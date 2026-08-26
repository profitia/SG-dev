import { BenchmarkFinderClient } from '@/components/benchmark-finder/benchmark-finder-client'

type BenchmarkFinderPageProps = {
  params: {
    locale: string
  }
}

export default function BenchmarkFinderPage({ params }: BenchmarkFinderPageProps) {
  const locale = params.locale === 'en' ? 'en' : 'pl'

  return <BenchmarkFinderClient locale={locale} />
}