import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {readFileSync} from 'node:fs'
import {BenchmarkPickerView} from '../components/benchmark-picker/shared-benchmark-picker'
import {emptyPickerState} from '../components/benchmark-picker/picker-controller'
import {BenchmarkQualification} from '../components/benchmark-picker/benchmark-qualification'
import {classifyBenchmark} from '../lib/benchmark/qualification'
import type {BenchmarkCandidate} from '../lib/benchmark/contracts'
const provider={providerCode:'MACROBOND' as const,displayName:'Macrobond'}
const inventory:BenchmarkCandidate={candidateId:'macrobond:steel',provider,providerSeries:{provider,providerSeriesId:'steel'},displayName:'Steel inventories',description:null,frequency:'monthly',currency:null,unit:'tonnes',source:'Fixture',region:null}
const noop=()=>{}
test('generic picker retains quantity candidate and selection action; only PCI opts into eligibility',()=>{
  const props={locale:'en' as const,state:{...emptyPickerState(),ready:true,searched:true,candidates:[inventory]},query:'steel',setQuery:noop,search:noop,more:noop,select:noop}
  const generic=renderToStaticMarkup(<BenchmarkPickerView {...props}/>),pci=renderToStaticMarkup(<BenchmarkPickerView {...props} modelContext="PCI"/>)
  assert.match(generic,/Quantity \/ volume \/ stock/);assert.doesNotMatch(generic,/PCI:|UNSUITABLE/)
  assert.match(pci,/PCI: semantically unsuitable/)
  for(const html of [generic,pci]){assert.match(html,/aria-label="Select: Steel inventories"/);assert.doesNotMatch(html,/disabled=""/)}
})
test('BQL labels are localized, explainable, do not claim history readiness and do not fetch',()=>{
  const before=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected BQL request')}
  try{for(const locale of ['pl','en'] as const){
    const html=renderToStaticMarkup(<BenchmarkQualification candidate={inventory} locale={locale} modelContext="PCI"/>)
    assert.match(html,/data-semantic-class="QUANTITY"/);assert.match(html,/bql-semantic\/1.0.0/)
    assert.ok(html.includes(locale==='pl'?'Dostępność historii':'History and period availability'))
    assert.ok(html.includes(locale==='pl'?'nie cenę':'not a price'))
  }}finally{globalThis.fetch=before}
  assert.equal(classifyBenchmark(inventory).reason,'PHYSICAL_QUANTITY')
})
test('saved response derives semantics from existing mapping; no added provider, SQL or identity operation',()=>{
  const repository=readFileSync(new URL('../lib/benchmark/repository.ts',import.meta.url),'utf8')
  assert.match(repository,/semanticProfile: classifyBenchmark\(/);assert.match(repository,/metadata: mapping.metadataJson/)
  const bqlComponent=readFileSync(new URL('../components/benchmark-picker/benchmark-qualification.tsx',import.meta.url),'utf8')
  assert.doesNotMatch(bqlComponent,/useEffect|useAuth|fetch\(/)
  const host=readFileSync(new URL('../components/price-change-index/price-change-index-layer.tsx',import.meta.url),'utf8')
  assert.match(host,/modelContext="PCI"/);assert.match(host,/if\(step!==3\|\|qualificationIssue/)
  assert.match(host,/if\(qualificationIssue\)\{setError\(qualificationIssue\);return\}/)
  // Qualification adds no setComponents reset; mutation stays in the existing explicit edits and picker callback.
  assert.doesNotMatch(host,/qualificationIssue[^\n]*setComponents/)
})
