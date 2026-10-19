import { createHash } from 'node:crypto'
import { createAccessStore, DATABASE_SERVICE_ISSUER } from './access-store.mjs'
import { createOperationExecutor, OperationDenied } from './operation-context.mjs'
import { createModuleScopeGuard } from './module-scope.mjs'
import { createRequestLedger, requestLedgerSourceDigest } from './request-ledger.mjs'
import { createRequestContinuationLedger, requestContinuationSourceDigest } from './request-continuation.mjs'
import { createDelegatedJobStore, delegatedJobSourceDigest } from './delegated-job.mjs'

export const PRIVATE_OPERATION_HOST_CONTRACT = Object.freeze({ id: 'profitia.private-operation-host', version: '1.8.0' })
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
    || ['module','prepareInputs','createAuthenticator','requestLedger','requestContinuation'].some(key => Object.hasOwn(options,key))) throw new TypeError('Explicit bounded database service read host required')
  return createBoundOperationHost(options, true)
}

/** Current delegated PRIVATE dispatch admission only. This never starts the
 * science worker, publishes source data, or accepts an effect callback. A READY
 * result requires separately authorised source delivery and reconciliation.
 * Optional deliver() holds a NEW current private fence across the independent
 * source transaction. Source commit cannot be undone by this private rollback;
 * its durable READY admission then remains available for a funded retry. */
export function createDelegatedJobHost(options){
  const a=options.application,s=options.binding?.service,j=options.job
  const keys=j&&Object.keys(j).sort().join(',')
  const closedJob=j&&Object.getPrototypeOf(j)===Object.prototype
    &&Reflect.ownKeys(j).length===Object.keys(j).length
    &&Object.values(Object.getOwnPropertyDescriptors(j)).every(d=>'value'in d&&d.enumerable)
    &&(keys==='schemaDigest'||keys==='schemaDigest,targetOperation'&&j.targetOperation==='forecast.request'
      ||keys==='schemaDigest,supplierSchemaDigest,targetOperation'&&j.targetOperation==='supplier.report.refresh'&&/^[a-f0-9]{64}$/.test(j.supplierSchemaDigest??''))
  if(!a||!s||a.profileId!=='PLATFORM_INTERNAL'||a.identityIssuer!==DATABASE_SERVICE_ISSUER
    ||s.profileId!==a.profileId||s.deploymentId!==a.deploymentId||s.configurationVersion!==a.configurationVersion
    ||a.operations?.join(',')!=='job.execute'||a.features?.join(',')!=='job_execution'
    ||typeof options.readExternalAccount!=='function'||!closedJob
    ||!/^[a-f0-9]{64}$/.test(options.job.schemaDigest??'')
    ||options.sourceDelivery!==undefined&&typeof options.sourceDelivery?.deliver!=='function'
    ||['module','prepareInputs','createAuthenticator','requestLedger','requestContinuation','readResources','projectOutput','describeOutcome','jobDelivery','deliverSource'].some(k=>Object.hasOwn(options,k)))throw TypeError('Explicit delegated private dispatch host required')
  const base={...options,application:freeze(copy(a)),binding:freeze(copy(options.binding)),job:freeze(copy(options.job)),projectOutput:value=>value}
  const host=createBoundOperationHost(base,'delegated')
  return Object.freeze({contract:host.contract,hostContract:host.hostContract,
    admit:input=>host.execute(input,context=>context.dispatchAdmission),
    ...(base.sourceDelivery===undefined?{}:{deliver:(input,admission)=>{
      const deliveryHost=createBoundOperationHost({...base,jobDelivery:{admission:freeze(copy(admission))}},'delegated')
      return deliveryHost.execute(input,context=>context.dispatchAdmission)
    }})})
}

function createBoundOperationHost(options, serviceMode) {
  const delegated=serviceMode==='delegated'
  const { independentQuery, transact, createAuthenticator, readResources, projectOutput, prepareInputs, describeOutcome,readExternalAccount,sourceDelivery, now = Date.now, transactionTimeoutMs = 15000 } = options
  const application = freeze(copy(options.application))
  const binding = freeze(copy(options.binding))
  if (!application || !binding || binding.applicationId !== application.appId || binding.environment !== application.environment || [independentQuery, transact, ...(serviceMode ? [] : [createAuthenticator]), ...(delegated?[]:[readResources]), projectOutput, now].some(f => typeof f !== 'function') || !Number.isSafeInteger(transactionTimeoutMs) || transactionTimeoutMs < 100 || transactionTimeoutMs > 15000) throw new TypeError('Explicit application, private binding, identity factory and real transaction adapters required')
  const store = createAccessStore({ binding, now })
  const jobStore=delegated?createDelegatedJobStore({binding,schemaDigest:options.job.schemaDigest,targetOperation:options.job.targetOperation,supplierSchemaDigest:options.job.supplierSchemaDigest,now}):null
  const scopeStore=jobStore??store
  const module = options.module === undefined ? undefined : freeze(copy(options.module))
  if (module !== undefined && (!module || Object.getPrototypeOf(module) !== Object.prototype || Object.keys(module).length !== 3 || !/^[a-f0-9]{64}$/.test(module.auditSchemaDigest ?? '') || Object.keys(module).some(key => !['id','schemaDigest','auditSchemaDigest'].includes(key)))) throw new TypeError('Explicit accepted module audit boundary required')
  const moduleGuard = module ? createModuleScopeGuard({ applicationId: binding.applicationId, environment: binding.environment, moduleId: module.id, schemaDigest: module.schemaDigest, now }) : null
  const requestOperation = application.operations.includes('supplier.report.refresh') ? 'supplier.report.refresh' : 'forecast.request'
  if (application.operations.includes('forecast.request') && application.operations.includes('supplier.report.refresh')) throw new TypeError('Separate accepted module request hosts required')
  const needsRequestLedger = application.operations.includes(requestOperation)
  const requestBinding = options.requestLedger === undefined ? null : freeze(copy(options.requestLedger))
  const requestKeys = requestOperation === 'supplier.report.refresh' ? ['schemaDigest','externalSchemaDigest'] : ['schemaDigest']
  if (needsRequestLedger ? serviceMode || module?.id !== (requestOperation === 'supplier.report.refresh' ? 'supplier_report' : 'benchmark') || !requestBinding
      || Object.keys(requestBinding).sort().join(',') !== requestKeys.sort().join(',') || requestKeys.some(key=>!/^[a-f0-9]{64}$/.test(requestBinding[key] ?? ''))
    : requestBinding !== null) throw new TypeError('Private request requires its explicit same-store ledger and accepted module')
  const baseRequestLedger = needsRequestLedger ? createRequestLedger({ binding, schemaDigest: requestBinding.schemaDigest, operation: requestOperation, ...(requestOperation === 'supplier.report.refresh' ? {externalSchemaDigest:requestBinding.externalSchemaDigest} : {}), now }) : null
  if(options.requestContinuation===null)throw new TypeError('Explicit continuation cannot be null')
  const continuation=options.requestContinuation===undefined?null:freeze(copy(options.requestContinuation))
  if (continuation !== null && (!baseRequestLedger || serviceMode || delegated
    || requestOperation !== 'supplier.report.refresh' || application.operations.length !== 1)) throw new TypeError('Explicit HUMAN supplier-only private continuation required')
  const requestLedger = continuation === null ? baseRequestLedger
    : createRequestContinuationLedger({ ledger: baseRequestLedger, binding, continuation, now })
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
        recordAudit: event => scopeStore.appendAudit(independentQuery, event),
        withTransaction: async ({ actor, request }, run) => {
          if (!serviceMode && !identityBinding) unavailable()
          let entered = false, completed = false, closed = false, callbackResult,sourceAttempted=false
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
              const lease = delegated ? await jobStore.lockJob(query,{actor,request}) : serviceMode
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
              const resources = delegated ? {resource:lease.state.resource} : freeze(copy(await readResources({ actor, request, scope, query, transaction })))
              if (closed || !resources || Object.getPrototypeOf(resources) !== Object.prototype || Object.keys(resources).some(key => !['resource', 'inputs'].includes(key))) unavailable()
              if (serviceMode && resources.inputs !== undefined) unavailable()
              await scopeStore.verifyScope(query, lease)
              const observation=delegated?await readExternalAccount(lease.state.delegation.identityKey):null
              if(closed)unavailable()
              const requestPolicy = needsRequestLedger && request.operation === requestOperation
                ? await requestLedger.loadPolicy(query, { actor, request }) : undefined
              let reserveStarted = false, completeStarted = false, ownedReservation
              callbackResult = await run({
                state: { ...lease.state, resource: resources.resource, ...(resources.inputs === undefined ? {} : { inputs: resources.inputs }),
                  ...(delegated?{delegation:{...lease.state.delegation,externalAccountObservation:observation}}:{}),
                  ...(requestPolicy ? { usagePolicy: 'PRODUCT_POLICY', requestPolicy, ...(continuation === null ? {} : {requestContinuation:requestLedger.evidence(requestPolicy)}) } : {}) },
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
                ...(delegated?{admitDispatch:async context=>{
                  if(closed)unavailable()
                  if(!options.jobDelivery)return jobStore.claimDispatch(query,lease)
                  const admission=options.jobDelivery.admission
                  const current=await jobStore.prepareDelivery(query,lease,admission,sourceDelivery)
                  if(closed)unavailable()
                  if(current.status==='CONFIRMED')return current
                  sourceAttempted=true
                  const receipt=await sourceDelivery.deliver(freeze({sourceId:context.delegation.sourceId,
                    deliveryKey:context.delegation.deliveryKey,payload:context.payload}))
                  if(closed)throw new OperationDenied('DELIVERY_UNCERTAIN')
                  return jobStore.observeCommitted(query,lease,admission,receipt)
                }}:{}),
                transaction, transactionalEffects: true, outputBoundaryVersion: resources.resource?.projectionVersion,
                projectOutput: (value, context) => projectOutput(value, context, transaction),
                recordOutcome: event => scopeStore.appendAudit(query, event, lease),
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
              await scopeStore.verifyScope(query, lease)
              completed = true
              return callbackResult
            }, transactionOptions)
            if (!entered || !completed || result !== callbackResult) unavailable()
            return result
          } catch(error){
            if(sourceAttempted)throw new OperationDenied('DELIVERY_UNCERTAIN')
            throw error
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
    .update(await requestLedgerSourceDigest()).update(await requestContinuationSourceDigest()).update(await delegatedJobSourceDigest()).digest('hex')
}
