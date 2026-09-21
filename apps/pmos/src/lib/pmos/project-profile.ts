import projectRegistry from '../../../../../Canon/registries/profitia-projects-v1.json'

export const DEFAULT_PMOS_PROJECT_NAME = 'SpendGuru 2.0'
export const SRM_PMOS_PROJECT_NAME = 'SRM'

export type PmosMemorosMode = 'required' | 'disabled'
export type PmosMemorosAuditStatus = 'MEMOROS_REQUIRED' | 'MEMOROS_DISABLED_BY_PROJECT_PROFILE'
export type PmosContinuityMode = 'required' | 'disabled'

type RegistryProject = {
  projectKey: string
  displayName: string
  aliases: string[]
  legacyAliases?: string[]
  workspaces: string[]
  repository: { slug: string; defaultBranch: string; routingRegistry: string | null; routingBootstrapPaths?: string[] }
  database: { provider: 'neon'; projectId: string; databaseName: string; allowedHosts: string[] }
  continuity: { pmos: PmosContinuityMode; memoros: PmosMemorosMode; phr: PmosContinuityMode }
  adapter: string
  status: 'ACTIVE' | 'SUPERSEDED'
}

export type PmosProjectProfile = RegistryProject & {
  projectName: string
  workspaceName?: string
  memorosMode: PmosMemorosMode
  memorosAuditStatus: PmosMemorosAuditStatus
  memorosEnabled: boolean
  phrRequiredForCloseout: boolean
}

const ACTIVE_PROJECTS = (projectRegistry.projects as RegistryProject[]).filter((project) => project.status === 'ACTIVE')

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeLooseIdentifier(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\s*\[[^\]]+\]\s*$/g, '')
    .toLowerCase()
    .replace(/[\/_\-\u2010-\u2015\u2212]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function projectIdentifiers(project: RegistryProject): string[] {
  return [project.projectKey, project.displayName, ...project.aliases].map(normalizeLooseIdentifier)
}

function historicalProjectIdentifiers(project: RegistryProject): string[] {
  return [...projectIdentifiers(project), ...(project.legacyAliases ?? []).map(normalizeLooseIdentifier)]
}

export function listActivePmosProjectProfiles(): readonly RegistryProject[] {
  return ACTIVE_PROJECTS
}

export function findPmosProjectProfile(projectIdentity: string): RegistryProject | null {
  const key = normalizeLooseIdentifier(projectIdentity)
  return ACTIVE_PROJECTS.find((project) => projectIdentifiers(project).includes(key)) ?? null
}

export function findHistoricalPmosProjectProfile(projectIdentity: string): RegistryProject | null {
  const key = normalizeLooseIdentifier(projectIdentity)
  return ACTIVE_PROJECTS.find((project) => historicalProjectIdentifiers(project).includes(key)) ?? null
}

export function requirePmosProjectProfile(projectIdentity: string): RegistryProject {
  const profile = findPmosProjectProfile(projectIdentity)
  if (!profile) {
    throw new Error(`Unknown PMOS project "${projectIdentity}". Add an ACTIVE profile to Canon/registries/profitia-projects-v1.json before execution.`)
  }
  return profile
}

export const CANONICAL_PMOS_PROJECT_NAMES: ReadonlySet<string> = new Set(ACTIVE_PROJECTS.map((project) => project.displayName))
export const CANONICAL_PMOS_WORKSPACE_NAMES: ReadonlySet<string> = new Set(ACTIVE_PROJECTS.flatMap((project) => project.workspaces))

export function normalizePmosProjectName(projectName: string): string {
  const profile = findPmosProjectProfile(projectName)
  return profile?.displayName ?? normalizeWhitespace(projectName).replace(/\s*\[[^\]]+\]\s*$/g, '')
}

export function normalizeHistoricalPmosProjectName(projectName: string): string {
  const profile = findHistoricalPmosProjectProfile(projectName)
  return profile?.displayName ?? normalizeWhitespace(projectName).replace(/\s*\[[^\]]+\]\s*$/g, '')
}

export function normalizePmosWorkspaceName(workspaceName: string): string {
  const key = normalizeLooseIdentifier(workspaceName)
  for (const project of ACTIVE_PROJECTS) {
    const workspace = project.workspaces.find((candidate) => normalizeLooseIdentifier(candidate) === key)
    if (workspace) return workspace
  }
  return normalizeWhitespace(workspaceName).replace(/\s*\[[^\]]+\]\s*$/g, '')
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

export function resolvePmosProjectProfile(params: { projectName: string; workspaceName?: string; memorosMode?: string }): PmosProjectProfile {
  const registryProfile = requirePmosProjectProfile(params.projectName)
  const workspaceName = params.workspaceName ? normalizePmosWorkspaceName(params.workspaceName) : undefined
  if (workspaceName && !registryProfile.workspaces.includes(workspaceName)) {
    throw new Error(`Workspace "${workspaceName}" is not allowed for project ${registryProfile.displayName}.`)
  }

  const configuredMode = params.memorosMode?.trim().toLowerCase()
  if (params.memorosMode !== undefined && !configuredMode) {
    throw new Error('PMOS_MEMOROS_MODE is set but empty. Valid values: required, disabled.')
  }
  if (configuredMode && configuredMode !== 'required' && configuredMode !== 'disabled') {
    throw new Error(`PMOS_MEMOROS_MODE "${params.memorosMode}" is invalid. Valid values: required, disabled.`)
  }
  if (configuredMode && configuredMode !== registryProfile.continuity.memoros) {
    throw new Error(`PMOS_MEMOROS_MODE=${configuredMode} conflicts with the canonical ${registryProfile.projectKey} project profile (${registryProfile.continuity.memoros}).`)
  }

  const memorosMode = registryProfile.continuity.memoros
  return {
    ...registryProfile,
    projectName: registryProfile.displayName,
    workspaceName,
    memorosMode,
    memorosAuditStatus: memorosMode === 'disabled' ? 'MEMOROS_DISABLED_BY_PROJECT_PROFILE' : 'MEMOROS_REQUIRED',
    memorosEnabled: memorosMode !== 'disabled',
    phrRequiredForCloseout: registryProfile.continuity.phr === 'required',
  }
}

export function runMemorosPublicationIfEnabled<T>(profile: PmosProjectProfile, publish: () => Promise<T>): Promise<{ attempted: boolean; auditStatus: PmosMemorosAuditStatus; result: T | null }> {
  if (!profile.memorosEnabled) return Promise.resolve({ attempted: false, auditStatus: profile.memorosAuditStatus, result: null })
  return publish().then((result) => ({ attempted: true, auditStatus: profile.memorosAuditStatus, result }))
}

export function isSuccessfulPhrCloseoutStatus(status: string | null | undefined): boolean {
  return status === 'PUBLISHED' || status === 'IDEMPOTENT'
}

export function isPhrSatisfiedForCloseout(profile: PmosProjectProfile, status: string | null | undefined): boolean {
  return !profile.phrRequiredForCloseout || isSuccessfulPhrCloseoutStatus(status)
}

export function buildNamespacedPublicationId(projectIdentity: string, taskId: string): string {
  return `${requirePmosProjectProfile(projectIdentity).projectKey}:${taskId}`
}
