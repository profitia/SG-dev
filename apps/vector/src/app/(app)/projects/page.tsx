import Link from "next/link"
import { getAllProjects } from "@/app/actions/projects"
import { CreateProjectForm } from "@/components/projects/CreateProjectForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ProjectStatus } from "@/types"
import { FolderKanban } from "lucide-react"

const statusLabel: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  DONE: "Done",
  ARCHIVED: "Archived",
}

const statusDot: Record<ProjectStatus, string> = {
  ACTIVE: "bg-emerald-400",
  PAUSED: "bg-amber-400",
  DONE: "bg-slate-400",
  ARCHIVED: "bg-slate-700",
}

export default async function ProjectsPage() {
  let projects: Awaited<ReturnType<typeof getAllProjects>> = []
  let dbError = false

  try {
    projects = await getAllProjects()
  } catch {
    dbError = true
  }

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">
            Projects
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            All projects in execution
          </p>
        </div>
        <CreateProjectForm />
      </div>

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            Configure <code className="font-mono text-amber-400/80">DATABASE_URL</code> in <code className="font-mono text-amber-400/80">.env</code>
          </p>
        </div>
      )}

      {projects.length === 0 && !dbError ? (
        <div className="rounded-lg border border-[hsl(var(--border))] border-dashed px-6 py-16 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No projects yet</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Create your first project above or run the seed script</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.slug}`}>
              <Card className="h-full transition-colors hover:border-[hsl(var(--accent-foreground)/0.1)] hover:bg-[hsl(var(--accent)/0.5)] cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between mb-1">
                    <FolderKanban className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <div className="flex items-center gap-1.5">
                      <div className={cn("h-1.5 w-1.5 rounded-full", statusDot[project.status])} />
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">{statusLabel[project.status]}</span>
                    </div>
                  </div>
                  <CardTitle className="text-[hsl(var(--foreground))] normal-case text-sm font-semibold tracking-normal">
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {project.description && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mb-3">{project.description}</p>
                  )}
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {project._count?.tasks ?? 0} tasks
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
