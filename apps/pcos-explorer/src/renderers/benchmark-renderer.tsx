import type { RendererProps } from "@/registry/renderer-registry";
import type { BenchmarkQueryResult } from "@/domains/benchmark/query";
import { PageHeader } from "@/components/ui/page-header";
import { ConfidenceBar } from "@/components/ui/confidence-bar";
import { StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import Link from "next/link";

export function BenchmarkRenderer({ data }: RendererProps) {
  const {
    ontologyNodes,
    benchmarkIntelligence,
    shouldCostIntelligence,
    forecastIntelligence,
    macroIntelligence,
  } = data as BenchmarkQueryResult;

  const totalBenchmarkArtifacts =
    ontologyNodes.length +
    benchmarkIntelligence.length +
    shouldCostIntelligence.length +
    forecastIntelligence.length +
    macroIntelligence.length;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Benchmark Cognition"
        description="Cross-domain view of benchmark intelligence — market pricing, should-cost models, forecasting, and macroeconomic signals."
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Benchmark Nodes" value={ontologyNodes.length.toLocaleString()} sub="nodeType = BENCHMARK" />
          <StatCard label="Benchmark Intel" value={benchmarkIntelligence.length.toLocaleString()} sub="intelligenceType = BENCHMARK" accent />
          <StatCard label="Should-Cost" value={shouldCostIntelligence.length.toLocaleString()} sub="intelligenceType = SHOULD_COST" />
          <StatCard label="Forecasting" value={forecastIntelligence.length.toLocaleString()} sub="intelligenceType = FORECASTING" />
          <StatCard label="Macro Signals" value={macroIntelligence.length.toLocaleString()} sub="intelligenceType = MACROECONOMIC" />
        </div>

        {totalBenchmarkArtifacts === 0 ? (
          <EmptyState
            title="No benchmark cognition found"
            description="Run the PCOS-H3 pipeline to generate benchmark intelligence."
          />
        ) : (
          <div className="space-y-6">
            {ontologyNodes.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Benchmark Ontology Nodes
                </h2>
                <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Key</th>
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Version</th>
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Vector Dim</th>
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Payload Keys</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {ontologyNodes.map((node) => {
                        const payloadKeys = node.nodePayload
                          ? Object.keys(node.nodePayload as Record<string, unknown>).slice(0, 4)
                          : [];
                        return (
                          <tr key={node.id} className="bg-[hsl(var(--card))] hover:bg-[hsl(var(--accent))]">
                            <td className="px-4 py-2.5">
                              <Link href={`/ontology/${node.id}`} className="font-mono text-xs text-[hsl(var(--primary))] hover:underline">
                                {node.nodeKey}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{node.ontologyVersion ?? "—"}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                                {node.vectorEmbedding.length > 0 ? `${node.vectorEmbedding.length}d` : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {payloadKeys.map((k) => (
                                  <span key={k} className="rounded bg-[hsl(var(--secondary))] px-1 py-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{k}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {benchmarkIntelligence.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Benchmark Intelligence Units
                </h2>
                <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Subject</th>
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Confidence</th>
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Data Quality</th>
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Valid Until</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {benchmarkIntelligence.map((unit) => (
                        <tr key={unit.id} className="bg-[hsl(var(--card))] hover:bg-[hsl(var(--accent))]">
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-xs text-[hsl(var(--foreground))]">{unit.subjectId}</span>
                          </td>
                          <td className="px-4 py-2.5"><ConfidenceBar score={unit.confidenceScore} /></td>
                          <td className="px-4 py-2.5"><ConfidenceBar score={unit.dataQualityScore} /></td>
                          <td className="px-4 py-2.5">
                            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                              {unit.validUntil ? unit.validUntil.toISOString().split("T")[0] : "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: "Should-Cost Models", units: shouldCostIntelligence },
                { label: "Forecasting Models", units: forecastIntelligence },
                { label: "Macroeconomic Signals", units: macroIntelligence },
              ].map(({ label, units }) =>
                units.length > 0 ? (
                  <div key={label} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                    <p className="mb-2 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{label}</p>
                    <p className="text-2xl font-semibold tabular-nums text-[hsl(var(--foreground))]">{units.length}</p>
                    <div className="mt-2 space-y-1">
                      {units.slice(0, 5).map((u) => (
                        <div key={u.id} className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))] truncate max-w-[140px]">{u.subjectId}</span>
                          <ConfidenceBar score={u.confidenceScore} />
                        </div>
                      ))}
                      {units.length > 5 && (
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">+{units.length - 5} more</p>
                      )}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
