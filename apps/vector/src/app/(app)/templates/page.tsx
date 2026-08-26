import { ARCHETYPE_LIST } from "@/lib/workspaces/archetypes"
import { cn } from "@/lib/utils"
import { LayoutTemplate, ChevronRight, GitFork, Layers, Plus } from "lucide-react"
import Link from "next/link"

function TopologyPreview({
  topology,
}: {
  topology: { from: string; to: string; type: string; criticality: string }[]
}) {
  return (
    <div className="space-y-1.5">
      {topology.map((edge, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-[hsl(var(--foreground))] truncate max-w-[100px]">
            {edge.from}
          </span>
          <ChevronRight className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))] shrink-0" />
          <span className="text-[hsl(var(--muted-foreground))] truncate max-w-[100px]">
            {edge.to}
          </span>
          <span className="ml-auto text-[10px] font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded px-1.5 shrink-0">
            {edge.type}
          </span>
          <span
            className={cn(
              "text-[9px] font-semibold shrink-0 w-12 text-right",
              edge.criticality === "CRITICAL"
                ? "text-red-400"
                : edge.criticality === "HIGH"
                ? "text-amber-400"
                : "text-[hsl(var(--muted-foreground))]"
            )}
          >
            {edge.criticality}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function TemplatesPage() {
  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className="mb-10 flex items-baseline justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <LayoutTemplate className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
              Execution Archetypes
            </h1>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            5 opinionated workspace templates — each generates a full execution structure instantly
          </p>
        </div>
        <Link
          href="/workspaces/new"
          className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3.5 py-2 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          New Workspace
        </Link>
      </div>

      {/* Archetype grid */}
      <div className="grid grid-cols-1 gap-6">
        {ARCHETYPE_LIST.map((template) => (
          <div
            key={template.archetype}
            className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"
          >
            {/* Archetype header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-baseline gap-2.5 mb-1">
                  <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    {template.label}
                  </h2>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded px-1.5 py-0.5">
                    {template.tagline}
                  </span>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xl">
                  {template.description}
                </p>
              </div>
              <Link
                href={`/workspaces/new`}
                className="shrink-0 ml-4 flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--muted-foreground))/0.4] transition-colors"
              >
                <Plus className="h-2.5 w-2.5" />
                Use archetype
              </Link>
            </div>

            {/* 3-column: projects · domains · topology */}
            <div className="grid grid-cols-3 gap-6">

              {/* Projects */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                    Projects ({template.projects.length})
                  </span>
                </div>
                <div className="space-y-3">
                  {template.projects.map((p) => (
                    <div key={p.name}>
                      <div className="text-xs font-medium text-[hsl(var(--foreground))] mb-0.5">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                        {p.etaps.join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Domains */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <Layers className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                    Domains ({template.executionDomains.length})
                  </span>
                </div>
                <div className="space-y-3">
                  {template.executionDomains.map((d) => (
                    <div key={d.name}>
                      <div className="text-xs font-medium text-[hsl(var(--foreground))] mb-0.5">
                        {d.name}
                      </div>
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {d.projectNames.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Conventions preview */}
                <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">
                    Conventions
                  </div>
                  <div className="space-y-1">
                    {Object.entries(template.conventions)
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <div key={k} className="flex gap-1.5 text-[10px]">
                          <span className="text-[hsl(var(--muted-foreground))] shrink-0">
                            {k.split(".").pop()}:
                          </span>
                          <span className="text-[hsl(var(--foreground))] font-medium truncate">
                            {v}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Topology */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <GitFork className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                    Topology ({template.topology.length})
                  </span>
                </div>
                <TopologyPreview topology={template.topology} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
