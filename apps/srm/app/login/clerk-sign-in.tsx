"use client";

import { ClerkProvider, SignIn } from "@clerk/react";
import { plPL } from "@clerk/localizations";

/** The official provider owns OTP, Device Trust and session handling. */
export function ClerkSignIn({ publishableKey }: { publishableKey: string }) {
  return <ClerkProvider publishableKey={publishableKey} localization={plPL} telemetry={{ disabled: true }} signInUrl="/login" afterSignOutUrl="/login">
    <SignIn routing="hash" withSignUp={false} forceRedirectUrl="/xray" />
  </ClerkProvider>;
}
