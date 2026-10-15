import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { decodeMsrOriginal, downloadMsrOriginal, MsrSourceError } from "./msr-source";

function crc(bytes: Buffer): number {
  let result = 0xffffffff;
  for (const b of bytes) { result ^= b; for (let i = 0; i < 8; i++) result = (result >>> 1) ^ (result & 1 ? 0xedb88320 : 0); }
  return (result ^ 0xffffffff) >>> 0;
}
function archive(name = "report.xhtml", data = "<html xmlns='http://www.w3.org/1999/xhtml'/>"): Buffer {
  const n = Buffer.from(name), b = Buffer.from(data), h = Buffer.alloc(30), c = Buffer.alloc(46), e = Buffer.alloc(22);
  h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4); h.writeUInt32LE(crc(b), 14);
  h.writeUInt32LE(b.length, 18); h.writeUInt32LE(b.length, 22); h.writeUInt16LE(n.length, 26);
  c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6);
  c.writeUInt32LE(crc(b), 16); c.writeUInt32LE(b.length, 20); c.writeUInt32LE(b.length, 24); c.writeUInt16LE(n.length, 28);
  e.writeUInt32LE(0x06054b50); e.writeUInt16LE(1, 8); e.writeUInt16LE(1, 10);
  e.writeUInt32LE(c.length + n.length, 12); e.writeUInt32LE(h.length + n.length + b.length, 16);
  return Buffer.concat([h, n, b, c, n, e]);
}
const record = "68373e33935a5dc0776e1c56";
const signed = "https://mgbi-prod-krs-rdf-main-content-files.s3.amazonaws.com/source?signature=PRIVATE_SIGNATURE";
const budget = () => Response.json({ max: { files: 10 }, used: { files: 0 } });
const isCode = (code: string) => (e: unknown) => e instanceof MsrSourceError && e.code === code;

test("MSR transport follows 307, decodes retained gzip and never forwards the API key to storage", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.endsWith("/limits")) return budget();
    if (url.includes("/files/")) return new Response(null, { status: 307, headers: { Location: signed } });
    return new Response(new Uint8Array(gzipSync(archive())), { headers: { "Content-Type": "application/zip", "Content-Encoding": "gzip" } });
  }) as typeof fetch;
  const source = await downloadMsrOriginal(record, { apiKey: "PRIVATE_KEY", fetcher });
  assert.equal(source.files.length, 1); assert.equal(source.format, "XHTML"); assert.equal(source.container, "ZIP");
  assert.equal(calls.filter(c => c.url.includes("/files/")).length, 1);
  assert.equal(new Headers(calls[2].init?.headers).has("Authorization"), false);
  assert.ok(calls.every(c => c.init?.redirect === "manual" || c.init?.redirect === "error"));
});
test("MSR transport refuses exhausted quota before calling the paid endpoint", async () => {
  let calls = 0;
  await assert.rejects(downloadMsrOriginal(record, { apiKey: "x", fetcher: (async () => {
    calls++; return Response.json({ max: { files: 10 }, used: { files: 10 } });
  }) as typeof fetch }), isCode("MSR_FILE_BUDGET_EXHAUSTED"));
  assert.equal(calls, 1);
});
test("MSR transport does not retry ambiguous HTTP failures or leak keys and signed URLs", async () => {
  for (const status of [401, 403, 429, 500, 502, 503, 504]) {
    let paid = 0;
    await assert.rejects(downloadMsrOriginal(record, { apiKey: "PRIVATE_KEY", fetcher: (async (input) => {
      if (String(input).endsWith("/limits")) return budget();
      paid++; return new Response("PRIVATE_KEY " + signed, { status });
    }) as typeof fetch }), (error: unknown) => {
      assert.ok(error instanceof MsrSourceError); assert.equal(error.httpStatus, status);
      assert.ok(!String(error).includes("PRIVATE_KEY") && !String(error).includes("PRIVATE_SIGNATURE"));
      return true;
    });
    assert.equal(paid, 1);
  }
});
test("MSR transport refuses arbitrary storage, private IP and credential-bearing redirects", async () => {
  for (const target of ["http://169.254.169.254/latest", "https://evil.example/data", "https://user:pass@mgbi-prod-krs-rdf-main-content-files.s3.amazonaws.com/data"]) {
    let calls = 0;
    await assert.rejects(downloadMsrOriginal(record, { apiKey: "x", fetcher: (async (input) => {
      calls++; return String(input).endsWith("/limits") ? budget() : new Response(null, { status: 307, headers: { Location: target } });
    }) as typeof fetch }), isCode("MSR_REDIRECT_REJECTED"));
    assert.equal(calls, 2);
  }
});
test("MSR transport rejects a PDF response before consuming its body", async () => {
  let cancelled = false;
  const pdf = { ok: true, status: 200, headers: new Headers({ "Content-Type": "application/pdf" }),
    body: { cancel: async () => { cancelled = true; }, getReader: () => { throw new Error("PDF body must not be read"); } } } as unknown as Response;
  await assert.rejects(downloadMsrOriginal(record, { apiKey: "x", fetcher: (async (input) =>
    String(input).endsWith("/limits") ? budget() : pdf) as typeof fetch }), isCode("MSR_PDF_EXCLUDED"));
  assert.equal(cancelled, true);
});
test("MSR ZIP rejects PDF, traversal, oversized members and checksum corruption", () => {
  for (const name of ["document.PDF", "../report.xhtml", "/report.xhtml"]) {
    assert.throws(() => decodeMsrOriginal(record, archive(name), "application/zip", "2026-10-15T00:00:00Z"), MsrSourceError);
  }
  const damaged = archive(); damaged[30 + Buffer.byteLength("report.xhtml")] ^= 1;
  assert.throws(() => decodeMsrOriginal(record, damaged, "application/zip", "2026-10-15T00:00:00Z"), isCode("MSR_FILE_INTEGRITY"));
  const oversized = archive(), cd = oversized.readUInt32LE(oversized.length - 6);
  oversized.writeUInt32LE(21 * 1024 * 1024, cd + 24);
  assert.throws(() => decodeMsrOriginal(record, oversized, "application/zip", "2026-10-15T00:00:00Z"), isCode("MSR_ARCHIVE_EXPANSION_LIMIT"));
});
test("MSR timeout is bounded and the charged request is never automatically repeated", async () => {
  let paid = 0;
  await assert.rejects(downloadMsrOriginal(record, { apiKey: "x", timeoutMs: 10, fetcher: (async (input, init) => {
    if (String(input).endsWith("/limits")) return budget();
    paid++;
    return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }));
  }) as typeof fetch }), isCode("MSR_FILE_TIMEOUT"));
  assert.equal(paid, 1);
});
