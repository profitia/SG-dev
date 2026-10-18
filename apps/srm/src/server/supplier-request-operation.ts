import { createHash } from 'node:crypto'
import type { PoolClient } from 'pg'
import { OperationDenied, operationPayloadDigest, type OperationContext } from '@profitia/platform-contracts/operation-context'
import { validateXrayRequest } from './xray-lookup'

export const SUPPLIER_REQUEST_PROJECTION = 'srm-private-supplier-request-v1'
export const MAX_SUPPLIER_REQUEST_BYTES = 1024
export type SupplierRequestCommand = Readonly<{ kind: 'SUPPLIER_REPORT'; nip: string }>
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const refuse = (): never => { throw new OperationDenied('RESOURCE_SCOPE_MISMATCH') }

/** Closed intent only. It gives no authority to execute a provider request. */
export function readSupplierRequest(value: unknown): SupplierRequestCommand {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw new OperationDenied('CONTEXT_INVALID')
  const command = value as Record<string, unknown>
  if (Object.keys(command).sort().join(',') !== 'kind,nip'
    || command.kind !== 'SUPPLIER_REPORT' || typeof command.nip !== 'string'
    || !/^[0-9]{10}$/.test(command.nip) || command.nip === '0000000000') throw new OperationDenied('CONTEXT_INVALID')
  try { validateXrayRequest({ identifier: command.nip }) }
  catch { throw new OperationDenied('CONTEXT_INVALID') }
  return Object.freeze({ kind: 'SUPPLIER_REPORT', nip: command.nip })
}
export function supplierRequestResourceId(command: SupplierRequestCommand) {
  return `supplier-request:${operationPayloadDigest(readSupplierRequest(command))}`
}

/** Same pg transaction as the shared reservation and canonical OUTCOME. */
export async function persistSupplierRequest(context: Readonly<OperationContext>, client: PoolClient) {
  const command = readSupplierRequest(context.payload), reservation = context.requestReservation
  if (!reservation || reservation.replay !== false || !uuid.test(reservation.requestId)
    || context.operation !== 'supplier.report.refresh' || !context.organisationId || context.actorKind !== 'HUMAN'
    || context.applicationId !== 'srm' || context.resourceId !== supplierRequestResourceId(command)
    || context.payloadDigest !== operationPayloadDigest(command)) return refuse()
  const text = JSON.stringify(command)
  if (createHash('sha256').update(text).digest('hex') !== context.payloadDigest) return refuse()
  const result = await client.query(
    'INSERT INTO profitia_supplier_requests.commands(request_id,application_id,environment,organisation_id,user_id,resource_id,payload_digest,decision_id,command_text) VALUES($1::uuid,$2,$3,$4::uuid,$5::uuid,$6,$7,$8::uuid,$9)',
    [reservation.requestId, context.applicationId, context.environment, context.organisationId, context.actorId,
      context.resourceId, context.payloadDigest, context.decisionId, text],
  )
  if (result.rowCount !== 1) return refuse()
  return Object.freeze({ requestId: reservation.requestId, status: 'ACCEPTED' as const })
}

export function projectSupplierRequest(value: unknown, context: Readonly<OperationContext>) {
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'requestId,status'
    || !('requestId' in value) || typeof value.requestId !== 'string' || !uuid.test(value.requestId)
    || !('status' in value) || value.status !== 'ACCEPTED' || value.requestId !== context.requestReservation?.requestId
    || context.operation !== 'supplier.report.refresh' || context.resourceId !== supplierRequestResourceId(readSupplierRequest(context.payload))) return refuse()
  return Response.json({ requestId: value.requestId, status: 'ACCEPTED' }, { status: 202, headers: {
    'Cache-Control': 'private, no-store', 'Vary': 'Cookie, Authorization',
    'X-Profitia-Operation-Contract': `${context.contractId}@${context.contractVersion}`,
    'X-Profitia-Application': context.applicationId, 'X-Profitia-Environment': context.environment,
    'X-Profitia-Supplier-Projection': SUPPLIER_REQUEST_PROJECTION,
    'X-Profitia-Supplier-Resource': context.resourceId,
    'X-Profitia-Supplier-Configuration': context.configurationVersion,
  } })
}
