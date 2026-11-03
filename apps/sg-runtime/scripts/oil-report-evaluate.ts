import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'
import * as Sentry from '@sentry/nextjs'
import {createPlatformIngestionHost} from '@profitia/platform-contracts/platform-ingestion'
import {createExternalCallHost,externalCallEvidence,externalCallFailureEvidence,externalNativeResponse} from '@profitia/platform-contracts/external-call'
import {projectFrozenOilD0} from '../lib/forecast/oil-d0-report-projection'
import {makeOilEvidenceBundle,type OilMarketEvidence} from '../lib/insights/oil-report-evidence'
import {OIL_B1,createOilEvaluationSource,prepareOilResponsesCommand,type OilEvaluationGo} from '../lib/insights/oil-report-source'
import {executeOilOwnerEvaluation} from '../lib/insights/oil-report-operation'
import {traceOilReport} from '../lib/insights/oil-report-observability'
import targets from '../deployment/benchmark-discovery-targets.json'

export const B1_INPUT=Object.freeze({requestSha256:'c61df3c984351c1ff3edd1ab43a5de451d36be7814d9fce6e5e5295b1abb2695',
 d0Sha256:'ec11c696cdd4e9577c462fdadf45953aba57bb76d7281bf034363513dbde006b',
 lastCaseSha256:'251b521a3fa71441eab299e946f0fb7ab706027d85a23c234cade92830944da7',asOf:'2026-11-03T06:29:25Z',bodyBytes:16890})
export const B1_COUNTER=Object.freeze({sourceId:'sg2.oil-report.openai-token-count',resourceId:'sg2-oil-report:token-count',
 role:'sg2_oil_counter_development_source_runtime',url:'https://api.openai.com/v1/responses/input_tokens',timeoutMs:20000})
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex')
function fail(code:string):never{throw Error('OIL_B1_'+code)}
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const ref=(v:unknown):v is string=>typeof v==='string'&&/^[-A-Za-z0-9._:/]{1,256}$/.test(v)&&!/(?:PENDING|PLACEHOLDER|SYNTHETIC)/i.test(v)
type FileRef={path:string;sha256:string}
export interface OperatorRelease {
 schemaVersion:'OilB1OperatorRelease/1';status:'CONTROLLED_INSTALLATION_ACCEPTED';expiresAt:string
 artifact:FileRef;request:FileRef;d0:FileRef;lastCase:FileRef;marketEvidence:FileRef
 privateBindings:FileRef;credentialSha256:string;counterReceipt:FileRef|null
 rootConfigurationVersion:string;modelConfigurationVersion:string;counterConfigurationVersion:string
 refs:{ownerInstallation:string;controlledRelease:string;credential:string;counter:string;previousLiability:string;monitoring:string}
 monitoring:{ingestHost:string;projectId:string}
}
interface Bindings {schemaVersion:'OilB1PrivateBindings/1';modelDatabaseUrl:string;counterDatabaseUrl:string;
 openai:{key:string;projectId:string;trackingId:string};sentryDsn:string}
export interface CounterReceipt {schemaVersion:'OilB1TokenCount/1';count:number;model:string;bodySha256:string;counterBodySha256:string;
 verified:true;countedAt:string;sourceCallId:string;requestId:string|null;acceptanceRef:string;billingCost:'UNKNOWN';retryAllowed:false}

/** Only private, absolute, regular files are accepted. No symlink or overwrite path. */
export function readBoundFile(file:FileRef,maximumBytes=4_000_000){
 if(!file||!path.isAbsolute(file.path)||!digest(file.sha256))fail('FILE_REFERENCE_INVALID')
 const stat=fs.lstatSync(file.path)
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||(stat.mode&0o077)!==0||stat.size>maximumBytes)fail('FILE_NOT_PRIVATE')
 const bytes=fs.readFileSync(file.path);if(sha(bytes)!==file.sha256)fail('FILE_FINGERPRINT_MISMATCH')
 return bytes
}
export function readOperatorRelease(file:FileRef,now=Date.now()){
 const r=JSON.parse(readBoundFile(file,131072).toString('utf8')) as OperatorRelease
 if(r.schemaVersion!=='OilB1OperatorRelease/1'||r.status!=='CONTROLLED_INSTALLATION_ACCEPTED'||!Number.isFinite(Date.parse(r.expiresAt))
  ||Date.parse(r.expiresAt)<=now||!digest(r.credentialSha256)||!r.refs||!Object.values(r.refs).every(ref)
  ||!['ownerInstallation','controlledRelease','credential','counter','previousLiability','monitoring'].every(k=>ref(r.refs[k as keyof typeof r.refs]))
  ||![r.rootConfigurationVersion,r.modelConfigurationVersion,r.counterConfigurationVersion].every(v=>typeof v==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(v))
  ||!r.monitoring||!/^[A-Za-z0-9.-]+\.sentry\.io$/.test(r.monitoring.ingestHost)||!/^\d+$/.test(r.monitoring.projectId))fail('RELEASE_NOT_ACCEPTED')
 return r
}
export function checkDatabaseUrl(value:string,role:string){
 const u=new URL(value)
 if(!['postgres:','postgresql:'].includes(u.protocol)||!targets.source.hosts.includes(u.hostname)||u.pathname!=='/'+targets.source.databaseName
  ||decodeURIComponent(u.username)!==role||!u.password||u.hash||u.port&&u.port!=='5432'
  ||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))
  ||u.searchParams.getAll('sslmode').length!==1||u.searchParams.getAll('channel_binding').length>1
  ||u.searchParams.has('channel_binding')&&u.searchParams.get('channel_binding')!=='require'
  ||!['require','verify-full'].includes(u.searchParams.get('sslmode')??''))fail('DATABASE_BINDING_MISMATCH')
 return value
}
export function checkCredential(c:Bindings['openai'],expectedSha256:string){
 if(!c||c.projectId!==OIL_B1.projectId||c.trackingId!==OIL_B1.keyTrackingId||typeof c.key!=='string'||!c.key.trim()
  ||c.key.length>8192||/[\r\n\0]/.test(c.key)||!digest(expectedSha256)||sha(c.key)!==expectedSha256)fail('CREDENTIAL_BINDING_MISMATCH')
 return c
}
/** Includes the strict response schema and reasoning input. Output/service-tier controls do not consume input tokens. */
export function prepareCounterCommand(request:string){
 if(sha(request)!==B1_INPUT.requestSha256||Buffer.byteLength(request)!==B1_INPUT.bodyBytes)fail('FROZEN_REQUEST_MISMATCH')
 const r=JSON.parse(request)
 if(r.model!=='gpt-6.1-sol'||r.store!==false||r.reasoning?.effort!=='medium'||r.text?.format?.strict!==true
  ||r.max_output_tokens!==8000||r.service_tier!=='default'||Object.keys(r).sort().join(',')!=='input,max_output_tokens,model,reasoning,service_tier,store,text')fail('FROZEN_PROFILE_MISMATCH')
 const body=JSON.stringify({model:r.model,input:r.input,reasoning:r.reasoning,text:r.text})
 return Object.freeze({url:B1_COUNTER.url,method:'POST' as const,body,bodySha256:sha(body)})
}
export function validateCounterReceipt(receipt:CounterReceipt,request:string,acceptanceRef:string,now=Date.now()){
 const command=prepareCounterCommand(request),age=now-Date.parse(receipt?.countedAt)
 if(receipt?.schemaVersion!=='OilB1TokenCount/1'||receipt.verified!==true||receipt.model!=='gpt-6.1-sol'
  ||receipt.bodySha256!==sha(request)||receipt.counterBodySha256!==command.bodySha256||receipt.acceptanceRef!==acceptanceRef
  ||!Number.isSafeInteger(receipt.count)||receipt.count<1||receipt.count>15000||!Number.isFinite(age)||age<0||Date.parse(receipt.countedAt)<Date.parse(B1_INPUT.asOf)
  ||receipt.requestId!==null&&(typeof receipt.requestId!=='string'||!/^[-A-Za-z0-9._:]{1,512}$/.test(receipt.requestId))||!/^[a-f0-9-]{36}$/.test(receipt.sourceCallId)
  ||receipt.billingCost!=='UNKNOWN'||receipt.retryAllowed!==false)fail('TOKEN_RECEIPT_INVALID')
 return receipt.count
}
export function verifyFrozenInput(r:Pick<OperatorRelease,'request'|'d0'|'lastCase'|'marketEvidence'>){
 const request=readBoundFile(r.request,65536).toString('utf8');prepareCounterCommand(request)
 const d0=readBoundFile(r.d0),last=readBoundFile(r.lastCase)
 if(sha(d0)!==B1_INPUT.d0Sha256||sha(last)!==B1_INPUT.lastCaseSha256)fail('FROZEN_INPUT_MISMATCH')
 const market=JSON.parse(readBoundFile(r.marketEvidence).toString('utf8')) as OilMarketEvidence[]
 const bundle=makeOilEvidenceBundle(projectFrozenOilD0(d0,last),market,B1_INPUT.asOf)
 if(prepareOilResponsesCommand(bundle).body!==request)fail('REBUILT_REQUEST_MISMATCH')
 return {request,bundle}
}
function loadInput(r:OperatorRelease){
 const {request,bundle}=verifyFrozenInput(r)
 const manifest=JSON.parse(readBoundFile(r.artifact).toString('utf8')) as {schemaVersion:string;files:FileRef[]}
 if(manifest.schemaVersion!=='OilB1Artifact/1'||!Array.isArray(manifest.files)||manifest.files.length<15)fail('ARTIFACT_INVALID')
 for(const file of manifest.files)readBoundFile(file)
 const ownFile=fs.realpathSync(new URL(import.meta.url))
 if(!manifest.files.some(f=>f.path===ownFile&&f.sha256===sha(fs.readFileSync(ownFile))))fail('OPERATOR_NOT_IN_ARTIFACT')
 return {request,bundle,artifactSha256:r.artifact.sha256}
}
function loadBindings(r:OperatorRelease){
 const b=JSON.parse(readBoundFile(r.privateBindings,32768).toString('utf8')) as Bindings
 if(b.schemaVersion!=='OilB1PrivateBindings/1')fail('PRIVATE_BINDINGS_INVALID')
 checkDatabaseUrl(b.modelDatabaseUrl,OIL_B1.role);checkDatabaseUrl(b.counterDatabaseUrl,B1_COUNTER.role);checkCredential(b.openai,r.credentialSha256)
 const dsn=new URL(b.sentryDsn)
 if(dsn.protocol!=='https:'||dsn.hostname!==r.monitoring.ingestHost||dsn.pathname!=='/'+r.monitoring.projectId)fail('MONITORING_BINDING_MISMATCH')
 return b
}
type Db={connect():Promise<void>;end():Promise<void>;query(sql:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[];rowCount:number|null}>}
type Root=Parameters<typeof createPlatformIngestionHost<Db>>[0]
function databaseRoot(url:string,role:string,deploymentId:string,configurationVersion:string){
 // pg belongs to the private released operator artifact, not the SG2 app.
 // Pure preparation/import never loads an unadmitted application dependency.
 const Client=createRequire(import.meta.url)('pg').Client as new(options:{connectionString:string;connectionTimeoutMillis:number;statement_timeout:number})=>Db
 const client=(maxWaitMs=10000)=>new Client({connectionString:url,connectionTimeoutMillis:Math.min(10000,maxWaitMs),statement_timeout:20000})
 const query=(c:Db):Root['independentQuery']=>(sql,values)=>c.query(sql,values)
 const root:Omit<Root,'source'|'validateSharedPayload'>={
  application:{appId:targets.source.applicationId,profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId,configurationVersion,
   identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
  binding:{applicationId:targets.source.applicationId,environment:'development',projectId:targets.source.projectId,branchId:targets.source.branchId,
   databaseName:targets.source.databaseName,role,deploymentId,configurationVersion,schemaDigest:targets.source.sourceSqlDigest},
  independentQuery:async(sql,values)=>{const c=client();try{await c.connect();return await query(c)(sql,values)}finally{await c.end()}},
  transact:async(work,limits)=>{
   if(!Number.isSafeInteger(limits.timeoutMs)||limits.timeoutMs<1||!Number.isSafeInteger(limits.maxWaitMs)||limits.maxWaitMs<1)fail('TRANSACTION_LIMITS_INVALID')
   const c=client(limits.maxWaitMs)
   try{await c.connect();await c.query('BEGIN');try{
    await c.query("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)",[String(Math.min(20000,limits.timeoutMs))+'ms',String(Math.min(10000,limits.maxWaitMs))+'ms'])
    const value=await work({transaction:c,query:query(c)});await c.query('COMMIT');return value
   }catch(e){await c.query('ROLLBACK');throw e}}finally{await c.end()}
  }}
 return root
}
export function sanitizeOperatorError(event:Sentry.ErrorEvent,artifactSha256:string):Sentry.ErrorEvent{
 return {type:event.type,event_id:event.event_id,timestamp:event.timestamp,level:event.level,platform:'node',message:'Oil B1 technical event',
  environment:'development',release:'oil-b1-'+artifactSha256,tags:{operation:OIL_B1.operation}}
}
function monitoring(r:OperatorRelease,b:Bindings,artifactSha256:string){
 // A separately accepted SG2 process binding; never default to another project's DSN.
 Sentry.init({dsn:b.sentryDsn,environment:'development',release:'oil-b1-'+artifactSha256,sendDefaultPii:false,defaultIntegrations:false,tracesSampleRate:1,
  beforeSend:event=>sanitizeOperatorError(event,artifactSha256),
  beforeSendTransaction:event=>({type:'transaction',event_id:event.event_id,timestamp:event.timestamp,start_timestamp:event.start_timestamp,
   transaction:'oil_report.operator',environment:'development',release:'oil-b1-'+artifactSha256,
   contexts:{trace:event.contexts?.trace?{trace_id:event.contexts.trace.trace_id,span_id:event.contexts.trace.span_id,op:'sg.oil_report'}:undefined},
   tags:{operation:OIL_B1.operation},spans:[]})})
 return {trace:traceOilReport,flush:async()=>{try{await Sentry.flush(2000)}catch{}}}
}
function checkOutputParent(directory:string){
 if(!path.isAbsolute(directory))fail('ABSOLUTE_OUTPUT_REQUIRED')
 const parent=fs.lstatSync(path.dirname(directory));if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o077)!==0)fail('OUTPUT_PARENT_NOT_PRIVATE')
 if(fs.existsSync(directory))fail('OUTPUT_ALREADY_EXISTS')
}
function privateOutput(directory:string){
 checkOutputParent(directory)
 fs.mkdirSync(directory,{mode:0o700})
 return (name:string,data:string|Uint8Array)=>fs.writeFileSync(path.join(directory,name),data,{flag:'wx',mode:0o400})
}
/** Read-only installation acceptance. A missing active model policy is expected until the separate final GO. */
export async function inspectReleasedSource(releaseFile:FileRef,outputDirectory:string){
 const r=readOperatorRelease(releaseFile),{artifactSha256}=loadInput(r),b=loadBindings(r),save=privateOutput(outputDirectory)
 const proof:Record<string,unknown>={schemaVersion:'OilB1SourceInspection/1',artifactSha256,providerRequests:0,credentialFingerprintMatched:true,bindings:[]}
 for(const [role,url,sourceId,resourceId,configurationVersion,deploymentId,timeout] of [
  [OIL_B1.role,b.modelDatabaseUrl,OIL_B1.sourceId,OIL_B1.resourceId,r.modelConfigurationVersion,'oil-b1-'+artifactSha256,120000],
  [B1_COUNTER.role,b.counterDatabaseUrl,B1_COUNTER.sourceId,B1_COUNTER.resourceId,r.counterConfigurationVersion,'oil-b1-count-'+artifactSha256,20000]] as const){
  const root=databaseRoot(url,role,deploymentId,r.rootConfigurationVersion)
  const result=await root.independentQuery('SELECT current_database() AS database_name,current_user AS role,profitia_ingestion.runtime_descriptor() AS root,profitia_ingestion.current_state($1,$2) IS NOT NULL AS allowed,profitia_external_native.descriptor($1,$2) AS native,to_regnamespace(\'profitia_model_execution\') IS NOT NULL AS model_schema',[sourceId,resourceId])
  const row=result.rows[0] as {database_name:string;role:string;root:Record<string,unknown>;allowed:boolean;native:Record<string,unknown>;model_schema:boolean}
  if(row?.role!==role||row.database_name!==targets.source.databaseName||row.root?.projectId!==targets.source.projectId||row.root.branchId!==targets.source.branchId
   ||row.root.deploymentId!==deploymentId||row.root.configurationVersion!==r.rootConfigurationVersion||!row.allowed||!row.model_schema
   ||row.native?.configurationVersion!==configurationVersion||row.native.sourceId!==sourceId||row.native.resourceId!==resourceId||row.native.timeoutMs!==timeout
   ||row.native.origin!=='https://api.openai.com'||row.native.capacity!==1)fail('INSTALLED_SOURCE_MISMATCH')
  ;(proof.bindings as unknown[]).push({role,sourceId,resourceId,configurationVersion,deploymentId,descriptor:row.native})
 }
 save('SOURCE_INSTALLATION_READBACK.json',JSON.stringify(proof,null,2)+'\n')
 return {status:'SOURCE_BINDINGS_VERIFIED',providerRequests:0,generationRequiresSeparateFinalGo:true}
}
export async function countReleasedInput(releaseFile:FileRef,outputDirectory:string){
 const r=readOperatorRelease(releaseFile),{request,artifactSha256}=loadInput(r),b=loadBindings(r),command=prepareCounterCommand(request)
 const save=privateOutput(outputDirectory)
 save('TOKEN_COUNT_INTENTION.json',JSON.stringify({requestSha256:sha(request),counterBodySha256:command.bodySha256,acceptanceRef:r.refs.counter,retryAllowed:false,billingCost:'UNKNOWN'})+'\n')
 const telemetry=monitoring(r,b,artifactSha256)
 const root=databaseRoot(b.counterDatabaseUrl,B1_COUNTER.role,'oil-b1-count-'+artifactSha256,r.rootConfigurationVersion)
 const host=createPlatformIngestionHost<Db>({...root,source:{id:B1_COUNTER.sourceId,payloadSchema:'external-call-control-v1',qualityVersion:'sg2-source-control-v1',classificationVersion:'technical-source-control-v1'},
  validateSharedPayload:v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')==='action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status'})
 const transport=createExternalCallHost<Db,typeof command>({sourceHost:host,sourceId:B1_COUNTER.sourceId,resourceId:B1_COUNTER.resourceId,
  binding:{role:B1_COUNTER.role,configurationVersion:r.counterConfigurationVersion,schemaDigest:targets.source.externalSqlDigest,origin:'https://api.openai.com',transport:'HTTPS',pathRules:[{method:'POST',path:'/v1/responses/input_tokens'}]},
  nativeTransport:{schemaDigest:targets.source.nativeSqlDigest,pathRules:[{method:'POST',path:'/v1/responses/input_tokens',requestFormat:'JSON'}],redirectOrigins:[],maximumResponseBytes:4096,credentialMode:'SERVER_HEADERS',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'},
  independentQuery:root.independentQuery,query:(tx,sql,values)=>tx.query(sql,values),parseCommand:v=>{if(JSON.stringify(v)!==JSON.stringify(command))fail('COUNTER_COMMAND_MISMATCH');return command},
  buildRequest:()=>({method:'POST',url:command.url,body:command.body}),getHeaders:()=>({authorization:'Bearer '+b.openai.key,'x-client-request-id':'oil-b1-count-'+sha(request)})})
 try{
  const value=await telemetry.trace('source',()=>transport.execute({command,intentKey:sha('oil-b1-count:'+request)},{signal:AbortSignal.timeout(B1_COUNTER.timeoutMs)}))
  save('TOKEN_COUNT_RESPONSE_BODY.raw',value.bytes)
  const response=externalNativeResponse(value),evidence=externalCallEvidence(value),data=JSON.parse(Buffer.from(value.bytes).toString('utf8'))
  const requestId=response.headers.get('x-request-id')
  if(response.status<200||response.status>=300||!evidence||evidence.sourceId!==B1_COUNTER.sourceId||evidence.resourceId!==B1_COUNTER.resourceId
   ||data.object!=='response.input_tokens')fail('COUNTER_RESPONSE_INVALID')
  // The accepted non-model native transport strips x-request-id. Retain null,
  // the actual Source call ID and raw bytes; never manufacture an OpenAI ID.
  const receipt:CounterReceipt={schemaVersion:'OilB1TokenCount/1',model:'gpt-6.1-sol',bodySha256:sha(request),counterBodySha256:command.bodySha256,count:data.input_tokens,
   verified:true,countedAt:new Date().toISOString(),sourceCallId:evidence.callId,requestId,acceptanceRef:r.refs.counter,billingCost:'UNKNOWN',retryAllowed:false}
  validateCounterReceipt(receipt,request,r.refs.counter);save('TOKEN_COUNT_RECEIPT.json',JSON.stringify(receipt,null,2)+'\n')
  return {status:'COUNTED',count:receipt.count,receiptSha256:sha(fs.readFileSync(path.join(outputDirectory,'TOKEN_COUNT_RECEIPT.json'))),generativeCalls:0}
 }catch(error){
  const certainty=error&&typeof error==='object'&&'certainty'in error&&['NOT_SENT','UNVERIFIED','RESULT_NOT_RETAINED'].includes(String(error.certainty))?String(error.certainty):'UNVERIFIED'
  save('TOKEN_COUNT_FAILURE.json',JSON.stringify({status:'COUNT_NOT_VERIFIED',certainty,source:externalCallFailureEvidence(error),retryAllowed:false,billingCost:'UNKNOWN',generativeCalls:0})+'\n')
  return {status:'COUNT_NOT_VERIFIED',generativeCalls:0}
 }finally{await telemetry.flush()}
}
export async function runReleasedReport(releaseFile:FileRef,goFile:FileRef,outputDirectory:string){
 const r=readOperatorRelease(releaseFile)
 const goBytes=readBoundFile(goFile,16384),g=JSON.parse(goBytes.toString('utf8')) as OilEvaluationGo
 if(g.controlledReleaseRef!=='sha256:'+releaseFile.sha256||g.activeKeyProjectProofRef!==r.refs.credential||g.previousLiabilityAcceptanceRef!==r.refs.previousLiability
  ||g.tokenCounterAcceptanceRef!==r.refs.counter||!ref(g.ownerGoRef)||g.decision!=='GO_ONE_ATTEMPT'||g.operation!==OIL_B1.operation
  ||g.requestSha256!==B1_INPUT.requestSha256||g.asOf!==B1_INPUT.asOf||g.model!=='gpt-6.1-sol'||g.reservationMicroUsd!==150000
  ||!digest(g.intentKey)||!Number.isFinite(Date.parse(g.expiresAt))||Date.parse(g.expiresAt)<=Date.now())fail('GO_RELEASE_BINDING_MISMATCH')
 const {request,bundle,artifactSha256}=loadInput(r)
 if(g.artifactSha256!==artifactSha256||!r.counterReceipt)fail('GO_ARTIFACT_MISMATCH')
 const receipt=JSON.parse(readBoundFile(r.counterReceipt,16384).toString('utf8')) as CounterReceipt
 validateCounterReceipt(receipt,request,r.refs.counter)
 checkOutputParent(outputDirectory)
 const b=loadBindings(r),telemetry=monitoring(r,b,artifactSha256)
 const root=databaseRoot(b.modelDatabaseUrl,OIL_B1.role,'oil-b1-'+artifactSha256,r.rootConfigurationVersion)
 const source=await createOilEvaluationSource<Db>({root,externalConfigurationVersion:r.modelConfigurationVersion,artifactSha256,bundle,
  existingCredential:async()=>checkCredential(b.openai,r.credentialSha256),countModelInputTokens:body=>validateCounterReceipt(receipt,body,r.refs.counter),query:(tx,sql,values)=>tx.query(sql,values)})
 try{
  const result=await executeOilOwnerEvaluation(source,goBytes,goFile.sha256,outputDirectory,telemetry.trace)
  const metadata=path.join(outputDirectory,'OIL_MARKET_OUTLOOK_REPORT_METADATA.json')
  if(!fs.existsSync(metadata))fs.writeFileSync(metadata,JSON.stringify({status:result.status,asOf:B1_INPUT.asOf,requestSha256:B1_INPUT.requestSha256,
   artifactSha256,model:'gpt-6.1-sol',frozenD0Sha256:B1_INPUT.d0Sha256,evidenceFingerprint:bundle.fingerprint,publicationStatus:'HUMAN_REVIEW_REQUIRED',retryAllowed:false},null,2)+'\n',{flag:'wx',mode:0o400})
  const status=String(result.status),summary='Pierwsza próba Oil Market Outlook B1\n\nStatus: '+status+'. Model żądania: gpt-6.1-sol. Retry: NIE.\nOryginalna odpowiedź: '+('originalApiOutputExists'in result&&result.originalApiOutputExists?'zachowana':'nieuzyskana lub niedostępna przez dopuszczony transport')+'.\nKoszt dostawcy: UNKNOWN do rozliczenia. Publikacja: HUMAN_REVIEW_REQUIRED.\n'
  fs.writeFileSync(path.join(outputDirectory,'FIRST_REPORT_EXECUTION_SUMMARY_PL.md'),summary,{flag:'wx',mode:0o400})
  return {status,originalApiOutputExists:'originalApiOutputExists'in result&&result.originalApiOutputExists,retryAllowed:false}
 }finally{await telemetry.flush()}
}
export async function main(args:string[]){
 const arg=(key:string)=>{const i=args.indexOf(key);if(i<0||!args[i+1])fail('ARGUMENT_REQUIRED');return args[i+1]}
 const mode=arg('--mode'),release={path:arg('--release'),sha256:arg('--release-sha256')},output=arg('--output')
 if(mode==='inspect')return inspectReleasedSource(release,output)
 if(mode==='count')return countReleasedInput(release,output)
 if(mode==='run')return runReleasedReport(release,{path:arg('--go'),sha256:arg('--go-sha256')},output)
 return fail('MODE_NOT_ADMITTED')
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 main(process.argv.slice(2)).then(value=>console.log(JSON.stringify(value))).catch(error=>{
  console.error(error instanceof Error&&/^OIL_B1_[A-Z_]+$/.test(error.message)?error.message:'OIL_B1_OPERATOR_FAILED');process.exitCode=1
 })
}
