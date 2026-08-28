import { redirect } from 'next/navigation'

type CostScanLandingPageProps = {
  params: {
    locale: string
  }
}

export default function CostScanLandingPage({ params }: CostScanLandingPageProps) {
  const locale = params.locale === 'en' ? 'en' : 'pl'

  redirect(`/${locale}/category-builder`)
}