import { Pool } from "pg";
import { createCurrentE1OperationHost } from "@profitia/platform-current-e1-authority";
import { createServiceReadHost } from "@profitia/platform-contracts/private-operation-host";
import { createPlatformIngestionHost } from "@profitia/platform-contracts/platform-ingestion";
import { createExternalCallHost } from "@profitia/platform-contracts/external-call";
import { createInsightsRuntime } from "./runtime.mjs";
import { PostgresReportStore } from "./store.mjs";
import { createHubSources, createCanonicalReads } from "./source-adapters.mjs";
import { createComposer, qualityGate } from "./composer.mjs";
import { createRenderer } from "./renderer.mjs";
import { telemetry } from "./telemetry.mjs";
import { assertProfile, assertContext, requireThat, digest, OPERATIONS } from "@profitia/insights-contracts";

const operations = Object.values(OPERATIONS);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const product = { projectId: "autumn-waterfall-65938876", branchId: "br-dry-hall-b294222f", databaseName: "neondb" };
const central = { projectId: "spring-bread-28217539", branchId: "br-sparkling-term-b99l107x", databaseName: "platform_private" };
const runtimeBinding = ({ hosts, ...binding } = {}) => binding;

// Configuration is deployment-owned. The browser supplies no organisation,
// profile privileges, database, source, authority origin or model credential.
export function readInsightsConfiguration(env = process.env) {
  requireThat(env.INSIGHTS_REPORTS_ENABLED === "true", "INSIGHTS_NOT_ENABLED", 503);
  let c;
  try { c = JSON.parse(env.INSIGHTS_CONFIGURATION_JSON); } catch { throw Error("INSIGHTS_CONFIGURATION_REQUIRED"); }
  requireThat(c.environment === "development" && c.enabled === true && c.authorityDecisionRef &&
    env.APP_ENV === "development" && env.RENDER_SERVICE_ID === "srv-dapa3tid0e5s73f8bc5g" &&
    /^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT ?? "") && UUID.test(c.organisationId), "INVALID_DEVELOPMENT_BINDING");
  for (const p of Object.values(c.profiles)) assertProfile(p);
  for (const b of [c.composerBinding, c.counterBinding])
    requireThat(Object.entries(product).every(([k,v]) => b?.[k] === v), "WRONG_PRODUCT_DATABASE");
  for (const b of [c.workerBinding,c.receiverBinding,c.serviceBinding])
    requireThat(Object.entries(central).every(([k,v]) => b?.[k] === v), "WRONG_PRIVATE_DATABASE");
  requireThat(c.receiverApplication.environment === "development" && c.serviceApplication.environment === "development" &&
    c.receiverApplication.operations.join() === operations.join() && c.serviceApplication.operations.join() === operations.join() &&
    c.receiverApplication.features.join() === "market" && c.serviceApplication.features.join() === "market" &&
    c.hub.targetOrigin === "https://source-hub-development.onrender.com", "INVALID_INSIGHTS_ADMISSION");
  requireThat([c.receiverApplication,c.serviceApplication,c.readApplication,c.sourceApplication].every(a =>
    a?.deploymentId === env.RENDER_GIT_COMMIT), "EXACT_DEPLOYED_SOURCE_BINDING_REQUIRED");
  for (const [b, key] of [[c.workerBinding,"INSIGHTS_DATABASE_URL"],[c.receiverBinding,"INSIGHTS_RECEIVER_DATABASE_URL"],
    [c.serviceBinding,"INSIGHTS_E1_DATABASE_URL"],[c.composerBinding,"INSIGHTS_COMPOSER_DATABASE_URL"],[c.counterBinding,"INSIGHTS_COUNTER_DATABASE_URL"]]) {
    const u = new URL(env[key] ?? "invalid:");
    requireThat(["postgresql:","postgres:"].includes(u.protocol) && u.username === b.role && u.password &&
      !/owner|admin/i.test(u.username) && b.hosts.includes(u.hostname) && u.pathname === "/" + b.databaseName &&
      (!u.port || u.port === "5432") && !u.hash && u.searchParams.get("sslmode") === "require" &&
      [...u.searchParams.keys()].every(k => ["sslmode","channel_binding"].includes(k)), "ORDINARY_RUNTIME_URL_REQUIRED");
  }
  requireThat(env.INSIGHTS_SIGNING_PRIVATE_KEY && env.INSIGHTS_OPENAI_API_KEY &&
    c.openai?.projectId && digest(env.INSIGHTS_OPENAI_API_KEY) === c.openai.keySha256, "APPROVED_CREDENTIAL_BINDING_REQUIRED");
  return c;
}

export function pgPorts(pool) {
  return {
    independentQuery: pool.query.bind(pool),
    async transact(action, { timeoutMs = 15000, maxWaitMs = 3000 } = {}) {
      const client = await pool.connect();
      let expired = false;
      const timer = setTimeout(() => { expired = true; client.release(true); }, timeoutMs);
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)", [String(timeoutMs), String(maxWaitMs)]);
        const value = await action({ query: client.query.bind(client), transaction: client });
        requireThat(!expired, "TRANSACTION_DEADLINE");
        await client.query("COMMIT");
        return value;
      } catch (e) {
        if (!expired) await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally { clearTimeout(timer); if (!expired) client.release(); }
    },
  };
}
export function compactContext(c) {
  return assertContext({ environment: c.environment, organisationId: c.organisationId,
    actorId: c.actor.kind === "SERVICE" ? c.actor.serviceId : c.actor.userId,
    actorKind: c.actor.kind, decisionId: c.decisionId,
    expiresAt: new Date(Math.min(Date.now() + 15000, Date.parse(c.actor.expiresAt),
      ...(c.productEvidence ?? []).map(p => Date.parse(p.expiresAt)))).toISOString() });
}
export async function packResponse(response) {
  requireThat(response instanceof Response, "REPORT_RESPONSE_REQUIRED");
  const bytes = Buffer.from(await response.arrayBuffer());
  requireThat(bytes.length <= 20971520, "REPORT_RESPONSE_TOO_LARGE");
  return { status: response.status, headers: [...response.headers], body: bytes.toString("base64") };
}
export function unpackResponse(value) {
  return new Response(Buffer.from(value.body, "base64"), { status: value.status, headers: value.headers });
}
export function createHumanReportAuthority({ configuration: c, receiver, store, hostFactory = createCurrentE1OperationHost }) {
  const host = hostFactory({ application: c.receiverApplication, binding: runtimeBinding(c.receiverBinding), ...receiver,
    readResources: async ({ request, scope }) => ({ resource: { id: request.resourceId, type: "insights_report",
      dataClass: "ORGANISATION_PRIVATE", environment: "development", ownerOrganisationId: scope.organisationId,
      ownerUserId: null, version: "1", projectionVersion: "insights-report-v1" } }),
    projectOutput: value => value });
  return async ({ request, operation, resourceId }, action) => {
    const result = await host.execute({ request, operation, resourceId, organisationId: c.organisationId,
      contractId: host.contract.id, contractVersion: host.contract.version, payload: null },
      (ctx, transaction) => store.withClient(ctx.organisationId, transaction, async () => packResponse(await action(compactContext(ctx)))));
    return unpackResponse(result.value);
  };
}

/** Concrete host in the existing SG Runtime. Canonical ports are its accepted
 * read-only Market Data / Forecast readers, not a second database reader. */
export async function createInstalledInsightsRuntime({ env = process.env, canonicalPorts, monitoring = {}, python }) {
  const c = readInsightsConfiguration(env);
  const openaiKey = env.INSIGHTS_OPENAI_API_KEY;
  requireThat(typeof python === "string" && python.startsWith("/"), "DETERMINISTIC_PYTHON_REQUIRED");
  const { createCurrentE1ReportServiceHost } = await import("@profitia/platform-current-e1-authority/insights-service");
  const pools = new Map();
  const make = key => { const p = new Pool({ connectionString: env[key], max: 2, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000, application_name: "sg2-insights" }); pools.set(key,p); return p; };
  try {
    const e1 = pgPorts(make("INSIGHTS_E1_DATABASE_URL"));
    const service = createCurrentE1ReportServiceHost({ application: c.serviceApplication, binding: runtimeBinding(c.serviceBinding),
      query: e1.independentQuery, transact: e1.transact });
    const current = org => service.execute({ operation: OPERATIONS.start, organisationId: org, resourceId: "oil-asphalt", payload: null }, compactContext);
    const store = new PostgresReportStore(make("INSIGHTS_DATABASE_URL"), { authorizeTransaction: current });
    const workerPool = pools.get("INSIGHTS_DATABASE_URL");
    const installation = (await workerPool.query("SELECT insights_private.runtime_descriptor() AS descriptor")).rows[0]?.descriptor;
    requireThat(installation && Object.entries(c.workerBinding).filter(([k])=>k!=="hosts").every(([k,v]) => installation[k] === v), "INSIGHTS_STORE_NOT_INSTALLED");
    const authority = {
      execute: createHumanReportAuthority({ configuration: c, receiver: pgPorts(make("INSIGHTS_RECEIVER_DATABASE_URL")), store }),
      async authorizeJob(job) {
        const context = await current(job.organisationId), p = await service.claimProfile(job);
        requireThat(p, "WAITING_AUTHORIZATION");
        return { context, ...p };
      },
      async schedulerContext(definition) {
        requireThat(definition.organisationId === c.organisationId, "SCHEDULE_ORGANISATION_NOT_ADMITTED");
        return current(definition.organisationId);
      },
      async workerContexts() {
        const entries = await service.organisations();
        const unique = [...new Set(entries.map(x => x.organisationId))];
        return Promise.all(unique.map(current));
      },
    };
    const grants = { async current(org, provider, family) {
      return (await e1.independentQuery("SELECT profitia_services.report_source_grant($1::uuid,$2) AS grant", [org, `api.${provider}.${family}`])).rows[0]?.grant ?? null;
    }};
    // Each durable projection needs an owner-admitted current licence snapshot.
    // Expired/absent coverage admits no facts; Hub still checks current licence.
    const projectionPolicy = async ({ provider, family, metadata }) => {
      const p = c.projections.find(p => p.provider === provider && p.family === family && p.status === "ACTIVE" &&
        p.allowReportFacts === true && Date.parse(p.expiresAt) > Date.now() && p.licenceRef === metadata.licenceRef);
      return p ? { allowReportFacts: true, basisRef: p.basisRef } : null;
    };
    const sources = createHubSources({ configuration: { ...c.hub, privateKey: env.INSIGHTS_SIGNING_PRIVATE_KEY }, grants, projectionPolicy });
    requireThat(canonicalPorts && typeof canonicalPorts.marketRead === "function" && typeof canonicalPorts.forecastRead === "function", "CANONICAL_READ_PORTS_REQUIRED");
    const readHost = createServiceReadHost({ application: c.readApplication, binding: runtimeBinding(c.serviceBinding), ...e1,
      readResources: async ({ request }) => ({ resource: { id: request.resourceId,
        type: request.operation === "forecast.read" ? "market_forecast" : "market_knowledge", dataClass: "SHARED_KNOWLEDGE",
        environment: "development", ownerOrganisationId: null, ownerUserId: null,
        approvedSharedProjection: true, version: "1", projectionVersion: "insights-canonical-read-v1" } }), projectOutput: v => v });
    const read = async (operation, input, port) => (await readHost.execute({ contractId: readHost.contract.id, contractVersion: readHost.contract.version,
      operation, organisationId: input.organisationId, resourceId: input.seriesId, payload: null }, async ctx => {
        const result = await port(input);
        return result && { ...result, receiptRef: ctx.decisionId };
      })).value;
    const canonical = createCanonicalReads({ marketRead: input => read("knowledge.read", input, canonicalPorts.marketRead),
      forecastRead: input => read("forecast.read", input, canonicalPorts.forecastRead) });
    const sourcePools = { composer: pgPorts(make("INSIGHTS_COMPOSER_DATABASE_URL")), counter: pgPorts(make("INSIGHTS_COUNTER_DATABASE_URL")) };
    const sourceHost = async (kind, { job, prepared, counter }) => {
      const ports = sourcePools[kind], b = runtimeBinding(c[kind + "Binding"]), model = kind === "composer";
      const body = model ? prepared.body : prepared.counterBody;
      const attempt = (await ports.independentQuery("SELECT profitia_report_model.prepare_attempt($1,$2) AS attempt", [job.businessKey, digest(body)])).rows[0]?.attempt;
      requireThat(attempt && attempt.profileId === job.profile.id, "SOURCE_ATTEMPT_NOT_ADMITTED");
      const root = createPlatformIngestionHost({ ...ports, application: c.sourceApplication, binding: b,
        source: { id: attempt.sourceId, payloadSchema: "external-call-control-v1", qualityVersion: "sg2-source-control-v1", classificationVersion: "technical-source-control-v1" },
        validateSharedPayload: v => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).sort().join() === "action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status" });
      const paths = [{ method: "POST", path: model ? "/v1/responses" : "/v1/responses/input_tokens" }];
      return createExternalCallHost({ sourceHost: root, sourceId: attempt.sourceId, resourceId: attempt.resourceId,
        binding: { role: b.role, configurationVersion: attempt.configurationVersion, schemaDigest: c.schemas.externalCall,
          origin: "https://api.openai.com", transport: "HTTPS", pathRules: paths },
        nativeTransport: { schemaDigest: c.schemas.native, pathRules: paths.map(p => ({ ...p, requestFormat: "JSON" })),
          redirectOrigins: [], maximumResponseBytes: model ? 4000000 : 65536, credentialMode: "SERVER_HEADERS", completionMode: "ADMITTED_ATTEMPT_CURRENT_SETTLEMENT" },
        ...(model ? { modelExecution: { schemaDigest: c.schemas.model, profileId: job.profile.id, model: job.profile.model,
          maximumInputTokens: job.profile.maximumInputTokens, maximumOutputTokens: job.profile.maximumOutputTokens,
          maximumBodyBytes: job.profile.maximumBodyBytes, reservationMicroUsd: attempt.reservationMicroUsd, timeoutMs: job.profile.timeoutMs },
          countModelInputTokens: () => counter.inputTokens } : {}),
        independentQuery: ports.independentQuery, query: (tx,sql,values) => tx.query(sql,values),
        parseCommand: v => { requireThat(v && v.body === body && UUID.test(v.callId), "EXACT_REQUEST_REQUIRED"); return { body, callId: v.callId }; },
        buildRequest: () => ({ method: "POST", url: "https://api.openai.com" + paths[0].path, body }),
        getHeaders: command => ({ authorization: "Bearer " + openaiKey, "x-client-request-id": command.callId }) });
    };
    const runtime = createInsightsRuntime({ configuration: c, store, authority, sources, canonical,
      composer: createComposer({ counterHost: x => sourceHost("counter",x), generationHost: x => sourceHost("composer",x), pricing: c.pricing }),
      quality: qualityGate, renderer: createRenderer({ python }), telemetry: telemetry(monitoring),
      onError: code => monitoring.capture?.(new Error(code), { environment: "development" }) });
    return Object.assign(runtime, { async close() { runtime.stop(); await Promise.all([...pools.values()].map(p=>p.end())); } });
  } catch (e) { await Promise.all([...pools.values()].map(p=>p.end())); throw e; }
}
