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
  const content=receipt.krsNipSourceCompatibility?execFileSync('git',['show',receipt.krsNipSourceCompatibility.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)]):fs.readFileSync(path.join(root,file));assert.equal(hash(content),digest,file)
 }
})

test('KRS NIP candidate accepts current owned sources without claiming live installation',()=>{
 const current=receipt.krsNipSourceCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 assert.equal(current.status,'CANDIDATE_ONLY_NOT_ACTIVATED');assert.equal(current.ceidgFirst,true);assert.equal(current.primaryTimeoutMs,3000)
 assert.equal(current.liveGrantsChanged,false);assert.equal(current.productDeploymentPerformed,false)
 for(const [file,digest]of Object.entries(current.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',receipt.krsNipActivationCompatibility.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)])),digest,file)
})

test('KRS activation preserves accepted receipts and pins registration with no supplier UPDATE',()=>{
 const a=receipt.krsNipActivationCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 const previous=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptSha256)
 for(const [key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 assert.equal(a.existingSupplierRegistration,'KEEP');assert.equal(a.newRoleOrMapsPermissionsRequired,false)
 const next=receipt.organisationLocationAuthorityAdoption,nextDigests:Record<string,string>={...next.applicationSourceDigests,...receipt.organisationLocationBuildRecovery.applicationSourceDigests}
 for(const [file,digest]of Object.entries(a.applicationSourceDigests)){
  if(nextDigests[file])assert.equal(hash(execFileSync('git',['show',next.previousReceiptSourceSha+':'+path.posix.normalize('apps/srm/'+file)])),digest,'historical '+file)
  assert.equal(hash(fs.readFileSync(path.join(root,file))),nextDigests[file]??digest,file)
 }
})

test('bounded indicator reads retain the entire accepted receipt and add no new operation or grant',()=>{
 const a=receipt.boundedIndicatorReadAdoption
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptSha256)
 for(const [key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 assert.equal(a.unitId,'SRM_CACHE_READ');assert.equal(a.accessMode,'READ');assert.equal(a.maximumMetricsPerUnit,4)
 assert.equal(a.totalTransactionTimeoutMs,15000);assert.equal(a.publicationGuard,'CATALOG_ROW_XMIN_BEFORE_AND_AFTER_EACH_UNIT')
 assert.equal(a.liveGrantsChanged,false);assert.equal(a.productDeploymentPerformed,false)
 for(const [file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',receipt.krsNipSourceCompatibility.preservedBoundedIndicatorSourceSha+':'+path.posix.normalize('apps/srm/'+file)])),digest,file)
})

test('location build recovery preserves accepted access and changes no product runtime source',()=>{
 const a=receipt.organisationLocationBuildRecovery,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(fs.readFileSync(path.join(root,file))),digest,file)
 assert.equal(a.productRuntimeChanged,false);assert.equal(a.databaseChanged,false)
 const file='src/server/supplier-locations.ts'
 assert.equal(hash(fs.readFileSync(path.join(root,file))),hash(execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/'+file])))
})
