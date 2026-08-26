import { Badge } from "@/components/ui/badge"
import { TaskStatus, TaskType } from "@/types"

const statusLabels: Record<TaskStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  BLOCKED: "Blocked",
  REVIEW: "Review",
  DONE: "Done",
  ARCHIVED: "Archived",
}

const typeLabels: Record<TaskType, string> = {
  TASK: "Task",
  BLOCKER: "Blocker",
  IDEA: "Idea",
  DECISION: "Decision",
  BUG: "Bug",
  NOTE: "Note",
  REFACTOR: "Refactor",
}

type StatusBadgeProps = { status: TaskStatus }
type TypeBadgeProps = { type: TaskType }

export function StatusBadge({ status }: StatusBadgeProps) {
  const variantMap: Record<TaskStatus, "planned" | "active" | "blocked" | "review" | "done" | "archived"> = {
    PLANNED: "planned",
    ACTIVE: "active",
    BLOCKED: "blocked",
    REVIEW: "review",
    DONE: "done",
    ARCHIVED: "archived",
  }
  return <Badge variant={variantMap[status]}>{statusLabels[status]}</Badge>
}

export function TypeBadge({ type }: TypeBadgeProps) {
  const variantMap: Record<TaskType, "task" | "blocker" | "idea" | "decision" | "bug" | "note" | "refactor"> = {
    TASK: "task",
    BLOCKER: "blocker",
    IDEA: "idea",
    DECISION: "decision",
    BUG: "bug",
    NOTE: "note",
    REFACTOR: "refactor",
  }
  return <Badge variant={variantMap[type]}>{typeLabels[type]}</Badge>
}
