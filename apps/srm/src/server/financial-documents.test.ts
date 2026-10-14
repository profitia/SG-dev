import assert from "node:assert/strict";
import test from "node:test";
import { projectFinancialDocuments, applyFinancialDocumentMetadata, projectArchivedFinancialDocuments } from "./financial-documents";
import { createHash } from "node:crypto";
const record = (overrides: Record<string, unknown> = {}) => ({ id: "xml-1", document: { type: "financial_statement", period_from_date: "2025-02-01", period_to_date: "2026-01-31", is_ias_compliant: true }, content: { schema: { name: "JednostkaInnaWZlotych", version: "1-3" },
 extracted_fields: { "Naglowek.OkresOd": "2025-02-01", "Naglowek.OkresDo": "2026-01-31", "Bilans.Aktywa.KwotaA": "1234567890123456.789", "Bilans.Aktywa.KwotaB": null, "RZiS.RZiSKalk.A.KwotaA": "-17.3456", "RZiS.RZiSKalk.A.KwotaB1": "0", "RZiS.RZiSKalk.A.PozycjaUszczegolawiajaca.NazwaPozycji": "=1+1", "RZiS.RZiSKalk.A.PozycjaUszczegolawiajaca.KwotyPozycji.KwotaA": "1", "RachPrzeplywow.A.KwotaA": "999", "InformacjeDodatkowe.KwotaA": "888" }, standardized_fields: { bs: { a_ta_cfy: 1234567890123456.8 } } }, ...overrides });

const archiveOrg = "11111111-1111-4111-8111-111111111111", archiveNip = "5213390341";
function archived(records: unknown[] = [record({identifiers:{pl_nip:archiveNip}})]) {
  const payload_text = JSON.stringify({pages:[{results:records}]},null,2);
  return {organization_id:archiveOrg,nip:archiveNip,model:"pl-krs-rdf-record",payload_text,
    payload_jsonb_sha256:createHash("sha256").update(payload_text).digest("hex"),record_count:records.length};
}
test("archive reconstruction verifies persisted bytes rather than reserialized JSON key order", () => {
  const source=archived();const [document]=projectArchivedFinancialDocuments(source,archiveOrg,archiveNip);
  assert.equal(document.recordId,"xml-1");assert.equal(document.rows[0].amounts.KwotaA,"1234567890123456.789");
  assert.notEqual(createHash("sha256").update(JSON.stringify(JSON.parse(source.payload_text))).digest("hex"),source.payload_jsonb_sha256);
});
test("archive reconstruction rejects other tenants, suppliers and provider models", () => {
  for(const change of [{organization_id:"22222222-2222-4222-8222-222222222222"},{nip:"6310200831"},{model:"pl-krs-wp-record"}])
    assert.throws(()=>projectArchivedFinancialDocuments({...archived(),...change},archiveOrg,archiveNip),/identity mismatch/);
});
test("archive reconstruction rejects altered bytes and missing or altered checksum", () => {
  for(const change of [{payload_text:archived().payload_text.replace("1234567890123456.789","0")},{payload_jsonb_sha256:"a".repeat(64)},{payload_jsonb_sha256:""}])
    assert.throws(()=>projectArchivedFinancialDocuments({...archived(),...change},archiveOrg,archiveNip),/checksum mismatch/);
});
test("archive reconstruction rejects incomplete inventory, mixed supplier rows and duplicate documents", () => {
  assert.throws(()=>projectArchivedFinancialDocuments({...archived(),record_count:2},archiveOrg,archiveNip),/record count mismatch/);
  assert.throws(()=>projectArchivedFinancialDocuments(archived([record({identifiers:{pl_nip:"6310200831"}})]),archiveOrg,archiveNip),/supplier mismatch/);
  assert.throws(()=>projectArchivedFinancialDocuments(archived([record({identifiers:{pl_nip:archiveNip}}),record({identifiers:{pl_nip:archiveNip}})]),archiveOrg,archiveNip),/Duplicate/);
  const malformed=archived();malformed.payload_text=JSON.stringify({pages:[{}]});malformed.payload_jsonb_sha256=createHash("sha256").update(malformed.payload_text).digest("hex");
  assert.throws(()=>projectArchivedFinancialDocuments(malformed,archiveOrg,archiveNip),/Incomplete/);
});
test("a malformed source aborts reconstruction rather than manufacturing financial values", () => {
  assert.throws(()=>projectArchivedFinancialDocuments(archived([record({identifiers:{pl_nip:archiveNip},content:{schema:{name:"JednostkaInnaWZlotych",version:"1-3"},extracted_fields:{"Bilans.Aktywa.KwotaA":"NaN"}}})]),archiveOrg,archiveNip),/Invalid financial XML amount/);
});
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

test("saved empty MSR reports disclose accounting-standard limitation and preserve technical error states", () => {
 const docs = projectFinancialDocuments([record({content:{}})]);
 const section = {status:"EMPTY" as const,source:{provider:"MGBI" as const,model:"pl-krs-rdf-record",recordId:null},retrievedAt:null,effectiveAt:null,data:null,warnings:["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS"]};
 assert.deepEqual(applyFinancialDocumentMetadata(section,docs).warnings,["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS"]);
 assert.deepEqual(applyFinancialDocumentMetadata({...section,status:"ERROR"},docs).warnings,section.warnings);
});

test("an explicit XML UOR declaration conflicts with an IAS provider flag without leaking explanatory text", () => {
 const input=record(); const originalRows=projectFinancialDocuments([input])[0].rows;
 Object.assign(input.content.extracted_fields,{"WprowadzenieDoSprawozdaniaFinansowego.P_7.P_7D":"Sprawozdanie finansowe zostało sporządzone zgodnie z zasadami rachunkowości obowiązującymi w Polsce, określonymi w ustawie o\u00a0rachunkowości."});
 const [document]=projectFinancialDocuments([input]);
 assert.equal(document.standard,"UNKNOWN"); assert.equal(document.isIasCompliant,true);
 assert.equal(document.standardBasis,"MGBI_IAS_FLAG_CONFLICTS_WITH_XML_UOR_DECLARATION");
 assert.deepEqual(document.rows,originalRows); assert.equal(JSON.stringify(document).includes("obowiązującymi w Polsce"),false);
});
test("a generic reference to UOR does not replace the reported IAS standard", () => {
 const input=record();Object.assign(input.content.extracted_fields,{"WprowadzenieDoSprawozdaniaFinansowego.P_7.P_7D":"Noty zawierają odniesienie do ustawy o rachunkowości. Sprawozdanie sporządzono zgodnie z MSSF."});
 const [document]=projectFinancialDocuments([input]);assert.equal(document.standard,"IAS_IFRS");
 assert.equal(document.standardBasis,"MGBI_DOCUMENT_IAS_FLAG");
});

test("XML schema variant and system code are retained per document without altering source amounts", () => {
 const input=record();Object.assign(input.content.extracted_fields,{"Naglowek.WariantSprawozdania":"2","Naglowek.KodSprawozdania.@kodSystemowy":"SFJINZ (2)"});
 const [d]=projectFinancialDocuments([input]);assert.equal(d.schemaVariant,"2");assert.equal(d.schemaSystemCode,"SFJINZ (2)");
 assert.equal(d.rows[0].amounts.KwotaA,"1234567890123456.789");
});

test("mixed, unknown or supported financial documents never acquire an unsupported IAS verdict", () => {
 const section={status:"EMPTY" as const,source:{provider:"MGBI" as const,model:"pl-krs-rdf-record",recordId:null},retrievedAt:null,effectiveAt:null,data:null,warnings:[]};
 for(const documents of [projectFinancialDocuments([record()]),projectFinancialDocuments([record({content:{}}),record({id:"unknown",document:{type:"financial_statement"},content:{}})])]) {
  assert.ok(!applyFinancialDocumentMetadata(section,documents).warnings.includes("MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS"));
 }
 const docs=projectFinancialDocuments([record({content:{}})]);
 assert.ok(!applyFinancialDocumentMetadata({...section,warnings:["MGBI_PAGINATION_TRUNCATED"]},docs).warnings.includes("MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS"));
});
