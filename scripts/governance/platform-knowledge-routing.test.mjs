import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {resolveProjectProfile} from './project-profile.mjs'
import {resolveProjectRouting} from './routing-engine.mjs'
import {validateGovernanceManifest} from './validate-governance-manifest.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const baseline='d88adf594dfa51cd2011c2567dfc5f6506f6ffc1'
const registry='Canon/registries/current-architecture-baseline-v1.json'
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
const previous=p=>JSON.parse(execFileSync('git',['show',baseline+':'+p],{cwd:root,encoding:'utf8'}))
const targets=['apps/platform-knowledge-runtime/src/server.mjs','packages/platform-knowledge-contracts/src/index.mjs','packages/platform-knowledge-core/src/index.mjs','.github/workflows/platform-knowledge-ci.yml']
const route=(profile,paths,repositoryRoot=root)=>resolveProjectRouting({profile:resolveProjectProfile(profile,root),targets:paths,repositoryRoot})

test('Platform Knowledge adds exactly four owner-scoped routes without changing prior authority',()=>{
 const before=previous(registry),after=json(registry)
 const {surfaces:a,...oldMeta}=before,{surfaces:b,...newMeta}=after
 assert.deepEqual(newMeta,oldMeta)
 for(const row of before.surfaces)assert.deepEqual(after.surfaces.find(s=>s.id===row.id),row)
 const independentlyAccepted=[{"id":"GOV-DOCS-UNIVERSAL-V12-001","capability":"Agent Instruction Documentation","name":"Active instruction library \u2014 approved exact documents","pathPatterns":["docs/agent-instructions/profitia-universal-project-execution-v1.2.md","docs/agent-instructions/business-outcome-engineering-v1.1.md","docs/agent-instructions/full-autopilot-v2.md","docs/agent-instructions/ux-ui-design-canon.md","docs/agent-instructions/bsdc-launcher-v1.0.md","docs/agent-instructions/bsdc-launcher-v1.1.md"],"currentOwner":"Governance Source Layer","currentResponsibility":"Canonical approved Universal Wrapper, Business Outcome Engineering, Full Autopilot, UX/UI and BSDC launcher documents for SG2, ARCHITECTURE and SRM; current main is authoritative and the existing library branch is a compatibility entrypoint; no runtime, environment, access or continuity-policy grant.","baselineClassification":"ALIGNED","parentSurfaceId":null,"cleanupReason":null,"classificationReferenceSha":"4c8f2d98cdb42cde8b8de4d77af5aeef64b025ae","allowedProjectKeys":["ARCHITECTURE"],"onboardingAuthorization":"Explicit owner response: Zatwierdzam jeden wpis i doko\u0144czenie publikacji; 2026-11-11, host 01a1cc30-dccf-7942-b613-e33a0fe38b30. Exact documentation path only; publication without activation or replacement of existing wrappers. Separate owner activation instruction: aktywuj wrapper; 2026-11-11, same host. Activates the instruction for SG2, ARCHITECTURE and SRM through the existing manifest; no CIC activation or change to existing continuity requirements. Owner documentation consolidation instruction: Wykonaj to zadanie porz\u0105dkuj\u0105ce dokumentacj\u0119 i zwr\u00f3\u0107 mi linki do nowych lokalizacji wszystkich uporz\u0105dkowanych plik\u00f3w; 2026-11-11, same host. Register only the three exact approved reference paths under the existing owner before consolidation. BSDC v1.0 owner approval and activation mandate, 2026-11-12: add only docs/agent-instructions/bsdc-launcher-v1.0.md to this existing documentation owner; no new capability, owner, profile or product source authority. BSDC v1.1 explicit owner publication and activation mandate, 2026-11-12, host 01a1cc30-dccf-7942-b613-e33a0fe38b30: register only docs/agent-instructions/bsdc-launcher-v1.1.md under this existing documentation owner before publication; preserve v1.0 history, ownership, allowedProjectKeys, routing rules, product/runtime and continuity boundaries."},{"id":"AQC-BASE-001","capability":"Assistant Continuous Quality","name":"Assistant Quality Control","pathPatterns":["packages/assistant-quality-control/**"],"currentOwner":"Architecture Platform","currentResponsibility":"Bounded QA contracts, deterministic evaluation, durable repair state, cost reservations, isolated executor orchestration and independent release evidence; no conversation ownership or alternate Identity/E1.","baselineClassification":"ALIGNED","parentSurfaceId":null,"cleanupReason":null,"classificationReferenceSha":"df2214265e577ef653c35fa18a38c717ffe8905e","allowedProjectKeys":["ARCHITECTURE"],"onboardingAuthorization":"G1 GRANTED: explicit owner Stage 1 execution of accepted PDR revision 8, 2026-11-12; ARCH-CIC-QUALITY-STAGE1-G1-20261112; Canon/evidence/2026-11-12-assistant-quality-stage1-g1-onboarding.md. Development source registration only; resources remain human-owner-only; no administrative data/service grant, Stage 2, Staging or Production."},{"id":"AQC-BASE-002","capability":"Assistant Continuous Quality","name":"Assistant Quality Repair Workflow","pathPatterns":[".github/workflows/assistant-quality-repair.yml"],"currentOwner":"Architecture Platform","currentResponsibility":"Credential-free source checks and separately admitted Development repair execution; candidate code never receives publication or data-store credentials. Source registration is not a runtime service grant.","baselineClassification":"ALIGNED","parentSurfaceId":null,"cleanupReason":null,"classificationReferenceSha":"df2214265e577ef653c35fa18a38c717ffe8905e","allowedProjectKeys":["ARCHITECTURE"],"onboardingAuthorization":"G1 GRANTED: explicit owner Stage 1 execution of accepted PDR revision 8, 2026-11-12; ARCH-CIC-QUALITY-STAGE1-G1-20261112; Canon/evidence/2026-11-12-assistant-quality-stage1-g1-onboarding.md. Development source registration only; resources remain human-owner-only; no administrative data/service grant, Stage 2, Staging or Production."}]
 for(const row of independentlyAccepted)assert.deepEqual(after.surfaces.find(s=>s.id===row.id),row)
 assert.deepEqual(after.surfaces.filter(s=>!before.surfaces.some(r=>r.id===s.id)&&!independentlyAccepted.some(r=>r.id===s.id)).map(s=>s.id).sort(),[1,2,3,4].map(i=>'PK-BASE-00'+i))
 assert.equal(after.surfaces.length,before.surfaces.length+4+independentlyAccepted.length)
 const result=route('ARCHITECTURE',targets);assert.equal(result.ok,true,result.error)
 assert.deepEqual(result.results.map(r=>r.matchedSurfaceId),[1,2,3,4].map(i=>'PK-BASE-00'+i))
 assert(result.results.every(r=>r.currentOwner==='Architecture Platform'&&r.baselineClassification==='ALIGNED'&&r.highestSpecificityMatchCount===1))
 for(const profile of ['SG2','SRM'])assert.equal(route(profile,targets).ok,false)
})

test('Platform Knowledge does not admit neighbouring paths, consumer source or traversal',()=>{
 for(const p of ['apps/platform-knowledge-runtime-copy/src/main.mjs','packages/platform-knowledge-ui/index.mjs','packages/platform-knowledge-contract/index.mjs','.github/workflows/platform-knowledge-release.yml','.github/workflows/platform-knowledge-ci.yml.extra','apps/platform-knowledge-runtime/../../sg-runtime/x.mjs','apps/sg-runtime/lib/assistant/runtime.ts','apps/srm/src/server/server.ts'])assert.equal(route('ARCHITECTURE',[p]).ok,false,p)
})

test('Platform Knowledge refuses pre-onboarding and conflicting ownership',t=>{
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'pk-routing-'))
 t.after(()=>fs.rmSync(scratch,{recursive:true,force:true}))
 const file=path.join(scratch,registry);fs.mkdirSync(path.dirname(file),{recursive:true})
 fs.writeFileSync(file,JSON.stringify(previous(registry)))
 assert.equal(route('ARCHITECTURE',targets,scratch).ok,false)
 const conflict=json(registry)
 conflict.surfaces.push({...conflict.surfaces.find(r=>r.id==='PK-BASE-001'),id:'PK-CONFLICT-TEST',currentOwner:'Other owner'})
 fs.writeFileSync(file,JSON.stringify(conflict))
 const result=route('ARCHITECTURE',[targets[0]],scratch)
 assert.equal(result.ok,false);assert.equal(result.results[0].resolutionStatus,'CONFLICT')
})

test('Platform Knowledge onboarding preserves existing resources and cannot create runtime grants',()=>{
 const before=previous('Canon/registries/architecture-onboarding-v1.json'),after=json('Canon/registries/architecture-onboarding-v1.json')
 const {plannedModules:a,...oldMeta}=before,{plannedModules:b,...newMeta}=after
 assert.deepEqual(newMeta,oldMeta)
 for(const row of before.plannedModules)assert.deepEqual(after.plannedModules.find(r=>r.capability===row.capability),row)
  const independentlyAcceptedModules=[{"capability":"Assistant Continuous Quality","owner":"Architecture Platform","projectKey":"ARCHITECTURE","targetEnvironment":"development","pathPattern":"packages/assistant-quality-control/**","ciPath":".github/workflows/assistant-quality-repair.yml","approval":{"decision":"G1 GRANTED","decisionId":"ARCH-CIC-QUALITY-STAGE1-G1-20261112","sourceType":"EXPLICIT_OWNER_STAGE1_EXECUTION_OF_APPROVED_PDR_REV8","hostConversationId":null,"hostConversationIdStatus":"UNAVAILABLE","date":"2026-11-12","reference":"Canon/evidence/2026-11-12-assistant-quality-stage1-g1-onboarding.md","registrationTaskId":"ARCH-CIC-QUALITY-STAGE1-G1-20261112","approvedDesignCommit":"92dba2a44c33d90e767a651d3519542a654d548f","resourceCreationAuthorized":false,"administrativeGrantsAuthorized":false},"status":"SOURCE_ONBOARDING_PENDING_MAIN","continuityProjectKey":"ARCHITECTURE","firstConsumerProfile":"SG2","consumerAdoption":"SEPARATELY_REGISTERED_SG2_AND_CIC_TASKS","runtimeCreated":false,"resourceCreationAuthority":"HUMAN_OWNER_ONLY","implementationAuthority":"STAGE1_ONLY_AFTER_EFFECTIVE_ROUTING_AND_OWN_GATES","runtimeServiceDataMandate":"SEPARATE_EXACT_ADMISSION_REQUIRED","stage2Authority":"NONE_UNTIL_EXPLICIT_OWNER_ORDER","stagingProductionAuthority":"NONE","decisionDocument":"Canon/proposals/bsdc/ARCHITECTURE/cic-assistant-continuous-quality.md","evidenceDocument":"Canon/evidence/2026-11-12-assistant-quality-stage1-g1-onboarding.md","developmentRender":{"workspaceId":"tea-d7lps8rbc2fs73cn80dg","region":"frankfurt","proposedName":"assistant-quality-development-worker","serviceId":null,"deploymentPolicy":"MANUAL_EXACT_SHA"},"developmentStorage":{"ownerProfile":"SG2","projectId":null,"branchId":null,"databaseName":null,"schemaName":null,"status":"EXACT_PRODUCT_STORE_AND_INSTALLATION_PENDING_OWNER_CONFIRMATION"},"modelBudget":{"totalUsd":50,"incidentUsd":5,"windowDays":14,"start":"FIRST_PAID_STAGE1_ACCEPTANCE","automaticRenewal":false}}]
  for(const row of independentlyAcceptedModules)assert.deepEqual(after.plannedModules.find(r=>r.capability===row.capability),row)
  assert.deepEqual(after.plannedModules.filter(r=>!before.plannedModules.some(x=>x.capability===r.capability)&&!independentlyAcceptedModules.some(x=>x.capability===r.capability)).map(r=>r.capability),["Platform Knowledge"])
  assert.equal(after.plannedModules.length,before.plannedModules.length+1+independentlyAcceptedModules.length)
 const pk=after.plannedModules.find(r=>r.capability==='Platform Knowledge')
 assert.equal(pk.owner,'Architecture Platform');assert.equal(pk.projectKey,'ARCHITECTURE')
 assert.equal(pk.approval.resourceCreationAuthorized,false);assert.equal(pk.approval.administrativeGrantsAuthorized,false)
 assert.equal(pk.runtimeCreated,false);assert.equal(pk.stagingProductionAuthority,'NONE')
 assert.equal(pk.developmentStorage.neonProjectId,null);assert.equal(pk.developmentRender.apiServiceId,null)
 const validation=validateGovernanceManifest(root);assert.equal(validation.valid,true,validation.errors.join('; '))
 const document=validation.activeDocuments.find(d=>d.id==='platform-knowledge-development-foundation')
 for(const id of document.dependsOn)assert(validation.activeDocuments.find(d=>d.id===id).loadOrder<document.loadOrder)
})
