import { Prisma } from '@prisma/client'

import { db } from '@/lib/db'

const CONVERSATION_LINK_INCLUDE = {
  linkedDecisions: { include: { decision: { select: { id: true, title: true, number: true } } } },
  linkedWarnings: { include: { warning: { select: { id: true, title: true, severity: true, resolved: true } } } },
  linkedNodes: { include: { node: { select: { id: true, title: true, status: true } } } },
  linkedLogs: { include: { log: { select: { id: true, title: true, createdAt: true } } } },
  linkedPrinciples: { include: { principle: { select: { id: true, title: true } } } },
  linkedPrompts: { include: { promptExecution: { select: { id: true, title: true, status: true, etap: true } } } },
} satisfies Prisma.ConversationArtifactInclude

type ConversationWithLinks = Prisma.ConversationArtifactGetPayload<{
  include: typeof CONVERSATION_LINK_INCLUDE
}>

type BaseConversation = Prisma.ConversationArtifactGetPayload<{
  select: {
    id: true
    conversationId: true
    timestamp: true
    summary: true
    conversationType: true
    importanceLevel: true
    etap: true
    subetap: true
    taskId: true
    chronologyOrder: true
    domains: true
    tags: true
    flightRecordJson: true
  }
}>

export type ConversationReadModel = BaseConversation & {
  linkedDecisions: ConversationWithLinks['linkedDecisions']
  linkedWarnings: ConversationWithLinks['linkedWarnings']
  linkedNodes: ConversationWithLinks['linkedNodes']
  linkedLogs: ConversationWithLinks['linkedLogs']
  linkedPrinciples: ConversationWithLinks['linkedPrinciples']
  linkedPrompts: ConversationWithLinks['linkedPrompts']
}

type ListArgs = {
  where: Prisma.ConversationArtifactWhereInput
  skip: number
  take: number
}

function emptyLinkedCollections(): Pick<ConversationReadModel, 'linkedDecisions' | 'linkedWarnings' | 'linkedNodes' | 'linkedLogs' | 'linkedPrinciples' | 'linkedPrompts'> {
  return {
    linkedDecisions: [],
    linkedWarnings: [],
    linkedNodes: [],
    linkedLogs: [],
    linkedPrinciples: [],
    linkedPrompts: [],
  }
}

function isMissingRelationTableError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false
  }

  return error.code === 'P2021'
    && typeof error.message === 'string'
    && /conversation_(decisions|warnings|roadmap_nodes|logs|principles|prompts)/i.test(error.message)
}

function withEmptyLinkedCollections(conversation: BaseConversation): ConversationReadModel {
  return {
    ...conversation,
    ...emptyLinkedCollections(),
  }
}

export async function listConversationsWithFallback(args: ListArgs): Promise<ConversationReadModel[]> {
  try {
    return await db.conversationArtifact.findMany({
      where: args.where,
      orderBy: [{ timestamp: 'desc' }],
      skip: args.skip,
      take: args.take,
      include: CONVERSATION_LINK_INCLUDE,
    })
  } catch (error) {
    if (!isMissingRelationTableError(error)) {
      throw error
    }

    const baseRows = await db.conversationArtifact.findMany({
      where: args.where,
      orderBy: [{ timestamp: 'desc' }],
      skip: args.skip,
      take: args.take,
      select: {
        id: true,
        conversationId: true,
        timestamp: true,
        summary: true,
        conversationType: true,
        importanceLevel: true,
        etap: true,
        subetap: true,
        taskId: true,
        chronologyOrder: true,
        domains: true,
        tags: true,
        flightRecordJson: true,
      },
    })

    return baseRows.map(withEmptyLinkedCollections)
  }
}

export async function getConversationByIdWithFallback(id: string): Promise<ConversationReadModel | null> {
  try {
    return await db.conversationArtifact.findUnique({
      where: { id },
      include: CONVERSATION_LINK_INCLUDE,
    })
  } catch (error) {
    if (!isMissingRelationTableError(error)) {
      throw error
    }

    const baseRow = await db.conversationArtifact.findUnique({
      where: { id },
      select: {
        id: true,
        conversationId: true,
        timestamp: true,
        summary: true,
        conversationType: true,
        importanceLevel: true,
        etap: true,
        subetap: true,
        taskId: true,
        chronologyOrder: true,
        domains: true,
        tags: true,
        flightRecordJson: true,
      },
    })

    return baseRow ? withEmptyLinkedCollections(baseRow) : null
  }
}