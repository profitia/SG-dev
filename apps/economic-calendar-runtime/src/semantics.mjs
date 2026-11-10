import {CalendarError, fingerprint, instant} from '@profitia/economic-calendar-contracts'
import {SEMANTIC_CONTRACT,semanticChange,semanticFilter,semanticId} from '../../../packages/economic-calendar-contracts/semantic.mjs'

/** Curation is an operator operation, not an HTTP write or an ingestion privilege. */
export async function curate(transaction,input) {
  const v=semanticChange(input),{expectedVersion,...content}=v,digest=fingerprint(content)
  const {rows:[role]}=await transaction.query('SELECT current_user AS role')
  if(role.role!=='economic_calendar_development_owner')throw new CalendarError('SEMANTIC_CURATOR_REQUIRED',403)
  await transaction.query("SELECT pg_advisory_xact_lock(hashtextextended('ecr-semantics:'||$1||':'||$2,0))",[v.kind,v.id])
  const {rows:[old]}=await transaction.query('SELECT * FROM economic_calendar.semantic_revisions WHERE kind=$1 AND entity_id=$2 ORDER BY version DESC LIMIT 1',[v.kind,v.id])
  if(old?.fingerprint===digest)return {id:v.id,version:Number(old.version),changed:false}
  if(Number(old?.version??0)!==expectedVersion)throw new CalendarError('SEMANTIC_VERSION_CONFLICT',409)
  if(v.status==='accepted'){
    for(const [key,kind] of [['conceptId','concept'],['ruleId','rule']])if(v.data[key]){
      const {rows:[dependency]}=await transaction.query('SELECT status,version FROM economic_calendar.semantic_revisions WHERE kind=$1 AND entity_id=$2 ORDER BY version DESC LIMIT 1',[kind,v.data[key]])
      if(dependency?.status!=='accepted'||key==='ruleId'&&Number(dependency.version)!==v.data.ruleVersion)throw new CalendarError('SEMANTIC_DEPENDENCY_NOT_ACCEPTED',409)
    }
  }
  const {rows:[saved]}=await transaction.query(`INSERT INTO economic_calendar.semantic_revisions(kind,entity_id,version,status,data,evidence,curator_ref,fingerprint,effective_at,approved_at)
    VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9::timestamptz,CASE WHEN $4='accepted' THEN clock_timestamp() ELSE NULL END)
    RETURNING version,recorded_at,approved_at`,[v.kind,v.id,expectedVersion+1,v.status,JSON.stringify(v.data),JSON.stringify(v.evidence),v.curatorRef,digest,v.effectiveAt])
  return {id:v.id,version:Number(saved.version),changed:true,recordedAt:saved.recorded_at,approvedAt:saved.approved_at}
}
/** @param {any} transaction @param {string|null} asKnownAt */
export async function semanticSnapshot(transaction,asKnownAt=null){
  if(asKnownAt!==null)instant(asKnownAt)
  const {rows}=await transaction.query(`SELECT DISTINCT ON(kind,entity_id) kind,entity_id,version,status,data,evidence,curator_ref,recorded_at,effective_at,approved_at
    FROM economic_calendar.semantic_revisions WHERE recorded_at<=coalesce($1::timestamptz,clock_timestamp())
    AND effective_at<=coalesce($1::timestamptz,clock_timestamp()) ORDER BY kind,entity_id,version DESC`,[asKnownAt])
  return rows.map(r=>({kind:r.kind,id:r.entity_id,version:Number(r.version),status:r.status,data:r.data,evidence:r.evidence,curatorRef:r.curator_ref,recordedAt:r.recorded_at,effectiveAt:r.effective_at,approvedAt:r.approved_at}))
}
function accepted(entries,kind,id){return entries.find(e=>e.kind===kind&&e.id===id&&e.status==='accepted')}
export function publicationMeaning(entries,publication){
  const mappings=entries.filter(e=>e.kind==='mapping'&&e.data.provider===publication.source.provider&&e.data.publicationRef===publication.source.publicationRef)
  return mappings.map(m=>({mapping:m,concept:accepted(entries,'concept',m.data.conceptId)??null,
    certainty:m.status==='accepted'&&m.data.certainty==='CONFIRMED'?'CONFIRMED':m.status==='candidate'?'SUGGESTED':'UNRESOLVED'}))
}
function relationships(entries,conceptId,f){
  return entries.filter(e=>e.kind==='relevance'&&e.status==='accepted'&&e.data.conceptId===conceptId
    &&(!f.targetId||e.data.targetType===f.targetType&&e.data.targetId===f.targetId)
    &&accepted(entries,'rule',e.data.ruleId)?.version===e.data.ruleVersion)
}
export async function resultSnapshot(t,eventIds,asKnownAt=null){
  if(!eventIds.length)return []
  const {rows}=await t.query(`WITH retained AS(SELECT DISTINCT ON(observation_id) * FROM economic_calendar.result_observations WHERE adopted_as_current
    AND observed_at<=coalesce($2::timestamptz,clock_timestamp()) ORDER BY observation_id,sequence DESC)
    SELECT r.observation_id,r.sequence,l.event_id,r.concept_id,r.measure_id,r.measure_version,r.series_id,r.reference_period,r.geography,r.unit,
    r.actual::text,r.previous::text,r.forecast::text,r.revised::text,r.published_at,r.source_updated_at,r.source_retrieved_at,r.observed_at,
    r.receipt_ref,r.source_record_ref,r.source_url,r.licence_ref,r.basis_ref,r.rights_version,l.status AS correlation_status,l.recorded_at AS linked_at
    FROM retained r JOIN LATERAL(SELECT event_id,status,recorded_at FROM economic_calendar.result_links WHERE observation_id=r.observation_id
    AND recorded_at<=coalesce($2::timestamptz,clock_timestamp()) ORDER BY version DESC LIMIT 1)l ON true
    WHERE l.event_id=ANY($1::text[]) ORDER BY r.observation_id`,[eventIds,asKnownAt])
  return rows.map(r=>({observationId:r.observation_id,sequence:Number(r.sequence),eventId:r.event_id,conceptId:r.concept_id,measureId:r.measure_id,
    seriesId:r.series_id,referencePeriod:r.reference_period,geography:r.geography,unit:r.unit,observedMeasureVersion:Number(r.measure_version),editionLinkedAt:r.linked_at,
    actual:r.actual,previous:r.previous,forecast:r.forecast,revised:r.revised,publishedAt:r.published_at,sourceUpdatedAt:r.source_updated_at,
    sourceRetrievedAt:r.source_retrieved_at,observedAt:r.observed_at,receiptRef:r.receipt_ref,sourceRecordRef:r.source_record_ref,sourceUrl:r.source_url,
    licenceRef:r.licence_ref,storageBasisRef:r.basis_ref,rightsVersion:r.rights_version,correlationStatus:r.correlation_status,valueMeaning:'CURRENT_SNAPSHOT_NOT_PUBLICATION_VINTAGE'}))
}
export function createSemanticRepository(repository){
  async function timeline(t,input={}){
    const f=semanticFilter(input),entries=await semanticSnapshot(t,f.asKnownAt??null)
    // Select definitions and releases in SQL with keyset pagination. Relevance
    // selects a context; it never removes publications from the global store.
    const mappings=entries.filter(e=>e.kind==='mapping'&&e.status==='accepted'&&e.data.certainty==='CONFIRMED'&&accepted(entries,'concept',e.data.conceptId)
      &&(!f.targetId||relationships(entries,e.data.conceptId,f).length))
    const keys=mappings.map(m=>m.data.provider+'|'+m.data.publicationRef)
    const {rows}=await t.query(`WITH retained AS(
      SELECT e.event_id,coalesce($1::timestamptz,NULL) AS cutoff,
       CASE WHEN $1::timestamptz IS NULL THEN e.current_data ELSE v.data END AS data,
       CASE WHEN $1::timestamptz IS NULL THEN e.current_observed_at ELSE v.observed_at END AS known_at
      FROM economic_calendar.events e LEFT JOIN LATERAL(SELECT data,observed_at FROM economic_calendar.observations
       WHERE event_id=e.event_id AND adopted_as_current AND observed_at<=$1 ORDER BY observed_at DESC,sequence DESC LIMIT 1)v ON true)
      SELECT * FROM retained WHERE data IS NOT NULL AND (data->'source'->>'provider')||'|'||(data->'source'->>'publicationRef')=ANY($2::text[])
      AND ($3::timestamptz IS NULL OR (data->>'eventAt')::timestamptz>=$3)
      AND ($4::timestamptz IS NULL OR (data->>'eventAt')::timestamptz<=$4)
      AND ($5::text IS NULL OR event_id>$5) ORDER BY event_id LIMIT $6`,[f.asKnownAt??null,keys,f.from??null,f.to??null,f.after??null,f.limit+1])
    const page=rows.slice(0,f.limit),results=await resultSnapshot(t,page.map(r=>r.event_id),f.asKnownAt??null)
    const items=page.map(r=>{
      const mapping=mappings.find(m=>m.data.provider===r.data.source.provider&&m.data.publicationRef===r.data.source.publicationRef)
      const concept=accepted(entries,'concept',mapping.data.conceptId)
      return {eventId:r.event_id,event:r.data,knownAt:r.known_at,concept,mapping,relevance:relationships(entries,concept.id,f),
        results:results.filter(x=>x.eventId===r.event_id),timeMeaning:'SOURCE_SCHEDULE_NOT_PUBLICATION_CONFIRMATION',causalityClaim:false}
    })
    const definitions=await repository.listPublications(t,{limit:500,...(f.asKnownAt?{asKnownAt:f.asKnownAt}:{})})
    return {semanticContract:SEMANTIC_CONTRACT,items,nextAfter:rows.length>f.limit?page.at(-1).event_id:null,order:'CANONICAL_EVENT_ID',
      unresolvedSchedules:definitions.items.flatMap(p=>{const meaning=publicationMeaning(entries,p);return p.unresolvedNextSchedule&&(!f.targetId||meaning.some(m=>m.certainty==='CONFIRMED'&&relationships(entries,m.concept?.id,f).length))?[{publication:p,meaning}]:[]}),
      semanticVersions:entries.map(e=>({kind:e.kind,id:e.id,version:e.version,status:e.status})),
      coverage:{...definitions.coverage,unresolvedDefinitionPageMore:definitions.nextAfter!==null,unmappedDefinitions:definitions.items.filter(p=>!publicationMeaning(entries,p).some(m=>m.certainty==='CONFIRMED')).map(p=>p.publicationId),numericHistory:'OBSERVED_BY_ECR_ONLY',publishedAtNotInferred:true},
      targetStatus:f.targetId?(entries.some(e=>e.kind==='relevance'&&e.data.targetType===f.targetType&&e.data.targetId===f.targetId)?'RECOGNISED':'NO_CONFIRMED_RELATION'):'GLOBAL',causalityClaim:false}
  }
  async function context(t,f={}){
    const facts=await timeline(t,f),entries=await semanticSnapshot(t,f.asKnownAt??null)
    const ids=new Set(facts.items.map(i=>i.concept.id))
    return {...facts,projection:'ECONOMIC_CONTEXT',definitions:entries.filter(e=>['concept','measure'].includes(e.kind)&&e.status==='accepted'&&(ids.has(e.id)||ids.has(e.data.conceptId))),
      interpretationOwner:'AUTHORISED_CONSUMER',missingValuesMeaning:'UNKNOWN_NOT_ZERO'}
  }
  /** @param {any} t @param {{asKnownAt?:string}} input */
  async function knowledge(t,{asKnownAt}={}){return {semanticContract:SEMANTIC_CONTRACT,items:await semanticSnapshot(t,asKnownAt??null),historyMeaning:'RECORDED_SEMANTIC_KNOWLEDGE_ONLY'}}
  async function history(t,id,{after=0,limit=100}={}){
    semanticId(id);if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>500)throw new CalendarError('INVALID_HISTORY_PAGE')
    const {rows}=await t.query('SELECT kind,entity_id,version,status,data,evidence,curator_ref,effective_at,recorded_at,approved_at FROM economic_calendar.semantic_revisions WHERE entity_id=$1 AND version>$2 ORDER BY version LIMIT $3',[id,after,limit+1])
    return {items:rows.slice(0,limit),nextAfter:rows.length>limit?Number(rows[limit-1].version):null,historyMeaning:'RECORDED_SEMANTIC_KNOWLEDGE_ONLY'}
  }
  async function freshness(t){const {rows}=await t.query('SELECT job_id,provider_id,status,next_due_at,last_success_at,last_error_code,last_receipt_ref,last_result,lease_until FROM economic_calendar.sync_jobs ORDER BY job_id');return {items:rows,clock:new Date().toISOString(),completeness:'UNKNOWN'}}
  async function evidence(t,id,asKnownAt){const d=await repository.detail(t,id,asKnownAt);return {...d,semanticContract:SEMANTIC_CONTRACT,results:await resultSnapshot(t,[id],asKnownAt??null),meaning:publicationMeaning(await semanticSnapshot(t,asKnownAt??null),{source:d.event.source})}}
  async function resultHistory(t,id,{after='',limit=100}={}){
    await repository.detail(t,id)
    if(!Number.isSafeInteger(limit)||limit<1||limit>500||typeof after!=='string'||after&&!/^ecr_obs_[a-f0-9]{64}\.[1-9][0-9]{0,14}$/.test(after))throw new CalendarError('INVALID_HISTORY_PAGE')
    const [afterId,afterSequence]=after?after.split('.'):['',0]
    const {rows}=await t.query(`SELECT observation_id,sequence,measure_id,concept_id,actual::text,previous::text,forecast::text,revised::text,unit,reference_period,geography,published_at,source_updated_at,source_retrieved_at,observed_at,receipt_ref,source_record_ref,source_url,licence_ref,basis_ref,adopted_as_current,change_kind,correlation_status
      FROM economic_calendar.result_observations o WHERE EXISTS(SELECT 1 FROM economic_calendar.result_links l WHERE l.observation_id=o.observation_id AND l.event_id=$1)
      AND (observation_id,sequence)>($2,$3::bigint) ORDER BY observation_id,sequence LIMIT $4`,[id,afterId,afterSequence,limit+1])
    const page=rows.slice(0,limit)
    const {rows:links}=await t.query('SELECT observation_id,version,event_id,recorded_at,method,status FROM economic_calendar.result_links WHERE observation_id=ANY($1::text[]) ORDER BY observation_id,version',[page.map(r=>r.observation_id)])
    return {items:page,editionLinkHistory:links,nextAfter:rows.length>limit?page.at(-1).observation_id+'.'+page.at(-1).sequence:null,historyMeaning:'OBSERVED_SOURCE_DATA_ONLY_NOT_SEMANTIC_REVISIONS'}
  }
  return Object.freeze({timeline,context,knowledge,history,freshness,evidence,resultHistory})
}
