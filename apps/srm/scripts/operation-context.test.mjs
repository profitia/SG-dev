import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { OPERATION_CONTRACT, operationSourceDigest } from '@profitia/platform-contracts/operation-context'
import { operationSourceDigest as sourceDigest } from '../../../packages/platform-contracts/src/operation-context.mjs'
const receipt = JSON.parse(fs.readFileSync(new URL('../operation-integration.json', import.meta.url)))
test('explicit consumer binds exact implemented contract and installed/source digest without enabling live deployment', async () => {
  assert.equal(receipt.projectKey, 'SRM')
  assert.equal(receipt.scope, 'ISOLATED_OPERATION_INTEGRATION_ONLY')
  assert.equal(receipt.contract.id, OPERATION_CONTRACT.id)
  assert.equal(receipt.contract.version, OPERATION_CONTRACT.version)
  assert.equal(receipt.contract.implementation, OPERATION_CONTRACT.implementation)
  assert.equal(receipt.contract.sourceDigest, await operationSourceDigest())
  assert.equal(await operationSourceDigest(), await sourceDigest())
  assert.equal(receipt.liveRouteUsesContract, false)
  assert.equal(receipt.automaticProductDeployment, false)
  assert.equal(receipt.producer.projectKey, 'ARCHITECTURE')
  assert.match(receipt.producer.sourceSha, /^[a-f0-9]{40}$/)
  const source = createHash('sha256')
  for (const file of ['src/operation-context.mjs','src/operation-context.d.mts','src/request-operations.mjs','src/request-operations.d.mts','migrations/access/017-additional-request-operations.sql']) source.update(execFileSync('git', ['show', receipt.producer.sourceSha + ':packages/platform-contracts/' + file]))
  assert.equal(source.digest('hex'), receipt.contract.sourceDigest, 'Recorded producer SHA must contain the exact accepted implementation')
})
