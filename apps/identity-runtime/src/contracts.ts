import type { Actor } from '@profitia/platform-contracts/operation-context'
import type { ClerkIdentityClient, ExternalIdentityKey, IdentityBinding } from '@profitia/platform-contracts/identity-provider'
export type HumanActor = Readonly<Actor & { kind: 'HUMAN'; userId: string }>
export type RuntimeSdk = ClerkIdentityClient & { sessions: ClerkIdentityClient['sessions'] & { revokeSession(id: string): Promise<unknown> } }
export interface Target { readonly applicationId: string; readonly origin: string; readonly routes: Readonly<Record<string, string>> }
export interface RuntimeConfiguration {
  readonly applicationId: string; readonly environment: 'development'; readonly origin: string; readonly issuer: string
  readonly publishableKey: string; readonly targets: Readonly<Record<string, Target>>
  readonly stateTtlMs: number; readonly maxPendingFlows: number
}
export type FlowKind = 'registration' | 'login' | 'recovery'
/** Navigation intent only. Neither state nor arrival conveys authentication or product authority. */
export interface FlowRecord {
  readonly flowId: string; readonly kind: FlowKind; readonly targetId: string; readonly routeKey: string
  readonly receivingOrigin: string; readonly environment: 'development'; readonly userId: string
  readonly proofRef: string; readonly targetOrigin: string; readonly returnTo: string; readonly expiresAt: number
}
export interface FlowStore {
  readonly mode: 'single-process'; issue(record: FlowRecord): string; take(state: string): FlowRecord | null
  denySession(key: string, expiresAt: number): void; sessionDenied(key: string): boolean; clearPrincipal(userId: string): void
}
export interface IdentityAuthority {
  resolveBinding(key: Readonly<ExternalIdentityKey>): Promise<IdentityBinding | null>
  ready(): Promise<boolean>
}
export type SessionDecision = Readonly<{ status: 'authenticated'; actor: HumanActor }> | Readonly<{ status: 'unauthenticated' | 'unavailable' }>
export interface SessionBoundary {
  readonly configuration: RuntimeConfiguration; ready(): Promise<boolean>; session(request: Request): Promise<SessionDecision>
  beginFlow(request: Request, input: unknown): Promise<{ state: string; expiresAt: string }>
  consumeFlow(request: Request, input: unknown): Promise<string>; logout(request: Request): Promise<void>
}
export class BoundaryError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 409 | 429 | 503, readonly code: string) { super(code); this.name = 'BoundaryError' }
}
