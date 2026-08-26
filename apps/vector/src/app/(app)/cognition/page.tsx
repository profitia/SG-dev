import { getCognitionOutput } from "@/app/actions/cognition"
import { CockpitSection, CockpitEmpty } from "@/components/dashboard/CockpitSection"
import { HealthDot, SignalsPanel } from "@/components/cognition/SignalsPanel"
import { cn } from "@/lib/utils"
import { Brain } from "lucide-react"
import Link from "next/link"
import type { ProjectHealth } from "@/lib/cognition/signals"

export default async function CognitionPage() {
  let cognition: Awaited<ReturnType<typeof getCognitionOutput>> | null = null
  let dbError = false

  try {
    cognition = await getCognitionOutput()
  } catch {
    dbError = true
  }

  if (dbError || !cognition) {
    return (
      <div className="px-8 py-8 max-w-[1000px] mx-auto">
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      </div>
    )
  }

  const { overallHealth, projectHealths, signals, recommendations, focusSuggestions } = cognition

  const driftSignals = signals.filter((s) => s.type === "drift")
  const overloadSignals = signals.filter((s) => s.type === "overload" || s.type === "blocker_pressure")
  const fragSignals = signals.filter((s) => s.type === "fragmentation")
  const prioritySignals = signals.filter((s) => s.type === "priority_conflict")

  return (
    <div className="px-8 py-8 max-w-[1100px] mx-auto">

      {/* Header */}
      <div className="mb-10 flex items-baseline justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Brain className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
              Execution Cognition
            </h1>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Strategic execution health — deterministic, no AI hallucinations
          </p>
        </div>
        <HealthDot level={overallHealth} />
      </div>

      {/* Overall health banner */}
      {overallHealth !== "healthy" && (
        <div
          className={cn(
            "mb-10 rounded-lg border px-5 py-4",
            overallHealth === "critical"
              ? "border-red-900/40 bg-red-950/15"
              : "border-amber-900/30 bg-amber-950/10"
          )}
        >
          <p
            className={cn(
              "text-sm font-medium",
              overallHealth === "critical" ? "text-red-400" : "text-amber-400"
            )}
          >
            {overallHealth === "critical"
              ? "Execution is under pressure — address critical signals first"
              : "Execution has areas that need attention"}
          </p>
        </div>
      )}

      {/* 2-column main layout */}
      <div className="grid grid-cols-[1fr_360px] gap-12">

        {/* Left — Signals breakdown */}
        <div className="space-y-10">

          {/* Strategic Recommendations */}
          <CockpitSection label="Strategic Recommendations" count={recommendations.length}>
            {recommendations.length === 0 ? (
              <CockpitEmpty label="No active recommendations" />
            ) : (
              <div className="space-y-5">
                {recommendations.map((rec, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                          rec.priority === "high" ? "bg-amber-400" : "bg-[hsl(var(--muted-foreground)/0.4)]"
                        )}
                      />
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] leading-snug">
                        {rec.title}
                      </p>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed pl-5">
                      {rec.reasoning}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CockpitSection>

          {/* Focus Suggestions */}
          <CockpitSection label="Focus Now" count={focusSuggestions.length}>
            {focusSuggestions.length === 0 ? (
              <CockpitEmpty label="Execution state is clear" />
            ) : (
              <div className="space-y-2">
                {focusSuggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between rounded-md border border-[hsl(var(--border)/0.5)] px-3.5 py-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm text-[hsl(var(--foreground))] font-medium truncate">{s.title}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {s.projectName && <span className="mr-2">{s.projectName}</span>}
                        {s.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CockpitSection>

          {/* Signals by type */}
          {driftSignals.length > 0 && (
            <CockpitSection label="Drift" count={driftSignals.length}>
              <SignalsPanel signals={driftSignals} maxSignals={10} />
            </CockpitSection>
          )}
          {overloadSignals.length > 0 && (
            <CockpitSection label="Overload & Blocker Pressure" count={overloadSignals.length}>
              <SignalsPanel signals={overloadSignals} maxSignals={10} />
            </CockpitSection>
          )}
          {fragSignals.length > 0 && (
            <CockpitSection label="Fragmentation" count={fragSignals.length}>
              <SignalsPanel signals={fragSignals} maxSignals={10} />
            </CockpitSection>
          )}
          {prioritySignals.length > 0 && (
            <CockpitSection label="Priority Conflicts" count={prioritySignals.length}>
              <SignalsPanel signals={prioritySignals} maxSignals={10} />
            </CockpitSection>
          )}

        </div>

        {/* Right — Project Health */}
        <div>
          <CockpitSection label="Project Health" count={projectHealths.length}>
            {projectHealths.length === 0 ? (
              <CockpitEmpty label="No projects" />
            ) : (
              <div className="space-y-3">
                {projectHealths.map((ph) => (
                  <ProjectHealthCard key={ph.projectId} health={ph} />
                ))}
              </div>
            )}
          </CockpitSection>
        </div>

      </div>
    </div>
  )
}

// ---- Project Health Card ----------------------------------------------------

function ProjectHealthCard({ health }: { health: ProjectHealth }) {
  const barColor =
    health.level === "critical"
      ? "bg-red-500"
      : health.level === "warning"
      ? "bg-amber-400"
      : "bg-emerald-400"

  return (
    <Link
      href={`/projects/${health.projectSlug}`}
      className="block rounded-md border border-[hsl(var(--border)/0.5)] px-3.5 py-3 hover:bg-[hsl(var(--accent))] transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[hsl(var(--foreground))] truncate">
          {health.projectName}
        </span>
        <HealthDot level={health.level} />
      </div>

      {/* Score bar */}
      <div className="h-0.5 w-full rounded-full bg-[hsl(var(--border)/0.5)] mb-2.5">
        <div
          className={cn("h-0.5 rounded-full transition-all", barColor)}
          style={{ width: `${health.score}%` }}
        />
      </div>

      {health.reasons.length > 0 ? (
        <ul className="space-y-0.5">
          {health.reasons.slice(0, 3).map((r, i) => (
            <li key={i} className="text-[10px] text-[hsl(var(--muted-foreground))]">
              · {r}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[10px] text-[hsl(var(--muted-foreground)/0.5)] italic">No issues detected</p>
      )}
    </Link>
  )
}
