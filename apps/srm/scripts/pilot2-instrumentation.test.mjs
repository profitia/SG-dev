import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {prepareBaseline} from './pilot2-baseline.mjs'
import {instrumentPilot2} from './pilot2-instrumentation.mjs'
const repo=path.resolve(fileURLToPath(new URL('../../..',import.meta.url)))
const target=JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-runtime-targets.json'),'utf8'))
const sha=value=>createHash('sha256').update(value).digest('hex')
test('telemetry preserves every financial, provider, cache and access business source byte',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pilot2-instrumentation-'))
 try{
  const output=path.join(root,'instrumented'),proof=prepareBaseline(repo,target,output,'TELEMETRY')
  const expected=['apps/srm/src/server/runtime-environment.ts','apps/srm/src/server/lookup-diagnostics.ts','apps/srm/src/server/db.ts','apps/srm/app/api/xray/search/route.ts','apps/srm/app/api/xray/report-data/route.ts']
  assert.deepEqual(proof.changedFiles,expected)
  for(const [name,hash]of Object.entries(proof.originalFiles))if(!expected.includes(name))assert.equal(sha(fs.readFileSync(path.join(output,name))),hash,name)
  assert.deepEqual(proof.addedFiles,['apps/srm/src/server/supplier-telemetry.ts','apps/srm/src/server/diagnostic-trace.ts','apps/srm/src/server/diagnostic-pg.ts'])
  assert.equal(sha(fs.readFileSync(path.join(output,proof.addedFiles[0]))),sha(fs.readFileSync(path.join(repo,proof.addedFiles[0]))))
  assert.throws(()=>instrumentPilot2(repo,output,proof),/unchanged historical source/)
  assert.throws(()=>prepareBaseline(repo,target,path.join(root,'unexpected'),'UNKNOWN'),/explicitly accepted/)
  assert(!fs.existsSync(path.join(root,'unexpected')))
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
