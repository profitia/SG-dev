// VECTOR — Execution Signals Panel
// Ambient, calm signals display. No notification center. No gamification.

import { cn } from "@/lib/utils"
import type { Signal, HealthLevel, SignalType } from "@/lib/cognition/signals"

// ---- Health indicator -------------------------------------------------------

const healthColor: Record<HealthLevel, string> = {
  healthy: "bg-emerald-400",
  warning: "bg-amber-400",
  critical: "bg-red-500",
}

const healthLabel: Record<HealthLevel, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
}

const healthTextColor: Record<HealthLevel, string> = {
  healthy: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
}

export function HealthDot({ level }: { level: HealthLevel }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn("h-1.5 w-1.5 rounded-full shrink-0", healthColor[level])}
      />
      <span className={cn("text-[10px] font-medium", healthTextColor[level])}>
        {healthLabel[level]}
      </span>
    </span>
  )
}

// ---- Signal type label -------------------------------------------------------

const signalTypeLabel: Record<SignalType, string> = {
  drift: "Drift",
  overload: "Overload",
  blocker_pressure: "Blockers",
  fragmentation: "Fragment",
  priority_conflict: "Priority",
}

const signalDot: Record<HealthLevel, string> = {
  healthy: "bg-emerald-400/60",
  warning: "bg-amber-400/70",
  critical: "bg-red-500",
}

// ---- Signals list -----------------------------------------------------------

interface SignalsPanelProps {
  signals: Signal[]
  maxSignals?: number
  className?: string
}

export function SignalsPanel({
  signals,
  maxSignals = 6,
  className,
}: SignalsPanelProps) {
  const visible = signals
    .sort((a, b) => {
      const order: Record<HealthLevel, number> = { critical: 0, warning: 1, healthy: 2 }
      return order[a.level] - order[b.level]
    })
    .slice(0, maxSignals)

  if (visible.length === 0) {
    return (
      <p className={cn("text-xs text-[hsl(var(--muted-foreground)/0.5)] py-1 italic", className)}>
        No active signals
      </p>
    )
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {visible.map((signal, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span
            className={cn(
              "mt-[5px] h-1.5 w-1.5 rounded-full shrink-0",
              signalDot[signal.level]
            )}
          />
          <div className="min-w-0">
            <p className="text-xs text-[hsl(var(--foreground))] leading-snug">
              {signal.message}
            </p>
            {signal.projectName && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                {signal.projectName}
              </p>
            )}
          </div>
          <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground)/0.5)] mt-0.5 ml-auto pl-2">
            {signalTypeLabel[signal.type]}
          </span>
        </div>
      ))}
    </div>
  )
}
