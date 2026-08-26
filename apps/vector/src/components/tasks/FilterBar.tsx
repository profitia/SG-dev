"use client"

import { useState, useCallback } from "react"
import { Task, TaskStatus, TaskType, Priority, Project } from "@/types"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

type FilterState = {
  status: TaskStatus | null
  type: TaskType | null
  priority: Priority | null
  projectId: string | null
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "PLANNED", label: "Planned" },
  { value: "ACTIVE", label: "Active" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "REVIEW", label: "Review" },
  { value: "DONE", label: "Done" },
]

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: "TASK", label: "Task" },
  { value: "BLOCKER", label: "Blocker" },
  { value: "IDEA", label: "Idea" },
  { value: "DECISION", label: "Decision" },
  { value: "BUG", label: "Bug" },
  { value: "NOTE", label: "Note" },
  { value: "REFACTOR", label: "Refactor" },
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
]

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
        active
          ? "border-[hsl(var(--foreground)/0.4)] bg-[hsl(var(--foreground)/0.08)] text-[hsl(var(--foreground))]"
          : "border-[hsl(var(--border)/0.5)] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]"
      )}
    >
      {label}
    </button>
  )
}

interface FilterBarProps {
  projects: Pick<Project, "id" | "name">[]
  filters: FilterState
  onChange: (f: FilterState) => void
}

export function FilterBar({ projects, filters, onChange }: FilterBarProps) {
  const hasActiveFilters =
    filters.status !== null ||
    filters.type !== null ||
    filters.priority !== null ||
    filters.projectId !== null

  function toggleStatus(v: TaskStatus) {
    onChange({ ...filters, status: filters.status === v ? null : v })
  }
  function toggleType(v: TaskType) {
    onChange({ ...filters, type: filters.type === v ? null : v })
  }
  function togglePriority(v: Priority) {
    onChange({ ...filters, priority: filters.priority === v ? null : v })
  }
  function toggleProject(v: string) {
    onChange({ ...filters, projectId: filters.projectId === v ? null : v })
  }
  function clearAll() {
    onChange({ status: null, type: null, priority: null, projectId: null })
  }

  return (
    <div className="space-y-2.5 pb-5 border-b border-[hsl(var(--border)/0.4)]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.6)] mr-1">Status</span>
        {STATUS_OPTIONS.map((o) => (
          <FilterChip
            key={o.value}
            label={o.label}
            active={filters.status === o.value}
            onClick={() => toggleStatus(o.value)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.6)] mr-1">Type</span>
        {TYPE_OPTIONS.map((o) => (
          <FilterChip
            key={o.value}
            label={o.label}
            active={filters.type === o.value}
            onClick={() => toggleType(o.value)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.6)] mr-1">Priority</span>
        {PRIORITY_OPTIONS.map((o) => (
          <FilterChip
            key={o.value}
            label={o.label}
            active={filters.priority === o.value}
            onClick={() => togglePriority(o.value)}
          />
        ))}
      </div>

      {projects.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.6)] mr-1">Project</span>
          {projects.map((p) => (
            <FilterChip
              key={p.id}
              label={p.name}
              active={filters.projectId === p.id}
              onClick={() => toggleProject(p.id)}
            />
          ))}
        </div>
      )}

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <X className="h-3 w-3" />
          Clear filters
        </button>
      )}
    </div>
  )
}

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>({
    status: null,
    type: null,
    priority: null,
    projectId: null,
  })

  const applyFilters = useCallback(
    (tasks: (Task & { project?: Pick<Project, "name" | "slug" | "id"> | null })[]) =>
      tasks.filter((t) => {
        if (filters.status && t.status !== filters.status) return false
        if (filters.type && t.type !== filters.type) return false
        if (filters.priority && t.priority !== filters.priority) return false
        if (filters.projectId && t.projectId !== filters.projectId) return false
        return true
      }),
    [filters]
  )

  return { filters, setFilters, applyFilters }
}
