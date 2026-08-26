import Link from "next/link"
import { getDashboardData } from "@/app/actions/tasks"
import { getCognitionOutput } from "@/app/actions/cognition"
import { getExecutionReadiness, getActiveBuildThread } from "@/app/actions/execution"
import { StatusBadge, TypeBadge } from "@/components/tasks/TaskBadges"
import { CockpitSection, CockpitEmpty } from "@/components/dashboard/CockpitSection"
import { CognitionSection } from "@/components/cognition/CognitionSection"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { AlertOctagon, Clock, TrendingDown, ArrowRight, Zap, PlayCircle, CheckCircle2, Lock } from "lucide-react"
import { ProjectStatus, Priority } from "@/types"
import { formatDistanceToNow } from "date-fns"

const priorityRing: Record<Priority, string> = {
  CRITICAL: "border-l-2 border-l-red-500",
  HIGH: "border-l-2 border-l-amber-500",
  MEDIUM: "border-l-transparent border-l-2",
  LOW: "border-l-transparent border-l-2",
}

const statusDot: Record<ProjectStatus, string> = {
  ACTIVE: "bg-emerald-400",
  PAUSED: "bg-amber-400",
  DONE: "bg-slate-500",
  ARCHIVED: "bg-slate-700",
}

export default async function DashboardPage() {
  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null
  let dbError = false

  try {
    data = await getDashboardData()
  } catch {
    dbError = true
  }

  // Run cognition in parallel — graceful degradation if DB fails
  let cognition: Awaited<ReturnType<typeof getCognitionOutput>> | null = null
  let execReadiness: Awaited<ReturnType<typeof getExecutionReadiness>> | null = null
  let buildThread: Awaited<ReturnType<typeof getActiveBuildThread>> | null = null
  if (!dbError) {
    try {
      ;[cognition, execReadiness, buildThread] = await Promise.all([
        getCognitionOutput(),
        getExecutionReadiness(),
        getActiveBuildThread(),
      ])
    } catch {
      // non-fatal — sections will be hidden
    }
  }

  const activeProjects = data?.projects.filter((p) => p.status === "ACTIVE") ?? []
  const activeTasks = data?.activeTasks ?? []
  const blockers = data?.blockers ?? []
  const recentTasks = data?.recentTasks ?? []
  const staleTasks = data?.staleTasks ?? []
  const etaps = data?.etaps ?? []
  const allProjects = data?.projects ?? []

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className="mb-10 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Execution State
          </h1>
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            <span className="text-[hsl(var(--foreground))] font-medium">{activeProjects.length}</span>
            {" "}active projects
          </span>
          <span>
            <span className="text-[hsl(var(--foreground))] font-medium">{activeTasks.length}</span>
            {" "}in progress
          </span>
          {blockers.length > 0 && (
            <span className="text-red-400">
              <span className="font-medium">{blockers.length}</span>
              {" "}blocked
            </span>
          )}
        </div>
      </div>

      {dbError && (
        <div className="mb-8 rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            Run <code className="font-mono text-amber-400/80">npx prisma migrate dev</code> and <code className="font-mono text-amber-400/80">npm run db:seed</code>
          </p>
        </div>
      )}

      {/* 2-column cockpit layout */}
      <div className="grid grid-cols-[1fr_340px] gap-12">

        {/* Left column — main execution stream */}
        <div className="space-y-10">

          {/* Current Focus */}
          <CockpitSection label="Current Focus" count={activeTasks.length}>
            {activeTasks.length === 0 ? (
              <CockpitEmpty label="No tasks in progress" />
            ) : (
              <div className="space-y-0.5">
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "group flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-[hsl(var(--accent))] transition-colors",
                      priorityRing[task.priority]
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TypeBadge type={task.type} />
                      <span className="text-sm text-[hsl(var(--foreground))] truncate">{task.title}</span>
                    </div>
                    <div className="shrink-0 flex items-center gap-3 ml-4">
                      {task.project && (
                        <Link
                          href={`/projects/${task.project.slug}`}
                          className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          {task.project.name}
                        </Link>
                      )}
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CockpitSection>

          {/* Active Projects */}
          <CockpitSection label="Active Projects" count={activeProjects.length}>
            {activeProjects.length === 0 ? (
              <CockpitEmpty label="No active projects" />
            ) : (
              <div className="space-y-px">
                {activeProjects.map((project) => {
                  const projectBlockers = blockers.filter((b) => b.projectId === project.id)
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.slug}`}
                      className="group flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-[hsl(var(--accent))] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDot[project.status])} />
                        <span className="text-sm text-[hsl(var(--foreground))] truncate">{project.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        {projectBlockers.length > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-red-400">
                            <AlertOctagon className="h-3 w-3" />
                            {projectBlockers.length}
                          </span>
                        )}
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {project._count?.tasks ?? 0} tasks
                        </span>
                        <ArrowRight className="h-3 w-3 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CockpitSection>

          {/* Active ETAPs */}
          {etaps.length > 0 && (
            <CockpitSection label="Active ETAPs" count={etaps.length}>
              <div className="space-y-px">
                {etaps.map((etap) => (
                  <Link
                    key={etap.id}
                    href={`/projects/${etap.project?.slug}`}
                    className="group flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-[hsl(var(--accent))] transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-[hsl(var(--foreground))] truncate block">{etap.name}</span>
                      {etap.project && (
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{etap.project.name}</span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))] ml-4">
                      {etap._count?.tasks ?? 0} tasks
                    </span>
                  </Link>
                ))}
              </div>
            </CockpitSection>
          )}

          {/* Recent Activity */}
          {recentTasks.length > 0 && (
            <CockpitSection label="Recently Updated">
              <div className="space-y-px">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-[hsl(var(--accent))] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TypeBadge type={task.type} />
                      <span className="text-sm text-[hsl(var(--foreground))] truncate">{task.title}</span>
                    </div>
                    <div className="shrink-0 flex items-center gap-3 ml-4">
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                      </span>
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CockpitSection>
          )}
        </div>

        {/* Right column — operational signals */}
        <div className="space-y-10">

          {/* Blockers */}
          <CockpitSection
            label="Blockers"
            count={blockers.length}
            action={
              blockers.length > 0 ? (
                <Link href="/blockers" className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                  View all
                </Link>
              ) : undefined
            }
          >
            {blockers.length === 0 ? (
              <CockpitEmpty label="No active blockers" />
            ) : (
              <div className="space-y-1.5">
                {blockers.map((blocker) => (
                  <div
                    key={blocker.id}
                    className="rounded-md border border-red-900/40 bg-red-950/15 px-3 py-2.5"
                  >
                    <p className="text-sm text-[hsl(var(--foreground))] leading-snug">{blocker.title}</p>
                    {blocker.project && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{blocker.project.name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CockpitSection>

          {/* Drifted / Stale */}
          <CockpitSection
            label="Drifted Areas"
            count={staleTasks.length}
          >
            {staleTasks.length === 0 ? (
              <CockpitEmpty label="All areas current" />
            ) : (
              <div className="space-y-0.5">
                {staleTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-2.5 rounded-md px-3 py-2.5 hover:bg-[hsl(var(--accent))] transition-colors"
                  >
                    <TrendingDown className="h-3.5 w-3.5 text-amber-500/70 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-[hsl(var(--foreground))] truncate">{task.title}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        {task.project?.name} · {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CockpitSection>

          {/* Execution Readiness Widget */}
          {execReadiness && (
            <CockpitSection
              label="Execution Readiness"
              action={
                <Link href="/execution-queue" className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                  View queue →
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-2 px-3 pt-2 pb-3">
                {[
                  { label: "Ready",   value: execReadiness.readyTasks,   color: "text-emerald-400" },
                  { label: "Blocked", value: execReadiness.blockedTasks,  color: "text-red-400" },
                  { label: "Total",   value: execReadiness.totalTasks,    color: "text-[hsl(var(--foreground))]" },
                  { label: "Effort",  value: `${execReadiness.readyEffort}sp`, color: "text-sky-400" },
                ].map(s => (
                  <div key={s.label} className="rounded border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                    <div className={cn("text-base font-semibold tabular-nums", s.color)}>{s.value}</div>
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5 uppercase tracking-wide">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 px-3 pb-3">
                <PlayCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {execReadiness.readyTasks} tasks ready to build · {execReadiness.criticalTasks} critical
                </span>
              </div>
            </CockpitSection>
          )}

          {/* Backlog Signal */}
          <CockpitSection
            label="Backlog"
            action={
              <Link href="/backlog" className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                View all →
              </Link>
            }
          >
            <div className="space-y-1">
              {allProjects.filter(p => p.status === "ACTIVE").map((project) => {
                const taskCount = project._count?.tasks ?? 0
                return (
                  <div key={project.id} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">{project.name}</span>
                    <span className="text-xs text-[hsl(var(--foreground))] font-medium shrink-0 ml-2">
                      {taskCount}
                    </span>
                  </div>
                )
              })}
            </div>
          </CockpitSection>

        </div>
      </div>

      {/* Execution Cognition — full-width below the cockpit grid */}
      {cognition && <CognitionSection cognition={cognition} />}

      {/* BUILD EXECUTION STATUS — full-width, ETAP 10 active thread */}
      {buildThread && (
        <div className="mt-12">
          {/* Section header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                  Build Execution Status
                </span>
              </div>
              <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
                {buildThread.etap10?.name ?? "ETAP 10 — Organization System"}
              </h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
              <span>{buildThread.wave?.name}</span>
              <Link href="/execution-queue" className="text-sky-400 hover:text-sky-300 transition-colors">
                Full queue →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_300px] gap-6">

            {/* Current BUILD Node */}
            <CockpitSection label="Current BUILD Node">
              {buildThread.currentBuildNode ? (
                <div className="px-4 py-4">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="h-7 w-7 rounded-md bg-emerald-500/10 border border-emerald-700/40 flex items-center justify-center shrink-0">
                      <PlayCircle className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono text-emerald-400 font-medium">
                          {buildThread.currentBuildNode.localId}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-700/30">
                          READY
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
                        {buildThread.currentBuildNode.title}
                      </div>
                    </div>
                  </div>
                  {buildThread.currentBuildNode.description && (
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed mb-4 line-clamp-3">
                      {buildThread.currentBuildNode.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))]">
                    <span className="text-amber-400 font-medium">
                      {buildThread.currentBuildNode.complexity} complexity
                    </span>
                    <span>·</span>
                    <span>{buildThread.currentBuildNode.effort} sp</span>
                    <span>·</span>
                    <span>ARCHITECTURE</span>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-4 text-xs text-[hsl(var(--muted-foreground)/0.5)]">No active build node</div>
              )}
            </CockpitSection>

            {/* ORG Task Pipeline */}
            <CockpitSection label="Organization System Pipeline">
              <div className="divide-y divide-white/[0.03]">
                {buildThread.orgTasks.map((t, i) => {
                  const readinessCfg = {
                    READY:       { dot: "bg-emerald-500", label: "text-emerald-400" },
                    BLOCKED:     { dot: "bg-red-500",     label: "text-red-400"     },
                    NOT_READY:   { dot: "bg-slate-600",   label: "text-slate-500"   },
                    IN_PROGRESS: { dot: "bg-blue-500",    label: "text-blue-400"    },
                    COMPLETE:    { dot: "bg-violet-500",  label: "text-violet-400"  },
                    PLANNING:    { dot: "bg-amber-500",   label: "text-amber-400"   },
                    VALIDATION:  { dot: "bg-violet-400",  label: "text-violet-300"  },
                  }[t.readiness ?? "NOT_READY"] ?? { dot: "bg-slate-600", label: "text-slate-500" }
                  const isActive = t.id === buildThread.currentBuildNode?.id

                  return (
                    <div key={t.id} className={cn("flex items-center gap-3 px-4 py-3", isActive && "bg-emerald-950/10")}>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground)/0.5)] w-4">{i + 1}</span>
                        <div className={cn("h-1.5 w-1.5 rounded-full", readinessCfg.dot)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] shrink-0">{t.localId}</span>
                          <span className={cn("text-xs truncate", isActive ? "text-[hsl(var(--foreground))] font-medium" : "text-[hsl(var(--foreground)/0.7)]")}>
                            {t.title}
                          </span>
                        </div>
                        {t.blockingDependencies.length > 0 && t.readiness === "NOT_READY" && (
                          <div className="text-[9px] text-[hsl(var(--muted-foreground)/0.5)] mt-0.5">
                            after {t.blockingDependencies.map(d => d.blockingTask.localId).join(", ")}
                          </div>
                        )}
                      </div>
                      <span className={cn("text-[10px] font-medium shrink-0", readinessCfg.label)}>
                        {t.readiness?.replace("_", " ")}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CockpitSection>

            {/* Deployment Status + Blockers */}
            <div className="space-y-4">
              <CockpitSection label="Deployment">
                <div className="divide-y divide-white/[0.03]">
                  {Object.entries(buildThread.deploymentStatus).map(([key, value]) => {
                    const isOk = (value as string).includes("COMPLETE") || (value as string).includes("OPERATIONAL")
                    const isPending = (value as string).includes("PENDING")
                    return (
                      <div key={key} className="flex items-center justify-between px-3 py-2">
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))] capitalize">{key}</span>
                        <span className={cn(
                          "text-[9px] font-medium",
                          isOk ? "text-emerald-400" : isPending ? "text-amber-400" : "text-slate-500"
                        )}>
                          {isOk ? "✓" : isPending ? "⏳" : "○"} {(value as string).split(" — ")[0]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CockpitSection>

              <CockpitSection label="Blockers">
                <div className="space-y-1.5 px-3 py-2">
                  {buildThread.externalBlockers.map(b => (
                    <div key={b.id} className="flex items-start gap-2 p-2 rounded border border-red-900/30 bg-red-950/10">
                      <Lock className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9px] font-mono text-red-400">{b.id}</span>
                          <span className={cn(
                            "text-[8px] px-1 rounded font-medium",
                            b.severity === "CRITICAL" ? "bg-red-900/50 text-red-300" : "bg-amber-900/50 text-amber-300"
                          )}>{b.severity}</span>
                        </div>
                        <div className="text-[10px] text-[hsl(var(--foreground)/0.8)] font-medium">{b.title}</div>
                        <div className="text-[9px] text-[hsl(var(--muted-foreground)/0.6)] mt-0.5">{b.impact}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CockpitSection>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
