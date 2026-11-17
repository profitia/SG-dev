import test from 'node:test'
import assert from 'node:assert/strict'
import {createQualityMonitoring} from '../src/monitoring.mjs'
const sourceSha='a'.repeat(40)
const env={TARGET_ENVIRONMENT:'development',RENDER_SERVICE_ID:'srv-dbu4ak0ae00c73eaabcg',RENDER_GIT_COMMIT:sourceSha,NODE_ENV:'development',
 AQC_POSTHOG_PROJECT_TOKEN:'phc_SYNTHETIC_PUBLIC_TOKEN',AQC_POSTHOG_HOST:'https://eu.i.posthog.com',
 AQC_SENTRY_DSN:'https://'+('b'.repeat(32))+'@o4512356781981696.ingest.de.sentry.io/4512356940120144'}
const ready={status:'MONITORING_READY',sourceSha,controlStore:'CONNECTED_DISABLED',nativeLimits:'CONNECTED_DISABLED',paidRepairsEnabled:false,promotionEnabled:false,pilotStartedAt:null}
function fixture(override={},behavior={}){
 const captures=[],events=[],warnings=[],options={}
 const monitor=createQualityMonitoring({env:{...env,...override},now:()=>Date.parse('2026-11-17T12:00:00Z'),warn:v=>warnings.push(v),
  makePostHog:(key,o)=>{options.posthog={key,...o};return{on(){},capture(v){captures.push(v);behavior.capture?.(v)},shutdown:async()=>behavior.shutdown?.()}},
  makeSentry:o=>{options.sentry=o;return{captureEvent(v){events.push(v)},close:async()=>behavior.shutdown?.()}}})
 return{monitor,captures,events,warnings,options}
}
test('technical monitoring exports only trusted primitive state and no QA, identity, raw error or SDK enrichment',async()=>{
 const f=fixture();const poison='PRIVATE_QA_PAYLOAD_TOKEN_EMAIL_STACK'
 assert.equal(f.monitor.heartbeat({...ready,transcript:poison,user:{id:poison},modelInput:poison,purpose:poison}),true)
 f.monitor.heartbeat(ready)
 assert.equal(f.captures.length,2);assert.equal(f.events.length,1,'Sentry ready is emitted once per process')
 assert.equal(f.captures[0].properties.$process_person_profile,false);assert.equal(f.captures[0].disableGeoip,true)
 const e=f.events[0],clean=f.options.sentry.beforeSend({...e,user:{email:poison},request:{body:poison},breadcrumbs:[poison],contexts:{prompt:poison},exception:{values:[{value:poison}]},extra:{secret:poison}})
 assert(!JSON.stringify([f.captures,clean]).includes(poison));assert.equal(clean.environment,'development');assert.equal(clean.release,sourceSha);assert.deepEqual(clean.extra,e.extra)
 assert.equal(f.options.sentry.beforeSend(e),null,'unregistered replay is discarded')
 f.monitor.failure(poison);assert.equal(f.events[1].extra.aqc.error_code,'READINESS_UNAVAILABLE')
 assert(!JSON.stringify([f.captures,f.events,f.warnings]).includes(poison))
 assert.equal(f.options.sentry.beforeSend({event_id:'c'.repeat(32),message:poison}),null)
 await f.monitor.shutdown()
})
test('foreign scope and missing optional keys never initialize clients, send data or block application boot',async()=>{
 for(const override of [{TARGET_ENVIRONMENT:'production'},{RENDER_SERVICE_ID:'srv-foreign'},{RENDER_GIT_COMMIT:'invalid'},{AQC_POSTHOG_PROJECT_TOKEN:undefined,AQC_SENTRY_DSN:undefined}]){
  const f=fixture(override);assert.deepEqual(f.monitor.configured(),{posthog:false,sentry:false});f.monitor.heartbeat(ready);f.monitor.failure('READINESS_UNAVAILABLE')
  assert.equal(f.captures.length,0);assert.equal(f.events.length,0);await f.monitor.shutdown()
 }
})
test('enabled pilot, wrong SHA and unverified stores cannot be reported as technical ready',async()=>{
 const f=fixture()
 for(const change of [{sourceSha:'b'.repeat(40)},{paidRepairsEnabled:true},{promotionEnabled:true},{pilotStartedAt:'2026-11-17'},{nativeLimits:'ENABLED'},{controlStore:'UNKNOWN'}])
  assert.equal(f.monitor.heartbeat({...ready,...change}),false)
 assert.equal(f.captures.length,0);assert.equal(f.events.length,0);await f.monitor.shutdown()
})
test('SDK privacy configuration turns off profiling, tracing, AI/MCP content, identities, request and database payloads',async()=>{
 const f=fixture(),s=f.options.sentry,p=f.options.posthog
 assert.deepEqual(s.integrations,[]);assert.equal(s.defaultIntegrations,false);assert.equal(s.skipOpenTelemetrySetup,true);assert.equal(s.enableLogs,false);assert.equal(s.enableMetrics,false);assert.equal(s.tracesSampleRate,0);assert.equal(s.profileSessionSampleRate,0)
 assert.deepEqual(s.dataCollection,{userInfo:false,cookies:false,httpHeaders:false,httpBodies:[],urlQueryParams:false,graphQL:{document:false,variables:false},genAI:{inputs:false,outputs:false},mcp:{inputs:false,outputs:false},databaseQueryData:false,queues:false,stackFrameVariables:false,frameContextLines:0})
 assert.equal(p.disableGeoip,true);assert.equal(p.fetchRetryCount,0);assert.equal(p.requestTimeout,2000);assert.equal(p.maxQueueSize,10)
 await f.monitor.shutdown()
})
test('telemetry delivery failure never repeats controller work or leaks the SDK exception',async()=>{
 const f=fixture({}, {capture(){throw Error('PRIVATE_PROVIDER_EXCEPTION')}})
 assert.equal(f.monitor.heartbeat(ready),true);assert.equal(f.captures.length,1)
 assert(!JSON.stringify(f.warnings).includes('PRIVATE_PROVIDER_EXCEPTION'));await f.monitor.shutdown()
})
test('an indefinitely stalled SDK shutdown is bounded to one second',async()=>{
 const f=fixture({}, {shutdown:()=>new Promise(()=>{})}),before=Date.now();await f.monitor.shutdown()
 assert(Date.now()-before<1600)
})

test('Sentry acknowledgement reports only provider HTTP acceptance and cannot import response headers or SDK data',async()=>{
 const deliveries=[],warnings=[];let options
 const m=createQualityMonitoring({env,makePostHog:()=>({capture(){},on(){},shutdown:async()=>{}}),makeSentry:o=>{options=o;return{captureEvent(){},close:async()=>{}}},warn:v=>warnings.push(v),onDelivery:v=>deliveries.push(v)})
 options.onTransportResult(200);options.onTransportResult(429);options.onTransportResult({status:200,secret:'PRIVATE_DATA'})
 assert.deepEqual(deliveries,[{event:'aqc.monitoring.delivery',provider:'sentry',status:'ACCEPTED',httpStatus:200}])
 assert.equal(warnings.length,2);assert(!JSON.stringify([deliveries,warnings]).includes('PRIVATE_DATA'));await m.shutdown()
})
