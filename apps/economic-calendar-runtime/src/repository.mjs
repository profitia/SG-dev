import {currentE1SchemaDigest,currentE1CalendarSchemaDigest} from '@profitia/platform-current-e1-authority'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {assertHubResponse} from '@profitia/platform-source-hub-contracts'
import {publicationScheduleObservation,publicationId,publicationFilter} from '@profitia/economic-calendar-contracts'
import {CalendarError, calendarFilter, calendarObservation, canonical, changeKinds, eventId, fingerprint, instant, preferences} from '@profitia/economic-calendar-contracts'

const emptyPreferences = () => preferences({})
const actor = context => {
  if (context?.actorKind !== 'HUMAN' || !context.subjectUserId || context.actorId !== context.subjectUserId) throw new CalendarError('CURRENT_HUMAN_REQUIRED', 403)
  return context.subjectUserId
}
const schemaDigest = createHash('sha256').update(readFileSync(new URL('../migrations/001-read-model-and-preferences.sql', import.meta.url))).digest('hex')
const multiSourceDigest=createHash('sha256').update(readFileSync(new URL('../migrations/002-multi-source-calendar.sql',import.meta.url))).digest('hex')
export function createRepository(configuration, database) {
  configuration=Object.freeze({...configuration})
  async function assertInstalled(transaction) {
    const {rows: [i]} = await transaction.query('SELECT * FROM economic_calendar.installation WHERE singleton')
    if (!(i?.status === 'ACTIVE' && i.schema_digest === schemaDigest && i.receiver_base_digest === currentE1SchemaDigest('receiver') && i.calendar_receiver_digest === currentE1CalendarSchemaDigest('receiver')
      && i.multi_source_schema_digest===multiSourceDigest && i.application_id === configuration.applicationId && i.environment === 'development' && i.project_id === configuration.projectId && i.branch_id === configuration.branchId && i.database_name === configuration.databaseName)) throw new CalendarError('CALENDAR_STORAGE_UNAVAILABLE',503)
  }
  async function ready() {try {await database.verifyLogin();await assertInstalled(database);return true}catch{return false}}
  /** @param {any} transaction @param {string|null|undefined} asKnownAt */
  async function coverage(transaction, asKnownAt = null) {
    const {rows: [c]} = await transaction.query('SELECT min(observed_at) AS first_observed_at,max(observed_at) AS last_observed_at FROM economic_calendar.sync_runs WHERE ($1::timestamptz IS NULL OR observed_at<=$1::timestamptz)', [asKnownAt])
    return {scope: 'ECR_RETAINED_OBSERVATIONS', completeness: 'UNKNOWN', vintageHistory: 'OBSERVED_BY_ECR_ONLY', firstObservedAt: c.first_observed_at, lastObservedAt: c.last_observed_at}
  }
  async function listEvents(transaction, input) {
    const f = calendarFilter(input)
    const {rows} = await transaction.query(`
      WITH retained AS (
        SELECT e.event_id,CASE WHEN $1::timestamptz IS NULL THEN e.current_data ELSE v.data END AS data,
          CASE WHEN $1::timestamptz IS NULL THEN e.current_observed_at ELSE v.observed_at END AS observed_at,
          CASE WHEN $1::timestamptz IS NULL THEN e.current_receipt_ref ELSE v.receipt_ref END AS receipt_ref,
          CASE WHEN $1::timestamptz IS NULL THEN e.current_source_retrieved_at ELSE v.source_retrieved_at END AS source_retrieved_at,
          CASE WHEN $1::timestamptz IS NULL THEN e.last_observed_at ELSE v.observed_at END AS last_observed_at,
          CASE WHEN $1::timestamptz IS NULL THEN e.last_source_retrieved_at ELSE v.source_retrieved_at END AS last_source_retrieved_at
        FROM economic_calendar.events e
        LEFT JOIN LATERAL (SELECT data,observed_at,receipt_ref,source_retrieved_at FROM economic_calendar.observations
          WHERE event_id=e.event_id AND adopted_as_current AND observed_at<=$1::timestamptz ORDER BY observed_at DESC,sequence DESC LIMIT 1) v ON true
      ) SELECT event_id,data,observed_at,receipt_ref,source_retrieved_at,last_observed_at,last_source_retrieved_at FROM retained WHERE data IS NOT NULL
        AND ($2::timestamptz IS NULL OR (data->>'eventAt')::timestamptz >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR (data->>'eventAt')::timestamptz <= $3::timestamptz)
        AND ($4::text[] IS NULL OR data->>'country'=ANY($4::text[]))
        AND ($5::text[] IS NULL OR data->>'indicator'=ANY($5::text[]))
        AND ($6::int[] IS NULL OR (data->>'importance')::int=ANY($6::int[]))
        AND ($7::text IS NULL OR position(lower($7::text) IN lower(data->>'title'))>0)
        AND ($8::text[] IS NULL OR event_id=ANY($8::text[]))
        AND ($9::text IS NULL OR event_id>$9::text)
      ORDER BY event_id LIMIT $10`, [f.asKnownAt ?? null, f.from ?? null, f.to ?? null, f.countries ?? null, f.indicators ?? null, f.importance ?? null, f.eventText ?? null, f.eventIds ?? null, f.after ?? null, f.limit + 1])
    const page = rows.slice(0, f.limit)
    return {items: page.map(r => ({...r.data, knownAt: r.observed_at, observation: {receiptRef:r.receipt_ref,sourceRetrievedAt:r.source_retrieved_at},freshness:{kind:f.asKnownAt?'LATEST_RETAINED_CHANGE_AS_KNOWN_AT':'LATEST_OBSERVATION',observedAt:r.last_observed_at,sourceRetrievedAt:r.last_source_retrieved_at}})), order: 'CANONICAL_EVENT_ID', nextAfter: rows.length > f.limit ? page.at(-1).event_id : null, coverage: await coverage(transaction, f.asKnownAt)}
  }
  async function detail(transaction, id, asKnownAt = undefined) {
    const result = await listEvents(transaction, {eventIds: [eventId(id)], ...(asKnownAt ? {asKnownAt: instant(asKnownAt)} : {}), limit: 1})
    if (!result.items.length) throw new CalendarError('EVENT_NOT_AVAILABLE', 404)
    return {event: result.items[0], coverage: result.coverage}
  }
  async function revisions(transaction, id, {after = 0, limit = 100} = {}) {
    eventId(id)
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new CalendarError('INVALID_HISTORY_PAGE')
    await detail(transaction, id)
    const {rows} = await transaction.query('SELECT sequence,data,observed_at,source_retrieved_at,receipt_ref,adopted_as_current,change_kinds FROM economic_calendar.observations WHERE event_id=$1 AND sequence>$2 ORDER BY sequence LIMIT $3', [id, after, limit + 1])
    const page = rows.slice(0, limit)
    return {items: page.map(r => ({sequence: Number(r.sequence), event: r.data, observedAt: r.observed_at, sourceRetrievedAt: r.source_retrieved_at, receiptRef: r.receipt_ref, adoptedAsCurrent: r.adopted_as_current, changeKinds: r.change_kinds})), nextAfter: rows.length > limit ? Number(page.at(-1).sequence) : null, historyMeaning: 'OBSERVED_BY_ECR_ONLY'}
  }
  /** @param {any} transaction @param {any} input @param {string|null} id */
  async function listPublications(transaction,input={},id=null){
    const f=publicationFilter(input);if(id!==null)publicationId(id)
    const {rows}=await transaction.query(`WITH retained AS (
      SELECT p.publication_id,p.provider,CASE WHEN $1::timestamptz IS NULL THEN p.current_data ELSE v.data END AS data,
       CASE WHEN $1::timestamptz IS NULL THEN p.current_observed_at ELSE v.observed_at END AS observed_at,
       CASE WHEN $1::timestamptz IS NULL THEN p.current_receipt_ref ELSE v.receipt_ref END AS receipt_ref,
       CASE WHEN $1::timestamptz IS NULL THEN p.current_source_retrieved_at ELSE v.source_retrieved_at END AS source_retrieved_at
      FROM economic_calendar.publications p LEFT JOIN LATERAL(SELECT data,observed_at,receipt_ref,source_retrieved_at FROM economic_calendar.publication_observations
       WHERE publication_id=p.publication_id AND adopted_as_current AND observed_at<=$1::timestamptz ORDER BY observed_at DESC,sequence DESC LIMIT 1)v ON true)
      SELECT * FROM retained WHERE data IS NOT NULL AND ($2::text IS NULL OR provider=$2) AND ($3::text IS NULL OR publication_id>$3)
      AND ($4::text IS NULL OR publication_id=$4) ORDER BY publication_id LIMIT $5`,[f.asKnownAt??null,f.provider??null,f.after??null,id,f.limit+1])
    const page=rows.slice(0,f.limit)
    return {items:page.map(r=>({...r.data,knownAt:r.observed_at,observation:{receiptRef:r.receipt_ref,sourceRetrievedAt:r.source_retrieved_at}})),order:'CANONICAL_PUBLICATION_ID',nextAfter:rows.length>f.limit?page.at(-1).publication_id:null,coverage:await coverage(transaction,f.asKnownAt)}
  }
  async function publicationDetail(transaction,id,asKnownAt){const r=await listPublications(transaction,{...(asKnownAt?{asKnownAt}:{}),limit:1},publicationId(id));if(!r.items.length)throw new CalendarError('PUBLICATION_NOT_AVAILABLE',404);return {publication:r.items[0],coverage:r.coverage}}
  async function publicationRevisions(transaction,id,{after=0,limit=100}={}){
    await publicationDetail(transaction,id)
    if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>500)throw new CalendarError('INVALID_HISTORY_PAGE')
    const {rows}=await transaction.query('SELECT sequence,data,observed_at,source_retrieved_at,receipt_ref,adopted_as_current,change_kind FROM economic_calendar.publication_observations WHERE publication_id=$1 AND sequence>$2 ORDER BY sequence LIMIT $3',[id,after,limit+1])
    const page=rows.slice(0,limit);return {items:page.map(r=>({sequence:Number(r.sequence),publication:r.data,observedAt:r.observed_at,sourceRetrievedAt:r.source_retrieved_at,receiptRef:r.receipt_ref,adoptedAsCurrent:r.adopted_as_current,changeKind:r.change_kind})),nextAfter:rows.length>limit?Number(page.at(-1).sequence):null,historyMeaning:'OBSERVED_BY_ECR_ONLY'}
  }
  async function getPreferences(transaction, context) {
    const {rows: [r]} = await transaction.query('SELECT revision,data,created_at,updated_at FROM economic_calendar.preferences WHERE user_id=$1::uuid', [actor(context)])
    return {version: r ? Number(r.revision) : 0, preferences: r?.data ?? emptyPreferences(), createdAt: r?.created_at ?? null, updatedAt: r?.updated_at ?? null}
  }
  async function lockPreferences(transaction, context) {
    const user = actor(context)
    await transaction.query('INSERT INTO economic_calendar.preferences(user_id,data,last_write_organisation_id) VALUES($1::uuid,$2::jsonb,$3::uuid) ON CONFLICT(user_id) DO NOTHING', [user, JSON.stringify(emptyPreferences()), context.organisationId])
    const {rows: [r]} = await transaction.query('SELECT revision FROM economic_calendar.preferences WHERE user_id=$1::uuid FOR UPDATE', [user])
    if (!r) throw new CalendarError('PREFERENCE_SCOPE_REFUSED', 403)
    return {user, version: Number(r.revision)}
  }
  async function putPreferences(transaction, context, expectedVersion, input) {
    const data = preferences(input)
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new CalendarError('EXPECTED_VERSION_REQUIRED')
    const current = await lockPreferences(transaction, context)
    if (current.version !== expectedVersion) throw new CalendarError('PREFERENCE_VERSION_CONFLICT', 409)
    await transaction.query('UPDATE economic_calendar.preferences SET data=$2::jsonb,revision=revision+1,updated_at=clock_timestamp(),last_write_organisation_id=$3::uuid WHERE user_id=$1::uuid', [current.user, JSON.stringify(data), context.organisationId])
    return getPreferences(transaction, context)
  }
  /** @param {any} transaction @param {any} context @param {{after?:string,limit?:number}} page */
  async function favourites(transaction, context, {after, limit = 100} = {}) {
    if (after !== undefined) eventId(after)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new CalendarError('INVALID_PAGE_SIZE')
    const {rows} = await transaction.query('SELECT event_id,created_at FROM economic_calendar.favourites WHERE user_id=$1::uuid AND ($2::text IS NULL OR event_id>$2) ORDER BY event_id LIMIT $3', [actor(context), after ?? null, limit + 1])
    const page = rows.slice(0, limit)
    return {items: page.map(r => ({eventId: r.event_id, savedAt: r.created_at, eventAvailability: 'REQUIRES_CURRENT_EVENT_READ'})), nextAfter: rows.length > limit ? page.at(-1).event_id : null, eventContentIncluded: false}
  }
  /** @param {any} transaction @param {any} context @param {string} id @param {boolean} saved @param {number|undefined} expectedVersion */
  async function setFavourite(transaction, context, id, saved, expectedVersion = undefined) {
    eventId(id)
    if(expectedVersion!==undefined&&(!Number.isSafeInteger(expectedVersion)||expectedVersion<0))throw new CalendarError('EXPECTED_VERSION_REQUIRED')
    const current = await lockPreferences(transaction, context)
    if(expectedVersion!==undefined&&expectedVersion!==current.version)throw new CalendarError('PREFERENCE_VERSION_CONFLICT',409)
    const result = saved
      ? await transaction.query('INSERT INTO economic_calendar.favourites(user_id,event_id) VALUES($1::uuid,$2) ON CONFLICT DO NOTHING', [current.user, id])
      : await transaction.query('DELETE FROM economic_calendar.favourites WHERE user_id=$1::uuid AND event_id=$2', [current.user, id])
    if (result.rowCount) await transaction.query('UPDATE economic_calendar.preferences SET revision=revision+1,updated_at=clock_timestamp(),last_write_organisation_id=$2::uuid WHERE user_id=$1::uuid', [current.user, context.organisationId])
    return {eventId: id, saved, changed: Boolean(result.rowCount), version: current.version + (result.rowCount ? 1 : 0), eventAvailability: 'REQUIRES_CURRENT_EVENT_READ'}
  }
  return Object.freeze({ready, assertInstalled, listEvents, detail, revisions, listPublications,publicationDetail,publicationRevisions,getPreferences, putPreferences, favourites, setFavourite})
}

async function persistPublication(query,o,receipt){
  await query("SELECT pg_advisory_xact_lock(hashtextextended('ecr-publication:'||$1,0))",[o.publicationId])
  const {rows:[clock]}=await query('SELECT clock_timestamp() AS observed_at'),at=clock.observed_at
  const {rows:[current]}=await query('SELECT * FROM economic_calendar.publications WHERE publication_id=$1 FOR UPDATE',[o.publicationId])
  if(current?.current_fingerprint===o.fingerprint){
    await query('UPDATE economic_calendar.publications SET last_observed_at=greatest(last_observed_at,$2),last_receipt_ref=CASE WHEN $4::timestamptz>=last_source_retrieved_at THEN $3::uuid ELSE last_receipt_ref END,last_source_retrieved_at=greatest(last_source_retrieved_at,$4::timestamptz) WHERE publication_id=$1',[o.publicationId,at,receipt,o.sourceRetrievedAt]);return 'unchanged'
  }
  const stale=Boolean(current&&new Date(current.last_source_retrieved_at).toISOString()>o.sourceRetrievedAt)
  const {rows:[n]}=await query('SELECT coalesce(max(sequence),0)+1 AS sequence FROM economic_calendar.publication_observations WHERE publication_id=$1',[o.publicationId]),sequence=Number(n.sequence)
  if(!current)await query('INSERT INTO economic_calendar.publications(publication_id,provider,publication_ref,current_fingerprint,current_data,current_sequence,first_observed_at,current_observed_at,last_observed_at,current_receipt_ref,current_source_retrieved_at,last_receipt_ref,last_source_retrieved_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$7,$7,$8::uuid,$9::timestamptz,$8::uuid,$9::timestamptz)',[o.publicationId,o.data.source.provider,o.data.source.publicationRef,o.fingerprint,JSON.stringify(o.data),sequence,at,receipt,o.sourceRetrievedAt])
  else if(!stale)await query('UPDATE economic_calendar.publications SET current_fingerprint=$2,current_data=$3::jsonb,current_sequence=$4,current_observed_at=$5,last_observed_at=greatest(last_observed_at,$5),current_receipt_ref=$6::uuid,current_source_retrieved_at=$7::timestamptz,last_receipt_ref=$6::uuid,last_source_retrieved_at=$7::timestamptz WHERE publication_id=$1',[o.publicationId,o.fingerprint,JSON.stringify(o.data),sequence,at,receipt,o.sourceRetrievedAt])
  await query('INSERT INTO economic_calendar.publication_observations(publication_id,sequence,fingerprint,data,observed_at,source_retrieved_at,receipt_ref,adopted_as_current,change_kind) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7::uuid,$8,$9)',[o.publicationId,sequence,o.fingerprint,JSON.stringify(o.data),at,o.sourceRetrievedAt,receipt,!stale,stale?'STALE_SOURCE_OBSERVATION':current?'DEFINITION_OR_SCHEDULE_CHANGED':'FIRST_OBSERVED'])
  return stale?'stale':current?'changed':'created'
}
/** Separate ordinary ingestion login. It has no private-preference privileges.
 * SourceHub has already admitted the genuine component/actor and storage basis.
 * This function is never installed as an unauthenticated HTTP sync endpoint.
 */
export async function persistAcquisition(database, command, response, {intentDigest = fingerprint({receipt:response.usage.receiptRef})} = {}) {
  if(!/^[a-f0-9]{64}$/.test(intentDigest))throw new CalendarError('INVALID_SYNC_INTENT')
  command=structuredClone(command);response=structuredClone(response)
  const scheduleMode=command.contractVersion==='1.3.0'
  if(scheduleMode)assertHubResponse(response,command)
  const normalized=scheduleMode?response.items.map(publicationScheduleObservation):[]
  const publications=new Map()
  for(const {publication:p} of normalized){const previous=publications.get(p.publicationId);if(previous&&previous.fingerprint!==p.fingerprint)throw new CalendarError('CONFLICTING_PUBLICATION_DUPLICATE',502);publications.set(p.publicationId,p)}
  const observations = scheduleMode?normalized.flatMap(o=>o.event?[o.event]:[]):response.items.map(calendarObservation)
  const receipt = response.usage.receiptRef, requestDigest = fingerprint(command)
  const contentDigest = fingerprint(scheduleMode?[...observations.map(o=>({id:o.eventId,data:o.fingerprint})),...[...publications.values()].map(o=>({id:o.publicationId,data:o.fingerprint}))].sort((a,b)=>a.id.localeCompare(b.id)):observations.map(o => ({id: o.eventId, data: o.fingerprint})))
  const deduplicated = new Map()
  for (const o of observations) {
    const other = deduplicated.get(o.eventId)
    if (other && other.fingerprint !== o.fingerprint) throw new CalendarError('CONFLICTING_SOURCE_DUPLICATE', 502)
    deduplicated.set(o.eventId, o)
  }
  return database.transact(async ({query}) => {
    await query("SELECT pg_advisory_xact_lock(hashtextextended('ecr-intent:'||$1,0))", [intentDigest])
    await query("SELECT pg_advisory_xact_lock(hashtextextended('ecr-receipt:'||$1,0))", [receipt])
    if(scheduleMode){
      await query("SELECT pg_advisory_xact_lock_shared(hashtextextended('ecr-storage-policy:'||$1,0))",[command.provider])
      const {rows:[policy]}=await query("SELECT * FROM economic_calendar.storage_policies WHERE provider_id=$1 AND status='ACTIVE'",[command.provider])
      if(!policy||policy.licence_ref!==response.provenance.licenceRef||[...publications.values()].some(o=>o.data.source.storageBasisRef!==policy.basis_ref))throw new CalendarError('ECR_STORAGE_POLICY_NOT_ADMITTED',403)
    }
    const {rows: [previousRun]} = await query('SELECT request_digest,content_digest,intent_digest,result FROM economic_calendar.sync_runs WHERE receipt_ref=$1::uuid OR intent_digest=$2', [receipt,intentDigest])
    if (previousRun) {
      if (previousRun.intent_digest !== intentDigest || previousRun.request_digest !== requestDigest || previousRun.content_digest !== contentDigest) throw new CalendarError('ACQUISITION_RECEIPT_CONFLICT', 409)
      return {...previousRun.result, replay: true}
    }
    const {rows: [clock]} = await query('SELECT clock_timestamp() AS observed_at')
    const startedAt = clock.observed_at
    const result = {received: response.items.length, distinctEvents: deduplicated.size, duplicates: observations.length - deduplicated.size, created: 0, changed: 0, unchanged: 0, stale: 0, receiptRef: receipt, observedAt: startedAt, replay: false,
      ...(scheduleMode?{publications:publications.size,publicationCreated:0,publicationChanged:0,publicationUnchanged:0,publicationStale:0}: {})}
    for(const p of [...publications.values()].sort((a,b)=>a.publicationId.localeCompare(b.publicationId))){const outcome=await persistPublication(query,p,receipt);result['publication'+outcome[0].toUpperCase()+outcome.slice(1)]++}
    // Stable lock ordering makes overlapping multi-event synchronizations safe.
    for (const o of [...deduplicated.values()].sort((a, b) => a.eventId.localeCompare(b.eventId))) {
      await query("SELECT pg_advisory_xact_lock(hashtextextended('ecr-event:'||$1,0))", [o.eventId])
      const {rows: [serializedClock]} = await query('SELECT clock_timestamp() AS observed_at')
      const observedAt = serializedClock.observed_at
      const {rows: [current]} = await query('SELECT * FROM economic_calendar.events WHERE event_id=$1 FOR UPDATE', [o.eventId])
      if (current && (current.provider !== o.data.source.provider || current.vendor_event_id !== o.data.source.vendorEventId)) throw new CalendarError('SOURCE_IDENTITY_CONFLICT', 409)
      if (current?.current_fingerprint === o.fingerprint) {
        await query('UPDATE economic_calendar.events SET last_observed_at=greatest(last_observed_at,$2::timestamptz),last_receipt_ref=CASE WHEN $4::timestamptz>=last_source_retrieved_at THEN $3::uuid ELSE last_receipt_ref END,last_source_retrieved_at=greatest(last_source_retrieved_at,$4::timestamptz) WHERE event_id=$1', [o.eventId, observedAt,receipt,o.sourceRetrievedAt]); result.unchanged++; continue
      }
      const {rows: [number]} = await query('SELECT coalesce(max(sequence),0)+1 AS sequence FROM economic_calendar.observations WHERE event_id=$1', [o.eventId])
      const sequence = Number(number.sequence)
      const oldUpdated = current?.current_data?.providerUpdatedAt, newUpdated = o.data.providerUpdatedAt
      const stale = Boolean(oldUpdated && newUpdated && newUpdated < oldUpdated || scheduleMode&&current&&new Date(current.last_source_retrieved_at).toISOString()>o.sourceRetrievedAt)
      const kinds = stale ? ['STALE_SOURCE_OBSERVATION'] : changeKinds(current?.current_data ?? null, o.data)
      if (!current) {
        await query('INSERT INTO economic_calendar.events(event_id,provider,vendor_event_id,current_fingerprint,current_data,current_sequence,first_observed_at,current_observed_at,last_observed_at,current_receipt_ref,current_source_retrieved_at,last_receipt_ref,last_source_retrieved_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$7,$7,$8::uuid,$9::timestamptz,$8::uuid,$9::timestamptz)', [o.eventId, o.data.source.provider, o.data.source.vendorEventId, o.fingerprint, JSON.stringify(o.data), sequence, observedAt,receipt,o.sourceRetrievedAt]); result.created++
      } else if (!stale) {
        await query('UPDATE economic_calendar.events SET current_fingerprint=$2,current_data=$3::jsonb,current_sequence=$4,current_observed_at=$5,last_observed_at=greatest(last_observed_at,$5::timestamptz),current_receipt_ref=$6::uuid,current_source_retrieved_at=$7::timestamptz,last_receipt_ref=$6::uuid,last_source_retrieved_at=$7::timestamptz WHERE event_id=$1', [o.eventId, o.fingerprint, JSON.stringify(o.data), sequence, observedAt,receipt,o.sourceRetrievedAt]); result.changed++
      } else {result.stale++}
      if(o.data.publicationId)await query('UPDATE economic_calendar.events SET publication_id=$2 WHERE event_id=$1',[o.eventId,o.data.publicationId])
      await query('INSERT INTO economic_calendar.observations(event_id,sequence,fingerprint,data,observed_at,source_retrieved_at,receipt_ref,adopted_as_current,change_kinds) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7::uuid,$8,$9::text[])', [o.eventId, sequence, o.fingerprint, JSON.stringify(o.data), observedAt, o.sourceRetrievedAt, receipt, !stale, kinds])
    }
    const {rows: [completedClock]} = await query('SELECT clock_timestamp() AS observed_at')
    const observedAt = completedClock.observed_at; result.observedAt = observedAt
    const coverage = {provider: response.coverage ?? {completeness: 'UNKNOWN'}, page: response.page, status: response.status, historyMeaning: 'OBSERVED_BY_ECR_ONLY'}
    await query('INSERT INTO economic_calendar.sync_runs(receipt_ref,request_digest,content_digest,observed_at,source_retrieved_at,coverage,result,intent_digest,provider_id,source_licence_ref) VALUES($1::uuid,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10)', [receipt, requestDigest, contentDigest, observedAt, instant(response.provenance.retrievedAt), JSON.stringify(coverage), JSON.stringify(result),intentDigest,command.provider,response.provenance.licenceRef])
    return result
  }, {timeoutMs: 30000, maxWaitMs: 5000})
}
