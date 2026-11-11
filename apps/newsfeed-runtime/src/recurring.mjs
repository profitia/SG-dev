import {randomUUID} from 'node:crypto';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRecurringOperationHost,createRecurringSigner,createRecurringConsentClient} from '@profitia/platform-current-e1-authority/recurring';
import {nextOccurrence} from './scheduler.mjs';
import {indexNewsfeedPublications} from './repository.mjs';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
const digest=createHash('sha256').update(readFileSync(new URL('../migrations/004-recurring-monitoring.sql',import.meta.url))).digest('hex');
const first=async(q,s,v=[])=>{const r=await q(s,v);if(r.rows.length!==1)throw new SourceHubError('MONITORING_STATE_UNAVAILABLE',503);return r.rows[0]};
export async function createNewsfeedMonitoring(c,db,{binding,fetch:send=globalThis.fetch,sourceHub}){
 const descriptor=(await first(db.query,'SELECT profitia_e1_receiver.recurring_descriptor() AS d')).d;
 const signer=createRecurringSigner({environment:c.environment,authorityOrigin:descriptor.authorityOrigin,componentId:c.recurring.componentId,keyId:c.recurring.keyId,privateKey:c.secrets.recurringPrivateKey});
 /** @type {import('@profitia/platform-contracts/operation-context').Application} */
 const application={appId:c.applicationId,profileId:'SPENDGURU_SAAS',deploymentId:c.deploymentId,configurationVersion:c.configurationVersion,environment:c.environment,identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,operations:['newsfeed.monitor.execute'],features:['personal_workspace']};
 const host=createRecurringOperationHost({application,binding,independentQuery:db.query,transact:db.transact,signer,fetch:send,
  async readResource(q,/** @type {any} */p,/** @type {any} */input){
   await first(q,'SELECT newsfeed.monitoring_read($1::uuid,$2::uuid,$3) AS state',[input.resourceId,input.payload.leaseId,input.payload.phase]);
   const d=p.state.recurringDelegation;
   return{id:input.resourceId,type:'private_recurring_job',dataClass:'USER_IN_ORGANISATION_PRIVATE',environment:c.environment,ownerOrganisationId:d.organisationId,ownerUserId:d.ownerUserId,version:d.resourceVersion,projectionVersion:'newsfeed-recurring-v1'};
  }});
 const consent=createRecurringConsentClient({fetch:send});
 /** @param {any} job @param {string} phase @param {string|null} sourceResourceId */
 const input=(job,phase,sourceResourceId=null)=>({operation:'newsfeed.monitor.execute',organisationId:job.organisationId,resourceId:job.id,
  payload:{delegationId:job.delegationId,resourceId:job.resourceId,resourceVersion:job.resourceVersion,definitionDigest:job.definitionDigest,leaseId:job.leaseId,claimedAt:job.claimedAt,slotAt:job.slotAt,scheduleSlot:job.scheduleSlot,phase,sourceResourceId}});
 return Object.freeze({
 async ready(){try{return await host.ready()&&(await first(db.query,"SELECT digest FROM newsfeed.recurring_migrations WHERE version='1.0.0'")).digest===digest}catch{return false}},
 async activate(t,request,id,version,enabled){
  const command=(await first(t.query,'SELECT newsfeed.monitoring_command($1::uuid,$2::bigint,$3::boolean) AS command',[id,version,enabled])).command;
  const receipt=await consent.consent(t.query,request,command);
  return(await first(t.query,'SELECT newsfeed.monitoring_activate($1::jsonb,$2::timestamptz) AS result',[JSON.stringify(receipt),enabled?nextOccurrence(command.schedule,new Date().toISOString())?.at??null:null])).result;
 },
 async candidates(){return(await first(db.query,'SELECT newsfeed.monitoring_candidates() AS candidates')).candidates},
 async claim(candidate){return(await first(db.query,'SELECT newsfeed.monitoring_claim($1::uuid,$2::bigint,$3::timestamptz,$4::uuid,$5::uuid) AS job',[candidate.id,candidate.version,candidate.slotAt,randomUUID(),randomUUID()])).job},
 /** @param {any} job @param {{signal?:AbortSignal}} options */
 async execute(job,{signal}={}){
  try{
   const prepared=await host.execute(input(job,'PREPARE'),async(_,t)=>{
    const s=(await first(t.query,'SELECT newsfeed.monitoring_read($1::uuid,$2::uuid,$3) AS state',[job.id,job.leaseId,'PREPARE'])).state;
    const next=nextOccurrence(s.observation.schedule,new Date(Math.max(Date.parse(job.slotAt),Date.now())).toISOString());
    await t.query('SELECT newsfeed.monitoring_intent($1::uuid,$2::uuid,$3::timestamptz)',[job.id,job.leaseId,next?.at??null]);
    return{request:s.observation.filters};
   });
   const sourceResourceId='api.'+prepared.request.provider+'.'+prepared.request.family;
   return await host.execute(input(job,'EFFECT',sourceResourceId),async(_,t,admission)=>{
    if(!admission?.sourceGrant?.grantId)throw new SourceHubError('SOURCE_CONSUMER_GRANT_REQUIRED',403);
    await t.query('SELECT newsfeed.monitoring_effect($1::uuid,$2::uuid)',[job.id,job.leaseId]);
    const result=await sourceHub.acquireService({command:prepared.request,organisationId:job.organisationId,grantId:admission.sourceGrant.grantId,idempotencyKey:'newsfeed-recurring:'+job.id,signal});
    const items=indexNewsfeedPublications(result);
    return(await first(t.query,'SELECT newsfeed.monitoring_complete($1::uuid,$2::uuid,$3::jsonb,$4::integer) AS result',[job.id,job.leaseId,JSON.stringify(items),result.items.length])).result;
   });
  }catch(e){await db.query('SELECT newsfeed.monitoring_uncertain($1::uuid,$2::uuid)',[job.id,job.leaseId]).catch(()=>{});throw e}
 }
 });
}

