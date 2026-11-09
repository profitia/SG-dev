import { randomUUID } from "node:crypto";
import {
  assertContext,
  assertProfile,
  digest,
  requireThat,
  ReportError,
} from "@profitia/insights-contracts";
import { planData } from "./planner.mjs";
import { buildEvidence } from "./evidence.mjs";
import { validatePeriod } from "./calendar.mjs";
import { telemetry as createTelemetry } from "./telemetry.mjs";
export function createReportRunner({
  store,
  authority,
  sources,
  canonical,
  composer,
  quality,
  renderer,
  telemetry = createTelemetry(),
  now = () => new Date().toISOString(),
}) {
  requireThat(
    [store, authority, sources, canonical, composer, quality, renderer].every(
      Boolean,
    ),
    "EXPLICIT_RUNTIME_PORTS_REQUIRED",
  );
  async function start(ctx, input, profile, trigger = "API") {
    assertContext(ctx);
    assertProfile(profile);
    validatePeriod(input, now());
    requireThat(
      input.profileVersion === profile.version,
      "PROFILE_VERSION_MISMATCH",
    );
    return store.start(ctx, input, profile, trigger);
  }
  async function run(org, id, { signal } = {}) {
    const lease = await store.claim(org, id);
    if (!lease) return store.get(org, id);
    let j = lease.job;
    const save = () => store.checkpoint(org, id, lease, j);
    // All side effects are journalled BEFORE execution. Persist result and receipt
    // before permitting the next stage. A crash in this interval is ambiguous.
    async function effect(key, reserve, fn) {
      const old = j.calls[key];
      if (old) {
        if (["SUCCEEDED", "FAILED_NO_RETRY"].includes(old.status)) return old.result;
        throw new ReportError("RECONCILIATION_REQUIRED");
      }
      requireThat(!signal?.aborted, "WORKER_INTERRUPTED");
      requireThat(
        Number.isSafeInteger(reserve) && reserve >= 0,
        "INVALID_RESERVATION",
      );
      const committed = Object.values(j.calls).reduce(
        (n, c) => n + (c.costMicroUsd ?? c.reservedMicroUsd),
        0,
      );
      requireThat(
        committed + reserve <= j.profile.budgetMicroUsd,
        "BUDGET_EXCEEDED",
      );
      j.calls[key] = {
        id: randomUUID(),
        status: "INTENT",
        reservedMicroUsd: reserve,
        costMicroUsd: null,
        startedAt: now(),
      };
      await save();
      try {
        const out = await fn(j.calls[key].id);
        requireThat(out && out.receiptRef, "RECEIPT_REQUIRED");
        if (out.costMicroUsd !== null && out.costMicroUsd !== undefined)
          requireThat(
            Number.isSafeInteger(out.costMicroUsd) &&
              out.costMicroUsd >= 0 &&
              out.costMicroUsd <= reserve,
            "COST_RESERVATION_EXCEEDED",
          );
        j.calls[key] = {
          ...j.calls[key],
          status: "SUCCEEDED",
          costMicroUsd: out.costMicroUsd ?? null,
          result: out,
          endedAt: now(),
        };
        await save();
        return out;
      } catch (e) {
        if (key.startsWith("source:")) {
          // An unavailable provider is coverage, not permission to retry. Its
          // cost remains unknown outside the OpenAI ledger. No Hub receipt is
          // invented when the Hub returned none. Other admitted facts can still
          // support the explicitly PARTIAL report.
          const result = { status: "UNAVAILABLE", projection: [], receiptRef: null,
            localAttemptRef: j.calls[key].id, reason: e.code ?? "SOURCE_HUB_UNAVAILABLE",
            usage: { logicalRequests: 1, upstreamRequests: null, providerCost: "UNKNOWN_NOT_OPENAI" } };
          j.calls[key] = { ...j.calls[key], status: "FAILED_NO_RETRY", costMicroUsd: 0,
            endedAt: now(), result };
          await save();
          return result;
        }
        j.calls[key] = {
          ...j.calls[key],
          status: e.certainty === "NOT_SENT" ? "NOT_SENT" : "UNCERTAIN",
          endedAt: now(),
          reason: e.code ?? "UNVERIFIED",
        };
        await save();
        throw new ReportError("RECONCILIATION_REQUIRED");
      }
    }
    async function stage(name, fn) {
      if (j.stages[name]?.status === "SUCCEEDED") return j.stages[name].value;
      const result = await telemetry.stage(name, j, fn);
      j.stages[name] = { status: "SUCCEEDED", ...result };
      await save();
      return result.value;
    }
    try {
      assertProfile(j.profile);
      const auth = await authority.authorizeJob(j);
      assertContext(auth.context);
      requireThat(
        auth.context.actorKind === "SERVICE" &&
          auth.context.organisationId === org &&
          auth.profileId === j.profile.id &&
          Date.parse(auth.expiresAt) > Date.parse(now()) &&
          auth.budgetMicroUsd >= j.profile.budgetMicroUsd,
        "WAITING_AUTHORIZATION",
      );
      j.authorityRef = auth.receiptRef;
      j.status = "RUNNING";
      await save();
      requireThat(
        !Object.values(j.calls).some((c) =>
          ["INTENT", "UNCERTAIN", "NOT_SENT"].includes(c.status),
        ),
        "RECONCILIATION_REQUIRED",
      );
      const plan = await stage("plan", () => planData(j));
      const acq = await stage("acquire", async () => {
        const result = [];
        for (const q of plan.queries) {
          if (!(await sources.admitted(q, j))) {
            result.push({
              queryId: q.id,
              status: "NOT_ADMITTED",
              projection: [],
            });
            continue;
          }
          const out = await effect("source:" + q.id, 0, (callId) =>
            sources.acquire(q, j, {
              idempotencyKey: j.id + ":" + q.id,
              callId,
              signal,
            }),
          );
          result.push({ ...out, queryId: q.id });
        }
        return result;
      });
      const bundle = await stage("evidence", async () => {
        const values = await canonical.read(j, plan);
        j.asOf = now();
        await save();
        return buildEvidence(j, acq, values);
      });
      requireThat(
        bundle.evidence.length > 0 || bundle.market.series?.length > 0,
        "NO_DATA",
      );
      const composed = await stage("compose", async () => {
        const prepared = await composer.prepare(j, bundle);
        requireThat(
          prepared.maximumCostMicroUsd <= j.profile.budgetMicroUsd,
          "BUDGET_EXCEEDED",
        );
        const counter = await effect(
          "openai:count",
          prepared.counterMaximumCostMicroUsd,
          (callId) => composer.count(j, prepared, { callId, signal }),
        );
        return effect(
          "openai:compose",
          prepared.maximumCostMicroUsd,
          (callId) =>
            composer.generate(j, bundle, prepared, { callId, counter, signal }),
        );
      });
      const gate = await stage("quality", () => quality(j, bundle, composed));
      requireThat(
        gate.status === "PASS_WITH_HUMAN_REVIEW",
        "QUALITY_GATE_FAILED",
      );
      const render = await telemetry.stage("render", j, () => renderer(j, bundle, composed, gate));
      const rendered = render.value;
      j.stages.render = { status: "SUCCEEDED", timing: render.timing, value: rendered.metadata };
      j.status = "AWAITING_REVIEW";
      j.coverage = bundle.status === "PARTIAL_READY" ? "PARTIAL" : "COMPLETE";
      j.stages.finalize = { status: "SUCCEEDED", at: now() };
      j.artifacts = Object.fromEntries(
        Object.entries(rendered.artifacts).map(([k, v]) => [
          k,
          { sha256: digest(Buffer.from(v)), bytes: Buffer.byteLength(v) },
        ]),
      );
      j.completedAt = now();
      return await store.finalize(org, id, lease, j, rendered.artifacts);
    } catch (e) {
      j.status =
        e.code === "RECONCILIATION_REQUIRED"
          ? "RECONCILIATION_REQUIRED"
          : [
                "WAITING_AUTHORIZATION",
                "CURRENT_E1_CONTEXT_REQUIRED",
                "PROFILE_NOT_ADMITTED",
              ].includes(e.code)
            ? "WAITING_AUTHORIZATION"
            : "FAILED";
      j.error = { code: e.code ?? "REPORT_EXECUTION_FAILED", at: now() };
      await save();
      return j;
    } finally {
      await store.release(org, id, lease);
    }
  }
  return Object.freeze({ start, run });
}
