"use client"

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useState, useTransition, useMemo } from "react"
import { updateTaskStatus } from "@/app/actions/tasks"
import { TypeBadge, StatusBadge } from "@/components/tasks/TaskBadges"
import { Task, TaskStatus, TaskType, Priority, Project } from "@/types"
import { cn } from "@/lib/utils"
import { GripVertical, AlertOctagon } from "lucide-react"

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "PLANNED", label: "Planned" },
  { id: "ACTIVE", label: "Active" },
  { id: "BLOCKED", label: "Blocked" },
  { id: "REVIEW", label: "Review" },
  { id: "DONE", label: "Done" },
]

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  PLANNED: "border-t-slate-600",
  ACTIVE: "border-t-blue-500",
  BLOCKED: "border-t-red-500",
  REVIEW: "border-t-amber-500",
  DONE: "border-t-emerald-600",
  ARCHIVED: "border-t-slate-800",
}

const PRIORITY_DOT: Record<Priority, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-slate-500",
  LOW: "bg-slate-700",
}

interface KanbanTaskCardProps {
  task: Task & { project?: Pick<Project, "name" | "slug"> | null }
  overlay?: boolean
}

function KanbanTaskCard({ task, overlay }: KanbanTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 select-none",
        "hover:border-[hsl(var(--border)/0.8)] hover:bg-[hsl(var(--accent)/0.4)] transition-colors",
        isDragging && "opacity-30",
        overlay && "shadow-xl border-[hsl(var(--border)/0.8)] rotate-1 scale-[1.02]"
      )}
    >
      {/* Priority line */}
      <div
        className={cn(
          "absolute left-0 top-2 bottom-2 w-0.5 rounded-full",
          task.priority === "CRITICAL" && "bg-red-500",
          task.priority === "HIGH" && "bg-amber-500",
        )}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 pl-1.5">
          <p className="text-sm text-[hsl(var(--foreground))] leading-snug line-clamp-2">
            {task.title}
          </p>
          {task.project && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1.5">
              {task.project.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <TypeBadge type={task.type} />
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 text-[hsl(var(--muted-foreground)/0.4)] hover:text-[hsl(var(--muted-foreground))] cursor-grab active:cursor-grabbing transition-colors opacity-0 group-hover:opacity-100"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface KanbanColumnProps {
  column: { id: TaskStatus; label: string }
  tasks: (Task & { project?: Pick<Project, "name" | "slug"> | null })[]
}

function KanbanColumn({ column, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="flex flex-col min-w-[220px] flex-1">
      {/* Column header */}
      <div
        className={cn(
          "mb-3 rounded-t-md border-t-2 pt-2.5 px-1",
          COLUMN_ACCENT[column.id]
        )}
      >
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            {column.label}
          </span>
          <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.5)]">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Column body */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-b-md p-1.5 space-y-1.5 min-h-[200px] transition-colors",
          isOver && "bg-[hsl(var(--accent)/0.3)]"
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <KanbanTaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="h-20 rounded border border-dashed border-[hsl(var(--border)/0.4)] flex items-center justify-center">
            <p className="text-[10px] text-[hsl(var(--muted-foreground)/0.3)]">
              Drop here
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface KanbanBoardProps {
  tasks: (Task & { project?: Pick<Project, "name" | "slug"> | null })[]
}

export function KanbanBoard({ tasks: initialTasks }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [activeTask, setActiveTask] = useState<(typeof tasks)[0] | null>(null)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const tasksByColumn = useMemo(() => {
    const map: Record<TaskStatus, typeof tasks> = {
      PLANNED: [], ACTIVE: [], BLOCKED: [], REVIEW: [], DONE: [], ARCHIVED: [],
    }
    tasks.forEach((t) => map[t.status]?.push(t))
    return map
  }, [tasks])

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const taskId = active.id as string
    const newStatus = over.id as TaskStatus

    // Only valid column IDs trigger status update
    if (!COLUMNS.find((c) => c.id === newStatus)) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    )

    startTransition(async () => {
      try {
        await updateTaskStatus(taskId, newStatus)
      } catch {
        // Revert on error
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t))
        )
      }
    })
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={tasksByColumn[column.id] ?? []}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && <KanbanTaskCard task={activeTask} overlay />}
      </DragOverlay>
    </DndContext>
  )
}
