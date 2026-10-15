import { createHash } from "node:crypto";
import type { FinancialData, FinancialPeriod } from "@profitia/srm-xray";
import type { FinancialSourceDocument } from "./financial-documents";
import type { FinancialSourceFact, MgbiFinancialResult } from "./mgbi-financial";
import { MSR_MAPPING_VERSION, type MsrFact, type MsrParsed } from "./msr-parser";
import type { MsrOriginal } from "./msr-source";

export const MSR_PROJECTION_VERSION = "2026-10-15-msr-projection-v2";

// Equivalences are deliberately narrow. An issuer's extension/anchor is never an alias.
// In particular IFRS Revenue is not necessarily UoR net sales: retain its own code.
const METRICS: Readonly<Record<string, string>> = {
  Assets: "BS_A_TA", Equity: "BS_LAE_E", Liabilities: "BS_LAE_LAPFL",
  CurrentAssets: "BS_A_CA", NoncurrentAssets: "BS_A_NCA", CurrentLiabilities: "BS_LAE_LAPFL_STL",
  NoncurrentLiabilities: "BS_LAE_LAPFL_LTL", Inventories: "BS_A_CA_INV",
  CashAndCashEquivalents: "BS_CASH", Revenue: "MSR_REVENUE", ExpenseByNature: "MSR_OPERATING_COSTS",
  ProfitLoss: "PALA_NPL", ProfitLossFromOperatingActivities: "PALA_PLFOA",
  CashFlowsFromUsedInOperatingActivities: "CFS_OPERATING_CASH_FLOW",
};
const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export type MsrCandidate = { recordId: string; nip: string; from: string; to: string;
  scope: FinancialPeriod["scope"]; filingDate: string | null; correction: boolean | null; documentId: string | null };

/** Latest filing per independent scope. Older periods disclosed in that filing are retained.
 * At most two paid originals per lookup; never download every historical filing speculatively. */
export function selectMsrCandidates(records: readonly unknown[], nip: string): MsrCandidate[] {
  const candidates = records.flatMap(raw => {
    const r = obj(raw), d = obj(r.document), original = obj(obj(obj(r.files).main_document).original);
    if (obj(r.identifiers).pl_nip !== nip
        || !["financial_statement", "consolidated_financial_statement"].includes(String(d.type))
        || typeof r.id !== "string" || !/^[a-f0-9]{24}$/.test(r.id)
        || typeof d.period_from_date !== "string" || typeof d.period_to_date !== "string"
        || !/^\d{4}-\d{2}-\d{2}$/.test(d.period_from_date) || !/^\d{4}-\d{2}-\d{2}$/.test(d.period_to_date)
        || d.period_from_date > d.period_to_date) return [];
    return [{ recordId: r.id, nip, from: d.period_from_date, to: d.period_to_date,
      scope: d.type === "financial_statement" ? "standalone" as const : "consolidated" as const,
      filingDate: typeof d.filing_date === "string" ? d.filing_date : null, correction: typeof d.is_correction === "boolean" ? d.is_correction : null,
      documentId: typeof d.document_id === "string" || typeof d.document_id === "number" ? String(d.document_id) : null,
      ias: d.is_ias_compliant === true,
      excludedPdf: typeof original.content_type === "string" && original.content_type.toLowerCase().split(";")[0].trim() === "application/pdf" }];
  }).sort((a,b) => b.to.localeCompare(a.to) || (b.filingDate ?? "").localeCompare(a.filingDate ?? "")
    || Number(b.correction)-Number(a.correction) || a.recordId.localeCompare(b.recordId));
  // Decide the current filing first. A historical IAS flag cannot justify a paid
  // download when that scope has since moved to UoR, an unknown basis or PDF.
  return candidates.filter((c,i) => candidates.findIndex(v => v.scope === c.scope) === i && c.ias && !c.excludedPdf)
    .map(({excludedPdf:_,ias:__,...c})=>c);
}

export type MsrProjection = { parsed?:MsrParsed; data: FinancialData; facts: FinancialSourceFact[]; document: FinancialSourceDocument; retrievedAt:string };
export function projectMsrFinancial(candidate: MsrCandidate, original: MsrOriginal, parsed: MsrParsed): MsrProjection {
  if (original.recordId !== candidate.recordId || parsed.sourceChecksum !== original.checksum || parsed.standard !== "IAS_IFRS"
      || new Set(parsed.contexts.map(c => c.scheme + ":" + c.entity)).size !== 1)
    throw new Error("MSR_SOURCE_IDENTITY_MISMATCH");
  const positioned = parsed.sourceType === "POSITIONED_XHTML";
  const standardBasis = positioned ? "MGBI_IAS_FLAG_AND_XHTML_PRIMARY_CELLS_V1" : "MGBI_IAS_FLAG_AND_IXBRL_CONTEXTS_V1";
  const durations = parsed.contexts.filter(c => !c.instant && !Object.keys(c.dimensions).length && c.from && c.to <= candidate.to);
  if (!durations.some(c => c.from === candidate.from && c.to === candidate.to)) throw new Error("MSR_PERIOD_IDENTITY_MISMATCH");
  const keys = [...new Set(durations.map(c => c.from + ":" + c.to))].sort().reverse();
  const facts: FinancialSourceFact[] = [], periods: FinancialPeriod[] = [];
  const rows: FinancialSourceDocument["rows"] = [];
  const metricEvidence: NonNullable<FinancialSourceDocument["metricEvidence"]> = [];
  const columns: FinancialSourceDocument["columns"] = [];
  for (const key of keys) {
    const [from,to] = key.split(":"), duration = parsed.contexts.filter(c => !c.instant && c.from === from && c.to === to);
    const contexts = parsed.contexts.filter(c => duration.includes(c) || c.instant && c.to === to);
    const unique = new Map<string, MsrFact>();
    for (const f of parsed.facts) if (f.numeric && contexts.some(c => c.id === f.contextRef)) {
      const c = contexts.find(c => c.id === f.contextRef)!;
      const identity = f.concept + ":" + JSON.stringify(c.dimensions) + ":" + f.unitRef + ":" + c.instant;
      const previous = unique.get(identity);
      if (!previous) unique.set(identity,f);
      else if (previous.amount !== f.amount || previous.validation !== "VALID" || f.validation !== "VALID")
        unique.set(identity,{...previous,amount:null,validation:"REVIEW",reason:"MSR_EQUIVALENT_CONTEXT_CONFLICT"});
    }
    if (!unique.size) continue;
    const numericRows: NonNullable<FinancialPeriod["msrRows"]>[number][] = [];
    const mapped = new Map<string, { f: MsrFact; currency: string }[]>();
    for (const f of unique.values()) {
      const c = contexts.find(c => c.id === f.contextRef)!, u = parsed.units.find(u => u.id === f.unitRef);
      const dimensions = Object.entries(c.dimensions).map(([axis,member]) => axis + " = " + member);
      const rowKey = createHash("sha256").update(f.concept + JSON.stringify(c.dimensions) + (c.instant ? "I" : "D") + ":" + f.unitRef).digest("hex").slice(0,24);
      // Segment/typed dimensions and note payloads stay in the private fact archive.
      for (const section of dimensions.length ? [] : f.statements.length ? f.statements : ["Other" as const]) numericRows.push({
        key: rowKey, label: f.label, section, amount: f.amount, currency: u?.denominator ? null : u?.currency ?? null,
        unit: u ? u.measure + (u.denominator ? "/" + u.denominator : "") : "UNKNOWN", validation: f.validation, dimensions,
      });
      const code = /^https?:\/\/xbrl\.ifrs\.org\/taxonomy\/\d{4}-\d{2}-\d{2}\/ifrs-full$/.test(f.namespace) || (parsed.sourceType === "POSITIONED_XHTML" && f.namespace === "urn:profitia:msr:positioned-xhtml-primary:v1") ? METRICS[f.localName] : undefined;
      if (code && (code !== "MSR_OPERATING_COSTS" || f.statements.includes("RZiS")) && code.startsWith("BS_") === c.instant && !dimensions.length && f.validation === "VALID" && f.amount !== null && u?.currency && !u.denominator
          && /^-?\d{1,20}(?:\.\d{1,4})?$/.test(f.amount)) {
        const group = mapped.get(code) ?? []; group.push({ f, currency: u.currency }); mapped.set(code,group);
      }
    }
    const publicFacts: FinancialPeriod["facts"][number][] = [];
    for (const [code, values] of mapped) {
      // Multiple units or different contexts for the same metric are not silently selected.
      if (new Set(values.map(v => v.f.amount + ":" + v.currency)).size !== 1) continue;
      const { f,currency } = values[0];
      publicFacts.push({ metricCode: code, amount: f.amount!, currency, unit: currency });
      metricEvidence.push({code,from,to,value:f.amount!,currency,concept:f.concept,contextRef:f.contextRef,factId:f.id,
        semanticBasis:f.localName});
      const days = (Date.parse(to) - Date.parse(from))/86400000 + 1;
      facts.push({ metricCode: code, amount: f.amount!, sourceAmount: f.amount!, normalizationRule: "SOURCE_VALUE",
        periodStart: from, periodEnd: to, periodType: days >= 350 && days <= 380 ? "YEAR" : "OTHER",
        statementScope: candidate.scope === "standalone" ? "UNIT" : "CONSOLIDATED", currencyCode: currency, unitCode: currency,
        sourcePath: candidate.recordId + (positioned ? ".XHTML." : ".iXBRL.") + f.id, validationStatus: "VALID" });
    }
    const sourceColumn = from === candidate.from && to === candidate.to ? "cfy" : "period_" + from + "_" + to;
    columns.push({ sourceColumn, role: sourceColumn === "cfy" ? "CURRENT" : "COMPARATIVE", from,to,basis:positioned ? "XHTML_EXPLICIT_PRIMARY_COLUMNS" : "XBRL_EXPLICIT_CONTEXT" });
    for (const row of numericRows.filter(r => !r.dimensions.length && ["Bilans","RZiS"].includes(r.section))) {
      let stored = rows.find(r => r.sourcePath === row.key && r.section === row.section);
      if (!stored) { stored = {section:row.section as "Bilans"|"RZiS",sourcePath:row.key,label:row.label,depth:0,amounts:{}}; rows.push(stored); }
      stored.amounts[sourceColumn] = row.validation === "VALID" ? row.amount : null;
    }
    periods.push({ accountingStandard:"IAS_IFRS", accountingStandardBasis:standardBasis, isIasCompliant:true,
      from,to,scope:candidate.scope,documentId:candidate.recordId + ":" + (sourceColumn === "cfy" ? "cfy" : "pfy"), facts:publicFacts, msrRows:numericRows });
  }
  if (!periods.some(p => p.from === candidate.from && p.to === candidate.to && p.msrRows?.length)) throw new Error("MSR_NO_NUMERIC_STATEMENT");
  const currencies = [...new Set(periods.flatMap(p => p.msrRows?.map(r => r.currency).filter(Boolean) ?? []))];
  return { parsed, data:{periods}, facts, retrievedAt:original.retrievedAt, document:{ recordId:candidate.recordId,documentId:candidate.documentId,scope:candidate.scope,
    from:candidate.from,to:candidate.to,standard:"IAS_IFRS",isIasCompliant:true,standardBasis,
    provider:"MGBI",model:"pl-krs-rdf-record",format:"XHTML",availability:parsed.sourceType === "POSITIONED_XHTML" ? "XHTML_SUPPORTED" : "IXBRL_SUPPORTED",formatBasis:parsed.sourceType === "POSITIONED_XHTML" ? "LICENSED_ORIGINAL_POSITIONED_XHTML" : "LICENSED_ORIGINAL_IXBRL",
    schemaName:parsed.sourceType === "POSITIONED_XHTML" ? "POSITIONED_XHTML" : "ESEF/iXBRL",schemaVersion:MSR_MAPPING_VERSION,currency:currencies.length === 1 ? currencies[0] : null,
    scale:"1",correction:candidate.correction,filingDate:candidate.filingDate,checksum:original.checksum,mappingVersion:MSR_PROJECTION_VERSION,
    validation:parsed.warnings.length ? "REVIEW" : "VALID",columns,rows,metricEvidence } };
}

export function mergeMsrFinancial(base: MgbiFinancialResult, projections: readonly MsrProjection[], warnings: readonly string[]): MgbiFinancialResult {
  warnings = [...warnings,...projections.some(p=>p.data.periods.some(period=>period.msrRows?.some(r=>r.validation === "REVIEW"))) ? ["MSR_UNVERIFIED_SOURCE_VALUES"] : []];
  if (!projections.length) return warnings.length ? {...base,section:{...base.section,warnings:[...new Set([...base.section.warnings,...warnings])]}} : base;
  const projectedPeriods = projections.flatMap(p => p.data.periods);
  const periods = [...projectedPeriods, ...(base.section.data?.periods ?? []).filter(p =>
    !projectedPeriods.some(n => n.scope===p.scope && n.from===p.from && n.to===p.to))];
  const data = {periods,revisionRule:"FINANCIAL_REVISIONS_V1"};
  return {...base,sourceData:data,facts:[...base.facts.filter(f=>!projections.some(p=>p.data.periods.some(period=>period.from===f.periodStart && period.to===f.periodEnd && (period.scope==="standalone"?"UNIT":"CONSOLIDATED")===f.statementScope))),...projections.flatMap(p => p.facts)],errorCode:null,section:{...base.section,status:warnings.length ? "PARTIAL" : "SUCCESS",data,
    retrievedAt:[base.section.retrievedAt ?? "",...projections.map(p=>p.retrievedAt)].sort().at(-1)!,
    warnings:[...new Set([...base.section.warnings.filter(w => !["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS","MGBI_NO_STRUCTURED_FINANCIAL_DATA","MGBI_FINANCIAL_UNKNOWN_FORMAT","MGBI_FINANCIAL_UNSUPPORTED_XML","MGBI_FINANCIAL_NO_XML"].includes(w)),...warnings])]} };
}
