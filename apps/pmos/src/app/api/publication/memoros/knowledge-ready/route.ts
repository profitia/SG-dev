import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type KnowledgeReadyCallbackPayload = {
  knowledgeProcessingId?: string
  sourceConversationId?: string | null
  sourceExternalId?: string
  threadId?: string
  sourceRecordId?: string
  projectId?: string
  status?: 'knowledge_ready' | 'failed'
  consumerReadinessStatus?: 'ready' | 'failed'
  currentStage?: string
  metrics?: Record<string, unknown> | null
  retrievalProbe?: Record<string, unknown> | null
  error?: { code?: string | null; message?: string | null } | null
  acknowledgedAt?: string
}

function buildPublicationArtifactId(conversationId: string): string {
  return `${conversationId}:PUBLICATION:MEMOROS:v1`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as KnowledgeReadyCallbackPayload

    const sourceConversationId = body.sourceConversationId?.trim()
    if (!sourceConversationId) {
      return NextResponse.json({ error: 'sourceConversationId is required' }, { status: 400 })
    }

    const artifactId = buildPublicationArtifactId(sourceConversationId)
    const publicationArtifacts = await db.$queryRawUnsafe<Array<{ id: string; payload: Prisma.JsonValue }>>(
      `SELECT "id", "payload"
       FROM "artifacts"
       WHERE "id" = $1
       LIMIT 1`,
      artifactId,
    )
    const publicationArtifact = publicationArtifacts[0] ?? null

    if (!publicationArtifact) {
      return NextResponse.json({ error: 'Publication artifact not found' }, { status: 404 })
    }

    const existingPayload = publicationArtifact.payload && typeof publicationArtifact.payload === 'object' && !Array.isArray(publicationArtifact.payload)
      ? publicationArtifact.payload as Record<string, unknown>
      : {}

    const updatedPayload = {
      ...existingPayload,
      consumerReadiness: {
        consumer: 'MEMOROS',
        status: body.consumerReadinessStatus === 'failed' ? 'failed' : body.consumerReadinessStatus === 'ready' ? 'ready' : 'pending',
        knowledgeProcessingId: body.knowledgeProcessingId ?? null,
        currentStage: body.currentStage ?? body.status ?? null,
        threadId: body.threadId ?? null,
        sourceRecordId: body.sourceRecordId ?? null,
        projectId: body.projectId ?? null,
        metrics: body.metrics ?? null,
        retrievalProbe: body.retrievalProbe ?? null,
        acknowledgedAt: body.acknowledgedAt ?? new Date().toISOString(),
        error: body.error ? {
          code: body.error.code ?? null,
          message: body.error.message ?? null,
        } : null,
      },
    }

    await db.$executeRawUnsafe(
      `UPDATE "artifacts"
       SET "payload" = $2::jsonb,
           "updated_at" = NOW()
       WHERE "id" = $1`,
      artifactId,
      JSON.stringify(updatedPayload as Prisma.InputJsonValue),
    )

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('[pmos memoros knowledge-ready callback]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}