import type { FinancialData, GeneralCompanyData } from '@profitia/srm-xray';

export const CORPORATE_KNOWLEDGE_VERSION = 'srm-corporate-knowledge-v1';
export const MAX_CORPORATE_KNOWLEDGE_BYTES = 32 * 1024 * 1024;
type ObjectValue = Record<string, unknown>;
const unavailable = (): never => { throw new TypeError('Corporate knowledge unavailable'); };

/** A closed serialization boundary, not identity, permission, source-license
 * authority or a detector of personal information hidden in arbitrary text.
 * Only the already classified corporate fields are eligible. Raw responses,
 * unknown fields, people and private provenance require their own boundary. */
function finiteJson(input: unknown): void {
  let nodes = 0;
  const active = new Set<object>();
  const visit = (value: unknown, depth: number, optional = false): void => {
    if (++nodes > 500_000 || depth > 32) return unavailable();
    if (value === undefined && optional || value === null || typeof value === 'boolean') return;
    if (typeof value === 'string') { if (value.length > MAX_CORPORATE_KNOWLEDGE_BYTES) return unavailable(); return; }
    if (typeof value === 'number') { if (!Number.isFinite(value)) return unavailable(); return; }
    if (!value || typeof value !== 'object' || active.has(value)) return unavailable();
    active.add(value);
    if (Array.isArray(value)) {
      if (value.length > 16_384 || Reflect.ownKeys(value).length !== value.length + 1) return unavailable();
      for (let i = 0; i < value.length; i++) {
        const d = Object.getOwnPropertyDescriptor(value, String(i));
        if (!d || !('value' in d)) return unavailable();
        visit(d.value, depth + 1);
      }
    } else {
      if (Object.getPrototypeOf(value) !== Object.prototype) return unavailable();
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (Reflect.ownKeys(value).length !== Object.keys(descriptors).length) return unavailable();
      for (const d of Object.values(descriptors)) {
        if (!d.enumerable || !('value' in d)) return unavailable();
        visit(d.value, depth + 1, true);
      }
    }
    active.delete(value);
  };
  visit(input, 0);
  if (Buffer.byteLength(JSON.stringify(input)) > MAX_CORPORATE_KNOWLEDGE_BYTES) return unavailable();
}
function object(value: unknown, required: readonly string[], optional: readonly string[] = []): ObjectValue {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype
    || required.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) return unavailable();
  return value as ObjectValue;
}
function text(value: unknown, maximum = 4096, nullable = false): void {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return unavailable();
}
function choice(value: unknown, values: readonly unknown[]): void { if (!values.includes(value)) return unavailable(); }
function date(value: unknown, nullable = false): void {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) return unavailable();
}
function amount(value: unknown, nullable = false): void {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || value.length > 128 || !/^-?\d+(?:\.\d+)?$/.test(value)) return unavailable();
}
function items(value: unknown, read: (value: unknown) => void, maximum = 16_384): void {
  if (!Array.isArray(value) || value.length > maximum) return unavailable();
  value.forEach(read);
}
function optional(value: ObjectValue, key: string, read: (value: unknown) => void): void {
  if (value[key] !== undefined) read(value[key]);
}
function fact(value: unknown): void {
  const v = object(value, ['metricCode','amount','currency','unit']);
  if (typeof v.metricCode !== 'string' || !/^[A-Z][A-Z0-9_]{1,79}$/.test(v.metricCode)) return unavailable();
  amount(v.amount); text(v.currency, 64); text(v.unit, 64);
}
function period(value: unknown): void {
  const v = object(value, ['from','to','scope','documentId','facts'], ['comparativeData','sourceRegistration','effectiveRevisionId',
    'revisionStatus','accountingStandard','accountingStandardBasis','isIasCompliant','xmlSchema','msrRows']);
  date(v.from); date(v.to); if (String(v.from) > String(v.to)) return unavailable();
  choice(v.scope, ['standalone','consolidated']); text(v.documentId, 1024); items(v.facts, fact);
  optional(v, 'effectiveRevisionId', x => text(x, 1024));
  optional(v, 'revisionStatus', x => choice(x, ['RESOLVED','UNRESOLVED']));
  optional(v, 'accountingStandard', x => choice(x, ['POLISH_UOR','IAS_IFRS','UNKNOWN']));
  optional(v, 'accountingStandardBasis', x => text(x));
  optional(v, 'isIasCompliant', x => choice(x, [true,false,null]));
  optional(v, 'sourceRegistration', x => {
    const r = object(x, ['krs','legalName','relationship']);
    if (typeof r.krs !== 'string' || !/^\d{10}$/.test(r.krs)) return unavailable();
    text(r.legalName, 4096, true); choice(r.relationship, ['CURRENT','PREDECESSOR','UNCONFIRMED']);
  });
  optional(v, 'xmlSchema', x => { const r = object(x, ['name','version']); text(r.name, 256, true); text(r.version, 128, true); });
  optional(v, 'comparativeData', x => {
    const r = object(x, ['selected','dateBasis','original','restated']);
    choice(r.selected, ['ORIGINAL','RESTATED','UNRESOLVED']); choice(r.dateBasis, ['CALENDAR_PREVIOUS_YEAR','UNCONFIRMED']);
    items(r.original, fact); items(r.restated, fact);
  });
  optional(v, 'msrRows', x => items(x, row => {
    const r = object(row, ['key','label','section','amount','currency','unit','validation','dimensions']);
    text(r.key, 4096); text(r.label); choice(r.section, ['Bilans','RZiS','CashFlow','Equity','ComprehensiveIncome','Other']);
    amount(r.amount, true); text(r.currency, 64, true); text(r.unit, 64); choice(r.validation, ['VALID','REVIEW']);
    items(r.dimensions, dimension => text(dimension, 4096), 128);
  }));
}
const indicatorFields = ['code','periodStart','periodEnd','scope','status','value','unit','importance','reasonCode','formulaVersion'] as const;
const internalIndicatorFields = ['nip','inputFacts','sourceSnapshotIds','sourceDocumentIds'] as const;
function indicator(value: unknown): void {
  const v = object(value, indicatorFields);
  if (typeof v.code !== 'string' || !/^[A-Z][A-Z0-9_]{1,79}$/.test(v.code)) return unavailable();
  date(v.periodStart); date(v.periodEnd); if (String(v.periodStart) > String(v.periodEnd)) return unavailable();
  choice(v.scope, ['standalone','consolidated']); choice(v.status, ['AVAILABLE','UNAVAILABLE']);
  amount(v.value, true); choice(v.unit, ['RATIO','PERCENT','PLN','DAYS']); choice(v.importance, [1,2,3]);
  text(v.reasonCode, 256, true); text(v.formulaVersion, 128);
  if (v.status === 'AVAILABLE' ? v.value === null || v.reasonCode !== null : v.value !== null || v.reasonCode === null) return unavailable();
}
function financial(value: unknown): void {
  if (value === null) return;
  const v = object(value, ['periods'], ['qualityRule','registryHistoryVersion','revisionRule','indicators']);
  optional(v, 'qualityRule', x => text(x, 128)); optional(v, 'revisionRule', x => text(x, 128));
  optional(v, 'registryHistoryVersion', x => choice(x, ['KRS_CONTINUITY_V1']));
  items(v.periods, period, 1024); optional(v, 'indicators', x => items(x, indicator));
}

/** Strict SOURCE candidate: no dropping unknown fields or private lineage.
 * It neither publishes anything nor certifies where the bytes came from. */
export function readCorporateFinancialData(value: unknown): FinancialData | null {
  finiteJson(value); financial(value);
  return JSON.parse(JSON.stringify(value)) as FinancialData | null;
}

/** Public DTO has exactly the declared indicator fields. The four known
 * calculator-only properties stay in the server's original result; they are
 * removed only from this detached response. Other unknown fields fail closed. */
export function projectPublicFinancialData(value: unknown): FinancialData | null {
  finiteJson(value);
  if (value === null) return null;
  const v = object(value, ['periods'], ['qualityRule','registryHistoryVersion','revisionRule','indicators']);
  const projected = { ...v };
  if (v.indicators !== undefined) {
    items(v.indicators, x => object(x, indicatorFields, internalIndicatorFields));
    projected.indicators = (v.indicators as ObjectValue[]).map(x => Object.fromEntries(indicatorFields.map(key => [key, x[key]])));
  }
  financial(projected);
  return JSON.parse(JSON.stringify(projected)) as FinancialData;
}

/** Only the known KRS corporate fields qualify. JDG and people are not
 * reclassified through a name, arbitrary object or a supplier's container. */
export function readCorporateCompanyData(value: unknown, nip: string): GeneralCompanyData | null {
  if (typeof nip !== 'string' || !/^[0-9]{10}$/.test(nip)) return unavailable();
  finiteJson(value); if (value === null) return null;
  const v = object(value, ['legalName','legalForm','krs','nip','regon','registeredAddress','registeredAt','mainPkd'],
    ['registrationStatus','deregisteredAt','mainPkdDescription','website','registryHistory']);
  if (v.nip !== nip || typeof v.krs !== 'string' || !/^\d{10}$/.test(v.krs)
    || v.regon !== null && (typeof v.regon !== 'string' || !/^(?:\d{9}|\d{14})$/.test(v.regon))) return unavailable();
  for (const key of ['legalName','legalForm','registeredAddress','mainPkd']) text(v[key], 4096, true);
  date(v.registeredAt, true); optional(v, 'deregisteredAt', x => date(x, true));
  optional(v, 'registrationStatus', x => choice(x, ['ACTIVE','LIQUIDATION','DEREGISTERED','UNKNOWN']));
  optional(v, 'mainPkdDescription', x => text(x, 4096, true));
  optional(v, 'website', x => {
    text(x, 4096, true); if (x === null) return;
    let u: URL; try { u = new URL(x as string); } catch { return unavailable(); }
    if (!['http:','https:'].includes(u.protocol) || u.username || u.password) return unavailable();
  });
  optional(v, 'registryHistory', x => {
    const h = object(x, ['version','currentKrs','members','links','unlinkedKrs']);
    choice(h.version, ['KRS_CONTINUITY_V1']); if (h.currentKrs !== v.krs) return unavailable();
    const krs = (x: unknown) => { if (typeof x !== 'string' || !/^\d{10}$/.test(x)) return unavailable(); };
    items(h.members, x => {
      const m = object(x, ['krs','legalName','legalForm','registeredAt','deregisteredAt','status']);
      krs(m.krs); text(m.legalName, 4096, true); text(m.legalForm, 4096, true);
      date(m.registeredAt, true); date(m.deregisteredAt, true); choice(m.status, ['ACTIVE','LIQUIDATION','DEREGISTERED','UNKNOWN']);
    }, 100);
    items(h.links, x => { const l = object(x, ['predecessorKrs','successorKrs','basis']); krs(l.predecessorKrs); krs(l.successorKrs); choice(l.basis, ['KRS_FORMATION_TRANSFORMATION']); }, 100);
    items(h.unlinkedKrs, krs, 100);
  });
  return JSON.parse(JSON.stringify(value)) as GeneralCompanyData;
}
