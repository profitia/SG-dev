import type {OperationInput,OperationExecutor} from './operation-context.mjs';
import type {ClerkIdentityClient} from './identity-provider.mjs';
import type {PublicIdentityApplication} from './public-request.mjs';
import type {SupplierWorkspaceOperationHostOptions} from './private-operation-host.mjs';
export const SUPPLIER_WORKSPACE_HOST_CONTRACT:Readonly<{id:'profitia.supplier-workspace-host';version:'1.0.0'}>;
export type SupplierWorkspaceHostOptions<Transaction>=Omit<SupplierWorkspaceOperationHostOptions<Transaction>,
 'createAuthenticator'|'readResources'|'projectOutput'|'describeOutcome'|'requestLedger'|'requestContinuation'|'locationAdmission'|'reportAdmission'|'prepareInputs'>&{
 clerk:ClerkIdentityClient;identity:PublicIdentityApplication;
 createAuthenticator?:never;readResources?:never;projectOutput?:never;prepareInputs?:never;
};
export function createSupplierWorkspaceHost<Transaction>(options:SupplierWorkspaceHostOptions<Transaction>):Readonly<{
 contract:OperationExecutor['contract'];hostContract:typeof SUPPLIER_WORKSPACE_HOST_CONTRACT;
 execute(input:OperationInput):Promise<Readonly<{decision:'ALLOW';decisionId:string;contractId:string;contractVersion:string;value:unknown}>>;
}>;
export function supplierWorkspaceHostSourceDigest():Promise<string>;
