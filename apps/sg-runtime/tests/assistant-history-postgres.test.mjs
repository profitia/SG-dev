// Isolated PostgreSQL only. No product connection, provider or customer data.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto'
import pg from '../../architecture-lab/node_modules/pg/lib/index.js'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {createAssistantHistory} from '../lib/assistant/history.ts'
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
test('real ordinary history role persists across connections, isolates the pilot, serialises turns and deletes expired content',async()=>{
 const url=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const admin=new pg.Client({connectionString:url});await admin.connect()
 const owner='sg2_assistant_history_owner',role='sg2_assistant_history_runtime',password='SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL'
 let database,pool,created=false
 try{
  assert.equal((await admin.query("SELECT 1 FROM pg_database WHERE datname='neondb'")).rowCount,0,'never adopt an existing database')
  for(const r of [owner,role])await admin.query('CREATE ROLE '+r+' '+(r===owner?'NOLOGIN':"LOGIN PASSWORD '"+password+"'")+' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE')
  await admin.query('CREATE DATABASE neondb');created=true
  const dbUrl=new URL(url);dbUrl.pathname='/neondb';database=new pg.Client({connectionString:dbUrl.href});await database.connect()
  await database.query('CREATE EXTENSION pgcrypto');await database.query('GRANT CREATE ON DATABASE neondb TO '+owner)
  const source=fs.readFileSync(new URL('../migrations/assistant/001-history.sql',import.meta.url),'utf8'),schemaDigest=createHash('sha256').update(source).digest('hex'),key=randomBytes(32)
  const asOwner=async action=>{await database.query('BEGIN');try{await database.query('SET LOCAL ROLE '+owner);const value=await action(database);await database.query('COMMIT');return value}catch(e){await database.query('ROLLBACK');throw e}}
  await asOwner(async c=>{
   await c.query(source.replaceAll('__ASSISTANT_HISTORY_SCHEMA_DIGEST__',schemaDigest))
   await c.query("INSERT INTO sg2_assistant_history.installation VALUES(true,$1,'development','spendguru','autumn-waterfall-65938876','br-dry-hall-b294222f',$2,$3,'SYNTHETIC_ONLY')",[schemaDigest,key,U])
  })
  dbUrl.username=role;dbUrl.password=password;pool=new pg.Pool({connectionString:dbUrl.href,max:3,connectionTimeoutMillis:3000})
  const signed=(action,payload={},userId=U)=>JSON.stringify({...payload,action,userId,contract:'1.0.0',schemaDigest,until:Date.now()+10000})
  const call=async(action,payload={},userId=U)=>{
   const body=signed(action,payload,userId),proof=createHmac('sha256',key).update(body).digest('hex')
   return(await pool.query('SELECT sg2_assistant_history.apply($1,$2) AS result',[body,proof])).rows[0].result
  }
  const attacker=await pool.connect();
  try{
   await attacker.query('CREATE TEMP TABLE installation(singleton boolean,schema_digest text,environment text,application_id text,project_id text,branch_id text,command_key bytea,pilot_user_id uuid,source_ref text)');
   await attacker.query('GRANT SELECT ON pg_temp.installation TO sg2_assistant_history_owner');
   const forgedKey=Buffer.alloc(32,17);
   await attacker.query("INSERT INTO pg_temp.installation VALUES(true,$1,'development','spendguru','autumn-waterfall-65938876','br-dry-hall-b294222f',$2,$3,'SYNTHETIC_TEMP_SHADOW_ONLY')",[schemaDigest,forgedKey,V]);
   const body=signed('LIST',{},V),proof=createHmac('sha256',forgedKey).update(body).digest('hex');
   await assert.rejects(()=>attacker.query('SELECT sg2_assistant_history.apply($1,$2)',[body,proof]),/HISTORY_UNAVAILABLE/,'temporary tables cannot replace the real private-history owner or HMAC key');
   assert.equal((await attacker.query('SELECT sg2_assistant_history.descriptor() AS binding')).rows[0].binding.userId,U);
   await attacker.query('DROP TABLE pg_temp.installation');
  }finally{attacker.release()}
  for(const sql of ['SELECT * FROM sg2_assistant_history.turns',"UPDATE sg2_assistant_history.installation SET pilot_user_id='"+V+"'",'SET ROLE '+owner])await assert.rejects(()=>pool.query(sql),e=>e.code==='42501')
  const descriptor=(await pool.query('SELECT sg2_assistant_history.descriptor() AS binding')).rows[0].binding
  assert.equal(descriptor.runtimeRole,role);assert.equal(descriptor.schemaDigest,schemaDigest);assert.equal(descriptor.userId,U)
  await assert.rejects(()=>pool.query('SELECT sg2_assistant_history.apply($1,$2)',[signed('LIST'),'forged']),/HISTORY_UNAVAILABLE/)
  await assert.rejects(()=>call('LIST',{},V),/HISTORY_UNAVAILABLE/,'even a valid signature cannot enrol a second pilot')
  const commandId=randomUUID(),begin={conversationId:null,commandId,message:'SYNTHETIC question',locale:'pl',scopes:[],expectedRevision:null}
  const first=await call('BEGIN',begin),id=first.conversationId
  assert.equal(first.status,'NEW');assert.equal((await call('BEGIN',begin)).status,'REPLAY')
  await assert.rejects(()=>call('BEGIN',{...begin,message:'changed meaning'}),/HISTORY_CONFLICT/)
  await assert.rejects(()=>call('LOAD',{conversationId:id},V),/HISTORY_UNAVAILABLE/)
  await assert.rejects(()=>call('LOAD',{conversationId:randomUUID()}),/HISTORY_UNAVAILABLE/)
  await call('COMPLETE',{conversationId:id,commandId,response:'SYNTHETIC answer',sources:[]})
  await call('COMPLETE',{conversationId:id,commandId,response:'SYNTHETIC answer',sources:[]})
  await assert.rejects(()=>call('COMPLETE',{conversationId:id,commandId,response:'changed receipt',sources:[]}),/HISTORY_CONFLICT/)
  // A fresh physical connection reads the saved turn; no component memory or
  // browser storage participates in this persistence assertion.
  const second=new pg.Client({connectionString:dbUrl.href});await second.connect()
  try{
   const body=signed('LOAD',{conversationId:id}),proof=createHmac('sha256',key).update(body).digest('hex')
   const stored=(await second.query('SELECT sg2_assistant_history.apply($1,$2) AS result',[body,proof])).rows[0].result
   assert.equal(stored.turns.length,1);assert.equal(stored.turns[0].message,'SYNTHETIC question');assert.equal(stored.turns[0].response,'SYNTHETIC answer')
   assert.equal(stored.revision,2)
  }finally{await second.end()}
  const competing=await Promise.allSettled([1,2].map(n=>call('BEGIN',{...begin,conversationId:id,commandId:randomUUID(),message:'SYNTHETIC competing '+n,expectedRevision:2})))
  assert.equal(competing.filter(r=>r.status==='fulfilled').length,1);assert.equal(competing.filter(r=>r.status==='rejected').length,1)
  assert.equal((await call('LOAD',{conversationId:id})).turns.length,2)
  const history=createAssistantHistory({commandKey:key.toString('hex'),schemaDigest,query:(sql,params)=>pool.query(sql,params)})
  const context={applicationId:'spendguru',environment:'development',actorId:U,actor:{kind:'HUMAN',actorId:U},organisationId:null,operation:'assistant.history.read'}
  const preview=await history.load(context,id,true)
  assert.equal(preview.turns.length,1);assert.equal(preview.turns[0].message,'SYNTHETIC question')
  assert.equal(preview.turns[0].response,'');assert.deepEqual(preview.turns[0].sources,[])
  assert.equal((await call('LOAD',{conversationId:id})).turns[0].response,'SYNTHETIC answer','preview does not rewrite saved content')
  await assert.rejects(()=>history.load({...context,actorId:V,actor:{kind:'HUMAN',actorId:V}},id,true),e=>e.code==='DENIED')
  await call('DELETE',{conversationId:id});assert.deepEqual((await call('LIST')).items,[])
  await assert.rejects(()=>call('LOAD',{conversationId:id}),/HISTORY_UNAVAILABLE/)
  // The admitted schema already stores opaque source references within its
  // four-source cap. Prove ECR works through the real ordinary role unchanged.
  const ecrReference={version:'2.1.0',source:'ECONOMIC_CALENDAR',from:'2026-11-01T00:00:00.000Z',to:'2026-11-30T23:59:59.999Z',targetType:null,targetId:null,asKnownAt:null,after:null}
  const ecrScope={source:'ECONOMIC_CALENDAR',organisationId:'11111111-1111-4111-8111-111111111111',reference:ecrReference,sourceVersion:'e'.repeat(64),requiredRecordIds:['E:ecr_evt_'+'a'.repeat(64)]}
  const ecrCommand=randomUUID(),ecr=await call('BEGIN',{...begin,commandId:ecrCommand,message:'SYNTHETIC_ONLY ECR',scopes:[ecrScope]})
  await call('COMPLETE',{conversationId:ecr.conversationId,commandId:ecrCommand,response:'SYNTHETIC_ONLY ECR context',sources:[{id:'ECONOMIC_CALENDAR',label:'ECR',asOf:null,status:'PARTIAL'}]})
  const ecrStored=await history.load(context,ecr.conversationId)
  assert.deepEqual(ecrStored.turns[0].scopes[0].reference,ecrReference);assert.deepEqual(ecrStored.turns[0].scopes[0].requiredRecordIds,ecrScope.requiredRecordIds)
  await assert.rejects(()=>call('LOAD',{conversationId:ecr.conversationId},V),/HISTORY_UNAVAILABLE/)
  await assert.rejects(()=>call('BEGIN',{...begin,commandId:randomUUID(),scopes:Array(5).fill(ecrScope)}),/HISTORY_UNAVAILABLE/,'ECR does not expand the admitted four-source boundary')
  await call('DELETE',{conversationId:ecr.conversationId})
  const expiring=await call('BEGIN',{...begin,commandId:randomUUID()})
  await asOwner(c=>c.query("UPDATE sg2_assistant_history.conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[expiring.conversationId]))
  await pool.query('SELECT sg2_assistant_history.prune()')
  assert.equal(Number((await asOwner(c=>c.query('SELECT count(*) AS n FROM sg2_assistant_history.conversations'))).rows[0].n),0)
  assert.equal(Number((await asOwner(c=>c.query('SELECT count(*) AS n FROM sg2_assistant_history.turns'))).rows[0].n),0)
 }finally{await pool?.end();await database?.end();if(created)await admin.query('DROP DATABASE neondb WITH (FORCE)');await admin.end()}
})
