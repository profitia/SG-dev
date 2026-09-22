import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { validateGovernanceManifest } from './validate-governance-manifest.mjs'
import { compareProviderSnapshot, loadEnvironmentTopology, resolveEnvironmentProfile, validateEnvironmentTopology } from './environment-profile.mjs'
import { runGovernancePreflight } from './governance-preflight.mjs'
import { resolveHistoricalProjectProfile, resolveProjectProfile } from './project-profile.mjs'
import { resolveProjectRouting } from './routing-engine.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

test('repository governance manifest is valid and has one active execution canon', () => {
  const result = validateGovernanceManifest(repositoryRoot)
  assert.equal(result.valid, true, result.errors.join('\n'))
  assert.equal(result.activeDocuments.filter((document) => document.id === 'agent-execution-canon').length, 1)
  assert.equal(result.manifest.documents.find((document) => document.id === 'vsc-execution-canon').status, 'SUPERSEDED')
  assert.equal(result.manifest.documents.find((document) => document.id === 'sg2-agent-execution-canon-v2').status, 'SUPERSEDED')
})

test('project profiles route SG2 and allow only bounded CIC governance bootstrap before its registry exists', () => {
  const sg2 = resolveProjectProfile('sg-dev', repositoryRoot)
  const cic = resolveProjectProfile('CIC', repositoryRoot)
  assert.equal(sg2.projectKey, 'SG2')
  assert.equal(sg2.continuity.controlPlaneEnvironment, 'development')
  assert.equal(cic.continuity?.controlPlaneEnvironment ?? null, null)
  assert.equal(cic.repository.slug, 'profitia/conversational-intelligence-core')
  assert.throws(() => resolveProjectProfile('unregistered', repositoryRoot), /Unknown project/)

  const sg2Routing = resolveProjectRouting({ profile: sg2, targets: ['apps/pmos/package.json'], repositoryRoot })
  assert.equal(sg2Routing.ok, true)
  const tempCicRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cic-governance-bootstrap-'))
  const bootstrapRouting = resolveProjectRouting({
    profile: cic,
    targets: ['AGENTS.md', 'governance/registries/cic-architecture-baseline-v1.json'],
    repositoryRoot: tempCicRoot,
  })
  assert.equal(bootstrapRouting.ok, true)
  assert.equal(bootstrapRouting.bootstrapMode, true)

  const productRouting = resolveProjectRouting({ profile: cic, targets: ['packages/cic-core/src/index.ts'], repositoryRoot: tempCicRoot })
  assert.equal(productRouting.ok, false)
  assert.match(productRouting.error, /restricted to declared governance paths/)

  const registryPath = path.join(tempCicRoot, cic.repository.routingRegistry)
  fs.mkdirSync(path.dirname(registryPath), { recursive: true })
  fs.writeFileSync(registryPath, JSON.stringify({
    schemaVersion: '1.0',
    classificationReferenceSha: '2f59a86144b9f578b6cdc78746bee22192b1cb9f',
    pathResolutionStrategy: 'MOST_SPECIFIC_MATCH_WINS',
    surfaces: [{
      id: 'CIC-BASE-001',
      pathPatterns: ['packages/cic-core/**'],
      currentOwner: 'CIC Core',
      currentResponsibility: 'Canonical shared conversation contracts.',
      baselineClassification: 'ALIGNED',
    }],
  }))
  const onboardedRouting = resolveProjectRouting({ profile: cic, targets: ['packages/cic-core/src/index.ts'], repositoryRoot: tempCicRoot })
  assert.equal(onboardedRouting.ok, true)
  assert.equal(onboardedRouting.bootstrapMode, undefined)
})

test('SG2 environment topology resolves exact project and provider identities', () => {
  const sg2 = resolveProjectProfile('SG2', repositoryRoot)
  for (const targetEnvironment of ['development', 'staging']) {
    const resolved = resolveEnvironmentProfile({ profile: sg2, targetEnvironment, governanceRoot: repositoryRoot })
    assert.equal(resolved.targetEnvironment, targetEnvironment)
    assert.equal(resolved.environment.github.repository, 'profitia/SG-dev')
    assert.equal(resolved.environment.github.exclusiveProjectKey, 'SG2')
    assert.match(resolved.environment.render.environmentId, /^evm-/)
    assert.match(resolved.environment.neon.branchId, /^br-/)
  }
  assert.throws(
    () => resolveEnvironmentProfile({ profile: sg2, targetEnvironment: 'production', governanceRoot: repositoryRoot }),
    /not ACTIVE.*RESERVED/,
  )
  assert.throws(
    () => resolveEnvironmentProfile({ profile: sg2, targetEnvironment: 'client-demo', governanceRoot: repositoryRoot }),
    /Unknown TARGET_ENVIRONMENT/,
  )
})

test('SG2 environment topology prevents cross-environment service and database identities', () => {
  const sg2 = resolveProjectProfile('SG2', repositoryRoot)
  const { registry } = loadEnvironmentTopology(sg2, repositoryRoot)
  const result = validateEnvironmentTopology(registry)
  assert.equal(result.valid, true, result.errors.join('\n'))

  const staging = registry.environments.staging
  const development = registry.environments.development
  assert.equal(registry.policy.continuityControlPlaneEnvironment, 'development')
  assert.equal(registry.continuityControlPlane.logicalEnvironment, 'development')
  assert.equal(registry.continuityControlPlane.stagingOrProductionRuntimeAllowed, false)
  assert.deepEqual(registry.continuityControlPlane.servesGovernedTasksTargeting, ['development'])
  assert.match(registry.continuityControlPlane.render.serviceId, /^srv-/)
  assert.equal(registry.continuityControlPlane.stagingOrProductionContinuityAllowed, false)
  assert.equal(registry.continuityControlPlane.neon.projectId, 'lucky-dream-96138453')
  assert.equal(staging.deploymentPolicy, 'MANUAL_EXACT_SHA')
  assert.equal(staging.render.services.dashboard.autoDeploy, false)
  assert.equal(staging.render.services.runtime.autoDeploy, false)
  assert.equal(staging.frozenBaseline.sourceSha, '518f1ad9d6143748d9d5f42a084cae6135b66799')
  assert.equal(staging.frozenBaseline.databaseBranchId, staging.neon.branchId)
  assert.equal(development.status, 'ACTIVE')
  assert.equal(development.github.environmentName, 'sg2-development')
  assert.equal(staging.github.environmentName, 'sg2-staging')
  assert.equal(registry.environments.production.github.environmentName, 'sg2-production')
  assert.equal(new Set(Object.values(registry.environments).map((environment) => environment.github.environmentId)).size, 3)
  assert.equal(development.isolationProof.developmentDurableJobCount, 1)
  assert.equal(development.isolationProof.stagingDurableJobCount, 0)
  assert.equal(development.isolationProof.stagingActionTraceCount, 0)
  for (const service of Object.values(development.render.services)) {
    assert.match(service.currentDeployId, /^dep-/)
  }
  assert.doesNotMatch(JSON.stringify(registry), /postgres(?:ql)?:\/\//i)
})

test('SRM uses the shared routing registry and activates only verified Development topology', () => {
  const srm = resolveProjectProfile('SRM', repositoryRoot)
  assert.equal(srm.repository.routingRegistry, 'Canon/registries/current-architecture-baseline-v1.json')
  assert.equal(srm.repository.environmentTopologyRegistry, 'Canon/registries/srm-environment-topology-v1.json')
  assert.equal(srm.continuity.controlPlaneEnvironment, 'development')
  const { registry } = loadEnvironmentTopology(srm, repositoryRoot)
  assert.equal(validateEnvironmentTopology(registry).valid, true)
  const development = resolveEnvironmentProfile({ profile: srm, targetEnvironment: 'development', governanceRoot: repositoryRoot })
  assert.equal(development.environment.neon.databaseName, 'srm_app')
  assert.notEqual(development.environment.neon.projectId, srm.database.projectId)
  for (const name of ['staging', 'production']) {
    assert.throws(() => resolveEnvironmentProfile({ profile: srm, targetEnvironment: name, governanceRoot: repositoryRoot }), /not ACTIVE.*RESERVED/)
  }
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'srm-reserved-activation-'))
  const topologyPath = path.join(temporaryRoot, srm.repository.environmentTopologyRegistry)
  fs.mkdirSync(path.dirname(topologyPath), { recursive: true })
  for (const name of ['staging', 'production']) {
    const premature = structuredClone(registry)
    premature.environments[name].status = 'ACTIVE'
    premature.environments[name].verificationStatus = 'VERIFIED'
    fs.writeFileSync(topologyPath, JSON.stringify(premature))
    assert.throws(() => resolveEnvironmentProfile({ profile: srm, targetEnvironment: name, governanceRoot: temporaryRoot }), /lacks required provider identities/)
  }
  const routed = resolveProjectRouting({ profile: srm, targets: ['apps/srm/package.json', 'Canon/registries/srm-environment-topology-v1.json', 'scripts/governance/environment-profile.mjs'], repositoryRoot })
  assert.equal(routed.ok, true)
  assert.deepEqual(routed.results.map((entry) => entry.baselineClassification), ['ALIGNED', 'ALIGNED', 'ALIGNED'])
})

test('SRM active environment fails closed on wrong repository, Neon project, or product database', () => {
  const srm = resolveProjectProfile('SRM', repositoryRoot)
  const original = loadEnvironmentTopology(srm, repositoryRoot).registry
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'srm-environment-identity-'))
  const topologyPath = path.join(temporaryRoot, srm.repository.environmentTopologyRegistry)
  fs.mkdirSync(path.dirname(topologyPath), { recursive: true })
  const resolve = (mutate) => {
    const copy = structuredClone(original)
    mutate(copy.environments.development)
    fs.writeFileSync(topologyPath, JSON.stringify(copy))
    return () => resolveEnvironmentProfile({ profile: srm, targetEnvironment: 'development', governanceRoot: temporaryRoot })
  }
  assert.throws(resolve((environment) => { environment.github.repository = 'profitia/other' }), /wrong GitHub repository/)
  assert.throws(resolve((environment) => { environment.github.repositoryId = 999 }), /verified SRM GitHub identity/)
  assert.throws(resolve((environment) => { environment.neon.projectId = srm.database.projectId }), /PMOS database identity/)
  assert.throws(resolve((environment) => { environment.neon.databaseName = srm.database.databaseName }), /PMOS database identity/)
  assert.throws(resolve((environment) => { environment.render.projectId = 'prj-other' }), /wrong SRM Render project identity/)
  assert.throws(resolve((environment) => { environment.neon.projectId = 'wrong-neon-project' }), /wrong SRM product Neon project identity/)
  assert.throws(resolve((environment) => { environment.neon.databaseName = 'wrong_database' }), /wrong SRM product database identity/)
  assert.throws(resolve((environment) => { environment.neon.databaseId = null }), /application database identity/)
})

test('SRM preflight gates Development and blocks reserved environments without PMOS continuity', () => {
  const input = {
    mode: 'development', project: 'SRM', target_environment: 'development', task_id: 'srm-environment-test',
    conversation_id: 'srm-environment-test-conversation', title: 'SRM governance test',
    workspace: 'SG-dev Codespaces SRM', execution_environment: 'codespaces', scope: 'governance',
    targets: ['Canon/registries/profitia-projects-v1.json'], legacyExceptions: [], repository_root: repositoryRoot,
    ci: false, offline: true, allowDirty: true, requireBegin: false, skipRuntime: true, checkEstate: false,
  }
  const development = runGovernancePreflight(input)
  assert.equal(development.gates.TARGET_ENVIRONMENT_GATE.status, 'PASS')
  assert.equal(development.gates.PMOS_CONTROL_PLANE_GATE.status, 'PASS')
  for (const target_environment of ['staging', 'production']) {
    const result = runGovernancePreflight({ ...input, target_environment })
    assert.equal(result.gates.TARGET_ENVIRONMENT_GATE.status, 'BLOCKED')
    assert.equal(result.gates.PMOS_BEGIN_GATE.status, 'NOT_APPLICABLE')
    assert.equal(result.gates.PMOS_RUNTIME_GATE.status, 'NOT_APPLICABLE')
    assert.equal(result.verdict, 'BLOCKED')
  }
  const wrongExecution = runGovernancePreflight({ ...input, execution_environment: 'staging' })
  assert.equal(wrongExecution.gates.PMOS_CONTROL_PLANE_GATE.status, 'BLOCKED')
})

test('fresh provider snapshots detect Staging SHA drift, auto-deploy drift and unregistered services', () => {
  const sg2 = resolveProjectProfile('SG2', repositoryRoot)
  const { registry } = loadEnvironmentTopology(sg2, repositoryRoot)
  const staging = registry.environments.staging
  const capturedAt = new Date().toISOString()
  const snapshot = {
    capturedAt,
    source: { render: 'render-api', neon: 'neon-api' },
    renderServices: Object.values(staging.render.services).map((service) => ({
      id: service.serviceId,
      environmentId: staging.render.environmentId,
      repo: 'https://github.com/profitia/SG-dev',
      autoDeploy: service.autoDeploy,
      liveStatus: 'live',
      liveDeployId: service.baselineDeployId,
      liveSha: service.baselineSha,
    })),
    neonBranches: [{ id: staging.neon.branchId, projectId: staging.neon.projectId, name: staging.neon.branchName }],
  }
  assert.equal(compareProviderSnapshot(registry, 'staging', snapshot).valid, true)
  const drifted = structuredClone(snapshot)
  drifted.renderServices[0].liveSha = '48dfcd8af93fa9f5e9708653a868b89c138b6b91'
  drifted.renderServices[1].autoDeploy = true
  drifted.renderServices.push({ ...drifted.renderServices[0], id: 'srv-unregistered' })
  const result = compareProviderSnapshot(registry, 'staging', drifted)
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /Staging baseline drift/)
  assert.match(result.errors.join('\n'), /autoDeploy drift/)
  assert.match(result.errors.join('\n'), /Unregistered SG2 Render service/)
  assert.equal(compareProviderSnapshot(registry, 'staging', { ...snapshot, capturedAt: '2020-01-01T00:00:00Z' }).valid, false)
})

test('SRM provider snapshot detects an unregistered Development service without borrowing SG2 identity', () => {
  const srm = resolveProjectProfile('SRM', repositoryRoot)
  const { registry } = loadEnvironmentTopology(srm, repositoryRoot)
  const development = registry.environments.development
  const snapshot = {
    capturedAt: new Date().toISOString(),
    source: { render: 'render-api', neon: 'neon-api' },
    renderServices: [{
      id: 'srv-unregistered-srm',
      environmentId: development.render.environmentId,
      repo: 'https://github.com/profitia/SG-dev.git',
      autoDeploy: 'no',
      liveStatus: 'live',
    }],
    neonBranches: [{ id: development.neon.branchId, projectId: development.neon.projectId, name: development.neon.branchName }],
  }
  const result = compareProviderSnapshot(registry, 'development', snapshot)
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /Unregistered SRM Render service/)
})

test('SG2 PMOS applies only to Development and creates no Staging or Production continuity', () => {
  const input = {
    mode: 'development',
    project: 'SG2',
    target_environment: 'staging',
    task_id: 'governance-test-pmos-control-plane',
    conversation_id: 'governance-test-pmos-control-plane-conversation',
    title: 'Governance test PMOS control plane',
    workspace: 'SG-dev',
    execution_environment: 'development',
    scope: 'governance-test',
    targets: ['Canon/adapters/sg2-project-adapter-v1.md'],
    legacyExceptions: [],
    repository_root: repositoryRoot,
    json: false,
    ci: false,
    offline: true,
    allowDirty: true,
    requireBegin: false,
    skipRuntime: true,
    checkEstate: false,
  }

  const staging = runGovernancePreflight(input)
  assert.equal(staging.gates.PMOS_CONTROL_PLANE_GATE.status, 'NOT_APPLICABLE')
  assert.equal(staging.gates.PMOS_RUNTIME_GATE.status, 'NOT_APPLICABLE')
  assert.equal(staging.gates.PMOS_BEGIN_GATE.status, 'NOT_APPLICABLE')
  assert.equal(staging.gates.LIVE_PROVIDER_DRIFT_GATE.status, 'BLOCKED')
  assert.equal(staging.verdict, 'BLOCKED')
  const unreadableSnapshot = runGovernancePreflight({ ...input, provider_snapshot: path.join(os.tmpdir(), 'missing-sg2-provider-snapshot.json') })
  assert.equal(unreadableSnapshot.gates.TARGET_ENVIRONMENT_GATE.status, 'PASS')
  assert.equal(unreadableSnapshot.gates.LIVE_PROVIDER_DRIFT_GATE.status, 'BLOCKED')

  const reservedProduction = runGovernancePreflight({ ...input, target_environment: 'production' })
  assert.equal(reservedProduction.gates.TARGET_ENVIRONMENT_GATE.status, 'BLOCKED')
  assert.equal(reservedProduction.gates.PMOS_BEGIN_GATE.status, 'NOT_APPLICABLE')
  assert.equal(reservedProduction.verdict, 'BLOCKED')

  const development = runGovernancePreflight({ ...input, target_environment: 'development' })
  assert.equal(development.gates.PMOS_CONTROL_PLANE_GATE.status, 'PASS')
  assert.equal(development.verdict, 'PASS')

  const unlawful = runGovernancePreflight({ ...input, target_environment: 'development', execution_environment: 'staging' })
  assert.equal(unlawful.gates.PMOS_CONTROL_PLANE_GATE.status, 'BLOCKED')
  assert.equal(unlawful.verdict, 'BLOCKED')

  const ci = runGovernancePreflight({ ...input, ci: true, execution_environment: 'ci' })
  assert.equal(ci.gates.PMOS_CONTROL_PLANE_GATE.status, 'NOT_APPLICABLE')
  assert.equal(ci.verdict, 'PASS')
})

test('PCOS is not an active PMOS project identity and cross-runtime coupling stays blocked', () => {
  const retiredLabel = 'SpendGuru 2.0 - PCOS Runtime'
  assert.throws(() => resolveProjectProfile(retiredLabel, repositoryRoot), /Unknown project/)
  assert.equal(resolveHistoricalProjectProfile(retiredLabel, repositoryRoot)?.projectKey, 'SG2')

  const projectRegistry = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'Canon/registries/profitia-projects-v1.json'), 'utf8'))
  const sg2 = projectRegistry.projects.find((project) => project.projectKey === 'SG2')
  const srm = projectRegistry.projects.find((project) => project.projectKey === 'SRM')
  assert.equal(sg2.aliases.includes(retiredLabel), false)
  assert.equal(sg2.legacyAliases.includes(retiredLabel), true)
  assert.equal(sg2.database.purpose, 'PMOS_CONTINUITY')
  assert.equal(srm.database.purpose, 'PMOS_CONTINUITY')
  assert.equal(srm.database.databaseName, 'srm_pmos')

  const sourceFiles = (root) => {
    const pending = [root]
    const result = []
    while (pending.length > 0) {
      const current = pending.pop()
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const resolved = path.join(current, entry.name)
        if (entry.isDirectory()) pending.push(resolved)
        else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) result.push(resolved)
      }
    }
    return result
  }
  const importsFrom = (root) => sourceFiles(root)
    .flatMap((file) => fs.readFileSync(file, 'utf8').split('\n').filter((line) => /(?:from\s+|import\s*\(|require\s*\()/.test(line)))
    .join('\n')

  assert.doesNotMatch(importsFrom(path.join(repositoryRoot, 'apps/pcos-explorer/src')), /pmos/i)
  assert.doesNotMatch(importsFrom(path.join(repositoryRoot, 'apps/pmos/src')), /pcos/i)

  const pcosBlueprint = fs.readFileSync(path.join(repositoryRoot, 'apps/pcos-explorer/render.preview.yaml'), 'utf8')
  assert.match(pcosBlueprint, /buildFilter:/)
  assert.match(pcosBlueprint, /apps\/pcos-explorer\/\*\*/)
  assert.doesNotMatch(pcosBlueprint, /(?:DATABASE_URL|DIRECT_URL)/)

  const pcosPackage = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'apps/pcos-explorer/package.json'), 'utf8'))
  assert.equal('db:sync' in pcosPackage.scripts, false)
  assert.equal('db:check-sync' in pcosPackage.scripts, false)
  assert.equal(fs.existsSync(path.join(repositoryRoot, 'apps/pcos-explorer/scripts/sync-schema.mjs')), false)

  const rootBlueprint = fs.readFileSync(path.join(repositoryRoot, 'render.yaml'), 'utf8')
  const pmosService = rootBlueprint.slice(rootBlueprint.indexOf('name: pmos-spendguru2-development'))
  assert.match(pmosService, /buildFilter:/)
  assert.match(pmosService, /apps\/pmos\/\*\*/)
  assert.doesNotMatch(pmosService, /apps\/pcos-explorer/)
})

test('manifest validation rejects an active dependency on a superseded document', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sg2-governance-manifest-'))
  const manifestDirectory = path.join(tempRoot, 'Canon', 'registries')
  fs.mkdirSync(manifestDirectory, { recursive: true })
  fs.writeFileSync(path.join(tempRoot, 'AGENTS.md'), 'loader')
  fs.mkdirSync(path.join(tempRoot, 'scripts', 'governance'), { recursive: true })
  fs.writeFileSync(path.join(tempRoot, 'scripts', 'governance', 'governance-preflight.mjs'), 'export {}')
  fs.writeFileSync(path.join(tempRoot, 'active.md'), 'active')
  fs.writeFileSync(path.join(tempRoot, 'old.md'), 'old')
  fs.writeFileSync(path.join(manifestDirectory, 'governance-manifest-v2.json'), JSON.stringify({
    schemaVersion: '2.0',
    validation: { failClosed: true },
    entrypoint: 'AGENTS.md',
    preflight: 'scripts/governance/governance-preflight.mjs',
    documents: [
      { id: 'old', version: '1', owner: 'test', path: 'old.md', status: 'SUPERSEDED', loadOrder: null, dependsOn: [], supersededBy: 'active' },
      { id: 'active', version: '2', owner: 'test', path: 'active.md', status: 'ACTIVE', loadOrder: 1, dependsOn: ['old'] },
    ],
  }))

  const result = validateGovernanceManifest(tempRoot)
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /depends on superseded/)
})
