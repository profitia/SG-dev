import { canonical, requireThat } from "@profitia/insights-contracts";

const text = value => typeof value === "string" && value.trim() === value &&
  value.length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
const validSeries = (s, asOf) => text(s.seriesId) && text(s.label) && text(s.provider) &&
  text(s.receiptRef) && Number.isFinite(s.value) &&
  typeof s.observationDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.observationDate) &&
  Number.isFinite(Date.parse(s.observationDate + "T00:00:00Z")) &&
  new Date(s.observationDate + "T00:00:00Z").toISOString().slice(0, 10) === s.observationDate &&
  typeof asOf === "string" && Number.isFinite(Date.parse(asOf)) &&
  s.observationDate <= asOf.slice(0, 10);

/** Exact aliases for authenticated canonical market reads already in the frozen
 * bundle. receiptRef is the existing read authorization decision, not a Hub
 * article ID or a new provider receipt. No raw history or model prose is added. */
export function canonicalMarketCitations(bundle) {
  const reserved = new Set([...(bundle.evidence ?? []).map(e => e.id), "FORECAST", "METHODOLOGY"]);
  const groups = new Map();
  for (const value of bundle.market?.series ?? []) {
    if (!text(value?.receiptRef)) continue;
    requireThat(!reserved.has(value.receiptRef), "UNVERIFIED_CITATION");
    const { history, ...summary } = value;
    const group = groups.get(value.receiptRef) ?? [];
    group.push(summary);
    groups.set(value.receiptRef, group);
  }
  const entries = [];
  for (const [ref, group] of groups) {
    // An incomplete or future observation cannot become a citable alias.
    if (!group.every(s => validSeries(s, bundle.asOf))) continue;
    const unique = new Map();
    for (const s of group) {
      requireThat(!unique.has(s.seriesId) || canonical(unique.get(s.seriesId)) === canonical(s), "UNVERIFIED_CITATION");
      unique.set(s.seriesId, s);
    }
    entries.push({ ref, series: [...unique.values()] });
  }
  return { schemaVersion: "CanonicalMarketCitations/1.0", evidenceFingerprint: bundle.fingerprint, entries };
}
