import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {prepareBaseline} from './pilot2-baseline.mjs'
import {PILOT2_PRIVATE_HTTP_ROUTES} from './pilot2-private-overlay.mjs'
const repo=fileURLToPath(new URL('../../..',import.meta.url))
test('Private stage opens canonical current-HUMAN routes without moving them into company admission or changing report calculations',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pilot2-private-overlay-'))
 try{
  const target=JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-runtime-targets.json')))
  const cold=path.join(root,'cold'),privateApp=path.join(root,'private')
  prepareBaseline(repo,target,cold,'COLD_ACQUISITION');const proof=prepareBaseline(repo,target,privateApp,'PRIVATE_OPERATIONS')
  const read=(dir,name)=>fs.readFileSync(path.join(dir,'apps/srm/'+name),'utf8')
  assert.equal(proof.overlay.companyAdmissionAuthorizesPrivateData,false)
  for(const file of['src/server/financial-indicators.ts','src/server/financial-scanner.ts','src/server/financial-revisions.ts',
   'src/server/report-data.ts','src/modules/xray/report-controller.ts','package-lock.json'])assert.equal(read(privateApp,file),read(cold,file),file)
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
