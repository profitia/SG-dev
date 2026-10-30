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

// Historical and conflict fixtures remain disposable. Actual current routes
// are also tested below; source registration does not grant live E1 authority.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const evidence=JSON.parse(fs.readFileSync(path.join(root,'Canon/evidence/2026-10-22-krs-registry-g1-onboarding.json'),'utf8'))
const registryPath='Canon/registries/current-architecture-baseline-v1.json'
const original=JSON.parse(execFileSync('git',['show',`${evidence.authoritySha}:${registryPath}`],{cwd:root,encoding:'utf8'}))
const candidates=evidence.registeredSurfaces
const targets=['apps/krs-registry-runtime/src/server.mjs','packages/krs-registry-contracts/src/index.mjs','.github/workflows/krs-registry-ci.yml']
// This immutable acceptance checkpoint predates TASK02 source creation. Git
// failures must fail the test; only a successful empty tree listing is absence.
const g1Checkpoint='0ad9525f1397d41b965787fb487492a713ba0e54'
const implementationPaths=['apps/krs-registry-runtime','packages/krs-registry-contracts',targets[2]]
function inspectCheckpoint(repositoryRoot,checkpoint){
 assert.match(checkpoint,/^[a-f0-9]{40}$/)
 const git=args=>execFileSync('git',args,{cwd:repositoryRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']})
 const commit=git(['rev-parse','--verify',`${checkpoint}^{commit}`]).trim()
 assert.equal(commit,checkpoint,'Checkpoint must identify the exact commit')
 const tree=git(['rev-parse','--verify',`${commit}^{tree}`]).trim()
 assert.match(tree,/^[a-f0-9]{40}$/)
 const present=git(['ls-tree','--full-tree','--name-only','-z',tree,'--',...implementationPaths]).split('\0').filter(Boolean)
 assert.ok(present.every(p=>implementationPaths.includes(p)),'Unexpected Git tree output')
 return {commit,tree,present}
}
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
test('G1 is the actual human owner approval without invented host identity or activation',()=>{
 assert.equal(evidence.approval.decision,'G1 GRANTED')
 assert.equal(evidence.approval.sourceType,'EXPLICIT_OWNER_CHAT_INSTRUCTION')
 assert.equal(evidence.approval.hostConversationId,null)
 assert.match(evidence.ownerInstruction,/DECISION: G1 — GRANTED/)
 assert.ok(candidates.every(s=>s.onboardingAuthorization.startsWith('G1 GRANTED:')))
 for(const value of Object.values(evidence.sourceOnly))assert.equal(value,false)
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

const current=JSON.parse(fs.readFileSync(path.join(root,registryPath),'utf8'))
// The G1 receipt is immutable history. Later approved capabilities may extend
// today's registry, but every accepted KRS-era row must remain unchanged.
const acceptedRegistry=JSON.parse(execFileSync('git',['show',`${g1Checkpoint}:${registryPath}`],{cwd:root,encoding:'utf8'}))
const activeRoute=(project,paths)=>resolveProjectRouting({profile:resolveProjectProfile(project,root),targets:paths,repositoryRoot:root})
test('accepted KRS checkpoint adds exactly three routes and current registry preserves every accepted row and metadata',()=>{
 const oldIds=new Set(original.surfaces.map(s=>s.id))
 assert.deepEqual(acceptedRegistry.surfaces.filter(s=>oldIds.has(s.id)),original.surfaces)
 assert.deepEqual(acceptedRegistry.surfaces.filter(s=>!oldIds.has(s.id)),candidates)
 const active=new Map(current.surfaces.map(s=>[s.id,s]))
 for(const row of acceptedRegistry.surfaces)assert.deepEqual(active.get(row.id),row)
 const {surfaces:ignoredOld,...oldMeta}=original,{surfaces:ignoredNew,...newMeta}=current
 assert.deepEqual(newMeta,oldMeta)
 const r=activeRoute('ARCHITECTURE',targets);assert.equal(r.ok,true,r.error)
 assert.deepEqual(r.results.map(x=>x.matchedSurfaceId),['KRS-BASE-001','KRS-BASE-002','KRS-BASE-003'])
 for(const x of r.results){assert.equal(x.highestSpecificityMatchCount,1);assert.equal(x.currentOwner,'Architecture Platform');assert.equal(x.baselineClassification,'ALIGNED');assert.deepEqual(x.allowedProjectKeys,['ARCHITECTURE'])}
 for(const project of ['SRM','SG2'])for(const p of targets)assert.equal(activeRoute(project,[p]).ok,false)
 for(const row of current.surfaces.filter(s=>s.id.startsWith('KRS-BASE-')))assert.equal(row.classificationReferenceSha,evidence.authoritySha)
})
test('active onboarding preserves physical resources and earlier planned modules with zero activation authority',()=>{
 const p='Canon/registries/architecture-onboarding-v1.json',now=JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
 const before=JSON.parse(execFileSync('git',['show',`${evidence.authoritySha}:${p}`],{cwd:root,encoding:'utf8'}))
 const {plannedModules:oldModules,...oldPhysical}=before,{plannedModules,...physical}=now
 // Check the immutable KRS acceptance against its actual predecessor. Current
 // approved capabilities may extend the list, but cannot rewrite accepted rows.
 const accepted=JSON.parse(execFileSync('git',['show',`${g1Checkpoint}:${p}`],{cwd:root,encoding:'utf8'}))
 const {plannedModules:acceptedModules,...acceptedPhysical}=accepted
 assert.deepEqual(acceptedPhysical,oldPhysical);assert.deepEqual(physical,acceptedPhysical)
 assert.deepEqual(acceptedModules.slice(0,oldModules.length),oldModules)
 assert.equal(acceptedModules.length,oldModules.length+1)
 for(const module of acceptedModules)assert.deepEqual(plannedModules.find(m=>m.capability===module.capability),module)
 assert.equal(new Set(plannedModules.map(m=>m.capability)).size,plannedModules.length)
 const k=acceptedModules.at(-1)
 assert.equal(k.capability,'KRS Registry');assert.equal(k.owner,'Architecture Platform');assert.equal(k.projectKey,'ARCHITECTURE')
 assert.equal(k.pathPattern,'apps/krs-registry-runtime/**');assert.equal(k.contractsPath,'packages/krs-registry-contracts/**');assert.equal(k.ciPath,targets[2]);assert.deepEqual(k.approval,evidence.approval)
 assert.equal(k.runtimeCreated,false);assert.equal(k.plannedRender.serviceId,null);assert.equal(k.plannedRender.createOrDeployAuthorized,false);assert.equal(k.catalogStorage.projectId,null)
 assert.equal(k.activation,'DEFERRED');assert.equal(k.synchronization,'DISABLED');assert.match(k.financialAdmissionInvariant,/KRS and NIP reconciliation/)
 for(const key of ['resourceCreationAuthority','deploymentAuthority','productDatabaseMutationAuthority','e1GrantExpansionAuthority'])assert.equal(k[key],'NOT_AUTHORIZED_BY_G1')
 const checkpoint=inspectCheckpoint(root,g1Checkpoint)
 assert.deepEqual(checkpoint.present,[],'Accepted G1/TASK01B Git tree must contain no KRS implementation')
})
test('historical inspection distinguishes absent paths from invalid objects and unrelated Git failure',()=>{
 assert.deepEqual(inspectCheckpoint(root,g1Checkpoint).present,[])
 assert.throws(()=>inspectCheckpoint(root,'f'.repeat(40)))
 assert.throws(()=>inspectCheckpoint(root,'main'))
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'krs-no-repository-'))
 try{assert.throws(()=>inspectCheckpoint(scratch,g1Checkpoint))}finally{fs.rmSync(scratch,{recursive:true,force:true})}
})
test('historical absence remains true after present-day implementation paths are created',()=>{
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'krs-checkpoint-'))
 const git=args=>execFileSync('git',args,{cwd:scratch,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 const commit=()=>git(['-c','user.name=KRS fixture','-c','user.email=krs-fixture@example.invalid','-c','commit.gpgsign=false','commit','--allow-empty','-m','Synthetic historical checkpoint'])
 try{
  git(['init','--quiet']);commit();const before=git(['rev-parse','HEAD'])
  assert.deepEqual(inspectCheckpoint(scratch,before).present,[])
  for(const [i,p]of implementationPaths.entries()){
   const file=path.join(scratch,i===2?p:`${p}/fixture.mjs`)
   fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'// Synthetic source fixture, no runtime or cloud effect\n')
  }
  git(['add','--',...implementationPaths]);commit();const after=git(['rev-parse','HEAD'])
  assert.deepEqual(inspectCheckpoint(scratch,after).present.sort(),[...implementationPaths].sort())
  assert.deepEqual(inspectCheckpoint(scratch,before).present,[])
 }finally{fs.rmSync(scratch,{recursive:true,force:true})}
})
test('present source still requires the current accepted exact owner routes',()=>{
 for(let i=0;i<implementationPaths.length;i++)if(fs.existsSync(path.join(root,implementationPaths[i]))){
  const result=activeRoute('ARCHITECTURE',[targets[i]])
  assert.equal(result.ok,true,result.error);assert.equal(result.results[0].currentOwner,'Architecture Platform')
  for(const consumer of ['SRM','SG2'])assert.equal(activeRoute(consumer,[targets[i]]).ok,false)
 }
 fixture(({resolve})=>{assert.equal(resolve('ARCHITECTURE',targets).ok,false)},{candidate:false})
})
test('accepted manifest adds only G1 and current manifest preserves its accepted rows and dependencies',()=>{
 const p='Canon/registries/governance-manifest-v2.json',m=JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
 const before=JSON.parse(execFileSync('git',['show',`${evidence.authoritySha}:${p}`],{cwd:root,encoding:'utf8'}))
 const accepted=JSON.parse(execFileSync('git',['show',`${g1Checkpoint}:${p}`],{cwd:root,encoding:'utf8'}))
 const doc=accepted.documents.find(d=>d.id==='krs-registry-architecture-and-ownership')
 assert.equal(doc.status,'ACTIVE');assert.equal(doc.owner,'Architecture Platform');assert.equal(doc.loadOrder,370)
 assert.deepEqual(doc.appliesTo,['SG2','SRM','ARCHITECTURE'])
 assert.deepEqual(accepted.documents.filter(d=>d.id!==doc.id),before.documents)
 const graph=new Map(m.documents.map(d=>[d.id,d]))
 // G1 is immutable history; later registrations must preserve every accepted
 // row rather than make today's entire manifest equal to the old snapshot.
 for(const row of accepted.documents)assert.deepEqual(graph.get(row.id),row)
 for(const id of doc.dependsOn){assert.ok(graph.get(id).status.startsWith('ACTIVE'));assert.ok(graph.get(id).loadOrder<doc.loadOrder)}
})
test('original published foundation evidence is unchanged and governance CI executes the KRS regression',()=>{
 for(const p of evidence.historicalFoundationFiles)assert.deepEqual(fs.readFileSync(path.join(root,p)),execFileSync('git',['show',`${evidence.priorFoundationSha}:${p}`],{cwd:root}))
 const s=fs.readFileSync(path.join(root,'.github/workflows/governance-preflight.yml'),'utf8')
 assert.match(s,/node --test .*scripts\/governance\/krs-registry-routing\.test\.mjs/)
 assert.doesNotMatch(s,/render deploy|workflow_dispatch|secrets\./)
})
