import type { SavedBenchmark } from '../../lib/benchmark/contracts'

interface DraftComponent { id: string; name: string; weightPercent: number; benchmark: SavedBenchmark }

/** Existing Category Builder action, outside the universal Picker. No persistence or readiness changes. */
export function attachCategoryBenchmark<T extends { components: DraftComponent[] }>(current: T, benchmark: SavedBenchmark,
  target: { componentId: string | null; newComponent: () => { id: string; name: string } }): T {
  if (target.componentId) return { ...current, components: current.components.map(c => c.id === target.componentId ? { ...c, benchmark } : c) }
  return { ...current, components: [...current.components, { ...target.newComponent(), weightPercent: 0, benchmark }] }
}
