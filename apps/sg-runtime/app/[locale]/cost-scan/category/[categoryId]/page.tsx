import { CategoryCostScanClient } from '@/components/cost-scan/category-cost-scan-client'

type CategoryCostScanPageProps = {
  params: {
    locale: string
    categoryId: string
  }
}

export default function CategoryCostScanPage({ params }: CategoryCostScanPageProps) {
  const locale = params.locale === 'en' ? 'en' : 'pl'

  return <CategoryCostScanClient locale={locale} categoryId={params.categoryId} />
}