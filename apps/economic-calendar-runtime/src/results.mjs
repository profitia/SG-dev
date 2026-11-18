import {CalendarError,canonical,fingerprint,instant} from '@profitia/economic-calendar-contracts'
import {assertHubResponse} from '@profitia/platform-source-hub-contracts'
import {semanticSnapshot} from './semantics.mjs'
import {recordResultLink} from './result-links.mjs'
import {assertResultMeasure} from './result-scope.mjs'
const decimal=value=>{
 if(value===null)return null
 const text=String(value),negative=text.startsWith('-'),parts=text.replace(/^[-+]/,'').split('.')
 const whole=parts[0].replace(/^0+(?=\d)/,''),fraction=(parts[1]??'').replace(/0+$/,'')
 const normalized=whole+(fraction?'.'+fraction:'');return negative&&normalized!=='0'?'-'+normalized:normalized
}

/** Current EIA snapshots are observations of a period, not publication vintages.
 * The already-retained schedule supplies an edition only on an exact, unique
 * provider/publication/reference-period match; no date proximity heuristic.
 */
export async function persistResults(database,command,response,{intentDigest,assertLease=async(_t)=>{}}){
  assertHubResponse(response,command)
  if(command.contractVersion!=='1.4.0'||!/^([a-f0-9]{64})$/.test(intentDigest??''))throw new CalendarError('DURABLE_RESULT_CONTRACT_REQUIRED')
  const requestDigest=fingerprint(command),contentDigest=fingerprint(response.items),receipt=response.usage.receiptRef
  return database.transact(async t=>{
    await assertLease(t)
    await t.query("SELECT pg_advisory_xact_lock(hashtextextended('ecr-result-intent:'||$1,0))",[intentDigest])
    const {rows:[old]}=await t.query('SELECT * FROM economic_calendar.result_acquisitions WHERE intent_digest=$1 OR receipt_ref=$2::uuid',[intentDigest,receipt])
    if(old){if(old.intent_digest!==intentDigest||old.request_digest!==requestDigest||old.content_digest!==contentDigest)throw new CalendarError('RESULT_INTENT_CONFLICT',409);return {...old.result,replay:true}}
    const semantics=await semanticSnapshot(t),measures=semantics.filter(e=>e.kind==='measure'&&e.status==='accepted'),mappings=semantics.filter(e=>e.kind==='mapping')
    const result={received:response.items.length,created:0,changed:0,unchanged:0,stale:0,matched:0,unresolved:0,receiptRef:receipt,replay:false,latestReferencePeriod:null,coverage:response.coverage}
    const duplicate=new Set()
    for(const item of response.items){
      const p=item.payload,m=item.metadata,s=m.consumerStorage
      if(!/^\d{4}-\d\d-\d\d$/.test(p.referencePeriod)||!Number.isFinite(Date.parse(p.referencePeriod))||new Date(p.referencePeriod).toISOString().slice(0,10)!==p.referencePeriod
        ||p.referencePeriod>m.retrievedAt.slice(0,10)||command.criteria.start&&p.referencePeriod<command.criteria.start||command.criteria.end&&p.referencePeriod>command.criteria.end)throw new CalendarError('RESULT_REFERENCE_PERIOD_NOT_ADMITTED',502)
      const {rows:[policy]}=await t.query('SELECT * FROM economic_calendar.result_storage_policies WHERE provider_id=$1 AND family=$2 AND dataset_id=$3',[command.provider,command.family,p.datasetId])
      if(!policy||policy.status!=='ACTIVE'||policy.licence_ref!==m.licenceRef||policy.basis_ref!==s.basisRef||!policy.series_ids.includes(p.dimensions.series))throw new CalendarError('ECR_RESULT_STORAGE_NOT_ADMITTED',403)
      for(const value of p.measures){
        const measure=measures.find(e=>e.data.sourceSelector.provider===command.provider&&e.data.sourceSelector.path===p.datasetId&&e.data.sourceSelector.series===p.dimensions.series&&e.data.sourceSelector.field===value.field)
        const scope=assertResultMeasure(measure,mappings,p,value)
        if(value.value!==null&&(typeof value.value!=='number'&&typeof value.value!=='string'||!/^[-+]?\d+(?:\.\d+)?$/.test(String(value.value))||!Number.isFinite(Number(value.value))))throw new CalendarError('UNCONFIRMED_RESULT_SEMANTICS',502)
        const concept=measure.data.conceptId
        const {rows:events}=await t.query("SELECT event_id FROM economic_calendar.events WHERE provider=$1 AND current_data->'source'->>'publicationRef'=$3 AND current_data->'reference'->>'providerValue'=$2",[command.provider,p.referencePeriod,scope.publicationRef])
        const event=events.length===1?events[0].event_id:null
        result.latestReferencePeriod=[result.latestReferencePeriod,p.referencePeriod].filter(Boolean).sort().at(-1)
        const id='ecr_obs_'+fingerprint({provider:command.provider,dataset:p.datasetId,series:p.dimensions.series,field:value.field,referencePeriod:p.referencePeriod,geography:p.dimensions.duoarea})
        if(duplicate.has(id))throw new CalendarError('DUPLICATE_RESULT_IN_ACQUISITION',502);duplicate.add(id)
        await t.query("SELECT pg_advisory_xact_lock(hashtextextended('ecr-result:'||$1,0))",[id])
        const data={conceptId:concept,measureId:measure.id,eventId:event,actual:decimal(value.value),unit:value.unit,publishedAt:p.publishedAt,sourceUpdatedAt:m.asOf,
          referencePeriod:p.referencePeriod,geography:p.dimensions.duoarea,revisionStatus:p.revisionStatus}
        const {conceptId,measureId,eventId,...sourceValues}=data
        const digest=fingerprint(sourceValues),{rows:[previous]}=await t.query('SELECT * FROM economic_calendar.result_observations WHERE observation_id=$1 AND adopted_as_current ORDER BY sequence DESC LIMIT 1',[id])
        if(previous?.fingerprint===digest){await recordResultLink(t,id,Number(previous.sequence),event,scope.method);result.unchanged++;continue}
        const stale=Boolean(previous&&new Date(previous.source_retrieved_at)>new Date(m.retrievedAt))
        const {rows:[last]}=await t.query('SELECT coalesce(max(sequence),0)+1 AS next FROM economic_calendar.result_observations WHERE observation_id=$1',[id]),sequence=Number(last.next)
        await t.query(`INSERT INTO economic_calendar.result_observations(observation_id,sequence,event_id,concept_id,measure_id,provider_id,dataset_id,series_id,reference_period,geography,unit,measure_version,
          actual,previous,forecast,revised,published_at,source_updated_at,source_retrieved_at,fingerprint,receipt_ref,source_record_ref,source_url,licence_ref,basis_ref,rights_version,adopted_as_current,change_kind,correlation_status)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$26,$12::numeric,NULL,NULL,NULL,$13::timestamptz,$14::timestamptz,$15::timestamptz,$16,$17::uuid,$18,$19,$20,$21,$22,$23,$24,$25)`,
        [id,sequence,event,concept,measure.id,command.provider,p.datasetId,p.dimensions.series,p.referencePeriod,p.dimensions.duoarea,value.unit,data.actual,p.publishedAt,m.asOf,instant(m.retrievedAt),digest,receipt,m.sourceRecordRef,m.sourceUrl,m.licenceRef,s.basisRef,s.rightsVersion,!stale,stale?'STALE_SOURCE_OBSERVATION':previous?(decimal(previous.actual)===data.actual?'SOURCE_METADATA_CHANGED':'VALUE_CHANGED'):'FIRST_OBSERVED',event?'MATCHED_REFERENCE_PERIOD':'UNRESOLVED_EDITION',measure.version])
        await recordResultLink(t,id,sequence,event,scope.method)
        result[stale?'stale':previous?'changed':'created']++;result[event?'matched':'unresolved']++
      }
    }
    await t.query('INSERT INTO economic_calendar.result_acquisitions(intent_digest,request_digest,content_digest,receipt_ref,result) VALUES($1,$2,$3,$4::uuid,$5::jsonb)',[intentDigest,requestDigest,contentDigest,receipt,JSON.stringify(result)])
    return result
  },{timeoutMs:30000,maxWaitMs:5000})
}
