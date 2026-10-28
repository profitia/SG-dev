import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import test from 'node:test'
import {resolveProjectProfile} from './project-profile.mjs'
import {resolveProjectRouting} from './routing-engine.mjs'
import {validateGovernanceManifest} from './validate-governance-manifest.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const registry='Canon/registries/current-architecture-baseline-v1.json'
const beforeSha='acbc37b278a16a9e4c47f794e3eb7577d42f21d6'
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
const before=JSON.parse(execFileSync('git',['show',beforeSha+':'+registry],{cwd:root,encoding:'utf8'}))
const route=(project,targets)=>resolveProjectRouting({profile:resolveProjectProfile(project,root),targets,repositoryRoot:root})
const targets=['packages/srm-adp-ui/package.json','packages/srm-adp-ui/src/index.ts','packages/srm-adp-ui/src/AdpWorkspace.tsx','.github/workflows/srm-adp-ui-ci.yml']

test('ADP public presentation and exact offline CI belong only to existing SRM owner',()=>{
 const r=route('SRM',targets);assert.equal(r.ok,true,r.error)
 for(const x of r.results){assert.equal(x.resolutionStatus,'RESOLVED');assert.equal(x.highestSpecificityMatchCount,1);assert.equal(x.currentOwner,'SRM Runtime');assert.equal(x.baselineClassification,'ALIGNED');assert.deepEqual(x.allowedProjectKeys,['SRM']);assert.equal(x.projectBoundaryStatus,'ALLOWED')}
 assert.equal(r.results[0].matchedSurfaceId,'SRM-ADP-BASE-001');assert.equal(r.results[3].matchedSurfaceId,'SRM-ADP-BASE-002')
})

test('host and Architecture cannot mutate SRM UI; SRM cannot mutate the SG2 host',()=>{
 for(const project of ['SG2','ARCHITECTURE'])for(const target of targets){const r=route(project,[target]);assert.equal(r.ok,false);assert.equal(r.results[0].projectBoundaryStatus,'DENIED')}
 assert.equal(route('SRM',['apps/sg-runtime/components/appshell/adp-module.tsx']).ok,false)
 assert.equal(route('SG2',['apps/sg-runtime/components/appshell/adp-module.tsx']).ok,true)
 assert.equal(route('ARCHITECTURE',['apps/identity-runtime/package.json']).ok,true)
})

test('additive onboarding preserves all existing owners and classification metadata',()=>{
 const current=read(registry);const byId=new Map(current.surfaces.map(s=>[s.id,s]))
 for(const old of before.surfaces)assert.deepEqual(byId.get(old.id),old,old.id)
 for(const [key,value]of Object.entries(before))if(key!=='surfaces')assert.deepEqual(current[key],value,key)
 for(const id of ['SRM-ADP-BASE-001','SRM-ADP-BASE-002']){assert(!before.surfaces.some(s=>s.id===id));assert.equal(byId.get(id).classificationReferenceSha,beforeSha)}
})

test('misspelled/sibling UI paths and neighboring workflow remain fail-closed',()=>{
 for(const p of ['packages/srm-adp-uis/package.json','packages/srm-adp-ui-private/package.json','packages/srm-adp/package.json','../packages/srm-adp-ui/package.json'])assert.equal(route('SRM',[p]).ok,false,p)
 assert.notEqual(route('SRM',['.github/workflows/srm-adp-ui-ci.yml.extra']).results[0]?.matchedSurfaceId,'SRM-ADP-BASE-002')
 assert.equal(route('SRM',['packages/srm-xray/src/index.ts']).results[0].matchedSurfaceId,'SRM-BASE-001')
})

test('active manifest binds a bounded presentation amendment, not a service activation',()=>{
 const m=validateGovernanceManifest(root);assert.equal(m.valid,true,m.errors.join('\n'))
 const d=m.activeDocuments.find(d=>d.id==='srm-adp-presentation-mounting-amendment');assert(d);assert.deepEqual(d.appliesTo,['SG2','SRM','ARCHITECTURE'])
 const source=fs.readFileSync(path.join(root,d.path),'utf8')
 for(const text of ['NATIVE VIEW','PRESENTATION_ONLY / LOCAL_STATE','/pl/dashboard','/[locale]/account','no Screen Context','No private `apps/srm/**` import','OWNER_APPROVED / MAIN_ACCEPTANCE_PENDING','does not authorize skipping CI, automatic merge or product deployment'])assert(source.includes(text),text)
 const priorTree=execFileSync('git',['ls-tree',beforeSha,'--','packages/srm-adp-ui','.github/workflows/srm-adp-ui-ci.yml'],{cwd:root,encoding:'utf8'});assert.equal(priorTree,'')
})
