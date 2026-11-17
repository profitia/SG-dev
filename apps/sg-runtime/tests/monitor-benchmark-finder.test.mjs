import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readConfiguration,runMonitor,idempotencyKey} from '../scripts/monitor-benchmark-finder.mjs'

const env=()=>({APP_ENV:'development',FINDER_MONITOR_ENVIRONMENT:'development',
  FINDER_MONITOR_TARGET_URL:'https://dev-sg2.spendguru.app',FINDER_MONITOR_ACCOUNT:'tomasz@profitia.pl',
  SENTRY_DSN:'https://'+'1'.repeat(32)+'@o123.ingest.de.sentry.io/4512356940120144',
  RENDER_GIT_COMMIT:'a'.repeat(40),PROFITIA_CLERK_ISSUER:'https://monitor-test.clerk.accounts.dev',PROFITIA_CLERK_SECRET_KEY:'sk_test_existing_secret'})
const jwt=claims=>'e30.'+Buffer.from(JSON.stringify({iss:'https://monitor-test.clerk.accounts.dev',azp:'https://dev-sg2.spendguru.app',sub:'user_monitor',sid:'sess_monitor',exp:Math.floor(Date.now()/1000)+60,...claims})).toString('base64url')+'.signature'
const candidate={displayName:'Crude Oil WTI, Spot Price',provider:{providerCode:'MACROBOND'},
  providerSeries:{providerSeriesId:'cl_c1_cl'},frequency:'Daily'}
function fixture(change=()=>null) {
  const requests=[],envelopes=[],logs=[]
  const json=value=>Response.json(value)
  const fetchImpl=async(url,options={})=>{
    const u=new URL(url);requests.push({url:u,options})
    assert.equal(options.redirect,'error')
    assert.ok(options.signal)
    if(u.hostname.endsWith('.sentry.io')) {
      const lines=options.body.trim().split('\n')
      const item={type:JSON.parse(lines[1]).type,payload:JSON.parse(lines[2])}
      envelopes.push(item)
      const alternative=change({type:'telemetry',item,options})
      return alternative??json({})
    }
    const alternative=change({type:'request',url:u,options})
    if(alternative) return alternative
    if(u.hostname==='api.clerk.com') {
      assert.equal(options.headers.Authorization,'Bearer sk_test_existing_secret')
      if(u.pathname==='/v1/users') return json([{id:'user_monitor',banned:false,locked:false,two_factor_enabled:false,
        email_addresses:[{email_address:'tomasz@profitia.pl',verification:{status:'verified'}}]}])
      if(u.pathname==='/v1/sign_in_tokens') {
        assert.deepEqual(JSON.parse(options.body),{user_id:'user_monitor',expires_in_seconds:60,honor_lockout:true})
        return json({id:'sit_monitor',token:'ticket_private_credential'})
      }
      if(u.pathname.endsWith('/revoke')) return json({id:'sess_monitor',status:'revoked'})
    }
    if(u.hostname==='monitor-test.clerk.accounts.dev') {
      assert.equal(options.headers.Origin,'https://dev-sg2.spendguru.app')
      assert.equal(options.headers.Authorization,undefined)
      if(u.pathname==='/v1/dev_browser') return json({token:'browser_private_credential'})
      assert.equal(u.searchParams.get('__dev_session'),'browser_private_credential')
      if(u.pathname==='/v1/client/sign_ins') {
        assert.deepEqual(Object.fromEntries(new URLSearchParams(options.body)),{strategy:'ticket',ticket:'ticket_private_credential'})
        return json({response:{status:'complete',created_session_id:'sess_monitor'}})
      }
      if(u.pathname.endsWith('/tokens')) return json({jwt:jwt()})
      if(u.pathname==='/v1/client') return json({response:{sessions:[]}})
    }
    assert.equal(u.origin,'https://dev-sg2.spendguru.app')
    if(u.pathname==='/api/health') return json({status:'ok',service:'sg-runtime',environment:'development'})
    assert.ok(options.headers.Authorization.startsWith('Bearer e30.'))
    assert.match(options.headers['x-profitia-idempotency-key'],/^finder_[A-Za-z0-9_-]{16,100}$/)
    assert.match(options.headers['sentry-trace'],/^[a-f0-9]{32}-[a-f0-9]{16}-1$/)
    if(u.pathname==='/api/benchmark/metadata') return json({items:[{key:'Frequency',providerKey:'Frequency'}]})
    if(u.pathname.endsWith('/values')) return json({items:[{value:'D',label:'Daily'}]})
    if(u.pathname==='/api/benchmark/search') return json({items:[candidate]})
    throw new Error('Unexpected destination')
  }
  return {requests,envelopes,logs,fetchImpl,log:value=>logs.push(value)}
}
const revoked=f=>f.requests.some(r=>r.url.pathname==='/v1/sessions/sess_monitor/revoke')
test('real flow contract covers metadata, dictionary, simple and filtered search with one revoked test session',async()=>{
  const f=fixture(),result=await runMonitor(env(),f)
  assert.equal(result.status,'ok');assert.ok(revoked(f))
  assert.equal(f.requests.filter(r=>r.url.pathname==='/v1/sign_in_tokens').length,1)
  assert.equal(f.requests.filter(r=>r.url.hostname==='dev-sg2.spendguru.app').length,5)
  const advanced=f.requests.find(r=>r.url.pathname==='/api/benchmark/search'&&r.options.method==='POST')
  assert.deepEqual(JSON.parse(advanced.options.body),{exactSeriesId:'cl_c1_cl',
    filters:[{metadataKey:'Frequency',operator:'equals',value:'D'}],limit:1})
  const checkins=f.envelopes.filter(e=>e.type==='check_in').map(e=>e.payload)
  assert.equal(checkins[0].monitor_config.schedule.value,'0 */6 * * *')
  assert.equal(checkins[0].monitor_config.timezone,'UTC')
  assert.equal(checkins[0].check_in_id,checkins[1].check_in_id)
  assert.equal(checkins[1].status,'ok')
  const trace=f.envelopes.find(e=>e.type==='transaction').payload
  assert.equal(trace.environment,'development');assert.equal(trace.release,'a'.repeat(40))
  assert.ok(trace.spans.length>=7);assert.equal(trace.contexts.trace.trace_id,result.traceId)
})
test('handled 403 becomes Critical with correct environment and sessions are revoked',async()=>{
  const f=fixture(({url})=>url?.pathname==='/api/benchmark/metadata'?Response.json({error:'private denial details'},{status:403}):null)
  const result=await runMonitor(env(),f)
  assert.equal(result.status,'error');assert.equal(result.stage,'metadata');assert.equal(result.code,'HTTP_403')
  assert.ok(revoked(f))
  const error=f.envelopes.find(e=>e.type==='event').payload
  assert.match(error.exception.values[0].type,/^Critical/)
  assert.equal(error.environment,'development');assert.equal(error.release,'a'.repeat(40))
  assert.equal(f.envelopes.at(-1).payload.status,'error')
})
test('HTTP 200 with missing control results is failure',async()=>{
  const f=fixture(({url,options})=>url?.pathname==='/api/benchmark/search'&&options.method==='POST'?Response.json({items:[]}):null)
  const result=await runMonitor(env(),f)
  assert.equal(result.code,'CONTROL_BENCHMARK_MISSING');assert.equal(result.stage,'advanced_search');assert.ok(revoked(f))
})
test('HTTP 200 login HTML does not pass the functional check',async()=>{
  const f=fixture(({url})=>url?.pathname==='/api/benchmark/metadata'?new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}}):null)
  const result=await runMonitor(env(),f)
  assert.equal(result.code,'INVALID_CONTENT_TYPE');assert.ok(revoked(f))
})
test('transport failures produce minimal telemetry without account, credentials, raw errors or business content',async()=>{
  const f=fixture(({url})=>{if(url?.pathname==='/api/benchmark/search')throw new Error('jwt_private_credential business-sensitive tomasz@profitia.pl')})
  const result=await runMonitor(env(),f)
  assert.equal(result.code,'NETWORK_FAILURE');assert.ok(revoked(f))
  const emitted=JSON.stringify({events:f.envelopes,logs:f.logs})
  for(const privateText of ['ticket_private_credential','browser_private_credential',jwt(),'sk_test_existing_secret','business-sensitive','tomasz@profitia.pl','cl_c1_cl'])
    assert.equal(emitted.includes(privateText),false)
})
test('wrong environment, target, account or Sentry project fail before any request',async()=>{
  for(const patch of [{APP_ENV:'production'},{FINDER_MONITOR_ENVIRONMENT:'staging'},
    {FINDER_MONITOR_TARGET_URL:'https://example.com'},{FINDER_MONITOR_ACCOUNT:'another@example.com'},
    {SENTRY_DSN:'https://'+'1'.repeat(32)+'@o123.ingest.de.sentry.io/999'},
    {RENDER_GIT_COMMIT:'moving-main'},{PROFITIA_CLERK_ISSUER:'https://bad.example.com'}]) {
    const f=fixture()
    await assert.rejects(runMonitor({...env(),...patch},f))
    assert.equal(f.requests.length,0)
  }
})
test('live Clerk credentials are rejected without sending them to Clerk',async()=>{
  const f=fixture(),result=await runMonitor({...env(),PROFITIA_CLERK_SECRET_KEY:'sk_live_forbidden'},f)
  assert.equal(result.code,'DEVELOPMENT_CLERK_KEY_REQUIRED')
  assert.equal(f.requests.some(r=>r.url.hostname==='api.clerk.com'),false)
})
test('foreign, locked or unverified accounts cannot acquire a session',async()=>{
  for(const account of [{id:'user_monitor',locked:true},{id:'user_monitor',email_addresses:[]},
    {id:'user_other',email_addresses:[{email_address:'other@example.com',verification:{status:'verified'}}]}]) {
    const f=fixture(({url})=>url?.pathname==='/v1/users'?Response.json([account]):null)
    const result=await runMonitor(env(),f)
    assert.equal(result.code,'ACCOUNT_NOT_ELIGIBLE')
    assert.equal(f.requests.some(r=>r.url.pathname==='/v1/sign_in_tokens'),false)
  }
})
test('cleanup failure fails the run',async()=>{
  const f=fixture(({url})=>url?.pathname.endsWith('/revoke')?Response.json({error:'no'},{status:503}):null)
  const result=await runMonitor(env(),f)
  assert.equal(result.status,'error');assert.equal(result.stage,'cleanup')
})
test('telemetry rejection remains a failed run with functional requests still performed',async()=>{
  const f=fixture(({type})=>type==='telemetry'?Response.json({error:'unavailable'},{status:503}):null)
  const result=await runMonitor(env(),f)
  assert.equal(result.status,'error');assert.equal(result.telemetryAccepted,false);assert.ok(revoked(f))
  assert.equal(f.envelopes.at(-1).payload.status,'error')
})
test('idempotency prevents duplicate work in the same six-hour window without colliding changed commands',()=>{
  assert.equal(idempotencyKey('search','WTI',21600001),idempotencyKey('search','WTI',21600100))
  assert.notEqual(idempotencyKey('search','WTI',21600001),idempotencyKey('search','WTI',43200001))
  assert.notEqual(idempotencyKey('search','WTI',21600001),idempotencyKey('search','Brent',21600001))
})

test('a genuine token missing or mismatching the authorized party never reaches Finder',async()=>{
  for(const patch of [{azp:null},{azp:'https://other.example.com'},{sub:'user_other'},{exp:1}]) {
    const f=fixture(({url})=>url?.hostname==='monitor-test.clerk.accounts.dev'&&url.pathname.endsWith('/tokens')?Response.json({jwt:jwt(patch)}):null)
    const result=await runMonitor(env(),f)
    assert.equal(result.code,'SESSION_BINDING_INVALID');assert.ok(revoked(f))
    assert.equal(f.requests.some(r=>r.url.pathname==='/api/benchmark/metadata'),false)
  }
})
test('an incomplete sign-in revokes its unused ticket and cannot call Finder',async()=>{
  const f=fixture(({url})=>url?.pathname==='/v1/client/sign_ins'?Response.json({response:{status:'needs_second_factor'}}):url?.pathname==='/v1/sign_in_tokens/sit_monitor/revoke'?Response.json({id:'sit_monitor',status:'revoked'}):null)
  const result=await runMonitor(env(),f)
  assert.equal(result.code,'SESSION_INCOMPLETE')
  assert.ok(f.requests.some(r=>r.url.pathname==='/v1/sign_in_tokens/sit_monitor/revoke'))
  assert.equal(f.requests.some(r=>r.url.pathname==='/api/benchmark/metadata'),false)
})
test('a lost sign-in response recovers and revokes only the isolated client session',async()=>{
  const f=fixture(({url})=>{
    if(url?.pathname==='/v1/client/sign_ins')throw new Error('lost response')
    if(url?.pathname==='/v1/client')return Response.json({response:{sessions:[{id:'sess_monitor',user:{id:'user_monitor'}}]}})
    if(url?.pathname==='/v1/sign_in_tokens/sit_monitor/revoke')return Response.json({id:'sit_monitor',status:'revoked'})
  })
  const result=await runMonitor(env(),f)
  assert.equal(result.code,'NETWORK_FAILURE');assert.ok(revoked(f))
})
