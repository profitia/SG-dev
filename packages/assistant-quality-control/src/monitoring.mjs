import {randomUUID} from 'node:crypto'
import {PostHog} from 'posthog-node'
import {NodeClient,makeNodeTransport,defaultStackParser} from '@sentry/node'

const serviceId='srv-dbu4ak0ae00c73eaabcg'
const service='sg2-assistant-quality-development'
const safeCodes=new Set(['READINESS_DATABASE_BINDING_INVALID','READINESS_CONFIGURATION_INVALID','READINESS_SAFETY_STATE_INVALID','READINESS_PROVIDER_UNAVAILABLE','READINESS_UNAVAILABLE'])
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const defaultPostHog=(key,options)=>new PostHog(key,options)
const defaultSentry=({onTransportResult,...options})=>{
 const client=new NodeClient({...options,stackParser:defaultStackParser,transport:settings=>{
  const transport=makeNodeTransport({...settings,keepAlive:false,bufferSize:10})
  return {flush:timeout=>transport.flush(timeout),async send(envelope){
   try{const result=await transport.send(envelope);onTransportResult(result?.statusCode);return result}
   catch{onTransportResult(undefined);throw Error('Technical telemetry delivery unavailable')}
  }}
 }})
 client.init();return client
}
const keyPresent=v=>typeof v==='string'&&v.trim()===v&&v.length>0
function validSentry(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='o4512356781981696.ingest.de.sentry.io'&&u.pathname==='/4512356940120144'&&/^[a-f0-9]{32}$/.test(u.username)&&!u.password&&!u.port&&!u.search&&!u.hash}catch{return false}}

/** Technical worker metadata only. No identity, QA object, model input/output,
 * error message/stack, database statement, request or environment is accepted.
 * Clients are process-local and never installed as global instrumentation.
 * Missing/failed telemetry does not affect the native safety checks. */
export function createQualityMonitoring({env,makePostHog=defaultPostHog,makeSentry=defaultSentry,warn=()=>{},onDelivery=()=>{},now=Date.now}){
 const sourceSha=env.RENDER_GIT_COMMIT,scope=env.TARGET_ENVIRONMENT==='development'&&env.RENDER_SERVICE_ID===serviceId&&sha(sourceSha)
 let posthog=null,sentry=null,sentReady=false
 const pending=new Map(),distinctId=randomUUID()
 const warning=code=>{try{warn({event:'aqc.monitoring.unavailable',code})}catch{}}
 if(scope&&keyPresent(env.AQC_POSTHOG_PROJECT_TOKEN)&&env.AQC_POSTHOG_HOST==='https://eu.i.posthog.com'){
  try{
   posthog=makePostHog(env.AQC_POSTHOG_PROJECT_TOKEN,{host:env.AQC_POSTHOG_HOST,flushAt:1,flushInterval:1000,maxQueueSize:10,
    disableGeoip:true,fetchRetryCount:0,requestTimeout:2000,featureFlagsRequestMaxRetries:0})
   posthog.on?.('error',()=>warning('POSTHOG_DELIVERY_UNVERIFIED'))
  }catch{warning('POSTHOG_INITIALIZATION_UNVERIFIED')}
 }else if(env.NODE_ENV!=='production')warning('POSTHOG_CONFIGURATION_MISSING')
 const eventFor=(metadata,id,timestamp)=>({
  event_id:id,timestamp,platform:'node',level:metadata.status==='FAILED'?'error':'info',environment:'development',release:sourceSha,
  message:metadata.status==='FAILED'?'CIC quality worker unavailable':'CIC quality worker technical ready',
  tags:{service,render_service_id:serviceId,aqc_technical:'true'},
  extra:{aqc:metadata},...(metadata.status==='FAILED'?{exception:{values:[{type:'AqcTechnicalFailure',value:metadata.error_code}]}}:{}),
 })
 if(scope&&validSentry(env.AQC_SENTRY_DSN)){
  try{
   sentry=makeSentry({dsn:env.AQC_SENTRY_DSN,environment:'development',release:sourceSha,
    onTransportResult:status=>{
     if(Number.isSafeInteger(status)&&status>=200&&status<300){try{onDelivery({event:'aqc.monitoring.delivery',provider:'sentry',status:'ACCEPTED',httpStatus:status})}catch{}}
     else warning('SENTRY_DELIVERY_UNVERIFIED')
    },
    integrations:[],defaultIntegrations:false,skipOpenTelemetrySetup:true,enableLogs:false,enableMetrics:false,
    tracesSampleRate:0,profileSessionSampleRate:0,sendClientReports:false,maxBreadcrumbs:0,attachStacktrace:false,debug:false,
    dataCollection:{userInfo:false,cookies:false,httpHeaders:false,httpBodies:[],urlQueryParams:false,
     graphQL:{document:false,variables:false},genAI:{inputs:false,outputs:false},mcp:{inputs:false,outputs:false},
     databaseQueryData:false,queues:false,stackFrameVariables:false,frameContextLines:0},
    beforeSend:event=>{
     const metadata=pending.get(event.event_id);pending.delete(event.event_id)
     // Reconstruct from trusted primitive metadata. Discard every SDK/user/request
     // enrichment, attachment and arbitrary exception, even if one appears.
     return metadata?eventFor(metadata,event.event_id,Date.parse(metadata.observed_at)/1000):null
    }})
  }catch{warning('SENTRY_INITIALIZATION_UNVERIFIED')}
 }else if(env.NODE_ENV!=='production')warning('SENTRY_CONFIGURATION_MISSING')
 const metadata=(status,code)=>Object.freeze({schema_version:'AQC_TECHNICAL_MONITORING_V1',environment:'development',service,render_service_id:serviceId,
  source_sha:sourceSha,observed_at:new Date(now()).toISOString(),status,
  control_store:status==='MONITORING_READY'?'CONNECTED_DISABLED':'UNVERIFIED',native_limits:status==='MONITORING_READY'?'CONNECTED_DISABLED':'UNVERIFIED',
  paid_repairs_enabled:false,promotion_enabled:false,pilot_started:false,...(status==='FAILED'?{error_code:safeCodes.has(code)?code:'READINESS_UNAVAILABLE'}:{})})
 const report=(event,m,toSentry)=>{
  if(posthog)try{posthog.capture({distinctId,event,timestamp:new Date(m.observed_at),disableGeoip:true,properties:{$process_person_profile:false,...m}})}catch{warning('POSTHOG_DELIVERY_UNVERIFIED')}
  if(sentry&&toSentry&&pending.size<10)try{
   const id=randomUUID().replaceAll('-','');pending.set(id,m)
   sentry.captureEvent(eventFor(m,id,Date.parse(m.observed_at)/1000))
  }catch{warning('SENTRY_DELIVERY_UNVERIFIED')}
 }
 return Object.freeze({
  configured:()=>Object.freeze({posthog:!!posthog,sentry:!!sentry}),
  heartbeat(value){
   if(!scope||value?.status!=='MONITORING_READY'||value.sourceSha!==sourceSha||value.controlStore!=='CONNECTED_DISABLED'||value.nativeLimits!=='CONNECTED_DISABLED'
    ||value.paidRepairsEnabled!==false||value.promotionEnabled!==false||value.pilotStartedAt!==null)return false
   report('cic_quality_technical_heartbeat',metadata('MONITORING_READY'),!sentReady);sentReady=true;return true
  },
  failure(code){if(scope)report('cic_quality_technical_failure',metadata('FAILED',code),true)},
  async shutdown(){
   let timer
   try{
    await Promise.race([Promise.allSettled([posthog?.shutdown(1000),sentry?.close(1000)]),
     new Promise(resolve=>{timer=setTimeout(resolve,1000)})])
   }catch{warning('MONITORING_SHUTDOWN_UNVERIFIED')}finally{clearTimeout(timer);pending.clear()}
  },
 })
}
