import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const GOVERNANCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const PROJECT_REGISTRY_PATH = 'Canon/registries/profitia-projects-v1.json'

function normalize(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s*\[[^\]]+\]\s*$/g, '')
    .toLowerCase()
    .replace(/[\/_\-\u2010-\u2015\u2212]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function loadProjectRegistry(governanceRoot = GOVERNANCE_ROOT) {
  const registryPath = path.join(governanceRoot, PROJECT_REGISTRY_PATH)
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  if (registry.schemaVersion !== '1.0' || registry.defaultPolicy !== 'FAIL_CLOSED' || !Array.isArray(registry.projects)) {
    throw new Error(`Invalid Profitia project registry: ${PROJECT_REGISTRY_PATH}`)
  }
  return registry
}

export function resolveProjectProfile(projectIdentity, governanceRoot = GOVERNANCE_ROOT) {
  const key = normalize(projectIdentity)
  const profile = loadProjectRegistry(governanceRoot).projects.find((project) => (
    project.status === 'ACTIVE'
    && [project.projectKey, project.displayName, ...(project.aliases ?? [])].some((candidate) => normalize(candidate) === key)
  ))
  if (!profile) {
    throw new Error(`Unknown project "${projectIdentity}". Add an ACTIVE profile to ${PROJECT_REGISTRY_PATH}.`)
  }
  return profile
}

export function resolveHistoricalProjectProfile(projectIdentity, governanceRoot = GOVERNANCE_ROOT) {
  const key = normalize(projectIdentity)
  return loadProjectRegistry(governanceRoot).projects.find((project) => (
    project.status === 'ACTIVE'
    && [project.projectKey, project.displayName, ...(project.aliases ?? []), ...(project.legacyAliases ?? [])]
      .some((candidate) => normalize(candidate) === key)
  )) ?? null
}

export function normalizeRepositorySlug(remoteUrl) {
  const value = String(remoteUrl ?? '').trim().replace(/\.git$/i, '')
  const match = value.match(/(?:github\.com[/:])([^/]+\/[^/]+)$/i)
  return match ? match[1].toLowerCase() : value.toLowerCase()
}
