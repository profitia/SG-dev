import { sign, verify } from 'node:crypto'
import { canonical, GateError, inspectSource, requireThat, sha256 } from './source.mjs'

const protocol = 'sg-governance-observation/v1'
const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const equal = (a, b) => canonical(a) === canonical(b)
const signingBytes = (role, keyId, payload) => Buffer.from(canonical({ protocol, role, keyId, payload }))
const keyType = key => key?.asymmetricKeyType === 'ed25519'

export function signEnvelope(role, keyId, payload, privateKey) {
  requireThat(keyType(privateKey) && privateKey.type === 'private', 'INVALID_SIGNING_KEY')
  return { role, keyId, payload, signature: sign(null, signingBytes(role, keyId, payload), privateKey).toString('base64') }
}

function readEnvelope(envelope, role, trusted) {
  requireThat(envelope?.role === role && envelope.keyId === trusted.id &&
    typeof envelope.signature === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(envelope.signature),
  'SIGNER_OR_ENVELOPE_REJECTED')
  const ok = verify(null, signingBytes(role, envelope.keyId, envelope.payload),
    trusted.publicKey, Buffer.from(envelope.signature, 'base64'))
  requireThat(ok, 'SIGNATURE_REJECTED')
  return envelope.payload
}

export function bindSource(source, policy, trust) {
  requireThat(isDigest(policy.digest) && typeof policy.appVersion === 'string' &&
    policy.appVersion.length > 0, 'INVALID_POLICY')
  const trustDigest = separateTrust(trust)
  return { source, policyDigest: policy.digest, appVersion: policy.appVersion, trustDigest, operation: 'SOURCE_R4' }
}

function grantMatches(envelope, binding, trust, now) {
  const grant = readEnvelope(envelope, 'owner', trust.owner)
  requireThat(equal(grant.binding, binding) && typeof grant.id === 'string' &&
    /^[A-Za-z0-9_-]{1,100}$/.test(grant.id), 'OWNER_DECISION_SCOPE_CHANGED')
  requireThat(Number.isSafeInteger(now) && Number.isSafeInteger(grant.validFrom) &&
    Number.isSafeInteger(grant.validUntil) && grant.validFrom <= now && now < grant.validUntil,
  'OWNER_DECISION_NOT_CURRENT', { hold: true })
  return grant
}

function separateTrust(trust) {
  const roles = [trust?.owner, trust?.producer, trust?.verifier]
  requireThat(roles.every(role => typeof role?.id === 'string' && role.id &&
      keyType(role.publicKey) && role.publicKey.type === 'public'), 'INVALID_TRUST_CONFIG')
  const fingerprints = roles.map(role => sha256(role.publicKey.export({ type: 'spki', format: 'der' })))
  requireThat(new Set(roles.map(role => role.id)).size === roles.length &&
    new Set(fingerprints).size === roles.length, 'INDEPENDENCE_REQUIRED')
  requireThat(Number.isSafeInteger(trust.appId) && trust.appId > 0, 'INVALID_APP_ID')
  return sha256(canonical({ appId: trust.appId,
    identities: roles.map((role, index) => ({ id: role.id, fingerprint: fingerprints[index] })) }))
}

async function checkCurrentGrant(grant, decision, grantState) {
  const state = await grantState(grant.id)
  requireThat(state?.digest === sha256(canonical(decision)) && state.active === true && state.used === false,
    'OWNER_DECISION_UNAVAILABLE_REVOKED_OR_USED', { hold: true })
}

export async function produce({ observe, policy, trust, decision, grantState, attestedRun, clock, privateKey }) {
  const source = await observe()
  requireThat(source.risk === 'R4' && !source.draft, 'R4_PR_NOT_ELIGIBLE', { hold: true })
  const binding = bindSource(source, policy, trust)
  const grant = grantMatches(decision, binding, trust, clock())
  await checkCurrentGrant(grant, decision, grantState)
  requireThat(attestedRun?.result === 'PASS' && isDigest(attestedRun.digest) &&
    typeof attestedRun.id === 'string' && attestedRun.id.length > 0 && equal(attestedRun.binding, binding), 'CI_ATTESTATION_MISSING_OR_FAILED', { hold: true })
  return signEnvelope('producer', trust.producer.id, {
    binding, decisionDigest: sha256(canonical(decision)), run: attestedRun,
  }, privateKey)
}

export function createObservation({ readSnapshot, git, policy }) {
  return async () => inspectSource(await readSnapshot(), git, policy)
}

export function verifyProof({ observe, policy, trust, decision, proof, grantState, readRun, clock, privateKey }) {
  return report(async () => {
    const current = await observe()
    requireThat(!current.draft, 'PR_DRAFT', { hold: true })
    if (current.risk !== 'R4') {
      return { status: 'NOT_APPLICABLE', reason: 'EXISTING_CONTROLS_ONLY', route: current.risk }
    }
    requireThat(decision && proof, 'REQUIRED_EVIDENCE_MISSING', { hold: true })
    const binding = bindSource(current, policy, trust)
    const received = readEnvelope(proof, 'producer', trust.producer)
    requireThat(equal(received.binding, binding), 'STALE_OR_DIFFERENT_SOURCE', { hold: true })
    const grant = grantMatches(decision, binding, trust, clock())
    requireThat(received.decisionDigest === sha256(canonical(decision)), 'DECISION_DIGEST_MISMATCH')
    await checkCurrentGrant(grant, decision, grantState)
    const { run, bytes } = await readRun(received.run.id, binding) ?? {}
    requireThat(Buffer.isBuffer(bytes) && sha256(bytes) === run?.digest && run.result === 'PASS' && equal(run, received.run) && equal(run.binding, binding),
      'ORIGINAL_RUN_MISSING_FAILED_OR_CHANGED')
    const fresh = await observe()
    requireThat(equal(current, fresh), 'SOURCE_CHANGED_DURING_VERIFICATION', { hold: true })
    await checkCurrentGrant(grant, decision, grantState)
    grantMatches(decision, binding, trust, clock())
    const statement = { binding, proofDigest: sha256(canonical(proof)), decisionDigest: received.decisionDigest,
      verdict: 'PASS', appId: trust.appId, observedAt: clock() }
    const attestation = signEnvelope('verifier', trust.verifier.id, statement, privateKey)
    readEnvelope(attestation, 'verifier', trust.verifier)
    return { status: 'PASS', reason: 'QUALIFIED_IN_OBSERVATION', route: 'R4', attestation }
  })
}

export async function simulateCheck(result, { observe, policy, trust, decision, grantState, clock }) {
  if (result.status === 'NOT_APPLICABLE') return null
  const evaluated = await report(async () => {
    if (result.status !== 'PASS') return result
    separateTrust(trust)
    const statement = readEnvelope(result.attestation, 'verifier', trust.verifier)
    requireThat(statement.verdict === 'PASS' && Number.isSafeInteger(trust.appId) &&
      statement.appId === trust.appId, 'APP_OR_VERIFIER_MISMATCH')
    const current = await observe()
    const binding = bindSource(current, policy, trust)
    requireThat(equal(statement.binding, binding), 'STALE_OR_DIFFERENT_SOURCE', { hold: true })
    const grant = grantMatches(decision, binding, trust, clock())
    requireThat(statement.decisionDigest === sha256(canonical(decision)), 'DECISION_DIGEST_MISMATCH')
    await checkCurrentGrant(grant, decision, grantState)
    grantMatches(decision, binding, trust, clock())
    return {
      status: 'PASS', reason: 'QUALIFIED_IN_OBSERVATION', expectedAppId: trust.appId,
      commit: current.testMerge, head: current.head, main: current.main, tree: current.integrationTree,
      attestationDigest: sha256(canonical(result.attestation)),
    }
  })
  return { mode: 'simulation', status: evaluated.status, reason: evaluated.reason,
    ...(evaluated.status === 'PASS' ? evaluated : {}) }
}

async function report(operation) {
  try {
    return await operation()
  } catch (error) {
    return error instanceof GateError ? { status: error.status, reason: error.code }
      : { status: 'HOLD', reason: 'DEPENDENCY_UNAVAILABLE' }
  }
}
