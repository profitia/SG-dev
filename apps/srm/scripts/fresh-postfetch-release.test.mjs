import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {freshPostfetchReleasePlan} from './fresh-postfetch-release.mjs'
test('postfetch release refuses missing or substituted function evidence before producing changes',()=>{
 const args={mode:'install-bind',sourceSha:'a'.repeat(40),previousSha:'b'.repeat(40)}
 for(const backup of [undefined,[],[{}],[{},{}]])assert.throws(()=>freshPostfetchReleasePlan({...args,backup}))
 const target=JSON.parse(fs.readFileSync(new URL('../deployment/xray-fresh-postfetch-2026-10-30.json',import.meta.url)))
 assert.equal(target.targetEnvironment,'development');assert.equal(target.serviceId,'srv-db1vu6gm7kps73d0e3r0')
 assert.equal(Object.keys(target.functions).length,2)
 for(const flag of ['changesExistingPolicies','changesAcl','changesTenantAccess','providerQuotaOrLicenseChanged','historyDeleted','pilotOrMapsDeploymentChanged','runtimeDeploymentClaimed'])assert.equal(target[flag],false,flag)
})
