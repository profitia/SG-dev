// One canonical metadata catalogue. No direct provider HTTP, paid calls or cron.
import {readFile,writeFile,rename,lstat} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {setTimeout as pause} from 'node:timers/promises'
import {createFirstPartySourceHubClient} from '@profitia/platform-source-hub-contracts/client'
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const catalogueUrl=new URL('../catalog/commodities-capabilities-v1.json',import.meta.url)
const humanUrl=new URL('../docs/commodities-capabilities.pl.md',import.meta.url)
export function catalogueSummary(catalogue){const out={};for(const [p,info]of Object.entries(catalogue.providers)){out[p]={entries:info.entries.length,byStatus:Object.fromEntries(catalogue.statusVocabulary.map(s=>[s,info.entries.filter(e=>e.status===s).length])),liveDataOperations:info.entries.filter(e=>e.dataEvidence?.status==='LIVE_VERIFIED').length}}return out}
export function renderCatalogue(c){
 const lines=['# Katalog możliwości EIA, CFTC i commodities.sh','',`Status: **${c.status}**. Kompletność inwentaryzacji: **${c.inventoryComplete?'potwierdzona':'niepotwierdzona'}**.`, '', 'Źródłem tej reprezentacji jest [jeden katalog JSON](../catalog/commodities-capabilities-v1.json). Zawiera pola, jednostki, trasy, częstotliwości, koszty, licencje i receipt każdego potwierdzenia. Metadane LIVE nie oznaczają przetestowania wszystkich szeregów ani historii.','', '| Provider | Pozycje | LIVE metadanych/operacji | Udokumentowane | Płatne, nieaktywne | Ograniczone / nieznane |','|---|---:|---:|---:|---:|---:|']
 for(const [p,s]of Object.entries(catalogueSummary(c)))lines.push(`| ${p} | ${s.entries} | ${s.byStatus.LIVE_VERIFIED} | ${s.byStatus.DOCUMENTED_NOT_TESTED} | ${s.byStatus.PAID_NOT_ACTIVATED} | ${s.byStatus.ACCESS_RESTRICTED+s.byStatus.UNAVAILABLE_OR_UNKNOWN} |`)
 for(const [p,info]of Object.entries(c.providers)){
  lines.push('',`## ${p}`,'',info.reason??'', '', '| Grupa / zbiór / endpoint | Status | Pola | Częstotliwości | Koszt USD |','|---|---|---:|---|---|')
  for(const e of info.entries)lines.push(`| ${String(e.id).replaceAll('|','\\|')} | ${e.status} | ${e.metadata?.fields?.length??e.fields?.length??'—'} | ${(e.metadata?.frequencies??[]).map(f=>f.id).join(', ')||'nieustalona'} | ${e.priceUsd??'nieustalony'} |`)
  lines.push('', 'Dokumentacja: '+info.documentation.map(u=>`[źródło](${u})`).join(', '))
 }
 lines.push('', '## Ograniczenia i licencje','', 'EIA: bezpłatny klucz, rzeczywisty throttling dostawcy, atrybucja EIA, zastrzeżenia praw do materiałów osób trzecich. CFTC: informacje rządowe są public domain, z wyjątkami dla cudzych materiałów; atrybucja CFTC. commodities.sh: obowiązują także warunki źródeł nadrzędnych, w tym FRED. Darmowy discovery nie przyznaje prawa do redystrybucji płatnych obserwacji. Komercyjna redystrybucja wymaga sprawdzenia praw konkretnej serii. SourceHub nie utrwala treści obserwacji przy TTL 0; katalog zapisuje wyłącznie dopuszczone metadane.','', '## Niewiążące możliwe zastosowania','', 'Oil Report: zapasy, produkcja, handel i ceny energii EIA oraz pozycjonowanie COT CFTC. Kalendarz Surowcowy: harmonogramy publikacji i okresy referencyjne, bez utożsamiania ich z opublikowanym odczytem. Analityka SpendGuru: porównania szeregów z zachowaniem jednostek, rewizji i semantyki instrumentów. Żadne z tych zastosowań nie jest wdrażane ani zatwierdzane przez ten katalog.','')
 return lines.join('\n')
}
export async function persistCatalogue(c){c.summary=catalogueSummary(c);await writeFile(new URL(catalogueUrl.href+'.tmp'),JSON.stringify(c,null,2)+'\n',{flag:'wx'});await rename(new URL(catalogueUrl.href+'.tmp'),catalogueUrl);await writeFile(humanUrl,renderCatalogue(c))}
export async function loadCatalogueClient(profileFile,keyFile){
 const stat=await lstat(keyFile);if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||stat.size>4096)throw Error('PRIVATE_SERVICE_KEY_REQUIRED')
 const profile=JSON.parse(await readFile(profileFile,'utf8'))
 if(profile.status!=='ENROLLED'||profile.targetOrigin!=='https://source-hub-development.onrender.com'||profile.applicationId!=='profitia-source-hub-catalogue-development'||profile.componentId!=='source-hub-catalogue-development'||Date.parse(profile.expiresAt)<=Date.now())throw Error('CURRENT_OWN_SERVICE_ENROLLMENT_REQUIRED')
 const client=createFirstPartySourceHubClient({environment:'development',componentId:profile.componentId,consumerApplicationId:profile.applicationId,receiverApplicationId:profile.receiverApplicationId,sourceOrigin:profile.sourceOrigin,targetOrigin:profile.targetOrigin,keyId:profile.keyId,privateKey:await readFile(keyFile,'utf8')})
 return {profile,client}
}
export async function collectCatalogue({catalogue,client,profile,save=persistCatalogue,throttleMs=500,onProgress=()=>{}}){
 const c=catalogue;c.requests??={};c.generatedAt=new Date().toISOString()
 const command=(provider,criteria={},operation='metadata')=>({contractVersion:'1.1.0',provider,family:'data-catalog',operation,criteria})
 async function acquire(q){
  const d=digest(q),old=c.requests[d]
  if(old)throw Error(old.state==='SUCCEEDED'?'METADATA_ALREADY_PERSISTED_USE_CHECKPOINT':'PRIOR_ATTEMPT_REQUIRES_RECONCILIATION')
  const grant=profile.grants.find(g=>g.resourceId==='api.'+q.provider+'.'+q.family);if(!grant)throw Error('EXACT_SERVICE_GRANT_REQUIRED')
  const key='commodity-catalogue:'+randomUUID();c.requests[d]={state:'PENDING',idempotencyKey:key,command:q};await save(c)
  try{await pause(throttleMs);const result=await client.acquire({command:q,execution:{kind:'SERVICE',organisationId:profile.organisationId,grantId:grant.grantId},idempotencyKey:key})
   if(result.items.some(i=>i.metadata.consumerStorage?.mode!=='CATALOG_METADATA_ONLY'))throw Error('CATALOGUE_STORAGE_RIGHT_REQUIRED')
   c.requests[d]={...c.requests[d],state:'SUCCEEDED',receiptRef:result.usage.receiptRef,completedAt:new Date().toISOString()}
   return result
  }catch(error){c.requests[d]={...c.requests[d],state:'FAILED_OR_UNCERTAIN',code:/^[A-Z_]{1,80}$/.test(error.code??'')?error.code:'COLLECTION_NOT_COMPLETED'};await save(c);throw error}
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
async function main(){const {profile,client}=await loadCatalogueClient(process.env.SOURCE_HUB_CATALOGUE_PROFILE_FILE,process.env.SOURCE_HUB_CATALOGUE_PRIVATE_KEY_FILE);if(!/^owner-decision:sha256:[a-f0-9]{64}$/.test(process.env.SOURCE_HUB_CATALOGUE_OWNER_REFERENCE??''))throw Error('OWNER_APPROVAL_REQUIRED');const c=JSON.parse(await readFile(catalogueUrl,'utf8'));if(!/^[a-f0-9]{40}$/.test(process.env.SOURCE_HUB_CATALOGUE_SOURCE_SHA??'')||!/^dep-[a-z0-9]+$/.test(process.env.SOURCE_HUB_CATALOGUE_DEPLOY_ID??''))throw Error('VERIFIED_DEVELOPMENT_RELEASE_REFERENCE_REQUIRED');c.sourceCommit=process.env.SOURCE_HUB_CATALOGUE_SOURCE_SHA;c.developmentDeployment={serviceId:'srv-dbllmk0n74is73c2eptg',deployId:process.env.SOURCE_HUB_CATALOGUE_DEPLOY_ID};await collectCatalogue({catalogue:c,client,profile,onProgress:progress=>process.stdout.write(JSON.stringify(progress)+'\n')})}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.stderr.write('{"catalogue":"REFUSED_OR_INCOMPLETE"}\n');process.exitCode=1})
