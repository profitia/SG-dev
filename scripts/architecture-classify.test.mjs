import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'

import {
  createResolverRuntime,
  normalizeInputPath,
  resolveBaselinePath,
  validateRegistry,
} from './architecture-classify.mjs'

const repoRoot = path.resolve(process.cwd())
const registryPath = path.join(repoRoot, 'Canon/registries/current-architecture-baseline-v1.json')

function loadRuntime() {
  return createResolverRuntime({ repoRoot, registryPath })
}

function expectResolved(result, surfaceId, classification) {
  assert.equal(result.resolutionStatus, 'RESOLVED')
  assert.equal(result.matchedSurfaceId, surfaceId)
  assert.equal(result.baselineClassification, classification)
  assert.equal(result.highestSpecificityMatchCount, 1)
}

test('Test 1 - SG Runtime / Category Builder', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('apps/sg-runtime/app/[locale]/category-builder/page.tsx'), 'SG2-BASE-001', 'ALIGNED')
})

test('Test 2 - Benchmark Finder', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('apps/sg-runtime/app/[locale]/benchmark-finder/page.tsx'), 'SG2-BASE-001', 'ALIGNED')
})

test('Test 3 - Forecast Methodology', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('tooling/Benchmark-Forecasting'), 'SG2-BASE-002', 'ALIGNED')
})

test('Test 4 - Generic Dashboard Preview', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('apps/dashboard-preview/app/[locale]/page.tsx'), 'SG2-BASE-003', 'ALIGNED')
})

test('Test 5 - Dashboard Data Runtime Nested ALIGNED', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('apps/dashboard-preview/runtime/data-runtime/README.md'), 'SG2-BASE-004', 'ALIGNED')
})

test('Test 6 - Dashboard Forecast Persistence Nested LEGACY', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('apps/dashboard-preview/prisma-market-data/schema.prisma'), 'SG2-BASE-012', 'LEGACY')
})

test('Test 7 - Dashboard Forecast Bridge Exact LEGACY', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts'), 'SG2-BASE-013', 'LEGACY')
})

test('Test 8 - PMOS', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('apps/pmos/package.json'), 'SG2-BASE-006', 'ALIGNED')
})

test('Test 9 - Vector', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('apps/vector/package.json'), 'SG2-BASE-005', 'ALIGNED')
})

test('Test 10 - PCOS Generic', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('apps/pcos-explorer/package.json'), 'SG2-BASE-008', 'ALIGNED')
})

test('Test 11 - PCOS Nested LEGACY', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('apps/pcos-explorer/prisma/schema.prisma'), 'SG2-BASE-015', 'LEGACY')
})

test('Test 12 - Vercly', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('apps/vercly/src/app/page.tsx'), 'SG2-BASE-009', 'ALIGNED')
})

test('Test 13 - Governance', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('packages/governance/src/index.ts'), 'SG2-BASE-007', 'ALIGNED')
})

test('Test 14 - Exact Deployment File', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('render.yaml'), 'SG2-BASE-010', 'ALIGNED')
})

test('Test 15 - Exact Workflow File', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('.github/workflows/forecast-production-operations.yml'), 'SG2-BASE-011', 'ALIGNED')
})

test('Edge A - subtree root itself matches subtree pattern', () => {
  const runtime = loadRuntime()
  expectResolved(runtime.resolvePath('tooling/Benchmark-Forecasting'), 'SG2-BASE-002', 'ALIGNED')
})

test('Edge B - prefix collision does not match subtree', () => {
  const runtime = loadRuntime()
  const result = runtime.resolvePath('apps/dashboard-preview-other/file.ts')
  assert.equal(result.resolutionStatus, 'NO_MATCH')
  assert.equal(result.baselineClassification, null)
})

test('Edge C - leading dot slash normalizes identically', () => {
  const runtime = loadRuntime()
  const result = runtime.resolvePath('./apps/pmos/package.json')
  expectResolved(result, 'SG2-BASE-006', 'ALIGNED')
  assert.equal(result.normalizedPath, 'apps/pmos/package.json')
})

test('Edge D - exact match outranks subtree', () => {
  const registry = {
    schemaVersion: '1.0',
    classificationReferenceSha: 'test',
    transitionalEpochStartSha: null,
    transitionalPolicyActive: false,
    pathResolutionStrategy: 'MOST_SPECIFIC_MATCH_WINS',
    surfaces: [
      { id: 'S1', pathPatterns: ['root/**'], baselineClassification: 'ALIGNED', currentOwner: 'A', currentResponsibility: 'A', parentSurfaceId: null, cleanupReason: null, capability: 'Test', name: 'Root' },
      { id: 'S2', pathPatterns: ['root/file.ts'], baselineClassification: 'LEGACY', currentOwner: 'B', currentResponsibility: 'B', parentSurfaceId: null, cleanupReason: null, capability: 'Test', name: 'File' },
    ],
  }
  const result = resolveBaselinePath({ registry, inputPath: 'root/file.ts', repoRoot })
  expectResolved(result, 'S2', 'LEGACY')
})

test('Edge E - registry order independence', () => {
  const registryA = {
    schemaVersion: '1.0',
    classificationReferenceSha: 'test',
    transitionalEpochStartSha: null,
    transitionalPolicyActive: false,
    pathResolutionStrategy: 'MOST_SPECIFIC_MATCH_WINS',
    surfaces: [
      { id: 'A', pathPatterns: ['root/**'], baselineClassification: 'ALIGNED', currentOwner: 'A', currentResponsibility: 'A', parentSurfaceId: null, cleanupReason: null, capability: 'Test', name: 'Root' },
      { id: 'B', pathPatterns: ['root/deeper/**'], baselineClassification: 'LEGACY', currentOwner: 'B', currentResponsibility: 'B', parentSurfaceId: null, cleanupReason: null, capability: 'Test', name: 'Deep' },
    ],
  }
  const registryB = { ...registryA, surfaces: [...registryA.surfaces].reverse() }
  const resultA = resolveBaselinePath({ registry: registryA, inputPath: 'root/deeper/file.ts', repoRoot })
  const resultB = resolveBaselinePath({ registry: registryB, inputPath: 'root/deeper/file.ts', repoRoot })
  assert.deepEqual({ id: resultA.matchedSurfaceId, classification: resultA.baselineClassification }, { id: resultB.matchedSurfaceId, classification: resultB.baselineClassification })
})

test('Edge F - equal-specificity conflict returns CONFLICT', () => {
  const registry = {
    schemaVersion: '1.0',
    classificationReferenceSha: 'test',
    transitionalEpochStartSha: null,
    transitionalPolicyActive: false,
    pathResolutionStrategy: 'MOST_SPECIFIC_MATCH_WINS',
    surfaces: [
      { id: 'S1', pathPatterns: ['root/**'], baselineClassification: 'ALIGNED', currentOwner: 'A', currentResponsibility: 'A', parentSurfaceId: null, cleanupReason: null, capability: 'Test', name: 'Root A' },
      { id: 'S2', pathPatterns: ['root/**'], baselineClassification: 'LEGACY', currentOwner: 'B', currentResponsibility: 'B', parentSurfaceId: null, cleanupReason: null, capability: 'Test', name: 'Root B' },
    ],
  }
  const result = resolveBaselinePath({ registry, inputPath: 'root/file.ts', repoRoot })
  assert.equal(result.resolutionStatus, 'CONFLICT')
  assert.deepEqual(result.conflictingSurfaceIds.sort(), ['S1', 'S2'])
})

test('Edge G - unregistered path returns NO_MATCH', () => {
  const runtime = loadRuntime()
  const result = runtime.resolvePath('some/new/unregistered/root/file.ts')
  assert.equal(result.resolutionStatus, 'NO_MATCH')
  assert.equal(result.baselineClassification, null)
})

test('Edge H - invalid classification in registry fails validation', () => {
  const registry = {
    schemaVersion: '1.0',
    classificationReferenceSha: 'test',
    pathResolutionStrategy: 'MOST_SPECIFIC_MATCH_WINS',
    surfaces: [
      { id: 'S1', pathPatterns: ['root/**'], baselineClassification: 'UNKNOWN' },
    ],
  }
  const validation = validateRegistry(registry)
  assert.equal(validation.valid, false)
  assert.ok(validation.errors.some((error) => error.includes('invalid baselineClassification')))
})

test('Edge I - path escaping repo root is rejected', () => {
  assert.throws(() => normalizeInputPath('../../outside-repo/file.ts', repoRoot), /escapes repository root/)
})