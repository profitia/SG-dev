import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
const root=path.resolve('../..'),git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),head=git(['rev-parse','HEAD']),candidate=process.env.CANDIDATE_HEAD_SHA??head
assert.equal(head,candidate)
let base=process.env.VALIDATION_BASE_SHA??git(['rev-parse','origin/main']);if(/^0+$/.test(base)||base===head)base=git(['rev-parse','HEAD^'])
assert.match(base,/^[a-f0-9]{40}$/)
const changed=git(['diff','--name-only',`${base}...${head}`]).split('\n').filter(Boolean)
assert(changed.length>0)
assert(changed.every(p=>p.startsWith('apps/krs-registry-runtime/')||p.startsWith('packages/krs-registry-contracts/')||p==='.github/workflows/krs-registry-ci.yml'),'Separate owner dependency required for any extra path')
const args=['scripts/governance/governance-preflight.mjs','--ci','--mode','development','--project','ARCHITECTURE','--target-environment','development','--task-id','CI-KRS-TASK02','--conversation-id','CI-KRS-TASK02','--title','KRS source validation','--workspace','GitHub Actions','--execution-environment','ci','--scope','implementation','--json',...changed.flatMap(p=>['--target',p])]
const gate=JSON.parse(execFileSync(process.execPath,args,{cwd:root,encoding:'utf8'}));assert.equal(gate.verdict,'PASS')
const protectedPaths=['apps/srm','apps/maps-runtime','packages/maps-contracts','packages/maps-embed','packages/srm-xray','packages/platform-contracts','render.yaml']
const preserved=Object.fromEntries(protectedPaths.map(p=>{const before=git(['rev-parse',`${base}:${p}`]),after=git(['rev-parse',`${head}:${p}`]);assert.equal(after,before);return [p,after]}))
const postgres=JSON.parse(fs.readFileSync('dist/postgres-evidence.json'));assert(postgres.performance.nameRows>=100000)
const artifact=JSON.parse(fs.readFileSync('dist/artifact-proof.json'));assert.equal(artifact.sourceSha,head)
fs.writeFileSync('dist/source-proof.json',JSON.stringify({projectKey:'ARCHITECTURE',targetEnvironment:'development',candidateHeadSha:candidate,validationSha:head,baseSha:base,changedPaths:changed,preserved,governance:gate,postgresEvidence:postgres,artifact,e1ProducerAcceptance:'UNAVAILABLE_FAIL_CLOSED',deploymentPerformed:false,productDatabaseMutationPerformed:false,sourceNetworkRequests:0,financialCalls:0},null,2)+'\n')
console.log('Exact source, routing, independent PostgreSQL and artifact proof PASS')
