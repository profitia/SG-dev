import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { advanceBzpWindow, bzpUrl, digest, mergeSeeds, sampleSeeds, seedFromNotices, validNip, type Seed } from "./bzp";
import { FIELDS, MetadataClient, minimalRecord, PROJECTION_VERSION, readJson, validateMgbiUrl } from "./mgbi";
import { analyze, checkReceipt, type Receipt } from "./audit";

const nip = "7010446505", otherNip = "6762554220";
const seedRow = (value = nip, name = "Test sp. z o.o."): Seed => ({ nip: value, name, city: "Kraków", source: "BZP", noticeId: "notice-1", publishedAt: "2026-10-01" });
const record = (mime = "text/xml") => ({ id: "rdf-1", identifiers: { pl_nip: nip, pl_krs: "0000533676" },
  document: { type: "financial_statement", period_from_date: "2025-01-01", period_to_date: "2025-12-31", is_ias_compliant: false },
  files: { main_document: { original: { content_type: mime, url: "https://example.org/never-download" } } },
  content: { schema: { name: "JednostkaInnaWZlotych", version: "1-3" }, standardized_fields: { bs: { a_ca_cfy: "0", a_ta_cfy: "100" } } } });
const receipt = (records: unknown[]): Receipt => ({ nip, records, count: records.length, complete: true, retrievedAt: "2026-10-16T12:00:00Z", projection: PROJECTION_VERSION });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("validates NIP checksum without accepting REGON, repeated digits or arbitrary punctuation", () => {
  assert.equal(validNip("PL 701-044-65-05"), nip);
  for (const value of ["7010446506", "123456789", "0000000000", "1111111111", "7010446505;", 7010446505, null]) assert.equal(validNip(value), null);
});
test("BZP seeds use Polish contractors, never contracting authorities; ignore foreign and invalid IDs", () => {
  const rows = seedFromNotices([{ objectId: "n1", publicationDate: "2026-10-01", organizationName: "Authority", organizationNationalId: otherNip,
    contractors: [{ contractorCountry: "PL", contractorNationalId: nip, contractorName: "Contractor" },
      { contractorCountry: "DE", contractorNationalId: otherNip, contractorName: "Foreign" },
      { contractorCountry: "PL", contractorNationalId: "123", contractorName: "Invalid" }] }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].nip, nip); assert.equal(rows[0].name, "Contractor");
});
test("merging is unique by NIP and retains latest evidence independently of input order", () => {
  const old = seedRow(), latest = { ...old, name: "New name", publishedAt: "2026-10-02" };
  assert.deepEqual(mergeSeeds([old], [latest, old]), [latest]);
  assert.deepEqual(mergeSeeds([latest], [old]), [latest]);
});
test("100 and 250 are nested reproducible samples of 10000 unique synthetic test NIPs", () => {
  const rows: Seed[] = Array.from({ length: 10_000 }, (_, i) => seedRow(String(i).padStart(10, "0")));
  const full = sampleSeeds(rows, 10_000, "fixed");
  assert.equal(new Set(full.map(row => row.nip)).size, 10_000);
  assert.deepEqual(full.slice(0, 100), sampleSeeds([...rows].reverse(), 100, "fixed"));
  assert.deepEqual(full.slice(0, 250), sampleSeeds(rows, 250, "fixed"));
  assert.notDeepEqual(full.slice(0, 100), sampleSeeds(rows, 100, "other"));
  assert.throws(() => sampleSeeds(rows, 10_001, "fixed"));
});
test("BZP request uses only result notices and bounded paging", () => {
  const cursor = "08df1f75-41bf-e778-647d-de00010341f0";
  const url = bzpUrl("2026-10-01", "2026-10-02", cursor);
  assert.equal(url.searchParams.get("NoticeType"), "TenderResultNotice");
  assert.equal(url.searchParams.get("PageSize"), "100");
  assert.equal(url.searchParams.get("SearchAfter"), cursor);
  assert.equal(url.searchParams.has("PageNumber"), false);
  assert.throws(() => bzpUrl("2026-10-02", "2026-10-01"));
});
test("BZP uses the last objectId cursor and rejects repeated pages before advancing checkpoints", () => {
  const first = { cursorScheme: "objectId-v1" as const, nextAfter: null, pages: 0, complete: false, pageDigests: [] };
  const notices = [{ objectId: "08df1f75-41bf-e778-647d-de00010341f0" }];
  const next = advanceBzpWindow(first, notices);
  assert.equal(next.nextAfter, notices[0].objectId);
  assert.throws(() => advanceBzpWindow(next, notices), /REPEATED_PAGE/);
  assert.throws(() => advanceBzpWindow(first, [{}]), /INVALID_NOTICE_IDS/);
  assert.equal(first.nextAfter, null);
});
test("network allowlist rejects every file endpoint, foreign host and unprojected records request", () => {
  for (const url of ["https://example.org/v1/models/pl-krs-rdf-record/limits", "https://api.mgbi.pl/v1/models/pl-krs-rdf-record/files",
    "https://api.mgbi.pl/v1/models/pl-krs-rdf-record/records", "https://api.mgbi.pl/v1/models/pl-krs-wp-record/limits"]) assert.throws(() => validateMgbiUrl(new URL(url)));
});
test("metadata client sends repeated exact selected fields, disables redirects and retains no URLs", async () => {
  let reserved = 0;
  const client = new MetadataClient("test-key", "raw", async () => { reserved++; }, (async (input, init) => {
    const url = new URL(String(input));
    assert.deepEqual(url.searchParams.getAll("content"), [...FIELDS]);
    assert.equal(url.searchParams.has("content.standardized_fields.is_available"), false);
    assert.equal(init?.redirect, "error");
    return json({ count: 1, pages: 1, results: [record()] });
  }) as typeof fetch);
  const result = await client.page(nip, 1);
  assert.equal(reserved, 1); assert.equal(result.count, 1);
  assert.doesNotMatch(JSON.stringify(result), /example.org|never-download/);
});
test("429 stops immediately; transient 503 consumes a separate durable request reservation", async () => {
  let calls = 0;
  const limited = new MetadataClient("key", "raw", async () => { calls++; }, (async () => json({}, 429)) as typeof fetch);
  await assert.rejects(limited.page(nip, 1), /HTTP_429/); assert.equal(calls, 1);
  calls = 0;
  const retry = new MetadataClient("key", "raw", async () => { calls++; }, (async () => calls === 1 ? json({}, 503) : json({ count: 0, pages: 0, results: [] })) as typeof fetch);
  assert.equal((await retry.page(nip, 1)).count, 0); assert.equal(calls, 2);
});
test("malformed quota and pagination fail closed", async () => {
  const client = new MetadataClient("key", "raw", async () => {}, (async () => json({ max: {}, used: {} })) as typeof fetch);
  await assert.rejects(client.limits(), /INVALID_LIMITS/);
  await assert.rejects(client.page(nip, 1), /INVALID_PAGINATION/);
});
test("JSON-only reads reject PDF/HTML and oversized bodies", async () => {
  await assert.rejects(readJson(new Response("pdf", { headers: { "content-type": "application/pdf" } })), /NON_JSON/);
  await assert.rejects(readJson(json({ body: "12345" }), 4), /SIZE_LIMIT/);
});
test("minimal record removes personal text, arbitrary XML, attachment links; keeps explicit zero", () => {
  const source = { ...record(), people: [{ pesel: "secret" }], content: { ...record().content, extracted_fields: { name: "secret" }, standardized_fields: { bs: { a_ca_cfy: 0, bad: "secret" } } } };
  const text = JSON.stringify(minimalRecord(source));
  assert.doesNotMatch(text, /secret|https:|extracted_fields|people/);
  assert.match(text, /a_ca_cfy":0/);
});
test("no RDF statements is not classified as SRM failure or evidence of JDG status", () => {
  const result = analyze(receipt([]));
  assert.equal(result.category, "NO_FINANCIAL_STATEMENTS_IN_RDF");
  assert.equal(result.fullReportReady, "NOT_VERIFIED");
});
test("PDF/MSR originals are flagged as requiring source files without fetching them", () => {
  assert.equal(analyze(receipt([record("application/pdf")])).category, "SOURCE_FILE_REQUIRED_FOR_SOME_REPORTS");
  assert.ok(analyze(receipt([record("application/xhtml+xml")])).flags.includes("MSR_OR_HTML_REQUIRES_SOURCE_FILE"));
});
test("structured data is a candidate only; incomplete projection does not prove parser failure", () => {
  const result = analyze(receipt([minimalRecord(record())]));
  assert.equal(result.category, "STRUCTURED_DATA_CANDIDATE");
  assert.equal(result.numericStatements, 1);
  assert.ok(result.flags.includes("FULL_REPORT_READINESS_NOT_VERIFIED"));
  assert.ok(!result.flags.includes("REPLAY_EXCEPTION_REQUIRES_REPRODUCTION"));
});
test("incomplete/mismatched/duplicate source data cannot produce a successful replay", () => {
  const r = record();
  assert.equal(analyze({ ...receipt([r]), complete: false }).category, "ACCESS_OR_RESPONSE_ERROR");
  assert.equal(analyze({ ...receipt([r]), nip: otherNip }).replay, "NOT_RUN");
  assert.ok(analyze(receipt([r, r])).flags.includes("DUPLICATE_RECORD"));
});
test("saved receipts cannot be reused under another NIP, projection or incomplete inventory", () => {
  checkReceipt(receipt([record()]), nip);
  assert.throws(() => checkReceipt(receipt([record()]), otherNip), /SAVED_RECEIPT/);
  assert.throws(() => checkReceipt({ ...receipt([record()]), projection: "old" }, nip), /SAVED_RECEIPT/);
  assert.throws(() => checkReceipt({ ...receipt([record()]), count: 2 }, nip), /SAVED_RECEIPT/);
});
test("multiple registrations, repeated filings and noncalendar periods remain explicit review cases", () => {
  const first = record();
  const second = { ...record(), id: "rdf-2", identifiers: { ...record().identifiers, pl_krs: "0000000001" } };
  const third = { ...record(), id: "rdf-3", document: { ...record().document, period_from_date: "2025-03-01" } };
  const fourth = { ...record(), id: "rdf-4" };
  const result = analyze(receipt([first, second, third, fourth]));
  assert.ok(result.flags.includes("MULTIPLE_KRS_REQUIRES_CONTINUITY_REVIEW"));
  assert.ok(result.flags.includes("MULTIPLE_FILINGS_SAME_PERIOD_REQUIRES_REVIEW"));
  assert.ok(result.flags.includes("NON_CALENDAR_OR_NON_ANNUAL_PERIOD"));
  assert.equal(result.fullReportReady, "NOT_VERIFIED");
});
test("corrections and thousand-PLN units are visible rather than silently normalized by audit", () => {
  const r = { ...record(), document: { ...record().document, is_correction: true }, content: { ...record().content, schema: { name: "JednostkaInnaWTysiacachZlotych", version: "1-3" } } };
  const result = analyze(receipt([r]));
  assert.ok(result.flags.includes("CORRECTION")); assert.ok(result.flags.includes("THOUSAND_PLN"));
});
test("CLI freezes cohorts, replays saved JSON offline and refuses non-development execution", async () => {
  const dir = await mkdtemp(join(tmpdir(), "srm-coverage-test-"));
  const run = (...args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "scripts/coverage/cli.ts", ...args, "--dir", dir], { cwd: process.cwd(), env: { ...process.env, TARGET_ENVIRONMENT: "development", MGBI_API_KEY: "" }, encoding: "utf8" });
  try {
    const rows = mergeSeeds([], [seedRow(), seedRow(otherNip)]);
    await writeFile(join(dir, "directory.json"), JSON.stringify({ version: 1, rows, windows: {} }));
    assert.equal(run("sample", "--size", "2").status, 0);
    await mkdir(join(dir, "receipts"));
    await writeFile(join(dir, "receipts", `${nip}.json`), JSON.stringify(receipt([minimalRecord(record())])));
    const replay = run("replay", "--size", "2");
    assert.equal(replay.status, 0, replay.stderr);
    const report = JSON.parse(await readFile(join(dir, "report-2.json"), "utf8"));
    assert.equal(report.filesDownloaded, 0); assert.equal(report.results.length, 2);
    assert.equal(report.categories.ACCESS_OR_RESPONSE_ERROR, 1);
    const cohortPath = join(dir, `cohort-${digest("srm-coverage-v1").slice(0, 16)}.json`);
    const before = await readFile(cohortPath, "utf8");
    await writeFile(join(dir, "directory.json"), JSON.stringify({ version: 1, rows: [seedRow()], windows: {} }));
    assert.equal(run("sample", "--size", "2").status, 0);
    assert.equal(await readFile(cohortPath, "utf8"), before);
    const denied = spawnSync(process.execPath, ["--import", "tsx", "scripts/coverage/cli.ts", "sample"], { env: { ...process.env, TARGET_ENVIRONMENT: "staging" }, encoding: "utf8" });
    assert.match(denied.stderr, /DEVELOPMENT_ONLY/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
