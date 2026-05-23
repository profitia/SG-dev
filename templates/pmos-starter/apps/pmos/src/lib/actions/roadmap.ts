'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createRoadmapNode(form: FormData) {
  const title = form.get('title') as string
  const description = (form.get('description') as string) || null
  const status = (form.get('status') as string) || 'backlog'
  const priority = (form.get('priority') as string) || 'medium'
  const parentId = (form.get('parentId') as string) || null

  if (!title?.trim()) throw new Error('Title is required')

  // Determine order (append to end of siblings)
  const siblingsCount = await db.roadmapNode.count({
    where: { parentId: parentId || null },
  })

  await db.roadmapNode.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      status: status as never,
      priority: priority as never,
      parentId: parentId || null,
      order: siblingsCount,
    },
  })

  revalidatePath('/roadmap')
}

export async function updateNodeStatus(id: string, status: string) {
  await db.roadmapNode.update({
    where: { id },
    data: { status: status as never },
  })
  revalidatePath('/roadmap')
}
