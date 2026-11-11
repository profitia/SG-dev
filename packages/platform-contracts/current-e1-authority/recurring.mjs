import {createHash,createPrivateKey,createPublicKey,sign,verify,randomUUID,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createOperationExecutor,OperationDenied,operationPayloadDigest} from '@profitia/platform-contracts/operation-context';
import {createAccessStore} from '@profitia/platform-contracts/access-store';
import {createClerkAccountStatusReader} from '@profitia/platform-contracts/identity-provider';
export const RECURRING_E1_CONTRACT='profitia.current-private-recurring/1.0.0';
const tag='profitia.private-recurring-job/1.0.0',uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const deny=()=>{throw new OperationDenied('ACCESS_BASIS_INVALID')},fail=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')};
const clone=v=>structuredClone(v),hash=v=>createHash('sha256').update(v).digest('hex');
const plain=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const https=v=>{try{const u=new URL(v);return u.origin===v&&u.protocol==='https:'&&!u.username&&!u.password&&!u.hostname.includes('*')}catch{return false}};
const operations=['newsfeed.monitor.execute','insights.subscription.execute'];
export const recurringAuthoritySchemaUrl=new URL('./migrations/012-recurring-authority.sql',import.meta.url);
export const recurringReceiverSchemaUrl=new URL('./migrations/013-recurring-receiver.sql',import.meta.url);
export const recurringSchemaDigest=side=>hash(readFileSync(side==='authority'?recurringAuthoritySchemaUrl:side==='receiver'?recurringReceiverSchemaUrl:fail()));
async function one(query,sql,args=[]){const r=await query(sql,args);if(r?.rows?.length!==1)fail();return r.rows[0]}
async function json(response){const reader=response.body?.getReader();if(!reader)fail();let size=0;const chunks=[];try{for(;;){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>32768)fail();chunks.push(x.value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{fail()}}
function validateCommand(c){
 if(!plain(c,['delegationId','organisationId','operation','resourceId','resourceVersion','definitionDigest','schedule','enabled'])||!operations.includes(c.operation)
 ||!['delegationId','organisationId','resourceId'].every(k=>uuid.test(c[k]??''))||!/^[1-9][0-9]*$/.test(c.resourceVersion??'')||!/^[a-f0-9]{64}$/.test(c.definitionDigest??'')||typeof c.enabled!=='boolean'||!c.schedule||typeof c.schedule!=='object')deny();
 return c;
}
/** Uses each consumer's already enrolled Ed25519 credential, never a borrowed
 * Oil identity. A signature authenticates transport; central E1 still decides
 * current membership, product and the exact revocable private consent. */
export function createRecurringSigner(c,{now=Date.now}={}){
 if(c?.environment!=='development'||!https(c.authorityOrigin)||![/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/].every(r=>r.test(c.componentId??'')&&r.test(c.keyId??'')))throw TypeError('Enrolled Development recurring consumer required');
 const privateKey=c.privateKey?.type==='private'?c.privateKey:createPrivateKey(c.privateKey);
 if(privateKey.asymmetricKeyType!=='ed25519')throw TypeError('Own Ed25519 credential required');
 return body=>{const issuedAt=now(),p={contract:RECURRING_E1_CONTRACT,componentId:c.componentId,keyId:c.keyId,targetOrigin:c.authorityOrigin,requestId:randomUUID(),issuedAt,expiresAt:issuedAt+15000,bodyDigest:operationPayloadDigest(body)};
 const raw=JSON.stringify(p);return{payload:raw,signature:sign(null,Buffer.from(raw),privateKey).toString('base64url')}};
}
export function createRecurringConsentClient({fetch:send=globalThis.fetch}={}){
 return Object.freeze({async consent(query,request,command){
  validateCommand(command);if(!(request instanceof Request)||!/^Bearer [^\\s]{1,8192}$/.test(request.headers.get('authorization')??''))deny();
  const d=(await one(query,'SELECT profitia_e1_receiver.recurring_descriptor() AS descriptor')).descriptor;if(!https(d?.authorityOrigin))fail();
  const transactionId=(await one(query,'SELECT txid_current()::text AS id')).id;
  const challenge={binding:d.binding,transactionId,nonce:randomBytes(32).toString('hex'),organisationId:command.organisationId,
   operation:command.operation==='newsfeed.monitor.execute'?'personal.list.write':'insights.report.start',
   resourceId:command.operation==='newsfeed.monitor.execute'?command.resourceId:'oil-asphalt',requestDigest:operationPayloadDigest(command)};
  let r;try{r=await send(d.authorityOrigin+'/v1/e1/recurring/consent',{method:'POST',redirect:'error',signal:AbortSignal.any([request.signal,AbortSignal.timeout(3000)]),headers:{authorization:request.headers.get('authorization'),'content-type':'application/json'},body:JSON.stringify({applicationId:d.binding.applicationId,challenge,command,requestOrigin:new URL(request.url).origin})})}catch{fail()}
  if(r.status===401||r.status===403)deny();if(r.status!==200)fail();return json(r);
 }});
}
export function createRecurringAuthority({query,client,binding,authorizeHuman,now=Date.now}){
 if(binding?.applicationId!=='identity-runtime-development'||binding.environment!=='development'||typeof query!=='function'||typeof authorizeHuman!=='function')throw TypeError('Existing central E1 owner required');
 return Object.freeze({
 async ready(){try{return(await one(query,'SELECT profitia_e1_authority.recurring_ready() AS ready')).ready===true}catch{return false}},
 async consent(request,input){
  if(!(request instanceof Request)||request.headers.has('cookie')||request.headers.has('origin')||!plain(input,['applicationId','challenge','command','requestOrigin']))deny();
  const c=clone(validateCommand(input.command)),challenge=clone(input.challenge);
  if(challenge?.organisationId!==c.organisationId||challenge.resourceId!==(c.operation==='newsfeed.monitor.execute'?c.resourceId:'oil-asphalt')||challenge.requestDigest!==operationPayloadDigest(c)
   ||challenge.operation!==(c.operation==='newsfeed.monitor.execute'?'personal.list.write':'insights.report.start'))deny();
  const proof=await authorizeHuman(request,{applicationId:input.applicationId,challenge,requestOrigin:input.requestOrigin,previous:null});
  const result=(await one(query,'SELECT profitia_e1_authority.recurring_consent($1,$2::jsonb,$3::jsonb) AS consent',[input.applicationId,JSON.stringify(proof),JSON.stringify(c)])).consent;
  if(!result)deny();return clone(result);
 },
 async authorize(request,input){
  if(!(request instanceof Request)||request.headers.has('authorization')||request.headers.has('cookie')||request.headers.has('origin')||!plain(input,['consumerProof','challenge','previous']))deny();
  const x=clone(input),proof=x.consumerProof;if(!plain(proof,['payload','signature'])||typeof proof.payload!=='string'||proof.payload.length>4096||!/^[A-Za-z0-9_-]{86}$/.test(proof.signature??''))deny();
  let p;try{p=JSON.parse(proof.payload)}catch{deny()}
  if(JSON.stringify(p)!==proof.payload||Buffer.from(proof.signature,'base64url').toString('base64url')!==proof.signature||!plain(p,['contract','componentId','keyId','targetOrigin','requestId','issuedAt','expiresAt','bodyDigest'])||p.contract!==RECURRING_E1_CONTRACT||!uuid.test(p.requestId??'')||!https(p.targetOrigin)||p.targetOrigin!==new URL(request.url).origin
   ||!Number.isSafeInteger(p.issuedAt)||p.issuedAt>now()+3000||p.expiresAt!==p.issuedAt+15000||p.expiresAt<=now()||p.bodyDigest!==operationPayloadDigest({challenge:x.challenge,previous:x.previous}))deny();
  const registered=(await one(query,'SELECT profitia_e1_authority.source_consumer($1,$2) AS consumer',[p.componentId,p.keyId])).consumer;
  if(!registered)deny();let valid=false;try{const key=createPublicKey(registered.publicKey);valid=key.asymmetricKeyType==='ed25519'&&verify(null,Buffer.from(proof.payload),key,Buffer.from(proof.signature,'base64url'))}catch{deny()}if(!valid)deny();
  const identity=(await one(query,'SELECT profitia_e1_authority.recurring_identity($1,$2,$3::jsonb) AS identity',[p.componentId,p.keyId,JSON.stringify(x.challenge)])).identity;
  if(!identity)deny();
  const observation=await createClerkAccountStatusReader({client,environment:'development',issuer:identity.issuer,now})(identity);
  if(!observation)deny();
  const answer=(await one(query,'SELECT profitia_e1_authority.issue_recurring($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb) AS proof',
   [p.componentId,p.keyId,registered.keyDigest,JSON.stringify(x.challenge),JSON.stringify(observation),x.previous===null?null:JSON.stringify(x.previous)])).proof;
  if(!answer)deny();return clone(answer);
 }
 });
}
/** Same transaction interpreter and canonical audit as HUMAN operations.
 * Remote E1 is observed at admission and again before local commit; no ALLOW
 * cache, copied directory, fabricated session or runtime proof-key access. */
export function createRecurringOperationHost({application,binding,independentQuery,transact,signer,readResource,fetch:send=globalThis.fetch,now=Date.now}){
 application=clone(application);binding=clone(binding);
 if(application.environment!=='development'||binding.environment!=='development'||application.appId!==binding.applicationId||application.operations.length!==1||!operations.includes(application.operations[0])||[independentQuery,transact,signer,readResource,send].some(f=>typeof f!=='function'))throw TypeError('Explicit existing Development recurring receiver required');
 const schema=recurringSchemaDigest('receiver'),audit=createAccessStore({binding,now});
 async function descriptor(q){const d=(await one(q,'SELECT profitia_e1_receiver.recurring_descriptor() AS descriptor')).descriptor;if(d?.contract!==RECURRING_E1_CONTRACT||d.schemaDigest!==schema||!https(d.authorityOrigin)||operationPayloadDigest(d.binding)!==operationPayloadDigest(binding))fail();return d}
 async function remote(d,challenge,previous=null){const body={challenge,previous},consumerProof=signer(body);let r;try{r=await send(d.authorityOrigin+'/v1/e1/recurring/authorize',{method:'POST',redirect:'error',signal:AbortSignal.timeout(3000),headers:{'content-type':'application/json'},body:JSON.stringify({consumerProof,...body})})}catch{fail()}if(r.status===403||r.status===401)deny();if(r.status!==200)fail();return json(r)}
 const append=(q,event)=>one(q,'SELECT profitia_e1_receiver.recurring_audit($1::jsonb) AS recorded',[JSON.stringify(event)]);
 return Object.freeze({
 async ready(){try{await descriptor(independentQuery);return true}catch{return false}},
 async execute(input,action){
  if(typeof action!=='function')throw TypeError('Explicit private transaction effect required');
  const captured=clone(input);delete captured.request;const d=await descriptor(independentQuery);
  return transact(async({query,transaction})=>{
   const challenge=(await one(query,'SELECT profitia_e1_receiver.recurring_challenge($1::jsonb,$2) AS challenge',[JSON.stringify({...captured,payloadDigest:operationPayloadDigest(captured.payload)}),randomBytes(32).toString('hex')])).challenge;
   let proof=await remote(d,challenge),accepted=(await one(query,'SELECT profitia_e1_receiver.recurring_accept($1::jsonb) AS accepted',[JSON.stringify(proof)])).accepted;
   if(!accepted?.actor||!accepted?.state)fail();
   const engine=createOperationExecutor({application,recurringSchemaDigest:schema,now,authenticate:async()=>clone(accepted.actor),
    recordAudit:event=>audit.appendAudit(independentQuery,event),
    withTransaction:async(_,run)=>{
     const resource=await readResource(query,accepted,captured);
     return run({state:{...clone(accepted.state),resource},transaction,transactionalEffects:true,outputBoundaryVersion:resource.projectionVersion,projectOutput:clone,
      revalidateExternalAccount:async()=>{
       proof=await remote(d,challenge,proof);const fresh=(await one(query,'SELECT profitia_e1_receiver.recurring_accept($1::jsonb) AS accepted',[JSON.stringify(proof)])).accepted;
       if(fresh?.fingerprint!==accepted.fingerprint||fresh?.actor?.proofRef!==accepted.actor.proofRef)deny();return fresh.state.recurringDelegation.identityObservation;
      },
      recordOutcome:event=>append(query,event)});
    }});
   return (await engine.execute({...captured,contractId:engine.contract.id,contractVersion:engine.contract.version,request:null},(context,tx)=>action(context,tx,{sourceGrant:clone(accepted.state.sourceGrant??null)}))).value;
  },{timeoutMs:15000,maxWaitMs:3000});
 }
 });
}

