import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {prepareBaseline,BUSINESS_BASELINE} from './pilot2-baseline.mjs'
import {verifyRegistryLock} from './pilot2-registry-package.mjs'
import {replaceRegistrySeam} from './pilot2-registry-overlay.mjs'
const repo=path.resolve(fileURLToPath(new URL('../../..',import.meta.url)))
const target=JSON.parse(fs.readFileSync(new URL('../deployment/pilot2-runtime-targets.json',import.meta.url)))
const hash=value=>createHash('sha256').update(value).digest('hex')
test('registry stage retains all financial formula, parser, UI and freshness bytes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pilot2-registry-test-')),out=path.join(dir,'out')
 try{
  const proof=prepareBaseline(repo,target,out,'REGISTRY')
  for(const name of ['financial-indicators.ts','financial-unit.ts','financial-revisions.ts','financial-documents.ts','msr-parser.ts','shared-catalog.ts']){
   const file='apps/srm/src/server/'+name
   if(proof.originalFiles[file])assert.equal(hash(fs.readFileSync(path.join(out,file))),proof.originalFiles[file],name)
  }
  for(const [file,digest]of Object.entries(proof.originalFiles))if(file.startsWith('apps/srm/src/modules/')||file.startsWith('apps/srm/src/components/'))assert.equal(hash(fs.readFileSync(path.join(out,file))),digest,file)
  assert.equal(proof.overlay.stage,'REGISTRY');assert.equal(proof.overlay.humanAuthorizationStage,'NOT_YET_ADOPTED')
  const engine=fs.readFileSync(path.join(out,'apps/srm/src/server/xray-lookup.ts'),'utf8')
  assert(engine.indexOf('if(registry)financial=await reconcilePilot2Financial')<engine.indexOf('await atLookupStage("source_archive"'))
  assert(engine.indexOf('if(registry)msr={...await reconcilePilot2Financial')<engine.indexOf('const savedFinancial ='))
  assert.match(engine,/preserveGeneral:!registry/)
  const msr=fs.readFileSync(path.join(out,'apps/srm/src/server/msr-repository.ts'),'utf8')
  const originalMsr=execFileSync('git',['show',BUSINESS_BASELINE+':apps/srm/src/server/msr-repository.ts'],{cwd:repo,encoding:'utf8'})
  assert.equal(msr.replace('import {requirePilot2FinancialAcquisition} from "./pilot2-registry";\n','').replace('claim:(c,id) => {requirePilot2FinancialAcquisition();return withOrganization(organizationId,client => claimMsrSource(client,organizationId,c,id,requestId));},','claim:(c,id) => withOrganization(organizationId,client => claimMsrSource(client,organizationId,c,id,requestId)),'),originalMsr)
  const original=JSON.parse(execFileSync('git',['show',BUSINESS_BASELINE+':apps/srm/package-lock.json'],{cwd:repo}))
  verifyRegistryLock(original,JSON.parse(fs.readFileSync(path.join(out,'apps/srm/package-lock.json'))))
  const changed=JSON.parse(fs.readFileSync(path.join(out,'apps/srm/package-lock.json')));changed.packages['node_modules/pg'].version='0.0.0'
  assert.throws(()=>verifyRegistryLock(original,changed),/Staging dependency changed/)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('an ambiguous or drifted Staging seam cannot be patched silently',()=>{
 assert.throws(()=>replaceRegistrySeam('no','old','new'))
 assert.throws(()=>replaceRegistrySeam('old old','old','new'))
})
