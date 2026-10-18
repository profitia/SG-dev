import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { OperationDenied, operationPayloadDigest, type OperationContext } from '@profitia/platform-contracts/operation-context'
import { cognitionOk, privateApiResponse } from '@/lib/api/middleware'
import type { ForecastPreparationCommand } from './preparation-queue'

export const FORECAST_REQUEST_PROJECTION = 'sg2-private-forecast-request-v1'
export const MAX_FORECAST_REQUEST_BYTES = 16384
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const refuse = (): never => { throw new OperationDenied('RESOURCE_SCOPE_MISMATCH') }

/** The existing queue's schema remains the sole domain command definition.
 * This adapter persists delivery intent; it never invokes the compute queue. */
export async function readForecastRequest(value: unknown): Promise<ForecastPreparationCommand> {
  const { ForecastPreparationCommandSchema } = await import('./preparation-queue')
  const parsed = ForecastPreparationCommandSchema.safeParse(value)
  if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data), 'utf8') > MAX_FORECAST_REQUEST_BYTES) {
    throw new OperationDenied('CONTEXT_INVALID')
  }
  return parsed.data
}
export function forecastRequestResourceId(command: ForecastPreparationCommand) {
  return `forecast-request:${operationPayloadDigest(command)}`
}

/** Same ordinary Prisma transaction as quota, intent and OUTCOME. Neither
 * caller-supplied ownership nor an earlier receipt can authorize this write. */
export async function persistForecastRequest(context: Readonly<OperationContext>, transaction: Prisma.TransactionClient) {
  const command = await readForecastRequest(context.payload)
  const reservation = context.requestReservation
  if (!reservation || reservation.replay !== false || !uuid.test(reservation.requestId)
    || context.operation !== 'forecast.request' || !context.organisationId || context.actorKind !== 'HUMAN'
    || context.applicationId !== 'spendguru' || context.resourceId !== forecastRequestResourceId(command)
    || context.payloadDigest !== operationPayloadDigest(command)) return refuse()
  // The domain has exactly four string fields. Ordered serialization matches
  // the shared canonical digest; SQL independently hashes the stored UTF8 bytes.
  const commandText = JSON.stringify(Object.fromEntries(Object.keys(command).sort().map(key => [key, command[key as keyof typeof command]])))
  if (createHash('sha256').update(commandText).digest('hex') !== context.payloadDigest) return refuse()
  const count = await transaction.$executeRawUnsafe(
    'INSERT INTO profitia_forecast_requests.commands(request_id,application_id,environment,organisation_id,user_id,resource_id,payload_digest,decision_id,command_text) VALUES($1::uuid,$2,$3,$4::uuid,$5::uuid,$6,$7,$8::uuid,$9)',
    reservation.requestId, context.applicationId, context.environment, context.organisationId, context.actorId,
    context.resourceId, context.payloadDigest, context.decisionId, commandText,
  )
  if (count !== 1) return refuse()
  return { requestId: reservation.requestId, status: 'ACCEPTED' as const }
}

export async function projectForecastRequest(value: unknown, context: Readonly<OperationContext>) {
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'requestId,status'
    || !('requestId' in value) || typeof value.requestId !== 'string' || !uuid.test(value.requestId)
    || !('status' in value) || value.status !== 'ACCEPTED' || value.requestId !== context.requestReservation?.requestId
    || context.operation !== 'forecast.request' || context.resourceId !== forecastRequestResourceId(await readForecastRequest(context.payload))) return refuse()
  const response = privateApiResponse(cognitionOk({ requestId: value.requestId, status: 'ACCEPTED' }, 202))
  response.headers.set('X-Profitia-Forecast-Projection', FORECAST_REQUEST_PROJECTION)
  return response
}
