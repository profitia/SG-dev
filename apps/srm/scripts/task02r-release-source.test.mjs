import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {assembleTask02rSource,copyTask02rArtifact} from './task02r-build-release.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const hash=b=>createHash('sha256').update(b).digest('hex')
test('the narrow build retains deployed Identity/KRS bytes and only accepts the exact repair closure',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'task02r-source-test-')),out=path.join(temp,'source')
 try{
  let inputRoot=root
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'apps/srm/deployment/task02r-release-source.json')))
  const acceptance=JSON.parse(fs.readFileSync(path.join(root,'apps/srm/operation-integration.json'))).krsNipSourceCompatibility
  if(acceptance&&Object.entries(manifest.overrides).some(([name,digest])=>hash(fs.readFileSync(path.join(root,name)))!==digest)){
   // The parallel KRS candidate must remain refused by the frozen narrow
   // builder. Exercise its accepted historical input separately, without
   // widening its manifest, changing its code or activating another service.
   assert.throws(()=>assembleTask02rSource(root,out),/RELEASE_OVERRIDE_DIGEST_MISMATCH/)
   inputRoot=path.join(temp,'accepted-source')
   execFileSync('git',['clone','--quiet','--shared','--no-checkout',root,inputRoot])
   execFileSync('git',['checkout','--quiet','--detach',acceptance.preservedBoundedIndicatorSourceSha],{cwd:inputRoot})
   execFileSync('git',['remote','set-url','origin','https://github.com/profitia/SG-dev.git'],{cwd:inputRoot})
  }
  const receipt=assembleTask02rSource(inputRoot,out),base=receipt.baselineSha
  const changed=new Set([...Object.keys(receipt.overrides),'packages/platform-contracts/package.json',
   'packages/platform-contracts/package-lock.json','apps/srm/package-lock.json','task02r-release-source.json'])
  const files=execFileSync('git',['ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n')
  // Every SRM and platform source outside the exact closure retains its Git blob.
  const entries=execFileSync('git',['ls-tree','-r',base,'apps/srm','packages/platform-contracts','packages/maps-embed'],{cwd:root,encoding:'utf8'}).trim().split('\n')
  for(const line of entries){const [metadata,name]=line.split('\t');if(changed.has(name))continue
   const expected=metadata.split(' ')[2],file=path.join(out,name),bytes=fs.lstatSync(file).isSymbolicLink()?Buffer.from(fs.readlinkSync(file)):fs.readFileSync(file)
   assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),expected,name)
  }
  for(const [name,digest]of Object.entries(receipt.assembledOverrideDigests))assert.equal(hash(fs.readFileSync(path.join(out,name))),digest,name)
  const store='apps/srm/src/server/supplier-native-work-store.ts',selected=fs.readFileSync(path.join(out,store),'utf8')
  const baseline=execFileSync('git',['show',base+':'+store],{cwd:root,encoding:'utf8'})
  for(const [start,end]of [['    register(','\n    cache('],['    reproject(','\n    archive(']]){
   const part=text=>text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)))
   assert.equal(part(selected),part(baseline),'Parallel KRS method must retain deployed bytes: '+start)
  }
  assert(!selected.includes('ExistingSupplierRegistration'));assert(!selected.includes('includeOriginalResponse'))
  assert(selected.includes('async indicators('));assert(selected.includes('readIndicatorPublication'))
  for(const name of ['apps/srm/app/page.tsx','apps/srm/app/session-boundary.tsx','apps/srm/src/server/private-runtime.ts','apps/srm/package.json'])assert.deepEqual(fs.readFileSync(path.join(out,name)),execFileSync('git',['show',base+':'+name],{cwd:root}))
  assert.equal(JSON.parse(fs.readFileSync(path.join(out,'packages/platform-contracts/package.json'))).version,'1.26.0')
  assert.equal(receipt.identityOrKrsSourceAdopted,false)
  assert(!fs.existsSync(path.join(out,'packages/platform-contracts/src/identity-renewal.mjs')))
  assert(files.includes('apps/srm/src/server/supplier-request-work.ts'))
  assert.throws(()=>assembleTask02rSource(root,out),/FRESH_RELEASE_DIRECTORY_REQUIRED/)
  // A pinned repair changed in the input fails before fetching or writing.
  const candidate=path.join(temp,'candidate');fs.mkdirSync(candidate)
  execFileSync('git',['init','--quiet'],{cwd:candidate})
  execFileSync('git',['remote','add','origin','https://github.com/profitia/SG-dev'],{cwd:candidate})
  for(const name of [...Object.keys(receipt.overrides),'apps/srm/deployment/task02r-release-source.json']){
   fs.mkdirSync(path.dirname(path.join(candidate,name)),{recursive:true});fs.copyFileSync(path.join(inputRoot,name),path.join(candidate,name))
  }
  const entry=path.join(candidate,'apps/srm/src/server/supplier-request-work.ts');fs.appendFileSync(entry,'\n// unaccepted source\n')
  assert.throws(()=>assembleTask02rSource(candidate,path.join(temp,'refused')),/RELEASE_OVERRIDE_DIGEST_MISMATCH/)
  assert(!fs.existsSync(path.join(temp,'refused')))
  execFileSync('git',['remote','set-url','origin','https://github.com/profitia/unapproved-repository.git'],{cwd:candidate})
  assert.throws(()=>assembleTask02rSource(candidate,path.join(temp,'refused')),/REPOSITORY_AUTHORITY_MISMATCH/)
  execFileSync('git',['remote','set-url','origin','https://github.com/profitia/SG-dev.git'],{cwd:candidate})
  fs.unlinkSync(entry);fs.symlinkSync(path.join(root,'apps/srm/src/server/supplier-request-work.ts'),entry)
  assert.throws(()=>assembleTask02rSource(candidate,path.join(temp,'refused')),/RELEASE_SYMLINK_REFUSED/)
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})

test('standalone external packages remain loadable after the complete isolated source is removed',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'task02r-alias-test-')),source=path.join(temp,'source'),next=path.join(source,'.next'),destination=path.join(temp,'retained/.next')
 try{
  const packages={}
  for(const name of ['pdfkit','pg','rimraf','sharp']){
   const pkg={name,version:'1.0.0',main:'index.cjs'};packages['node_modules/'+name]={version:pkg.version}
   for(const folder of [path.join(source,'node_modules',name),path.join(next,'standalone/node_modules',name)]){
    fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'package.json'),JSON.stringify(pkg));fs.writeFileSync(path.join(folder,'index.cjs'),'module.exports='+JSON.stringify({name})+';')
   }
   fs.mkdirSync(path.join(next,'node_modules'),{recursive:true});fs.symlinkSync('../../node_modules/'+name,path.join(next,'node_modules',name+'-'+'a'.repeat(16)))
  }
  fs.writeFileSync(path.join(source,'package-lock.json'),JSON.stringify({packages}))
  copyTask02rArtifact(next,destination)
  fs.rmSync(source,{recursive:true,force:true})
  const require=createRequire(path.join(destination,'standalone/.next/server/chunks/probe.cjs'))
  for(const name of ['pdfkit','pg','rimraf','sharp']){
   const alias=name+'-'+'a'.repeat(16)
   assert.equal(require(alias).name,name)
   assert(fs.realpathSync(path.join(destination,'node_modules',alias)).startsWith(fs.realpathSync(path.join(destination,'standalone/node_modules'))+'/'))
  }
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})
