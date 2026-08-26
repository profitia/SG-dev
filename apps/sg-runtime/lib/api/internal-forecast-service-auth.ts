import { randomUUID, timingSafeEqual } from 'node:crypto'

import { type NextRequest, NextResponse } from 'next/server'

import { cognitionError } from '@/lib/api/middleware'

export type InternalForecastServicePrincipal = {
  kind: 'INTERNAL_SERVICE'
  service: 'DASHBOARD_PREVIEW'
  scope: 'FORECAST_READ'
  requestId: string
}

type InternalForecastServiceHandler<TArgs extends unknown[] = []> = (
  principal: InternalForecastServicePrincipal,
  request: NextRequest,
  ...args: TArgs
) => Promise<NextResponse>

type InternalForecastServiceAuthOptions = {
  service?: InternalForecastServicePrincipal['service']
  scope?: InternalForecastServicePrincipal['scope']
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization')?.trim() ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(authorization)
  return match?.[1]?.trim() ?? null
}

function isValidInternalServiceToken(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)

  if (actualBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer)
    return false
  }

  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export function withInternalForecastServiceAuth<TArgs extends unknown[]>(
  handler: InternalForecastServiceHandler<TArgs>,
  options: InternalForecastServiceAuthOptions = {},
) {
  const service = options.service ?? 'DASHBOARD_PREVIEW'
  const scope = options.scope ?? 'FORECAST_READ'

  return async (request: NextRequest, ...args: TArgs): Promise<NextResponse> => {
    const configuredToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN?.trim() ?? ''
    const requestId = request.headers.get('x-request-id') ?? randomUUID()

    if (!configuredToken) {
      return cognitionError(
        'INTERNAL_SERVICE_AUTH_UNAVAILABLE',
        'Internal forecast service authentication is not configured.',
        403,
        requestId,
      )
    }

    const providedToken = readBearerToken(request)
    if (!providedToken) {
      return cognitionError(
        'INTERNAL_SERVICE_AUTH_REQUIRED',
        'Internal forecast service authentication is required.',
        401,
        requestId,
      )
    }

    if (!isValidInternalServiceToken(providedToken, configuredToken)) {
      return cognitionError(
        'INTERNAL_SERVICE_AUTH_INVALID',
        'Internal forecast service authentication is invalid.',
        403,
        requestId,
      )
    }

    return handler({
      kind: 'INTERNAL_SERVICE',
      service,
      scope,
      requestId,
    }, request, ...args)
  }
}