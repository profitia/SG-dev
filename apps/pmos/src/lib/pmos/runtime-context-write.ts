import fs from "fs"
import path from "path"

import type { IntegrityMetadata } from "../../../../../packages/governance/src/index.ts"
import { verifyTextIntegrity } from "../../../../../packages/governance/src/index.ts"

import { atomicWriteFileSet, quarantineTextArtifact, readJsonFileSafe } from "./atomic-io.ts"

interface RuntimeContextWriteInput {
  contextFilePath: string
  integrityFilePath: string
  recoveryDir: string
  content: string
  integrity: Record<string, unknown>
  label: string
}

export interface RuntimeContextWriteResult {
  quarantinedPaths: string[]
  verificationPassed: boolean
  preserved: boolean
}

export function repairRuntimeContextArtifacts(input: RuntimeContextWriteInput): RuntimeContextWriteResult {
  const currentContent = fs.existsSync(input.contextFilePath) ? fs.readFileSync(input.contextFilePath, "utf-8") : null
  const currentIntegrity = fs.existsSync(input.integrityFilePath)
    ? readJsonFileSafe<IntegrityMetadata & { runtimeStateHash?: string }>(input.integrityFilePath)
    : { value: null, error: null }

  const quarantinedPaths: string[] = []
  const hasHalfPair = fs.existsSync(input.contextFilePath) !== fs.existsSync(input.integrityFilePath)
  const integrityInvalid = currentIntegrity.error !== null
  const contentMismatch = currentContent && currentIntegrity.value
    ? !verifyTextIntegrity(currentContent, currentIntegrity.value as Parameters<typeof verifyTextIntegrity>[1]).valid
    : false

  if (
    currentContent
    && currentIntegrity.value
    && !hasHalfPair
    && !integrityInvalid
    && !contentMismatch
    && currentIntegrity.value.runtimeStateHash === (input.integrity.runtimeStateHash as string | undefined)
  ) {
    return { quarantinedPaths, verificationPassed: true, preserved: true }
  }

  if (hasHalfPair || integrityInvalid || contentMismatch) {
    const quarantinedContent = quarantineTextArtifact(input.contextFilePath, input.recoveryDir, `${input.label}-runtime-context`)
    const quarantinedIntegrity = quarantineTextArtifact(input.integrityFilePath, input.recoveryDir, `${input.label}-runtime-integrity`)
    if (quarantinedContent) quarantinedPaths.push(quarantinedContent)
    if (quarantinedIntegrity) quarantinedPaths.push(quarantinedIntegrity)
  }

  atomicWriteFileSet([
    { filePath: input.contextFilePath, content: input.content },
    { filePath: input.integrityFilePath, content: `${JSON.stringify(input.integrity, null, 2)}\n` },
  ], {
    label: `runtime-context:${input.label}`,
    journalPath: path.join(input.recoveryDir, `${input.label}.runtime-write.json`),
  })

  const verification = verifyTextIntegrity(fs.readFileSync(input.contextFilePath, "utf-8"), input.integrity as Parameters<typeof verifyTextIntegrity>[1])
  return { quarantinedPaths, verificationPassed: verification.valid, preserved: false }
}