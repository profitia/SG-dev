import ExcelJS from "exceljs";
import { type FinancialData, type FinancialPeriod } from "@profitia/srm-xray";

type Scope = FinancialPeriod["scope"];
import { financialRowPresentation } from "./financial-schema-labels";
import type { FinancialSourceDocument, FinancialSourceRow } from "./financial-documents";

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

function documentProvenance(document: FinancialSourceDocument): string {
  return [`Dokument: ${document.provider}/${document.model}/${document.recordId}; document_id=${document.documentId ?? "nieustalony"}`,
    `Zakres: ${document.scope}; okres: ${document.from} – ${document.to}; korekta=${document.correction ?? "nieustalona"}; złożono=${document.filingDate ?? "nieustalone"}`,
    `Standard: ${document.standard}; is_ias_compliant=${document.isIasCompliant ?? "nieustalone"}; ${document.standardBasis}`,
    `Waluta: ${document.currency ?? "nieustalona"}; mnożnik jednostki: ${document.scale ?? "nieustalony"}; kwoty bez przeliczeń`,
    `XML: ${document.schemaName} ${document.schemaVersion}; wariant=${document.schemaVariant ?? "nieustalony"}; ${document.schemaSystemCode ?? ""}; ${document.formatBasis}; ${document.availability}; ${document.validation}`,
    `Mapowanie: ${document.mappingVersion}; SHA256 ${document.checksum}`].join("\n");
}

function addSheet(workbook: ExcelJS.Workbook, name: string, section: "Bilans" | "RZiS", documents: readonly { document: FinancialSourceDocument; years: string[] }[]): void {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
  sheet.getColumn(1).width = 85;
  const columns = documents.flatMap(({ document, years }) => document.columns.map(column => ({ document, column, years })));
  const header = sheet.addRow(["Pozycja", ...columns.map(({ document, column, years }) =>
    (column.from && column.to ? `${column.from} – ${column.to}` : `${column.sourceColumn} · okres nieustalony · raport ${years.join(", ")}`)
      + ` (${document.currency ?? "waluta nieustalona"}${document.scale === "1000" ? ", tys." : ""})`)]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF242F44" } };
  header.alignment = { wrapText: true, vertical: "middle" }; header.height = 55;
  header.getCell(1).note = "Wszystkie dostępne pozycje wybranych sprawozdań. Kwoty ponad 15 cyfr są dokładnym tekstem. Puste komórki oznaczają brak wartości; zero pozostaje zerem. Pochodzenie dokumentów i pozycji zapisano w komentarzach. Różne dokumenty i kolumny porównawcze pozostają rozdzielone.";
  columns.forEach(({ document, column }, index) => {
    sheet.getColumn(index + 2).width = 29;
    header.getCell(index + 2).note = `${documentProvenance(document)}\nKolumna XML: ${column.sourceColumn}; rola=${column.role}; ${column.basis}`;
  });
  type DisplayRow = { label: string; depth: number; order: number; family: string; sources: Map<string, { row: FinancialSourceRow; basis: string }> };
  const rows = new Map<string, DisplayRow>();
  for (const { document } of documents) for (const item of document.rows.filter(row => row.section === section)) {
    const presentation = financialRowPresentation(document, item);
    const family = document.schemaName?.replace(/(WZlotych|WTysiacachZlotych)$/, "") ?? document.schemaName ?? "";
    // Merge only the same source position with the same verified meaning across selected documents.
    // Amounts always stay in that document's own columns; name or amount alone is never an identity.
    const key = JSON.stringify([family, item.sourcePath.replaceAll(">", "."), presentation.label]);
    let row = rows.get(key);
    if (!row) { row = { label: presentation.label, depth: item.depth, order: presentation.order, family, sources: new Map() }; rows.set(key, row); }
    row.sources.set(document.recordId, { row: item, basis: presentation.basis });
  }
  for (const item of [...rows.values()].sort((a, b) => a.family.localeCompare(b.family) || a.order - b.order ||
    [...a.sources.values()][0].row.sourcePath.localeCompare([...b.sources.values()][0].row.sourcePath, "pl", { numeric: true }))) {
    // Explicit string cells prevent a provider label beginning '=' or '+' becoming a formula.
    const row = sheet.addRow([item.label, ...columns.map(({ document, column }) => exactExcelAmount(item.sources.get(document.recordId)?.row.amounts[column.sourceColumn] ?? null))]);
    row.getCell(1).alignment = { indent: Math.min(7, Math.max(0, item.depth - (section === "RZiS" ? 2 : 1))), wrapText: true };
    row.getCell(1).note = [...item.sources].map(([recordId, source]) => `Dokument: ${recordId}\nŚcieżka źródłowa: ${source.row.sourcePath}\nEtykieta: ${source.basis}`).join("\n\n");
    row.outlineLevel = Math.min(7, Math.max(0, item.depth - (section === "RZiS" ? 2 : 1)));
    for (let index = 0; index < columns.length; index++) {
      const { document, column } = columns[index];
      const source = item.sources.get(document.recordId), amount = source?.row.amounts[column.sourceColumn];
      const cell = row.getCell(index + 2);
      const note = source ? `Dokument: ${document.recordId}\nŚcieżka źródłowa: ${source.row.sourcePath}.${column.sourceColumn}` : "Pozycja nie występuje w tym dokumencie.";
      cell.note = note + (typeof cell.value === "string" ? "\nDokładna kwota źródłowa jako tekst — limit precyzji Excela." : amount == null ? "\nBrak wartości w kolumnie źródłowej." : "");
      if (typeof cell.value === "number") cell.numFmt = "#,##0" + (amount?.includes(".") ? "." + "0".repeat(amount.split(".")[1].length) : "");
    }
  }
  sheet.autoFilter = { from: "A1", to: { row: sheet.rowCount, column: columns.length + 1 } };
  sheet.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape", printTitlesRow: "1:1" };
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
