import { createHash } from 'node:crypto'
import { createAccessStore } from './access-store.mjs'
import { createOperationExecutor, OperationDenied } from './operation-context.mjs'
import { createModuleScopeGuard } from './module-scope.mjs'

export const PRIVATE_OPERATION_HOST_CONTRACT = Object.freeze({ id: 'profitia.private-operation-host', version: '1.1.0' })
const unavailable = () => { throw new OperationDenied('POLICY_UNAVAILABLE') }
const copy = value => structuredClone(value)
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

/** Composes the existing policy engine and store. The host still owns the real
 * driver transaction, its total timeout, commit/rollback and physical binding.
 * No request identity, lease or transaction is retained on the shared instance.
 */
export function createPrivateOperationHost(options) {
  const { independentQuery, transact, createAuthenticator, readResources, projectOutput, now = Date.now, transactionTimeoutMs = 15000 } = options
  const application = freeze(copy(options.application))
  const binding = freeze(copy(options.binding))
  if (!application || !binding || binding.applicationId !== application.appId || binding.environment !== application.environment || [independentQuery, transact, createAuthenticator, readResources, projectOutput, now].some(f => typeof f !== 'function') || !Number.isSafeInteger(transactionTimeoutMs) || transactionTimeoutMs < 100 || transactionTimeoutMs > 15000) throw new TypeError('Explicit application, private binding, identity factory and real transaction adapters required')
  const store = createAccessStore({ binding, now })
  const module = options.module === undefined ? undefined : freeze(copy(options.module))
  if (module !== undefined && (!module || Object.getPrototypeOf(module) !== Object.prototype || Object.keys(module).length !== 3 || !/^[a-f0-9]{64}$/.test(module.auditSchemaDigest ?? '') || Object.keys(module).some(key => !['id','schemaDigest','auditSchemaDigest'].includes(key)))) throw new TypeError('Explicit accepted module audit boundary required')
  const moduleGuard = module ? createModuleScopeGuard({ applicationId: binding.applicationId, environment: binding.environment, moduleId: module.id, schemaDigest: module.schemaDigest, now }) : null
  const transactionOptions = Object.freeze({ timeoutMs: transactionTimeoutMs, maxWaitMs: Math.min(3000, transactionTimeoutMs) })
  // Validate the unchanged policy configuration now, without authenticating,
  // reading a database or constructing request-owned state.
  const validate = createOperationExecutor({ application, now, authenticate: async () => null, withTransaction: unavailable, recordAudit: unavailable })

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
          if (!identityBinding) unavailable()
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
              const lease = await store.lockAccess(query, { actor, identityBinding, organisationId: request.organisationId })
              const scope = Object.freeze({ applicationId: binding.applicationId, environment: binding.environment, userId: lease.userId, organisationId: lease.organisationId })
              let moduleEvidence
              if (moduleGuard) {
                const evidence = await moduleGuard.bind(query, scope)
                await store.verifyModuleAudit(query, module.auditSchemaDigest)
                moduleEvidence = freeze({ ...evidence, moduleSchemaDigest: module.schemaDigest, auditSchemaDigest: module.auditSchemaDigest })
              }
              const resources = freeze(copy(await readResources({ actor, request, scope, query, transaction })))
              if (closed || !resources || Object.getPrototypeOf(resources) !== Object.prototype || Object.keys(resources).some(key => !['resource', 'inputs'].includes(key))) unavailable()
              await store.verifyScope(query, lease)
              callbackResult = await run({
                state: { ...lease.state, resource: resources.resource, ...(resources.inputs === undefined ? {} : { inputs: resources.inputs }) },
                ...(moduleEvidence ? { moduleEvidence } : {}),
                transaction, transactionalEffects: true, outputBoundaryVersion: resources.resource?.projectionVersion,
                projectOutput: (value, context) => projectOutput(value, context, transaction),
                recordOutcome: event => store.appendAudit(query, event, lease),
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
export function privateOperationHostSourceDigest() {
  return import('node:fs').then(fs => createHash('sha256')
    .update(fs.readFileSync(new URL('./private-operation-host.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('./private-operation-host.d.mts', import.meta.url))).digest('hex'))
}
