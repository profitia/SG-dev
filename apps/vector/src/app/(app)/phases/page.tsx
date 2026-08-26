import { getExecutionPhases } from "@/app/actions/orchestration"
import { cn } from "@/lib/utils"
import { Layers } from "lucide-react"

const STATUS_STYLES: Record<string, string> = {
  PLANNED:  "bg-slate-800/50 text-slate-400",
  ACTIVE:   "bg-emerald-900/30 text-emerald-400",
  COMPLETE: "bg-blue-900/30 text-blue-400",
}

const CRITICALITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-amber-400",
  MEDIUM:   "bg-sky-400",
  LOW:      "bg-slate-500",
}

export default async function PhasesPage() {
  let phases: Awaited<ReturnType<typeof getExecutionPhases>> = []
  let dbError = false

  try {
    phases = await getExecutionPhases()
  } catch {
    dbError = true
  }

  return (
    <div className="px-8 py-8 max-w-[1100px] mx-auto">

      {/* Header */}
      <div className="mb-10 flex items-baseline justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Layers className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
              Execution Phases
            </h1>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            SG2 canonical build sequence — 8 phases from Foundation to Production Hardening
          </p>
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {phases.length} phases
        </span>
      </div>

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      )}

      {/* Phase timeline */}
      <div className="relative space-y-4">
        {/* Vertical connector line */}
        <div className="absolute left-[19px] top-8 bottom-8 w-px bg-[hsl(var(--border)/0.4)]" />

        {phases.map((phase) => {
          const systemCount  = phase.coreSystems.length
          const etapCount    = phase.etaps.length
          const criticalSys  = phase.coreSystems.filter(s => s.criticality === "CRITICAL" || s.criticality === "HIGH").length
          const totalTasks   = phase.etaps.flatMap(e => e.tasks).length
          const doneTasks    = phase.etaps.flatMap(e => e.tasks).filter(t => t.status === "DONE").length
          const pct          = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

          return (
            <div key={phase.id} className="relative flex gap-5">
              {/* Phase number bubble */}
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <span className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
                  {phase.order}
                </span>
              </div>

              {/* Phase card */}
              <div className="flex-1 rounded-lg border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--card))] px-5 py-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                        {phase.name}
                      </p>
                      <span className={cn("text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded", STATUS_STYLES[phase.status] ?? STATUS_STYLES.PLANNED)}>
                        {phase.status}
                      </span>
                    </div>
                    {phase.description && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{phase.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                    <span>{systemCount} system{systemCount !== 1 ? "s" : ""}</span>
                    <span>{etapCount} ETAP{etapCount !== 1 ? "s" : ""}</span>
                    {totalTasks > 0 && (
                      <span className={pct === 100 ? "text-emerald-400" : ""}>{pct}% done</span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {totalTasks > 0 && (
                  <div className="mb-3 h-0.5 w-full rounded-full bg-[hsl(var(--border)/0.4)]">
                    <div
                      className="h-0.5 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}

                {/* Systems */}
                {systemCount > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {phase.coreSystems.map(s => (
                      <div
                        key={s.id}
                        className="flex items-center gap-1.5 rounded border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.5)] px-2 py-1"
                        title={s.description ?? ""}
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", CRITICALITY_DOT[s.criticality] ?? "bg-slate-500")} />
                        <span className="text-[11px] text-[hsl(var(--foreground)/0.8)]">{s.name}</span>
                        {s.isBlocking && (
                          <span className="text-[9px] text-red-400">blocking</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ETAPs linked */}
                {etapCount > 0 && (
                  <div className="mt-3 pt-3 border-t border-[hsl(var(--border)/0.3)] flex flex-wrap gap-1.5">
                    {phase.etaps.map(e => (
                      <span key={e.id} className="text-[10px] text-[hsl(var(--muted-foreground)/0.7)] bg-[hsl(var(--border)/0.2)] px-2 py-0.5 rounded">
                        {e.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
