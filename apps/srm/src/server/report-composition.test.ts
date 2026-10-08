import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinancialDataMount } from "@profitia/srm-xray";
import { emptyCard, sampleCard } from "../demo/fixture";
import { emptySection, SupplierReportController, type DisplayCard, type ReportState, type SearchResult } from "../modules/xray/report-controller";
import { reportDate, SupplierReport } from "../modules/xray/supplier-report";
import { projectReportData } from "./report-data";
import { FINANCIAL_MAPPING_VERSION } from "./shared-catalog";

const nipA = "8650004194", nipB = "5272443955";
function company(nip = nipA): SearchResult {
  const card: DisplayCard = { ...sampleCard, identity: { nip, krs: "0000000001", name: "Dostawca testowy" },
    general: { ...sampleCard.general, data: { ...sampleCard.general.data!, legalName: "Dostawca testowy", nip } },
    financial: { ...sampleCard.financial, retrievedAt: "2026-10-01T12:00:00Z", data: { periods: ["standalone", "consolidated"].map(scope => ({
      from: "2025-01-01", to: "2025-12-31", scope: scope as "standalone" | "consolidated", documentId: `PRIVATE_DOCUMENT_${scope}`,
      facts: ["PALA_NRFS", "PALA_OAC", "PALA_NPL", "BS_A_TA"].map(metricCode => ({ metricCode, amount: "100000", currency: "PLN", unit: "PLN" })),
    })) } } };
  return { entityType: "COMPANY", card };
}
function jdg(nip = nipA): SearchResult {
  return { entityType: "JDG", nip, section: { status: "SUCCESS", retrievedAt: null, effectiveAt: null, warnings: [],
    data: { entries: [{ recordId: "TEST", nip, regon: null, name: "Test JDG", status: "Aktywny", fields: [] }] } } };
}
function metadata(nip = nipA, entityType: "COMPANY" | "JDG" = "COMPANY") {
  const result = company(nip);
  return projectReportData({ nip, entityType }, { nip, financial_json: { ...(result.entityType === "COMPANY" ? result.card.financial : emptyCard.financial),
    source: { provider: "MGBI", model: "PRIVATE_MODEL", recordId: "PRIVATE_RECORD" }, catalogMappingVersion: FINANCIAL_MAPPING_VERSION },
    financial_sha256: "a".repeat(64), financial_checked_at: "2026-10-07T12:00:00Z", facts: [], indicators: [], kys: null }, new Date("2026-10-08T12:00:00Z"), {});
}
function controller(result: SearchResult = company(), overrides: Partial<Record<string, () => Promise<Response>>> = {}) {
  const calls: string[] = [];
  const instance = new SupplierReportController((async (url: string, init: RequestInit) => {
    calls.push(url); const body = JSON.parse(String(init.body));
    if (overrides[url]) return overrides[url]!();
    return Response.json(url === "/api/xray/search" ? result : url === "/api/xray/report-data" ? metadata(body.nip, body.entityType) : { section: { ...sampleCard.kys, retrievedAt: "2026-10-08T11:00:00Z" } });
  }) as typeof fetch);
  return { instance, calls };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
test("default browser transport does not bind native fetch to the controller", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async function (input, init) {
      assert.equal(this, undefined);
      const body = JSON.parse(String(init?.body));
      return Response.json(String(input).endsWith("/search") ? company() : metadata(body.nip));
    };
    const instance = new SupplierReportController();
    await instance.search(nipA);
    assert.equal(instance.getSnapshot().error, null);
    assert.equal(instance.getSnapshot().metadata?.nip, nipA);
  } finally { globalThis.fetch = original; }
});
function markup(state: ReportState, extra: Partial<React.ComponentProps<typeof SupplierReport>> = {}) {
  return renderToStaticMarkup(React.createElement(SupplierReport, { state, onFetchKys: () => {}, onReadMetadata: () => {},
    onRevealPesel: async () => { throw new Error("Not called"); }, onDownloadExcel: async () => {}, ...extra }));
}

test("initial/reset states do not fetch providers or metadata; metadata reads follow lookup once", async () => {
  const { instance, calls } = controller();
  assert.equal(instance.getSnapshot().result, null); assert.deepEqual(calls, []);
  await instance.search(nipA);
  assert.deepEqual(calls, ["/api/xray/search", "/api/xray/report-data"]);
  assert.equal(instance.getSnapshot().kys.status, "NOT_REQUESTED");
  assert.equal(instance.getSnapshot().metadata?.nip, nipA);
  instance.reset(); assert.equal(instance.getSnapshot().metadata, null); assert.equal(instance.getSnapshot().kys.data, null);
  assert.equal(calls.length, 2);
});

test("late search cannot overwrite another supplier even when transport ignores abort", async () => {
  const old = deferred<Response>(); const calls: string[] = [];
  const instance = new SupplierReportController((async (url: string, init: RequestInit) => {
    calls.push(url); const body = JSON.parse(String(init.body));
    if (url === "/api/xray/search" && body.identifier === nipA) return old.promise;
    return Response.json(url === "/api/xray/search" ? company(nipB) : metadata(body.nip));
  }) as typeof fetch);
  const first = instance.search(nipA); assert.equal(instance.getSnapshot().busy, true);
  instance.reset(); await instance.search(nipB);
  old.resolve(Response.json(company(nipA))); await first;
  assert.equal(instance.getSnapshot().metadata?.nip, nipB); assert.equal(calls.filter(p => p.endsWith("report-data")).length, 1);
});

test("late KYS cannot mix suppliers or launch another metadata read", async () => {
  const old = deferred<Response>(); const { instance, calls } = controller(company(), { "/api/xray/kys": () => old.promise });
  await instance.search(nipA); const fetchKys = instance.fetchKys();
  assert.equal(instance.getSnapshot().kys.status, "PENDING");
  instance.reset(); await instance.search(nipA);
  old.resolve(Response.json({ section: sampleCard.kys })); await fetchKys;
  assert.equal(instance.getSnapshot().kys.status, "NOT_REQUESTED"); assert.equal(instance.getSnapshot().kys.data, null);
  assert.equal(calls.filter(p => p.endsWith("report-data")).length, 2);
});

test("only explicit KYS uses its route; one subsequent stored metadata read", async () => {
  const { instance, calls } = controller(); await instance.search(nipA); await instance.fetchKys();
  assert.deepEqual(calls, ["/api/xray/search", "/api/xray/report-data", "/api/xray/kys", "/api/xray/report-data"]);
  assert.equal(instance.getSnapshot().kys.status, "SUCCESS");
  const { instance: jd, calls: jdCalls } = controller(jdg()); await jd.search(nipA); await jd.fetchKys();
  assert.equal(jdCalls[2], "/api/xray/jdg/kys"); assert.equal(jd.getSnapshot().metadata?.entityType, "JDG");
});

test("metadata denial/failure is independent of financial and KYS results", async () => {
  const { instance, calls } = controller(company(), { "/api/xray/report-data": async () => Response.json({ error: "Wymagane logowanie." }, { status: 401 }) });
  await instance.search(nipA);
  assert.ok(instance.getSnapshot().result); assert.equal(instance.getSnapshot().error, null); assert.ok(instance.getSnapshot().metadataError);
  await instance.fetchKys(); assert.equal(instance.getSnapshot().kys.status, "SUCCESS");
  await instance.refreshMetadata(); assert.equal(calls.filter(p => p.endsWith("kys")).length, 1);
});

test("mismatched search and metadata fail closed without retaining another supplier", async () => {
  const wrongSearch = controller(company(nipB)); await wrongSearch.instance.search(nipA);
  assert.equal(wrongSearch.instance.getSnapshot().result, null); assert.equal(wrongSearch.calls.length, 1);
  const wrongMetadata = controller(company(), { "/api/xray/report-data": async () => Response.json(metadata(nipB)) });
  await wrongMetadata.instance.search(nipA); assert.equal(wrongMetadata.instance.getSnapshot().metadata, null);
  assert.ok(wrongMetadata.instance.getSnapshot().result); assert.ok(wrongMetadata.instance.getSnapshot().metadataError);
});

test("superseded metadata cannot replace latest metadata for the same supplier", async () => {
  const stale = deferred<Response>(); let reads = 0;
  const { instance } = controller(company(), { "/api/xray/report-data": async () => ++reads === 1 ? stale.promise : Response.json(metadata()) });
  const search = instance.search(nipA); await tick(); await instance.refreshMetadata();
  const current = instance.getSnapshot().metadata;
  stale.resolve(Response.json(metadata(nipB))); await search;
  assert.equal(instance.getSnapshot().metadata, current); assert.equal(instance.getSnapshot().metadataError, null);
});

test("KYS error and identifier mismatch never fabricate retrieval dates or block finance", async () => {
  for (const response of [Response.json({ error: "Źródło niedostępne." }, { status: 503 }),
    Response.json({ section: { ...sampleCard.kys, data: { ...sampleCard.kys.data, company: { nip: nipB } } } })]) {
    const { instance } = controller(company(), { "/api/xray/kys": async () => response });
    await instance.search(nipA); await instance.fetchKys();
    assert.ok(instance.getSnapshot().result); assert.equal(instance.getSnapshot().kys.status, "ERROR");
    assert.equal(instance.getSnapshot().kys.retrievedAt, null); assert.equal(instance.getSnapshot().kys.data, null);
  }
});

test("page composition preserves all feature mounts and hides empty future analysis", async () => {
  const { instance } = controller(); await instance.search(nipA); const html = markup(instance.getSnapshot());
  for (const name of ["Dane identyfikacyjne i rejestrowe", "Rachunek zysków i strat", "Bilans", "Analiza wskaźnikowa", "Pobierz do Excela", "Pełny raport KYS", "Źródła i aktualność"]) assert.ok(html.includes(name), name);
  for (const id of ["report-summary", "report-finance\"", "report-observations"]) assert.equal(html.includes(id), false);
  assert.match(html, /Raport KYS nie został jeszcze pobrany/);
  assert.equal(html.includes("PRIVATE_DOCUMENT"), false); assert.equal(html.includes("PRIVATE_MODEL"), false);
  for (const target of html.matchAll(/href="#([^\"]+)"/g)) assert.ok(html.includes(`id="${target[1]}"`));
});

test("slot contract shares supplier, metadata, scope and periods without replacing detail reports", async () => {
  const { instance } = controller(); await instance.search(nipA);
  const html = markup(instance.getSnapshot(), { slots: {
    summary: context => { assert.equal(context.metadata?.nip, nipA); assert.equal(context.financial?.status, "SUCCESS"); assert.equal(context.kys.status, "NOT_REQUESTED"); return React.createElement("p", null, "Treść testowa podsumowania"); },
    financial: { liquidity: context => { assert.equal(context.scope, "standalone"); assert.equal(context.periods[0].year, "2025"); return React.createElement("p", null, "Treść testowa finansów"); } },
    observations: () => React.createElement("p", null, "Treść testowa obserwacji"),
  } });
  assert.ok(html.includes('id="report-summary"')); assert.ok(html.includes('id="report-finance"')); assert.ok(html.includes('id="report-observations"'));
  assert.ok(html.includes("Rachunek zysków i strat"));
});

test("partial, empty finance and KYS states remain independent and preserve source dates", async () => {
  const { instance } = controller(); await instance.search(nipA);
  const state = instance.getSnapshot(); assert.ok(state.result?.entityType === "COMPANY");
  for (const status of ["PARTIAL", "EMPTY", "ERROR"] as const) {
    const result = { ...state.result, card: { ...state.result.card, financial: { ...state.result.card.financial, status, data: null } } };
    for (const kysStatus of ["NOT_REQUESTED", "PENDING", "SUCCESS", "ERROR"] as const) {
      const html = markup({ ...state, result, kys: { ...emptySection(), status: kysStatus }, kysBusy: kysStatus === "PENDING" });
      assert.ok(html.includes("Pobierz raport KYS") || html.includes("Przygotowywanie raportu KYS")); assert.ok(html.includes("Źródła i aktualność"));
    }
  }
  const html = markup(state); assert.ok(html.includes(reportDate(state.metadata!.financial.freshness.checkedAt)));
  assert.ok(html.includes("Okres finansowy:")); assert.ok(html.includes("2025-01-01 – 2025-12-31"));
  assert.equal(reportDate(null), "nie ustalono"); assert.equal(reportDate("invalid"), "nie ustalono");
});

test("JDG preserves its registry and explicit KYS without company-financial mount", async () => {
  const { instance } = controller(jdg()); await instance.search(nipA); const html = markup(instance.getSnapshot());
  assert.ok(html.includes("Test JDG")); assert.ok(html.includes("Pełny raport KYS")); assert.ok(html.includes("nie dotyczy JDG"));
  assert.equal(html.includes("Sprawozdania finansowe i wskaźniki"), false); assert.equal(html.includes("Pobierz do Excela"), false);
});

test("independent FinancialDataMount remains compatible and accepts host scope without new selection logic", () => {
  const result = company(); assert.ok(result.entityType === "COMPANY");
  const independent = renderToStaticMarkup(React.createElement(FinancialDataMount, { section: result.card.financial }));
  const controlled = renderToStaticMarkup(React.createElement(FinancialDataMount, { section: result.card.financial, selectedScope: "consolidated" }));
  assert.ok(independent.includes("dane jednostkowe")); assert.ok(controlled.includes("dane skonsolidowane"));
  assert.ok(controlled.includes("Analiza wskaźnikowa"));
});

test("Financial Health slots share exact period and source navigation without provider operations", async () => {
  const { instance, calls } = controller(); await instance.search(nipA);
  const before = calls.length;
  markup(instance.getSnapshot(), { slots: { financial: { liquidity: context => {
    assert.deepEqual(context.selectedPeriod, { from: "2025-01-01", to: "2025-12-31" });
    assert.equal(typeof context.setPeriod, "function"); assert.equal(typeof context.onSource, "function");
    return React.createElement("p", null, "Zapisane wyniki");
  } } } });
  assert.equal(calls.length, before);
});
