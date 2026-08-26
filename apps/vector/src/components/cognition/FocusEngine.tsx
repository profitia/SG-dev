// VECTOR — Focus Engine UI
// "What should I focus on now?" — suggestions only, user remains in control.

import { cn } from "@/lib/utils"
import type { FocusSuggestion, HealthLevel } from "@/lib/cognition/signals"
import { CockpitSection, CockpitEmpty } from "@/components/dashboard/CockpitSection"
import { Target } from "lucide-react"

const healthBorder: Record<HealthLevel, string> = {
  healthy: "border-[hsl(var(--border)/0.5)]",
  warning: "border-amber-900/30",
  critical: "border-red-900/30",
}

const healthBg: Record<HealthLevel, string> = {
  healthy: "",
  warning: "bg-amber-950/10",
  critical: "bg-red-950/10",
}

interface FocusEngineProps {
  suggestions: FocusSuggestion[]
  overallHealth: HealthLevel
}

export function FocusEngine({ suggestions, overallHealth }: FocusEngineProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-6 py-5 mb-10",
        healthBorder[overallHealth],
        healthBg[overallHealth]
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Target className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Focus Engine
        </span>
        <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.5)] ml-2">
          suggestions · you decide
        </span>
      </div>

      {suggestions.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground)/0.5)] italic">
          No focus suggestions. Execution state looks clear.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="rounded-md border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] px-3.5 py-3 space-y-1"
            >
              <p className="text-sm text-[hsl(var(--foreground))] leading-snug font-medium">
                {s.title}
              </p>
              <div className="flex items-center gap-2">
                {s.projectName && (
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {s.projectName}
                  </span>
                )}
                {s.projectName && (
                  <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.4)]">·</span>
                )}
                <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.7)]">
                  {s.reason}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
