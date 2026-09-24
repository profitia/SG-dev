import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { SpendGuruAdvisoryWidget } from '@/components/advisory/spendguru-advisory-widget'
import { isPorrDemoProfile, serverEnv } from '@/lib/env'
import { getEnvironmentBrowserTabTitle } from '@/lib/browser-tab-title'

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

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
          <SpendGuruAdvisoryWidget locale={locale as Locale} enabled={!isPorrDemoProfile} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
