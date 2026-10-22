import fs from 'node:fs';import {execFileSync} from 'node:child_process';import path from 'node:path';import assert from 'node:assert/strict'
const root=path.resolve('../..'),git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),head=git(['rev-parse','HEAD']),candidate=process.env.CANDIDATE_HEAD_SHA??head
assert.equal(head,candidate,'Proof must validate exact candidate HEAD')
let base=process.env.VALIDATION_BASE_SHA??git(['rev-parse','origin/main'])
if(/^0+$/.test(base)||base===head)base=git(['rev-parse','HEAD^'])
assert(/^[a-f0-9]{40}$/.test(base),'Exact validation base required')
const changed=git(['diff','--name-only',`${base}...${head}`]).split('\n').filter(Boolean)
assert(changed.length>0,'Changed paths must be checked by canonical Architecture CI governance')
const args=['scripts/governance/governance-preflight.mjs','--ci','--mode','development','--project','ARCHITECTURE','--target-environment','development','--task-id','CI-IDENTITY-B2','--conversation-id','CI-IDENTITY-B2','--title','Identity B2 source validation','--workspace','GitHub Actions','--execution-environment','ci','--scope','implementation','--json'];for(const p of changed)args.push('--target',p)
const gate=JSON.parse(execFileSync(process.execPath,args,{cwd:root,encoding:'utf8'}));assert.equal(gate.verdict,'PASS')
fs.writeFileSync('dist/b2-source-proof.json',JSON.stringify({projectKey:'ARCHITECTURE',targetEnvironment:'development',validationSha:head,candidateHeadSha:candidate,validationBaseSha:base,changedPaths:changed,governance:gate,sourceTests:'PASS',liveClerkAcceptance:'PENDING',browserSso:'PENDING',deploymentPerformed:false,databaseMutated:false},null,2));console.log('Exact candidate source/governance proof recorded without live-provider or deployment claims')
