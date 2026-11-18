import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {sourceAdmissionDigest,assertSourceValidationProof,transportPlan,executionProfile,classifyCapability,assertWorkflowPackageCredential,
 classifyPackageFailure,credentialFree,assertSourceAdmission,assertSourceCheckout,
 readTrustedAdmissions,trustedAdmissionById,assertOperationWithinMandate,assertReleaseState,resumePoint} from './development-execution.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const now=Date.parse('2026-11-16T14:00:00Z'), head='a'.repeat(40), base='b'.repeat(40)
const sourcePath='packages/platform-contracts/src/operation-context.mjs'
const entry={path:sourcePath,blob:head,status:'modified',mode:'100644',projectKey:'ARCHITECTURE',owner:'Architecture Platform',surfaceId:'ARCH-BASE-001'}
const record=()=>({id:'independent-source',status:'ACTIVE',repository:'profitia/SG-dev',actor:'profitia',
 taskId:'AN-INDEPENDENT-FUTURE-TASK',targetEnvironment:'development',scope:'SOURCE_VALIDATION_ONLY',
 approvalRef:'accepted-owner-mandate',sourceSha:head,baseSha:base,validFrom:'2026-11-01T00:00:00Z',
 validUntil:'2026-12-01T00:00:00Z',files:[{...entry}]})
const facts=()=>({repository:'profitia/SG-dev',actor:'profitia',candidateSha:head,currentMainSha:base,
 files:[{filename:sourcePath,sha:head,status:'modified'}]})

test('registered projects share one standard and preserve profile-specific repositories, transport and continuity',()=>{
 for(const key of ['SG2','ARCHITECTURE','SRM','CIC']){
  const p=executionProfile(key)
  assert.equal(p.standard,'profitia.development-execution/v1')
  assert.equal(transportPlan(key).repository,p.profile.repository.slug)
  assert.equal(transportPlan(key).ownershipFromBranch,false)
  assert.equal(transportPlan(key).grantsAuthority,false)
 }
 assert.equal(transportPlan('ARCHITECTURE','policy').prefix,'sg2/')
 assert.equal(transportPlan('ARCHITECTURE').prefix,'architecture/')
 assert.equal(transportPlan('SRM').prefix,'srm/')
 assert.equal(executionProfile('CIC').profile.repository.slug,'profitia/conversational-intelligence-core')
 assert.equal(executionProfile('SG2').continuity.memoros,'required')
 assert.equal(executionProfile('SRM').continuity.memoros,'disabled')
 assert.throws(()=>executionProfile('UNREGISTERED'))
 assert.throws(()=>transportPlan('SG2','deployment'))
})

test('readiness distinguishes decisions, absent credentials, authentication, permission and ambiguous resources',()=>{
 const ok={credentialPresent:true,httpStatus:200}
 for(const [delta,want] of [
  [{},'READY'],[{requiredDecisionPresent:false},'DECISION_REQUIRED'],
  [{credentialPresent:false},'CREDENTIAL_MISSING'],[{httpStatus:401},'AUTHENTICATION_REJECTED'],
  [{httpStatus:403},'PERMISSION_REJECTED'],[{httpStatus:404},'RESOURCE_OR_ACCESS_UNVERIFIED'],
  [{httpStatus:500},'TECHNICAL_FAILURE'],[{httpStatus:undefined},'TECHNICAL_FAILURE'],
  [{errorCode:'ETIMEDOUT'},'TECHNICAL_FAILURE']
 ])assert.equal(classifyCapability({...ok,...delta}),want)
})

test('workflow token validation uses repository identity and never the PAT-only user endpoint',async()=>{
 const context={repository:'profitia/SG-dev',controlSha:head,ref:'refs/heads/main',event:'workflow_dispatch',
  workflowRef:'profitia/SG-dev/.github/workflows/platform-contracts-ci.yml@refs/heads/main'}
 const calls=[]
 const request=async(endpoint,token)=>{calls.push(endpoint);assert.equal(token,'opaque-test');return {data:{full_name:context.repository}}}
 await assertWorkflowPackageCredential({token:'opaque-test',context,request})
 assert.deepEqual(calls,['repos/profitia/SG-dev'])
 await assert.rejects(()=>assertWorkflowPackageCredential({token:'',context,request}))
 await assert.rejects(()=>assertWorkflowPackageCredential({token:'opaque-test',context:{...context,ref:'refs/pull/1/merge'},request}))
 await assert.rejects(()=>assertWorkflowPackageCredential({token:'opaque-test',context,request:async()=>({data:{full_name:'foreign/repo'}})}))
})

test('sanitized package failures expose categories without raw registry output',()=>{
 for(const [raw,code] of [['npm ERR E401 token-secret','PACKAGE_AUTHENTICATION_REJECTED'],
 ['403 Forbidden secret','PACKAGE_PERMISSION_REJECTED'],['E404 token-secret','PACKAGE_OR_ACCESS_UNVERIFIED'],
 ['EINTEGRITY token-secret','PACKAGE_INTEGRITY_REJECTED'],['ETIMEDOUT token-secret','CONTROLLED_DEPENDENCY_INSTALL_FAILED']]){
  assert.equal(classifyPackageFailure(raw),code);assert(!classifyPackageFailure(raw).includes('secret'))
 }
 for(const key of ['NPM_TOKEN','NODE_AUTH_TOKEN','GH_TOKEN','GITHUB_TOKEN','SG2_PACKAGES_READ_TOKEN'])assert.equal(credentialFree({[key]:'secret'}),false)
 assert.equal(credentialFree({PATH:'/usr/bin',GITHUB_TOKEN:''}),true)
})

test('component-independent admission binds complete source versions and actual owner routes',()=>{
 assertSourceAdmission(record(),facts(),root,now)
 for(const change of [
  r=>r.status='PROPOSED',r=>r.actor='other',r=>r.repository='foreign/repo',
  r=>r.scope='DEPLOYMENT',r=>r.targetEnvironment='production',r=>r.approvalRef='',
  r=>r.validUntil='2026-11-01',r=>r.validFrom='2027-01-01',r=>r.files=[],
  r=>r.files[0].owner='SG Runtime',r=>r.files[0].projectKey='SG2',
  r=>r.files[0].blob=base,r=>r.files[0].mode='120000',r=>r.files.push({...r.files[0]})
 ]){
  const r=record();change(r);assert.throws(()=>assertSourceAdmission(r,facts(),root,now))
 }
 for(const change of [
  f=>f.files.push({...f.files[0],filename:'extra.js'}),
  f=>f.files[0].previous_filename='renamed.js',f=>f.files[0].status='removed',
  f=>f.files[0].sha=base,f=>f.candidateSha='main'
 ]){
  const f=facts();change(f);assert.throws(()=>assertSourceAdmission(record(),f,root,now))
 }
})

test('ordinary admission cannot authorize protected policy bytes or traverse directories',()=>{
 for(const name of ['Canon/new-policy.md','scripts/governance/anything.mjs','.github/workflows/ci.yml',
 'governance/routing.json','AGENTS.md','apps/sg-runtime/.npmrc','../escape','apps/../escape']){
  const r=record(),f=facts();r.files[0].path=name;f.files[0].filename=name
  assert.throws(()=>assertSourceAdmission(r,f,root,now))
 }
})

test('trusted ledger is independent of candidate data and rejects duplicates and symlink replacement',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dev-ledger-'))
 try {
  fs.mkdirSync(path.join(dir,'Canon/registries'),{recursive:true})
  const p=path.join(dir,'Canon/registries/controlled-source-admissions-v1.json')
  fs.writeFileSync(p,JSON.stringify({schemaVersion:'1.0',records:[record()]}))
  assert.equal(trustedAdmissionById(record().id,dir).sourceSha,head)
  assert.throws(()=>trustedAdmissionById('self-authored',dir))
  fs.writeFileSync(p,JSON.stringify({schemaVersion:'1.0',records:[record(),record()]}))
  assert.throws(()=>readTrustedAdmissions(dir))
  fs.unlinkSync(p);fs.symlinkSync(path.join(root,'Canon/registries/controlled-source-admissions-v1.json'),p)
  assert.throws(()=>readTrustedAdmissions(dir))
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('real Git checkout verifies reviewed source, current authority, mode, full diff, dirty bytes and refresh lineage',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dev-source-'))
 const g=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try{
  g('init');g('config','user.name','Isolated Test');g('config','user.email','isolated@example.invalid')
  const target=path.join(dir,sourcePath);fs.mkdirSync(path.dirname(target),{recursive:true})
  fs.writeFileSync(target,'export const sample = 1\n');fs.writeFileSync(path.join(dir,'authority-only.txt'),'unchanged authority\n');g('add','.');g('commit','-m','base')
  const initial=g('rev-parse','HEAD')
  fs.writeFileSync(target,'export const sample = 2\n');g('add','.');g('commit','-m','candidate')
  const candidate=g('rev-parse','HEAD'),blob=g('hash-object',sourcePath)
  const r=record();r.baseSha=initial;r.sourceSha=candidate;r.files[0].blob=blob
  r.validFrom='2020-01-01';r.validUntil='2099-01-01'
  const s={sha:candidate,controlSha:initial,actor:'profitia',files:[{filename:sourcePath,sha:blob,status:'modified'}]}
  assertSourceCheckout(dir,r,s,root)
  fs.writeFileSync(target,'dirty\n');assert.throws(()=>assertSourceCheckout(dir,r,s,root));g('checkout','--',sourcePath)
  fs.chmodSync(target,0o755);assert.throws(()=>assertSourceCheckout(dir,r,s,root));fs.chmodSync(target,0o644)
  fs.writeFileSync(path.join(dir,'authority-only.txt'),'unapproved authority edit\n')
  assert.throws(()=>assertSourceCheckout(dir,r,s,root),/SOURCE_CHECKOUT_DIRTY/);g('checkout','--','authority-only.txt')
  fs.writeFileSync(path.join(dir,'unexpected.txt'),'unreviewed')
  assert.throws(()=>assertSourceCheckout(dir,r,s,root),/SOURCE_CHECKOUT_DIRTY/)
  g('add','.');assert.throws(()=>assertSourceCheckout(dir,r,s,root),/SOURCE_CHECKOUT_DIRTY/)
  g('commit','-m','unreviewed')
  assert.throws(()=>assertSourceCheckout(dir,r,{...s,sha:g('rev-parse','HEAD')},root))
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

const mandate=()=>({id:'owner-mandate',status:'ACTIVE',approvalRef:'independent-owner-decision',validFrom:'2026-01-01',validUntil:'2026-12-01',
 projectKey:'SRM',repository:'profitia/SG-dev',taskId:'FUTURE-TASK',targetEnvironment:'development',
 businessScopeDigest:'scope-digest',operations:['implement','transport','release','change-access'],
 sourceSha:head,resourceIds:['registered-service'],costCeiling:0})
const operation=()=>({projectKey:'SRM',repository:'profitia/SG-dev',taskId:'FUTURE-TASK',targetEnvironment:'development',
 businessScopeDigest:'scope-digest',kind:'transport',sourceSha:head,costCeiling:0})

test('same valid scope reuses the recorded mandate while new authority remains a real decision',()=>{
 assert.equal(assertOperationWithinMandate(mandate(),operation(),now).newAuthorityGranted,false)
 for(const delta of [{targetEnvironment:'staging'},{taskId:'other'},{projectKey:'CIC'},
 {businessScopeDigest:'changed'},{kind:'change-access'},{kind:'unapproved'},{costCeiling:1},
 {sourceSha:base},{resourceId:'unregistered'}])assert.throws(()=>assertOperationWithinMandate(mandate(),{...operation(),...delta},now))
 assert.throws(()=>assertOperationWithinMandate({...mandate(),revoked:true},operation(),now))
 assert.throws(()=>assertOperationWithinMandate({...mandate(),validUntil:'2026-11-01'},operation(),now))
})

test('release and rollback preserve newer parallel deployments and do not imply a database restore',()=>{
 const x={requestedSha:head,resourceId:'service',expectedLiveDeployId:'live',
 observed:{resourceId:'service',environment:'development',liveDeployId:'live',inProgressDeployIds:[],migrationInProgress:false,capturedAt:new Date(now).toISOString()},
 lkg:{resourceId:'service',sourceSha:head,artifactDigest:'sha256:'+'c'.repeat(64),configurationRef:'config',recoveryProcedureRef:'runbook',databaseRollbackRequired:false}}
 assertReleaseState(x,now);assertReleaseState({...x,rollback:true},now)
 for(const delta of [{liveDeployId:'newer'},{inProgressDeployIds:['another-task']},{migrationInProgress:true},{environment:'production'}]){
  assert.throws(()=>assertReleaseState({...x,observed:{...x.observed,...delta}},now))
 }
 assert.throws(()=>assertReleaseState({...x,rollback:true,lkg:{...x.lkg,databaseRollbackRequired:true}},now))
})

test('resume selects the first unverified operation only after same-owner state reconciliation',()=>{
 const journal={operationId:'op',sourceSha:head,generation:3,owner:'original-executor',steps:[{id:'done',status:'VERIFIED'},{id:'next',status:'INTENT_RECORDED'}]}
 const observed={operationId:'op',sourceSha:head,generation:3,owner:'original-executor',previousExecutorFinished:true,ambiguousEffect:false}
 assert.equal(resumePoint(journal,observed),'next')
 for(const delta of [{sourceSha:base},{generation:4},{owner:'parallel-executor'},{previousExecutorFinished:false},{ambiguousEffect:true}]){
  assert.throws(()=>resumePoint(journal,{...observed,...delta}))
 }
 assert.throws(()=>resumePoint({...journal,completed:true},observed))
})

test('versioned generic proof binds trusted data, real workflow, candidate and complete result without a historical task ID',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dev-proof-'))
 try{
  fs.mkdirSync(path.join(dir,'Canon/registries'),{recursive:true})
  for(const name of ['profitia-projects-v1.json','current-architecture-baseline-v1.json']){
    fs.copyFileSync(path.join(root,'Canon/registries',name),path.join(dir,'Canon/registries',name))
  }
  const r=record();r.validFrom='2000-01-01';r.validUntil='2099-01-01'
  fs.writeFileSync(path.join(dir,'Canon/registries/controlled-source-admissions-v1.json'),JSON.stringify({schemaVersion:'1.0',records:[r]}))
  const digest='c'.repeat(64)
  const run={id:123,workflow_id:456,repository:{full_name:'profitia/SG-dev'},head_branch:'main',head_sha:base,event:'workflow_dispatch',actor:{login:'profitia'},conclusion:'success'}
  const p={schemaVersion:'2.0',repository:'profitia/SG-dev',workflow:'.github/workflows/platform-contracts-ci.yml',
    scope:'EXACT_SOURCE_VALIDATION',targetEnvironment:'development',candidateSha:head,controlSha:base,runId:'123',
    executionWorkspace:'ISOLATED_GIT_CHECKOUT',executionCheckoutSha:head,sourceInputVerifiedBeforeExecution:true,sourceInputVerifiedAfterExecution:true,
    controlPolicyDigest:digest,sourceAdmissionId:r.id,sourceAdmissionDigest:sourceAdmissionDigest(r),originalSourceSha:head,
    credentialRemovedBeforeCandidateExecution:true,privatePackageArtifactsPublished:false,productDeploymentPerformed:false,
    customerIdentityAdapterVerified:false,install:'CLEAN_REGISTRY_IGNORE_SCRIPTS',tests:'PASS',typecheck:'PASS',build:'PASS'}
  assertSourceValidationProof(p,run,head,456,{expectedControlDigest:digest},dir)
  const ledgerPath=path.join(dir,'Canon/registries/controlled-source-admissions-v1.json')
  fs.writeFileSync(ledgerPath,JSON.stringify({schemaVersion:'1.0',records:[r,{...r,id:'unrelated-task',sourceSha:'e'.repeat(40)}]}))
  assertSourceValidationProof(p,run,head,456,{expectedControlDigest:digest},dir)
  fs.writeFileSync(ledgerPath,JSON.stringify({schemaVersion:'1.0',records:[{...r,status:'REVOKED'}]}))
  assert.throws(()=>assertSourceValidationProof(p,run,head,456,{expectedControlDigest:digest},dir))
  fs.writeFileSync(ledgerPath,JSON.stringify({schemaVersion:'1.0',records:[r]}))
  for(const delta of [{candidateSha:base},{sourceAdmissionDigest:'0'.repeat(64)},{tests:'SKIPPED'},
    {sourceAdmissionId:'self-authorized'},{productDeploymentPerformed:true},{scope:'LIVE_PRODUCT'},
    {executionWorkspace:undefined},{executionWorkspace:'MUTABLE_SOURCE_ROOT'},{executionCheckoutSha:base},
    {sourceInputVerifiedBeforeExecution:false},{sourceInputVerifiedAfterExecution:false}]){
    assert.throws(()=>assertSourceValidationProof({...p,...delta},run,head,456,{expectedControlDigest:digest},dir))
  }
  for(const delta of [{actor:{login:'foreign'}},{conclusion:'failure'},{head_branch:'feature'},{head_sha:head}]){
    assert.throws(()=>assertSourceValidationProof(p,{...run,...delta},head,456,{expectedControlDigest:digest},dir))
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('trusted controller resolves a generic owner-routed record and rejects an API pagination/head race',async()=>{
 const {resolveCandidateAdmission}=await import('./controlled-package-ci.mjs')
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dev-resolution-'))
 try{
  fs.mkdirSync(path.join(dir,'Canon/registries'),{recursive:true})
  for(const name of ['profitia-projects-v1.json','current-architecture-baseline-v1.json']){
    fs.copyFileSync(path.join(root,'Canon/registries',name),path.join(dir,'Canon/registries',name))
  }
  const r=record();r.validFrom='2000-01-01';r.validUntil='2099-01-01'
  fs.writeFileSync(path.join(dir,'Canon/registries/controlled-source-admissions-v1.json'),JSON.stringify({schemaVersion:'1.0',records:[r]}))
  const c={repository:r.repository,ref:'refs/heads/main',workflowRef:r.repository+'/.github/workflows/platform-contracts-ci.yml@refs/heads/main',
    event:'workflow_dispatch',actor:'profitia',triggeringActor:'profitia',controlSha:base}
  const pr={number:17,state:'open',user:{login:'profitia'},changed_files:1,
    base:{ref:'main',sha:base,repo:{full_name:r.repository}},
    head:{ref:'architecture/independent-future-source',sha:head,repo:{full_name:r.repository}}}
  const files=facts().files
  const request=async endpoint=>({data:endpoint.includes('/files?')?files:pr})
  const result=await resolveCandidateAdmission(c,'17',head,request,dir)
  assert.equal(result.admission.kind,'TRUSTED_RECORD');assert.equal(result.admission.recordId,r.id)
  let metadataReads=0
  await assert.rejects(()=>resolveCandidateAdmission(c,'17',head,async endpoint=>{
    if(endpoint.includes('/files?'))return {data:files}
    return {data:++metadataReads===1?pr:{...pr,head:{...pr.head,sha:base}}}
  },dir))
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('source refresh incorporates independently advanced main while retaining exactly the reviewed blobs',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dev-refresh-'))
 const g=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try{
  g('init');g('config','user.name','Isolated Test');g('config','user.email','isolated@example.invalid')
  const target=path.join(dir,sourcePath);fs.mkdirSync(path.dirname(target),{recursive:true})
  fs.writeFileSync(target,'before\n');g('add','.');g('commit','-m','base')
  const initial=g('rev-parse','HEAD')
  g('checkout','-b','source');fs.writeFileSync(target,'reviewed\n');g('add','.');g('commit','-m','reviewed')
  const original=g('rev-parse','HEAD'),blob=g('hash-object',sourcePath)
  g('checkout','-b','control',initial);fs.writeFileSync(path.join(dir,'authority.txt'),'independent-main\n');g('add','.');g('commit','-m','authority')
  const authority=g('rev-parse','HEAD')
  g('checkout','source');g('merge','--no-edit','control')
  const refreshed=g('rev-parse','HEAD'),r=record()
  Object.assign(r,{baseSha:initial,sourceSha:original,validFrom:'2000-01-01',validUntil:'2099-01-01'});r.files[0].blob=blob
  const state={sha:refreshed,controlSha:authority,actor:'profitia',files:[{filename:sourcePath,sha:blob,status:'modified'}]}
  assertSourceCheckout(dir,r,state,root)
  assert.throws(()=>assertSourceCheckout(dir,r,{...state,controlSha:original},root))
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('generic dependency validation accepts the actual authority tree without a task-specific source projector',async()=>{
 const {checkAdmittedPackages}=await import('./controlled-package-ci.mjs')
 assert.equal(checkAdmittedPackages(root),path.join(root,'apps/sg-runtime'))
})

test('generic package policy accepts only identical authority peers and refuses even historically accepted alternate private pins',async()=>{
 const {assertPackagePolicy,assertManifestPolicy,PRIVATE_PACKAGES,LOCAL_PACKAGES,CIC_ANALYTICAL_ECR_PIN}=await import('./controlled-package-ci.mjs')
 const packages=Object.fromEntries(PRIVATE_PACKAGES.map(name=>['node_modules/'+name,{version:'1.0.0',integrity:'sha512-approved'}]))
 packages['']={name:'@sg/runtime',dependencies:{'@profitia/cic-core':'1.0.0'}}
 packages['node_modules/@profitia/maps-embed']={version:'0.1.2',resolved:LOCAL_PACKAGES['@profitia/maps-embed'],peerDependencies:{'@profitia/platform-contracts':'1.200.0','@profitia/maps-contracts':'1.200.0'}}
 const authority={lockfileVersion:3,packages},candidate=structuredClone(authority)
 const config='@profitia:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NPM_TOKEN}\n'
 assertPackagePolicy(candidate,authority,config,{trustedAuthorityMetadata:true})
 const broadened=structuredClone(candidate);broadened.packages['node_modules/@profitia/maps-embed'].peerDependencies['@profitia/platform-contracts']='^1.200.0'
 assert.throws(()=>assertPackagePolicy(broadened,authority,config,{trustedAuthorityMetadata:true}))
 const historicalPeer=structuredClone(candidate);historicalPeer.packages['node_modules/@profitia/maps-embed'].peerDependencies['@profitia/maps-contracts']='0.1.0'
 assert.throws(()=>assertPackagePolicy(historicalPeer,authority,config,{trustedAuthorityMetadata:true}))
 const alternate=structuredClone(candidate);alternate.packages[''].dependencies['@profitia/cic-core']=CIC_ANALYTICAL_ECR_PIN.version
 alternate.packages['node_modules/@profitia/cic-core']={...CIC_ANALYTICAL_ECR_PIN}
 assert.throws(()=>assertPackagePolicy(alternate,authority,config,{trustedAuthorityMetadata:true}))
 const accepted={name:'@profitia/maps-embed',peerDependencies:{'@profitia/platform-contracts':'1.200.0'}}
 assertManifestPolicy(accepted,accepted,{trustedAuthorityMetadata:true})
 assert.throws(()=>assertManifestPolicy({...accepted,peerDependencies:{'@profitia/platform-contracts':'^1.200.0'}},accepted,{trustedAuthorityMetadata:true}))
})

test('accepted-main proof cannot validate a foreign PR SHA or borrow a source admission',()=>{
 const digest='d'.repeat(64),run={id:91,workflow_id:7,repository:{full_name:'profitia/SG-dev'},head_branch:'main',head_sha:head,event:'push',actor:{login:'profitia'},conclusion:'success'}
 const p={schemaVersion:'2.0',repository:'profitia/SG-dev',workflow:'.github/workflows/platform-contracts-ci.yml',
  scope:'AUTHORITY_MAIN_VALIDATION',targetEnvironment:'development',candidateSha:head,controlSha:head,runId:91,controlPolicyDigest:digest,
  credentialRemovedBeforeCandidateExecution:true,privatePackageArtifactsPublished:false,productDeploymentPerformed:false,
  customerIdentityAdapterVerified:false,install:'CLEAN_REGISTRY_IGNORE_SCRIPTS',tests:'PASS',typecheck:'PASS',build:'PASS'}
 assertSourceValidationProof(p,run,head,7,{expectedControlDigest:digest})
 assert.throws(()=>assertSourceValidationProof({...p,candidateSha:base},run,base,7,{expectedControlDigest:digest}))
 assert.throws(()=>assertSourceValidationProof({...p,sourceAdmissionId:'borrowed'},run,head,7,{expectedControlDigest:digest}))
 assert.throws(()=>assertSourceValidationProof(p,run,head,7))
})

test('a first deployment requires real absence of a prior deploy and an explicit abort procedure',()=>{
 const x={requestedSha:head,resourceId:'existing-service',expectedLiveDeployId:null,
 observed:{resourceId:'existing-service',environment:'development',liveDeployId:null,inProgressDeployIds:[],migrationInProgress:false,capturedAt:new Date(now).toISOString()},
 lkg:{type:'FIRST_DEPLOYMENT',resourceId:'existing-service',configurationRef:'accepted-config',abortProcedureRef:'accepted-abort'}}
 assertReleaseState(x,now)
 assert.throws(()=>assertReleaseState({...x,rollback:true},now))
 assert.throws(()=>assertReleaseState({...x,lkg:{...x.lkg,abortProcedureRef:null}},now))
 assert.throws(()=>assertReleaseState({...x,observed:{...x.observed,liveDeployId:'already-live'}},now))
})

test('source proposal derives actual Git blobs and routing while remaining inert and unable to approve itself',async()=>{
 const {proposeSourceAdmission}=await import('./development-execution.mjs')
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dev-proposal-'))
 const g=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try{
  g('init');g('config','user.name','Isolated Test');g('config','user.email','isolated@example.invalid');g('remote','add','origin','https://github.com/profitia/SG-dev')
  const p=path.join(dir,sourcePath);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'before\n');g('add','.');g('commit','-m','base');const baseline=g('rev-parse','HEAD')
  fs.writeFileSync(p,'after\n');g('add','.');g('commit','-m','source');const candidate=g('rev-parse','HEAD')
  const result=proposeSourceAdmission({projectKey:'ARCHITECTURE',taskId:'UNRELATED-TASK',baseSha:baseline,sourceSha:candidate,repositoryRoot:dir})
  assert.equal(result.status,'PROPOSED');assert.equal(result.approvalRef,null);assert.equal(result.actor,null)
  assert.equal(result.files[0].blob,g('hash-object',sourcePath));assert.equal(result.files[0].owner,'Architecture Platform')
  assert.throws(()=>assertSourceAdmission(result,{repository:result.repository,actor:'profitia',candidateSha:candidate,currentMainSha:baseline,files:[{filename:sourcePath,sha:result.files[0].blob,status:'modified'}]},root,now))
  fs.mkdirSync(path.join(dir,'Canon'));fs.writeFileSync(path.join(dir,'Canon/policy.md'),'protected');g('add','.');g('commit','-m','protected')
  assert.throws(()=>proposeSourceAdmission({projectKey:'ARCHITECTURE',taskId:'UNRELATED-TASK',baseSha:baseline,sourceSha:g('rev-parse','HEAD'),repositoryRoot:dir}))
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

import {trustedApplicationContinuity} from './development-execution.mjs'
import {resolveProjectProfile as continuityProfile} from './project-profile.mjs'
import {resolveProjectRouting as continuityRoute} from './routing-engine.mjs'

const continuityPath='apps/sg-runtime/components/procurement-insights/continuity-fixture.tsx'
function continuityFixture(changeRecord=r=>r,{candidateLedger=false,trackedPath=continuityPath,extras={}}={}) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'application-continuity-'))
 const g=(...a)=>execFileSync('git',a,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 const write=(p,s)=>{const f=path.join(dir,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
 g('init','-b','main');g('config','user.name','Synthetic fixture');g('config','user.email','synthetic@example.invalid')
 g('remote','add','origin','https://github.com/profitia/SG-dev')
 write(trackedPath,'export const sample=1\n');write('unchanged.txt','immutable\n');for(const[p,bytes]of Object.entries(extras))write(p,bytes);g('add','.');g('commit','-m','synthetic base')
 const initial=g('rev-parse','HEAD');g('checkout','-b','candidate')
 write(trackedPath,'export const sample=2\n');g('add','.');g('commit','-m','synthetic reviewed source')
 const original=g('rev-parse','HEAD'),blob=g('hash-object',trackedPath)
 const route=continuityRoute({profile:continuityProfile('SG2',root),targets:[trackedPath],repositoryRoot:root}).results[0]
 const r=changeRecord({...record(),id:'SYNTHETIC_APPLICATION_REVIEW',sourceSha:original,baseSha:initial,
  validFrom:'2000-01-01T00:00:00Z',validUntil:'2099-01-01T00:00:00Z',
  files:[{path:trackedPath,blob,status:'modified',mode:'100644',projectKey:'SG2',owner:route.currentOwner,surfaceId:route.matchedSurfaceId}]})
 g('checkout','main');write('Canon/registries/controlled-source-admissions-v1.json',JSON.stringify({schemaVersion:'1.0',records:candidateLedger?[]:[r]}))
 g('add','.');g('commit','-m','synthetic independent authority')
 const authority=g('rev-parse','HEAD');g('update-ref','refs/remotes/origin/main',authority)
 g('checkout','candidate');g('merge','--no-edit','main')
 const check=()=>trustedApplicationContinuity(dir,[trackedPath],{authorityRoot:dir,governanceRoot:root})
 return {dir,g,write,r,initial,original,authority,check,close:()=>fs.rmSync(dir,{recursive:true,force:true})}
}

test('historical application compatibility authenticates fetched authority or a complete independently admitted real Git candidate',()=>{
 const f=continuityFixture()
 try {
  const read=f.check();assert.equal(read(continuityPath).toString(),'export const sample=2\n')
  const b=read(continuityPath);b.fill(0);assert.equal(read(continuityPath).toString(),'export const sample=2\n','read returns defensive byte copies')
  assert.throws(()=>read('unchanged.txt'),/APPLICATION_CONTINUITY_PATH_REJECTED/)
  f.g('checkout','main');assert.equal(f.check()(continuityPath).toString(),'export const sample=1\n')
 }finally{f.close()}
})

for(const [name,edit,pattern]of [
 ['expiry',r=>({...r,validUntil:'2001-01-01T00:00:00Z'}),/SOURCE_ADMISSION_EXPIRED/],
 ['revocation',r=>({...r,status:'REVOKED'}),/SOURCE_ADMISSION_IDENTITY_REJECTED/],
 ['missing owner decision',r=>({...r,approvalRef:null}),/SOURCE_ADMISSION_IDENTITY_REJECTED/],
 ['wrong owner',r=>({...r,files:r.files.map(x=>({...x,owner:'unapproved'}))}),/SOURCE_ADMISSION_ROUTING_REJECTED/],
 ['wrong surface',r=>({...r,files:r.files.map(x=>({...x,surfaceId:'unapproved'}))}),/SOURCE_ADMISSION_ROUTING_REJECTED/],
 ['wrong Git base',r=>({...r,baseSha:'f'.repeat(40)}),/SOURCE_BASE_OR_LINEAGE_REJECTED/]
])test('historical source compatibility rejects '+name,()=>{
 const f=continuityFixture(edit);try{assert.throws(f.check,pattern)}finally{f.close()}
})

test('a candidate cannot supply its own ledger or replace its trusted main decision',()=>{
 const f=continuityFixture(r=>r,{candidateLedger:true})
 try{
  f.write('Canon/registries/controlled-source-admissions-v1.json',JSON.stringify({schemaVersion:'1.0',records:[f.r]}))
  f.g('add','.');f.g('commit','-m','synthetic self approval')
  assert.equal(f.check(),null)
 }finally{f.close()}
})

for(const [name,mutate]of [
 ['changed bytes',f=>f.write(continuityPath,'unreviewed\n')],
 ['changed executable mode',f=>fs.chmodSync(path.join(f.dir,continuityPath),0o755)],
 ['omitted source',f=>fs.unlinkSync(path.join(f.dir,continuityPath))],
 ['symlink',f=>{fs.unlinkSync(path.join(f.dir,continuityPath));fs.symlinkSync(path.join(f.dir,'unchanged.txt'),path.join(f.dir,continuityPath))}],
 ['additional untracked source',f=>f.write('unexpected.ts','unreviewed\n')],
 ['tracked authority edit',f=>f.write('unchanged.txt','changed\n')],
 ['staged authority edit',f=>{f.write('unchanged.txt','changed\n');f.g('add','unchanged.txt')}],
 ['extra committed source',f=>{f.write('unexpected.ts','unreviewed\n');f.g('add','.');f.g('commit','-m','synthetic extra source')}],
 ['candidate receipt modification',f=>f.write('apps/sg-runtime/assistant-notifications-integration.json','unreviewed receipt\n')]
])test('historical compatibility fails closed on '+name,()=>{
 const f=continuityFixture()
 try{mutate(f);let result=null;try{result=f.check()}catch{return}assert.equal(result,null)}finally{f.close()}
})

test('accepted actual main bytes do not borrow an expired source-validation mandate',()=>{
 const f=continuityFixture(r=>({...r,validUntil:'2001-01-01T00:00:00Z'}))
 try{
  assert.throws(f.check,/SOURCE_ADMISSION_EXPIRED/)
  f.g('checkout','main');f.g('merge','--no-edit','candidate')
  f.g('update-ref','refs/remotes/origin/main',f.g('rev-parse','HEAD'))
  assert.equal(f.check()(continuityPath).toString(),'export const sample=2\n','fresh independently accepted main is its own source authority')
 }finally{f.close()}
})

test('compatibility never authorises receipt, SQL, workflow, package or contract paths',()=>{
 const f=continuityFixture()
 try{for(const p of ['Canon/registries/controlled-source-admissions-v1.json','.github/workflows/platform-contracts-ci.yml',
  'apps/sg-runtime/assistant-notifications-integration.json','apps/sg-runtime/package.json',
  'packages/platform-contracts/src/operation-context.mjs','apps/insights-runtime/sql/003-report-subscriptions.sql'])
  assert.throws(()=>trustedApplicationContinuity(f.dir,[p],{authorityRoot:f.dir,governanceRoot:root}),/APPLICATION_CONTINUITY_PATH_REJECTED/)
 }finally{f.close()}
})


const literalReportRoute='apps/sg-runtime/app/api/v1/insights/[...report]/route.ts'
const reportRouteDecoy='apps/sg-runtime/app/api/v1/insights/r/route.ts'
const literalRouteFixture=()=>continuityFixture(r=>r,{trackedPath:literalReportRoute,extras:{[reportRouteDecoy]:'export const decoy=true\n'}})

test('the one literal report route binds its own Git blob, full checkout and accepted authority despite a glob-shaped decoy',async()=>{
 const {proposeSourceAdmission}=await import('./development-execution.mjs')
 const f=literalRouteFixture()
 try{
  const proposed=proposeSourceAdmission({projectKey:'SG2',taskId:'SYNTHETIC_LITERAL_ROUTE',sourceSha:f.original,baseSha:f.initial,repositoryRoot:f.dir})
  assert.equal(proposed.status,'PROPOSED');assert.equal(proposed.approvalRef,null)
  assert.equal(proposed.files.length,1);assert.equal(proposed.files[0].path,literalReportRoute)
  assert.equal(proposed.files[0].blob,f.g('hash-object',literalReportRoute))
  assert.notEqual(proposed.files[0].blob,f.g('hash-object',reportRouteDecoy))
  const state={sha:f.g('rev-parse','HEAD'),controlSha:f.authority,actor:'profitia',files:f.r.files.map(x=>({filename:x.path,sha:x.blob,status:x.status}))}
  assert.throws(()=>assertSourceAdmission(proposed,{repository:proposed.repository,actor:'profitia',candidateSha:f.original,currentMainSha:f.authority,files:state.files},root),/SOURCE_ADMISSION_IDENTITY_REJECTED/)
  assertSourceCheckout(f.dir,f.r,state,root)
  const read=f.check();assert.equal(read(literalReportRoute).toString(),'export const sample=2\n')
  assert.throws(()=>read(reportRouteDecoy),/APPLICATION_CONTINUITY_PATH_REJECTED/)
  f.g('checkout','main');assert.equal(f.check()(literalReportRoute).toString(),'export const sample=1\n')
 }finally{f.close()}
})

test('the literal route exception rejects neighbouring bracket names, suffixes, case changes and traversal',()=>{
 const names=[literalReportRoute.replace('[...report]','[report]'),literalReportRoute.replace('[...report]','[...reports]'),
  literalReportRoute.replace('[...report]','[...Report]'),literalReportRoute.replace('[...report]','x[...report]'),
  literalReportRoute+'.bak',literalReportRoute+'/',literalReportRoute+'/extra','/'+literalReportRoute,
  literalReportRoute.replace('/insights/','/insights/../'),literalReportRoute.replace('/insights/','/insights//'),
  literalReportRoute.replace('/insights/','/insights/'+String.fromCharCode(92)),literalReportRoute+String.fromCharCode(0)]
 for(const name of names){
  const r=record(),f=facts();r.files[0]={...r.files[0],path:name,projectKey:'SG2'};f.files[0].filename=name
  assert.throws(()=>assertSourceAdmission(r,f,root,now),/SOURCE_ADMISSION_FILES_REJECTED/,name)
 }
})

test('real Git proposals cannot extend the literal exception to another bracketed Next route',async()=>{
 const {proposeSourceAdmission}=await import('./development-execution.mjs')
 const f=continuityFixture(r=>r,{trackedPath:literalReportRoute.replace('[...report]','[report]')})
 try{assert.throws(()=>proposeSourceAdmission({projectKey:'SG2',taskId:'SYNTHETIC_OTHER_ROUTE',sourceSha:f.original,baseSha:f.initial,repositoryRoot:f.dir}),/SOURCE_PROPOSAL_PROTECTED_OR_UNSUPPORTED_PATH/)}finally{f.close()}
})

test('the decoy blob cannot replace the literal route in an otherwise internally matching admission',()=>{
 const f=literalRouteFixture()
 try{
  const r=structuredClone(f.r);r.files[0].blob=f.g('hash-object',reportRouteDecoy)
  const state={sha:f.g('rev-parse','HEAD'),controlSha:f.authority,actor:'profitia',files:r.files.map(x=>({filename:x.path,sha:x.blob,status:x.status}))}
  assert.throws(()=>assertSourceCheckout(f.dir,r,state,root),/SOURCE_PHYSICAL_FILE_REJECTED/)
 }finally{f.close()}
})

for(const [name,mutate]of[
 ['changed bytes',f=>f.write(literalReportRoute,'unreviewed\n')],
 ['executable mode',f=>fs.chmodSync(path.join(f.dir,literalReportRoute),0o755)],
 ['symlink',f=>{fs.unlinkSync(path.join(f.dir,literalReportRoute));fs.symlinkSync(path.join(f.dir,'unchanged.txt'),path.join(f.dir,literalReportRoute))}]
])test('literal route preserves physical source refusal: '+name,()=>{
 const f=literalRouteFixture();try{mutate(f);if(name==='changed bytes')assert.equal(f.check(),null);else assert.throws(f.check)}finally{f.close()}
})

for(const mode of['executable','symlink'])test('a regular decoy cannot hide '+mode+' mode in the actual authority route',()=>{
 const f=literalRouteFixture()
 try{
  f.g('checkout','main')
  if(mode==='executable')fs.chmodSync(path.join(f.dir,literalReportRoute),0o755)
  else{fs.unlinkSync(path.join(f.dir,literalReportRoute));fs.symlinkSync('unchanged.txt',path.join(f.dir,literalReportRoute))}
  f.g('--literal-pathspecs','add','--',literalReportRoute);f.g('commit','-m','synthetic invalid authority mode')
  f.g('update-ref','refs/remotes/origin/main',f.g('rev-parse','HEAD'))
  if(mode==='executable')fs.chmodSync(path.join(f.dir,literalReportRoute),0o644)
  else{fs.unlinkSync(path.join(f.dir,literalReportRoute));f.write(literalReportRoute,'unchanged.txt')}
  assert.throws(f.check,/APPLICATION_CONTINUITY_AUTHORITY_MODE_REJECTED/)
 }finally{f.close()}
})
