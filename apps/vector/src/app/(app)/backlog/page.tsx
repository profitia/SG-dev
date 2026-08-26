import { getAllTasks } from "@/app/actions/tasks"
import { getAllProjects } from "@/app/actions/projects"
import { TaskBoard } from "@/components/tasks/TaskBoard"
import { InlineTaskCreate } from "@/components/tasks/InlineTaskCreate"

export default async function BacklogPage() {
  let tasks: Awaited<ReturnType<typeof getAllTasks>> = []
  let projects: Awaited<ReturnType<typeof getAllProjects>> = []
  let dbError = false

  try {
    ;[tasks, projects] = await Promise.all([getAllTasks(), getAllProjects()])
  } catch {
    dbError = true
  }

  return (
    <div className="px-8 py-8 max-w-[1100px] mx-auto">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
          Backlog
        </h1>
        <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
          All tasks — list and kanban view
        </p>
      </div>

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      )}

      {projects.length > 0 && (
        <div className="mb-5">
          <InlineTaskCreate
            projectId={projects[0].id}
            placeholder="Quick add task… (prefix: /blocker /idea /decision)"
          />
        </div>
      )}

      <TaskBoard
        tasks={tasks as any}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        defaultView="list"
        showProjectFilter={true}
      />
    </div>
  )
}
