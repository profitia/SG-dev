import type { KysPdfSelection } from "@profitia/srm-xray";
import { authorizeStoredKys, KysPdfError, readStoredKysPdf, type StoredKysPdf } from "./kys-pdf-access";
import { validateKysPdfSelection } from "./kys-pdf";
import { productEnvironmentReady, productOrganizationId } from "./runtime-environment";
import { hasDemoSession } from "./demo-auth";
import { isSameOriginRequest } from "./request-origin";

const MAX_PDF_BYTES = 24 * 1024 * 1024;
const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff", Vary: "Cookie" };
type Reader = (organizationId: string, selection: Pick<KysPdfSelection, "nip" | "entityType">) => Promise<StoredKysPdf | null>;

export function verclyKrsReference(data: NonNullable<StoredKysPdf["data"]>): string {
  const correlation = data.correlationId, company = data.company;
  if (!correlation || !/^[A-Za-z0-9_-]{8,100}$/.test(correlation) ||
    !company?.krs || !/^\d{10}$/.test(company.krs) || !company.regon || !/^\d{9}$/.test(company.regon)) {
    throw new KysPdfError(404, "Aktualny odpis KRS nie jest dostępny dla tego raportu.");
  }
  return `${correlation}-${company.regon}`;
}

export type KrsDownloadOptions={apiKey:string|undefined;baseUrl:string|undefined;fetcher?:typeof fetch;clock?:()=>Date;signal?:AbortSignal;
 /** Legacy rechecks immediately before streaming. Native callers retain the
  * response internally and recheck fresh HUMAN authority after full download. */
 verifyBeforeStream?:()=>Promise<void>};
/** Original bounded PDF transport. This function grants no data authority. */
export async function downloadVerclyKrsPdf(reference:string,nip:string,options:KrsDownloadOptions):Promise<Response>{
 if(!/^[A-Za-z0-9_-]{8,100}-[0-9]{9}$/.test(reference)||!/^[0-9]{10}$/.test(nip))throw new KysPdfError(400,'Nieprawidłowy wybór odpisu KRS.');
  const {apiKey,baseUrl,fetcher=fetch,clock=()=>new Date()}=options;
  if (!apiKey || !baseUrl) throw new KysPdfError(503, "Pobieranie odpisu KRS jest chwilowo niedostępne.");
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.username || base.password) throw new KysPdfError(503, "Pobieranie odpisu KRS jest chwilowo niedostępne.");
  const url = new URL(`/api/krs/${reference}`, base);
  const signal = AbortSignal.any([options.signal??new AbortController().signal, AbortSignal.timeout(60_000)]);
  const upstream = await fetcher(url, { method: "GET", headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/pdf" },
    redirect: "manual", cache: "no-store", signal });
  if (!upstream.ok || !upstream.body) throw new KysPdfError(upstream.status === 404 ? 404 : 502,
    upstream.status === 404 ? "Odpis KRS nie jest dostępny dla tego raportu." : "Nie udało się pobrać odpisu KRS.");
  const mime = upstream.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  const declaredSize = Number(upstream.headers.get("content-length"));
  if (!["application/pdf", "application/octet-stream"].includes(mime ?? "") ||
    (Number.isFinite(declaredSize) && declaredSize > MAX_PDF_BYTES)) {
    await upstream.body.cancel();
    throw new KysPdfError(502, "Dostawca nie zwrócił poprawnego pliku PDF.");
  }
  const reader = upstream.body.getReader(), firstChunks: Uint8Array[] = [];
  let bytes = 0;
  while (bytes < 5) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > MAX_PDF_BYTES) break;
    firstChunks.push(part.value);
  }
  if (bytes < 5 || bytes > MAX_PDF_BYTES || Buffer.concat(firstChunks).subarray(0, 5).toString() !== "%PDF-") {
    await reader.cancel();
    throw new KysPdfError(502, "Dostawca nie zwrócił poprawnego pliku PDF.");
  }
  if(options.verifyBeforeStream)try { await options.verifyBeforeStream(); }
  catch (cause) { await reader.cancel(); throw cause; }
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (firstChunks.length) { controller.enqueue(firstChunks.shift()!); return; }
      try {
        const part = await reader.read();
        if (part.done) { controller.close(); return; }
        bytes += part.value.byteLength;
        if (bytes > MAX_PDF_BYTES) { await reader.cancel(); controller.error(new Error("PDF size limit")); return; }
        controller.enqueue(part.value);
      } catch (cause) { controller.error(cause); }
    },
    cancel() { return reader.cancel(); },
  });
  const filename = `KRS_${nip}_${clock().toISOString().slice(0, 10)}.pdf`;
  return new Response(stream, { headers: { ...headers, "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`, "X-Download-Filename": filename } });
}

/** Fetch only the PDF belonging to the authorized, stored KYS verification. No order, archive or disk write. */
export function verclyKrsHandler(read: Reader = readStoredKysPdf, fetcher: typeof fetch = fetch,
  env: Readonly<Record<string, string | undefined>> = process.env, clock = () => new Date()) {
  return async (request: Request): Promise<Response> => {
    const error = (message: string, status: number) => Response.json({ error: message }, { status, headers });
    if (!productEnvironmentReady(env)) return error("Środowisko niedostępne.", 404);
    if (!await hasDemoSession(request, env)) return error("Wymagane logowanie.", 401);
    if (!isSameOriginRequest(request)) return error("Nieprawidłowe żądanie.", 403);
    const organizationId = productOrganizationId(env);
    if (!organizationId) return error("Środowisko SRM nie jest skonfigurowane.", 503);
    let selection: KysPdfSelection;
    try {
      const body = await request.text();
      if (body.length > 1024) throw new Error("Oversized request");
      selection = validateKysPdfSelection(JSON.parse(body));
      if (selection.entityType !== "COMPANY") throw new Error("KRS is for companies");
    } catch { return error("Nieprawidłowy NIP lub wersja raportu.", 400); }
    try {
      const first = authorizeStoredKys(await read(organizationId, selection), organizationId, selection, clock(), env);
      const reference = verclyKrsReference(first.row.data);
      return await downloadVerclyKrsPdf(reference,selection.nip,{apiKey:env.VERCLY_API_KEY,baseUrl:env.VERCLY_API_BASE_URL,
        fetcher,clock,signal:request.signal,verifyBeforeStream:async()=>{authorizeStoredKys(await read(organizationId,selection),organizationId,selection,clock(),env)}});
    } catch (cause) {
      return error(cause instanceof KysPdfError ? cause.message : "Nie udało się pobrać odpisu KRS.", cause instanceof KysPdfError ? cause.status : 503);
    }
  };
}
