import { getExecutionQueue, getExecutionReadiness, getExecutionPressure } from "@/app/actions/execution"
import { CockpitSection } from "@/components/dashboard/CockpitSection"
import { cn } from "@/lib/utils"
import { PlayCircle, AlertTriangle, CheckCircle2, Clock, Lock } from "lucide-react"

const READINESS_BADGE: Record<string, string> = {
  READY:       "bg-emerald-500/10 text-emerald-400 border border-emerald-700/40",
  BLOCKED:     "bg-red-500/10 text-red-400 border border-red-700/40",
  IN_PROGRESS: "bg-blue-500/10 text-blue-400 border border-blue-700/40",
  NOT_READY:   "bg-slate-800/60 text-slate-500 border border-slate-700/30",
  PLANNING:    "bg-amber-500/10 text-amber-400 border border-amber-700/40",
  COMPLETE:    "bg-violet-500/10 text-violet-400 border border-violet-700/40",
}

const COMPLEXITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-amber-400",
  MEDIUM:   "bg-sky-400",
  LOW:      "bg-slate-500",
}

const IMPL_BADGE: Record<string, string> = {
  ARCHITECTURE:  "text-violet-400",
  RUNTIME:       "text-blue-400",
  BACKEND:       "text-sky-400",
  FRONTEND:      "text-teal-400",
  DATABASE:      "text-amber-400",
  AUTH:          "text-orange-400",
  AI:            "text-pink-400",
  INGESTION:     "text-cyan-400",
  OBSERVABILITY: "text-green-400",
  EXPORT:        "text-indigo-400",
  GOVERNANCE:    "text-rose-400",
  DEPLOYMENT:    "text-lime-400",
  UX:            "text-fuchsia-400",
}

export default async function ExecutionQueuePage() {
  let queue: Awaited<ReturnType<typeof getExecutionQueue>> | null = null
  let readiness: Awaited<ReturnType<typeof getExecutionReadiness>> | null = null
  let pressure: Awaited<ReturnType<typeof getExecutionPressure>> | null = null
  let dbError = false

  try {
    ;[queue, readiness, pressure] = await Promise.all([
      getExecutionQueue(),
      getExecutionReadiness(),
      getExecutionPressure(),
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
            <PlayCircle className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
              Execution Queue
            </h1>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            SG2 task decomposition — {readiness?.totalTasks ?? 0} tasks, {readiness?.readyTasks ?? 0} ready, {readiness?.blockedTasks ?? 0} blocked
          </p>
        </div>
        {readiness && (
          <div className="flex items-center gap-6 text-xs">
            <span className="text-emerald-400 font-medium">{readiness.readyTasks} READY</span>
            <span className="text-red-400 font-medium">{readiness.blockedTasks} BLOCKED</span>
            <span className="text-[hsl(var(--muted-foreground))]">{readiness.totalEffort} sp total</span>
          </div>
        )}
      </div>

      {dbError && (
        <div className="rounded-md border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-400 mb-8">
          DB error — could not load execution queue.
        </div>
      )}

      {/* Stats Row */}
      {readiness && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
          {[
            { label: "Total Tasks",    value: readiness.totalTasks,    color: "text-[hsl(var(--foreground))]" },
            { label: "Ready",          value: readiness.readyTasks,    color: "text-emerald-400" },
            { label: "Blocked",        value: readiness.blockedTasks,  color: "text-red-400" },
            { label: "Critical Tasks", value: readiness.criticalTasks, color: "text-amber-400" },
            { label: "Total Effort",   value: `${readiness.totalEffort} sp`, color: "text-sky-400" },
          ].map(s => (
            <div key={s.label} className="rounded-md border border-white/[0.04] bg-white/[0.02] px-4 py-3">
              <div className={cn("text-xl font-semibold tabular-nums", s.color)}>{s.value}</div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* External Blockers */}
      {pressure && pressure.externalBlockers.length > 0 && (
        <CockpitSection label="External Blockers" className="mb-8">
          <div className="space-y-2">
            {pressure.externalBlockers.map(b => (
              <div key={b.id} className="flex items-start gap-3 px-4 py-3 rounded-md border border-red-700/30 bg-red-950/10">
                <Lock className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-mono text-red-300">{b.id}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-sm font-medium",
                      b.severity === "CRITICAL" ? "bg-red-900/50 text-red-300" : "bg-amber-900/50 text-amber-300"
                    )}>
                      {b.severity}
                    </span>
                  </div>
                  <div className="text-xs text-[hsl(var(--foreground))] font-medium">{b.title}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                    Blocks: {Array.isArray(b.blocks) ? b.blocks.join(", ") : b.blocks}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CockpitSection>
      )}

      {/* READY QUEUE */}
      {queue && queue.ready.length > 0 && (
        <CockpitSection label={`Build Now — ${queue.ready.length} Tasks Ready`} className="mb-8">
          <div className="space-y-2">
            {queue.ready.map(t => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3 rounded-md border border-emerald-700/30 bg-emerald-950/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-emerald-300 shrink-0">{t.localId}</span>
                    <span className={cn("text-[10px] font-medium", IMPL_BADGE[t.implementationType ?? "BACKEND"])}>
                      {t.implementationType}
                    </span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto shrink-0">
                      {t.effort}sp
                    </span>
                  </div>
                  <div className="text-xs text-[hsl(var(--foreground))] font-medium mb-1">{t.title}</div>
                  {t.description && (
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed line-clamp-2">
                      {t.description}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                    {t.stream && <span>{t.stream.name}</span>}
                    {t.wave && <span>Wave {t.wave.order}: {t.wave.name}</span>}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <div className={cn("h-1.5 w-1.5 rounded-full", COMPLEXITY_DOT[t.complexity ?? "MEDIUM"])} />
                      <span>{t.complexity}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CockpitSection>
      )}

      {/* BLOCKED TASKS */}
      {queue && queue.blocked.length > 0 && (
        <CockpitSection label={`Blocked — ${queue.blocked.length} Tasks`} className="mb-8">
          <div className="space-y-2">
            {queue.blocked.map(t => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3 rounded-md border border-red-700/30 bg-red-950/10">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-red-300 shrink-0">{t.localId}</span>
                    <span className={cn("text-[10px] font-medium", IMPL_BADGE[t.implementationType ?? "AUTH"])}>
                      {t.implementationType}
                    </span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto shrink-0">
                      {t.effort}sp
                    </span>
                  </div>
                  <div className="text-xs text-[hsl(var(--foreground))] font-medium mb-1">{t.title}</div>
                  {t.blockingDependencies.length > 0 && (
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      External blocker — resolve before this task can proceed
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CockpitSection>
      )}

      {/* NOT READY QUEUE */}
      {queue && queue.notReady.length > 0 && (
        <CockpitSection label={`Not Ready — ${queue.notReady.length} Tasks`}>
          <div className="divide-y divide-white/[0.03]">
            {queue.notReady.map(t => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-2.5">
                <Clock className="h-3 w-3 text-[hsl(var(--muted-foreground)/0.5)] mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] shrink-0">{t.localId}</span>
                    <span className="text-xs text-[hsl(var(--foreground)/0.7)] truncate">{t.title}</span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto shrink-0">{t.effort}sp</span>
                  </div>
                  {t.blockingDependencies.length > 0 && (
                    <div className="text-[10px] text-[hsl(var(--muted-foreground)/0.6)] mt-0.5">
                      Waiting on: {t.blockingDependencies.map(d => d.blockingTask.localId).join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CockpitSection>
      )}
    </div>
  )
}
