import fs from 'node:fs'
import path from 'node:path'

const ALLOWED_ENVIRONMENTS = ['development', 'staging', 'production']

function normalizeEnvironment(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function loadEnvironmentTopology(profile, governanceRoot) {
  const registryPath = profile?.repository?.environmentTopologyRegistry
  if (!registryPath) {
    throw new Error(`Project ${profile?.projectKey ?? '<unknown>'} does not declare environmentTopologyRegistry.`)
  }
  const resolvedPath = path.join(governanceRoot, registryPath)
  const registry = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
  if (registry.schemaVersion !== '1.0' || registry.projectKey !== profile.projectKey || !registry.environments) {
    throw new Error(`Invalid environment topology registry: ${registryPath}`)
  }
  return { registry, registryPath }
}

export function resolveEnvironmentProfile({ profile, targetEnvironment, governanceRoot }) {
  const normalized = normalizeEnvironment(targetEnvironment)
  if (!ALLOWED_ENVIRONMENTS.includes(normalized)) {
    throw new Error(`Unknown TARGET_ENVIRONMENT "${targetEnvironment}". Expected one of: ${ALLOWED_ENVIRONMENTS.join(', ')}.`)
  }
  const { registry, registryPath } = loadEnvironmentTopology(profile, governanceRoot)
  const environment = registry.environments[normalized]
  if (!environment || environment.status !== 'ACTIVE') {
    throw new Error(`TARGET_ENVIRONMENT ${normalized} is not ACTIVE for ${profile.projectKey} (status=${environment?.status ?? 'missing'}).`)
  }
  if (environment.github?.exclusiveProjectKey !== profile.projectKey) {
    throw new Error(`TARGET_ENVIRONMENT ${normalized} is not exclusively assigned to ${profile.projectKey}.`)
  }
  if (!environment.github.environmentId || !environment.render?.environmentId || !environment.neon?.branchId) {
    throw new Error(`TARGET_ENVIRONMENT ${normalized} lacks required provider identities for ${profile.projectKey}.`)
  }
  if (environment.github.repository && environment.github.repository !== profile.repository.slug) {
    throw new Error(`TARGET_ENVIRONMENT ${normalized} has the wrong GitHub repository for ${profile.projectKey}.`)
  }
  if (registry.policy?.sourceAuthority !== profile.repository.slug) {
    throw new Error(`TARGET_ENVIRONMENT ${normalized} has the wrong source authority for ${profile.projectKey}.`)
  }
  if (profile.projectKey === 'SRM') {
    if (environment.verificationStatus !== 'VERIFIED' || !environment.github.repositoryId || environment.github.repositoryId !== registry.policy.sourceRepositoryId) {
      throw new Error(`TARGET_ENVIRONMENT ${normalized} lacks verified SRM GitHub identity.`)
    }
    if (environment.neon.projectId === profile.database.projectId || environment.neon.databaseName === profile.database.databaseName) {
      throw new Error(`TARGET_ENVIRONMENT ${normalized} uses the SRM PMOS database identity for product data.`)
    }
    if (environment.render.projectId !== registry.policy.renderProjectId || !registry.policy.renderProjectId) {
      throw new Error(`TARGET_ENVIRONMENT ${normalized} has the wrong SRM Render project identity.`)
    }
    if (environment.neon.projectId !== registry.policy.productNeonProjectId || registry.policy.productNeonProjectId === profile.database.projectId) {
      throw new Error(`TARGET_ENVIRONMENT ${normalized} has the wrong SRM product Neon project identity.`)
    }
    if (environment.neon.databaseName !== registry.policy.productDatabaseName || registry.policy.productDatabaseName === profile.database.databaseName) {
      throw new Error(`TARGET_ENVIRONMENT ${normalized} has the wrong SRM product database identity.`)
    }
    if (!environment.neon.projectId || !environment.neon.databaseId || !environment.neon.databaseName || environment.neon.purpose !== 'SRM_APPLICATION_DATA') {
      throw new Error(`TARGET_ENVIRONMENT ${normalized} lacks a registered SRM application database identity.`)
    }
  }
  return { targetEnvironment: normalized, environment, registryPath }
}

export function validateEnvironmentTopology(registry) {
  const errors = []
  const serviceIds = new Map()
  const branchIds = new Map()
  const githubEnvironmentIds = new Map()
  for (const name of ALLOWED_ENVIRONMENTS) {
    const environment = registry.environments?.[name]
    if (!environment) {
      errors.push(`Missing environment: ${name}`)
      continue
    }
    const expectedGithubEnvironmentName = `${String(registry.projectKey).toLowerCase()}-${name}`
    if (environment.github?.environmentName !== expectedGithubEnvironmentName) {
      errors.push(`GitHub environment for ${name} must be namespaced as ${expectedGithubEnvironmentName}`)
    }
    const githubEnvironmentId = environment.github?.environmentId
    if (!githubEnvironmentId && environment.status === 'ACTIVE') errors.push(`Missing GitHub environment ID for ${name}`)
    else if (githubEnvironmentId && githubEnvironmentIds.has(githubEnvironmentId)) errors.push(`GitHub environment ${githubEnvironmentId} is shared by ${githubEnvironmentIds.get(githubEnvironmentId)} and ${name}`)
    else if (githubEnvironmentId) githubEnvironmentIds.set(githubEnvironmentId, name)
    const branchId = environment.neon?.branchId
    if (!branchId && environment.status === 'ACTIVE') errors.push(`Missing Neon branch ID for ${name}`)
    else if (branchId && branchIds.has(branchId)) errors.push(`Neon branch ${branchId} is shared by ${branchIds.get(branchId)} and ${name}`)
    else if (branchId) branchIds.set(branchId, name)

    for (const service of Object.values(environment.render?.services ?? {})) {
      if (!service.serviceId) continue
      if (serviceIds.has(service.serviceId)) errors.push(`Render service ${service.serviceId} is shared by ${serviceIds.get(service.serviceId)} and ${name}`)
      else serviceIds.set(service.serviceId, name)
    }
  }
  if (/postgres(?:ql)?:\/\/|password|access[_-]?token|secret[_-]?key/i.test(JSON.stringify(registry))) {
    errors.push('Environment topology registry contains a prohibited secret or connection-string marker')
  }
  return { valid: errors.length === 0, errors }
}

// The snapshot must be captured from read-only Render and Neon provider APIs.
// This function deliberately compares immutable IDs before descriptive names.
export function compareProviderSnapshot(registry, targetEnvironment, snapshot, now = Date.now()) {
  const errors = []
  const environment = registry.environments?.[targetEnvironment]
  const capturedAt = Date.parse(snapshot?.capturedAt ?? '')
  if (!Number.isFinite(capturedAt) || capturedAt > now || now - capturedAt > 15 * 60_000) {
    errors.push('Provider snapshot is missing or older than 15 minutes')
  }
  if (snapshot?.source?.render !== 'render-api' || snapshot?.source?.neon !== 'neon-api') {
    errors.push('Provider snapshot must identify read-only Render and Neon API sources')
  }
  if (!environment) return { valid: false, errors: [...errors, `Unknown environment: ${targetEnvironment}`] }
  if (!Array.isArray(snapshot?.renderServices) || !Array.isArray(snapshot?.neonBranches)) {
    return { valid: false, errors: [...errors, 'Provider snapshot requires complete renderServices and neonBranches arrays'] }
  }
  const expectedServices = Object.values(environment.render.services ?? {})
  const expectedIds = new Set(expectedServices.map((service) => service.serviceId))
  for (const expected of expectedServices) {
    const actual = snapshot.renderServices.find((service) => service.id === expected.serviceId)
    if (!actual) { errors.push(`Missing Render service ${expected.serviceId}`); continue }
    if (actual.environmentId !== environment.render.environmentId) errors.push(`Render environment mismatch for ${expected.serviceId}`)
    if (actual.autoDeploy !== expected.autoDeploy) errors.push(`Render autoDeploy drift for ${expected.serviceId}: expected ${expected.autoDeploy}, actual ${actual.autoDeploy}`)
    if (actual.liveStatus !== 'live') errors.push(`Render service ${expected.serviceId} has no live deploy`)
    if (targetEnvironment === 'staging') {
      if (actual.liveDeployId !== expected.baselineDeployId || actual.liveSha !== expected.baselineSha) {
        errors.push(`Staging baseline drift for ${expected.serviceId}: expected ${expected.baselineSha}, actual ${actual.liveSha ?? '<missing>'}`)
      }
    }
  }
  const sourceRepo = `https://github.com/${registry.policy.sourceAuthority}`
  for (const actual of snapshot.renderServices) {
    if (actual.environmentId === environment.render.environmentId
      && String(actual.repo ?? '').replace(/\.git$/, '') === sourceRepo
      && !expectedIds.has(actual.id)) {
      errors.push(`Unregistered ${registry.projectKey} Render service in ${targetEnvironment}: ${actual.id}`)
    }
  }
  const branch = snapshot.neonBranches.find((candidate) => candidate.id === environment.neon.branchId)
  if (!branch || branch.projectId !== environment.neon.projectId || branch.name !== environment.neon.branchName) {
    errors.push(`Neon branch identity mismatch for ${targetEnvironment}: ${environment.neon.branchId}`)
  }
  return { valid: errors.length === 0, errors }
}
