"use client";

import { createContext, Fragment, useContext, type ReactNode } from "react";
import { ClerkProvider, ClerkFailed, SignOutButton, useAuth } from "@clerk/react";
import { plPL } from "@clerk/localizations";

const ProviderMode = createContext<"legacy_demo" | "clerk" | null>(null);
const unavailable = <p role="alert">Logowanie jest chwilowo niedostępne.</p>;

/** Public presentation configuration only. Provider state is never membership,
 * tenant identity, a permission or an authorisation receipt for a data API. */
export function SrmIdentityProvider({ mode, publishableKey, children }: {
  mode: "legacy_demo" | "clerk" | "unavailable"; publishableKey?: string; children: ReactNode;
}) {
  if (mode === "legacy_demo") return <ProviderMode.Provider value="legacy_demo">{children}</ProviderMode.Provider>;
  if (mode !== "clerk" || !publishableKey) return unavailable;
  return <ProviderMode.Provider value="clerk">
    <ClerkProvider publishableKey={publishableKey} localization={plPL} telemetry={{ disabled: true }} signInUrl="/login" afterSignOutUrl="/login">
      {children}
      <ClerkFailed>{unavailable}</ClerkFailed>
    </ClerkProvider>
  </ProviderMode.Provider>;
}

export type SessionPresentation = { status: "loading" | "signed-out" } | { status: "signed-in"; userId: string; sessionId: string };
/** Presentation/reset boundary; it neither verifies tokens nor grants API access. */
export function SrmSessionContent({ session, children }: { session: SessionPresentation; children: ReactNode }) {
  if (session.status === "loading") return <p role="status">Sprawdzanie sesji…</p>;
  if (session.status !== "signed-in" || !session.userId || !session.sessionId) return <p role="status"><a href="/login">Zaloguj się, aby otworzyć aplikację.</a></p>;
  // A principal/session change replaces the complete report subtree. The
  // existing useSupplierReport cleanup disposes its controller and requests.
  return <Fragment key={JSON.stringify([session.userId, session.sessionId])}>{children}</Fragment>;
}
function ClerkSessionContent({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const session: SessionPresentation = !isLoaded ? { status: "loading" }
    : isSignedIn && userId && sessionId ? { status: "signed-in", userId, sessionId } : { status: "signed-out" };
  return <SrmSessionContent session={session}>{children}</SrmSessionContent>;
}
export function SrmAuthenticatedView({ children }: { children: ReactNode }) {
  const mode = useContext(ProviderMode);
  if (mode === "legacy_demo") return children;
  return mode === "clerk" ? <ClerkSessionContent>{children}</ClerkSessionContent> : unavailable;
}
/** Keep legacy header visibility; named sessions can also sign out before search. */
export function SrmSessionActions({ legacyVisible, children }: { legacyVisible: boolean; children: ReactNode }) {
  const mode = useContext(ProviderMode);
  return mode === "clerk" || (mode === "legacy_demo" && legacyVisible) ? children : null;
}
export function SrmLogout({ children, legacyVisible = true }: { children: ReactNode; legacyVisible?: boolean }) {
  const mode = useContext(ProviderMode);
  if (mode === "legacy_demo") return legacyVisible ? <form action="/api/auth/logout" method="post">{children}</form> : null;
  return mode === "clerk" ? <SignOutButton redirectUrl="/login">{children}</SignOutButton> : unavailable;
}
