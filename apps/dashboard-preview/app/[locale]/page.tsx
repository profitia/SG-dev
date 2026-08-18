import { DashboardShell } from '@/components/dashboard-shell'
import { RawDataView } from '@/components/raw-data-view'

type LocaleHomePageProps = {
  searchParams?: {
    embed?: string
  }
}

export default function LocaleHomePage({ searchParams }: LocaleHomePageProps) {
  const embedded = searchParams?.embed === '1'

  return (
    <DashboardShell embedded={embedded}>
      <RawDataView embedded={embedded} />
    </DashboardShell>
  )
}
