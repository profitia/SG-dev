import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'

const root=new URL('../../../',import.meta.url)
const receipt=JSON.parse(fs.readFileSync(new URL('../sdk-1.33-compatibility.json',import.meta.url)))
const next=JSON.parse(fs.readFileSync(new URL('../sdk-1.34-compatibility.json',import.meta.url)))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')

test('SDK1.34 preserves the complete SDK1.33 receipt and explicit optional peer history',()=>{
 assert.equal(hash(fs.readFileSync(new URL('../sdk-1.33-compatibility.json',import.meta.url))),next.previousReceiptSha256)
 assert.equal(next.previousReceiptSourceSha,'3d660eeaf8b6b7ef914a612b8383514f99e857d3')
 assert.equal(next.producerCandidateSha,'ebf017cae09bf7bd9139af7917534b47ae0c4d4b')
 assert.equal(next.taskId,'ARCH-SOURCE-HUB-TE-MARKETS-ACTIVATION-20261106')
 assert.equal(JSON.parse(fs.readFileSync(new URL('packages/platform-contracts/package.json',root))).version,next.platformVersion)
 assert.equal(next.platformVersion,'1.34.0');assert.equal(next.marketSymbolContractVersion,'1.0.0')
 assert.deepEqual(next.allowedSdkVersions,['1.32.3','1.33.0','1.34.0'])
 assert.deepEqual(receipt.allowedSdkVersions,['1.32.3','1.33.0'])
 for(const [name,record] of Object.entries(receipt.packages)){
  const prefix='packages/platform-contracts/'+name+'/'
  const installed=fs.readFileSync(new URL(prefix+'package.json',root))
  const current=Buffer.from(installed.toString().replace('"1.32.3 || 1.33.0 || 1.34.0"','"1.32.3 || 1.33.0"'))
  assert.equal(hash(installed),next.packages[name].manifestSha256)
  assert.equal(hash(current),next.packages[name].previousManifestSha256)
  assert.deepEqual(next.packages[name].unchangedSourceDigests,record.unchangedSourceDigests)
  const metadata=JSON.parse(current)
  assert.equal(metadata.peerDependencies['@profitia/platform-contracts'],'1.32.3 || 1.33.0')
  // Reconstruct only the reviewed peer edit; the frozen predecessor hash still
  // detects every other byte change, including in shallow CI checkouts.
  const previous=Buffer.from(current.toString().replace('"1.32.3 || 1.33.0"','"1.32.3"'))
  assert.equal(hash(previous),record.previousManifestSha256)
  assert.equal(hash(current),record.manifestSha256)
  const expected=JSON.parse(previous)
  assert.equal(expected.peerDependencies['@profitia/platform-contracts'],'1.32.3')
  expected.peerDependencies['@profitia/platform-contracts']='1.32.3 || 1.33.0'
  assert.deepEqual(JSON.parse(current),expected,'only the explicit peer range changes')
  for(const [file,digest] of Object.entries(record.unchangedSourceDigests)){
   assert.equal(hash(fs.readFileSync(new URL(prefix+file,root))),digest)
  }
 }
 for(const name of ['apiPathAdopted','schemaChanged','authorizationChanged','deploymentPerformed'])assert.equal(receipt[name],false)
 for(const name of ['marketSymbolAdopted','schemaChanged','authorizationChanged','deploymentPerformed'])assert.equal(next[name],false)
 assert.equal(Object.keys(next.producerFiles).length,27)
 for(const [file,digest] of Object.entries(next.producerFiles))assert.equal(hash(fs.readFileSync(new URL(file,root))),digest,'frozen producer '+file)
})
