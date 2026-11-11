import { readSelfServiceAccountConfiguration } from '@/lib/platform/account-session'
import { redirect } from 'next/navigation'
import { dashboardPath } from '@/lib/appshell/adp-navigation'
export const dynamic = 'force-dynamic'
export default function Account({ params }: { params: { locale: string } }) {
  const locale = params.locale === 'en' ? 'en' : 'pl'
  let config: ReturnType<typeof readSelfServiceAccountConfiguration> = null
  try { config = readSelfServiceAccountConfiguration() } catch { /* No false authenticated state. */ }
  // The persistent dashboard guard performs the current account check once.
  // This entry route owns no second session check or intermediate client view.
  if (config) redirect(dashboardPath(locale))
  return <main className="min-h-screen bg-slate-50 px-6 py-16"><section className="mx-auto max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
    <p className="font-semibold">SpendGuru</p><p role="alert">{locale === 'en' ? 'Your account is temporarily unavailable.' : 'Konto jest chwilowo niedostępne.'}</p>
  </section></main>
}
