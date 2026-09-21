import fs from 'node:fs'
import path from 'node:path'

import { loadRegistry, normalizeInputPath, resolveBaselinePaths, validateRegistry } from '../architecture-classify.mjs'

function matchesBootstrapPattern(pattern, target) {
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3).replace(/\/$/, '')
    return target === prefix || target.startsWith(`${prefix}/`)
  }
  return target === pattern
}

function resolveBootstrapRouting({ profile, targets, repositoryRoot }) {
  const patterns = profile.repository.routingBootstrapPaths ?? []
  if (patterns.length === 0) return null
  const results = targets.map((target) => {
    const normalizedPath = normalizeInputPath(target, repositoryRoot)
    const matchedPattern = patterns.find((pattern) => matchesBootstrapPattern(pattern, normalizedPath)) ?? null
    return {
      inputPath: target,
      normalizedPath,
      resolutionStatus: matchedPattern ? 'RESOLVED' : 'NO_MATCH',
      matchedSurfaceId: matchedPattern ? `${profile.projectKey}-GOVERNANCE-BOOTSTRAP` : null,
      matchedPattern,
      baselineClassification: matchedPattern ? 'ALIGNED' : null,
      currentOwner: matchedPattern ? `${profile.projectKey} Governance Bootstrap` : null,
      currentResponsibility: matchedPattern ? 'Create the project-local governance entrypoint, routing registry, validator, adapter, and CI gate.' : null,
      matchCount: matchedPattern ? 1 : 0,
      highestSpecificityMatchCount: matchedPattern ? 1 : 0,
      conflictingSurfaceIds: [],
    }
  })
  return {
    ok: results.length > 0 && results.every((entry) => entry.resolutionStatus === 'RESOLVED'),
    results,
    error: results.every((entry) => entry.resolutionStatus === 'RESOLVED')
      ? null
      : `Project ${profile.projectKey} routing bootstrap is restricted to declared governance paths.`,
    bootstrapMode: true,
  }
}

export function resolveProjectRouting({ profile, targets, repositoryRoot }) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return { ok: false, results: [], error: 'At least one exact --target is required for development mode.' }
  }
  if (!profile.repository.routingRegistry) {
    return resolveBootstrapRouting({ profile, targets, repositoryRoot })
      ?? { ok: false, results: [], error: `Project ${profile.projectKey} has no active routing registry. Product mutation is blocked until ownership is registered.` }
  }

  try {
    const registryPath = path.join(repositoryRoot, profile.repository.routingRegistry)
    if (!fs.existsSync(registryPath)) {
      return resolveBootstrapRouting({ profile, targets, repositoryRoot })
        ?? { ok: false, results: [], error: `Project ${profile.projectKey} routing registry is missing: ${profile.repository.routingRegistry}` }
    }
    const registry = loadRegistry(registryPath)
    const validation = validateRegistry(registry)
    if (!validation.valid) return { ok: false, results: [], error: validation.errors.join(' | ') }
    const results = resolveBaselinePaths({ registry, inputPaths: targets, repoRoot: repositoryRoot })
    return {
      ok: results.length > 0 && results.every((entry) => entry.resolutionStatus === 'RESOLVED'),
      results,
      error: null,
    }
  } catch (error) {
    return { ok: false, results: [], error: error.message }
  }
}
