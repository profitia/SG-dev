import assert from 'node:assert/strict'
import test from 'node:test'

import { PHASE_2_1_DATABASE_CLONE_ALIAS } from './phase-2-1-database-guard.mjs'

test('Phase 2.1 clone alias is immutable and purpose-specific', () => {
  assert.equal(PHASE_2_1_DATABASE_CLONE_ALIAS, 'phase-2-1-local-clone-v1')
})