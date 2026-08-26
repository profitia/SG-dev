import { getAllEtaps } from "@/app/actions/projects"
import Link from "next/link"
import { cn } from "@/lib/utils"

function progressPercent(tasks: { status: string }[]): number {
  if (!tasks.length) return 0
  const done = tasks.filter((t) => t.status === "DONE" || t.status === "ARCHIVED").length
  return Math.round((done / tasks.length) * 100)
}

export default async function EtapsPage() {
  let etaps: Awaited<ReturnType<typeof getAllEtaps>> = []
  let dbError = false

  try {
    etaps = await getAllEtaps()
  } catch {
    dbError = true
  }

  // Group by project
  const byProject = new Map<string, { project: (typeof etaps)[0]["project"]; etaps: typeof etaps }>()
  etaps.forEach((etap) => {
    const key = etap.projectId
    if (!byProject.has(key)) {
      byProject.set(key, { project: etap.project, etaps: [] })
    }
    byProject.get(key)!.etaps.push(etap)
  })

  return (
    <div className="px-8 py-8 max-w-[900px] mx-auto">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
          ETAPs
        </h1>
        <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
          Execution phases across all active projects
        </p>
      </div>

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      )}

      {byProject.size === 0 && !dbError && (
        <div className="py-20 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground)/0.5)]">No ETAPs defined yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground)/0.3)] mt-1">
            Add ETAPs from the project detail page
          </p>
        </div>
      )}

      <div className="space-y-10">
        {[...byProject.values()].map(({ project, etaps: projEtaps }) => (
          <div key={project?.id ?? "unknown"}>
            {/* Project header */}
            <div className="flex items-baseline gap-3 mb-4">
              <Link
                href={`/projects/${project?.slug}`}
                className="text-sm font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--muted-foreground))] transition-colors"
              >
                {project?.name}
              </Link>
              <div className={cn(
                "text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded",
                project?.status === "ACTIVE" && "bg-emerald-900/30 text-emerald-400",
                project?.status === "PAUSED" && "bg-amber-900/30 text-amber-400",
                project?.status === "DONE" && "bg-slate-800/30 text-slate-400",
              )}>
                {project?.status}
              </div>
            </div>

            {/* ETAPs grid */}
            <div className="space-y-2">
              {projEtaps.map((etap) => {
                const pct = progressPercent(etap.tasks)
                const totalTasks = etap.tasks.length
                const doneTasks = etap.tasks.filter((t) => t.status === "DONE").length
                const blockedTasks = etap.tasks.filter((t) => t.status === "BLOCKED").length

                return (
                  <div
                    key={etap.id}
                    className="rounded-md border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-[hsl(var(--foreground))]">{etap.name}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
                        {blockedTasks > 0 && (
                          <span className="text-red-400">{blockedTasks} blocked</span>
                        )}
                        <span>{doneTasks}/{totalTasks} done</span>
                        <span className="font-medium text-[hsl(var(--foreground))]">{pct}%</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 w-full rounded-full bg-[hsl(var(--border)/0.3)] overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct === 100
                            ? "bg-emerald-600"
                            : blockedTasks > 0
                            ? "bg-red-500"
                            : "bg-blue-500"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
