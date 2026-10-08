import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { kysPdfDocument, type KysPdfDocument, type KysPdfSelection } from "@profitia/srm-xray";
import { authorizeStoredKys, KysPdfError, readStoredKysPdf } from "./kys-pdf-access";
import { hasDemoSession } from "./demo-auth";
import { isSameOriginRequest } from "./request-origin";
import { validateReportSelection } from "./report-data";

const MAX_INPUT = 8 * 1024 * 1024, MAX_OUTPUT = 24 * 1024 * 1024, MAX_PAGES = 500;
const fonts = () => ({ regular: readFileSync(join(process.cwd(), "src/server/assets/LiberationSans-Regular.ttf")),
  bold: readFileSync(join(process.cwd(), "src/server/assets/LiberationSans-Bold.ttf")) });
/** Sanitize controls/product provider names; preserve selectable Unicode business text. */
const text = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
  .replace(/MGBI/gi, "Dane finansowe").replace(/Vercly/gi, "Raport KYS");

/** In-memory structured document, no HTML, attachments, temporary copies or public archive. */
export async function renderKysPdf(report: KysPdfDocument): Promise<Buffer> {
  if (Buffer.byteLength(JSON.stringify(report)) > MAX_INPUT) throw new KysPdfError(413, "Raport przekracza limit dokumentu. Nie wyeksportowano częściowej kopii.");
  const font = fonts();
  const doc = new PDFDocument({ size: "A4", margins: { top: 46, bottom: 48, left: 44, right: 44 }, bufferPages: true,
    info: { Title: "Raport KYS - Weryfikacja dostawcy", Author: "SRM", Creator: "SRM", CreationDate: new Date(report.generatedAt) } });
  doc.registerFont("regular", font.regular); doc.registerFont("bold", font.bold);
  const chunks: Buffer[] = []; let bytes = 0;
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > MAX_OUTPUT) { doc.destroy(); reject(new KysPdfError(413, "Dokument jest zbyt duży. Nie wyeksportowano częściowej kopii.")); } else chunks.push(chunk); });
    doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
  });
  const left = 44, width = doc.page.width - 88, bottom = doc.page.height - 58;
  let y = 46, pages = 1, continuation = "";
  function newPage() {
    if (++pages > MAX_PAGES) throw new KysPdfError(413, "Raport przekracza limit stron. Nie wyeksportowano częściowej kopii.");
    doc.addPage(); y = 46;
    doc.font("bold").fontSize(9).fillColor("#334155").text("SRM · Raport KYS", left, y, { width }); y += 17;
    if (continuation) { doc.font("regular").fontSize(9).text(text(`${continuation} (ciąg dalszy)`), left, y, { width });
      y += doc.heightOfString(text(`${continuation} (ciąg dalszy)`), { width }) + 10; }
  }
  function ensure(height: number) { if (y + height > bottom) newPage(); }
  // Split at Unicode code points into measured fragments, including unusually long fields.
  function paragraph(content: string, bold = false, size = 10) {
    const clean = text(content) || "brak danych";
    doc.font(bold ? "bold" : "regular").fontSize(size).fillColor("#1e293b");
    let remaining = Array.from(clean);
    while (remaining.length) {
      ensure(size * 2 + 5);
      doc.font(bold ? "bold" : "regular").fontSize(size);
      const room = bottom - y;
      let low = 1, high = remaining.length, best = 0;
      while (low <= high) { const mid = (low + high) >>> 1;
        if (doc.heightOfString(remaining.slice(0, mid).join(""), { width }) <= room) { best = mid; low = mid + 1; } else high = mid - 1; }
      if (!best) { newPage(); continue; }
      if (best < remaining.length) { const boundary = remaining.slice(0, best).lastIndexOf(" "); if (boundary > best / 2) best = boundary + 1; }
      const fragment = remaining.slice(0, best).join("");
      const height = doc.heightOfString(fragment, { width });
      doc.text(fragment, left, y, { width, lineGap: 0 }); y += height + 3;
      remaining = remaining.slice(best); if (remaining.length) newPage();
    }
  }
  try {
    paragraph("SRM · Dokument wygenerowany z zapisanego raportu", false, 9);
    paragraph(report.title, true, 20); paragraph(report.companyName, true, 14);
    paragraph(`NIP ${report.nip} · ${report.entityType === "COMPANY" ? "Spółka / podmiot rejestrowy" : "Jednoosobowa działalność gospodarcza"}`);
    paragraph(`Dane KYS pozyskano: ${report.retrievedAt}`); paragraph(`PDF wygenerowano: ${report.generatedAt}`);
    y += 10;
    for (const section of report.sections) {
      continuation = "";
      doc.font("bold").fontSize(13);
      const headingHeight = doc.heightOfString(text(section.title), { width });
      doc.font("regular").fontSize(9);
      const noteHeight = section.note ? doc.heightOfString(text(section.note), { width }) + 3 : 0;
      ensure(headingHeight + noteHeight + 110); continuation = section.title; y += 9; paragraph(section.title, true, 13);
      if (section.note) paragraph(section.note, false, 9);
      if (!section.records.length) paragraph("Brak zapisanych pozycji w tej części raportu. Nie potwierdza to wykonania kontroli ani braku zdarzenia.");
      for (const record of section.records) {
        doc.font("bold").fontSize(10);
        let recordHeight = doc.heightOfString(text(record.title), { width }) + 20;
        doc.font("regular").fontSize(10);
        for (const [label, value] of record.fields) recordHeight += doc.heightOfString(text(`${label}: ${value}`), { width }) + 3;
        ensure(recordHeight < 630 ? recordHeight : 80); y += 7; doc.moveTo(left, y).lineTo(left + width, y).strokeColor("#dbe2ea").lineWidth(0.5).stroke(); y += 8;
        paragraph(record.title, true, 10);
        for (const [label, value] of record.fields) paragraph(`${label}: ${value}`);
      }
      continuation = "";
    }
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i); doc.font("regular").fontSize(8).fillColor("#64748b");
      // Explicit height prevents PDFKit from adding a footer-only page.
      doc.text(`SRM · Raport KYS                         Strona ${i + 1} z ${range.count}`, left, doc.page.height - 36, { width, height: 14, lineBreak: false });
    }
    doc.end();
  } catch (error) { doc.destroy(error instanceof Error ? error : new Error("PDF generation failed")); await result.catch(() => undefined); throw error; }
  return result;
}

export function validateKysPdfSelection(input: unknown): KysPdfSelection {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid selection");
  const v = input as Record<string, unknown>;
  if (Object.keys(v).some(key => !["nip", "entityType", "retrievedAt", "exportRef"].includes(key)) ||
    !["COMPANY", "JDG"].includes(String(v.entityType)) || v.nip === "0000000000" || typeof v.exportRef !== "string" || !/^[a-f0-9]{64}$/.test(v.exportRef) ||
    typeof v.retrievedAt !== "string" || !Number.isFinite(Date.parse(v.retrievedAt)) || new Date(v.retrievedAt).toISOString() !== v.retrievedAt) throw new Error("Invalid selection");
  return { ...validateReportSelection(v), retrievedAt: v.retrievedAt, exportRef: v.exportRef };
}

export function kysPdfHandler(read = readStoredKysPdf, render = renderKysPdf,
  env: Readonly<Record<string, string | undefined>> = process.env, clock = () => new Date()) {
  return async (request: Request): Promise<Response> => {
    const headers = { "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" };
    const error = (message: string, status: number) => Response.json({ error: message }, { status, headers });
    if (env.TARGET_ENVIRONMENT !== "development") return error("Środowisko niedostępne.", 404);
    if (!await hasDemoSession(request, env)) return error("Wymagane logowanie.", 401);
    if (!isSameOriginRequest(request)) return error("Nieprawidłowe żądanie.", 403);
    const organizationId = env.SRM_DEVELOPMENT_ORGANIZATION_ID;
    if (!organizationId) return error("Środowisko SRM nie jest skonfigurowane.", 503);
    let selection: KysPdfSelection;
    try { const body = await request.text(); if (body.length > 1024) throw new Error("Oversized"); selection = validateKysPdfSelection(JSON.parse(body)); }
    catch { return error("Nieprawidłowy NIP, rodzaj dostawcy lub wersja raportu.", 400); }
    try {
      const now = clock(), authorized = authorizeStoredKys(await read(organizationId, selection), organizationId, selection, now, env);
      const document = kysPdfDocument(authorized.row.data, { ...selection, retrievedAt: new Date(authorized.row.retrievedAt!).toISOString(),
        generatedAt: now.toISOString(), expiresAt: authorized.expiresAt, partial: authorized.row.data.isComplete !== true || !authorized.row.completionConfirmed,
        warnings: authorized.row.warnings });
      const pdf = await render(document);
      // Reject refreshed/deleted/expired data before sending any bytes. Repeated exports do not mutate state.
      authorizeStoredKys(await read(organizationId, selection), organizationId, selection, clock(), env);
      const filename = `KYS_${selection.nip}_${now.toISOString().slice(0, 10)}.pdf`;
      return new Response(new Uint8Array(pdf), { headers: { ...headers, "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`, "X-Download-Filename": filename } });
    } catch (e) { return error(e instanceof KysPdfError ? e.message : "Nie udało się przygotować PDF. Raport pozostaje dostępny w SRM.", e instanceof KysPdfError ? e.status : 503); }
  };
}
