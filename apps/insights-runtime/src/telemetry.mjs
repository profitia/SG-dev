import { performance } from "node:perf_hooks";
/** Reuses the approved host's Sentry; never serializes business payloads. */
export function telemetry({
  span = async (_n, fn) => fn(),
  capture = () => {},
} = {}) {
  return {
    async stage(name, job, fn) {
      const startedAt = new Date().toISOString(),
        begin = performance.now();
      let invoked = false,
        value,
        businessError;
      const once = async () => {
        if (invoked) return value;
        invoked = true;
        try {
          value = await fn();
          return value;
        } catch (e) {
          businessError = e;
          throw e;
        }
      };
      try {
        try {
          await span("insights.report." + name, once, {
            jobId: job.id,
            environment: "development",
          });
        } catch (e) {
          if (businessError) throw businessError;
          if (!invoked) await once();
        }
        if (!invoked) await once();
        if (businessError) throw businessError;
        return {
          value,
          timing: {
            startedAt,
            endedAt: new Date().toISOString(),
            durationMs: performance.now() - begin,
            status: "SUCCEEDED",
          },
        };
      } catch (e) {
        try {
          if (
            ![
              "OPERATION_DENIED",
              "NO_DATA",
              "WAITING_AUTHORIZATION",
              "RECONCILIATION_REQUIRED",
            ].includes(e.code)
          )
            capture(new Error("INSIGHTS_STAGE_FAILED"), {
              stage: name,
              jobId: job.id,
              environment: "development",
            });
        } catch {}
        throw e;
      }
    },
  };
}
