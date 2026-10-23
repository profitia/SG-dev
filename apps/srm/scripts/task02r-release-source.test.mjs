import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {assembleTask02rSource} from './task02r-build-release.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const hash=b=>createHash('sha256').update(b).digest('hex')
test('the narrow build retains deployed Identity/KRS bytes and only accepts the exact repair closure',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'task02r-source-test-')),out=path.join(temp,'source')
 try{
  const receipt=assembleTask02rSource(root,out),base=receipt.baselineSha
  const changed=new Set([...Object.keys(receipt.overrides),'packages/platform-contracts/package.json',
   'packages/platform-contracts/package-lock.json','apps/srm/package-lock.json','task02r-release-source.json'])
  const files=execFileSync('git',['ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n')
  // Every SRM and platform source outside the exact closure retains its Git blob.
  const entries=execFileSync('git',['ls-tree','-r',base,'apps/srm','packages/platform-contracts','packages/maps-embed'],{cwd:root,encoding:'utf8'}).trim().split('\n')
  for(const line of entries){const [metadata,name]=line.split('\t');if(changed.has(name))continue
   const expected=metadata.split(' ')[2],file=path.join(out,name),bytes=fs.lstatSync(file).isSymbolicLink()?Buffer.from(fs.readlinkSync(file)):fs.readFileSync(file)
   assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),expected,name)
  }
  for(const [name,digest]of Object.entries(receipt.overrides))assert.equal(hash(fs.readFileSync(path.join(out,name))),digest,name)
  for(const name of ['apps/srm/app/page.tsx','apps/srm/app/session-boundary.tsx','apps/srm/src/server/private-runtime.ts','apps/srm/package.json'])assert.deepEqual(fs.readFileSync(path.join(out,name)),execFileSync('git',['show',base+':'+name],{cwd:root}))
  assert.equal(JSON.parse(fs.readFileSync(path.join(out,'packages/platform-contracts/package.json'))).version,'1.26.0')
  assert.equal(receipt.identityOrKrsSourceAdopted,false)
  assert(!fs.existsSync(path.join(out,'packages/platform-contracts/src/identity-renewal.mjs')))
  assert(files.includes('apps/srm/src/server/supplier-request-work.ts'))
  assert.throws(()=>assembleTask02rSource(root,out),/FRESH_RELEASE_DIRECTORY_REQUIRED/)
  // A pinned repair changed in the input fails before fetching or writing.
  const candidate=path.join(temp,'candidate');fs.mkdirSync(candidate)
  execFileSync('git',['init','--quiet'],{cwd:candidate})
  execFileSync('git',['remote','add','origin','https://github.com/profitia/SG-dev.git'],{cwd:candidate})
  for(const name of [...Object.keys(receipt.overrides),'apps/srm/deployment/task02r-release-source.json']){
   fs.mkdirSync(path.dirname(path.join(candidate,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(candidate,name))
  }
  const entry=path.join(candidate,'apps/srm/src/server/supplier-request-work.ts');fs.appendFileSync(entry,'\n// unaccepted source\n')
  assert.throws(()=>assembleTask02rSource(candidate,path.join(temp,'refused')),/RELEASE_OVERRIDE_DIGEST_MISMATCH/)
  assert(!fs.existsSync(path.join(temp,'refused')))
  fs.unlinkSync(entry);fs.symlinkSync(path.join(root,'apps/srm/src/server/supplier-request-work.ts'),entry)
  assert.throws(()=>assembleTask02rSource(candidate,path.join(temp,'refused')),/RELEASE_SYMLINK_REFUSED/)
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})
