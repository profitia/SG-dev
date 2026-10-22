import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {partitionChangedPaths,validateCandidate,validateOwnerGroups} from './ci-routing.mjs'
const root=path.resolve('../..'),git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),head=git(['rev-parse','HEAD']),candidate=process.env.CANDIDATE_HEAD_SHA??head
assert.equal(head,candidate)
let base=process.env.VALIDATION_BASE_SHA??git(['rev-parse','origin/main'])
if(/^0+$/.test(base)||!process.env.VALIDATION_BASE_SHA&&base===head)base=git(['rev-parse','HEAD^'])
validateCandidate({git,candidate,base})
const changed=execFileSync('git',['diff','--name-only','-z',`${base}...${head}`],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean)
const {groups,partition}=partitionChangedPaths(changed,root)
const governanceByProject=validateOwnerGroups({groups,runGovernance(projectKey,targets){
 const args=['scripts/governance/governance-preflight.mjs','--ci','--mode','development','--project',projectKey,'--target-environment','development','--task-id','CI-KRS-TASK02','--conversation-id','CI-KRS-TASK02','--title','KRS source and owner dependency validation','--workspace','GitHub Actions','--execution-environment','ci','--scope','implementation','--json',...targets.flatMap(p=>['--target',p])]
 return JSON.parse(execFileSync(process.execPath,args,{cwd:root,encoding:'utf8'}))
}})
const gate=governanceByProject.find(g=>g.projectKey==='ARCHITECTURE')?.governance
const protectedPaths=['apps/srm','apps/maps-runtime','packages/maps-contracts','packages/maps-embed','packages/srm-xray','packages/platform-contracts','render.yaml']
// Preserve each actual tree identity. A validated owner dependency is recorded
// as changed, never presented as byte preservation or release authority.
const dependencyTrees=Object.fromEntries(protectedPaths.map(p=>{const before=git(['rev-parse',`${base}:${p}`]),after=git(['rev-parse',`${head}:${p}`]);return [p,{before,after,status:before===after?'PRESERVED':'OWNER_DEPENDENCY_CHANGED'}]}))
const preserved=Object.fromEntries(Object.entries(dependencyTrees).filter(([,v])=>v.status==='PRESERVED').map(([p,v])=>[p,v.after]))
const postgres=JSON.parse(fs.readFileSync('dist/postgres-evidence.json'));assert(postgres.performance.nameRows>=100000)
const artifact=JSON.parse(fs.readFileSync('dist/artifact-proof.json'));assert.equal(artifact.sourceSha,head)
validateCandidate({git,candidate,base})
fs.writeFileSync('dist/source-proof.json',JSON.stringify({projectKey:'ARCHITECTURE',targetEnvironment:'development',candidateHeadSha:candidate,validationSha:head,baseSha:base,changedPaths:changed,ownerPartition:partition,governanceByProject,dependencyTrees,preserved,...(gate?{governance:gate}:{}),postgresEvidence:postgres,artifact,e1ProducerAcceptance:'UNAVAILABLE_FAIL_CLOSED',deploymentPerformed:false,productDatabaseMutationPerformed:false,sourceNetworkRequests:0,financialCalls:0},null,2)+'\n')
console.log('Exact source, routing, independent PostgreSQL and artifact proof PASS')
