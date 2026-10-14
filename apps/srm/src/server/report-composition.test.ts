import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinancialDataMount, FinancialScannerMount } from "@profitia/srm-xray";
import { emptyCard, sampleCard } from "../demo/fixture";
import { emptySection, SupplierReportController, type DisplayCard, type ReportState, type SearchResult } from "../modules/xray/report-controller";
import { reportMessage, SupplierReport } from "../modules/xray/supplier-report";
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
test("KYS user request time is independent of API/cache acquisition and updates only after explicit successful requests", async () => {
  let now="2026-10-14T11:30:01Z", failure=false;
  const sourceTime="2026-10-08T21:26:59Z";
  for (const entityType of ["COMPANY", "JDG"] as const) for (const mode of ["PROVIDER", "CACHE", "FOLLOWER"]) {
    const transport:typeof fetch=async url=> {
      if(String(url).endsWith("/search")) return Response.json(entityType === "COMPANY" ? company() : jdg());
      if(String(url).endsWith("/report-data")) return Response.json(metadata(nipA,entityType));
      if(failure) return Response.json({error:"Unavailable"},{status:503});
      return Response.json({section:{...sampleCard.kys,retrievedAt:sourceTime}}, {headers:{"X-SRM-Request-Id":"11111111-1111-4111-8111-111111111111","X-SRM-KYS-Mode":mode}});
    };
    now="2026-10-14T11:30:01Z";failure=false;
    const instance=new SupplierReportController(transport,()=>new Date(now));
    await instance.search(nipA);assert.equal(instance.getSnapshot().kysRequestedAt,undefined);
    await instance.fetchKys();assert.equal(instance.getSnapshot().kysRequestedAt,new Date(now).toISOString());
    assert.equal(instance.getSnapshot().kys.retrievedAt,sourceTime);
    now="2026-10-14T11:35:02Z";
    await instance.refreshMetadata();assert.equal(instance.getSnapshot().kysRequestedAt,"2026-10-14T11:30:01.000Z");
    await instance.fetchKys();assert.equal(instance.getSnapshot().kysRequestedAt,new Date(now).toISOString());
    failure=true;await instance.fetchKys();assert.equal(instance.getSnapshot().kysRequestedAt,undefined);
    instance.reset();assert.equal(instance.getSnapshot().kysRequestedAt,undefined);
  }
});

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
  for (const name of ["Dane identyfikacyjne i rejestrowe", "Rachunek zysków i strat", "Bilans", "Pobierz do Excela", "Raport KYS"]) assert.ok(html.includes(name), name);
  for (const id of ["report-summary", "report-finance\"", "report-observations"]) assert.equal(html.includes(id), false);
  assert.doesNotMatch(html, /Raport KYS nie został jeszcze pobrany|Zapisany raport jest dostępny/);
  assert.match(html, /<details class="report-detail" id="report-kys"><summary[^>]+data-library-component="SRM-C49"/);
  assert.match(html, /data-canon-usage="supplier-report:kys-request"/);
  assert.equal(html.includes("PRIVATE_DOCUMENT"), false); assert.equal(html.includes("PRIVATE_MODEL"), false);
  for (const target of html.matchAll(/href="#([^\"]+)"/g)) assert.ok(html.includes(`id="${target[1]}"`));
});

test("slot contract shares supplier, metadata, scope and periods without replacing detail reports", async () => {
  const { instance } = controller(); await instance.search(nipA);
  const html = markup(instance.getSnapshot(), { slots: {
    summary: context => { assert.equal(context.metadata?.nip, nipA); assert.equal(context.financial?.status, "SUCCESS"); assert.equal(context.kys.status, "NOT_REQUESTED"); assert.equal(typeof context.onIndicator, "function"); assert.equal(typeof context.onNavigate, "function"); return React.createElement("p", null, "Treść testowa podsumowania"); },
    financial: { liquidity: context => { assert.equal(context.scope, "standalone"); assert.equal(context.periods[0].year, "2025"); return React.createElement("p", null, "Treść testowa finansów"); } },
    observations: () => React.createElement("p", null, "Treść testowa obserwacji"),
  } });
  assert.ok(html.includes('id="report-summary"')); assert.ok(html.includes("Najważniejsze informacje")); assert.ok(html.includes('id="report-finance"')); assert.ok(html.includes('id="report-observations"'));
  assert.ok(html.includes("Rachunek zysków i strat"));
});

test("partial, empty finance and KYS states remain independent and preserve source dates", async () => {
  const { instance } = controller(); await instance.search(nipA);
  const state = instance.getSnapshot(); assert.ok(state.result?.entityType === "COMPANY");
  for (const status of ["PARTIAL", "EMPTY", "ERROR"] as const) {
    const result = { ...state.result, card: { ...state.result.card, financial: { ...state.result.card.financial, status, data: null } } };
    for (const kysStatus of ["NOT_REQUESTED", "PENDING", "SUCCESS", "ERROR"] as const) {
      const html = markup({ ...state, result, kys: { ...emptySection(), status: kysStatus }, kysBusy: kysStatus === "PENDING" });
      assert.ok(html.includes("Pobierz raport KYS") || html.includes("Przygotowywanie raportu KYS")); assert.equal(html.includes("Źródła i aktualność"), false);
    }
  }
  const before = JSON.stringify(state.metadata); const html = markup(state); assert.equal(JSON.stringify(state.metadata), before);
  assert.equal(html.includes(state.metadata!.financial.freshness.checkedAt!), false);
  assert.ok(html.includes("Okres finansowy:")); assert.ok(html.includes("2025-01-01 – 2025-12-31"));

});

test("JDG preserves its registry and explicit KYS without company-financial mount", async () => {
  const { instance } = controller(jdg()); await instance.search(nipA); const html = markup(instance.getSnapshot());
  assert.ok(html.includes("Test JDG")); assert.ok(html.includes("Raport KYS"));
  assert.equal(html.includes("Sprawozdania finansowe i wskaźniki"), false); assert.equal(html.includes("Pobierz do Excela"), false);
});

test("independent FinancialDataMount remains compatible and accepts host scope without new selection logic", () => {
  const result = company(); assert.ok(result.entityType === "COMPANY");
  const independent = renderToStaticMarkup(React.createElement(FinancialDataMount, { section: result.card.financial }));
  const controlled = renderToStaticMarkup(React.createElement(FinancialDataMount, { section: result.card.financial, selectedScope: "consolidated" }));
  assert.ok(independent.includes("dane jednostkowe")); assert.ok(controlled.includes("dane skonsolidowane"));
  assert.ok(!controlled.includes("Uzupełniająca definicja przepływów"));
  assert.ok(controlled.includes("srm-statement-chart-card"));
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


test("C1 presentation hides providers and technical header while retaining contracts, reports and single lower KYS action", async () => {
  const { instance, calls } = controller(); await instance.search(nipA); const state = instance.getSnapshot();
  const before = JSON.stringify(state.metadata), html = markup(state, { slots: { financial: { liquidity: () => React.createElement("p", null, "Financial Health") } } });
  const identity = html.slice(html.indexOf('id="supplier-identity"'), html.indexOf('<nav'));
  assert.doesNotMatch(html, /MGBI|Vercly|Źródła i aktualność|report-sources|report-status-grid|Ostatnia kontrola źródła|Wygaśnięcie cache/i);
  assert.doesNotMatch(identity, /Pobrano|Cache|metadane|Nie pobrano/i);
  assert.match(identity, /NIP:|KRS:|Okres finansowy:/);
  assert.ok(html.indexOf('id="report-finance"') < html.indexOf('id="report-financial-details"'));
  assert.ok(html.indexOf('id="report-financial-details"') < html.indexOf('id="report-kys"'));
  assert.ok(html.indexOf('id="report-kys"') < html.indexOf('id="report-kys-details"'));
  assert.equal([...html.matchAll(/>Pobierz raport KYS<\/button>/g)].length, 1);
  for (const target of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${target[1]}"`));
  assert.equal(JSON.stringify(state.metadata), before);
  assert.equal(state.metadata?.financial.source, "MGBI"); assert.equal(state.metadata?.kys.source, "VERCLY");
  assert.deepEqual(calls, ["/api/xray/search", "/api/xray/report-data"]);
});

test("C1 preserves data limitations but omits redundant general warnings under the radar", async () => {
  const { instance } = controller(); await instance.search(nipA); const state = instance.getSnapshot();
  const data = structuredClone(state.metadata!); data.financial.freshness.freshness = "EXPIRED";
  data.financial.completeness = "PARTIAL"; data.financial.limitations = ["FINANCIAL_CACHE_EXPIRED", "MAPPING_VERSION_OUTDATED", "FINANCIAL_FACTS_UNVERIFIED"];
  data.kys.freshness.freshness = "EXPIRED"; data.kys.completeness = "PARTIAL";
  const html = markup({ ...state, metadata: data });
  for (const text of ["Dane finansowe mogą być nieaktualne", "Część wyników wymaga aktualizacji", "Poprzedni raport KYS stracił ważność", "Raport KYS jest częściowy"]) assert.ok(html.includes(text), text);
  assert.equal(html.includes(data.financial.freshness.checkedAt!), false);
  assert.ok(!html.includes("Dane finansowe są częściowe"));
  assert.ok(!html.includes("Część danych nie została potwierdzona"));
  assert.ok(data.financial.limitations.includes("FINANCIAL_FACTS_UNVERIFIED"));
  assert.ok(html.indexOf("Dane finansowe mogą") > html.indexOf('id="report-financial-details"'));
  assert.ok(html.indexOf("Poprzedni raport KYS") > html.indexOf('id="report-kys"'));
});

test("C1 product error labels preserve internal provider messages and neutral customer errors", async () => {
  const { instance } = controller(); await instance.search(nipA);
  const state = { ...instance.getSnapshot(), kysError: "Vercly nie zwróciło pełnych danych.", kys: { ...emptySection(), status: "ERROR" as const } };
  const html = markup(state); assert.doesNotMatch(html, /Vercly|MGBI/);
  assert.equal(state.kysError, "Vercly nie zwróciło pełnych danych.");
  assert.equal(reportMessage("MGBI niedostępne; Vercly niedostępne"), "Dane finansowe i rejestrowe niedostępne; Raport KYS niedostępne");
  assert.doesNotMatch(reportMessage("MGBI_API_KEY missing VERCLY_TIMEOUT"), /MGBI|VERCLY|API_KEY|TIMEOUT/);
  assert.equal(reportMessage("Wymagane logowanie."), "Wymagane logowanie.");
});


test("full KYS is withheld when stored metadata cannot confirm authorized version or expired retention", async () => {
  const {instance}=controller(); await instance.search(nipA);
  const state={...instance.getSnapshot(),kys:{...sampleCard.kys,status:"SUCCESS" as const,data:{...sampleCard.kys.data!,company:{nip:nipA,name:"PRIVATE_EXPIRED_PERSON_REPORT",krs:null,regon:null,legalForm:null,address:null,country:null,activityStatus:null,registeredAt:null,lastChangedAt:null,mainPkd:null,shareCapital:null,representation:null}}}};
  const html=markup(state);assert.doesNotMatch(html,/PRIVATE_EXPIRED_PERSON_REPORT|data-kys-detail/);assert.match(html,/Nie ustalono ważności/);
  state.metadata!.kys.freshness.freshness="EXPIRED";
  assert.match(markup(state),/stracił ważność/);assert.doesNotMatch(markup(state),/PRIVATE_EXPIRED_PERSON_REPORT/);
});


test("PDF action is adjacent full KYS only for explicitly displayed bound fresh report; no export from stale or unrelated context", async () => {
  const { instance } = controller(); await instance.search(nipA);
  const extra = { onDownloadKysPdf: async () => {}, onDownloadKrsPdf: async () => {} };
  assert(!markup(instance.getSnapshot(), extra).includes("kys-pdf-export"));
  const state = instance.getSnapshot(), acquired = new Date().toISOString(), until = new Date(Date.now() + 3600000).toISOString();
  const data = { ...sampleCard.kys.data!, correlationId: "test-report-123", company: { ...sampleCard.kys.data?.company!, nip: nipA, krs: "0000000001", regon: "123456789" }, pepMatches: [] };
  const kys = { ...sampleCard.kys, status: "SUCCESS" as const, retrievedAt: acquired, data };
  const meta = { ...state.metadata!, kys: { ...state.metadata!.kys, status: "SUCCESS" as const, reportAvailable: true, exportRef: "a".repeat(64),
    freshness: { ...state.metadata!.kys.freshness, freshness: "FRESH" as const, retrievedAt: acquired, retentionUntil: until, cacheExpiresAt: until } } };
  const ready = { ...state, kys, metadata: meta };
  const html = markup(ready, extra);
  assert(html.indexOf("Zapisz PDF") < html.indexOf("Pobierz aktualny KRS"));
  assert(html.indexOf("Pobierz aktualny KRS") < html.indexOf("Pobierz ponownie"));
  assert.match(html, /data-library-component="SRM-C02"[^>]*data-canon-usage="supplier-report:07"/);
  assert(html.includes("kys-pdf-export")); assert(html.indexOf("Sprawozdania finansowe i wskaźniki") < html.indexOf("kys-pdf-export"));
  assert(html.indexOf("kys-pdf-export") < html.indexOf('id="report-kys-details"'));
  for (const unavailable of [ { ...ready, kys: { ...kys, status: "NOT_REQUESTED" as const } },
    { ...ready, metadata: { ...meta, nip: nipB } }, { ...ready, metadata: { ...meta, kys: { ...meta.kys, exportRef: null } } },
    { ...ready, metadata: { ...meta, kys: { ...meta.kys, freshness: { ...meta.kys.freshness, freshness: "EXPIRED" as const } } } },
    { ...ready, kysBusy: true } ]) assert(!markup(unavailable, extra).includes("kys-pdf-export"));
});

test("HTTP KYS failure retains opaque server timing for the committed error render without report contents", async () => {
 const requestId="11111111-1111-4111-8111-111111111111";
 const {instance}=controller(company(),{"/api/xray/kys":async()=>Response.json({error:"Źródło niedostępne."},{status:503,headers:{"X-SRM-Request-Id":requestId,"X-SRM-KYS-Mode":"PROVIDER","Server-Timing":"total;dur=100"}})});
 await instance.search(nipA);await instance.fetchKys();const state=instance.getSnapshot();
 assert.equal(state.kys.status,"ERROR");assert.equal(state.kysTiming?.requestId,requestId);
 assert.equal(state.kysTiming?.mode,"PROVIDER");assert.ok(state.kysTiming!.apiMs>=0);
 assert.equal(state.kys.data,null);assert.equal(JSON.stringify(state.kysTiming).includes(nipA),false);
});


test("scanner composition replaces legacy summary and health cards while preserving detail and KYS mounts", async () => {
 const { instance, calls }=controller(); await instance.search(nipA); const state=instance.getSnapshot();
 const before=JSON.stringify(state.metadata);
 const html=markup(state,{slots:{
  scanner:context=>{assert.equal(context.metadata?.nip,nipA);return React.createElement(FinancialScannerMount,{report:context.metadata});},
  summary:()=>React.createElement("div",null,"Legacy summary marker"),
  financial:{liquidity:()=>React.createElement("div",null,"Legacy health marker")}
 }});
 assert.match(html,/Supplier Finance Scanner/);
 assert.doesNotMatch(html,/Legacy summary marker|Legacy health marker|report-summary|Okres finansowy:/);
 assert.ok(html.indexOf('id="report-finance"')>html.indexOf('id="supplier-identity"'));
 assert.ok(html.indexOf('id="report-finance"')<html.indexOf('id="report-financial-details"'));
 for(const title of ["Rachunek zysków i strat","Bilans","Pobierz do Excela","Raport KYS"])assert.ok(html.includes(title),title);
 assert.equal(JSON.stringify(state.metadata),before);
 assert.deepEqual(calls,["/api/xray/search","/api/xray/report-data"]);
});


for(const registrationStatus of ["DEREGISTERED","LIQUIDATION"] as const)test(`${registrationStatus} preserves identity and scanner status while hiding details and requests`,async()=>{
 const result=company();if(result.entityType!=="COMPANY")throw Error("fixture");
 result.card.general.data!.registrationStatus=registrationStatus;result.card.general.data!.deregisteredAt="2009-01-19";
 const {instance,calls}=controller(result);await instance.search(nipA);await instance.fetchKys();await instance.refreshMetadata();
 assert.deepEqual(calls,["/api/xray/search"]);assert.equal(instance.getSnapshot().metadata,null);
 const html=markup({...instance.getSnapshot(),kys:{...sampleCard.kys},metadata:metadata()},{slots:{kys:()=>{throw Error("restricted KYS mounted")}}});
 assert.match(html,registrationStatus==="DEREGISTERED"?/Spółka została wykreślona z KRS 19\.01\.2009 r\./:/Spółka jest w trakcie likwidacji/);
 assert.match(html,/data-library-component="SRM-C61"/);
 assert.match(html,/NIP:/);assert.match(html,/KRS:/);
 assert.doesNotMatch(html,/Raport KYS|Dane szczegółowe|PRIVATE_DOCUMENT|report-financial-details|report-indicator-details/);
 instance.reset();assert.equal(instance.getSnapshot().result,null);assert.equal(instance.getSnapshot().metadata,null);
});

test("removed JDG has only the dated CEIDG notice and never mounts registry or KYS",async()=>{
 const result=jdg();if(result.entityType!=="JDG")throw Error("fixture");
 result.section.data={entries:[{...result.section.data!.entries[0],status:"Wykreślony",fields:[{key:"dataWykreslenia",label:"Data wykreślenia",value:"2018-08-18",children:[]}]}]};
 const {instance,calls}=controller(result);await instance.search(nipA);await instance.fetchKys();await instance.refreshMetadata();assert.deepEqual(calls,["/api/xray/search"]);
 const html=markup({...instance.getSnapshot(),kys:{...sampleCard.kys}},{slots:{kys:()=>{throw Error("inactive KYS")}}});
 assert.match(html,/Działalność jest wykreślona z CEIDG od 18\.08\.2018 r\. i jest nieaktywna/);
 assert.doesNotMatch(html,/Test JDG|Dane szczegółowe|Raport KYS|button|<nav|Pobierz/);assert.equal((html.match(/role="status"/g)||[]).length,1);
 instance.reset();assert.equal(instance.getSnapshot().result,null);
});


test("unsupported IAS hides financial details but preserves registry and explicit KYS", async () => {
  const result = company(); assert.equal(result.entityType, "COMPANY");
  if (result.entityType !== "COMPANY") return;
  result.card.general.data!.registrationStatus = "ACTIVE";
  result.card.financial = { ...emptyCard.financial, status: "EMPTY", warnings: ["FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE"] };
  const { instance } = controller(result); await instance.search(nipA);
  const html = markup(instance.getSnapshot());
  assert.match(html, /Sprawozdania MSR \/ MSSF/);
  assert.match(html, /Dane identyfikacyjne i rejestrowe/);
  assert.match(html, /Pobierz raport KYS/);
  assert.doesNotMatch(html, /id="report-financial-details"|id="report-indicator-details"|Rachunek zysków i strat|Pobierz do Excela/);
  for (const target of html.matchAll(/href="#([^\"]+)"/g)) assert.ok(html.includes(`id="${target[1]}"`));
});
