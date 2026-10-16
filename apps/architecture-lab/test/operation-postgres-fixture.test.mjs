import assert from 'node:assert/strict'
import test from 'node:test'
import { assertIsolatedTestConnection } from '../src/operation-postgres-fixture.mjs'

test('operation fixture cannot connect to hosted databases, wrong roles or ordinary local databases', () => {
  const valid = 'postgresql://architecture_test_owner@127.0.0.1:55439/sg2_operation_test'
  assert.equal(assertIsolatedTestConnection(valid, 'sg2_operation_test', 'architecture_test_owner'), valid)
  for (const value of ['postgresql://architecture_test_owner@example.neon.tech/sg2_operation_test', 'postgresql://architecture_test_owner@127.0.0.1/architecture_pmos', 'postgresql://neondb_owner@127.0.0.1/sg2_operation_test', 'postgresql://architecture_test_owner@127.0.0.1.evil.test/sg2_operation_test']) assert.throws(() => assertIsolatedTestConnection(value, 'sg2_operation_test', 'architecture_test_owner'), /disposable loopback/)
})
