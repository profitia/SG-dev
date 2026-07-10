import { useTranslations } from 'next-intl'

import { DashboardShell } from '@/components/dashboard-shell'
import { RawDataView } from '@/components/raw-data-view'

export default function LocaleHomePage() {
  const t = useTranslations('Home')

  return (
    <DashboardShell>
      <section className="panel" style={{ marginBottom: '16px' }}>
        <h1 style={{ marginTop: 0, marginBottom: '8px', fontSize: '2rem' }}>{t('title')}</h1>
        <p className="muted" style={{ marginTop: 0 }}>{t('subtitle')}</p>
        <p>{t('status')}</p>
      </section>

      <RawDataView />
    </DashboardShell>
  )
}
