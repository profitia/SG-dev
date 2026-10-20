export interface PublicIdentityRequestBoundary {
  publicOrigins: string[];
  internalOrigins: string[];
}
/** Optional explicit server-owned proxy binding; direct hosts need no adapter. */
export interface PublicIdentityApplication extends IdentityApplication {
  requestBoundary?: PublicIdentityRequestBoundary;
}
/** Header-only identity request; never consumes/replaces a business body or grants access. */
export declare function createPublicIdentityRequestBoundary(input: PublicIdentityRequestBoundary): (request: unknown) => Request | null;
export declare function publicIdentityRequestSourceDigest(): Promise<string>;
import type { Actor } from './operation-context.mjs';
import type { IdentityApplication } from './identity-provider.mjs';
export declare function bindPublicIdentityAuthenticator(authenticate: (request: unknown) => Promise<Readonly<Actor> | null>, input: PublicIdentityRequestBoundary): (request: unknown) => Promise<Readonly<Actor> | null>;
