/** Closed private-recurring extension of the existing operation executor.
 * These are structural checks of authority-produced state, never an issuer,
 * directory, scheduler, grant store or replacement for current SQL admission. */
export const RECURRING_JOB_CONTRACT=Object.freeze({id:'profitia.private-recurring-job',version:'1.0.0'});
const tag=RECURRING_JOB_CONTRACT.id+'/'+RECURRING_JOB_CONTRACT.version;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const digest=/^[a-f0-9]{64}$/;
const policies=Object.freeze({
 'newsfeed.monitor.execute':Object.freeze({resourceType:'newsfeed_observation',ownerOperation:'personal.list.write',ownerFeature:'personal_workspace'}),
 'insights.subscription.execute':Object.freeze({resourceType:'report_subscription',ownerOperation:'insights.report.start',ownerFeature:'market'})
});
export const RECURRING_JOB_OPERATIONS=Object.freeze(Object.keys(policies));
export const recurringOperationPolicy=operation=>Object.hasOwn(policies,operation)?policies[operation]:null;
const text=v=>typeof v==='string'&&v.length>0&&v.length<=256;
const live=(v,time)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)>time;
const exact=(value,keys)=>value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
const required=ok=>{if(!ok)throw TypeError('Current private recurring delegation required')};
/** Called only after the host has verified its signed, transaction-bound E1
 * proof. Service identity and the private owner remain distinct throughout. */
export function validateRecurringDelegation(value,{operation,jobId,applicationId,organisationId,actorId,payloadDigest,schemaDigest,now}){
 const policy=recurringOperationPolicy(operation),d=value;
 required(policy&&Number.isFinite(now)&&digest.test(schemaDigest??'')&&exact(d,[
  'contract','schemaDigest','delegationId','delegationVersion','jobId','leaseId','executorApplicationId','serviceActorId',
  'organisationId','ownerUserId','resourceType','resourceId','resourceVersion','scheduleSlot','payloadDigest','policyResourceId',
  'claimedAt','expiresAt','ownerApplication','ownerAccess','ownerProducts','identityObservation','policyVersion'
 ]));
 required(d.contract===tag&&d.schemaDigest===schemaDigest&&uuid.test(d.delegationId??'')&&/^[1-9][0-9]*$/.test(d.delegationVersion??'')
  &&d.jobId===jobId&&uuid.test(jobId??'')&&uuid.test(d.leaseId??'')&&d.executorApplicationId===applicationId
  &&d.serviceActorId===actorId&&uuid.test(actorId??'')&&d.organisationId===organisationId&&uuid.test(organisationId??'')
  &&uuid.test(d.ownerUserId??'')&&d.ownerUserId!==actorId&&d.resourceType===policy.resourceType&&uuid.test(d.resourceId??'')
  &&/^[1-9][0-9]*$/.test(d.resourceVersion??'')&&text(d.scheduleSlot)&&text(d.policyResourceId)
  &&digest.test(d.payloadDigest??'')&&d.payloadDigest===payloadDigest&&text(d.policyVersion)
  &&Number.isFinite(Date.parse(d.claimedAt))&&Date.parse(d.claimedAt)<=now&&live(d.expiresAt,now)
  &&Date.parse(d.expiresAt)<=Date.parse(d.claimedAt)+30000);
 const app=d.ownerApplication,access=d.ownerAccess,identity=d.identityObservation;
 required(app&&text(app.appId)&&app.environment==='development'
  &&['SPENDGURU_SAAS','PORR_SUITE'].includes(app.profileId)&&text(app.configurationVersion)
  &&app.operations?.includes(policy.ownerOperation)&&app.features?.includes(policy.ownerFeature)
  &&(app.profileId==='PORR_SUITE'?app.organisationId===organisationId:app.organisationId===null));
 required(access?.type==='MEMBERSHIP'&&access.actorId===d.ownerUserId&&access.organisationId===organisationId
  &&access.status==='ACTIVE'&&text(access.version)&&text(access.sourceRef)&&live(access.expiresAt,now)
  &&Array.isArray(access.permissions)&&Array.isArray(access.denies));
 const matches=p=>p.operation===policy.ownerOperation&&p.feature===policy.ownerFeature&&(p.resourceId===null||p.resourceId===d.policyResourceId);
 required(access.permissions.some(matches)&&!access.denies.some(matches));
 required(identity?.status==='ACTIVE'&&text(identity.issuer)&&text(identity.subject)
  &&Date.parse(identity.observedAt)<=now&&live(identity.expiresAt,now)
  &&Date.parse(identity.expiresAt)<=Date.parse(identity.observedAt)+5000);
 required(Array.isArray(d.ownerProducts)&&d.ownerProducts.some(p=>p.product==='SPENDGURU'&&p.features?.includes(policy.ownerFeature)
  &&p.organisationId===organisationId&&p.environment==='development'&&p.applicationId===app.appId&&p.status==='ACTIVE'
  &&text(p.version)&&text(p.sourceRef)&&['CONTRACT','VERIFIED_BILLING','EXPLICIT_OFFER'].includes(p.source)&&live(p.expiresAt,now)));
 return freeze(structuredClone(d));
}
