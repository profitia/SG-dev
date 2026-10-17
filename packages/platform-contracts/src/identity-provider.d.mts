import type { Actor, Environment } from './operation-context.mjs'
export interface ExternalIdentityKey { environment: Environment; issuer: string; subject: string }
export interface IdentityBinding extends ExternalIdentityKey {
  userId: string; status: 'ACTIVE' | 'DISABLED' | 'REVOKED'; version: string; sourceRef: string; expiresAt: string
}
export interface IdentityApplication {
  appId: string; environment: Environment; issuer: string; authorizedParties: string[]
}
/** Structural projection of the official SDK. This is not an alternate verifier. */
export interface ClerkIdentityClient {
  authenticateRequest(request: Request, options: { acceptsToken: 'session_token'; authorizedParties: string[]; clockSkewInMs: number }): Promise<{
    /** The SDK also returns signed-out/machine objects; the adapter validates the human shape at runtime. */
    status: string; isAuthenticated: boolean; toAuth(): unknown
  }>
  sessions: { getSession(id: string): Promise<{ id: string; userId: string; status: string; expireAt: number; abandonAt: number; actor: unknown }> }
  users: { getUser(id: string): Promise<{ id: string; banned: boolean; locked: boolean; deprovisioned: boolean }> }
}
export declare const IDENTITY_ADAPTER_CONTRACT: Readonly<{ id: 'profitia.identity-provider'; version: '1.0.0' }>
export declare function identitySourceDigest(): Promise<string>
export declare function createClerkIdentityAuthenticator(options: {
  client: ClerkIdentityClient; application: IdentityApplication;
  /** Current, authoritative binding only; never infer a binding from an email or HTTP claim. */
  resolveBinding(key: Readonly<ExternalIdentityKey>): Promise<IdentityBinding | null>;
  now?: () => number
}): (request: unknown) => Promise<Readonly<Actor> | null>
