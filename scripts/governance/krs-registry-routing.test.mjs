import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {resolveProjectRouting} from './routing-engine.mjs'
import {resolveProjectProfile} from './project-profile.mjs'
import {validateRegistry} from '../architecture-classify.mjs'

// Candidate onboarding is exercised only in disposable registries. This test
// neither registers a module nor supplies owner approval or live E1 authority.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const evidence=JSON.parse(fs.readFileSync(path.join(root,'Canon/evidence/2026-10-22-krs-registry-foundation.json'),'utf8'))
const registryPath='Canon/registries/current-architecture-baseline-v1.json'
const original=JSON.parse(execFileSync('git',['show',`${evidence.authoritySha}:${registryPath}`],{cwd:root,encoding:'utf8'}))
const candidates=evidence.onboardingProposal.surfaces
const targets=['apps/krs-registry-runtime/src/server.mjs','packages/krs-registry-contracts/src/index.mjs','.github/workflows/krs-registry-ci.yml']
const fixture=(fn,{candidate=true}={})=>{
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'krs-routing-'))
 try{
  const registry=structuredClone(original)
  if(candidate)registry.surfaces.push(...structuredClone(candidates))
  const file=path.join(scratch,registryPath);fs.mkdirSync(path.dirname(file),{recursive:true})
  const save=()=>fs.writeFileSync(file,JSON.stringify(registry))
  save()
  return fn({registry,save,resolve:(project,paths)=>resolveProjectRouting({profile:resolveProjectProfile(project,root),targets:paths,repositoryRoot:scratch})})
 }finally{fs.rmSync(scratch,{recursive:true,force:true})}
}

test('unaccepted authority baseline refuses all proposed application paths',()=>fixture(({resolve})=>{
 const r=resolve('ARCHITECTURE',targets);assert.equal(r.ok,false)
 assert.ok(r.results.every(x=>x.resolutionStatus==='NO_MATCH'))
},{candidate:false}))
test('proposal remains explicitly unauthorised and carries no fabricated approval',()=>{
 assert.equal(evidence.onboardingProposal.status,'SIMULATION_ONLY_NOT_ACTIVE_ROUTING')
 assert.equal(evidence.approval.formalApprovalId,null)
 assert.ok(candidates.every(s=>s.onboardingAuthorization===null))
})
test('three proposed exact routes resolve uniquely to Architecture in simulation',()=>fixture(({resolve,registry})=>{
 assert.equal(validateRegistry(registry).valid,true)
 const r=resolve('ARCHITECTURE',targets);assert.equal(r.ok,true)
 assert.deepEqual(r.results.map(x=>x.matchedSurfaceId),['KRS-BASE-001','KRS-BASE-002','KRS-BASE-003'])
 assert.ok(r.results.every(x=>x.currentOwner==='Architecture Platform'&&x.projectBoundaryStatus==='ALLOWED'))
}))
test('consumer profiles cannot mutate producer routes',()=>fixture(({resolve})=>{
 for(const p of ['SRM','SG2']){
  const r=resolve(p,targets);assert.equal(r.ok,false)
  assert.ok(r.results.every(x=>x.projectBoundaryStatus==='DENIED'))
 }
}))
test('new routes do not admit sibling applications or workflows',()=>fixture(({resolve})=>{
 for(const p of ['apps/krs-registry-runtime-copy/index.mjs','packages/krs-registry-contract/index.mjs','.github/workflows/krs-registry-deploy.yml']){
  const r=resolve('ARCHITECTURE',[p]);assert.equal(r.ok,false)
  assert.equal(r.results[0].resolutionStatus,'NO_MATCH')
 }
}))
test('existing owner rows and epoch/reference fields are byte-semantically preserved',()=>fixture(({registry,resolve})=>{
 assert.deepEqual(registry.surfaces.slice(0,original.surfaces.length),original.surfaces)
 for(const k of ['classificationReferenceSha','transitionalEpochStartSha','transitionalPolicyActive'])assert.deepEqual(registry[k],original[k])
 assert.equal(resolve('SRM',['apps/srm/src/server/supplier-location-sync.ts']).ok,true)
 assert.equal(resolve('ARCHITECTURE',['apps/srm/src/server/supplier-location-sync.ts']).ok,false)
 assert.equal(resolve('SRM',['packages/platform-contracts/src/supplier-location.mjs']).ok,false)
}))
test('equal-specificity conflicting proposal fails closed',()=>fixture(({registry,save,resolve})=>{
 registry.surfaces.push({...structuredClone(candidates[0]),id:'KRS-CONFLICT-FIXTURE',currentOwner:'Conflicting test owner'})
 save();assert.equal(resolve('ARCHITECTURE',[targets[0]]).ok,false)
}))
test('path traversal cannot escape proposed producer scope',()=>fixture(({resolve})=>{
 assert.equal(resolve('ARCHITECTURE',['apps/krs-registry-runtime/../../srm/src/server.ts']).ok,false)
}))
