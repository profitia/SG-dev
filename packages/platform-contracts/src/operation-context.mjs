import { createHash, randomUUID } from 'node:crypto'

export const OPERATION_CONTRACT = Object.freeze({ id: 'profitia.operation-context', version: '1.0.0', implementation: '1.0.0-candidate.1' })

// Explicit implementation, not an interpreter of the target specification JSON.
// Everything outside this bounded candidate is denied, including jobs and billing.
const rule = (feature, resourceType, dataClass, effect, product = null, mode = 'ORGANISATION') => Object.freeze({ feature, resourceType, dataClass, effect, product, mode })
const rules = Object.freeze({
  'account.settings.read': rule('account', 'account_settings', 'ACCOUNT_PRIVATE', 'READ', null, 'ACCOUNT'),
  'account.settings.write': rule('account', 'account_settings', 'ACCOUNT_PRIVATE', 'WRITE', null, 'ACCOUNT'),
  'knowledge.read': rule('market', 'market_knowledge', 'SHARED_KNOWLEDGE', 'READ', 'SPENDGURU'),
  'benchmark.selection.read': rule('benchmark', 'benchmark_selection', 'ORGANISATION_PRIVATE', 'READ', 'SPENDGURU'),
  'benchmark.selection.write': rule('benchmark', 'benchmark_selection', 'ORGANISATION_PRIVATE', 'WRITE', 'SPENDGURU'),
  'personal.list.read': rule('personal_workspace', 'personal_list', 'USER_IN_ORGANISATION_PRIVATE', 'READ'),
  'personal.list.write': rule('personal_workspace', 'personal_list', 'USER_IN_ORGANISATION_PRIVATE', 'WRITE'),
  'supplier.report.read': rule('supplier_report', 'supplier_report', 'SHARED_KNOWLEDGE', 'READ', 'SUPPLIER_INTELLIGENCE'),
  'supplier.report.project': rule('supplier_report', 'supplier_projection', 'ORGANISATION_PRIVATE', 'WRITE', 'SUPPLIER_INTELLIGENCE'),
})
export const IMPLEMENTED_OPERATIONS = Object.freeze(Object.keys(rules))
const profiles = Object.freeze({
  PORR_SUITE: { features: ['account', 'market', 'benchmark', 'personal_workspace', 'supplier_report'], products: ['SPENDGURU', 'SUPPLIER_INTELLIGENCE'], fixed: true },
  SPENDGURU_SAAS: { features: ['account', 'market', 'benchmark', 'personal_workspace', 'supplier_report'], products: ['SPENDGURU', 'SUPPLIER_INTELLIGENCE'] },
  SUPPLIER_INTELLIGENCE_STANDALONE: { features: ['account', 'personal_workspace', 'supplier_report'], products: ['SUPPLIER_INTELLIGENCE'] },
})

export class OperationDenied extends Error {
  constructor(reasonCode, decisionId = randomUUID()) {
    super('Operation unavailable')
    this.name = 'OperationDenied'
    this.reasonCode = reasonCode
    this.decisionId = decisionId
  }
}
const deny = (reason) => { throw new OperationDenied(reason) }
const nonempty = (v) => typeof v === 'string' && v.length > 0 && v.length <= 256
const validUntil = (v, now) => typeof v === 'string' && Number.isFinite(Date.parse(v)) && Date.parse(v) > now
const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  throw new TypeError('Only finite JSON payloads are supported')
}

export function operationPayloadDigest(payload) {
  return createHash('sha256').update(canonical(payload)).digest('hex')
}

function permission(access, operation, feature, resourceId) {
  if (!Array.isArray(access.permissions) || !Array.isArray(access.denies)) return false
  const matches = p => p.operation === operation && p.feature === feature && (p.resourceId === null || p.resourceId === resourceId)
  return !access.denies.some(matches) && access.permissions.some(matches)
}

function checkResource(resource, context, expected) {
  if (!resource || resource.environment !== context.environment || resource.type !== expected.resourceType || resource.dataClass !== expected.dataClass || !nonempty(resource.id) || !nonempty(resource.version) || !nonempty(resource.projectionVersion)) deny('RESOURCE_SCOPE_MISMATCH')
  if (resource.dataClass === 'SHARED_KNOWLEDGE') {
    if (resource.ownerOrganisationId !== null || resource.ownerUserId !== null || resource.approvedSharedProjection !== true) deny('RESOURCE_SCOPE_MISMATCH')
  } else if (resource.dataClass === 'ACCOUNT_PRIVATE') {
    if (resource.ownerOrganisationId !== null || resource.ownerUserId !== context.subjectUserId) deny('RESOURCE_SCOPE_MISMATCH')
  } else {
    if (resource.ownerOrganisationId !== context.organisationId) deny('RESOURCE_SCOPE_MISMATCH')
    if (resource.dataClass === 'USER_IN_ORGANISATION_PRIVATE' && resource.ownerUserId !== context.subjectUserId) deny('RESOURCE_SCOPE_MISMATCH')
    if (resource.dataClass === 'ORGANISATION_PRIVATE' && resource.ownerUserId !== null) deny('RESOURCE_SCOPE_MISMATCH')
  }
}

function productAvailable(state, product, feature, config, ceiling, now) {
  if (!ceiling.products.includes(product)) deny('PRODUCT_UNAVAILABLE')
  const grant = state.products?.find(g => g.product === product && g.features?.includes(feature))
  if (!grant || grant.organisationId !== state.access.organisationId || grant.environment !== config.environment || grant.applicationId !== config.appId || grant.status !== 'ACTIVE' || !nonempty(grant.version) || !nonempty(grant.sourceRef) || !['CONTRACT', 'VERIFIED_BILLING', 'EXPLICIT_OFFER'].includes(grant.source) || !validUntil(grant.expiresAt, now)) deny('PRODUCT_UNAVAILABLE')
}

/** All authority callbacks are server-owned. No context/role/ALLOW from HTTP is accepted. */
export function createOperationExecutor(options) {
  const { authenticate, withTransaction, recordAudit, now = Date.now } = options
  const config = freeze(structuredClone(options.application))
  const ceiling = Object.hasOwn(profiles, config.profileId) ? profiles[config.profileId] : null
  if (!ceiling || !['development', 'staging', 'production'].includes(config.environment) || !['appId', 'deploymentId', 'configurationVersion', 'identityIssuer'].every(k => nonempty(config[k])) || !Array.isArray(config.operations) || config.operations.some(op => !Object.hasOwn(rules, op)) || !Array.isArray(config.features) || config.features.some(f => !ceiling.features.includes(f)) || (ceiling.fixed && !nonempty(config.organisationId)) || (!ceiling.fixed && config.organisationId !== null) || [authenticate, withTransaction, recordAudit].some(f => typeof f !== 'function')) throw new TypeError('Explicit supported application and server authority adapters required')

  return Object.freeze({
    contract: OPERATION_CONTRACT,
    async execute(input, action) {
      const decisionId = randomUUID()
      let audit = { decisionId, contractVersion: OPERATION_CONTRACT.version, implementationVersion: OPERATION_CONTRACT.implementation, applicationId: config.appId, deploymentId: config.deploymentId, configurationVersion: config.configurationVersion, environment: config.environment, operation: typeof input?.operation === 'string' && input.operation.length < 128 ? input.operation : null, actorId: null, actorKind: null, subjectUserId: null, organisationId: null }
      let intentRecorded = false
      try {
        // Snapshot inputs before the first await; never execute a later, mutated payload.
        if (!input || input.contractId !== OPERATION_CONTRACT.id || input.contractVersion !== OPERATION_CONTRACT.version) deny('UNSUPPORTED_CONTRACT')
        const selected = Object.hasOwn(rules, input.operation) ? rules[input.operation] : null
        if (!selected || !config.operations.includes(input.operation)) deny('PERMISSION_DENIED')
        if (!config.features.includes(selected.feature)) deny('APPLICATION_FEATURE_UNAVAILABLE')
        if (typeof action !== 'function' || !nonempty(input.resourceId) || !(input.organisationId === null || nonempty(input.organisationId))) deny('CONTEXT_INVALID')
        const payload = freeze(JSON.parse(canonical(input.payload)))
        const request = freeze({ operation: input.operation, resourceId: input.resourceId, organisationId: input.organisationId, payload, payloadDigest: operationPayloadDigest(payload) })
        audit = { ...audit, resourceId: request.resourceId, payloadDigest: request.payloadDigest }
        const actor = await authenticate(input.request)
        const time = now()
        if (!actor || !['HUMAN', 'SERVICE'].includes(actor.kind) || !nonempty(actor.actorId) || !nonempty(actor.proofRef) || actor.issuer !== config.identityIssuer || actor.audience !== config.appId || !validUntil(actor.expiresAt, time) || (actor.kind === 'HUMAN' && actor.userId !== actor.actorId) || (actor.kind === 'SERVICE' && (actor.serviceId !== actor.actorId || actor.userId != null))) deny('UNVERIFIED_IDENTITY')
        if (actor.environment !== config.environment) deny('ENVIRONMENT_MISMATCH')
        if (actor.onBehalfOf != null) deny('DELEGATION_INVALID')
        const identity = freeze({ kind: actor.kind, actorId: actor.actorId, ...(actor.kind === 'HUMAN' ? { userId: actor.userId } : { serviceId: actor.serviceId }), proofRef: actor.proofRef, issuer: actor.issuer, audience: actor.audience, environment: actor.environment, expiresAt: actor.expiresAt })
        audit = { ...audit, actorId: identity.actorId, actorKind: identity.kind, subjectUserId: identity.kind === 'HUMAN' ? identity.userId : null }
        return await withTransaction({ actor: identity, request }, async session => {
          const state = session.state
          if (!state || !nonempty(state.policyVersion) || state.environment !== config.environment || state.applicationId !== config.appId || typeof session.recordOutcome !== 'function' || typeof session.projectOutput !== 'function') deny('POLICY_UNAVAILABLE')
          const access = state.access
          if (!access || access.actorId !== identity.actorId || access.status !== 'ACTIVE' || !nonempty(access.version) || !nonempty(access.sourceRef) || !validUntil(access.expiresAt, now())) deny('ACCESS_BASIS_INVALID')
          if (access.type === 'DELEGATED_USER') deny('DELEGATION_INVALID') // Not implemented by this candidate; no implicit SERVICE impersonation.
          const organisationId = request.organisationId
          if (selected.mode === 'ACCOUNT') {
            if (identity.kind !== 'HUMAN' || access.type !== 'ACCOUNT_SELF' || organisationId !== null || access.organisationId !== null) deny('CONTEXT_INVALID')
          } else {
            if (!nonempty(organisationId) || organisationId !== access.organisationId || (ceiling.fixed && organisationId !== config.organisationId)) deny('CONTEXT_INVALID')
            if (access.type !== (identity.kind === 'HUMAN' ? 'MEMBERSHIP' : 'SERVICE_GRANT')) deny('ACCESS_BASIS_INVALID')
          }
          const context = { ...audit, organisationId, mode: selected.mode, policyVersion: state.policyVersion, accessVersion: access.version, accessSourceRef: access.sourceRef, feature: selected.feature, effect: selected.effect, resourceId: request.resourceId }
          audit = { ...context }
          if (!permission(access, request.operation, selected.feature, request.resourceId)) deny('PERMISSION_DENIED')
          checkResource(state.resource, context, selected)
          if (state.resource.id !== request.resourceId) deny('RESOURCE_SCOPE_MISMATCH')
          if (selected.product) productAvailable(state, selected.product, selected.feature, config, ceiling, now())
          if (selected.dataClass === 'USER_IN_ORGANISATION_PRIVATE') {
            if (identity.kind !== 'HUMAN') deny('DELEGATION_INVALID')
            const requirements = state.resource.contentRequirements
            if (!Array.isArray(requirements) || !requirements.length) deny('PRODUCT_UNAVAILABLE')
            for (const requirement of requirements) {
              if (!ceiling.features.includes(requirement.feature) || !config.features.includes(requirement.feature)) deny('APPLICATION_FEATURE_UNAVAILABLE')
              productAvailable(state, requirement.product, requirement.feature, config, ceiling, now())
            }
          }
          if (request.operation === 'supplier.report.project') {
            if (!config.operations.includes('supplier.report.read') || !permission(access, 'supplier.report.read', 'supplier_report', request.resourceId) || !Array.isArray(state.inputs) || state.inputs.length === 0) deny('PERMISSION_DENIED')
            for (const resource of state.inputs) checkResource(resource, context, { resourceType: 'supplier_report', dataClass: 'SHARED_KNOWLEDGE' })
          }
          // These nine operations explicitly have NOT_APPLICABLE usage policy. Paid
          // refresh/export/forecast requests cannot be enabled with a missing limit.
          if (state.usagePolicy !== 'NOT_APPLICABLE') deny('LIMIT_POLICY_UNAVAILABLE')
          if (session.transactionalEffects !== true || session.outputBoundaryVersion !== state.resource.projectionVersion) deny('POLICY_UNAVAILABLE')
          const bound = freeze({ ...context, actor: identity, resource: structuredClone(state.resource), payload, payloadDigest: request.payloadDigest, correlationId: randomUUID() })
          audit = { ...audit, correlationId: bound.correlationId, resourceVersion: bound.resource.version, projectionVersion: bound.resource.projectionVersion }
          try { await recordAudit({ ...audit, phase: 'INTENT', decision: 'ALLOW', reasonCode: 'AUTHORIZED' }) }
          catch { deny('AUDIT_UNAVAILABLE') }
          intentRecorded = true
          const value = await action(bound, session.transaction)
          const output = await session.projectOutput(value, bound)
          if (!validUntil(identity.expiresAt, now()) || !validUntil(access.expiresAt, now())) deny('ACCESS_BASIS_INVALID')
          if (selected.product) productAvailable(state, selected.product, selected.feature, config, ceiling, now())
          if (selected.dataClass === 'USER_IN_ORGANISATION_PRIVATE') for (const requirement of state.resource.contentRequirements) productAvailable(state, requirement.product, requirement.feature, config, ceiling, now())
          try { await session.recordOutcome({ ...audit, phase: 'OUTCOME', decision: 'ALLOW', reasonCode: 'SUCCEEDED' }) }
          catch { deny('AUDIT_UNAVAILABLE') }
          return Object.freeze({ decision: 'ALLOW', decisionId, contractVersion: OPERATION_CONTRACT.version, value: output })
        })
      } catch (error) {
        const rejected = error instanceof OperationDenied ? error : new OperationDenied('POLICY_UNAVAILABLE', decisionId)
        rejected.decisionId = decisionId
        try { await recordAudit({ ...audit, phase: intentRecorded ? 'FAILURE' : 'DECISION', decision: 'DENY', reasonCode: rejected.reasonCode }) }
        catch { throw new OperationDenied('AUDIT_UNAVAILABLE', decisionId) }
        throw rejected
      }
    },
  })
}

export function operationSourceDigest() {
  // Kept outside the decision path: consumers bind the implementation and types.
  return import('node:fs').then(fs => createHash('sha256').update(fs.readFileSync(new URL('./operation-context.mjs', import.meta.url))).update(fs.readFileSync(new URL('./operation-context.d.mts', import.meta.url))).digest('hex'))
}
