import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {assertSourceHubMarketSymbolCompatibility,assertSourceHubApiPathCompatibility} from './source-hub-sdk-compatibility.mjs'
const root=new URL('../../../',import.meta.url),cache=new Map()
const current=p=>fs.readFileSync(new URL(p,root))
const historical=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root}));return cache.get(key)}
test('SDK1.34 verifies both current consumers and the complete immutable API_PATH predecessor',()=>{
 const receipt=JSON.parse(current('apps/srm/operation-integration.json')),a=receipt.sourceHubMarketSymbolCompatibility
 const next=assertSourceHubMarketSymbolCompatibility(receipt,current,historical)
 assert.deepEqual(next.prior.sourceHubApiPathCompatibility,receipt.sourceHubApiPathCompatibility)
 assertSourceHubApiPathCompatibility(receipt,current,historical)
 for(const file of [...Object.keys(a.consumerSourceDigests),...Object.keys(a.peerSourceDigests),...Object.keys(a.sourceDigests).map(p=>'packages/platform-contracts/'+p)]){
  assert.throws(()=>assertSourceHubMarketSymbolCompatibility(receipt,p=>p===file?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical),file)
 }
 for(const mutate of [r=>r.sourceHubMarketSymbolCompatibility.marketSymbolOptedIn=true,r=>r.sourceHubMarketSymbolCompatibility.previousReceiptSha256='0'.repeat(64),r=>r.sourceHubMarketSymbolCompatibility.consumerSourceDigests['apps/srm/unapproved.ts']='0'.repeat(64),r=>r.sourceHubApiPathCompatibility.sourceDigests['package.json']='0'.repeat(64),r=>r.sourceHubMarketSymbolCompatibility.sdkDigests.externalCallSourceDigest='0'.repeat(64)]){
  const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertSourceHubMarketSymbolCompatibility(changed,current,historical))
 }
})
