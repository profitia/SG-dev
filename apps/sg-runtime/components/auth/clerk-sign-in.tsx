'use client'

import React from 'react'
import { SignIn } from '@clerk/react'

/** Only public configuration and a server-validated local return path enter UI. */
export function ClerkSignIn({ returnPath }: {
  returnPath: string
}) {
  return <SignIn routing="hash" withSignUp={false} forceRedirectUrl={returnPath} />
}
