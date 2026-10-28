import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {prepareBaseline} from './pilot2-baseline.mjs'
const repo=fileURLToPath(new URL('../../..',import.meta.url))
test('Cold acquisition adopts canonical native engines, guarded HTTP continuations and exports while preserving calculations and measured cache',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pilot2-cold-overlay-'))
 try{
  const target=JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-runtime-targets.json')))
  const scanner=path.join(root,'scanner'),cold=path.join(root,'cold')
  prepareBaseline(repo,target,scanner,'SCANNER');const proof=prepareBaseline(repo,target,cold,'COLD_ACQUISITION')
  const read=(dir,name)=>fs.readFileSync(path.join(dir,'apps/srm/'+name),'utf8')
  assert.equal(read(cold,'src/server/private-runtime.ts'),execFileSync('git',['show',proof.pilotEntrySourceSha+':apps/srm/src/server/private-runtime.ts'],{cwd:repo,encoding:'utf8'}))
  assert.equal(proof.pilotEntryFiles.length,6)
  for(const name of proof.pilotEntryFiles)assert.equal(fs.readFileSync(path.join(cold,name),'utf8'),execFileSync('git',['show',proof.pilotEntrySourceSha+':'+name],{cwd:repo,encoding:'utf8'}))
  assert.equal(proof.overlay.externalHttpInHumanTransaction,false)
  assert.equal(proof.overlay.privateDataAuthority,'EXISTING_E1_ORGANISATION_NO_CLONED_ARCHIVE')
  assert.equal(proof.overlay.postClickClerkReads,false)
  for(const file of['src/server/financial-indicators.ts','src/server/financial-scanner.ts',
   'src/server/financial-revisions.ts','package-lock.json'])assert.equal(read(cold,file),read(scanner,file),file)
  assert.equal(read(cold,'app/page.tsx').replace('const response = await transport("/api/xray/financial-excel"','const response = await fetch("/api/xray/financial-excel"'),read(scanner,'app/page.tsx'))
  assert.match(read(cold,'src/modules/xray/krs-session-transport.ts'),/const paths=new Set\(\['\/api\/xray\/financial-excel'/)
  assert.doesNotMatch(read(cold,'src/modules/xray/krs-session-transport.ts').split('\n')[1],/financial-excel/,'Export cannot inherit a report admission')
  const beforeBoundary=v=>v.slice(0,v.indexOf('/** Same host boundary as the existing exports;'))
  const coldReport=read(cold,'src/server/report-data.ts')
  assert.equal(coldReport.slice(0,coldReport.indexOf('export type ReportDataOperationBoundary =')),beforeBoundary(read(scanner,'src/server/report-data.ts')))
  for(const file of['supplier-native-work-store.ts','provider-source-transport.ts','krs-native-financial.ts']){
   assert.equal(read(cold,'src/server/'+file),fs.readFileSync(path.join(repo,'apps/srm/src/server/'+file),'utf8'))
  }
  assert.match(read(cold,'src/modules/xray/report-controller.ts'),/response\.status===202/)
  assert.match(read(cold,'app/api/xray/krs/lookup/route.ts'),/getPilot2ColdRuntime\(\)\.lookup/)
  assert.match(read(cold,'middleware.ts'),/'\/api\/xray\/financial-excel'/)
  assert.doesNotMatch(read(cold,'middleware.ts'),/api\/supplier-locations/)
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
