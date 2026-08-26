import { notFound } from "next/navigation"
import { getProjectBySlug } from "@/app/actions/projects"
import { EtapTree } from "@/components/projects/EtapTree"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let project: Awaited<ReturnType<typeof getProjectBySlug>> | null = null
  let dbError = false

  try {
    project = await getProjectBySlug(slug)
  } catch {
    dbError = true
  }

  if (!dbError && !project) {
    notFound()
  }

  if (dbError || !project) {
    return (
      <div className="px-8 py-8 max-w-5xl mx-auto">
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            Configure <code className="font-mono text-amber-400/80">DATABASE_URL</code> in <code className="font-mono text-amber-400/80">.env</code>
          </p>
        </div>
      </div>
    )
  }

  // Collect all tasks: from subetaps + direct-on-etap + direct-on-project
  const allTasks = [
    ...project.etaps.flatMap((e) => [
      ...e.tasks,
      ...e.subetaps.flatMap((s) => s.tasks),
    ]),
    ...project.tasks,
  ]

  const tasksByStatus = {
    active: allTasks.filter((t) => t.status === "ACTIVE").length,
    done: allTasks.filter((t) => t.status === "DONE").length,
    planned: allTasks.filter((t) => t.status === "PLANNED").length,
    blocked: allTasks.filter((t) => t.status === "BLOCKED").length,
  }

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">
            {project.name}
          </h1>
          <Badge
            variant={
              project.status === "ACTIVE"
                ? "active"
                : project.status === "PAUSED"
                ? "review"
                : "archived"
            }
          >
            {project.status}
          </Badge>
        </div>
        {project.description && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{project.description}</p>
        )}

        <div className="mt-4 flex items-center gap-4">
          {[
            { label: "Active", value: tasksByStatus.active, color: "text-blue-400" },
            { label: "Done", value: tasksByStatus.done, color: "text-emerald-400" },
            { label: "Planned", value: tasksByStatus.planned, color: "text-slate-400" },
            { label: "Blocked", value: tasksByStatus.blocked, color: "text-red-400" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-1.5">
              <span className={cn("text-sm font-semibold", stat.color)}>{stat.value}</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <EtapTree etaps={project.etaps} tasks={allTasks} />
    </div>
  )
}
