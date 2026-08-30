import { type NextRequest } from 'next/server'

import { withInternalForecastServiceAuth } from '@/lib/api/internal-forecast-service-auth'
import { cognitionError, cognitionOk, parseJsonBody, parseSearchParams } from '@/lib/api/middleware'
import {
  InteractiveForecastIdentitySchema,
  prepareInteractiveCurrentForecast,
  resolveInteractiveForecastCapability,
  type InteractiveForecastCapabilityResult,
  type InteractiveForecastIdentity,
  type InteractiveForecastPreparationResult,
} from '@/lib/forecast/interactive-preparation'

type CapabilityResolver = (input: InteractiveForecastIdentity) => Promise<InteractiveForecastCapabilityResult>
type CurrentPreparationResolver = (input: InteractiveForecastIdentity) => Promise<InteractiveForecastPreparationResult>

function internalRouteError(error: unknown, requestId: string) {
  return cognitionError(
    'INTERNAL_FORECAST_OPERATION_FAILED',
    error instanceof Error ? error.message : 'Internal Forecast operation failed.',
    500,
    requestId,
  )
}

export function createInternalForecastCapabilityRouteHandler(
  resolveCapability: CapabilityResolver = resolveInteractiveForecastCapability,
) {
  return withInternalForecastServiceAuth(async (principal, request: NextRequest) => {
    const parsed = parseSearchParams(request, InteractiveForecastIdentitySchema)
    if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, principal.requestId)

    try {
      return cognitionOk(await resolveCapability(parsed.data))
    } catch (error) {
      return internalRouteError(error, principal.requestId)
    }
  })
}

export function createInternalCurrentForecastPreparationRouteHandler(
  prepareCurrent: CurrentPreparationResolver = prepareInteractiveCurrentForecast,
) {
  return withInternalForecastServiceAuth(async (principal, request: NextRequest) => {
    const parsed = await parseJsonBody(request, InteractiveForecastIdentitySchema)
    if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, principal.requestId)

    try {
      return cognitionOk(await prepareCurrent(parsed.data))
    } catch (error) {
      return internalRouteError(error, principal.requestId)
    }
  })
}