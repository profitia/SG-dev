import {createHash,createPrivateKey,createPublicKey,sign,verify,randomUUID,randomBytes} from 'node:crypto';
import {createAccessStore} from '@profitia/platform-contracts/access-store';
import {createClerkIdentityAuthenticator,createClerkAccountStatusReader} from '@profitia/platform-contracts/identity-provider';
export const KNOWLEDGE_E1_CONTRACT='profitia.current-e1-knowledge/1.0.0';
export const KNOWLEDGE_OPERATIONS=Object.freeze(['document.import','document.read','document.query','document.publish','document.withdraw','document.delete','memory.read','memory.write','memory.forget']);
const fail=()=>{throw Object.assign(Error('E1_KNOWLEDGE_UNAVAILABLE'),{reasonCode:'POLICY_UNAVAILABLE'});};
const deny=()=>{throw Object.assign(Error('E1_KNOWLEDGE_DENIED'),{reasonCode:'ACCESS_BASIS_INVALID'});};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const plain=(x,keys)=>x&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const https=v=>{try{const u=new URL(v);return u.origin===v&&u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v??'');
async function one(query,sql,args=[]){const r=await query(sql,args);if(r?.rows?.length!==1)fail();return r.rows[0];}
async function boundedJson(response){
 const reader=response.body?.getReader();if(!reader)fail();const parts=[];let size=0;
 try{for(;;){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>32768)fail();parts.push(x.value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(parts).toString());}catch{fail();}
}
/** Extension of the existing central Identity/E1 authority. Every human read
 * uses the canonical account binding + fresh Clerk session/account. Grants
 * reside solely in that authority; no directory/grant mirror in PK. */
export function createKnowledgeAuthority({query,client,binding,now=Date.now}){
 if(binding?.applicationId!=='identity-runtime-development'||binding.environment!=='development')throw TypeError('Existing Identity authority required');
 const access=createAccessStore({binding,now});
 async function receiver(role){const r=(await one(query,'SELECT profitia_e1_authority.knowledge_receiver($1) AS receiver',[role])).receiver;if(!r)deny();return r;}
 async function human(request,input){
  if(!(request instanceof Request)||request.headers.has('cookie')||request.headers.has('origin')||!/^Bearer [\x21-\x7e]{1,16384}$/.test(request.headers.get('authorization')??''))deny();
  if(!plain(input,['role','nonce','operation','resourceId','scopes','requestOrigin','requestDigest','delegation']))deny();
  if(!KNOWLEDGE_OPERATIONS.includes(input.operation)||!Array.isArray(input.scopes)||!input.scopes.length||input.scopes.length>2
    ||new Set(input.scopes).size!==input.scopes.length||input.scopes.some(s=>!['ACCOUNT_PRIVATE','PROFITIA_SHARED'].includes(s))
    ||!/^[a-f0-9]{64}$/.test(input.nonce)||!/^[a-f0-9]{64}$/.test(input.requestDigest)||typeof input.resourceId!=='string'||input.resourceId.length>200)deny();
  const r=await receiver(input.role);if(r.kind!=='API'||r.origin!==input.requestOrigin)deny();
  let identity;
  const authenticate=createClerkIdentityAuthenticator({client,application:{appId:r.applicationId,environment:'development',issuer:r.issuer,authorizedParties:r.authorizedParties,
   bearerPeerReads:r.authorizedParties.filter(sourceOrigin=>sourceOrigin!==r.origin).map(sourceOrigin=>({sourceOrigin,targetOrigin:r.origin,path:'/'}))},now,
   resolveBinding:async key=>{identity=structuredClone(key);return access.resolveBinding(query,key);}});
  const actor=await authenticate(new Request(r.origin+'/',{headers:{authorization:request.headers.get('authorization')}}));
  if(!actor||!identity)deny();
  const admission=(await one(query,'SELECT profitia_e1_authority.knowledge_human_issue($1,$2::jsonb,$3::jsonb,$4::jsonb) AS admission',[
   input.role,JSON.stringify(identity),JSON.stringify(actor),JSON.stringify(input)])).admission;
  if(!admission)deny();return admission;
 }
 async function worker(request,input){
  if(!(request instanceof Request)||request.headers.has('authorization')||request.headers.has('cookie')||request.headers.has('origin')
   ||!plain(input,['consumerProof','jobId','delegationId','nonce']))deny();
  const proof=input.consumerProof;if(!plain(proof,['payload','signature'])||typeof proof.payload!=='string'||proof.payload.length>4096)deny();
  let p;try{p=JSON.parse(proof.payload);}catch{deny();}
  if(!plain(p,['contract','role','keyId','targetOrigin','bodyDigest','issuedAt','expiresAt'])||p.contract!==KNOWLEDGE_E1_CONTRACT
   ||!uuid(input.jobId)||!uuid(input.delegationId)||!/^[a-f0-9]{64}$/.test(input.nonce)
   ||p.bodyDigest!==hash({jobId:input.jobId,delegationId:input.delegationId,nonce:input.nonce})
   ||!Number.isSafeInteger(p.issuedAt)||!Number.isSafeInteger(p.expiresAt)||p.issuedAt>now()+1000||p.expiresAt<=now()||p.expiresAt-p.issuedAt!==15000)deny();
  const r=await receiver(p.role);if(r.kind!=='WORKER'||p.targetOrigin!==r.authorityOrigin||p.keyId!==r.keyId)deny();
  try{const key=createPublicKey(r.publicKey);if(key.asymmetricKeyType!=='ed25519'||!verify(null,Buffer.from(proof.payload),key,Buffer.from(proof.signature,'base64url')))deny();}catch{deny();}
  const identity=(await one(query,'SELECT profitia_e1_authority.knowledge_job_identity($1,$2::uuid,$3::uuid) AS identity',[p.role,input.jobId,input.delegationId])).identity;
  if(!identity)deny();
  const observation=await createClerkAccountStatusReader({client,environment:'development',issuer:identity.issuer,now})(identity);
  if(!observation)deny();
  const admission=(await one(query,'SELECT profitia_e1_authority.knowledge_job_issue($1,$2::uuid,$3::uuid,$4,$5::jsonb) AS admission',[p.role,input.jobId,input.delegationId,input.nonce,JSON.stringify(observation)])).admission;
  if(!admission)deny();return admission;
 }
 return Object.freeze({async ready(){try{return(await one(query,'SELECT profitia_e1_authority.knowledge_ready() AS ready')).ready===true;}catch{return false;}},human,worker});
}

/** A response is accepted ONLY from a fresh direct HTTPS call to the owner-
 * enrolled authority read from the native receiving database. It is never a
 * bearer token, user-supplied JSON, cached ALLOW or transferable permission.
 * Provider calls use a sealed bounded in-process execution, not Clerk/chunk. */
export function createKnowledgeOperationHost({independentQuery,application,fetch:send=fetch,workerCredential=null,now=Date.now}){
 if(application?.environment!=='development'||!['platform-knowledge-development-api','platform-knowledge-development-worker'].includes(application.applicationId))throw TypeError('Exact PK Development application required');
 const active=new WeakMap();
 const descriptor=async()=>{
  const row=await one(independentQuery,'SELECT current_database() AS database_name,current_user AS role_name,session_user AS login,platform_knowledge.authority_descriptor() AS descriptor');
  const d=row.descriptor;
  if(!d||d.contract!==KNOWLEDGE_E1_CONTRACT||d.binding.applicationId!==application.applicationId||d.binding.environment!=='development'
   ||d.binding.databaseName!==row.database_name||d.binding.role!==row.role_name||row.login!==row.role_name||d.binding.deploymentId!==application.deploymentId
   ||d.binding.projectId!=='sparkling-sky-79692560'||d.binding.branchId!=='br-billowing-grass-b9ko5s4f'||!https(d.authorityOrigin)||!https(d.origin))fail();return d;
 };
 async function remote(d,route,input,authorization){
  let response;try{response=await send(d.authorityOrigin+'/v1/e1/knowledge/'+route,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
   headers:{'content-type':'application/json',...(authorization?{authorization}:{})},body:JSON.stringify(input)});}catch{fail();}
  if(response.status===401||response.status===403)deny();if(response.status!==200)fail();
  const p=await boundedJson(response);
  if(p?.contract!==KNOWLEDGE_E1_CONTRACT||p.nonce!==input.nonce||JSON.stringify(p.binding)!==JSON.stringify(d.binding)
   ||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=now()||Date.parse(p.expiresAt)>now()+16000
   ||!p.principal||p.principal.environment!=='development'||!uuid(p.principal.internalUserId)||typeof p.grantFingerprint!=='string')fail();
  return p;
 }
 return Object.freeze({
  async ready(){try{const d=await descriptor();const r=await send(d.authorityOrigin+'/v1/e1/knowledge/ready',{redirect:'error',signal:AbortSignal.timeout(5000)});return r.status===200&&(await boundedJson(r)).ready===true;}catch{return false;}},
  async execute(request,command,action){
   if(!(request instanceof Request)||typeof action!=='function'||!plain(command,['operation','resourceId','scopes','requestDigest','delegation']))deny();
   const d=await descriptor();if(d.kind!=='API'||new URL(request.url).origin!==d.origin||request.headers.has('cookie'))deny();
   const input={role:d.binding.role,nonce:randomBytes(32).toString('hex'),...structuredClone(command),requestOrigin:d.origin};
   const authorization=request.headers.get('authorization'),first=await remote(d,'human',input,authorization);
   const scope=Object.freeze({principal:Object.freeze(structuredClone(first.principal)),delegation:first.delegation??null,expiresAt:first.expiresAt});
   active.set(scope,{deadline:now()+300000,job:false});
   try{
    const value=await action(scope);
    const final=await remote(await descriptor(),'human',{...input,nonce:randomBytes(32).toString('hex'),delegation:null},authorization);
    if(final.grantFingerprint!==first.grantFingerprint||final.principal.internalUserId!==scope.principal.internalUserId)deny();return value;
   }finally{active.delete(scope);}
  },
  async authorizeJob(job){
   const d=await descriptor();if(d.kind!=='WORKER'||!workerCredential||!uuid(job.delegation?.delegationId))deny();
   const nonce=randomBytes(32).toString('hex'),body={jobId:job.id,delegationId:job.delegation.delegationId,nonce};
   const issuedAt=now(),p={contract:KNOWLEDGE_E1_CONTRACT,role:d.binding.role,keyId:workerCredential.keyId,targetOrigin:d.authorityOrigin,bodyDigest:hash(body),issuedAt,expiresAt:issuedAt+15000};
   const raw=JSON.stringify(p),key=createPrivateKey(workerCredential.privateKey);
   if(key.asymmetricKeyType!=='ed25519')deny();
   const admission=await remote(d,'worker',{consumerProof:{payload:raw,signature:sign(null,Buffer.from(raw),key).toString('base64url')},...body});
   if(admission.sourceId!==job.source_id||admission.generationId!==job.generation_id)deny();
   const scope=Object.freeze({principal:Object.freeze(structuredClone(admission.principal)),delegation:job.delegation,expiresAt:admission.expiresAt});
   active.set(scope,{deadline:Math.min(Date.parse(admission.delegationExpiresAt),Date.parse(job.deadline_at)),job:true});return scope;
  },
  release(scope){active.delete(scope);},
  authorizeProvider({scope,operation,model,reservationMicrousd=0}){
   const lease=active.get(scope);if(!lease||lease.deadline<=now()||!['gpt-6-luna','text-embedding-3-small'].includes(model)
    ||!['TOKEN_COUNT','COGNITIVE','EMBEDDING','QUERY_EMBEDDING','SUMMARY'].includes(operation)||!Number.isSafeInteger(reservationMicrousd)||reservationMicrousd<0||reservationMicrousd>1000000)deny();return true;
  },
  createDelegation(scope,command){if(!active.has(scope)||!scope.delegation||scope.delegation.jobId!==command.jobId||scope.delegation.sourceId!==command.sourceId
    ||scope.delegation.generationId!==command.generationId||scope.delegation.rightsDigest!==command.rightsDigest)deny();return structuredClone(scope.delegation);}
 });
}
