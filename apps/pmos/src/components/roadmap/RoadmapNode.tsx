import { STATUS_LABELS } from '@/lib/constants'

type Tag = { tag: { id: string; name: string } }
type Count = { logs: number; decisions: number }

interface RoadmapNodeProps {
  node: {
    id: string
    title: string
    description: string | null
    status: string
    priority: string
    order: number
    tags: Tag[]
    _count: Count
  }
  depth: number
}

const STATUS_CHIP: Record<string, string> = {
  done:        'chip chip-done',
  in_progress: 'chip chip-warn',
  blocked:     'chip chip-blocked',
  backlog:     'chip',
  archived:    'chip',
}

export function RoadmapNode({ node, depth }: RoadmapNodeProps) {
  return (
    <div className="flex-1 min-w-0 py-1.5 pr-3">
      <div className="flex items-center gap-2 min-w-0">
        {/* Title */}
        <span
          className={`
            leading-snug min-w-0 truncate
            ${depth === 0 ? 'text-2xs font-semibold text-text-primary tracking-wide' : 'text-2xs font-normal text-text-secondary'}
            ${node.status === 'done' ? 'line-through !text-text-tertiary' : ''}
            ${node.status === 'archived' ? '!text-text-tertiary' : ''}
          `}
        >
          {node.title}
        </span>

        {/* Meta */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          {/* Tags — only at depth 0, max 2 */}
          {depth === 0 && node.tags.slice(0, 2).map(({ tag }) => (
            <span key={tag.id} className="chip">#{tag.name}</span>
          ))}

          {/* Log count */}
          {node._count.logs > 0 && (
            <span className="chip">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <rect x="0.75" y="0.75" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.1"/>
                <path d="M2.5 3.5h3M2.5 5h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              {node._count.logs}
            </span>
          )}

          {/* Priority */}
          {node.priority === 'high' && (
            <span className="chip chip-blocked">↑</span>
          )}

          {/* Status chip */}
          <span className={STATUS_CHIP[node.status] ?? 'chip'}>
            {STATUS_LABELS[node.status]}
          </span>
        </div>
      </div>

      {/* Description — depth 0 only, compact */}
      {depth === 0 && node.description && node.status !== 'done' && (
        <p className="text-text-tertiary text-3xs mt-0.5 leading-relaxed line-clamp-1 pr-4">
          {node.description}
        </p>
      )}
    </div>
  )
}

