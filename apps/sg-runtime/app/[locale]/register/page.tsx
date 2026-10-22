import Link from 'next/link'
import { readSelfServiceAccountConfiguration, accountCompletionUrl } from '@/lib/platform/account-session'
import { SelfServiceAuthentication } from '@/components/auth/clerk-sign-up'
export const dynamic = 'force-dynamic'
export default function Registration({ params }: { params: { locale: string } }) {
  const locale = params.locale === 'en' ? 'en' : 'pl', en = locale === 'en'
  let config: ReturnType<typeof readSelfServiceAccountConfiguration> = null
  try { config = readSelfServiceAccountConfiguration() } catch { /* Fail closed, no demo fallback. */ }
  return <main className="min-h-screen bg-slate-50 px-6 py-16"><section className="mx-auto max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
    <p className="font-semibold">SpendGuru</p><h1 className="text-3xl font-semibold">{en ? 'Create your account' : 'Utwórz konto'}</h1>
    <p className="text-sm text-slate-600">{en ? 'Your own account. No invitation required.' : 'Twoje własne konto. Bez zaproszenia.'}</p>
    {config ? <SelfServiceAuthentication locale={locale} mode="registration" completionUrl={accountCompletionUrl(config, locale, 'registration')} /> : <p role="alert">{en ? 'Registration is temporarily unavailable.' : 'Rejestracja jest chwilowo niedostępna.'}</p>}
    <Link href={`/${locale}`} className="text-sm underline">{en ? 'Already have an account? Sign in' : 'Masz już konto? Zaloguj się'}</Link>
  </section></main>
}
