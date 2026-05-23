'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createArchitectureWarning(form: FormData) {
  const title = form.get('title') as string
  const description = form.get('description') as string
  const severity = (form.get('severity') as string) || 'medium'
  const type = form.get('type') as string
  const affectedArea = (form.get('affectedArea') as string) || null
  const relatedLogId = (form.get('relatedLogId') as string) || null
  const relatedRoadmapNodeId = (form.get('relatedRoadmapNodeId') as string) || null

  if (!title?.trim()) throw new Error('Title is required')
  if (!description?.trim()) throw new Error('Description is required')
  if (!type) throw new Error('Type is required')

  await db.architectureWarning.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      severity: severity as never,
      type: type as never,
      affectedArea: affectedArea?.trim() || null,
      relatedLogId: relatedLogId || null,
      relatedRoadmapNodeId: relatedRoadmapNodeId || null,
    },
  })

  revalidatePath('/warnings')
}

export async function resolveArchitectureWarning(id: string) {
  await db.architectureWarning.update({
    where: { id },
    data: { resolved: true, resolvedAt: new Date() },
  })

  revalidatePath('/warnings')
}
