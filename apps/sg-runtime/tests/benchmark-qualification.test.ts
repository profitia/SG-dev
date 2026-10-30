import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {classifyBenchmark,assessPciEligibility,savedBenchmarkProfile,BQL_RULESET_VERSION} from '../lib/benchmark/qualification'
import {presentQualification} from '../lib/benchmark/qualification-presentation'
import type {BenchmarkCandidate,SavedBenchmark} from '../lib/benchmark/contracts'
const provider={providerCode:'MACROBOND' as const,displayName:'Macrobond'}
const candidate=(patch:Partial<BenchmarkCandidate>={}):BenchmarkCandidate=>({candidateId:'macrobond:test',provider,providerSeries:{provider,providerSeriesId:'test'},displayName:'Brent crude oil spot price',description:null,frequency:'daily',currency:'USD',unit:'USD/barrel',source:'Fixture exchange',region:'World',...patch})

const cases:[string,Partial<BenchmarkCandidate>,string][]=[
  ['price with combined evidence',{},'PRICE_LEVEL'],
  ['physical price with currency and native unit',{displayName:'Copper, spot',unit:'tonnes'},'PRICE_LEVEL'],
  ['inventory is not a steel price',{displayName:'Steel inventories',currency:null,unit:'Thousand tonnes'},'QUANTITY'],
  ['production volume',{displayName:'Steel production',currency:null,unit:'t'},'QUANTITY'],
  ['price index is a separate variant',{displayName:'Steel producer price index',currency:null,unit:'2020=100'},'PRICE_INDEX'],
  ['interest rate',{displayName:'Interest rate',currency:null,unit:'Percent'},'RATE'],
  ['price change is a percentage, not a nominal price',{displayName:'Oil price, annual change',currency:null,unit:'%'},'RATE'],
  ['currency pair',{displayName:'Foreign exchange rate',currency:null,unit:'EUR/USD'},'OTHER'],
  ['nonprice index',{displayName:'Industrial production index',currency:null,unit:'Index points'},'OTHER'],
  ['monetary GDP',{displayName:'GDP',unit:'Millions of USD'},'OTHER'],
  ['equity price, not inventory',{displayName:'Stock price',unit:'USD/share'},'PRICE_LEVEL'],
  ['currency alone',{displayName:'Steel',unit:null},'UNDETERMINED'],
  ['price word alone',{displayName:'Steel price',currency:null,unit:null},'UNDETERMINED'],
  ['unit alone',{displayName:'Market indicator',unit:'USD/tonne'},'UNDETERMINED'],
  ['index alone',{displayName:'Steel index',currency:null,unit:'Index points'},'UNDETERMINED'],
  ['conflicting units',{unit:'tonnes',titleUnit:'2020=100'},'UNDETERMINED'],
  ['conflicting physical dimensions',{unit:'USD/barrel',titleUnit:'USD/tonne'},'UNDETERMINED'],
  ['conflicting currency',{currency:'EUR',unit:'USD/barrel'},'UNDETERMINED'],
  ['conflicting price and inventory',{displayName:'Steel inventory prices',unit:'tonnes'},'UNDETERMINED'],
  ['provider sampling is not semantics',{displayName:'Steel',unit:null,metadata:{DataType:'close',Class:'stock',PriceType:'1'}},'UNDETERMINED'],
  ['AI suggestion is not evidence',{displayName:'Steel',currency:null,unit:null,aiScore:1,aiReason:'Verified price',recommendedRank:1},'UNDETERMINED'],
]
for(const [name,patch,expected] of cases)test(name,()=>assert.equal(classifyBenchmark(candidate(patch)).classification,expected))

test('qualification retains deterministic provenance and ignores external ranking',()=>{
  const original=candidate(),profile=classifyBenchmark(original)
  assert.equal(profile.rulesetVersion,BQL_RULESET_VERSION);assert.equal(profile.providerCode,'MACROBOND');assert.equal(profile.seriesId,'test')
  assert.ok(profile.evidence.some(e=>e.field==='unit'&&e.values[0]==='USD/barrel'))
  assert.deepEqual(classifyBenchmark({...original,aiReason:'Inventory',aiScore:0}),profile)
  assert.equal(assessPciEligibility(profile).status,'SUITABLE')
  assert.equal(assessPciEligibility(profile,'PRICE_INDEX').reason,'VARIANT_MISMATCH')
  assert.equal(assessPciEligibility(classifyBenchmark(candidate({displayName:'Steel inventories',currency:null,unit:'tonnes'}))).status,'UNSUITABLE')
  assert.equal(assessPciEligibility(classifyBenchmark(candidate({displayName:'Unknown',unit:null}))).status,'VERIFY')
})
test('PRICE_INDEX and PRICE_LEVEL remain distinct accepted model variants',()=>{
  const index=classifyBenchmark(candidate({displayName:'Producer price index',currency:null,unit:'Index points'}))
  assert.equal(assessPciEligibility(index,'PRICE_INDEX').status,'SUITABLE')
  assert.equal(assessPciEligibility(index,'PRICE_LEVEL').status,'UNSUITABLE')
  assert.equal(presentQualification(index,'pl').eligibility,null)
  assert.match(presentQualification(index,'en','PCI','PRICE_LEVEL').reason,/Select Price index/)
})
test('current snapshot is recomputed, earlier evidence is not rewritten',()=>{
  const first=classifyBenchmark(candidate()),snapshot=JSON.stringify(first)
  const next=classifyBenchmark(candidate({displayName:'Steel inventories',unit:'tonnes',currency:null}))
  assert.notDeepEqual(first,next);assert.equal(JSON.stringify(first),snapshot)
  const saved:SavedBenchmark={...candidate(),selectionId:'s',businessBenchmarkId:'b',organizationId:'org',selectedAt:'2026-10-30',semanticProfile:first}
  assert.deepEqual(savedBenchmarkProfile(saved),first)
  assert.equal(savedBenchmarkProfile({...saved,providerSeries:{provider,providerSeriesId:'another'},displayName:'Unknown',unit:null}).classification,'UNDETERMINED')
})
test('classification has no request, database, auth, persistence or calculation dependencies',()=>{
  const source=readFileSync(new URL('../lib/benchmark/qualification.ts',import.meta.url),'utf8')
  assert.doesNotMatch(source,/from ['"][^'"]*(clerk|db\/|cost-analysis|macrobond|service|forecast)/i)
  assert.doesNotMatch(source,/\b(fetch|localStorage|sessionStorage|Date\.now)\s*[.(]/)
  for(let i=0;i<1000;i++)assert.equal(classifyBenchmark(candidate()).classification,'PRICE_LEVEL')
})
