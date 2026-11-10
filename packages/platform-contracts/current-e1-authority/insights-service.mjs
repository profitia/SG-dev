export const INSIGHTS_E1_REPORT_CONTRACT=Object.freeze({id:'profitia.insights-report-e1',version:'1.0.0'});
import {createOperationExecutor,OperationDenied} from '@profitia/platform-contracts/operation-context';
import {createAccessStore} from '@profitia/platform-contracts/access-store';
export const INSIGHTS_REPORT_OPERATIONS=Object.freeze(['insights.report.start','insights.report.status','insights.report.list','insights.report.download']);
export function createCurrentE1ReportServiceHost({application,binding,query,transact,now=Date.now}){
 if(application?.environment!=='development'||application.identityIssuer!=='urn:profitia:database-service-runtime:v1'||application.profileId!=='SPENDGURU_SAAS'||application.features?.join(',')!=='market'||application.operations?.join(',')!==INSIGHTS_REPORT_OPERATIONS.join(',')||[query,transact].some(v=>typeof v!=='function'))throw TypeError('Explicit bounded report SERVICE host required');
 const access=createAccessStore({binding,now});
 const recordAudit=(event,q=query)=>q('SELECT profitia_services.report_append_audit($1::jsonb)',[JSON.stringify(event)]);
 const read=async(q,org,op,resource)=>{const actor=await access.resolveServiceActor(q);if(!actor)throw new OperationDenied('ACCESS_BASIS_INVALID');const s=(await q('SELECT profitia_services.report_state($1::uuid,$2,$3) AS state',[org,op,resource])).rows[0]?.state;if(!s||s.applicationId!==application.appId||s.actor.actorId!==actor.actorId||s.actor.proofRef!==actor.proofRef)throw new OperationDenied('ACCESS_BASIS_INVALID');return s};
 return Object.freeze({async execute(input,action){const state=await read(query,input.organisationId,input.operation,input.resourceId),actor=state.actor;
 const engine=createOperationExecutor({application,now,authenticate:async()=>actor,recordAudit,withTransaction:async({request},run)=>transact(async({query:q,transaction})=>{
  const current=await read(q,request.organisationId,request.operation,request.resourceId);if(current.actor.proofRef!==actor.proofRef)throw new OperationDenied('ACCESS_BASIS_INVALID');
  const resource={id:request.resourceId,type:'insights_report',dataClass:'ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:request.organisationId,ownerUserId:null,version:'1',projectionVersion:'insights-report-v1'};
  return run({state:{...current,resource},transaction,transactionalEffects:true,outputBoundaryVersion:resource.projectionVersion,projectOutput:value=>value,recordOutcome:async event=>{const end=await read(q,request.organisationId,request.operation,request.resourceId);if(end.policyVersion!==current.policyVersion)throw new OperationDenied('ACCESS_BASIS_INVALID');await recordAudit(event,q)}})
 })});return (await engine.execute({...input,contractId:engine.contract.id,contractVersion:engine.contract.version},action)).value;
 },async currentContext(organisationId){return read(query,organisationId,'insights.report.start','oil-asphalt')},async claimProfile(job){return (await query('SELECT profitia_services.claim_report_profile($1::uuid,$2,$3) AS profile',[job.organisationId,job.profile.id,job.businessKey])).rows[0]?.profile??null},async organisations(){return (await query('SELECT profitia_services.report_organisations() AS items')).rows[0]?.items??[]}})
}
