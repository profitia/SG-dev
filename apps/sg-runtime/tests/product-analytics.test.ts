import test from 'node:test'
import './product-analytics-monitoring.test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
import {JSDOM} from 'jsdom'
import {readProductAnalyticsConfiguration, isAllowedAnalyticsBrowser, isProductAnalyticsPathEnabled, productAnalyticsSdkOptions, DEVELOPMENT_SERVICE} from '../lib/product-analytics/config'
import {filterSdkEvent, isProductAnalyticsEventEnabled, validateBusinessEvent} from '../lib/product-analytics/contract'
import {ProductAnalytics} from '../lib/product-analytics/adapter'

const token='phc_'+ 'A'.repeat(43) // Deliberately synthetic, never an actual project token.
const env={SG2_PRODUCT_ANALYTICS_ENABLED:'true',APP_ENV:'development',RENDER_SERVICE_ID:DEVELOPMENT_SERVICE,
  SG2_PRODUCT_ANALYTICS_CONSENT_MODE:'explicit_test',POSTHOG_PROJECT_ID:'329829',POSTHOG_HOST:'https://eu.i.posthog.com',POSTHOG_PROJECT_TOKEN:token}

test('configuration fails closed for absent, invalid and foreign deployment/environment values',()=>{
  assert.equal(readProductAnalyticsConfiguration({}),null)
  for(const key of Object.keys(env))assert.equal(readProductAnalyticsConfiguration({...env,[key]:undefined}),null,key)
  for(const patch of [{APP_ENV:'staging'},{APP_ENV:'production'},{APP_ENV:'Development'},{SG2_PRODUCT_ANALYTICS_ENABLED:'1'},
    {RENDER_SERVICE_ID:'srv-other'},{POSTHOG_PROJECT_TOKEN:'invalid'},{POSTHOG_HOST:'https://us.i.posthog.com'},
    {POSTHOG_HOST:'https://eu.i.posthog.com/evil'},{POSTHOG_PROJECT_ID:'other'}, {SG2_PRODUCT_ANALYTICS_CONSENT_MODE:'implicit'}])
    assert.equal(readProductAnalyticsConfiguration({...env,...patch}),null)
  assert.deepEqual(readProductAnalyticsConfiguration({...env,NODE_ENV:'production'}),{token,host:env.POSTHOG_HOST})
  assert.equal(readProductAnalyticsConfiguration({...env,RENDER_GIT_COMMIT:'bad'})?.releaseSha,undefined)
  assert.equal(readProductAnalyticsConfiguration({...env,RENDER_GIT_COMMIT:'a'.repeat(40)})?.releaseSha,'a'.repeat(40))
  for(const hostname of ['localhost','demo-sg-porr.spendguru.app','spendguru.app','sg2-development-runtime.onrender.com.evil.test'])
    assert.equal(isAllowedAnalyticsBrowser({hostname,protocol:'https:'}),false)
  assert.equal(isAllowedAnalyticsBrowser({hostname:'sg2-development-runtime.onrender.com',protocol:'http:'}),false)
  assert.equal(isAllowedAnalyticsBrowser({hostname:'sg2-development-runtime.onrender.com',protocol:'https:'}),true)
})

test('adapter rejects unknown events, free text, business IDs and invalid status/mode combinations',()=>{
  for(const name of ['$pageview','$autocapture','$identify','$exception','$snapshot','invented'])assert.equal(validateBusinessEvent(name,{module:'appshell'}),null)
  for(const key of ['nip','krs','regon','email','company','supplierId','userId','organisationId','token','url','query','weights','amount','result','stack'])
    assert.equal(validateBusinessEvent('benchmark_selected',{module:'benchmark_finder',[key]:'sensitive'}),null,key)
  assert.equal(validateBusinessEvent('adp_local_action_performed',{module:'adp',action_type:'form.change',value:'secret'}),null)
  assert.equal(validateBusinessEvent('adp_local_action_performed',{module:'adp',action_type:'invented'}),null)
  assert.equal(validateBusinessEvent('pci_analysis_finished',{module:'price_change_index',status:'success'}),null)
  assert.equal(validateBusinessEvent('pci_category_save_requested',{module:'price_change_index',mode:'simple'}),null)
  assert.equal(validateBusinessEvent('benchmark_selected',{module:'xray'}),null)
  assert.equal(validateBusinessEvent('pci_step_viewed',{module:'price_change_index',step:'company-secret'}),null)
})

test('last SDK boundary removes enriched PII/URLs/person updates and preserves required technical envelope',()=>{
  const id=randomUUID(),uuid=randomUUID(),timestamp=new Date()
  const raw={event:'adp_local_action_performed',uuid,timestamp,$set:{email:'private'},$set_once:{name:'private'},$unset:['email'],context:'private',
    properties:{module:'adp',action_type:'contact.add',token,distinct_id:id,$device_id:randomUUID(),$session_id:randomUUID(),$window_id:randomUUID(),
      $lib:'web',$lib_version:'1.444.0',$current_url:'https://private/?nip=123',$referrer:'https://private/?token=secret',$pathname:'/supplier/private',
      $initial_current_url:'private',$set:{email:'private'},email:'private',value:'private',organisationId:'private',$geoip_disable:false}}
  const result=filterSdkEvent(raw,true,token)!
  assert(result);assert.equal(result.uuid,uuid);assert.equal(result.timestamp,timestamp)
  assert.equal(result.properties.token,token);assert.equal(result.properties.distinct_id,id)
  assert.equal(result.properties.application,'SG2');assert.equal(result.properties.environment,'development')
  assert.equal(result.properties.$geoip_disable,true,'ingestion-side GeoIP suppression cannot be overridden by incoming SDK properties')
  assert.deepEqual(Object.keys(result).sort(),['event','properties','timestamp','uuid'])
  assert.doesNotMatch(JSON.stringify(result),/private|nip=|email|organisationId|\$set|current_url|referrer|pathname/)
  assert.equal(filterSdkEvent(raw,false,token),null)
  assert.equal(filterSdkEvent({...raw,properties:{...raw.properties,token:'other'}},true,token),null)
  assert.equal(filterSdkEvent({...raw,properties:{...raw.properties,distinct_id:'raw_clerk_id'}},true,token),null)
})

test('default off, consent withdrawal, transport failure and duplicate effects never affect business work',()=>{
  const analytics=new ProductAnalytics(),events:any[]=[],input={module:'appshell' as const,entry_point:'appshell'}
  assert.equal(analytics.capture('app_opened',input),false);assert.equal(analytics.begin('appshell','benchmark_search'),null)
  let permitted=false
  analytics.connect((event,properties)=>events.push({event,properties}),()=>permitted)
  analytics.once('app','app_opened',input);assert.equal(events.length,0)
  permitted=true
  for(let i=0;i<5;i++)analytics.once('app','app_opened',input)
  assert.equal(events.length,1)
  for(const key of ['benchmark_finder','benchmark_finder','adp','adp','benchmark_finder'])analytics.transition('module',key,'module_opened',{module:key as 'adp',entry_point:'appshell'})
  assert.equal(events.filter(e=>e.event==='module_opened').length,1)
  const attempt=analytics.begin('price_change_index','pci_analysis')!
  analytics.finish(attempt,'CALCULATED');analytics.finish(attempt,'CALCULATED')
  assert.equal(events.filter(e=>e.event==='operation_completed').length,1)
  assert.equal(events.at(-1).properties.process_attempt_id,attempt.id)
  const limited=analytics.begin('price_change_index','pci_analysis');analytics.finish(limited,'PROXY_MARKET_ONLY')
  assert.equal(events.filter(e=>e.event==='operation_completed').length,1)
  permitted=false;assert.equal(analytics.capture('app_opened',input),false)
  analytics.connect(()=>{throw Error('transport failure')},()=>true)
  assert.doesNotThrow(()=>analytics.capture('app_opened',input));assert.equal(analytics.capture('app_opened',input),false)
})

test('stage one blocks every Finder entry, view, event and operation at adapter and final SDK boundaries',()=>{
  for(const pathname of ['/pl/dashboard/benchmark-finder','/en/dashboard/benchmark-finder/','/pl/dashboard/benchmark-finder/detail'])
    assert.equal(isProductAnalyticsPathEnabled(pathname),false)
  for(const pathname of ['/pl/dashboard','/en/dashboard/adp','/pl/dashboard/xray'])assert.equal(isProductAnalyticsPathEnabled(pathname),true)
  const analytics=new ProductAnalytics(),sent:any[]=[]
  analytics.connect((event,properties)=>sent.push({event,properties}),()=>true)
  const excluded:any[]=[['module_opened',{module:'benchmark_finder',entry_point:'appshell'}],
    ['screen_viewed',{module:'appshell',view:'benchmark_finder'}],['app_opened',{module:'appshell',entry_point:'benchmark_finder'}],
    ['benchmark_search_submitted',{module:'benchmark_finder',mode:'simple',process_attempt_id:randomUUID()}],
    ['benchmark_results_displayed',{module:'benchmark_finder',mode:'simple',status:'success',result_count:1}],
    ['benchmark_selected',{module:'benchmark_finder'}],
    ['operation_started',{module:'appshell',operation:'benchmark_search',process_attempt_id:randomUUID()}],
    ['operation_failed',{module:'benchmark_finder',operation:'benchmark_search',process_attempt_id:randomUUID(),status:'error'}]]
  for(const[event,properties]of excluded){
    assert.equal(isProductAnalyticsEventEnabled(event,properties),false,event)
    assert.equal(analytics.capture(event,properties),false,event)
    assert.equal(filterSdkEvent({event,properties:{...properties,token,distinct_id:randomUUID()}},true,token),null,event)
  }
  assert.equal(sent.length,0)
  for(const[event,properties]of [['app_opened',{module:'appshell',entry_point:'appshell'}],['adp_view_opened',{module:'adp',view:'data'}],['xray_report_opened',{module:'xray'}]] as const)
    assert.equal(analytics.capture(event,properties),true,event)
  assert.equal(sent.length,3)
})

test('pinned real browser SDK enriches then filters payloads, emits no automatic events and stores no identity',async()=>{
  const dom=new JSDOM('<html><body><input value="private"/></body></html>',{url:'https://sg2-development-runtime.onrender.com/pl/dashboard?email=private',runScripts:'outside-only'})
  const requests:any[]=[],raw:any[]=[],filtered:any[]=[]
  class MockXHR {readyState=0;status=200;responseText='{}';withCredentials=false;onreadystatechange:any;onload:any;
    open(method:string,url:string){requests.push({method,url})}setRequestHeader(){}send(body:unknown){requests.at(-1).body=body;this.readyState=4;this.onreadystatechange?.();this.onload?.()}abort(){}getAllResponseHeaders(){return ''}}
  Object.defineProperty(dom.window,'XMLHttpRequest',{value:MockXHR})
  Object.defineProperty(dom.window,'fetch',{value:async(url:unknown,options:unknown)=>{requests.push({url:String(url),options});return {ok:true,status:200,text:async()=>'{}',json:async()=>({})}}})
  dom.window.eval(fs.readFileSync(new URL('../node_modules/posthog-js/dist/array.no-external.js',import.meta.url),'utf8'))
  const sdk=(dom.window as any).posthog
  const config=productAnalyticsSdkOptions({token,host:env.POSTHOG_HOST},()=>true)
  try {
  sdk.init(token,{...config,api_transport:'XHR',disable_compression:true,before_send:(data:any)=>{raw.push(data);const clean=filterSdkEvent(data,true,token);filtered.push(clean);return clean}})
  await new Promise(resolve=>setTimeout(resolve,30))
  assert.equal(requests.length,0,'initialization must not fetch flags, recordings or automatic events')
  sdk.capture('adp_local_action_performed',{module:'adp',action_type:'contact.add'})
  assert.equal(filtered.length,1);assert(raw[0].properties.$current_url.includes('email=private'))
  assert(filtered[0]);assert.doesNotMatch(JSON.stringify(filtered[0]),/private|current_url|referrer|pathname|browser|os_version/)
  assert.equal(filtered[0].properties.token,token)
  assert.equal(filtered[0].properties.$geoip_disable,true)
  assert.equal(dom.window.document.cookie,'');assert.equal(dom.window.localStorage.length,0);assert.equal(dom.window.sessionStorage.length,0)
  sdk.capture('ui_interaction',{module:'category_builder',view:'category_builder',control_id:'category-save-button',control_path:'body:1/main:1/button:1',interaction:'click',text:'private',value:'private'})
  assert.equal(filtered.length,2);assert(filtered[1]);assert.equal(filtered[1].properties.control_id,'category-save-button')
  assert.doesNotMatch(JSON.stringify(filtered[1]),/private|current_url|pathname|value|text/)
  sdk.capture('$exception',{message:'private'});assert.equal(filtered.at(-1),null)
  assert.equal(requests.filter(r=>/flags|decide|\/s\//.test(r.url)).length,0)
  assert.equal(requests.length,2,'only the explicit accepted events may reach the mocked transport')
  const body=String(requests[0].body),encoded=new URLSearchParams(body).get('data')
  const serialized=encoded?(encoded.startsWith('{')?encoded:Buffer.from(encoded,'base64').toString('utf8')):body
  const sent=JSON.parse(serialized)
  assert.deepEqual(Object.keys(sent).sort(),['api_key','batch','sent_at'])
  assert.equal(sent.api_key,token);assert.equal(sent.batch.length,1)
  assert.equal(sent.batch[0].properties.$geoip_disable,true,'the pinned real SDK must retain the suppression flag in the actual transport body')
  } finally { dom.window.close() }
})
