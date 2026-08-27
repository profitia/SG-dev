#!/usr/bin/env node

import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import process from 'process'

export const EXIT_CODES = Object.freeze({
  OK: 0,
  NO_MATCH: 2,
  CONFLICT: 3,
  INVALID_INPUT: 4,
  INVALID_REGISTRY: 5,
})

const VALID_BASELINE_CLASSIFICATIONS = new Set(['ALIGNED', 'LEGACY'])
const VALID_PATH_RESOLUTION_STRATEGY = 'MOST_SPECIFIC_MATCH_WINS'

function toPosixPath(value) {
  return value.replaceAll('\\', '/')
}

function stripTrailingSlash(value) {
  return value.length > 1 ? value.replace(/\/+$/g, '') : value
}

function isPatternGrammarSupported(pattern) {
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3)
    return prefix.length > 0 && !/[?*\[\]{}]/.test(prefix)
  }

  return !/[?*\[\]{}]/.test(pattern)
}

export function normalizeInputPath(inputPath, repoRoot) {
  if (typeof inputPath !== 'string' || inputPath.trim() === '') {
    const error = new Error('Input path must be a non-empty string.')
    error.code = 'INVALID_INPUT_PATH'
    throw error
  }

  const rawPath = toPosixPath(inputPath.trim())
  const repoRootResolved = path.resolve(repoRoot)
  const absoluteCandidate = rawPath.startsWith('/')
    ? path.resolve(rawPath)
    : path.resolve(repoRootResolved, rawPath)
  const relativeToRoot = toPosixPath(path.relative(repoRootResolved, absoluteCandidate))

  if (relativeToRoot === '' || relativeToRoot === '.' || relativeToRoot === '..' || relativeToRoot.startsWith('../')) {
    const error = new Error(`Input path escapes repository root: ${inputPath}`)
    error.code = 'INVALID_INPUT_PATH'
    throw error
  }

  return stripTrailingSlash(path.posix.normalize(relativeToRoot))
}

export function loadRegistry(registryPath) {
  const raw = fs.readFileSync(registryPath, 'utf8')
  return JSON.parse(raw)
}

export function validateRegistry(registry) {
  const errors = []

  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    errors.push('Registry root must be an object.')
  }

  if (!registry?.schemaVersion) {
    errors.push('Registry schemaVersion is required.')
  }

  if (!registry?.classificationReferenceSha) {
    errors.push('Registry classificationReferenceSha is required.')
  }

  if (registry?.pathResolutionStrategy !== VALID_PATH_RESOLUTION_STRATEGY) {
    errors.push(`Registry pathResolutionStrategy must equal ${VALID_PATH_RESOLUTION_STRATEGY}.`)
  }

  if (!Array.isArray(registry?.surfaces)) {
    errors.push('Registry surfaces must be an array.')
  }

  if (Array.isArray(registry?.surfaces)) {
    const ids = new Set()
    for (const surface of registry.surfaces) {
      if (!surface || typeof surface !== 'object' || Array.isArray(surface)) {
        errors.push('Each surface must be an object.')
        continue
      }

      if (typeof surface.id !== 'string' || surface.id.length === 0) {
        errors.push('Each surface id must be a non-empty string.')
      } else if (ids.has(surface.id)) {
        errors.push(`Duplicate surface id: ${surface.id}`)
      } else {
        ids.add(surface.id)
      }

      if (!Array.isArray(surface.pathPatterns) || surface.pathPatterns.length === 0) {
        errors.push(`Surface ${surface.id ?? '<unknown>'} must define one or more pathPatterns.`)
      } else {
        for (const pattern of surface.pathPatterns) {
          if (typeof pattern !== 'string' || pattern.length === 0) {
            errors.push(`Surface ${surface.id ?? '<unknown>'} contains an empty path pattern.`)
            continue
          }

          if (!isPatternGrammarSupported(pattern)) {
            errors.push(`Surface ${surface.id ?? '<unknown>'} uses unsupported path pattern grammar: ${pattern}`)
          }
        }
      }

      if (!VALID_BASELINE_CLASSIFICATIONS.has(surface.baselineClassification)) {
        errors.push(`Surface ${surface.id ?? '<unknown>'} has invalid baselineClassification: ${surface.baselineClassification}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

function classifyPattern(pattern) {
  if (pattern.endsWith('/**')) {
    return {
      type: 'SUBTREE',
      literalPrefix: stripTrailingSlash(pattern.slice(0, -3)),
    }
  }

  return {
    type: 'EXACT',
    literalPrefix: stripTrailingSlash(pattern),
  }
}

function doesPatternMatch(pattern, normalizedPath) {
  const { type, literalPrefix } = classifyPattern(pattern)
  if (type === 'EXACT') {
    return normalizedPath === literalPrefix
  }

  return normalizedPath === literalPrefix || normalizedPath.startsWith(`${literalPrefix}/`)
}

function buildPatternSpecificity(pattern) {
  const { type, literalPrefix } = classifyPattern(pattern)
  return {
    type,
    literalPrefix,
    weight: type === 'EXACT' ? 2 : 1,
    literalLength: literalPrefix.length,
  }
}

function compareSpecificity(left, right) {
  if (left.weight !== right.weight) {
    return left.weight - right.weight
  }

  if (left.literalLength !== right.literalLength) {
    return left.literalLength - right.literalLength
  }

  return 0
}

export function resolveBaselinePath({ registry, inputPath, repoRoot }) {
  const normalizedPath = normalizeInputPath(inputPath, repoRoot)
  const matches = []

  for (const surface of registry.surfaces) {
    for (const pattern of surface.pathPatterns) {
      if (!doesPatternMatch(pattern, normalizedPath)) {
        continue
      }

      matches.push({
        surface,
        pattern,
        specificity: buildPatternSpecificity(pattern),
      })
    }
  }

  if (matches.length === 0) {
    return {
      inputPath,
      normalizedPath,
      resolutionStatus: 'NO_MATCH',
      matchedSurfaceId: null,
      matchedPattern: null,
      baselineClassification: null,
      currentOwner: null,
      currentResponsibility: null,
      matchCount: 0,
      highestSpecificityMatchCount: 0,
      conflictingSurfaceIds: [],
    }
  }

  let bestSpecificity = matches[0].specificity
  for (const match of matches.slice(1)) {
    if (compareSpecificity(match.specificity, bestSpecificity) > 0) {
      bestSpecificity = match.specificity
    }
  }

  const highestMatches = matches.filter((match) => compareSpecificity(match.specificity, bestSpecificity) === 0)
  const highestSurfaceIds = [...new Set(highestMatches.map((match) => match.surface.id))]

  if (highestSurfaceIds.length > 1) {
    return {
      inputPath,
      normalizedPath,
      resolutionStatus: 'CONFLICT',
      matchedSurfaceId: null,
      matchedPattern: null,
      baselineClassification: null,
      currentOwner: null,
      currentResponsibility: null,
      matchCount: matches.length,
      highestSpecificityMatchCount: highestSurfaceIds.length,
      conflictingSurfaceIds: highestSurfaceIds,
    }
  }

  const resolvedMatch = highestMatches.find((match) => match.surface.id === highestSurfaceIds[0])
  return {
    inputPath,
    normalizedPath,
    resolutionStatus: 'RESOLVED',
    matchedSurfaceId: resolvedMatch.surface.id,
    matchedPattern: resolvedMatch.pattern,
    baselineClassification: resolvedMatch.surface.baselineClassification,
    currentOwner: resolvedMatch.surface.currentOwner,
    currentResponsibility: resolvedMatch.surface.currentResponsibility,
    matchCount: matches.length,
    highestSpecificityMatchCount: 1,
    conflictingSurfaceIds: [],
  }
}

export function resolveBaselinePaths({ registry, inputPaths, repoRoot }) {
  return inputPaths.map((inputPath) => resolveBaselinePath({ registry, inputPath, repoRoot }))
}

export function summarizeResolutionResults(results) {
  const summary = {
    totalPaths: results.length,
    resolvedCount: 0,
    noMatchCount: 0,
    conflictCount: 0,
    invalidInputCount: 0,
    allPathsResolved: false,
  }

  for (const result of results) {
    if (result.resolutionStatus === 'RESOLVED') summary.resolvedCount += 1
    else if (result.resolutionStatus === 'NO_MATCH') summary.noMatchCount += 1
    else if (result.resolutionStatus === 'CONFLICT') summary.conflictCount += 1
    else if (result.resolutionStatus === 'INVALID_INPUT_PATH') summary.invalidInputCount += 1
  }

  summary.allPathsResolved = summary.totalPaths > 0 && summary.resolvedCount === summary.totalPaths
  return summary
}

function formatHumanResult(result) {
  const lines = [
    `INPUT_PATH=${result.inputPath}`,
    `NORMALIZED_PATH=${result.normalizedPath}`,
    `RESOLUTION_STATUS=${result.resolutionStatus}`,
    `MATCH_COUNT=${result.matchCount}`,
    `HIGHEST_SPECIFICITY_MATCH_COUNT=${result.highestSpecificityMatchCount}`,
  ]

  if (result.resolutionStatus === 'RESOLVED') {
    lines.push(`MATCHED_SURFACE_ID=${result.matchedSurfaceId}`)
    lines.push(`MATCHED_PATTERN=${result.matchedPattern}`)
    lines.push(`BASELINE_CLASSIFICATION=${result.baselineClassification}`)
    lines.push(`CURRENT_OWNER=${result.currentOwner}`)
    lines.push(`CURRENT_RESPONSIBILITY=${result.currentResponsibility}`)
  } else if (result.resolutionStatus === 'CONFLICT') {
    lines.push(`CONFLICTING_SURFACE_IDS=${result.conflictingSurfaceIds.join(',')}`)
  } else {
    lines.push('MATCHED_SURFACE_ID=null')
    lines.push('MATCHED_PATTERN=null')
    lines.push('BASELINE_CLASSIFICATION=null')
    lines.push('CURRENT_OWNER=null')
    lines.push('CURRENT_RESPONSIBILITY=null')
  }

  return lines.join('\n')
}

function parseCliArgs(argv) {
  const args = [...argv]
  const options = {
    json: false,
    paths: [],
  }

  while (args.length > 0) {
    const token = args.shift()
    if (token === '--json') {
      options.json = true
      continue
    }

    options.paths.push(token)
  }

  return options
}

function determineExitCode(results) {
  if (results.some((result) => result.resolutionStatus === 'INVALID_INPUT_PATH')) {
    return EXIT_CODES.INVALID_INPUT
  }

  if (results.some((result) => result.resolutionStatus === 'CONFLICT')) {
    return EXIT_CODES.CONFLICT
  }

  if (results.some((result) => result.resolutionStatus === 'NO_MATCH')) {
    return EXIT_CODES.NO_MATCH
  }

  return EXIT_CODES.OK
}

export function createResolverRuntime({ repoRoot = process.cwd(), registryPath = path.join(repoRoot, 'Canon/registries/current-architecture-baseline-v1.json') } = {}) {
  const registry = loadRegistry(registryPath)
  const registryValidation = validateRegistry(registry)

  if (!registryValidation.valid) {
    const error = new Error(`Invalid registry:\n- ${registryValidation.errors.join('\n- ')}`)
    error.code = 'INVALID_REGISTRY'
    error.registryValidation = registryValidation
    throw error
  }

  return {
    repoRoot,
    registryPath,
    registry,
    registryValidation,
    resolvePath(inputPath) {
      return resolveBaselinePath({ registry, inputPath, repoRoot })
    },
    resolvePaths(inputPaths) {
      return resolveBaselinePaths({ registry, inputPaths, repoRoot })
    },
  }
}

export async function main(argv = process.argv.slice(2), io = { stdout: process.stdout, stderr: process.stderr }) {
  const { json, paths } = parseCliArgs(argv)

  if (paths.length === 0) {
    io.stderr.write('Usage: node scripts/architecture-classify.mjs [--json] <path> [<path> ...]\n')
    return EXIT_CODES.INVALID_INPUT
  }

  let runtime
  try {
    runtime = createResolverRuntime()
  } catch (error) {
    if (error?.code === 'INVALID_REGISTRY') {
      io.stderr.write(`${error.message}\n`)
      return EXIT_CODES.INVALID_REGISTRY
    }

    throw error
  }

  const results = []
  for (const inputPath of paths) {
    try {
      results.push(runtime.resolvePath(inputPath))
    } catch (error) {
      if (error?.code !== 'INVALID_INPUT_PATH') {
        throw error
      }

      results.push({
        inputPath,
        normalizedPath: null,
        resolutionStatus: 'INVALID_INPUT_PATH',
        matchedSurfaceId: null,
        matchedPattern: null,
        baselineClassification: null,
        currentOwner: null,
        currentResponsibility: null,
        matchCount: 0,
        highestSpecificityMatchCount: 0,
        conflictingSurfaceIds: [],
        error: error.message,
      })
    }
  }

  const summary = summarizeResolutionResults(results)
  const payload = {
    registryValid: true,
    cleanupFindingsUsedForClassification: false,
    transitionalLogicImplemented: false,
    transitionalClassificationAssigned: false,
    results,
    summary,
  }

  if (json) {
    io.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
  } else {
    io.stdout.write(`REGISTRY_VALID=YES\n`)
    io.stdout.write(`CLEANUP_FINDINGS_USED_FOR_CLASSIFICATION=NO\n`)
    io.stdout.write(`TRANSITIONAL_LOGIC_IMPLEMENTED=NO\n`)
    io.stdout.write(`TRANSITIONAL_CLASSIFICATION_ASSIGNED=NO\n`)
    io.stdout.write(`TOTAL_PATHS=${summary.totalPaths}\n`)
    io.stdout.write(`RESOLVED_COUNT=${summary.resolvedCount}\n`)
    io.stdout.write(`NO_MATCH_COUNT=${summary.noMatchCount}\n`)
    io.stdout.write(`CONFLICT_COUNT=${summary.conflictCount}\n`)
    io.stdout.write(`INVALID_INPUT_COUNT=${summary.invalidInputCount}\n`)
    io.stdout.write(`ALL_PATHS_RESOLVED=${summary.allPathsResolved ? 'YES' : 'NO'}\n`)
    for (const result of results) {
      io.stdout.write('\n')
      io.stdout.write(`${formatHumanResult(result)}\n`)
      if (result.error) {
        io.stdout.write(`ERROR=${result.error}\n`)
      }
    }
  }

  return determineExitCode(results)
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null
const currentFilePath = path.resolve(fileURLToPath(import.meta.url))

if (invokedPath && currentFilePath === invokedPath) {
  const exitCode = await main()
  process.exit(exitCode)
}