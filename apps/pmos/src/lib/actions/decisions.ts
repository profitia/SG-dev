'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createDecision(form: FormData) {
  const title = form.get('title') as string
  const decision = form.get('decision') as string
  const reason = (form.get('reason') as string) || null
  const impact = (form.get('impact') as string) || null
  const affectedSystemsRaw = (form.get('affectedSystems') as string) || '[]'
  const nodeId = (form.get('nodeId') as string) || null

  if (!title?.trim()) throw new Error('Title is required')
  if (!decision?.trim()) throw new Error('Decision is required')

  let affectedSystems: string[] = []
  try {
    affectedSystems = JSON.parse(affectedSystemsRaw)
  } catch {
    affectedSystems = []
  }

  const record = await db.decision.create({
    data: {
      title: title.trim(),
      decision: decision.trim(),
      reason: reason?.trim() || null,
      impact: impact?.trim() || null,
      affectedSystems,
    },
  })

  // Link to roadmap node
  if (nodeId) {
    await db.roadmapNodeDecision.create({
      data: { nodeId, decisionId: record.id },
    })
  }

  revalidatePath('/decisions')
}
