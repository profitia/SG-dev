"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StatusBadge, TypeBadge } from "@/components/tasks/TaskBadges"
import { Etap, Task } from "@/types"
import { cn } from "@/lib/utils"

interface EtapTreeProps {
  etaps: Etap[]
  tasks: Task[]
}

interface EtapRowProps {
  etap: Etap
  tasks: Task[]
}

function TaskRow({ task }: { task: Task }) {
  const isDone = task.status === "DONE" || task.status === "ARCHIVED"
  return (
    <div className="flex items-center justify-between px-4 py-2 hover:bg-[hsl(var(--accent))] transition-colors rounded-md">
      <div className="flex items-center gap-2.5 min-w-0">
        <TypeBadge type={task.type} />
        <span className={cn(
          "text-sm text-[hsl(var(--foreground))] truncate",
          isDone && "line-through"
        )}>
          {task.title}
        </span>
      </div>
      <div className="shrink-0 flex items-center gap-2 ml-3">
        <StatusBadge status={task.status} />
      </div>
    </div>
  )
}

function EtapRow({ etap, tasks }: EtapRowProps) {
  const [open, setOpen] = useState(true)
  const etapTasks = tasks.filter((t) => t.etapId === etap.id)

  return (
    <div className="border border-[hsl(var(--border))] rounded-lg overflow-hidden">
      {/* Etap header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[hsl(var(--secondary)/0.6)] hover:bg-[hsl(var(--secondary))] transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          )}
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
            {etap.name}
          </span>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {etapTasks.length} tasks
        </Badge>
      </button>

      {/* Tasks */}
      {open && (
        <div className="px-2 py-1.5 space-y-0.5">
          {etap.subetaps && etap.subetaps.length > 0
            ? etap.subetaps.map((sub) => {
                const subTasks = tasks.filter((t) => t.subetapId === sub.id)
                return (
                  <div key={sub.id} className="ml-4">
                    <p className="px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wider">
                      {sub.name}
                    </p>
                    <div className="space-y-0.5">
                      {subTasks.map((task) => (
                        <TaskRow key={task.id} task={task} />
                      ))}
                      {subTasks.length === 0 && (
                        <p className="px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                          No tasks
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            : null}

          {/* Direct etap tasks (no subetap) */}
          {etapTasks
            .filter((t) => !t.subetapId)
            .map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}

          {etapTasks.length === 0 && (
            <p className="px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">
              No tasks in this ETAP
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function EtapTree({ etaps, tasks }: EtapTreeProps) {
  if (etaps.length === 0) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] border-dashed px-6 py-10 text-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No ETAPs defined yet
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {etaps
        .sort((a, b) => a.order - b.order)
        .map((etap) => (
          <EtapRow key={etap.id} etap={etap} tasks={tasks} />
        ))}
    </div>
  )
}
