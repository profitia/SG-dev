import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { BenchmarkFinderClient } from '@/components/benchmark-finder/benchmark-finder-client'
import { PorrDemoShell } from '@/components/porr-demo/porr-demo-shell'
import { isPorrDemoProfile } from '@/lib/env'
import {
  isPorrDemoRuntimeReady,
  resolvePorrDemoRuntimeConfig,
  resolvePorrDemoSessionCookieName,
} from '@/lib/porr-demo-profile'
import { verifyPorrDemoSessionToken } from '@/lib/porr-demo-session'
import { readSg2IdentityRuntime } from '@/lib/platform/identity-runtime'
import { Sg2AuthenticatedView } from '@/components/auth/session-boundary'

type BenchmarkFinderPageProps = {
  params: {
    locale: string
  }
}

export default async function BenchmarkFinderPage({ params }: BenchmarkFinderPageProps) {
  const locale = params.locale === 'en' ? 'en' : 'pl'
  let identity
  try { identity = readSg2IdentityRuntime() }
  catch { return <p role="alert">{locale === 'en' ? 'Sign-in is temporarily unavailable.' : 'Logowanie jest chwilowo niedostępne.'}</p> }
  if (identity.provider === 'clerk') {
    return <Sg2AuthenticatedView locale={locale}>
      <PorrDemoShell locale={locale} activeRoute="benchmark-finder"><BenchmarkFinderClient locale={locale} showPorrDemoPortfolio={isPorrDemoProfile} /></PorrDemoShell>
    </Sg2AuthenticatedView>
  }

  if (!isPorrDemoProfile) {
    return <BenchmarkFinderClient locale={locale} />
  }

  const runtimeConfig = resolvePorrDemoRuntimeConfig()
  const token = cookies().get(resolvePorrDemoSessionCookieName(runtimeConfig.appEnv))?.value
  const session = isPorrDemoRuntimeReady(runtimeConfig) && runtimeConfig.sessionSecret
    ? await verifyPorrDemoSessionToken(runtimeConfig.sessionSecret, token)
    : null

  if (!session) {
    redirect(`/${locale}?next=/${locale}/benchmark-finder`)
  }

  return (
    <PorrDemoShell locale={locale} activeRoute="benchmark-finder">
      <BenchmarkFinderClient locale={locale} showPorrDemoPortfolio />
    </PorrDemoShell>
  )
}
