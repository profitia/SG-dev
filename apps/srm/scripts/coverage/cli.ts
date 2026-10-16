import { readFile, writeFile, rename, mkdir, open, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { advanceBzpWindow, bzpUrl, digest, mergeSeeds, sampleSeeds, seedFromNotices, validNip, type Seed, type BzpWindow } from "./bzp";
import { AuditStop, MetadataClient, PROJECTION_VERSION, readJson } from "./mgbi";
import { analyze, checkReceipt, type Receipt } from "./audit";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function read<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
async function save(path: string, value: unknown): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  await rename(tmp, path);
}
function args() {
  const [command, ...rest] = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!/^--[a-z-]+$/.test(rest[i]) || rest[i + 1] === undefined || rest[i + 1].startsWith("--") || options[rest[i].slice(2)] !== undefined) throw new AuditStop("INVALID_ARGUMENTS");
    options[rest[i].slice(2)] = rest[i + 1];
  }
  return { command, options };
}
function integer(value: string | undefined, fallback: number, max: number) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new AuditStop("INVALID_POSITIVE_INTEGER");
  return number;
}
async function main() {
  if (process.env.TARGET_ENVIRONMENT !== "development") throw new AuditStop("DEVELOPMENT_ONLY");
  const { command, options } = args();
  if (!["seed", "sample", "fetch", "replay"].includes(command)) throw new AuditStop("COMMAND_REQUIRED: seed | sample | fetch | replay");
  const allowed: Record<string, string[]> = { seed: ["dir", "from", "to", "max-pages"], sample: ["dir", "size", "seed"], fetch: ["dir", "size", "seed", "max-calls", "reserve"], replay: ["dir", "size", "seed"] };
  if (Object.keys(options).some(key => !allowed[command].includes(key))) throw new AuditStop("UNKNOWN_OPTION");
  const dir = resolve(options.dir ?? ".coverage");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const lockPath = join(dir, "operation.lock");
  const lock = await open(lockPath, "wx", 0o600);
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    const catalogPath = join(dir, "directory.json");
    const catalog = await read<{ version: 1; rows: Seed[]; windows: Record<string, BzpWindow> }>(catalogPath)
      ?? { version: 1 as const, rows: [], windows: {} };
    if (catalog.version !== 1 || !Array.isArray(catalog.rows) || catalog.rows.some(row => !validNip(row.nip) || typeof row.name !== "string")) throw new AuditStop("INVALID_DIRECTORY");
    if (command === "seed") {
      const from = options.from ?? "", to = options.to ?? "";
      bzpUrl(from, to);
      const key = `${from}:${to}`;
      // Restart an old cursor format from the beginning; keep the deduplicated seed rows.
      let window: BzpWindow = catalog.windows[key]?.cursorScheme === "objectId-v1" ? catalog.windows[key]
        : { cursorScheme: "objectId-v1", nextAfter: null, pages: 0, complete: false, pageDigests: [] };
      const budget = integer(options["max-pages"], 10, 500);
      for (let calls = 0; calls < budget && !window.complete; calls++) {
        await sleep(2200);
        const response = await fetch(bzpUrl(from, to, window.nextAfter), { redirect: "error", signal: AbortSignal.timeout(30_000), headers: { Accept: "application/json" } });
        const notices = await readJson(response, 30_000_000);
        if (!Array.isArray(notices)) throw new AuditStop("BZP_INVALID_RESPONSE");
        window = advanceBzpWindow(window, notices);
        catalog.rows = mergeSeeds(catalog.rows, seedFromNotices(notices));
        catalog.windows[key] = window;
        // Batch and cursor are one atomic file: an interrupted request cannot skip records.
        await save(catalogPath, catalog);
        console.log(JSON.stringify({ source: "BZP", page: window.pages, uniqueNips: catalog.rows.length, completeWindow: window.complete }));
      }
      return;
    }
    const size = integer(options.size, 100, 10_000), seed = options.seed ?? "srm-coverage-v1";
    const cohortPath = join(dir, `cohort-${digest(seed).slice(0, 16)}.json`);
    let cohort = await read<{ seed: string; catalogDigest: string; rows: Seed[] }>(cohortPath);
    if (!cohort) {
      const rows = sampleSeeds(catalog.rows, Math.min(10_000, catalog.rows.length), seed);
      cohort = { seed, catalogDigest: digest(catalog.rows), rows };
      await save(cohortPath, cohort);
    }
    if (cohort.seed !== seed || size > cohort.rows.length || cohort.rows.some(row => !validNip(row.nip))
      || new Set(cohort.rows.map(row => row.nip)).size !== cohort.rows.length) throw new AuditStop("INSUFFICIENT_OR_INVALID_FROZEN_COHORT: seed more BZP rows and use a new seed");
    const rows = cohort.rows.slice(0, size);
    await save(join(dir, `sample-${size}.json`), { seed, catalogDigest: cohort.catalogDigest, rows });
    if (command === "sample") { console.log(JSON.stringify({ size, seed, catalogDigest: cohort.catalogDigest })); return; }
    const receiptsDir = join(dir, "receipts");
    await mkdir(receiptsDir, { recursive: true, mode: 0o700 });
    if (command === "fetch") {
      const maxCalls = integer(options["max-calls"], size * 2, 20_000), reserve = integer(options.reserve, 50, 20_000);
      const ledgerPath = join(dir, "request-ledger.json");
      const ledger = await read<{ requests: number; calls: number; nextAllowedAt: number }>(ledgerPath) ?? { requests: 0, calls: 0, nextAllowedAt: 0 };
      let available = 0;
      const client = new MetadataClient(process.env.MGBI_API_KEY ?? "", process.env.MGBI_AUTH_SCHEME ?? "raw", async kind => {
        if (kind === "records") {
          if (ledger.calls >= maxCalls || available <= 0) throw new AuditStop("REQUEST_BUDGET_EXHAUSTED");
          ledger.calls++; available--;
        }
        await sleep(Math.max(0, ledger.nextAllowedAt - Date.now()));
        ledger.requests++; ledger.nextAllowedAt = Date.now() + 350;
        // Reserve the request durably before sending it; crashes cannot reset budgets.
        await save(ledgerPath, ledger);
      });
      const before = await client.limits();
      await save(join(dir, "limits-before.json"), { ...before, at: new Date().toISOString() });
      available = Math.max(0, before.remainingSearch - reserve);
      try {
        for (const row of rows) {
          const path = join(receiptsDir, `${row.nip}.json`);
          let receipt = await read<Receipt & { pages: number; nextPage: number }>(path);
          if (receipt) checkReceipt(receipt, row.nip);
          if (receipt?.complete && receipt.projection === PROJECTION_VERSION) continue;
          if (receipt && receipt.projection !== PROJECTION_VERSION) throw new AuditStop("PROJECTION_VERSION_CONFLICT");
          receipt ??= { nip: row.nip, retrievedAt: new Date().toISOString(), complete: false, count: 0, records: [], projection: PROJECTION_VERSION, pages: 1, nextPage: 1 };
          if (!receipt.complete && (!Number.isSafeInteger(receipt.nextPage) || receipt.nextPage < 1 || receipt.nextPage > 100)) throw new AuditStop("INVALID_SAVED_PAGE_CHECKPOINT");
          while (!receipt.complete) {
            const page = await client.page(row.nip, receipt.nextPage);
            if (receipt.nextPage > 1 && (receipt.count !== page.count || receipt.pages !== page.pages)) throw new AuditStop("PAGINATION_CHANGED: preserve receipt and review before restarting");
            if (page.records.some(record => (record as {identifiers?: {pl_nip?: string}}).identifiers?.pl_nip !== row.nip)) throw new AuditStop("IDENTIFIER_MISMATCH");
            receipt.count = page.count; receipt.pages = page.pages;
            receipt.records.push(...page.records); receipt.nextPage++;
            receipt.complete = receipt.nextPage > Math.max(1, page.pages);
            if (receipt.complete && receipt.records.length !== receipt.count || !receipt.complete && !page.records.length
              || new Set(receipt.records.map(record => (record as { id: string }).id)).size !== receipt.records.length) throw new AuditStop("INCOMPLETE_OR_DUPLICATE_PAGINATION");
            await save(path, receipt);
          }
          console.log(JSON.stringify({ nip: row.nip, records: receipt.count, calls: ledger.calls, filesDownloaded: 0 }));
        }
      } finally {
        const after = await client.limits();
        await save(join(dir, "limits-after.json"), { ...after, at: new Date().toISOString() });
        if (after.filesUsed !== before.filesUsed) throw new AuditStop("PROVIDER_FILE_COUNTER_CHANGED: audit never calls file endpoints; investigate concurrent activity");
      }
    }
    const results = [];
    for (const row of rows) {
      const receipt = await read<Receipt>(join(receiptsDir, `${row.nip}.json`));
      if (receipt) checkReceipt(receipt, row.nip);
      results.push(analyze(receipt ?? { nip: row.nip, count: 0, records: [], complete: false, retrievedAt: new Date().toISOString(), projection: PROJECTION_VERSION, error: "NOT_FETCHED" }));
    }
    const categories: Record<string, number> = {}, flags: Record<string, number> = {};
    for (const result of results) {
      categories[result.category] = (categories[result.category] ?? 0) + 1;
      for (const flag of result.flags) flags[flag] = (flags[flag] ?? 0) + 1;
    }
    const report = { generatedAt: new Date().toISOString(), size, seed, catalogDigest: cohort.catalogDigest,
      population: "BZP contractors in fetched publication windows; includes JDG and is not representative of all Polish companies",
      fullReportReadiness: "NOT_VERIFIED: XML dictionaries and original files intentionally excluded", categories, flags, filesDownloaded: 0, results };
    await save(join(dir, `report-${size}.json`), report);
    const cell = (v: unknown) => `"${String(v).replaceAll('"', '""')}"`;
    await writeFile(join(dir, `report-${size}.csv`), "nip,category,records,statements,numericStatements,replay,flags\n" + results.map(r => [r.nip, r.category, r.records, r.statements, r.numericStatements, r.replay, r.flags.join(";")].map(cell).join(",")).join("\n") + "\n", { mode: 0o600 });
    console.log(JSON.stringify({ size, categories, flags, filesDownloaded: 0 }));
  } finally { await lock.close(); await unlink(lockPath); }
}
main().catch(error => { console.error(error instanceof AuditStop ? error.message : "AUDIT_FAILED: inspect operation and checkpoint; secrets are not logged"); process.exitCode = 1; });
