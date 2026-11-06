// Report-side arithmetic only. No transport, provider credentials or Forecast fit.
import {createHash} from 'node:crypto';
import {assertCommodityResponse} from '../../../../packages/platform-source-hub-contracts/commodities-v1.mjs';

const fail = code => { throw Object.assign(new Error(code), {code}); };
const requireThat = (ok, code) => { if (!ok) fail(code); };
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const day = value => {
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'EXACT_DATE_REQUIRED');
  const d = new Date(value + 'T00:00:00Z');
  requireThat(Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value, 'INVALID_DATE');
  return d.getTime();
};
const number = value => {
  requireThat(typeof value === 'number' && Number.isFinite(value) || typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value), 'MISSING_NUMERIC_OBSERVATION');
  const n = Number(value); requireThat(Number.isFinite(n), 'INVALID_NUMBER'); return n;
};
const contracts = value => { const n = number(value); requireThat(Number.isSafeInteger(n) && n >= 0, 'INVALID_CONTRACT_COUNT'); return n; };
const recordBefore = (item, asOf) => {
  const a = Date.parse(asOf), m = item.metadata;
  requireThat(Number.isFinite(a) && Number.isFinite(Date.parse(m.retrievedAt)) && Date.parse(m.retrievedAt) <= a, 'RETRIEVAL_AFTER_AS_OF');
  requireThat(m.availableAt === null || Number.isFinite(Date.parse(m.availableAt)) && Date.parse(m.availableAt) <= a, 'AVAILABILITY_AFTER_AS_OF');
  return {sourceRecordRef:m.sourceRecordRef, contentFingerprint:m.contentFingerprint, receiptRef:m.usageReceiptRef,
    licenceRef:m.licenceRef, sourceUrl:m.sourceUrl, retrievedAt:m.retrievedAt, availableAt:m.availableAt,
    providerPublicationAt:'UNKNOWN'};
};
const localDate = value => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Warsaw', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(value));

/** Validate the real Hub envelope before interpreting any values. */
export function checkedHubResponse(response, command, asOf) {
  assertCommodityResponse(response, command);
  requireThat(Date.parse(response.provenance.retrievedAt) <= Date.parse(asOf), 'ENVELOPE_AFTER_AS_OF');
  response.items.forEach(item => recordBefore(item, asOf));
  return response;
}

/** The selected series and unit are resolved from admitted metadata/observations,
 * never from a business inventory ID or a guessed API selector. */
export function eiaWeeklyPair(items, {datasetId, dimensions, unit, asOf, field='value'}) {
  requireThat(datasetId && dimensions && Object.keys(dimensions).length && typeof unit === 'string' && unit.length, 'EXACT_SERIES_SELECTION_REQUIRED');
  const rows = new Map(); let discarded=0, deduplicated=0;
  for (const item of items) {
    const p = item.payload;
    if (item.metadata.providerId !== 'eia' || p.datasetId !== datasetId || p.frequency !== 'weekly'
      || Object.entries(dimensions).some(([key,value]) => p.dimensions[key] !== value)) { discarded++; continue; }
    const lineage = recordBefore(item, asOf), measure = p.measures.find(m => m.field === field);
    requireThat(measure?.unit === unit, 'NONCOMPARABLE_UNITS');
    const timestamp = day(p.referencePeriod), value = number(measure.value);
    requireThat(p.referencePeriod <= localDate(asOf), 'OBSERVATION_AFTER_AS_OF');
    if (p.publishedAt !== null) requireThat(Date.parse(p.publishedAt) <= Date.parse(asOf), 'PUBLICATION_AFTER_AS_OF');
    const old = rows.get(timestamp);
    const identity = digest({datasetId, dimensions:p.dimensions, field, unit, value});
    if (old) { requireThat(old.identity === identity, 'CONFLICTING_REVISION'); deduplicated++; continue; }
    rows.set(timestamp, {period:p.referencePeriod, value, unit, dimensions:p.dimensions, identity, lineage,
      publicationAt:p.publishedAt ?? 'UNKNOWN', revisionStatus:p.revisionStatus});
  }
  const ordered = [...rows].sort((a,b) => b[0]-a[0]).map(r => r[1]);
  requireThat(ordered.length, 'NO_SELECTED_OBSERVATIONS');
  const [latest, previous] = ordered;
  const comparable = !!previous && day(latest.period)-day(previous.period) === 7*86400000
    && digest(latest.dimensions) === digest(previous.dimensions);
  return {kind:'EIA_WEEKLY_OBSERVATION', datasetId, latest, previous:previous ?? null,
    change:comparable ? latest.value-previous.value : 'UNKNOWN', changeUnit:unit,
    changeReason:comparable ? 'IDENTICAL_SERIES_CONSECUTIVE_WEEK' : 'NO_COMPARABLE_CONSECUTIVE_WEEK',
    records:{received:items.length, selectedUnique:rows.size, discarded, deduplicated}};
}

/** Disaggregated futures-only Managed Money and Open Interest, never physical demand. */
export function cftcWtiPair(items, {asOf, contractCode, contractName, datasetId='72hh-3qpy'}) {
  requireThat(datasetId === '72hh-3qpy' && typeof contractCode === 'string' && contractCode.length && contractName === 'WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE', 'EXACT_WTI_FUTURES_ONLY_SELECTION_REQUIRED');
  const rows = new Map(); let discarded=0, deduplicated=0;
  for (const item of items) {
    const p = item.payload;
    if (item.metadata.providerId !== 'cftc' || p.datasetId !== datasetId || p.contractCode !== contractCode || p.contractName !== contractName) { discarded++; continue; }
    const lineage = recordBefore(item, asOf), date = day(p.reportDate), c=p.columns;
    requireThat(p.reportDate <= localDate(asOf), 'POSITIONS_AFTER_AS_OF');
    if(p.publicationAt !== null) requireThat(Number.isFinite(Date.parse(p.publicationAt)) && Date.parse(p.publicationAt)<=Date.parse(asOf),'PUBLICATION_AFTER_AS_OF');
    const long=contracts(c.m_money_positions_long_all), short=contracts(c.m_money_positions_short_all), openInterest=contracts(c.open_interest_all);
    const identity=digest({long,short,openInterest,datasetId,contractCode,contractName});
    const old=rows.get(date);
    if (old) { requireThat(old.identity === identity, 'CONFLICTING_POSITION_RECORD'); deduplicated++; continue; }
    rows.set(date,{reportDate:p.reportDate,long,short,net:long-short,openInterest,unit:'contracts',identity,lineage,
      publicationAt:p.publicationAt ?? 'UNKNOWN',reportVariant:'DISAGGREGATED_FUTURES_ONLY'});
  }
  const ordered=[...rows].sort((a,b)=>b[0]-a[0]).map(r=>r[1]);requireThat(ordered.length,'NO_SELECTED_POSITIONING');
  const [latest,previous]=ordered; const comparable=!!previous && day(latest.reportDate)-day(previous.reportDate)===7*86400000;
  return {kind:'FUTURES_POSITIONING_NOT_PHYSICAL_DEMAND',datasetId,contractCode,contractName,latest,previous:previous??null,
    netChange:comparable?latest.net-previous.net:'UNKNOWN',openInterestChange:comparable?latest.openInterest-previous.openInterest:'UNKNOWN',
    records:{received:items.length,selectedUnique:rows.size,discarded,deduplicated}};
}

/** A recurrence is not an actual release date, and is never expanded locally. */
export function confirmedOilCalendar(items,{asOf,fromDate,throughDate}) {
  day(fromDate);day(throughDate);requireThat(fromDate<=throughDate,'INVALID_CALENDAR_WINDOW');
  const accepted=[], excluded=[];const seen=new Map();
  for (const item of items) {
    const p=item.payload;const lineage=recordBefore(item,asOf);
    requireThat(item.metadata.providerId==='commodities-sh' && p.kind==='PUBLICATION_SCHEDULE','PUBLICATION_CALENDAR_REQUIRED');
    const reason = !/petroleum|crude|\boil\b|\bcot\b|commitments of traders|\bcftc\b|\bsteo\b/i.test(p.title) ? 'NOT_OIL_RELEVANT'
      : !p.scheduledAt && !p.dateOnly ? 'RECURRENCE_WITHOUT_CONFIRMED_DATE' : null;
    if(reason){excluded.push({scheduleId:p.scheduleId,reason});continue;}
    if(p.scheduledAt)requireThat(Number.isFinite(Date.parse(p.scheduledAt)),'INVALID_SCHEDULE_DATE');
    const date=p.scheduledAt?localDate(p.scheduledAt):p.dateOnly;day(date);
    if(date<fromDate||date>throughDate||p.scheduledAt&&Date.parse(p.scheduledAt)<=Date.parse(asOf)){excluded.push({scheduleId:p.scheduleId,reason:'OUTSIDE_FUTURE_WINDOW'});continue;}
    const key=p.scheduleId+':'+date,identity=digest({title:p.title,date,scheduledAt:p.scheduledAt});
    if(seen.has(key)){requireThat(seen.get(key)===identity,'CONFLICTING_CALENDAR_DATE');continue;}
    seen.set(key,identity);accepted.push({scheduleId:p.scheduleId,title:p.title,date,scheduledAt:p.scheduledAt??'UNKNOWN',
      timeBasis:p.scheduledAt?'PROVIDER_TIMESTAMP_CONVERT_TO_EUROPE_WARSAW':'CONFIRMED_DATE_ONLY_TIME_UNKNOWN',
      status:'PROVIDER_SCHEDULE_NOT_RELEASE_RESULT',lineage});
  }
  return {events:accepted.sort((a,b)=>a.date.localeCompare(b.date)),excluded,status:accepted.length?'CONFIRMED_DATED_SUBSET':'NO_CONFIRMED_OIL_RELEASE_DATES'};
}
