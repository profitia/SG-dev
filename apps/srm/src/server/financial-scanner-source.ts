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

export const SCANNER_SOURCE_RULE = "XML_SOURCE_BASIS_V2" as const;
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
        doc.correction !== false
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
          d.scope === p.scope &&
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
      // A later selected comparative column is an explicit restatement, never an extra observation.
      // Competing same-period filings and correction flags need a correction lineage adapter, not completeness ranking.
      if (
        candidates.some(
          (d) => d.correction !== false || d.filingDate! > doc.filingDate!,
        ) ||
        candidates.some(
          (d) => d.recordId !== doc.recordId && d.filingDate === doc.filingDate,
        )
      )
        return reject("SOURCE_REVISION_UNRESOLVED");
      if (
        candidates.some((d, i) =>
          candidates.some(
            (e, j) => j < i && d.from === e.from && d.to === e.to,
          ),
        )
      )
        return reject("SOURCE_REVISION_UNRESOLVED");
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
      const base = `POLISH_UOR:${p.scope}:PLN:${p.from.slice(5)}:${p.to.slice(5)}`;
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
