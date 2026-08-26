import { getTopologyData } from "@/app/actions/topology"
import {
  createProjectDependency,
  deleteProjectDependency,
  createExecutionDomain,
  assignProjectToDomain,
  createSharedBlocker,
  resolveSharedBlocker,
} from "@/app/actions/topology"
import { db } from "@/lib/db/prisma"
import { TopologyGraph } from "@/components/topology/TopologyGraph"
import { CockpitSection, CockpitEmpty } from "@/components/dashboard/CockpitSection"
import { cn } from "@/lib/utils"
import { Network, AlertTriangle, GitFork, Layers, ShieldAlert, ChevronRight } from "lucide-react"
import type { TopologyAnalysis } from "@/lib/topology/types"

// ── Signal level styling ──────────────────────────────────────────────────────

function signalDot(level: "healthy" | "warning" | "critical") {
  return cn(
    "mt-1 shrink-0 w-1.5 h-1.5 rounded-full",
    level === "critical" ? "bg-red-500" : level === "warning" ? "bg-amber-400" : "bg-emerald-500"
  )
}

// ── Topology page ─────────────────────────────────────────────────────────────

export default async function TopologyPage() {
  let topology: TopologyAnalysis | null = null
  let dbError = false
  let projects: { id: string; name: string; slug: string }[] = []

  try {
    ;[topology, projects] = await Promise.all([
      getTopologyData(),
      db.project.findMany({
        where: { status: { not: "ARCHIVED" } },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      }),
    ])
  } catch {
    dbError = true
  }

  if (dbError || !topology) {
    return (
      <div className="px-8 py-8 max-w-[1000px] mx-auto">
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      </div>
    )
  }

  const { nodes, edges, bottlenecks, criticalPaths, isolatedProjectIds, domains, sharedBlockers, signals, recommendations } = topology

  const hasDependencies = edges.length > 0

  const activeBlockers = sharedBlockers.filter((b) => !b.resolved)
  const resolvedBlockers = sharedBlockers.filter((b) => b.resolved)

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="mb-10 flex items-baseline justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Network className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
              Execution Topology
            </h1>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Cross-project dependency map — bottlenecks, critical paths, shared constraints
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
          <span>{nodes.length} projecty</span>
          <span className="opacity-30">·</span>
          <span>{edges.length} zależności</span>
          {bottlenecks.length > 0 && (
            <>
              <span className="opacity-30">·</span>
              <span className="text-amber-400">{bottlenecks.length} bottleneck{bottlenecks.length > 1 ? "ów" : ""}</span>
            </>
          )}
        </div>
      </div>

      {/* Empty state — no dependencies yet */}
      {!hasDependencies && (
        <div className="mb-8 rounded-lg border border-dashed border-[hsl(var(--border))] px-6 py-5">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Brak zadeklarowanych zależności. Dodaj pierwsze powiązanie między projektami poniżej, aby zbudować mapę topologiczną.
          </p>
        </div>
      )}

      {/* Main layout: Graph + Panel */}
      <div className="grid grid-cols-[1fr_340px] gap-8 mb-12">

        {/* ── Graph ── */}
        <div
          className="rounded-lg border border-[hsl(var(--border))] overflow-hidden"
          style={{ height: 500 }}
        >
          <TopologyGraph nodes={nodes} edges={edges} bottlenecks={bottlenecks} />
        </div>

        {/* ── Right panel: signals + recommendations ── */}
        <div className="flex flex-col gap-6 overflow-y-auto" style={{ maxHeight: 500 }}>

          {/* Topology Signals */}
          <CockpitSection label="Topology Signals" count={signals.length}>
            {signals.length === 0 ? (
              <CockpitEmpty label="No topology signals" />
            ) : (
              <div className="space-y-3">
                {signals.map((signal, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className={signalDot(signal.level)} />
                    <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                      {signal.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CockpitSection>

          {/* Recommendations */}
          <CockpitSection label="Strategic Recommendations" count={recommendations.length}>
            {recommendations.length === 0 ? (
              <CockpitEmpty label="No recommendations" />
            ) : (
              <div className="space-y-4">
                {recommendations.map((rec, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-start gap-2">
                      <div
                        className={cn(
                          "mt-1 shrink-0 w-1.5 h-1.5 rounded-full",
                          rec.priority === "high" ? "bg-red-500" : "bg-amber-400"
                        )}
                      />
                      <p className="text-xs font-medium text-[hsl(var(--foreground))] leading-snug">
                        {rec.title}
                      </p>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed pl-3.5">
                      {rec.reasoning}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CockpitSection>

        </div>
      </div>

      {/* ── Bottom: Bottlenecks + Domains + Shared Blockers ── */}
      <div className="grid grid-cols-3 gap-8 mb-12">

        {/* Bottlenecks */}
        <CockpitSection label="Bottlenecks" count={bottlenecks.length}>
          {bottlenecks.length === 0 ? (
            <CockpitEmpty label="No bottlenecks detected" />
          ) : (
            <div className="space-y-3">
              {bottlenecks.map((b) => (
                <div
                  key={b.projectId}
                  className="flex items-start gap-2.5 rounded-md border border-amber-900/30 bg-amber-950/10 px-3 py-2.5"
                >
                  <GitFork className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">
                      {b.projectName}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      {b.dependentCount} dependentów · {b.dependencyTypes.join(", ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CockpitSection>

        {/* Execution Domains */}
        <CockpitSection label="Execution Domains" count={domains.length}>
          {domains.length === 0 ? (
            <CockpitEmpty label="No execution domains" />
          ) : (
            <div className="space-y-3">
              {domains.map((domain) => {
                const domainProjects = projects.filter((p) =>
                  domain.projectIds.includes(p.id)
                )
                return (
                  <div key={domain.id} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                      <span className="text-xs font-medium text-[hsl(var(--foreground))]">
                        {domain.name}
                      </span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        ({domain.projectIds.length})
                      </span>
                    </div>
                    {domainProjects.length > 0 && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] pl-4">
                        {domainProjects.map((p) => p.name).join(", ")}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CockpitSection>

        {/* Shared Blockers */}
        <CockpitSection label="Shared Blockers" count={activeBlockers.length}>
          {activeBlockers.length === 0 ? (
            <CockpitEmpty label="No active shared blockers" />
          ) : (
            <div className="space-y-3">
              {activeBlockers.map((blocker) => {
                const affectedNames = blocker.affectedProjectIds
                  .map((id) => projects.find((p) => p.id === id)?.name ?? id)
                  .join(", ")
                return (
                  <div
                    key={blocker.id}
                    className={cn(
                      "flex items-start gap-2.5 rounded-md border px-3 py-2.5",
                      blocker.severity === "CRITICAL" || blocker.severity === "HIGH"
                        ? "border-red-900/30 bg-red-950/10"
                        : "border-amber-900/30 bg-amber-950/10"
                    )}
                  >
                    <ShieldAlert
                      className={cn(
                        "h-3.5 w-3.5 mt-0.5 shrink-0",
                        blocker.severity === "CRITICAL" || blocker.severity === "HIGH"
                          ? "text-red-400"
                          : "text-amber-400"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">
                        {blocker.title}
                      </p>
                      {affectedNames && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                          {affectedNames}
                        </p>
                      )}
                    </div>
                    <form action={resolveSharedBlocker.bind(null, blocker.id)} className="shrink-0">
                      <button
                        type="submit"
                        className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                      >
                        Resolve
                      </button>
                    </form>
                  </div>
                )
              })}
            </div>
          )}
        </CockpitSection>
      </div>

      {/* ── Management forms ── */}
      <div className="grid grid-cols-3 gap-8">

        {/* Add Dependency */}
        <div className="rounded-lg border border-[hsl(var(--border))] p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">
            Add Dependency
          </h3>
          <form action={createProjectDependency} className="space-y-3">
            <div>
              <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
                Source (depends on →)
              </label>
              <select
                name="sourceProjectId"
                required
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none"
              >
                <option value="">Wybierz projekt...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
                Target (zależy od)
              </label>
              <select
                name="targetProjectId"
                required
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none"
              >
                <option value="">Wybierz projekt...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
                  Typ
                </label>
                <select
                  name="dependencyType"
                  defaultValue="runtime"
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none"
                >
                  {["runtime", "orchestration", "ui", "infra", "cognition", "ai", "localization", "deployment"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
                  Criticality
                </label>
                <select
                  name="criticality"
                  defaultValue="MEDIUM"
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none"
                >
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <input
              name="description"
              placeholder="Opis (opcjonalnie)"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
            >
              Add Dependency
            </button>
          </form>
        </div>

        {/* Add Execution Domain + Assign */}
        <div className="rounded-lg border border-[hsl(var(--border))] p-5 space-y-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">
              Create Domain
            </h3>
            <form action={createExecutionDomain} className="space-y-3">
              <input
                name="name"
                placeholder="Nazwa domeny (np. Runtime, AI Layer...)"
                required
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
              />
              <input
                name="description"
                placeholder="Opis (opcjonalnie)"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
              />
              <button
                type="submit"
                className="w-full rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
              >
                Create Domain
              </button>
            </form>
          </div>

          {domains.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">
                Assign Project to Domain
              </h3>
              <form action={assignProjectToDomain} className="space-y-3">
                <select
                  name="projectId"
                  required
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none"
                >
                  <option value="">Projekt...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  name="executionDomainId"
                  required
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none"
                >
                  <option value="">Domena...</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="w-full rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
                >
                  Assign
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Add Shared Blocker */}
        <div className="rounded-lg border border-[hsl(var(--border))] p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">
            Add Shared Blocker
          </h3>
          <form action={createSharedBlocker} className="space-y-3">
            <input
              name="title"
              placeholder="Tytuł blokady..."
              required
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
            />
            <select
              name="severity"
              defaultValue="MEDIUM"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none"
            >
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              name="description"
              placeholder="Opis (opcjonalnie)"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
            />
            <div>
              <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
                Dotknięte projekty (ID, przecinek)
              </label>
              <select
                name="projectIds"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] focus:outline-none"
              >
                <option value="">Wszystkie / brak konkretnych</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
            >
              Add Shared Blocker
            </button>
          </form>
        </div>
      </div>

      {/* Critical Paths (if any) */}
      {criticalPaths.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">
            Critical Execution Paths
          </h2>
          <div className="space-y-2">
            {criticalPaths.map((path, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-red-900/30 bg-red-950/10 px-4 py-3"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {path.projectNames.map((name, j) => (
                    <span key={j} className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[hsl(var(--foreground))]">
                        {name}
                      </span>
                      {j < path.projectNames.length - 1 && (
                        <ChevronRight className="h-3 w-3 text-red-400/60" />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
