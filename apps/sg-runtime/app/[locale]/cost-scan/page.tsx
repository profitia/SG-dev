import { redirect } from 'next/navigation'

import { isPorrDemoProfile } from '@/lib/env'

type CostScanLandingPageProps = {
  params: {
    locale: string
  }
}

export default function CostScanLandingPage({ params }: CostScanLandingPageProps) {
  const locale = params.locale === 'en' ? 'en' : 'pl'

  if (isPorrDemoProfile) {
    redirect(`/${locale}/benchmark-finder`)
  }

  redirect(`/${locale}/category-builder`)
}