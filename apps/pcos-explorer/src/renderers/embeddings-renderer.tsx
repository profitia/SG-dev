import type { RendererProps } from "@/registry/renderer-registry";
import type { EmbeddingsQueryResult } from "@/domains/embeddings/query";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { formatDistanceToNow } from "date-fns";

export function EmbeddingsRenderer({ data }: RendererProps) {
  const { records, byDocType, byModel, total, avgTokens, stdDim, nonStdDim } =
    data as EmbeddingsQueryResult;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Embedding Records"
        description="Vector embeddings persisted by PCOS-H3. These enable semantic retrieval of procurement cognition artifacts."
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Embeddings" value={total.toLocaleString()} />
          <StatCard label="Avg Token Count" value={Math.round(avgTokens).toLocaleString()} />
          <StatCard
            label="Std Dim (1536)"
            value={stdDim.toLocaleString()}
            sub={`${total > 0 ? Math.round((stdDim / total) * 100) : 0}% of total`}
            accent
          />
          {nonStdDim > 0 && (
            <StatCard label="Non-std Dim" value={nonStdDim.toLocaleString()} sub="Review recommended" />
          )}
        </div>

        {byDocType.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              By Document Type
            </h2>
            <div className="flex flex-wrap gap-2">
              {byDocType.map((t) => (
                <div
                  key={t.documentType}
                  className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2"
                >
                  <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                    {t.documentType}
                  </span>
                  <span className="font-mono text-sm font-semibold text-[hsl(var(--foreground))]">
                    {t._count.id.toLocaleString()}
                  </span>
                  {t._avg.tokenCount != null && (
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      ~{Math.round(t._avg.tokenCount)} tok
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {byModel.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              By Embedding Model
            </h2>
            <div className="flex flex-wrap gap-2">
              {byModel.map((m) => (
                <div
                  key={m.modelId}
                  className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2"
                >
                  <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                    {m.modelId}
                  </span>
                  <Badge variant="default">{m._count.id.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </section>
        )}

        {records.length === 0 ? (
          <EmptyState
            title="No embedding records found"
            description="Run the PCOS-H3 hydration pipeline to generate embeddings."
          />
        ) : (
          <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Document Type</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Document ID</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Model</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Dimensions</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Tokens</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {records.map((rec) => (
                  <tr
                    key={rec.id}
                    className="bg-[hsl(var(--card))] transition-colors hover:bg-[hsl(var(--accent))]"
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                        {rec.documentType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-[hsl(var(--foreground))]">
                        {rec.documentId.length > 32 ? rec.documentId.slice(0, 32) + "…" : rec.documentId}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                        {rec.modelId}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={rec.dimensions === 1536 ? "success" : "warning"}>
                        {rec.dimensions}d
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                        {rec.tokenCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        {formatDistanceToNow(rec.createdAt, { addSuffix: true })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.length === 200 && (
              <div className="border-t border-[hsl(var(--border))] px-4 py-2 text-center">
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  Showing first 200 records.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
