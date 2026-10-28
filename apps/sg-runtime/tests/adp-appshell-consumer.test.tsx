import test, {before} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
let appRoot: string, publicRoot: string, local: any, createElement: any, renderToStaticMarkup: any, AdpModuleHost: any, bundleAdp: any, verifyPublicAdoption: any
before(async () => {
 const harness = await import('./adp-appshell-preview.mjs'); ({appRoot,publicRoot,bundleAdp,verifyPublicAdoption}=harness)
 local = await harness.loadAdpModule('lib/appshell/adp-local-model.ts')
 ;({createElement}=harness.runtimeRequire('react')); ({renderToStaticMarkup}=harness.runtimeRequire('react-dom/server'))
 ;({AdpModuleHost}=await harness.loadAdpModule('components/appshell/adp-module-host.tsx'))
})
let id = 0
const context = {id: () => `local-${++id}`, today: () => '2026-10-28', author: 'Ty'}

test('public adoption binds version, bytes, source revision and the normal declared local package', () => {
  const receipt = verifyPublicAdoption()
  assert.equal(receipt.contractVersion, '1.0.0');assert.equal(receipt.sourceRevision, '465859267208024064')
  const lock = JSON.parse(fs.readFileSync(path.join(appRoot, 'package-lock.json'), 'utf8'))
  assert.equal(lock.packages['node_modules/@profitia/srm-adp-ui'].version, '1.0.0')
  assert(!lock.packages['node_modules/@profitia/srm-adp-ui'].link)
  assert.equal(lock.packages['']['dependencies']['@profitia/srm-adp-ui'], 'file:../../packages/srm-adp-ui')
})
test('initial model has every field, approved document text and no invented supplier/provider results', () => {
  const model = local.createLocalAdpModel('Organization', '2027')
  assert.equal(Object.keys(model.form.values).length, 43)
  assert(Object.values(model.form.values).every(value => value === ''))
  for (const key of ['contacts','locations','relations','activities','documents','projects','turnover','ratings','keywords','warningHistory']) assert.deepEqual(model[key], [])
  assert.equal(model.warning, null);assert.equal(model.summary, undefined);assert.equal(model.sapId, undefined)
  assert.equal(model.form.declarations.length, 2);assert(model.form.archiveNote.includes('SAP'));assert.equal(model.plan.year, '2027')
  assert.doesNotMatch(JSON.stringify(model), /Tomasz|DEMO-001|Firma Demonstracyjna|MGBI|Vercly|5213390341/)
})
test('local form preserves zero/multiline text, refuses an electronic signature and stale-instance updates', () => {
  const original = local.createLocalAdpModel('Organization'), change = {type:'form.change', field:'name', value:'0\nSecond line'}
  const model = local.applyScopedAdpEvent('new', 'new', original, change, context)
  assert.equal(model.form.values.name, '0\nSecond line');assert.equal(original.form.values.name, '')
  assert.equal(local.applyScopedAdpEvent('new', 'old', model, {...change,value:'stale'}, context), model)
  assert.equal(local.reduceLocalAdpModel(model,{type:'form.change',field:'signature',value:'signed'},context),model)
  assert.equal(local.reduceLocalAdpModel(model,{type:'form.change',field:'unknown',value:'x'},context),model)
})
test('typed interactions only update owned memory; no backend status, calculation or transport is invented', () => {
  let model = local.createLocalAdpModel('Organization')
  const emit = event => {model = local.reduceLocalAdpModel(model, event, context)}
  emit({type:'contact.add',values:{name:'Local contact',email:'sample@example.invalid'}})
  emit({type:'location.add',values:{name:'Local location',address:'Local address'}})
  emit({type:'relation.add',values:{name:'Local relation',type:'Local link',source:'Entered by user'}})
  emit({type:'document.add',values:{type:'ADP',name:'Local document',when:'2026-10-28',body:'Metadata only'}})
  emit({type:'activity.add',values:{type:'Notatka',title:'Local note',when:'2026-10-28',body:'Multiline\n0'}})
  emit({type:'activity.complete',id:model.activities[0].id})
  emit({type:'category.assign',value:'Kategoria 1'});emit({type:'category.assign',value:'Kategoria 1'})
  emit({type:'keyword.add',text:'Local topic'});emit({type:'keyword.edit',id:model.keywords[0].id,text:'Changed topic'})
  emit({type:'rating.add',values:{kind:'negotiation',score:'6',comment:'Local opinion'}})
  emit({type:'rating.add',values:{kind:'negotiation',score:'7'}})
  emit({type:'warning.add',values:{body:'Local warning'}});emit({type:'warning.remove',values:{body:'Local reason'}})
  for (const key of ['contacts','locations','relations','activities','documents','ratings','keywords']) assert.equal(model[key].length, 1)
  assert.equal(model.categories.length, 1);assert.equal(model.activities[0].done,true)
  assert.equal(model.documents[0].status,undefined);assert.equal(model.warning,null);assert.equal(model.warningHistory.length,2)
  assert.equal(model.ratings[0].scale,6);assert.equal(model.ratings[0].author,'Ty')
})
test('all eight areas and both themes mount from the accepted public export without another assistant', () => {
  for (const locale of ['pl','en']) for (const theme of ['light','dark']) for (const view of ['overview','data','cooperation','activities','documents','ratings','xray','newsfeed']) {
    const html = renderToStaticMarkup(createElement(AdpModuleHost, {locale,theme,active:true,organizationDisplayName:'Organization',navigation:{view,section:'company',dataArea:'adp'},onNavigate:()=>{},onReturn:()=>{}}))
    assert(html.includes(`data-theme="${theme}"`));assert(html.includes('sg-adp-ui'))
    assert.doesNotMatch(html, /iframe|srm-chat-|data-delivery|Control \+ I|Firma Demonstracyjna|SAP DEMO|Informacje o projekcie|Symuluj/)
  }
})
test('actual ADP host graph structurally excludes design evidence and every business transport', async () => {
  const result = await bundleAdp('components/appshell/adp-module-host.tsx', {metafile:true})
  for (const input of Object.keys(result.metafile.inputs)) assert.doesNotMatch(input, /(?:tests|evidence|source-contract|adp-integration|apps\/srm\/|cic|mgbi|vercly)/i)
  assert.doesNotMatch(result.outputFiles[0].text,/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|DeliveryRuntime|data-delivery|data-canon|designs\.magicpath|ScreenContext|<iframe/)
  const matrix = JSON.parse(fs.readFileSync(path.join(appRoot,'evidence/adp-product-transfer-matrix.json'),'utf8'))
  assert.equal(matrix.rows.length,1472);assert.equal(matrix.rows.filter(row=>row.decision==='WYKLUCZYĆ').length,627)
  assert.equal(fs.readFileSync(path.join(publicRoot,'source-contract.json'),'utf8').includes('PINNED_PROVENANCE_NO_AUTOMATIC_SYNC'),true)
})
