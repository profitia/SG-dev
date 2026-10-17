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

function privateDashboardResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store')
  const vary = response.headers.get('Vary')?.split(',').map(value => value.trim()).filter(Boolean) ?? []
  if (!vary.includes('*')) {
    for (const name of ['Cookie', 'Authorization']) {
      if (!vary.some(value => value.toLowerCase() === name.toLowerCase())) vary.push(name)
    }
    response.headers.set('Vary', vary.join(', '))
  }
  return response
}

function createPorrApiUnauthorizedResponse(status: number, message: string) {
  return privateDashboardResponse(NextResponse.json(
    {
      error: {
        code: status === 401 ? 'UNAUTHORIZED' : 'CONFIGURATION_ERROR',
        message,
      },
    },
    { status },
  ))
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isApiRequest = isDashboardPreviewApiPath(pathname)
  // An explicit individual identity mode cannot borrow the legacy session or
  // the open library profile. This host has not yet adopted its private guard.
  // Its later adoption must verify identity, current rights and resource scope.
  const provider = process.env.PROFITIA_AUTH_PROVIDER ?? 'legacy_demo'
  if (provider !== 'legacy_demo') {
    return isApiRequest
      ? createPorrApiUnauthorizedResponse(503, 'Dashboard access is not configured.')
      : privateDashboardResponse(new NextResponse('Dashboard access is not configured.', { status: 503 }))
  }
  const runtimeConfig = resolveDashboardPreviewPorrDemoRuntimeConfig()

  if (!runtimeConfig.enabled) {
    return isApiRequest ? NextResponse.next() : handleI18nRouting(request)
  }

  if (!isDashboardPreviewPorrDemoRuntimeReady(runtimeConfig)) {
    if (isApiRequest) {
      return createPorrApiUnauthorizedResponse(503, 'PORR dashboard session validation is not configured.')
    }

    const redirectTarget = buildPorrDemoEntryRedirectTarget(runtimeConfig.entryUrl)
    return privateDashboardResponse(redirectTarget
      ? NextResponse.redirect(redirectTarget)
      : new NextResponse('PORR dashboard access is not configured.', { status: 503 }))
  }

  const token = extractPorrDemoSessionCookieValue(request.headers.get('cookie'), runtimeConfig.appEnv)
  const session = await verifyPorrDemoSessionToken(runtimeConfig.sessionSecret!, token)

  if (!session) {
    if (isApiRequest) {
      return createPorrApiUnauthorizedResponse(401, 'PORR dashboard session is required.')
    }

    return privateDashboardResponse(NextResponse.redirect(new URL(runtimeConfig.entryUrl!)))
  }

  return privateDashboardResponse(isApiRequest ? NextResponse.next() : handleI18nRouting(request))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
