import {requestOperationPolicy,REQUEST_OPERATIONS} from './request-operations.mjs'
import { createHash } from 'node:crypto'
import { createAccessStore, DATABASE_SERVICE_ISSUER } from './access-store.mjs'
import { createOperationExecutor, OperationDenied, OPERATION_CONTRACT } from './operation-context.mjs'
import { createModuleScopeGuard } from './module-scope.mjs'
import { createRequestLedger, requestLedgerSourceDigest } from './request-ledger.mjs'
import { createRequestContinuationLedger, requestContinuationSourceDigest } from './request-continuation.mjs'
import { createDelegatedJobStore, delegatedJobSourceDigest } from './delegated-job.mjs'
import {createRequestInspection,requestInspectionSourceDigest} from './request-inspection.mjs'
import {createRequestWorkScope,requestWorkSourceDigest} from './request-work.mjs'

export const PRIVATE_OPERATION_HOST_CONTRACT = Object.freeze({ id: 'profitia.private-operation-host', version: '1.11.0' })
const unavailable = () => { throw new OperationDenied('POLICY_UNAVAILABLE') }
const copy = value => structuredClone(value)
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

/** Composes the existing policy engine and store. The host still owns the real
 * driver transaction, its total timeout, commit/rollback and physical binding.
 * No request identity, lease or transaction is retained on the shared instance.
 */
export function createPrivateOperationHost(options) {
  if (options.privateContinuation!==undefined||options.delegatedContinuation!==undefined||options.privateInspection!==undefined||options.delegatedInspection!==undefined||options.privateWork!==undefined||options.delegatedWork!==undefined)throw new TypeError('Delegated phases require the explicit service host')
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
    || ['module','prepareInputs','createAuthenticator','requestLedger','requestContinuation','privateContinuation','delegatedContinuation','privateInspection','delegatedInspection','privateWork','delegatedWork'].some(key => Object.hasOwn(options,key))) throw new TypeError('Explicit bounded database service read host required')
  return createBoundOperationHost(options, true)
}

/** Current delegated PRIVATE dispatch admission only. This never starts the
 * science worker, publishes source data, or accepts an effect callback. A READY
 * result requires separately authorised source delivery and reconciliation.
 * Optional deliver() holds a NEW current private fence across the independent
 * source transaction. Source commit cannot be undone by this private rollback;
 * its durable READY admission then remains available for a funded retry. */
function delegatedConfiguration(options){
  const a=options.application,s=options.binding?.service,j=options.job
  const keys=j&&Object.keys(j).sort().join(',')
  const closedJob=j&&Object.getPrototypeOf(j)===Object.prototype
    &&Reflect.ownKeys(j).length===Object.keys(j).length
    &&Object.values(Object.getOwnPropertyDescriptors(j)).every(d=>'value'in d&&d.enumerable)
    &&(keys==='schemaDigest'||keys==='schemaDigest,targetOperation'&&j.targetOperation==='forecast.request'
      ||keys==='schemaDigest,supplierSchemaDigest,targetOperation'&&j.targetOperation==='supplier.report.refresh'&&/^[a-f0-9]{64}$/.test(j.supplierSchemaDigest??'')
      ||keys==='locationSchemaDigest,operationSchemaDigest,schemaDigest,supplierSchemaDigest,targetOperation'&&requestOperationPolicy(j.targetOperation)?.location&&requestOperationPolicy(j.targetOperation)?.delegated!==false&&/^[a-f0-9]{64}$/.test(j.locationSchemaDigest??'')&&/^[a-f0-9]{64}$/.test(j.operationSchemaDigest??'')&&/^[a-f0-9]{64}$/.test(j.supplierSchemaDigest??'')
      ||keys==='operationSchemaDigest,schemaDigest,supplierSchemaDigest,targetOperation'&&requestOperationPolicy(j.targetOperation)?.additional&&!requestOperationPolicy(j.targetOperation)?.location&&/^[a-f0-9]{64}$/.test(j.supplierSchemaDigest??'')&&/^[a-f0-9]{64}$/.test(j.operationSchemaDigest??''))
  if(!a||!s||a.profileId!=='PLATFORM_INTERNAL'||a.identityIssuer!==DATABASE_SERVICE_ISSUER
    ||s.profileId!==a.profileId||s.deploymentId!==a.deploymentId||s.configurationVersion!==a.configurationVersion
    ||a.operations?.join(',')!=='job.execute'||a.features?.join(',')!=='job_execution'
    ||typeof options.readExternalAccount!=='function'||!closedJob
    ||!/^[a-f0-9]{64}$/.test(options.job.schemaDigest??'')
    ||options.sourceDelivery!==undefined&&typeof options.sourceDelivery?.deliver!=='function'
    ||['module','prepareInputs','createAuthenticator','requestLedger','requestContinuation','readResources','projectOutput','describeOutcome','jobDelivery','deliverSource','delegatedContinuation','delegatedInspection','delegatedWork'].some(k=>Object.hasOwn(options,k)))throw TypeError('Explicit delegated private dispatch host required')
  return {...options,application:freeze(copy(a)),binding:freeze(copy(options.binding)),job:freeze(copy(options.job)),projectOutput:value=>value}
}

export function createDelegatedJobHost(options){
  if(options.privateInspection!==undefined||options.privateWork!==undefined)throw TypeError('Inspection/work requires its explicit host')
  const base=delegatedConfiguration(options),j=base.job
  const privateContinuation=options.privateContinuation
  if(privateContinuation!==undefined&&(!privateContinuation||Object.getPrototypeOf(privateContinuation)!==Object.prototype
    ||Reflect.ownKeys(privateContinuation).sort().join(',')!=='delegatedSchemaDigest,schemaDigest'
    ||Object.values(Object.getOwnPropertyDescriptors(privateContinuation)).some(d=>!('value'in d)||!d.enumerable)
    ||!Object.values(privateContinuation).every(v=>/^[a-f0-9]{64}$/.test(v??''))
    ||j.targetOperation!=='supplier.report.refresh'||options.sourceDelivery!==undefined))throw TypeError('Explicit isolated Supplier private phase host required')
  const phaseBinding=privateContinuation===undefined?undefined:freeze(copy(privateContinuation))
  const host=createBoundOperationHost(base,'delegated')
  return Object.freeze({contract:host.contract,hostContract:host.hostContract,
    admit:input=>host.execute(input,context=>context.dispatchAdmission),
    ...(privateContinuation===undefined?{}:{runPrivatePhase:(input,phase,action)=>{
      if(!phase||Object.getPrototypeOf(phase)!==Object.prototype||Reflect.ownKeys(phase).sort().join(',')!=='inputDigest,phaseId'
        ||Object.values(Object.getOwnPropertyDescriptors(phase)).some(d=>!('value'in d)||!d.enumerable)
        ||typeof action!=='function')throw TypeError('Explicit private phase action required')
      const phaseHost=createBoundOperationHost({...base,delegatedContinuation:{requestId:input?.resourceId,...copy(phase),...copy(phaseBinding)}},'delegated')
      return phaseHost.execute(input,action)
    }}),
    ...(base.sourceDelivery===undefined?{}:{deliver:(input,admission)=>{
      const deliveryHost=createBoundOperationHost({...base,jobDelivery:{admission:freeze(copy(admission))}},'delegated')
      return deliveryHost.execute(input,context=>context.dispatchAdmission)
    }})})
}

/** Inspection never reserves/replays a write or claims a dispatch. Only the
 * installed accepted-phase anchor and current original authority may be read. */
export function createDelegatedPrivateInspectionHost(options){
 const base=delegatedConfiguration(options),c=options.privateInspection
 if(!c||Object.getPrototypeOf(c)!==Object.prototype||Reflect.ownKeys(c).sort().join(',')!=='continuationSchemaDigest,delegatedSchemaDigest,schemaDigest'
  ||Object.values(Object.getOwnPropertyDescriptors(c)).some(d=>!('value'in d)||!d.enumerable)
  ||!Object.values(c).every(v=>/^[a-f0-9]{64}$/.test(v??''))||base.job.targetOperation!=='supplier.report.refresh'
  ||options.privateContinuation!==undefined||options.privateWork!==undefined||options.sourceDelivery!==undefined)throw TypeError('Explicit read-only Supplier inspection source required')
 const captured=freeze(copy(c))
 return Object.freeze({contract:OPERATION_CONTRACT,hostContract:PRIVATE_OPERATION_HOST_CONTRACT,
  inspectPrivatePhase(input,phase,action){
   if(!phase||Object.getPrototypeOf(phase)!==Object.prototype||Reflect.ownKeys(phase).join(',')!=='phaseId'
    ||Object.values(Object.getOwnPropertyDescriptors(phase)).some(d=>!('value'in d)||!d.enumerable)
    ||typeof action!=='function')throw TypeError('Explicit private phase inspection action required')
   const host=createBoundOperationHost({...base,delegatedInspection:{requestId:input?.resourceId,phaseId:phase.phaseId,...copy(captured)}},'delegated')
   return host.execute(input,async(context,transaction)=>{
    if(await action(context,transaction)!==undefined)unavailable()
    return Object.freeze({requestId:context.resourceId,status:'ACCEPTED'})
   })
  }})
}

/** A short reviewed native SQL unit. No dispatch claim, effect reservation or
 * provider call; the receiving domain owns durable replay/uncertainty. */
export function createDelegatedNativeWorkHost(options){
 const base=delegatedConfiguration(options),c=options.privateWork
 if(!c||Object.getPrototypeOf(c)!==Object.prototype||Reflect.ownKeys(c).join(',')!=='schemaDigest'
  ||Object.values(Object.getOwnPropertyDescriptors(c)).some(d=>!('value'in d)||!d.enumerable)
  ||!/^[a-f0-9]{64}$/.test(c.schemaDigest??'')||!requestOperationPolicy(base.job.targetOperation)?.nativeWork
  ||options.privateContinuation!==undefined||options.privateInspection!==undefined||options.sourceDelivery!==undefined)throw TypeError('Explicit native SQL work source required')
 const captured=freeze(copy(c))
 return Object.freeze({contract:OPERATION_CONTRACT,hostContract:PRIVATE_OPERATION_HOST_CONTRACT,
  runSqlWork(input,unit,action){
   if(!unit||Object.getPrototypeOf(unit)!==Object.prototype||Reflect.ownKeys(unit).length!==3
    ||Object.keys(unit).sort().join(',')!=='accessMode,inputDigest,unitId'
    ||Object.values(Object.getOwnPropertyDescriptors(unit)).some(d=>!('value'in d)||!d.enumerable)
    ||typeof action!=='function')throw TypeError('Explicit native SQL unit action required')
   const host=createBoundOperationHost({...base,delegatedWork:{requestId:input?.resourceId,...copy(unit),...copy(captured)}},'delegated')
   return host.execute(input,async(context,transaction)=>{
    if(await action(context,transaction)!==undefined)unavailable()
    return Object.freeze({requestId:context.resourceId,status:'ACCEPTED'})
   })
  }})
}

function createBoundOperationHost(options, serviceMode) {
  const delegated=serviceMode==='delegated'
  const { independentQuery, transact, createAuthenticator, readResources, projectOutput, prepareInputs, describeOutcome,readExternalAccount,sourceDelivery, now = Date.now, transactionTimeoutMs = 15000 } = options
  const application = freeze(copy(options.application))
  const binding = freeze(copy(options.binding))
  if (!application || !binding || binding.applicationId !== application.appId || binding.environment !== application.environment || [independentQuery, transact, ...(serviceMode ? [] : [createAuthenticator]), ...(delegated?[]:[readResources]), projectOutput, now].some(f => typeof f !== 'function') || !Number.isSafeInteger(transactionTimeoutMs) || transactionTimeoutMs < 100 || transactionTimeoutMs > 15000) throw new TypeError('Explicit application, private binding, identity factory and real transaction adapters required')
  const store = createAccessStore({ binding, now })
  const jobStore=delegated?createDelegatedJobStore({binding,schemaDigest:options.job.schemaDigest,targetOperation:options.job.targetOperation,supplierSchemaDigest:options.job.supplierSchemaDigest,operationSchemaDigest:options.job.operationSchemaDigest,locationSchemaDigest:options.job.locationSchemaDigest,now}):null
  const scopeStore=jobStore??store
  const module = options.module === undefined ? undefined : freeze(copy(options.module))
  if (module !== undefined && (!module || Object.getPrototypeOf(module) !== Object.prototype || Object.keys(module).length !== 3 || !/^[a-f0-9]{64}$/.test(module.auditSchemaDigest ?? '') || Object.keys(module).some(key => !['id','schemaDigest','auditSchemaDigest'].includes(key)))) throw new TypeError('Explicit accepted module audit boundary required')
  const moduleGuard = module ? createModuleScopeGuard({ applicationId: binding.applicationId, environment: binding.environment, moduleId: module.id, schemaDigest: module.schemaDigest, now }) : null
  const requestOperations=application.operations.filter(op=>REQUEST_OPERATIONS.includes(op))
  if(requestOperations.length>1)throw TypeError('Separate accepted module request hosts required')
  const requestOperation=requestOperations[0],target=requestOperationPolicy(requestOperation)
  const needsRequestLedger=target!==null
  const requestBinding=options.requestLedger===undefined?null:freeze(copy(options.requestLedger))
  const requestKeys=['schemaDigest',...(target?.external||target?.location?['externalSchemaDigest']:[]),...(target?.additional?['operationSchemaDigest']:[]),...(target?.location?['locationSchemaDigest']:[])]
  if(needsRequestLedger ? serviceMode||module?.id!==target.module||!requestBinding
    ||Object.keys(requestBinding).sort().join(',')!==requestKeys.sort().join(',')||requestKeys.some(key=>!/^[a-f0-9]{64}$/.test(requestBinding[key]??''))
    :requestBinding!==null)throw TypeError('Private request requires its explicit same-store ledger and accepted module')
  const baseRequestLedger=needsRequestLedger?createRequestLedger({binding,...requestBinding,operation:requestOperation,now}):null
  if(options.requestContinuation===null)throw new TypeError('Explicit continuation cannot be null')
  const continuation=options.requestContinuation===undefined?null:freeze(copy(options.requestContinuation))
  if (continuation !== null && (!baseRequestLedger || serviceMode || delegated
    || requestOperation !== 'supplier.report.refresh' || application.operations.length !== 1)) throw new TypeError('Explicit HUMAN supplier-only private continuation required')
  const delegatedContinuation=options.delegatedContinuation===undefined?null:freeze(copy(options.delegatedContinuation))
  const privatePhaseLedger=delegatedContinuation===null?null:createRequestContinuationLedger({binding,continuation:delegatedContinuation,executionMode:'DELEGATED_SERVICE',now})
  const inspectionBinding=options.delegatedInspection===undefined?null:freeze(copy(options.delegatedInspection))
  if(inspectionBinding!==null&&(!delegated||delegatedContinuation!==null||options.sourceDelivery!==undefined))throw TypeError('Isolated current read inspection required')
  const inspectionStore=inspectionBinding===null?null:createRequestInspection({binding,inspection:inspectionBinding,now})
  const workBinding=options.delegatedWork===undefined?null:freeze(copy(options.delegatedWork))
  if(workBinding!==null&&(!delegated||delegatedContinuation!==null||inspectionBinding!==null||options.sourceDelivery!==undefined))throw TypeError('Isolated current native work required')
  const workStore=workBinding===null?null:createRequestWorkScope({binding,work:{...workBinding,...(options.job.operationSchemaDigest===undefined?{}:{targetOperation:options.job.targetOperation,operationSchemaDigest:options.job.operationSchemaDigest,...(requestOperationPolicy(options.job.targetOperation)?.location?{locationSchemaDigest:options.job.locationSchemaDigest}:{})})},now})
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
                ? await requestLedger.loadPolicy(query, { actor, request, resource:resources.resource }) : undefined
              const phasePolicy=privatePhaseLedger?await privatePhaseLedger.loadPhase(query,{actor,request,lease}):null
              const inspectionPolicy=inspectionStore?await inspectionStore.load(query,{request,lease}):null
              const nativeWorkPolicy=workStore?await workStore.load(query,{request,lease}):null
              let reserveStarted = false, completeStarted = false, ownedReservation
              callbackResult = await run({
                state: { ...lease.state, resource: resources.resource, ...(resources.inputs === undefined ? {} : { inputs: resources.inputs }),
                  ...(delegated?{delegation:{...lease.state.delegation,externalAccountObservation:observation}}:{}),
                  ...(phasePolicy?{requestContinuation:privatePhaseLedger.evidence(phasePolicy)}:{}),
                  ...(inspectionPolicy?{requestInspection:inspectionStore.evidence(inspectionPolicy)}:{}),
                  ...(nativeWorkPolicy?{requestWork:workStore.evidence(nativeWorkPolicy)}:{}),
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
                ...(phasePolicy?{
                  reservePrivatePhase:async context=>{
                    if(closed||reserveStarted)unavailable();reserveStarted=true
                    ownedReservation=await privatePhaseLedger.reserve(query,phasePolicy,context)
                    if(closed)unavailable();return ownedReservation
                  },
                  completePrivatePhase:async(context,value)=>{
                    if(closed||completeStarted||!ownedReservation)unavailable();completeStarted=true
                    await privatePhaseLedger.complete(query,phasePolicy,ownedReservation,context,value)
                    if(closed)unavailable()
                  }
                }:{}),
                ...(nativeWorkPolicy?{recordWorkIntent:async event=>{if(closed)unavailable();await scopeStore.appendAudit(query,event,lease);if(closed)unavailable()},
                  bindWork:async context=>{if(closed)unavailable();await workStore.bind(query,nativeWorkPolicy,context)},
                  verifyWork:async context=>{if(closed)unavailable();await workStore.verify(query,nativeWorkPolicy,context)}}:{}),
                ...(inspectionPolicy?{recordInspectionIntent:async event=>{if(closed)unavailable();await scopeStore.appendAudit(query,event,lease);if(closed)unavailable()},
                  bindInspection:async context=>{if(closed)unavailable();await inspectionStore.bind(query,inspectionPolicy,context)},
                  verifyInspection:async context=>{if(closed)unavailable();await inspectionStore.verify(query,inspectionPolicy,context)}}:{}),
                ...(moduleEvidence ? { moduleEvidence } : {}),
                ...(delegated?{admitDispatch:async context=>{
                  if(closed)unavailable()
                  if(privatePhaseLedger)unavailable()
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
    .update(await requestLedgerSourceDigest()).update(await requestContinuationSourceDigest()).update(await delegatedJobSourceDigest()).update(await requestInspectionSourceDigest()).update(await requestWorkSourceDigest()).digest('hex')
}
