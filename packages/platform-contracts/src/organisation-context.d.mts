import type {Application} from './operation-context.mjs'
import type {createPrivateOperationHost} from './private-operation-host.mjs'
export declare const ORGANISATION_CONTEXT_CONTRACT:Readonly<{id:'profitia.organisation-context';version:'1.0.0'}>
export declare const organisationContextSchemaUrl:string
export declare function organisationContextSchemaDigest():string
export declare const organisationSelectionSchemaUrl:string
export declare function organisationSelectionSchemaDigest():string
export interface OwnOrganisationContext{readonly userId:string;readonly organisationId:string|null;readonly expiresAt:string}
export interface OwnOrganisationChoices{
 readonly userId:string;readonly expiresAt:string
 readonly choices:readonly Readonly<{organisationId:string;slug:string|null;name:string|null}>[]
}
export declare function createOrganisationContextReader<T>(options:Pick<Parameters<typeof createPrivateOperationHost<T>>[0],'binding'|'independentQuery'|'transact'|'createAuthenticator'|'now'>&{
 application:Application;schemaDigest:string;selectionSchemaDigest?:string
}):Readonly<{contract:typeof ORGANISATION_CONTEXT_CONTRACT;ready():Promise<unknown>;read(request:Request):Promise<OwnOrganisationContext>;
 /** Requires installed SQL012 and an explicit matching selectionSchemaDigest. */
 choices(request:Request):Promise<OwnOrganisationChoices>;select(request:Request,organisationId:string):Promise<OwnOrganisationContext>;readSelected(request:Request,organisationId:string):Promise<OwnOrganisationContext>}>
