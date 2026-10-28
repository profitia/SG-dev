'use client'

import React, { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react'
import { ClerkProvider, ClerkFailed, SignOutButton, useAuth } from '@clerk/react'
import { enUS, plPL } from '@clerk/localizations'
import type { BrowserPersistencePolicy } from '@/lib/platform/browser-session-storage'

const CredentialGetter=createContext<(()=>Promise<string|null>)|null>(null)
export function useSg2SessionCredential(){return useContext(CredentialGetter)}

const ProviderMode = createContext<'legacy_demo' | 'clerk' | null>(null)
const unavailable = <p role="alert">Logowanie jest chwilowo niedostępne. / Sign-in is temporarily unavailable.</p>

export function useSg2IdentityMode(): 'legacy_demo' | 'clerk' | 'unavailable' {
  return useContext(ProviderMode) ?? 'unavailable'
}

/** Only public, server-selected presentation configuration. No browser state
 * is an internal tenant/user identity or a permission to a backend operation. */
export function Sg2IdentityProvider({ mode, publishableKey, locale, children, satellite }: {
  mode: 'legacy_demo' | 'clerk' | 'unavailable'; publishableKey?: string; locale: 'pl' | 'en'; children: ReactNode
  satellite?: { domain: string; signInUrl: string; signUpUrl: string }
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (mode === 'legacy_demo') return <ProviderMode.Provider value="legacy_demo">{children}</ProviderMode.Provider>
  if (mode !== 'clerk' || !publishableKey) return unavailable
  // Generic React satellite integration is client-only: no Clerk SSR/hydration.
  if (satellite && !mounted) return <p role="status">{locale === 'en' ? 'Checking your session…' : 'Sprawdzamy Twoją sesję…'}</p>
  return <ProviderMode.Provider value="clerk">
    <ClerkProvider publishableKey={publishableKey} localization={locale === 'en' ? enUS : plPL}
      telemetry={{ disabled: true }} afterSignOutUrl={`/${locale}`}
      {...(satellite ? { isSatellite: true, domain: satellite.domain, satelliteAutoSync: true, signInUrl: satellite.signInUrl, signUpUrl: satellite.signUpUrl }
        : { signInUrl: `/${locale}` })}>
      {children}<ClerkFailed>{unavailable}</ClerkFailed>
    </ClerkProvider>
  </ProviderMode.Provider>
}

export type Sg2SessionPresentation = { status: 'loading' | 'signed-out' } | { status: 'signed-in'; userId: string; sessionId: string; organisationId?: string | null }
export function Sg2SessionContent({ session, locale, children }: { session: Sg2SessionPresentation; locale: 'pl' | 'en'; children: ReactNode }) {
  if (session.status === 'loading') return <p role="status">{locale === 'en' ? 'Checking session…' : 'Sprawdzanie sesji…'}</p>
  if (session.status !== 'signed-in' || !session.userId || !session.sessionId) return <p role="status"><a href={`/${locale}`}>{locale === 'en' ? 'Sign in to open the application.' : 'Zaloguj się, aby otworzyć aplikację.'}</a></p>
  // Replaces the entire Finder subtree, its request controllers and caches.
  return <Fragment key={JSON.stringify([session.userId, session.sessionId, session.organisationId ?? null])}>{children}</Fragment>
}
function ClerkSessionContent({ locale, children }: { locale: 'pl' | 'en'; children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, sessionId, orgId, getToken } = useAuth()
  const session: Sg2SessionPresentation = !isLoaded ? { status: 'loading' }
    : isSignedIn && userId && sessionId ? { status: 'signed-in', userId, sessionId, organisationId: orgId ?? null } : { status: 'signed-out' }
  return <Sg2SessionContent session={session} locale={locale}>
    <div className="flex justify-end px-6 pt-4"><SignOutButton redirectUrl={`/${locale}`}>
      <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800">{locale === 'en' ? 'Sign out' : 'Wyloguj się'}</button>
    </SignOutButton></div>
    <CredentialGetter.Provider value={getToken}>{children}</CredentialGetter.Provider>
  </Sg2SessionContent>
}
export function Sg2AuthenticatedView({ locale, children }: { locale: 'pl' | 'en'; children: ReactNode }) {
  const mode = useContext(ProviderMode)
  if (mode === 'legacy_demo') return children
  return mode === 'clerk' ? <ClerkSessionContent locale={locale}>{children}</ClerkSessionContent> : unavailable
}
/** Without a backend-authoritative organisation/user cache scope, individual
 * sessions use memory only. Old demo history is neither read nor adopted. */
export function useSg2BrowserPersistencePolicy(): BrowserPersistencePolicy {
  return useContext(ProviderMode) === 'legacy_demo' ? 'legacy' : 'volatile'
}

/** A module consumes the existing SDK session; it never starts a second login.
 * SDK organisation IDs invalidate browser memory only, never authorise APIs. */
export function Sg2ModuleSession({locale,children}:{locale:'pl'|'en';children:ReactNode}) {
  const {isLoaded,isSignedIn,userId,sessionId,orgId,getToken}=useAuth()
  const session:Sg2SessionPresentation=!isLoaded?{status:'loading'}:isSignedIn&&userId&&sessionId
    ?{status:'signed-in',userId,sessionId,organisationId:orgId??null}:{status:'signed-out'}
  return <Sg2SessionContent session={session} locale={locale}><CredentialGetter.Provider value={getToken}>{children}</CredentialGetter.Provider></Sg2SessionContent>
}
