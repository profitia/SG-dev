import { getActiveTasks, getBlockers, getBacklog } from "@/app/actions/tasks"
import { getCognitionOutput } from "@/app/actions/cognition"
import { StatusBadge, TypeBadge } from "@/components/tasks/TaskBadges"
import { CockpitSection, CockpitEmpty } from "@/components/dashboard/CockpitSection"
import { FocusEngine } from "@/components/cognition/FocusEngine"
import { SignalsPanel } from "@/components/cognition/SignalsPanel"
import { formatDistanceToNow } from "date-fns"
import { TrendingDown, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Priority } from "@/types"
import { db } from "@/lib/db"

const priorityBorder: Record<Priority, string> = {
  CRITICAL: "border-l-2 border-l-red-500",
  HIGH: "border-l-2 border-l-amber-500",
  MEDIUM: "border-l-transparent border-l-2",
  LOW: "border-l-transparent border-l-2",
}

async function getFocusData() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

  const [activeTasks, blockers, staleTasks, reviewTasks, recentlyDone] = await Promise.all([
    db.task.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      include: { project: { select: { name: true, slug: true } } },
    }),
    db.task.findMany({
      where: { status: "BLOCKED" },
      orderBy: { priority: "desc" },
      include: { project: { select: { name: true, slug: true } } },
    }),
    db.task.findMany({
      where: { status: { in: ["ACTIVE", "PLANNED"] }, updatedAt: { lt: sevenDaysAgo } },
      take: 6,
      orderBy: { updatedAt: "asc" },
      include: { project: { select: { name: true, slug: true } } },
    }),
    db.task.findMany({
      where: { status: "REVIEW" },
      orderBy: { updatedAt: "desc" },
      include: { project: { select: { name: true, slug: true } } },
    }),
    db.task.findMany({
      where: { status: "DONE", updatedAt: { gte: twoDaysAgo } },
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: { project: { select: { name: true, slug: true } } },
    }),
  ])

  return { activeTasks, blockers, staleTasks, reviewTasks, recentlyDone }
}

export default async function FocusPage() {
  let data: Awaited<ReturnType<typeof getFocusData>> | null = null
  let dbError = false

  try {
    data = await getFocusData()
  } catch {
    dbError = true
  }

  // Cognition — graceful degradation
  let cognition: Awaited<ReturnType<typeof getCognitionOutput>> | null = null
  if (!dbError) {
    try {
      cognition = await getCognitionOutput()
    } catch {
      // non-fatal
    }
  }

  const activeTasks = data?.activeTasks ?? []
  const blockers = data?.blockers ?? []
  const staleTasks = data?.staleTasks ?? []
  const reviewTasks = data?.reviewTasks ?? []
  const recentlyDone = data?.recentlyDone ?? []

  return (
    <div className="px-8 py-8 max-w-[900px] mx-auto">

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
          Focus
        </h1>
        <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
          What matters now — your execution orientation
        </p>
      </div>

      {dbError && (
        <div className="mb-8 rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      )}

      {/* Focus Engine — AI-assisted, deterministic suggestions */}
      {cognition && (
        <FocusEngine
          suggestions={cognition.focusSuggestions}
          overallHealth={cognition.overallHealth}
        />
      )}

      <div className="space-y-12">

        {/* In Progress */}
        <CockpitSection label="In Progress" count={activeTasks.length}>
          {activeTasks.length === 0 ? (
            <CockpitEmpty label="Nothing actively in progress" />
          ) : (
            <div className="space-y-0.5">
              {activeTasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "group flex items-center justify-between rounded-md px-3 py-3 hover:bg-[hsl(var(--accent))] transition-colors",
                    priorityBorder[task.priority]
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <TypeBadge type={task.type} />
                    <div className="min-w-0">
                      <p className="text-sm text-[hsl(var(--foreground))] truncate">{task.title}</p>
                      {task.project && (
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{task.project.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2 ml-4">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                    </span>
                    <StatusBadge status={task.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CockpitSection>

        {/* Blockers */}
        {(blockers.length > 0 || !dbError) && (
          <CockpitSection label="Blockers" count={blockers.length}>
            {blockers.length === 0 ? (
              <CockpitEmpty label="No blockers — clear to proceed" />
            ) : (
              <div className="space-y-1.5">
                {blockers.map((blocker) => (
                  <div
                    key={blocker.id}
                    className="flex items-start gap-3 rounded-md border border-red-900/40 bg-red-950/10 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{blocker.title}</p>
                      {blocker.project && (
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{blocker.project.name}</p>
                      )}
                    </div>
                    <StatusBadge status={blocker.status} />
                  </div>
                ))}
              </div>
            )}
          </CockpitSection>
        )}

        {/* Needs Attention / Review */}
        {reviewTasks.length > 0 && (
          <CockpitSection label="Needs Attention" count={reviewTasks.length}>
            <div className="space-y-0.5">
              {reviewTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-[hsl(var(--accent))] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TypeBadge type={task.type} />
                    <span className="text-sm text-[hsl(var(--foreground))] truncate">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {task.project && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{task.project.name}</span>
                    )}
                    <StatusBadge status={task.status} />
                  </div>
                </div>
              ))}
            </div>
          </CockpitSection>
        )}

        {/* Stale Tasks */}
        {staleTasks.length > 0 && (
          <CockpitSection label="Stale — No Movement" count={staleTasks.length}>
            <div className="space-y-0.5">
              {staleTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-[hsl(var(--accent))] transition-colors opacity-80"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TrendingDown className="h-3.5 w-3.5 text-amber-500/60 shrink-0" />
                    <span className="text-sm text-[hsl(var(--foreground))] truncate">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {task.project && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{task.project.name}</span>
                    )}
                    <span className="text-[10px] text-amber-500/70 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CockpitSection>
        )}

        {/* Recently Completed */}
        {recentlyDone.length > 0 && (
          <CockpitSection label="Recently Done">
            <div className="space-y-0.5">
              {recentlyDone.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-[hsl(var(--accent))] transition-colors opacity-60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TypeBadge type={task.type} />
                    <span className="text-sm text-[hsl(var(--foreground))] truncate line-through decoration-[hsl(var(--muted-foreground)/0.4)]">{task.title}</span>
                  </div>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0 ml-4">
                    {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </CockpitSection>
        )}

        {/* Execution Signals — ambient, calm */}
        {cognition && cognition.signals.length > 0 && (
          <CockpitSection label="Execution Signals" count={cognition.signals.length}>
            <SignalsPanel signals={cognition.signals} maxSignals={8} />
          </CockpitSection>
        )}

      </div>
    </div>
  )
}
