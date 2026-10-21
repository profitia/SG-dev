import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createIdentityProvisioner } from '../src/identity-provisioning.mjs'
import { clerkFixture } from './fixtures/identity-profile-postgres.mjs'

test('unverified browser data and nonmutation requests cannot reach the provisioning transaction',async()=>{
  const f=clerkFixture();let called=false
  const provisioner=createIdentityProvisioner({client:f.client,identityApplication:{appId:'synthetic',environment:'development',issuer:f.issuer,authorizedParties:[f.origin]},
    binding:{applicationId:'synthetic',environment:'development',projectId:'synthetic',branchId:'synthetic',databaseName:'synthetic',role:'synthetic',schemaDigest:'a'.repeat(64)},schemaDigest:'b'.repeat(64),proofKey:randomBytes(32),transact:()=>{called=true;assert.fail()}})
  await assert.rejects(provisioner.ensureAccount({issuer:f.issuer,subject:f.subject,verified:true}))
  await assert.rejects(provisioner.ensureAccount(f.request('GET')))
  assert.equal(called,false)
})
