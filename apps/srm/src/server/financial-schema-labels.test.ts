import assert from "node:assert/strict";
import test from "node:test";
import { financialRowPresentation } from "./financial-schema-labels";
import { projectFinancialDocuments, type FinancialSourceRow } from "./financial-documents";

const document = projectFinancialDocuments([{ id: "label-fixture", document: { type: "financial_statement" }, content: { schema: { name: "JednostkaInnaWZlotych", version: "1-3" } } }])[0];
const row = (sourcePath: string, label = sourcePath): FinancialSourceRow => ({ section: sourcePath.startsWith("Bilans") ? "Bilans" : "RZiS", sourcePath, label, depth: 2, amounts: {} });
test("verified schema labels distinguish balance, income variants, hierarchy and revisions", () => {
  assert.equal(financialRowPresentation(document, row("Bilans.Aktywa")).label, "Aktywa razem");
  assert.equal(financialRowPresentation(document, row("Bilans.Aktywa.Aktywa_A.Aktywa_A_II")).label, "Rzeczowe aktywa trwałe");
  assert.equal(financialRowPresentation(document, row("RZiS.RZiSPor.B")).label, "Koszty działalności operacyjnej");
  assert.equal(financialRowPresentation(document, row("RZiS.RZiSKalk.B")).label, "Koszty sprzedanych produktów i towarów, w tym:");
  const old = { ...document, schemaVersion: "1-2", schemaVariant: "1" };
  assert.equal(financialRowPresentation(old, row("RZiS.RZiSPor.A.A_IV")).label, "Przychody netto ze sprzedaży towarów i materiałów");
  assert.equal(financialRowPresentation({ ...document, schemaVersion: "1-0E", schemaVariant: "2" }, row("RZiS.RZiSPor.A.A_IV")).label, "Przychody netto ze sprzedaży towarów");
  assert.match(financialRowPresentation(document, row("Bilans.Aktywa")).basis, /MF_XSD.*SHA256/);
});
test("ambiguous or unrecognized schemas never borrow a label from a different accounting meaning", () => {
  const ambiguous = { ...document, schemaVersion: "1-0E", schemaVariant: null };
  assert.match(financialRowPresentation(ambiguous, row("RZiS.RZiSPor.A.A_IV")).basis, /UNRESOLVED/);
  assert.equal(financialRowPresentation(ambiguous, row("Bilans.Aktywa")).label, "Aktywa razem");
  assert.match(financialRowPresentation({ ...ambiguous, schemaVariant: "2", schemaSystemCode: "SFJINZ (1)" }, row("RZiS.RZiSPor.A.A_IV")).basis, /UNRESOLVED/);
  assert.match(financialRowPresentation({ ...document, schemaVersion: "99" }, row("Bilans.Aktywa")).basis, /UNRESOLVED/);
  assert.equal(financialRowPresentation(document, row("Bilans.Aktywa.PozycjaUszczegolawiajaca.KwotyPozycji", "+ źródłowa pozycja własna")).label, "+ źródłowa pozycja własna");
  assert.ok(financialRowPresentation(document, row("Bilans.Aktywa.Aktywa_A.Aktywa_A_II")).order < financialRowPresentation(document, row("Bilans.Aktywa.Aktywa_A.Aktywa_A_III")).order);
});
