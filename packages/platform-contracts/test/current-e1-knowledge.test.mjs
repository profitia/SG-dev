import {test} from 'node:test';import assert from 'node:assert/strict';
import {createKnowledgeOperationHost,KNOWLEDGE_E1_CONTRACT} from '../current-e1-authority/knowledge.mjs';
import {readFile} from 'node:fs/promises';
import {randomUUID,generateKeyPairSync,sign,createHash} from 'node:crypto';
const origin='https://platform-knowledge-development-api.onrender.com',authority='https://identity.synthetic.test',user='11111111-1111-4111-8111-111111111111';
const binding={applicationId:'platform-knowledge-development-api',environment:'development',projectId:'sparkling-sky-79692560',branchId:'br-billowing-grass-b9ko5s4f',databaseName:'platform_knowledge',role:'platform_knowledge_api',deploymentId:'a'.repeat(40)};
const command={operation:'document.query',resourceId:'library',scopes:['ACCOUNT_PRIVATE'],requestDigest:'b'.repeat(64),delegation:null};
const principal={environment:'development',internalUserId:user,organisationIds:[],sharedKnowledgeAllowed:false,operator:false,usePurpose:'CUSTOMER_SERVICE'};
function ports(send){return {application:{applicationId:binding.applicationId,environment:'development',deploymentId:binding.deploymentId},independentQuery:async()=>({rows:[{database_name:binding.databaseName,role_name:binding.role,login:binding.role,descriptor:{contract:KNOWLEDGE_E1_CONTRACT,binding,kind:'API',origin,authorityOrigin:authority}}]}),fetch:send};}
test('only a live native-bound authority exchange mints scope; serialized ALLOW and ended work do not',async()=>{
 let calls=0,scope;
 const host=createKnowledgeOperationHost(ports(async(url,init)=>{calls++;assert.equal(url,authority+'/v1/e1/knowledge/human');assert.equal(init.redirect,'error');const input=JSON.parse(init.body);
  return Response.json({contract:KNOWLEDGE_E1_CONTRACT,nonce:input.nonce,binding,principal,grantFingerprint:'fp',expiresAt:new Date(Date.now()+10000).toISOString()});}));
 await host.execute(new Request(origin+'/v1/query',{headers:{authorization:'Bearer synthetic'}}),command,async s=>{scope=s;assert.equal(s.principal.internalUserId,user);
  assert.equal(host.authorizeProvider({scope:s,operation:'COGNITIVE',model:'gpt-6-luna',reservationMicrousd:100}),true);
  assert.throws(()=>host.authorizeProvider({scope:structuredClone(s),operation:'COGNITIVE',model:'gpt-6-luna'}));return{ok:true};});
 assert.equal(calls,2);assert.throws(()=>host.authorizeProvider({scope,operation:'COGNITIVE',model:'gpt-6-luna'}));
});
test('revoked final grant suppresses output; role/nonce/identity drift fails closed',async()=>{
 for(const drift of ['grant','nonce','identity','binding']){
  let calls=0;
  const host=createKnowledgeOperationHost(ports(async(_url,init)=>{calls++;const x=JSON.parse(init.body);return Response.json({contract:KNOWLEDGE_E1_CONTRACT,
   nonce:drift==='nonce'?'bad':x.nonce,binding:drift==='binding'?{...binding,role:'platform_knowledge_owner'}:binding,
   principal:drift==='identity'?{...principal,internalUserId:'browser-user'}:principal,
   grantFingerprint:drift==='grant'&&calls===2?'revoked':'fp',expiresAt:new Date(Date.now()+10000).toISOString()});}));
  await assert.rejects(host.execute(new Request(origin+'/v1/query',{headers:{authorization:'Bearer synthetic'}}),command,async()=>({private:'result'})));
 }
});

test('native central SQL admits exact private account only and revokes durable worker delegation',{skip:process.env.PK_E1_DATABASE_TESTS!=='1'},async()=>{
 const {currentE1Fixture,U,V}=await import('./fixtures/current-e1-authority-postgres.mjs');
 const f=await currentE1Fixture();
 try{
  await f.asOwner(0,async db=>{
   await db.query(await readFile(new URL('../current-e1-authority/migrations/015-knowledge-authority.sql',import.meta.url),'utf8'));
   await db.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('platform-knowledge-development-api','ACTIVE'),('platform-knowledge-development-worker','ACTIVE')");
   await db.query(`INSERT INTO profitia_e1_authority.knowledge_receivers(login_role,application_id,kind,binding,origin,authority_origin,issuer,authorized_parties,status,source_ref,expires_at)
    VALUES('platform_knowledge_api','platform-knowledge-development-api','API',$1,$2,$3,$4,$5,'ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')`,[JSON.stringify(binding),origin,f.authorityOrigin,f.issuer,[origin,f.origin]]);
   for(const operation of ['document.import','document.read','document.query'])await db.query(`INSERT INTO profitia_e1_authority.knowledge_grants(grant_id,user_id,scope,operation,effect,use_purpose,status,source_ref,expires_at)
    VALUES($1,$2,'ACCOUNT_PRIVATE',$3,'ALLOW','CUSTOMER_SERVICE','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')`,[randomUUID(),U,operation]);
  });
  f.clerkState.azp=origin;
  const make=(scopes=['ACCOUNT_PRIVATE'],delegation=null)=>({role:'platform_knowledge_api',nonce:'c'.repeat(64),operation:delegation?'document.import':'document.query',resourceId:'library',scopes,requestOrigin:origin,requestDigest:'d'.repeat(64),delegation});
  const human=new Request(f.authorityOrigin+'/v1/e1/knowledge/human',{headers:{authorization:'Bearer SYNTHETIC_A'}});
  const p=await f.authority.authorizeKnowledgeHuman(human,make());assert.equal(p.principal.internalUserId,U);assert.deepEqual(p.principal.allowedScopes,['ACCOUNT_PRIVATE']);
  await assert.rejects(f.authority.authorizeKnowledgeHuman(human,make(['PROFITIA_SHARED'])));
  await assert.rejects(f.authority.authorizeKnowledgeHuman(new Request(human.url,{headers:{authorization:'Bearer SYNTHETIC_B'}}),make()));
  f.clerkState.banned=true;await assert.rejects(f.authority.authorizeKnowledgeHuman(human,make()));f.clerkState.banned=false;
  const ids={jobId:randomUUID(),sourceId:randomUUID(),generationId:randomUUID(),scope:'ACCOUNT_PRIVATE',ownerUserId:null,rightsDigest:'e'.repeat(64),sourceVersion:1,maximumMicrousd:1000000};
  const admitted=await f.authority.authorizeKnowledgeHuman(human,make(['ACCOUNT_PRIVATE'],ids));assert.equal(admitted.delegation.sourceId,ids.sourceId);
  const pair=generateKeyPairSync('ed25519'),publicKey=pair.publicKey.export({type:'spki',format:'pem'}),workerBinding={...binding,applicationId:'platform-knowledge-development-worker',role:'platform_knowledge_worker'};
  await f.asOwner(0,db=>db.query(`INSERT INTO profitia_e1_authority.knowledge_receivers(login_role,application_id,kind,binding,origin,authority_origin,issuer,authorized_parties,key_id,public_key,status,source_ref,expires_at)
   VALUES('platform_knowledge_worker','platform-knowledge-development-worker','WORKER',$1,$2,$3,$4,$5,'synthetic-key',$6,'ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')`,[JSON.stringify(workerBinding),origin,f.authorityOrigin,f.issuer,[origin],publicKey]));
  const body={jobId:ids.jobId,delegationId:admitted.delegation.delegationId,nonce:'f'.repeat(64)};
  const issuedAt=Date.now(),payload=JSON.stringify({contract:KNOWLEDGE_E1_CONTRACT,role:'platform_knowledge_worker',keyId:'synthetic-key',targetOrigin:f.authorityOrigin,
   bodyDigest:createHash('sha256').update(JSON.stringify(body)).digest('hex'),issuedAt,expiresAt:issuedAt+15000});
  const input={consumerProof:{payload,signature:sign(null,Buffer.from(payload),pair.privateKey).toString('base64url')},...body};
  const worker=new Request(f.authorityOrigin+'/v1/e1/knowledge/worker');const job=await f.authority.authorizeKnowledgeWorker(worker,input);assert.equal(job.sourceId,ids.sourceId);assert.equal(job.principal.internalUserId,U);
  await f.asOwner(0,db=>db.query("UPDATE profitia_e1_authority.knowledge_grants SET status='REVOKED' WHERE user_id=$1 AND operation='document.import'",[U]));
  await assert.rejects(f.authority.authorizeKnowledgeWorker(worker,input));
 }finally{await f.close();}
});
