import type { PoolClient } from 'pg'
import { OPERATION_CONTRACT, OperationDenied, operationPayloadDigest, type Json, type OperationContext } from '@profitia/platform-contracts/operation-context'
import { createDelegatedPrivateInspectionHost } from '@profitia/platform-contracts/private-operation-host'
import { createClerkAccountStatusReader } from '@profitia/platform-contracts/identity-provider'
import { readPresentationJson } from '@profitia/platform-contracts/embedded-read-channel'
import { createSrmNativePgDriver } from './native-pg-driver'
import { readSupplierRequest, type SupplierRequestCommand } from './supplier-request-operation'
import { SUPPLIER_PRIVATE_PHASES, type SupplierPrivatePhase, type SupplierServiceContinuationOptions } from './supplier-request-continuation'

export const MAX_PRIVATE_INSPECTION_BYTES = 8 * 1024 * 1024
export type SupplierPrivateInspectionSelection = Readonly<{
  requestId: string; organisationId: string; command: SupplierRequestCommand; phaseId: SupplierPrivatePhase
}>
export type SupplierRequestInspectionOptions = Omit<SupplierServiceContinuationOptions, 'executionMode'> & {
  inspectionSchemaDigest: string; inspectionBusinessBoundaryDigest: string
}
export interface SupplierRequestInspection {
  read<T>(selection: SupplierPrivateInspectionSelection,
    action: (context: Readonly<OperationContext>, client: PoolClient) => T | Promise<T>): Promise<T>
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const refuse = (): never => { throw new OperationDenied('RESOURCE_SCOPE_MISMATCH') }
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

/** Same shared inspection host and native driver. Captured server JSON leaves
 * this adapter only after actual COMMIT; failed reads publish no captured value. */
export function createSrmSupplierRequestInspection(options: SupplierRequestInspectionOptions): Readonly<SupplierRequestInspection> {
  const allowed = ['pool','auditPool','clerk','now','transactionTimeoutMs','application','binding','job',
    'continuationSchemaDigest','delegatedSchemaDigest','commandBoundaryDigest','delegatedBusinessBoundaryDigest',
    'accountIdentity','inspectionSchemaDigest','inspectionBusinessBoundaryDigest']
  if (typeof window !== 'undefined' || Object.keys(options).some(k => !allowed.includes(k))
    || Reflect.ownKeys(options).length !== Object.keys(options).length
    || Object.values(Object.getOwnPropertyDescriptors(options)).some(d => !('value' in d) || !d.enumerable)
    || !['continuationSchemaDigest','delegatedSchemaDigest','commandBoundaryDigest','delegatedBusinessBoundaryDigest',
      'inspectionSchemaDigest','inspectionBusinessBoundaryDigest'].every(k => /^[a-f0-9]{64}$/.test(options[k as keyof SupplierRequestInspectionOptions] as string))
    || options.accountIdentity?.environment !== options.application.environment) throw TypeError('Explicit native Supplier inspection binding required')
  const fixed = freeze(structuredClone({ application: options.application, binding: options.binding, job: options.job,
    continuationSchemaDigest: options.continuationSchemaDigest, delegatedSchemaDigest: options.delegatedSchemaDigest,
    commandBoundaryDigest: options.commandBoundaryDigest, delegatedBusinessBoundaryDigest: options.delegatedBusinessBoundaryDigest,
    inspectionSchemaDigest: options.inspectionSchemaDigest, inspectionBusinessBoundaryDigest: options.inspectionBusinessBoundaryDigest }))
  const host = createDelegatedPrivateInspectionHost<PoolClient>({ application: fixed.application, binding: fixed.binding, job: fixed.job,
    now: options.now, transactionTimeoutMs: options.transactionTimeoutMs,
    privateInspection: { schemaDigest: fixed.inspectionSchemaDigest, continuationSchemaDigest: fixed.continuationSchemaDigest, delegatedSchemaDigest: fixed.delegatedSchemaDigest },
    readExternalAccount: createClerkAccountStatusReader({ client: options.clerk, ...options.accountIdentity, now: options.now }),
    ...createSrmNativePgDriver(options.pool, options.auditPool) })
  return Object.freeze({
    async read<T>(input: SupplierPrivateInspectionSelection, action: (context: Readonly<OperationContext>, client: PoolClient) => T | Promise<T>): Promise<T> {
      if (!input || Object.getPrototypeOf(input) !== Object.prototype
        || Reflect.ownKeys(input).length !== 4
        || Object.values(Object.getOwnPropertyDescriptors(input)).some(d => !('value' in d) || !d.enumerable)
        || Object.keys(input).sort().join(',') !== 'command,organisationId,phaseId,requestId'
        || !uuid.test(input.requestId) || !uuid.test(input.organisationId)
        || !SUPPLIER_PRIVATE_PHASES.includes(input.phaseId) || typeof action !== 'function') return refuse()
      const selected = freeze({ ...input, command: readSupplierRequest(input.command) })
      let captured: T | undefined, received = false
      try {
        const receipt = await host.inspectPrivatePhase({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
          operation: 'job.execute', organisationId: selected.organisationId, resourceId: selected.requestId, payload: selected.command, request: null },
        { phaseId: selected.phaseId }, async (context, client) => {
          if (received || context.actorKind !== 'SERVICE' || context.subjectUserId === context.actorId
            || context.organisationId !== selected.organisationId || context.payloadDigest !== operationPayloadDigest(selected.command)
            || context.requestInspection?.requestId !== selected.requestId || context.requestInspection.phaseId !== selected.phaseId
            || context.requestContinuation !== undefined || context.delegation?.target.application.appId !== 'srm') return refuse()
          const d = (await client.query('SELECT srm.current_supplier_inspection($1::uuid,$2::uuid,$3) AS descriptor',
            [selected.organisationId, selected.requestId, selected.command.nip])).rows[0]?.descriptor
          if (!d || d.inspectionBusinessSchemaVersion !== '1.0.0'
            || d.inspectionBusinessBoundaryDigest !== fixed.inspectionBusinessBoundaryDigest
            || d.commandBoundaryDigest !== fixed.commandBoundaryDigest || d.delegatedBusinessBoundaryDigest !== fixed.delegatedBusinessBoundaryDigest
            || d.applicationId !== context.applicationId || d.parentApplicationId !== 'srm'
            || d.subjectUserId !== context.subjectUserId || d.nip !== selected.command.nip || d.phaseId !== selected.phaseId) return refuse()
          const commands = await client.query('SELECT command_json FROM profitia_supplier_requests.commands WHERE request_id=$1::uuid', [selected.requestId])
          if (commands.rows.length !== 1 || operationPayloadDigest(readSupplierRequest(commands.rows[0].command_json)) !== context.payloadDigest) return refuse()
          await client.query("SELECT set_config('srm.organization_id',$1,true)", [selected.organisationId])
          const value = await action(context, client)
          const digest = operationPayloadDigest(value as Json), text = JSON.stringify(value)
          if (!text || Buffer.byteLength(text) > MAX_PRIVATE_INSPECTION_BYTES) return refuse()
          const json = await readPresentationJson(new Response(text, { headers: { 'content-type': 'application/json' } }), MAX_PRIVATE_INSPECTION_BYTES)
          if (operationPayloadDigest(json) !== digest) return refuse()
          captured = freeze(json) as T; received = true
        })
        if (!received || receipt.value.requestId !== selected.requestId || receipt.value.status !== 'ACCEPTED') return refuse()
        return captured as T
      } finally { captured = undefined }
    },
  })
}
