import path from 'node:path'

import { loadRegistry, resolveBaselinePaths, validateRegistry } from '../architecture-classify.mjs'

export function resolveProjectRouting({ profile, targets, repositoryRoot }) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return { ok: false, results: [], error: 'At least one exact --target is required for development mode.' }
  }
  if (!profile.repository.routingRegistry) {
    return { ok: false, results: [], error: `Project ${profile.projectKey} has no active routing registry. Product mutation is blocked until ownership is registered.` }
  }

  try {
    const registry = loadRegistry(path.join(repositoryRoot, profile.repository.routingRegistry))
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
