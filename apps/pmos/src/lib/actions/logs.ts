'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createExecutionLog(form: FormData) {
  const title = form.get('title') as string
  const summary = (form.get('summary') as string) || null
  const prompt = (form.get('prompt') as string) || null
  const changedFilesRaw = (form.get('changedFiles') as string) || '[]'
  const architecturalImpact = (form.get('architecturalImpact') as string) || null
  const blockers = (form.get('blockers') as string) || null
  const nextSteps = (form.get('nextSteps') as string) || null
  const canonicalAlignment = (form.get('canonicalAlignment') as string) || 'medium'
  const nodeId = (form.get('nodeId') as string) || null
  const tagIds = form.getAll('tagIds') as string[]

  if (!title?.trim()) throw new Error('Title is required')

  let changedFiles: string[] = []
  try {
    changedFiles = JSON.parse(changedFilesRaw)
  } catch {
    changedFiles = []
  }

  const log = await db.executionLog.create({
    data: {
      title: title.trim(),
      summary: summary?.trim() || null,
      prompt: prompt?.trim() || null,
      changedFiles,
      architecturalImpact: architecturalImpact?.trim() || null,
      blockers: blockers?.trim() || null,
      nextSteps: nextSteps?.trim() || null,
      canonicalAlignment: canonicalAlignment as never,
    },
  })

  // Link to roadmap node
  if (nodeId) {
    await db.roadmapNodeLog.create({
      data: { nodeId, logId: log.id },
    })
  }

  // Link tags
  if (tagIds.length > 0) {
    await db.logTag.createMany({
      data: tagIds.map((tagId) => ({ logId: log.id, tagId })),
      skipDuplicates: true,
    })
  }

  revalidatePath('/logs')
}
