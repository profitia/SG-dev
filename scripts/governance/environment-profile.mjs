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
  if (!environment || !['ACTIVE', 'PROVISIONING', 'RESERVED'].includes(environment.status)) {
    throw new Error(`TARGET_ENVIRONMENT ${normalized} is not registered for ${profile.projectKey}.`)
  }
  if (environment.github?.exclusiveProjectKey !== profile.projectKey) {
    throw new Error(`TARGET_ENVIRONMENT ${normalized} is not exclusively assigned to ${profile.projectKey}.`)
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
    if (!githubEnvironmentId) errors.push(`Missing GitHub environment ID for ${name}`)
    else if (githubEnvironmentIds.has(githubEnvironmentId)) errors.push(`GitHub environment ${githubEnvironmentId} is shared by ${githubEnvironmentIds.get(githubEnvironmentId)} and ${name}`)
    else githubEnvironmentIds.set(githubEnvironmentId, name)
    const branchId = environment.neon?.branchId
    if (!branchId) errors.push(`Missing Neon branch ID for ${name}`)
    else if (branchIds.has(branchId)) errors.push(`Neon branch ${branchId} is shared by ${branchIds.get(branchId)} and ${name}`)
    else branchIds.set(branchId, name)

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
