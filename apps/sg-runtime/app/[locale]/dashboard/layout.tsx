import React, {Suspense} from 'react'
import {readSelfServiceAccountConfiguration, accountCompletionUrl} from '@/lib/platform/account-session'
import {PlatformAppShellEntry} from '@/components/appshell/platform-appshell-entry'
import {isPorrDemoProfile} from '@/lib/env'

export const dynamic = 'force-dynamic'
export default function DashboardLayout({params, children}: {params: {locale: string}; children: React.ReactNode}) {
  const locale = params.locale === 'en' ? 'en' : 'pl'
  let config: ReturnType<typeof readSelfServiceAccountConfiguration> = null
  try {config = readSelfServiceAccountConfiguration()} catch { /* No false authenticated state. */ }
  if (config) return <><Suspense fallback={<p role="status">{locale === 'en' ? 'Checking your session…' : 'Sprawdzamy Twoją sesję…'}</p>}>
    <PlatformAppShellEntry locale={locale} completionUrl={accountCompletionUrl(config, locale, 'login')}
      organisationBranding={isPorrDemoProfile ? 'porr' : null} dashboard />
  </Suspense>{children}</>
  return <main className="p-8"><p role="alert">{locale === 'en' ? 'Your account is temporarily unavailable.' : 'Konto jest chwilowo niedostępne.'}</p></main>
}
