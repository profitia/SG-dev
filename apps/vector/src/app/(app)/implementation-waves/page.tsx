import { getImplementationWaves, getExecutionReadiness } from "@/app/actions/execution"
import { CockpitSection } from "@/components/dashboard/CockpitSection"
import { cn } from "@/lib/utils"
import { Layers3 } from "lucide-react"

const WAVE_STATUS: Record<string, { badge: string; bar: string }> = {
  COMPLETE: { badge: "bg-violet-500/10 text-violet-400 border border-violet-700/40", bar: "bg-violet-500" },
  ACTIVE:   { badge: "bg-blue-500/10 text-blue-400 border border-blue-700/40",       bar: "bg-blue-500" },
  BLOCKED:  { badge: "bg-red-500/10 text-red-400 border border-red-700/40",           bar: "bg-red-500" },
  PLANNED:  { badge: "bg-slate-800/60 text-slate-500 border border-slate-700/30",    bar: "bg-slate-700" },
}

const READINESS_DOT: Record<string, string> = {
  READY:       "bg-emerald-500",
  BLOCKED:     "bg-red-500",
  IN_PROGRESS: "bg-blue-500",
  NOT_READY:   "bg-slate-600",
  PLANNING:    "bg-amber-500",
  COMPLETE:    "bg-violet-500",
  VALIDATION:  "bg-violet-400",
}

const COMPLEXITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH:     "text-amber-400",
  MEDIUM:   "text-sky-400",
  LOW:      "text-slate-400",
}

export default async function ImplementationWavesPage() {
  let waves: Awaited<ReturnType<typeof getImplementationWaves>> = []
  let readiness: Awaited<ReturnType<typeof getExecutionReadiness>> | null = null
  let dbError = false

  try {
    ;[waves, readiness] = await Promise.all([
      getImplementationWaves(),
      getExecutionReadiness(),
    ])
  } catch {
    dbError = true
  }

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className="mb-10 flex items-baseline justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Layers3 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
              Implementation Waves
            </h1>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            SG2 phased delivery model — {waves.length} waves, {readiness?.totalTasks ?? 0} tasks, {readiness?.totalEffort ?? 0} story points
          </p>
        </div>
        {readiness && (
          <div className="flex items-center gap-4 text-xs">
            <span className="text-emerald-400 font-medium">{readiness.readyTasks} ready</span>
            <span className="text-[hsl(var(--muted-foreground)/0.5)]">·</span>
            <span className="text-[hsl(var(--muted-foreground))]">{readiness.activeWaves} active wave</span>
          </div>
        )}
      </div>

      {dbError && (
        <div className="rounded-md border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-400 mb-8">
          DB error — could not load implementation waves.
        </div>
      )}

      {/* Waves */}
      <div className="space-y-6">
        {waves.map(wave => {
          const totalTasks  = wave.tasks.length
          const readyTasks  = wave.tasks.filter(t => t.readiness === "READY").length
          const blockedTasks= wave.tasks.filter(t => t.readiness === "BLOCKED").length
          const completeTasks = wave.tasks.filter(t => t.readiness === "COMPLETE").length
          const totalEffort = wave.tasks.reduce((s, t) => s + t.effort, 0)
          const cfg = WAVE_STATUS[wave.status] ?? WAVE_STATUS.PLANNED
          const progress = totalTasks > 0 ? Math.round((completeTasks / totalTasks) * 100) : 0

          return (
            <CockpitSection key={wave.id} label={`Wave ${wave.order} — ${wave.name}`}>
              {/* Wave header */}
              <div className="px-4 py-3 border-b border-white/[0.04]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-sm font-medium", cfg.badge)}>
                      {wave.status}
                    </span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {totalTasks} tasks · {totalEffort} sp
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-[hsl(var(--muted-foreground))]">
                    {readyTasks > 0  && <span className="text-emerald-400">{readyTasks} ready</span>}
                    {blockedTasks > 0 && <span className="text-red-400">{blockedTasks} blocked</span>}
                    {completeTasks > 0 && <span className="text-violet-400">{completeTasks} done</span>}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative h-1 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", cfg.bar)}
                    style={{ width: `${Math.max(progress, wave.status === "COMPLETE" ? 100 : 0)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-[hsl(var(--muted-foreground)/0.5)] mt-1">
                  <span>{wave.description}</span>
                  <span>{wave.status === "COMPLETE" ? "100" : progress}%</span>
                </div>
              </div>

              {/* Task list */}
              {wave.tasks.length > 0 ? (
                <div className="divide-y divide-white/[0.02]">
                  {wave.tasks.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2">
                      <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", READINESS_DOT[t.readiness ?? "NOT_READY"])} />
                      <span className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] shrink-0 w-16">{t.localId}</span>
                      <span className="text-xs text-[hsl(var(--foreground)/0.8)] flex-1 truncate">{t.title}</span>
                      <span className={cn("text-[10px] font-medium shrink-0", COMPLEXITY_COLOR[t.complexity ?? "MEDIUM"])}>
                        {t.complexity?.slice(0, 3)}
                      </span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">{t.effort}sp</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-xs text-[hsl(var(--muted-foreground)/0.4)]">
                  No tasks assigned to this wave yet
                </div>
              )}
            </CockpitSection>
          )
        })}
      </div>
    </div>
  )
}
