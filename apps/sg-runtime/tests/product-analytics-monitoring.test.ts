import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {randomUUID} from 'node:crypto'
import {ProductAnalytics} from '../lib/product-analytics/adapter'
import {startApplicationMonitoring} from '../lib/product-analytics/monitoring'
import {analyticsSurface,isFinderContext} from '../lib/product-analytics/surfaces'
import {filterSdkEvent,validateBusinessEvent} from '../lib/product-analytics/contract'

function fixture(path='/pl/dashboard',html='<button>Private business label</button>') {
  const dom=new JSDOM(`<html><body>${html}</body></html>`,{url:`https://dev-sg2.spendguru.app${path}`,pretendToBeVisual:true})
  const win=dom.window as unknown as Window & typeof globalThis,analytics=new ProductAnalytics(),events:any[]=[]
  let consent=true,enabled=true
  const permitted=()=>consent&&enabled&&!win.location.pathname.split('/').includes('benchmark-finder')&&!isFinderContext(win.document)
  analytics.connect((event,properties)=>events.push({event,properties}),permitted)
  const stop=startApplicationMonitoring(win,permitted,analytics)
  const fire=(selector:string,type='click')=>win.document.querySelector(selector)!.dispatchEvent(new win.Event(type,{bubbles:true,cancelable:true}))
  return {dom,win,analytics,events,fire,setConsent:(v:boolean)=>{consent=v},setEnabled:(v:boolean)=>{enabled=v},close(){stop();dom.window.close()}}
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,45))

test('route descriptors discard resource IDs, unknown query values and locale',()=>{
  for(const [path,search,module,view] of [
    ['/pl/dashboard','','appshell','appshell'],['/en/dashboard/xray','','xray','xray'],
    ['/pl/account','','account','account'],['/en/register','','account','registration'],['/pl','','account','sign_in'],
    ['/pl/category-builder','','category_builder','category_builder'],['/pl/cost-scan/category/private-id','?nip=123','cost_scan','cost_scan'],
    ['/pl/supplier-intelligence','','supplier_intelligence','supplier_intelligence'],['/pl/future/private','','other','other'],
    ['/pl/dashboard/adp','?view=data&section=payments&area=contacts&email=private','adp','data'],
    ['/en/dashboard/adp','?view=private&section=secret','adp','overview'],['/pl/dashboard/benchmark-finder','','benchmark_finder','benchmark_finder'],
  ]) {
    const result=analyticsSurface(path,search)
    assert.equal(result.module,module);assert.equal(result.view,view)
    assert.doesNotMatch(JSON.stringify(result),/private|secret|nip|email|\/pl/)
  }
})

test('delegated future controls capture useful action types without text, values, IDs, attributes or URLs',async()=>{
  const f=fixture('/pl/category-builder?token=PRIVATE',`<form id="secret-company"><input id="private-nip" name="supplierId" value="PRIVATE123" data-testid="category-name-input"/><textarea>CONFIDENTIAL</textarea><select><option value="SECRET">Private supplier</option></select><button title="SECRET" data-analytics-id="private-company">PRIVATE</button></form>`)
  try {
    f.fire('input','input');f.fire('input','input');f.fire('textarea','input');f.fire('select','change');f.fire('button');f.fire('form','submit')
    await settle()
    assert.equal(f.events.filter(e=>e.event==='form_started').length,1)
    assert.equal(f.events.filter(e=>e.properties.interaction==='first_edit').length,2,'once per field per screen, without values or lengths')
    assert.equal(f.events.filter(e=>e.event==='form_submitted').length,1)
    assert.equal(f.events.filter(e=>e.event==='operation_completed').length,0,'submit never means business success')
    assert(f.events.some(e=>e.properties.control_id==='category-name-input'))
    const token='phc_'+'A'.repeat(43)
    for(const e of f.events) {
      assert(validateBusinessEvent(e.event,e.properties),e.event)
      const sent=filterSdkEvent({...e,properties:{...e.properties,token,distinct_id:randomUUID(),$current_url:'PRIVATE',text:'SECRET'}},true,token)
      assert(sent,e.event);assert.doesNotMatch(JSON.stringify(sent),/PRIVATE|SECRET|CONFIDENTIAL|supplierId|private-nip|secret-company|title|current_url/)
      assert.equal(sent.properties.$geoip_disable,true)
    }
    assert(f.events.some(e=>e.event==='performance_measured'&&e.properties.metric==='next_frame_delay'))
  } finally {f.close()}
})

test('Finder launch controls, destination links and all nested contents remain completely unobserved',()=>{
  const f=fixture('/pl/dashboard',`<article data-analytics-exclude="finder"><button><span>Finder</span></button></article><a href="/pl/dashboard/benchmark-finder?private=x">Finder</a><button id="allowed">ADP</button>`)
  try {
    const count=f.events.length
    f.fire('span');f.fire('a');assert.equal(f.events.length,count)
    f.fire('#allowed');assert.equal(f.events.at(-1).event,'ui_interaction')
  } finally {f.close()}
})

test('visible embedded Finder blocks generic, business, late and feedback events; hidden retained Finder does not',async()=>{
  const f=fixture('/pl/category-builder','<button>Category</button><section hidden data-appshell-module="benchmark-finder"><button>Retained Finder</button></section>')
  try {
    assert.equal(isFinderContext(f.win.document),false);f.fire('body > button')
    const attempt=f.analytics.begin('category_builder','category_save')
    const modal=f.win.document.createElement('div');modal.dataset.testid='category-finder-modal';modal.innerHTML='<button>Finder</button><p role="alert">PRIVATE</p>'
    f.win.document.body.append(modal);const count=f.events.length
    f.fire('[data-testid="category-finder-modal"] button')
    assert.equal(f.analytics.capture('pci_analysis_requested',{module:'price_change_index',process_attempt_id:randomUUID()}),false)
    await settle();f.analytics.finish(attempt,'success');assert.equal(f.events.length,count)
    modal.remove();await settle();f.fire('body > button')
    assert(f.events.length>count);assert.equal(f.events.filter(e=>e.event==='operation_completed').length,0,'late completion never crosses Finder context')
    assert.equal(f.events.filter(e=>e.event==='form_left_incomplete'||e.event==='operation_left_incomplete').length,0)
    assert.doesNotMatch(JSON.stringify(f.events),/benchmark_finder|PRIVATE/)
  } finally {f.close()}
})

test('Finder route transitions produce zero events and ordinary monitoring resumes on return',async()=>{
  const f=fixture()
  try {
    f.win.history.pushState({},'','/pl/dashboard/benchmark-finder');const count=f.events.length
    f.fire('button');await settle();assert.equal(f.events.length,count)
    f.win.history.pushState({},'','/pl/dashboard/adp?view=data&section=payments');f.fire('button')
    assert(f.events.some(e=>e.event==='screen_viewed'&&e.properties.view==='data'&&e.properties.section==='payments'))
    assert.equal(f.events.at(-1).properties.module,'adp')
    assert.doesNotMatch(JSON.stringify(f.events),/benchmark_finder/)
  } finally {f.close()}
})

test('consent absence, immediate withdrawal and environment disable suppress every collector and SDK boundary',async()=>{
  const f=fixture()
  try {
    f.setConsent(false);const count=f.events.length;f.fire('button');await settle();assert.equal(f.events.length,count)
    const attempt=f.analytics.begin('cost_scan','cost_scan');assert.equal(attempt,null)
    f.setConsent(true);f.fire('button');assert(f.events.length>count)
    f.setEnabled(false);const disabled=f.events.length;f.fire('button');await settle();assert.equal(f.events.length,disabled)
    assert.equal(filterSdkEvent({event:'ui_interaction',properties:{}},false,'synthetic'),null)
  } finally {f.close()}
})

test('native invalid, alerts and incomplete forms report classifications without error text or field contents',async()=>{
  const f=fixture('/pl/supplier-intelligence','<form><input required value="PRIVATE"/><button>Submit</button></form>')
  try {
    f.fire('input','invalid')
    assert(f.events.some(e=>e.properties.interaction==='validation_failed'))
    const alert=f.win.document.createElement('p');alert.setAttribute('role','alert');alert.textContent='SECRET error with nip=123';f.win.document.body.append(alert)
    await settle();assert.equal(f.events.filter(e=>e.event==='ui_feedback_shown').length,1)
    f.win.history.pushState({},'','/pl/account');f.fire('button')
    assert.equal(f.events.filter(e=>e.event==='form_left_incomplete').length,1)
    assert.doesNotMatch(JSON.stringify(f.events),/PRIVATE|SECRET|nip=123/)
  } finally {f.close()}
})

test('password, file, one-time-code, hidden and opted-out controls are excluded',()=>{
  const f=fixture('/pl/account','<input type="password"/><input type="file"/><input autocomplete="section-auth one-time-code"/><input hidden/><button class="ph-no-capture">PRIVATE</button>')
  try {const before=f.events.length;for(const e of Array.from(f.win.document.querySelectorAll('input,button')))e.dispatchEvent(new f.win.Event('input',{bubbles:true}));assert.equal(f.events.length,before)}finally{f.close()}
})

test('actual business outcomes distinguish limited results, failure, duplicate completion and navigation',async()=>{
  const f=fixture('/pl/cost-scan/category/PRIVATE')
  try {
    const result=await f.analytics.observe('cost_scan','cost_scan',Promise.resolve({status:'PARTIAL',private:'SECRET'}),()=> 'partial')
    assert.equal(result.private,'SECRET');assert.equal(f.events.at(-1).event,'operation_limited')
    const error=Error('SECRET');await assert.rejects(f.analytics.observe('category_builder','category_save',Promise.reject(error)),e=>e===error)
    assert.equal(f.events.at(-1).event,'operation_failed')
    const pending=f.analytics.begin('cost_scan','cost_scan');f.win.history.pushState({},'','/pl/account');f.fire('button')
    assert.equal(f.events.filter(e=>e.event==='operation_left_incomplete').length,1)
    f.analytics.finish(pending,'success');assert.equal(f.events.filter(e=>e.event==='operation_completed').length,0)
    assert.equal(f.analytics.begin('cost_scan','invented'),null)
    assert.doesNotMatch(JSON.stringify(f.events),/PRIVATE|SECRET/)
  } finally {f.close()}
})

test('contract rejects arbitrary control IDs, CSS paths, text and performance detail at final transport',()=>{
  const p={module:'category_builder',view:'category_builder',control_path:'body:1/main:1/button:2',control_id:'structural',interaction:'click'}
  assert(validateBusinessEvent('ui_interaction',p))
  for(const patch of [{control_id:'SECRET'},{control_path:'#private-nip'},{text:'PRIVATE'},{control_path:'div:0'},{control_path:'button:123456'},{interaction:'PRIVATE'}])assert.equal(validateBusinessEvent('ui_interaction',{...p,...patch}),null)
  assert.equal(validateBusinessEvent('ui_interaction',{module:'appshell'}),null)
})

test('the existing identity reset starts a fresh volatile analytics session without retaining prior form state',()=>{
  const f=fixture('/pl/account','<form><input/></form>')
  try {
    f.fire('input','input');f.analytics.reset();f.fire('input','input')
    assert.equal(f.events.filter(e=>e.event==='session_started').length,2)
    assert.equal(f.events.filter(e=>e.event==='form_started').length,2)
    assert.equal(f.events.filter(e=>e.event==='form_left_incomplete').length,0)
  }finally{f.close()}
})
