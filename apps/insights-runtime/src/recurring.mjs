import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRecurringOperationHost,createRecurringSigner,createRecurringConsentClient} from '@profitia/platform-current-e1-authority/recurring';
import {digest,editionKey,requireThat} from '@profitia/insights-contracts';
import {nextReportOccurrence} from './subscriptions.mjs';
import {completedPeriod} from './calendar.mjs';
const schemaDigest=digest(readFileSync(new URL('../sql/004-recurring-subscriptions.sql',import.meta.url)));
const one=async(q,sql,values=[])=>{const r=await q(sql,values);requireThat(r.rows.length===1,'SUBSCRIPTION_STATE_UNAVAILABLE',503);return r.rows[0]};
export async function createRecurringSubscriptions({configuration:c,receiver,store,runner,privateKey,fetch:send=globalThis.fetch,now=Date.now}){
 const d=(await one(receiver.independentQuery,'SELECT profitia_e1_receiver.recurring_descriptor() AS descriptor')).descriptor;
 const signer=createRecurringSigner({environment:'development',authorityOrigin:d.authorityOrigin,componentId:c.hub.componentId,keyId:c.hub.keyId,privateKey});
 const application={...c.receiverApplication,identityIssuer:'urn:profitia:database-service-runtime:v1',operations:['insights.subscription.execute']};
 const {hosts,...binding}=c.receiverBinding;
 const host=createRecurringOperationHost({application,binding,...receiver,signer,fetch:send,
  async readResource(q,p,input){
   await one(q,'SELECT insights_private.subscription_recurring_read($1::uuid,$2::uuid) AS state',[input.resourceId,input.payload.leaseId]);
   const d=p.state.recurringDelegation;
   return{id:input.resourceId,type:'private_recurring_job',dataClass:'USER_IN_ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:d.organisationId,ownerUserId:d.ownerUserId,version:d.resourceVersion,projectionVersion:'insights-private-subscription-v1'};
  }});
 const consent=createRecurringConsentClient({fetch:send});
 let tick=null;
 return Object.freeze({
 async ready(){try{return await host.ready()&&(await one(receiver.independentQuery,"SELECT digest FROM insights_private.recurring_migrations WHERE version='1.0.0'")).digest===schemaDigest}catch{return false}},
 async activate(ctx,request,id,version,enabled){
  return store.transaction(ctx.organisationId,async db=>{
   const command=(await one(db.query.bind(db),'SELECT insights_private.subscription_recurring_command($1::uuid,$2::bigint,$3) AS command',[id,version,enabled])).command;
   const receipt=await consent.consent(db.query.bind(db),request,command);
   const schedule={...command.schedule,weekday:command.schedule.weekdays[0]%7};
   const next=enabled?nextReportOccurrence(schedule,new Date(now()).toISOString()):null;
   await db.query('SELECT insights_private.subscription_recurring_activate($1::jsonb,$2::timestamptz)',[JSON.stringify(receipt),next?.at??null]);
  });
 },
 async candidates(){return(await one(receiver.independentQuery,'SELECT insights_private.subscription_recurring_candidates() AS items')).items},
 async claim(candidate){return(await one(receiver.independentQuery,'SELECT insights_private.subscription_recurring_claim($1::uuid,$2::bigint,$3::timestamptz,$4::uuid,$5::uuid) AS job',[candidate.id,candidate.version,candidate.slotAt,randomUUID(),randomUUID()])).job},
 async execute(job){
  return host.execute({operation:'insights.subscription.execute',organisationId:job.organisationId,resourceId:job.id,
   payload:{delegationId:job.delegationId,resourceId:job.resourceId,resourceVersion:job.resourceVersion,definitionDigest:job.definitionDigest,leaseId:job.leaseId,claimedAt:job.claimedAt,slotAt:job.slotAt,scheduleSlot:job.scheduleSlot,phase:'EFFECT',sourceResourceId:null}},
   (context,transaction)=>store.withClient(context.organisationId,transaction,async()=>{
    const state=(await one(transaction.query.bind(transaction),'SELECT insights_private.subscription_recurring_read($1::uuid,$2::uuid) AS state',[job.id,job.leaseId])).state;
    const definition=state.subscription.definition,profile=c.profiles[definition.profileVersion];
    requireThat(profile&&definition.definitionId==='oil-asphalt','PROFILE_NOT_AVAILABLE',409);
    const command={definitionId:definition.definitionId,profileVersion:definition.profileVersion,period:completedPeriod(job.slotAt),revision:1,asOf:new Date(now()).toISOString(),allowPartial:false};
    await transaction.query('SELECT insights_private.subscription_recurring_intent($1::uuid,$2::uuid,$3::jsonb,$4)',[job.id,job.leaseId,JSON.stringify(command),editionKey(context.organisationId,command)]);
    // This creates/links one real producer job only. Its independent SERVICE
    // admission, source/model costs, Quality Gate and publication are unchanged.
    const actual={...context,expiresAt:new Date(Math.min(Date.parse(context.actor.expiresAt),Date.parse(context.recurringDelegation.expiresAt))).toISOString()};
    const producer=await runner.start(actual,command,profile,'SUBSCRIPTION',{jobId:job.id});
    const next=nextReportOccurrence(definition.schedule,new Date(Math.max(Date.parse(job.slotAt),now())).toISOString());
    await transaction.query('SELECT insights_private.subscription_recurring_complete($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::timestamptz)',[job.id,job.leaseId,producer.id,context.decisionId,next?.at??null]);
    return{id:job.id,producerJobId:producer.id,status:'QUEUED'};
   }));
 },
 async tick(options={}){
  if(options.signal?.aborted)return;if(tick)return tick;
  tick=(async()=>{for(const candidate of(await one(receiver.independentQuery,'SELECT insights_private.subscription_recurring_candidates() AS items')).items){
   if(options.signal?.aborted)break;
   const job=(await one(receiver.independentQuery,'SELECT insights_private.subscription_recurring_claim($1::uuid,$2::bigint,$3::timestamptz,$4::uuid,$5::uuid) AS job',[candidate.id,candidate.version,candidate.slotAt,randomUUID(),randomUUID()])).job;
   if(!job)continue;
   try{await this.execute(job)}catch{/* No external I/O at dispatch: the SQL rollback and expiring lease permit a safe later claim. */}
  }})();
  try{return await tick}finally{tick=null}
 }
 });
}

