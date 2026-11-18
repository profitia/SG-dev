#!/usr/bin/env node
// Shared Development policy primitives. The existing PMOS and release executors
// retain their lifecycle; these checks never create grants or execute releases.
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {resolveProjectProfile} from './project-profile.mjs'
import {resolveProjectRouting} from './routing-engine.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const ADMISSIONS_PATH = 'Canon/registries/controlled-source-admissions-v1.json'
export const EXECUTION_PROFILES_PATH = 'Canon/registries/development-execution-profiles-v1.json'
const sha = /^[a-f0-9]{40}$/
const deny = code => {throw new Error(code)}
const git = (cwd, args) => execFileSync('git', args, {cwd, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim()
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b)
const safePath = name => typeof name === 'string' && /^[a-zA-Z0-9_.@/-]+$/.test(name)
  && !name.startsWith('/') && !name.endsWith('/') && name.split('/').every(p => p && p !== '.' && p !== '..')
const protectedPath = name => /(^|\/)AGENTS\.md$/.test(name)
  || /^(Canon\/|governance\/|scripts\/governance\/|\.github\/|\.devcontainer\/)/.test(name)
  || /(^|\/)[^/]*(integration|compatibility|provenance|source)[^/]*\.json$/.test(name)
  || /(^|\/)(\.npmrc|\.env[^/]*|development-integration\.json|operation-integration\.json)$/.test(name)

// PROPOSED closed source-only exception. Inert until this policy is independently
// owner-accepted on authority main and a separately approved ACTIVE ledger record
// exists. No historical receipt or general source JSON admission is granted.
export const ASSISTANT_RESERVATION_SOURCE_ADMISSION = Object.freeze({
  admissionId:"ARCHITECTURE:ARCH-ACG-M1M2-COMPLETION-20261117",
  sourceSha:"817d20e2e9fea8698ab5f9f5a8f5e553787d5c72",
  baseSha:"3109989f6a2c6378b3eddfb84cf99d1a199d1f1e",
  filesSha256:"5f4f8e39d3a64c79deb0778595bd45282e38a3f76c73bf0986a98194505d4967",
  newSourceRecord:"apps/architecture-lab/assistant-reservation-source.json",
  protectedTests:Object.freeze(["scripts/governance/controlled-package-ci.test.mjs","scripts/governance/platform-source-hub-foundation.test.mjs"])
})
function exactReservationSourceEntry(record, entry) {
  const pin=ASSISTANT_RESERVATION_SOURCE_ADMISSION
  const admittedPath=(entry.path===pin.newSourceRecord && entry.status==='added')
    || (pin.protectedTests.includes(entry.path) && entry.status==='modified')
  return admittedPath && entry.mode==='100644'
    && entry.projectKey==='ARCHITECTURE' && record.id===pin.admissionId
    && record.sourceSha===pin.sourceSha && record.baseSha===pin.baseSha
    && createHash('sha256').update(JSON.stringify(record.files)).digest('hex')===pin.filesSha256
}

export function executionProfile(projectKey, governanceRoot = root) {
  const profile = resolveProjectProfile(projectKey, governanceRoot)
  const registry = JSON.parse(fs.readFileSync(path.join(governanceRoot, EXECUTION_PROFILES_PATH), 'utf8'))
  if (registry.schemaVersion !== '1.0' || registry.standard !== 'profitia.development-execution/v1') deny('EXECUTION_STANDARD_REJECTED')
  const adapter = registry.adapters[profile.projectKey]
  if(adapter && adapter.repository !== profile.repository.slug) deny('EXECUTION_ADAPTER_REPOSITORY_REJECTED')
  // Future ACTIVE profiles inherit the common rules; an executable transport
  // still requires a registered adapter. No repository/environment is guessed.
  return {profile, standard:registry.standard, adapter:adapter ?? null, continuity:profile.continuity}
}

export function transportPlan(projectKey, kind = 'source', governanceRoot = root) {
  const {profile,adapter} = executionProfile(projectKey, governanceRoot)
  if (!adapter || !['source','policy'].includes(kind)) deny('EXECUTION_ADAPTER_REQUIRED')
  const prefix = kind === 'policy' ? adapter.policyTransportPrefix : adapter.sourceTransportPrefix
  if (typeof prefix !== 'string' || !/^[a-z0-9-]+\/$/.test(prefix)) deny('TRANSPORT_NOT_REGISTERED')
  return {projectKey:profile.projectKey, repository:profile.repository.slug, authorityBranch:profile.repository.defaultBranch,
    prefix, ownershipFromBranch:false, grantsAuthority:false, targetEnvironment:'development',
    requiredChecks:['manifest','routing','require-begin','exact-head-ci','resulting-main-ci']}
}

export function classifyCapability({credentialPresent, httpStatus, requiredDecisionPresent = true, errorCode}) {
  if (!requiredDecisionPresent) return 'DECISION_REQUIRED'
  if (!credentialPresent) return 'CREDENTIAL_MISSING'
  if (httpStatus === 401) return 'AUTHENTICATION_REJECTED'
  if (httpStatus === 403) return 'PERMISSION_REJECTED'
  if (httpStatus === 404) return 'RESOURCE_OR_ACCESS_UNVERIFIED'
  if (errorCode || !Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 300) return 'TECHNICAL_FAILURE'
  return 'READY'
}

// Called only by the trusted workflow. A successful API request does not assert
// package access; the exact artifact probes and clean installation do that.
export async function assertWorkflowPackageCredential({token, context, request}) {
  if (!token) deny('PACKAGE_CREDENTIAL_MISSING')
  if (!context || !sha.test(context.controlSha ?? '') || context.ref !== 'refs/heads/main'
    || context.workflowRef !== context.repository + '/.github/workflows/platform-contracts-ci.yml@refs/heads/main'
    || !['push','workflow_dispatch'].includes(context.event)) deny('PACKAGE_CREDENTIAL_CONTEXT_REJECTED')
  let result
  try {result=await request('repos/' + context.repository, token)} catch(error) {
    const codes={GITHUB_API_401:'PACKAGE_AUTHENTICATION_REJECTED',GITHUB_API_403:'PACKAGE_PERMISSION_REJECTED',GITHUB_API_404:'PACKAGE_OR_ACCESS_UNVERIFIED'}
    if(codes[error.message])deny(codes[error.message])
    throw error
  }
  if (result.data?.full_name !== context.repository) deny('PACKAGE_CREDENTIAL_REPOSITORY_REJECTED')
}

export function classifyPackageFailure(output) {
  // Inspect captured text in memory, never return or print raw npm output.
  if (/\b(E401|ENEEDAUTH)\b|401 Unauthorized/i.test(output)) return 'PACKAGE_AUTHENTICATION_REJECTED'
  if (/\bE403\b|403 Forbidden/i.test(output)) return 'PACKAGE_PERMISSION_REJECTED'
  if (/\bE404\b|404 Not Found/i.test(output)) return 'PACKAGE_OR_ACCESS_UNVERIFIED'
  if (/\bEINTEGRITY\b/.test(output)) return 'PACKAGE_INTEGRITY_REJECTED'
  return 'CONTROLLED_DEPENDENCY_INSTALL_FAILED'
}

export function credentialFree(env) {
  return !['NPM_TOKEN','NODE_AUTH_TOKEN','GH_TOKEN','GITHUB_TOKEN','SG2_PACKAGES_READ_TOKEN'].some(k => Boolean(env[k]))
}

export function readTrustedAdmissions(governanceRoot = root) {
  const name = path.join(governanceRoot, ADMISSIONS_PATH)
  // Compatibility with historical fixture roots only. Main always tracks the file.
  if (!fs.existsSync(name)) return []
  const stat = fs.lstatSync(name)
  if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(name) !== name || stat.size > 1024*1024) deny('SOURCE_ADMISSION_STORE_REJECTED')
  const data = JSON.parse(fs.readFileSync(name,'utf8'))
  if (data.schemaVersion !== '1.0' || !Array.isArray(data.records)) deny('SOURCE_ADMISSION_STORE_REJECTED')
  const ids = new Set()
  for (const record of data.records) {
    if (!record || !record.id || ids.has(record.id)) deny('SOURCE_ADMISSION_STORE_REJECTED')
    ids.add(record.id)
  }
  return data.records
}

export function findTrustedAdmission(sourceSha, governanceRoot = root) {
  const matches = readTrustedAdmissions(governanceRoot).filter(r => r.sourceSha === sourceSha)
  if (matches.length > 1) deny('SOURCE_ADMISSION_CONFLICT')
  return matches[0] ?? null
}

// Lookup is by stable record ID on refresh; ID is a selector, never authority.
// Entries are read only from trusted-control, never from the candidate.
export function trustedAdmissionById(id, governanceRoot = root) {
  if (!id) return null
  const record = readTrustedAdmissions(governanceRoot).find(r => r.id === id)
  if (!record) deny('SOURCE_ADMISSION_NOT_FOUND')
  return record
}

export function assertSourceAdmission(record, {repository,actor,candidateSha,currentMainSha,files,repositoryRoot}, governanceRoot = root, now = Date.now()) {
  if (!record || record.status !== 'ACTIVE' || record.repository !== repository || record.actor !== actor
    || record.targetEnvironment !== 'development' || record.scope !== 'SOURCE_VALIDATION_ONLY'
    || !record.taskId || !record.approvalRef || !sha.test(record.sourceSha ?? '') || !sha.test(record.baseSha ?? '')
    || !sha.test(candidateSha ?? '') || !sha.test(currentMainSha ?? '')) deny('SOURCE_ADMISSION_IDENTITY_REJECTED')
  const from = Date.parse(record.validFrom), until = Date.parse(record.validUntil)
  if (!Number.isFinite(from) || !Number.isFinite(until) || from > now || until <= now || until <= from) deny('SOURCE_ADMISSION_EXPIRED')
  if (!Array.isArray(record.files) || record.files.length < 1 || record.files.length > 300
    || !Array.isArray(files) || files.length !== record.files.length) deny('SOURCE_ADMISSION_FILES_REJECTED')
  const names = new Set(), actual = new Map(files.map(f => [f.filename,f]))
  if (actual.size !== files.length) deny('SOURCE_ADMISSION_FILES_REJECTED')
  for (const entry of record.files) {
    if (!safePath(entry.path) || (protectedPath(entry.path) && !exactReservationSourceEntry(record,entry)) || names.has(entry.path)
      || !sha.test(entry.blob ?? '') || !['100644','100755'].includes(entry.mode)
      || !['added','modified'].includes(entry.status)) deny('SOURCE_ADMISSION_FILES_REJECTED')
    names.add(entry.path)
    const f = actual.get(entry.path)
    if (!f || f.sha !== entry.blob || f.status !== entry.status || Object.hasOwn(f,'previous_filename')) deny('SOURCE_ADMISSION_BYTES_REJECTED')
    const profile = resolveProjectProfile(entry.projectKey,governanceRoot)
    const route = resolveProjectRouting({profile,targets:[entry.path],repositoryRoot:repositoryRoot ?? governanceRoot}).results[0]
    if (profile.repository.slug !== repository || !route || route.resolutionStatus !== 'RESOLVED'
      || route.highestSpecificityMatchCount !== 1 || route.projectBoundaryStatus !== 'ALLOWED'
      || route.baselineClassification !== 'ALIGNED' || route.currentOwner !== entry.owner
      || route.matchedSurfaceId !== entry.surfaceId) deny('SOURCE_ADMISSION_ROUTING_REJECTED')
  }
  return record
}

export function assertSourceCheckout(candidateRoot, record, state, governanceRoot = root) {
  const base = fs.realpathSync(candidateRoot)
  if (base !== path.resolve(candidateRoot) || git(base,['rev-parse','HEAD']) !== state.sha) deny('SOURCE_CHECKOUT_REJECTED')
  assertSourceAdmission(record,{repository:record.repository,actor:state.actor,candidateSha:state.sha,currentMainSha:state.controlSha,files:state.files},governanceRoot)
  // Preserve source lineage and require current authority to be incorporated.
  for (const [ancestor,head] of [[record.sourceSha,state.sha],[record.baseSha,record.sourceSha],[state.controlSha,state.sha]]) {
    try {git(base,['merge-base','--is-ancestor',ancestor,head])} catch {deny('SOURCE_BASE_OR_LINEAGE_REJECTED')}
  }
  const changed = git(base,['diff','--name-only','--no-renames',state.controlSha+'...'+state.sha]).split('\n').filter(Boolean).sort()
  if (!equal(changed,record.files.map(f=>f.path).sort())) deny('SOURCE_DIFF_REJECTED')
  for (const entry of record.files) {
    const target = path.join(base,entry.path), stat = fs.lstatSync(target)
    const tree = git(base,['ls-tree',state.sha,'--',entry.path])
    if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(target) !== target || stat.size > 1024*1024
      || tree !== entry.mode+' blob '+entry.blob+'\t'+entry.path
      || git(base,['hash-object','--no-filters','--',entry.path]) !== entry.blob
      || Boolean(stat.mode & 0o111) !== (entry.mode === '100755')) deny('SOURCE_PHYSICAL_FILE_REJECTED')
  }
  // Lifecycle scripts must not leave unreviewed tracked, staged or untracked
  // source outside the admitted diff before the exact-source proof is emitted.
  if (git(base,['status','--porcelain=v1','--untracked-files=all','--ignore-submodules=none'])) deny('SOURCE_CHECKOUT_DIRTY')
  return true
}

// Historical application-source compatibility, not a grant or source proof.
// Only a trusted caller's fetched main supplies authority; candidate metadata
// and candidate JavaScript are never evaluated to establish it.
export function trustedApplicationContinuity(candidateRoot, watchedPaths, {authorityRoot=root,governanceRoot=root}={}) {
  const paths=[...new Set(watchedPaths)]
  if(paths.length!==watchedPaths.length || paths.some(p=>!p.startsWith('apps/')||!safePath(p)||protectedPath(p)||!/\.(?:tsx?|mjs)$/.test(p))) deny('APPLICATION_CONTINUITY_PATH_REJECTED')
  const remote=git(authorityRoot,['remote','get-url','origin'])
  if(!['https://github.com/profitia/SG-dev','https://github.com/profitia/SG-dev.git','git@github.com:profitia/SG-dev.git'].includes(remote))deny('APPLICATION_CONTINUITY_AUTHORITY_REQUIRED')
  const controlSha=git(authorityRoot,['rev-parse','refs/remotes/origin/main'])
  if(!sha.test(controlSha))deny('APPLICATION_CONTINUITY_AUTHORITY_REQUIRED')
  const readGit=(repo,ref,p)=>execFileSync('git',['cat-file','blob',ref+':'+p],{cwd:repo,stdio:['ignore','pipe','pipe'],maxBuffer:2*1024*1024})
  const authority=p=>{const entry=git(authorityRoot,['ls-tree',controlSha,'--',p]);if(!entry)return null;if(!entry.startsWith('100644 blob '))deny('APPLICATION_CONTINUITY_AUTHORITY_MODE_REJECTED');return readGit(authorityRoot,controlSha,p)}
  const physical=p=>{
    const base=fs.realpathSync(candidateRoot),target=path.join(base,p),stat=fs.lstatSync(target)
    if(!stat.isFile()||stat.isSymbolicLink()||fs.realpathSync(target)!==target||stat.size>1024*1024||stat.mode&0o111)deny('APPLICATION_CONTINUITY_PHYSICAL_REJECTED')
    return fs.readFileSync(target)
  }
  const bytes=new Map(paths.map(p=>[p,physical(p)]))
  const sameAsAuthority=p=>{const b=authority(p);return b!==null&&bytes.get(p).equals(b)}
  const reader=()=>p=>{if(!bytes.has(p))deny('APPLICATION_CONTINUITY_PATH_REJECTED');return Buffer.from(bytes.get(p))}
  // Already accepted main source is authenticated against its actual Git bytes,
  // independently of a past, temporary admission. Immutable receipt checks in
  // the historical reader still run unchanged.
  if(paths.every(sameAsAuthority))return reader()
  const ledgerBytes=authority(ADMISSIONS_PATH)
  if(!ledgerBytes)return null
  if(ledgerBytes.length>1024*1024)deny('SOURCE_ADMISSION_STORE_REJECTED')
  const ledger=JSON.parse(ledgerBytes.toString('utf8'))
  if(ledger.schemaVersion!=='1.0'||!Array.isArray(ledger.records)||ledger.records.some(r=>!r?.id)
    ||new Set(ledger.records.map(r=>r.id)).size!==ledger.records.length)deny('SOURCE_ADMISSION_STORE_REJECTED')
  const matches=ledger.records.filter(r=>Array.isArray(r.files)&&r.files.some(f=>paths.includes(f.path))&&r.files.every(f=>{
    if(!safePath(f.path))return false
    try{const b=physical(f.path);return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')===f.blob}catch{return false}
  }))
  if(matches.length>1)deny('APPLICATION_CONTINUITY_CONFLICT')
  if(!matches.length)return null
  const record=matches[0],candidateSha=git(candidateRoot,['rev-parse','HEAD'])
  assertSourceAdmission(record,{repository:'profitia/SG-dev',actor:'profitia',candidateSha,currentMainSha:controlSha,
    files:record.files.map(f=>({filename:f.path,sha:f.blob,status:f.status}))},governanceRoot)
  assertSourceCheckout(candidateRoot,record,{sha:candidateSha,controlSha,actor:'profitia',
    files:record.files.map(f=>({filename:f.path,sha:f.blob,status:f.status}))},governanceRoot)
  for(const name of paths)if(!record.files.some(f=>f.path===name)&&!sameAsAuthority(name))deny('APPLICATION_CONTINUITY_BYTES_REJECTED')
  return reader()
}

// Mandate data is authoritative only when loaded from the independently accepted
// control-plane record. These pure comparisons alone never install permissions.
export function assertOperationWithinMandate(mandate, operation, now = Date.now()) {
  if (!mandate || mandate.status !== 'ACTIVE' || !mandate.approvalRef || !mandate.id || mandate.revoked === true
    || !Number.isFinite(Date.parse(mandate.validFrom)) || Date.parse(mandate.validFrom) > now
    || !Number.isFinite(Date.parse(mandate.validUntil)) || Date.parse(mandate.validUntil) <= now) deny('EXECUTION_DECISION_REQUIRED')
  for (const key of ['projectKey','repository','taskId','targetEnvironment','businessScopeDigest']) {
    if (!operation[key] || operation[key] !== mandate[key]) deny('EXECUTION_SCOPE_CHANGED')
  }
  if (operation.targetEnvironment !== 'development' || !mandate.operations?.includes(operation.kind)) deny('EXECUTION_OPERATION_NOT_DELEGATED')
  if (['change-trust','change-access','create-resource','change-cost','change-license','database-restore'].includes(operation.kind)) deny('EXECUTION_OWNER_DECISION_REQUIRED')
  if (['transport','publish-source','merge','release','rollback'].includes(operation.kind) && !sha.test(operation.sourceSha ?? '')) deny('EXECUTION_SOURCE_REQUIRED')
  if (['release','rollback'].includes(operation.kind) && !operation.resourceId) deny('EXECUTION_RESOURCE_REQUIRED')
  if (operation.sourceSha && mandate.sourceSha !== operation.sourceSha) deny('EXECUTION_SOURCE_CHANGED')
  if (operation.resourceId && !mandate.resourceIds?.includes(operation.resourceId)) deny('EXECUTION_RESOURCE_CHANGED')
  if (!Number.isFinite(operation.costCeiling) || !Number.isFinite(mandate.costCeiling) || operation.costCeiling > mandate.costCeiling) deny('EXECUTION_COST_CHANGED')
  return {decision:'WITHIN_RECORDED_MANDATE',mandateId:mandate.id,newAuthorityGranted:false}
}

export function assertReleaseState({requestedSha,resourceId,expectedLiveDeployId,observed,rollback = false,lkg}, now = Date.now()) {
  if (!sha.test(requestedSha ?? '') || !resourceId || observed?.resourceId !== resourceId
    || observed.environment !== 'development' || observed.liveDeployId !== expectedLiveDeployId
    || !Array.isArray(observed.inProgressDeployIds) || observed.inProgressDeployIds.length
    || observed.migrationInProgress !== false || !Number.isFinite(Date.parse(observed.capturedAt))
    || Date.parse(observed.capturedAt)>now || now-Date.parse(observed.capturedAt)>300000
    || !lkg || lkg.resourceId !== resourceId || !lkg.configurationRef) deny('RELEASE_STATE_CONFLICT')
  if(lkg.type==='FIRST_DEPLOYMENT'){
    if(expectedLiveDeployId!==null||rollback||!lkg.abortProcedureRef)deny('FIRST_DEPLOYMENT_RECOVERY_REQUIRED')
    return true
  }
  if(!sha.test(lkg.sourceSha??'')||!/^sha256:[a-f0-9]{64}$/.test(lkg.artifactDigest??'')||!lkg.recoveryProcedureRef)deny('RELEASE_STATE_CONFLICT')
  if (rollback && (lkg.sourceSha !== requestedSha || lkg.databaseRollbackRequired !== false)) deny('ROLLBACK_REQUIRES_SEPARATE_DECISION')
  return true
}

export function resumePoint(journal, observed) {
  if (!journal || journal.completed === true || !journal.operationId || !journal.sourceSha
    || observed?.operationId !== journal.operationId || observed.sourceSha !== journal.sourceSha
    || observed.generation !== journal.generation || observed.owner !== journal.owner
    || observed.previousExecutorFinished !== true || observed.ambiguousEffect !== false
    || !Array.isArray(journal.steps)) deny('RESUME_RECONCILIATION_REQUIRED')
  const step = journal.steps.find(s => s.status !== 'VERIFIED')
  if (!step || !['PENDING','INTENT_RECORDED'].includes(step.status)) deny('RESUME_RECONCILIATION_REQUIRED')
  return step.id
}


export function sourceAdmissionDigest(record) {
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value
  return createHash('sha256').update(JSON.stringify(canonical(record))).digest('hex')
}

export function assertSourceValidationProof(proof,run,candidateSha,workflowId,{expectedControlDigest,currentRunId,currentRef,completedJobs=[]}={},governanceRoot=root) {
  const sameRun=String(run.id)===String(currentRunId)&&currentRef==='refs/heads/main'&&run.event==='push'
    &&completedJobs.some(j=>j.name==='SG2 controlled operation integration'&&j.conclusion==='success')
  if(run.workflow_id!==workflowId||run.repository?.full_name!=='profitia/SG-dev'||run.head_branch!=='main'
    ||!['push','workflow_dispatch'].includes(run.event)||run.actor?.login!=='profitia'||!sameRun&&run.conclusion!=='success')deny('UNTRUSTED_VALIDATION_RUN')
  if(!proof||proof.schemaVersion!=='2.0'||proof.repository!=='profitia/SG-dev'
    ||!['EXACT_SOURCE_VALIDATION','AUTHORITY_MAIN_VALIDATION'].includes(proof.scope)||proof.targetEnvironment!=='development'
    ||proof.workflow!=='.github/workflows/platform-contracts-ci.yml'||proof.candidateSha!==candidateSha
    ||proof.controlSha!==run.head_sha||String(proof.runId)!==String(run.id)||!/^[a-f0-9]{64}$/.test(expectedControlDigest??'')
    ||proof.controlPolicyDigest!==expectedControlDigest)deny('VALIDATION_PROVENANCE_MISMATCH')
  if(proof.scope==='EXACT_SOURCE_VALIDATION'||Object.hasOwn(proof,'executionWorkspace')){
    if(proof.executionWorkspace!=='ISOLATED_GIT_CHECKOUT'||proof.executionCheckoutSha!==candidateSha
      ||proof.sourceInputVerifiedBeforeExecution!==true||proof.sourceInputVerifiedAfterExecution!==true)deny('VALIDATION_INPUT_ISOLATION_INCOMPLETE')
  }
  if(proof.scope==='AUTHORITY_MAIN_VALIDATION'){
    if(candidateSha!==run.head_sha||proof.sourceAdmissionId!==undefined||proof.originalSourceSha!==undefined)deny('VALIDATION_PROVENANCE_MISMATCH')
  }else{
    const record=trustedAdmissionById(proof.sourceAdmissionId,governanceRoot)
    assertSourceAdmission(record,{repository:proof.repository,actor:run.actor.login,candidateSha,currentMainSha:proof.controlSha,
      files:record.files.map(f=>({filename:f.path,sha:f.blob,status:f.status}))},governanceRoot)
    if(proof.sourceAdmissionDigest!==sourceAdmissionDigest(record)||proof.originalSourceSha!==record.sourceSha)deny('VALIDATION_INCOMPLETE')
  }
  if(proof.credentialRemovedBeforeCandidateExecution!==true||proof.privatePackageArtifactsPublished!==false
    ||proof.productDeploymentPerformed!==false||proof.customerIdentityAdapterVerified!==false
    ||proof.install!=='CLEAN_REGISTRY_IGNORE_SCRIPTS'||proof.tests!=='PASS'||proof.typecheck!=='PASS'||proof.build!=='PASS')deny('VALIDATION_INCOMPLETE')
  return proof
}

export function proposeSourceAdmission({projectKey,taskId,sourceSha,baseSha,repositoryRoot},governanceRoot=root) {
  const {profile}=executionProfile(projectKey,governanceRoot)
  if(!taskId||!sha.test(sourceSha??'')||!sha.test(baseSha??'')||!repositoryRoot)deny('SOURCE_PROPOSAL_INPUT_REQUIRED')
  const checkout=fs.realpathSync(repositoryRoot)
  if(checkout!==path.resolve(repositoryRoot)||git(checkout,['rev-parse','--show-toplevel'])!==checkout)deny('SOURCE_PROPOSAL_REPOSITORY_REJECTED')
  const remote=git(checkout,['remote','get-url','origin']).replace(/\.git$/,'').replace(/^git@github.com:/,'https://github.com/')
  if(remote!=='https://github.com/'+profile.repository.slug)deny('SOURCE_PROPOSAL_REPOSITORY_REJECTED')
  try{git(checkout,['merge-base','--is-ancestor',baseSha,sourceSha])}catch{deny('SOURCE_PROPOSAL_BASE_REJECTED')}
  const rows=git(checkout,['diff','--name-status','--no-renames',baseSha,sourceSha]).split('\n').filter(Boolean)
  if(!rows.length||rows.length>300)deny('SOURCE_PROPOSAL_FILES_REJECTED')
  const files=rows.map(line=>{
    const [status,name,...rest]=line.split('\t')
    if(rest.length||!['A','M'].includes(status)||!safePath(name)||protectedPath(name))deny('SOURCE_PROPOSAL_PROTECTED_OR_UNSUPPORTED_PATH')
    const tree=git(checkout,['ls-tree',sourceSha,'--',name]),m=/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(tree)
    if(!m||m[3]!==name)deny('SOURCE_PROPOSAL_FILE_MODE_REJECTED')
    const route=resolveProjectRouting({profile,targets:[name],repositoryRoot:governanceRoot}).results[0]
    if(!route||route.resolutionStatus!=='RESOLVED'||route.projectBoundaryStatus!=='ALLOWED'||route.highestSpecificityMatchCount!==1||route.baselineClassification!=='ALIGNED')deny('SOURCE_PROPOSAL_ROUTING_REJECTED')
    return {path:name,blob:m[2],mode:m[1],status:status==='A'?'added':'modified',projectKey:profile.projectKey,owner:route.currentOwner,surfaceId:route.matchedSurfaceId}
  })
  return {id:profile.projectKey+':'+taskId,status:'PROPOSED',repository:profile.repository.slug,actor:null,taskId,
    targetEnvironment:'development',scope:'SOURCE_VALIDATION_ONLY',approvalRef:null,sourceSha,baseSha,validFrom:null,validUntil:null,files}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command,projectKey,...args] = process.argv.slice(2)
    let result
    if(command==='transport')result=transportPlan(projectKey,args[0])
    else if(command==='propose-source')result=proposeSourceAdmission({projectKey,taskId:args[0],sourceSha:args[1],baseSha:args[2],repositoryRoot:args[3]})
    else deny('USE_TRANSPORT_OR_PROPOSE_SOURCE')
    console.log(JSON.stringify(result,null,2))
  } catch(error) {console.error(error.message?.match(/^[A-Z_]+$/)?error.message:'EXECUTION_PREFLIGHT_FAILED_CLOSED');process.exitCode=1}
}
