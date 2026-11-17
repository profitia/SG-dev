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
function continuityFixture(changeRecord=r=>r,{candidateLedger=false}={}) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'application-continuity-'))
 const g=(...a)=>execFileSync('git',a,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 const write=(p,s)=>{const f=path.join(dir,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
 g('init','-b','main');g('config','user.name','Synthetic fixture');g('config','user.email','synthetic@example.invalid')
 g('remote','add','origin','https://github.com/profitia/SG-dev')
 write(continuityPath,'export const sample=1\n');write('unchanged.txt','immutable\n');g('add','.');g('commit','-m','synthetic base')
 const initial=g('rev-parse','HEAD');g('checkout','-b','candidate')
 write(continuityPath,'export const sample=2\n');g('add','.');g('commit','-m','synthetic reviewed source')
 const original=g('rev-parse','HEAD'),blob=g('hash-object',continuityPath)
 const route=continuityRoute({profile:continuityProfile('SG2',root),targets:[continuityPath],repositoryRoot:root}).results[0]
 const r=changeRecord({...record(),id:'SYNTHETIC_APPLICATION_REVIEW',sourceSha:original,baseSha:initial,
  validFrom:'2000-01-01T00:00:00Z',validUntil:'2099-01-01T00:00:00Z',
  files:[{path:continuityPath,blob,status:'modified',mode:'100644',projectKey:'SG2',owner:route.currentOwner,surfaceId:route.matchedSurfaceId}]})
 g('checkout','main');write('Canon/registries/controlled-source-admissions-v1.json',JSON.stringify({schemaVersion:'1.0',records:candidateLedger?[]:[r]}))
 g('add','.');g('commit','-m','synthetic independent authority')
 const authority=g('rev-parse','HEAD');g('update-ref','refs/remotes/origin/main',authority)
 g('checkout','candidate');g('merge','--no-edit','main')
 const check=()=>trustedApplicationContinuity(dir,[continuityPath],{authorityRoot:dir,governanceRoot:root})
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

const reservationAdmissionFixture={"id":"ARCHITECTURE:ARCH-ACG-M1M2-COMPLETION-20261117","status":"PROPOSED","repository":"profitia/SG-dev","actor":null,"taskId":"ARCH-ACG-M1M2-COMPLETION-20261117","targetEnvironment":"development","scope":"SOURCE_VALIDATION_ONLY","approvalRef":null,"sourceSha":"97853df58a6a3822a50f64e0207fc0bbb1abbd92","baseSha":"56dcedb243d5d9568e3bd9cc3e13836f4e8b24bb","validFrom":null,"validUntil":null,"files":[{"path":"apps/architecture-lab/assistant-reservation-source.json","blob":"8d7bcf8966f26f62eaa5d4499382a286fbc45ff5","mode":"100644","status":"added","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},{"path":"apps/architecture-lab/private-recurring-source.mjs","blob":"028efb927bf0f0ee7233a360157349cbcc1e2c7c","mode":"100644","status":"modified","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},{"path":"apps/architecture-lab/test/market-calendar-source.test.mjs","blob":"2838e60d52f755e21dba0f4b00903304cd242dc4","mode":"100644","status":"modified","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},{"path":"apps/architecture-lab/test/sdk-compatibility.test.mjs","blob":"bff15c73d68558a2035562a7b406c3ad16499871","mode":"100644","status":"modified","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},{"path":"apps/package-limits/migrations/006-assistant-reservation-diagnostics.sql","blob":"582d49c91be12663b3daf77061c64e2db0b1cf3b","mode":"100644","status":"added","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"LIMITS-BASE-001"},{"path":"apps/package-limits/test/database.test.mjs","blob":"24887cc4294c2a14d60a94159b97d125fe4be046","mode":"100644","status":"modified","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"LIMITS-BASE-001"},{"path":"apps/sg-runtime/lib/assistant/conversation.ts","blob":"a2cb781736ea7014450ea968a4cb4dd65066fd40","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/lib/assistant/model.ts","blob":"514d3df4b47c38cd8cafd776d366ba7310cd83ef","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/lib/assistant/runtime.ts","blob":"88cda9802aa0b14617720ed7b17db7b4164d5767","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/assistant-conversation-handler.test.ts","blob":"93eda325b65dbf097e8a52e40bea7b05f6400b3a","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs","blob":"7905d1891ec77bc69e07763c5bfa22c45d65f58d","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/assistant-model.test.ts","blob":"ee853da80969ab76bdc02b7901ad1e1bc7089674","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","blob":"4c47911446870bc8f036595ee901845b170fb6e5","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/market-calendar-integrity.test.mjs","blob":"3ea7b69685ba6d72686f25b485fbd4d265e1e7df","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/operation-context.test.mjs","blob":"df6a3de6003bcbf7891f1b64df0b3618a655acd3","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/pci-smart-integrity.test.mjs","blob":"dc12a2b45eee9162189e32a136655c08b24ec698","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/porr-demo-middleware.test.ts","blob":"1e8ca6daeb1556d0b42a43b5958d1547fb4a7191","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/private-host.integration.test.mjs","blob":"62f0c6a25a25824e03abe30975adab521f11d6f3","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/procurement-insights-completion.test.mjs","blob":"44bf99607822c22914a519533f10a4eda5ccdb38","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/procurement-insights-live-acceptance-source.test.mjs","blob":"678db1a73f631c2060a549a5a22d3e1fec76bf3d","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","blob":"ef9f9af804a6f832c20e1de7e2aa88f6f39068e5","mode":"100644","status":"modified","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},{"path":"apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs","blob":"1fadc475cbc78cab4e9c0cd79c3b0c67eaea1994","mode":"100644","status":"modified","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},{"path":"apps/srm/scripts/native-execution-adoption.test.mjs","blob":"997a89829319d309a995b0e45687a32592fb5a30","mode":"100644","status":"modified","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},{"path":"apps/srm/scripts/operation-context.test.mjs","blob":"bf88f2fc7ae073f58a52c4fc58e92398742e80c1","mode":"100644","status":"modified","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},{"path":"apps/srm/scripts/private-host.integration.test.mjs","blob":"e66267247831533b54cef7366ed77da7d9daf173","mode":"100644","status":"modified","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},{"path":"apps/srm/scripts/request-quota-adoption.test.mjs","blob":"7c442fe12340ff5cd8cd7830085e4fabd07b715e","mode":"100644","status":"modified","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},{"path":"apps/srm/scripts/supplier-location-admission.integration.test.mjs","blob":"4f417b8cd4bba33773f38865e910014b7adc054d","mode":"100644","status":"modified","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},{"path":"apps/srm/scripts/xray-performance-adoption.test.mjs","blob":"c6e81048b4292b048c77dffdccbe49dd7ceedf9e","mode":"100644","status":"modified","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},{"path":"apps/srm/src/server/root-atomic-claim-adoption.test.ts","blob":"99bf0c3bb83e731f37d6c36bee3d430cee094931","mode":"100644","status":"modified","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},{"path":"packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs","blob":"ee338b06485c73dc917f6c1c5498d57527f6bda8","mode":"100644","status":"modified","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},{"path":"packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs","blob":"5f1d87555bf7d699000d0ecf1185a3005e00e6f1","mode":"100644","status":"modified","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},{"path":"packages/platform-contracts/src/assistant-usage.d.mts","blob":"892420ff3e7ff709bf3696d06272cea889427378","mode":"100644","status":"modified","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},{"path":"packages/platform-contracts/src/assistant-usage.mjs","blob":"f44757eac744e0e9d83cb90c932879594f98dfea","mode":"100644","status":"modified","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},{"path":"packages/platform-contracts/test/assistant-reservation-source.mjs","blob":"e4a736a0d2dcc15f7ec5a471db599e4680ee2716","mode":"100644","status":"added","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},{"path":"packages/platform-contracts/test/assistant-reservation-source.test.mjs","blob":"12f14bb522501e4b0dffa33f2e20dff6aa04d849","mode":"100644","status":"added","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},{"path":"packages/platform-contracts/test/assistant-usage.test.mjs","blob":"aa3c83dded41ed761120f73fb86da3d8fdb22e47","mode":"100644","status":"modified","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},{"path":"packages/platform-contracts/test/private-operation-host.test.mjs","blob":"1a99d4e04f37ee7c1ae883faa3f332c7d3202879","mode":"100644","status":"modified","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},{"path":"packages/platform-contracts/test/recurring-consent-transport.test.mjs","blob":"2772fa919985b6149f3c0d77f79a477f1b3191ae","mode":"100644","status":"modified","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}]}

// A new source record may be validated only as part of this complete, independently
// admitted owner composition. The fixture is metadata; no activation is performed.
test('closed reservation source record uses existing exact-source validation for all three owners',()=>{
 const r={...structuredClone(reservationAdmissionFixture),status:'ACTIVE',actor:'profitia',approvalRef:'isolated-owner-decision',validFrom:'2026-11-01T00:00:00Z',validUntil:'2026-12-01T00:00:00Z'}
 const f={repository:r.repository,actor:r.actor,candidateSha:r.sourceSha,currentMainSha:r.baseSha,files:r.files.map(e=>({filename:e.path,sha:e.blob,status:e.status}))}
 assert.equal(r.files.length,38)
 assert.deepEqual([...new Set(r.files.map(e=>e.projectKey))].sort(),['ARCHITECTURE','SG2','SRM'])
 assert.equal(assertSourceAdmission(r,f,root,now),r)
 assert.throws(()=>assertSourceAdmission({...r,status:'PROPOSED'},f,root,now))
 assert.throws(()=>assertSourceAdmission({...r,approvalRef:null},f,root,now))
 assert.throws(()=>assertSourceAdmission({...r,validUntil:'2026-11-01'},f,root,now))
 const mutations=[
  x=>{x.id+='-other'},x=>{x.sourceSha='c'.repeat(40)},x=>{x.baseSha='d'.repeat(40)},
  x=>{x.files.find(e=>e.path.endsWith('/assistant-reservation-source.json')).blob='e'.repeat(40)},
  x=>{x.files.find(e=>e.path.endsWith('/assistant-reservation-source.json')).mode='100755'},
  x=>{x.files.find(e=>e.path.endsWith('/assistant-reservation-source.json')).status='modified'},
  x=>{x.files.find(e=>e.path.endsWith('/assistant-reservation-source.json')).projectKey='SG2'},
  x=>{x.files.find(e=>e.path.endsWith('/assistant-reservation-source.json')).path='apps/architecture-lab/other-source.json'},
  x=>{x.files.pop()},x=>{x.files.push({...x.files[0],path:'apps/sg-runtime/operation-integration.json',status:'modified'})},
  x=>{x.files[0].owner='Another owner'},x=>{x.files[0].surfaceId='Another surface'}
 ]
 for(const mutate of mutations){const x=structuredClone(r);mutate(x);const facts={...f,files:x.files.map(e=>({filename:e.path,sha:e.blob,status:e.status}))};assert.throws(()=>assertSourceAdmission(x,facts,root,now))}
})
