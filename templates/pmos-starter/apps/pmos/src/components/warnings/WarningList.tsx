import { WarningCard } from './WarningCard'

type ConvRef = { conversation: { id: string; summary: string; conversationType: string; importanceLevel: string; timestamp: Date } }

type Warning = {
  id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: string
  affectedArea: string | null
  createdAt: Date
  relatedLog: { id: string; title: string } | null
  relatedRoadmapNode: { id: string; title: string } | null
  conversations?: ConvRef[]
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export function WarningList({ warnings }: { warnings: Warning[] }) {
  const sorted = [...warnings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  )

  return (
    <div className="space-y-3">
      {sorted.map((w) => (
        <WarningCard key={w.id} warning={w} />
      ))}
    </div>
  )
}
