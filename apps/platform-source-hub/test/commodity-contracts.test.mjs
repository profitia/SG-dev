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

test('only a ledger-reconciled EIA429 can resume; success and uncertain sends never acquire a second key',async()=>{
 const {createHash}=await import('node:crypto'),{operationPayloadDigest}=await import('@profitia/platform-contracts/operation-context'),{reconcileThrottledAttempt}=await import('../scripts/catalog-commodities.mjs')
 const c=catalogue(),q={contractVersion:'1.1.0',provider:'eia',family:'data-catalog',operation:'metadata',criteria:{path:''}},old={state:'FAILED_OR_UNCERTAIN',idempotencyKey:'SYNTHETIC_ONLY_429',command:q,code:'RATE_LIMITED'};c.requests={synthetic:old}
 const p={...profile,componentId:'source-hub-catalogue-development',serviceId:receipt},s={id:receipt,component_id:p.componentId,organisation_id:p.organisationId,actor_kind:'SERVICE',actor_id:p.serviceId,idempotency_digest:createHash('sha256').update(old.idempotencyKey).digest('hex'),request_digest:operationPayloadDigest(q),error_code:'RATE_LIMITED',http_status:429,outcome:'RESPONSE',source_call_status:'RESPONSE',receipt_ref:receipt,completed_at:'2026-11-06T18:00:00.000Z'}
 for(const bad of[{http_status:200},{outcome:'UNVERIFIED'},{actor_id:'foreign'},{request_digest:'wrong'}])assert.throws(()=>reconcileThrottledAttempt(c,{...s,...bad},p))
 reconcileThrottledAttempt(c,s,p);assert.equal(old.reconciliation.receiptRef,receipt);assert.equal(old.idempotencyKey,'SYNTHETIC_ONLY_429')
 old.state='SUCCEEDED';assert.throws(()=>reconcileThrottledAttempt(c,s,p));old.state='PENDING';assert.throws(()=>reconcileThrottledAttempt(c,s,p))
})
test('SourceHub Retry-After is bounded and kept only for an actual429',async()=>{
 const {sourceHubRetryAfter}=await import('../scripts/catalog-commodities.mjs')
 assert.equal(await sourceHubRetryAfter(Response.json({error:{retryAfterSeconds:37}},{status:429})),37)
 assert.equal(await sourceHubRetryAfter(Response.json({error:{retryAfterSeconds:37}},{status:200})),null)
 assert.equal(await sourceHubRetryAfter(Response.json({error:{retryAfterSeconds:999999}},{status:429})),null)
})

test('explicitly reconciled throttling resumes once with history, while the same unverified checkpoint makes zero calls',async()=>{
 const {createHash}=await import('node:crypto'),{operationPayloadDigest}=await import('@profitia/platform-contracts/operation-context'),{reconcileThrottledAttempt}=await import('../scripts/catalog-commodities.mjs')
 const c=catalogue(),q={contractVersion:'1.1.0',provider:'eia',family:'data-catalog',operation:'metadata',criteria:{path:''}},d=createHash('sha256').update(JSON.stringify(q)).digest('hex'),key='SYNTHETIC_ONLY_429',p={...profile,componentId:'source-hub-catalogue-development',serviceId:receipt}
 c.providers.cftc.catalogueComplete=true;c.providers['commodities-sh'].openapiLiveVerified=true;c.providers['commodities-sh'].catalogueLiveVerified=true;c.requests={[d]:{state:'FAILED_OR_UNCERTAIN',idempotencyKey:key,command:q,code:'RATE_LIMITED'}}
 let calls=0;const client={async acquire(){calls++;return body('eia',[{datasetId:'',name:'Synthetic root',fields:[],children:[],frequencies:[]}])}}
 await collectCatalogue({catalogue:c,profile:p,client,save:async()=>{},throttleMs:0});assert.equal(calls,0)
 reconcileThrottledAttempt(c,{id:receipt,component_id:p.componentId,organisation_id:p.organisationId,actor_kind:'SERVICE',actor_id:p.serviceId,idempotency_digest:createHash('sha256').update(key).digest('hex'),request_digest:operationPayloadDigest(q),error_code:'RATE_LIMITED',http_status:429,outcome:'RESPONSE',source_call_status:'RESPONSE',receipt_ref:receipt,completed_at:'2026-11-06T18:00:00.000Z'},p)
 await collectCatalogue({catalogue:c,profile:p,client,save:async()=>{},throttleMs:0});assert.equal(calls,1);assert.equal(c.requests[d].state,'SUCCEEDED');assert.equal(c.requests[d].previousAttempts[0].idempotencyKey,key);assert.notEqual(c.requests[d].idempotencyKey,key);assert.equal(c.requests[d].resumedFromReceipt,receipt)
 await collectCatalogue({catalogue:c,profile:p,client,save:async()=>{},throttleMs:0});assert.equal(calls,1)
})

test('catalogue keeps actual paid operations closed and separately identifies OpenAPI self-discovery outside paths',async()=>{
 const {finalizeCatalogue}=await import('../scripts/catalog-commodities.mjs'),c=catalogue()
 c.providers['commodities-sh'].openapi={info:{'x-free-paths':['/openapi.json','/terms.txt']}};c.providers['commodities-sh'].openapiLiveVerified=true
 c.providers['commodities-sh'].entries=[{id:'GET /v1/price/{code}',status:'PAID_NOT_ACTIVATED',metadata:{kind:'OPERATION_METADATA',name:'Paid price',fields:[]},path:'/v1/price/{code}',method:'GET'}]
 c.requests={spec:{state:'SUCCEEDED',command:{provider:'commodities-sh',criteria:{endpoint:'openapi'}},receiptRef:receipt}}
 finalizeCatalogue(c);assert.equal(c.providers['commodities-sh'].entries[0].status,'PAID_NOT_ACTIVATED');assert.equal(c.providers['commodities-sh'].entries.find(e=>e.path==='/openapi.json').metadataEvidence.receiptRef,receipt);assert.equal(c.coverage.commoditiesSh.structuredOpenapiOperations,1);assert.equal(c.coverage.commoditiesSh.additionalDocumentedDiscovery,2)
 const n=c.providers['commodities-sh'].entries.length;finalizeCatalogue(c);assert.equal(c.providers['commodities-sh'].entries.length,n)
})
