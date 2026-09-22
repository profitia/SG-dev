import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import type { EstateAuditSnapshot, VerificationStatus } from './operations'

type MissingComponent = 'integrity' | 'lock' | 'closeout'

type HistoricalEstateException = {
  baseName: string
  classification: 'PRE_CLOSEOUT_STANDARD_ARTIFACT'
  taskId: string
  introducedByCommit: string
  introducedAt: string
  reason: string
  expectedMissing: MissingComponent[]
  contentSha256: {
    json: string
    markdown: string
  }
}

type HistoricalEstateManifest = {
  schemaVersion: '1.0'
  exceptions: HistoricalEstateException[]
}

export type HistoricalEstateAuditResult = {
  snapshot: EstateAuditSnapshot
  acknowledgedExceptions: HistoricalEstateException[]
  manifestPath: string
  errors: string[]
}

type HistoricalEstatePaths = {
  conversationsDir: string
  closeoutsDir: string
  manifestPath: string
}

const REQUIRED_MISSING_COMPONENTS = new Set<MissingComponent>(['integrity', 'lock', 'closeout'])

function statusFromCounts(hasErrors: boolean, hasWarnings: boolean): VerificationStatus {
  if (hasErrors) return 'FAIL'
  if (hasWarnings) return 'WARN'
  return 'PASS'
}

function sha256(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function validateException(value: unknown, index: number): HistoricalEstateException {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`exceptions[${index}] must be an object`)
  }

  const candidate = value as Partial<HistoricalEstateException>
  const label = `exceptions[${index}]`
  if (typeof candidate.baseName !== 'string' || !/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}_[a-z0-9-]+$/.test(candidate.baseName)) {
    throw new Error(`${label}.baseName is invalid`)
  }
  if (candidate.classification !== 'PRE_CLOSEOUT_STANDARD_ARTIFACT') {
    throw new Error(`${label}.classification is unsupported`)
  }
  if (typeof candidate.taskId !== 'string' || candidate.taskId.trim() === '') {
    throw new Error(`${label}.taskId is required`)
  }
  if (typeof candidate.introducedByCommit !== 'string' || !/^[a-f0-9]{40}$/.test(candidate.introducedByCommit)) {
    throw new Error(`${label}.introducedByCommit must be a full Git commit SHA`)
  }
  if (typeof candidate.introducedAt !== 'string' || Number.isNaN(new Date(candidate.introducedAt).getTime())) {
    throw new Error(`${label}.introducedAt must be an ISO timestamp`)
  }
  if (typeof candidate.reason !== 'string' || candidate.reason.trim().length < 40) {
    throw new Error(`${label}.reason must explain why modern closeout evidence cannot be reconstructed`)
  }
  if (!Array.isArray(candidate.expectedMissing)) {
    throw new Error(`${label}.expectedMissing must be an array`)
  }
  const expectedMissing = new Set(candidate.expectedMissing)
  if (expectedMissing.size !== REQUIRED_MISSING_COMPONENTS.size
    || [...REQUIRED_MISSING_COMPONENTS].some((component) => !expectedMissing.has(component))) {
    throw new Error(`${label}.expectedMissing must contain exactly integrity, lock, and closeout`)
  }
  if (!candidate.contentSha256 || !isSha256(candidate.contentSha256.json) || !isSha256(candidate.contentSha256.markdown)) {
    throw new Error(`${label}.contentSha256 must contain exact JSON and Markdown SHA-256 hashes`)
  }

  return candidate as HistoricalEstateException
}

function readManifest(manifestPath: string): HistoricalEstateManifest {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Partial<HistoricalEstateManifest>
  if (parsed.schemaVersion !== '1.0' || !Array.isArray(parsed.exceptions)) {
    throw new Error('historical estate manifest must use schemaVersion 1.0 and contain exceptions[]')
  }
  const exceptions = parsed.exceptions.map(validateException)
  const duplicate = exceptions.find((entry, index) => exceptions.findIndex((candidate) => candidate.baseName === entry.baseName) !== index)
  if (duplicate) throw new Error(`duplicate historical estate exception: ${duplicate.baseName}`)
  return { schemaVersion: '1.0', exceptions }
}

function defaultPaths(appRoot: string): HistoricalEstatePaths {
  const pmosDir = path.join(appRoot, '.pmos')
  return {
    conversationsDir: path.join(pmosDir, 'conversations'),
    closeoutsDir: path.join(pmosDir, 'recovery', 'closeouts'),
    manifestPath: path.join(pmosDir, 'historical-estate-exceptions-v1.json'),
  }
}

function verifyException(entry: HistoricalEstateException, paths: HistoricalEstatePaths): string[] {
  const basePath = path.join(paths.conversationsDir, entry.baseName)
  const jsonPath = `${basePath}.json`
  const markdownPath = `${basePath}.md`
  const integrityPath = `${basePath}.integrity.json`
  const lockPath = `${basePath}.lock.json`
  const closeoutPath = path.join(paths.closeoutsDir, `${entry.baseName}.closeout.json`)
  const errors: string[] = []

  if (!fs.existsSync(jsonPath)) errors.push(`${entry.baseName}: JSON artifact is missing`)
  if (!fs.existsSync(markdownPath)) errors.push(`${entry.baseName}: Markdown artifact is missing`)
  if (fs.existsSync(jsonPath) && sha256(jsonPath) !== entry.contentSha256.json) errors.push(`${entry.baseName}: JSON hash drift`)
  if (fs.existsSync(markdownPath) && sha256(markdownPath) !== entry.contentSha256.markdown) errors.push(`${entry.baseName}: Markdown hash drift`)
  if (fs.existsSync(integrityPath)) errors.push(`${entry.baseName}: exception is stale because integrity evidence now exists`)
  if (fs.existsSync(lockPath)) errors.push(`${entry.baseName}: exception is stale because lock evidence now exists`)
  if (fs.existsSync(closeoutPath)) errors.push(`${entry.baseName}: exception is stale because closeout evidence now exists`)

  return errors
}

function normalizeSnapshot(snapshot: EstateAuditSnapshot, acknowledgedCount: number): EstateAuditSnapshot {
  const normalized: EstateAuditSnapshot = {
    ...snapshot,
    archive: { ...snapshot.archive },
    integrity: { ...snapshot.integrity },
    closeouts: { ...snapshot.closeouts },
    recovery: { ...snapshot.recovery },
    maintenance: { ...snapshot.maintenance },
    metrics: { ...snapshot.metrics },
    lifecycle: { ...snapshot.lifecycle },
  }

  normalized.archive.warnings = Math.max(0, normalized.archive.warnings - acknowledgedCount)
  normalized.integrity.missingIntegrity = Math.max(0, normalized.integrity.missingIntegrity - acknowledgedCount)
  normalized.integrity.missingLocks = Math.max(0, normalized.integrity.missingLocks - acknowledgedCount)
  normalized.closeouts.expected = Math.max(0, normalized.closeouts.expected - acknowledgedCount)
  normalized.closeouts.missing = Math.max(0, normalized.closeouts.missing - acknowledgedCount)

  normalized.archive.status = statusFromCounts(normalized.archive.invalidArtifacts > 0, normalized.archive.warnings > 0)
  normalized.integrity.status = statusFromCounts(
    normalized.integrity.corruptedIntegrity > 0 || normalized.integrity.corruptedLocks > 0,
    normalized.integrity.missingIntegrity > 0 || normalized.integrity.missingLocks > 0,
  )
  normalized.closeouts.status = statusFromCounts(normalized.closeouts.missing > 0, normalized.closeouts.recoveryRequired > 0)
  normalized.status = statusFromCounts(
    [normalized.archive.status, normalized.integrity.status, normalized.closeouts.status, normalized.recovery.status, normalized.maintenance.status].includes('FAIL'),
    [normalized.archive.status, normalized.integrity.status, normalized.closeouts.status, normalized.recovery.status, normalized.maintenance.status].includes('WARN'),
  )
  return normalized
}

export function applyHistoricalEstateExceptions(
  snapshot: EstateAuditSnapshot,
  overrides: Partial<HistoricalEstatePaths> & { appRoot?: string } = {},
): HistoricalEstateAuditResult {
  const paths = { ...defaultPaths(overrides.appRoot ?? process.cwd()), ...overrides }
  const errors: string[] = []
  let manifest: HistoricalEstateManifest

  try {
    manifest = readManifest(paths.manifestPath)
  } catch (error) {
    return {
      snapshot: {
        ...snapshot,
        status: 'FAIL',
        historicalExceptions: {
          status: 'FAIL',
          acknowledged: 0,
          artifacts: [],
          errors: [(error as Error).message],
        },
      },
      acknowledgedExceptions: [],
      manifestPath: paths.manifestPath,
      errors: [(error as Error).message],
    }
  }

  const acknowledgedExceptions = manifest.exceptions.filter((entry) => {
    const entryErrors = verifyException(entry, paths)
    errors.push(...entryErrors)
    return entryErrors.length === 0
  })
  const normalized = normalizeSnapshot(snapshot, acknowledgedExceptions.length)
  if (errors.length > 0) normalized.status = 'FAIL'
  normalized.historicalExceptions = {
    status: errors.length > 0 ? 'FAIL' : 'PASS',
    acknowledged: acknowledgedExceptions.length,
    artifacts: acknowledgedExceptions.map((entry) => entry.baseName),
    errors,
  }

  return {
    snapshot: normalized,
    acknowledgedExceptions,
    manifestPath: paths.manifestPath,
    errors,
  }
}

export function formatHistoricalEstateExceptions(result: HistoricalEstateAuditResult): string {
  if (result.errors.length > 0) {
    return ` - historical-exceptions: FAIL | acknowledged=${result.acknowledgedExceptions.length} | errors=${result.errors.join('; ')}`
  }
  const names = result.acknowledgedExceptions.map((entry) => entry.baseName).join(',') || 'none'
  return ` - historical-exceptions: PASS | acknowledged=${result.acknowledgedExceptions.length} | artifacts=${names}`
}
