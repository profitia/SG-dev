import assert from 'node:assert/strict'
import test from 'node:test'

import { getMarketDataPrisma } from '../lib/market-data/client'

test('market-data Prisma is a process singleton in production', async () => {
  const previousDatabaseUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousNodeEnv = process.env.NODE_ENV
  const previousPrisma = globalThis.__sgRuntimeMarketDataPrisma__

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://singleton.invalid/market-data'
  process.env.NODE_ENV = 'production'
  delete globalThis.__sgRuntimeMarketDataPrisma__

  try {
    const first = getMarketDataPrisma()
    const second = getMarketDataPrisma()
    assert.ok(first)
    assert.equal(second, first)
    assert.equal(globalThis.__sgRuntimeMarketDataPrisma__, first)
    await first.$disconnect()
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.MARKET_DATA_DATABASE_URL
    else process.env.MARKET_DATA_DATABASE_URL = previousDatabaseUrl
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
    globalThis.__sgRuntimeMarketDataPrisma__ = previousPrisma
  }
})
