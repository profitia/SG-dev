import { NextRequest, NextResponse } from 'next/server'

import {
  buildExpiredPorrDemoSessionCookie,
  buildPorrDemoSessionCookie,
  createPorrDemoSessionToken,
} from '@/lib/porr-demo-session'
import {
  isPorrDemoRuntimeReady,
  resolvePorrDemoAbsoluteUrl,
  resolvePorrDemoLocale,
  resolvePorrDemoNextPath,
  resolvePorrDemoRuntimeConfig,
} from '@/lib/porr-demo-profile'

export const dynamic = 'force-dynamic'

function buildAccessRedirect(runtimeAppUrl: string, request: NextRequest, locale: 'pl' | 'en', nextPath: string, error: string) {
  const redirectUrl = resolvePorrDemoAbsoluteUrl(`/${locale}`, runtimeAppUrl, request.url)
  redirectUrl.searchParams.set('next', nextPath)
  redirectUrl.searchParams.set('error', error)
  return redirectUrl
}

export async function POST(request: NextRequest) {
  const runtimeConfig = resolvePorrDemoRuntimeConfig()
  const formData = await request.formData()
  const locale = resolvePorrDemoLocale(String(formData.get('locale') ?? '/pl'))
  const nextPath = resolvePorrDemoNextPath(String(formData.get('next') ?? ''), locale)

  if (!runtimeConfig.enabled || !isPorrDemoRuntimeReady(runtimeConfig)) {
    return NextResponse.redirect(buildAccessRedirect(runtimeConfig.appUrl, request, locale, nextPath, 'configuration'))
  }

  const submittedPassword = String(formData.get('password') ?? '').trim()
  if (submittedPassword !== runtimeConfig.password) {
    const response = NextResponse.redirect(buildAccessRedirect(runtimeConfig.appUrl, request, locale, nextPath, 'invalid-password'))
    response.cookies.set(buildExpiredPorrDemoSessionCookie(runtimeConfig.appUrl, runtimeConfig.nodeEnv))
    return response
  }

  const token = await createPorrDemoSessionToken(runtimeConfig.sessionSecret!, {
    orgId: runtimeConfig.orgId!,
    userId: runtimeConfig.userId!,
    orgRole: runtimeConfig.orgRole!,
  })

  const response = NextResponse.redirect(resolvePorrDemoAbsoluteUrl(nextPath, runtimeConfig.appUrl, request.url))
  response.cookies.set(buildPorrDemoSessionCookie(token, runtimeConfig.appUrl, runtimeConfig.nodeEnv))
  return response
}