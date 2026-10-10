import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import type { FinancialData } from "@profitia/srm-xray";
import { buildFinancialExcel, exactExcelAmount, financialExcelDate, validateFinancialExcelSelection } from "./financial-excel";
import { projectFinancialDocuments } from "./financial-documents";
const data: FinancialData = { periods: [{ from: "2025-01-01", to: "2025-12-31", scope: "standalone", documentId: "doc-1:cfy", facts: [{ metricCode: "BS_A_TA", amount: "1", currency: "PLN", unit: "PLN" }, { metricCode: "PALA_NPL", amount: "-17.3456", currency: "PLN", unit: "PLN" }] }] };
const documents = projectFinancialDocuments([{ id: "doc-1", document: { type: "financial_statement", period_from_date: "2025-01-01", period_to_date: "2025-12-31", is_ias_compliant: true }, content: { schema: { name: "JednostkaInnaWZlotych", version: "1-3" }, extracted_fields: { "Bilans.Aktywa.KwotaA": "1234567890123456.789", "Bilans.Aktywa.KwotaB": null, "RZiS.RZiSKalk.A.PozycjaUszczegolawiajaca.NazwaPozycji": "=SUM(A1:A9)", "RZiS.RZiSKalk.A.PozycjaUszczegolawiajaca.KwotyPozycji.KwotaA": "-17.3456", "RZiS.RZiSKalk.A.PozycjaUszczegolawiajaca.KwotyPozycji.KwotaB1": "0" } } }]);
test("workbook round trip preserves all original XML amounts, source paths, precision and safe labels in exactly two sheets", async () => {
 const { filename, bytes } = await buildFinancialExcel(data, { nip: "8650004194", scope: "standalone", years: ["2025"] }, new Date("2026-10-10T10:00:00Z"), documents);
 assert.equal(filename, "Financials_8650004194_20261010.xlsx");
 const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
 assert.deepEqual(book.worksheets.map(s => s.name), ["ProfitLoss_8650004194_20261010", "Balance_8650004194_20261010"]);
 const income = book.worksheets[0], balance = book.worksheets[1];
 assert.equal(income.getCell("A9").value, "=SUM(A1:A9)"); assert.equal(income.getCell("A9").type, ExcelJS.ValueType.String);
 assert.equal(income.getCell("C9").value, -17.3456); assert.equal(income.getCell("E9").value, 0);
 assert.equal(balance.getCell("C9").value, "1234567890123456.789"); assert.equal(balance.getCell("D9").value, null);
 assert.match(String(income.getCell("E8").value), /KwotaB1.*nieustalony/);
 assert.match(String(income.getCell("B3").value), /IAS_IFRS/);
});
test("selected document identity and tenant projection are required; limited dashboard facts never masquerade as full Excel", async () => {
 assert.throws(() => validateFinancialExcelSelection({ nip: "8650004194", scope: "standalone", years: [] }), /Wybierz/);
 const selection = { nip: "8650004194", scope: "standalone" as const, years: ["2025"] };
 await assert.rejects(buildFinancialExcel(data, selection), /Pełne dane/);
 await assert.rejects(buildFinancialExcel(data, selection, new Date(), [{ ...documents[0], recordId: "other-document" }]), /Pełne dane/);
 await assert.rejects(buildFinancialExcel(data, { ...selection, years: ["2024"] }), /Wybrane lata/);
});
test("precision handling does not convert currencies, round four decimals or lose zero", () => {
 assert.equal(exactExcelAmount("-123.4567"), -123.4567); assert.equal(exactExcelAmount("0"), 0); assert.equal(exactExcelAmount(null), null);
 assert.equal(exactExcelAmount("9999999999999999.12"), "9999999999999999.12");
 assert.equal(financialExcelDate(new Date("2026-10-09T22:30:00Z")), "20261010");
});
