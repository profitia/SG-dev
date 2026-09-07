#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

import {
  buildRuntimeAuthorityIntegrity,
  readRuntimeAuthoritySnapshot,
  renderRuntimeAuthorityMarkdown,
} from '../src/lib/pmos/runtime-authority'
import { assertDatabaseUrl } from '../src/lib/pmos/operator-preflight'
import { repairRuntimeContextArtifacts } from '../src/lib/pmos/runtime-context-write'

const prisma = new PrismaClient()
const CONTEXT_FILE = path.resolve(__dirname, '../.context/runtime-context.md')
const CONTEXT_INTEGRITY_FILE = path.resolve(__dirname, '../.context/runtime-context.integrity.json')
const RECOVERY_RUNTIME_DIR = path.resolve(__dirname, '../.pmos/recovery/runtime')

async function main() {
  assertDatabaseUrl('pmos:context')
  console.log('[pmos:context] Rebuilding runtime-context.md from PMOS authority...')

  const snapshot = await readRuntimeAuthoritySnapshot(prisma)
  const content = renderRuntimeAuthorityMarkdown(snapshot)
  const integrity = buildRuntimeAuthorityIntegrity(snapshot, content)

  fs.mkdirSync(path.dirname(CONTEXT_FILE), { recursive: true })
  const repairResult = repairRuntimeContextArtifacts({
    contextFilePath: CONTEXT_FILE,
    integrityFilePath: CONTEXT_INTEGRITY_FILE,
    recoveryDir: RECOVERY_RUNTIME_DIR,
    content,
    integrity: integrity as unknown as Record<string, unknown>,
    label: 'pmos-context',
  })

  if (!repairResult.verificationPassed) {
    throw new Error('Runtime context integrity verification failed after atomic rebuild.')
  }

  console.log('[pmos:context] ✓ runtime-context.md written')
  console.log('[pmos:context] ✓ runtime-context.integrity.json written')
  if (repairResult.preserved) {
    console.log('[pmos:context] ✓ runtime-context preserved unchanged (idempotent rebuild)')
  }
  if (repairResult.quarantinedPaths.length > 0) {
    console.log(`[pmos:context] ✓ quarantined previous corrupted runtime artifacts: ${repairResult.quarantinedPaths.length}`)
  }
}

main()
  .catch(async (error) => {
    console.error('[pmos:context] FATAL:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })