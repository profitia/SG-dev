import { createHash } from 'node:crypto'
import { createAccessStore, DATABASE_SERVICE_ISSUER } from './access-store.mjs'
import { createOperationExecutor, OperationDenied } from './operation-context.mjs'
import { createModuleScopeGuard } from './module-scope.mjs'
import { createRequestLedger, requestLedgerSourceDigest } from './request-ledger.mjs'

export const PRIVATE_OPERATION_HOST_CONTRACT = Object.freeze({ id: 'profitia.private-operation-host', version: '1.4.0' })
const unavailable = () => { throw new OperationDenied('POLICY_UNAVAILABLE') }
const copy = value => structuredClone(value)
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

/** Composes the existing policy engine and store. The host still owns the real
 * driver transaction, its total timeout, commit/rollback and physical binding.
 * No request identity, lease or transaction is retained on the shared instance.
 */
export function createPrivateOperationHost(options) {
  if (options.binding?.service !== undefined) throw new TypeError('Human host cannot use a database service binding')
  return createBoundOperationHost(options, false)
}

/** An internal server/CLI host authenticated by its actual ordinary SQL login.
 * No HTTP token, claimed service ID, membership or user impersonation adapter.
 * Only approved prepared-data reads; no provider acquisition, writes or jobs. */
export function createServiceReadHost(options) {
  const a = options.application, s = options.binding?.service
  if (!a || !s || a.identityIssuer !== DATABASE_SERVICE_ISSUER
    || s.profileId !== a.profileId || s.deploymentId !== a.deploymentId
    || s.configurationVersion !== a.configurationVersion
    || !Array.isArray(a.operations) || !a.operations.length
    || a.operations.some(op => !['knowledge.read','forecast.read','supplier.report.read'].includes(op))
    || ['module','prepareInputs','createAuthenticator','requestLedger'].some(key => Object.hasOwn(options,key))) throw new TypeError('Explicit bounded database service read host required')
  return createBoundOperationHost(options, true)
}

function createBoundOperationHost(options, serviceMode) {
  const { independentQuery, transact, createAuthenticator, readResources, projectOutput, prepareInputs, describeOutcome, now = Date.now, transactionTimeoutMs = 15000 } = options
  const application = freeze(copy(options.application))
  const binding = freeze(copy(options.binding))
  if (!application || !binding || binding.applicationId !== application.appId || binding.environment !== application.environment || [independentQuery, transact, ...(serviceMode ? [] : [createAuthenticator]), readResources, projectOutput, now].some(f => typeof f !== 'function') || !Number.isSafeInteger(transactionTimeoutMs) || transactionTimeoutMs < 100 || transactionTimeoutMs > 15000) throw new TypeError('Explicit application, private binding, identity factory and real transaction adapters required')
  const store = createAccessStore({ binding, now })
  const module = options.module === undefined ? undefined : freeze(copy(options.module))
  if (module !== undefined && (!module || Object.getPrototypeOf(module) !== Object.prototype || Object.keys(module).length !== 3 || !/^[a-f0-9]{64}$/.test(module.auditSchemaDigest ?? '') || Object.keys(module).some(key => !['id','schemaDigest','auditSchemaDigest'].includes(key)))) throw new TypeError('Explicit accepted module audit boundary required')
  const moduleGuard = module ? createModuleScopeGuard({ applicationId: binding.applicationId, environment: binding.environment, moduleId: module.id, schemaDigest: module.schemaDigest, now }) : null
  const needsRequestLedger = application.operations.includes('forecast.request')
  const requestBinding = options.requestLedger === undefined ? null : freeze(copy(options.requestLedger))
  if (needsRequestLedger ? serviceMode || module?.id !== 'benchmark' || !requestBinding
      || Object.keys(requestBinding).join(',') !== 'schemaDigest' || !/^[a-f0-9]{64}$/.test(requestBinding.schemaDigest ?? '')
    : requestBinding !== null) throw new TypeError('Compute request requires the explicit same-store ledger and benchmark module')
  const requestLedger = needsRequestLedger ? createRequestLedger({ binding, schemaDigest: requestBinding.schemaDigest, now }) : null
  const transactionOptions = Object.freeze({ timeoutMs: transactionTimeoutMs, maxWaitMs: Math.min(3000, transactionTimeoutMs) })
  // Validate the unchanged policy configuration now, without authenticating,
  // reading a database or constructing request-owned state.
  const validate = createOperationExecutor({ application, now, authenticate: async () => null, withTransaction: unavailable, recordAudit: unavailable })
  if ((prepareInputs !== undefined && typeof prepareInputs !== 'function') || (describeOutcome !== undefined && typeof describeOutcome !== 'function') || (application.operations.includes('supplier.report.export') && typeof prepareInputs !== 'function')) throw new TypeError('Export requires server-owned transactional preparation; optional outcome adapter must be a function')

  return Object.freeze({
    contract: validate.contract,
    hostContract: PRIVATE_OPERATION_HOST_CONTRACT,
    async execute(input, action) {
      // These variables belong to exactly ONE execution, including when the
      // shared host receives overlapping requests for different users/orgs.
      let identityBinding = null
      let bindingRead = false
      const executor = createOperationExecutor({ application, now,
        authenticate: async request => {
          if (serviceMode) return store.resolveServiceActor(independentQuery)
          const authenticate = createAuthenticator({ resolveBinding: async key => {
            if (bindingRead) unavailable()
            bindingRead = true
            identityBinding = await store.resolveBinding(independentQuery, key)
            return identityBinding
          } })
          if (typeof authenticate !== 'function') unavailable()
          const actor = await authenticate(request)
          if (actor && (!bindingRead || !identityBinding)) unavailable()
          return actor
        },
        recordAudit: event => store.appendAudit(independentQuery, event),
        withTransaction: async ({ actor, request }, run) => {
          if (!serviceMode && !identityBinding) unavailable()
          let entered = false, completed = false, closed = false, callbackResult
          try {
            const result = await transact(async ({ query, transaction }) => {
              if (entered || closed || typeof query !== 'function' || query === independentQuery || transaction == null) unavailable()
              entered = true
              // PostgreSQL 16 has no transaction_timeout. The driver MUST also
              // enforce transactionOptions.timeoutMs over the entire callback.
              await query(`SET LOCAL statement_timeout='${transactionTimeoutMs}ms'`)
              await query(`SET LOCAL lock_timeout='${transactionOptions.maxWaitMs}ms'`)
              await query(`SET LOCAL idle_in_transaction_session_timeout='${transactionTimeoutMs}ms'`)
              if (closed) unavailable()
              const lease = serviceMode
                ? await store.lockServiceRead(query, { actor, organisationId: request.organisationId, operation: request.operation, resourceId: request.resourceId })
                : await store.lockAccess(query, { actor, identityBinding, organisationId: request.organisationId })
              const scope = Object.freeze({ applicationId: binding.applicationId, environment: binding.environment, userId: lease.userId, organisationId: lease.organisationId,
                ...(serviceMode ? { serviceId: lease.serviceId, operation: lease.operation, resourceId: lease.resourceId } : {}) })
              let moduleEvidence
              if (moduleGuard) {
                const evidence = await moduleGuard.bind(query, scope)
                await store.verifyModuleAudit(query, module.auditSchemaDigest)
                moduleEvidence = freeze({ ...evidence, moduleSchemaDigest: module.schemaDigest, auditSchemaDigest: module.auditSchemaDigest })
              }
              const resources = freeze(copy(await readResources({ actor, request, scope, query, transaction })))
              if (closed || !resources || Object.getPrototypeOf(resources) !== Object.prototype || Object.keys(resources).some(key => !['resource', 'inputs'].includes(key))) unavailable()
              if (serviceMode && resources.inputs !== undefined) unavailable()
              await store.verifyScope(query, lease)
              const requestPolicy = request.operation === 'forecast.request'
                ? await requestLedger.loadPolicy(query, { actor, request }) : undefined
              let reserveStarted = false, completeStarted = false, ownedReservation
              callbackResult = await run({
                state: { ...lease.state, resource: resources.resource, ...(resources.inputs === undefined ? {} : { inputs: resources.inputs }),
                  ...(requestPolicy ? { usagePolicy: 'PRODUCT_POLICY', requestPolicy } : {}) },
                ...(requestPolicy ? {
                  reserveUsage: async context => {
                    if (closed || reserveStarted) unavailable()
                    reserveStarted = true
                    ownedReservation = await requestLedger.reserve(query, requestPolicy, context)
                    if (closed) unavailable()
                    return ownedReservation
                  },
                  completeRequest: async (context, value) => {
                    if (closed || completeStarted || !ownedReservation) unavailable()
                    completeStarted = true
                    await requestLedger.complete(query, requestPolicy, ownedReservation, context, value)
                    if (closed) unavailable()
                  },
                } : {}),
                ...(moduleEvidence ? { moduleEvidence } : {}),
                transaction, transactionalEffects: true, outputBoundaryVersion: resources.resource?.projectionVersion,
                projectOutput: (value, context) => projectOutput(value, context, transaction),
                recordOutcome: event => store.appendAudit(query, event, lease),
                ...(prepareInputs === undefined ? {} : { prepareInputs: async context => {
                  if (closed) unavailable()
                  await prepareInputs({ context, query, transaction })
                  if (closed) unavailable()
                } }),
                ...(describeOutcome === undefined ? {} : { describeOutcome: async (value, context) => {
                  if (closed) unavailable()
                  const outcome = await describeOutcome(value, context, transaction)
                  if (closed) unavailable()
                  return outcome
                } }),
              })
              if (closed) unavailable()
              await store.verifyScope(query, lease)
              completed = true
              return callbackResult
            }, transactionOptions)
            if (!entered || !completed || result !== callbackResult) unavailable()
            return result
          } finally { closed = true }
        },
      })
      return executor.execute(input, action)
    },
  })
}

/** Accept this fingerprint alongside the independent identity/store/policy digests. */
export async function privateOperationHostSourceDigest() {
  const fs = await import('node:fs')
  return createHash('sha256').update(fs.readFileSync(new URL('./private-operation-host.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('./private-operation-host.d.mts', import.meta.url)))
    .update(await requestLedgerSourceDigest()).digest('hex')
}
