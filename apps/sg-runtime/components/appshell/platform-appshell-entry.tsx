'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/react'
import { AccountLanding } from '@/components/auth/account-landing'
import { SelfServiceAuthentication } from '@/components/auth/clerk-sign-up'

export function PlatformAppShellEntry({ locale, completionUrl, organisationBranding }: {
  locale: 'pl' | 'en'; completionUrl: string; organisationBranding?: 'porr' | null
}) {
  const { isLoaded, isSignedIn } = useAuth(), [openingLogin, setOpeningLogin] = useState(false), en = locale === 'en'
  if (!isLoaded) return <main className="p-8"><p role="status">{en ? 'Checking your session…' : 'Sprawdzamy Twoją sesję…'}</p></main>
  if (isSignedIn) return <AccountLanding locale={locale} completionUrl={completionUrl} presentation="workspace" organisationBranding={organisationBranding} />
  return <main className="min-h-screen bg-slate-50 px-6 py-16"><section className="mx-auto max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
    <p className="font-semibold">SpendGuru</p><h1 className="text-3xl font-semibold">{en ? 'Welcome back' : 'Dobrze Cię widzieć'}</h1>
    {openingLogin ? <SelfServiceAuthentication locale={locale} mode="login" completionUrl={completionUrl} />
      : <button type="button" onClick={() => setOpeningLogin(true)} className="rounded-lg bg-sky-800 px-5 py-3 text-white">{en ? 'Sign in' : 'Zaloguj się'}</button>}
    <p><Link href={`/${locale}/register`} className="text-sm underline">{en ? 'Create your account' : 'Utwórz konto'}</Link></p>
  </section></main>
}
