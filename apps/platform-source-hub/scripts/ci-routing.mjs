import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {partitionChangedPaths,validateCandidate,validateOwnerGroups} from '../../identity-runtime/scripts/ci-routing.mjs'

const acceptedConsumerPaths={
  "SG2": [
    "apps/dashboard-preview/package-lock.json",
    "apps/sg-runtime/package-lock.json",
    "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx",
    "apps/sg-runtime/tests/category-operation.test.ts",
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs",
    "apps/sg-runtime/tests/identity-runtime.test.ts",
    "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs",
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs",
    "apps/sg-runtime/tests/operation-context.test.mjs",
    "apps/sg-runtime/tests/pci-smart-integrity.mjs",
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs",
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts",
    "apps/sg-runtime/tests/self-service-account.test.ts",
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs",
    "apps/sg-runtime/tests/xray-gateway.test.ts"
  ],
  "SRM": [
    "apps/maps-runtime/package-lock.json",
    "apps/maps-runtime/platform-integration.json",
    "apps/maps-runtime/test/embed.test.mjs",
    "apps/srm/deployment/root-atomic-claim-targets.json",
    "apps/srm/package-lock.json",
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs",
    "apps/srm/scripts/native-execution-adoption.test.mjs",
    "apps/srm/scripts/operation-context.test.mjs",
    "apps/srm/scripts/request-quota-adoption.test.mjs",
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs",
    "apps/srm/scripts/xray-performance-adoption.test.mjs",
    "apps/srm/src/server/full-ui-parity-adoption.test.ts",
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts",
    "packages/maps-embed/package.json"
  ]
}

export function validateConsumerGroups(groups,readReceipt){
 for(const {projectKey,targets} of groups){
  if(projectKey==='ARCHITECTURE')continue
  assert(['SG2','SRM'].includes(projectKey),'Only the separately registered consumers belong to this delivery')
  const app=projectKey==='SG2'?'sg-runtime':'srm',file=`apps/${app}/operation-integration.json`
  const receipt=readReceipt(file),a=receipt.sourceHubApiPathCompatibility
  assert.equal(receipt.projectKey,projectKey)
  assert.equal(a.taskId,`${projectKey}-SOURCE-HUB-API-PATH-COMPATIBILITY-20261103`)
  assert.equal(a.scope,'SDK_API_PATH_COMPATIBILITY_RECORDS_AND_TESTS_ONLY')
  assert.equal(a.targetEnvironment,'development');assert.equal(a.producer.projectKey,'ARCHITECTURE')
  assert.equal(a.producer.pullRequest,885);assert.equal(a.platformVersion,'1.33.0')
  assert.deepEqual(Object.keys(a.consumerSourceDigests).sort(),acceptedConsumerPaths[projectKey],'Exact owner-approved acceptance paths required')
  const allowed=new Set([file,...acceptedConsumerPaths[projectKey]])
  for(const target of targets)assert(allowed.has(target),'Consumer changes require an exact separately governed acceptance binding: '+target)
  for(const flag of ['apiPathOptedIn','sql028Installed','businessLogicChanged','uiChanged','authorizationChanged','sourceBindingsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 }
 return groups
}

export function validateRouting({changedPaths,repositoryRoot,readReceipt,runGovernance}){
 const {groups,partition}=partitionChangedPaths(changedPaths,repositoryRoot)
 validateConsumerGroups(groups,readReceipt)
 return {partition,results:validateOwnerGroups({groups,runGovernance})}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const repositoryRoot=fileURLToPath(new URL('../../../',import.meta.url))
 const git=args=>execFileSync('git',args,{cwd:repositoryRoot,encoding:'utf8'}).trim()
 const base=process.argv[process.argv.indexOf('--base')+1]
 const candidate=git(['rev-parse','HEAD'])
 validateCandidate({git,candidate,base})
 const changedPaths=git(['diff','--name-only',base,candidate]).split('\n').filter(Boolean)
 const result=validateRouting({changedPaths,repositoryRoot,
  readReceipt:file=>JSON.parse(fs.readFileSync(path.join(repositoryRoot,file))),
  runGovernance:(projectKey,targets)=>{
   const args=['scripts/governance/governance-preflight.mjs','--ci','--mode','development','--project',projectKey,
    '--target-environment','development','--task-id',`CI-SOURCE-HUB-${projectKey}`,'--host-conversation-unavailable',
    '--title','Source Hub Stage2A owner routing','--scope','implementation','--workspace','GitHub Actions','--execution-environment','ci','--json']
   for(const target of targets)args.push('--target',target)
   return JSON.parse(execFileSync(process.execPath,args,{cwd:repositoryRoot,encoding:'utf8'}))
  }})
 console.log(JSON.stringify({candidate,base,...result},null,2))
}
