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
  assert.deepEqual(r.changedPaths,['apps/srm/src/server/supplier-locations.ts'])
  const value=fs.readFileSync(path.join(out,r.changedPaths[0]),'utf8');assert.match(value,/if\(!row\?\.nip\)return refuse\(\)/)
  assert.doesNotMatch(value,/if\(!row\?\.nip\|\|!row.krs\)/)
  assert(!fs.existsSync(path.join(out,'apps/krs-registry-runtime')))
  const store=fs.readFileSync(path.join(out,'apps/srm/src/server/supplier-native-work-store.ts'),'utf8')
  assert.doesNotMatch(store,/ExistingSupplierRegistration|includeOriginalResponse/)
  assert.equal(fs.readFileSync(path.join(out,'apps/srm/src/server/private-runtime.ts'),'utf8'),execFileSync('git',['show','a0a3b0626fac16e011b57d6284ce55abcfcd3ca3:apps/srm/src/server/private-runtime.ts'],{cwd:root,encoding:'utf8'}))
  assert.throws(()=>assembleLocationAccessSource(root,out),/FRESH_RELEASE_DIRECTORY_REQUIRED/)
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})
