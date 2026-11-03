import {createHash} from 'node:crypto'
import {OIL_REPORT_PROFILE as p,assertOilBodyBudget} from './oil-report-profile'
import {OIL_NARRATIVE_FORMAT,OIL_REPORT_PROMPT} from './oil-report-contract'
import type {OilEvidenceBundle} from './oil-report-evidence'
import {assertOilEvidenceBundle} from './oil-report-evidence'
import {createPlatformIngestionHost} from '@profitia/platform-contracts/platform-ingestion'
import {createExternalCallHost,externalCallSourceDigest,externalCallEvidence,externalNativeResponse,ExternalCallUnavailable} from '@profitia/platform-contracts/external-call'
import targets from '../../deployment/benchmark-discovery-targets.json'
export interface TokenBudgetReceipt {count:number;model:string;bodySha256:string;verified:boolean}
/** No fetch/SDK/client/credential here. This exact closed command must later be
 * bound to the separately adopted, current E1+Source native host, never raw HTTP. */
export function prepareOilResponsesCommand(bundle:OilEvidenceBundle){
 const body=JSON.stringify({model:p.model,store:false,reasoning:{effort:p.reasoningEffort},service_tier:p.serviceTier,max_output_tokens:p.maximumOutputTokens,
  input:[{role:'developer',content:OIL_REPORT_PROMPT},{role:'user',content:JSON.stringify(bundle)}],text:{format:OIL_NARRATIVE_FORMAT}})
 if(Buffer.byteLength(body)>p.maximumBodyBytes)throw Error('REPORT_BODY_TOO_LARGE')
 return Object.freeze({url:'https://api.openai.com/v1/responses',method:'POST' as const,body,bodySha256:createHash('sha256').update(body).digest('hex'),bodyBytes:Buffer.byteLength(body),model:p.model})
}
export function validateOilTokenReceipt(command:ReturnType<typeof prepareOilResponsesCommand>,receipt:TokenBudgetReceipt){assertOilBodyBudget(command.body,receipt,command.bodySha256)}
export function oilReportSourceCandidate(){return Object.freeze({sourceId:'sg2.oil-report.openai',resourceId:'sg2-oil-report:compose',method:'POST',path:'/v1/responses',origin:'https://api.openai.com',
 status:'PROPOSED_NOT_ADMITTED',timeoutMs:p.sourceTimeoutMs,maximumBodyBytes:p.maximumBodyBytes,maximumRequestBytes:p.maximumBodyBytes+Buffer.byteLength('https://api.openai.com/v1/responses'),maximumResponseBytes:4000000,
 requestHeaders:['authorization','accept','content-type','x-client-request-id'],responseHeaders:['content-type','retry-after','x-request-id'],model:p.model,
 requires:['CURRENT_HUMAN_E1','SQL028_SOURCE_COST_POLICY','VERIFIED_EXISTING_KEY_PROJECT','RECONCILED_PREVIOUS_UNVERIFIED','CONTROLLED_RELEASE','FINAL_OWNER_GO']})}

export const OIL_B1=Object.freeze({operation:'oil.report.owner_evaluation',admissionSha256:'170f41c2d3b14ae87a8c97b2c7268eb8d2fab3817cc3fdae9050e73670c45f8e',
 sourceId:'sg2.oil-report.openai',resourceId:'sg2-oil-report:compose',role:'sg2_oil_composer_development_source_runtime',
 projectId:'proj_2K9cBEJw2V9ZRe1l9RsnBo9s',keyTrackingId:'key_OA4upa2U5wcNJYx3',
 producerExternalDigest:'40c2d7b8aa6120badd6d3291298241a8fa048fb6da915602ce726ca88f9bd54b',modelSqlDigest:'5d2574b15bb532fee04a8984dd6a81e4d2f99e8206310076bae3e5bbf73a7653'} as const)
type Root<T>=Parameters<typeof createPlatformIngestionHost<T>>[0]
type EvaluationOptions<T>={root:Omit<Root<T>,'source'|'validateSharedPayload'>;externalConfigurationVersion:string;artifactSha256:string;bundle:OilEvidenceBundle;
 /** Server-owned accepted counter implementation, never an integer/boolean from a caller. */
 countModelInputTokens:(body:string)=>number|Promise<number>;
 /** Only the released operator composition may supply this existing credential. */
 existingCredential:()=>Promise<{key:string;projectId:string;trackingId:string}>;
 query:(tx:T,sql:string,values?:unknown[])=>ReturnType<Root<T>['independentQuery']>}
const evaluationSources=new WeakSet<object>()
/** Closed B1 composition over the original Root/Source host. An installed
 * 1.32 SDK cannot silently ignore USD controls: exact producer digest is
 * verified before creating the model host. No alternate HTTP or credentials. */
export async function createOilEvaluationSource<T>(options:EvaluationOptions<T>){
 assertOilEvidenceBundle(options.bundle)
 const {application:a,binding:b}=options.root
 if(typeof window!=='undefined'||a.appId!==targets.source.applicationId||a.environment!=='development'||a.profileId!=='PLATFORM_INTERNAL'
  ||a.organisationId!==null||a.identityIssuer!=='urn:profitia:database-service-runtime:v1'||a.operations.join(',')!=='knowledge.ingest'||a.features.join(',')!=='knowledge_ingestion'
  ||b.applicationId!==a.appId||b.environment!=='development'||b.role!==OIL_B1.role||b.projectId!==targets.source.projectId||b.branchId!==targets.source.branchId||b.databaseName!==targets.source.databaseName
  ||typeof options.countModelInputTokens!=='function'||typeof options.existingCredential!=='function'
  ||!/^[a-f0-9]{64}$/.test(options.artifactSha256)||b.deploymentId!=='oil-b1-'+options.artifactSha256||a.deploymentId!==b.deploymentId
  ||!options.externalConfigurationVersion||options.externalConfigurationVersion.length>128
  ||options.bundle.forecast.series.some(s=>s.models.length!==4||s.models.some(m=>m.lastMatured.verificationPercent===undefined)))throw new ExternalCallUnavailable('NOT_SENT')
 if(await externalCallSourceDigest()!==OIL_B1.producerExternalDigest)throw new ExternalCallUnavailable('NOT_SENT')
 const command=prepareOilResponsesCommand(options.bundle)
 const root=createPlatformIngestionHost<T>({...options.root,
  source:{id:OIL_B1.sourceId,payloadSchema:'external-call-control-v1',qualityVersion:'sg2-source-control-v1',classificationVersion:'technical-source-control-v1'},
  validateSharedPayload:v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')==='action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status'})
 const modelExecution={schemaDigest:OIL_B1.modelSqlDigest,profileId:p.id,model:p.model,maximumInputTokens:p.maximumInputTokens,maximumOutputTokens:p.maximumOutputTokens,maximumBodyBytes:p.maximumBodyBytes,reservationMicroUsd:p.reservationMicroUsd,timeoutMs:p.sourceTimeoutMs}
 const extended={sourceHost:root,sourceId:OIL_B1.sourceId,resourceId:OIL_B1.resourceId,
  binding:{role:b.role,configurationVersion:options.externalConfigurationVersion,schemaDigest:targets.source.externalSqlDigest,origin:'https://api.openai.com',transport:'HTTPS' as const,pathRules:[{method:'POST' as const,path:'/v1/responses'}]},
  nativeTransport:{schemaDigest:targets.source.nativeSqlDigest,pathRules:[{method:'POST' as const,path:'/v1/responses',requestFormat:'JSON' as const}],redirectOrigins:[],maximumResponseBytes:4000000,credentialMode:'SERVER_HEADERS' as const,completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT' as const},
  modelExecution,countModelInputTokens:(body:string)=>{if(body!==command.body)throw new ExternalCallUnavailable('NOT_SENT');return options.countModelInputTokens(body)},
  independentQuery:options.root.independentQuery,query:options.query,now:options.root.now,
  parseCommand:(value:unknown)=>{if(JSON.stringify(value)!==JSON.stringify(command))throw new ExternalCallUnavailable('NOT_SENT');return command},
  buildRequest:()=>({method:'POST' as const,url:command.url,body:command.body}),
  getHeaders:async()=>{const c=await options.existingCredential();if(c.projectId!==OIL_B1.projectId||c.trackingId!==OIL_B1.keyTrackingId||typeof c.key!=='string'||!c.key.trim()||c.key.length>8192||/[\r\n\0]/.test(c.key))throw new ExternalCallUnavailable('NOT_SENT');
   return {authorization:'Bearer '+c.key,'x-client-request-id':'oil-b1-'+command.bodySha256}}}
 const host=createExternalCallHost<T,typeof command>(extended)
 let used=false
 const source=Object.freeze({command,bundle:options.bundle,artifactSha256:options.artifactSha256,
  async execute(go:OilEvaluationGo,signal:AbortSignal){
   if(used||!go||approvedGoReceipts.get(go)?.source!==source||Date.parse(go.expiresAt)<=Date.now()||!/^[a-f0-9]{64}$/.test(go.intentKey))throw new ExternalCallUnavailable('NOT_SENT');used=true
   const result=await host.execute({command,intentKey:go.intentKey},{signal}),evidence=externalCallEvidence(result)
   if(!evidence||evidence.sourceId!==OIL_B1.sourceId||evidence.resourceId!==OIL_B1.resourceId)throw new ExternalCallUnavailable('RESULT_NOT_RETAINED')
   const response=externalNativeResponse(result)
   return {evidence,response,bytes:result.bytes}
  },
  async recordUsage(callId:string,usage:{inputTokens:number;outputTokens:number;cachedInputTokens:number},requestId:string,responseId:string){
   return options.root.independentQuery('SELECT profitia_model_execution.record_usage($1::uuid,$2::jsonb,$3,$4) AS receipt',[callId,usage,requestId,responseId])
  }})
 evaluationSources.add(source);return source
}
export type OilEvaluationSource=Awaited<ReturnType<typeof createOilEvaluationSource>>
export function assertOilEvaluationSource(source:OilEvaluationSource){if(!evaluationSources.has(source))throw Error('OIL_B1_SOURCE_NOT_BOUND')}

const approvedGoReceipts=new WeakMap<object,{source:OilEvaluationSource;sha256:string}>()
export interface OilEvaluationGo {
 schemaVersion:'OilB1FinalGo/1';decision:'GO_ONE_ATTEMPT';operation:typeof OIL_B1.operation;admissionSha256:typeof OIL_B1.admissionSha256;
 requestSha256:string;evidenceFingerprint:string;artifactSha256:string;asOf:string;expiresAt:string;intentKey:string;
 projectId:typeof OIL_B1.projectId;model:typeof p.model;reservationMicroUsd:150000;
 ownerGoRef:string;controlledReleaseRef:string;activeKeyProjectProofRef:string;tokenCounterAcceptanceRef:string;previousLiabilityAcceptanceRef:string
}
/** A serialized decision is only an operator instruction, never E1 authority.
 * Source remains independently responsible for live SERVICE identity, current
 * grants, single-attempt SQL policy, atomic USD hold and current settlement. */
export function validateOilEvaluationGo(bytes:Uint8Array,expectedSha256:string,source:OilEvaluationSource,now=Date.now()):OilEvaluationGo{
 assertOilEvaluationSource(source)
 if(!/^[a-f0-9]{64}$/.test(expectedSha256)||createHash('sha256').update(bytes).digest('hex')!==expectedSha256)throw Error('OIL_B1_GO_FINGERPRINT_MISMATCH')
 const g=JSON.parse(Buffer.from(bytes).toString('utf8')) as OilEvaluationGo
 const keys='activeKeyProjectProofRef,admissionSha256,artifactSha256,asOf,controlledReleaseRef,decision,evidenceFingerprint,expiresAt,intentKey,model,operation,ownerGoRef,previousLiabilityAcceptanceRef,projectId,requestSha256,reservationMicroUsd,schemaVersion,tokenCounterAcceptanceRef'
 if(!g||Object.keys(g).sort().join(',')!==keys||g.schemaVersion!=='OilB1FinalGo/1'||g.decision!=='GO_ONE_ATTEMPT'||g.operation!==OIL_B1.operation||g.admissionSha256!==OIL_B1.admissionSha256
  ||g.requestSha256!==source.command.bodySha256||g.evidenceFingerprint!==source.bundle.fingerprint||g.asOf!==source.bundle.asOf
  ||g.artifactSha256!==source.artifactSha256
  ||g.projectId!==OIL_B1.projectId||g.model!==p.model||g.reservationMicroUsd!==150000
  ||!Number.isFinite(Date.parse(g.expiresAt))||Date.parse(g.expiresAt)<=now
  ||!['artifactSha256','intentKey'].every(k=>/^[a-f0-9]{64}$/.test(g[k as 'artifactSha256'|'intentKey']))
  ||!['ownerGoRef','controlledReleaseRef','activeKeyProjectProofRef','tokenCounterAcceptanceRef','previousLiabilityAcceptanceRef'].every(k=>typeof g[k as keyof OilEvaluationGo]==='string'&&/^[-A-Za-z0-9._:/]{1,256}$/.test(String(g[k as keyof OilEvaluationGo]))))throw Error('OIL_B1_FINAL_GO_NOT_VALID')
 approvedGoReceipts.set(g,{source,sha256:expectedSha256});return Object.freeze(g)
}
