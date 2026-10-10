import ExcelJS from "exceljs";
import { type FinancialData, type FinancialPeriod } from "@profitia/srm-xray";

type Scope = FinancialPeriod["scope"];
import type { FinancialSourceDocument } from "./financial-documents";

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

/** Preserve source decimals. Excel's fifteen-digit limit must never silently round a source amount. */
export function exactExcelAmount(amount: string | null): string | number | null {
  if (amount === null) return null;
  const significant = amount.replace(/^-/, "").replace(".", "").replace(/^0+/, "");
  return significant.length <= 15 && Number.isFinite(Number(amount)) ? Number(amount) : amount;
}

export function financialExcelDate(now: Date): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}

function addSheet(workbook: ExcelJS.Workbook, name: string, section: "Bilans" | "RZiS", documents: readonly { document: FinancialSourceDocument; years: string[] }[]): void {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  sheet.getColumn(1).width = 72; sheet.getColumn(2).width = 90;
  for (const { document, years } of documents) {
    const heading = sheet.addRow([`${section} · ${years.join(", ")} · ${document.scope === "standalone" ? "jednostkowe" : "skonsolidowane"}`]);
    heading.font = { bold: true, color: { argb: "FFFFFFFF" } };
    heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF242F44" } };
    sheet.addRow(["Dokument / źródło", `${document.provider}/${document.model}/${document.recordId} · document_id=${document.documentId ?? "nieustalony"} · korekta=${document.correction ?? "nieustalona"} · złożono=${document.filingDate ?? "nieustalone"}`]);
    sheet.addRow(["Okres dokumentu / standard", `${document.from} – ${document.to} · ${document.standard} · is_ias_compliant=${document.isIasCompliant ?? "nieustalone"} · ${document.standardBasis}`]);
    sheet.addRow(["Waluta / skala wartości źródłowych", `${document.currency ?? "nieustalona"} · mnożnik jednostki ${document.scale ?? "nieustalony"} · bez przeliczania kwot`]);
    sheet.addRow(["Pochodzenie XML", `${document.schemaName} ${document.schemaVersion} · ${document.formatBasis} · ${document.availability} · ${document.validation}`]);
    sheet.addRow(["Wersja / suma kontrolna", `${document.mappingVersion} · SHA256 ${document.checksum}`]);
    sheet.addRow(["Precyzja / braki", "Kwoty ponad 15 cyfr zapisano jako dokładny tekst. Puste komórki oznaczają brak kwoty; zero pozostaje zerem. Kolumny porównawcze bez potwierdzonych dat zachowują oznaczenie XML."]);
    const columns = document.columns;
    const header = sheet.addRow(["Pozycja / etykieta źródłowa", "Ścieżka źródłowa", ...columns.map((column) => column.sourceColumn + (column.from && column.to ? ` · ${column.from} – ${column.to}` : " · okres nieustalony"))]);
    header.font = { bold: true }; header.alignment = { wrapText: true }; header.height = 40;
    for (let index = 0; index < columns.length; index++) sheet.getColumn(index + 3).width = 29;
    for (const item of document.rows.filter((row) => row.section === section)) {
      // ExcelJS string values remain string cells, even when source labels begin with '=' or '+'.
      const row = sheet.addRow([item.label, item.sourcePath, ...columns.map((column) => exactExcelAmount(item.amounts[column.sourceColumn] ?? null))]);
      row.outlineLevel = Math.min(7, Math.max(0, item.depth - 1));
      for (let index = 0; index < columns.length; index++) {
        const amount = item.amounts[columns[index].sourceColumn];
        const cell = row.getCell(index + 3);
        if (typeof cell.value === "string") cell.note = "Dokładna kwota źródłowa jako tekst — limit precyzji Excela.";
        if (typeof cell.value === "number") cell.numFmt = "#,##0" + (amount?.includes(".") ? "." + "0".repeat(amount.split(".")[1].length) : "");
        if (amount === null || amount === undefined) cell.note = "Brak wartości w kolumnie źródłowej.";
      }
    }
    sheet.addRow([]);
  }
  sheet.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape" };
}

export async function buildFinancialExcel(data: FinancialData, selection: FinancialExcelSelection, now = new Date(), sourceDocuments: readonly FinancialSourceDocument[] = []): Promise<{ filename: string; bytes: Buffer }> {
  const available = new Map(periodsForExcel(data, selection.scope).map((period) => [period.to.slice(0, 4), period]));
  if (selection.years.some((year) => !available.has(year))) throw new Error("Wybrane lata nie są dostępne w zapisanym raporcie.");
  const selected = new Map<string, { document: FinancialSourceDocument; years: string[] }>();
  for (const year of [...selection.years].sort().reverse()) {
    const period = available.get(year)!;
    const recordId = period.documentId.replace(/:(cfy|pfy)$/, "");
    const document = sourceDocuments.find((candidate) => candidate.recordId === recordId && candidate.scope === selection.scope);
    if (!document || document.availability !== "XML_SUPPORTED" || document.validation !== "VALID" || !document.rows.some((row) => row.section === "Bilans") || !document.rows.some((row) => row.section === "RZiS")) {
      throw new Error("Pełne dane bilansu i RZiS z XML nie są dostępne dla wybranego raportu w tej organizacji.");
    }
    const previous = selected.get(recordId);
    if (previous) previous.years.push(year); else selected.set(recordId, { document, years: [year] });
  }
  const documents = [...selected.values()];
  const date = financialExcelDate(now), workbook = new ExcelJS.Workbook();
  workbook.creator = "SRM X-Ray"; workbook.created = now; workbook.title = `Dane finansowe ${selection.nip}`;
  addSheet(workbook, `ProfitLoss_${selection.nip}_${date}`, "RZiS", documents);
  addSheet(workbook, `Balance_${selection.nip}_${date}`, "Bilans", documents);
  return { filename: `Financials_${selection.nip}_${date}.xlsx`, bytes: Buffer.from(await workbook.xlsx.writeBuffer()) };
}
