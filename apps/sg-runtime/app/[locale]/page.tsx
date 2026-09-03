import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { PorrDemoShell } from '@/components/porr-demo/porr-demo-shell'
import { isPorrDemoProfile } from '@/lib/env'
import {
  PORR_DEMO_SESSION_COOKIE_NAME,
  isPorrDemoRuntimeReady,
  resolvePorrDemoNextPath,
  resolvePorrDemoRuntimeConfig,
} from '@/lib/porr-demo-profile'
import { verifyPorrDemoSessionToken } from '@/lib/porr-demo-session'

type HomePageProps = {
  params: {
    locale: string
  }
  searchParams?: {
    next?: string
    error?: string
  }
}

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const locale = params.locale === 'en' ? 'en' : 'pl'
  const t = await getTranslations({ locale, namespace: 'HomePage' })

  const env = process.env.APP_ENV ?? 'development'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

  if (!isPorrDemoProfile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <div className="max-w-lg space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <p className="font-medium">{t('subtitle')}</p>
            <p className="mt-1 text-xs text-gray-400">{t('description')}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-right font-medium text-gray-500">{t('environmentLabel')}</dt>
            <dd className="text-left text-gray-800">{env}</dd>

            <dt className="text-right font-medium text-gray-500">{t('serviceLabel')}</dt>
            <dd className="text-left text-gray-800">sg-runtime</dd>

            <dt className="text-right font-medium text-gray-500">{t('appUrlLabel')}</dt>
            <dd className="text-left break-all text-gray-800">{appUrl}</dd>
          </dl>

          <p className="text-xs text-gray-400">
            {t('healthLabel')}{' '}
            <a href="/api/health" className="underline">
              /api/health
            </a>
          </p>

          <div className="pt-2">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/${t('localeCode')}/benchmark-finder`}
                className="inline-flex rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
              >
                {t('benchmarkFinderLabel')}
              </Link>
              <Link
                href={`/${t('localeCode')}/category-builder`}
                className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {t('categoryBuilderLabel')}
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const runtimeConfig = resolvePorrDemoRuntimeConfig()
  const runtimeReady = isPorrDemoRuntimeReady(runtimeConfig)
  const token = cookies().get(PORR_DEMO_SESSION_COOKIE_NAME)?.value
  const session = runtimeReady && runtimeConfig.sessionSecret
    ? await verifyPorrDemoSessionToken(runtimeConfig.sessionSecret, token)
    : null
  const nextPath = resolvePorrDemoNextPath(searchParams?.next, locale)

  if (session) {
    return (
      <PorrDemoShell locale={locale} activeRoute="home">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-600">
                {t('porrDemo.eyebrow')}
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                {t('porrDemo.title')}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                {t('porrDemo.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${locale}/benchmark-finder`}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {t('porrDemo.openFinder')}
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {t('porrDemo.availableNowLabel')}
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li>{t('porrDemo.availableItemOne')}</li>
              <li>{t('porrDemo.availableItemTwo')}</li>
              <li>{t('porrDemo.availableItemThree')}</li>
            </ul>
          </div>
        </section>
      </PorrDemoShell>
    )
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f2ea_0%,#fbfaf8_48%,#f4f0e8_100%)] px-6 py-10 text-slate-950 sm:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.12)] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="bg-[radial-gradient(circle_at_top_left,#fde9bf_0%,#f6f2ea_46%,#ffffff_100%)] px-8 py-10 sm:px-12 sm:py-14">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-700">
              {t('porrDemo.eyebrow')}
            </p>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              {t('porrDemo.title')}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              {t('porrDemo.subtitle')}
            </p>

            <div className="mt-10 rounded-[28px] border border-white/80 bg-white/75 p-6 shadow-[0_16px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                {t('porrDemo.availableNowLabel')}
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <li>{t('porrDemo.availableItemOne')}</li>
                <li>{t('porrDemo.availableItemTwo')}</li>
                <li>{t('porrDemo.availableItemThree')}</li>
              </ul>
            </div>
          </section>

          <section className="px-8 py-10 sm:px-12 sm:py-14">
            <div className="mx-auto max-w-md space-y-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {t('porrDemo.accessEyebrow')}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {runtimeReady ? t('porrDemo.accessTitle') : t('porrDemo.unavailableTitle')}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {runtimeReady ? t('porrDemo.accessSubtitle') : t('porrDemo.unavailableSubtitle')}
                </p>
              </div>

              {runtimeReady ? (
                <form action="/api/porr-demo-auth" method="post" className="space-y-4">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="next" value={nextPath} />

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">{t('porrDemo.passwordLabel')}</span>
                    <input
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-slate-500 focus:bg-white"
                    />
                  </label>

                  {searchParams?.error === 'invalid-password' ? (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {t('porrDemo.invalidPassword')}
                    </p>
                  ) : null}

                  {searchParams?.error === 'configuration' ? (
                    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {t('porrDemo.configurationError')}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {t('porrDemo.submitLabel')}
                  </button>
                </form>
              ) : (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {t('porrDemo.configurationError')}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
