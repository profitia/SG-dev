import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {isDeepStrictEqual} from 'node:util'
import {resolveProjectProfile} from './project-profile.mjs'
import {resolveProjectRouting} from './routing-engine.mjs'
import {validateGovernanceManifest} from './validate-governance-manifest.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const approved='3a1b98b287c09844b8c9064c3ecae1830b4e3fc3'
const baseline='1cc5282c718ab1ce85fa9da4831592739c0ff899'
const registryPath='Canon/registries/current-architecture-baseline-v1.json'
const activePath='Canon/v1.1-economic-calendar-runtime-source-hub-and-preferences-amendment.md'
const read=p=>fs.readFileSync(path.join(root,p),'utf8')
const json=p=>JSON.parse(read(p))
const prior=(ref,p)=>execFileSync('git',['show',ref+':'+p],{cwd:root,encoding:'utf8'})
const hash=s=>createHash('sha256').update(s).digest('hex')
const proposal=JSON.parse(prior(approved,'Canon/proposals/economic-calendar-runtime-source-hub-g1-v1.json'))
const targets=['apps/economic-calendar-runtime/src/main.mjs','packages/economic-calendar-contracts/index.mjs','.github/workflows/economic-calendar-ci.yml']
const route=(project,paths,repositoryRoot=root)=>resolveProjectRouting({profile:resolveProjectProfile(project,root),targets:paths,repositoryRoot})

// ECR preserves prior authority; later governed canon versions may retain it
// through explicit immutable history rather than freezing the whole registry.
function assertManifestHistoryPreserved(previous,current,currentText=read,previousText=p=>prior(baseline,p)){
 for(const old of previous){
  const next=current.find(d=>d.id===old.id)
  assert(next,`Prior document ID missing: ${old.id}`)
  if(isDeepStrictEqual(next,old))continue
  assert.equal(old.status,'ACTIVE');assert.equal(next.status,'ACTIVE')
  assert.notEqual(next.version,old.version);assert.notEqual(next.path,old.path)
  for(const key of ['owner','appliesTo','dependsOn','loadOrder'])assert.deepEqual(next[key],old[key])
  const historical=current.find(d=>d.path===old.path&&d.version===old.version&&d.status==='SUPERSEDED'&&d.supersededBy===old.id)
  assert(historical,`Immutable superseded entry required: ${old.id}`)
  const {supersededBy,...payload}=historical
  assert.deepEqual({...payload,id:old.id,status:old.status,loadOrder:old.loadOrder},old)
  assert.equal(currentText(old.path),previousText(old.path),`Historical bytes changed: ${old.path}`)
 }
}

test('later canon succession preserves history, owner and dependencies without weakening ECR authority',()=>{
 const old={id:'prior-canon',version:'1.0',path:'Canon/prior.md',status:'ACTIVE',loadOrder:100,owner:'Original owner',appliesTo:['ARCHITECTURE'],dependsOn:['earlier-canon']}
 const next={...old,version:'2.0',path:'Canon/current.md'}
 const historical={...old,id:'prior-canon-v1',status:'SUPERSEDED',loadOrder:null,supersededBy:old.id}
 const unchanged=()=> 'exact historical bytes'
 assertManifestHistoryPreserved([old],[next,historical],unchanged,unchanged)
 assert.throws(()=>assertManifestHistoryPreserved([old],[next],unchanged,unchanged))
 assert.throws(()=>assertManifestHistoryPreserved([old],[{...next,owner:'Other owner'},historical],unchanged,unchanged))
 assert.throws(()=>assertManifestHistoryPreserved([old],[next,{...historical,dependsOn:[]}],unchanged,unchanged))
 assert.throws(()=>assertManifestHistoryPreserved([old],[next,historical],()=> 'modified history',unchanged))
})

test('ECR exact owner-approved rows preserve prior authority and only admit Architecture',()=>{
 const before=JSON.parse(prior(baseline,registryPath)),current=json(registryPath)
 for(const old of before.surfaces)assert.deepEqual(current.surfaces.find(s=>s.id===old.id),old)
 const {surfaces:a,...oldMeta}=before,{surfaces:b,...newMeta}=current
 assert.deepEqual(newMeta,oldMeta)
 assert.deepEqual(current.cleanupFindings,before.cleanupFindings)
 for(const expected of proposal.proposedSurfaces){
  const row=current.surfaces.find(s=>s.id===expected.id)
  const {classificationReferenceSha,onboardingAuthorization,...payload}=row
  assert.deepEqual(payload,expected)
  assert.equal(classificationReferenceSha,baseline)
  assert(onboardingAuthorization.includes('G1 GRANTED: explicit owner'))
  assert(onboardingAuthorization.includes(approved))
 }
 const r=route('ARCHITECTURE',targets)
 assert.equal(r.ok,true,r.error)
 assert.deepEqual(r.results.map(x=>x.matchedSurfaceId),proposal.proposedSurfaces.map(x=>x.id))
 assert(r.results.every(x=>x.currentOwner==='Architecture Platform'&&x.baselineClassification==='ALIGNED'&&x.highestSpecificityMatchCount===1))
 for(const project of ['SG2','SRM']){
  const denied=route(project,targets);assert.equal(denied.ok,false)
  assert(denied.results.every(x=>x.projectBoundaryStatus==='DENIED'))
 }
})

test('ECR siblings, UI, deployment workflows and traversal remain unregistered',()=>{
 for(const p of ['apps/economic-calendar-runtime-copy/src/main.mjs','packages/economic-calendar-ui/index.mjs','packages/economic-calendar-contract/index.mjs','.github/workflows/economic-calendar-deploy.yml','.github/workflows/economic-calendar-ci.yml.extra','apps/economic-calendar-runtime/../../srm/x.mjs'])assert.equal(route('ARCHITECTURE',[p]).ok,false,p)
 assert.equal(route('ARCHITECTURE',['apps/sg-runtime/app/page.tsx']).ok,false)
 assert.equal(route('ARCHITECTURE',['apps/srm/src/server/server.ts']).ok,false)
})

test('pre-G1 and equal-specificity conflicting authority fail closed',t=>{
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'ecr-g1-routing-'))
 t.after(()=>fs.rmSync(scratch,{recursive:true,force:true}))
 const file=path.join(scratch,registryPath);fs.mkdirSync(path.dirname(file),{recursive:true})
 fs.writeFileSync(file,prior(baseline,registryPath))
 const absent=route('ARCHITECTURE',targets,scratch)
 assert.equal(absent.ok,false);assert(absent.results.every(x=>x.resolutionStatus==='NO_MATCH'))
 const conflict=json(registryPath)
 conflict.surfaces.push({...conflict.surfaces.find(s=>s.id==='ECR-BASE-001'),id:'ECR-CONFLICT-FIXTURE',currentOwner:'Other fixture owner'})
 fs.writeFileSync(file,JSON.stringify(conflict))
 const denied=route('ARCHITECTURE',[targets[0]],scratch)
 assert.equal(denied.ok,false);assert.equal(denied.results[0].resolutionStatus,'CONFLICT')
})

test('accepted ECR vision and amendment business sections preserve exact approved bytes',()=>{
 const original=read(proposal.originalVision.path)
 assert.equal(hash(original),proposal.originalVision.sha256)
 assert.equal(original,prior(proposal.originalVision.commit,proposal.originalVision.path))
 assert.equal(read('Canon/proposals/economic-calendar-runtime-source-hub-g1-v1.json'),prior(approved,'Canon/proposals/economic-calendar-runtime-source-hub-g1-v1.json'))
 assert.equal(read(proposal.amendment),prior(approved,proposal.amendment))
 const segment=(s,a,b)=>s.slice(s.indexOf(a),b?s.indexOf(b):undefined)
 for(const [a,b] of [['## 1. One acquisition owner','## 6. Source approval'],['## 7. Acceptance and observability',null]])assert.equal(segment(read(activePath),a,b),segment(prior(approved,proposal.amendment),a,b))
 assert.match(read(activePath),/OWNER APPROVED \/ G1 GRANTED/)
 assert.match(read(activePath),/this accepted v1\.1 amendment supplies the current G1/)
})

test('ECR activation appends one ordered document and one onboarding record without administrative authority',()=>{
 const oldManifest=JSON.parse(prior(baseline,'Canon/registries/governance-manifest-v2.json')),manifest=json('Canon/registries/governance-manifest-v2.json')
 assertManifestHistoryPreserved(oldManifest.documents,manifest.documents)
 const validation=validateGovernanceManifest(root);assert.equal(validation.valid,true,validation.errors.join('; '))
 const doc=validation.activeDocuments.find(d=>d.path===activePath)
 assert.equal(doc.owner,'Architecture Platform');assert.equal(doc.version,'1.1')
 for(const id of doc.dependsOn)assert(validation.activeDocuments.find(d=>d.id===id).loadOrder<doc.loadOrder)
 const oldOnboarding=JSON.parse(prior(baseline,'Canon/registries/architecture-onboarding-v1.json')),onboarding=json('Canon/registries/architecture-onboarding-v1.json')
 for(const old of oldOnboarding.plannedModules)assert.deepEqual(onboarding.plannedModules.find(m=>m.capability===old.capability),old)
 for(const [k,v] of Object.entries(oldOnboarding))if(k!=='plannedModules')assert.deepEqual(onboarding[k],v)
 const entry=onboarding.plannedModules.find(m=>m.capability==='Economic Calendar Runtime')
 assert.equal(entry.approval.decision,'G1 GRANTED');assert.equal(entry.approval.approvedCandidate,approved)
 assert.equal(entry.approval.resourceCreationAuthorized,false);assert.equal(entry.approval.administrativeGrantsAuthorized,false)
 assert.equal(entry.stagingProductionAuthority,'NONE');assert.equal(entry.continuityProjectKey,'ARCHITECTURE')
 const evidence=read(entry.evidenceDocument)
 assert(evidence.includes('Zatwierdzam propozycję i udzielam G1'))
 assert(evidence.includes('Zgoda nie obejmuje automatycznego tworzenia zasobów infrastrukturalnych ani nadawania grantów administracyjnych.'))
 assert(evidence.includes(approved))
})
