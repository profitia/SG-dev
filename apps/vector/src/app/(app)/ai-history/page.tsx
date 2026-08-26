import { getAiHistory } from "@/app/actions/ai"
import { formatDistanceToNow } from "date-fns"
import { Sparkles, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

type InterpretationResult = {
  summary?: string
  taskType?: string
  priority?: string
  project?: string | null
  etap?: string | null
  confidence?: number
  reasoning?: string
}

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-amber-400",
  MEDIUM: "text-slate-400",
  LOW: "text-slate-600",
}

const TYPE_COLOR: Record<string, string> = {
  BLOCKER: "text-red-400",
  BUG: "text-orange-400",
  IDEA: "text-violet-400",
  DECISION: "text-amber-400",
  NOTE: "text-slate-400",
  REFACTOR: "text-lime-400",
  TASK: "text-blue-400",
}

export default async function AiHistoryPage() {
  let history: Awaited<ReturnType<typeof getAiHistory>> = []
  let dbError = false

  try {
    history = await getAiHistory()
  } catch {
    dbError = true
  }

  const accepted = history.filter((h) => h.accepted).length
  const total = history.length

  return (
    <div className="px-8 py-8 max-w-[900px] mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
            AI History
          </h1>
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            Interpretation log — for observability and future tuning
          </p>
        </div>
        {total > 0 && (
          <div className="text-right">
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              {accepted}/{total}
            </p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              accepted rate {total > 0 ? Math.round((accepted / total) * 100) : 0}%
            </p>
          </div>
        )}
      </div>

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-medium text-amber-400">Database not connected</p>
        </div>
      )}

      {history.length === 0 && !dbError && (
        <div className="py-20 text-center">
          <Sparkles className="h-6 w-6 text-[hsl(var(--muted-foreground)/0.2)] mx-auto mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground)/0.5)]">No interpretations yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground)/0.3)] mt-1">
            Use ⌘K to capture — AI will interpret and log here
          </p>
        </div>
      )}

      <div className="space-y-2">
        {history.map((item) => {
          const result = (item.result ?? {}) as InterpretationResult
          const confidence = result.confidence ?? 0

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-md border px-4 py-3",
                item.accepted
                  ? "border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]"
                  : "border-[hsl(var(--border)/0.3)] bg-transparent"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* Raw input */}
                  <p className="text-[10px] text-[hsl(var(--muted-foreground)/0.5)] mb-1.5 truncate">
                    "{item.rawInput}"
                  </p>
                  {/* Interpreted summary */}
                  {result.summary && (
                    <p className="text-sm text-[hsl(var(--foreground))]">{result.summary}</p>
                  )}

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {result.taskType && (
                      <span className={cn("text-[10px] font-medium", TYPE_COLOR[result.taskType] ?? "text-slate-400")}>
                        {result.taskType}
                      </span>
                    )}
                    {result.priority && (
                      <span className={cn("text-[10px]", PRIORITY_COLOR[result.priority] ?? "text-slate-400")}>
                        {result.priority}
                      </span>
                    )}
                    {result.project && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.6)]">
                        {result.project}
                      </span>
                    )}
                    {result.etap && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.4)]">
                        ETAP: {result.etap}
                      </span>
                    )}
                    <span className={cn(
                      "text-[10px]",
                      confidence >= 0.9 ? "text-emerald-500/60" : confidence >= 0.7 ? "text-amber-500/60" : "text-slate-600"
                    )}>
                      {Math.round(confidence * 100)}% confidence
                    </span>
                  </div>
                </div>

                {/* Accepted / rejected indicator */}
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  {item.accepted ? (
                    <span className="flex items-center gap-1 text-[9px] text-emerald-500/70">
                      <Check className="h-2.5 w-2.5" />
                      accepted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[9px] text-[hsl(var(--muted-foreground)/0.3)]">
                      <X className="h-2.5 w-2.5" />
                      not used
                    </span>
                  )}
                  <span className="text-[9px] text-[hsl(var(--muted-foreground)/0.3)]">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
