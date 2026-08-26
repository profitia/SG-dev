import { getWorkspaces } from "@/app/actions/workspaces"
import { ARCHETYPES } from "@/lib/workspaces/archetypes"
import { cn } from "@/lib/utils"
import { Building2, Plus, ChevronRight } from "lucide-react"
import Link from "next/link"

const ARCHETYPE_LABEL: Record<string, string> = {
  SaaS: "SaaS Product",
  Startup: "Startup",
  Agency: "Agency",
  InternalProduct: "Internal Product",
  AIPlatform: "AI Platform",
}

export default async function WorkspacesPage() {
  let workspaces: Awaited<ReturnType<typeof getWorkspaces>> = []
  let dbError = false

  try {
    workspaces = await getWorkspaces()
  } catch {
    dbError = true
  }

  return (
    <div className="px-8 py-8 max-w-[900px] mx-auto">

      {/* Header */}
      <div className="mb-10 flex items-baseline justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Building2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
              Workspaces
            </h1>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Execution-ready workspace instances — each generated from an archetype
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

      {dbError && (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4 mb-8">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      )}

      {/* Workspace list */}
      {workspaces.length === 0 && !dbError ? (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] px-8 py-12 text-center">
          <Building2 className="h-8 w-8 text-[hsl(var(--muted-foreground))] mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">
            No workspaces yet
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-5">
            Generate your first execution workspace from an archetype.
          </p>
          <Link
            href="/workspaces/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Generate first workspace
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {workspaces.map((ws) => {
            const totalProjects = ws.projects.length
            const activeProjects = ws.projects.filter((p) => p.status === "ACTIVE").length
            const totalTasks = ws.projects.flatMap((p) => p.tasks).length
            const blockedTasks = ws.projects
              .flatMap((p) => p.tasks)
              .filter((t) => t.status === "BLOCKED").length

            return (
              <Link
                key={ws.id}
                href={`/workspaces/${ws.slug}`}
                className="flex items-center gap-5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-4 hover:border-[hsl(var(--muted-foreground))/0.4] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2.5 mb-0.5">
                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                      {ws.name}
                    </span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded px-1.5 py-0.5">
                      {ARCHETYPE_LABEL[ws.archetype] ?? ws.archetype}
                    </span>
                  </div>
                  {ws.description && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {ws.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-6 shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                  <div className="text-center">
                    <div className="font-semibold text-[hsl(var(--foreground))]">
                      {activeProjects}/{totalProjects}
                    </div>
                    <div className="text-[10px]">projects</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-[hsl(var(--foreground))]">{totalTasks}</div>
                    <div className="text-[10px]">tasks</div>
                  </div>
                  {blockedTasks > 0 && (
                    <div className="text-center">
                      <div className="font-semibold text-red-400">{blockedTasks}</div>
                      <div className="text-[10px]">blocked</div>
                    </div>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
