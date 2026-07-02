// PCOS Cognition Explorer — Observability Service
// Architecture-ready metrics layer for the Explorer runtime.
//
// Design goals:
//   1. Zero external dependencies — collects metrics in-process
//   2. Architecture-ready — structured for future telemetry stack integration
//      (OpenTelemetry, Datadog, Prometheus, etc.)
//   3. Minimal overhead — metrics recorded as append-only events
//   4. Server-side only — runs in Next.js server context
//
// Future integration points (NOT implemented — placeholder contracts):
//   - OTEL_EXPORTER_OTLP_ENDPOINT → OpenTelemetry OTLP export
//   - PCOS_METRICS_ENDPOINT → internal PCOS telemetry receiver
//   - HydrationTelemetryEvent model → runtime DB sink

// ── Metric event types ───────────────────────────────────────────────────────

export type MetricEventKind =
  | "query_executed"
  | "query_failed"
  | "render_completed"
  | "render_failed"
  | "platform_health_computed"
  | "lineage_resolved"
  | "domain_loaded";

export interface MetricEvent {
  kind: MetricEventKind;
  domainId: string;
  durationMs: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ── Query metrics ────────────────────────────────────────────────────────────

export interface QueryMetrics {
  domainId: string;
  /** Total executions recorded */
  totalExecutions: number;
  /** Successful executions */
  successCount: number;
  /** Failed executions */
  errorCount: number;
  /** Error rate 0.0–1.0 */
  errorRate: number;
  /** Average duration (ms) */
  avgDurationMs: number;
  /** p95 duration (ms) */
  p95DurationMs: number;
  /** p99 duration (ms) */
  p99DurationMs: number;
  /** Most recent execution timestamp */
  lastExecutedAt: Date | null;
}

// ── Renderer metrics ─────────────────────────────────────────────────────────

export interface RendererMetrics {
  domainId: string;
  totalRenders: number;
  failedRenders: number;
  emptyResultRenders: number;
  avgRenderDurationMs: number;
  lastRenderedAt: Date | null;
}

// ── Platform metrics ─────────────────────────────────────────────────────────

export interface PlatformMetrics {
  snapshotAt: Date;
  totalQueriesExecuted: number;
  totalRenderedViews: number;
  totalErrors: number;
  /** Per-domain query metrics */
  queryMetrics: Record<string, QueryMetrics>;
  /** Per-domain renderer metrics */
  rendererMetrics: Record<string, RendererMetrics>;
}

// ── In-process metrics store ─────────────────────────────────────────────────
// Singleton — lives in Node.js module cache.
// Not persisted across restarts. Suitable for dev + short-lived observability.
// Production: emit events to telemetry backend instead.

const _events: MetricEvent[] = [];
const _queryDurations: Record<string, number[]> = {};
const _renderDurations: Record<string, number[]> = {};

function _percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Record a completed domain query */
export function recordQueryExecution(
  domainId: string,
  durationMs: number,
  success: boolean,
  metadata?: Record<string, unknown>
): void {
  _events.push({
    kind: success ? "query_executed" : "query_failed",
    domainId,
    durationMs,
    timestamp: new Date(),
    metadata,
  });
  if (!_queryDurations[domainId]) _queryDurations[domainId] = [];
  if (success) _queryDurations[domainId].push(durationMs);
}

/** Record a completed renderer invocation */
export function recordRenderCompletion(
  domainId: string,
  durationMs: number,
  isEmpty: boolean,
  success: boolean
): void {
  _events.push({
    kind: success ? "render_completed" : "render_failed",
    domainId,
    durationMs,
    timestamp: new Date(),
    metadata: { isEmpty },
  });
  if (!_renderDurations[domainId]) _renderDurations[domainId] = [];
  if (success) _renderDurations[domainId].push(durationMs);
}

/** Get query metrics for a specific domain */
export function getQueryMetrics(domainId: string): QueryMetrics {
  const allEvents = _events.filter((e) => e.domainId === domainId);
  const successEvents = allEvents.filter((e) => e.kind === "query_executed");
  const errorEvents = allEvents.filter((e) => e.kind === "query_failed");
  const durations = [...(_queryDurations[domainId] ?? [])].sort((a, b) => a - b);
  const total = successEvents.length + errorEvents.length;

  return {
    domainId,
    totalExecutions: total,
    successCount: successEvents.length,
    errorCount: errorEvents.length,
    errorRate: total > 0 ? errorEvents.length / total : 0,
    avgDurationMs:
      durations.length > 0
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
        : 0,
    p95DurationMs: _percentile(durations, 95),
    p99DurationMs: _percentile(durations, 99),
    lastExecutedAt:
      allEvents.length > 0 ? allEvents[allEvents.length - 1].timestamp : null,
  };
}

/** Get renderer metrics for a specific domain */
export function getRendererMetrics(domainId: string): RendererMetrics {
  const renderEvents = _events.filter(
    (e) =>
      e.domainId === domainId &&
      (e.kind === "render_completed" || e.kind === "render_failed")
  );
  const failedEvents = renderEvents.filter((e) => e.kind === "render_failed");
  const emptyEvents = renderEvents.filter(
    (e) => e.kind === "render_completed" && e.metadata?.isEmpty === true
  );
  const durations = [...(_renderDurations[domainId] ?? [])].sort(
    (a, b) => a - b
  );

  return {
    domainId,
    totalRenders: renderEvents.length,
    failedRenders: failedEvents.length,
    emptyResultRenders: emptyEvents.length,
    avgRenderDurationMs:
      durations.length > 0
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
        : 0,
    lastRenderedAt:
      renderEvents.length > 0
        ? renderEvents[renderEvents.length - 1].timestamp
        : null,
  };
}

/** Get full platform metrics snapshot */
export function getPlatformMetrics(): PlatformMetrics {
  const domainIds = [
    ...new Set(_events.map((e) => e.domainId).filter(Boolean)),
  ];

  const queryMetrics: Record<string, QueryMetrics> = {};
  const rendererMetrics: Record<string, RendererMetrics> = {};
  for (const id of domainIds) {
    queryMetrics[id] = getQueryMetrics(id);
    rendererMetrics[id] = getRendererMetrics(id);
  }

  return {
    snapshotAt: new Date(),
    totalQueriesExecuted: _events.filter(
      (e) => e.kind === "query_executed" || e.kind === "query_failed"
    ).length,
    totalRenderedViews: _events.filter(
      (e) => e.kind === "render_completed" || e.kind === "render_failed"
    ).length,
    totalErrors: _events.filter(
      (e) => e.kind === "query_failed" || e.kind === "render_failed"
    ).length,
    queryMetrics,
    rendererMetrics,
  };
}

// ── Instrumented query wrapper ───────────────────────────────────────────────
// Use this to wrap any domain query to automatically collect metrics.

export async function withQueryMetrics<T>(
  domainId: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    recordQueryExecution(domainId, durationMs, true);
    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    recordQueryExecution(domainId, durationMs, false, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ── Future telemetry integration point ──────────────────────────────────────
// When ready to connect a telemetry backend, implement this interface:
//
// export interface TelemetryExporter {
//   export(events: MetricEvent[]): Promise<void>;
// }
//
// Call: await exporter.export(_events.splice(0))  // drain and export
//
// Supported backends (not yet implemented):
//   - OpenTelemetry OTLP: https://opentelemetry.io/docs/specs/otlp/
//   - PCOS HydrationTelemetryEvent → runtime DB
//   - Prometheus push gateway
