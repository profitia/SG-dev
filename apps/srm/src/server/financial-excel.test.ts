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
 assert.equal(income.getCell("A2").value, "=SUM(A1:A9)"); assert.equal(income.getCell("A2").type, ExcelJS.ValueType.String);
 assert.equal(income.getCell("B2").value, -17.3456); assert.equal(income.getCell("D2").value, 0);
 assert.equal(balance.getCell("B2").value, "1234567890123456.789"); assert.equal(balance.getCell("C2").value, null);
 assert.match(String(income.getCell("D1").value), /KwotaB1.*nieustalony/);
 assert.match(String(income.getCell("B1").note), /IAS_IFRS/);
 assert.equal(balance.getCell("A1").value, "Pozycja"); assert.equal(balance.getCell("A2").value, "Aktywa razem");
 assert.match(String(balance.getCell("A2").note), /Bilans\.Aktywa/);
 assert.equal(balance.columnCount, 4); assert.equal(balance.rowCount, 2);
 assert.equal(balance.views[0].state, "frozen");
 if (balance.views[0].state === "frozen") assert.equal(balance.views[0].xSplit, 1);
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

test("all source items export with accounting labels in A, amounts from B and XML hierarchy order, without technical columns", async () => {
 const [document] = projectFinancialDocuments([{id:"doc-1", document:{type:"financial_statement",period_from_date:"2025-01-01",period_to_date:"2025-12-31"},content:{schema:{name:"JednostkaInnaWZlotych",version:"1-0E"},extracted_fields:{
  "Naglowek.WariantSprawozdania":"2", "Bilans.Aktywa.KwotaA":"10", "Bilans.Aktywa.Aktywa_A.KwotaA":"0", "Bilans.Aktywa.Aktywa_A.Aktywa_A_I.KwotaA":"-3",
  "RZiS.RZiSPor.A.KwotaA":"10", "RZiS.RZiSPor.A.A_IV.KwotaA":"7", "RZiS.RZiSPor.B.KwotaA":"-2"
 }}}]);
 const result = await buildFinancialExcel(data,{nip:"8650004194",scope:"standalone",years:["2025"]},new Date(),[document]);
 const book = new ExcelJS.Workbook();await book.xlsx.load(result.bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
 assert.deepEqual(book.worksheets[1].getColumn(1).values.slice(2), ["Aktywa razem","Aktywa trwałe","Wartości niematerialne i prawne"]);
 assert.deepEqual(book.worksheets[1].getColumn(2).values.slice(2), [10,0,-3]);
 assert.deepEqual(book.worksheets[0].getColumn(1).values.slice(2), ["Przychody netto ze sprzedaży i zrównane z nimi, w tym:","Przychody netto ze sprzedaży towarów","Koszty działalności operacyjnej"]);
 for (const sheet of book.worksheets) { assert.equal(sheet.columnCount,2);sheet.eachRow((row,number)=>{
  assert.ok(!/^(Bilans|RZiS)\./.test(String(row.getCell(1).value)));
  if(number>1)assert.equal(typeof row.getCell(2).value,"number");
 }); }
});
test("selected years become adjacent document value columns; similar labels never merge different paths or corrected versions", async () => {
 const d1={...documents[0],schemaName:"JednostkaInnaWZlotych",schemaVersion:"1-3",columns:[documents[0].columns[0]],rows:[
 {...documents[0].rows[0],amounts:{KwotaA:"10"}},
 {...documents[0].rows[1],amounts:{KwotaA:"1"}}]};
 const d2={...d1,recordId:"doc-2",from:"2024-01-01",to:"2024-12-31",correction:true,columns:[{...d1.columns[0],from:"2024-01-01",to:"2024-12-31"}],rows:d1.rows.map(row=>({...row,amounts:{KwotaA:"20"}}))};
 const result=await buildFinancialExcel({periods:[...data.periods,{...data.periods[0],from:"2024-01-01",to:"2024-12-31",documentId:"doc-2:cfy"}]},{nip:"8650004194",scope:"standalone",years:["2024","2025"]},new Date(),[d1,d2]);
 const book=new ExcelJS.Workbook();await book.xlsx.load(result.bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
 const balance=book.worksheets[1];assert.equal(balance.rowCount,2);assert.equal(balance.getCell("B2").value,10);assert.equal(balance.getCell("C2").value,20);
 assert.match(String(balance.getCell("B1").note),/doc-1/);assert.match(String(balance.getCell("C1").note),/doc-2.*\n.*korekta=true/);
 const sameYearCorrection={...d1,recordId:"correction",correction:true};
 const corrected=await buildFinancialExcel({periods:[{...data.periods[0],documentId:"correction:cfy"}]},{nip:"8650004194",scope:"standalone",years:["2025"]},new Date(),[d1,sameYearCorrection]);
 await book.xlsx.load(corrected.bytes as unknown as Parameters<typeof book.xlsx.load>[0]);assert.match(String(book.worksheets[1].getCell("B1").note),/correction/);
});
