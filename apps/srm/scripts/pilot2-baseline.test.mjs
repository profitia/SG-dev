import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {validateTarget,rebindEnvironment,BUSINESS_BASELINE} from './pilot2-baseline.mjs'
const target=JSON.parse(fs.readFileSync(new URL('../deployment/pilot2-runtime-targets.json',import.meta.url),'utf8'))
const original=execFileSync('git',['show',BUSINESS_BASELINE+':apps/srm/src/server/runtime-environment.ts'],{encoding:'utf8'})
test('accepted historical business source permits only the isolated Development binding',()=>{
 const adapted=rebindEnvironment(original,target)
 assert.equal(adapted,original.replace('br-dark-surf-b1vrhda9',target.neon.branchId).replace('ep-red-smoke-b16ih64d.c-5.eu-central-1.aws.neon.tech',target.neon.host))
 assert.match(adapted,/host !== expected.host/)
 assert.match(adapted,/url.username !== "srm_app_runtime"/)
})
test('other live services, source branches, owner roles and environment substitution are denied',()=>{
 for(const [section,key,value]of [
  ['render','serviceId','srv-db496b3tqb8s73eh5sfg'],['render','autoDeploy',true],
  ['neon','branchId','br-broad-butterfly-b11t4v01'],['neon','host','ep-autumn-wildflower-b1mv0vda.c-5.eu-central-1.aws.neon.tech'],
  ['neon','runtimeRole','neondb_owner'],['source','businessBaselineSha','0'.repeat(40)]
 ]){
  const changed=structuredClone(target);changed[section][key]=value;assert.throws(()=>validateTarget(changed))
 }
 const changed=structuredClone(target);changed.targetEnvironment='staging';assert.throws(()=>validateTarget(changed))
})
test('source drift or removal of a connection guard cannot be hidden as rebinding',()=>{
 assert.throws(()=>rebindEnvironment(original.replace('host !== expected.host','false'),target))
 assert.throws(()=>rebindEnvironment(original.replace('br-dark-surf-b1vrhda9','new-unknown-branch'),target))
})

