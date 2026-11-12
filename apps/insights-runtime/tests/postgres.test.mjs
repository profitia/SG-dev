import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PostgresReportStore } from "../src/store.mjs";
import { createReportRunner } from "../src/runner.mjs";
import { createReportApi } from "../src/api.mjs";
import { createScheduler } from "../src/scheduler.mjs";
import {
  CANON_SHA256,
  SECTIONS,
  ReportError,
} from "../../../packages/insights-contracts/index.mjs";
import { qualityGate } from "../src/composer.mjs";
import { createRenderer } from "../src/renderer.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

test("renderer handles incomplete vendor metadata, long unedited prose and deterministic pagination", {skip: process.env.INSIGHTS_TEST_RENDER !== "true"}, () => {
  // Controlled synthetic layout case; no provider data, model or network.
  const dir = mkdtempSync(join(tmpdir(), "oil-render-regression-"));
  try {
    const keys = ["executive", "statistical", "events", "macro", "outlook", "calendar", "asphalt", "procurement"];
    const phrase = "To kontrolowany materiał do sprawdzenia układu dokumentu i zachowania pełnej treści. Nie stanowi obserwacji rynkowej ani rekomendacji zakupowej. ";
    const evidence = Array.from({length:18}, (_,i) => ({id:"TEST_"+i,provider:"test-only",publisher:{id:"test",name:"Kontrolowane źródło"},title:"Materiał testowy",url:"https://example.invalid/layout-test",publishedAt:null,materialDepth:"CONTROLLED_TEST_ONLY",family:i<6?"market-observations":"news",facts:i<6?{symbol:["CL1:COM","CO1:COM","BIT:COM"][i%3],label:null,price:10+i,currency:null,unit:i<3?"TEST/t":null,instrumentType:"UNKNOWN",referenceMarket:"Rynek testowy",observationAt:"2026-11-10T08:00:00Z",weeklyChange:null}:{} }));
    const narrative = Object.fromEntries(keys.map((k,i)=>[k,Array.from({length:[3,4,3,3,3,3,3,4][i]},(_,j)=>({text:phrase.repeat(3),refs:["TEST_"+((i*3+j)%18)]}))]));
    const bundle={schemaVersion:"ReportEvidenceBundle/OilAsphalt/0.5",profileId:"CONTROLLED_TEST_ONLY",fingerprint:"test-fingerprint",admissionRef:"TEST_NOT_LIVE",asOf:"2026-11-10T08:00:00Z",evidence,forecast:{series:[]},windows:{review:{fromDate:"2026-11-03",throughDate:"2026-11-09"},outlook:{fromDate:"2026-11-10",throughDate:"2026-11-16"}},pilotDeviations:[],coverage:{}};
    const receipt={profileId:bundle.profileId,status:"completed",evidenceFingerprint:bundle.fingerprint};
    for(const[n,v]of Object.entries({bundle,narrative,receipt}))writeFileSync(join(dir,n+".json"),JSON.stringify(v));
    const hashes=[];
    for(let i=0;i<2;i++){
      const out=join(dir,"output-"+i),root=fileURLToPath(new URL("../render/",import.meta.url));
      const r=spawnSync(process.env.INSIGHTS_TEST_PYTHON??"python3",[join(root,"report.py"),"--bundle",join(dir,"bundle.json"),"--narrative",join(dir,"narrative.json"),"--receipt",join(dir,"receipt.json"),"--output",out,"--font",join(root,"fonts/DejaVuSans.ttf"),"--bold",join(root,"fonts/DejaVuSans-Bold.ttf")],{encoding:"utf8",timeout:60000,env:{...process.env,PYTHONHASHSEED:"0",TZ:"UTC"}});
      assert.equal(r.status,0,r.stderr);
      const metadata=JSON.parse(readFileSync(join(out,"RENDER_VALIDATION.json")));
      assert.equal(metadata.pages,4);assert.equal(metadata.originalNarrativePreserved,true);
      const markdown=readFileSync(join(out,"OIL_ASPHALT_MARKET_OUTLOOK_v0.5_PL.md"),"utf8");
      assert.ok(markdown.includes("waluta niepotwierdzona"));assert.ok(markdown.includes("jednostka niepotwierdzona"));
      assert.ok(markdown.includes("Kontrolowane źródło"));assert.ok(!markdown.includes("{'id':"));
      for(const statements of Object.values(narrative))for(const statement of statements)assert.ok(markdown.includes(statement.text));
      hashes.push(createHash("sha256").update(readFileSync(join(out,"OIL_ASPHALT_MARKET_OUTLOOK_v0.5_PL.pdf"))).digest("hex"));
    }
    assert.equal(hashes[0],hashes[1],"identical inputs preserve exact PDF bytes");
    const short=Object.fromEntries(keys.map(k=>[k,[{text:phrase,refs:["METHODOLOGY"]}]]));
    writeFileSync(join(dir,"narrative.json"),JSON.stringify(short));
    const root=fileURLToPath(new URL("../render/",import.meta.url)),out=join(dir,"short-output");
    const r=spawnSync(process.env.INSIGHTS_TEST_PYTHON??"python3",[join(root,"report.py"),"--bundle",join(dir,"bundle.json"),"--narrative",join(dir,"narrative.json"),"--receipt",join(dir,"receipt.json"),"--output",out,"--font",join(root,"fonts/DejaVuSans.ttf"),"--bold",join(root,"fonts/DejaVuSans-Bold.ttf")],{encoding:"utf8",timeout:60000,env:{...process.env,PYTHONHASHSEED:"0",TZ:"UTC"}});
    assert.equal(r.status,0,r.stderr);
    assert.equal(JSON.parse(readFileSync(join(out,"RENDER_VALIDATION.json"))).pages,4,"short input preserves the same four-page renderer contract");

  } finally {rmSync(dir,{recursive:true,force:true});}
});
const enabled = !!process.env.INSIGHTS_TEST_DATABASE_URL;
const TEST_ORG = "org-a-" + randomUUID(),
  REPLAY_ORG = "offline-replay-" + randomUUID();
const profile = {
  id: "oil-v05-autonomous-1",
  version: "oil-v05-autonomous-1",
  environment: "development",
  canonSha256: CANON_SHA256,
  model: "gpt-6.1-sol",
  budgetMicroUsd: 5000000,
  counterReservationMicroUsd: 100000,
  maximumInputTokens: 15000,
  maximumOutputTokens: 16000,
  maximumBodyBytes: 65536,
  timeoutMs: 600000,
  autoRetry: false,
  store: false,
  rawRetentionSeconds: 0,
};
const now = () => "2026-11-10T08:00:00.000Z",
  ctx = (org = TEST_ORG) => ({
    environment: "development",
    organisationId: org,
    actorId: "test-service",
    actorKind: "SERVICE",
    decisionId: "CONTROLLED_TEST_AUTHORITY",
    expiresAt: "2099-01-01T00:00:00Z",
  });
const input = JSON.parse(
  readFileSync(new URL("./fixtures/offline-report.json", import.meta.url)),
).command;
function ports(store, { render, generate, source } = {}) {
  const counts = { source: 0, count: 0, generate: 0, render: 0 };
  let revoked = false;
  const authority = {
    async authorizeJob(j) {
      if (revoked) throw new ReportError("WAITING_AUTHORIZATION");
      return {
        context: ctx(j.organisationId),
        profileId: profile.id,
        budgetMicroUsd: 5000000,
        expiresAt: "2099-01-01T00:00:00Z",
        receiptRef: "TEST_E1",
      };
    },
    async schedulerContext() {
      return ctx();
    },
    async execute(_in, action) {
      if (revoked) throw new ReportError("OPERATION_DENIED", 403);
      return action(ctx());
    },
  };
  const composer = {
    async prepare() {
      return {
        maximumCostMicroUsd: 100000,
        counterMaximumCostMicroUsd: 100000,
      };
    },
    async count() {
      counts.count++;
      return { receiptRef: "TEST_COUNTER", costMicroUsd: null };
    },
    async generate(j, b, p, o) {
      counts.generate++;
      if (generate) return generate(j, b, p, o);
      return {
        receiptRef: "TEST_GENERATION",
        costMicroUsd: 10000,
        status: "completed",
        model: profile.model,
        profileId: profile.id,
        evidenceFingerprint: b.fingerprint,
        narrative: Object.fromEntries(
          SECTIONS.map((k) => [
            k,
            [
              {
                text: "Kontrolowany materiał testowy. Brak potwierdzonych danych wymaga ostrożności.",
                refs: ["METHODOLOGY"],
              },
            ],
          ]),
        ),
      };
    },
  };
  const deps = {
    store,
    authority,
    sources: {
      async admitted(q) {
        return q.id === "te-snapshot";
      },
      async acquire(q, j, o) {
        counts.source++;
        if (source) return source(q, j, o);
        return {
          receiptRef: "TEST_HUB",
          costMicroUsd: 0,
          status: "EMPTY",
          projection: [],
        };
      },
    },
    canonical: {
      async read() {
        return {
          market: {
            status: "CONTROLLED_TEST_ONLY",
            series: [{ seriesId: "cl_c1_cl", status: "CONTROLLED_TEST_ONLY" }],
          },
        };
      },
    },
    composer,
    quality: qualityGate,
    renderer: async (...args) => {
      counts.render++;
      return render
        ? render(...args)
        : {
            artifacts: {
              pdf: Buffer.from("%PDF-1.7\nCONTROLLED_TEST_ONLY"),
              markdown: "controlled",
              appendix: "controlled",
            },
            metadata: { pages: 4, testOnly: true },
          };
    },
    now,
  };
  return {
    deps,
    counts,
    revoke() {
      revoked = true;
    },
  };
}
test(
  "Postgres acceptance: one job, tenant isolation, API4, scheduler, leases, recovery and uncertain costs",
  { skip: !enabled },
  async (t) => {
    const pool = new Pool({
        connectionString: process.env.INSIGHTS_TEST_DATABASE_URL,
        max: 8,
      }),
      store = new PostgresReportStore(pool);
    t.after(() => pool.end());
    const p = ports(
        store,
        process.env.INSIGHTS_TEST_RENDER === "true"
          ? {
              render: createRenderer({
                python: process.env.INSIGHTS_TEST_PYTHON ?? "python3",
              }),
            }
          : {},
      ),
      runner = createReportRunner(p.deps);
    const jobs = await Promise.all(
      Array.from({ length: 8 }, () =>
        runner.start(ctx(), input, profile, "API"),
      ),
    );
    assert.equal(new Set(jobs.map((x) => x.id)).size, 1);
    const job = jobs[0];
    const scheduler = createScheduler({
      runner,
      authority: p.deps.authority,
      definitions: [
        {
          id: "oil-asphalt",
          profileVersion: profile.version,
          revision: 1,
          schedule: {
            enabled: true,
            weekday: 2,
            localTime: "08:00",
            timezone: "Europe/Warsaw",
            catchUp: "LATEST_ONLY",
            graceMinutes: 15,
          },
        },
      ],
      profiles: { [profile.version]: profile },
      now,
    });
    assert.equal((await scheduler.tick())[0].id, job.id);
    await Promise.all([
      runner.run(TEST_ORG, job.id),
      runner.run(TEST_ORG, job.id),
    ]);
    const complete = await store.get(TEST_ORG, job.id);
    assert.equal(complete.status, "AWAITING_REVIEW");
    assert.equal(p.counts.generate, 1);
    assert.equal(p.counts.count, 1);
    assert.equal(await store.get("org-b", job.id), null);
    assert.equal(await store.artifact("org-b", job.id), null);
    await runner.run(TEST_ORG, job.id);
    assert.equal(p.counts.generate, 1);
    const api = createReportApi({
      runner,
      store,
      authority: p.deps.authority,
      profiles: { [profile.version]: profile },
      now,
    });
    const req = (path, options = {}) =>
      new Request("https://test.local" + path, {
        ...options,
        headers: {
          authorization: "Bearer controlled-test-only",
          ...options.headers,
        },
      });
    const started = await api(
      req("/api/v1/insights/report-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
    assert.equal(started.status, 202);
    assert.equal((await started.json()).jobId, job.id);
    assert.equal(
      (await api(req("/api/v1/insights/report-jobs/" + job.id))).status,
      200,
    );
    assert.equal(
      (await (await api(req("/api/v1/insights/report-editions"))).json())
        .editions[0].editionId,
      job.id,
    );
    const download = await api(
      req("/api/v1/insights/report-editions/" + job.id + "/pdf"),
    );
    assert.equal(download.status, 200);
    assert.equal((await download.text()).slice(0, 5), "%PDF-");
    assert.equal(
      (await api(req("/api/v1/insights/report-jobs?organisationId=org-b")))
        .status,
      400,
    );
    p.revoke();
    assert.equal(
      (await api(req("/api/v1/insights/report-editions/" + job.id + "/pdf")))
        .status,
      403,
    );
    // Process replacement after rendering fails: durable model output is reused.
    let crash = true;
    const p2 = ports(store, {
        render: async () => {
          if (crash) throw Error("CONTROLLED_RENDER_CRASH");
          return {
            artifacts: { pdf: Buffer.from("%PDF-recovered") },
            metadata: { pages: 4 },
          };
        },
      }),
      j2 = await createReportRunner(p2.deps).start(
        ctx(),
        { ...input, revision: 2 },
        profile,
      );
    assert.equal(
      (await createReportRunner(p2.deps).run(TEST_ORG, j2.id)).status,
      "FAILED",
    );
    crash = false;
    assert.equal(
      (await createReportRunner(p2.deps).run(TEST_ORG, j2.id)).status,
      "AWAITING_REVIEW",
    );
    assert.equal(p2.counts.generate, 1);
    // A generation with uncertain billing cannot be retried, even after restart.
    const p3 = ports(store, {
        generate: async () => {
          throw Error("UNKNOWN_UPSTREAM_STATUS");
        },
      }),
      r3 = createReportRunner(p3.deps),
      j3 = await r3.start(ctx(), { ...input, revision: 3 }, profile);
    assert.equal(
      (await r3.run(TEST_ORG, j3.id)).status,
      "RECONCILIATION_REQUIRED",
    );
    await r3.run(TEST_ORG, j3.id);
    assert.equal(p3.counts.generate, 1);
    const unknown = await store.get(TEST_ORG, j3.id);
    assert.equal(unknown.calls["openai:compose"].costMicroUsd, null);
    assert.equal(unknown.calls["openai:compose"].reservedMicroUsd, 100000);
    // Fenced lease: stale holder cannot checkpoint after another claim.
    const j4 = await r3.start(ctx(), { ...input, revision: 4 }, profile),
      lease = await store.claim(TEST_ORG, j4.id, 1);
    await new Promise((r) => setTimeout(r, 5));
    const replacement = await store.claim(TEST_ORG, j4.id);
    assert.ok(replacement);
    await assert.rejects(
      store.checkpoint(TEST_ORG, j4.id, lease, j4),
      (e) => e.code === "LEASE_LOST",
    );
    await store.release(TEST_ORG, j4.id, replacement);

    // Real separate process exits after committed INTENT, before settlement.
    const crashJob = await r3.start(ctx(), { ...input, revision: 5 }, profile);
    const script = `import {Pool} from 'pg';import {PostgresReportStore} from './src/store.mjs';const p=new Pool({connectionString:process.env.INSIGHTS_TEST_DATABASE_URL});const s=new PostgresReportStore(p);const l=await s.claim(${JSON.stringify(TEST_ORG)},${JSON.stringify(crashJob.id)});const j=l.job;j.calls['openai:compose']={status:'INTENT',reservedMicroUsd:100000,costMicroUsd:null};j.status='RUNNING';await s.checkpoint(${JSON.stringify(TEST_ORG)},j.id,l,j);process.exit(77);`;
    const killed = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: process.env,
        encoding: "utf8",
      },
    );
    assert.equal(killed.status, 77, killed.stderr);
    // Advance only this isolated test lease to simulate expiry after the crash.
    await store.transaction(TEST_ORG, (db) =>
      db.query(
        "UPDATE insights_private.report_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
        [crashJob.id],
      ),
    );
    const afterCrash = await createReportRunner(p3.deps).run(
      TEST_ORG,
      crashJob.id,
    );
    assert.equal(afterCrash.status, "RECONCILIATION_REQUIRED");
    assert.equal(p3.counts.generate, 1);
    if (process.env.INSIGHTS_TEST_RECEIPT_OUT)
      writeFileSync(
        process.env.INSIGHTS_TEST_RECEIPT_OUT,
        JSON.stringify(
          {
            status: "OFFLINE_POSTGRES_API_SCHEDULER_RECOVERY_PASS",
            jobId: job.id,
            calls: p.counts,
            unknownCostRetained: true,
            tenantIsolation: true,
            live: false,
          },
          null,
          2,
        ),
      );
  },
);
test(
  "Existing immutable report replay through durable runner and API download; no live model/provider",
  { skip: !enabled || !process.env.INSIGHTS_REPLAY_ROOT },
  async (t) => {
    const pool = new Pool({
        connectionString: process.env.INSIGHTS_TEST_DATABASE_URL,
      }),
      store = new PostgresReportStore(pool);
    t.after(() => pool.end());
    const base = process.env.INSIGHTS_REPLAY_ROOT,
      load = (n) => JSON.parse(readFileSync(base + "/" + n));
    const bundle = load(
        "deliverables-final-v2/OIL_COMMODITY_EVIDENCE_BUNDLE.json",
      ),
      narrative = load("execution-live-v1/REVIEWED_NARRATIVE.json"),
      oldReceipt = load("deliverables-final-v2/OPENAI_EXECUTION_RECEIPT.json");
    // Test dependency substitutes frozen, licence-controlled local replay material.
    const projection = bundle.evidence.map((e) => ({
      ...e,
      publishedAt: e.publishedAt ?? null,
      availableAt: e.availableAt ?? null,
      receiptRef: e.receiptRef ?? "HISTORICAL_RECEIPT",
      licenceRef: e.licenceRef ?? "HISTORICAL_LICENSE_REFERENCE",
      projectionBasisRef: "OFFLINE_REPLAY_NO_PUBLICATION",
    }));
    const renderer = createRenderer({
        python: process.env.INSIGHTS_TEST_PYTHON ?? "python3",
      }),
      p = ports(store, {
        source: async () => ({
          receiptRef: "HISTORICAL_REPLAY_ONLY",
          costMicroUsd: 0,
          status: "SUCCEEDED",
          projection,
        }),
        generate: async (j, b) => ({
          ...oldReceipt,
          receiptRef: oldReceipt.requestId ?? "HISTORICAL_OPENAI_RESPONSE",
          costMicroUsd: 0,
          status: "completed",
          evidenceFingerprint: b.fingerprint,
          profileId: profile.id,
          narrative,
          replay: true,
        }),
        render: renderer,
      });
    p.deps.now = () => bundle.asOf;
    const runner = createReportRunner(p.deps),
      job = await runner.start(
        ctx(REPLAY_ORG),
        {
          ...input,
          period: {
            fromDate: bundle.windows.review.fromDate,
            throughDate: bundle.windows.review.throughDate,
          },
          asOf: bundle.asOf,
          allowPartial: true,
          revision: 10,
        },
        profile,
      );
    const done = await runner.run(REPLAY_ORG, job.id);
    assert.equal(done.status, "AWAITING_REVIEW", JSON.stringify(done.error));
    const api = createReportApi({
      runner,
      store,
      authority: { execute: async (_i, f) => f(ctx(REPLAY_ORG)) },
      profiles: { [profile.version]: profile },
      now,
    });
    const response = await api(
      new Request(
        "https://test.local/api/v1/insights/report-editions/" + job.id + "/pdf",
        { headers: { authorization: "Bearer offline-test-only" } },
      ),
    );
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    if (process.env.INSIGHTS_REPLAY_OUT) {
      mkdirSync(process.env.INSIGHTS_REPLAY_OUT, { recursive: true });
      writeFileSync(
        process.env.INSIGHTS_REPLAY_OUT +
          "/OFFLINE_HISTORICAL_REPLAY_NOT_NEW_EDITION.pdf",
        bytes,
      );
      writeFileSync(
        process.env.INSIGHTS_REPLAY_OUT + "/REPLAY_RECEIPT.json",
        JSON.stringify(
          {
            jobId: job.id,
            status: done.status,
            historicalAsOf: bundle.asOf,
            testOnly: true,
            newProviderCalls: 0,
            newModelCalls: 0,
            pages: done.stages.render.value.pages,
          },
          null,
          2,
        ),
      );
    }
  },
);


test("receiving E1 transaction owns the job write and rolls it back on final denial", {skip:!enabled}, async()=>{
 const pool=new Pool({connectionString:process.env.INSIGHTS_TEST_DATABASE_URL,max:2});
 const store=new PostgresReportStore(pool);
 const org="e1-rollback-"+randomUUID(),c=await pool.connect();
 try{
  await c.query("BEGIN");
  const j=await store.withClient(org,c,()=>store.start(ctx(org),input,profile,"API"));
  assert(j.id);
  await c.query("ROLLBACK");
  assert.equal(await store.get(org,j.id),null);
  await c.query("BEGIN");
  const committed=await store.withClient(org,c,()=>store.start(ctx(org),input,profile,"API"));
  await c.query("COMMIT");
  assert.equal((await store.get(org,committed.id)).id,committed.id);
 }finally{c.release();await pool.end()}
});


test("provider rejection produces explicit PARTIAL coverage without retry or losing admitted canonical facts", {skip:!enabled}, async()=>{
 const pool=new Pool({connectionString:process.env.INSIGHTS_TEST_DATABASE_URL,max:3});
 const store=new PostgresReportStore(pool),org="source-partial-"+randomUUID();
 try{
  const f=ports(store,{source:async()=>{throw Object.assign(Error("CONTROLLED_PROVIDER_DENIAL"),{code:"SOURCE_NOT_ENTITLED"})}});
  const runner=createReportRunner(f.deps),job=await runner.start(ctx(org),input,profile);
  const done=await runner.run(org,job.id);
  assert.equal(done.status,"AWAITING_REVIEW");assert.equal(done.coverage,"PARTIAL");
  const attempt=done.calls['source:te-snapshot'];assert.equal(attempt.status,'FAILED_NO_RETRY');
  assert.equal(attempt.result.receiptRef,null);assert.equal(attempt.result.usage.providerCost,'UNKNOWN_NOT_OPENAI');
  await runner.run(org,job.id);assert.equal(f.counts.source,1);assert.equal(f.counts.generate,1);
 }finally{await pool.end()}
});
