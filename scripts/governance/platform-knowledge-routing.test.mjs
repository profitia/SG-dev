import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {resolveProjectProfile} from './project-profile.mjs'
import {resolveProjectRouting} from './routing-engine.mjs'
import {validateGovernanceManifest} from './validate-governance-manifest.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const baseline='d88adf594dfa51cd2011c2567dfc5f6506f6ffc1'
const registry='Canon/registries/current-architecture-baseline-v1.json'
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
const previous=p=>JSON.parse(execFileSync('git',['show',baseline+':'+p],{cwd:root,encoding:'utf8'}))
const targets=['apps/platform-knowledge-runtime/src/server.mjs','packages/platform-knowledge-contracts/src/index.mjs','packages/platform-knowledge-core/src/index.mjs','.github/workflows/platform-knowledge-ci.yml']
const route=(profile,paths,repositoryRoot=root)=>resolveProjectRouting({profile:resolveProjectProfile(profile,root),targets:paths,repositoryRoot})

test('Platform Knowledge adds exactly four owner-scoped routes without changing prior authority',()=>{
 const before=previous(registry),after=json(registry)
 const {surfaces:a,...oldMeta}=before,{surfaces:b,...newMeta}=after
 assert.deepEqual(newMeta,oldMeta)
 for(const row of before.surfaces)assert.deepEqual(after.surfaces.find(s=>s.id===row.id),row)
 assert.equal(after.surfaces.length,before.surfaces.length+4)
 const result=route('ARCHITECTURE',targets);assert.equal(result.ok,true,result.error)
 assert.deepEqual(result.results.map(r=>r.matchedSurfaceId),[1,2,3,4].map(i=>'PK-BASE-00'+i))
 assert(result.results.every(r=>r.currentOwner==='Architecture Platform'&&r.baselineClassification==='ALIGNED'&&r.highestSpecificityMatchCount===1))
 for(const profile of ['SG2','SRM'])assert.equal(route(profile,targets).ok,false)
})

test('Platform Knowledge does not admit neighbouring paths, consumer source or traversal',()=>{
 for(const p of ['apps/platform-knowledge-runtime-copy/src/main.mjs','packages/platform-knowledge-ui/index.mjs','packages/platform-knowledge-contract/index.mjs','.github/workflows/platform-knowledge-release.yml','.github/workflows/platform-knowledge-ci.yml.extra','apps/platform-knowledge-runtime/../../sg-runtime/x.mjs','apps/sg-runtime/lib/assistant/runtime.ts','apps/srm/src/server/server.ts'])assert.equal(route('ARCHITECTURE',[p]).ok,false,p)
})

test('Platform Knowledge refuses pre-onboarding and conflicting ownership',t=>{
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'pk-routing-'))
 t.after(()=>fs.rmSync(scratch,{recursive:true,force:true}))
 const file=path.join(scratch,registry);fs.mkdirSync(path.dirname(file),{recursive:true})
 fs.writeFileSync(file,JSON.stringify(previous(registry)))
 assert.equal(route('ARCHITECTURE',targets,scratch).ok,false)
 const conflict=json(registry)
 conflict.surfaces.push({...conflict.surfaces.find(r=>r.id==='PK-BASE-001'),id:'PK-CONFLICT-TEST',currentOwner:'Other owner'})
 fs.writeFileSync(file,JSON.stringify(conflict))
 const result=route('ARCHITECTURE',[targets[0]],scratch)
 assert.equal(result.ok,false);assert.equal(result.results[0].resolutionStatus,'CONFLICT')
})

test('Platform Knowledge onboarding preserves existing resources and cannot create runtime grants',()=>{
 const before=previous('Canon/registries/architecture-onboarding-v1.json'),after=json('Canon/registries/architecture-onboarding-v1.json')
 const {plannedModules:a,...oldMeta}=before,{plannedModules:b,...newMeta}=after
 assert.deepEqual(newMeta,oldMeta)
 for(const row of before.plannedModules)assert.deepEqual(after.plannedModules.find(r=>r.capability===row.capability),row)
 assert.equal(after.plannedModules.length,before.plannedModules.length+1)
 const pk=after.plannedModules.find(r=>r.capability==='Platform Knowledge')
 assert.equal(pk.owner,'Architecture Platform');assert.equal(pk.projectKey,'ARCHITECTURE')
 assert.equal(pk.approval.resourceCreationAuthorized,false);assert.equal(pk.approval.administrativeGrantsAuthorized,false)
 assert.equal(pk.runtimeCreated,false);assert.equal(pk.stagingProductionAuthority,'NONE')
 assert.equal(pk.developmentStorage.neonProjectId,null);assert.equal(pk.developmentRender.apiServiceId,null)
 const validation=validateGovernanceManifest(root);assert.equal(validation.valid,true,validation.errors.join('; '))
 const document=validation.activeDocuments.find(d=>d.id==='platform-knowledge-development-foundation')
 for(const id of document.dependsOn)assert(validation.activeDocuments.find(d=>d.id===id).loadOrder<document.loadOrder)
})
