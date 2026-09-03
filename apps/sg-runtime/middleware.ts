import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'

import {
  PORR_DEMO_SESSION_COOKIE_NAME,
  isPorrDemoProtectedPagePath,
  isPorrDemoRestrictedPagePath,
  isPorrDemoRuntimeReady,
  resolvePorrDemoLocale,
  resolvePorrDemoNextPath,
  resolvePorrDemoRuntimeConfig,
} from './lib/porr-demo-profile'
import { verifyPorrDemoSessionToken } from './lib/porr-demo-session'
import { routing } from './i18n/routing'

// Locale-aware routing middleware.
// - Redirects / to /pl (the default locale).
// - Recognises /pl and /en as valid locale prefixes.
// - Stores the last locale in a cookie for future visits.
// /api routes are intentionally excluded by the matcher so /api/health is unaffected.
const handleI18nRouting = createMiddleware(routing)

export default async function middleware(request: NextRequest) {
  const intlResponse = handleI18nRouting(request)
  const runtimeConfig = resolvePorrDemoRuntimeConfig()
  if (!runtimeConfig.enabled) {
    return intlResponse
  }

  const locale = resolvePorrDemoLocale(request.nextUrl.pathname)
  const token = request.cookies.get(PORR_DEMO_SESSION_COOKIE_NAME)?.value
  const session = runtimeConfig.sessionSecret
    ? await verifyPorrDemoSessionToken(runtimeConfig.sessionSecret, token)
    : null

  if (isPorrDemoRestrictedPagePath(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL(session ? `/${locale}/benchmark-finder` : `/${locale}`, request.url))
  }

  if (!isPorrDemoProtectedPagePath(request.nextUrl.pathname)) {
    return intlResponse
  }

  if (!isPorrDemoRuntimeReady(runtimeConfig)) {
    const redirectUrl = new URL(`/${locale}`, request.url)
    redirectUrl.searchParams.set('error', 'configuration')
    return NextResponse.redirect(redirectUrl)
  }

  if (session) {
    return intlResponse
  }

  const redirectUrl = new URL(`/${locale}`, request.url)
  redirectUrl.searchParams.set('next', resolvePorrDemoNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`, locale))
  return NextResponse.redirect(redirectUrl)
}

export const config = {
  matcher: [
    // Match all pathnames except:
    // - /api/* (health route and future API routes must not be locale-redirected)
    // - /_next/* (Next.js internals)
    // - Static files (anything with a file extension: .ico, .png, .css, etc.)
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
