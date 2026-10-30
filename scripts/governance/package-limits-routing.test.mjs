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
const base='9e164df67e6e356975ad7b4f572abc5bef407f3d'
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
const before=p=>JSON.parse(execFileSync('git',['show',base+':'+p],{cwd:root,encoding:'utf8'}))
const route=(key,targets)=>resolveProjectRouting({profile:resolveProjectProfile(key,root),targets,repositoryRoot:root})
const targets=['apps/package-limits/package.json','apps/package-limits/src/server.ts','.github/workflows/package-limits-ci.yml']
test('Limits application and exact CI route exclusively to Architecture Platform',()=>{
 const r=route('ARCHITECTURE',targets);assert.equal(r.ok,true)
 for(const item of r.results){assert.equal(item.currentOwner,'Architecture Platform');assert.equal(item.baselineClassification,'ALIGNED');assert.equal(item.projectBoundaryStatus,'ALLOWED')}
 for(const key of ['SG2','SRM'])assert.equal(route(key,targets).ok,false)
})
test('Limits registration never captures neighboring apps, workflow suffixes or traversal',()=>{
 for(const p of ['apps/package-limit/package.json','apps/package-limits-other/src/server.ts','.github/workflows/package-limits-ci.yml.extra','../apps/package-limits/package.json'])assert.equal(route('ARCHITECTURE',[p]).ok,false,p)
 assert.equal(route('ARCHITECTURE',['apps/sg-runtime/app/page.tsx']).ok,false)
 assert.equal(route('ARCHITECTURE',['apps/srm/src/server/server.ts']).ok,false)
})
test('G1 preserves every pre-existing route, classification and frozen metadata',()=>{
 const p='Canon/registries/current-architecture-baseline-v1.json',a=before(p),b=read(p),ids=new Set(['LIMITS-BASE-001','LIMITS-BASE-002'])
 assert.deepEqual(b.surfaces.filter(x=>!ids.has(x.id)),a.surfaces)
 const {surfaces:sa,...ma}=a,{surfaces:sb,...mb}=b;assert.deepEqual(mb,ma)
 assert.equal(b.surfaces.filter(x=>ids.has(x.id)).length,2)
 for(const s of a.surfaces)for(const pattern of s.pathPatterns){const p=pattern.endsWith('/**')?pattern.slice(0,-3)+'/routing-probe':pattern;assert(!ids.has(route('ARCHITECTURE',[p]).results[0]?.matchedSurfaceId))}
})
test('module binding uses only owner-existing Limits Development resources and own continuity',()=>{
 const p='Canon/registries/architecture-onboarding-v1.json',a=before(p),b=read(p),m=b.plannedModules.find(m=>m.capability==='Package & Limits Management')
 assert(m);assert.equal(m.owner,'Architecture Platform');assert.equal(m.projectKey,'ARCHITECTURE');assert.equal(m.targetEnvironment,'development');assert.equal(m.approval.decision,'G1 GRANTED');assert.equal(m.continuityProjectKey,'ARCHITECTURE')
 assert.equal(m.developmentRender.serviceId,'srv-dbi5at9srm7s73da7ol0');assert.equal(m.developmentRender.autoDeploy,false)
 assert.equal(m.developmentStorage.neonProjectId,'lingering-thunder-05075810');assert.equal(m.developmentStorage.branchId,'br-green-hall-b9s837k0');assert.equal(m.developmentStorage.databaseName,'neondb');assert.equal(m.stagingProductionAuthority,'NONE')
 b.plannedModules=b.plannedModules.filter(x=>x!==m);assert.deepEqual(b,a)
})
test('runbook is ordered after actual dependencies and business canons remain unchanged',()=>{
 const m=validateGovernanceManifest(root);assert.equal(m.valid,true,m.errors.join('\n'))
 const d=m.activeDocuments.find(x=>x.id==='package-limits-development-runbook');assert(d);assert.equal(d.owner,'Architecture Platform');assert.deepEqual(d.appliesTo,['ARCHITECTURE'])
 for(const dep of d.dependsOn)assert(m.activeDocuments.find(x=>x.id===dep).loadOrder<d.loadOrder)
 for(const p of ['Canon/v1.0-profitia-package-and-limits-management-canon.md','Canon/v1.1-profitia-package-and-limits-customer-lifecycle-addendum.md','Canon/registries/profitia-projects-v1.json','Canon/registries/architecture-environment-topology-v1.json'])assert.equal(fs.readFileSync(path.join(root,p),'utf8'),execFileSync('git',['show',base+':'+p],{cwd:root,encoding:'utf8'}))
})
