import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import receipt from '../../operation-integration.json'
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex')
test('native account revalidation preserves historical acceptance and pins the entire current receiver',()=>{
 const a=receipt.accountRecheckSourceCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'': 'apps/srm')
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptSha256)
 for(const [key,value]of Object.entries(JSON.parse(before.toString())))assert.deepEqual(['contract','producer'].includes(key)?a.previousRootAcceptance[key as 'contract'|'producer']:(receipt as Record<string,unknown>)[key],value,key)
 assert.equal(a.accountRevalidationOptedIn,true);assert.equal(a.totalTransactionTimeoutMs,15000);assert.equal(a.maximumAccountObservationMs,5000)
 assert.equal(a.liveGrantsChanged,false);assert.equal(a.productDeploymentPerformed,false)
 for(const [file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(fs.readFileSync(path.join(root,file))),digest,file)
})
