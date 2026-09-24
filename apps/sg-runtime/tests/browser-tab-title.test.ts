import assert from 'node:assert/strict'
import test from 'node:test'

import { getEnvironmentBrowserTabTitle } from '../lib/browser-tab-title'

test('browser tab identifies Development explicitly', () => {
  assert.equal(getEnvironmentBrowserTabTitle('SpendGuru 2.0', 'development'), 'DEV SpendGuru 2.0')
})

test('browser tab identifies Staging explicitly', () => {
  assert.equal(getEnvironmentBrowserTabTitle('SpendGuru 2.0', 'staging'), 'STAGE SpendGuru 2.0')
})

test('Production retains its existing title', () => {
  assert.equal(getEnvironmentBrowserTabTitle('SpendGuru 2.0', 'production'), 'SpendGuru 2.0')
})
