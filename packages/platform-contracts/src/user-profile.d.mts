import type { IdentityProvisioningOptions } from './identity-provisioning.mjs'
import type { AccessQuery } from './access-store.mjs'
import type { Application } from './operation-context.mjs'
export declare const USER_PROFILE_CONTRACT: Readonly<{ id: 'profitia.user-profile'; version: '1.0.0' }>
export interface UserProfilePatch { avatar_sex?: 'male' | 'female' | null; job?: string | null; phone?: string | null; communication_language?: 'pl' | 'en'; language_source?: 'browser' | 'user' }
export interface UserProfile {
  readonly user_id: string
  /** Assistant avatar preference, never the person's sex. */
  readonly avatar_sex: 'male' | 'female' | null
  /** Present after additive language migration; never inferred country. */
  readonly communication_language?: 'pl' | 'en'
  readonly language_source?: 'migration' | 'browser' | 'user' | 'default'
  readonly job: string | null
  /** E.164 contact only, no verification/authentication claim. */
  readonly phone: string | null
  /** Positive bigint encoded as decimal text without JS precision loss. */
  readonly version: string
  readonly created_at: string; readonly updated_at: string
}
export declare class ProfileConflict extends Error { readonly code: 'PROFILE_VERSION_CONFLICT' }
export declare const profileSchemaUrl: string
export declare function profileSchemaDigest(): string
export type ProfilePhoneParser = (input: string, options: { extract: false }) => { number: string; ext?: string; isValid(): boolean }
export declare function normalizeProfilePatch(value: unknown, phoneParser: ProfilePhoneParser): Readonly<UserProfilePatch>
export declare function createUserProfileBackend<Transaction>(options: IdentityProvisioningOptions<Transaction> & {
  application: Application; independentQuery: AccessQuery; phoneParser: ProfilePhoneParser
}): Readonly<{
  contract: typeof USER_PROFILE_CONTRACT
  getCurrentUserProfile(request: Request): Promise<UserProfile | null>
  ensureInitialUserProfile(request: Request): Promise<UserProfile>
  updateCurrentUserProfile(request: Request, input: { expectedVersion: string; patch: UserProfilePatch }): Promise<UserProfile>
}>
export interface AssistantAvatarPreference {
  readonly userId: string
  readonly avatarSex: 'male' | 'female' | null
  readonly version: string
}
export declare function createAssistantAvatarBackend<Transaction>(options: IdentityProvisioningOptions<Transaction> & {
  application: Application; independentQuery: AccessQuery
}): Readonly<{
  getAssistantAvatar(request: Request): Promise<AssistantAvatarPreference | null>
  ensureAssistantAvatar(request: Request): Promise<AssistantAvatarPreference>
  updateAssistantAvatar(request: Request, input: { expectedVersion: string; avatarSex: 'male' | 'female' }): Promise<AssistantAvatarPreference>
}>
