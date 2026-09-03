import { redirect } from 'next/navigation'

import { CategoryCostScanClient } from '@/components/cost-scan/category-cost-scan-client'
import { isPorrDemoProfile } from '@/lib/env'

type CategoryCostScanPageProps = {
  params: {
    locale: string
    categoryId: string
  }
}

export default function CategoryCostScanPage({ params }: CategoryCostScanPageProps) {
  const locale = params.locale === 'en' ? 'en' : 'pl'

  if (isPorrDemoProfile) {
    redirect(`/${locale}/benchmark-finder`)
  }

  return <CategoryCostScanClient locale={locale} categoryId={params.categoryId} />
}