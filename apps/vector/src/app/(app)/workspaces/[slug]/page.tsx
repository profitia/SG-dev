import { getWorkspace } from "@/app/actions/workspaces"
import { deleteWorkspace } from "@/app/actions/workspaces"
import { ARCHETYPES } from "@/lib/workspaces/archetypes"
import { CockpitSection, CockpitEmpty } from "@/components/dashboard/CockpitSection"
import { cn } from "@/lib/utils"
import {
  Building2,
  ChevronRight,
  Layers,
  GitFork,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Pause,
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  return (
    <div
      className={cn(
        "shrink-0 w-1.5 h-1.5 rounded-full",
        status === "ACTIVE"
          ? "bg-emerald-500"
          : status === "PAUSED"
          ? "bg-amber-400"
          : status === "DONE"
          ? "bg-[hsl(var(--muted-foreground))]"
          : "bg-[hsl(var(--border))]"
      )}
    />
  )
}

// ── Workspace dashboard ───────────────────────────────────────────────────────

export default async function WorkspaceDashboard({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = await getWorkspace(slug).catch(() => null)

  if (!workspace) notFound()

  const template = ARCHETYPES[workspace.archetype as keyof typeof ARCHETYPES] ?? null

  const allTasks = workspace.projects.flatMap((p) => p.tasks)
  const activeTasks = allTasks.filter((t) => t.status === "ACTIVE").length
  const blockedTasks = allTasks.filter((t) => t.status === "BLOCKED").length
  const criticalTasks = allTasks.filter((t) => t.priority === "CRITICAL").length
  const doneTasks = allTasks.filter((t) => t.status === "DONE").length

  const activeProjects = workspace.projects.filter((p) => p.status === "ACTIVE").length
  const totalDependencies = workspace.projects.reduce(
    (sum, p) => sum + p.sourceDependencies.length,
    0
  )

  const aiConventions = workspace.conventions.filter((c) => c.key.startsWith("ai."))
  const govConventions = workspace.conventions.filter((c) => c.key.startsWith("governance."))

  return (
    <div className="px-8 py-8 max-w-[1100px] mx-auto">

      {/* Header */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] mb-2">
            <Link href="/workspaces" className="hover:text-[hsl(var(--foreground))] transition-colors">
              Workspaces
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[hsl(var(--foreground))]">{workspace.name}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
              {workspace.name}
            </h1>
            <span className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded px-2 py-0.5">
              {template?.label ?? workspace.archetype}
            </span>
          </div>
          {workspace.description && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              {workspace.description}
            </p>
          )}
        </div>

        {/* Health numbers */}
        <div className="flex items-center gap-6 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
          <div className="text-center">
            <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {activeProjects}/{workspace.projects.length}
            </div>
            <div>active</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {allTasks.length}
            </div>
            <div>tasks</div>
          </div>
          <div className="text-center">
            <div
              className={cn(
                "text-sm font-semibold",
                blockedTasks > 0 ? "text-red-400" : "text-[hsl(var(--foreground))]"
              )}
            >
              {blockedTasks}
            </div>
            <div>blocked</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {totalDependencies}
            </div>
            <div>dependencies</div>
          </div>
        </div>
      </div>

      {/* Main grid: projects + right panel */}
      <div className="grid grid-cols-[1fr_300px] gap-10 mb-10">

        {/* Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Projects
            </h2>
            <Link
              href={`/projects`}
              className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              View all
            </Link>
          </div>

          <div className="space-y-2">
            {workspace.projects.map((project) => {
              const pActive = project.tasks.filter((t) => t.status === "ACTIVE").length
              const pBlocked = project.tasks.filter((t) => t.status === "BLOCKED").length
              const pDone = project.tasks.filter((t) => t.status === "DONE").length
              const domains = project.executionDomains.map((pd) => pd.executionDomain.name)

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 hover:border-[hsl(var(--muted-foreground))/0.3] transition-colors group"
                >
                  <StatusDot status={project.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                        {project.name}
                      </span>
                      {domains.slice(0, 2).map((d) => (
                        <span
                          key={d}
                          className="text-[10px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded px-1.5 py-0.5"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                      <span>{project.etaps.length} ETAPs</span>
                      {pActive > 0 && <span>{pActive} active</span>}
                      {pBlocked > 0 && <span className="text-red-400">{pBlocked} blocked</span>}
                      {pDone > 0 && <span>{pDone} done</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-6">

          {/* Execution summary */}
          <CockpitSection label="Execution State" count={undefined}>
            <div className="space-y-2">
              {[
                { label: "Active tasks", value: activeTasks, color: "text-[hsl(var(--foreground))]" },
                { label: "Blocked", value: blockedTasks, color: blockedTasks > 0 ? "text-red-400" : "text-[hsl(var(--foreground))]" },
                { label: "Critical priority", value: criticalTasks, color: criticalTasks > 0 ? "text-amber-400" : "text-[hsl(var(--foreground))]" },
                { label: "Done", value: doneTasks, color: "text-emerald-500" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{row.label}</span>
                  <span className={cn("text-xs font-semibold tabular-nums", row.color)}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </CockpitSection>

          {/* Topology */}
          {totalDependencies > 0 && (
            <CockpitSection label="Topology" count={totalDependencies}>
              <div className="space-y-1.5">
                {workspace.projects
                  .filter((p) => p.sourceDependencies.length > 0)
                  .slice(0, 5)
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-1.5 text-xs">
                      <span className="text-[hsl(var(--foreground))] font-medium truncate">
                        {p.name}
                      </span>
                      <span className="text-[hsl(var(--muted-foreground))] shrink-0">
                        → {p.sourceDependencies.length}
                      </span>
                    </div>
                  ))}
              </div>
              <Link
                href="/topology"
                className="mt-3 block text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                View topology map →
              </Link>
            </CockpitSection>
          )}

          {/* Quick links */}
          <div className="space-y-1.5">
            {[
              { label: "Execution Topology", href: "/topology" },
              { label: "Cognition Engine", href: "/cognition" },
              { label: "Project Blockers", href: "/blockers" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                <ChevronRight className="h-3 w-3" />
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Conventions */}
      {workspace.conventions.length > 0 && (
        <div className="grid grid-cols-2 gap-8 mb-8">

          {aiConventions.length > 0 && (
            <CockpitSection label="AI Conventions" count={aiConventions.length}>
              <div className="space-y-2">
                {aiConventions.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 w-28 truncate">
                      {c.key.replace("ai.", "")}
                    </span>
                    <span className="text-xs font-medium text-[hsl(var(--foreground))]">
                      {c.value}
                    </span>
                  </div>
                ))}
              </div>
            </CockpitSection>
          )}

          {govConventions.length > 0 && (
            <CockpitSection label="Governance" count={govConventions.length}>
              <div className="space-y-2">
                {govConventions.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 w-28 truncate">
                      {c.key.replace("governance.", "")}
                    </span>
                    <span className="text-xs font-medium text-[hsl(var(--foreground))]">
                      {c.value}
                    </span>
                  </div>
                ))}
              </div>
            </CockpitSection>
          )}
        </div>
      )}

      {/* Delete workspace */}
      <div className="pt-4 border-t border-[hsl(var(--border))]">
        <form
          action={async () => {
            "use server"
            const { deleteWorkspace: del } = await import("@/app/actions/workspaces")
            await del(workspace.id)
          }}
        >
          <button
            type="submit"
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
          >
            Delete workspace
          </button>
        </form>
      </div>
    </div>
  )
}
