import { getDependencies } from "@/app/actions/tasks"
import { DependencyGraph } from "@/components/tasks/DependencyGraph"

export default async function DependenciesPage() {
  let dependencies: Awaited<ReturnType<typeof getDependencies>> = []
  let dbError = false

  try {
    dependencies = await getDependencies()
  } catch {
    dbError = true
  }

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
          Dependencies
        </h1>
        <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
          {dependencies.length > 0
            ? `${dependencies.length} dependency ${dependencies.length === 1 ? "link" : "links"} — drag to rearrange`
            : "Visual map of task blocking relationships"}
        </p>
      </div>

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      )}

      <DependencyGraph dependencies={dependencies as any} />
    </div>
  )
}
