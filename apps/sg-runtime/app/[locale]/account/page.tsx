import { readSelfServiceAccountConfiguration, accountCompletionUrl } from '@/lib/platform/account-session'
import { AccountLanding } from '@/components/auth/account-landing'
export const dynamic = 'force-dynamic'
export default function Account({ params }: { params: { locale: string } }) {
  const locale = params.locale === 'en' ? 'en' : 'pl'
  let config: ReturnType<typeof readSelfServiceAccountConfiguration> = null
  try { config = readSelfServiceAccountConfiguration() } catch { /* No false authenticated state. */ }
  return <main className="min-h-screen bg-slate-50 px-6 py-16"><section className="mx-auto max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
    <p className="font-semibold">SpendGuru</p>{config ? <AccountLanding locale={locale} completionUrl={accountCompletionUrl(config, locale, 'login')} />
      : <p role="alert">{locale === 'en' ? 'Your account is temporarily unavailable.' : 'Konto jest chwilowo niedostępne.'}</p>}
  </section></main>
}
