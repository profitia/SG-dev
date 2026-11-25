import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createObservation, verifyProof } from './gate.mjs'
import { canonical, GateError, isOid, readGitHubSnapshot, requireThat, sha256 } from './source.mjs'

const schema = 'sg-gv-01b-observation/v1'
const positiveId = value => Number.isSafeInteger(value) && value > 0
const same = (left, right) => canonical(left) === canonical(right)
const maxArtifactBytes = 1024 * 1024
const routedInputs = [
  'Canon/registries/current-architecture-baseline-v1.json',
  'Canon/registries/profitia-projects-v1.json',
  'scripts/architecture-classify.mjs',
  'scripts/governance/routing-engine.mjs',
]

function observedPolicy(bytes, expectedDigest, resolveRoute, readIntegrationImpact) {
  requireThat(Buffer.isBuffer(bytes) && bytes.length <= 64 * 1024 &&
    sha256(bytes) === expectedDigest, 'TRUST_POLICY_DIGEST_MISMATCH')
  const config = JSON.parse(bytes)
  const { repository, repoId, repoOwnerId, authoritySha, appVersion, evidence, r1Paths } = config
  requireThat(config.schema === schema && config.mode === 'observation' &&
    /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repository ?? '') &&
    positiveId(repoId) && positiveId(repoOwnerId) && isOid(authoritySha) &&
    typeof appVersion === 'string' && appVersion.length > 0 &&
    r1Paths && Object.getPrototypeOf(r1Paths) === Object.prototype &&
    evidence && positiveId(evidence.workflowId) && positiveId(evidence.actorId) &&
    isOid(evidence.controlSha) && typeof evidence.controlBranch === 'string' &&
    /^\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml$/.test(evidence.workflowPath ?? '') &&
    typeof resolveRoute === 'function' &&
    (readIntegrationImpact === undefined || typeof readIntegrationImpact === 'function'), 'INVALID_OBSERVATION_POLICY')
  return {
    repository, repoId, repoOwnerId, authoritySha, evidence, appVersion, r1Paths,
    digest: expectedDigest, readIntegrationImpact,
    resolveRoute(path) {
      const route = resolveRoute(path)
      return route?.projectBoundaryStatus === 'ALLOWED' ? route : null
    },
  }
}

function readEvidenceMember(bytes) {
  const directory = mkdtempSync(join(tmpdir(), 'sg-source-evidence-'))
  try {
    const archive = join(directory, 'original.zip')
    writeFileSync(archive, bytes, { flag: 'wx', mode: 0o600 })
    const unzip = args => execFileSync('/usr/bin/unzip', [...args, archive, ...(args[0] === '-p' ? ['evidence.json'] : [])], {
      timeout: 3_000, maxBuffer: 64 * 1024, env: { LANG: 'C' },
    })
    requireThat(unzip(['-Z1']).toString('utf8') === 'evidence.json\n', 'ORIGINAL_ARTIFACT_LAYOUT_REJECTED')
    return JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(unzip(['-p'])))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

export function originalGitHubRun({ get, downloadZip, policy, binding, runId, attempt, artifactId }) {
  requireThat([runId, attempt, artifactId].every(positiveId), 'ORIGINAL_RUN_ID_REJECTED')
  requireThat(same(binding.policyDigest, policy.digest), 'ORIGINAL_RUN_POLICY_CHANGED')
  const source = binding.source
  const control = policy.evidence
  const api = '/repos/' + policy.repository + '/actions'
  const runPath = api + '/runs/' + runId
  const artifactPath = api + '/artifacts/' + artifactId

  function validRun(run) {
    return run?.id === runId && run.run_attempt === attempt &&
      run.repository?.id === policy.repoId && run.head_repository?.id === policy.repoId &&
      run.head_sha === control.controlSha && run.head_branch === control.controlBranch &&
      run.workflow_id === control.workflowId && run.path === control.workflowPath &&
      run.actor?.id === control.actorId && run.triggering_actor?.id === control.actorId &&
      run.event === 'workflow_dispatch' && run.status === 'completed' && run.conclusion === 'success'
  }

  return (async () => {
    const [run, originalAttempt, artifact] = await Promise.all([
      get(runPath), get(runPath + '/attempts/' + attempt), get(artifactPath),
    ])
    requireThat(validRun(run) && validRun(originalAttempt), 'ORIGINAL_WORKFLOW_OR_ATTEMPT_REJECTED')
    const artifactRun = artifact?.workflow_run
    requireThat(artifact?.id === artifactId && artifact.name === 'source-admission-evidence' && artifact.expired === false &&
      artifactRun?.id === runId && artifactRun.repository_id === policy.repoId &&
      artifactRun.head_repository_id === policy.repoId && artifactRun.head_sha === control.controlSha &&
      artifactRun.head_branch === control.controlBranch &&
      positiveId(artifact.size_in_bytes) && artifact.size_in_bytes <= maxArtifactBytes,
    'ORIGINAL_ARTIFACT_METADATA_REJECTED')
    const bytes = await downloadZip(artifactPath + '/zip', maxArtifactBytes)
    requireThat(Buffer.isBuffer(bytes) && bytes.length === artifact.size_in_bytes &&
      artifact.digest === 'sha256:' + sha256(bytes), 'ORIGINAL_ARTIFACT_BYTES_REJECTED')
    const descriptor = {
      repo: policy.repoId, pr: source.pr, head: source.head, base: source.main,
      merge: source.testMerge, tree: source.integrationTree, sourceDigest: source.sourceDigest,
      policyDigest: policy.digest, control: control.controlSha, run: runId, attempt,
    }
    requireThat(same(readEvidenceMember(bytes), descriptor), 'ORIGINAL_ARTIFACT_SOURCE_MISMATCH')
    const [freshRun, freshArtifact] = await Promise.all([get(runPath), get(artifactPath)])
    requireThat(validRun(freshRun) && freshArtifact && same(freshArtifact, artifact),
    'ORIGINAL_EVIDENCE_CHANGED', { hold: true })
    return {
      run: { id: [runId, attempt, artifactId].join('/'), digest: sha256(bytes), result: 'PASS', binding },
      bytes,
    }
  })()
}

// The host supplies the digest, approved routing checkout and distinct credentials.
// The adapter accepts read capabilities only and cannot publish a check or perform a merge.
export async function observePullRequest({
  policyBytes, expectedDigest, resolveRoute, readGitHub, git, pullNumber, trust,
  decision, proof, grantState, downloadZip, verifierKey, readIntegrationImpact, clock = Date.now,
}) {
  try {
    const policy = observedPolicy(policyBytes, expectedDigest, resolveRoute, readIntegrationImpact)
    const observe = createObservation({
      readSnapshot: async () => {
        const snapshot = await readGitHubSnapshot(readGitHub, policy.repository, pullNumber)
        requireThat(git.commonBase(policy.authoritySha, snapshot.main) === policy.authoritySha &&
          routedInputs.every(path => {
            const trusted = git.entry(policy.authoritySha, path)
            return trusted?.mode === '100644' && same(trusted, git.entry(snapshot.main, path))
          }), 'ROUTING_AUTHORITY_MOVED', { hold: true })
        return snapshot
      },
      git, policy,
    })

    const result = await verifyProof({
      observe, policy, trust, decision, proof, grantState, clock, privateKey: verifierKey,
      readRun: (id, binding) => {
        const match = /^([1-9]\d*)\/([1-9]\d*)\/([1-9]\d*)$/.exec(id)
        requireThat(match, 'ORIGINAL_RUN_ID_REJECTED')
        const [runId, attempt, artifactId] = match.slice(1).map(Number)
        return originalGitHubRun({
          get: readGitHub, downloadZip, policy, binding, runId, attempt, artifactId,
        })
      },
    })
    return { ...result, mode: 'observation', mergeAuthority: false }
  } catch (error) {
    const result = error instanceof GateError ? { status: error.status, reason: error.code }
      : { status: 'HOLD', reason: 'DEPENDENCY_UNAVAILABLE' }
    return { ...result, mode: 'observation', mergeAuthority: false }
  }
}
