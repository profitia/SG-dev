import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {prepareBaseline} from './pilot2-baseline.mjs'
import {PILOT2_PRIVATE_HTTP_ROUTES} from './pilot2-private-overlay.mjs'
const repo=fileURLToPath(new URL('../../..',import.meta.url))
// Exact inverse of the approved observation-only transform. The complete
// original report source must still match,not just a few labels or formulas.
function withoutReportDiagnostics(source,cold){
 const replaceOnce=(from,to)=>{assert.equal(source.split(from).length,2,from);source=source.replace(from,to)}
 replaceOnce("import {diagnosticRun} from './diagnostic-trace';\n",'')
 replaceOnce("import {diagnosticResponseJson} from './diagnostic-trace';\n",'')
 replaceOnce('function projectReportDataObserved(','export function projectReportData(')
 replaceOnce("\nexport const projectReportData:typeof projectReportDataObserved=(...args)=>diagnosticRun('REPORT_PROJECTION',()=>projectReportDataObserved(...args));\n",'')
 assert.equal(source.split('diagnosticResponseJson(').length-1,cold.split('Response.json(').length-1)
 return source.replaceAll('diagnosticResponseJson(','Response.json(')
}
test('Private stage opens canonical current-HUMAN routes without moving them into company admission or changing report calculations',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pilot2-private-overlay-'))
 try{
  const target=JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-runtime-targets.json')))
  const cold=path.join(root,'cold'),privateApp=path.join(root,'private')
  prepareBaseline(repo,target,cold,'COLD_ACQUISITION');const proof=prepareBaseline(repo,target,privateApp,'PRIVATE_OPERATIONS')
  const read=(dir,name)=>fs.readFileSync(path.join(dir,'apps/srm/'+name),'utf8')
  assert.equal(proof.overlay.companyAdmissionAuthorizesPrivateData,false)
  for(const file of['src/server/financial-indicators.ts','src/server/financial-scanner.ts','src/server/financial-revisions.ts',
   'src/server/report-data.ts','src/modules/xray/report-controller.ts','package-lock.json']){
    const actual=read(privateApp,file),original=read(cold,file)
    assert.equal(file==='src/server/report-data.ts'?withoutReportDiagnostics(actual,original):actual,original,file)
   }
  for(const[name,operation]of Object.entries(PILOT2_PRIVATE_HTTP_ROUTES)){
   assert.match(read(privateApp,'app/api/xray/'+name+'/route.ts'),new RegExp("\\.private\\('"+operation+"',request\\)"))
   assert(read(privateApp,'middleware.ts').includes('/api/xray/'+name))
  }
  const transport=read(privateApp,'src/modules/xray/krs-session-transport.ts')
  const reportPaths=transport.split('\n').find(line=>line.startsWith('const reportPaths='))
  for(const name of Object.keys(PILOT2_PRIVATE_HTTP_ROUTES))assert(!reportPaths.includes("'/api/xray/"+name+"'"))
  assert(!read(privateApp,'middleware.ts').includes('/api/supplier-locations'))
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
