'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useAuth, useClerk } from '@clerk/react'

/** Official widgets own passwords, verification, recovery and all challenges. */
export function SelfServiceAuthentication({ locale, completionUrl, mode }: {
  locale: 'pl' | 'en'; completionUrl: string; mode: 'registration' | 'login'
}) {
  const { isLoaded, isSignedIn } = useAuth()
  const clerk = useClerk(), started = useRef(false), [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!isLoaded || started.current) return
    started.current = true
    if (isSignedIn) { window.location.replace(completionUrl); return }
    // These SDK helpers carry the native satellite handshake. Password/code
    // components are mounted only at the configured primary Runtime origin.
    const options = { signInForceRedirectUrl: completionUrl, signUpForceRedirectUrl: completionUrl }
    void (mode === 'registration' ? clerk.redirectToSignUp(options) : clerk.redirectToSignIn(options)).catch(() => setFailed(true))
  }, [isLoaded, isSignedIn, completionUrl, clerk, mode])
  return failed ? <p role="alert">{locale === 'en' ? 'Sign-in is temporarily unavailable. Please reload.' : 'Logowanie jest chwilowo niedostępne. Odśwież stronę.'}</p>
    : <p role="status">{locale === 'en' ? 'Opening secure authentication…' : 'Otwieramy bezpieczne logowanie…'}</p>
}
