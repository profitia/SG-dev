"use client"

import { useState, useMemo } from "react"
import { Task, Project, TaskStatus, Priority } from "@/types"
import { KanbanBoard } from "./KanbanBoard"
import { FilterBar, useFilters } from "./FilterBar"
import { StatusBadge, TypeBadge } from "./TaskBadges"
import { formatDistanceToNow } from "date-fns"
import { List, LayoutGrid, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

type ViewMode = "list" | "kanban"

const PRIORITY_DOT: Record<Priority, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-slate-600",
  LOW: "bg-slate-700",
}

interface TaskBoardProps {
  tasks: (Task & { project?: Pick<Project, "id" | "name" | "slug"> | null })[]
  projects: Pick<Project, "id" | "name">[]
  defaultView?: ViewMode
  showProjectFilter?: boolean
}

export function TaskBoard({
  tasks,
  projects,
  defaultView = "list",
  showProjectFilter = true,
}: TaskBoardProps) {
  const [view, setView] = useState<ViewMode>(defaultView)
  const [showFilters, setShowFilters] = useState(false)
  const { filters, setFilters, applyFilters } = useFilters()

  const filtered = useMemo(() => applyFilters(tasks as any), [tasks, applyFilters])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors",
              view === "list"
                ? "bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            )}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
          <button
            onClick={() => setView("kanban")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors",
              view === "kanban"
                ? "bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Kanban
          </button>
        </div>

        <div className="flex items-center gap-2">
          {filtered.length !== tasks.length && (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {filtered.length} / {tasks.length}
            </span>
          )}
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors",
              showFilters
                ? "bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <FilterBar
          projects={showProjectFilter ? projects : []}
          filters={filters}
          onChange={setFilters}
        />
      )}

      {/* View */}
      {view === "kanban" ? (
        <KanbanBoard tasks={filtered as any} />
      ) : (
        <ListView tasks={filtered as any} />
      )}
    </div>
  )
}

function ListView({
  tasks,
}: {
  tasks: (Task & { project?: Pick<Project, "id" | "name" | "slug"> | null })[]
}) {
  if (tasks.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-[hsl(var(--muted-foreground)/0.5)]">No tasks match the current filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-px">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="group flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-[hsl(var(--accent))] transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Priority indicator */}
            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", PRIORITY_DOT[task.priority])} />
            <TypeBadge type={task.type} />
            <div className="min-w-0">
              <p className="text-sm text-[hsl(var(--foreground))] truncate">{task.title}</p>
              {task.project && (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  {task.project.name}
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3 ml-4">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity">
              {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
            </span>
            <StatusBadge status={task.status} />
          </div>
        </div>
      ))}
    </div>
  )
}
