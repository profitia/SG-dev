import assert from 'node:assert/strict'
import test from 'node:test'

import { readDashboardPreviewEnvironment } from '@/lib/db/env'

const mutableEnv = process.env as Record<string, string | undefined>

test('market-data env falls back to DATABASE_URL when MARKET_DATA_DATABASE_URL is absent', () => {
  const previousDatabaseUrl = process.env.DATABASE_URL
  const previousMarketDataUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousNodeEnv = mutableEnv.NODE_ENV

  mutableEnv.NODE_ENV = 'production'
  process.env.DATABASE_URL = 'postgresql://dashboard-preview:test@example.invalid/dashboard-preview'
  delete process.env.MARKET_DATA_DATABASE_URL

  try {
    const environment = readDashboardPreviewEnvironment()

    assert.equal(environment.databaseUrl, 'postgresql://dashboard-preview:test@example.invalid/dashboard-preview')
    assert.equal(environment.marketDataDatabaseUrl, 'postgresql://dashboard-preview:test@example.invalid/dashboard-preview')
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }

    if (previousMarketDataUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousMarketDataUrl
    }

    if (previousNodeEnv === undefined) {
      delete mutableEnv.NODE_ENV
    } else {
      mutableEnv.NODE_ENV = previousNodeEnv
    }
  }
})
