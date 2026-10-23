import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {posix} from 'node:path'
import {createSrmLocationAdmission,readSrmLocationAdmissionConfiguration} from '../src/server/supplier-location-admission.ts'
import {operationSourceDigest,OPERATION_CONTRACT} from '@profitia/platform-contracts/operation-context'
import {createSupplierLocationAdmission} from '@profitia/platform-contracts/supplier-location'

const hash=v=>createHash('sha256').update(v).digest('hex'),receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
const accepted=receipt.p1ReceiverSourceCompatibility,key=Buffer.alloc(32,59).toString('base64')
test('P1 runtime configuration needs exact accepted schemas/version and a separate canonical32byte key',()=>{
 const env={PROFITIA_SUPPLIER_LOCATION_ADMISSION_VERSION:accepted.configurationVersion,PROFITIA_SUPPLIER_LOCATION_ADMISSION_KEY:key}
 assert.equal(readSrmLocationAdmissionConfiguration(env,accepted).proofKey.length,32)
 for(const patch of [{PROFITIA_SUPPLIER_LOCATION_ADMISSION_VERSION:undefined},{PROFITIA_SUPPLIER_LOCATION_ADMISSION_VERSION:'unreviewed'},
  {PROFITIA_SUPPLIER_LOCATION_ADMISSION_KEY:undefined},{PROFITIA_SUPPLIER_LOCATION_ADMISSION_KEY:'legacy-secret'},
  {PROFITIA_SUPPLIER_LOCATION_ADMISSION_KEY:Buffer.alloc(31).toString('base64')},{PROFITIA_SUPPLIER_LOCATION_ADMISSION_KEY:key+'\n'}]){
  assert.throws(()=>readSrmLocationAdmissionConfiguration({...env,...patch},accepted))
 }
 assert.throws(()=>readSrmLocationAdmissionConfiguration(env,{...accepted,parentSchemaDigest:'wrong'}))
})

test('missing or mismatched receiver descriptor prevents any parent read or attestation',async()=>{
 const port=createSrmLocationAdmission({schemaDigest:accepted.sql020Digest,parentSchemaDigest:accepted.parentSchemaDigest,proofKey:Buffer.alloc(32)})
 for(const value of [null,{}, {parentSchemaVersion:'1.0.0',parentSchemaDigest:'0'.repeat(64)}]){
  let calls=0
  await assert.rejects(port.readParent({query:async()=>{calls++;return {rows:[{value}]}},actor:{},request:{},resource:{}}))
  assert.equal(calls,1)
 }
})

test('new P1 receipt preserves every historical record and verifies exact current source and installed package',async()=>{
 const before=JSON.parse(execFileSync('git',['show',accepted.previousReceiptSourceSha+':apps/srm/operation-integration.json'],{encoding:'utf8'}))
 assert.equal(hash(execFileSync('git',['show',accepted.previousReceiptSourceSha+':apps/srm/operation-integration.json'])),accepted.previousReceiptDigest)
 for(const[k,v]of Object.entries(before))assert.deepEqual(['contract','producer'].includes(k)?accepted.previousRootAcceptance[k]:receipt[k],v,k)
 assert.equal(accepted.platformVersion,'1.25.0');assert.equal(OPERATION_CONTRACT.implementation,'1.0.0-candidate.16')
 assert.equal(accepted.optInRootImplementation,'1.0.0-candidate.17');assert.equal(accepted.optInHostVersion,'1.12.0')
 assert.equal(await operationSourceDigest(),receipt.unmeteredSourceCompatibility.sdkDigests.operationSourceDigest)
 const root=new URL('../../../packages/platform-contracts/',import.meta.url)
 const installed=new URL('../',import.meta.resolve('@profitia/platform-contracts/supplier-location'))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',installed))).version,receipt.unmeteredSourceCompatibility.platformVersion)
 for(const[file,digest]of Object.entries(receipt.accountRecheckSourceCompatibility.sourceDigests))assert.equal(hash(execFileSync('git',['show',receipt.accountRecheckSourceCompatibility.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'historical producer '+file)
 for(const[file,digest]of Object.entries({...receipt.accountRecheckSourceCompatibility.sourceDigests,...receipt.krsNipSourceCompatibility?.sourceDigests,...receipt.unmeteredSourceCompatibility.sourceDigests})){
  assert.equal(hash(fs.readFileSync(new URL(file,root))),digest,file)
  assert.equal(hash(fs.readFileSync(new URL(file,installed))),digest,'installed '+file)
 }
 for(const[file,digest]of Object.entries(accepted.applicationSourceDigests)){
  const change=receipt.krsLivePilotSourceCompatibility?.changedFiles[file];
  if(change){
   assert.equal(change.previousSha256,digest,file);
   assert.equal(hash(execFileSync('git',['show',receipt.krsLivePilotSourceCompatibility.previousApplicationAuthority+':'+posix.normalize('apps/srm/'+file)])),digest,file);
  }
  assert.equal(hash(execFileSync('git',['show',receipt.accountRecheckSourceCompatibility.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)])),change?.sourceSha256??digest,file)
 }
 for(const flag of ['sql014Installed','sql020Installed','runtimeGrantsAdded','attestationKeyProvisioned','productDeploymentPerformed','paidGeocodingEnabled'])assert.equal(accepted[flag],false,flag)
})

test('SQL014 is additive and SQL001-013 and producer001-019 remain byte-identical',()=>{
 for(const name of fs.readdirSync(new URL('../db/private-store/',import.meta.url)).filter(n=>/^0(?:0[1-9]|1[0-3])-.*\.sql$/.test(n))){
  assert.deepEqual(fs.readFileSync(new URL('../db/private-store/'+name,import.meta.url)),execFileSync('git',['show',accepted.producer.sourceSha+':apps/srm/db/private-store/'+name]),name)
 }
 const root=new URL('../../../packages/platform-contracts/migrations/access/',import.meta.url)
 for(const name of fs.readdirSync(root).filter(n=>/^0(?:0[1-9]|1[0-9])-.*\.sql$/.test(n)))assert.deepEqual(fs.readFileSync(new URL(name,root)),execFileSync('git',['show',accepted.producer.sourceSha+':packages/platform-contracts/migrations/access/'+name]),name)
 assert.equal(hash(fs.readFileSync(new URL('../db/private-store/014-supplier-location-admission-parent.sql',import.meta.url))),accepted.parentSchemaDigest)
})

test('manual CREATE identity uses the producer formula scoped to authenticated actor/org, supplier, environment and key',()=>{
 const org='11111111-1111-4111-8111-111111111111',user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',supplier='22222222-2222-4222-8222-222222222222'
 const binding={applicationId:'srm',environment:'development',role:'synthetic_runtime',projectId:'p',branchId:'b',databaseName:'d'}
 const port=createSupplierLocationAdmission({binding,schemaDigest:accepted.sql020Digest,proofKey:Buffer.alloc(32),readParent:async()=>null})
 const input={organisationId:org,userId:user,supplierId:supplier,idempotencyKey:'synthetic_idempotency_key_123456789'}
 const id=port.locationId(input);assert.equal(port.locationId(input),id)
 for(const patch of [{organisationId:supplier},{userId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},{supplierId:org},{idempotencyKey:'different_idempotency_key_123456789'}])assert.notEqual(port.locationId({...input,...patch}),id)
 const prod=createSupplierLocationAdmission({binding:{...binding,environment:'production'},schemaDigest:accepted.sql020Digest,proofKey:Buffer.alloc(32),readParent:async()=>null})
 assert.notEqual(prod.locationId(input),id)
})
