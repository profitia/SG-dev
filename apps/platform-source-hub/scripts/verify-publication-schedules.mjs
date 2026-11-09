// Explicit real SourceHub consumer verification. No cron, retry, provider
// connection, provider secret or retained schedule/provider content.
import {randomUUID} from 'node:crypto'
import {writeFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {loadCatalogueClient} from './catalog-commodities.mjs'
export async function verifyPublicationSchedules({client,profile,from,to,includeSteo=true}){
 const commands=[{contractVersion:'1.2.0',provider:'commodities-sh',family:'publication-calendar',operation:'calendar',criteria:{limit:1000}},
  {contractVersion:'1.2.0',provider:'eia',family:'publication-calendar',operation:'calendar',criteria:{publication:'wpsr',from,to,limit:1000}},
  ...(includeSteo?[{contractVersion:'1.2.0',provider:'eia',family:'publication-calendar',operation:'calendar',criteria:{publication:'steo',from,to,limit:1000}}]:[])]
 const evidence=[],snapshots=new Map(),comparisons=[]
 for(let repeat=1;repeat<=2;repeat++){
  const responses=new Map()
  for(const command of commands){
   const grant=profile.grants.find(g=>g.resourceId==='api.'+command.provider+'.publication-calendar')
   const label=command.provider+':'+(command.criteria.publication??'calendar'),start=performance.now()
   if(!grant){evidence.push({label,repeat,status:'BLOCKED',code:'EXACT_SERVICE_GRANT_REQUIRED'});continue}
   try{
    const r=await client.acquire({command,execution:{kind:'SERVICE',organisationId:profile.organisationId,grantId:grant.grantId},idempotencyKey:'schedule-verification:'+randomUUID()})
    if(!r.items.length)throw Error('REAL_SCHEDULES_REQUIRED')
    const snapshot=r.items.map(i=>({identity:i.payload.scheduleId??i.payload.correlationKey,fingerprint:i.metadata.contentFingerprint})).sort((a,b)=>a.identity.localeCompare(b.identity))
    const old=snapshots.get(label),unchanged=old?JSON.stringify(old)===JSON.stringify(snapshot):null;snapshots.set(label,snapshot);responses.set(label,r)
    evidence.push({label,repeat,status:'LIVE_VERIFIED',sourceHubHttpStatus:200,providerHttpStatus:'VERIFY_MATCHING_SOURCE_RECEIPT',durationMs:Math.round(performance.now()-start),contractVersion:r.contractVersion,itemCount:r.items.length,coverage:r.coverage,receiptRef:r.usage.receiptRef,upstreamAttempts:r.usage.upstreamAttempts,cacheHit:r.usage.cacheHit,retrievedAt:r.provenance.retrievedAt,
     sourceUrls:[...new Set(r.items.map(i=>i.metadata.sourceUrl))],vendorIdsPresent:r.items.filter(i=>i.metadata.vendorRecordId!==null).length,dated:r.items.filter(i=>i.payload.scheduledAt!==null||i.payload.dateOnly!==null).length,
     scheduleStatuses:[...new Set(r.items.map(i=>i.payload.scheduleStatus))],timePrecisions:[...new Set(r.items.map(i=>i.payload.timePrecision))],unchangedScheduleFacts:unchanged,fingerprints:snapshot.map(i=>i.fingerprint),retentionZero:r.items.every(i=>i.metadata.retentionUntil===null&&!i.metadata.consumerStorage)})
   }catch(error){evidence.push({label,repeat,status:'BLOCKED',code:error.code??'VERIFICATION_FAILED',durationMs:Math.round(performance.now()-start)})}
  }
  // A named publication comparison does not merge provider event identities.
  const aggregated=responses.get('commodities-sh:calendar')?.items.filter(i=>i.payload.title==='EIA Weekly Petroleum Status Report'&&i.payload.sourceName==='EIA')??[],official=responses.get('eia:wpsr')?.items??[]
  if(aggregated.length===1&&aggregated[0].payload.scheduledAt){const a=aggregated[0].payload,next=official.filter(i=>i.payload.scheduledAt>=new Date().toISOString()).sort((a,b)=>a.payload.scheduledAt.localeCompare(b.payload.scheduledAt))[0];comparisons.push({repeat,publication:'Weekly Petroleum Status Report',basis:'EXACT_PUBLICATION_NAME_AND_SOURCE_LABEL_NOT_EVENT_IDENTITY',status:next?(a.scheduledAt===next.payload.scheduledAt?'SCHEDULES_AGREE':'SCHEDULES_DIFFER'):'NO_OFFICIAL_OCCURRENCE_IN_REQUESTED_WINDOW',deltaMinutes:next?(Date.parse(a.scheduledAt)-Date.parse(next.payload.scheduledAt))/60000:null})}
  else comparisons.push({repeat,status:'COMMON_PUBLICATION_NOT_CONFIRMED_WITH_SOURCE_METADATA'})
 }
 return {businessOutcome:evidence.length===commands.length*2&&evidence.every(e=>e.status==='LIVE_VERIFIED'&&e.retentionZero===true)?'SUCCESS':'PARTIAL',evidence,comparisons,limitations:['No exhaustive provider coverage claim','No proof of future uninterrupted availability','Schedule is not proof of API observation availability','No event identity adoption or schedule history retained']}
}
async function main(){
 if(!/^owner-decision:sha256:[a-f0-9]{64}$/.test(process.env.SOURCE_HUB_SCHEDULE_OWNER_REFERENCE??''))throw Error('OWNER_APPROVAL_REQUIRED')
 const {profile,client}=await loadCatalogueClient(process.env.SOURCE_HUB_CATALOGUE_PROFILE_FILE,process.env.SOURCE_HUB_CATALOGUE_PRIVATE_KEY_FILE)
 const result=await verifyPublicationSchedules({profile,client,from:process.env.SOURCE_HUB_SCHEDULE_FROM,to:process.env.SOURCE_HUB_SCHEDULE_TO})
 if(process.env.SOURCE_HUB_SCHEDULE_EVIDENCE_FILE)await writeFile(process.env.SOURCE_HUB_SCHEDULE_EVIDENCE_FILE,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 process.stdout.write(JSON.stringify(result)+'\n');if(result.businessOutcome!=='SUCCESS')process.exitCode=1
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.stderr.write('{"verification":"REFUSED_OR_FAILED"}\n');process.exitCode=1})
