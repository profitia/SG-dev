import { getTaskReadinessMatrix, getExecutionReadiness } from "@/app/actions/execution"
import { CockpitSection } from "@/components/dashboard/CockpitSection"
import { cn } from "@/lib/utils"
import { ClipboardCheck } from "lucide-react"

const READINESS_CONFIG: Record<string, { label: string; badge: string; row: string }> = {
  READY:       { label: "Ready",       badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-700/40", row: "border-emerald-700/20 bg-emerald-950/5" },
  BLOCKED:     { label: "Blocked",     badge: "bg-red-500/10 text-red-400 border border-red-700/40",             row: "border-red-700/20 bg-red-950/5" },
  IN_PROGRESS: { label: "In Progress", badge: "bg-blue-500/10 text-blue-400 border border-blue-700/40",          row: "border-blue-700/20 bg-blue-950/5" },
  VALIDATION:  { label: "Validation",  badge: "bg-violet-500/10 text-violet-400 border border-violet-700/40",    row: "border-violet-700/20 bg-violet-950/5" },
  PLANNING:    { label: "Planning",    badge: "bg-amber-500/10 text-amber-400 border border-amber-700/40",        row: "border-amber-700/20 bg-amber-950/5" },
  NOT_READY:   { label: "Not Ready",   badge: "bg-slate-800/60 text-slate-500 border border-slate-700/30",       row: "" },
  COMPLETE:    { label: "Complete",    badge: "bg-violet-500/10 text-violet-400 border border-violet-700/40",     row: "border-violet-700/20 bg-violet-950/5" },
}

const COMPLEXITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-amber-400",
  MEDIUM:   "bg-sky-400",
  LOW:      "bg-slate-500",
}

const IMPL_COLOR: Record<string, string> = {
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

const READINESS_ORDER = ["READY", "BLOCKED", "IN_PROGRESS", "VALIDATION", "PLANNING", "NOT_READY", "COMPLETE"]

export default async function TaskReadinessPage() {
  let matrix: Awaited<ReturnType<typeof getTaskReadinessMatrix>> | null = null
  let readiness: Awaited<ReturnType<typeof getExecutionReadiness>> | null = null
  let dbError = false

  try {
    ;[matrix, readiness] = await Promise.all([
      getTaskReadinessMatrix(),
      getExecutionReadiness(),
    ])
  } catch {
    dbError = true
  }

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-1">
          <ClipboardCheck className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Task Readiness
          </h1>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Full implementation readiness matrix — {readiness?.totalTasks ?? 0} tasks across 7 readiness states
        </p>
      </div>

      {dbError && (
        <div className="rounded-md border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-400 mb-8">
          DB error — could not load readiness matrix.
        </div>
      )}

      {/* Readiness Stats */}
      {readiness && (
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-10">
          {READINESS_ORDER.map(state => {
            const cfg = READINESS_CONFIG[state]
            const count = matrix?.byReadiness[state as keyof typeof matrix.byReadiness]?.length ?? 0
            return (
              <div key={state} className="rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 text-center">
                <div className="text-base font-semibold tabular-nums text-[hsl(var(--foreground))]">{count}</div>
                <div className="text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5 uppercase tracking-wide">{cfg.label}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Readiness Groups */}
      {matrix && READINESS_ORDER.map(state => {
        const tasks = matrix.byReadiness[state as keyof typeof matrix.byReadiness] ?? []
        if (tasks.length === 0) return null
        const cfg = READINESS_CONFIG[state]

        return (
          <CockpitSection
            key={state}
            label={`${cfg.label} — ${tasks.length} tasks`}
            className="mb-6"
          >
            <div className="space-y-1">
              {tasks.map(t => (
                <div key={t.id} className={cn(
                  "flex items-start gap-3 px-4 py-2.5 rounded-md border",
                  cfg.row || "border-white/[0.04]"
                )}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] shrink-0 w-16">{t.localId}</span>
                      <span className={cn("text-[10px] font-medium shrink-0", IMPL_COLOR[t.implementationType ?? "BACKEND"])}>
                        {t.implementationType}
                      </span>
                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        <div className={cn("h-1.5 w-1.5 rounded-full", COMPLEXITY_DOT[t.complexity ?? "MEDIUM"])} />
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{t.effort}sp</span>
                      </div>
                    </div>
                    <div className="text-xs text-[hsl(var(--foreground)/0.85)] font-medium mb-0.5">{t.title}</div>
                    <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground)/0.7)]">
                      {t.stream && <span>{t.stream.name}</span>}
                      {t.wave && <span>Wave {t.wave.order}</span>}
                      {t.blockingDependencies && t.blockingDependencies.length > 0 && (
                        <span className="text-amber-500/70">
                          deps: {(t.blockingDependencies as any[]).map((d: any) => d.blockingTask.localId).join(", ")}
                        </span>
                      )}
                      {t.blockedDependencies && t.blockedDependencies.length > 0 && (
                        <span className="text-sky-500/70">
                          unlocks: {(t.blockedDependencies as any[]).map((d: any) => d.blockedTask.localId).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CockpitSection>
        )
      })}
    </div>
  )
}
