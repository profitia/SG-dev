'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

export async function createPromptExecution(form: FormData) {
  const changedFilesRaw = (form.get('changedFiles') as string | null) ?? ''
  const changedFiles = changedFilesRaw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  await db.promptExecution.create({
    data: {
      title: form.get('title') as string,
      etap: (form.get('etap') as string) || null,
      subetap: (form.get('subetap') as string) || null,
      node: (form.get('node') as string) || null,
      domain: (form.get('domain') as string) || null,
      promptType: (form.get('promptType') as string) || null,
      promptContent: form.get('promptContent') as string,
      executionSummary: (form.get('executionSummary') as string) || null,
      architecturalImpact: (form.get('architecturalImpact') as string) || null,
      changedFiles,
      blockers: (form.get('blockers') as string) || null,
      nextSteps: (form.get('nextSteps') as string) || null,
      status: (form.get('status') as 'queued' | 'running' | 'completed' | 'failed' | 'archived') ?? 'completed',
      roadmapNodeId: (form.get('roadmapNodeId') as string) || null,
    },
  })

  revalidatePath('/prompts')
}

export async function updatePromptStatus(id: string, status: 'queued' | 'running' | 'completed' | 'failed' | 'archived') {
  await db.promptExecution.update({
    where: { id },
    data: { status },
  })
  revalidatePath('/prompts')
}
