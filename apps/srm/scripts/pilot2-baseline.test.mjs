import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {validateTarget,rebindEnvironment,verifyBaselineArchive,prepareBaseline,BUSINESS_BASELINE} from './pilot2-baseline.mjs'
const target=JSON.parse(fs.readFileSync(new URL('../deployment/pilot2-runtime-targets.json',import.meta.url),'utf8'))
const original=execFileSync('git',['show',BUSINESS_BASELINE+':apps/srm/src/server/runtime-environment.ts'],{encoding:'utf8'})
test('accepted historical business source permits only the isolated Development binding',()=>{
 const adapted=rebindEnvironment(original,target)
 assert.equal(adapted,original.replace('br-dark-surf-b1vrhda9',target.neon.branchId).replace('ep-red-smoke-b16ih64d.c-5.eu-central-1.aws.neon.tech',target.neon.host))
 assert.match(adapted,/host !== expected.host/)
 assert.match(adapted,/url.username !== "srm_app_runtime"/)
})
test('other live services, source branches, owner roles and environment substitution are denied',()=>{
 for(const [section,key,value]of [
  ['render','serviceId','srv-db496b3tqb8s73eh5sfg'],['render','autoDeploy',true],
  ['neon','branchId','br-broad-butterfly-b11t4v01'],['neon','host','ep-autumn-wildflower-b1mv0vda.c-5.eu-central-1.aws.neon.tech'],
  ['neon','runtimeRole','neondb_owner'],['source','businessBaselineSha','0'.repeat(40)]
 ]){
  const changed=structuredClone(target);changed[section][key]=value;assert.throws(()=>validateTarget(changed))
 }
 const changed=structuredClone(target);changed.targetEnvironment='staging';assert.throws(()=>validateTarget(changed))
})
test('source drift or removal of a connection guard cannot be hidden as rebinding',()=>{
 assert.throws(()=>rebindEnvironment(original.replace('host !== expected.host','false'),target))
 assert.throws(()=>rebindEnvironment(original.replace('br-dark-surf-b1vrhda9','new-unknown-branch'),target))
})
test('archived source equals accepted Git bytes and works in an actual shallow checkout',()=>{
 const repo=path.resolve(fileURLToPath(new URL('../../..',import.meta.url))),verified=verifyBaselineArchive(repo)
 assert.equal(verified.historicalGitVerified,true)
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pilot2-shallow-test-'))
 try{
  const shallow=path.join(root,'repo');fs.mkdirSync(path.join(shallow,'apps/srm/deployment'),{recursive:true})
  for(const name of ['pilot2-staging-source.json','pilot2-staging-source.tar.gz'])fs.copyFileSync(path.join(repo,'apps/srm/deployment',name),path.join(shallow,'apps/srm/deployment',name))
  const git=args=>execFileSync('git',args,{cwd:shallow,stdio:'pipe'})
  git(['init','--initial-branch=main']);git(['-c','user.name=PILOT2 fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','isolated shallow fixture'])
  assert.throws(()=>verifyBaselineArchive(shallow),/Full history/)
  fs.writeFileSync(path.join(shallow,'.git/shallow'),git(['rev-parse','HEAD']))
  const proof=prepareBaseline(shallow,target,path.join(root,'output'))
  assert.equal(proof.sourceArchive.historicalGitVerified,false)
  assert.deepEqual(proof.changedFiles,['apps/srm/src/server/runtime-environment.ts'])
  const archive=path.join(shallow,'apps/srm/deployment/pilot2-staging-source.tar.gz')
  fs.appendFileSync(archive,'tamper');assert.throws(()=>verifyBaselineArchive(shallow),/integrity mismatch/)
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})

