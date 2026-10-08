import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KysOverview, VerclyKysMount, kysOverview, type KysOverviewInput, type SupplierReportData } from "@profitia/srm-xray";

const now = Date.parse("2026-10-08T12:00:00Z"), nip = "8650004194";
function fixture(): KysOverviewInput {
  return { nip, entityType: "COMPANY", section: { status: "SUCCESS", retrievedAt: "2026-10-08T11:00:00Z", effectiveAt: null, warnings: [], data: {
    correlationId: "PRIVATE_CORRELATION", reportId: "PRIVATE_REPORT", isComplete: true, queriedRegisters: ["Regon"], stateAsOf: null,
    company: { nip, name: "PRIVATE_COMPANY", krs: null, regon: null, legalForm: null, address: null, country: null, activityStatus: "ACTIVE", registeredAt: null, lastChangedAt: null, mainPkd: null, shareCapital: null, representation: "PRIVATE_REPRESENTATION" },
    registryChecks: { krzListed: false, vatActive: true, euVat: null }, screenedLists: [{ name: "LIST_A", type: "SANCTIONS", matched: false }],
    screeningSummary: { directlyRelatedSanctions: false, beneficiaryRelatedSanctions: false, otherLists: null },
    beneficialOwners: [], relatedPersons: [], relatedEntities: [], beneficialOwnersCount: 0, relatedPersonsCount: 12, pepPositionsCount: 12, pepMatches: [],
  } }, metadata: { nip, entityType: "COMPANY", kys: { status: "SUCCESS", completeness: "COMPLETE", reportAvailable: true,
    freshness: { freshness: "FRESH", retrievedAt: "2026-10-08T11:00:00Z", checkedAt: null, cacheExpiresAt: "2026-10-15T11:00:00Z", retentionUntil: "2026-10-15T11:00:00Z" }, limitations: [] } } as unknown as SupplierReportData };
}
const rows = (i: KysOverviewInput) => kysOverview(i, now).groups.flatMap(g => g.rows);
const row = (i: KysOverviewInput, label: string) => rows(i).find(r => r.label === label)!;
const html = (i: KysOverviewInput) => renderToStaticMarkup(React.createElement(KysOverview, { model: kysOverview(i, now), onDetails: () => {} }));

test("explicit returned registry booleans prove the returned result only; null is unknown", () => {
  const i = fixture(); assert.equal(row(i, "KRZ").execution, "PERFORMED"); assert.match(row(i, "KRZ").result, /nie wskazano wpisu/);
  assert.equal(row(i, "VAT").execution, "PERFORMED"); assert.equal(row(i, "VAT UE (VIES)").execution, "UNKNOWN");
  i.section.data!.registryChecks = { krzListed: true, vatActive: false, euVat: false };
  assert.match(row(i, "KRZ").result, /wpis w KRZ.*Sprawdź/); assert.match(row(i, "VAT").result, /nieczynny/);
  assert.doesNotMatch(JSON.stringify(rows(i)), /Dostawca jest niewypłacalny|Dostawca jest bezpieczny/);
});

test("queried registers prove execution independently of an unknown returned status", () => {
  const i = fixture(); i.section.data!.registryChecks = undefined; i.section.data!.queriedRegisters = ["VAT Information Exchange System", "National Debt Register"];
  for (const label of ["KRZ", "VAT", "VAT UE (VIES)"]) { assert.equal(row(i,label).execution, label === "VAT" ? "UNKNOWN" : "PERFORMED"); assert.match(row(i,label).result,/Nie ustalono/); }
});

test("empty and missing list arrays do not prove screening execution or zero risk", () => {
  for (const value of [[], undefined]) { const i = fixture(); i.section.data!.screenedLists = value; const r = row(i,"Wyniki dla badanego podmiotu"); assert.equal(r.execution,"UNKNOWN"); assert.match(r.result,/Nie ustalono/); }
});

test("explicit no-match concerns returned list scope; matching entries are verification signals", () => {
  const i = fixture(); assert.match(row(i,"Wyniki dla badanego podmiotu").result,/wynikach 1 list.*zwróconego zakresu/);
  i.section.data!.screenedLists = [{name:"LIST_A",type:"SANCTIONS",matched:true},{name:"LIST_B",type:"WARNING",matched:false}];
  const r = row(i,"Wyniki dla badanego podmiotu"); assert.match(r.result,/dopasowania: 1.*2 list.*Wymagają weryfikacji/); assert.equal(r.execution,"PERFORMED");
});

test("aggregate related-group sanctions are never attributed directly to supplier", () => {
  const i=fixture(); i.section.data!.screeningSummary={directlyRelatedSanctions:true,beneficiaryRelatedSanctions:true,otherLists:null};
  assert.match(row(i,"Podmiot i bezpośrednio powiązani").result,/Nie ustalono, kogo dotyczy/);
  assert.match(row(i,"Beneficjenci i powiązane podmioty").result,/Nie jest wynikiem bezpośrednio przypisanym/);
});

test("PEP count comes only from returned match entries, never total persons or position counts", () => {
  const i=fixture(); assert.equal(row(i,"PEP").execution,"UNKNOWN"); assert.doesNotMatch(row(i,"PEP").result,/12/);
  i.section.data!.pepMatches=[{personGroup:"beneficialOwners",personIndex:0,personName:"PRIVATE_PERSON",searchPhrase:"PRIVATE_SEARCH",matchedName:"PRIVATE_MATCH",aliases:["PRIVATE_ALIAS"],birthDate:"1970-01-01",positions:[],probabilityPercent:95,identifierMatchesPesel:true}];
  assert.match(row(i,"PEP").result,/dopasowania PEP: 1.*sprawdzenia tożsamości/); assert.equal(row(i,"PEP").execution,"PERFORMED");
  assert.doesNotMatch(html(i),/PRIVATE_|1970-01-01|95%|prawdopodobieństwo/i);
});

test("person and relation availability is not screening evidence; zero/null remain distinct", () => {
  const i=fixture(); assert.match(row(i,"Beneficjenci").result,/0 wpisów.*Nie potwierdza/); assert.match(row(i,"Zapisane relacje").result,/Nie ustalono/);
  i.section.data!.beneficialOwnersCount=null; assert.match(row(i,"Beneficjenci").result,/Nie ustalono/);
  i.section.data!.relatedEntities=[{name:"PRIVATE_RELATED_ENTITY",role:null,krs:null,nip:null,regon:null,relationshipStart:null,relationshipEnd:null,stakeDescription:null,sanctionsMatch:true}];
  assert.match(row(i,"Zapisane relacje").result,/1 zapisanych relacji.*nie jest oceną/); assert.doesNotMatch(html(i),/PRIVATE_RELATED_ENTITY/);
});

test("partial/unknown completeness, warnings and incomplete report never claim all checks complete", () => {
  for (const mutate of [(i: KysOverviewInput)=>{i.section.status="PARTIAL";},(i: KysOverviewInput)=>{i.section.data!.isComplete=false;},(i: KysOverviewInput)=>{i.metadata!.kys.completeness="UNKNOWN";},(i: KysOverviewInput)=>{i.section.warnings=["VERCLY_INCOMPLETE_SOURCES"]; }]) {
    const i=fixture(); mutate(i); const r=kysOverview(i,now); assert(r.available); assert.match(r.message,/ograniczenia/); assert.doesNotMatch(html(i),/VERCLY|MGBI|100%/i);
  }
  assert.match(kysOverview(fixture(),now).message,/Nie oznacza to wykonania każdej/);
});

test("NOT_REQUESTED, PENDING, ERROR and EMPTY return no pseudo-results even when data is attached", () => {
  for(const status of ["NOT_REQUESTED","PENDING","ERROR","EMPTY"] as const) {const i=fixture();i.section.status=status;const r=kysOverview(i,now);assert(!r.available);assert.equal(r.groups.length,0);assert.equal(html(i),"");}
});

test("supplier, entity, missing metadata and mismatched retrieved version fail closed", () => {
  for(const mutate of [(i: KysOverviewInput)=>{i.nip="5272443955";},(i: KysOverviewInput)=>{i.entityType="JDG";},(i: KysOverviewInput)=>{i.metadata=null;},(i: KysOverviewInput)=>{i.section.data!.company!.nip="5272443955";},(i: KysOverviewInput)=>{i.section.retrievedAt="2026-10-08T10:00:00Z";}]){
    const i=fixture();mutate(i);assert(!kysOverview(i,now).available);assert.equal(rows(i).length,0);assert.doesNotMatch(html(i),/PRIVATE_/);
  }
});

test("expired cache and retention boundary, not only server freshness, withhold all results", () => {
  const i=fixture(),expiry=Date.parse(i.metadata!.kys.freshness.retentionUntil!);
  assert(kysOverview(i,expiry-1).available); assert(!kysOverview(i,expiry).available);
  i.metadata!.kys.freshness.cacheExpiresAt="2026-10-08T12:00:00Z"; assert(!kysOverview(i,now).available);
  i.metadata!.kys.freshness.freshness="EXPIRED";assert.match(kysOverview(i,now).message,/stracił ważność/);
});

test("unknown/absent freshness or invalid/missing expiry is not an authority to show retained data", () => {
  for(const mutate of [(i:KysOverviewInput)=>{i.metadata!.kys.freshness.freshness="UNKNOWN";},(i:KysOverviewInput)=>{i.metadata!.kys.freshness.retentionUntil=null;},(i:KysOverviewInput)=>{i.metadata!.kys.freshness.cacheExpiresAt="invalid";},(i:KysOverviewInput)=>{i.metadata!.kys.reportAvailable=false;},(i:KysOverviewInput)=>{i.section.retrievedAt=null;}]){const i=fixture();mutate(i);assert(!kysOverview(i,now).available);}
});

test("cache/provider methods do not change output or freshness; reading has no side effects", () => {
  const i=fixture();i.metadata!.kys.freshness.lastRetrievalMethod="CACHE";const before=JSON.stringify(i);const model=kysOverview(i,now);assert.equal(JSON.stringify(i),before);
  i.metadata!.kys.freshness.lastRetrievalMethod="PROVIDER";assert.deepEqual(kysOverview(i,now),model);
});

test("JDG has no relation link to COMPANY-only section and keeps available registry facts", () => {
  const i=fixture();i.entityType="JDG";i.metadata!.entityType="JDG";assert(kysOverview(i,now).available);assert(!rows(i).some(r=>r.target==="relations"));
});

test("public overview has no person/raw IDs/provider branding/scoring/CTA, and all links resolve to existing mount targets", () => {
  const i=fixture();const text=html(i);assert.doesNotMatch(text,/PRIVATE_|MGBI|Vercly|PESEL|Pobierz raport|Risk Score|Poziom ryzyka/i);
  const full=renderToStaticMarkup(React.createElement(VerclyKysMount,{section:i.section}));
  for(const r of rows(i))assert(full.includes(`data-kys-detail="${r.target}"`));
  const twice=renderToStaticMarkup(React.createElement(React.Fragment,null,React.createElement(VerclyKysMount,{section:i.section}),React.createElement(VerclyKysMount,{section:i.section})));
  const ids=[...twice.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  assert.match(text,/Wykonanie: nie ustalono/);assert.match(text,/Kompletność raportu/);
});


test("positive person and other-list signals keep their party scope and do not count all persons", () => {
  const i=fixture();i.section.data!.screeningSummary!.otherLists=true;
  i.section.data!.beneficialOwners=[{fullName:"PRIVATE_PERSON",pesel:"PRIVATE_PESEL",birthDate:"PRIVATE_DOB",positions:[],citizenship:[],foundIn:[],sanctionsMatch:true,pepMatch:null}];
  assert.match(row(i,"Pozostałe listy").result,/Wymaga weryfikacji/);
  assert.match(row(i,"Beneficjenci — listy").result,/dopasowaniem do list: 1.*dotyczą osób/);
  assert.equal(row(i,"Beneficjenci — listy").target,"beneficiaries");assert.doesNotMatch(html(i),/PRIVATE_|12 wpisów/);
});
