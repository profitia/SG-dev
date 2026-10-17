'use client'

import React from 'react'
import { ClerkProvider, SignIn } from '@clerk/react'
import { enUS, plPL } from '@clerk/localizations'

/** Only public configuration and a server-validated local return path enter UI. */
export function ClerkSignIn({ publishableKey, locale, returnPath }: {
  publishableKey: string; locale: 'pl' | 'en'; returnPath: string
}) {
  return <ClerkProvider publishableKey={publishableKey} localization={locale === 'en' ? enUS : plPL}
    telemetry={{ disabled: true }} signInUrl={`/${locale}`} afterSignOutUrl={`/${locale}`}>
    <SignIn routing="hash" withSignUp={false} forceRedirectUrl={returnPath} />
  </ClerkProvider>
}
