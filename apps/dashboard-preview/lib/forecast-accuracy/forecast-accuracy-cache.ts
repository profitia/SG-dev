export interface ForecastAccuracyCacheStore<T> {
  read(key: string, nowMs: number): T | null
  write(key: string, value: T, nowMs: number): void
  withPending<R>(key: string, factory: () => Promise<R>): Promise<R>
  clear(): void
}

interface CacheEntry<T> {
  cachedAt: number
  value: T
}

export interface ForecastAccuracyCacheKeyInput {
  locale: 'pl' | 'en'
  organizationId: string | null
  benchmarkCode: string
  horizonMonths: number | null
  dateFrom: string | null
  dateTo: string | null
}

export const FORECAST_ACCURACY_CACHE_TTL_MS = 30_000

export function buildForecastAccuracyCacheKey(input: ForecastAccuracyCacheKeyInput): string {
  return JSON.stringify({
    locale: input.locale,
    organizationId: input.organizationId,
    benchmarkCode: input.benchmarkCode,
    horizonMonths: input.horizonMonths,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  })
}

export function createForecastAccuracyCacheStore<T>(ttlMs = FORECAST_ACCURACY_CACHE_TTL_MS): ForecastAccuracyCacheStore<T> {
  const cache = new Map<string, CacheEntry<T>>()
  const pending = new Map<string, Promise<unknown>>()

  return {
    read(key, nowMs) {
      const entry = cache.get(key)

      if (!entry) {
        return null
      }

      if (nowMs - entry.cachedAt > ttlMs) {
        cache.delete(key)
        return null
      }

      return entry.value
    },
    write(key, value, nowMs) {
      cache.set(key, {
        cachedAt: nowMs,
        value,
      })
    },
    async withPending<R>(key: string, factory: () => Promise<R>) {
      const current = pending.get(key)

      if (current) {
        return current as Promise<R>
      }

      const next = factory().finally(() => {
        pending.delete(key)
      })

      pending.set(key, next)
      return next
    },
    clear() {
      cache.clear()
      pending.clear()
    },
  }
}