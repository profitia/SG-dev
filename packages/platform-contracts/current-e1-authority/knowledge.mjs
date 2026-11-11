import {createHash,createPrivateKey,createPublicKey,sign,verify,randomUUID,randomBytes} from 'node:crypto';
import {createOperationExecutor,OPERATION_CONTRACT,operationPayloadDigest} from '@profitia/platform-contracts/operation-context';
import {knowledgeOperationPolicy} from '@profitia/platform-contracts/knowledge-operations';
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
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
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
   ||!plain(input,['consumerProof','jobId','delegationId','nonce','phase']))deny();
  const proof=input.consumerProof;if(!plain(proof,['payload','signature'])||typeof proof.payload!=='string'||proof.payload.length>4096)deny();
  let p;try{p=JSON.parse(proof.payload);}catch{deny();}
  if(!plain(p,['contract','role','keyId','targetOrigin','bodyDigest','issuedAt','expiresAt'])||p.contract!==KNOWLEDGE_E1_CONTRACT
   ||!['START','CHECKPOINT'].includes(input.phase)||!uuid(input.jobId)||!uuid(input.delegationId)||!/^[a-f0-9]{64}$/.test(input.nonce)
   ||p.bodyDigest!==hash({jobId:input.jobId,delegationId:input.delegationId,nonce:input.nonce,phase:input.phase})
   ||!Number.isSafeInteger(p.issuedAt)||!Number.isSafeInteger(p.expiresAt)||p.issuedAt>now()+1000||p.expiresAt<=now()||p.expiresAt-p.issuedAt!==15000)deny();
  const r=await receiver(p.role);if(r.kind!=='WORKER'||p.targetOrigin!==r.authorityOrigin||p.keyId!==r.keyId)deny();
  try{const key=createPublicKey(r.publicKey);if(key.asymmetricKeyType!=='ed25519'||!verify(null,Buffer.from(proof.payload),key,Buffer.from(proof.signature,'base64url')))deny();}catch{deny();}
  const identity=(await one(query,'SELECT profitia_e1_authority.knowledge_job_identity($1,$2::uuid,$3::uuid) AS identity',[p.role,input.jobId,input.delegationId])).identity;
  if(!identity)deny();
  const observation=input.phase==='START'?await createClerkAccountStatusReader({client,environment:'development',issuer:identity.issuer,now})(identity):null;
  if(input.phase==='START'&&!observation)deny();
  const admission=(await one(query,'SELECT profitia_e1_authority.knowledge_job_issue($1,$2::uuid,$3::uuid,$4,$5::jsonb,$6) AS admission',[p.role,input.jobId,input.delegationId,input.nonce,JSON.stringify(observation),input.phase==='START'])).admission;
  if(!admission)deny();return admission;
 }
 return Object.freeze({async ready(){try{return(await one(query,'SELECT profitia_e1_authority.knowledge_ready() AS ready')).ready===true;}catch{return false;}},human,worker});
}

/** A response is accepted ONLY from a fresh direct HTTPS call to the owner-
 * enrolled authority read from the native receiving database. It is never a
 * bearer token, user-supplied JSON, cached ALLOW or transferable permission.
 * Provider calls use a sealed bounded in-process execution, not Clerk/chunk. */
export function createKnowledgeOperationHost({independentQuery,application,transact=null,fetch:send=fetch,workerCredential=null,now=Date.now}){
 if(application?.environment!=='development'||!['platform-knowledge-development-api','platform-knowledge-development-worker'].includes(application.applicationId))throw TypeError('Exact PK Development application required');
 const active=new WeakMap();
 if(typeof transact!=='function')throw TypeError('Native transaction port required');
 const descriptor=async()=>{
  const row=await one(independentQuery,`SELECT current_database() AS database_name,current_user AS role_name,session_user AS login,
   r.rolsuper,r.rolinherit,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,
   pg_has_role(current_user,'platform_knowledge_owner','MEMBER') AS owner_member,platform_knowledge.authority_descriptor() AS descriptor
   FROM pg_roles r WHERE r.rolname=current_user`);
  const d=row.descriptor;
  if(!d||!/^[a-f0-9]{64}$/.test(d.binding?.knowledgeSchemaDigest??'')||d.contract!==KNOWLEDGE_E1_CONTRACT||d.binding.applicationId!==application.applicationId||d.binding.environment!=='development'
   ||d.binding.databaseName!==row.database_name||d.binding.role!==row.role_name||row.login!==row.role_name||d.binding.deploymentId!==application.deploymentId
   ||d.binding.projectId!=='sparkling-sky-79692560'||d.binding.branchId!=='br-billowing-grass-b9ko5s4f'||!https(d.authorityOrigin)||!https(d.origin)
   ||!['rolsuper','rolinherit','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls','owner_member'].every(k=>row[k]===false))fail();return d;
 };
 async function remote(d,route,input,authorization){
  let response;try{response=await send(d.authorityOrigin+'/v1/e1/knowledge/'+route,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
   headers:{'content-type':'application/json',...(authorization?{authorization}:{})},body:JSON.stringify(input)});}catch{fail();}
  if(response.status===401||response.status===403)deny();if(response.status!==200)fail();
  const p=await boundedJson(response);
  if(p?.contract!==KNOWLEDGE_E1_CONTRACT||p.nonce!==input.nonce||JSON.stringify(p.binding)!==JSON.stringify(d.binding)
   ||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=now()||Date.parse(p.expiresAt)>now()+16000
   ||!p.principal||p.principal.environment!=='development'||!uuid(p.principal.internalUserId)||!/^[a-f0-9]{64}$/.test(p.grantFingerprint??'')
   ||!Array.isArray(p.principal.organisationIds)||p.principal.organisationIds.some(x=>!uuid(x))
   ||!Array.isArray(p.principal.allowedScopes)||p.principal.allowedScopes.some(s=>!['ACCOUNT_PRIVATE','PROFITIA_SHARED'].includes(s))
   ||!['sharedKnowledgeAllowed','operator','publishBindingStandard'].every(k=>typeof p.principal[k]==='boolean')
   ||!['PROFITIA_INTERNAL','CUSTOMER_SERVICE'].includes(p.principal.usePurpose))fail();
  if(route==='human'&&(p.operation!==input.operation||p.resourceId!==input.resourceId||JSON.stringify(p.scopes)!==JSON.stringify(input.scopes)
   ||JSON.stringify(p.principal.allowedScopes)!==JSON.stringify(input.scopes)))fail();
  return p;
 }
 // Canonical Root owns each ADMIT / COMMIT / RESULT operation. Long-running
 // upload/model work is outside its SQL transactions. No external call is
 // represented as an atomic SQL effect; each paid batch has its own ledger.
 const executionPolicy=Object.freeze({provider:'openai',models:['gpt-6-luna','text-embedding-3-small'],store:false,maximumPaidAttempts:1,
  maximumInputTokens:16384,maximumOutputTokens:4096,maximumJobMinutes:30,maximumDocumentMicrousd:1000000,
  globalBudgetCeilingMicrousd:10000000,atomicPerBatch:true,uncertainRetainsReservation:true});
 async function rootPhase(d,admission,command,phase,work,refresh){
  const isJob=d.kind==='WORKER',scopes=isJob?[command.scope]:command.scopes;
  const operations=scopes.map(scope=>'knowledge.'+(scope==='ACCOUNT_PRIVATE'?'private':'shared')+'.'+(isJob?'service.process':command.operation));
  const actorId=isJob?d.binding.role:admission.principal.internalUserId;
  const actor={kind:isJob?'SERVICE':'HUMAN',actorId,...(isJob?{serviceId:actorId}:{userId:actorId}),proofRef:'current-e1:'+admission.grantFingerprint,
   issuer:d.authorityOrigin,audience:d.binding.applicationId,environment:'development',expiresAt:admission.expiresAt};
  const writeAudit=(query,event)=>query(`INSERT INTO platform_knowledge.audit(operation,actor_ref,outcome,technical)
   VALUES($1,$2,$3,$4::jsonb)`,['E1_'+event.phase,hash(actorId),event.decision==='DENY'?'DENIED':event.phase==='OUTCOME'?'COMPLETED':'ACCEPTED',
    JSON.stringify({decisionId:event.decisionId,operation:event.operation,reasonCode:event.reasonCode,payloadDigest:event.payloadDigest??null,implementationVersion:event.implementationVersion})]);
  const executor=createOperationExecutor({knowledgeSchemaDigest:d.binding.knowledgeSchemaDigest,now,
   application:{appId:d.binding.applicationId,profileId:isJob?'PLATFORM_INTERNAL':'SPENDGURU_SAAS',deploymentId:application.deploymentId,
    configurationVersion:'knowledge-v1',environment:'development',identityIssuer:d.authorityOrigin,organisationId:null,features:['platform_knowledge'],operations},
   authenticate:async()=>actor,recordAudit:event=>writeAudit(independentQuery,event),
   withTransaction:async({request},run)=>transact(async db=>{
    const p=admission.principal;
    await db.query(`SELECT set_config('pk.user_id',$1,true),set_config('pk.organisation_ids',$2,true),set_config('pk.allowed_scopes',$3,true),
     set_config('pk.shared_read',$4,true),set_config('pk.operator',$5,true),set_config('pk.purpose',$6,true)`,
     [p.internalUserId,JSON.stringify(p.organisationIds),JSON.stringify(p.allowedScopes),String(p.sharedKnowledgeAllowed),String(p.operator),p.usePurpose]);
    const rule=knowledgeOperationPolicy(request.operation),scope=rule.scope==='private'?'ACCOUNT_PRIVATE':'PROFITIA_SHARED';
    const tx=(await one(db.query.bind(db),'SELECT txid_current()::text AS id')).id;
    let resource={id:command.resourceId,type:rule.resourceType,dataClass:rule.dataClass,environment:'development',ownerOrganisationId:null,
     ownerUserId:scope==='ACCOUNT_PRIVATE'?p.internalUserId:null,version:admission.grantFingerprint,projectionVersion:'knowledge-v1',approvedSharedProjection:scope==='PROFITIA_SHARED'};
    if(uuid(command.resourceId)&&!(command.operation==='document.import'&&phase==='ADMIT')){
     const source=await one(db.query.bind(db),'SELECT id,scope,owner_user_id,owner_organisation_id,published_at,revision FROM platform_knowledge.sources WHERE id=$1',[command.resourceId]);
     if(source.scope!==scope)deny();resource={...resource,ownerUserId:source.owner_user_id,ownerOrganisationId:source.owner_organisation_id,
      version:String(source.revision),approvedSharedProjection:!!source.published_at};
    }
    const knowledge={contract:'profitia.knowledge-operations/1.0.0',schemaDigest:d.binding.knowledgeSchemaDigest,applicationId:d.binding.applicationId,
     environment:'development',resourceId:request.resourceId,payloadDigest:request.payloadDigest,scope,transactionId:tx,
     ownerUserId:resource.ownerUserId,administrationAllowed:p.operator===true,revocationVersion:admission.grantFingerprint,expiresAt:admission.expiresAt,
     executionPolicy,...(isJob?{delegation:{id:command.delegationId,resourceId:command.resourceId,status:'ACTIVE',expiresAt:admission.delegationExpiresAt,revocationVersion:admission.grantFingerprint}}:{})};
    return run({transaction:db,transactionalEffects:true,outputBoundaryVersion:resource.projectionVersion,
     state:{environment:'development',applicationId:d.binding.applicationId,transactionId:tx,policyVersion:admission.grantFingerprint,
      resource,products:[],knowledge,usagePolicy:rule.boundedExecution?'PLATFORM_BUDGET':'NOT_APPLICABLE',
      access:{type:isJob?'SERVICE_GRANT':'ACCOUNT_SELF',actorId,organisationId:null,status:'ACTIVE',version:admission.grantFingerprint,
       sourceRef:'current-e1-knowledge',expiresAt:admission.expiresAt,permissions:[{operation:request.operation,feature:'platform_knowledge',resourceId:request.resourceId}],denies:[]}},
     assertKnowledgeBudget:async()=>{const b=await one(db.query.bind(db),'SELECT ceiling_microusd,spent_microusd,reserved_microusd FROM platform_knowledge.budget WHERE id=true');
      if(Number(b.ceiling_microusd)>10000000||Number(b.ceiling_microusd)<1||Number(b.spent_microusd)<0||Number(b.reserved_microusd)<0)deny();},
     projectOutput:async value=>{if(refresh){const current=await refresh();if(current.grantFingerprint!==admission.grantFingerprint||hash(current.principal)!==hash(p))deny();}
      if(command.operation==='document.import'&&phase==='RESULT'){
       if(!uuid(value?.sourceId))deny();
       const source=await one(db.query.bind(db),'SELECT scope,owner_user_id,owner_organisation_id FROM platform_knowledge.sources WHERE id=$1 FOR SHARE',[value.sourceId]);
       if(!command.scopes.includes(source.scope)||source.owner_organisation_id!==null||source.scope==='ACCOUNT_PRIVATE'&&source.owner_user_id!==p.internalUserId||source.scope==='PROFITIA_SHARED'&&(!p.operator||source.owner_user_id!==null))deny();
      }
      if(command.operation==='document.query'&&phase==='RESULT'&&Array.isArray(value?.evidence)&&value.evidence.length){
       const refs=value.evidence,rows=(await db.query(`SELECT id,active_generation_id FROM platform_knowledge.sources s WHERE id=ANY($1::uuid[])
        AND platform_knowledge.source_visible(s) AND (scope='ACCOUNT_PRIVATE' OR published_at IS NOT NULL)
        AND(rights->>'apiExcerptAllowed')::boolean AND(rights->>'quotingAllowed')::boolean FOR SHARE`,[[...new Set(refs.map(e=>e.sourceId))]])).rows;
       if(refs.some(e=>!rows.some(r=>r.id===e.sourceId&&r.active_generation_id===e.generationId)))deny();
      }return value;},
     recordOutcome:event=>writeAudit(db.query.bind(db),event)});
   })});
  let value;
  for(let i=0;i<operations.length;i++){
   const result=await executor.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:operations[i],organisationId:null,
    resourceId:command.resourceId,payload:{requestDigest:command.requestDigest??null,phase,scope:scopes[i]},request:null},
    async(_context,db)=>i===operations.length-1&&work?work(db):{authorized:true});value=result.value;
  }
  return value;
 }
 return Object.freeze({
  async ready(){try{const d=await descriptor();const r=await send(d.authorityOrigin+'/v1/e1/knowledge/ready',{redirect:'error',signal:AbortSignal.timeout(5000)});return r.status===200&&(await boundedJson(r)).ready===true;}catch{return false;}},
  async execute(request,command,action){
   if(!(request instanceof Request)||typeof action!=='function'||!plain(command,['operation','resourceId','scopes','requestDigest','delegation']))deny();
   const d=await descriptor();if(d.kind!=='API'||new URL(request.url).origin!==d.origin||request.headers.has('cookie'))deny();
   const input={role:d.binding.role,nonce:randomBytes(32).toString('hex'),...structuredClone(command),requestOrigin:d.origin};
   const authorization=request.headers.get('authorization'),first=await remote(d,'human',input,authorization);
   const refresh=()=>remote(d,'human',{...input,nonce:randomBytes(32).toString('hex'),delegation:null},authorization);
   const scope=Object.freeze({principal:freeze(structuredClone(first.principal)),delegation:freeze(structuredClone(first.delegation??null)),expiresAt:first.expiresAt});
   active.set(scope,{deadline:now()+300000,job:false,refresh,fingerprint:first.grantFingerprint,principalDigest:hash(first.principal)});
   try{
    if(['document.publish','document.withdraw','document.delete','memory.write','memory.forget'].includes(command.operation))
     return await rootPhase(d,first,command,'COMMIT',db=>action(Object.freeze({...scope,transaction:db})),refresh);
    await rootPhase(d,first,command,'ADMIT');
    const value=await action(scope),current=await refresh();
    if(current.grantFingerprint!==first.grantFingerprint||hash(current.principal)!==hash(first.principal))deny();
    return await rootPhase(await descriptor(),current,command,'RESULT',async()=>value);
   }finally{active.delete(scope);}
  },
  async authorizeJob(job){
   const d=await descriptor();if(d.kind!=='WORKER'||!workerCredential||!uuid(job.delegation?.delegationId))deny();
   const nonce=randomBytes(32).toString('hex'),body={jobId:job.id,delegationId:job.delegation.delegationId,nonce,phase:'START'};
   const issuedAt=now(),p={contract:KNOWLEDGE_E1_CONTRACT,role:d.binding.role,keyId:workerCredential.keyId,targetOrigin:d.authorityOrigin,bodyDigest:hash(body),issuedAt,expiresAt:issuedAt+15000};
   const raw=JSON.stringify(p),key=createPrivateKey(workerCredential.privateKey);
   if(key.asymmetricKeyType!=='ed25519')deny();
   const admission=await remote(d,'worker',{consumerProof:{payload:raw,signature:sign(null,Buffer.from(raw),key).toString('base64url')},...body});
   if(admission.sourceId!==job.source_id||admission.generationId!==job.generation_id)deny();
   const scope=Object.freeze({principal:freeze(structuredClone(admission.principal)),delegation:freeze(structuredClone(job.delegation)),expiresAt:admission.expiresAt});
   await rootPhase(d,admission,{scope:job.delegation.scope??admission.principal.allowedScopes[0],resourceId:job.source_id,delegationId:job.delegation.delegationId},'ADMIT');
   active.set(scope,{deadline:Math.min(Date.parse(admission.delegationExpiresAt),Date.parse(job.deadline_at)),job:true,jobRecord:job,fingerprint:admission.grantFingerprint,principalDigest:hash(admission.principal)});return scope;
  },
  release(scope){active.delete(scope);},
  async authorizeProvider({scope,operation,model,reservationMicrousd=0}){
   const lease=active.get(scope);if(!lease||lease.deadline<=now()||!['gpt-6-luna','text-embedding-3-small'].includes(model)
    ||!['TOKEN_COUNT','COGNITIVE','EMBEDDING','QUERY_EMBEDDING','SUMMARY'].includes(operation)||!Number.isSafeInteger(reservationMicrousd)||reservationMicrousd<0||reservationMicrousd>1000000)deny();
   if(!lease.job&&operation!=='TOKEN_COUNT'){const p=await lease.refresh();if(p.grantFingerprint!==lease.fingerprint||hash(p.principal)!==lease.principalDigest)deny();}
   if(lease.job){
    const d=await descriptor(),job=lease.jobRecord,nonce=randomBytes(32).toString('hex');
    const body={jobId:job.id,delegationId:job.delegation.delegationId,nonce,phase:'CHECKPOINT'},issuedAt=now();
    const payload=JSON.stringify({contract:KNOWLEDGE_E1_CONTRACT,role:d.binding.role,keyId:workerCredential.keyId,targetOrigin:d.authorityOrigin,bodyDigest:hash(body),issuedAt,expiresAt:issuedAt+15000});
    const current=await remote(d,'worker',{...body,consumerProof:{payload,signature:sign(null,Buffer.from(payload),createPrivateKey(workerCredential.privateKey)).toString('base64url')}});
    if(current.grantFingerprint!==lease.fingerprint||hash(current.principal)!==lease.principalDigest||current.sourceId!==job.source_id||current.generationId!==job.generation_id)deny();
   }
   return true;
  },
  createDelegation(scope,command){if(!active.has(scope)||!scope.delegation||scope.delegation.jobId!==command.jobId||scope.delegation.sourceId!==command.sourceId
    ||scope.delegation.generationId!==command.generationId||scope.delegation.rightsDigest!==command.rightsDigest)deny();return structuredClone(scope.delegation);}
 });
}
