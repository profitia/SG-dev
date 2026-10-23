import test from 'node:test'
import assert from 'node:assert/strict'
import {krsContinuity} from './krs-continuity'
import type {VerifiedIdentityV1} from '@profitia/krs-registry-contracts'
test('client JSON cannot mint official continuity even when it claims matching NIP and KRS',async()=>{
 for(const value of [{currentEvidenceRef:'KRS:0001233591:'+ 'a'.repeat(64),records:[]},null])
  await assert.rejects(krsContinuity(value,{} as VerifiedIdentityV1,Date.now()))
})
