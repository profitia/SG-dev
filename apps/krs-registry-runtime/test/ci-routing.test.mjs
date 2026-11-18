import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {partitionChangedPaths,projectForRoute,validateCandidate,validateOwnerGroups,validateGovernanceContext} from '../scripts/ci-routing.mjs'

const root=fileURLToPath(new URL('../../..',import.meta.url))
const arch='apps/krs-registry-runtime/scripts/ci-proof.mjs',srm='apps/srm/src/server/supplier-locations.ts',sg2='apps/sg-runtime/package-lock.json',maps='apps/maps-runtime/src/index.ts'

test('actual canonical owners cover Architecture-only and mixed owner candidates exactly once',()=>{
 assert.deepEqual(partitionChangedPaths([arch],root).groups,[{projectKey:'ARCHITECTURE',targets:[arch]}])
 const input=[arch,srm,sg2,maps,'Canon/evidence/owner.md','packages/platform-contracts/src/index.mjs']
 const result=partitionChangedPaths(input,root)
 assert.deepEqual(result.partition.map(p=>p.path),input)
 assert.deepEqual(result.partition.map(p=>p.projectKey),['ARCHITECTURE','SRM','SG2','SRM','ARCHITECTURE','ARCHITECTURE'])
 assert.deepEqual(result.groups.flatMap(g=>g.targets).sort(),[...input].sort())
 assert.deepEqual(result.groups.find(g=>g.projectKey==='ARCHITECTURE').targets,[arch,input[4],input[5]])
})

test('unknown paths, ambiguous shared owners, duplicates, traversal and non-exact paths fail closed',()=>{
 for(const input of [[],['README.md'],['render.yaml'],[arch,arch],['../apps/srm/file.ts'],['apps/srm/../identity-runtime/x'],['/apps/srm/x'],['apps\\srm\\x'],[' apps/srm/x'],['apps/srm//x'],['apps/srm/a\nb']]){
  assert.throws(()=>partitionChangedPaths(input,root),undefined,JSON.stringify(input))
 }
})

test('canonical registry conflicts, legacy and unknown project identities cannot be routed',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'identity-routing-registry-'))
 try{
  fs.mkdirSync(path.join(dir,'Canon/registries'),{recursive:true})
  for(const name of ['profitia-projects-v1.json','current-architecture-baseline-v1.json'])fs.copyFileSync(path.join(root,'Canon/registries',name),path.join(dir,'Canon/registries',name))
  const file=path.join(dir,'Canon/registries/current-architecture-baseline-v1.json'),registry=JSON.parse(fs.readFileSync(file))
  const target=registry.surfaces.find(s=>s.pathPatterns.includes('apps/krs-registry-runtime/**'))
  const original=structuredClone(target)
  target.baselineClassification='LEGACY';fs.writeFileSync(file,JSON.stringify(registry))
  assert.throws(()=>partitionChangedPaths([arch],dir),/Legacy/)
  Object.assign(target,original);registry.surfaces.push({...original,id:'DUPLICATE-OWNER',currentOwner:'Conflicting owner'})
  fs.writeFileSync(file,JSON.stringify(registry));assert.throws(()=>partitionChangedPaths([arch],dir))
  registry.surfaces.pop();target.allowedProjectKeys=['UNKNOWN'];fs.writeFileSync(file,JSON.stringify(registry))
  assert.throws(()=>partitionChangedPaths([arch],dir),/Unknown project/)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('a shared owner never overrides a canonical denied or ambiguous project boundary',()=>{
 const route={resolutionStatus:'RESOLVED',baselineClassification:'ALIGNED',highestSpecificityMatchCount:1,currentOwner:'Maps Capability',allowedProjectKeys:['SG2']}
 assert.throws(()=>projectForRoute(route))
 assert.throws(()=>projectForRoute({...route,allowedProjectKeys:['SRM','SG2'],highestSpecificityMatchCount:2}))
})

test('every actual project subgroup must execute its complete gate and any failure denies proof',()=>{
 const {groups}=partitionChangedPaths([arch,srm,sg2,maps],root),seen=[]
 const receipts=validateOwnerGroups({groups,runGovernance(project,targets){seen.push([project,targets]);return {verdict:'PASS',actualProject:project}}})
 assert.deepEqual(seen,groups.map(g=>[g.projectKey,g.targets]))
 assert.equal(receipts.length,3)
 for(const failing of ['ARCHITECTURE','SRM','SG2'])assert.throws(()=>validateOwnerGroups({groups,runGovernance(project){return {verdict:project===failing?'BLOCKED':'PASS'}}}),/governance failed/)
 assert.throws(()=>validateOwnerGroups({groups,runGovernance(){throw Error('canonical preflight exited nonzero')}}),/nonzero/)
})

test('real Git candidate and validation base remain exact; unknown, same or unrelated base and changed HEAD denied',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'identity-routing-git-'))
 const git=args=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try{
  git(['init','--quiet']);git(['config','user.name','Synthetic test']);git(['config','user.email','test@example.invalid'])
  git(['commit','--quiet','--allow-empty','-m','base']);const base=git(['rev-parse','HEAD'])
  git(['commit','--quiet','--allow-empty','-m','candidate']);const candidate=git(['rev-parse','HEAD'])
  assert.equal(validateCandidate({git,candidate,base}),candidate)
  for(const values of [{candidate:base,base},{candidate,base:candidate},{candidate,base:'f'.repeat(40)},{candidate,base:'main'}])assert.throws(()=>validateCandidate({git,...values}))
  git(['checkout','--orphan','unrelated']);git(['commit','--quiet','--allow-empty','-m','unrelated']);const unrelated=git(['rev-parse','HEAD']);git(['checkout',candidate])
  assert.throws(()=>validateCandidate({git,candidate,base:unrelated}))
  git(['commit','--quiet','--allow-empty','-m','head changed']);assert.throws(()=>validateCandidate({git,candidate,base}),/exact candidate/)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})


test('real source and merge checkouts retain artifact SHA while rejecting altered context, targets or refs',()=>{
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'krs-validation-context-')))
 const gitAt=cwd=>args=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try {
  const producer=path.join(temporary,'producer');fs.mkdirSync(producer)
  const git=gitAt(producer),target='owned-source.txt'
  git(['init','--quiet','--initial-branch=main']);git(['config','user.name','Isolated context fixture']);git(['config','user.email','context@example.invalid'])
  const commit=message=>git(['-c','commit.gpgsign=false','commit','--quiet','--allow-empty','-m',message])
  fs.writeFileSync(path.join(producer,target),'accepted predecessor');git(['add',target]);commit('base')
  const base=git(['rev-parse','HEAD'])
  git(['checkout','--quiet','-b','candidate']);fs.writeFileSync(path.join(producer,target),'exact source');git(['add',target]);commit('candidate')
  const candidate=git(['rev-parse','HEAD'])
  git(['checkout','--quiet','main']);fs.writeFileSync(path.join(producer,'authority.txt'),'separate accepted policy');git(['add','authority.txt']);commit('authority')
  const authority=git(['rev-parse','HEAD'])
  git(['-c','user.name=Isolated context fixture','-c','user.email=context@example.invalid','-c','commit.gpgsign=false','merge','--quiet','--no-ff','candidate','-m','Synthetic two-parent validation merge'])
  const validationSha=git(['rev-parse','HEAD'])
  for(const [name,sha]of [['source',candidate],['validation',validationSha]]) {
   git(['clone','--quiet','--shared',producer,path.join(temporary,name)])
   const current=gitAt(path.join(temporary,name));current(['checkout','--quiet','--detach',sha]);current(['remote','set-url','origin','https://github.com/profitia/SG-dev.git'])
  }
  const sourceGit=gitAt(path.join(temporary,'source')),contextGit=gitAt(path.join(temporary,'validation'))
  const input={sourceGit,contextGit,candidate,validationSha,requestedBase:base,event:'pull_request',changedPaths:[target]}
  assert.deepEqual(validateGovernanceContext(input),{candidateHeadSha:candidate,validationSha,baseSha:authority,requestedBaseSha:base})
  for(const change of [{candidate:base},{validationSha:candidate},{requestedBase:'main'},{changedPaths:[]},{changedPaths:[target,target]},{changedPaths:[target,'authority.txt']},{event:'pull_request_target'}])assert.throws(()=>validateGovernanceContext({...input,...change}))
  const contextFile=path.join(temporary,'validation',target)
  fs.appendFileSync(contextFile,'uncommitted drift');assert.throws(()=>validateGovernanceContext(input),/Clean independent/);contextGit(['checkout','--',target])
  const sourceFile=path.join(temporary,'source',target)
  fs.appendFileSync(sourceFile,'source drift');assert.throws(()=>validateGovernanceContext(input),/Clean independent/);sourceGit(['checkout','--',target])
  contextGit(['remote','set-url','origin','https://github.com/foreign/repository.git']);assert.throws(()=>validateGovernanceContext(input),/Canonical repository/)
  contextGit(['remote','set-url','origin','https://github.com/profitia/SG-dev.git'])
  // Keep the same two parents but change the merged target. Ancestry alone
  // must never grant authority to build or validate different source bytes.
  fs.writeFileSync(contextFile,'different merged target');contextGit(['add',target]);contextGit(['-c','user.name=Isolated context fixture','-c','user.email=context@example.invalid','-c','commit.gpgsign=false','commit','--quiet','--amend','--no-edit'])
  assert.throws(()=>validateGovernanceContext({...input,validationSha:contextGit(['rev-parse','HEAD'])}),/preserve candidate bytes/)
  contextGit(['checkout','--quiet','--detach',candidate])
  assert.equal(validateGovernanceContext({...input,event:'push',validationSha:candidate}).validationSha,candidate)
  contextGit(['checkout','--quiet','--detach',authority])
  assert.throws(()=>validateGovernanceContext({...input,event:'push',validationSha:authority}),/actual pushed source/)
 } finally {fs.rmSync(temporary,{recursive:true,force:true})}
})
