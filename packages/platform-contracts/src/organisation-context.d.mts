import type {Application} from './operation-context.mjs'
import type {createPrivateOperationHost} from './private-operation-host.mjs'
export declare const ORGANISATION_CONTEXT_CONTRACT:Readonly<{id:'profitia.organisation-context';version:'1.0.0'}>
export declare const organisationContextSchemaUrl:string
export declare function organisationContextSchemaDigest():string
export interface OwnOrganisationContext{readonly userId:string;readonly organisationId:string|null;readonly expiresAt:string}
export declare function createOrganisationContextReader<T>(options:Pick<Parameters<typeof createPrivateOperationHost<T>>[0],'binding'|'independentQuery'|'transact'|'createAuthenticator'|'now'>&{
 application:Application;schemaDigest:string
}):Readonly<{contract:typeof ORGANISATION_CONTEXT_CONTRACT;ready():Promise<unknown>;read(request:Request):Promise<OwnOrganisationContext>}>
