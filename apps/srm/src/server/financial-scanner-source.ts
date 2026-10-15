import { createHash } from "node:crypto";
import type {
  FinancialPeriod,
  ScannerAxisCode,
  SupplierReportData,
} from "@profitia/srm-xray";
import {
  FINANCIAL_DOCUMENT_MAPPING_VERSION,
  type FinancialSourceDocument,
} from "./financial-documents";

import { resolveDocumentFamily } from "./financial-revisions";
import { MSR_PROJECTION_VERSION } from "./msr-financial";

export const SCANNER_SOURCE_RULE = "FINANCIAL_SOURCE_BASIS_V3" as const;
export type ScannerSourceEvidence = Record<
  string,
  {
    reason: string | null;
    evidenceRef: string | null;
    basis: Partial<Record<ScannerAxisCode, string>>;
    costs: string | null;
  }
>;
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const amount = (s: string | null | undefined): bigint | null => {
  if (s == null || !/^-?\d{1,24}(?:\.\d{1,6})?$/.test(s)) return null;
  const [w, f = ""] = s.replace(/^-/, "").split(".");
  const n = BigInt(w) * 1_000_000n + BigInt(f.padEnd(6, "0"));
  return s.startsWith("-") ? -n : n;
};
const id = (p: { scope: string; from: string; to: string }) =>
  `${p.scope}:${p.from}:${p.to}`;
const annual = (p: { from: string | null; to: string | null }) =>
  !!p.from &&
  !!p.to &&
  [365, 366].includes((Date.parse(p.to) - Date.parse(p.from)) / 86400000 + 1);
const prior = (date: string) =>
  `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`;
const path = (s: string) => s.replaceAll(">", ".");

/** Narrow audited UoR XML adapter. No inference from metric names, amount size or NIP.
 * Unresolved standards, revisions, source dates and unsupported variants stay unavailable.
 * Current/prior columns are matched to the already mapped exact annual period and facts.
 */
export function qualifyScannerSources(
  financial: SupplierReportData["financial"],
  selected: readonly FinancialPeriod[],
  documents: readonly FinancialSourceDocument[],
  asOf: string,
): ScannerSourceEvidence {
  return Object.fromEntries(
    financial.periods.map((p) => {
      const result: ScannerSourceEvidence[string] = {
        reason: "SOURCE_DOCUMENT_UNAVAILABLE",
        evidenceRef: null,
        basis: {},
        costs: null,
      };
      const original = selected.find((x) => id(x) === id(p));
      const recordId = original?.documentId.replace(/:(cfy|pfy)$/, "");
      const doc = documents.find(
        (d) => d.recordId === recordId && d.scope === p.scope,
      );
      const reject = (reason: string) =>
        [id(p), { ...result, reason }] as const;
      if (!doc || !original) return reject("SOURCE_DOCUMENT_UNAVAILABLE");
      if (!annual(p) || !annual(doc)) return reject("NON_ANNUAL_PERIOD");
      const family = documents.filter(d => d.sourceKrs === doc.sourceKrs && d.scope === doc.scope && d.from === doc.from && d.to === doc.to && d.filingDate && d.filingDate <= asOf.slice(0,10));
      const revision = resolveDocumentFamily(family);
      if (doc.standard === "IAS_IFRS") return [id(p), qualifyMsrPeriod(p, doc, revision, asOf)];
      if (
        doc.mappingVersion !== FINANCIAL_DOCUMENT_MAPPING_VERSION ||
        doc.validation !== "VALID" ||
        doc.availability !== "XML_SUPPORTED" ||
        !/^[a-f0-9]{64}$/.test(doc.checksum)
      )
        return reject("UNVERIFIED_SOURCE");
      if (doc.standard !== "POLISH_UOR")
        return reject("ACCOUNTING_STANDARD_UNCONFIRMED");
      if (
        doc.currency !== "PLN" ||
        doc.scale !== "1" ||
        (doc.schemaName !== "JednostkaInnaWZlotych" &&
          doc.schemaName !== "SkonsolidowanaJednostkaInnaWZlotych")
      )
        return reject("UNSUPPORTED_SOURCE_BASIS");
      if (
        !doc.filingDate ||
        doc.filingDate > asOf.slice(0, 10) ||
        revision.status !== "RESOLVED"
      )
        return reject("SOURCE_REVISION_UNRESOLVED");
      const comparative = original.documentId.endsWith(":pfy");
      // Prior-column dating is supported only for a complete calendar year. Other fiscal years require explicit comparative dates.
      if (
        comparative
          ? !doc.from!.endsWith("-01-01") ||
            !doc.to!.endsWith("-12-31") ||
            p.from !== prior(doc.from!) ||
            p.to !== prior(doc.to!)
          : p.from !== doc.from || p.to !== doc.to
      )
        return reject("SOURCE_PERIOD_UNCONFIRMED");
      const candidates = documents.filter(
        (d) =>
          d.sourceKrs === doc.sourceKrs && d.scope === p.scope &&
          d.from &&
          d.to &&
          d.filingDate &&
          d.filingDate <= asOf.slice(0, 10) &&
          ((d.from === p.from && d.to === p.to) ||
            (d.from.endsWith("-01-01") &&
              d.to.endsWith("-12-31") &&
              prior(d.from) === p.from &&
              prior(d.to) === p.to)),
      );
      // Equivalent filings do not create additional observations. A later report
      // may explicitly restate a comparative column, but cannot mix its missing fields.
      if (candidates.some(d => d.filingDate! > doc.filingDate! && (d.from !== doc.from || d.to !== doc.to)))
        return reject("SOURCE_REVISION_UNRESOLVED");
      for (const candidate of candidates) {
        const group = candidates.filter(d => d.from === candidate.from && d.to === candidate.to);
        if (resolveDocumentFamily(group).status !== "RESOLVED") return reject("SOURCE_REVISION_UNRESOLVED");
      }
      const column = comparative ? "KwotaB" : "KwotaA";
      const rows = new Map(
        doc.rows.map((r) => [path(r.sourcePath), amount(r.amounts[column])]),
      );
      // A duplicated path is ambiguous even when its values happen to agree.
      const seen = new Set<string>();
      for (const row of doc.rows) {
        const key = path(row.sourcePath);
        if (seen.has(key)) rows.set(key, null);
        seen.add(key);
      }
      const hasPor = [...rows.keys()].some((key) => key.startsWith("RZiS.RZiSPor."));
      const hasKalk = [...rows.keys()].some((key) => key.startsWith("RZiS.RZiSKalk."));
      const match = (code: string, xml: string, cost = false) => {
        const f = p.facts.find((f) => f.metricCode === code),
          x = rows.get(xml),
          v = amount(f?.amount);
        return (
          !!f &&
          f.validation === "VERIFIED" &&
          f.scope === p.scope &&
          f.periodStart === p.from &&
          f.periodEnd === p.to &&
          f.documentRef === p.documentRef &&
          f.currency === "PLN" &&
          f.unit === "PLN" &&
          x != null &&
          v != null &&
          (cost
            ? f.normalization === "NORMALIZED_CONFIRMED" &&
              f.normalizationRule === "VERIFIED_COST_MAGNITUDE_V1" &&
              amount(f.sourceAmount) === x &&
              v === (x < 0n ? -x : x)
            : v === x)
        );
      };
      const base = `POLISH_UOR:${p.scope}:PLN:${p.from.slice(5)}:${p.to.slice(5)}` + (doc.sourceKrs ? `:KRS:${doc.sourceKrs}` : "");
      const basis: ScannerSourceEvidence[string]["basis"] = {};
      if (hasPor && !hasKalk && match("PALA_NPL", "RZiS.RZiSPor.L"))
        basis.NET_RESULT = base + ":NET_RESULT";
      if (hasPor && !hasKalk && match("PALA_NRFS", "RZiS.RZiSPor.A")) {
        basis.REVENUE = base + ":SALES_AND_EQUIVALENTS";
        if (match("PALA_PLFOA", "RZiS.RZiSPor.F"))
          basis.OPERATING_MARGIN =
            base + ":OPERATING_RESULT:SALES_AND_EQUIVALENTS";
        const a = rows.get("RZiS.RZiSPor.A"),
          b = rows.get("RZiS.RZiSPor.B"),
          c = rows.get("RZiS.RZiSPor.C");
        if (
          match("PALA_OAC", "RZiS.RZiSPor.B", true) &&
          a != null &&
          b != null &&
          c != null &&
          a - (b < 0n ? -b : b) === c
        ) {
          basis.OPERATING_COST_RATIO =
            base + ":COMPARATIVE_BASIC_OPERATING_COSTS:SALES_AND_EQUIVALENTS";
          result.costs = p.facts.find(
            (f) => f.metricCode === "PALA_OAC",
          )!.amount;
        }
      }
      // MF full UoR schemas: consolidated O is negative goodwill, not net result.
      const calculationSchema = ["1-0", "1-1", "1-0E", "1-2", "1-3"].includes(doc.schemaVersion ?? "") &&
        doc.schemaName === (p.scope === "consolidated" ? "SkonsolidowanaJednostkaInnaWZlotych" : "JednostkaInnaWZlotych");
      if (hasKalk && !hasPor && calculationSchema) {
        const netPath = p.scope === "consolidated" ? "RZiS.RZiSKalk.W" : "RZiS.RZiSKalk.O";
        if (match("PALA_NPL", netPath))
          basis.NET_RESULT = base + ":NET_RESULT";
        if (match("PALA_NRFS", "RZiS.RZiSKalk.A")) {
          // Sales-only is deliberately not comparable with comparative A (sales + equivalents).
          basis.REVENUE = base + ":SALES_ONLY";
          if (match("PALA_PLFOA", "RZiS.RZiSKalk.I"))
            basis.OPERATING_MARGIN = base + ":OPERATING_RESULT:SALES_ONLY";
          const costs = calculationCosts(rows);
          if (costs !== null) {
            basis.OPERATING_COST_RATIO =
              base + ":CALCULATION_BASIC_OPERATING_COSTS:SALES_ONLY";
            result.costs = `${costs / 1_000_000n}.${String(costs % 1_000_000n).padStart(6, "0")}`;
          }
        }
      }
      // The balance sheet is independent of the presence/variant/quality of P&L rows.
      if (
        match("BS_LAE_LAPFL", "Bilans.Pasywa.Pasywa_B") &&
        match("BS_A_TA", "Bilans.Aktywa")
      )
        basis.LIABILITIES_TO_ASSETS =
          base + ":LIABILITIES_AND_PROVISIONS:TOTAL_ASSETS";
      if (
        match("BS_A_CA", "Bilans.Aktywa.Aktywa_B") &&
        match("BS_LAE_LAPFL_STL", "Bilans.Pasywa.Pasywa_B.Pasywa_B_III")
      )
        basis.CURRENT_RATIO = base + ":CURRENT_RATIO";
      return [
        id(p),
        {
          ...result,
          reason: null,
          basis,
          evidenceRef: hash([
            SCANNER_SOURCE_RULE,
            doc.checksum,
            doc.mappingVersion,
            doc.filingDate,
            revision.id,
            column,
            p.from,
            p.to,
            basis,
          ]),
        },
      ];
    }),
  );
}

/** Explicit XML calculation-variant mapping, scoped to one qualified document/column.
 * Non-negative B/D/E are source expense magnitudes: never infer them from margin or
 * substitute the catalog's PALA_OAC/COGS. Negative presentation requires exact
 * reconciliation of both subtotals before any sign normalization. Missing != zero.
 */
function calculationCosts(rows: Map<string, bigint | null>): bigint | null {
  const get = (letter: string) => rows.get(`RZiS.RZiSKalk.${letter}`);
  const b = get("B"), d = get("D"), e = get("E");
  if (b == null || d == null || e == null) return null;
  if (b >= 0n && d >= 0n && e >= 0n) return b + d + e;
  const a = get("A"), c = get("C"), f = get("F");
  const magnitude = (n: bigint) => n < 0n ? -n : n;
  // Uniform non-positive presentation only; mixed signs may be real reversals.
  if ([b, d, e].some((n) => n > 0n) || a == null || c == null || f == null ||
      a - magnitude(b) !== c || c - magnitude(d) - magnitude(e) !== f) return null;
  return magnitude(b) + magnitude(d) + magnitude(e);
}

/** Explicit iXBRL concepts and contexts, never amount/name heuristics or issuer
 * extension aliases. Missing current liabilities must not become total liabilities. */
function qualifyMsrPeriod(p: SupplierReportData["financial"]["periods"][number], doc: FinancialSourceDocument,
  revision: ReturnType<typeof resolveDocumentFamily>, asOf:string): ScannerSourceEvidence[string] {
  const result:ScannerSourceEvidence[string] = {reason:null,evidenceRef:null,basis:{},costs:null};
  const reject = (reason:string) => ({...result,reason});
  if (doc.mappingVersion !== MSR_PROJECTION_VERSION || !["IXBRL_SUPPORTED","XHTML_SUPPORTED"].includes(doc.availability) ||
      !/^[a-f0-9]{64}$/.test(doc.checksum) || doc.scale !== "1") return reject("UNVERIFIED_SOURCE");
  if (!doc.filingDate || doc.filingDate > asOf.slice(0,10) || revision.status !== "RESOLVED") return reject("SOURCE_REVISION_UNRESOLVED");
  if (!doc.columns.some(c=>c.from===p.from && c.to===p.to && c.basis===(doc.schemaName==="POSITIONED_XHTML" ? "XHTML_EXPLICIT_PRIMARY_COLUMNS" : "XBRL_EXPLICIT_CONTEXT"))) return reject("SOURCE_PERIOD_UNCONFIRMED");
  const observations = doc.metricEvidence?.filter(e=>e.from===p.from && e.to===p.to) ?? [];
  const match = (code:string, concept:string) => {
    const evidence = observations.filter(e=>e.code===code && e.semanticBasis===concept &&
      (/^\{https?:\/\/xbrl\.ifrs\.org\/taxonomy\/\d{4}-\d{2}-\d{2}\/ifrs-full\}/.test(e.concept) || (doc.schemaName==="POSITIONED_XHTML" && e.concept.startsWith("{urn:profitia:msr:positioned-xhtml-primary:v1}"))));
    const facts = p.facts.filter(f=>f.metricCode===code);
    const e=evidence[0], f=facts[0];
    return evidence.length===1 && facts.length===1 && e.currency==="PLN" && f.validation==="VERIFIED" &&
      f.currency==="PLN" && f.unit==="PLN" && f.scope===p.scope && f.documentRef===p.documentRef &&
      f.periodStart===p.from && f.periodEnd===p.to && amount(f.amount)!==null && amount(f.amount)===amount(e.value);
  };
  const base = `IAS_IFRS:${doc.schemaName}:${p.scope}:PLN:${p.from.slice(5)}:${p.to.slice(5)}` + (doc.sourceKrs ? `:KRS:${doc.sourceKrs}` : "");
  if (match("PALA_NPL","ProfitLoss")) result.basis.NET_RESULT=base+":ProfitLoss";
  if (match("MSR_REVENUE","Revenue")) {
    result.basis.REVENUE=base+":Revenue";
    if(match("PALA_PLFOA","ProfitLossFromOperatingActivities")) result.basis.OPERATING_MARGIN=base+":ProfitLossFromOperatingActivities:Revenue";
    if(match("MSR_OPERATING_COSTS","ExpenseByNature")) {
      const value=observations.find(e=>e.code==="MSR_OPERATING_COSTS")!.value;
      if(amount(value)! >= 0n) {result.costs=value;result.basis.OPERATING_COST_RATIO=base+":ExpenseByNature:Revenue";}
    }
  }
  if(match("BS_A_TA","Assets") && match("BS_LAE_LAPFL","Liabilities")) result.basis.LIABILITIES_TO_ASSETS=base+":Liabilities:Assets";
  if(match("BS_A_CA","CurrentAssets") && match("BS_LAE_LAPFL_STL","CurrentLiabilities")) result.basis.CURRENT_RATIO=base+":CurrentAssets:CurrentLiabilities";
  result.evidenceRef=hash([SCANNER_SOURCE_RULE,doc.checksum,doc.mappingVersion,revision.id,p.from,p.to,observations,result.basis]);
  return result;
}
