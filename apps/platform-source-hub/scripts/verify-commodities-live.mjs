// Real consumer E2E only. No direct provider fetch, credentials or persisted data.
import {readFile,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {loadCatalogueClient,persistCatalogue} from './catalog-commodities.mjs'
export async function verifyCommoditiesLive({client,profile,catalogue=null,save=persistCatalogue}){
 const requests=[
  {provider:'eia',family:'series-observations',operation:'observations',criteria:{path:'petroleum/stoc/wstk',frequency:'weekly',data:['value'],facets:{duoarea:['NUS']},limit:3}},
  {provider:'cftc',family:'positioning-observations',operation:'observations',criteria:{datasetId:'jun7-fc8e',limit:3}},
  {provider:'commodities-sh',family:'data-catalog',operation:'catalog',criteria:{endpoint:'catalog'}},
  {provider:'commodities-sh',family:'publication-calendar',operation:'calendar',criteria:{limit:1000}}
 ]
 const evidence=[]
 for(const r of requests){const q={contractVersion:'1.1.0',...r},grant=profile.grants.find(g=>g.resourceId==='api.'+r.provider+'.'+r.family)
  if(!grant)throw Error('EXACT_SERVICE_GRANT_REQUIRED')
  try{const result=await client.acquire({command:q,execution:{kind:'SERVICE',organisationId:profile.organisationId,grantId:grant.grantId},idempotencyKey:'commodity-live:'+randomUUID()})
   if(result.items.length===0)throw Error('NONEMPTY_REAL_PROVIDER_DATA_REQUIRED')
   const e={provider:r.provider,family:r.family,operation:r.operation,criteria:r.criteria,status:'LIVE_VERIFIED',sourceHubHttpStatus:200,providerHttpStatus:'VERIFY_MATCHING_SOURCE_RECEIPT',itemCount:result.items.length,receiptRef:result.usage.receiptRef,upstreamAttempts:result.usage.upstreamAttempts,retrievedAt:result.provenance.retrievedAt,sourceUrl:result.items[0].metadata.sourceUrl,fingerprints:result.items.map(i=>i.metadata.contentFingerprint)}
   // Hashes/counts only. TTL0 observations and schedules are not written.
   evidence.push(e)
   if(catalogue){const info=catalogue.providers[r.provider],entry=info.entries.find(x=>x.id===(r.criteria.path??(r.criteria.datasetId??(r.family==='publication-calendar'?'GET /v1/calendar':'GET /v1/catalog'))))
    if(entry){entry.dataEvidence=e;if(r.provider==='commodities-sh')entry.status='LIVE_VERIFIED'}
    info.liveEvidence??=[];info.liveEvidence.push(e);await save(catalogue)
   }
  }catch(error){evidence.push({provider:r.provider,family:r.family,status:'ACCESS_RESTRICTED',code:error.code??error.message});}
 }
 return {businessOutcome:evidence.every(e=>e.status==='LIVE_VERIFIED')?'SUCCESS':'PARTIAL',evidence}
}
async function main(){if(!/^owner-decision:sha256:[a-f0-9]{64}$/.test(process.env.SOURCE_HUB_CATALOGUE_OWNER_REFERENCE??''))throw Error('OWNER_APPROVAL_REQUIRED');const {profile,client}=await loadCatalogueClient(process.env.SOURCE_HUB_CATALOGUE_PROFILE_FILE,process.env.SOURCE_HUB_CATALOGUE_PRIVATE_KEY_FILE),catalogue=JSON.parse(await readFile(new URL('../catalog/commodities-capabilities-v1.json',import.meta.url),'utf8')),r=await verifyCommoditiesLive({profile,client,catalogue});if(process.env.SOURCE_HUB_LIVE_EVIDENCE_FILE)await writeFile(process.env.SOURCE_HUB_LIVE_EVIDENCE_FILE,JSON.stringify(r,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify(r)+'\n');if(r.businessOutcome!=='SUCCESS')process.exitCode=1}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.stderr.write('{"live":"REFUSED_OR_FAILED"}\n');process.exitCode=1})
