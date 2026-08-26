import { getCriticalPath, getTopologyPressure } from "@/app/actions/orchestration"
import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react"

const COLOR_DOT: Record<string, string> = {
  purple:  "bg-purple-500",
  blue:    "bg-blue-500",
  amber:   "bg-amber-500",
  green:   "bg-green-500",
  cyan:    "bg-cyan-500",
  violet:  "bg-violet-500",
  pink:    "bg-pink-500",
  orange:  "bg-orange-500",
  red:     "bg-red-500",
  slate:   "bg-slate-400",
}

const CRITICALITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400 border-red-900/40",
  HIGH:     "text-amber-400 border-amber-900/40",
  MEDIUM:   "text-sky-400 border-sky-900/40",
  LOW:      "text-slate-400 border-slate-700/40",
}

export default async function CriticalPathPage() {
  let criticalPath: Awaited<ReturnType<typeof getCriticalPath>> = []
  let pressure: Awaited<ReturnType<typeof getTopologyPressure>> | null = null
  let dbError = false

  try {
    ;[criticalPath, pressure] = await Promise.all([
      getCriticalPath(),
      getTopologyPressure(),
    ])
  } catch {
    dbError = true
  }

  const blockers = criticalPath.filter(n => n.isBlocker)
  const nonBlockers = criticalPath.filter(n => !n.isBlocker)

  return (
    <div className="px-8 py-8 max-w-[900px] mx-auto">

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-1">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Critical Path
          </h1>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          SG2 execution sequencing — what must exist before global progress continues
        </p>
      </div>

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      )}

      {/* Summary stats */}
      {pressure && (
        <div className="mb-10 grid grid-cols-4 gap-3">
          {[
            { label: "Path length",          value: pressure.criticalPathLen },
            { label: "Blocking nodes",        value: pressure.blockers,         alert: pressure.blockers > 5 },
            { label: "Critical deps",         value: pressure.criticalDeps,     alert: pressure.criticalDeps > 8 },
            { label: "Orchestration pressure",value: pressure.orchestrationPressure, isText: true, alert: pressure.orchestrationPressure === "HIGH" },
          ].map(({ label, value, alert, isText }) => (
            <div
              key={label}
              className={cn(
                "rounded-lg border px-4 py-3",
                alert ? "border-amber-900/40 bg-amber-950/10" : "border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]"
              )}
            >
              <p className={cn("text-sm font-semibold", alert ? "text-amber-400" : "text-[hsl(var(--foreground))]")}>
                {isText ? String(value) : String(value)}
              </p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── PHASE 1: Hard blockers ─────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          <h2 className="text-xs font-medium uppercase tracking-widest text-red-400">
            Hard Blockers — must complete before anything else
          </h2>
        </div>

        <div className="relative space-y-2">
          <div className="absolute left-[15px] top-4 bottom-4 w-px bg-red-900/30" />
          {blockers.map((node, i) => {
            const sys = node.system
            const streamColor = sys?.stream?.color ?? "slate"
            const streamDot   = COLOR_DOT[streamColor] ?? COLOR_DOT.slate
            const critStyle   = sys ? CRITICALITY_COLOR[sys.criticality] : CRITICALITY_COLOR.MEDIUM
            const deps        = sys?.targetDependencies ?? []

            return (
              <div key={node.id} className="relative flex gap-4">
                {/* Node number */}
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-800/50 bg-[hsl(var(--card))]">
                  <span className="text-[11px] font-semibold text-red-400">{node.order}</span>
                </div>

                {/* Node card */}
                <div className="flex-1 rounded-md border border-red-900/30 bg-red-950/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {sys && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", streamDot)} />}
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{node.label}</p>
                      </div>
                      {node.rationale && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                          {node.rationale}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sys && (
                        <span className={cn("text-[9px] uppercase tracking-widest border rounded px-1.5 py-0.5", critStyle)}>
                          {sys.criticality}
                        </span>
                      )}
                    </div>
                  </div>
                  {sys && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                      <span>Domain: {sys.domain?.name ?? "—"}</span>
                      <span>·</span>
                      <span>Stream: {sys.stream?.label ?? "—"}</span>
                      <span>·</span>
                      <span>Phase: {sys.phase?.name ?? "—"}</span>
                      {deps.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{deps.length} downstream</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── PHASE 2: Sequenced execution ──────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <h2 className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            Sequenced Execution — ordered by dependency chain
          </h2>
        </div>

        <div className="relative space-y-2">
          <div className="absolute left-[15px] top-4 bottom-4 w-px bg-[hsl(var(--border)/0.4)]" />
          {nonBlockers.map((node) => {
            const sys = node.system
            const streamColor = sys?.stream?.color ?? "slate"
            const streamDot   = COLOR_DOT[streamColor] ?? COLOR_DOT.slate
            const critStyle   = sys ? CRITICALITY_COLOR[sys.criticality] : CRITICALITY_COLOR.MEDIUM

            return (
              <div key={node.id} className="relative flex gap-4">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                  <span className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">{node.order}</span>
                </div>

                <div className="flex-1 rounded-md border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {sys && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", streamDot)} />}
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{node.label}</p>
                      </div>
                      {node.rationale && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                          {node.rationale}
                        </p>
                      )}
                    </div>
                    {sys && (
                      <span className={cn("text-[9px] uppercase tracking-widest border rounded px-1.5 py-0.5 shrink-0", critStyle)}>
                        {sys.criticality}
                      </span>
                    )}
                  </div>
                  {sys && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                      <span>Stream: {sys.stream?.label ?? "—"}</span>
                      <span>·</span>
                      <span>Phase: {sys.phase?.name ?? "—"}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
