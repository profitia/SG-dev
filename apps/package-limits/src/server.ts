import http, { type IncomingMessage, type ServerResponse } from "node:http";
import fs from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { configuration, type Config } from "./config.js";
import { identityBoundary, type WithIdentity } from "./auth.js";
import { Store } from "./store.js";
import { Fault, command, id, type Dict } from "./domain.js";
import { page } from "./page.js";
interface Dependencies {
  config: Config;
  store: Store;
  withIdentity: WithIdentity;
  health: () => Promise<unknown>;
}
function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}
async function body(req: IncomingMessage): Promise<unknown> {
  if (
    !String(req.headers["content-type"] ?? "")
      .toLowerCase()
      .startsWith("application/json")
  )
    throw new Fault(415, "JSON_REQUIRED");
  const chunks: Buffer[] = [];
  let n = 0;
  for await (const x of req) {
    const b = Buffer.from(x);
    n += b.length;
    if (n > 65536) throw new Fault(413, "INPUT_TOO_LARGE");
    chunks.push(b);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Fault(400, "INVALID_JSON");
  }
}
export function createHandler(deps: Dependencies) {
  const rates = new Map<string, { n: number; until: number }>();
  return async (req: IncomingMessage, res: ServerResponse) => {
    const requestId = randomUUID();
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    res.setHeader("X-Request-Id", requestId);
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' " +
        deps.config.issuer +
        " https://challenges.cloudflare.com; connect-src 'self' " +
        deps.config.issuer +
        "; frame-src " +
        deps.config.issuer +
        " https://challenges.cloudflare.com; img-src 'self' data: https://img.clerk.com https://images.clerk.dev; style-src 'self' 'unsafe-inline'; font-src 'self' data: " +
        deps.config.issuer +
        "; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
    try {
      const url = new URL(req.url ?? "/", deps.config.origin);
      if (url.origin !== deps.config.origin)
        throw new Fault(400, "INVALID_URL");
      if (req.method === "GET" && url.pathname === "/healthz") {
        await deps.health();
        return json(res, 200, {
          status: "ok",
          environment: "development",
          sourceSha: deps.config.sourceSha,
        });
      }
      if (
        req.method === "GET" &&
        ["/browser.js", "/styles.css"].includes(url.pathname)
      ) {
        res.setHeader(
          "Content-Type",
          url.pathname.endsWith(".js")
            ? "text/javascript; charset=utf-8"
            : "text/css; charset=utf-8",
        );
        return res.end(
          fs.readFileSync(new URL("." + url.pathname, import.meta.url)),
        );
      }
      if (req.method === "GET" && url.pathname === "/") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.end(page(deps.config));
      }
      if (
        !["/api/state", "/api/organisations", "/api/command"].includes(
          url.pathname,
        )
      )
        throw new Fault(404, "NOT_FOUND");
      if (
        (req.headers.origin && req.headers.origin !== deps.config.origin) ||
        (req.method === "POST" && req.headers.origin !== deps.config.origin)
      )
        throw new Fault(403, "SAME_ORIGIN_REQUIRED");
      if (req.method !== (url.pathname === "/api/command" ? "POST" : "GET"))
        throw new Fault(405, "METHOD_NOT_ALLOWED");
      const address = req.socket.remoteAddress ?? "unknown",
        now = Date.now();
      if (rates.size > 4096)
        for (const [k, v] of rates) if (v.until < now) rates.delete(k);
      const r = rates.get(address);
      if (r && r.until > now && r.n >= 240)
        throw new Fault(429, "TOO_MANY_REQUESTS");
      rates.set(
        address,
        r && r.until > now
          ? { n: r.n + 1, until: r.until }
          : { n: 1, until: now + 60000 },
      );
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers))
        if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(",") : v);
      const request = new Request(url, { method: req.method, headers });
      const change = req.method === "POST" ? command(await body(req)) : null;
      const data = await deps.withIdentity(request, (scope) =>
        deps.store.transact(scope.actor, async (session) => {
          if (url.pathname === "/api/state") {
            const offset = Number(url.searchParams.get("offset") ?? 0);
            if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
              throw new Fault(400, "INVALID_PAGE");
            const state = await session.call("list", {
              offset,
              q: (url.searchParams.get("q") ?? "").slice(0, 256),
            });
            const ids = [
              ...new Set<string>(
                state.assignments.map(
                  (a: { organisation_id: string }) => a.organisation_id,
                ),
              ),
            ];
            state.organisations = ids.length
              ? await scope.organisations("", ids)
              : [];
            return state;
          }
          if (url.pathname === "/api/organisations") {
            await session.call("authorize", {});
            return {
              organisations: (
                await scope.organisations(
                  (url.searchParams.get("q") ?? "").slice(0, 256),
                  null,
                )
              ).slice(0, 25),
            };
          }
          if (!change) throw new Fault(400, "INVALID_COMMAND");
          const d = { ...change.data };
          if (change.operation.startsWith("assignment.")) {
            await session.call("authorize", {});
            let org = d.organisationId;
            if (change.operation === "assignment.status")
              org = (
                await session.call("assignment.reference", {
                  assignmentId: d.assignmentId,
                })
              ).organisationId;
            const verified = await scope.lockOrganisation(id(org));
            d.organisationVersion = Number(verified.version);
          }
          return session.call(change.operation, {
            requestId: change.requestId,
            data: d,
          });
        }),
      );
      return json(res, 200, data);
    } catch (e) {
      const err = e as { code?: string };
      const f =
        e instanceof Fault
          ? e
          : err.code === "23514"
            ? new Fault(400, "CANONICAL_ORGANISATION_REQUIRED")
            : new Fault(503, "SERVICE_UNAVAILABLE");
      if (f.status >= 500)
        console.error(
          JSON.stringify({
            event: "limits_request_failed",
            requestId,
            code: f.code,
          }),
        );
      return json(res, f.status, { error: f.code, requestId });
    }
  };
}
async function main() {
  const c = configuration();
  const limits = new Pool(c.limits),
    identity = new Pool(c.identity);
  const store = new Store(limits, c.commandKey);
  const health = async () => {
    const [l, i] = await Promise.all([
      store.health(),
      identity.query("SELECT profitia_limits_identity_read.descriptor() AS d"),
    ]);
    if (
      l.schemaDigest !== c.limitsDigest ||
      i.rows[0].d.schemaDigest !== c.identityDigest ||
      l.commandKeyFingerprint !==
        createHash("sha256").update(c.commandKey).digest("hex") ||
      l.branchId !== "br-green-hall-b9s837k0" ||
      i.rows[0].d.branchId !== "br-sparkling-term-b99l107x"
    )
      throw Error("PHYSICAL_BINDING_UNAVAILABLE");
  };
  await health();
  const server = http.createServer(
    createHandler({
      config: c,
      store,
      withIdentity: identityBoundary(c, identity),
      health,
    }),
  );
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxRequestsPerSocket = 100;
  server.listen(c.port, "0.0.0.0", () =>
    console.log(
      JSON.stringify({
        event: "limits_started",
        environment: "development",
        sourceSha: c.sourceSha,
      }),
    ),
  );
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    server.close(() => {
      void Promise.all([limits.end(), identity.end()]).then(() =>
        process.exit(0),
      );
    });
    setTimeout(() => process.exit(1), 25000).unref();
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(() => {
    console.error("LIMITS_STARTUP_FAILED");
    process.exitCode = 1;
  });
