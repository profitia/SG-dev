import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

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
      redirect(`/${locale}/benchmark-finder`)
  }

  return (
    <main className="bg-white text-slate-950">
      <div className="mx-auto w-full max-w-[1440px] px-[clamp(24px,4vw,56px)] py-8 sm:py-10 xl:flex xl:min-h-screen xl:items-center">
        <div className="grid w-full gap-10 xl:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] xl:gap-0">
            <section className="flex min-h-full flex-col xl:pr-[clamp(36px,4vw,56px)]">
              <div>
              <div className="flex items-start justify-between gap-6">
                <img
                  src="/porr-demo/spendguru-logo.png"
                  alt={t('porrDemo.spendGuruLogoAlt')}
                  className="h-auto w-[138px] sm:w-[164px]"
                />
                <img
                  src="/porr-demo/porr-logo.svg"
                  alt={t('porrDemo.porrLogoAlt')}
                  className="mt-1 h-auto w-[34px] sm:w-[40px]"
                />
              </div>

              <h1 className="mt-10 max-w-[11ch] text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-slate-950 sm:text-[3.75rem]">
                {t('porrDemo.loginTitle')}
              </h1>

              <p className="mt-8 text-[1.06rem] font-medium text-slate-950">
                {t('porrDemo.loginSubtitle')}
              </p>
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-700">
                {t('porrDemo.loginDescription')}
              </p>

              <div className="mt-8 max-w-md space-y-4 xl:max-w-none">
                {runtimeReady ? (
                  <form action="/api/porr-demo-auth" method="post" className="space-y-4">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="next" value={nextPath} />

                    <label className="block">
                      <span className="sr-only">{t('porrDemo.passwordLabel')}</span>
                      <input
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        placeholder={t('porrDemo.passwordPlaceholder')}
                        className="w-full rounded-xl border border-slate-300 bg-white px-5 py-4 text-base text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-slate-500"
                      />
                    </label>

                    {searchParams?.error === 'invalid-password' ? (
                      <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {t('porrDemo.invalidPassword')}
                      </p>
                    ) : null}

                    {searchParams?.error === 'configuration' ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {t('porrDemo.configurationError')}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-full bg-[#D12177] px-5 py-3.5 text-sm font-semibold text-white transition hover:brightness-95"
                    >
                      {t('porrDemo.submitLabel')}
                    </button>
                  </form>
                ) : (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {t('porrDemo.configurationError')}
                  </p>
                )}
              </div>
              </div>

              <p className="mt-10 max-w-md text-xs leading-5 text-slate-700 xl:mt-auto xl:pt-10">
              {t('porrDemo.loginDisclaimer')}
              </p>
            </section>

            <div className="hidden bg-[#0E4F8A] xl:block" aria-hidden="true" />

            <section className="flex min-h-full flex-col xl:pl-[clamp(36px,4vw,56px)]">
              <div className="flex min-h-full flex-col gap-9 text-sm leading-6 text-slate-950">
              <div className="space-y-1">
                <p>{t('porrDemo.versionLabel')}</p>
                <p>{t('porrDemo.publicationDateLabel')}</p>
              </div>

              <div>
                <h2 className="text-base font-semibold text-slate-950">{t('porrDemo.currentScopeTitle')}</h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-950 marker:text-slate-950">
                  <li>{t('porrDemo.currentScopeItemOne')}</li>
                  <li>{t('porrDemo.currentScopeItemTwo')}</li>
                  <li>{t('porrDemo.currentScopeItemThree')}</li>
                </ul>
              </div>

              <div>
                <h2 className="text-base font-semibold text-slate-950">{t('porrDemo.changelogTitle')}</h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-950 marker:text-slate-950">
                  <li>{t('porrDemo.changelogItemOne')}</li>
                </ul>
              </div>

              <div>
                <h2 className="text-base font-semibold text-slate-950">{t('porrDemo.plannedTopicsTitle')}</h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-950 marker:text-slate-950">
                  <li>{t('porrDemo.plannedTopicsItemOne')}</li>
                </ul>
              </div>

                <div className="mt-auto pt-8 text-sm text-slate-950">
                <p>{t('porrDemo.contactTitle')}</p>
                <p>{t('porrDemo.contactEmail')}</p>
                </div>
              </div>
            </section>
          </div>
      </div>
    </main>
  )
}
