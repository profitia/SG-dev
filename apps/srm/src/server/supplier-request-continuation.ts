import type { PoolClient } from 'pg'
import { OPERATION_CONTRACT, OperationDenied, operationPayloadDigest, type Json, type OperationContext } from '@profitia/platform-contracts/operation-context'
import { readPresentationJson } from '@profitia/platform-contracts/embedded-read-channel'
import { validRequestIdempotencyKey } from '@profitia/platform-contracts/request-ledger'
import { createSrmSupplierRequestOperationHost } from './private-runtime'
import { readSupplierRequest, supplierRequestResourceId, type SupplierRequestCommand } from './supplier-request-operation'

export const SUPPLIER_PRIVATE_PHASES = Object.freeze(['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'] as const)
export type SupplierPrivatePhase = typeof SUPPLIER_PRIVATE_PHASES[number]
export const MAX_PRIVATE_PHASE_BYTES = 1024 * 1024
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const deny = (reason: 'CONTEXT_INVALID' | 'POLICY_UNAVAILABLE' | 'RESOURCE_SCOPE_MISMATCH' = 'RESOURCE_SCOPE_MISMATCH'): never => { throw new OperationDenied(reason) }
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
type HostOptions = Parameters<typeof createSrmSupplierRequestOperationHost>[0]
type Options = Omit<HostOptions, 'requestContinuation'> & { continuationSchemaDigest: string }
export type SupplierPrivatePhaseInput = Readonly<{
  requestId: string; phaseId: SupplierPrivatePhase; organisationId: string
  command: SupplierRequestCommand; idempotencyKey: string; request: Request; data: Json
}>

/** Server composition of the existing native host. It exposes no new HTTP
 * endpoint, alternate identity, policy engine, audit writer or provider port. */
export function createSrmSupplierRequestContinuation(options: Options) {
  if (typeof window !== 'undefined' || !/^[a-f0-9]{64}$/.test(options.continuationSchemaDigest)
    || Object.hasOwn(options, 'requestContinuation')) throw new TypeError('Explicit server-owned continuation source required')
  const schemaDigest = options.continuationSchemaDigest
  const { pool, auditPool, clerk, now, transactionTimeoutMs } = options
  const captured: HostOptions = { pool, auditPool, clerk, now, transactionTimeoutMs,
    ...structuredClone({ application: options.application, identity: options.identity, binding: options.binding,
      module: options.module, requestLedger: options.requestLedger, commandBoundaryDigest: options.commandBoundaryDigest }) }
  // Construction validates the unchanged supplier-only native configuration;
  // it does not authenticate, read a database or retain any actor/transaction.
  createSrmSupplierRequestOperationHost(captured)
  return Object.freeze({
    async run(input: SupplierPrivatePhaseInput,
      action: (context: Readonly<OperationContext>, client: PoolClient, data: Readonly<Json>) => void | Promise<void>) {
      if (!input || Object.getPrototypeOf(input) !== Object.prototype
        || Object.keys(input).sort().join(',') !== 'command,data,idempotencyKey,organisationId,phaseId,request,requestId'
        || !uuid.test(input.requestId) || !uuid.test(input.organisationId)
        || !SUPPLIER_PRIVATE_PHASES.includes(input.phaseId) || !validRequestIdempotencyKey(input.idempotencyKey)
        || !(input.request instanceof Request) || input.request.signal.aborted || typeof action !== 'function') return deny('CONTEXT_INVALID')
      const { requestId, phaseId, organisationId, idempotencyKey, request } = input
      const command = readSupplierRequest(input.command)
      let data: Json
      try {
        const expected = operationPayloadDigest(input.data), text = JSON.stringify(input.data)
        if (!text || Buffer.byteLength(text) > MAX_PRIVATE_PHASE_BYTES) return deny('CONTEXT_INVALID')
        data = freeze(await readPresentationJson(new Response(text, { headers: { 'content-type': 'application/json' } }), MAX_PRIVATE_PHASE_BYTES))
        if (operationPayloadDigest(data) !== expected) return deny('CONTEXT_INVALID')
      } catch { return deny('CONTEXT_INVALID') }
      const inputDigest = operationPayloadDigest(data)
      const host = createSrmSupplierRequestOperationHost({ ...captured,
        requestContinuation: { requestId, phaseId, inputDigest, schemaDigest } })
      let performed = false
      const result = await host.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        operation: 'supplier.report.refresh', organisationId, resourceId: supplierRequestResourceId(command),
        payload: command, idempotencyKey, request,
      }, async (context, client) => {
        const continuation = context.requestContinuation
        if (request.signal.aborted || !continuation || continuation.requestId !== requestId || continuation.phaseId !== phaseId
          || continuation.inputDigest !== inputDigest || continuation.schemaDigest !== schemaDigest
          || context.requestReservation?.requestId !== requestId || context.requestReservation.replay !== false
          || context.applicationId !== 'srm' || context.actorKind !== 'HUMAN' || context.organisationId !== organisationId
          || context.payloadDigest !== operationPayloadDigest(command)) return deny()
        const row = await client.query('SELECT command_json FROM profitia_supplier_requests.commands WHERE request_id=$1::uuid', [requestId])
        if (row.rows.length !== 1 || operationPayloadDigest(readSupplierRequest(row.rows[0].command_json)) !== context.payloadDigest) return deny()
        if (await action(context, client, data) !== undefined || request.signal.aborted) return deny()
        performed = true
        return Object.freeze({ requestId, status: 'ACCEPTED' as const })
      })
      const publication: unknown = result.value
      if (!(publication instanceof Response) || publication.status !== 202) return deny('POLICY_UNAVAILABLE')
      const receipt: unknown = await publication.json()
      if (!receipt || typeof receipt !== 'object' || Object.keys(receipt).sort().join(',') !== 'requestId,status'
        || !('requestId' in receipt) || receipt.requestId !== requestId || !('status' in receipt) || receipt.status !== 'ACCEPTED') return deny('POLICY_UNAVAILABLE')
      // execute resolves after the actual native COMMIT. Failure/unknown COMMIT
      // propagates; this function never replays work or reports rollback itself.
      return Object.freeze({ requestId, phaseId, status: performed ? 'COMMITTED' as const : 'REPLAY' as const })
    },
  })
}
