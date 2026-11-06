import test from 'node:test'
import assert from 'node:assert/strict'
import {collectCatalogue,catalogueSummary,renderCatalogue} from '../scripts/catalog-commodities.mjs'
const receipt='11111111-1111-4111-8111-111111111111'
const body=(provider,payloads)=>({usage:{receiptRef:receipt},items:payloads.map(payload=>({payload,metadata:{consumerStorage:{mode:'CATALOG_METADATA_ONLY',basisRef:'SYNTHETIC_ONLY',licenceVersion:'1'},usageReceiptRef:receipt,contentFingerprint:'a'.repeat(64),retrievedAt:'2026-11-06T18:00:00.000Z',sourceUrl:'https://example.test/metadata',licenceRef:'SYNTHETIC_ONLY'}}))})
const catalogue=()=>({schemaVersion:'SourceHubCommodityCapabilityCatalogue/1',status:'SYNTHETIC_ONLY',inventoryComplete:false,statusVocabulary:['LIVE_VERIFIED','DOCUMENTED_NOT_TESTED','ACCESS_RESTRICTED','PAID_NOT_ACTIVATED','UNAVAILABLE_OR_UNKNOWN'],providers:Object.fromEntries(['eia','cftc','commodities-sh'].map(p=>[p,{entries:[],documentation:[]}]))})
const profile={organisationId:'SYNTHETIC_ONLY',grants:['eia','cftc','commodities-sh'].map(p=>({resourceId:'api.'+p+'.data-catalog',grantId:receipt}))}
test('catalogue traverses every discovered metadata node, records original fields and never requests observations or paid endpoints',async()=>{
 const calls=[],c=catalogue(),client={async acquire({command:q}){calls.push(q);assert.equal(q.family,'data-catalog');if(q.provider==='eia')return body('eia',[{datasetId:q.criteria.path,name:'Synthetic energy',fields:q.criteria.path?[{name:'value',unit:'Mbbl'}]:[],children:q.criteria.path?[]:[{id:'petroleum'}],frequencies:[]}]);if(q.provider==='cftc')return body('cftc',[{datasetId:'jun7-fc8e',name:'Legacy Combined',fields:[{name:'open_interest_all',unit:null}],frequencies:[],children:[]}]);return body('commodities-sh',q.criteria.endpoint==='openapi'?[{datasetId:'GET /v1/price/{code}',name:'Paid price',fields:[],children:[],frequencies:[],documentedStatus:'PAID_NOT_ACTIVATED',priceUsd:.01,path:'/v1/price/{code}',method:'GET'}]:[{datasetId:'catalog',name:'Free catalog',fields:[],children:[],frequencies:[]}])}}
 await collectCatalogue({catalogue:c,profile,client,save:async()=>{},throttleMs:0});assert.equal(c.inventoryComplete,true);assert.equal(c.providers.eia.entries.length,2);assert.equal(c.providers['commodities-sh'].entries[0].status,'PAID_NOT_ACTIVATED');assert.equal(catalogueSummary(c)['commodities-sh'].byStatus.PAID_NOT_ACTIVATED,1);assert(calls.every(q=>q.family==='data-catalog'));assert(renderCatalogue(c).includes('Niewiążące'))
 const before=calls.length;await collectCatalogue({catalogue:c,profile,client,save:async()=>{},throttleMs:0});assert.equal(calls.length,before)
})
test('catalogue refuses payload retention without explicit metadata rights, persists a failed checkpoint, and never silently retries it',async()=>{
 const c=catalogue();let calls=0;const client={async acquire(){calls++;return {usage:{receiptRef:receipt},items:[{payload:{},metadata:{}}]}}}
 await collectCatalogue({catalogue:c,profile,client,save:async()=>{},throttleMs:0});assert.equal(c.inventoryComplete,false);assert.equal(calls,3);assert(Object.values(c.requests).every(r=>r.state==='FAILED_OR_UNCERTAIN'))
 await collectCatalogue({catalogue:c,profile,client,save:async()=>{},throttleMs:0});assert.equal(calls,3);assert.equal(c.providers.eia.status,'ACCESS_RESTRICTED')
})

test('enrollment profile matches every immutable SQL field, including privateKeyPersistence',async()=>{
 const {readFile}=await import('node:fs/promises')
 const profile=JSON.parse(await readFile(new URL('../operations/commodity-service-profile.json',import.meta.url),'utf8'))
 const sql=await readFile(new URL('../operations/enroll-commodity-service.sql',import.meta.url),'utf8')
 const embedded=JSON.parse(sql.match(/expected jsonb := \$profile\$([\s\S]*?)\$profile\$::jsonb/)[1])
 assert.equal(profile.privateKeyPersistence,'OWNER_APPROVED_SECRET_STORE')
 assert.deepEqual(embedded,profile)
})
