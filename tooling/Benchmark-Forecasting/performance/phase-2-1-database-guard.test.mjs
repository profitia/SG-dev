import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PHASE_2_1_DATABASE_CLONE_ALIAS,
  assertPhase21DatabaseTarget,
} from './phase-2-1-database-guard.mjs'

test('accepts only the explicit local Phase 2.1 clone identity', () => {
  const result = assertPhase21DatabaseTarget({
    databaseUrl: 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_market_data',
    cloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS,
    role: 'marketData',
  })

  assert.equal(result.isolated, true)
  assert.equal(result.databaseName, 'sg_phase_2_1_market_data')
})

test('rejects a remote database even when the alias is supplied', () => {
  assert.throws(() => assertPhase21DatabaseTarget({
    databaseUrl: 'postgresql://user:secret@example.neon.tech/neondb',
    cloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS,
    role: 'marketData',
  }), /isolated local PostgreSQL/)
})

test('rejects local targets without the exact clone alias or database role', () => {
  assert.throws(() => assertPhase21DatabaseTarget({
    databaseUrl: 'postgresql://phase21@localhost:55421/sg_phase_2_1_market_data',
    cloneAlias: 'development',
    role: 'marketData',
  }), /approved isolated alias/)

  assert.throws(() => assertPhase21DatabaseTarget({
    databaseUrl: 'postgresql://phase21@localhost:55421/neondb',
    cloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS,
    role: 'marketData',
  }), /sg_phase_2_1_market_data/)
})