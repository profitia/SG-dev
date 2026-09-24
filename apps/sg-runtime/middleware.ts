import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'

import {
  isPorrDemoProtectedPagePath,
  isPorrDemoRestrictedPagePath,
  isPorrDemoRuntimeReady,
  resolvePorrDemoAbsoluteUrl,
  resolvePorrDemoCookieDomain,
  resolvePorrDemoLocale,
  resolvePorrDemoNextPath,
  resolvePorrDemoRuntimeConfig,
  resolvePorrDemoSessionCookieName,
} from './lib/porr-demo-profile'
import { buildPorrDemoSessionCookie, verifyPorrDemoSessionToken } from './lib/porr-demo-session'
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
  const token = request.cookies.get(resolvePorrDemoSessionCookieName(runtimeConfig.appEnv))?.value
  const session = runtimeConfig.sessionSecret
    ? await verifyPorrDemoSessionToken(runtimeConfig.sessionSecret, token)
    : null

  if (isPorrDemoRestrictedPagePath(request.nextUrl.pathname)) {
    return NextResponse.redirect(resolvePorrDemoAbsoluteUrl(
      session ? `/${locale}/benchmark-finder` : `/${locale}`,
      runtimeConfig.appUrl,
      request.url,
    ))
  }

  if (!isPorrDemoProtectedPagePath(request.nextUrl.pathname)) {
    return intlResponse
  }

  if (!isPorrDemoRuntimeReady(runtimeConfig)) {
    const redirectUrl = resolvePorrDemoAbsoluteUrl(`/${locale}`, runtimeConfig.appUrl, request.url)
    redirectUrl.searchParams.set('error', 'configuration')
    return NextResponse.redirect(redirectUrl)
  }

  if (session) {
    // Upgrade an already signed-in Development browser's host-only cookie so the
    // sibling analytics host receives it without requiring a second login.
    const domain = resolvePorrDemoCookieDomain(runtimeConfig.appEnv, runtimeConfig.appUrl)
    // The public host may be rewritten to the Render host before NextRequest is
    // constructed. The browser itself accepts this domain cookie only when the
    // response came from a spendguru.app host; it rejects it on *.onrender.com.
    if (domain && token) {
      intlResponse.cookies.set({
        ...buildPorrDemoSessionCookie(token, runtimeConfig.appEnv, runtimeConfig.nodeEnv, runtimeConfig.appUrl),
        maxAge: Math.max(0, session.exp - Math.floor(Date.now() / 1000)),
      })
    }
    return intlResponse
  }

  const redirectUrl = resolvePorrDemoAbsoluteUrl(`/${locale}`, runtimeConfig.appUrl, request.url)
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
