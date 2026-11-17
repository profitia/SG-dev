import test from 'node:test';import assert from 'node:assert/strict';
import {usableMemory} from '../src/memory.mjs';
const principal={environment:'development',internalUserId:'user-a',organisationIds:[],usePurpose:'CUSTOMER_SERVICE'};
const now=Date.parse('2026-11-11T12:00:00Z'),rights={classification:'UNKNOWN',purpose:'PRIVATE',organisationConstraintId:null,quotingAllowed:true,apiExcerptAllowed:true};
const source={id:'source',scope:'ACCOUNT_PRIVATE',ownerUserId:'user-a',ownerOrganisationId:null,environment:'development',status:'CURRENT',activeGenerationId:'g1',sourceVersion:1,rights};
const memory={scope:'ACCOUNT_PRIVATE',ownerUserId:'user-a',ownerOrganisationId:null,text:'A short supported preference',origin:'DOCUMENT',sourceRefs:[{sourceId:'source',generationId:'g1',sourceVersion:'1'}],expiresAt:new Date(now+10000).toISOString()};
const options={principal,accountState:{user_id:'user-a',memory_enabled:true,consent_version:'pk-memory-opt-in-v1',consent_at:new Date(now).toISOString()},sources:[source],now};
test('prepared memory eligibility needs opt-in, current owner and every source restriction',()=>{
 assert.equal(usableMemory(memory,options),true);
 for(const changes of [{accountState:{...options.accountState,memory_enabled:false}},{accountState:{...options.accountState,deleted_at:'now'}},{principal:{...principal,internalUserId:'user-b'}},{sources:[]},{sources:[{...source,activeGenerationId:'g2'}]},{sources:[{...source,revokedAt:'now'}]},{sources:[{...source,rights:{...rights,organisationConstraintId:'former-org'}}]}])assert.equal(usableMemory(memory,{...options,...changes}),false);
 assert.equal(usableMemory({...memory,sourceRefs:[],origin:'DOCUMENT'},options),false);assert.equal(usableMemory({...memory,sourceRefs:[],origin:'USER_EXPLICIT'},options),true);
});

test('short business rejection survives Root rollback, while an audit failure remains unavailable',async()=>{
 const {createAuthority}=await import('../src/auth.mjs'),{Fault}=await import('../src/store.mjs');
 const {KNOWLEDGE_E1_CONTRACT}=await import('@profitia/platform-current-e1-authority/knowledge');
 const origin='https://platform-knowledge-development-api.onrender.com',release='a'.repeat(40),sourceId='11111111-aaaa-4111-8111-111111111111';
 const binding={applicationId:'platform-knowledge-development-api',environment:'development',projectId:'sparkling-sky-79692560',branchId:'br-billowing-grass-b9ko5s4f',databaseName:'platform_knowledge',role:'platform_knowledge_api',deploymentId:release,knowledgeSchemaDigest:'c'.repeat(64)};
 const p={environment:'development',internalUserId:'11111111-1111-4111-8111-111111111111',organisationIds:[],allowedScopes:['PROFITIA_SHARED'],sharedKnowledgeAllowed:true,operator:true,publishBindingStandard:false,usePurpose:'PROFITIA_INTERNAL'};
 const previous=globalThis.fetch;
 try{for(const failAudit of [false,true]){
  let rolledBack=false;
  const query=async(sql,values)=>{
   if(sql.includes('authority_descriptor'))return{rows:[{database_name:'platform_knowledge',role_name:binding.role,login:binding.role,rolsuper:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,owner_member:false,descriptor:{contract:KNOWLEDGE_E1_CONTRACT,binding,kind:'API',origin,authorityOrigin:'https://identity.synthetic.test'}}]};
   if(sql.includes('txid_current'))return{rows:[{id:'41'}]};
   if(sql.includes('FROM platform_knowledge.sources'))return{rows:[{id:sourceId,scope:'PROFITIA_SHARED',owner_user_id:null,owner_organisation_id:null,published_at:null,revision:1}]};
   if(sql.includes('INSERT INTO platform_knowledge.audit')&&failAudit&&values[0]==='E1_FAILURE')throw Error('SYNTHETIC_AUDIT_FAILURE');
   if(sql==='ROLLBACK')rolledBack=true;
   return{rows:[]};
  };
  const pool={query,connect:async()=>({query,release(){}})};
  globalThis.fetch=async(_url,init)=>{const input=JSON.parse(init.body);return Response.json({contract:KNOWLEDGE_E1_CONTRACT,nonce:input.nonce,binding,principal:p,operation:input.operation,resourceId:input.resourceId,scopes:input.scopes,grantFingerprint:'b'.repeat(64),expiresAt:new Date(Date.now()+10000).toISOString()});};
  const authority=createAuthority({config:{role:'api',environment:'development',release},pool,env:{}});
  await assert.rejects(authority.execute(new Request(origin+'/v1/sources/'+sourceId+'/publish',{headers:{authorization:'Bearer SYNTHETIC_ONLY'}}),{operation:'document.publish',resourceId:sourceId,scopes:['PROFITIA_SHARED'],requestDigest:'d'.repeat(64),delegation:null},async()=>{throw new Fault(409,'SOURCE_NOT_PUBLISHABLE');}),error=>error instanceof Fault&&error.status===(failAudit?503:409));
  assert.equal(rolledBack,true);
 }}finally{globalThis.fetch=previous;}
});
