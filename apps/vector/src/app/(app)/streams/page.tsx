import { getExecutionStreams, getTopologyPressure } from "@/app/actions/orchestration"
import { CockpitSection, CockpitEmpty } from "@/components/dashboard/CockpitSection"
import { cn } from "@/lib/utils"
import { GitFork } from "lucide-react"

const COLOR_MAP: Record<string, string> = {
  purple:  "border-purple-700/50 bg-purple-950/20",
  blue:    "border-blue-700/50 bg-blue-950/20",
  amber:   "border-amber-700/50 bg-amber-950/20",
  green:   "border-green-700/50 bg-green-950/20",
  cyan:    "border-cyan-700/50 bg-cyan-950/20",
  violet:  "border-violet-700/50 bg-violet-950/20",
  pink:    "border-pink-700/50 bg-pink-950/20",
  orange:  "border-orange-700/50 bg-orange-950/20",
  red:     "border-red-700/50 bg-red-950/20",
  slate:   "border-slate-700/50 bg-slate-900/20",
}

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

const CRITICALITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-amber-400",
  MEDIUM:   "bg-sky-400",
  LOW:      "bg-slate-500",
}

const PRESSURE_BADGE: Record<string, string> = {
  HIGH:   "text-red-400",
  MEDIUM: "text-amber-400",
  LOW:    "text-emerald-400",
}

export default async function StreamsPage() {
  let streams: Awaited<ReturnType<typeof getExecutionStreams>> = []
  let pressure: Awaited<ReturnType<typeof getTopologyPressure>> | null = null
  let dbError = false

  try {
    ;[streams, pressure] = await Promise.all([
      getExecutionStreams(),
      getTopologyPressure(),
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
            <GitFork className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
              Execution Streams
            </h1>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            SG2 orchestration streams — 10 parallel execution lanes, {pressure?.totalSystems ?? 0} core systems, {pressure?.totalDeps ?? 0} dependencies
          </p>
        </div>
        {pressure && (
          <div className="flex items-center gap-4 text-xs">
            <span className={cn("font-medium", PRESSURE_BADGE[pressure.orchestrationPressure])}>
              {pressure.orchestrationPressure} orchestration pressure
            </span>
            <span className="text-[hsl(var(--muted-foreground)/0.5)]">·</span>
            <span className="text-[hsl(var(--muted-foreground))]">
              {pressure.criticalDeps} critical deps
            </span>
          </div>
        )}
      </div>

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      )}

      {/* Pressure summary */}
      {pressure && (pressure.overloadedDomains.length > 0 || pressure.overloadedStreams.length > 0) && (
        <div className="mb-8 rounded-lg border border-amber-900/30 bg-amber-950/10 px-5 py-4">
          <p className="text-xs font-medium text-amber-400 mb-2">Topology pressure detected</p>
          <div className="flex flex-wrap gap-3">
            {pressure.overloadedStreams.map((s) => (
              <span key={s.name} className="text-xs text-[hsl(var(--muted-foreground))]">
                Stream <span className="text-amber-300">{s.name}</span> — {s.count} systems (high load)
              </span>
            ))}
            {pressure.overloadedDomains.map((d) => (
              <span key={d.name} className="text-xs text-[hsl(var(--muted-foreground))]">
                Domain <span className="text-amber-300">{d.name}</span> — {d.count} systems
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Streams grid */}
      <div className="grid grid-cols-2 gap-4">
        {streams.map((stream) => {
          const color      = stream.color ?? "slate"
          const cardStyle  = COLOR_MAP[color] ?? COLOR_MAP.slate
          const dotStyle   = COLOR_DOT[color] ?? COLOR_DOT.slate
          const systemCount = stream.coreSystems.length
          const subCount    = stream.subetaps.length
          const isLoaded    = pressure?.overloadedStreams.some(s => s.name === stream.name)

          return (
            <div
              key={stream.id}
              className={cn("rounded-lg border px-5 py-4", cardStyle)}
            >
              {/* Stream header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", dotStyle)} />
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    {stream.name}
                  </p>
                  {isLoaded && (
                    <span className="text-[9px] uppercase tracking-widest text-amber-400">HIGH LOAD</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                  {systemCount > 0 && <span>{systemCount} sys</span>}
                  {subCount > 0 && <span>{subCount} subetaps</span>}
                </div>
              </div>

              {/* Description */}
              {stream.description && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">{stream.description}</p>
              )}

              {/* Core systems */}
              {systemCount > 0 ? (
                <div className="space-y-1.5">
                  {stream.coreSystems.map(s => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", CRITICALITY_DOT[s.criticality] ?? "bg-slate-500")} />
                      <span className="text-[11px] text-[hsl(var(--foreground)/0.85)]">{s.name}</span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.5)] ml-auto">
                        {s.phase?.name ?? "—"}
                      </span>
                      {s.isBlocking && (
                        <span className="text-[9px] text-red-400 shrink-0">blocking</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground)/0.4)] italic">No systems assigned</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
