import {
  CONTRACT,
  OPERATIONS,
  assertContext,
  command,
  requireThat,
  ReportError,
} from "@profitia/insights-contracts";
import { isOperationDenied } from "@profitia/platform-contracts/operation-context";
/** The host authority must invoke the action inside its verified current E1
 * boundary. Neither body/query/header organisation values are accepted. */
export function createReportApi({
  runner,
  store,
  authority,
  profiles,
  now = () => new Date().toISOString(),
}) {
  const idPattern = "[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}";
  const respond = (x, status = 200, headers = {}) =>
    Response.json(x, {
      status,
      headers: { "cache-control": "private, no-store", ...headers },
    });
  const safe = (j) =>
    j && {
      contractVersion: CONTRACT,
      jobId: j.id,
      editionId: j.editionId,
      definitionId: j.command.definitionId,
      profileVersion: j.command.profileVersion,
      period: j.command.period,
      asOf: j.asOf ?? j.command.asOf,
      status: j.status,
      coverage: j.coverage,
      stages: Object.fromEntries(
        Object.entries(j.stages).map(([k, v]) => [
          k,
          { status: v.status, timing: v.timing ?? null },
        ]),
      ),
      artifacts: j.artifacts ?? {},
      error: j.error ?? null,
      humanReviewRequired: true,
    };
  return async (request) => {
    try {
      const u = new URL(request.url),
        p = u.pathname;
      requireThat(!u.search, "UNSUPPORTED_QUERY", 400);
      let op, id;
      if (p === "/api/v1/insights/report-jobs" && request.method === "POST")
        op = "start";
      else if (
        p === "/api/v1/insights/report-editions" &&
        request.method === "GET"
      )
        op = "list";
      else if (
        new RegExp("^/api/v1/insights/report-jobs/" + idPattern + "$").test(p) &&
        request.method === "GET"
      ) {
        op = "status";
        id = p.split("/").at(-1);
      } else if (
        new RegExp("^/api/v1/insights/report-editions/" + idPattern + "/pdf$").test(p) &&
        request.method === "GET"
      ) {
        op = "download";
        id = p.split("/").at(-2);
      } else throw new ReportError("NOT_FOUND", 404);
      requireThat(
        /^Bearer \S+$/.test(request.headers.get("authorization") ?? ""),
        "AUTHENTICATION_REQUIRED",
        401,
      );
      return await authority.execute(
        { request, operation: OPERATIONS[op], resourceId: id ?? "oil-asphalt" },
        async (ctx) => {
          assertContext(ctx);
          if (op === "start") {
            requireThat(
              request.headers.get("content-type") === "application/json" &&
                !request.headers.has("content-encoding"),
              "INVALID_CONTENT_TYPE",
              400,
            );
            requireThat(request.body, "INVALID_JSON", 400);
            const reader = request.body.getReader(),
              chunks = [];
            let size = 0;
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.length;
                requireThat(size <= 8192, "REQUEST_TOO_LARGE", 413);
                chunks.push(value);
              }
            } finally {
              await reader.cancel().catch(() => {});
              reader.releaseLock();
            }
            const c = command(JSON.parse(Buffer.concat(chunks).toString()));
            const profile = profiles[c.profileVersion];
            requireThat(profile, "PROFILE_UNAVAILABLE", 503);
            const j = await runner.start(ctx, c, profile, "API");
            return respond(safe(j), 202, {
              location: "/api/v1/insights/report-jobs/" + j.id,
            });
          }
          if (op === "list")
            return respond({
              contractVersion: CONTRACT,
              editions: (await store.list(ctx.organisationId))
                .filter((j) => j.status === "AWAITING_REVIEW")
                .map(safe),
            });
          const j = await store.get(ctx.organisationId, id);
          requireThat(j, "NOT_FOUND", 404);
          if (op === "status") return respond(safe(j));
          requireThat(
            j.status === "AWAITING_REVIEW",
            "ARTIFACT_NOT_READY",
            409,
          );
          const a = await store.artifact(ctx.organisationId, id);
          requireThat(a, "NOT_FOUND", 404);
          return new Response(a.bytes, {
            headers: {
              "content-type": "application/pdf",
              "content-disposition": `attachment; filename="oil-asphalt-${j.command.period.throughDate}-r${j.command.revision}.pdf"`,
              "cache-control": "private, no-store",
              etag: '"' + a.sha256 + '"',
              "x-report-status": "HUMAN_REVIEW_REQUIRED",
            },
          });
        },
      );
    } catch (e) {
      if (isOperationDenied(e)) {
        const unavailable = ["POLICY_UNAVAILABLE", "AUDIT_UNAVAILABLE"].includes(e.reasonCode);
        return respond({ error: { code: unavailable ? "AUTHORITY_UNAVAILABLE" : "ACCESS_DENIED" } }, unavailable ? 503 : 403);
      }
      return respond(
        {
          error: {
            code:
              e instanceof SyntaxError
                ? "INVALID_JSON"
                : (e.code ?? "REPORT_UNAVAILABLE"),
          },
        },
        e instanceof SyntaxError ? 400 : (e.status ?? 503),
      );
    }
  };
}
