'use client'
import React, { useEffect } from 'react'
import { SignIn, SignUp, useAuth } from '@clerk/react'

/** Official widgets own passwords, verification, recovery and all challenges. */
export function SelfServiceAuthentication({ locale, completionUrl, mode }: {
  locale: 'pl' | 'en'; completionUrl: string; mode: 'registration' | 'login'
}) {
  const { isLoaded, isSignedIn } = useAuth()
  useEffect(() => { if (isLoaded && isSignedIn) window.location.replace(completionUrl) }, [isLoaded, isSignedIn, completionUrl])
  if (!isLoaded || isSignedIn) return <p role="status">{locale === 'en' ? 'Checking your session…' : 'Sprawdzamy Twoją sesję…'}</p>
  return mode === 'registration'
    ? <SignUp routing="hash" signInUrl={`/${locale}`} forceRedirectUrl={completionUrl} signInForceRedirectUrl={completionUrl} />
    : <SignIn routing="hash" signUpUrl={`/${locale}/register`} forceRedirectUrl={completionUrl} signUpForceRedirectUrl={completionUrl} />
}
