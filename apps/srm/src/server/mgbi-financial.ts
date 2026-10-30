import {diagnosticRun} from './diagnostic-trace'
import { FINANCIAL_QUALITY_RULE } from "@profitia/srm-xray";
import { verifiedXmlMultiplier, equalAmounts, multiplySourceAmount } from "./financial-unit";
import { withOrganization, type DatabasePool } from "./db";
import { projectArchivedFinancialDocuments, financialRecordsFromPages, type FinancialArchive } from "./financial-documents";
import { resolveDocumentFamily, FINANCIAL_REVISION_RULE } from "./financial-revisions";
import type { FinancialData, FinancialPeriod, SectionEnvelope } from "@profitia/srm-xray";
import type { CompanyIdentifier, MgbiGeneralOptions } from "./mgbi-general";
import { projectFinancialDocuments, type FinancialSourceDocument } from "./financial-documents";
import { fetchMgbiPages } from "./mgbi-archive";
import { COMPANY_IDENTITY_VERSION, financialRegistration, type RegistryHistory } from "./company-continuity";

type RecordObject = Record<string, unknown>;
export type FinancialSourceFact = {
  metricCode: string;
  periodStart: string;
  periodEnd: string;
  periodType: "YEAR" | "QUARTER" | "MONTH" | "OTHER";
  statementScope: "UNIT" | "CONSOLIDATED";
  amount: string;
  sourceAmount: string;
  normalizationRule: "SOURCE_VALUE" | "VERIFIED_COST_MAGNITUDE_V1" | "UNVERIFIED_COST_SIGN";
  currencyCode: string;
  unitCode: string;
  sourcePath: string;
  validationStatus: "VALID" | "REVIEW";
};
export type MgbiFinancialResult = {
  section: SectionEnvelope<FinancialData>;
  sourceData?: FinancialData;
  rawResponse?: { pages: unknown[]; recordCount: number };
  facts: FinancialSourceFact[];
  errorCode: string | null;
};

const MODEL = "pl-krs-rdf-record";
const SOURCE = { provider: "MGBI" as const, model: MODEL, recordId: null };
const NO_FINANCIAL_FACTS = "MGBI_NO_STRUCTURED_FINANCIAL_DATA";
const INTERNATIONAL_STATEMENT = "MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS";
const XML_FINANCIAL_FIELDS: Record<string, string> = {
  "Bilans.Aktywa.Aktywa_B.Aktywa_B_I": "BS_A_CA_INV",
  "Bilans.Aktywa.Aktywa_B.Aktywa_B_II.Aktywa_B_II_1.Aktywa_B_II_1_A": "BS_TRADE_RECEIVABLES_RELATED",
  "Bilans.Aktywa.Aktywa_B.Aktywa_B_II.Aktywa_B_II_2.Aktywa_B_II_2_A": "BS_TRADE_RECEIVABLES_INVESTEE",
  "Bilans.Aktywa.Aktywa_B.Aktywa_B_II.Aktywa_B_II_3.Aktywa_B_II_3_A": "BS_TRADE_RECEIVABLES_OTHER",
  "Bilans.Pasywa.Pasywa_B.Pasywa_B_III.Pasywa_B_III_1.Pasywa_B_III_1_A": "BS_TRADE_PAYABLES_RELATED",
  "Bilans.Pasywa.Pasywa_B.Pasywa_B_III.Pasywa_B_III_2.Pasywa_B_III_2_A": "BS_TRADE_PAYABLES_INVESTEE",
  "Bilans.Pasywa.Pasywa_B.Pasywa_B_III.Pasywa_B_III_3.Pasywa_B_III_3_D": "BS_TRADE_PAYABLES_OTHER",
  "RZiS.RZiSKalk.A": "PALA_NET_SALES",
  "RZiS.RZiSKalk.B": "PALA_COGS",
  "RZiS.RZiSKalk.C": "PALA_GROSS_PROFIT",
  "RZiS.RZiSPor.H.H_I": "PALA_INTEREST_EXPENSE",
  "RZiS.RZiSKalk.K.K_I": "PALA_INTEREST_EXPENSE",
  "RachPrzeplywow.PrzeplywyPosr.A.A_III": "CFS_OPERATING_CASH_FLOW",
  "RachPrzeplywow.PrzeplywyBezp.A.A_III": "CFS_OPERATING_CASH_FLOW",
  "RachPrzeplywow.PrzeplywyPosr.B.B_II.B_II_1": "CFS_CAPITAL_EXPENDITURE",
  "RachPrzeplywow.PrzeplywyBezp.B.B_II.B_II_1": "CFS_CAPITAL_EXPENDITURE",
};

// Corroboration only: do not broaden extracted-only mappings or mix P&L variants.
const XML_UNIT_FIELDS: Record<string,string> = {
  ...XML_FINANCIAL_FIELDS,
  "Bilans.Aktywa": "BS_A_TA",
  "Bilans.Aktywa.Aktywa_A": "BS_A_FA",
  "Bilans.Aktywa.Aktywa_B": "BS_A_CA",
  "Bilans.Pasywa.Pasywa_A": "BS_LAE_E",
  "Bilans.Pasywa.Pasywa_B": "BS_LAE_LAPFL",
  "Bilans.Pasywa.Pasywa_B.Pasywa_B_III": "BS_LAE_LAPFL_STL",
  "RZiS.RZiSPor.A": "PALA_NRFS",
  "RZiS.RZiSPor.B": "PALA_OAC",
  "RZiS.RZiSPor.C": "PALA_PLFS",
  "RZiS.RZiSPor.F": "PALA_PLFOA",
  "RZiS.RZiSPor.I": "PALA_GPL",
  "RZiS.RZiSPor.L": "PALA_NPL",
};

function obj(value: unknown): RecordObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordObject : null;
}
function field(value: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>((current, key) => obj(current)?.[key], value);
}
function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function date(value: unknown): string | null {
  const text = string(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text)) ? text : null;
}
function previousYear(value: string): string {
  const year = Number(value.slice(0, 4)) - 1;
  const monthDay = value.slice(4);
  return `${year}${monthDay === "-02-29" && !((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? "-02-28" : monthDay}`;
}
function amount(value: unknown): string | null {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : string(value);
  if (!text || !/^-?\d{1,20}(?:\.\d{1,4})?$/.test(text)) return null;
  return text;
}
function empty(status: "EMPTY" | "ERROR", at: string, warning: string, errorCode: string | null): MgbiFinancialResult {
  return { section: { status, source: SOURCE, retrievedAt: at, effectiveAt: null, data: null, warnings: [warning] }, facts: [], errorCode };
}

function scaledAmount(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const result = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0"));
  return negative ? -result : result;
}

function reconcileCosts(periods: FinancialPeriod[], facts: FinancialSourceFact[], sourceDocuments: Map<FinancialSourceFact, string>): boolean {
  let unverified = false;
  for (const period of periods) {
    const values = new Map(period.facts.map((fact) => [fact.metricCode, fact.amount]));
    const equations = [
      { cost: "PALA_OAC", left: "PALA_NRFS", addition: null, result: "PALA_PLFS" },
      { cost: "PALA_COGS", left: "PALA_NET_SALES", addition: null, result: "PALA_GROSS_PROFIT" },
      { cost: "PALA_OOC", left: "PALA_PLFS", addition: "PALA_OOR", result: "PALA_PLFOA" },
      { cost: "PALA_FC", left: "PALA_PLFOA", addition: "PALA_FR", result: "PALA_GPL" },
      { cost: "PALA_IT", left: "PALA_GPL", addition: null, result: "PALA_NPL" },
    ] as const;
    for (const equation of equations) {
      const sourceCost = values.get(equation.cost);
      if (sourceCost === undefined) continue;
      const left = values.get(equation.left);
      const addition = equation.addition === null ? "0" : values.get(equation.addition);
      const result = values.get(equation.result);
      const costValue = scaledAmount(sourceCost);
      // Compare only values from the same document, period and statement scope.
      // One grosz covers decimal rounding in source reports, not a material mismatch.
      const verified = left !== undefined && addition !== undefined && result !== undefined && (
        (costValue < 0n && abs(scaledAmount(left) + scaledAmount(addition) + costValue - scaledAmount(result)) <= 100n) ||
        (costValue >= 0n && abs(scaledAmount(left) + scaledAmount(addition) - costValue - scaledAmount(result)) <= 100n)
      );
      if (!verified) unverified = true;
      for (const displayFact of period.facts) {
        if (displayFact.metricCode !== equation.cost && !(equation.cost === "PALA_OAC" && displayFact.metricCode.startsWith("PALA_OAC_"))) continue;
        const stored = facts.find((fact) => sourceDocuments.get(fact) === period.documentId && fact.metricCode === displayFact.metricCode && fact.periodStart === period.from
          && fact.periodEnd === period.to && fact.statementScope === (period.scope === "standalone" ? "UNIT" : "CONSOLIDATED"));
        if (!stored) continue;
        const sameSign = scaledAmount(stored.sourceAmount) === 0n || (scaledAmount(stored.sourceAmount) < 0n) === (costValue < 0n);
        if (!verified || !sameSign) {
          stored.normalizationRule = "UNVERIFIED_COST_SIGN";
          stored.validationStatus = "REVIEW";
          unverified = true;
          continue;
        }
        stored.amount = stored.sourceAmount.replace(/^-/, "");
        stored.normalizationRule = "VERIFIED_COST_MAGNITUDE_V1";
        displayFact.amount = stored.amount;
      }
    }
  }
  return unverified;
}

function abs(value: bigint): bigint { return value < 0n ? -value : value; }

function isInternationalStatementWithoutFacts(records: unknown[], identifier: CompanyIdentifier, totalCount: number): boolean {
  // A partial page cannot prove that every available statement follows the same standard.
  if (totalCount > records.length) return false;
  const idKey = identifier.type === "KRS" ? "pl_krs" : "pl_nip";
  const statements = records.filter((record) => {
    const type = field(record, "document", "type");
    return string(field(record, "identifiers", idKey)) === identifier.value
      && (type === "financial_statement" || type === "consolidated_financial_statement");
  });
  const documents = projectFinancialDocuments(statements);
  return statements.length > 0 && documents.length === statements.length && documents.every(document => document.standard === "IAS_IFRS" && document.availability !== "XML_SUPPORTED" && !document.rows.length);
}

export function mapMgbiFinancialRecords(records: unknown[], identifier: CompanyIdentifier, retrievedAt: string, totalCount = records.length, history?:RegistryHistory): MgbiFinancialResult {
 return diagnosticRun('FINANCIAL_NORMALIZE',()=>{
  const idKey = identifier.type === "KRS" ? "pl_krs" : "pl_nip";
  const identityMatching = records.filter((record) => string(field(record, "identifiers", idKey)) === identifier.value);
  if (records.length && !identityMatching.length) return empty("ERROR", retrievedAt, "MGBI_IDENTIFIER_MISMATCH", "IDENTIFIER_MISMATCH");
  const matching = history ? identityMatching.filter(r=>history.members.some(m=>m.krs===field(r,"identifiers","pl_krs"))) : identityMatching;
  const rank = (r:unknown) => history?.members.findIndex(m=>m.krs===field(r,"identifiers","pl_krs")) ?? 0;
  const selected = matching.filter((record) => {
    const type = string(field(record, "document", "type"));
    return type === "financial_statement" || type === "consolidated_financial_statement";
  }).sort((a, b) => rank(a)-rank(b) || (string(field(b, "document", "filing_date")) ?? "").localeCompare(string(field(a, "document", "filing_date")) ?? "") || (string(field(b, "document", "period_to_date")) ?? "").localeCompare(string(field(a, "document", "period_to_date")) ?? ""));

  const documents = new Map(projectFinancialDocuments(selected).map((document) => [document.recordId, document]));
  // A family can have several filings and both current/comparative periods.
  // Resolve its complete content once in this normalization only. No result
  // survives the invocation or a change to the source inventory.
  const familyKey = (scope: unknown, from: unknown, to: unknown, krs: unknown) => JSON.stringify([scope,from,to,krs]);
  const families = new Map<string,FinancialSourceDocument[]>();
  for (const document of documents.values()) {
    const key = familyKey(document.scope,document.from,document.to,document.sourceKrs);
    const family = families.get(key) ?? [];
    family.push(document); families.set(key,family);
  }
  const revisions = new Map<string,ReturnType<typeof resolveDocumentFamily>>();
  const periods: FinancialPeriod[] = [];
  const facts: FinancialSourceFact[] = [];
  const sourceDocuments = new Map<FinancialSourceFact, string>();
  const seen = new Set<string>();
  const owners = new Map<string,string>();
  for (const record of selected) {
    const document = obj(field(record, "document"));
    const documentMetadata = documents.get(string(field(record, "id")) ?? "");
    const standardized = obj(field(record, "content", "standardized_fields"));
    const extracted = obj(field(record, "content", "extracted_fields"));
    const from = date(document?.period_from_date);
    const to = date(document?.period_to_date);
    const recordId = string(field(record, "id"));
    if (!from || !to || !recordId || from > to) continue;
    const scope = document?.type === "consolidated_financial_statement" ? "CONSOLIDATED" : "UNIT";
    // Reserve only periods actually disclosed by this filing. A missing metric
    // in a declared comparative column is not filled from another document;
    // absence of that entire column cannot hide an older annual statement.
    const hasPriorColumn=documentMetadata?.columns.some(c=>c.sourceColumn==="KwotaB")
      || [standardized,extracted].some(dictionary=>Object.values(dictionary ?? {}).some(group=>Object.keys(obj(group) ?? {}).some(key=>/_(pfy|cpfy)$/.test(key))));
    for (const [start,end] of [[from,to],...(hasPriorColumn?[[previousYear(from),previousYear(to)]]:[])]) {
      const key = `${scope}:${start}:${end}`;
      if (!owners.has(key)) owners.set(key,recordId);
    }
    if ((!standardized && !extracted) || documentMetadata?.availability === "NO_XML" || documentMetadata?.availability === "UNSUPPORTED_XML") continue;
    const family = familyKey(documentMetadata?.scope,from,to,documentMetadata?.sourceKrs);
    let revision = revisions.get(family);
    if (!revision) { revision = resolveDocumentFamily(families.get(family) ?? []); revisions.set(family,revision); }
    const schema = string(field(record, "content", "schema", "name")) ?? "";
    const multiplier = verifiedXmlMultiplier(record, schema);
    // Standardized values can already be PLN, even in a thousand-unit schema.
    // Confirm each value against the extracted XML column instead of scaling twice.
    const unitFor = (metric: string, numeric: string, column: string, dictionaryName: string): "PLN" | "UNKNOWN" => {
      if (/WZlotych$/i.test(schema)) return "PLN";
      if (multiplier === null || column === "RESTATED_UNCONFIRMED") return "UNKNOWN";
      if (dictionaryName === "extracted_fields") return multiplier === 1 ? "PLN" : "UNKNOWN";
      const paths = Object.entries(XML_UNIT_FIELDS).filter(([, code]) => code === metric);
      return paths.some(([path]) => {
        const source = amount(extracted?.[`${path}.${column}`]);
        const normalized = source === null ? null : multiplySourceAmount(source, multiplier);
        return normalized !== null && equalAmounts(numeric, normalized);
      }) ? "PLN" : "UNKNOWN";
    };
    const restated: FinancialPeriod["facts"][number][] = [];
    const byPeriod = new Map<string, FinancialPeriod>();
    // MGBI defines extracted_fields as the complete XML field dictionary and
    // standardized_fields as its smaller comparable subset. Preserve the subset
    // as authority when both dictionaries contain the same metric and period.
    for (const [dictionaryName, dictionary] of [["standardized_fields", standardized], ["extracted_fields", extracted]] as const) {
      if (!dictionary) continue;
      if (dictionaryName === "extracted_fields") {
        // MGBI returns a flat XML path-to-amount map. Persist only audited
        // financial paths; other extracted fields may contain personal data.
        for (const [xmlPath, rawValue] of Object.entries(dictionary)) {
          const match = /^(.*)\.Kwota([AB])$/.exec(xmlPath);
          const metricCode = match ? XML_FINANCIAL_FIELDS[match[1]] : undefined;
          const numeric = amount(rawValue);
          if (!metricCode || numeric === null) continue;
          const prior = match![2] === "B";
          const periodStart = prior ? previousYear(from) : from;
          const periodEnd = prior ? previousYear(to) : to;
          const unique = [scope, periodStart, periodEnd, metricCode].join(":");
          if (owners.get(`${scope}:${periodStart}:${periodEnd}`) !== recordId || seen.has(unique)) continue;
          seen.add(unique);
          const periodType = periodStart.slice(0, 4) === periodEnd.slice(0, 4) && periodStart.endsWith("-01-01") && periodEnd.endsWith("-12-31") ? "YEAR" : "OTHER";
          const unitCode = unitFor(metricCode, numeric, match![2] === "B" ? "KwotaB" : "KwotaA", dictionaryName);
          const validationStatus = unitCode === "PLN" ? "VALID" : "REVIEW";
          facts.push({ metricCode, periodStart, periodEnd, periodType, statementScope: scope,
            amount: numeric, sourceAmount: numeric, normalizationRule: "SOURCE_VALUE", currencyCode: "PLN", unitCode,
            sourcePath: "content.extracted_fields." + xmlPath, validationStatus });
          const key = recordId + ":" + (prior ? "pfy" : "cfy");
          sourceDocuments.set(facts.at(-1)!, key);
          let period = byPeriod.get(key);
          if (!period) {
            period = { effectiveRevisionId:revision.id, revisionStatus:revision.status, from: periodStart, to: periodEnd, scope: scope === "UNIT" ? "standalone" : "consolidated", documentId: key, accountingStandard: documents.get(recordId)?.standard, accountingStandardBasis: documents.get(recordId)?.standardBasis, isIasCompliant: documents.get(recordId)?.isIasCompliant, xmlSchema: { name: documents.get(recordId)?.schemaName ?? null, version: documents.get(recordId)?.schemaVersion ?? null }, facts: [] };
            byPeriod.set(key, period);
            periods.push(period);
          }
          (period.facts as { metricCode: string; amount: string; currency: string; unit: string }[]).push({ metricCode, amount: numeric, currency: "PLN", unit: unitCode });
        }
      }
      for (const [sectionName, sectionFields] of Object.entries(dictionary)) {
      const section = obj(sectionFields);
      if (!section || !/^[a-z]{2,8}$/.test(sectionName)) continue;
      for (const [sourceKey, rawValue] of Object.entries(section)) {
        const match = /^([a-z][a-z0-9_]{0,70})_(cfy|pfy|cpfy)$/.exec(sourceKey);
        const numeric = amount(rawValue);
        if (!match || numeric === null) continue;
        const prior = match[2] !== "cfy";
        const periodStart = prior ? previousYear(from) : from;
        const periodEnd = prior ? previousYear(to) : to;
        const metricCode = `${sectionName}_${match[1]}`.toUpperCase();
        if (metricCode.length > 80) continue;
        const unitCode = unitFor(metricCode, numeric, match[2] === "cpfy" ? "RESTATED_UNCONFIRMED" : prior ? "KwotaB" : "KwotaA", dictionaryName);
        const validationStatus = unitCode === "PLN" ? "VALID" : "REVIEW";
        if (match[2] === "cpfy") {
          if (!restated.some(f => f.metricCode === metricCode)) restated.push({ metricCode, amount: numeric, currency: "PLN", unit: unitCode });
          continue;
        }
        const unique = `${scope}:${periodStart}:${periodEnd}:${metricCode}`;
        if (owners.get(`${scope}:${periodStart}:${periodEnd}`) !== recordId || seen.has(unique)) continue;
        seen.add(unique);
        const periodType = periodStart.slice(0, 4) === periodEnd.slice(0, 4) && periodStart.endsWith("-01-01") && periodEnd.endsWith("-12-31") ? "YEAR" : "OTHER";
        const fact: FinancialSourceFact = {
          metricCode, periodStart, periodEnd, periodType, statementScope: scope,
          amount: numeric, sourceAmount: numeric, normalizationRule: "SOURCE_VALUE", currencyCode: "PLN", unitCode,
          sourcePath: `content.${dictionaryName}.${sectionName}.${sourceKey}`,
          validationStatus,
        };
        facts.push(fact);
        const key = `${recordId}:${prior ? "pfy" : "cfy"}`;
        sourceDocuments.set(fact, key);
        let period = byPeriod.get(key);
        if (!period) {
          period = { effectiveRevisionId:revision.id, revisionStatus:revision.status, from: periodStart, to: periodEnd, scope: scope === "UNIT" ? "standalone" : "consolidated", documentId: key, accountingStandard: documents.get(recordId)?.standard, accountingStandardBasis: documents.get(recordId)?.standardBasis, isIasCompliant: documents.get(recordId)?.isIasCompliant, xmlSchema: { name: documents.get(recordId)?.schemaName ?? null, version: documents.get(recordId)?.schemaVersion ?? null }, facts: [] };
          byPeriod.set(key, period);
          periods.push(period);
        }
        (period.facts as { metricCode: string; amount: string; currency: string; unit: string }[]).push({ metricCode, amount: numeric, currency: "PLN", unit: unitCode });
      }
      }
    }
    if (restated.length && owners.get(`${scope}:${previousYear(from)}:${previousYear(to)}`) === recordId) {
      let priorPeriod = byPeriod.get(`${recordId}:pfy`);
      if (!priorPeriod) {
        priorPeriod = { from: previousYear(from), to: previousYear(to), scope: scope === "UNIT" ? "standalone" : "consolidated", documentId: `${recordId}:pfy`, facts: [], effectiveRevisionId: revision.id, revisionStatus: revision.status, accountingStandard: documentMetadata?.standard };
        periods.push(priorPeriod);
      }
      const original = structuredClone(priorPeriod.facts);
      const differs = restated.some(r => !original.some(o => o.metricCode === r.metricCode && o.unit === r.unit && equalAmounts(o.amount,r.amount)));
      priorPeriod.comparativeData = { original, restated, selected: differs ? "UNRESOLVED" : "ORIGINAL",
        dateBasis: from.endsWith("-01-01") && to.endsWith("-12-31") ? "CALENDAR_PREVIOUS_YEAR" : "UNCONFIRMED" };
    }
  }
  if (!facts.length && !periods.some(p=>p.comparativeData?.restated.length)) {
    const availability = [...documents.values()].map((document) => document.availability);
    const warning = availability.length && availability.every(value => value === "NO_XML") ? "MGBI_FINANCIAL_NO_XML" : availability.includes("UNSUPPORTED_XML") ? "MGBI_FINANCIAL_UNSUPPORTED_XML" : availability.includes("UNKNOWN_FORMAT") ? "MGBI_FINANCIAL_UNKNOWN_FORMAT" : NO_FINANCIAL_FACTS;
    return empty("EMPTY", retrievedAt, warning, null);
  }
  for (const period of periods) {
    const document = documents.get(period.documentId.replace(/:(cfy|pfy)$/, ""));
    const registration = financialRegistration(document?.sourceKrs,history);
    if (registration) period.sourceRegistration=registration;
  }
  const identityMetadata={ qualityRule: FINANCIAL_QUALITY_RULE, ...(history?{registryHistoryVersion:COMPANY_IDENTITY_VERSION}:{}) };
  const sourceData: FinancialData = structuredClone({ periods, revisionRule:FINANCIAL_REVISION_RULE,...identityMetadata });
  const unverifiedCosts = reconcileCosts(periods, facts, sourceDocuments);
  const incomplete = totalCount > records.length;
  return {
    section: {
      status: incomplete ? "PARTIAL" : "SUCCESS",
      source: { ...SOURCE, recordId: string(field(selected[0], "id")) },
      retrievedAt,
      effectiveAt: date(field(selected[0], "document", "period_to_date")),
      data: { periods, revisionRule:FINANCIAL_REVISION_RULE,...identityMetadata },
      warnings: [...(incomplete ? ["MGBI_SEARCH_RESULT_LIMIT"] : []), ...(unverifiedCosts ? ["MGBI_COST_SIGN_UNVERIFIED"] : [])],
    },
    sourceData,
    facts,
    errorCode: null,
  };

 })
}

export async function fetchMgbiFinancial(identifier: CompanyIdentifier, options: MgbiGeneralOptions & {companyHistory?:RegistryHistory} = {}): Promise<MgbiFinancialResult> {
  if (!/^[0-9]{10}$/.test(identifier.value) || (identifier.type !== "NIP" && identifier.type !== "KRS")) throw new Error("A valid ten-digit NIP or KRS is required");
  const key = options.apiKey ?? process.env.MGBI_API_KEY;
  if (!key?.trim()) throw new Error("MGBI_API_KEY is required");
  const scheme = options.authScheme ?? (process.env.MGBI_AUTH_SCHEME === "bearer" ? "bearer" : "raw");
  const url = new URL(`/v1/models/${MODEL}/records`, options.baseUrl ?? "https://api.mgbi.pl");
  url.searchParams.set(identifier.type === "NIP" ? "identifiers.pl_nip" : "identifiers.pl_krs", identifier.value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  const now = options.now ?? (() => new Date());
  let mapping = false;
  try {
    // No structured-field filter: the archive must retain every RDF record returned for this NIP,
    // including statements that cannot yet be mapped into SRM financial facts.
    const response = await fetchMgbiPages(url,
      { Accept: "application/json", Authorization: scheme === "bearer" ? `Bearer ${key.trim()}` : key.trim() },
      controller.signal, options.fetcher);
    const retrievedAt = now().toISOString();
    if (response.errorCode) return empty("ERROR", retrievedAt, `MGBI_${response.errorCode}`, response.errorCode);
    mapping = true;
    const eligible = options.companyHistory ? response.records.filter(r=>options.companyHistory!.members.some(m=>m.krs===field(r,"identifiers","pl_krs"))) : response.records;
    const mapped = mapMgbiFinancialRecords(response.records, identifier, retrievedAt, response.count,options.companyHistory);
    const result = mapped.section.status === "EMPTY" && isInternationalStatementWithoutFacts(eligible, identifier, eligible.length)
      ? empty("EMPTY", retrievedAt, INTERNATIONAL_STATEMENT, null) : mapped;
    return { ...result, rawResponse: { pages: response.pages, recordCount: response.count } };
  } catch (error) {
    const timeout = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    const code = timeout ? "TIMEOUT" : mapping ? "MAPPING_ERROR" : "NETWORK_ERROR";
    return empty("ERROR", now().toISOString(), `MGBI_${code}`, code);
  } finally { clearTimeout(timer); }
}

/** Offline reconstruction from the tenant's verified archive. No provider call,
 * no source receipt deletion, and no implicit cross-version gap filling. */
export async function reprojectFinancialArchive(organizationId:string,nip:string,history?:RegistryHistory,pool?:DatabasePool,includeOriginalResponse=false):Promise<MgbiFinancialResult|null> {
 return diagnosticRun('ARCHIVE_REPROJECT',async ()=>{
  return withOrganization(organizationId,async client=>{
    const row=(await client.query<FinancialArchive & {retrieved_at:Date|string}>(
      "SELECT organization_id,nip,model,payload_json::text AS payload_text,payload_jsonb_sha256,record_count,last_checked_at AS retrieved_at FROM srm.mgbi_source_archives WHERE organization_id=$1 AND nip=$2 AND model='pl-krs-rdf-record'",[organizationId,nip])).rows[0];
    if(!row)return null;
    projectArchivedFinancialDocuments(row,organizationId,nip);
    const pages=JSON.parse(row.payload_text).pages;
    const result=mapMgbiFinancialRecords(financialRecordsFromPages(pages),{type:"NIP",value:nip},new Date(row.retrieved_at).toISOString(),row.record_count,history);
    return includeOriginalResponse?{...result,rawResponse:{pages,recordCount:row.record_count}}:result;
  },pool);

 })
}
