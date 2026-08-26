"use client"

import {
  useState,
  useRef,
  useEffect,
  useTransition,
  useCallback,
} from "react"
import { Command, Check, Loader2, Sparkles, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { interpretCapture } from "@/app/actions/ai"
import { createTask } from "@/app/actions/tasks"
import { captureToInbox } from "@/app/actions/inbox"
import { cn } from "@/lib/utils"
import type { Interpretation } from "@/lib/ai/schemas"

// ─── Types ────────────────────────────────────────────────────────────────────

type CaptureState =
  | { phase: "idle" }
  | { phase: "interpreting" }
  | { phase: "reviewing"; interpretation: Interpretation; taskPayload: TaskPayload; duplicates: DuplicateHint[] }
  | { phase: "saved" }
  | { phase: "error"; message: string }

interface TaskPayload {
  title: string
  type: string
  priority: string
  projectId: string | null
  etapHint: string | null
  subetapHint: string | null
}

interface DuplicateHint {
  id: string
  title: string
  type: string
  status: string
}

// ─── Label maps ───────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  BLOCKER: "text-red-400 bg-red-950/40 border-red-800/40",
  BUG: "text-orange-400 bg-orange-950/40 border-orange-800/40",
  IDEA: "text-violet-400 bg-violet-950/40 border-violet-800/40",
  DECISION: "text-amber-400 bg-amber-950/40 border-amber-800/40",
  NOTE: "text-slate-400 bg-slate-800/40 border-slate-700/40",
  REFACTOR: "text-lime-400 bg-lime-950/40 border-lime-800/40",
  TASK: "text-blue-400 bg-blue-950/40 border-blue-800/40",
}

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-amber-400",
  MEDIUM: "text-slate-300",
  LOW: "text-slate-500",
}

const CONFIDENCE_LABEL = (c: number) =>
  c >= 0.9 ? "High confidence" : c >= 0.7 ? "Probable" : c >= 0.5 ? "Uncertain" : "Speculative"

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.9 ? "text-emerald-400" : c >= 0.7 ? "text-amber-400" : "text-slate-500"

// ─── AI Review Panel ──────────────────────────────────────────────────────────

function AiReviewPanel({
  interpretation,
  taskPayload,
  duplicates,
  onAccept,
  onSkip,
  isPending,
}: {
  interpretation: Interpretation
  taskPayload: TaskPayload
  duplicates: DuplicateHint[]
  onAccept: (edited: TaskPayload) => void
  onSkip: () => void
  isPending: boolean
}) {
  const [edited, setEdited] = useState<TaskPayload>(taskPayload)
  const [showReasoning, setShowReasoning] = useState(false)

  return (
    <div className="border-t border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.5)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border)/0.3)]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-[hsl(var(--muted-foreground)/0.5)]" />
          <span className="text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.5)]">
            AI interpretation
          </span>
        </div>
        <span className={cn("text-[10px]", CONFIDENCE_COLOR(interpretation.confidence))}>
          {CONFIDENCE_LABEL(interpretation.confidence)}
          {" · "}{Math.round(interpretation.confidence * 100)}%
        </span>
      </div>

      {/* Editable title */}
      <div className="px-4 pt-3 pb-2">
        <label className="text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.4)] mb-1 block">
          Title
        </label>
        <input
          value={edited.title}
          onChange={(e) => setEdited({ ...edited, title: e.target.value })}
          className="w-full bg-transparent text-sm text-[hsl(var(--foreground))] border-b border-[hsl(var(--border)/0.4)] pb-1 focus:outline-none focus:border-[hsl(var(--border))] transition-colors"
        />
      </div>

      {/* Type / Priority / hints */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-2.5">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.4)]">Type</label>
          <select
            value={edited.type}
            onChange={(e) => setEdited({ ...edited, type: e.target.value })}
            className={cn(
              "text-[11px] border rounded px-2 py-0.5 bg-transparent cursor-pointer focus:outline-none",
              TYPE_COLOR[edited.type] ?? TYPE_COLOR.TASK
            )}
          >
            {["TASK", "BLOCKER", "IDEA", "DECISION", "BUG", "NOTE", "REFACTOR"].map((t) => (
              <option key={t} value={t} className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">{t}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.4)]">Priority</label>
          <select
            value={edited.priority}
            onChange={(e) => setEdited({ ...edited, priority: e.target.value })}
            className={cn(
              "text-[11px] border border-[hsl(var(--border)/0.4)] rounded px-2 py-0.5 bg-transparent cursor-pointer focus:outline-none",
              PRIORITY_COLOR[edited.priority]
            )}
          >
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
              <option key={p} value={p} className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">{p}</option>
            ))}
          </select>
        </div>

        {interpretation.etap && (
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.4)]">ETAP</label>
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{interpretation.etap}</span>
          </div>
        )}

        {interpretation.project && (
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.4)]">Project</label>
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{interpretation.project}</span>
          </div>
        )}
      </div>

      {/* Dependency suggestions */}
      {interpretation.suggestedDependencies.length > 0 && (
        <div className="px-4 pb-2.5">
          <label className="text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.4)] mb-1 block">May depend on</label>
          <ul className="space-y-0.5">
            {interpretation.suggestedDependencies.map((dep, i) => (
              <li key={i} className="text-[11px] text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-[hsl(var(--muted-foreground)/0.3)] shrink-0" />
                {dep}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Possible duplicates */}
      {duplicates.length > 0 && (
        <div className="px-4 pb-2.5 border-t border-[hsl(var(--border)/0.2)] pt-2.5">
          <label className="text-[9px] uppercase tracking-widest text-amber-500/60 mb-1.5 block">Possible duplicate</label>
          <ul className="space-y-1">
            {duplicates.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                <span className="h-1 w-1 rounded-full bg-amber-500/50 shrink-0" />
                <span className="truncate">{d.title}</span>
                <span className="text-[9px] text-[hsl(var(--muted-foreground)/0.4)] shrink-0">{d.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reasoning toggle */}
      <div className="px-4 pb-1">
        <button
          onClick={() => setShowReasoning((s) => !s)}
          className="flex items-center gap-1 text-[9px] text-[hsl(var(--muted-foreground)/0.35)] hover:text-[hsl(var(--muted-foreground))] transition-colors"
        >
          {showReasoning ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          Reasoning
        </button>
        {showReasoning && (
          <p className="mt-1.5 text-[10px] text-[hsl(var(--muted-foreground)/0.5)] italic leading-relaxed">
            {interpretation.reasoning}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[hsl(var(--border)/0.3)]">
        <button
          onClick={onSkip}
          disabled={isPending}
          className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors px-3 py-1.5"
        >
          Save to inbox
        </button>
        <button
          onClick={() => onAccept(edited)}
          disabled={isPending || !edited.title.trim()}
          className={cn(
            "flex items-center gap-1.5 text-xs rounded-md px-4 py-1.5 font-medium transition-all",
            "bg-[hsl(var(--foreground))] text-[hsl(var(--background))]",
            "hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Accept + save task
        </button>
      </div>
    </div>
  )
}

// ─── Main QuickCapture ────────────────────────────────────────────────────────

export function QuickCapture() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [state, setState] = useState<CaptureState>({ phase: "idle" })
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
        setState({ phase: "idle" })
      }
      if (e.key === "Escape" && open) {
        setOpen(false)
        setValue("")
        setState({ phase: "idle" })
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const close = useCallback(() => {
    setOpen(false)
    setValue("")
    setState({ phase: "idle" })
  }, [])

  function handleInterpret(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || isPending) return

    setState({ phase: "interpreting" })
    startTransition(async () => {
      try {
        const result = await interpretCapture(trimmed)

        if (!result.ok) {
          if (result.disabled) {
            await captureToInbox(trimmed)
            setState({ phase: "saved" })
            setValue("")
            setTimeout(close, 1500)
          } else {
            setState({ phase: "error", message: result.error })
          }
          return
        }

        setState({
          phase: "reviewing",
          interpretation: result.interpretation,
          taskPayload: result.taskPayload,
          duplicates: result.possibleDuplicates,
        })
      } catch {
        setState({ phase: "error", message: "Something went wrong" })
      }
    })
  }

  function handleAccept(edited: TaskPayload) {
    startTransition(async () => {
      try {
        if (!edited.projectId) {
          await captureToInbox(edited.title)
        } else {
          await createTask({
            title: edited.title,
            type: edited.type as any,
            priority: edited.priority as any,
            projectId: edited.projectId,
          })
        }
        setState({ phase: "saved" })
        setValue("")
        setTimeout(close, 1500)
      } catch {
        setState({ phase: "error", message: "Failed to save task" })
      }
    })
  }

  function handleSkip() {
    if (state.phase !== "reviewing") return
    const title = state.taskPayload.title
    startTransition(async () => {
      try {
        await captureToInbox(title)
        setState({ phase: "saved" })
        setValue("")
        setTimeout(close, 1500)
      } catch {
        setState({ phase: "error", message: "Failed to save" })
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setState({ phase: "idle" }) }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm text-[hsl(var(--muted-foreground))] shadow-lg transition-all hover:text-[hsl(var(--foreground))] hover:shadow-xl"
      >
        <Command className="h-3.5 w-3.5" />
        <span>Capture</span>
        <kbd className="ml-1 rounded bg-[hsl(var(--secondary))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl mx-4">
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl overflow-hidden">

          {state.phase !== "saved" && (
            <form onSubmit={handleInterpret}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                {state.phase === "interpreting" ? (
                  <Loader2 className="h-4 w-4 text-[hsl(var(--muted-foreground)/0.4)] shrink-0 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-[hsl(var(--muted-foreground)/0.3)] shrink-0" />
                )}
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value)
                    if (state.phase === "error") setState({ phase: "idle" })
                  }}
                  placeholder={state.phase === "interpreting" ? "Interpreting…" : "Describe what needs to happen…"}
                  disabled={state.phase === "interpreting" || state.phase === "reviewing"}
                  className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.4)] focus:outline-none disabled:opacity-60"
                />
                {state.phase === "idle" && value.trim().length > 0 && (
                  <kbd className="shrink-0 rounded bg-[hsl(var(--secondary))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">↵</kbd>
                )}
              </div>
            </form>
          )}

          {state.phase === "saved" && (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-sm text-[hsl(var(--foreground))]">Saved</span>
            </div>
          )}

          {state.phase === "error" && (
            <div className="border-t border-[hsl(var(--border)/0.3)] flex items-center gap-2 px-4 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{state.message}</p>
              <button
                onClick={() => setState({ phase: "idle" })}
                className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                Dismiss
              </button>
            </div>
          )}

          {state.phase === "reviewing" && (
            <AiReviewPanel
              interpretation={state.interpretation}
              taskPayload={state.taskPayload}
              duplicates={state.duplicates}
              onAccept={handleAccept}
              onSkip={handleSkip}
              isPending={isPending}
            />
          )}
        </div>

        {state.phase === "idle" && (
          <p className="mt-2 text-center text-[9px] text-[hsl(var(--muted-foreground)/0.3)]">
            Natural language — AI interprets and suggests structure
          </p>
        )}
      </div>
    </div>
  )
}
