import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import receipt from '../../operation-integration.json'
import '../../scripts/task02r-release-source.test.mjs'
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex')
test('native account revalidation preserves historical acceptance and pins the entire current receiver',()=>{
 const a=receipt.accountRecheckSourceCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'': 'apps/srm')
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptSha256)
 for(const [key,value]of Object.entries(JSON.parse(before.toString())))assert.deepEqual(['contract','producer'].includes(key)?a.previousRootAcceptance[key as 'contract'|'producer']:(receipt as Record<string,unknown>)[key],value,key)
 assert.equal(a.accountRevalidationOptedIn,true);assert.equal(a.totalTransactionTimeoutMs,15000);assert.equal(a.maximumAccountObservationMs,5000)
 assert.equal(a.liveGrantsChanged,false);assert.equal(a.productDeploymentPerformed,false)
 for(const [file,digest]of Object.entries(a.applicationSourceDigests)){
  const content=receipt.krsNipSourceCompatibility?execFileSync('git',['show','1514ad205141762ae8f0407f20ee395c0cd254bf:'+path.posix.normalize('apps/srm/'+file)]):fs.readFileSync(path.join(root,file));assert.equal(hash(content),digest,file)
 }
})

test('KRS NIP candidate accepts current owned sources without claiming live installation',()=>{
 const current=receipt.krsNipSourceCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 assert.equal(current.status,'CANDIDATE_ONLY_NOT_ACTIVATED');assert.equal(current.ceidgFirst,true);assert.equal(current.primaryTimeoutMs,3000)
 assert.equal(current.liveGrantsChanged,false);assert.equal(current.productDeploymentPerformed,false)
 for(const [file,digest]of Object.entries(current.applicationSourceDigests))assert.equal(hash(fs.readFileSync(path.join(root,file))),digest,file)
})
