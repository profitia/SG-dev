import { redirect } from 'next/navigation'

import { CategoryBuilderClient } from '@/components/category-builder/category-builder-client'
import { isPorrDemoProfile } from '@/lib/env'

type CategoryBuilderPageProps = {
  params: {
    locale: string
  }
}

export default function CategoryBuilderPage({ params }: CategoryBuilderPageProps) {
  const locale = params.locale === 'en' ? 'en' : 'pl'

  if (isPorrDemoProfile) {
    redirect(`/${locale}/benchmark-finder`)
  }

  return <CategoryBuilderClient locale={locale} />
}