import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {prepareBaseline} from './pilot2-baseline.mjs'
import {verifyHumanPackage} from './pilot2-human-overlay.mjs'
const repo=fileURLToPath(new URL('../../..',import.meta.url))
const load=n=>JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-'+n),'utf8'))
const hash=b=>createHash('sha256').update(b).digest('hex')
test('form stage reuses the measured Registry engine and exact Staging SQL; no private clone or paid request enters form admission',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pilot2-human-overlay-'))
 try{
  const target=load('runtime-targets.json'),registry=path.join(root,'registry'),human=path.join(root,'human')
  prepareBaseline(repo,target,registry,'REGISTRY');const proof=prepareBaseline(repo,target,human,'FORM_ADMISSION')
  assert.equal(proof.overlay.stage,'FORM_ADMISSION');assert.equal(proof.overlay.coldAcquisitionStage,'NOT_YET_ADOPTED_FAIL_CLOSED')
  assert.equal(proof.overlay.clonedPrivateDataDisclosed,false)
  assert.equal(proof.overlay.retainedHostSourceSha,'77f7908756a343f4c62bed50fb2a0e52af1cc375')
  const retained={
  "apps/srm/src/modules/xray/use-supplier-report.ts": "5a32d160bcc836e91749835d154cb90c57c93e591393d3f7f88e446a3cb4a5a4",
  "apps/srm/src/server/private-operation-host.ts": "0a622121b0930e121a531345ded9770a4ebcd761a9f9900596492772cddf2165",
  "apps/srm/src/server/request-origin.ts": "5af12d28d91f31873de3edc2ba00769856d8b3fd46f1397fa82715e6f4332672"
}
  assert.deepEqual(proof.overlay.retainedHostFiles,retained)
  for(const[name,digest]of Object.entries(retained)){
   const body=fs.readFileSync(path.join(human,name),'utf8')
   assert.equal(hash(body),digest,name)
   assert(!body.includes('@profitia/srm-xray/workflow'),name)
   assert(!body.includes('@profitia/platform-contracts/peer-operation'),name)
  }
  assert(!fs.existsSync(path.join(human,'apps/srm/src/server/peer-xray.ts')))
  assert(fs.readFileSync(path.join(repo,'apps/srm/src/server/private-operation-host.ts'),'utf8').includes('@profitia/platform-contracts/peer-operation'))

  for(const file of ['mgbi-financial.ts','mgbi-general.ts','financial-indicators.ts','financial-documents.ts','msr-repository.ts','msr-parser.ts','xray-lookup.ts']){
   const relative='apps/srm/src/server/'+file
   assert.equal(hash(fs.readFileSync(path.join(human,relative))),hash(fs.readFileSync(path.join(registry,relative))),file)
  }
  for(const relative of['apps/srm/src/modules/xray/report-controller.ts','apps/srm/src/modules/xray/supplier-report.tsx'])assert.equal(hash(fs.readFileSync(path.join(human,relative))),hash(fs.readFileSync(path.join(registry,relative))),relative)
  const original=fs.readFileSync(path.join(registry,'apps/srm/src/server/report-data.ts'),'utf8')
  const changed=fs.readFileSync(path.join(human,'apps/srm/src/server/report-data.ts'),'utf8')
  const oldSql=/export const REPORT_DATA_SQL = `([\s\S]*?)`;/u.exec(original)[1]
  const shared=/export const REPORT_SHARED_FINANCIAL_SELECT = `([\s\S]*?)`;/u.exec(changed)[1]
  const reconstructed=/export const REPORT_DATA_SQL = `([\s\S]*?)`;/u.exec(changed)[1].replace('${REPORT_SHARED_FINANCIAL_SELECT}',shared)
  assert.equal(reconstructed,oldSql,'No change to original private SQL, calculations or scanner queries')
  assert(!shared.includes('financial_source_documents'));assert(!shared.includes('lookup_requests'))
  const page=fs.readFileSync(path.join(human,'apps/srm/app/page.tsx'),'utf8')
  assert(page.includes('requireAdmission={true}'));assert(page.includes('useSupplierReport(transport)'))
  assert(page.includes('<SrmAuthenticatedView>'));assert(!page.includes('<iframe'))
  const middleware=fs.readFileSync(path.join(human,'apps/srm/middleware.ts'),'utf8')
  assert(!middleware.includes('hasDemoSession'));assert(!middleware.includes("'/api/xray/kys'"))
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('all Registry dependencies remain exact; an extra package, altered Next or lifecycle script rejects the lock',()=>{
 const a=load('registry-package.json'),b=load('human-package.json'),c=load('registry-package-lock.json'),d=load('human-package-lock.json')
 assert.doesNotThrow(()=>verifyHumanPackage(a,b,c,d))
 for(const mutate of[
  x=>{x.packages['node_modules/next'].version='0.0.0'},
  x=>{x.packages['node_modules/other']={version:'1.0.0'}},
  x=>{x.packages['node_modules/@clerk/react'].hasInstallScript=true},
  x=>{x.packages['node_modules/@clerk/backend'].resolved='https://unapproved.example/package.tgz'},
 ]){const changed=structuredClone(d);mutate(changed);assert.throws(()=>verifyHumanPackage(a,b,c,changed))}
})
