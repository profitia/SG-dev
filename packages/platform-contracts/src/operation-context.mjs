import { createHash, randomUUID } from 'node:crypto'

export const OPERATION_CONTRACT = Object.freeze({ id: 'profitia.operation-context', version: '1.0.0', implementation: '1.0.0-candidate.5' })
const denialBrand = Symbol.for('profitia.operation-context.denial.v1')
const denialCodes = new Set(['UNSUPPORTED_CONTRACT', 'UNVERIFIED_IDENTITY', 'CONTEXT_INVALID', 'ENVIRONMENT_MISMATCH', 'APPLICATION_FEATURE_UNAVAILABLE', 'ACCESS_BASIS_INVALID', 'PERMISSION_DENIED', 'PRODUCT_UNAVAILABLE', 'RESOURCE_SCOPE_MISMATCH', 'DATA_CLASSIFICATION_UNKNOWN', 'DELEGATION_INVALID', 'LIMIT_POLICY_UNAVAILABLE', 'LIMIT_EXCEEDED', 'IDEMPOTENCY_CONFLICT', 'AUDIT_UNAVAILABLE', 'POLICY_UNAVAILABLE', 'EXPLICIT_DENY'])

// Explicit implementation, not an interpreter of the target specification JSON.
// Everything outside this bounded candidate is denied, including jobs and billing.
const rule = (feature, resourceType, dataClass, effect, product = null, mode = 'ORGANISATION') => Object.freeze({ feature, resourceType, dataClass, effect, product, mode })
const rules = Object.freeze({
  'account.settings.read': rule('account', 'account_settings', 'ACCOUNT_PRIVATE', 'READ', null, 'ACCOUNT'),
  'account.settings.write': rule('account', 'account_settings', 'ACCOUNT_PRIVATE', 'WRITE', null, 'ACCOUNT'),
  'knowledge.read': rule('market', 'market_knowledge', 'SHARED_KNOWLEDGE', 'READ', 'SPENDGURU'),
  'benchmark.selection.read': rule('benchmark', 'benchmark_selection', 'ORGANISATION_PRIVATE', 'READ', 'SPENDGURU'),
  'benchmark.selection.write': rule('benchmark', 'benchmark_selection', 'ORGANISATION_PRIVATE', 'WRITE', 'SPENDGURU'),
  'category.read': rule('category', 'category', 'ORGANISATION_PRIVATE', 'READ', 'SPENDGURU'),
  'category.write': rule('category', 'category', 'ORGANISATION_PRIVATE', 'WRITE', 'SPENDGURU'),
  'supplier.assignment.read': rule('supplier_workspace', 'supplier_assignment', 'ORGANISATION_PRIVATE', 'READ'),
  'supplier.assignment.write': rule('supplier_workspace', 'supplier_assignment', 'ORGANISATION_PRIVATE', 'WRITE'),
  'forecast.read': rule('forecast', 'market_forecast', 'SHARED_KNOWLEDGE', 'READ', 'SPENDGURU'),
  'personal.list.read': rule('personal_workspace', 'personal_list', 'USER_IN_ORGANISATION_PRIVATE', 'READ'),
  'personal.list.write': rule('personal_workspace', 'personal_list', 'USER_IN_ORGANISATION_PRIVATE', 'WRITE'),
  'supplier.report.read': rule('supplier_report', 'supplier_report', 'SHARED_KNOWLEDGE', 'READ', 'SUPPLIER_INTELLIGENCE'),
  'supplier.report.project': rule('supplier_report', 'supplier_projection', 'ORGANISATION_PRIVATE', 'WRITE', 'SUPPLIER_INTELLIGENCE'),
  // Bounded AM24: one organisation report and its explicit shared/private
  // inputs. Personal exports and external acquisition remain unsupported.
  'supplier.report.export': rule('supplier_report', 'supplier_export', 'ORGANISATION_PRIVATE', 'EXPORT', 'SUPPLIER_INTELLIGENCE'),
})
export const IMPLEMENTED_OPERATIONS = Object.freeze(Object.keys(rules))
const profiles = Object.freeze({
  PORR_SUITE: { features: ['account', 'market', 'benchmark', 'category', 'supplier_workspace', 'forecast', 'personal_workspace', 'supplier_report'], products: ['SPENDGURU', 'SUPPLIER_INTELLIGENCE'], fixed: true },
  SPENDGURU_SAAS: { features: ['account', 'market', 'benchmark', 'category', 'supplier_workspace', 'forecast', 'personal_workspace', 'supplier_report'], products: ['SPENDGURU', 'SUPPLIER_INTELLIGENCE'] },
  SUPPLIER_INTELLIGENCE_STANDALONE: { features: ['account', 'supplier_workspace', 'personal_workspace', 'supplier_report'], products: ['SUPPLIER_INTELLIGENCE'] },
})

export class OperationDenied extends Error {
  constructor(reasonCode, decisionId = randomUUID()) {
    super('Operation unavailable')
    this.name = 'OperationDenied'
    this.reasonCode = reasonCode
    this.decisionId = decisionId
    Object.defineProperty(this, denialBrand, { value: true })
  }
}
// ESM/CJS, bundlers and an installed file dependency can have distinct class
// identities. Error transport is branded, never authorized from a JSON flag.
export function isOperationDenied(error) {
  return error instanceof Error && error[denialBrand] === true && denialCodes.has(error.reasonCode) && /^[a-f0-9-]{36}$/.test(error.decisionId)
}
const deny = (reason) => { throw new OperationDenied(reason) }
const nonempty = (v) => typeof v === 'string' && v.length > 0 && v.length <= 256
const validUntil = (v, now) => typeof v === 'string' && Number.isFinite(Date.parse(v)) && Date.parse(v) > now
const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

/** Server-owned module provenance, never a permission or a token. Shared by the
 * executor and its single audit adapter; SQL independently enforces the shape. */
export function normalizeModuleEvidence(value, { now = Date.now, allowExpired = false } = {}) {
  const keys = ['moduleId','moduleBindingId','version','sourceRef','expiresAt','transactionId','moduleSchemaDigest','auditSchemaDigest']
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).length !== keys.length || keys.some(key => !nonempty(value[key])) || Object.keys(value).some(key => !keys.includes(key))
    || !['benchmark','category','supplier_report'].includes(value.moduleId)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.moduleBindingId)
    || !/^[1-9][0-9]*$/.test(value.version) || !/^[0-9]+$/.test(value.transactionId)
    || !['moduleSchemaDigest','auditSchemaDigest'].every(key => /^[a-f0-9]{64}$/.test(value[key]))
    || keys.some(key => /gh[pousr]_|sk_(?:live|test)_|postgres(?:ql)?:\/\/|Bearer\s/i.test(value[key]))
    || !Number.isFinite(Date.parse(value.expiresAt))) deny('POLICY_UNAVAILABLE')
  if (!allowExpired && !validUntil(value.expiresAt, now())) deny('ACCESS_BASIS_INVALID')
  return freeze(structuredClone(value))
}

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
  return { product, feature, version: grant.version, sourceRef: grant.sourceRef, source: grant.source, expiresAt: grant.expiresAt }
}

/** All authority callbacks are server-owned. No context/role/ALLOW from HTTP is accepted. */
export function createOperationExecutor(options) {
  const { authenticate, withTransaction, recordAudit, now = Date.now } = options
  const config = freeze(structuredClone(options.application))
  const ceiling = Object.hasOwn(profiles, config.profileId) ? profiles[config.profileId] : null
  if (!ceiling || !['development', 'staging', 'production'].includes(config.environment) || !['appId', 'deploymentId', 'configurationVersion', 'identityIssuer'].every(k => nonempty(config[k])) || !Array.isArray(config.operations) || config.operations.some(op => !Object.hasOwn(rules, op)) || !Array.isArray(config.features) || config.features.some(f => !ceiling.features.includes(f)) || (ceiling.fixed && !nonempty(config.organisationId)) || (!ceiling.fixed && config.organisationId !== null) || [authenticate, withTransaction, recordAudit, now].some(f => typeof f !== 'function')) throw new TypeError('Explicit supported application and server authority adapters required')
  const stamp = event => ({ ...event, occurredAt: new Date(now()).toISOString() })

  return Object.freeze({
    contract: OPERATION_CONTRACT,
    async execute(input, action) {
      const decisionId = randomUUID()
      const operationStartedAt = new Date(now()).toISOString()
      let audit = { decisionId, contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version, implementationVersion: OPERATION_CONTRACT.implementation, applicationId: config.appId, applicationProfile: config.profileId, deploymentId: config.deploymentId, configurationVersion: config.configurationVersion, environment: config.environment, operationStartedAt, occurredAt: operationStartedAt, operation: typeof input?.operation === 'string' && input.operation.length < 128 ? input.operation : null, actorId: null, actorKind: null, subjectUserId: null, organisationId: null }
      let intentRecorded = false
      const preparationAudits = []
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
        audit = { ...audit, actorId: identity.actorId, actorKind: identity.kind, subjectUserId: identity.kind === 'HUMAN' ? identity.userId : null, identityProofRef: identity.proofRef, identityIssuer: identity.issuer, identityAudience: identity.audience }
        return await withTransaction({ actor: identity, request }, async session => {
          const state = session.state
          if (!state || !nonempty(state.policyVersion) || state.environment !== config.environment || state.applicationId !== config.appId || typeof session.recordOutcome !== 'function' || typeof session.projectOutput !== 'function' || (session.describeOutcome !== undefined && typeof session.describeOutcome !== 'function')) deny('POLICY_UNAVAILABLE')
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
          const moduleEvidence = session.moduleEvidence === undefined ? undefined : normalizeModuleEvidence(session.moduleEvidence, { now })
          if (moduleEvidence && selected.mode !== 'ORGANISATION') deny('CONTEXT_INVALID')
          const context = { ...audit, organisationId, mode: selected.mode, policyVersion: state.policyVersion, accessBasisType: access.type, accessVersion: access.version, accessSourceRef: access.sourceRef, feature: selected.feature, effect: selected.effect, resourceId: request.resourceId, ...(moduleEvidence ? { moduleEvidence } : {}) }
          audit = { ...context }
          if (!permission(access, request.operation, selected.feature, request.resourceId)) deny('PERMISSION_DENIED')
          checkResource(state.resource, context, selected)
          if (state.resource.id !== request.resourceId) deny('RESOURCE_SCOPE_MISMATCH')
          const productEvidence = []
          if (selected.product) productEvidence.push(productAvailable(state, selected.product, selected.feature, config, ceiling, now()))
          if (selected.feature === 'supplier_workspace') {
            // An explicit offer must grant this feature in an eligible product;
            // neither a role name nor merely owning another feature is enough.
            const eligible = ['SPENDGURU','SUPPLIER_INTELLIGENCE'].find(product => ceiling.products.includes(product) && state.products?.some(grant => grant.product === product && grant.features?.includes(selected.feature) && grant.organisationId === organisationId && grant.applicationId === config.appId && grant.environment === config.environment && grant.status === 'ACTIVE' && ['CONTRACT','VERIFIED_BILLING','EXPLICIT_OFFER'].includes(grant.source) && validUntil(grant.expiresAt, now()) && nonempty(grant.version) && nonempty(grant.sourceRef)))
            if (!eligible) deny('PRODUCT_UNAVAILABLE')
            productEvidence.push(productAvailable(state, eligible, selected.feature, config, ceiling, now()))
          }
          if (selected.dataClass === 'USER_IN_ORGANISATION_PRIVATE') {
            if (identity.kind !== 'HUMAN') deny('DELEGATION_INVALID')
            const requirements = state.resource.contentRequirements
            if (!Array.isArray(requirements) || !requirements.length) deny('PRODUCT_UNAVAILABLE')
            for (const requirement of requirements) {
              if (!ceiling.features.includes(requirement.feature) || !config.features.includes(requirement.feature)) deny('APPLICATION_FEATURE_UNAVAILABLE')
              productEvidence.push(productAvailable(state, requirement.product, requirement.feature, config, ceiling, now()))
            }
          }
          if (request.operation === 'supplier.report.project') {
            if (!config.operations.includes('supplier.report.read') || !permission(access, 'supplier.report.read', 'supplier_report', request.resourceId) || !Array.isArray(state.inputs) || state.inputs.length === 0) deny('PERMISSION_DENIED')
            for (const resource of state.inputs) checkResource(resource, context, { resourceType: 'supplier_report', dataClass: 'SHARED_KNOWLEDGE' })
          }
          let preparationResource
          if (request.operation === 'supplier.report.export') {
            // Export never grants preparation or source access. The current
            // projection capability is required for the private source and for
            // its separately audited SQL restoration. This bounded candidate
            // does not infer personal, account or arbitrary input permissions.
            for (const operation of ['supplier.report.read', 'supplier.report.project']) {
              if (!config.operations.includes(operation) || !permission(access, operation, 'supplier_report', request.resourceId)) deny('PERMISSION_DENIED')
            }
            if (!Array.isArray(state.inputs) || state.inputs.length !== 2) deny('RESOURCE_SCOPE_MISMATCH')
            const shared = state.inputs.filter(resource => resource?.type === 'supplier_report')
            const privateInputs = state.inputs.filter(resource => resource?.type === 'supplier_projection')
            if (shared.length !== 1 || privateInputs.length !== 1 || state.inputs.some(resource => resource?.id !== request.resourceId)) deny('RESOURCE_SCOPE_MISMATCH')
            checkResource(shared[0], context, rules['supplier.report.read'])
            checkResource(privateInputs[0], context, rules['supplier.report.project'])
            if (typeof session.prepareInputs !== 'function') deny('POLICY_UNAVAILABLE')
            preparationResource = privateInputs[0]
          }
          // These fifteen operations explicitly have NOT_APPLICABLE usage policy.
          // Export preparation is scoped private SQL, not paid refresh, global
          // ingestion or a forecast request with an omitted limit.
          if (state.usagePolicy !== 'NOT_APPLICABLE') deny('LIMIT_POLICY_UNAVAILABLE')
          if (session.transactionalEffects !== true || session.outputBoundaryVersion !== state.resource.projectionVersion) deny('POLICY_UNAVAILABLE')
          const bound = freeze({ ...context, actor: identity, resource: structuredClone(state.resource), productEvidence, usagePolicy: state.usagePolicy, payload, payloadDigest: request.payloadDigest, correlationId: randomUUID() })
          audit = { ...audit, correlationId: bound.correlationId, resourceType: bound.resource.type, dataClass: bound.resource.dataClass, ownerOrganisationId: bound.resource.ownerOrganisationId, ownerUserId: bound.resource.ownerUserId, resourceVersion: bound.resource.version, projectionVersion: bound.resource.projectionVersion, productEvidence, usagePolicy: state.usagePolicy }
          try { await recordAudit(stamp({ ...audit, phase: 'INTENT', decision: 'ALLOW', reasonCode: 'AUTHORIZED' })) }
          catch (error) {
            if (isOperationDenied(error) && error.reasonCode === 'ACCESS_BASIS_INVALID') throw error
            deny('AUDIT_UNAVAILABLE')
          }
          intentRecorded = true
          if (preparationResource) {
            const preparationContext = freeze({ ...bound, decisionId: randomUUID(), operation: 'supplier.report.project', effect: 'WRITE', resource: structuredClone(preparationResource) })
            const preparationAudit = { ...audit, decisionId: preparationContext.decisionId, operation: preparationContext.operation,
              effect: 'WRITE', resourceType: preparationResource.type, dataClass: preparationResource.dataClass,
              ownerOrganisationId: preparationResource.ownerOrganisationId, ownerUserId: preparationResource.ownerUserId,
              resourceVersion: preparationResource.version, projectionVersion: preparationResource.projectionVersion }
            try { await recordAudit(stamp({ ...preparationAudit, phase: 'INTENT', decision: 'ALLOW', reasonCode: 'AUTHORIZED' })) }
            catch (error) {
              if (isOperationDenied(error) && error.reasonCode === 'ACCESS_BASIS_INVALID') throw error
              deny('AUDIT_UNAVAILABLE')
            }
            preparationAudits.push(preparationAudit)
            await session.prepareInputs(preparationContext)
            if (!validUntil(identity.expiresAt, now()) || !validUntil(access.expiresAt, now())) deny('ACCESS_BASIS_INVALID')
            productAvailable(state, selected.product, selected.feature, config, ceiling, now())
            if (moduleEvidence) normalizeModuleEvidence(moduleEvidence, { now })
            try { await session.recordOutcome(stamp({ ...preparationAudit, phase: 'OUTCOME', decision: 'ALLOW', reasonCode: 'SUCCEEDED' })) }
            catch (error) {
              if (isOperationDenied(error) && ['ACCESS_BASIS_INVALID','PRODUCT_UNAVAILABLE','APPLICATION_FEATURE_UNAVAILABLE'].includes(error.reasonCode)) throw error
              deny('AUDIT_UNAVAILABLE')
            }
          }
          const value = await action(bound, session.transaction)
          const output = await session.projectOutput(value, bound)
          const outcome = session.describeOutcome === undefined ? 'SUCCEEDED' : await session.describeOutcome(output, bound)
          if (!['SUCCEEDED', 'NO_DATA', 'SELECTION_UNAVAILABLE'].includes(outcome)) deny('POLICY_UNAVAILABLE')
          if (!validUntil(identity.expiresAt, now()) || !validUntil(access.expiresAt, now())) deny('ACCESS_BASIS_INVALID')
          if (selected.product) productAvailable(state, selected.product, selected.feature, config, ceiling, now())
          if (selected.feature === 'supplier_workspace') productAvailable(state, productEvidence[0].product, selected.feature, config, ceiling, now())
          if (selected.dataClass === 'USER_IN_ORGANISATION_PRIVATE') for (const requirement of state.resource.contentRequirements) productAvailable(state, requirement.product, requirement.feature, config, ceiling, now())
          if (moduleEvidence) normalizeModuleEvidence(moduleEvidence, { now })
          try { await session.recordOutcome(stamp({ ...audit, phase: 'OUTCOME', decision: 'ALLOW', reasonCode: outcome })) }
          catch (error) {
            // A current scope denial is different from an unavailable writer.
            // Both roll back the effect; only the latter is a technical failure.
            if (isOperationDenied(error) && ['ACCESS_BASIS_INVALID','PRODUCT_UNAVAILABLE','APPLICATION_FEATURE_UNAVAILABLE'].includes(error.reasonCode)) throw error
            deny('AUDIT_UNAVAILABLE')
          }
          return Object.freeze({ decision: 'ALLOW', decisionId, contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version, value: output })
        })
      } catch (error) {
        const rejected = isOperationDenied(error) ? error : new OperationDenied('POLICY_UNAVAILABLE', decisionId)
        rejected.decisionId = decisionId
        let preparationAuditFailed = false
        for (const preparation of preparationAudits) {
          try { await recordAudit(stamp({ ...preparation, phase: 'FAILURE', decision: 'DENY', reasonCode: rejected.reasonCode })) }
          catch { preparationAuditFailed = true }
        }
        try { await recordAudit(stamp({ ...audit, phase: intentRecorded ? 'FAILURE' : 'DECISION', decision: 'DENY', reasonCode: rejected.reasonCode })) }
        catch { throw new OperationDenied('AUDIT_UNAVAILABLE', decisionId) }
        if (preparationAuditFailed) throw new OperationDenied('AUDIT_UNAVAILABLE', decisionId)
        throw rejected
      }
    },
  })
}

export function operationSourceDigest() {
  // Kept outside the decision path: consumers bind the implementation and types.
  return import('node:fs').then(fs => createHash('sha256').update(fs.readFileSync(new URL('./operation-context.mjs', import.meta.url))).update(fs.readFileSync(new URL('./operation-context.d.mts', import.meta.url))).digest('hex'))
}
