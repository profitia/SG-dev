import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {partitionChangedPaths,projectForRoute,validateCandidate,validateOwnerGroups} from '../scripts/ci-routing.mjs'

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
