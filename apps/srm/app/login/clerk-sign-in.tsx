"use client";

import { SignIn } from "@clerk/react";

/** The official provider owns OTP, Device Trust and session handling. */
export function ClerkSignIn() {
  return <SignIn routing="hash" withSignUp={false} forceRedirectUrl="/" />;
}
