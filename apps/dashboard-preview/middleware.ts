import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'

import {
  buildPorrDemoEntryRedirectTarget,
  extractPorrDemoSessionCookieValue,
  isDashboardPreviewApiPath,
  isDashboardPreviewPorrDemoRuntimeReady,
  resolveDashboardPreviewPorrDemoRuntimeConfig,
} from './lib/porr-demo-profile'
import { verifyPorrDemoSessionToken } from './lib/porr-demo-session'
import { routing } from './i18n/routing'

const handleI18nRouting = createMiddleware(routing)

function createPorrApiUnauthorizedResponse(status: number, message: string) {
  return NextResponse.json(
    {
      error: {
        code: status === 401 ? 'UNAUTHORIZED' : 'CONFIGURATION_ERROR',
        message,
      },
    },
    { status },
  )
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isApiRequest = isDashboardPreviewApiPath(pathname)
  const runtimeConfig = resolveDashboardPreviewPorrDemoRuntimeConfig()

  if (!runtimeConfig.enabled) {
    return isApiRequest ? NextResponse.next() : handleI18nRouting(request)
  }

  if (!isDashboardPreviewPorrDemoRuntimeReady(runtimeConfig)) {
    if (isApiRequest) {
      return createPorrApiUnauthorizedResponse(503, 'PORR dashboard session validation is not configured.')
    }

    const redirectTarget = buildPorrDemoEntryRedirectTarget(runtimeConfig.entryUrl)
    return redirectTarget
      ? NextResponse.redirect(redirectTarget)
      : new NextResponse('PORR dashboard access is not configured.', { status: 503 })
  }

  const token = extractPorrDemoSessionCookieValue(request.headers.get('cookie'))
  const session = await verifyPorrDemoSessionToken(runtimeConfig.sessionSecret!, token)

  if (!session) {
    if (isApiRequest) {
      return createPorrApiUnauthorizedResponse(401, 'PORR dashboard session is required.')
    }

    return NextResponse.redirect(new URL(runtimeConfig.entryUrl!))
  }

  return isApiRequest ? NextResponse.next() : handleI18nRouting(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}