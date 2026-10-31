import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {SmartPreparationFields} from '../../../packages/sg2-price-change-index-ui/src/SmartPreparationFields'
import {BenchmarkQualificationFilter,matchesQualification} from '../components/benchmark-picker/benchmark-qualification-filter'
import {seedPciComponent,pciSmartInput,pciMarketResult,emptyPurchase} from '../components/price-change-index/price-change-index-controller'
const provider={providerCode:'MACROBOND' as const,displayName:'Synthetic'}
const candidate=(id:string,title:string)=>({candidateId:id,provider,providerSeries:{provider,providerSeriesId:id},displayName:title,description:null,frequency:'Daily',currency:title.includes('price')?'USD':null,unit:title.includes('price')?'USD/tonne':title.includes('inventories')?'tonnes':null,source:'SYNTHETIC',region:null})
test('PL/EN PCI filter is optional, deterministic, stable and exposes unsuitable sources without I/O',()=>{
 const rows=[candidate('a','Steel inventories'),candidate('b','Copper spot price USD/tonne'),candidate('c','Opaque series')],before=JSON.stringify(rows)
 assert.deepEqual(rows.filter(x=>matchesQualification(x,'ALL')),rows)
 assert.deepEqual(rows.filter(x=>matchesQualification(x,'SUITABLE')).map(x=>x.candidateId),['b'])
 assert.deepEqual(rows.filter(x=>matchesQualification(x,'UNSUITABLE')).map(x=>x.candidateId),['a'])
 assert.equal(JSON.stringify(rows),before)
 for(const locale of ['pl','en'] as const){const html=renderToStaticMarkup(<BenchmarkQualificationFilter locale={locale} value="ALL" onChange={()=>{}}/>);assert.match(html,/UNSUITABLE/);assert.match(html,/VERIFY/);assert.match(html,locale==='pl'?/Wszystkie/:/All/)}
})
test('smart payload omits legacy global methods and price anchor substitutions, preserves stable identities',()=>{
 const saved={...candidate('x','Copper price'),selectionId:'selected',businessBenchmarkId:'business',organizationId:'11111111-1111-4111-8111-111111111111',selectedAt:'2026-10-01'}
 const c=seedPciComponent(saved,'stable');c.name='User name';c.weightPercent=60;c.preparationMethod={periodBasis:'END_OF_PERIOD',reduction:'AUTO',verified:false}
 const p={...emptyPurchase(),amount:'100',currency:'PLN',unit:'tona',taxBasis:'NET' as const,deliveryBasis:'EXW',purchaseDate:'2026-10-22',referenceDate:'2026-10-01'}
 const input=pciSmartInput('Category',[c],p,'en','PREPARE',{olderYear:null})
 assert.equal(input.declarations[0].componentId,'stable');assert.equal(input.category.components[0].name,'User name');assert.equal(input.purchase.purchaseDate,'2026-10-22')
 assert(!('referenceDate' in input.purchase));assert(!('economicPeriodApproved' in input.purchase));assert(!('periodBasis' in input.purchase));assert(!input.reference)
})
