import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinancialDataMount, latestAvailableFinancialYear, VerclyKysMount, type FinancialData, type SectionEnvelope, type VerclyKysData } from "@profitia/srm-xray";
import { toPublicSection, validateXrayRequest } from "./xray-lookup";

test("public response omits provider provenance and vendor warning codes", () => {
  const section: SectionEnvelope<null> = {
    status: "ERROR", source: { provider: "MGBI", model: "pl-krs-wp-record", recordId: "record" },
    retrievedAt: null, effectiveAt: null, data: null, warnings: ["MGBI_NOT_CONFIGURED"],
  };
  const publicJson = JSON.stringify(toPublicSection(section));
  assert.ok(!publicJson.includes("MGBI"));
  assert.ok(!publicJson.includes("pl-krs-wp-record"));
  assert.ok(!publicJson.includes("record"));
});

test("public report preserves safe, distinct reasons for KYS notices and missing financial facts", () => {
  const source = { provider: "VERCLY" as const, model: "KYS_NIP", recordId: "private-id" };
  const kys = toPublicSection({ status: "PARTIAL", source, retrievedAt: null, effectiveAt: null, data: null,
    warnings: ["VERCLY_SEVERITY_0", "VERCLY_SEVERITY_0", "VERCLY_INCOMPLETE_SOURCES"] });
  assert.deepEqual(kys.warnings, ["KYS_PROVIDER_NOTICE", "KYS_INCOMPLETE_SOURCES"]);
  const financial = toPublicSection({ status: "EMPTY", source: { provider: "MGBI", model: "pl-krs-rdf-record", recordId: null },
    retrievedAt: null, effectiveAt: null, data: null, warnings: ["MGBI_NO_STRUCTURED_FINANCIAL_DATA"] });
  assert.deepEqual(financial.warnings, ["FINANCIAL_NO_STRUCTURED_DATA"]);
  const international = toPublicSection({ status: "EMPTY", source: { provider: "MGBI", model: "pl-krs-rdf-record", recordId: null },
    retrievedAt: null, effectiveAt: null, data: null, warnings: ["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS"] });
  assert.deepEqual(international.warnings, ["FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE"]);
  assert.ok(!JSON.stringify({ kys, financial }).includes("VERCLY"));
  assert.ok(!JSON.stringify({ kys, financial }).includes("MGBI"));
});

test("public report keeps unknown provider errors generic", () => {
  const section = toPublicSection({ status: "ERROR", source: { provider: "MGBI", model: "pl-krs-rdf-record", recordId: null },
    retrievedAt: null, effectiveAt: null, data: null, warnings: ["MGBI_HTTP_401"] });
  assert.deepEqual(section.warnings, ["REPORT_WARNING"]);
});

test("accepts a checksum-valid NIP as the only search value", () => {
  assert.deepEqual(validateXrayRequest({ identifier: "527-244-39-55" }), {
    identifier: { type: "NIP", value: "5272443955" },
  });
});

test("rejects invalid NIP without requiring company name or phone", () => {
  assert.throws(() => validateXrayRequest({ identifier: "5272443956" }), /kontrolna/);
  assert.throws(() => validateXrayRequest({ identifier: "0000217580" }), /kontrolna/);
  assert.throws(() => validateXrayRequest({ identifier: "123" }), /10 cyfr/);
});

test("financial mount groups readable rows, converts PLN to thousands and keeps KYS independent", () => {
  const section: SectionEnvelope<FinancialData> = {
    status: "SUCCESS", source: { provider: "MGBI", model: "KRS-RDF", recordId: "record" },
    retrievedAt: "2026-10-06T00:00:00Z", effectiveAt: "2025-12-31", warnings: [],
    data: { periods: [
      { from: "2024-01-01", to: "2024-12-31", scope: "standalone", documentId: "old:cfy", facts: [
        { metricCode: "BS_A_TA", amount: "2", currency: "PLN", unit: "THOUSAND_PLN" },
        { metricCode: "PALA_NPL", amount: "100", currency: "PLN", unit: "PLN" },
      ] },
      { from: "2025-01-01", to: "2025-12-31", scope: "standalone", documentId: "new:cfy", facts: [
        { metricCode: "BS_A_TA", amount: "3000", currency: "PLN", unit: "PLN" },
        { metricCode: "PALA_NPL", amount: "150", currency: "PLN", unit: "PLN" },
        { metricCode: "PALA_OAC_MAEC", amount: "222", currency: "PLN", unit: "PLN" },
        { metricCode: "PALA_UNKNOWN", amount: "1", currency: "PLN", unit: "PLN" },
      ] },
    ] },
  };
  const html = renderToStaticMarkup(createElement(FinancialDataMount, { section }));
  assert.equal(latestAvailableFinancialYear(section.data), "2025");
  assert.match(html, /Rachunek zysków i strat/);
  assert.match(html, /Aktywa/);
  assert.match(html, /Pasywa/);
  assert.match(html, /Zużycie materiałów i energii/);
  assert.match(html, /Aktywa razem/);
  assert.match(html, /3,00/);
  assert.match(html, /2,00/);
  assert.match(html, /tysiącach złotych/);
  assert.match(html, /Analiza wskaźnikowa/);
  assert.match(html, /Siła finansowa/);
  assert.match(html, /Płynność bieżąca/);
  assert.match(html, /Udział zobowiązań i rezerw w aktywach/);
  assert.match(html, /Marża netto/);
  assert.match(html, /Cykl konwersji gotówki/);
  assert.equal(html.match(/W trakcie developmentu/g)?.length, 18);
  assert.match(html, /Nie można obliczyć/);
  assert.ok(!html.includes("Wskaźniki pomogą ocenić płynność"));
  assert.ok(!html.includes("Źródło:"));
  assert.ok(!html.includes("MGBI"));
  assert.ok(!html.includes("PALA_UNKNOWN"));
});

test("financial mount starts with eight newest years and offers older columns", () => {
  const periods = Array.from({ length: 10 }, (_, index) => {
    const year = 2016 + index;
    return { from: `${year}-01-01`, to: `${year}-12-31`, scope: "standalone" as const, documentId: `doc-${year}`, facts: [
      { metricCode: "PALA_NRFS", amount: "1000000", currency: "PLN", unit: "PLN" },
      { metricCode: "PALA_OAC", amount: "500000", currency: "PLN", unit: "PLN" },
      { metricCode: "PALA_NPL", amount: "200000", currency: "PLN", unit: "PLN" },
      { metricCode: "BS_A_TA", amount: "3000000", currency: "PLN", unit: "PLN" },
    ] };
  });
  const section: SectionEnvelope<FinancialData> = {
    status: "SUCCESS", source: { provider: "MGBI", model: "KRS-RDF", recordId: "record" },
    retrievedAt: "2026-10-06T00:00:00Z", effectiveAt: "2025-12-31", warnings: ["FINANCIAL_COST_SIGN_UNVERIFIED"], data: { periods },
  };
  const html = renderToStaticMarkup(createElement(FinancialDataMount, { section }));
  assert.match(html, /Więcej lat \(2\)/);
  assert.match(html, /Przesuń tabelę w lewo/);
  assert.match(html, /Pokaż wykres: Zysk lub strata netto/);
  assert.match(html, />2018<\/th>/);
  assert.ok(!html.includes(">2016</th>"));
  assert.equal(latestAvailableFinancialYear(section.data), "2025");
  assert.ok(html.indexOf(">2025</th>") < html.indexOf(">2018</th>"));
  assert.match(html, /financial-chart-value/);
  assert.match(html, /financial-table-group"><th scope="rowgroup"[^>]*>Przychody<\/th>/);
  assert.match(html, /<tr><th scope="row">Przychody netto ze sprzedaży i zrównane z nimi<\/th>/);
  assert.match(html, /<tr><th scope="row">Koszty działalności operacyjnej<\/th>/);
  assert.ok(!html.includes("Nie udało się potwierdzić znaku części kosztów"));
});

test("KYS mount expands provider sanctions codes to list names", () => {
  const section: SectionEnvelope<VerclyKysData> = {
    status: "SUCCESS", source: { provider: "VERCLY", model: "KYS_NIP", recordId: "report" },
    retrievedAt: "2026-10-06T00:00:00Z", effectiveAt: null, warnings: [],
    data: { correlationId: "request", reportId: "report", isComplete: true, queriedRegisters: ["VAT Information Exchange System"], stateAsOf: null,
      company: { name: "Spółka", krs: null, nip: null, regon: null, legalForm: "JOINT_STOCK", address: null, country: "PL", activityStatus: "ACTIVE", registeredAt: null, lastChangedAt: null, mainPkd: null, shareCapital: "332905973.00", representation: null },
      registryChecks: { krzListed: false, vatActive: true, euVat: null },
      screenedLists: [{ name: "uk_ofsi_sanctions", type: "SANCTIONS", matched: false }] },
  };
  const html = renderToStaticMarkup(createElement(VerclyKysMount, { section }));
  assert.match(html, /UK Office of Financial Sanctions Implementation \(OFSI\)/);
  assert.ok(!html.includes("uk_ofsi_sanctions"));
  assert.match(html, /Spółka akcyjna/);
  assert.match(html, /Aktywny/);
  assert.match(html, /332\s?905,97 tys\. PLN/);
  assert.match(html, /System wymiany informacji o VAT \(VIES\)/);
  assert.match(html, /Krajowym Rejestrze Zadłużonych<\/dt><dd>Nie/);
  assert.match(html, /Podatnik VAT czynny<\/dt><dd>Tak/);
  assert.match(html, /Podatnik VAT UE<\/dt><dd>nie ustalono/);
  assert.ok(!html.includes("brak trafienia"));
  assert.ok(!html.includes("VERCLY"));
  assert.ok(!html.includes("Vercly"));
  assert.ok(!html.includes("Źródło:"));
});

test("KYS mount masks PESEL and keeps beneficiary details aligned without birth date", () => {
  const section: SectionEnvelope<VerclyKysData> = {
    status: "SUCCESS", source: { provider: "VERCLY", model: "KYS_NIP", recordId: "report" },
    retrievedAt: null, effectiveAt: null, warnings: [],
    data: { correlationId: "request", reportId: "report", isComplete: true, queriedRegisters: [], stateAsOf: null,
      relatedPersonsCount: 1, beneficialOwnersCount: 1,
      relatedPersons: [{ fullName: "Anna Testowa", pesel: "10987654321", peselRevealToken: "token-1", birthDate: null, positions: ["CZŁONEK ZARZĄDU"], citizenship: [], foundIn: [], sanctionsMatch: false, pepMatch: false }],
      beneficialOwners: [{ fullName: "Jan Przykładowy", pesel: "12345678901", peselRevealToken: "token-2", birthDate: null, positions: ["Beneficjent rzeczywisty"], citizenship: ["POLSKA"], foundIn: ["CRBR", "Bardzo długa nazwa podmiotu powiązanego"], sanctionsMatch: false, pepMatch: true }],
    },
  };
  const html = renderToStaticMarkup(createElement(VerclyKysMount, { section, onRevealPesel: async () => "12345678901" }));
  assert.match(html, /Osoby pełniące funkcje kierownicze i nadzorcze/);
  assert.match(html, /Beneficjenci rzeczywiści/);
  assert.ok(!html.includes("10987654321"));
  assert.ok(!html.includes("12345678901"));
  assert.equal((html.match(/>Pokaż<\/button>/g) ?? []).length, 2);
  assert.equal((html.match(/<dt>Data urodzenia<\/dt>/g) ?? []).length, 1);
  assert.match(html, /CRBR/);
  assert.equal((html.match(/<details class="kys-person-entry">/g) ?? []).length, 2);
  assert.match(html, /<summary class="kys-person-summary">/);
  assert.match(html, /kys-person-preview/);
  assert.match(html, /Sankcje<\/small>Nie/);
  assert.match(html, /PEP<\/small>Tak/);
  assert.match(html, /<dt>Rejestr<\/dt><dd>CRBR, Bardzo długa nazwa podmiotu powiązanego<\/dd>/);
  assert.match(html, /kys-person-open-label">Rozwiń/);
  assert.match(html, /kys-person-close-label">Zwiń/);
  assert.ok(!html.includes("Szczegóły osób i ich identyfikatory nie są udostępniane"));
});

test("JDG KYS mount shows the sole proprietor form without company-only fields", () => {
  const section: SectionEnvelope<VerclyKysData> = {
    status: "PARTIAL", source: { provider: "VERCLY", model: "KYS_NIP", recordId: "jdg-report" },
    retrievedAt: "2026-10-06T00:00:00Z", effectiveAt: null, warnings: ["VERCLY_SEVERITY_0"],
    data: { correlationId: "jdg-request", reportId: "jdg-report", isComplete: true, queriedRegisters: [], stateAsOf: null,
      company: { name: "Przykładowa JDG", krs: null, nip: "7972088368", regon: null, legalForm: "SOLE_PROPRIETORSHIP", address: null, country: "PL", activityStatus: "ACTIVE", registeredAt: null, lastChangedAt: null, mainPkd: null, shareCapital: null, representation: null },
      registryChecks: { krzListed: null, vatActive: null, euVat: null },
      screenedLists: [{ name: "uk_ofsi_sanctions", type: "SANCTIONS", matched: false }] },
  };
  const html = renderToStaticMarkup(createElement(VerclyKysMount, { section, entityType: "JDG" }));
  assert.match(html, /Jednoosobowa działalność gospodarcza/);
  assert.match(html, /UK Office of Financial Sanctions Implementation \(OFSI\)/);
  assert.ok(!html.includes("<dt>KRS</dt>"));
  assert.ok(!html.includes("Kapitał zakładowy"));
  assert.ok(!html.includes("Zasady reprezentacji"));
  assert.ok(!html.includes("VERCLY"));
});

test("JDG KYS notice does not claim the complete report is missing", () => {
  const section: SectionEnvelope<VerclyKysData> = {
    status: "PARTIAL", source: { provider: "VERCLY", model: "KYS_NIP", recordId: null },
    retrievedAt: null, effectiveAt: null, warnings: ["KYS_PROVIDER_NOTICE"],
    data: { correlationId: "request", reportId: null, isComplete: true, queriedRegisters: [], stateAsOf: null,
      registryChecks: { krzListed: null, vatActive: null, euVat: null }, screenedLists: [] },
  };
  const html = renderToStaticMarkup(createElement(VerclyKysMount, { section, entityType: "JDG" }));
  assert.match(html, /Raport KYS zawiera uwagę dotyczącą części sprawdzeń/);
  assert.ok(!html.includes("Źródło nie zwróciło pełnych danych"));
});

test("financial no-data message avoids suggesting the financial report is absent", () => {
  const section: SectionEnvelope<FinancialData> = {
    status: "EMPTY", source: { provider: "MGBI", model: "pl-krs-rdf-record", recordId: null },
    retrievedAt: null, effectiveAt: null, data: null, warnings: ["FINANCIAL_NO_STRUCTURED_DATA"],
  };
  const html = renderToStaticMarkup(createElement(FinancialDataMount, { section }));
  assert.match(html, /Nie mamy obecnie kwot finansowych do wyświetlenia dla tej firmy/);
  assert.ok(!html.includes("Źródło nie zwróciło pełnych danych"));
});

test("financial mount explains confirmed international-standard report availability", () => {
  const section: SectionEnvelope<FinancialData> = {
    status: "EMPTY", source: { provider: "MGBI", model: "pl-krs-rdf-record", recordId: null },
    retrievedAt: null, effectiveAt: null, data: null, warnings: ["FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE"],
  };
  const html = renderToStaticMarkup(createElement(FinancialDataMount, { section }));
  assert.match(html, /Sprawozdanie finansowe jest dostępne/);
  assert.match(html, /międzynarodowych standardów rachunkowości/);
  assert.ok(!html.includes("MGBI"));
  assert.ok(!html.includes("brak danych</p>"));
});

test("KYS pending state has an honest indeterminate progress indicator", () => {
  const section: SectionEnvelope<VerclyKysData> = {
    status: "PENDING", source: { provider: "VERCLY", model: "KYS_NIP", recordId: null },
    retrievedAt: null, effectiveAt: null, data: null, warnings: [],
  };
  const html = renderToStaticMarkup(createElement(VerclyKysMount, { section }));
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuetext="Pobieranie trwa"/);
  assert.ok(!html.includes("aria-valuenow"));
});
