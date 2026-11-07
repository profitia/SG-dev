import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseHubRequest,assertHubResponse,SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs'
import {prepareEia,eiaWireUrl,createEiaProvider} from '../src/providers/eia.mjs'
import {prepareCftc,createCftcProvider} from '../src/providers/cftc.mjs'
import {prepareCommodities,createCommoditiesProvider,openapiOperations} from '../src/providers/commodities-sh.mjs'
import {catalogueStorageProjection} from '../src/repository.mjs'
import {assertNoSecret,createTelemetry} from '../src/observability.mjs'
const req=(provider,family,operation,criteria={})=>({contractVersion:'1.1.0',provider,family,operation,criteria})
const admitted=body=>{body.provenance.licenceRef='SYNTHETIC_ONLY';body.usage.receiptRef='11111111-1111-4111-8111-111111111111';for(const i of body.items)Object.assign(i.metadata,{licenceRef:body.provenance.licenceRef,usageReceiptRef:body.usage.receiptRef,retentionUntil:null,redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY'});return body}
const offline=json=>async()=>Response.json(json)
test('commodity contracts are explicitly versioned and reject keys, proxy URLs, arbitrary SoQL, unbounded pages and wrong families',()=>{
 for(const r of [req('eia','series-observations','observations',{path:'petroleum/stoc/wstk',frequency:'weekly',data:['value']}),req('cftc','data-catalog','metadata',{datasetId:'jun7-fc8e'}),req('commodities-sh','publication-calendar','calendar')])assert.deepEqual(parseHubRequest(r),r)
 for(const r of [req('eia','economic-calendar','search'),req('cftc','data-catalog','catalog',{url:'https://evil.test'}),req('eia','data-catalog','catalog',{api_key:'SYNTHETIC_ONLY'}),req('eia','data-catalog','catalog',{path:'../data'}),req('cftc','positioning-observations','observations',{datasetId:'jun7-fc8e',where:'1=1'}),req('cftc','data-catalog','catalog',{limit:1001}),req('commodities-sh','data-catalog','catalog',{endpoint:'price/CL'})])assert.throws(()=>parseHubRequest(r),SourceHubError)
})
test('EIA injects its key only in server-owned wire URL; echo, ambiguous publication dates and missing measures never become observations',async()=>{
 const q=req('eia','series-observations','observations',{path:'petroleum/stoc/wstk',frequency:'weekly',data:['value'],facets:{duoarea:['NUS']},limit:2}),p=prepareEia(q),key='SYNTHETIC_ONLY_EIA_SECRET'
 assert(!p.url.includes(key));assert.equal(new URL(eiaWireUrl(p.url,key)).searchParams.get('api_key'),key)
 const a=createEiaProvider({fetchImpl:offline({apiVersion:'2.1.12',request:{params:{api_key:key}},response:{total:'3',frequency:'weekly',data:[{period:'2026-10-30',value:'42.125',units:'thousand barrels',duoarea:'NUS'},{period:'2026-10-23',value:null,units:'thousand barrels',duoarea:'NUS'}]}})})
 const body=admitted(await a.acquire(q));assertHubResponse(body,q);assertNoSecret(body,{eia:key});assert.equal(body.items[0].payload.measures[0].value,'42.125');assert.equal(body.items[1].payload.measures[0].value,null);assert.equal(body.items[0].payload.publishedAt,null);assert.equal(body.page.more,true)
 await assert.rejects(()=>createEiaProvider({fetchImpl:offline({response:{data:[{period:'2026',other:1}]}})}).acquire(q),{code:'PROVIDER_SCHEMA_CHANGED'})
 for(const url of ['https://evil.test/v2/','https://api.eia.gov/v2/?api_key=forged'])assert.throws(()=>eiaWireUrl(url,key))
})
test('EIA discovers metadata without downloading series and preserves units, hierarchy and reference periods',async()=>{
 const q=req('eia','data-catalog','metadata',{path:'petroleum'}),body=await createEiaProvider({fetchImpl:offline({apiVersion:'2',response:{name:'Petroleum',routes:[{id:'stoc',name:'Stocks'}],data:{value:{alias:'Stocks',units:'thousand barrels'}},frequency:[{id:'weekly',format:'YYYY-MM-DD'}],facets:[{id:'duoarea',description:'Area'}],startPeriod:'1982',endPeriod:'2026'}})}).acquire(q)
 assert.equal(body.items[0].payload.fields[0].unit,'thousand barrels');assert.equal(body.items[0].payload.children[0].id,'stoc');assertHubResponse(admitted(body),q)
})
test('CFTC typed filters quote strings, preserve column values and never invent a primary key or a release timestamp',async()=>{
 const q=req('cftc','positioning-observations','observations',{datasetId:'jun7-fc8e',filters:[{field:'market_and_exchange_names',op:'eq',value:"Oil' OR 1=1"}],limit:1}),u=new URL(prepareCftc(q).url)
 assert.equal(u.searchParams.get('$where'),"market_and_exchange_names = 'Oil'' OR 1=1'")
 const body=await createCftcProvider({fetchImpl:offline([{id:'not-a-guaranteed-primary-key',report_date_as_yyyy_mm_dd:'2026-11-03T00:00:00.000',cftc_contract_market_code:'067651',market_and_exchange_names:'WTI',open_interest_all:'123456',noncomm_positions_long_all:'100'}])}).acquire(q)
 assert.equal(body.items[0].payload.columns.open_interest_all,'123456');assert.equal(body.items[0].payload.uniqueness,'NOT_ASSERTED');assert.equal(body.items[0].payload.publicationAt,null);assert.equal(body.items[0].payload.reportDate,'2026-11-03');assertHubResponse(admitted(body),q)
})
test('commodities.sh has a hard free discovery allowlist independent of payment enforcement',async()=>{
 const spec=JSON.parse(readFileSync(new URL('../catalog/commodities-capabilities-v1.json',import.meta.url),'utf8')).providers['commodities-sh'].openapi
 const ops=openapiOperations(spec);assert.equal(ops.length,30);assert(ops.filter(x=>x.priceUsd>0).every(x=>x.access==='PAID_NOT_ACTIVATED'&&!x.paidExecutionAllowed))
 const q=req('commodities-sh','data-catalog','catalog',{endpoint:'catalog'});assert.equal(new URL(prepareCommodities(q).url).pathname,'/v1/catalog')
 const body=await createCommoditiesProvider({fetchImpl:offline({instruments:[{code:'CL',name:'WTI',value:99}],pricing_usd:{PRICE:.01}})}).acquire(q)
 assert.equal(body.items[0].payload.catalogue.instruments[0].value,undefined);assertHubResponse(admitted(body),q)
 const schedule=req('commodities-sh','publication-calendar','calendar'),s=await createCommoditiesProvider({fetchImpl:offline({events:[{name:'EIA Petroleum',date:'2026-11-12',frequency:'weekly'}]})}).acquire(schedule)
 assert.equal(s.items[0].payload.scheduledAt,null);assert.equal(s.items[0].payload.dateOnly,'2026-11-12');assert.equal(s.items[0].payload.actual,null);assertHubResponse(admitted(s),schedule)
})
test('metadata retention is a separate, exact licence right; observation data stays transient',()=>{
 const l={provider_id:'eia',consumer_access_mode:'SPENDGURU_PRODUCT',allow_catalog_inventory:true,licence_ref:'SYNTHETIC_ONLY',version:1}
 assert.equal(catalogueStorageProjection(l,'data-catalog').mode,'CATALOG_METADATA_ONLY');assert.equal(catalogueStorageProjection(l,'series-observations'),null);assert.equal(catalogueStorageProjection({...l,allow_catalog_inventory:false},'data-catalog'),null);assert.throws(()=>catalogueStorageProjection({...l,provider_id:'brave'},'data-catalog'))
})
test('new providers emit only bounded counters; provider secrets in any normalized output are refused',()=>{
 const lines=[],t=createTelemetry(s=>lines.push(s));t.emit({requestId:'synthetic',service:'platform-source-hub',operation:'/v1/acquire',outcome:'OK',status:200,durationMs:2,provider:'eia',family:'series-observations',url:'https://api.eia.gov/v2/?api_key=SECRET'})
 assert(!lines.join('').includes('api_key'));assert.equal(JSON.parse(lines[0]).provider,'eia');assert.throws(()=>assertNoSecret({echo:'SYNTHETIC_ONLY_SECRET'},{eia:'SYNTHETIC_ONLY_SECRET'}))
})
