import {createHash} from 'node:crypto'

export const ECR_CONTRACT = Object.freeze({id: 'profitia.economic-calendar', version: '1.1.0'})
export const ECR_APPLICATION = 'profitia-economic-calendar-runtime-development'
export const ECR_EVENT_RESOURCE = 'economic-calendar-events'
export const ECR_PREFERENCE_RESOURCE = 'economic-calendar-preferences'
const eventPattern = /^ecr_evt_[a-f0-9]{64}$/
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export class CalendarError extends Error {
  constructor(code, status = 400) {super(code); this.name = 'CalendarError'; this.code = code; this.status = status}
}
const refuse = (code = 'INVALID_INPUT') => {throw new CalendarError(code)}
export function closedObject(value, keys) {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).every(k => keys.includes(k))
}
export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && Object.getPrototypeOf(value) === Object.prototype) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
  return refuse('INVALID_VALUE')
}
export const fingerprint = value => createHash('sha256').update(canonical(value)).digest('hex')
export function eventId(value) {if (typeof value !== 'string' || !eventPattern.test(value)) refuse('INVALID_EVENT_ID'); return value}
export function organisationId(value) {if (typeof value !== 'string' || !uuidPattern.test(value)) refuse('ORGANISATION_SELECTION_REQUIRED'); return value}
export function canonicalEventId(provider, vendorId) {
  if (provider !== 'trading-economics' || typeof vendorId !== 'string' || !vendorId.length || vendorId.length > 256) refuse('INVALID_SOURCE_IDENTITY')
  return 'ecr_evt_' + fingerprint({provider, vendorId})
}
function text(value, length = 256) {
  if (typeof value !== 'string' || !value.length || value.length > length || /[\u0000-\u001f\u007f]/.test(value)) refuse()
  return value
}
function selection(value, max = Infinity) {
  if (!Array.isArray(value) || value.length > max) refuse()
  const values = value.map(v => text(v))
  if (new Set(values).size !== values.length) refuse('DUPLICATE_SELECTION')
  return values
}
export function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) refuse('INVALID_UTC_INSTANT')
  const normalized = new Date(value).toISOString()
  if (normalized.slice(0, 19) !== value.slice(0, 19)) refuse('INVALID_UTC_INSTANT')
  return normalized
}
export function calendarFilter(value = {}) {
  if (!closedObject(value, ['from', 'to', 'countries', 'indicators', 'importance', 'eventText', 'eventIds', 'asKnownAt', 'limit', 'after'])) refuse('UNSUPPORTED_FILTER')
  const out = {}
  for (const k of ['from', 'to', 'asKnownAt']) if (value[k] !== undefined) out[k] = instant(value[k])
  if (out.from && out.to && out.from > out.to) refuse('INVALID_DATE_INTERVAL')
  for (const k of ['countries', 'indicators']) if (value[k] !== undefined) out[k] = selection(value[k])
  if (value.eventIds !== undefined) {out.eventIds = selection(value.eventIds, 500).map(eventId)}
  if (value.importance !== undefined) {
    if (!Array.isArray(value.importance) || value.importance.some(v => ![1, 2, 3].includes(v)) || new Set(value.importance).size !== value.importance.length) refuse()
    out.importance = [...value.importance]
  }
  if (value.eventText !== undefined) out.eventText = text(value.eventText)
  out.limit = value.limit ?? 100
  if (!Number.isSafeInteger(out.limit) || out.limit < 1 || out.limit > 500) refuse('INVALID_PAGE_SIZE')
  if (value.after !== undefined) out.after = eventId(value.after)
  return out
}
export function preferences(value) {
  if (!closedObject(value, ['watchedCountries', 'watchedIndicators', 'watchedTopics', 'savedFilters', 'display'])) refuse('UNSUPPORTED_PREFERENCE')
  const out = {watchedCountries: selection(value.watchedCountries ?? []), watchedIndicators: selection(value.watchedIndicators ?? []), watchedTopics: [], savedFilters: [], display: {}}
  if (!Array.isArray(value.watchedTopics ?? [])) refuse()
  out.watchedTopics = (value.watchedTopics ?? []).map(topic => {
    if (!closedObject(topic, ['kind', 'text']) || topic.kind !== 'LOCAL_EVENT_TEXT_CONTAINS') refuse('UNSUPPORTED_TOPIC')
    return {kind: topic.kind, text: text(topic.text)}
  })
  if (!Array.isArray(value.savedFilters ?? [])) refuse()
  const names = new Set()
  out.savedFilters = (value.savedFilters ?? []).map(saved => {
    if (!closedObject(saved, ['name', 'filter'])) refuse()
    const name = text(saved.name, 120)
    if (names.has(name)) refuse('DUPLICATE_SAVED_FILTER'); names.add(name)
    const filter = calendarFilter(saved.filter)
    if (filter.after !== undefined || filter.asKnownAt !== undefined) refuse('UNSUPPORTED_SAVED_FILTER')
    return {name, filter}
  })
  const display = value.display ?? {}
  if (!closedObject(display, ['timeZone', 'view'])) refuse('UNSUPPORTED_DISPLAY_PREFERENCE')
  if (display.timeZone !== undefined) {
    try {new Intl.DateTimeFormat('en', {timeZone: text(display.timeZone, 100)}).format()} catch {refuse('INVALID_TIME_ZONE')}
    out.display.timeZone = display.timeZone
  }
  if (display.view !== undefined) {if (!['list', 'week', 'month'].includes(display.view)) refuse(); out.display.view = display.view}
  if (Buffer.byteLength(canonical(out)) > 65536) refuse('PREFERENCES_TOO_LARGE')
  return out
}
const nullableText = value => value === null || typeof value === 'string' && value.length <= 16384
const scalar = value => value === null || typeof value === 'string' && value.length <= 16384 || typeof value === 'number' && Number.isFinite(value)
/** Only the accepted SourceHub economic-calendar payload, never raw provider
 * transport. Observation time belongs to ECR; provider update is not publication.
 */
export function calendarObservation(item) {
  const p = item?.payload, m = item?.metadata
  if (!p || !m || m.providerId !== 'trading-economics' || m.apiFamily !== 'economic-calendar' || m.contractFamily !== 'economic-calendar' || m.contractVersion !== '1.0.0'
    || p.eventId !== m.vendorRecordId || !uuidPattern.test(m.usageReceiptRef ?? '') || !/^[a-f0-9]{64}$/.test(m.contentFingerprint ?? '')
    || typeof m.sourceRecordRef !== 'string' || !m.sourceRecordRef.length || m.sourceRecordRef.length > 512
    || typeof m.licenceRef !== 'string' || !m.licenceRef.length || m.licenceRef.length>256 || m.licenceRef === 'PENDING_ADMISSION') refuse('INVALID_SOURCE_OBSERVATION')
  const id = canonicalEventId(m.providerId, p.eventId)
  for (const key of ['actual', 'previous', 'revised', 'consensusForecast', 'vendorForecast']) if (!scalar(p[key])) refuse('INVALID_SOURCE_OBSERVATION')
  for (const key of ['country', 'indicator', 'event', 'referencePeriod', 'unit', 'currency', 'source', 'sourceUrl']) if (!nullableText(p[key])) refuse('INVALID_SOURCE_OBSERVATION')
  if (![null, 0, 1].includes(p.dateSpan) || ![null, 1, 2, 3].includes(p.importance)) refuse('INVALID_SOURCE_OBSERVATION')
  if(p.sourceUrl!==null){try{const u=new URL(p.sourceUrl);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||p.sourceUrl.length>4096)refuse('INVALID_SOURCE_OBSERVATION')}catch{refuse('INVALID_SOURCE_OBSERVATION')}}
  const rights = m.consumerStorage
  if (!closedObject(rights, ['mode', 'basisRef', 'licenceVersion']) || rights.mode !== 'DURABLE_OWNER_ENTITLEMENT'
    || typeof rights.basisRef !== 'string' || !rights.basisRef.length || rights.basisRef.length > 256
    || typeof rights.licenceVersion !== 'string' || !/^[1-9][0-9]*$/.test(rights.licenceVersion)) throw new CalendarError('DURABLE_STORAGE_NOT_ADMITTED', 403)
  const source = {provider: 'trading-economics', vendorEventId: p.eventId, sourceRecordRef: m.sourceRecordRef, licenceRef: m.licenceRef, storageBasisRef: rights.basisRef, licenceVersion: String(rights.licenceVersion)}
  const native = p.native && Object.getPrototypeOf(p.native) === Object.prototype ? p.native : {}
  if (![native.Reference ?? null, native.ReferenceDate ?? null].every(nullableText)) refuse('INVALID_SOURCE_OBSERVATION')
  const data = {
    eventId: id, source, eventAt: p.eventAt === null ? null : instant(p.eventAt), eventTimeZone: p.eventAt === null ? null : 'UTC', dateSpan: p.dateSpan,
    country: p.country, indicator: p.indicator, title: p.event, importance: p.importance,
    values: {actual: p.actual, previousAfterRevision: p.previous, previousBeforeRevision: p.revised, consensusForecast: p.consensusForecast, vendorForecast: p.vendorForecast},
    reference: {providerValue: p.referencePeriod, label: native.Reference ?? null, date: native.ReferenceDate ?? null}, unit: p.unit, currency: p.currency,
    providerUpdatedAt: p.lastUpdate === null ? null : instant(p.lastUpdate), publishedAt: null, sourceName: p.source, sourceUrl: p.sourceUrl,
    historyMeaning: 'OBSERVED_BY_ECR_ONLY'
  }
  return {eventId: id, fingerprint: fingerprint({...data, source: {provider: source.provider, vendorEventId: source.vendorEventId}}), data, sourceRetrievedAt: instant(m.retrievedAt), providerFingerprint: m.contentFingerprint, receiptRef: m.usageReceiptRef}
}
export function changeKinds(previous, next) {
  if (!previous) return ['FIRST_OBSERVED']
  const kinds = []
  const timing=v=>['scheduledAt','scheduledUntil','dateOnly','localDateTime','timeZone','timePrecision'].map(k=>v.schedule?.[k]??null)
  if (previous.eventAt !== next.eventAt || previous.dateSpan !== next.dateSpan || canonical(timing(previous))!==canonical(timing(next))) kinds.push('SCHEDULE_CHANGED')
  if (canonical(previous.values.actual) !== canonical(next.values.actual)) kinds.push('ACTUAL_CHANGED')
  if (canonical([previous.values.previousAfterRevision, previous.values.previousBeforeRevision]) !== canonical([next.values.previousAfterRevision, next.values.previousBeforeRevision])) kinds.push('PREVIOUS_REVISED')
  if (canonical([previous.values.consensusForecast, previous.values.vendorForecast]) !== canonical([next.values.consensusForecast, next.values.vendorForecast])) kinds.push('FORECAST_CHANGED')
  if (!kinds.length && fingerprint(previous) !== fingerprint(next)) kinds.push('SOURCE_METADATA_CHANGED')
  return kinds
}
export function publicationId(value){if(typeof value!=='string'||!/^ecr_pub_[a-f0-9]{64}$/.test(value))refuse('INVALID_PUBLICATION_ID');return value}
export function publicationFilter(value={}){
 if(!closedObject(value,['provider','after','limit','asKnownAt']))refuse('UNSUPPORTED_FILTER')
 const out=/** @type {any} */({limit:value.limit??100})
 if(!Number.isSafeInteger(out.limit)||out.limit<1||out.limit>500)refuse('INVALID_PAGE_SIZE')
 if(value.provider!==undefined){if(!['eia','commodities-sh'].includes(value.provider))refuse('UNSUPPORTED_PROVIDER');out.provider=value.provider}
 if(value.after!==undefined)out.after=publicationId(value.after)
 if(value.asKnownAt!==undefined)out.asKnownAt=instant(value.asKnownAt)
 return out
}
/** Publication references are provider-local definitions, never cross-provider
 * event identities. A moving aggregator next date cannot identify a release.
 */
export function publicationScheduleObservation(item){
 const p=item?.payload,m=item?.metadata,r=m?.consumerStorage
 if(!closedObject(p,['kind','scheduleId','title','publicationRef','correlationKey','identityStatus','scheduledAt','scheduledUntil','dateOnly','localDateTime','timeZone','timePrecision','recurrence','referencePeriod','releaseStatus','scheduleStatus','sourceName','sourceUrl','officialSource','sourceUpdatedAt','lastVerifiedAt','standardSchedule','exception','sourceTiming','qualityFlags','actual','previous','forecast','publishedAt'])||!m||m.contractVersion!=='1.3.0'||m.contractFamily!=='publication-calendar'||m.apiFamily!=='publication-calendar'
  ||!['eia','commodities-sh'].includes(m.providerId)||p.kind!=='PUBLICATION_SCHEDULE'||p.releaseStatus!=='PROVIDER_SCHEDULE_ONLY'
  ||typeof p.publicationRef!=='string'||!p.publicationRef.length||p.publicationRef.length>256||typeof p.title!=='string'||!p.title.length
  ||!uuidPattern.test(m.usageReceiptRef??'')||!/^[a-f0-9]{64}$/.test(m.contentFingerprint??'')||!nullableText(p.referencePeriod)
  ||!['actual','previous','forecast','publishedAt','sourceUpdatedAt'].every(k=>p[k]===null))refuse('INVALID_SOURCE_OBSERVATION')
 if(!closedObject(r,['mode','basisRef','licenceVersion','rightsVersion','consumerApplicationId','retentionMode','redistribution'])
  ||r.mode!=='DURABLE_OWNER_ENTITLEMENT'||r.consumerApplicationId!==ECR_APPLICATION||r.retentionMode!=='DURABLE_NO_FIXED_EXPIRY'||r.redistribution!=='PRIVATE_AUTHORISED_CONSUMER_ONLY'
  ||typeof r.basisRef!=='string'||!r.basisRef.length||r.basisRef.length>256||!['licenceVersion','rightsVersion'].every(k=>typeof r[k]==='string'&&/^[1-9][0-9]*$/.test(r[k])))throw new CalendarError('DURABLE_STORAGE_NOT_ADMITTED',403)
 text(m.licenceRef);text(m.sourceRecordRef,512)
 const id='ecr_pub_'+fingerprint({provider:m.providerId,publicationRef:p.publicationRef})
 const source={provider:m.providerId,family:'publication-calendar',publicationRef:p.publicationRef,sourceRecordRef:m.sourceRecordRef,licenceRef:m.licenceRef,storageBasisRef:r.basisRef,licenceVersion:r.licenceVersion,rightsVersion:r.rightsVersion,consumerApplicationId:r.consumerApplicationId,retentionMode:r.retentionMode,redistribution:r.redistribution}
 const concrete=m.providerId==='eia'&&typeof p.referencePeriod==='string'&&/^(\d{4}-\d\d|\d{4}-\d\d-\d\d)$/.test(p.referencePeriod)
 const definition={publicationId:id,source,title:p.title,recurrence:p.recurrence,timeZone:p.timeZone,sourceName:p.sourceName,sourceUrl:p.sourceUrl,
  entityLevel:'PUBLICATION_DEFINITION',releaseIdentityStatus:concrete?'REFERENCE_PERIOD_IDENTIFIES_EIA_RELEASE':'UNRESOLVED_NEXT_RELEASE',unresolvedNextSchedule:concrete?null:structuredClone(p),historyMeaning:'OBSERVED_BY_ECR_ONLY'}
 const publication={publicationId:id,data:definition,fingerprint:fingerprint({...definition,source:{provider:m.providerId,publicationRef:p.publicationRef}}),sourceRetrievedAt:instant(m.retrievedAt),receiptRef:m.usageReceiptRef}
 if(!concrete)return {publication,event:null}
 const vendorEventId=p.publicationRef+':'+p.referencePeriod,eventId='ecr_evt_'+fingerprint({provider:m.providerId,vendorId:vendorEventId})
 const data={eventId,publicationId:id,entityLevel:'EVENT_RELEASE',source:{...source,vendorEventId},eventAt:p.scheduledAt===null?null:instant(p.scheduledAt),eventTimeZone:p.timeZone,dateSpan:null,
  country:null,indicator:null,title:p.title,importance:null,values:{actual:null,previousAfterRevision:null,previousBeforeRevision:null,consensusForecast:null,vendorForecast:null,measurements:[]},
  reference:{providerValue:p.referencePeriod,label:p.referencePeriod,date:null},unit:null,currency:null,providerUpdatedAt:null,publishedAt:null,sourceName:p.sourceName,sourceUrl:p.sourceUrl,
  schedule:structuredClone(p),historyMeaning:'OBSERVED_BY_ECR_ONLY',releaseIdentityStatus:'EIA_PUBLICATION_REFERENCE_PERIOD'}
 return {publication,event:{eventId,fingerprint:fingerprint({...data,source:{provider:m.providerId,vendorEventId}}),data,sourceRetrievedAt:instant(m.retrievedAt),providerFingerprint:m.contentFingerprint,receiptRef:m.usageReceiptRef}}
}
