import type {Actor,OperationExecutor} from './operation-context.mjs'
import type {IdentityBinding} from './identity-provider.mjs'
import type {ClerkIdentityClient} from './identity-provider.mjs'
import type {PublicIdentityApplication} from './public-request.mjs'
import type {createPrivateOperationHost} from './private-operation-host.mjs'

export declare const CURRENT_HUMAN_READ_CONTRACT:Readonly<{id:'profitia.current-human-read';version:'1.0.0'}>
export declare function createCurrentHumanReadIdentity(options:{
 client:ClerkIdentityClient;application:PublicIdentityApplication;now?:()=>number
 resolveBinding(key:Readonly<Pick<IdentityBinding,'environment'|'issuer'|'subject'>>):Promise<IdentityBinding|null>
}):Readonly<{
 authenticate(request:unknown):Promise<Readonly<Actor>|null>
 revalidate(request:unknown,actor:Readonly<Actor>):Promise<Readonly<Actor>|null>
 close():void
}>
export declare function createCurrentHumanReadHost<Transaction>(options:
 Omit<Parameters<typeof createPrivateOperationHost<Transaction>>[0],'createAuthenticator'|'requestLedger'|'requestContinuation'|'locationAdmission'|'reportAdmission'|'prepareInputs'>
 &{clerk:ClerkIdentityClient;identity:PublicIdentityApplication}
):Readonly<OperationExecutor<Transaction>&{hostContract:typeof CURRENT_HUMAN_READ_CONTRACT}>
export declare function currentHumanReadSourceDigest():Promise<string>
