import assert from "node:assert/strict";
import test from "node:test";
import { projectFinancialDocuments, applyFinancialDocumentMetadata } from "./financial-documents";
const record = (overrides: Record<string, unknown> = {}) => ({ id: "xml-1", document: { type: "financial_statement", period_from_date: "2025-02-01", period_to_date: "2026-01-31", is_ias_compliant: true }, content: { schema: { name: "JednostkaInnaWZlotych", version: "1-3" },
 extracted_fields: { "Naglowek.OkresOd": "2025-02-01", "Naglowek.OkresDo": "2026-01-31", "Bilans.Aktywa.KwotaA": "1234567890123456.789", "Bilans.Aktywa.KwotaB": null, "RZiS.RZiSKalk.A.KwotaA": "-17.3456", "RZiS.RZiSKalk.A.KwotaB1": "0", "RZiS.RZiSKalk.A.PozycjaUszczegolawiajaca.NazwaPozycji": "=1+1", "RZiS.RZiSKalk.A.PozycjaUszczegolawiajaca.KwotyPozycji.KwotaA": "1", "RachPrzeplywow.A.KwotaA": "999", "InformacjeDodatkowe.KwotaA": "888" }, standardized_fields: { bs: { a_ta_cfy: 1234567890123456.8 } } }, ...overrides });
test("complete XML sections retain custom hierarchy, exact values, null, signs and unassigned comparison dates; derived subset is not duplicated", () => {
 const [d] = projectFinancialDocuments([record()]);
 assert.equal(d.rows.length, 3); assert.equal(d.standard, "IAS_IFRS"); assert.equal(d.format, "XML");
 assert.equal(d.rows[0].amounts.KwotaA, "1234567890123456.789"); assert.equal(d.rows[0].amounts.KwotaB, null);
 assert.equal(d.rows[1].amounts.KwotaA, "-17.3456"); assert.equal(d.rows[1].amounts.KwotaB1, "0");
 assert.equal(d.columns.find(c => c.sourceColumn === "KwotaB1")?.to, null);
 assert.equal(d.rows[2].label, "=1+1"); assert.equal(d.currency, "PLN"); assert.equal(d.scale, "1");
});
test("standard is document-specific; false on an unknown schema does not establish UOR", () => {
 const documents = projectFinancialDocuments([record(), record({ id: "uor", document: { type: "financial_statement", is_ias_compliant: false } }), record({ id: "unknown", document: { type: "financial_statement", is_ias_compliant: false }, content: {} })]);
 assert.deepEqual(documents.map(d => d.standard), ["IAS_IFRS", "POLISH_UOR", "UNKNOWN"]);
});
test("known PDF, missing format and unsupported XML stay distinct without following any URL", () => {
 const [pdf, unknown, unsupported] = projectFinancialDocuments([record({ id: "pdf", files: { main_document: { original: { content_type: "application/pdf", url: "https://example.invalid/file" } } } }), record({ id: "unknown", content: {} }), record({ id: "xml", content: {}, files: { main_document: { original: { content_type: "application/xml" } } } })]);
 assert.deepEqual([pdf.availability, unknown.availability, unsupported.availability], ["NO_XML", "UNKNOWN_FORMAT", "UNSUPPORTED_XML"]);
 assert.equal(pdf.rows.length, 0); assert.equal(unknown.rows.length, 0);
});
test("XML dictionary rejects excessive complexity and malformed amounts; '>' paths are supported", () => {
 const input = record(); input.content.extracted_fields = { "Bilans>Aktywa>KwotaA": "0", "RZiS>RZiSPor>A>KwotaA": "2" } as unknown as typeof input.content.extracted_fields;
 assert.equal(projectFinancialDocuments([input])[0].rows.length, 2);
 input.content.extracted_fields = { "Bilans.Aktywa.KwotaA": "NaN" } as unknown as typeof input.content.extracted_fields;
 assert.throws(() => projectFinancialDocuments([input]), /Invalid financial XML amount/);
});

test("saved empty MSR reports disclose unresolved format and preserve technical error states", () => {
 const docs = projectFinancialDocuments([record({content:{}})]);
 const section = {status:"EMPTY" as const,source:{provider:"MGBI" as const,model:"pl-krs-rdf-record",recordId:null},retrievedAt:null,effectiveAt:null,data:null,warnings:["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS"]};
 assert.deepEqual(applyFinancialDocumentMetadata(section,docs).warnings,["MGBI_FINANCIAL_UNKNOWN_FORMAT"]);
 assert.deepEqual(applyFinancialDocumentMetadata({...section,status:"ERROR"},docs).warnings,section.warnings);
});
