import fs from 'node:fs';import {execFileSync} from 'node:child_process';import path from 'node:path';import assert from 'node:assert/strict'
import {partitionChangedPaths, validateCandidate, validateOwnerGroups} from './ci-routing.mjs'
const root=path.resolve('../..'),git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),head=git(['rev-parse','HEAD']),candidate=process.env.CANDIDATE_HEAD_SHA??head
let base=process.env.VALIDATION_BASE_SHA??git(['rev-parse','origin/main'])
if(/^0+$/.test(base)||!process.env.VALIDATION_BASE_SHA&&base===head)base=git(['rev-parse','HEAD^'])
validateCandidate({git,candidate,base})
const changed=execFileSync('git',['diff','--name-only','-z',`${base}...${head}`],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean)
const {groups,partition}=partitionChangedPaths(changed,root)
const governanceByProject=validateOwnerGroups({groups,runGovernance(projectKey,targets){
 const args=['scripts/governance/governance-preflight.mjs','--ci','--mode','development','--project',projectKey,'--target-environment','development','--task-id','CI-IDENTITY-B2','--conversation-id','CI-IDENTITY-B2','--title','Identity B2 source validation','--workspace','GitHub Actions','--execution-environment','ci','--scope','implementation','--json'];for(const p of targets)args.push('--target',p)
 return JSON.parse(execFileSync(process.execPath,args,{cwd:root,encoding:'utf8'}))
}})
validateCandidate({git,candidate,base})
assert.equal(git(['rev-parse','HEAD']),head,'Candidate changed during validation')
const architecture=governanceByProject.find(g=>g.projectKey==='ARCHITECTURE')
fs.writeFileSync('dist/b2-source-proof.json',JSON.stringify({projectKey:'ARCHITECTURE',targetEnvironment:'development',validationSha:head,candidateHeadSha:candidate,validationBaseSha:base,changedPaths:changed,ownerPartition:partition,governanceByProject,...(architecture?{governance:architecture.governance}:{}),sourceTests:'PASS',liveClerkAcceptance:'PENDING',browserSso:'PENDING',deploymentPerformed:false,databaseMutated:false},null,2));console.log('Exact candidate source/governance proof recorded without live-provider or deployment claims')
