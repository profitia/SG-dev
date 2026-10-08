import type { ExecutiveSummaryInput, SummaryItem } from "./executive-summary-rules";
import { compactFinancialValue } from "./financial-value";
import { financialValue } from "./financial-history";

/** Format an already selected fact. Eligibility and priority remain in executiveSummary. */
export function snapshotFact(item: SummaryItem, input: ExecutiveSummaryInput): { label: string; value: string; exact: string; change: string | null } | null {
  const evidence = item.evidence;
  const labels: Record<string, string> = { revenue: "Przychody", net: "Wynik netto", "working-capital": "Kapitał obrotowy netto" };
  if (!evidence || !labels[item.id]) return null;
  if (evidence.kind === "source") return { label: labels[item.id], value: compactFinancialValue(evidence.fact.amount, "PLN"), exact: financialValue(evidence.fact.amount, "PLN"), change: null };
  const metadata = input.metadata;
  if (!metadata || metadata.nip !== input.nip || metadata.entityType !== input.entityType) return null;
  const periods = metadata.financial.periods.filter(period => period.scope === input.scope && period.from === input.selectedPeriod?.from && period.to === input.selectedPeriod?.to);
  if (periods.length !== 1) return null;
  const period = periods[0];
  const histories = metadata.financial.history.filter(history => history.code === evidence.code);
  if (histories.length !== 1) return null;
  const points = histories[0].points.filter(point => point.scope === period.scope && point.periodStart === period.from && point.periodEnd === period.to && point.documentRef === period.documentRef);
  if (points.length !== 1) return null;
  const point = points[0];
  if (evidence.code === "REVENUE_YOY") {
    const current = point.evidence.filter(fact => fact.metricCode === "PALA_NRFS" && fact.documentRef === period.documentRef && fact.scope === period.scope && fact.periodStart === period.from && fact.periodEnd === period.to);
    if (current.length !== 1 || point.comparison.status !== "COMPARABLE") return null;
    return { label: labels[item.id], value: compactFinancialValue(current[0].amount, "PLN"), exact: financialValue(current[0].amount, "PLN"), change: `Zmiana rok do roku: ${compactFinancialValue(point.value, "PERCENT")}` };
  }
  return { label: labels[item.id], value: compactFinancialValue(point.value, point.unit), exact: financialValue(point.value, point.unit), change: null };
}
