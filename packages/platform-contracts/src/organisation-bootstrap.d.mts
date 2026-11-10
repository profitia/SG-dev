import type {Application,OperationContext} from './operation-context.mjs'
import type {ClerkIdentityClient,IdentityApplication} from './identity-provider.mjs'
import type {AccessStoreBinding,AccessQuery} from './access-store.mjs'
import type {CompanyRecord} from './organisation-profile.mjs'
export const ORGANISATION_BOOTSTRAP_CONTRACT:Readonly<{id:'profitia.organisation-bootstrap';version:'1.0.0'}>
export const organisationBootstrapSchemaUrl:string
export function organisationBootstrapSchemaDigest():string
export type OrganisationCreationReceipt=Readonly<{status:'CREATED';organisationId:string;slug:string;activation:'PENDING_PACKAGE';commandId:string}>|Readonly<{status:'INCOMPLETE_DRAFT'|'COMPANY_LOOKUP_REQUIRED'|'ORGANISATION_ALREADY_EXISTS'|'SLUG_UNAVAILABLE'}>
export interface StoredCompanyRecord{company:CompanyRecord;sourceRef:string;version:string}
export function createOrganisationBootstrapBackend<Transaction extends object>(options:{
 client:ClerkIdentityClient;identityApplication:IdentityApplication;application:Application;binding:AccessStoreBinding
 schemaDigest:string;proofKey:Uint8Array;now?:()=>number;independentQuery:AccessQuery
 transact<T>(run:(session:{query:AccessQuery;transaction:Transaction})=>Promise<T>,limits:{timeoutMs:number;maxWaitMs:number}):Promise<T>
 /** Governed stored registry/cache read only. No paid fallback in this operation. */
 readVerifiedCompany(input:Readonly<{nip:string;context:Readonly<OperationContext>}>):Promise<StoredCompanyRecord|null>
}):Readonly<{contract:typeof ORGANISATION_BOOTSTRAP_CONTRACT;ready():Promise<unknown>;completeCurrentOrganisation(request:Request,input:Readonly<{commandId:string;draftVersion:string}>):Promise<OrganisationCreationReceipt>}>
