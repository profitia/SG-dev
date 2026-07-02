import type { RendererProps } from "@/registry/renderer-registry";
import type { HydrationQueryResult } from "@/domains/hydration/query";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { formatDistanceToNow } from "date-fns";

const STAGE_ORDER = [
  "H2_SNOWFLAKE_CONNECTIVITY",
  "H3_LAB_HYDRATION",
  "H4_COGNITION_VALIDATION",
  "H5_COGNITION_PROMOTION",
  "H6_SANDBOX_ORCHESTRATION",
];

function runDurationMs(run: {
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
}): string {
  const end = run.completedAt ?? run.failedAt;
  if (!run.startedAt || !end) return "—";
  const ms = end.getTime() - run.startedAt.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function HydrationRenderer({ data }: RendererProps) {
  const { runs } = data as HydrationQueryResult;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Hydration Lineage"
        description="History of all PCOS hydration runs — the lifecycle events that generated the current cognition substrate."
      />

      <div className="p-6 space-y-6">
        {runs.length === 0 ? (
          <EmptyState
            title="No hydration runs found"
            description="Run the PCOS-H3 pipeline to begin hydrating cognition."
          />
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <div
                key={run.id}
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={run.status} />
                    <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                      {run.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="muted">{run.environment}</Badge>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {run.createdAt ? formatDistanceToNow(run.createdAt, { addSuffix: true }) : "—"}
                    </span>
                  </div>
                </div>

                <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {STAGE_ORDER.map((stage) => {
                      const isActive = run.stage === stage;
                      const stageIdx = STAGE_ORDER.indexOf(stage);
                      const activeIdx = STAGE_ORDER.indexOf(run.stage);
                      const isDone = stageIdx < activeIdx;
                      return (
                        <div key={stage} className="flex items-center gap-1 shrink-0">
                          <span
                            className={[
                              "rounded px-2 py-0.5 font-mono text-[10px]",
                              isActive
                                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold"
                                : isDone
                                ? "bg-[hsl(142_71%_15%)] text-[hsl(142_71%_65%)]"
                                : "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]",
                            ].join(" ")}
                          >
                            {stage.replace("_", " ")}
                          </span>
                          {stageIdx < STAGE_ORDER.length - 1 && (
                            <span className="text-[hsl(var(--border))]">→</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {run.currentPhase && (
                    <p className="mt-1.5 font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                      Phase: <span className="text-[hsl(var(--foreground))]">{run.currentPhase}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] sm:grid-cols-8">
                  {[
                    { label: "Records", value: run.recordsProcessed.toLocaleString() },
                    { label: "Duration", value: runDurationMs(run) },
                    { label: "Ontology", value: run._count.ontologyNodes.toLocaleString() },
                    { label: "Memory", value: run._count.cognitionMemory.toLocaleString() },
                    { label: "Intel", value: run._count.intelligenceUnits.toLocaleString() },
                    { label: "Retrieval", value: run._count.retrievalDocuments.toLocaleString() },
                    { label: "Embed", value: run._count.embeddingRecords.toLocaleString() },
                    { label: "Events", value: run._count.lineageEvents.toLocaleString() },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-3 py-2">
                      <p className="text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        {label}
                      </p>
                      <p className="mt-0.5 font-mono text-xs font-medium text-[hsl(var(--foreground))]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {run.errorMessage && (
                  <div className="border-t border-[hsl(var(--border))] bg-[hsl(0_84%_8%)] px-4 py-2">
                    <p className="font-mono text-[11px] text-[hsl(0_84%_65%)]">
                      {run.errorMessage}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
