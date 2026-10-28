'use client'
import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useAuth, useClerk } from '@clerk/react'
import { useRouter } from 'next/navigation'
import { AppShellDashboard } from '@/components/appshell/appshell-dashboard'
import { dashboardPath } from '@/lib/appshell/adp-navigation'

type State = { key: string; status: 'loading' | 'ready' | 'failed' | 'expired' | 'signing-out' | 'logout-failed'; userId?: string; expiresAt?: string; assistantAvatar?: 'male' | 'female' | null; salutation?: { firstName: string | null; vocative: string | null; dictionaryVersion: string | null } | null }
export function AccountLanding({ locale, completionUrl, presentation = 'account', organisationBranding, dashboard = false }: {
  locale: 'pl' | 'en'; completionUrl: string; presentation?: 'account' | 'workspace'; organisationBranding?: 'porr' | null; dashboard?: boolean
}) {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth(), clerk = useClerk()
  const router = useRouter()
  const key = JSON.stringify([userId, sessionId]), current = useRef<AbortController | null>(null)
  const [retry, setRetry] = useState(0), [state, setState] = useState<State>({ key: '', status: 'loading' })
  const workspaceReady = presentation === 'workspace' && isLoaded && isSignedIn && !!userId && !!sessionId
    && state.key === key && state.status === 'ready' && Date.parse(state.expiresAt ?? '') > Date.now()
  useEffect(() => {
    if (workspaceReady && !dashboard) router.replace(dashboardPath(locale))
  }, [workspaceReady, dashboard, locale, router])
  useEffect(() => {
    const controller = new AbortController(); current.current?.abort(); current.current = controller
    setState(previous => presentation === 'workspace' && previous.key === key && previous.status === 'ready'
      && Date.parse(previous.expiresAt ?? '') > Date.now() ? previous : { key, status: 'loading' })
    if (isLoaded && isSignedIn && userId && sessionId) void (async () => {
      try {
        const credential = await getToken({ skipCache: presentation === 'workspace' }); if (!credential) throw Error('SESSION_REQUIRED')
        const response = await fetch('/api/account', { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${credential}` } })
        const result = await response.json()
        if (!response.ok || result.authenticated !== true || typeof result.userId !== 'string' || !(Date.parse(result.expiresAt) > Date.now())
          || ![null, 'male', 'female'].includes(result.assistantAvatar)
          || !(result.salutation === null || result.salutation && ['firstName', 'vocative'].every(field => result.salutation[field] === null || typeof result.salutation[field] === 'string'))) throw Error('ACCOUNT_UNAVAILABLE')
        if (!controller.signal.aborted) setState({ key, status: 'ready', userId: result.userId, expiresAt: result.expiresAt, assistantAvatar: result.assistantAvatar, salutation: result.salutation })
      } catch { if (!controller.signal.aborted) setState({ key, status: 'failed' }) }
    })()
    return () => controller.abort()
  }, [isLoaded, isSignedIn, userId, sessionId, getToken, key, retry, presentation])
  useEffect(() => {
    if (state.status !== 'ready' || !state.expiresAt) return
    // A workspace rechecks the existing backend account proof with a fresh SDK
    // token. No new session, organisation grant or product permission is minted.
    if (presentation === 'workspace') {
      // Leave room for the existing bounded account reads. A successful proof
      // with the same deadline must schedule another attempt, not extend access.
      const refresh = setTimeout(() => setRetry(n => n + 1), Math.min(2147483647, Math.max(1000, Date.parse(state.expiresAt) - Date.now() - 15000)))
      const expiry = setTimeout(() => setState(previous => previous.key === state.key && previous.expiresAt === state.expiresAt && previous.status === 'ready'
        ? { key: previous.key, status: 'expired' } : previous), Math.min(2147483647, Math.max(0, Date.parse(state.expiresAt) - Date.now())))
      const focus = () => setRetry(n => n + 1)
      window.addEventListener('focus', focus)
      return () => { clearTimeout(refresh); clearTimeout(expiry); window.removeEventListener('focus', focus) }
    }
    const timer = setTimeout(() => setState(previous => previous.key === state.key && previous.status === 'ready'
      ? { key: previous.key, status: 'expired' } : previous), Math.min(2147483647, Math.max(0, Date.parse(state.expiresAt) - Date.now())))
    return () => clearTimeout(timer)
  }, [state, presentation])
  async function logout() {
    current.current?.abort(); setState({ key, status: 'signing-out' })
    try { await clerk.signOut({ sessionId: sessionId ?? undefined, redirectUrl: `/${locale}` }) }
    catch { setState({ key, status: 'logout-failed' }) }
  }
  const en = locale === 'en'
  if (!isLoaded) return <p role="status">{en ? 'Checking your session…' : 'Sprawdzamy Twoją sesję…'}</p>
  if (!isSignedIn) return <p><a href={`/${locale}`} className="underline">{en ? 'Sign in' : 'Zaloguj się'}</a></p>
  const status = state.key !== key ? 'loading' : state.status === 'ready' && !(Date.parse(state.expiresAt ?? '') > Date.now()) ? 'expired' : state.status
  if (workspaceReady && !dashboard) return <p role="status">{en ? 'Opening your workspace…' : 'Otwieramy Twoje biurko…'}</p>
  if (workspaceReady && dashboard) return <AppShellDashboard key={JSON.stringify([key, state.userId])} locale={locale}
    assistantAvatar={state.assistantAvatar} salutation={locale === 'en' ? state.salutation?.firstName : state.salutation?.vocative}
    organisationBranding={organisationBranding} onLogout={() => void logout()} />
  return <section className="space-y-5" key={key}>
    {status === 'ready' ? <><h1 className="text-3xl font-semibold">{en ? 'Your account is ready' : 'Konto gotowe'}</h1>
      <p>{en ? 'You are signed in to your Profitia account.' : 'Jesteś zalogowany do swojego konta Profitia.'}</p>
      {state.assistantAvatar && <div className="flex items-center gap-3">
        <Image src={`/advisory/${state.assistantAvatar === 'female' ? 'anna' : 'adam'}-128.webp`} width={48} height={48}
          className="rounded-full" alt={en ? 'Your selected assistant avatar' : 'Wybrany awatar Twojego asystenta'} />
        <span>{en ? 'Your assistant' : 'Twój asystent'}</span>
      </div>}
      <p className="break-all text-xs text-slate-500">{en ? 'Account ID' : 'Identyfikator konta'}: {state.userId}</p>
      <p className="text-sm text-slate-600">{en ? 'Organisation setup will be available in a later step.' : 'Konfiguracja organizacji będzie dostępna w kolejnym etapie.'}</p></>
      : status === 'failed' || status === 'expired' ? <><p role="alert">{status === 'expired'
        ? (en ? 'Confirm your session again to continue.' : 'Potwierdź ponownie sesję, aby kontynuować.')
        : (en ? 'We could not confirm your account. Please try again.' : 'Nie udało się potwierdzić konta. Spróbuj ponownie.')}</p>
        <button onClick={() => setRetry(n => n + 1)} className="underline">{en ? 'Try again' : 'Spróbuj ponownie'}</button><p><a href={completionUrl} className="underline">{en ? 'Finish preparing your account' : 'Dokończ przygotowanie konta'}</a></p></>
      : status === 'logout-failed' ? <p role="alert">{en ? 'Sign-out was not confirmed. Please try again.' : 'Wylogowanie nie zostało potwierdzone. Spróbuj ponownie.'}</p>
      : <p role="status">{status === 'signing-out' ? (en ? 'Signing out…' : 'Wylogowywanie…') : (en ? 'Confirming your account…' : 'Potwierdzamy Twoje konto…')}</p>}
    <button type="button" disabled={status === 'signing-out'} onClick={() => void logout()} className="rounded-full border border-slate-300 px-5 py-3 text-sm disabled:opacity-50">{en ? 'Sign out / switch account' : 'Wyloguj się / zmień konto'}</button>
  </section>
}
