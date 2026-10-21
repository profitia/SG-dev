import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync, execFileSync} from 'node:child_process'
import {assertTrustedContext, assertEnvironment, selectCandidate, assertArchitectureFiles, resolveCandidateAdmission, assertArchitectureCheckout, CONTROL_POLICY_FILES, assertCredentialMetadata, assertReceipt, assertPackagePolicy, assertManifestPolicy, assertLocalPackageSources, assertProof, controlPolicyDigest, operationContractProvenanceDigest, REPOSITORY, WORKFLOW, PRIVATE_PACKAGES, LOCAL_PACKAGES} from './controlled-package-ci.mjs'

const sha = 'a'.repeat(40), other = 'b'.repeat(40)
const context = () => ({repository: REPOSITORY, ref: 'refs/heads/main', workflowRef: `${REPOSITORY}/${WORKFLOW}@refs/heads/main`, event: 'workflow_dispatch', actor: 'profitia', triggeringActor: 'profitia', controlSha: sha})
const pr = () => ({state: 'open', user: {login: 'profitia'}, base: {ref: 'main', repo: {full_name: REPOSITORY}}, head: {sha: other, ref: 'sg2/integration', repo: {full_name: REPOSITORY}}})
const configuration = '@profitia:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NPM_TOKEN}\n'
const lock = () => ({lockfileVersion: 3, packages: Object.fromEntries(PRIVATE_PACKAGES.map(name => [`node_modules/${name}`, {version: '1.0.0', integrity: 'sha512-approved'}]))})
const rejection = fn => assert.throws(fn)

test('only trusted main workflow accepts owner execution, including push', () => {
  assertTrustedContext(context())
  assertTrustedContext({...context(), event: 'push'})
  for (const delta of [{repository: 'attacker/SG-dev'}, {ref: 'refs/pull/384/merge'}, {ref: 'refs/tags/main'}, {ref: 'refs/heads/architecture/test'}, {event: 'pull_request_target'}, {event: 'pull_request'}, {actor: 'attacker'}, {triggeringActor: 'attacker'}, {controlSha: 'main'}, {workflowRef: `${REPOSITORY}/${WORKFLOW}@refs/heads/untrusted`}]) rejection(() => assertTrustedContext({...context(), ...delta}))
})
test('provider policy must bind exact registered identity and sole main branch, never matching tags or pull refs', () => {
  const expected = {environmentName: 'architecture-development', environmentId: 24168168252, repository: REPOSITORY, protectionStatus: 'MAIN_ONLY'}
  const env = {id: expected.environmentId, name: expected.environmentName, deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}}
  assertEnvironment(env, [{name: 'main', type: 'branch'}], expected)
  for (const branches of [[], [{name: '*', type: 'branch'}], [{name: 'main', type: 'tag'}], [{name: 'main', type: 'branch'}, {name: 'refs/pull/*/merge', type: 'branch'}]]) rejection(() => assertEnvironment(env, branches, expected))
  rejection(() => assertEnvironment({...env, id: 1}, [{name: 'main', type: 'branch'}], expected))
  rejection(() => assertEnvironment({...env, deployment_branch_policy: null}, [{name: 'main', type: 'branch'}], expected))
})
test('internal reviewed PR is pinned; no owner-triggered fork, other product branch, stale SHA or arbitrary revision', () => {
  assert.equal(selectCandidate(context(), pr(), other), other)
  assert.equal(selectCandidate(context(), null, sha), sha)
  for (const change of [p => p.head.repo.full_name = 'profitia/fork', p => p.user.login = 'attacker', p => p.head.ref = 'srm/work', p => p.base.ref = 'staging', p => p.state = 'closed']) {
    const p = pr(); change(p); rejection(() => selectCandidate(context(), p, other))
  }
  rejection(() => selectCandidate(context(), pr(), sha))
  rejection(() => selectCandidate(context(), pr(), undefined))
  rejection(() => selectCandidate(context(), null, other))
})
test('credential metadata rejects broader scopes, another issuer account, missing/expired/unbounded lifetime', () => {
  const now = Date.parse('2026-10-17T00:00:00Z')
  const good = {scopes: 'read:packages', login: 'profitia', expiresAt: '2026-11-15T00:00:00Z'}
  assertCredentialMetadata(good, now)
  for (const delta of [{scopes: 'read:packages, repo'}, {scopes: 'write:packages'}, {scopes: ''}, {login: 'attacker'}, {expiresAt: null}, {expiresAt: '2026-10-16'}, {expiresAt: '2027-01-01'}]) rejection(() => assertCredentialMetadata({...good, ...delta}, now))
})
test('receipt is explicitly Development and has only the bounded public contract metadata', () => {
  const receipt = {projectKey: 'SG2', targetEnvironment: 'development', scope: 'ISOLATED_OPERATION_INTEGRATION_ONLY', liveRouteUsesContract: false, automaticProductDeployment: false, contract: {id: 'profitia.operation-context', version: '1.0.0', implementation: '1.0.0-candidate.3', sourceDigest: 'e'.repeat(64)}}
  assertReceipt(receipt)
  for (const delta of [{targetEnvironment: 'staging'}, {projectKey: 'SRM'}, {liveRouteUsesContract: true}, {contract: {...receipt.contract, arbitraryPayload: 'must not be copied into proof'}}]) rejection(() => assertReceipt({...receipt, ...delta}))
})
test('package names, pins and npm configuration are fixed before any install or token-bearing lifecycle', () => {
  assertPackagePolicy(lock(), lock(), configuration)
  rejection(() => assertPackagePolicy(lock(), lock(), configuration + 'registry=https://attacker.example\n'))
  for (const edit of [l => l.packages['node_modules/@profitia/cic-core'].version = '9.0.0', l => l.packages['node_modules/@profitia/cic-core'].integrity = 'sha512-forged', l => l.packages['node_modules/@profitia/other'] = {version: '1'}, l => delete l.packages['node_modules/@profitia/cic-core'], l => l.packages['node_modules/leftpad'] = {resolved: 'https://attacker.example/p.tgz'}, l => l.packages['node_modules/leftpad'] = {resolved: 'https://secret@registry.npmjs.org/p.tgz'}, l => l.packages['node_modules/local'] = {resolved: '/tmp/escape'}, l => l.packages['../escape'] = {}, l => l.lockfileVersion = 2]) {
    const candidate = lock(); edit(candidate); rejection(() => assertPackagePolicy(candidate, lock(), configuration))
  }
  const c = lock(); c.packages['node_modules/@profitia/platform-contracts'] = {resolved: '../../packages/platform-contracts', version: '1.1.3'}; assertPackagePolicy(c, lock(), configuration)
  c.packages['node_modules/@profitia/platform-contracts'].resolved = 'file:../../packages/platform-contracts'; assertPackagePolicy(c, lock(), configuration)
  c.packages['node_modules/@profitia/platform-contracts'].resolved = 'file:/tmp/escape'; rejection(() => assertPackagePolicy(c, lock(), configuration))
  const alias = lock(); alias.packages['node_modules/innocent-name'] = {name: '@profitia/cic-evals', version: '1.0.0'}; rejection(() => assertPackagePolicy(alias, lock(), configuration))
  const declared = lock(); declared.packages[''] = {dependencies: {alias: 'npm:@profitia/cic-evals@1.0.0'}}; rejection(() => assertPackagePolicy(declared, lock(), configuration))
})
test('manifest changes cannot hide private aliases, new pins or additional workspaces behind an accepted lock', () => {
  const authority = {dependencies: {'@profitia/cic-core': '1.1.1'}}
  assertManifestPolicy(authority, authority)
  assertManifestPolicy({dependencies: {...authority.dependencies, '@profitia/platform-contracts': 'file:../../packages/platform-contracts'}}, authority)
  for (const candidate of [{dependencies: {'@profitia/cic-core': '9.0.0'}}, {dependencies: {alias: 'npm:@profitia/cic-evals@1.0.0'}}, {dependencies: {'@profitia/cic-evals': '1.0.0'}}, {...authority, workspaces: ['../*']}, {...authority, overrides: {'@profitia/cic-core': '9'}}]) rejection(() => assertManifestPolicy(candidate, authority))
})
test('only the two reviewed local names bind to their own exact paths, never a registry, alias or nested install', () => {
  assert.deepEqual(Object.keys(LOCAL_PACKAGES).sort(), ['@profitia/platform-contracts', '@profitia/srm-xray'])
  const authority = {dependencies: {'@profitia/cic-core': '1.1.1'}}
  for (const [name, relative] of Object.entries(LOCAL_PACKAGES)) {
    for (const resolved of [relative, `file:${relative}`]) {
      const candidate = lock()
      candidate.packages[`node_modules/${name}`] = {version: '0.2.0', resolved}
      candidate.packages[''] = {dependencies: {[name]: `file:${relative}`}}
      assertPackagePolicy(candidate, lock(), configuration)
      assertManifestPolicy({dependencies: {[name]: `file:${relative}`}}, authority)
      for (const edit of [
        l => l.packages[`node_modules/${name}`].resolved = '../../packages/other',
        l => l.packages[`node_modules/${name}`].resolved = `${relative}/../srm-xray`,
        l => l.packages[`node_modules/${name}`].resolved = 'https://registry.npmjs.org/other/-/other-1.tgz',
        l => l.packages[`node_modules/${name}`].resolved = 'https://npm.pkg.github.com/other',
        l => l.packages[`node_modules/${name}`].link = true,
        l => l.packages[`node_modules/parent/node_modules/${name}`] = l.packages[`node_modules/${name}`],
        l => l.packages[''].dependencies[name] = '0.2.0',
        l => l.packages['node_modules/unscoped-alias'] = {resolved: `file:${relative}`},
      ]) {
        const changed = structuredClone(candidate); edit(changed)
        rejection(() => assertPackagePolicy(changed, lock(), configuration))
      }
    }
    for (const spec of ['0.2.0', `npm:${name}@0.2.0`, `file:${relative}/../srm-xray`, 'file:/tmp/escape', `link:${relative}`]) {
      rejection(() => assertManifestPolicy({dependencies: {[name]: spec}}, authority))
    }
    rejection(() => assertManifestPolicy({dependencies: {alias: `file:${relative}`}}, authority))
  }
})
test('actual local source validation rejects mismatched names, absent authority, added private dependencies and symlinks', () => {
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'controlled-local-source-')))
  const candidateRoot = path.join(temporary, 'candidate'), authorityRoot = path.join(temporary, 'authority')
  const name = '@profitia/srm-xray', relative = LOCAL_PACKAGES[name]
  const local = path.join(candidateRoot, 'packages/srm-xray'), authorityLocal = path.join(authorityRoot, 'packages/srm-xray')
  const manifest = {name, version: '0.2.0', peerDependencies: {react: '^18.3.1 || ^19.2.4'}}
  const candidate = lock(); candidate.packages[`node_modules/${name}`] = {version: manifest.version, resolved: `file:${relative}`}
  try {
    fs.mkdirSync(path.join(candidateRoot, 'apps/sg-runtime'), {recursive: true})
    for (const dir of [local, authorityLocal]) {fs.mkdirSync(dir, {recursive: true}); fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest))}
    assertLocalPackageSources(candidateRoot, candidate, authorityRoot)
    for (const changed of [{...manifest, name: '@profitia/cic-evals'}, {...manifest, version: '9.0.0'}, {...manifest, dependencies: {'@profitia/cic-evals': '1.0.0'}}, {...manifest, workspaces: ['../*']}, {...manifest, overrides: {'@profitia/cic-core': '9'}}]) {
      fs.writeFileSync(path.join(local, 'package.json'), JSON.stringify(changed))
      rejection(() => assertLocalPackageSources(candidateRoot, candidate, authorityRoot))
    }
    fs.writeFileSync(path.join(local, 'package.json'), JSON.stringify(manifest))
    fs.renameSync(path.join(authorityLocal, 'package.json'), path.join(authorityLocal, 'saved.json'))
    rejection(() => assertLocalPackageSources(candidateRoot, candidate, authorityRoot))
    fs.renameSync(path.join(authorityLocal, 'saved.json'), path.join(authorityLocal, 'package.json'))
    fs.renameSync(local, `${local}-real`)
    fs.symlinkSync(`${local}-real`, local, 'dir')
    rejection(() => assertLocalPackageSources(candidateRoot, candidate, authorityRoot))
    fs.unlinkSync(local)
    fs.symlinkSync(authorityLocal, local, 'dir')
    rejection(() => assertLocalPackageSources(candidateRoot, candidate, authorityRoot))
    fs.unlinkSync(local)
    fs.renameSync(`${local}-real`, local)
    fs.renameSync(path.join(local, 'package.json'), path.join(local, 'saved.json'))
    fs.symlinkSync(path.join(local, 'saved.json'), path.join(local, 'package.json'))
    rejection(() => assertLocalPackageSources(candidateRoot, candidate, authorityRoot))
  } finally {fs.rmSync(temporary, {recursive: true, force: true})}
})
test('actual current SG2 dependency policy remains valid and admits only the reviewed local module addition', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const authority = JSON.parse(fs.readFileSync(path.join(root, 'apps/sg-runtime/package-lock.json'), 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/sg-runtime/package.json'), 'utf8'))
  assertPackagePolicy(authority, authority, configuration)
  assertManifestPolicy(manifest, manifest)
  assertLocalPackageSources(root, authority, root)
  const candidate = structuredClone(authority)
  const supplier = JSON.parse(fs.readFileSync(path.join(root, 'packages/srm-xray/package.json'), 'utf8'))
  candidate.packages['node_modules/@profitia/srm-xray'] = {version: supplier.version, resolved: 'file:../../packages/srm-xray', peerDependencies: supplier.peerDependencies}
  candidate.packages[''].dependencies['@profitia/srm-xray'] = 'file:../../packages/srm-xray'
  assertPackagePolicy(candidate, authority, configuration)
  assertManifestPolicy({...manifest, dependencies: {...manifest.dependencies, '@profitia/srm-xray': 'file:../../packages/srm-xray'}}, manifest)
  assertLocalPackageSources(root, candidate, root)
  for (const name of PRIVATE_PACKAGES) assert.deepEqual(candidate.packages[`node_modules/${name}`], authority.packages[`node_modules/${name}`])
})
test('actual local npm install-links executes no prepare or install lifecycle with a credential', () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'controlled-local-lifecycle-')))
  const app = path.join(directory, 'apps/sg-runtime'), local = path.join(directory, 'packages/srm-xray')
  try {
    fs.mkdirSync(app, {recursive: true}); fs.mkdirSync(local, {recursive: true})
    const script = `require('node:fs').writeFileSync(process.env.FIXTURE_MARKER,JSON.stringify({credentialPresent:Boolean(process.env.NPM_TOKEN||process.env.NODE_AUTH_TOKEN||process.env.GH_TOKEN||process.env.GITHUB_TOKEN)}))`
    fs.writeFileSync(path.join(local, 'package.json'), JSON.stringify({name: '@profitia/srm-xray', version: '0.2.0', scripts: {prepare: `node -e "${script}"`, postinstall: `node -e "${script}"`}}))
    fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({name: 'local-consumer-fixture', version: '1.0.0', dependencies: {'@profitia/srm-xray': 'file:../../packages/srm-xray'}}))
    fs.writeFileSync(path.join(app, 'package-lock.json'), JSON.stringify({lockfileVersion: 3, packages: {'': {name: 'local-consumer-fixture', version: '1.0.0', dependencies: {'@profitia/srm-xray': 'file:../../packages/srm-xray'}}, 'node_modules/@profitia/srm-xray': {version: '0.2.0', resolved: 'file:../../packages/srm-xray', hasInstallScript: true}}}))
    fs.writeFileSync(path.join(directory, 'empty-npmrc'), '')
    const marker = path.join(directory, 'phase.json')
    const env = {...process.env, NPM_CONFIG_CACHE: path.join(directory, 'cache'), NPM_CONFIG_USERCONFIG: path.join(directory, 'empty-npmrc'), FIXTURE_MARKER: marker, NODE_AUTH_TOKEN: '', GH_TOKEN: '', GITHUB_TOKEN: '', NPM_TOKEN: 'synthetic-canary-no-real-authority'}
    const installed = spawnSync('npm', ['ci', '--install-links', '--ignore-scripts', '--offline', '--no-audit', '--no-fund'], {cwd: app, env, stdio: 'pipe'})
    assert.equal(installed.status, 0)
    assert.equal(fs.existsSync(marker), false, 'local prepare and postinstall must not execute while credential exists')
    assert.equal(fs.realpathSync(path.join(app, 'node_modules/@profitia/srm-xray')), path.join(app, 'node_modules/@profitia/srm-xray'), 'install-links must copy, not link, the local source')
    const lifecycle = spawnSync('npm', ['rebuild', '--foreground-scripts', '--offline', '--no-audit', '--no-fund'], {cwd: app, env: {...env, NPM_TOKEN: ''}, stdio: 'pipe'})
    assert.equal(lifecycle.status, 0)
    assert.deepEqual(JSON.parse(fs.readFileSync(marker, 'utf8')), {credentialPresent: false})
  } finally {fs.rmSync(directory, {recursive: true, force: true})}
})
function fixture() {
  return {proof: {schemaVersion: '1.0', repository: REPOSITORY, projectKey: 'SG2', targetEnvironment: 'development', scope: 'ISOLATED_API_AND_PERSISTENCE', candidateSha: other, controlSha: sha, controlPolicyDigest: controlPolicyDigest(), runId: '12', workflow: WORKFLOW, contract: {id: 'profitia.operation-context', sourceDigest: 'e'.repeat(64)}, credentialRemovedBeforeCandidateExecution: true, privatePackageArtifactsPublished: false, productDeploymentPerformed: false, customerIdentityAdapterVerified: false, install: 'CLEAN_REGISTRY_IGNORE_SCRIPTS', tests: 'PASS', typecheck: 'PASS', build: 'PASS'}, run: {id: 12, workflow_id: 34, repository: {full_name: REPOSITORY}, head_branch: 'main', head_sha: sha, event: 'workflow_dispatch', actor: {login: 'profitia'}, conclusion: 'success'}}
}
test('completed controlled proof binds exact candidate and control source; refuses reuse and false execution claims', () => {
  const {proof, run} = fixture(); assertProof(proof, run, other, 34)
  for (const change of [p => p.candidateSha = sha, p => p.controlSha = other, p => p.runId = '99', p => p.productDeploymentPerformed = true, p => p.tests = 'SKIPPED', p => p.install = 'COPIED_DEPENDENCIES', p => p.privatePackageArtifactsPublished = true, p => p.credentialRemovedBeforeCandidateExecution = false]) {const p = structuredClone(proof); change(p); rejection(() => assertProof(p, run, other, 34))}
  for (const delta of [{conclusion: 'failure'}, {conclusion: null}, {head_branch: 'feature'}, {workflow_id: 99}, {actor: {login: 'attacker'}}, {repository: {full_name: 'attacker/SG-dev'}}]) rejection(() => assertProof(proof, {...run, ...delta}, other, 34))
  rejection(() => assertProof({...proof, controlPolicyDigest: 'f'.repeat(64)}, run, other, 34))
  rejection(() => assertProof(proof, run, other, 34, {expectedControlDigest: 'f'.repeat(64)}))
})
test('same-run main push proof requires actually completed privileged job; cannot deadlock or waive a PR proof', () => {
  const {proof, run} = fixture(); run.event = 'push'; run.conclusion = null
  const options = {currentRunId: '12', currentRef: 'refs/heads/main', completedJobs: [{name: 'SG2 controlled operation integration', conclusion: 'success'}]}
  assertProof(proof, run, other, 34, options)
  for (const delta of [{currentRunId: '13'}, {currentRef: 'refs/pull/384/merge'}, {completedJobs: []}, {completedJobs: [{name: 'SG2 controlled operation integration', conclusion: 'failure'}]}]) rejection(() => assertProof(proof, run, other, 34, {...options, ...delta}))
})
test('actual npm ignores lifecycle during credential phase; later lifecycle executes with no credential', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'controlled-npm-lifecycle-test-'))
  try {
    const script = `require('node:fs').writeFileSync('phase.json',JSON.stringify({credentialPresent:Boolean(process.env.NPM_TOKEN)}))`
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({name: 'synthetic-controlled-ci-fixture', version: '1.0.0', scripts: {postinstall: `node -e "${script}"`}}))
    fs.writeFileSync(path.join(directory, 'package-lock.json'), JSON.stringify({name: 'synthetic-controlled-ci-fixture', version: '1.0.0', lockfileVersion: 3, packages: {'': {name: 'synthetic-controlled-ci-fixture', version: '1.0.0', hasInstallScript: true}}}))
    fs.writeFileSync(path.join(directory, 'empty-npmrc'), '')
    const env = {...process.env, NPM_CONFIG_CACHE: path.join(directory, 'cache'), NPM_CONFIG_USERCONFIG: path.join(directory, 'empty-npmrc'), NODE_AUTH_TOKEN: '', GH_TOKEN: '', GITHUB_TOKEN: '', NPM_TOKEN: 'synthetic-canary-no-real-authority'}
    const installed = spawnSync('npm', ['ci', '--ignore-scripts', '--offline', '--no-audit', '--no-fund'], {cwd: directory, env, stdio: 'pipe'})
    assert.equal(installed.status, 0)
    assert.equal(fs.existsSync(path.join(directory, 'phase.json')), false, 'credential-bearing install must execute no lifecycle')
    const lifecycle = spawnSync('npm', ['run', 'postinstall'], {cwd: directory, env: {...env, NPM_TOKEN: ''}, stdio: 'pipe'})
    assert.equal(lifecycle.status, 0)
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'phase.json'))), {credentialPresent: false})
  } finally {fs.rmSync(directory, {recursive: true, force: true})}
})


function sourceLayoutFixture(implementation='1.0.0-candidate.15') {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'contract-source-layout-'))
 const names=['src/operation-context.mjs','src/operation-context.d.mts','src/request-operations.mjs','src/request-operations.d.mts','migrations/access/017-additional-request-operations.sql']
 for(const name of names){const file=path.join(root,'packages/platform-contracts',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,name==='src/operation-context.mjs'?`export const OPERATION_CONTRACT = Object.freeze({ id: 'profitia.operation-context', version: '1.0.0', implementation: '${implementation}' })\n`:name+' synthetic source\n')}
 return{root,names,contract:{id:'profitia.operation-context',version:'1.0.0',implementation,sourceDigest:'a'.repeat(64)},file:name=>path.join(root,'packages/platform-contracts',name),close:()=>fs.rmSync(root,{recursive:true,force:true})}
}
for(const version of[1,3,14,15])test('fixed source provenance preserves explicit candidate'+version+' layout without evaluating candidate code',async()=>{
 const {createHash}=await import('node:crypto'),f=sourceLayoutFixture('1.0.0-candidate.'+version)
 try{const selected=f.names.slice(0,version===15?5:2),h=createHash('sha256');for(const name of selected)h.update(fs.readFileSync(f.file(name)));const before=f.names.map(name=>fs.readFileSync(f.file(name),'utf8'));assert.equal(operationContractProvenanceDigest(f.root,f.contract),h.digest('hex'));assert.deepEqual(f.names.map(name=>fs.readFileSync(f.file(name),'utf8')),before)}finally{f.close()}
})
test('candidate15 cannot downgrade to the two-file hash or supply its own source file list',async()=>{
 const {createHash}=await import('node:crypto'),f=sourceLayoutFixture()
 try{const h=createHash('sha256');for(const name of f.names.slice(0,2))h.update(fs.readFileSync(f.file(name)));const actual=operationContractProvenanceDigest(f.root,f.contract);assert.notEqual(actual,h.digest('hex'));assert.throws(()=>operationContractProvenanceDigest(f.root,{...f.contract,sourceFiles:['src/operation-context.mjs','src/operation-context.d.mts']}),/CONTRACT_PROVENANCE_MISMATCH/);assert.throws(()=>operationContractProvenanceDigest(f.root,{...f.contract,implementation:'1.0.0-candidate.14'}),/CONTRACT_IMPLEMENTATION_MISMATCH/)}finally{f.close()}
})
for(const name of['src/request-operations.mjs','src/request-operations.d.mts','migrations/access/017-additional-request-operations.sql'])test('candidate15 binds changes and refuses missing '+name,()=>{
 const f=sourceLayoutFixture()
 try{const before=operationContractProvenanceDigest(f.root,f.contract);fs.appendFileSync(f.file(name),'changed dependency');assert.notEqual(operationContractProvenanceDigest(f.root,f.contract),before);fs.unlinkSync(f.file(name));assert.throws(()=>operationContractProvenanceDigest(f.root,f.contract),/CONTRACT_SOURCE_FILE_REJECTED/)}finally{f.close()}
})
for(const implementation of['1.0.0-candidate.16','1.0.0-candidate.015','1.0.0-candidate.0','toString',null])test('unsupported source identity cannot select an implicit layout '+implementation,()=>{
 const f=sourceLayoutFixture();try{assert.throws(()=>operationContractProvenanceDigest(f.root,{...f.contract,implementation}),/CONTRACT_SOURCE_LAYOUT_UNSUPPORTED|CONTRACT_PROVENANCE_MISMATCH/)}finally{f.close()}
})
test('regular files and bounded size are required; symlink files and parent directories never widen reads',()=>{
 const f=sourceLayoutFixture(),outside=fs.mkdtempSync(path.join(os.tmpdir(),'untrusted-contract-source-'))
 try{const file=f.file('src/request-operations.mjs');fs.unlinkSync(file);fs.writeFileSync(path.join(outside,'private-file'),'synthetic outside marker');fs.symlinkSync(path.join(outside,'private-file'),file);assert.throws(()=>operationContractProvenanceDigest(f.root,f.contract),/CONTRACT_SOURCE_FILE_REJECTED/);fs.unlinkSync(file);fs.writeFileSync(file,'a'.repeat(1024*1024+1));assert.throws(()=>operationContractProvenanceDigest(f.root,f.contract),/CONTRACT_SOURCE_FILE_REJECTED/);fs.writeFileSync(file,'small');const src=f.file('src');fs.renameSync(src,path.join(outside,'src'));fs.symlinkSync(path.join(outside,'src'),src,'dir');assert.throws(()=>operationContractProvenanceDigest(f.root,f.contract),/CONTRACT_SOURCE_FILE_REJECTED/)}finally{f.close();fs.rmSync(outside,{recursive:true,force:true})}
})
test('actual current source provenance is the exact accepted SDK digest with all old trust rules intact',async()=>{
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),receipt=JSON.parse(fs.readFileSync(path.join(root,'apps/sg-runtime/operation-integration.json'),'utf8'))
 assert.equal(operationContractProvenanceDigest(root,receipt.contract),receipt.contract.sourceDigest)
 const sdk=await import('../../packages/platform-contracts/src/operation-context.mjs');assert.equal(await sdk.operationSourceDigest(),receipt.contract.sourceDigest)
})

for(const patch of[{id:'untrusted.contract'},{version:'9.0.0'},{sourceDigest:'invalid'},{paths:['../../outside']},{implementation:'1.0.0-candidate.14'}])test('source identity refuses malformed metadata or a downgrade '+JSON.stringify(patch),()=>{
 const f=sourceLayoutFixture();try{assert.throws(()=>operationContractProvenanceDigest(f.root,{...f.contract,...patch}),/CONTRACT_PROVENANCE_MISMATCH|CONTRACT_IMPLEMENTATION_MISMATCH/)}finally{f.close()}
})

const authorityRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const architecturePr = (count = 2) => ({...pr(), changed_files: count, base: {...pr().base, sha}, head: {...pr().head, ref: 'architecture/profile'}})
const producerFile = (filename = 'packages/platform-contracts/src/user-profile.mjs') => ({filename, status: 'modified', sha: 'c'.repeat(40)})
const architectureFiles = () => [producerFile(), producerFile('Canon/evidence/2026-10-21-identity-profile-b1-handoff.md')]

test('Architecture admission requires complete source files, exact SHA and actual trusted ownership', () => {
  assert.equal(selectCandidate(context(), architecturePr(), other, {files: architectureFiles()}), other)
  for (const files of [undefined, [], architectureFiles().slice(0, 1), [...architectureFiles(), producerFile()]]) rejection(() => selectCandidate(context(), architecturePr(), other, {files}))
  for (const expected of [undefined, sha, 'main']) rejection(() => selectCandidate(context(), architecturePr(), expected, {files: architectureFiles()}))
  const {proof, run} = fixture()
  assertProof(proof, run, selectCandidate(context(), architecturePr(), other, {files: architectureFiles()}), 34)
  rejection(() => assertProof(proof, run, sha, 34))
  // SG2 retains its original separate semantics; it requires no Architecture file list.
  assert.equal(selectCandidate(context(), pr(), other), other)
})

test('Architecture prefix never relaxes internal repository, owner, main or execution trust', () => {
  for (const edit of [p => p.head.repo.full_name = 'attacker/fork', p => p.base.repo.full_name = 'attacker/SG-dev', p => p.user.login = 'attacker', p => p.base.ref = 'staging', p => p.state = 'closed', p => p.head.ref = 'srm/work', p => p.head.sha = sha]) {
    const candidate = architecturePr(); edit(candidate)
    rejection(() => selectCandidate(context(), candidate, other, {files: architectureFiles()}))
  }
  for (const delta of [{ref: 'refs/heads/architecture/profile'}, {event: 'pull_request_target'}, {actor: 'attacker'}, {workflowRef: `${REPOSITORY}/${WORKFLOW}@refs/heads/untrusted`}]) rejection(() => selectCandidate({...context(), ...delta}, architecturePr(), other, {files: architectureFiles()}))
})

for (const name of ['apps/sg-runtime/package.json', 'apps/srm/page.tsx', 'apps/identity-runtime/index.mjs', 'packages/srm-xray/package.json',
  'scripts/governance/controlled-package-ci.mjs', WORKFLOW, '.github/workflows/identity-runtime-ci.yml', 'AGENTS.md',
  'Canon/registries/current-architecture-baseline-v1.json', 'Canon/registries/architecture-environment-topology-v1.json',
  'packages/platform-contracts/.npmrc', 'packages/platform-contracts/.env', 'packages/platform-contracts/scripts/install.mjs',
  'packages/platform-contracts/src/../../srm-xray/escape.mjs', 'packages/platform-contracts/src//escape.mjs', 'packages/platform-contracts/src/%2e%2e/escape.mjs',
  'packages/platform-contracts/src/escape.mjs\n', 'packages/platform-contracts-unrelated/src/escape.mjs', 'Canon/evidence/undated.md']) {
  test('Architecture rejects protected or non-producer path ' + JSON.stringify(name), () => rejection(() => selectCandidate(context(), architecturePr(), other, {files: [producerFile(), producerFile(name)]})))
}

test('Architecture rejects renames, forged/incomplete metadata, duplicate paths and evidence-only PRs', () => {
  for (const delta of [{status: 'renamed', previous_filename: 'apps/sg-runtime/escape.mjs'}, {previous_filename: 'apps/srm/escape.mjs'}, {status: 'copied'}, {sha: 'unverified'}]) rejection(() => selectCandidate(context(), architecturePr(), other, {files: [producerFile(), {...producerFile('packages/platform-contracts/src/other.mjs'), ...delta}]}))
  rejection(() => selectCandidate(context(), architecturePr(), other, {files: [producerFile(), producerFile()]}))
  rejection(() => selectCandidate(context(), architecturePr(1), other, {files: [architectureFiles()[1]]}))
  for (const count of [undefined, 0, 301, '2']) rejection(() => selectCandidate(context(), {...architecturePr(), changed_files: count}, other, {files: architectureFiles()}))
})

function routingFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-routing-authority-'))
  fs.mkdirSync(path.join(root, 'Canon/registries'), {recursive: true})
  for (const name of ['profitia-projects-v1.json', 'current-architecture-baseline-v1.json']) fs.copyFileSync(path.join(authorityRoot, 'Canon/registries', name), path.join(root, 'Canon/registries', name))
  return root
}

test('trusted ownership/project boundary drift fails closed; candidate declarations cannot substitute routing', () => {
  const root = routingFixture(), file = path.join(root, 'Canon/registries/current-architecture-baseline-v1.json'), original = fs.readFileSync(file, 'utf8')
  try {
    assertArchitectureFiles(architecturePr(), architectureFiles(), root)
    for (const patch of [{currentOwner: 'SG2 Runtime'}, {allowedProjectKeys: ['SG2']}, {baselineClassification: 'TRANSITIONAL'}]) {
      const registry = JSON.parse(original), surface = registry.surfaces.find(s => s.pathPatterns.includes('packages/platform-contracts/**'))
      Object.assign(surface, patch); fs.writeFileSync(file, JSON.stringify(registry))
      rejection(() => assertArchitectureFiles(architecturePr(), architectureFiles(), root))
    }
  } finally {fs.rmSync(root, {recursive: true, force: true})}
})

function apiFixture(candidate, files, after = candidate) {
  const calls = []
  return {calls, request: async endpoint => {
    calls.push(endpoint)
    const m = /\/files\?per_page=100&page=([1-4])$/.exec(endpoint)
    return {data: m ? files.slice((Number(m[1]) - 1) * 100, Number(m[1]) * 100) : structuredClone(calls.length === 1 ? candidate : after)}
  }}
}

test('trusted GitHub admission paginates actual files and fences exact PR metadata', async () => {
  const files = Array.from({length: 107}, (_, i) => producerFile(`packages/platform-contracts/src/contract-${i}.mjs`)), candidate = architecturePr(files.length), api = apiFixture(candidate, files)
  const result = await resolveCandidateAdmission(context(), '591', other, api.request)
  assert.equal(result.sha, other); assert.equal(result.admission.kind, 'ARCHITECTURE'); assert.equal(result.admission.files.length, 107)
  assert.deepEqual(api.calls, [`repos/${REPOSITORY}/pulls/591`, `repos/${REPOSITORY}/pulls/591/files?per_page=100&page=1`, `repos/${REPOSITORY}/pulls/591/files?per_page=100&page=2`, `repos/${REPOSITORY}/pulls/591`])
  for (const after of [{...candidate, head: {...candidate.head, sha}}, {...candidate, base: {...candidate.base, sha: other}}, {...candidate, changed_files: 106}, {...candidate, state: 'closed'}]) {
    const changed = apiFixture(candidate, files, after)
    await assert.rejects(resolveCandidateAdmission(context(), '591', other, changed.request))
  }
  const truncated = apiFixture(candidate, files.slice(0, 100)); await assert.rejects(resolveCandidateAdmission(context(), '591', other, truncated.request))
  const missing = apiFixture(candidate, []); await assert.rejects(resolveCandidateAdmission(context(), '591', other, missing.request))
  const duplicate = apiFixture(candidate, [...files.slice(0, 106), files[0]]); await assert.rejects(resolveCandidateAdmission(context(), '591', other, duplicate.request))
  const broad = apiFixture(architecturePr(301), files); await assert.rejects(resolveCandidateAdmission(context(), '591', other, broad.request)); assert.equal(broad.calls.length, 1)
})

test('unavailable file API is a failure; SG2 and exact-main keep their original no-list path', async () => {
  const unavailable = async endpoint => {if (endpoint.includes('/files?')) throw new Error('unavailable'); return {data: architecturePr()}}
  await assert.rejects(resolveCandidateAdmission(context(), '591', other, unavailable))
  const sg2 = apiFixture(pr(), []); assert.deepEqual(await resolveCandidateAdmission(context(), '591', other, sg2.request), {sha: other}); assert.equal(sg2.calls.length, 1)
  assert.deepEqual(await resolveCandidateAdmission(context(), '', sha, () => {throw new Error('must not request')}), {sha})
})

function checkoutFixture(edit = () => {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-checkout-')))
  const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', env: {...process.env, GIT_AUTHOR_NAME: 'Synthetic CI', GIT_AUTHOR_EMAIL: 'ci@example.invalid', GIT_COMMITTER_NAME: 'Synthetic CI', GIT_COMMITTER_EMAIL: 'ci@example.invalid'}}).trim()
  const filename = 'packages/platform-contracts/src/profile.mjs'
  fs.mkdirSync(path.dirname(path.join(root, filename)), {recursive: true}); fs.writeFileSync(path.join(root, filename), 'original synthetic source\n')
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'synthetic baseline'); const baseSha = git('rev-parse', 'HEAD')
  fs.writeFileSync(path.join(root, filename), 'changed synthetic source\n'); edit(root, filename)
  git('add', '.'); git('commit', '-qm', 'synthetic candidate'); const candidateSha = git('rev-parse', 'HEAD'), blob = git('rev-parse', `${candidateSha}:${filename}`)
  return {root, filename, candidateSha, admission: {kind: 'ARCHITECTURE', baseSha, files: [{filename, sha: blob, status: 'modified'}]}, close: () => fs.rmSync(root, {recursive: true, force: true})}
}

test('pinned real Git checkout binds complete diff, actual blob and regular-file contents before credentials', () => {
  const f = checkoutFixture()
  try {
    assertArchitectureCheckout(f.root, f.candidateSha, f.admission)
    const {proof, run} = fixture(); proof.candidateSha = f.candidateSha; assertProof(proof, run, f.candidateSha, 34)
    rejection(() => assertArchitectureCheckout(f.root, f.candidateSha, {...f.admission, files: [{...f.admission.files[0], sha: 'd'.repeat(40)}]}))
    fs.appendFileSync(path.join(f.root, f.filename), 'uncommitted replacement')
    rejection(() => assertArchitectureCheckout(f.root, f.candidateSha, f.admission))
  } finally {f.close()}
})

test('pinned Git diff rejects a hidden consumer mutation omitted from the API list', () => {
  const f = checkoutFixture(root => {fs.mkdirSync(path.join(root, 'apps/sg-runtime'), {recursive: true}); fs.writeFileSync(path.join(root, 'apps/sg-runtime/protected.mjs'), 'synthetic')})
  try {assert.throws(() => assertArchitectureCheckout(f.root, f.candidateSha, f.admission), /ARCHITECTURE_DIFF_MISMATCH/)} finally {f.close()}
})

test('Architecture Git checkout rejects symlink source even when API blob SHA matches', () => {
  const f = checkoutFixture((root, filename) => {fs.unlinkSync(path.join(root, filename)); fs.symlinkSync('/synthetic-outside-not-read', path.join(root, filename))})
  try {assert.throws(() => assertArchitectureCheckout(f.root, f.candidateSha, f.admission), /ARCHITECTURE_CHECKOUT_REJECTED/)} finally {f.close()}
})

test('all new trusted routing inputs invalidate the policy fingerprint; no candidate source is executed to hash them', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-policy-fingerprint-'))
  try {
    for (const name of CONTROL_POLICY_FILES) {fs.mkdirSync(path.dirname(path.join(root, name)), {recursive: true}); fs.copyFileSync(path.join(authorityRoot, name), path.join(root, name))}
    const before = controlPolicyDigest(root)
    for (const name of CONTROL_POLICY_FILES) {const file = path.join(root, name), original = fs.readFileSync(file); fs.appendFileSync(file, '\n'); assert.notEqual(controlPolicyDigest(root), before, name); fs.writeFileSync(file, original)}
  } finally {fs.rmSync(root, {recursive: true, force: true})}
})

test('workflow keeps main-only pinned controller, credential-free execution/proof and unchanged private installation phase', () => {
  const source = fs.readFileSync(path.join(authorityRoot, WORKFLOW), 'utf8'), privileged = source.slice(source.indexOf('  controlled-sg2:'), source.indexOf('  environment-policy-probe:'))
  assert.match(privileged, /if: github\.ref == 'refs\/heads\/main'/)
  assert.match(privileged, /environment: architecture-development/)
  assert.equal((privileged.match(/secrets\.SG2_PACKAGES_READ_TOKEN/g) ?? []).length, 1)
  const execute = privileged.slice(privileged.indexOf('      - name: Run lifecycle'), privileged.indexOf('      - name: Record sanitized'))
  for (const key of ['NPM_TOKEN', 'NODE_AUTH_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN']) assert(execute.includes(`${key}: ''`))
  assert(!execute.includes('secrets.')); assert.match(privileged, /run: node control\/scripts\/governance\/controlled-package-ci.mjs proof/)
  assert(!privileged.includes('continue-on-error')); assert(!privileged.includes('pull_request_target'))
})

test('missing proof is rejected and proof command refuses a credential before reading candidate state', () => {
  const {run} = fixture()
  rejection(() => assertProof(undefined, run, other, 34))
  rejection(() => assertProof({}, run, other, 34))
  const result = spawnSync(process.execPath, [path.join(authorityRoot, 'scripts/governance/controlled-package-ci.mjs'), 'proof'], {encoding: 'utf8', env: {...process.env, NPM_TOKEN: 'synthetic-canary-no-authority', NODE_AUTH_TOKEN: '', GH_TOKEN: ''}})
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /CREDENTIAL_PRESENT_IN_EXECUTION_PHASE/)
})
