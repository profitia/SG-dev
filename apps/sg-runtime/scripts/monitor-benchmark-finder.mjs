#!/usr/bin/env node
import {randomUUID, createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'

const TARGET = 'https://dev-sg2.spendguru.app'
const PROJECT = '4512356940120144'
const ACCOUNT = 'tomasz@profitia.pl'
const MONITOR = 'critical-development-benchmark-finder'
const SCHEDULE = '0 */6 * * *'
const safeStages = new Set(['configuration','health','account','session','metadata','metadata_values','search','advanced_search','cleanup','monitoring'])
export class MonitorFailure extends Error {
  constructor(stage, code) {
    super('Benchmark Finder synthetic check failed')
    this.stage = safeStages.has(stage) ? stage : 'monitoring'
    this.code = /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'INTERNAL_FAILURE'
  }
}
const fail = (stage,code) => { throw new MonitorFailure(stage,code) }
const id = () => randomUUID().replaceAll('-','')
const validItems = value => value && Array.isArray(value.items) && value.items.length > 0

/** Deliberately one admitted environment/account. Future activation is a separate task. */
export function readConfiguration(env) {
  if (env.APP_ENV !== 'development' || env.FINDER_MONITOR_ENVIRONMENT !== 'development'
    || env.FINDER_MONITOR_TARGET_URL !== TARGET || env.FINDER_MONITOR_ACCOUNT !== ACCOUNT)
    fail('configuration','TARGET_MISMATCH')
  let dsn
  try { dsn = new URL(env.SENTRY_DSN) } catch { fail('configuration','SENTRY_CONFIGURATION_INVALID') }
  if (dsn.protocol !== 'https:' || !/^o[0-9]+\.ingest\.de\.sentry\.io$/.test(dsn.hostname)
    || dsn.pathname !== '/'+PROJECT || !/^[a-f0-9]{32}$/.test(dsn.username)
    || dsn.password || dsn.port || dsn.search || dsn.hash)
    fail('configuration','SENTRY_CONFIGURATION_INVALID')
  if (!/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT ?? '')) fail('configuration','RELEASE_INVALID')
  return Object.freeze({dsn, release:env.RENDER_GIT_COMMIT, target:TARGET, email:ACCOUNT,
    clerkKey:env.PROFITIA_CLERK_SECRET_KEY})
}

export function idempotencyKey(stage, body, now) {
  return 'finder_monitor_'+createHash('sha256').update(JSON.stringify({
    environment:'development',window:Math.floor(now/21600000),stage,body
  })).digest('hex')
}

async function limitedJson(response,stage) {
  if (!response.ok) {
    await response.body?.cancel()
    fail(stage,'HTTP_'+response.status)
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    await response.body?.cancel()
    fail(stage,'INVALID_CONTENT_TYPE')
  }
  const reader=response.body?.getReader()
  if (!reader) fail(stage,'EMPTY_RESPONSE')
  const chunks=[]; let size=0
  try {
    while (true) {
      const part=await reader.read()
      if (part.done) break
      size+=part.value.byteLength
      if (size>524288) { await reader.cancel(); fail(stage,'RESPONSE_TOO_LARGE') }
      chunks.push(part.value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch(error) {
    if (error instanceof MonitorFailure) throw error
    fail(stage,'INVALID_JSON')
  } finally { reader.releaseLock() }
}

export async function runMonitor(env, {fetchImpl=fetch, now=Date.now, log=value=>console.log(JSON.stringify(value))}={}) {
  const config=readConfiguration(env)
  const started=now(), traceId=id(), rootSpan=id().slice(0,16), checkInId=id()
  const spans=[]; let sessionId, requestCount=0, failure=null, telemetryFailed=false
  const endToEnd=AbortSignal.timeout(120000)
  async function jsonRequest(stage,url,options={}) {
    requestCount++
    try {
      const response=await fetchImpl(url,{...options,redirect:'error',
        signal:AbortSignal.any([endToEnd,AbortSignal.timeout(20000)]),
        headers:{Accept:'application/json',...options.headers}})
      return await limitedJson(response,stage)
    } catch(error) {
      if(error instanceof MonitorFailure) throw error
      fail(stage,error?.name==='TimeoutError'||error?.name==='AbortError'?'TIMEOUT':'NETWORK_FAILURE')
    }
  }
  async function step(stage,operation) {
    const span={trace_id:traceId,span_id:id().slice(0,16),parent_span_id:rootSpan,
      op:'monitor.'+stage,description:'Benchmark Finder '+stage,start_timestamp:now()/1000}
    spans.push(span)
    try { const value=await operation(span.span_id);span.status='ok';return value }
    catch(error) {span.status='internal_error';throw error}
    finally {span.timestamp=now()/1000}
  }
  async function envelope(type,payload) {
    try {
      const response=await fetchImpl(config.dsn.origin+'/api/'+PROJECT+'/envelope/',{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
        headers:{'Content-Type':'application/x-sentry-envelope',
          'X-Sentry-Auth':'Sentry sentry_version=7, sentry_key='+config.dsn.username+', sentry_client=sg2-finder-monitor/1.0'},
        body:JSON.stringify({...(payload.event_id?{event_id:payload.event_id}:{}),sent_at:new Date(now()).toISOString()})+'\n'
          +JSON.stringify({type})+'\n'+JSON.stringify(payload)+'\n'})
      const ok=response.ok
      await response.body?.cancel()
      if (!ok) telemetryFailed=true
      return ok
    } catch {telemetryFailed=true;return false}
  }
  const checkIn=(status)=>envelope('check_in',{check_in_id:checkInId,monitor_slug:MONITOR,status,
    environment:'development',release:config.release,contexts:{trace:{trace_id:traceId}},
    ...(status==='in_progress'?{monitor_config:{schedule:{type:'crontab',value:SCHEDULE},timezone:'UTC',
      checkin_margin:10,max_runtime:3,failure_issue_threshold:1,recovery_threshold:1}}:{duration:(now()-started)/1000})})
  const clerk=(stage,path,body)=>jsonRequest(stage,'https://api.clerk.com/v1'+path,{
    ...(body?{method:'POST',body:JSON.stringify(body)}:{}),
    headers:{Authorization:'Bearer '+config.clerkKey,...(body?{'Content-Type':'application/json'}:{})}})
  async function finder(stage,path,body) {
    // Refresh the official short-lived JWT for each operation; never retry provider work.
    const token=await clerk('session','/sessions/'+sessionId+'/tokens',{})
    if(typeof token.jwt!=='string'||token.jwt.length>8192) fail('session','SESSION_TOKEN_INVALID')
    return step(stage,spanId=>jsonRequest(stage,config.target+path,{
      ...(body?{method:'POST',body:JSON.stringify(body)}:{}),
      headers:{Authorization:'Bearer '+token.jwt,
        'x-profitia-idempotency-key':idempotencyKey(stage,body??path,started),
        'sentry-trace':traceId+'-'+spanId+'-1',...(body?{'Content-Type':'application/json'}:{})}}))
  }
  await checkIn('in_progress')
  try {
    if(!/^sk_test_[A-Za-z0-9_-]+$/.test(config.clerkKey??'')) fail('configuration','DEVELOPMENT_CLERK_KEY_REQUIRED')
    const health=await step('health',()=>jsonRequest('health',config.target+'/api/health'))
    if(health.status!=='ok'||health.service!=='sg-runtime'||health.environment!=='development')
      fail('health','TARGET_MISMATCH')
    const users=await step('account',()=>clerk('account','/users?email_address='+encodeURIComponent(config.email)+'&limit=2'))
    if(!Array.isArray(users)||users.length!==1) fail('account','ACCOUNT_NOT_UNIQUE')
    const user=users[0]
    if(!/^user_[A-Za-z0-9]+$/.test(user.id??'')||user.banned||user.locked||user.two_factor_enabled
      ||!user.email_addresses?.some(e=>e.email_address===config.email&&e.verification?.status==='verified'))
      fail('account','ACCOUNT_NOT_ELIGIBLE')
    // Official Clerk testing endpoint, available only in Development instances.
    const session=await step('session',()=>clerk('session','/sessions',{user_id:user.id}))
    if(!/^sess_[A-Za-z0-9]+$/.test(session.id??'')) fail('session','SESSION_INVALID')
    sessionId=session.id
    if(session.user_id!==user.id||session.status!=='active') fail('session','SESSION_INVALID')
    const metadata=await finder('metadata','/api/benchmark/metadata')
    if(!validItems(metadata)||!metadata.items.every(item=>typeof item.key==='string')) fail('metadata','METADATA_UNAVAILABLE')
    const search=await finder('search','/api/benchmark/search?q=WTI&limit=3')
    if(!validItems(search)||!search.items.some(item=>item.provider?.providerCode==='MACROBOND'
      &&typeof item.providerSeries?.providerSeriesId==='string'
      &&/WTI|West Texas Intermediate/i.test(item.displayName??''))) fail('search','CONTROL_BENCHMARK_MISSING')
    const candidate=search.items.find(item=>item.provider?.providerCode==='MACROBOND'
      &&/WTI|West Texas Intermediate/i.test(item.displayName??''))
    const definition=metadata.items.find(item=>
      /^(frequency)$/i.test(item.key)||/^(frequency)$/i.test(item.providerKey??''))
    if(!definition||typeof candidate.frequency!=='string'||!candidate.frequency) fail('metadata','FREQUENCY_METADATA_MISSING')
    const values=await finder('metadata_values','/api/benchmark/metadata/'+encodeURIComponent(definition.key)+'/values?limit=200')
    if(!validItems(values)) fail('metadata_values','DICTIONARY_EMPTY')
    const frequency=values.items.find(item=>item.value===candidate.frequency||item.label===candidate.frequency)
    if(!frequency||typeof frequency.value!=='string') fail('metadata_values','CONTROL_FILTER_MISSING')
    const advanced=await finder('advanced_search','/api/benchmark/search',{
      exactSeriesId:candidate.providerSeries.providerSeriesId,
      filters:[{metadataKey:definition.key,operator:'equals',value:frequency.value}],limit:1})
    if(!validItems(advanced)||!advanced.items.some(item=>item.providerSeries?.providerSeriesId===candidate.providerSeries.providerSeriesId))
      fail('advanced_search','CONTROL_BENCHMARK_MISSING')
  } catch(error) {
    failure=error instanceof MonitorFailure?error:new MonitorFailure('monitoring','INTERNAL_FAILURE')
  } finally {
    if(sessionId) {
      try {
        // Independent cleanup timeout still runs if the probe's overall deadline expired.
        const response=await fetchImpl('https://api.clerk.com/v1/sessions/'+sessionId+'/revoke',{
          method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
          headers:{Authorization:'Bearer '+config.clerkKey,'Content-Type':'application/json'},body:'{}'})
        const revoked=await limitedJson(response,'cleanup')
        if(revoked.id!==sessionId||revoked.status!=='revoked') fail('cleanup','SESSION_REVOCATION_FAILED')
      } catch {failure??=new MonitorFailure('cleanup','SESSION_REVOCATION_FAILED')}
    }
  }
  // Only allowlisted technical fields leave this process. No JWT, account, payload or provider results.
  if(telemetryFailed&&!failure) failure=new MonitorFailure('monitoring','TELEMETRY_UNAVAILABLE')
  if(failure) await envelope('event',{event_id:id(),timestamp:now()/1000,platform:'node',level:'error',
    environment:'development',release:config.release,
    exception:{values:[{type:'CriticalBenchmarkFinderUnavailable_Development',
      value:'Development Benchmark Finder synthetic check failed: '+failure.stage+' / '+failure.code,
      mechanism:{type:'synthetic',handled:true}}]},
    fingerprint:['sg2','development','benchmark-finder-synthetic',failure.stage,failure.code],
    tags:{application:'sg-runtime',service:'sg2-development-finder-monitor',module:'benchmark',operation:'diagnostic'},
    contexts:{trace:{trace_id:traceId,span_id:rootSpan,op:'monitor.finder',status:'internal_error'}}})
  await envelope('transaction',{event_id:id(),type:'transaction',transaction:'Development Benchmark Finder synthetic',
    platform:'node',environment:'development',release:config.release,start_timestamp:started/1000,timestamp:now()/1000,
    contexts:{trace:{trace_id:traceId,span_id:rootSpan,op:'monitor.finder',status:failure?'internal_error':'ok'}},spans})
  await checkIn(failure||telemetryFailed?'error':'ok')
  const result={monitor:MONITOR,environment:'development',status:failure||telemetryFailed?'error':'ok',
    release:config.release,traceId,checkInId,requestCount,durationMs:now()-started,
    ...(failure?{stage:failure.stage,code:failure.code}:{}),telemetryAccepted:!telemetryFailed}
  log(result)
  return result
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  runMonitor(process.env).then(result=>{process.exitCode=result.status==='ok'?0:1}).catch(error=>{
    console.error(JSON.stringify({monitor:MONITOR,environment:'development',status:'error',
      stage:error instanceof MonitorFailure?error.stage:'configuration',
      code:error instanceof MonitorFailure?error.code:'CONFIGURATION_INVALID'}))
    process.exitCode=1
  })
}
