import type { RendererProps } from "@/registry/renderer-registry";
import type { PromotionQueryResult } from "@/domains/promotion/query";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle, GitBranch, Layers, Tag } from "lucide-react";

export function PromotionRenderer({ data }: RendererProps) {
  const { executions, snapshots, versions, recentLineage, recentTelemetry } =
    data as PromotionQueryResult;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Cognition Promotion"
        description="H5 promotion pipeline — LAB → PROD. Snapshots, semantic versioning, blue/green deployment, and full audit lineage."
      />

      <div className="p-6 space-y-8">
        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Executions", value: executions.length, icon: GitBranch },
            { label: "Snapshots", value: snapshots.length, icon: Layers },
            { label: "Versions", value: versions.length, icon: Tag },
            {
              label: "Lineage Events",
              value: recentLineage.length,
              icon: CheckCircle2,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 flex items-center gap-3"
            >
              <Icon size={16} className="text-[hsl(var(--muted-foreground))]" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  {label}
                </p>
                <p className="text-xl font-semibold tabular-nums">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Promotion Executions */}
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Promotion Executions
          </h2>
          {executions.length === 0 ? (
            <EmptyState
              title="No promotion executions"
              description="Run the PCOS-H5 promotion pipeline to promote LAB cognition to PROD."
            />
          ) : (
            <div className="space-y-2">
              {executions.map((exec) => (
                <div
                  key={exec.id}
                  className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={exec.status} />
                    <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                      {exec.id.slice(0, 16)}…
                    </span>
                    <Badge variant="muted">{exec.currentPhase}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    {exec.isPromoted ? (
                      <div className="flex items-center gap-1 text-[hsl(142_71%_55%)]">
                        <CheckCircle2 size={13} />
                        <span className="text-[11px]">Promoted</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                        <XCircle size={13} />
                        <span className="text-[11px]">Not Promoted</span>
                      </div>
                    )}
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {formatDistanceToNow(exec.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Cognition Versions */}
        {versions.length > 0 && (
          <section>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Cognition Versions
            </h2>
            <div className="space-y-2">
              {versions.map((ver) => (
                <div
                  key={ver.id}
                  className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Tag
                      size={14}
                      className="text-[hsl(var(--muted-foreground))]"
                    />
                    <span className="font-mono text-sm font-medium">
                      v{ver.versionString}
                    </span>
                    <Badge variant="muted">{ver.versionLabel}</Badge>
                    <Badge
                      variant={ver.status === "PROMOTED" ? "success" : "muted"}
                    >
                      {ver.status}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    {formatDistanceToNow(ver.createdAt, { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Snapshots */}
        {snapshots.length > 0 && (
          <section>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Cognition Snapshots
            </h2>
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Layers
                      size={14}
                      className="text-[hsl(var(--muted-foreground))]"
                    />
                    <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                      {snap.id.slice(0, 16)}…
                    </span>
                    <Badge variant="muted">v{snap.snapshotVersion}</Badge>
                    <Badge
                      variant={snap.status === "COMPLETE" ? "success" : "muted"}
                    >
                      {snap.status}
                    </Badge>
                  </div>
                  <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                    {snap.integrityHash.slice(0, 12)}…
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Lineage */}
        {recentLineage.length > 0 && (
          <section>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Recent Lineage Events
            </h2>
            <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
                    {["Phase", "Event Type", "Entity", "Time"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentLineage.slice(0, 20).map((ev) => (
                    <tr
                      key={ev.id}
                      className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted)/0.15)]"
                    >
                      <td className="px-3 py-2 font-mono">{ev.phase}</td>
                      <td className="px-3 py-2">
                        <Badge variant="muted">{ev.eventType}</Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-[hsl(var(--muted-foreground))]">
                        {ev.entityRef?.slice(0, 12) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                        {formatDistanceToNow(ev.createdAt, { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Telemetry summary */}
        {recentTelemetry.length > 0 && (
          <section>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Pipeline Telemetry
            </h2>
            <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
                    {["Phase", "Event", "Metric", "Value", "Time"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTelemetry.slice(0, 20).map((ev) => (
                    <tr
                      key={ev.id}
                      className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted)/0.15)]"
                    >
                      <td className="px-3 py-2 font-mono">{ev.phase}</td>
                      <td className="px-3 py-2">
                        <Badge variant="muted">{ev.eventType}</Badge>
                      </td>
                      <td className="px-3 py-2 font-mono">{ev.metricName}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {ev.metricValue != null
                          ? ev.metricValue.toFixed(2)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                        {formatDistanceToNow(ev.createdAt, { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {executions.length === 0 &&
          snapshots.length === 0 &&
          versions.length === 0 && (
            <EmptyState
              title="No promotion data"
              description="Run the PCOS-H5 promotion pipeline to promote LAB cognition to PROD."
            />
          )}
      </div>
    </div>
  );
}
