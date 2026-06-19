#!/usr/bin/env tsx

import { Prisma, PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

import { validatePendingArtifact, type FlightRecordV1 } from '../../../packages/governance/src'
import { assertNonCanonicalPmosWriteAllowed } from '../src/lib/pmos/noncanonical-write-guard'

const prisma = new PrismaClient()
const SG_DEV_ROOT = path.resolve(__dirname, '../../..')
const CONVERSATIONS_DIR = path.resolve(__dirname, '../.pmos/conversations')

type ConversationRow = {
  id: string
  conversationId: string
  taskId: string
  filesPath: string | null
  flightRecordJson: Prisma.JsonValue | null
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    apply: args.includes('--apply'),
    conversationId: null as string | null,
    limit: null as number | null,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--conversationId') {
      options.conversationId = args[index + 1] ?? null
      index += 1
      continue
    }
    if (arg === '--limit') {
      const raw = args[index + 1] ?? ''
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --limit value: ${raw}`)
      }
      options.limit = parsed
      index += 1
    }
  }

  return options
}

function resolveJsonCandidate(filesPath: string | null): string | null {
  if (!filesPath) return null

  const normalized = filesPath.endsWith('.md')
    ? filesPath.slice(0, -3) + '.json'
    : filesPath.endsWith('.json')
      ? filesPath
      : `${filesPath}.json`

  const absolute = path.isAbsolute(normalized) ? normalized : path.resolve(SG_DEV_ROOT, normalized)
  return fs.existsSync(absolute) ? absolute : null
}

function findJsonByConversationId(conversationId: string): string | null {
  const entries = fs.readdirSync(CONVERSATIONS_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.endsWith('.integrity.json') || entry.name.endsWith('.lock.json')) {
      continue
    }

    const absolutePath = path.join(CONVERSATIONS_DIR, entry.name)
    try {
      const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf-8')) as FlightRecordV1
      if (payload?.metadata?.conversationId === conversationId) {
        return absolutePath
      }
    } catch {
      continue
    }
  }

  return null
}

function loadFlightRecordOrThrow(jsonPath: string, row: ConversationRow): FlightRecordV1 {
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as FlightRecordV1
  const validation = validatePendingArtifact(parsed)
  if (!validation.valid) {
    throw new Error(`Invalid flight record in ${path.basename(jsonPath)}: ${validation.errors.join(' | ')}`)
  }
  if (parsed.metadata.conversationId !== row.conversationId) {
    throw new Error(`Conversation ID mismatch for ${row.conversationId}: file contains ${parsed.metadata.conversationId}`)
  }
  if (parsed.metadata.taskId !== row.taskId) {
    console.warn(`WARN ${row.conversationId} -> taskId mismatch row=${row.taskId}, file=${parsed.metadata.taskId}`)
  }
  return parsed
}

async function main() {
  assertNonCanonicalPmosWriteAllowed('backfill-flight-record-json.ts')

  const options = parseArgs()
  const rows = await prisma.conversationArtifact.findMany({
    select: {
      id: true,
      conversationId: true,
      taskId: true,
      filesPath: true,
      flightRecordJson: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const missingRows = rows.filter((row) => row.flightRecordJson == null)
  const scopedRows = missingRows.filter((row) => options.conversationId ? row.conversationId === options.conversationId : true)
  const targetRows = options.limit ? scopedRows.slice(0, options.limit) : scopedRows

  let matched = 0
  let updated = 0
  let unresolved = 0

  for (const row of targetRows) {
    const candidatePath = resolveJsonCandidate(row.filesPath) ?? findJsonByConversationId(row.conversationId)
    if (!candidatePath) {
      unresolved += 1
      console.log(`MISS ${row.conversationId} -> no JSON artifact found`)
      continue
    }

    const flightRecord = loadFlightRecordOrThrow(candidatePath, row)
    matched += 1

    if (!options.apply) {
      console.log(`PLAN ${row.conversationId} -> ${path.relative(SG_DEV_ROOT, candidatePath)}`)
      continue
    }

    await prisma.conversationArtifact.update({
      where: { id: row.id },
      data: {
        flightRecordJson: flightRecord as unknown as Prisma.InputJsonValue,
        filesPath: row.filesPath ?? path.relative(SG_DEV_ROOT, candidatePath).replace(/\.json$/, '.md'),
      },
    })
    updated += 1
    console.log(`UPDATED ${row.conversationId} -> ${path.relative(SG_DEV_ROOT, candidatePath)}`)
  }

  console.log(JSON.stringify({
    mode: options.apply ? 'apply' : 'dry-run',
    totalRows: rows.length,
    missingRows: missingRows.length,
    scannedRows: targetRows.length,
    matched,
    updated,
    unresolved,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('ERROR:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })