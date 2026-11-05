import type {AccessQuery,AccessStoreBinding} from './access-store.mjs'
import type {ClerkIdentityClient} from './identity-provider.mjs'
import type {Application,OperationExecutor} from './operation-context.mjs'
import type {createPrivateOperationHost} from './private-operation-host.mjs'
export declare const CURRENT_E1_CONTRACT:Readonly<{id:'profitia.current-e1-authority';version:'1.0.0'}>
export declare const currentE1AuthoritySchemaUrl:string
export declare const currentE1ReceiverSchemaUrl:string
export declare function currentE1SchemaDigest(side:'authority'|'receiver'):string
export declare function createCurrentE1OperationHost<T>(options:Omit<Parameters<typeof createPrivateOperationHost<T>>[0],'createAuthenticator'|'module'|'requestLedger'|'requestContinuation'|'locationAdmission'|'reportAdmission'|'prepareInputs'|'describeOutcome'>&{fetch?:typeof fetch}):Readonly<OperationExecutor<T>&{hostContract:typeof CURRENT_E1_CONTRACT;ready():Promise<boolean>}>
export interface CurrentE1Authority{ready():Promise<boolean>;authorize(request:Request,input:unknown):Promise<Readonly<{payload:string;signature:string}>>}
export declare function createCurrentE1Authority(options:{query:AccessQuery;client:ClerkIdentityClient;binding:AccessStoreBinding;now?:()=>number}):Readonly<CurrentE1Authority>
