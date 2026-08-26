// VECTOR — Execution Cognition Dashboard Section
// Strategic + minimal. Not surveillance. Not gamification.

import Link from "next/link"
import { cn } from "@/lib/utils"
import { CockpitSection, CockpitEmpty } from "@/components/dashboard/CockpitSection"
import { HealthDot, SignalsPanel } from "@/components/cognition/SignalsPanel"
import type { CognitionOutput, ProjectHealth } from "@/lib/cognition/signals"
import { Brain, ArrowUpRight } from "lucide-react"

// ---- Project health list ----------------------------------------------------

function ProjectHealthList({ healthList }: { healthList: ProjectHealth[] }) {
  if (healthList.length === 0) return <CockpitEmpty label="No projects" />

  return (
    <div className="space-y-1">
      {healthList.slice(0, 5).map((ph) => (
        <Link
          key={ph.projectId}
          href={`/projects/${ph.projectSlug}`}
          className="group flex items-center justify-between rounded-md px-3 py-2 hover:bg-[hsl(var(--accent))] transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <HealthDot level={ph.level} />
            <span className="text-xs text-[hsl(var(--foreground))] truncate">
              {ph.projectName}
            </span>
          </div>
          {ph.reasons.length > 0 && (
            <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))] ml-3 truncate max-w-[120px]">
              {ph.reasons[0]}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}

// ---- Recommendations list ---------------------------------------------------

function RecommendationsList({
  recommendations,
}: {
  recommendations: CognitionOutput["recommendations"]
}) {
  if (recommendations.length === 0) {
    return <CockpitEmpty label="No active recommendations" />
  }

  return (
    <div className="space-y-3">
      {recommendations.slice(0, 3).map((rec, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "mt-1 h-1.5 w-1.5 rounded-full shrink-0",
                rec.priority === "high" ? "bg-amber-400" : "bg-[hsl(var(--muted-foreground)/0.4)]"
              )}
            />
            <p className="text-xs font-medium text-[hsl(var(--foreground))] leading-snug">
              {rec.title}
            </p>
          </div>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed pl-4">
            {rec.reasoning}
          </p>
        </div>
      ))}
    </div>
  )
}

// ---- Main CognitionSection --------------------------------------------------

interface CognitionSectionProps {
  cognition: CognitionOutput
}

export function CognitionSection({ cognition }: CognitionSectionProps) {
  const { overallHealth, projectHealths, signals, recommendations } = cognition

  return (
    <div className="mt-12 pt-10 border-t border-[hsl(var(--border)/0.4)]">

      {/* Section header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <Brain className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            Execution Cognition
          </span>
          <HealthDot level={overallHealth} />
        </div>
        <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.5)]">
          deterministic · real-time
        </span>
      </div>

      {/* 3-column cognition grid */}
      <div className="grid grid-cols-3 gap-10">

        {/* Column 1 — Project Health */}
        <CockpitSection label="Project Health" count={projectHealths.length}>
          <ProjectHealthList healthList={projectHealths} />
        </CockpitSection>

        {/* Column 2 — Execution Signals */}
        <CockpitSection label="Signals" count={signals.length}>
          {signals.length === 0 ? (
            <CockpitEmpty label="No active signals" />
          ) : (
            <SignalsPanel signals={signals} maxSignals={5} />
          )}
        </CockpitSection>

        {/* Column 3 — Strategic Recommendations */}
        <CockpitSection label="Recommendations" count={recommendations.length}>
          <RecommendationsList recommendations={recommendations} />
        </CockpitSection>

      </div>
    </div>
  )
}
