import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { attachCategoryBenchmark } from '../components/category-builder/benchmark-picker-draft'
import type { SavedBenchmark } from '../lib/benchmark/contracts'

const provider = { providerCode: 'MACROBOND' as const, displayName: 'Macrobond' }
function benchmark(id: string): SavedBenchmark { return { selectionId: 'selection-' + id, businessBenchmarkId: 'business-' + id, organizationId: 'authorized-fixture', displayName: id, provider,
  providerSeries: { provider, providerSeriesId: id, providerSeriesKey: id }, frequency: 'monthly', currency: 'PLN', unit: 'index', source: 'Source', selectedAt: '2024-01-01T00:00:00.000Z' } }
const current = () => ({ id: 'category-original', name: 'Cable', status: 'DRAFT', components: [{ id: 'component-original', name: 'Copper', weightPercent: 60, benchmark: benchmark('old') }] })
test('Category Builder adds selected benchmark with existing zero-weight draft semantics', () => {
  const before = current(), copy = structuredClone(before), selected = benchmark('new')
  const after = attachCategoryBenchmark(before, selected, { componentId: null, newComponent: () => ({ id: 'draft-new', name: 'Energy' }) })
  assert.deepEqual(before, copy); assert.equal(after.id, before.id); assert.equal(after.status, 'DRAFT')
  assert.equal(after.components[0], before.components[0]); assert.deepEqual(after.components[1], { id: 'draft-new', name: 'Energy', weightPercent: 0, benchmark: selected })
})
test('Category Builder replacement keeps component/category IDs, name, weight and canonical benchmark identity', () => {
  const before = current(), selected = benchmark('replacement')
  const after = attachCategoryBenchmark(before, selected, { componentId: 'component-original', newComponent: () => assert.fail('replacement must not add a component') })
  assert.equal(after.components.length, 1); assert.equal(after.components[0].id, 'component-original'); assert.equal(after.components[0].weightPercent, 60)
  assert.equal(after.components[0].name, 'Copper'); assert.equal(after.components[0].benchmark, selected); assert.equal(after.components[0].benchmark.businessBenchmarkId, 'business-replacement')
})
test('AI suggestion adapter supplies only the existing suggestion name; unavailable workflows are not activated', () => {
  const after = attachCategoryBenchmark(current(), benchmark('suggested'), { componentId: null, newComponent: () => ({ id: 'draft-suggestion', name: 'Existing suggested PVC' }) })
  assert.equal(after.components[1].name, 'Existing suggested PVC'); assert.equal(after.components[1].weightPercent, 0)
})
test('an obsolete replacement target is not converted into a new component', () => {
  const before = current(), after = attachCategoryBenchmark(before, benchmark('new'), { componentId: 'obsolete', newComponent: () => assert.fail() })
  assert.deepEqual(after.components, before.components)
})
test('actual Category Builder uses the shared Picker and existing category save, seed and Cost Scan operations', () => {
  const source = fs.readFileSync(new URL('../components/category-builder/category-builder-client.tsx', import.meta.url), 'utf8')
  assert.match(source, /<SharedBenchmarkPicker/); assert.doesNotMatch(source, /BenchmarkFinderClient/)
  assert.match(source, /onSelect=\{handleBenchmarkSelected\}/); assert.match(source, /attachCategoryBenchmark\(current, benchmark/)
  assert.match(source, /finderActiveRef\.current = false/); assert.match(source, /if \(!finderActiveRef\.current\) return/)
  assert.match(source, /initialSelectedBenchmarkId=/); assert.match(source, /initialQuery=\{finderPrefill.query\}/)
  assert.match(source, /seedBenchmarkId/); assert.match(source, /\/api\/category/); assert.match(source, /cost-scan/)
})
