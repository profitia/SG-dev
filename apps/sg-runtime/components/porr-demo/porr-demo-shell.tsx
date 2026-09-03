import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

type PorrDemoShellProps = {
  children: React.ReactNode
  locale: 'pl' | 'en'
  activeRoute: 'home' | 'benchmark-finder'
}

export async function PorrDemoShell({ children, locale, activeRoute }: PorrDemoShellProps) {
  const t = await getTranslations({ locale, namespace: 'HomePage.porrDemo' })

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f2ea_0%,#fbfaf8_48%,#f4f0e8_100%)] px-6 py-6 sm:px-10 sm:py-8">
      <div className="mx-auto max-w-7xl rounded-[32px] border border-slate-200 bg-white/90 shadow-[0_30px_120px_rgba(15,23,42,0.12)] backdrop-blur">
        <header className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                {t('eyebrow')}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {t('title')}
              </h1>
            </div>

            <nav className="flex flex-wrap gap-3 text-sm font-medium">
              <Link
                href={`/${locale}`}
                className={activeRoute === 'home'
                  ? 'inline-flex rounded-full bg-slate-950 px-4 py-2 text-white'
                  : 'inline-flex rounded-full border border-slate-300 px-4 py-2 text-slate-700 hover:border-slate-400'}
              >
                {locale === 'en' ? 'Overview' : 'Przegląd'}
              </Link>
              <Link
                href={`/${locale}/benchmark-finder`}
                className={activeRoute === 'benchmark-finder'
                  ? 'inline-flex rounded-full bg-slate-950 px-4 py-2 text-white'
                  : 'inline-flex rounded-full border border-slate-300 px-4 py-2 text-slate-700 hover:border-slate-400'}
              >
                {t('openFinder')}
              </Link>
            </nav>
          </div>
        </header>

        <div className="px-6 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>
    </main>
  )
}