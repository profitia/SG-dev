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

type BenchmarkFinderPageProps = {
  params: {
    locale: string
  }
}

export default async function BenchmarkFinderPage({ params }: BenchmarkFinderPageProps) {
  const locale = params.locale === 'en' ? 'en' : 'pl'

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
