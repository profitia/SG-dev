#!/usr/bin/env tsx

import path from 'node:path'

import { readJsonFileSafe } from '../src/lib/pmos/atomic-io'
import { validateConversationArtifactSet } from '../src/lib/pmos/archive-completeness'
import { buildCanonicalConversationReadModel } from '../src/lib/pmos/flight-record-read'

function readBaseNameFromArgs(): string {
  const args = process.argv.slice(2)
  const baseFlagIndex = args.indexOf('--base')
  const requestedBase = baseFlagIndex >= 0 ? args[baseFlagIndex + 1]?.trim() : ''

  if (!requestedBase) {
    console.error('[recovery:check-archive] ERROR: missing required --base <artifact-base>')
    process.exit(1)
  }

  return path.basename(requestedBase)
}

const baseName = readBaseNameFromArgs()
const basePath = path.join(process.cwd(), '.pmos', 'conversations', baseName)
const result = validateConversationArtifactSet(basePath)
const artifact = readJsonFileSafe<unknown>(`${basePath}.json`).value
const conversation = artifact ? buildCanonicalConversationReadModel(artifact) : null

console.log(`[recovery:check-archive] ${result.status}`)
console.log(` - base=${baseName}`)
console.log(` - markdown=${path.basename(result.mdPath)}`)
console.log(` - json=${path.basename(result.jsonPath)}`)
console.log(` - integrity=${path.basename(result.integrityPath)}`)
console.log(` - lock=${path.basename(result.lockPath)}`)
if (conversation?.available) {
  console.log(` - taskId=${conversation.metadata.taskId ?? 'unknown'}`)
  console.log(` - closeoutState=${conversation.completionEvidence.closeoutState ?? 'unknown'}`)
  console.log(` - archiveCompletenessStatus=${conversation.completionEvidence.archiveCompletenessStatus ?? 'unknown'}`)
}

console.log(` - issues=${result.issues.length}`)
for (const issue of result.issues) {
  console.log(` - ${issue.severity}: ${issue.message}`)
}

if (result.status === 'FAIL') {
  process.exit(1)
}
