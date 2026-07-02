import type { RendererProps } from "@/registry/renderer-registry";
import type { ValidationQueryResult } from "@/domains/validation/query";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ui/confidence-bar";
import { EmptyState } from "@/components/ui/misc";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const DIMENSION_WEIGHTS: Record<string, number> = {
  ER_QUALITY: 20,
  ONTOLOGY_CONSISTENCY: 20,
  RETRIEVAL_PRECISION: 15,
  GRAPH_CONSISTENCY: 15,
  INTELLIGENCE_CONFIDENCE: 15,
  EMBEDDINGS_COVERAGE: 10,
  BENCHMARK_STABILITY: 5,
};

export function ValidationRenderer({ data }: RendererProps) {
  const { runs } = data as ValidationQueryResult;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Cognition Validation"
        description="H4 validation runs — 7-dimension quality assessment of the PCOS cognition substrate. Promotion gate for LAB → PROD."
      />

      <div className="p-6 space-y-6">
        {runs.length === 0 ? (
          <EmptyState
            title="No validation runs found"
            description="Run the PCOS-H4 validation pipeline to evaluate cognition quality."
          />
        ) : (
          <div className="space-y-4">
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
                    <Badge variant="muted">{run.environment}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    {run.isPromotionReady ? (
                      <div className="flex items-center gap-1 text-[hsl(142_71%_55%)]">
                        <CheckCircle2 size={13} />
                        <span className="text-[11px]">Promotion Ready</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                        <XCircle size={13} />
                        <span className="text-[11px]">Not Ready</span>
                      </div>
                    )}
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {formatDistanceToNow(run.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[hsl(var(--border))]">
                  <div className="p-4">
                    <p className="mb-3 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                      Quality Dimensions
                    </p>
                    {run.qualityScores.length > 0 ? (
                      <div className="space-y-0.5">
                        {run.qualityScores
                          .sort(
                            (a, b) =>
                              (DIMENSION_WEIGHTS[b.dimension] ?? 0) -
                              (DIMENSION_WEIGHTS[a.dimension] ?? 0)
                          )
                          .map((score) => (
                            <ScoreGauge
                              key={score.id}
                              label={`${score.dimension} (${DIMENSION_WEIGHTS[score.dimension] ?? "?"}%)`}
                              score={score.score * 100}
                            />
                          ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No quality scores recorded</p>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    {run.maturityScore ? (
                      <div>
                        <p className="mb-2 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                          Maturity Score
                        </p>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-3xl font-semibold tabular-nums text-[hsl(var(--foreground))]">
                            {Math.round(run.maturityScore.overallScore)}
                          </span>
                          <span className="text-sm text-[hsl(var(--muted-foreground))]">/100</span>
                          <Badge variant="muted">{run.maturityScore.maturityClass}</Badge>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
                          <div
                            className="h-full rounded-full bg-[hsl(var(--primary))]"
                            style={{ width: `${run.maturityScore.overallScore}%` }}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-0.5">
                          {[
                            { label: "ER", value: run.maturityScore.erScore },
                            { label: "Ontology", value: run.maturityScore.ontologyScore },
                            { label: "Retrieval", value: run.maturityScore.retrievalScore },
                            { label: "Embeddings", value: run.maturityScore.embeddingsScore },
                            { label: "Intelligence", value: run.maturityScore.intelligenceScore },
                            { label: "Graph", value: run.maturityScore.graphScore },
                            { label: "Benchmark", value: run.maturityScore.benchmarkScore },
                          ].map(({ label, value }) => (
                            <ScoreGauge key={label} label={label} score={value} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No maturity score</p>
                    )}

                    {run.promotionEvaluation && (
                      <div className="border-t border-[hsl(var(--border))] pt-3">
                        <p className="mb-2 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                          Promotion Evaluation
                        </p>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={run.promotionEvaluation.isReady ? "success" : "warning"}>
                            {run.promotionEvaluation.classifiedAs}
                          </Badge>
                          <span className="font-mono text-xs text-[hsl(var(--foreground))]">
                            {Math.round(run.promotionEvaluation.readinessScore * 100)}% ready
                          </span>
                        </div>

                        {(run.promotionEvaluation.blockers as string[]).length > 0 && (
                          <div className="space-y-1">
                            {(run.promotionEvaluation.blockers as string[]).map((b, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <XCircle size={11} className="mt-0.5 shrink-0 text-[hsl(0_84%_60%)]" />
                                <span className="text-[11px] text-[hsl(0_84%_65%)]">{b}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {(run.promotionEvaluation.warnings as string[]).length > 0 && (
                          <div className="mt-1 space-y-1">
                            {(run.promotionEvaluation.warnings as string[]).map((w, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <AlertTriangle size={11} className="mt-0.5 shrink-0 text-[hsl(38_92%_55%)]" />
                                <span className="text-[11px] text-[hsl(38_92%_65%)]">{w}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {run.promotionEvaluation.reasoning && (
                          <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))] italic leading-snug">
                            {run.promotionEvaluation.reasoning.slice(0, 200)}
                            {run.promotionEvaluation.reasoning.length > 200 ? "…" : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
