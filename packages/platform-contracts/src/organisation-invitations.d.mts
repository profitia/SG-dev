export const ORGANISATION_INVITATION_PROOF_CONTRACT:Readonly<{id:'profitia.organisation-invitation-proof';version:'1.0.0'}>
export const ORGANISATION_INVITATION_LIFETIME_MS:number
export type OrganisationInvitationProof=Readonly<{token:string;tokenHash:string;expiresAt:string}>
/** Random 256-bit invitation proof. Never an authentication/session token. */
export function createOrganisationInvitationProof(options?:{now?:()=>number}):OrganisationInvitationProof
export function organisationInvitationTokenHash(value:unknown):string
export function organisationInvitationProofMatches(token:unknown,tokenHash:unknown):boolean
/** Receiver configuration only, independent of browser Host and tenant slug. */
export function createOrganisationInvitationLinkBuilder(options:{identityOrigin:string;allowedIdentityOrigins:readonly string[]}):Readonly<{build(token:string):string}>
