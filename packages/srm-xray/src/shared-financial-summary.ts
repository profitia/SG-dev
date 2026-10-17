import type { SupplierReportData } from './contracts';

const invalid = (): never => { throw new TypeError('Invalid shared financial summary'); };
function object(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return invalid();
  const result = value as Record<string, unknown>;
  if (required.some(key => !Object.hasOwn(result, key)) || Object.keys(result).some(key => !required.includes(key) && !optional.includes(key))) invalid();
  return result;
}
const text = (value: unknown): void => { if (typeof value !== 'string') invalid(); };
const nullableText = (value: unknown): void => { if (value !== null) text(value); };
const choice = (value: unknown, values: readonly unknown[]): void => { if (!values.includes(value)) invalid(); };
function list(value: unknown, check: (item: unknown) => void): void {
  if (!Array.isArray(value)) return invalid();
  value.forEach(check);
}
function freshness(value: unknown): Record<string, unknown> {
  const result = object(value, ['retrievedAt','checkedAt','cacheExpiresAt','retentionUntil','freshness','readSource','lastRetrievalMethod']);
  for (const key of ['retrievedAt','checkedAt','cacheExpiresAt','retentionUntil']) nullableText(result[key]);
  choice(result.freshness, ['FRESH','EXPIRED','UNKNOWN','ABSENT']);
  choice(result.readSource, ['STORED']); choice(result.lastRetrievalMethod, ['PROVIDER','CACHE','UNKNOWN']);
  return result;
}
function fact(value: unknown): void {
  const result = object(value, ['ref','documentRef','metricCode','periodStart','periodEnd','scope','amount','sourceAmount','currency','unit','validation','normalization','normalizationRule','reasonCode']);
  for (const key of ['ref','documentRef','metricCode','periodStart','periodEnd','amount','currency','unit']) text(result[key]);
  for (const key of ['sourceAmount','normalizationRule','reasonCode']) nullableText(result[key]);
  choice(result.scope, ['standalone','consolidated']);
  choice(result.validation, ['VERIFIED','UNVERIFIED','UNAVAILABLE']);
  choice(result.normalization, ['NORMALIZED_CONFIRMED','SOURCE_VALUE','SOURCE_UNCONFIRMED','UNKNOWN']);
}
function period(value: unknown): void {
  const result = object(value, ['from','to','year','scope','documentRef','facts'], ['accountingStandard','sourceRegistration','qualityIssues','comparativeData']);
  for (const key of ['from','to','year','documentRef']) text(result[key]);
  choice(result.scope, ['standalone','consolidated']); list(result.facts, fact);
  if (Object.hasOwn(result, 'accountingStandard')) choice(result.accountingStandard, ['POLISH_UOR','IAS_IFRS','UNKNOWN']);
  if (Object.hasOwn(result, 'qualityIssues')) list(result.qualityIssues, text);
  if (Object.hasOwn(result, 'sourceRegistration')) {
    const registration = object(result.sourceRegistration, ['krs','legalName','relationship']);
    text(registration.krs); nullableText(registration.legalName);
    choice(registration.relationship, ['CURRENT','PREDECESSOR','UNCONFIRMED']);
  }
  if (Object.hasOwn(result, 'comparativeData')) {
    const comparison = object(result.comparativeData, ['selected','dateBasis','original','restated']);
    choice(comparison.selected, ['ORIGINAL','RESTATED','UNRESOLVED']);
    choice(comparison.dateBasis, ['CALENDAR_PREVIOUS_YEAR','UNCONFIRMED']);
    for (const key of ['original','restated']) list(comparison[key], value => {
      const item = object(value, ['metricCode','amount','currency','unit']);
      for (const key of ['metricCode','amount','currency','unit']) text(item[key]);
    });
  }
}
function history(value: unknown): void {
  const result = object(value, ['code','reasonCode','points']);
  text(result.code); nullableText(result.reasonCode);
  list(result.points, value => {
    const point = object(value, ['code','periodStart','periodEnd','scope','status','value','unit','importance','reasonCode','formulaVersion','year','documentRef','definitionRef','evidence','comparison']);
    for (const key of ['code','periodStart','periodEnd','formulaVersion','year','documentRef']) text(point[key]);
    for (const key of ['value','reasonCode']) nullableText(point[key]);
    choice(point.scope, ['standalone','consolidated']); choice(point.status, ['AVAILABLE','UNAVAILABLE']);
    choice(point.unit, ['RATIO','PERCENT','PLN','DAYS']); choice(point.importance, [1,2,3]);
    const definition = object(point.definitionRef, ['code','formulaVersion']); text(definition.code); text(definition.formulaVersion);
    list(point.evidence, fact);
    const comparison = object(point.comparison, ['status','reasonCode','previousPeriod','delta','unit','direction']);
    choice(comparison.status, ['COMPARABLE','NOT_COMPARABLE','UNKNOWN']); nullableText(comparison.reasonCode); nullableText(comparison.delta);
    choice(comparison.unit, ['PERCENTAGE_POINTS','RATIO','PLN','DAYS']); choice(comparison.direction, ['UP','DOWN','UNCHANGED','NO_COMPARISON']);
    if (comparison.previousPeriod !== null) {
      const previous = object(comparison.previousPeriod, ['from','to']); text(previous.from); text(previous.to);
    }
  });
}

/** Pure shared-envelope boundary. No authentication, permission, financial
 * calculation or provider access. The existing SRM projector owns the numeric
 * semantics and source qualification; hosts independently authorize each read.
 * Extra fields are refused at every declared object level, never stripped. */
export function readSharedFinancialSummary(value: unknown, selection: { nip: string; entityType: 'COMPANY' | 'JDG' }): SupplierReportData {
  if (!selection || !/^\d{10}$/.test(selection.nip) || !['COMPANY','JDG'].includes(selection.entityType)) invalid();
  const report = object(value, ['schemaVersion','nip','entityType','financial','kys']);
  if (report.schemaVersion !== '1.0' || report.nip !== selection.nip || report.entityType !== selection.entityType) invalid();
  const financial = object(report.financial, ['status','source','freshness','completeness','limitations','mappingVersion','sourceVersion','representationVersion','periods','history']);
  choice(financial.status, ['SUCCESS','EMPTY','PARTIAL','ERROR','NOT_REQUESTED','PENDING']); choice(financial.source, ['MGBI']);
  freshness(financial.freshness); choice(financial.completeness, ['COMPLETE','PARTIAL','EMPTY','UNKNOWN']); list(financial.limitations, text);
  for (const key of ['mappingVersion','sourceVersion','representationVersion']) nullableText(financial[key]);
  list(financial.periods, period); list(financial.history, history);
  // Empty histories may retain the existing indicator definitions. They are
  // not financial observations for an individual business.
  if (selection.entityType === 'JDG' && ((financial.periods as unknown[]).length
    || (financial.history as Array<{ points: unknown[] }>).some(item => item.points.length))) invalid();
  const kys = object(report.kys, ['status','source','freshness','completeness','lastAttemptStatus','lastAttemptAt','limitations','reportAvailable']);
  if (kys.status !== 'NOT_REQUESTED' || kys.source !== 'VERCLY' || kys.completeness !== 'UNKNOWN'
    || kys.lastAttemptStatus !== null || kys.lastAttemptAt !== null || kys.reportAvailable !== false
    || !Array.isArray(kys.limitations) || kys.limitations.length !== 1 || kys.limitations[0] !== 'KYS_NOT_REQUESTED') invalid();
  const kysFreshness = freshness(kys.freshness);
  if (kysFreshness.freshness !== 'ABSENT' || kysFreshness.lastRetrievalMethod !== 'UNKNOWN'
    || ['retrievedAt','checkedAt','cacheExpiresAt','retentionUntil'].some(key => kysFreshness[key] !== null)) invalid();
  return value as SupplierReportData;
}
