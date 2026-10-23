import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {assembleLocationAccessSource} from './location-access-build-release.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
test('location source adopts exactly one HQ check, retaining prior narrow artifact and parallel KRS exclusion',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'location-access-source-test-'))
 try{
  const out=path.join(temp,'source'),r=assembleLocationAccessSource(root,out)
  assert.equal(r.baseArtifactSourceSha,'7833cbfff7cea55cbc2c92be8fff71650167b22d');assert.equal(r.identityOrKrsSourceAdopted,false)
  assert.deepEqual(r.changedPaths,['apps/srm/src/server/supplier-locations.ts','apps/srm/middleware.ts','apps/srm/src/modules/xray/supplier-location-controller.ts'])
  const value=fs.readFileSync(path.join(out,r.changedPaths[0]),'utf8');assert.match(value,/if\(!row\?\.nip\)return refuse\(\)/)
  assert.doesNotMatch(value,/if\(!row\?\.nip\|\|!row.krs\)/)
  assert(!fs.existsSync(path.join(out,'apps/krs-registry-runtime')))
  const store=fs.readFileSync(path.join(out,'apps/srm/src/server/supplier-native-work-store.ts'),'utf8')
  assert.doesNotMatch(store,/ExistingSupplierRegistration|includeOriginalResponse/)
  assert.equal(fs.readFileSync(path.join(out,'apps/srm/src/server/private-runtime.ts'),'utf8'),execFileSync('git',['show','a0a3b0626fac16e011b57d6284ce55abcfcd3ca3:apps/srm/src/server/private-runtime.ts'],{cwd:root,encoding:'utf8'}))
  const middleware=fs.readFileSync(path.join(out,'apps/srm/middleware.ts'),'utf8')
  assert.match(middleware,/"\/api\/supplier-locations"/);assert.doesNotMatch(middleware,/"\/api\/xray\/krs\//)
  assert.equal(middleware,execFileSync('git',['show','a0a3b0626fac16e011b57d6284ce55abcfcd3ca3:apps/srm/middleware.ts'],{cwd:root,encoding:'utf8'}).replace('"/api/xray/web-identity"','"/api/xray/web-identity", "/api/supplier-locations"'))
  assert.equal(fs.readFileSync(path.join(out,r.changedPaths[2]),'utf8'),fs.readFileSync(path.join(root,r.changedPaths[2]),'utf8'))
  assert.throws(()=>assembleLocationAccessSource(root,out),/FRESH_RELEASE_DIRECTORY_REQUIRED/)
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})
test('provider shallow clone retains the fetch-only accepted artifact in the isolated build input',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'location-access-shallow-test-'))
 const run=(args,cwd)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:'pipe'})
 const accepted='7833cbfff7cea55cbc2c92be8fff71650167b22d',shallow=path.join(temp,'provider')
 try{
  run(['clone','--quiet','--no-local','--depth=1','--no-checkout',root,shallow],root)
  run(['sparse-checkout','set','apps/srm','packages/platform-contracts','packages/srm-xray','packages/maps-contracts','packages/maps-embed'],shallow)
  run(['checkout','--quiet','--detach','HEAD'],shallow)
  run(['remote','set-url','origin','https://github.com/profitia/SG-dev.git'],shallow)
  // Preserve the actual candidate bytes during a pre-commit local invocation.
  for(const file of ['apps/srm/deployment/location-access-release-source.json','apps/srm/middleware.ts','apps/srm/src/modules/xray/supplier-location-controller.ts','apps/srm/scripts/location-access-build-release.mjs'])fs.copyFileSync(path.join(root,file),path.join(shallow,file))
  run(['fetch','--no-tags','--depth=1',root,accepted],shallow)
  run(['cat-file','-e',accepted+'^{commit}'],shallow)
  // Retain the independently pinned base and middleware through local refs.
  // The accepted artifact itself remains fetch-only and unreachable: the
  // assertions below still prove the assembler must retain it explicitly.
  // Avoid nested shallow-boundary rewrites for unrelated fixtures in CI Git.
  run(['fetch','--no-tags','--depth=1',root,
   'a0a3b0626fac16e011b57d6284ce55abcfcd3ca3:refs/heads/fixture-base',
   '69c09959ceaa73d3e8836127a029f7caeb30c204:refs/heads/fixture-middleware'],shallow)
  const proof=path.join(temp,'shared-clone')
  run(['clone','--quiet','--shared','--no-checkout',shallow,proof],root)
  assert.throws(()=>run(['cat-file','-e',accepted+'^{commit}'],proof),'shared clone drops an unreachable fetched ancestor from a shallow provider')
  const out=path.join(temp,'source'),r=assembleLocationAccessSource(shallow,out)
  assert.equal(r.baseArtifactSourceSha,accepted);assert.equal(r.identityOrKrsSourceAdopted,false)
  assert.deepEqual(r.changedPaths,['apps/srm/src/server/supplier-locations.ts','apps/srm/middleware.ts','apps/srm/src/modules/xray/supplier-location-controller.ts'])
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})
