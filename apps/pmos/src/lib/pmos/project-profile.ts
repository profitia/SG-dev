export const DEFAULT_PMOS_PROJECT_NAME = 'SpendGuru 2.0'
export const SRM_PMOS_PROJECT_NAME = 'SRM / PORR'

export const CANONICAL_PMOS_PROJECT_NAMES: ReadonlySet<string> = new Set([
  DEFAULT_PMOS_PROJECT_NAME,
  SRM_PMOS_PROJECT_NAME,
])

export const CANONICAL_PMOS_WORKSPACE_NAMES: ReadonlySet<string> = new Set([
  'SG-dev',
  'sg2-pcog-runtime',
  'SG-dev Codespaces SRM',
])

export type PmosMemorosMode = 'required' | 'disabled'
export type PmosMemorosAuditStatus = 'MEMOROS_REQUIRED' | 'MEMOROS_DISABLED_BY_PROJECT_PROFILE'

export type PmosProjectProfile = {
  projectName: string
  workspaceName?: string
  memorosMode: PmosMemorosMode
  memorosAuditStatus: PmosMemorosAuditStatus
  memorosEnabled: boolean
  phrRequiredForCloseout: boolean
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeLooseIdentifier(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\s*\[[^\]]+\]\s*$/g, '')
    .toLowerCase()
    .replace(/[\/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizePmosProjectName(projectName: string): string {
  const normalized = normalizeWhitespace(projectName).replace(/\s*\[[^\]]+\]\s*$/g, '')
  const key = normalizeLooseIdentifier(projectName)

  if (
    key === 'spendguru 2.0'
    || key === 'spend guru'
    || key === 'spendguru'
    || key === 'spendguru 2 0'
    || key === 'spendguru 2'
    || key === 'spendguru 2 pmos'
    || key === 'sg2 discovery runtime'
    || key === 'sg dev'
    || key === 'spendguru 2.0 pmos'
    || key === 'spendguru 2.0 pcos runtime'
  ) {
    return DEFAULT_PMOS_PROJECT_NAME
  }

  if (key === 'srm' || key === 'srm porr') {
    return SRM_PMOS_PROJECT_NAME
  }

  return normalized
}

export function normalizePmosWorkspaceName(workspaceName: string): string {
  const normalized = normalizeWhitespace(workspaceName).replace(/\s*\[[^\]]+\]\s*$/g, '')
  const key = normalizeLooseIdentifier(workspaceName)

  if (key === 'sg dev' || key === 'sgdev') {
    return 'SG-dev'
  }

  if (key === 'sg2 pcog runtime') {
    return 'sg2-pcog-runtime'
  }

  if (key === 'sg dev codespaces srm' || key === 'sg dev codespace srm') {
    return 'SG-dev Codespaces SRM'
  }

  return normalized
}

export function getConfiguredPmosProjectName(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PMOS_PROJECT_NAME?.trim()
  if (!configured) return DEFAULT_PMOS_PROJECT_NAME
  return normalizePmosProjectName(configured)
}

export function getConfiguredPmosWorkspaceName(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const configured = env.PMOS_WORKSPACE_NAME?.trim()
  if (!configured) return undefined
  return normalizePmosWorkspaceName(configured)
}

export function resolvePmosProjectProfile(params: {
  projectName: string
  workspaceName?: string
  memorosMode?: string
}): PmosProjectProfile {
  const projectName = normalizePmosProjectName(params.projectName)
  const workspaceName = params.workspaceName ? normalizePmosWorkspaceName(params.workspaceName) : undefined
  const configuredMode = params.memorosMode

  if (configuredMode === undefined) {
    return {
      projectName,
      workspaceName,
      memorosMode: 'required',
      memorosAuditStatus: 'MEMOROS_REQUIRED',
      memorosEnabled: true,
      phrRequiredForCloseout: false,
    }
  }

  const normalizedMode = configuredMode.trim().toLowerCase()
  if (!normalizedMode) {
    throw new Error('PMOS_MEMOROS_MODE is set but empty. Valid values: required, disabled.')
  }

  if (normalizedMode !== 'required' && normalizedMode !== 'disabled') {
    throw new Error(`PMOS_MEMOROS_MODE \"${configuredMode}\" is invalid. Valid values: required, disabled.`)
  }

  if (normalizedMode === 'disabled' && projectName !== SRM_PMOS_PROJECT_NAME) {
    throw new Error('PMOS_MEMOROS_MODE=disabled is allowed only for project SRM / PORR.')
  }

  return {
    projectName,
    workspaceName,
    memorosMode: normalizedMode,
    memorosAuditStatus: normalizedMode === 'disabled' ? 'MEMOROS_DISABLED_BY_PROJECT_PROFILE' : 'MEMOROS_REQUIRED',
    memorosEnabled: normalizedMode !== 'disabled',
    phrRequiredForCloseout: normalizedMode === 'disabled',
  }
}

export function runMemorosPublicationIfEnabled<T>(
  profile: PmosProjectProfile,
  publish: () => Promise<T>,
): Promise<{ attempted: boolean; auditStatus: PmosMemorosAuditStatus; result: T | null }> {
  if (!profile.memorosEnabled) {
    return Promise.resolve({
      attempted: false,
      auditStatus: profile.memorosAuditStatus,
      result: null,
    })
  }

  return publish().then((result) => ({
    attempted: true,
    auditStatus: profile.memorosAuditStatus,
    result,
  }))
}

export function isSuccessfulPhrCloseoutStatus(status: string | null | undefined): boolean {
  return status === 'PUBLISHED' || status === 'IDEMPOTENT'
}

export function isPhrSatisfiedForCloseout(profile: PmosProjectProfile, status: string | null | undefined): boolean {
  if (!profile.phrRequiredForCloseout) return true
  return isSuccessfulPhrCloseoutStatus(status)
}