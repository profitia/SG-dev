import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {OIL_REPORT_E1_REVIEW,assertArchitectureCheckout} from '../../../scripts/governance/controlled-package-ci.mjs'
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
    "apps/sg-runtime/tests/private-host.integration.test.mjs",
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
    "apps/srm/scripts/private-host.integration.test.mjs",
    "apps/srm/scripts/request-quota-adoption.test.mjs",
    "apps/srm/scripts/rural-location-release.test.mjs",
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs",
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs",
    "apps/srm/scripts/xray-performance-adoption.test.mjs",
    "apps/srm/scripts/xray-style-acceptance.mjs",
    "apps/srm/src/server/full-ui-parity-adoption.test.ts",
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts",
    "packages/maps-embed/package.json"
  ]
}

export function validateConsumerGroups(groups,readReceipt,{reviewedOilPaths=new Set()}={}){
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
  const market=receipt.sourceHubMarketSymbolCompatibility
  if(market){
   const paths=[...acceptedConsumerPaths[projectKey],...(projectKey==='SRM'?['apps/srm/scripts/source-hub-market-symbol-compatibility.test.mjs']:[])].sort()
   assert.equal(market.schemaVersion,'1.0')
   assert.equal(market.taskId,projectKey==='SG2'?'SG2-OIL-V05-SDK134-ADOPTION-20261106':'SRM-SOURCE-HUB-MARKET-SYMBOL-SDK-ADOPTION-20261106')
   assert.equal(market.scope,'SDK_MARKET_SYMBOL_COMPATIBILITY_RECORDS_AND_TESTS_ONLY')
   assert.equal(market.targetEnvironment,'development');assert.equal(market.platformVersion,'1.34.0');assert.equal(market.marketSymbolContractVersion,'1.0.0')
   assert.equal(market.producer.projectKey,'ARCHITECTURE');assert.equal(market.producer.pullRequest,915)
   assert.equal(market.producer.sourceSha,'ebf017cae09bf7bd9139af7917534b47ae0c4d4b')
   assert.equal(market.previousReceiptSourceSha,'3d660eeaf8b6b7ef914a612b8383514f99e857d3');assert.match(market.previousReceiptSha256,/^[a-f0-9]{64}$/)
   assert.deepEqual(Object.keys(market.consumerSourceDigests).sort(),paths,'Exact separately registered SDK1.34 paths required')
   for(const value of Object.values(market.consumerSourceDigests))assert.match(value,/^[a-f0-9]{64}$/)
   for(const flag of ['marketSymbolOptedIn','sql029Installed','businessLogicChanged','uiChanged','authorizationChanged','sourceBindingsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(market[flag],false,flag)
   for(const p of paths)allowed.add(p)
  }
  for(const target of targets)assert(allowed.has(target)||reviewedOilPaths.has(target)&&OIL_REPORT_E1_REVIEW.entries[target]?.projectKey===projectKey,'Consumer changes require an exact separately governed acceptance binding: '+target)
  for(const flag of ['apiPathOptedIn','sql028Installed','businessLogicChanged','uiChanged','authorizationChanged','sourceBindingsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 }
 return groups
}

export function reviewedOilConsumerPaths(repositoryRoot,{baseSha,candidateSha}={}){
 const git=args=>execFileSync('git',args,{cwd:repositoryRoot,encoding:'utf8'}).trim();
 assert.equal(git(['rev-parse','HEAD']),candidateSha,'Validate the actual source checkout');
 const files=Object.entries(OIL_REPORT_E1_REVIEW.entries).map(([filename,e])=>({filename,status:e.status,sha:e.sha}));
 // Canonical verifier checks complete diff, registered owners, every Git mode,
 // pinned blob and actual regular-file bytes. A path or caller flag is no proof.
 assertArchitectureCheckout(repositoryRoot,candidateSha,{kind:'ARCHITECTURE',baseSha,files});
 return new Set(files.filter(f=>OIL_REPORT_E1_REVIEW.entries[f.filename].projectKey!=='ARCHITECTURE').map(f=>f.filename));
}

export function validateRouting({changedPaths,repositoryRoot,readReceipt,runGovernance,sourceReview}){
 const {groups,partition}=partitionChangedPaths(changedPaths,repositoryRoot)
 const needsOil=groups.some(g=>g.projectKey!=='ARCHITECTURE'&&g.targets.some(t=>!acceptedConsumerPaths[g.projectKey]?.includes(t)&&!['apps/sg-runtime/operation-integration.json','apps/srm/operation-integration.json','apps/srm/scripts/source-hub-market-symbol-compatibility.test.mjs'].includes(t)));
 const reviewedOilPaths=needsOil?reviewedOilConsumerPaths(repositoryRoot,sourceReview):new Set();
 validateConsumerGroups(groups,readReceipt,{reviewedOilPaths})
 return {partition,results:validateOwnerGroups({groups,runGovernance})}
}

export function validationBase({git,requestedBase,validationSha,event,headSha}){
 assert(/^[a-f0-9]{40}$/.test(requestedBase)&&/^[a-f0-9]{40}$/.test(validationSha),'Exact event revisions required')
 assert.equal(git(['rev-parse','HEAD']),validationSha,'Validate the actual event checkout')
 if(event==='pull_request'){
  assert(/^[a-f0-9]{40}$/.test(headSha),'Exact PR head required')
  const parents=git(['rev-list','--parents','-n','1',validationSha]).split(' ')
  assert.equal(parents.length,3,'Expected the GitHub PR validation merge')
  assert.equal(parents[0],validationSha);assert.equal(parents[2],headSha,'Validation merge must contain the exact PR head')
  git(['merge-base','--is-ancestor',requestedBase,parents[1]])
  return parents[1]
 }
 assert.equal(event,'push','Only explicit source CI events are supported')
 return requestedBase
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const repositoryRoot=fileURLToPath(new URL('../../../',import.meta.url))
 const git=args=>execFileSync('git',args,{cwd:repositoryRoot,encoding:'utf8'}).trim()
 const requestedBase=process.argv[process.argv.indexOf('--base')+1]
 const candidate=git(['rev-parse','HEAD'])
 const base=validationBase({git,requestedBase,validationSha:process.env.CI_ROUTING_VALIDATION,
  event:process.env.CI_ROUTING_EVENT,headSha:process.env.CI_ROUTING_HEAD})
 validateCandidate({git,candidate,base})
 const changedPaths=git(['diff','--name-only',base,candidate]).split('\n').filter(Boolean)
 const result=validateRouting({changedPaths,repositoryRoot,sourceReview:{baseSha:base,candidateSha:candidate},
  readReceipt:file=>JSON.parse(fs.readFileSync(path.join(repositoryRoot,file))),
  runGovernance:(projectKey,targets)=>{
   const args=['scripts/governance/governance-preflight.mjs','--ci','--mode','development','--project',projectKey,
    '--target-environment','development','--task-id',`CI-SOURCE-HUB-${projectKey}`,'--host-conversation-unavailable',
    '--title','Source Hub Stage2A owner routing','--scope','implementation','--workspace','GitHub Actions','--execution-environment','ci','--json']
   for(const target of targets)args.push('--target',target)
   return JSON.parse(execFileSync(process.execPath,args,{cwd:repositoryRoot,encoding:'utf8'}))
  }})
 console.log(JSON.stringify({candidate:process.env.CI_ROUTING_HEAD||candidate,validationSha:candidate,base,requestedBase,...result},null,2))
}
