export const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
  archived: 'Archived',
}

export const STATUS_COLORS: Record<string, string> = {
  backlog:     'text-text-tertiary',
  in_progress: 'text-yellow-400',
  blocked:     'text-warn-critical',
  done:        'text-status-done-text',
  archived:    'text-text-tertiary',
}

export const STATUS_DOT: Record<string, string> = {
  backlog:     'bg-text-muted',
  in_progress: 'bg-yellow-400',
  blocked:     'bg-red-500',
  done:        'bg-green-500',
  archived:    'bg-text-tertiary',
}

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const PRIORITY_COLORS: Record<string, string> = {
  low:    'text-text-tertiary',
  medium: 'text-yellow-400',
  high:   'text-warn-critical',
}

export const ALIGNMENT_LABELS: Record<string, string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
}

export const ALIGNMENT_COLORS: Record<string, string> = {
  high:   'text-status-done-text',
  medium: 'text-yellow-400',
  low:    'text-warn-critical',
}
