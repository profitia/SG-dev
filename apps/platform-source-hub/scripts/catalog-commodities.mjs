// One canonical metadata catalogue. No direct provider HTTP, paid calls or cron.
import {readFile,writeFile,rename,lstat} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {setTimeout as pause} from 'node:timers/promises'
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {createFirstPartySourceHubClient} from '@profitia/platform-source-hub-contracts/client'
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const catalogueUrl=new URL('../catalog/commodities-capabilities-v1.json',import.meta.url)
const humanUrl=new URL('../docs/commodities-capabilities.pl.md',import.meta.url)
export function catalogueSummary(catalogue){const out={};for(const [p,info]of Object.entries(catalogue.providers)){out[p]={entries:info.entries.length,byStatus:Object.fromEntries(catalogue.statusVocabulary.map(s=>[s,info.entries.filter(e=>e.status===s).length])),liveDataOperations:info.entries.filter(e=>e.dataEvidence?.status==='LIVE_VERIFIED').length}}return out}
export function renderCatalogue(c){
 const lines=['# Katalog możliwości EIA, CFTC i commodities.sh','',`Status: **${c.status}**. Kompletność inwentaryzacji: **${c.inventoryComplete?'potwierdzona':'niepotwierdzona'}**.`, '', 'Źródłem tej reprezentacji jest [jeden katalog JSON](../catalog/commodities-capabilities-v1.json). Zawiera pola, jednostki, trasy, częstotliwości, koszty, licencje i receipt każdego potwierdzenia. Metadane LIVE nie oznaczają przetestowania wszystkich szeregów ani historii.','', '| Provider | Pozycje | LIVE metadanych/operacji | Udokumentowane | Płatne, nieaktywne | Ograniczone / nieznane |','|---|---:|---:|---:|---:|---:|']
 for(const [p,s]of Object.entries(catalogueSummary(c)))lines.push(`| ${p} | ${s.entries} | ${s.byStatus.LIVE_VERIFIED} | ${s.byStatus.DOCUMENTED_NOT_TESTED} | ${s.byStatus.PAID_NOT_ACTIVATED} | ${s.byStatus.ACCESS_RESTRICTED+s.byStatus.UNAVAILABLE_OR_UNKNOWN} |`)
 for(const [p,info]of Object.entries(c.providers)){
  lines.push('',`## ${p}`,'',info.reason??'', '', '| Grupa / zbiór / endpoint | Status metadanych / operacji | Dane lub harmonogram LIVE | Pola | Częstotliwości | Koszt USD |','|---|---|---|---:|---|---|')
  for(const e of info.entries)lines.push(`| ${[e.group,e.metadata?.name??e.id,e.id].filter(Boolean).join(' / ').replaceAll('|','\\|').replace(/[\r\n]+/g,' ')} | ${e.status} | ${e.access?.observationsStatus??e.dataEvidence?.status??'DOCUMENTED_NOT_TESTED'} | ${e.metadata?.fields?.length??e.fields?.length??'—'} | ${(e.metadata?.frequencies??[]).map(f=>f.id).join(', ')||'nieustalona'} | ${e.priceUsd??'nieustalony'} |`)
  const escape=v=>String(v??'niepodane').replaceAll('|','\\|').replace(/[\r\n]+/g,' ')
  for(const e of info.entries.filter(e=>(e.metadata?.fields?.length??0)>0)){
   lines.push('',`<details><summary>Pola: ${escape(e.metadata.name)} (${escape(e.id)})</summary>`,'','| Pole API | Typ dostawcy | Jednostka | Znaczenie |','|---|---|---|---|')
   for(const f of e.metadata.fields)lines.push(`| ${escape(f.name)} | ${escape(f.type)} | ${escape(f.unit)} | ${escape(f.description??f.displayName)} |`)
   lines.push('','</details>')
  }
  lines.push('', 'Dokumentacja: '+info.documentation.map(u=>`[źródło](${u})`).join(', '))
 }
 lines.push('', '## Zakres katalogu','',`EIA: ${c.coverage?.eia.rootGroups??'—'} grup głównych, ${c.coverage?.eia.metadataNodes??'—'} węzłów metadanych i ${c.coverage?.eia.dataRoutes??'—'} tras z definicją pomiarów.`, '', `CFTC: ${c.coverage?.cftc.reportVariants??'—'} wariantów COT, ${c.coverage?.cftc.underlyingDatasets??'—'} zbiorów bazowych i ${c.coverage?.cftc.tabularDatasets??'—'} zbiorów tabularnych łącznie.`, '', `commodities.sh: ${c.coverage?.commoditiesSh.structuredOpenapiOperations??'—'} operacji w paths OpenAPI oraz ${c.coverage?.commoditiesSh.additionalDocumentedDiscovery??'—'} dodatkowe deklaracje discovery; ${c.coverage?.commoditiesSh.instruments??'—'} instrumentów i ${c.coverage?.commoditiesSh.inventorySeries??'—'} serii zapasów.`,'','Metadane CFTC obejmują siedem wariantów raportów oraz ich zbiory bazowe; strony pomocy i wizualizacje nie są dodatkowymi zbiorami COT. Operacje z info.x-free-paths, których nie ma w paths OpenAPI, są opisane osobno. Serie AEO/IEO/STEO mogą być projekcjami lub scenariuszami dostawcy; nie stanowią wyniku Forecast Core.','', '## Ograniczenia i licencje','', 'EIA: bezpłatny klucz, rzeczywisty throttling dostawcy, atrybucja EIA, zastrzeżenia praw do materiałów osób trzecich. CFTC: informacje rządowe są public domain, z wyjątkami dla cudzych materiałów; atrybucja CFTC. commodities.sh: obowiązują także warunki źródeł nadrzędnych, w tym FRED. Darmowy discovery nie przyznaje prawa do redystrybucji płatnych obserwacji. Komercyjna redystrybucja wymaga sprawdzenia praw konkretnej serii. SourceHub nie utrwala treści obserwacji przy TTL 0; katalog zapisuje wyłącznie dopuszczone metadane.','', '## Niewiążące możliwe zastosowania','', 'Oil Report: zapasy, produkcja, handel i ceny energii EIA oraz pozycjonowanie COT CFTC. Kalendarz Surowcowy: harmonogramy publikacji i okresy referencyjne, bez utożsamiania ich z opublikowanym odczytem. Analityka SpendGuru: porównania szeregów z zachowaniem jednostek, rewizji i semantyki instrumentów. Żadne z tych zastosowań nie jest wdrażane ani zatwierdzane przez ten katalog.','')
 return lines.join('\n')
}
// Metadata classification and verified proof reconciliation; no provider calls.
export function finalizeCatalogue(c,sourceReceipts=[]){
 const refs=new Map(sourceReceipts.map(r=>[r.call_id,r]))
 for(const [provider,info]of Object.entries(c.providers)){
  for(const e of info.liveEvidence??[]){const r=refs.get(e.receiptRef);if(r){if(r.http_status!==200||r.status!=='RESPONSE'||r.resource_id!=='api.'+provider+'.'+e.family)throw Error('LIVE_RECEIPT_MISMATCH');e.providerHttpStatus=200;e.sourceReceiptVerified=true}
   const id=e.criteria.path??e.criteria.datasetId??(e.family==='publication-calendar'?'GET /v1/calendar':'GET /v1/catalog'),entry=info.entries.find(x=>x.id===id)
   if(entry){entry.dataEvidence=e;if(provider==='commodities-sh')entry.status='LIVE_VERIFIED'}
  }
  for(const e of info.entries){
   e.access={sourceHubFamily:provider==='eia'?'data-catalog':provider==='cftc'?'data-catalog':e.metadata?.kind==='OPERATION_METADATA'?'data-catalog':'data-catalog',metadataStatus:e.evidence?'LIVE_VERIFIED':e.status,observationsStatus:['PAID_NOT_ACTIVATED','UNAVAILABLE_OR_UNKNOWN'].includes(e.status)?e.status:e.dataEvidence?.status??'DOCUMENTED_NOT_TESTED',storage:'METADATA_ONLY',redistribution:'CHECK_SOURCE_AND_THIRD_PARTY_RIGHTS'}
   if(provider==='eia'){e.classification={basis:'PROVIDER_ROUTE_HIERARCHY',group:e.id.split('/')[0]||'root',semantics:/^(aeo|ieo|steo)(\/|$)/.test(e.id)?'PROVIDER_OUTLOOK_OR_SCENARIO_SERIES':'PROVIDER_ROUTE_DEPENDENT_SERIES',pointInTimeVintage:'NOT_ASSERTED'};e.group=e.classification.group;e.geography={basis:'PROVIDER_FACET_DESCRIPTIONS',facets:e.metadata.facets.filter(f=>/state|country|region|area|padd|geog/i.test(f.id+' '+f.description)),values:'DISCOVER_ON_DEMAND_THROUGH_ADMITTED_FACET_METADATA'}}
   if(provider==='cftc'){const n=e.metadata.name;const tabular=e.metadata.fields.length>0;e.group=/legacy/i.test(n)?'Legacy':/disaggregated/i.test(n)?'Disaggregated':/TFF/.test(n)?'Traders in Financial Futures':/CIT|Supplemental/.test(n)?'Supplemental':'Reference / taxonomy';e.classification={basis:'PROVIDER_DATASET_NAME_AND_SCHEMA',kind:!tabular?'REFERENCE_OR_VISUALIZATION':n==='ProductHierarchy'?'CONTRACT_TAXONOMY':/_All$/.test(n)?'UNDERLYING_COT_DATASET':'COT_REPORT_VARIANT',primaryKey:'NOT_ASSERTED',candidateGrain:['report_date_as_yyyy_mm_dd','cftc_contract_market_code','futonly_or_combined'],geography:'REPORTED_CONTRACT_MARKETS_NOT_PHYSICAL_COMMODITY_ORIGIN'};if(!tabular||n==='ProductHierarchy')e.access.observationsStatus='UNAVAILABLE_OR_UNKNOWN'}
  }
 }
 const sh=c.providers['commodities-sh'],bundle=sh.entries.find(e=>e.id==='catalog')?.metadata.catalogue,operations=sh.entries.filter(e=>e.metadata.kind==='OPERATION_METADATA')
 for(const path of sh.openapi.info?.['x-free-paths']??[]){if(operations.some(e=>e.path===path))continue;const id='GET '+path;if(!sh.entries.some(e=>e.id===id))sh.entries.push({id,provider:'commodities-sh',group:'discovery',method:'GET',path,priceUsd:0,status:'DOCUMENTED_NOT_TESTED',evidenceBasis:'DOCUMENTATION_OPENAPI_INFO_X_FREE_PATHS',sourceHubAccess:'NOT_EXPOSED',metadata:{kind:'OPERATION_METADATA',datasetId:id,name:path,fields:[],frequencies:[],facets:[],children:[],definitionLocation:'info.x-free-paths; absent from paths'}})}
 const specEntry=sh.entries.find(e=>e.path==='/openapi.json'&&e.method==='GET');if(sh.openapiLiveVerified&&specEntry){specEntry.status='LIVE_VERIFIED';specEntry.metadataEvidence={status:'LIVE_VERIFIED',receiptRef:Object.values(c.requests??{}).find(r=>r.state==='SUCCEEDED'&&r.command.provider==='commodities-sh'&&r.command.criteria.endpoint==='openapi')?.receiptRef??null,meaning:'Actual normalized OpenAPI operation metadata acquired through SourceHub'}}
 for(const e of sh.entries){if(e.path?.includes('/curve/'))e.conditionalFuturePriceUsd=bundle?.pricing_usd?.CURVE??null;if(e.path?.includes('/spreads/calendar/'))e.conditionalFuturePriceUsd=bundle?.pricing_usd?.CALENDAR??null;e.paidExecutionAllowed=false}
 c.coverage={eia:{rootGroups:c.providers.eia.entries.find(e=>e.id==='')?.metadata.children.length??0,metadataNodes:c.providers.eia.entries.length,dataRoutes:c.providers.eia.entries.filter(e=>e.metadata.fields.length>0).length},cftc:{catalogueEntries:c.providers.cftc.entries.length,tabularDatasets:c.providers.cftc.entries.filter(e=>e.metadata.fields.length>0).length,reportVariants:c.providers.cftc.entries.filter(e=>e.classification.kind==='COT_REPORT_VARIANT').length,underlyingDatasets:c.providers.cftc.entries.filter(e=>e.classification.kind==='UNDERLYING_COT_DATASET').length},commoditiesSh:{structuredOpenapiOperations:operations.filter(e=>e.metadata.definitionLocation===undefined).length,additionalDocumentedDiscovery:sh.entries.filter(e=>e.metadata.definitionLocation).length,instruments:bundle?.instruments?.length??0,inventorySeries:bundle?.inventory_series?Object.keys(bundle.inventory_series).length:0}}
 c.providerLimitNotes={eia:{source:'https://www.eia.gov/opendata/faqs.php',sustainedGuidance:'Below approximately9000/hour under ideal conditions; route, demand, key and IP dependent',burstGuidance:'Below5/second; not a guarantee for every route',observed429:true,unmeteredSourceAdmissionUnchanged:true,wpsrWngsrApiPublicationLag:'Documented within2 hours; not a realtime release feed'},cftc:{authentication:'Public access without app token for tested queries',publication:'Generally Friday for Tuesday positions; holidays and historical reporting differ',pagination:'Typed SoQL filters/order/limit/offset; no stable primary-key or snapshot guarantee'},commoditiesSh:{payment:'Paid and per-tool paths never activated or called',licence:'Upstream EIA/FRED/CFTC/USDA/USGS terms and third-party restrictions apply; free discovery is not unlimited commercial redistribution'}}
 if(c.inventoryComplete)c.completedAt=new Date().toISOString();else c.lastCheckpointAt=new Date().toISOString();return c
}

export async function persistCatalogue(c){c.summary=catalogueSummary(c);await writeFile(new URL(catalogueUrl.href+'.tmp'),JSON.stringify(c,null,2)+'\n',{flag:'wx'});await rename(new URL(catalogueUrl.href+'.tmp'),catalogueUrl);await writeFile(humanUrl,renderCatalogue(c))}

// Resume only a positively reconciled, settled EIA429. Uncertain sends, other
// failures and successful requests remain immutable checkpoints. No HTTP retry.
export function reconcileThrottledAttempt(c,settlement,profile,{retryAfterSeconds=60}={}){
 const hash=v=>createHash('sha256').update(v).digest('hex')
 const old=Object.values(c.requests??{}).find(r=>hash(r.idempotencyKey)===settlement.idempotency_digest)
 if(!old||old.state!=='FAILED_OR_UNCERTAIN'||old.code!=='RATE_LIMITED'||old.command.provider!=='eia'||old.command.family!=='data-catalog'
  ||settlement.component_id!==profile.componentId||settlement.organisation_id!==profile.organisationId||settlement.actor_kind!=='SERVICE'||settlement.actor_id!==profile.serviceId
  ||settlement.request_digest!==operationPayloadDigest(old.command)||settlement.error_code!=='RATE_LIMITED'||settlement.http_status!==429||settlement.outcome!=='RESPONSE'||settlement.source_call_status!=='RESPONSE'
  ||!Number.isFinite(Date.parse(settlement.completed_at))||!/^[a-f0-9-]{36}$/.test(settlement.receipt_ref??'')||!Number.isSafeInteger(retryAfterSeconds)||retryAfterSeconds<1||retryAfterSeconds>86400)throw Error('EXACT_SETTLED_EIA_THROTTLE_REQUIRED')
 old.reconciliation={basis:'READ_ONLY_SOURCE_AND_USAGE_LEDGER',outcome:'RESPONSE',httpStatus:429,receiptRef:settlement.receipt_ref,acquisitionId:settlement.id,
  verifiedAt:new Date().toISOString(),notBefore:new Date(Date.parse(settlement.completed_at)+retryAfterSeconds*1000).toISOString(),backoffSeconds:retryAfterSeconds,providerHeaderRetained:false}
 return old.reconciliation
}
export async function sourceHubRetryAfter(response){
 if(response.status!==429)return null
 const header=response.headers.get('retry-after');if(/^\d{1,5}$/.test(header??'')&&Number(header)>0&&Number(header)<=86400)return Number(header)
 const reader=response.clone().body?.getReader();if(!reader)return null;const chunks=[];let n=0
 try{for(;;){const part=await reader.read();if(part.done)break;n+=part.value.byteLength;if(n>16384)return null;chunks.push(part.value)}const value=JSON.parse(Buffer.concat(chunks).toString('utf8')).error?.retryAfterSeconds;return Number.isSafeInteger(value)&&value>0&&value<=86400?value:null}catch{return null}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
}

export async function loadCatalogueClient(profileFile,keyFile){
 const stat=await lstat(keyFile);if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||stat.size>4096)throw Error('PRIVATE_SERVICE_KEY_REQUIRED')
 const profile=JSON.parse(await readFile(profileFile,'utf8'))
 if(profile.status!=='ENROLLED'||profile.targetOrigin!=='https://source-hub-development.onrender.com'||profile.applicationId!=='profitia-source-hub-catalogue-development'||profile.componentId!=='source-hub-catalogue-development'||Date.parse(profile.expiresAt)<=Date.now())throw Error('CURRENT_OWN_SERVICE_ENROLLMENT_REQUIRED')
 const rateDelays=new Map();const sdk=createFirstPartySourceHubClient({environment:'development',componentId:profile.componentId,consumerApplicationId:profile.applicationId,receiverApplicationId:profile.receiverApplicationId,sourceOrigin:profile.sourceOrigin,targetOrigin:profile.targetOrigin,keyId:profile.keyId,privateKey:await readFile(keyFile,'utf8')},{fetchImpl:async request=>{const response=await fetch(request);if(response.status===429)rateDelays.set(request.headers.get('idempotency-key'),await sourceHubRetryAfter(response));return response}})
 const client=Object.freeze({async acquire(input){try{return await sdk.acquire(input)}catch(error){if(error.code==='RATE_LIMITED')error.retryAfterSeconds=rateDelays.get(input.idempotencyKey)??null;throw error}finally{rateDelays.delete(input.idempotencyKey)}}})
 return {profile,client}
}
export async function collectCatalogue({catalogue,client,profile,save=persistCatalogue,throttleMs=500,providerThrottleMs={},onProgress=()=>{}}){
 const c=catalogue;c.requests??={};c.generatedAt=new Date().toISOString()
 const command=(provider,criteria={},operation='metadata')=>({contractVersion:'1.1.0',provider,family:'data-catalog',operation,criteria})
 async function acquire(q){
  const d=digest(q),old=c.requests[d]
  if(old){if(old.state==='SUCCEEDED')throw Error('METADATA_ALREADY_PERSISTED_USE_CHECKPOINT');if(old.state!=='FAILED_OR_UNCERTAIN'||old.command.provider!=='eia'||old.code!=='RATE_LIMITED'||old.reconciliation?.outcome!=='RESPONSE'||old.reconciliation?.httpStatus!==429)throw Error('PRIOR_ATTEMPT_REQUIRES_RECONCILIATION');if(!Number.isFinite(Date.parse(old.reconciliation.notBefore))||Date.parse(old.reconciliation.notBefore)>Date.now())throw Error('RETRY_AFTER_NOT_ELAPSED')}
  const grant=profile.grants.find(g=>g.resourceId==='api.'+q.provider+'.'+q.family);if(!grant)throw Error('EXACT_SERVICE_GRANT_REQUIRED')
  const key='commodity-catalogue:'+randomUUID();c.requests[d]={state:'PENDING',idempotencyKey:key,command:q,...(old?{previousAttempts:[...(old.previousAttempts??[]),Object.fromEntries(Object.entries(old).filter(([k])=>k!=='previousAttempts'))],resumedFromReceipt:old.reconciliation.receiptRef}:{})};await save(c)
  try{await pause(providerThrottleMs[q.provider]??throttleMs);const result=await client.acquire({command:q,execution:{kind:'SERVICE',organisationId:profile.organisationId,grantId:grant.grantId},idempotencyKey:key})
   if(result.items.some(i=>i.metadata.consumerStorage?.mode!=='CATALOG_METADATA_ONLY'))throw Error('CATALOGUE_STORAGE_RIGHT_REQUIRED')
   c.requests[d]={...c.requests[d],state:'SUCCEEDED',receiptRef:result.usage.receiptRef,completedAt:new Date().toISOString()}
   return result
  }catch(error){c.requests[d]={...c.requests[d],state:'FAILED_OR_UNCERTAIN',code:/^[A-Z_]{1,80}$/.test(error.code??'')?error.code:'COLLECTION_NOT_COMPLETED',failedAt:new Date().toISOString(),retryAfterSeconds:Number.isSafeInteger(error.retryAfterSeconds)?error.retryAfterSeconds:null};await save(c);throw error}
 }
 const metadataEntry=(provider,item)=>({id:item.payload.datasetId,provider,group:provider==='eia'?(item.payload.datasetId.split('/')[0]||'root'):provider==='cftc'?item.payload.name:'discovery',status:'LIVE_VERIFIED',priceUsd:0,metadata:item.payload,
  evidence:{receiptRef:item.metadata.usageReceiptRef,fingerprint:item.metadata.contentFingerprint,retrievedAt:item.metadata.retrievedAt,sourceUrl:item.metadata.sourceUrl,licenceRef:item.metadata.licenceRef,storageBasis:item.metadata.consumerStorage},
  dataEvidence:{status:'DOCUMENTED_NOT_TESTED',reason:'Metadata discovery does not prove an observation query'},licence:provider==='eia'?'EIA_TERMS_AND_ATTRIBUTION':provider==='cftc'?'CFTC_PUBLIC_DOMAIN_EXCEPT_THIRD_PARTY':'UPSTREAM_TERMS_AND_ATTRIBUTION'})
 for(const provider of ['eia','cftc','commodities-sh']){
  const info=c.providers[provider]
  try{
   if(provider==='eia'){
    const queue=[''],seen=new Set();while(queue.length){const path=queue.shift();if(seen.has(path))continue;seen.add(path)
     let entry=info.entries.find(e=>e.id===path)
     if(!entry){const body=await acquire(command(provider,{path}));if(body.items.length!==1)throw Error('EIA_METADATA_SCHEMA_CHANGED');entry=metadataEntry(provider,body.items[0]);info.entries.push(entry);await save(c);onProgress({provider,nodes:seen.size,pending:queue.length})}
     for(const child of entry.metadata.children){if(!/^[A-Za-z0-9_-]+$/.test(child.id))throw Error('EIA_UNSAFE_DISCOVERY_ROUTE');queue.push(path?path+'/'+child.id:child.id)}
    }info.metadataTreeComplete=true
   }else if(provider==='cftc'){
    const ids=new Set(info.entries.map(e=>e.id));let offset=info.catalogueNextOffset??0
    while(!info.catalogueComplete){const body=await acquire(command(provider,{limit:100,offset},'catalog'));let added=0
     for(const item of body.items)if(!ids.has(item.payload.datasetId)){ids.add(item.payload.datasetId);info.entries.push(metadataEntry(provider,item));added++}
     offset+=body.items.length;info.catalogueNextOffset=offset;info.catalogueComplete=body.items.length<100;await save(c)
     if(!added&&!info.catalogueComplete)throw Error('CFTC_PAGINATION_NOT_ADVANCING')
    }
    for(const e of info.entries){if(e.metadata.fields.length||e.metadata.viewType==='story')continue;const body=await acquire(command(provider,{datasetId:e.id}));if(body.items.length!==1)throw Error('CFTC_METADATA_SCHEMA_CHANGED');Object.assign(e,metadataEntry(provider,body.items[0]));await save(c)}info.datasetMetadataComplete=true
   }else{
    if(!info.openapiLiveVerified){const body=await acquire(command(provider,{endpoint:'openapi',limit:1000},'catalog'));info.entries=body.items.map(item=>({...metadataEntry(provider,item),id:item.payload.datasetId,status:item.payload.documentedStatus,priceUsd:item.payload.priceUsd,method:item.payload.method,path:item.payload.path,access:item.payload.access}));info.openapiLiveVerified=true;await save(c)}
    if(!info.catalogueLiveVerified){const body=await acquire(command(provider,{endpoint:'catalog'},'catalog'));info.entries.push(...body.items.map(i=>metadataEntry(provider,i)));info.catalogueLiveVerified=true;await save(c)}
   }
   info.status='LIVE_VERIFIED';info.reason='Current authorized SourceHub metadata acquired; observation proof is separate'
  }catch(error){info.status='ACCESS_RESTRICTED';info.reason=error.code??error.message;onProgress({provider,status:'INCOMPLETE',code:info.reason})}
  await save(c)
 }
 c.inventoryComplete=c.providers.eia.metadataTreeComplete===true&&c.providers.cftc.catalogueComplete===true&&c.providers.cftc.datasetMetadataComplete===true&&c.providers['commodities-sh'].catalogueLiveVerified===true&&c.providers['commodities-sh'].openapiLiveVerified===true
 c.status=c.inventoryComplete?'METADATA_INVENTORY_COMPLETE':'PARTIAL_INVENTORY';await save(c);return c
}
async function main(){const {profile,client}=await loadCatalogueClient(process.env.SOURCE_HUB_CATALOGUE_PROFILE_FILE,process.env.SOURCE_HUB_CATALOGUE_PRIVATE_KEY_FILE);if(!/^owner-decision:sha256:[a-f0-9]{64}$/.test(process.env.SOURCE_HUB_CATALOGUE_OWNER_REFERENCE??''))throw Error('OWNER_APPROVAL_REQUIRED');const c=JSON.parse(await readFile(catalogueUrl,'utf8'));if(!/^[a-f0-9]{40}$/.test(process.env.SOURCE_HUB_CATALOGUE_SOURCE_SHA??'')||!/^dep-[a-z0-9]+$/.test(process.env.SOURCE_HUB_CATALOGUE_DEPLOY_ID??''))throw Error('VERIFIED_DEVELOPMENT_RELEASE_REFERENCE_REQUIRED');c.sourceCommit=process.env.SOURCE_HUB_CATALOGUE_SOURCE_SHA;c.developmentDeployment={serviceId:'srv-dbllmk0n74is73c2eptg',deployId:process.env.SOURCE_HUB_CATALOGUE_DEPLOY_ID};await collectCatalogue({catalogue:c,client,profile,providerThrottleMs:{eia:2000},onProgress:progress=>process.stdout.write(JSON.stringify(progress)+'\n')});finalizeCatalogue(c);await persistCatalogue(c)}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.stderr.write('{"catalogue":"REFUSED_OR_INCOMPLETE"}\n');process.exitCode=1})
