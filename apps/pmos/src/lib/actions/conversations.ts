'use server'

import { db } from '@/lib/db'
import { pmosConfig } from '../../../pmos.config'
import { revalidatePath } from 'next/cache'

export async function createConversationArtifact(data: {
  conversationId: string
  timestamp: string
  taskId?: string
  etap?: string
  subetap?: string
  domains: string[]
  conversationType: string
  importanceLevel: string
  userPrompt: string
  llmResponse: string
  summary: string
  tags: string[]
  chronologyOrder: number
}) {
  const artifact = await db.conversationArtifact.create({
    data: {
      conversationId: data.conversationId,
      timestamp: new Date(data.timestamp),
      project: pmosConfig.projectName,
      taskId: data.taskId ?? null,
      etap: data.etap ?? null,
      subetap: data.subetap ?? null,
      domains: data.domains,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conversationType: data.conversationType as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      importanceLevel: data.importanceLevel as any,
      userPrompt: data.userPrompt,
      llmResponse: data.llmResponse,
      summary: data.summary,
      tags: data.tags,
      chronologyOrder: data.chronologyOrder,
    },
  })

  revalidatePath('/conversations')
  return artifact
}
