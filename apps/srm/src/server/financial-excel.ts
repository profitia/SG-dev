import ExcelJS from "exceljs";
import { financialLabels, type FinancialData, type FinancialPeriod } from "@profitia/srm-xray";

type Scope = FinancialPeriod["scope"];
type Group = { title: string; codes: readonly string[] };

const incomeGroups: readonly Group[] = [
  { title: "Przychody", codes: ["PALA_NRFS", "PALA_NET_SALES", "PALA_NRFS_CIIOP", "PALA_NRFS_MCOPFIPOTE", "PALA_OOR", "PALA_FR"] },
  { title: "Koszty", codes: ["PALA_OAC", "PALA_COGS", "PALA_OAC_D", "PALA_OAC_MAEC", "PALA_OAC_ES", "PALA_OAC_TAC", "PALA_OAC_TACI_ED", "PALA_OAC_R", "PALA_OAC_SIAOBI", "PALA_OAC_OCBT", "PALA_OAC_VOGAMS", "PALA_OOC", "PALA_FC", "PALA_INTEREST_EXPENSE", "PALA_IT"] },
  { title: "Wynik finansowy", codes: ["PALA_PLFS", "PALA_GROSS_PROFIT", "PALA_PLFOA", "PALA_GPL", "PALA_NPL"] },
];
const balanceGroups: readonly Group[] = [
  { title: "Aktywa", codes: ["BS_A_FA", "BS_A_CA", "BS_A_CA_INV", "BS_TRADE_RECEIVABLES_RELATED", "BS_TRADE_RECEIVABLES_INVESTEE", "BS_TRADE_RECEIVABLES_OTHER", "BS_A_TA"] },
  { title: "Pasywa", codes: ["BS_LAE_E", "BS_LAE_NC", "BS_LAE_LAPFL", "BS_LAE_LAPFL_LTL", "BS_LAE_LAPFL_STL", "BS_TRADE_PAYABLES_RELATED", "BS_TRADE_PAYABLES_INVESTEE", "BS_TRADE_PAYABLES_OTHER"] },
];

export type FinancialExcelSelection = { nip: string; scope: Scope; years: string[] };

export function validateFinancialExcelSelection(input: unknown): FinancialExcelSelection {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Nieprawidłowy wybór danych.");
  const value = input as Record<string, unknown>;
  if (typeof value.nip !== "string" || !/^\d{10}$/.test(value.nip)) throw new Error("Nieprawidłowy NIP.");
  if (value.scope !== "standalone" && value.scope !== "consolidated") throw new Error("Wybierz rodzaj sprawozdania.");
  if (!Array.isArray(value.years) || !value.years.length || value.years.length > 100 ||
      value.years.some((year) => typeof year !== "string" || !/^\d{4}$/.test(year)) ||
      new Set(value.years).size !== value.years.length) throw new Error("Wybierz dostępne lata.");
  return { nip: value.nip, scope: value.scope, years: value.years as string[] };
}

function complete(period: FinancialPeriod): boolean {
  return period.facts.some((fact) => fact.metricCode.startsWith("BS_"))
    && period.facts.some((fact) => fact.metricCode.startsWith("PALA_"));
}

/** Match the dashboard's best-report-per-year rule without asking MGBI again. */
export function periodsForExcel(data: FinancialData, scope: Scope): FinancialPeriod[] {
  const candidates = data.periods.filter((period) => period.scope === scope && period.facts.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(period.to))
    .sort((a, b) => b.to.localeCompare(a.to) || Number(complete(b)) - Number(complete(a)) || b.facts.length - a.facts.length);
  const byYear = new Map<string, FinancialPeriod>();
  for (const period of candidates) {
    const year = period.to.slice(0, 4);
    const previous = byYear.get(year);
    const quality = (item: FinancialPeriod) => (complete(item) ? 100000 : 0) + item.facts.length;
    if (!previous || quality(period) > quality(previous)) byYear.set(year, period);
  }
  return [...byYear.values()].sort((a, b) => b.to.localeCompare(a.to));
}

/** Convert source PLN or thousands of PLN to grosz before giving Excel a numeric cell. */
export function amountInPln(amount: string, currency: string, unit: string): number | null {
  if (currency !== "PLN" || (unit !== "PLN" && unit !== "THOUSAND_PLN") || !/^-?\d{1,20}(?:\.\d{1,4})?$/.test(amount)) return null;
  const negative = amount.startsWith("-");
  const [whole, fraction = ""] = (negative ? amount.slice(1) : amount).split(".");
  let tenThousandths = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, "0"));
  if (unit === "THOUSAND_PLN") tenThousandths *= 1000n;
  const cents = (tenThousandths + 50n) / 100n;
  // Excel keeps about 15 significant decimal digits. Larger amounts cannot
  // honestly be represented to a grosz as numeric worksheet cells.
  if (cents > 99_999_999_999_999n) return null;
  return Number(negative ? -cents : cents) / 100;
}

export function financialExcelDate(now: Date): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}

function addSheet(workbook: ExcelJS.Workbook, name: string, groups: readonly Group[], periods: readonly FinancialPeriod[], scope: Scope): void {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });
  sheet.getColumn(1).width = 68;
  for (let index = 0; index < periods.length; index++) sheet.getColumn(index + 2).width = 20;
  sheet.addRow(["Pozycja (PLN)", ...periods.map((period) => period.to.slice(0, 4))]);
  sheet.addRow(["Okres / zakres", ...periods.map((period) => `${period.from} – ${period.to} · ${scope === "standalone" ? "jednostkowe" : "skonsolidowane"}`)]);
  for (const row of [sheet.getRow(1), sheet.getRow(2)]) {
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF242F44" } };
  }
  sheet.getRow(2).height = 29;
  for (const group of groups) {
    const present = group.codes.filter((code) => periods.some((period) => period.facts.some((fact) => fact.metricCode === code)));
    if (!present.length) continue;
    const heading = sheet.addRow([group.title]);
    heading.font = { bold: true, color: { argb: "FFFFFFFF" } };
    heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF006D9E" } };
    for (const code of present) {
      const row = sheet.addRow([financialLabels[code]?.label ?? code, ...periods.map((period) => {
        const fact = period.facts.find((candidate) => candidate.metricCode === code);
        return fact ? amountInPln(fact.amount, fact.currency, fact.unit) : null;
      })]);
      for (let column = 2; column <= periods.length + 1; column++) row.getCell(column).numFmt = '#,##0.00;[Red](#,##0.00);–';
      if (code === "PALA_NPL" || code === "BS_A_TA" || code === "BS_LAE_LAPFL") row.font = { bold: true };
    }
  }
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
}

export async function buildFinancialExcel(data: FinancialData, selection: FinancialExcelSelection, now = new Date()): Promise<{ filename: string; bytes: Buffer }> {
  const available = periodsForExcel(data, selection.scope);
  const byYear = new Map(available.map((period) => [period.to.slice(0, 4), period]));
  if (selection.years.some((year) => !byYear.has(year))) throw new Error("Wybrane lata nie są dostępne w zapisanym raporcie.");
  const periods = selection.years.map((year) => byYear.get(year)!).sort((a, b) => b.to.localeCompare(a.to));
  const date = financialExcelDate(now);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SRM X-Ray";
  workbook.created = now;
  workbook.title = `Dane finansowe ${selection.nip}`;
  addSheet(workbook, `ProfitLoss_${selection.nip}_${date}`, incomeGroups, periods, selection.scope);
  addSheet(workbook, `Balance_${selection.nip}_${date}`, balanceGroups, periods, selection.scope);
  return { filename: `Financials_${selection.nip}_${date}.xlsx`, bytes: Buffer.from(await workbook.xlsx.writeBuffer()) };
}
