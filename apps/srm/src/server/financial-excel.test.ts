import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import type { FinancialData, FinancialPeriod } from "@profitia/srm-xray";
import { amountInPln, buildFinancialExcel, financialExcelDate, validateFinancialExcelSelection } from "./financial-excel";

function period(year: number, facts: FinancialPeriod["facts"]): FinancialPeriod {
  return { from: `${year}-01-01`, to: `${year}-12-31`, scope: "standalone", documentId: `doc-${year}`, facts };
}

test("export builds exactly two Polish-labelled sheets, selected years and numeric PLN amounts", async () => {
  const data: FinancialData = { periods: [
    period(2025, [
      { metricCode: "PALA_NRFS", amount: "1234567.89", currency: "PLN", unit: "PLN" },
      { metricCode: "PALA_OAC", amount: "1000.50", currency: "PLN", unit: "THOUSAND_PLN" },
      { metricCode: "PALA_NPL", amount: "-17.35", currency: "PLN", unit: "PLN" },
      { metricCode: "BS_A_TA", amount: "8765432.10", currency: "PLN", unit: "PLN" },
    ]),
    period(2024, [{ metricCode: "PALA_NRFS", amount: "900000.00", currency: "PLN", unit: "PLN" }]),
  ] };
  const { filename, bytes } = await buildFinancialExcel(data, { nip: "8650004194", scope: "standalone", years: ["2025"] }, new Date("2026-10-08T10:00:00Z"));
  assert.equal(filename, "Financials_8650004194_20261008.xlsx");
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["ProfitLoss_8650004194_20261008", "Balance_8650004194_20261008"]);
  const profitLoss = workbook.worksheets[0];
  const balance = workbook.worksheets[1];
  assert.equal(profitLoss.getCell("B1").value, "2025");
  assert.equal(profitLoss.getCell("C1").value, null);
  const rows = Array.from({ length: profitLoss.rowCount }, (_, index) => profitLoss.getRow(index + 1));
  const revenue = rows.find((row) => row.getCell(1).value === "Przychody netto ze sprzedaży i zrównane z nimi");
  const costs = rows.find((row) => row.getCell(1).value === "Koszty działalności operacyjnej");
  const result = rows.find((row) => row.getCell(1).value === "Zysk lub strata netto");
  assert.equal(revenue?.getCell(2).value, 1234567.89);
  assert.equal(costs?.getCell(2).value, 1000500);
  assert.equal(result?.getCell(2).value, -17.35);
  assert.match(revenue?.getCell(2).numFmt ?? "", /0\.00/);
  assert.ok(Array.from({ length: balance.rowCount }, (_, index) => balance.getRow(index + 1))
    .some((row) => row.getCell(1).value === "Aktywa razem" && row.getCell(2).value === 8765432.1));
});

test("selection rejects unavailable years and malformed requests", async () => {
  assert.throws(() => validateFinancialExcelSelection({ nip: "8650004194", scope: "standalone", years: [] }), /Wybierz dostępne lata/);
  assert.throws(() => validateFinancialExcelSelection({ nip: "8650004194", scope: "standalone", years: ["2025", "2025"] }), /Wybierz dostępne lata/);
  await assert.rejects(buildFinancialExcel({ periods: [period(2025, [{ metricCode: "BS_A_TA", amount: "1", currency: "PLN", unit: "PLN" }])] },
    { nip: "8650004194", scope: "standalone", years: ["2024"] }), /Wybrane lata/);
});

test("monetary conversion uses stored source scale and does not invent unknown values", () => {
  assert.equal(amountInPln("123.4567", "PLN", "PLN"), 123.46);
  assert.equal(amountInPln("-123.4567", "PLN", "PLN"), -123.46);
  assert.equal(amountInPln("123.4567", "PLN", "THOUSAND_PLN"), 123456.7);
  assert.equal(amountInPln("123.45", "EUR", "PLN"), null);
  assert.equal(amountInPln("123.45", "PLN", "UNKNOWN"), null);
  assert.equal(financialExcelDate(new Date("2026-10-07T22:30:00Z")), "20261008");
});
