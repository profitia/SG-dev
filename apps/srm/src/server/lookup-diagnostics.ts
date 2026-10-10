import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type LookupStage = "search" | "organization_context" | "lookup_registration" | "cache_read" | "provider_retrieval" | "source_archive" | "snapshot_persistence" | "projection_persistence" | "financial_persistence" | "attempt_persistence" | "catalog_persistence" | "report_assembly" | "retention_cleanup" | "lease_acquisition" | "tenant_persistence" | "cache_persistence" | "response_preparation" | "vercly_post" | "vercly_get" | "poll_wait" | "mapping";
type Section = "general" | "financial" | "jdg" | "kys";
type Provider = "MGBI" | "CEIDG" | "VERCLY";
type Diagnostics = { requestId: string; timings: Record<string, { ms: number; count: number }>; mode?: "PROVIDER" | "CACHE" | "FOLLOWER"; outcome?: string };
const context = new AsyncLocalStorage<Diagnostics>();
export const lookupRequestId = () => context.getStore()?.requestId;
export function kysMode(mode: Diagnostics["mode"]) { const value = context.getStore(); if (value) value.mode = mode; }
export function kysOutcome(status: string, code: string | null = null) {
  const value = context.getStore(); if (value && !(status === "ERROR" && !code && value.outcome === "TIMEOUT")) value.outcome = code?.includes("TIMEOUT") || code?.includes("NOT_READY") ? "TIMEOUT" : status === "ERROR" ? "ERROR" : status;
}
export async function measureLookup<T>(stage: LookupStage, action: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try { return await action(); } finally {
    const value = context.getStore();
    if (value) { const previous = value.timings[stage] ?? { ms: 0, count: 0 }; previous.ms += performance.now() - started; previous.count++; value.timings[stage] = previous; }
  }
}
/** Request-local counters only. Neither provider IDs nor report content enter telemetry. */
export async function withKysDiagnostics(action: () => Promise<Response>, signal: AbortSignal): Promise<Response> {
  const value: Diagnostics = { requestId: randomUUID(), timings: {} };
  const started = performance.now(); let status = 500;
  return context.run(value, async () => {
    try {
      const response = await action(); status = response.status;
      response.headers.set("X-SRM-Request-Id", value.requestId);
      response.headers.set("X-SRM-KYS-Mode", value.mode ?? "UNAVAILABLE");
      response.headers.set("Server-Timing", ["total;dur=" + (performance.now() - started).toFixed(3), ...Object.entries(value.timings).map(([key, timing]) => key + ";dur=" + timing.ms.toFixed(3))].join(", "));
      return response;
    } finally {
      console.info(JSON.stringify({ event: "srm_kys_timing", ...base(), mode: value.mode ?? "UNAVAILABLE", outcome: signal.aborted ? "ABORTED" : status >= 400 ? value.outcome === "TIMEOUT" ? "TIMEOUT" : "ERROR" : value.outcome ?? "SUCCESS", httpStatus: status, totalMs: Number((performance.now() - started).toFixed(3)), stages: value.timings }));
    }
  });
}

export class LookupStageError extends Error {
  constructor(readonly stage: LookupStage, cause: unknown, readonly section?: Section) {
    super("SRM lookup stage failed", { cause });
  }
}

export function withLookupDiagnostics<T>(action: () => Promise<T>): Promise<T> {
  return context.getStore() ? action() : context.run({ requestId: randomUUID(), timings: {} }, action);
}

export async function atLookupStage<T>(stage: LookupStage, action: () => Promise<T>, section?: Section): Promise<T> {
  try { return await measureLookup(stage, action); } catch (error) {
    if (error instanceof LookupStageError) throw error;
    throw new LookupStageError(stage, error, section);
  }
}

const providerCodes = new Set(["NOT_CONFIGURED", "TIMEOUT", "NETWORK_ERROR", "FETCH_ERROR", "INVALID_JSON", "INVALID_RESPONSE", "INVALID_REPORT", "IDENTIFIER_MISMATCH", "CORRELATION_MISMATCH", "INVALID_CORRELATION_ID", "RESULT_LIMIT", "INCOMPLETE_RESPONSE", "POLLING_TIMEOUT", "MAPPING_ERROR", "POST_OUTCOME_UNKNOWN", "ABORTED"]);
export function safeProviderCode(code: unknown): string {
  const normalized = typeof code === "string" ? code.replace(/^(MGBI|VERCLY|CEIDG)_/, "") : "";
  if (normalized === "REPORT_NOT_READY") return "POLLING_TIMEOUT";
  return providerCodes.has(normalized) || /^HTTP_[1-5]\d{2}$/.test(normalized) ? normalized : "UNKNOWN_PROVIDER_ERROR";
}

export function providerExceptionCode(error: unknown): string {
  if (error instanceof Error && error.message === "MGBI_API_KEY is required") return "NOT_CONFIGURED";
  if (error instanceof SyntaxError) return "INVALID_JSON";
  return error instanceof Error ? safeProviderCode(error.message) : "UNKNOWN_PROVIDER_ERROR";
}

function category(code: string, constraint?: string): string {
  if (code === "42501") return "DATABASE_PERMISSION";
  if (code === "23514") return constraint ? "FINANCIAL_CONSTRAINT" : "DATABASE_CONSTRAINT";
  if (code.startsWith("23")) return "DATABASE_INTEGRITY";
  if (code === "HTTP_401") return "PROVIDER_AUTHENTICATION";
  if (code === "HTTP_403") return "PROVIDER_ENTITLEMENT";
  if (code === "HTTP_429") return "PROVIDER_RATE_LIMIT";
  if (code.includes("TIMEOUT")) return "PROVIDER_TIMEOUT";
  if (code === "NOT_CONFIGURED") return "PROVIDER_CONFIGURATION";
  if (["INVALID_JSON", "INVALID_RESPONSE", "INVALID_REPORT", "MAPPING_ERROR", "IDENTIFIER_MISMATCH", "CORRELATION_MISMATCH", "SERIALIZATION_ERROR"].includes(code)) return "SERIALIZATION_OR_MAPPING";
  if (/^[0-9A-Z]{5}$/.test(code)) return "DATABASE_ERROR";
  return "LOOKUP_ERROR";
}

export function sanitizedLookupFailure(error: unknown) {
  const staged = error instanceof LookupStageError ? error : null;
  const cause = staged ? staged.cause : error;
  const record = cause && typeof cause === "object" ? cause as Record<string, unknown> : {};
  const sqlCodes = new Set(["42501", "23514", "23503", "23505", "23502", "22P02", "22003", "40001", "40P01", "53300", "53400", "57014", "57P01", "08001", "08003", "08006", "28P01", "3D000", "42P01", "42703", "25P02"]);
  const sqlstate = typeof record.code === "string" && sqlCodes.has(record.code) ? record.code : undefined;
  const code = sqlstate ?? (cause instanceof SyntaxError || cause instanceof TypeError ? "SERIALIZATION_ERROR" : "PERSISTENCE_ERROR");
  // PostgreSQL detail, message, query and values can contain personal/provider data.
  // Only known schema constraint names and the SQLSTATE cross the logging boundary.
  const constraint = typeof record.constraint === "string" && ["financial_facts_verified_cost_magnitude_check", "catalog_financial_facts_verified_cost_magnitude_check"].includes(record.constraint) ? record.constraint : undefined;
  return { stage: staged?.stage ?? "search", section: staged?.section, code, category: category(code, constraint), sqlstate, constraint };
}

function base() {
  const environment = process.env.TARGET_ENVIRONMENT;
  return { environment: environment === "development" || environment === "staging" ? environment : "unavailable", requestId: context.getStore()?.requestId ?? randomUUID() };
}

export function logLookupFailure(error: unknown): void {
  console.error(JSON.stringify({ event: "srm_lookup_failure", ...base(), ...sanitizedLookupFailure(error) }));
}

export function logProviderOutcome(provider: Provider, section: Section, status: string, errorCode: string | null, method: "PROVIDER" | "CACHE" = "PROVIDER"): void {
  const code = errorCode ? safeProviderCode(errorCode) : null;
  const safeStatus = ["SUCCESS", "PARTIAL", "EMPTY", "ERROR", "PENDING", "NOT_REQUESTED"].includes(status) ? status : "ERROR";
  const diagnostic = { event: "srm_provider_outcome", ...base(), stage: "provider_retrieval", provider, section, status: safeStatus, method, code, category: code ? category(code) : null };
  if (code) console.error(JSON.stringify(diagnostic)); else console.info(JSON.stringify(diagnostic));
}
