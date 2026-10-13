import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const DEVELOPMENT_CONTRACT_VERSION = '1.0.0'
const tracks = new Set(['SG2', 'SRM', 'ARCHITECTURE'])

// The expected identity is resolved from Canon. A folder name is never authority.
export function assertDevelopmentContext(actual, expected) {
  if (!actual || !expected || !tracks.has(expected.projectKey)) throw new Error('Registered Development track required')
  if (actual.projectKey !== expected.projectKey || actual.workspaceName !== expected.workspaceName) throw new Error('Development project or workspace identity mismatch')
  if (actual.targetEnvironment !== 'development' || expected.targetEnvironment !== 'development') throw new Error('Only Development integration is supported')
  return Object.freeze({ projectKey: actual.projectKey, workspaceName: actual.workspaceName, targetEnvironment: 'development' })
}

export function assertAcceptedContractVersion(version) {
  if (version !== DEVELOPMENT_CONTRACT_VERSION) throw new Error('Consumer must explicitly accept the current Development contract version')
}

export function developmentContractDigest() {
  return createHash('sha256')
    .update(readFileSync(new URL('./development-context.mjs', import.meta.url)))
    .update(readFileSync(new URL('./development-context.d.mts', import.meta.url)))
    .digest('hex')
}
