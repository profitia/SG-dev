"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { createTask } from "@/app/actions/tasks"
import { Plus, Loader2 } from "lucide-react"
import { TaskType } from "@/types"

interface InlineTaskCreateProps {
  projectId: string
  subetapId?: string
  placeholder?: string
  onCreated?: () => void
}

const PREFIX_TO_TYPE: Record<string, TaskType> = {
  "/task": "TASK",
  "/blocker": "BLOCKER",
  "/idea": "IDEA",
  "/decision": "DECISION",
  "/note": "NOTE",
  "/bug": "BUG",
  "/refactor": "REFACTOR",
}

function parseInput(value: string): { type: TaskType; title: string } {
  const lower = value.trim().toLowerCase()
  for (const [prefix, type] of Object.entries(PREFIX_TO_TYPE)) {
    if (lower.startsWith(prefix)) {
      return { type, title: value.trim().slice(prefix.length).trim() }
    }
  }
  return { type: "TASK", title: value.trim() }
}

export function InlineTaskCreate({
  projectId,
  subetapId,
  placeholder = "Add task... (/blocker /idea /note)",
  onCreated,
}: InlineTaskCreateProps) {
  const [active, setActive] = useState(false)
  const [value, setValue] = useState("")
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (active) inputRef.current?.focus()
  }, [active])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim() || isPending) return

    const { type, title } = parseInput(value)
    if (!title) return

    startTransition(async () => {
      await createTask({ title, type, projectId, subetapId })
      setValue("")
      onCreated?.()
      // keep active for rapid entry
      inputRef.current?.focus()
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setActive(false)
      setValue("")
    }
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors py-1"
      >
        <Plus className="h-3.5 w-3.5" />
        Add item
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (!value.trim()) setActive(false) }}
        placeholder={placeholder}
        disabled={isPending}
        className="flex-1 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none focus:border-[hsl(var(--primary))] transition-colors disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!value.trim() || isPending}
        className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30 transition-colors"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
      </button>
    </form>
  )
}
