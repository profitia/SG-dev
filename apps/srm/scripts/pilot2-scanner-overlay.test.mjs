import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {prepareBaseline} from './pilot2-baseline.mjs'
const repo=fileURLToPath(new URL('../../..',import.meta.url))
test('Scanner keeps the measured form, Staging financial projector and controller; only the admitted private data source is connected',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pilot2-scanner-overlay-'))
 try{
  const target=JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-runtime-targets.json')))
  const before=path.join(root,'form'),after=path.join(root,'scanner')
  prepareBaseline(repo,target,before,'FORM_ADMISSION');const proof=prepareBaseline(repo,target,after,'SCANNER')
  assert.equal(proof.overlay.privateDocumentsAuthority,'EXISTING_E1_ORGANISATION_NO_CLONED_ARCHIVE')
  assert.equal(proof.overlay.coldAcquisitionStage,'NOT_YET_ADOPTED_FAIL_CLOSED')
  const read=(dir,file)=>fs.readFileSync(path.join(dir,'apps/srm/'+file),'utf8')
  for(const file of['src/modules/xray/report-controller.ts','src/modules/xray/supplier-report.tsx',
   'src/server/financial-indicators.ts','src/server/financial-scanner.ts','src/server/financial-documents.ts',
   'src/server/mgbi-financial.ts','app/page.tsx','middleware.ts'])assert.equal(read(after,file),read(before,file),file)
  const projector=value=>value.slice(value.indexOf('export function projectReportData('),value.indexOf('/** One PostgreSQL statement'))
  assert.equal(projector(read(after,'src/server/report-data.ts')),projector(read(before,'src/server/report-data.ts')))
  assert(read(after,'src/server/report-data.ts').includes('REPORT_PRIVATE_DATA_SQL, parameters.slice(0, 3)'))
  assert(read(after,'app/api/xray/report-data/route.ts').includes('getPilot2ScannerRuntime().report'))
  assert(read(after,'app/api/health/route.ts').includes('getPilot2ScannerRuntime()'))
  assert.equal(read(after,'package-lock.json'),read(before,'package-lock.json'))
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
