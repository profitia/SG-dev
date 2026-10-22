import type { ClerkIdentityClient, IdentityApplication } from './identity-provider.mjs'
import type { AccessStoreBinding, AccessQuery } from './access-store.mjs'
import type { PrivateTransactionOptions } from './private-operation-host.mjs'
export declare const IDENTITY_PROVISIONING_CONTRACT: Readonly<{ id: 'profitia.identity-provisioning'; version: '1.0.0' }>
export interface IdentityProvisioningOptions<Transaction> {
  client: ClerkIdentityClient; identityApplication: IdentityApplication; binding: AccessStoreBinding
  schemaDigest: string
  /** Explicit opt-in to separately installed renewal; absent preserves B1. */
  renewalSchemaDigest?: string
  /** Separate server-held database attestation key, never a browser credential. */
  proofKey: Uint8Array
  now?: () => number
  /** One bounded real SQL transaction, rollback on ANY callback/commit error. */
  transact<T>(action: (session: { query: AccessQuery; transaction: Transaction }) => Promise<T>, limits: PrivateTransactionOptions): Promise<T>
}
export declare function createIdentityProvisioner<Transaction>(options: IdentityProvisioningOptions<Transaction>): Readonly<{
  contract: typeof IDENTITY_PROVISIONING_CONTRACT
  ensureAccount(request: Request): Promise<Readonly<{ userId: string }>>
}>
