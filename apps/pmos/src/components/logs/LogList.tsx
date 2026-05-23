import { LogCard } from './LogCard'

type Tag = { tag: { id: string; name: string } }
type NodeRef = { node: { id: string; title: string } }

interface Log {
  id: string
  title: string
  summary: string | null
  prompt: string | null
  changedFiles: string[]
  architecturalImpact: string | null
  blockers: string | null
  nextSteps: string | null
  canonicalAlignment: string
  createdAt: Date
  tags: Tag[]
  nodes: NodeRef[]
}

interface LogListProps {
  logs: Log[]
}

export function LogList({ logs }: LogListProps) {
  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <LogCard key={log.id} log={log} />
      ))}
    </div>
  )
}

