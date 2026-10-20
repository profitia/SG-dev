import { redirect } from 'next/navigation'

import { CategoryBuilderClient } from '@/components/category-builder/category-builder-client'
import { isPorrDemoProfile } from '@/lib/env'
import { readSg2IdentityRuntime } from '@/lib/platform/identity-runtime'
import { Sg2AuthenticatedView } from '@/components/auth/session-boundary'

type CategoryBuilderPageProps = {
  params: {
    locale: string
  }
}

export default function CategoryBuilderPage({ params }: CategoryBuilderPageProps) {
  const locale = params.locale === 'en' ? 'en' : 'pl'
  let identity
  try { identity = readSg2IdentityRuntime() }
  catch { return <p role="alert">{locale === 'en' ? 'Sign-in is temporarily unavailable.' : 'Logowanie jest chwilowo niedostępne.'}</p> }
  if (identity.provider === 'clerk') {
    // Neutral UI only. Every category/selection API independently checks the
    // current server session and private organisation authority. Session changes
    // replace the complete in-memory draft and pending component state.
    return <Sg2AuthenticatedView locale={locale}><CategoryBuilderClient locale={locale} /></Sg2AuthenticatedView>
  }

  if (isPorrDemoProfile) {
    redirect(`/${locale}/benchmark-finder`)
  }

  return <CategoryBuilderClient locale={locale} />
}
