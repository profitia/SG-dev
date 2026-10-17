import { Sg2AuthenticatedView } from '@/components/auth/session-boundary'
import { SupplierSummaryClient } from '@/components/supplier-intelligence/supplier-summary-client'
import { PorrDemoShell } from '@/components/porr-demo/porr-demo-shell'
import { readSg2IdentityRuntime } from '@/lib/platform/identity-runtime'

export default async function SupplierIntelligencePage({ params }: { params: { locale: string } }) {
  const locale = params.locale === 'en' ? 'en' : 'pl'
  try {
    if (readSg2IdentityRuntime().provider !== 'clerk' || process.env.PROFITIA_SUPPLIER_SUMMARY_ENABLED !== 'true') {
      return <p role="status">{locale === 'en' ? 'This feature is unavailable.' : 'Ta funkcjonalność jest niedostępna.'}</p>
    }
  } catch { return <p role="alert">{locale === 'en' ? 'Sign-in is temporarily unavailable.' : 'Logowanie jest chwilowo niedostępne.'}</p> }
  return <Sg2AuthenticatedView locale={locale}><PorrDemoShell locale={locale} activeRoute="benchmark-finder">
    <SupplierSummaryClient locale={locale} />
  </PorrDemoShell></Sg2AuthenticatedView>
}
