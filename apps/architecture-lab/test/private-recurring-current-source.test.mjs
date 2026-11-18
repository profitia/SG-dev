// SYNTHETIC_ONLY: local Git authority fixtures, no real admission or provider.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {proposeSourceAdmission} from '../../../scripts/governance/development-execution.mjs'

const repository=fileURLToPath(new URL('../../../',import.meta.url))
const source='apps/newsfeed-runtime/src/server.mjs'
const store='Canon/registries/controlled-source-admissions-v1.json'
const environment={PATH:process.env.PATH,GIT_NO_LAZY_FETCH:'1'}
const identity=['-c','user.name=Synthetic provenance test','-c','user.email=synthetic@invalid.test','-c','commit.gpgsign=false']
function git(root,args){return execFileSync('git',args,{cwd:root,env:environment,stdio:['ignore','pipe','pipe'],encoding:'utf8'}).trim()}
function probe(root,mode='plain'){
 const program="import fs from 'node:fs';import{pathToFileURL}from'node:url';import{execFileSync}from'node:child_process';const root=process.argv[1],mode=process.argv[2],source=process.argv[3];const{recurringSourcePredecessor}=await import(new URL('apps/architecture-lab/private-recurring-source.mjs',pathToFileURL(root+'/')));const physical=p=>fs.readFileSync(root+'/'+p),history=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']});const current=p=>{const bytes=physical(p);if(mode==='callback'&&p===source)return Buffer.concat([bytes,Buffer.from('UNACCEPTED_CALLBACK')]);if(mode==='receipt'&&p==='apps/srm/operation-integration.json')return Buffer.concat([bytes,Buffer.from('UNACCEPTED_RECEIPT')]);return bytes};const view=recurringSourcePredecessor(current,history);if(!view||view.manifest.runtimeActivated!==false)throw Error('REAL_RECURRING_GRAPH_REQUIRED');process.stdout.write('SYNTHETIC_SOURCE_VIEW_VERIFIED')"
 return execFileSync(process.execPath,['--input-type=module','-e',program,root,mode,source],{env:environment,stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:60000}).trim()
}
function fixture({admit=true,expired=false}={}){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pi-recurring-admission-test-')),root=path.join(temp,'repo')
 try{
  execFileSync('git',['clone','--quiet','--shared','--no-checkout',repository,root],{env:environment,stdio:['ignore','pipe','pipe']})
  const base=git(repository,['rev-parse','HEAD'])
  git(root,['checkout','--quiet','--detach',base]);git(root,['remote','set-url','origin','https://github.com/profitia/SG-dev.git'])
  git(root,['update-ref','refs/remotes/origin/main',base])
  fs.appendFileSync(path.join(root,source),'\n// SYNTHETIC_ONLY admitted current application source\n')
  git(root,['add','--',source]);git(root,[...identity,'commit','--quiet','-m','SYNTHETIC ordinary application source'])
  const sourceSha=git(root,['rev-parse','HEAD'])
  if(admit){
   const proposed=proposeSourceAdmission({projectKey:'ARCHITECTURE',taskId:'SYNTHETIC_RECURRING_APPLICATION_TEST',sourceSha,baseSha:base,repositoryRoot:root},root)
   assert.equal(proposed.status,'PROPOSED');assert.equal(proposed.actor,null);assert.equal(proposed.approvalRef,null)
   const now=Date.now(),record={...proposed,status:'ACTIVE',actor:'profitia',approvalRef:'SYNTHETIC_ONLY_NOT_A_REAL_OWNER_DECISION',validFrom:new Date(now-120000).toISOString(),validUntil:new Date(now+(expired?-60000:3600000)).toISOString()}
   git(root,['checkout','--quiet','--detach',base])
   const ledger=JSON.parse(fs.readFileSync(path.join(root,store)));ledger.records.push(record)
   fs.writeFileSync(path.join(root,store),JSON.stringify(ledger,null,2))
   git(root,['add','--',store]);git(root,[...identity,'commit','--quiet','-m','SYNTHETIC local authority only - no real grant'])
   const control=git(root,['rev-parse','HEAD']);git(root,['update-ref','refs/remotes/origin/main',control])
   git(root,['checkout','--quiet','--detach',sourceSha]);git(root,[...identity,'merge','--quiet','--no-edit',control])
  }
  return {root,temp,close(){fs.rmSync(temp,{recursive:true,force:true})}}
 }catch(error){fs.rmSync(temp,{recursive:true,force:true});throw error}
}
test('an independent full current-source admission permits Newsfeed without replacing any historical receipt',()=>{
 const f=fixture()
 try{
  assert.equal(probe(f.root),'SYNTHETIC_SOURCE_VIEW_VERIFIED')
  const file=path.join(f.root,source),original=fs.readFileSync(file)
  assert.throws(()=>probe(f.root,'callback'),'callback bytes are not physical admitted bytes')
  assert.throws(()=>probe(f.root,'receipt'),'immutable receipts remain exact')
  fs.appendFileSync(file,'UNADMITTED_PHYSICAL_CHANGE')
  assert.throws(()=>probe(f.root));fs.writeFileSync(file,original)
  fs.chmodSync(file,0o755);assert.throws(()=>probe(f.root));fs.chmodSync(file,0o644)
  fs.unlinkSync(file);assert.throws(()=>probe(f.root));fs.writeFileSync(file,original)
  const other=path.join(f.temp,'outside-source.mjs');fs.writeFileSync(other,original)
  fs.unlinkSync(file);fs.symlinkSync(other,file);assert.throws(()=>probe(f.root));fs.unlinkSync(file);fs.writeFileSync(file,original)
  const extra=path.join(f.root,'apps/newsfeed-runtime/unadmitted-test.mjs');fs.writeFileSync(extra,'SYNTHETIC_ONLY')
  assert.throws(()=>probe(f.root),'full source closure is mandatory');fs.unlinkSync(extra)
  const ledger=path.join(f.root,store),before=fs.readFileSync(ledger);fs.writeFileSync(ledger,Buffer.concat([before,Buffer.from('\n')]))
  assert.throws(()=>probe(f.root),'candidate metadata cannot replace authority');fs.writeFileSync(ledger,before)
  assert.equal(probe(f.root),'SYNTHETIC_SOURCE_VIEW_VERIFIED')
 }finally{f.close()}
})
test('missing or expired admission refuses current source; actual accepted main remains independent of temporary CI dates',()=>{
 for(const options of[{admit:false},{expired:true}]){
  const f=fixture(options)
  try{assert.throws(()=>probe(f.root))}finally{f.close()}
 }
 const f=fixture({expired:true})
 try{
  git(f.root,['update-ref','refs/remotes/origin/main',git(f.root,['rev-parse','HEAD'])])
  assert.equal(probe(f.root),'SYNTHETIC_SOURCE_VIEW_VERIFIED')
 }finally{f.close()}
})
