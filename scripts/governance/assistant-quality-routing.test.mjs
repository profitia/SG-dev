import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {resolveProjectProfile} from './project-profile.mjs'
import {resolveProjectRouting} from './routing-engine.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const base='d5bead649c3de7430c63e9fc1b64fc0b452e7a2a'
const registry='Canon/registries/current-architecture-baseline-v1.json'
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
const before=p=>JSON.parse(execFileSync('git',['show',base+':'+p],{cwd:root,encoding:'utf8'}))
const targets=['packages/assistant-quality-control/src/controller.mjs','.github/workflows/assistant-quality-repair.yml']
const route=(project,targets,repositoryRoot=root)=>resolveProjectRouting({profile:resolveProjectProfile(project,root),targets,repositoryRoot})
test('quality onboarding preserves existing authority and admits only two exact Architecture surfaces',()=>{
 const old=before(registry),now=read(registry)
 const {surfaces:a,...x}=old,{surfaces:b,...y}=now;assert.deepEqual(y,x)
 for(const row of a)assert.deepEqual(b.find(r=>r.id===row.id),row)
 assert.equal(b.length,a.length+2)
 const r=route('ARCHITECTURE',targets);assert.equal(r.ok,true,r.error)
 assert.deepEqual(r.results.map(x=>x.matchedSurfaceId),['AQC-BASE-001','AQC-BASE-002'])
 for(const p of ['SG2','SRM'])assert.equal(route(p,targets).ok,false)
 for(const p of ['packages/assistant-quality-control-copy/src/controller.mjs','.github/workflows/assistant-quality-release.yml','.github/workflows/assistant-quality-repair.yml.extra','apps/sg-runtime/lib/assistant/history.ts','packages/assistant-quality-control/../../apps/sg-runtime/x.ts'])assert.equal(route('ARCHITECTURE',[p]).ok,false,p)
})
test('quality routing rejects the old registry and conflicting ownership',t=>{
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'aqc-routing-'));t.after(()=>fs.rmSync(scratch,{recursive:true,force:true}))
 const p=path.join(scratch,registry);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(before(registry)))
 assert.equal(route('ARCHITECTURE',targets,scratch).ok,false)
 const r=read(registry);r.surfaces.push({...r.surfaces.find(x=>x.id==='AQC-BASE-001'),id:'AQC-CONFLICT',currentOwner:'Other owner'})
 fs.writeFileSync(p,JSON.stringify(r));assert.equal(route('ARCHITECTURE',[targets[0]],scratch).ok,false)
})
test('source onboarding creates no physical resource, data grant or stage2 authority',()=>{
 const p='Canon/registries/architecture-onboarding-v1.json',a=before(p),b=read(p)
 for(const row of a.plannedModules)assert.deepEqual(b.plannedModules.find(x=>x.capability===row.capability),row)
 const {plannedModules:c,...x}=a,{plannedModules:d,...y}=b;assert.deepEqual(y,x);assert.equal(d.length,c.length+1)
 const q=d.find(x=>x.capability==='Assistant Continuous Quality')
 assert.equal(q.approval.resourceCreationAuthorized,false);assert.equal(q.approval.administrativeGrantsAuthorized,false)
 assert.equal(q.runtimeCreated,false);assert.equal(q.developmentRender.serviceId,null);assert.equal(q.developmentStorage.projectId,null)
 assert.equal(q.stage2Authority,'NONE_UNTIL_EXPLICIT_OWNER_ORDER');assert.equal(q.stagingProductionAuthority,'NONE')
 assert.equal(q.modelBudget.totalUsd,50);assert.equal(q.modelBudget.automaticRenewal,false)
})
