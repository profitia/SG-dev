import { createIdentityProvisioner } from '../../src/identity-provisioning.mjs'
import { createUserProfileBackend, normalizeProfilePatch, type UserProfilePatch, type ProfilePhoneParser } from '../../src/user-profile.mjs'
import type { IdentityProvisioningOptions } from '../../src/identity-provisioning.mjs'
import type { Application } from '../../src/operation-context.mjs'
import type { AccessQuery } from '../../src/access-store.mjs'
declare const options: IdentityProvisioningOptions<object> & {application:Application;independentQuery:AccessQuery;phoneParser:ProfilePhoneParser}
declare const request: Request
const provisioner=createIdentityProvisioner(options)
const profile=createUserProfileBackend(options)
const userId:Promise<Readonly<{userId:string}>>=provisioner.ensureAccount(request)
const patch:UserProfilePatch={avatar_sex:'female',phone:null,job:'Engineer'}
profile.updateCurrentUserProfile(request,{expectedVersion:'1',patch})
normalizeProfilePatch({avatar_sex:'male'},options.phoneParser)
// @ts-expect-error raw external identity is never an authentication proof
provisioner.ensureAccount({issuer:'https://foreign.test',subject:'spoof'})
// @ts-expect-error no caller-selected user_id
profile.updateCurrentUserProfile(request,{expectedVersion:'1',patch,user_id:'foreign'})
// @ts-expect-error versions are server-owned and not patchable
profile.updateCurrentUserProfile(request,{expectedVersion:'1',patch:{version:'2'}})
// @ts-expect-error expected version is lossless decimal text
profile.updateCurrentUserProfile(request,{expectedVersion:1,patch})
void userId
