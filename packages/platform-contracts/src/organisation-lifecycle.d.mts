import type {AccessQuery,AccessStoreBinding} from './access-store.mjs'
import type {Application,Actor,OperationContext,OrganisationLifecycleOperation,ProductGrant} from './operation-context.mjs'
import type {ClerkIdentityClient,IdentityApplication,ExternalIdentityKey} from './identity-provider.mjs'
export declare const ORGANISATION_LIFECYCLE_CONTRACT:Readonly<{id:'profitia.organisation-lifecycle';version:'1.0.0'}>
export declare const organisationLifecycleSchemaUrl:string
export declare function organisationLifecycleSchemaDigest():string
export declare function normalizeOrganisationLifecycleInput(operation:OrganisationLifecycleOperation,input:unknown):Readonly<Record<string,unknown>>
export declare function organisationEmailKey(email:string,key:Uint8Array):string
export interface OrganisationInvitationEnvelope{keyId:string;iv:string;tag:string;ciphertext:string}
export interface OrganisationInvitationEncryption{key:Uint8Array;keyId:string;invitationId:string}
export declare function sealOrganisationInvitation(payload:unknown,options:OrganisationInvitationEncryption):Readonly<OrganisationInvitationEnvelope>
export declare function openOrganisationInvitation(envelope:OrganisationInvitationEnvelope,options:OrganisationInvitationEncryption):unknown
export interface OrganisationLifecycleUnit{context:Readonly<OperationContext>;query:AccessQuery;profile:Readonly<Record<string,any>>;actor:Readonly<Actor>;identityKey:Readonly<ExternalIdentityKey>;input:Readonly<Record<string,any>>;products:readonly ProductGrant[]}
export declare function createOrganisationLifecycleBackend<T>(options:{
 client:ClerkIdentityClient;binding:AccessStoreBinding;application:Application;identityApplication:IdentityApplication
 independentQuery:AccessQuery;schemaDigest:string;proofKey:Uint8Array;now?:()=>number
 transact<R>(run:(session:{query:AccessQuery;transaction:T})=>Promise<R>,limits:{timeoutMs:number;maxWaitMs:number}):Promise<R>
}):Readonly<{contract:typeof ORGANISATION_LIFECYCLE_CONTRACT;ready():Promise<unknown>;execute<R>(request:Request,operation:OrganisationLifecycleOperation,input:unknown,effect:(unit:OrganisationLifecycleUnit)=>Promise<R>):Promise<R>}>
