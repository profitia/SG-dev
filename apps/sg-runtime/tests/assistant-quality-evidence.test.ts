// Controlled synthetic PostgreSQL and encryption qualification only.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto'
import pg from '../../architecture-lab/node_modules/pg/lib/index.js'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {createQualityEvidenceStore,createQualityEvidencePurposeClient,createAssistantQualityCapture,createQualityHistoryContainment,type QualityEvidenceAuthority} from '../lib/assistant/quality-evidence'
const hash=(s:string)=>createHash('sha256').update(s).digest('hex')
test('native QA roles isolate encrypted controlled evidence, preserve fixed expiry, require fresh purpose and retain deletion/recovery barriers',async()=>{
 const ownerUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const admin=new pg.Client({connectionString:ownerUrl});await admin.connect()
 const owner='sg2_assistant_history_owner',captureRole='sg2_assistant_quality_capture',readerRole='sg2_assistant_quality_reader'
 const historyRole='sg2_assistant_history_runtime',password='SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL'
 const accountId=randomUUID(),interactionId=randomUUID(),evidenceId=randomUUID(),generation=randomUUID(),serviceId=randomUUID(),grantId=randomUUID()
 const captureKey=randomBytes(32).toString('hex'),readerKey=randomBytes(32).toString('hex'),storageKey=randomBytes(32).toString('hex')
 const now=Date.now(),stamp=(n:number)=>new Date(n).toISOString()
 const purpose={id:'ASSISTANT_QUALITY' as const,policyVersion:'1.0.0',grantId,validUntil:stamp(now+7200000)}
 let database:any,capture:any,reader:any,created=false,revoked=false,checks=0,clock=now
 const source=readFileSync(new URL('../migrations/002-assistant-quality-evidence.sql',import.meta.url),'utf8'),schemaDigest=hash(source)
 const reference={version:'1.1.0',source:'BENCHMARK_CHART',seriesId:'qa_synthetic',from:'2026-01-01',to:'2026-02-01',range:'1Y',fingerprint:'a'.repeat(64)}
 const sourceScopes=[{source:'BENCHMARK_CHART',organisationId:randomUUID(),classification:'SHARED_KNOWLEDGE',sourceVersion:'a'.repeat(64),rightsVersion:'controlled-test-v1',validUntil:stamp(now+7200000),status:'OK',reference}]
 const value={schemaVersion:'QA_EVIDENCE_V1',evidenceId,interactionId,accountId,applicationId:'spendguru',environment:'development',
  occurredAt:stamp(now-1000),earliestInputAt:stamp(now-2000),timeZone:'Europe/Warsaw',interpretedPeriod:null,purpose,
  versions:{applicationSha:'a'.repeat(40),model:'controlled-fixture',promptSha256:'b'.repeat(64),modelConfigurationSha256:'c'.repeat(64),cicVersion:'1.8.0',gatewayVersion:'2.2.0'},
  sourceScopes,modelInput:[{role:'user',content:'SYNTHETIC_PRIVATE_QA_QUESTION'}],
  output:{draft:'SYNTHETIC_PRIVATE_QA_DRAFT',delivered:'SYNTHETIC_PRIVATE_QA_DELIVERED',status:'COMPLETE'},expiresAt:stamp(now+3600000)}
 const authorize=(role:string)=>async(demand:any):Promise<QualityEvidenceAuthority>=>{
  checks++;if(revoked)throw Error('Synthetic current purpose revoked')
  return {applicationId:'spendguru',environment:'development',operation:role===captureRole?'assistant.quality.capture':'assistant.quality.read',
   actorKind:role===captureRole?'HUMAN':'SERVICE',actorId:role===captureRole?accountId:serviceId,accountId,
   purpose,sourceScopes:sourceScopes as any,storageGeneration:generation,validUntil:clock+10000}
 }
 try{
  assert.equal((await admin.query("SELECT 1 FROM pg_database WHERE datname='neondb'")).rowCount,0,'never adopt an existing database')
  for(const role of [owner,historyRole,captureRole,readerRole])
   await admin.query('CREATE ROLE '+role+' '+(role===owner?'NOLOGIN':"LOGIN PASSWORD '"+password+"'")+' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE')
  await admin.query('CREATE DATABASE neondb');created=true
  const url=new URL(ownerUrl);url.pathname='/neondb';database=new pg.Client({connectionString:url.href});await database.connect()
  await database.query('CREATE EXTENSION pgcrypto');await database.query('GRANT CREATE ON DATABASE neondb TO '+owner)
  const asOwner=async(action:(c:any)=>Promise<unknown>)=>{await database.query('BEGIN');try{await database.query('SET LOCAL ROLE '+owner);await action(database);await database.query('COMMIT')}catch(e){await database.query('ROLLBACK');throw e}}
  await asOwner(async c=>{
   const h=readFileSync(new URL('../migrations/assistant/001-history.sql',import.meta.url),'utf8')
   await c.query(h.replaceAll('__ASSISTANT_HISTORY_SCHEMA_DIGEST__',hash(h)))
   await c.query("INSERT INTO sg2_assistant_history.installation VALUES(true,$1,'development','spendguru','autumn-waterfall-65938876','br-dry-hall-b294222f',$2,$3,'SYNTHETIC_ONLY')",[hash(h),randomBytes(32),accountId])
   const conversation=(await c.query("INSERT INTO sg2_assistant_history.conversations(user_id,locale) VALUES($1,'pl') RETURNING id",[accountId])).rows[0].id
   await c.query("INSERT INTO sg2_assistant_history.turns(conversation_id,user_id,command_id,message,response,status,scopes) VALUES($1,$2,$3,'SYNTHETIC_PRIVATE_QA_QUESTION','SYNTHETIC_PRIVATE_QA_DELIVERED','COMPLETE','[]')",[conversation,accountId,interactionId])
   await c.query(source.replaceAll('__QUALITY_EVIDENCE_SCHEMA_DIGEST__',schemaDigest))
   await c.query("INSERT INTO sg2_assistant_quality_evidence.installation VALUES(true,$1,$2,$3,false,'SYNTHETIC_ONLY')",[schemaDigest,generation,accountId])
   for(const [role,key]of [[captureRole,captureKey],[readerRole,readerKey]])
    await c.query('INSERT INTO sg2_assistant_quality_evidence.credentials VALUES($1,$2,$3)',[role,serviceId,Buffer.from(key,'hex')])
  })
  url.username=captureRole;url.password=password;capture=new pg.Client({connectionString:url.href});await capture.connect()
  url.username=readerRole;reader=new pg.Client({connectionString:url.href});await reader.connect()
  const seen:string[]=[]
  const store=(role:string,client:any,commandKey:string,extra:Record<string,unknown>={})=>createQualityEvidenceStore({
   query:async(sql,values)=>{seen.push(String(values?.[0]));return client.query(sql,values)},commandKey,storageKey,schemaDigest,serviceId,storageGeneration:generation,
   role:role as any,authorize:authorize(role),now:()=>clock,...extra})
  const write=store(captureRole,capture,captureKey),read=store(readerRole,reader,readerKey)
  assert.equal((await write.descriptor()).enabled,false)
  await assert.rejects(()=>write.capture(value),'disabled installation cannot capture')
  await asOwner(c=>c.query('UPDATE sg2_assistant_quality_evidence.installation SET enabled=true'))
  await write.capture(value);await write.capture(value)
  assert(seen.every(s=>!s.includes('SYNTHETIC_PRIVATE_QA_')),'only authenticated ciphertext and metadata reach SQL')
  assert.deepEqual(await read.read(accountId,evidenceId),value)
  assert(checks>=4,'capture/read/publication checks are fresh')
  const direct=(client:any,key:string,action:string,payload:Record<string,unknown>)=>{
   const body=JSON.stringify({contract:'QualityEvidenceStore/1.0.0',action,...payload,schemaDigest,serviceId,storageGeneration:generation,until:Date.now()+10000})
   return client.query('SELECT sg2_assistant_quality_evidence.apply($1,$2)',[body,createHmac('sha256',Buffer.from(key,'hex')).update(body).digest('hex')])
  }
  await assert.rejects(()=>direct(capture,captureKey,'GET',{accountId,evidenceId}),/QA_EVIDENCE_UNAVAILABLE/)
  await assert.rejects(()=>direct(reader,readerKey,'GET',{accountId:randomUUID(),evidenceId}),/QA_EVIDENCE_UNAVAILABLE/)
  for(const sql of ['SELECT * FROM sg2_assistant_quality_evidence.evidence','SELECT * FROM sg2_assistant_quality_evidence.credentials','SET ROLE '+owner])
   await assert.rejects(()=>reader.query(sql),e=>e.code==='42501')
  await assert.rejects(()=>store(readerRole,reader,captureKey).read(accountId,evidenceId))
  await assert.rejects(()=>store(readerRole,reader,readerKey,{storageKey:randomBytes(32).toString('hex')}).read(accountId,evidenceId))
  await assert.rejects(()=>store(readerRole,reader,readerKey,{storageGeneration:randomUUID()}).read(accountId,evidenceId))
  revoked=true;await assert.rejects(()=>read.read(accountId,evidenceId));revoked=false
  const changed={...value,output:{...value.output,delivered:'CHANGED_SYNTHETIC_RESULT'}}
  await assert.rejects(()=>write.capture(changed),'idempotency never replaces content')
  const concurrentId=randomUUID(),results=await Promise.allSettled([value,changed].map(v=>write.capture({...v,evidenceId:concurrentId})))
  assert.equal(results.filter(v=>v.status==='fulfilled').length,1)
  await asOwner(c=>c.query("UPDATE sg2_assistant_quality_evidence.evidence SET sealed=jsonb_set(sealed,'{tag}',to_jsonb('AAAAAAAAAAAAAAAAAAAAAA=='::text)) WHERE evidence_id=$1",[evidenceId]))
  await assert.rejects(()=>read.read(accountId,evidenceId),'authenticated encryption rejects tampering')
  await asOwner(c=>c.query('DELETE FROM sg2_assistant_history.turns WHERE user_id=$1 AND command_id=$2',[accountId,interactionId]))
  await assert.rejects(()=>read.read(accountId,concurrentId),'history deletion removes QA by native foreign key cascade')
  await assert.rejects(()=>write.capture(value),'removed history cannot be resurrected by retry')
  assert.equal(await read.purge(),0)
 }finally{
  if(capture)await capture.end();if(reader)await reader.end();if(database)await database.end()
  if(created)await admin.query('DROP DATABASE neondb WITH (FORCE)')
  for(const role of [readerRole,captureRole,historyRole,owner])await admin.query('DROP ROLE IF EXISTS '+role)
  await admin.end()
 }
})


test('canonical QA purpose client binds the native role, exact input digest, current HUMAN decision and metadata-only HMAC',async()=>{
 const now=Date.now(),accountId=randomUUID(),serviceId=randomUUID(),storageGeneration=randomUUID(),evidenceId=randomUUID(),grantId=randomUUID(),schemaDigest='a'.repeat(64),commandKey=randomBytes(32).toString('hex')
 const context:any={applicationId:'spendguru',environment:'development',operation:'assistant.history.write',organisationId:null,decisionId:randomUUID(),actorId:accountId,actor:{kind:'HUMAN',actorId:accountId,expiresAt:new Date(now+30000).toISOString()}}
 const demand:any={action:'CAPTURE',accountId,evidenceId,inputSha256:hash('controlled public model input'),sourceScopes:[],occurredAt:new Date(now-100).toISOString(),earliestInputAt:new Date(now-200).toISOString()}
 let calls=0,override:Record<string,unknown>={}
 const factory=(role:'sg2_private_development_runtime'|'sg2_assistant_quality_authority')=>createQualityEvidencePurposeClient({commandKey,schemaDigest,serviceId,storageGeneration,role,now:()=>now,
  query:async(sql,values)=>{
   calls++;assert.equal(sql,'SELECT profitia_assistant_quality_access.apply($1::text,$2::text) AS result')
   const body=String(values?.[0]);assert.equal(values?.[1],createHmac('sha256',Buffer.from(commandKey,'hex')).update(body).digest('hex'))
   assert(!body.includes('controlled public model input'),'the native authority receives the input hash, never the prompt')
   const p=JSON.parse(body);assert.equal(p.serviceId,serviceId);assert.equal(p.storageGeneration,storageGeneration)
   const result={applicationId:'spendguru',environment:'development',projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',runtimeRole:role,schemaDigest,serviceId,storageGeneration,dataMode:'CONTROLLED_ACCEPTANCE',
    operation:p.action==='CAPTURE'?'assistant.quality.capture':'assistant.quality.read',actorKind:p.action==='CAPTURE'?'HUMAN':'SERVICE',actorId:p.action==='CAPTURE'?accountId:serviceId,accountId,
    purpose:{id:'ASSISTANT_QUALITY',policyVersion:'1.0.0',grantId,validUntil:new Date(now+3600000).toISOString()},validUntil:now+10000,sourceScopes:[],inputSha256:demand.inputSha256,expiresAt:new Date(now+3600000).toISOString(),invalidated:true,epoch:'2',...override}
   return {rows:[{result}]}
  }})
 const capture=factory('sg2_private_development_runtime'),read=factory('sg2_assistant_quality_authority')
 assert.equal((await capture.authorize(demand,context)).actorId,accountId)
 assert.equal((await read.authorize({action:'READ',accountId,evidenceId})).actorId,serviceId)
 const before=calls
 for(const changed of [{actorId:randomUUID()},{organisationId:randomUUID()},{decisionId:'invalid'},{actor:{...context.actor,kind:'SERVICE'}},{actor:{...context.actor,expiresAt:new Date(now-1).toISOString()}}])
  await assert.rejects(capture.authorize(demand,{...context,...changed}))
 await assert.rejects(capture.authorize({...demand,inputSha256:undefined},context))
 await assert.rejects(read.authorize(demand,context));await assert.rejects(read.authorize({action:'READ',accountId,evidenceId},context))
 await assert.rejects(read.invalidate(context));assert.equal(calls,before,'invalid identities never query the authority')
 assert.equal((await capture.invalidate(context)).invalidated,true)
 for(const changed of [{runtimeRole:'owner'},{storageGeneration:randomUUID()},{branchId:'foreign'},{serviceId:randomUUID()},{dataMode:'ALL_REAL_HISTORY'},
  {inputSha256:'b'.repeat(64)},{expiresAt:'invalid'},{validUntil:now+30001},{purpose:{id:'ASSISTANT_QUALITY',policyVersion:'1.0.0',grantId,validUntil:'invalid'}}]){
  override=changed;await assert.rejects(capture.authorize(demand,context))
 }
})

test('host capture composes independently enrolled authority with encrypted persistence and never accepts caller-supplied rights',async()=>{
 const now=Date.now(),accountId=randomUUID(),interactionId=randomUUID(),serviceId=randomUUID(),storageGeneration=randomUUID(),grantId=randomUUID()
 const purposeKey=randomBytes(32).toString('hex'),evidenceKey=randomBytes(32).toString('hex'),storageKey=randomBytes(32).toString('hex')
 const context:any={applicationId:'spendguru',environment:'development',operation:'assistant.history.write',organisationId:null,decisionId:randomUUID(),actorId:accountId,actor:{kind:'HUMAN',actorId:accountId,expiresAt:new Date(now+30000).toISOString()}}
 const modelInput=[{role:'user' as const,content:'CONTROLLED_COMPOSITION_PRIVATE_INPUT'}],inputHash=hash(JSON.stringify(modelInput)),purposeDigest='a'.repeat(64),evidenceDigest='b'.repeat(64)
 const operations:any[]=[],purpose={id:'ASSISTANT_QUALITY',policyVersion:'1.0.0',grantId,validUntil:new Date(now+3600000).toISOString()}
 let allowed=true
 const capture=createAssistantQualityCapture({accountId,serviceId,storageGeneration,purposeKey,evidenceKey,storageKey,purposeSchemaDigest:purposeDigest,evidenceSchemaDigest:evidenceDigest,now:()=>now,
  purposeQuery:async(sql,values)=>{
   const body=String(values?.[0]),p=JSON.parse(body);assert.equal(values?.[1],createHmac('sha256',Buffer.from(purposeKey,'hex')).update(body).digest('hex'))
   assert(!body.includes('CONTROLLED_COMPOSITION_PRIVATE_INPUT'));assert.equal(p.inputSha256,inputHash);assert.equal(p.decisionId,context.decisionId);operations.push(p)
   if(!allowed)throw Error('Synthetic authority refused')
   return{rows:[{result:{applicationId:'spendguru',environment:'development',projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',runtimeRole:'sg2_private_development_runtime',schemaDigest:purposeDigest,serviceId,storageGeneration,dataMode:'CONTROLLED_ACCEPTANCE',
    operation:'assistant.quality.capture',actorKind:'HUMAN',actorId:accountId,accountId,purpose,validUntil:now+10000,sourceScopes:[],inputSha256:inputHash,expiresAt:new Date(now+3500000).toISOString()}}]}
  },
  evidenceQuery:async(sql,values)=>{
   const body=String(values?.[0]),p=JSON.parse(body);assert.equal(values?.[1],createHmac('sha256',Buffer.from(evidenceKey,'hex')).update(body).digest('hex'))
   assert(!body.includes('CONTROLLED_COMPOSITION_PRIVATE_'));assert.equal(p.action,'PUT');assert(p.sealed?.ciphertext);operations.push(p)
   return{rows:[{result:{applicationId:'spendguru',environment:'development',projectId:'autumn-waterfall-65938876',branchId:'br-dry-hall-b294222f',databaseName:'neondb',runtimeRole:'sg2_assistant_quality_capture',schemaDigest:evidenceDigest,serviceId,storageGeneration,stored:true}}]}
  }})
 const input:any={accountId,interactionId,occurredAt:new Date(now-100).toISOString(),earliestInputAt:new Date(now-200).toISOString(),timeZone:'Europe/Warsaw',interpretedPeriod:null,
  versions:{applicationSha:'a'.repeat(40),model:'CONTROLLED_FIXTURE',promptSha256:'b'.repeat(64),modelConfigurationSha256:'c'.repeat(64),cicVersion:'1.8.0',gatewayVersion:'2.2.0'},modelInput,output:{draft:'CONTROLLED_COMPOSITION_PRIVATE_DRAFT',delivered:'CONTROLLED_COMPOSITION_PRIVATE_DELIVERED',status:'COMPLETE'}}
 const result=await capture.capture(context,input);assert.equal(result.evidenceId,interactionId)
 assert.deepEqual(operations.map(p=>p.action),['CAPTURE','CAPTURE','PUT']);assert.equal(operations[0].sourceScopes,null);assert.deepEqual(operations[1].sourceScopes,[])
 allowed=false;const count=operations.length;await assert.rejects(capture.capture(context,input));assert.equal(operations.length,count+1,'refused purpose never reaches persistence')
 await assert.rejects(capture.capture(context,{...input,accountId:randomUUID()}));assert.equal(operations.length,count+1)
})

test('history containment needs no optional QA capture configuration and rejects wrong or expired HUMAN context',async()=>{
 const now=Date.now(),actorId=randomUUID(),decisionId=randomUUID(),context:any={applicationId:'spendguru',environment:'development',operation:'assistant.history.write',organisationId:null,actorId,decisionId,actor:{kind:'HUMAN',actorId,expiresAt:new Date(now+10000).toISOString()}}
 let calls=0,override:Record<string,unknown>={}
 const containment=createQualityHistoryContainment(async(sql,values)=>{
  calls++
  if(sql.startsWith('SELECT current_database()'))return {rows:[{database_name:'platform_private',role:'sg2_private_development_runtime',login:'sg2_private_development_runtime',installed:true}]}
  assert.equal(sql,'SELECT profitia_assistant_quality_access.invalidate_history($1::uuid) AS result');assert.deepEqual(values,[decisionId])
  return {rows:[{result:{applicationId:'spendguru',environment:'development',projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',runtimeRole:'sg2_private_development_runtime',containmentVersion:'QUALITY_HISTORY_CONTAINMENT_V1',accountId:actorId,invalidated:true,epoch:'2',...override}}]}
 },()=>now)
 await containment.ready();assert.equal((await containment.invalidate(context)).invalidated,true)
 const before=calls
 for(const change of [{operation:'assistant.converse'},{organisationId:randomUUID()},{decisionId:'invalid'},{actorId:randomUUID()},{actor:{...context.actor,kind:'SERVICE'}},{actor:{...context.actor,expiresAt:new Date(now-1).toISOString()}}])await assert.rejects(containment.invalidate({...context,...change}))
 assert.equal(calls,before,'invalid contexts never reach E1')
 for(const change of [{runtimeRole:'owner'},{accountId:randomUUID()},{branchId:'foreign'},{invalidated:false},{epoch:'0'},{containmentVersion:'foreign'}]){override=change;await assert.rejects(containment.invalidate(context))}
 await assert.rejects(createQualityHistoryContainment(async()=>({rows:[]})).ready())
 // The composition deliberately has no command key, storage key, capture role,
 // feature flag, selected QA account or capture service dependency.
})
