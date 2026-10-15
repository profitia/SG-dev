import { createHash } from "node:crypto";
import { gunzipSync, inflateRawSync } from "node:zlib";

const API = "https://api.mgbi.pl";
const STORAGE = "mgbi-prod-krs-rdf-main-content-files.s3.amazonaws.com";
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_EXPANDED = 50 * 1024 * 1024;
export type MsrFile = { name: string; text: string; checksum: string };
export type MsrOriginal = {
  recordId: string; format: "XHTML" | "XBRL"; container: "ZIP" | "DOCUMENT";
  checksum: string; bytes: Buffer; files: MsrFile[]; retrievedAt: string;
};
/** Only codes/stages are printable. Never attach URLs, response payloads or credentials. */
export class MsrSourceError extends Error {
  constructor(public code: string, public stage: string, public httpStatus?: number) {
    super(code); this.name = "MsrSourceError";
  }
}
const fail = (code: string, stage = "file_validation"): never => { throw new MsrSourceError(code, stage); };
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Inspect the entire directory before inflating any member. No filesystem extraction. */
export function readMsrZip(bytes: Buffer): MsrFile[] {
  if (bytes.length > MAX_BYTES || bytes.length < 22) fail("MSR_ARCHIVE_SIZE");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break; }
  }
  if (end < 0) fail("MSR_INVALID_ZIP");
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12), offset = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)
      || count !== bytes.readUInt16LE(end + 8) || count > 500 || count === 0
      || offset + size > end || offset === 0xffffffff) fail("MSR_UNSUPPORTED_ZIP");
  const entries: { name: string; flags: number; method: number; crc: number; compressed: number; size: number; offset: number }[] = [];
  const names = new Set<string>(); let expanded = 0, cursor = offset;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > offset + size || bytes.readUInt32LE(cursor) !== 0x02014b50) fail("MSR_INVALID_ZIP");
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
    const compressed = bytes.readUInt32LE(cursor + 20), uncompressed = bytes.readUInt32LE(cursor + 24);
    const n = bytes.readUInt16LE(cursor + 28), x = bytes.readUInt16LE(cursor + 30), c = bytes.readUInt16LE(cursor + 32);
    if (cursor + 46 + n + x + c > offset + size) fail("MSR_INVALID_ZIP");
    const name = bytes.subarray(cursor + 46, cursor + 46 + n).toString("utf8");
    if (!name || name.includes("\0") || name.includes("\\") || name.startsWith("/") || name.split("/").includes("..")
        || names.has(name.normalize("NFC").toLowerCase())) fail("MSR_UNSAFE_ARCHIVE_PATH");
    if (/\.pdf$/i.test(name)) fail("MSR_PDF_EXCLUDED");
    if (flags & 1 || ![0, 8].includes(method)) fail("MSR_UNSUPPORTED_ZIP");
    expanded += uncompressed;
    if (uncompressed > MAX_BYTES || expanded > MAX_EXPANDED || (uncompressed > 1024 * 1024 && uncompressed > Math.max(1, compressed) * 500))
      fail("MSR_ARCHIVE_EXPANSION_LIMIT");
    names.add(name.normalize("NFC").toLowerCase());
    entries.push({ name, flags, method, compressed, size: uncompressed, crc: bytes.readUInt32LE(cursor + 16), offset: bytes.readUInt32LE(cursor + 42) });
    cursor += 46 + n + x + c;
  }
  if (cursor !== offset + size) fail("MSR_INVALID_ZIP");
  const files: MsrFile[] = [];
  for (const entry of entries) {
    if (!/\.(xhtml|html|xml|xsd|xbrl)$/i.test(entry.name)) continue;
    const at = entry.offset;
    if (at + 30 > offset || bytes.readUInt32LE(at) !== 0x04034b50) fail("MSR_INVALID_ZIP");
    const n = bytes.readUInt16LE(at + 26), x = bytes.readUInt16LE(at + 28), start = at + 30 + n + x;
    if (bytes.subarray(at + 30, at + 30 + n).toString("utf8") !== entry.name
        || bytes.readUInt16LE(at + 8) !== entry.method || bytes.readUInt16LE(at + 6) !== entry.flags
        || start + entry.compressed > offset) fail("MSR_INVALID_ZIP");
    const packed = bytes.subarray(start, start + entry.compressed);
    let data: Buffer;
    try { data = entry.method === 0 ? packed : inflateRawSync(packed, { maxOutputLength: Math.min(MAX_BYTES, entry.size + 1) }); }
    catch { return fail("MSR_INVALID_ZIP"); }
    if (data.length !== entry.size || crc32(data) !== entry.crc || data.subarray(0, 5).toString() === "%PDF-") fail("MSR_FILE_INTEGRITY");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    files.push({ name: entry.name, text, checksum: hash(data) });
  }
  return files;
}

async function boundedBody(response: Response, limit = MAX_BYTES): Promise<Buffer> {
  if (Number(response.headers.get("content-length")) > limit) fail("MSR_FILE_SIZE", "file_download");
  const reader = response.body?.getReader() ?? fail("MSR_EMPTY_FILE", "file_download");
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.length;
      if (total > limit) { await reader.cancel(); fail("MSR_FILE_SIZE", "file_download"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, total);
}

export function decodeMsrOriginal(recordId: string, body: Buffer, mime: string, retrievedAt: string): MsrOriginal {
  if (mime === "application/pdf" || body.subarray(0, 5).toString() === "%PDF-") fail("MSR_PDF_EXCLUDED");
  let bytes = body;
  // Native fetch decodes HTTP gzip; injected clients and stored fixtures may retain it.
  if (body[0] === 0x1f && body[1] === 0x8b) {
    try { bytes = gunzipSync(body, { maxOutputLength: MAX_BYTES }); } catch { return fail("MSR_GZIP_INVALID"); }
  }
  if (bytes.length > MAX_BYTES || bytes.subarray(0, 5).toString() === "%PDF-") fail("MSR_PDF_EXCLUDED");
  const zip = bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const files = zip ? readMsrZip(bytes) : [{ name: "document.xhtml", text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), checksum: hash(bytes) }];
  const reports = files.filter(file => /\.(xhtml|html|xbrl)$/i.test(file.name));
  if (reports.length !== 1) fail("MSR_REPORT_SET_UNSUPPORTED");
  return { recordId, format: reports[0].name.endsWith(".xbrl") ? "XBRL" : "XHTML", container: zip ? "ZIP" : "DOCUMENT",
    checksum: hash(bytes), bytes, files, retrievedAt };
}

export type MsrDownloadOptions = {
  apiKey?: string; authScheme?: "raw" | "bearer"; fetcher?: typeof fetch; timeoutMs?: number; now?: () => Date;
};
/** The paid endpoint is invoked once only. A timeout/ambiguous result must be journalled by the caller. */
export async function downloadMsrOriginal(recordId: string, options: MsrDownloadOptions = {}): Promise<MsrOriginal> {
  if (!/^[a-f0-9]{24}$/.test(recordId)) fail("MSR_RECORD_ID_INVALID", "file_selection");
  const key = (options.apiKey ?? process.env.MGBI_API_KEY)?.trim() || fail("MSR_PROVIDER_NOT_CONFIGURED", "file_authorization");
  const authorization = (options.authScheme ?? process.env.MGBI_AUTH_SCHEME) === "bearer" ? "Bearer " + key : key;
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);
  const signal = controller.signal;
  try {
    const limits = await fetcher(API + "/v1/models/pl-krs-rdf-record/limits", {
      method: "GET", headers: { Authorization: authorization, Accept: "application/json" }, signal, redirect: "error", cache: "no-store",
    });
    if (!limits.ok) throw new MsrSourceError("MSR_BUDGET_UNAVAILABLE", "file_budget", limits.status);
    const budget = JSON.parse((await boundedBody(limits, 32_768)).toString("utf8"));
    if (!Number.isSafeInteger(budget.max?.files) || !Number.isSafeInteger(budget.used?.files)
        || budget.max.files <= budget.used.files) fail("MSR_FILE_BUDGET_EXHAUSTED", "file_budget");
    let response = await fetcher(API + "/v1/models/pl-krs-rdf-record/records/" + recordId + "/files/main_document_uri", {
      method: "GET", headers: { Authorization: authorization, Accept: "application/zip, application/xhtml+xml, application/xml" },
      signal, redirect: "manual", cache: "no-store",
    });
    for (let redirects = 0; response.status === 307 || response.status === 302; redirects++) {
      if (redirects >= 3) fail("MSR_REDIRECT_LIMIT", "file_redirect");
      let target: URL;
      try { target = new URL(response.headers.get("location") ?? ""); } catch { return fail("MSR_REDIRECT_INVALID", "file_redirect"); }
      if (target.protocol !== "https:" || target.hostname !== STORAGE || target.username || target.password
          || (target.port && target.port !== "443")) fail("MSR_REDIRECT_REJECTED", "file_redirect");
      await response.body?.cancel();
      // Authorization is deliberately absent: the storage URL has its own short-lived signature.
      response = await fetcher(target, { method: "GET", headers: { Accept: "application/zip, application/xhtml+xml, application/xml" },
        signal, redirect: "manual", cache: "no-store" });
    }
    if (!response.ok) throw new MsrSourceError("MSR_FILE_HTTP_" + response.status, "file_download", response.status);
    const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (!["application/zip", "application/x-zip-compressed", "application/xhtml+xml", "application/xml", "text/xml", "text/html"].includes(mime)) {
      await response.body?.cancel(); fail(mime === "application/pdf" ? "MSR_PDF_EXCLUDED" : "MSR_FILE_TYPE_UNSUPPORTED", "file_download");
    }
    return decodeMsrOriginal(recordId, await boundedBody(response), mime, (options.now?.() ?? new Date()).toISOString());
  } catch (error) {
    if (error instanceof MsrSourceError) throw error;
    throw new MsrSourceError(controller.signal.aborted ? "MSR_FILE_TIMEOUT" : "MSR_FILE_NETWORK_OR_MAPPING", "file_download");
  } finally { clearTimeout(timer); }
}
