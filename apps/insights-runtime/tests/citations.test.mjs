// Controlled offline contracts only. No saved report, model output or provider call.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { SECTIONS, digest } from "../../../packages/insights-contracts/index.mjs";
import { buildEvidence } from "../src/evidence.mjs";
import { composerEvidence, qualityGate } from "../src/composer.mjs";
import { canonicalMarketCitations } from "../src/citations.mjs";
import { createRenderer } from "../src/renderer.mjs";

const command = JSON.parse(readFileSync(new URL("./fixtures/offline-report.json", import.meta.url))).command;
function fixture(labels = ["CONTROLLED WTI", "CONTROLLED Brent"]) {
  const job = { command, profile: { id: "CONTROLLED_FIXTURE_NOT_MODEL_OUTPUT" }, authorityRef: "CONTROLLED_OFFLINE" };
  const series = labels.map((label, i) => ({ seriesId: "CONTROLLED_SERIES_" + i, label, provider: "CONTROLLED_CANONICAL_PROVIDER",
    providerSeries: "CONTROLLED_VENDOR_SERIES_" + i, observationDate: "2026-11-09", value: 100 + i,
    currency: "CONTROLLED", unit: "CONTROLLED", instrumentType: "CONTROLLED", receiptRef: "receipt-" + i,
    history: [{ date: "2026-11-09", value: 100 + i }] }));
  const article = { id: "E_CONTROLLED", provider: "CONTROLLED", family: "market-context", publisher: "CONTROLLED",
    title: "Controlled source metadata", availableAt: null, publishedAt: null, retrievedAt: "2026-11-10T07:00:00Z",
    receiptRef: "hub-receipt-not-a-citation", licenceRef: "CONTROLLED", projectionBasisRef: "CONTROLLED", facts: {} };
  const bundle = buildEvidence(job, [{ queryId: "CONTROLLED", status: "SUCCEEDED", projection: [article] }], {
    market: { status: "AVAILABLE", series }, forecast: { status: "NOT_AVAILABLE", series: [] } });
  const narrative = Object.fromEntries(SECTIONS.map(k => [k, [{ text: "Kontrolowany przykład: zmiana podaży wpływa na warunki zakupów i wymaga obserwacji rynku.", refs: ["receipt-0"] }]]));
  const composed = { profileId: job.profile.id, status: "completed", evidenceFingerprint: bundle.fingerprint,
    receiptRef: "CONTROLLED_OFFLINE_NOT_MODEL_OUTPUT", narrative };
  return { job, bundle, composed };
}
const check = f => qualityGate(f.job, f.bundle, f.composed);
const rejectsCitation = f => assert.rejects(check(f), { code: "UNVERIFIED_CITATION" });

test("projection, gate and immutable canonical market receipts agree without editing narrative", async () => {
  const f = fixture(), before = digest(f), projection = composerEvidence(f.bundle), catalog = canonicalMarketCitations(f.bundle);
  assert.deepEqual(catalog.entries.map(x => x.ref), projection.context.market.series.map(x => x.receiptRef));
  assert.equal(catalog.evidenceFingerprint, f.bundle.fingerprint);
  assert(catalog.entries.every(x => x.series.every(s => !Object.hasOwn(s, "history"))));
  const gate = await check(f);
  assert.equal(gate.status, "PASS_WITH_HUMAN_REVIEW");
  assert.equal(gate.semanticReview, "HUMAN_REQUIRED");
  assert.equal(gate.automaticPublication, false);
  assert.equal(digest(f), before);
});

test("canonical receipt resolution is independent of Oil category names", async t => {
  for (const labels of [["CONTROLLED Brent", "CONTROLLED WTI"], ["CONTROLLED Copper", "CONTROLLED Wheat"]]) {
    await t.test(labels.join(" / "), async () => {
      const f = fixture(labels);
      f.composed.narrative.statistical[0].refs = ["receipt-1"];
      assert.equal((await check(f)).semanticReview, "HUMAN_REQUIRED");
    });
  }
});

test("unknown refs, Hub acquisition receipts and arbitrary forecast receipts remain refused", async t => {
  for (const ref of ["invented", "hub-receipt-not-a-citation", "coverage-receipt", "foreign-forecast-receipt", "constructor"]) {
    await t.test(ref, async () => {
      const f = fixture();
      f.bundle.coverage.push({ queryId: "CONTROLLED", receiptRef: "coverage-receipt" });
      f.bundle.forecast.series.push({ receiptRef: "foreign-forecast-receipt" });
      f.composed.narrative.executive[0].refs = [ref];
      await rejectsCitation(f);
    });
  }
});

test("incomplete, malformed and future market observations never create citable aliases", async t => {
  const mutations = [s => delete s.receiptRef, s => s.receiptRef = {}, s => s.receiptRef = " receipt-0",
    s => s.receiptRef = "receipt-0\n", s => delete s.seriesId, s => delete s.label, s => delete s.provider,
    s => s.value = null, s => s.value = "100", s => s.value = Infinity,
    s => s.observationDate = "2026-02-30", s => s.observationDate = "2026-11-11", s => delete s.observationDate];
  for (const [i, change] of mutations.entries()) await t.test("invalid canonical observation " + i, async () => {
    const f = fixture(); change(f.bundle.market.series[0]); await rejectsCitation(f);
  });
});

test("reserved or article-ID collisions are refused instead of silently changing attribution", async t => {
  for (const ref of ["FORECAST", "METHODOLOGY", "E_CONTROLLED"]) await t.test(ref, async () => {
    const f = fixture(); f.bundle.market.series[0].receiptRef = ref; f.composed.narrative.executive[0].refs = [ref];
    await rejectsCitation(f);
  });
});

test("shared receipt groups are exact: deduplicate identical series, refuse conflicting or incomplete members", async () => {
  const f = fixture(); f.bundle.market.series[1].receiptRef = "receipt-0";
  f.bundle.market.series.push(structuredClone(f.bundle.market.series[0]));
  assert.equal(canonicalMarketCitations(f.bundle).entries[0].series.length, 2);
  assert.equal((await check(f)).automaticPublication, false);
  const conflicting = fixture(); conflicting.bundle.market.series.push({ ...conflicting.bundle.market.series[0], value: 999 });
  await rejectsCitation(conflicting);
  const incomplete = fixture(); incomplete.bundle.market.series[1].receiptRef = "receipt-0"; delete incomplete.bundle.market.series[1].label;
  await rejectsCitation(incomplete);
});

test("existing article, FORECAST and METHODOLOGY refs retain their original contract", async () => {
  const f = fixture(); f.bundle.market.series = [];
  f.composed.narrative.executive[0].refs = ["E_CONTROLLED", "FORECAST", "METHODOLOGY"];
  for (const k of SECTIONS.filter(k => k !== "executive")) f.composed.narrative[k][0].refs = ["E_CONTROLLED"];
  assert.equal((await check(f)).automaticPublication, false);
});

test("market aliases do not weaken status, lineage, numerical-claim or human-review gates", async () => {
  const lineage = fixture(); lineage.composed.evidenceFingerprint = "FOREIGN_BUNDLE";
  await assert.rejects(check(lineage), { code: "NARRATIVE_LINEAGE_MISMATCH" });
  const status = fixture(); status.composed.status = "incomplete";
  await assert.rejects(check(status), { code: "NARRATIVE_LINEAGE_MISMATCH" });
  const digits = fixture(); digits.composed.narrative.executive[0].text = "Wartość 100.";
  await assert.rejects(check(digits), { code: "MODEL_NUMERICAL_OR_INTERNAL_CLAIM" });
});

const python = process.env.INSIGHTS_CITATION_TEST_PYTHON ?? "python3";
const renderPath = fileURLToPath(new URL("../render/", import.meta.url));
test("Python rejects forged catalogs, changed series and foreign lineage against the same bundle", () => {
  const f = fixture(), catalog = canonicalMarketCitations(f.bundle);
  const cases = [
    [f.bundle, { ...catalog, evidenceFingerprint: "FOREIGN" }],
    [f.bundle, { ...catalog, entries: [{ ref: "unknown", series: catalog.entries[0].series }] }],
    [f.bundle, { ...catalog, entries: [{ ...catalog.entries[0], series: [{ ...catalog.entries[0].series[0], value: 999 }] }] }],
    [f.bundle, { ...catalog, entries: [{ ...catalog.entries[0], title: "forged attribution" }] }],
  ];
  const future = structuredClone(f.bundle); future.market.series[0].observationDate = "2026-11-11";
  const futureCatalog = structuredClone(catalog); futureCatalog.entries[0].series[0].observationDate = "2026-11-11";
  cases.push([future, futureCatalog]);
  const code = "import json,sys;sys.path.insert(0,sys.argv[1]);from report import verified_market_sources\ncases=json.load(sys.stdin)\nfor bundle,catalog in cases:\n try: verified_market_sources(bundle,catalog)\n except AssertionError as e: assert str(e)=='UNVERIFIED_CITATION'\n else: raise AssertionError('FORGED_CATALOG_ACCEPTED')\nprint('ALL_FORGED_CATALOGS_REFUSED')";
  const result = spawnSync(python, ["-c", code, renderPath], { input: JSON.stringify(cases), encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ALL_FORGED_CATALOGS_REFUSED/);
});

test("actual renderer resolves canonical receipts into readable footnotes and exact lineage annex without provider calls", async () => {
  const f = fixture();
  f.composed.narrative.statistical[0].refs = ["receipt-1"];
  f.composed.narrative.events[0].refs = ["E_CONTROLLED"];
  f.composed.narrative.outlook[0].refs = ["FORECAST"];
  f.composed.narrative.calendar[0].refs = ["METHODOLOGY"];
  const before = digest(f), gate = await check(f), originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error("OFFLINE_PROVIDER_CALL_FORBIDDEN"); };
  try {
    const rendered = await createRenderer({ python })(f.job, f.bundle, f.composed, gate);
    assert.equal(rendered.metadata.pages, 4);
    assert.equal(rendered.metadata.numberedFootnotes, 5);
    assert.equal(rendered.metadata.humanReviewRequired, true);
    assert.equal(rendered.metadata.originalNarrativePreserved, true);
    assert.equal(rendered.metadata.rawModelTextEdited, false);
    const markdown = rendered.artifacts.markdown.toString(), appendix = rendered.artifacts.appendix.toString();
    assert(markdown.includes("Kanoniczne odczyty rynku"));
    assert(!markdown.includes("receipt-0"));
    assert(appendix.includes('"receipt-0"') && appendix.includes('"receipt-1"'));
    assert(appendix.includes(f.bundle.fingerprint));
    assert.equal(digest(f), before);
  } finally { globalThis.fetch = originalFetch; }
});
