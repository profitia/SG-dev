import { db } from '@/lib/db'
import { QuickLogForm } from '@/components/prompts/QuickLogForm'

export const dynamic = 'force-dynamic'

export default async function NewPromptPage() {
  const [nodes, templates] = await Promise.all([
    db.roadmapNode.findMany({
      where: { parentId: null },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, scope: true },
    }),
    db.promptTemplate.findMany({
      orderBy: [{ templateType: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, templateType: true, templateContent: true },
    }),
  ])

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-text-primary text-xl font-semibold mb-1">Log Execution</h1>
        <p className="text-text-tertiary text-sm">
          Quick log or full prompt execution record — under 2 min by default
        </p>
      </div>
      <QuickLogForm nodes={nodes} templates={templates} />
    </div>
  )
}
