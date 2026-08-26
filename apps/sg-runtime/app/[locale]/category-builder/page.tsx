import { CategoryBuilderClient } from '@/components/category-builder/category-builder-client'

type CategoryBuilderPageProps = {
  params: {
    locale: string
  }
}

export default function CategoryBuilderPage({ params }: CategoryBuilderPageProps) {
  const locale = params.locale === 'en' ? 'en' : 'pl'

  return <CategoryBuilderClient locale={locale} />
}