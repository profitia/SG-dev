import { useTranslations } from 'next-intl'
import Link from 'next/link'

export default function HomePage() {
  const t = useTranslations('HomePage')

  const env = process.env.APP_ENV ?? 'development'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

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
