import { createReportRunner } from "./runner.mjs";
import { createReportApi } from "./api.mjs";
import { createScheduler } from "./scheduler.mjs";
import { requireThat } from "@profitia/insights-contracts";
/** Boot once inside the existing approved host, not a new web service. The
 * host supplies its current E1 boundaries and existing Sentry callbacks. */
export function createInsightsRuntime({
  configuration,
  store,
  authority,
  sources,
  canonical,
  composer,
  quality,
  renderer,
  telemetry,
  onError = () => {},
  now,
}) {
  requireThat(configuration.environment === "development", "DEVELOPMENT_ONLY");
  const runner = createReportRunner({
    store,
    authority,
    sources,
    canonical,
    composer,
    quality,
    renderer,
    telemetry,
    now,
  });
  const scheduler = createScheduler({
    runner,
    authority,
    definitions: configuration.definitions,
    profiles: configuration.profiles,
    now,
  });
  const api = createReportApi({
    runner,
    store,
    authority,
    profiles: configuration.profiles,
    now,
  });
  let stopping = false;
  return {
    runner,
    api,
    scheduler,
    async tick(options) {
      if (options?.signal?.aborted) return;
      requireThat(
        configuration.enabled && configuration.authorityDecisionRef,
        "WAITING_AUTHORIZATION",
      );
      await scheduler.tick(options);
      for (const context of await authority.workerContexts()) {
        const id = await store.queued(context.organisationId);
        if (id) {
          try { await runner.run(context.organisationId, id, { signal: options?.signal }); }
          catch { try { onError("WORKER_JOB_FAILED"); } catch {} }
        }
      }
    },
    async serveWorker({ signal, intervalMs = 30000 }) {
      while (!signal.aborted && !stopping) {
        try { await this.tick({ signal }); }
        catch { try { onError("WORKER_TICK_FAILED"); } catch {} }
        await new Promise((resolve) => {
          const done = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", done);
            resolve();
          };
          const timer = setTimeout(done, intervalMs);
          signal.addEventListener("abort", done, { once: true });
          if (signal.aborted) done();
        });
      }
    },
    stop() {
      stopping = true;
    },
  };
}
