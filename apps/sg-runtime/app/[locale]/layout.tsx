import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { SpendGuruAdvisoryWidget } from '@/components/advisory/spendguru-advisory-widget'
import { isPorrDemoProfile, serverEnv } from '@/lib/env'
import { getEnvironmentBrowserTabTitle } from '@/lib/browser-tab-title'
import { readSg2IdentityRuntime, type Sg2IdentityRuntime } from '@/lib/platform/identity-runtime'
import { Sg2IdentityProvider } from '@/components/auth/session-boundary'
import { readSelfServiceAccountConfiguration, accountCompletionUrl } from '@/lib/platform/account-session'

export const dynamic = 'force-dynamic'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: { locale: string }
}

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  return {
    title: getEnvironmentBrowserTabTitle(t('title'), serverEnv.APP_ENV),
    description: t('description'),
  }
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({ children, params: { locale } }: LocaleLayoutProps) {
  // Validate the locale; if invalid, render the nearest not-found boundary.
  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }

  // Load messages on the server — passed to NextIntlClientProvider for client components.
  const messages = await getMessages()
  let identity: Sg2IdentityRuntime | null = null
  try { identity = readSg2IdentityRuntime() } catch { /* Explicit failure never renders demo. */ }
  let satellite: { domain: string; signInUrl: string; signUpUrl: string } | undefined
  try {
    const account = readSelfServiceAccountConfiguration()
    if (account) satellite = { domain: new URL(account.publicOrigin).host,
      signInUrl: accountCompletionUrl(account, locale as Locale, 'login'), signUpUrl: accountCompletionUrl(account, locale as Locale, 'registration') }
  } catch { identity = null }

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Sg2IdentityProvider mode={identity?.provider ?? 'unavailable'} locale={locale as Locale}
            satellite={satellite}
            publishableKey={identity?.provider === 'clerk' ? identity.publishableKey : undefined}>
            {children}
            <SpendGuruAdvisoryWidget locale={locale as Locale} enabled={identity?.provider === 'legacy_demo' && !isPorrDemoProfile} />
          </Sg2IdentityProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
