import type {AccessQuery,AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import type {Application,OperationExecutor} from '@profitia/platform-contracts/operation-context'
import type {createPrivateOperationHost} from '@profitia/platform-contracts/private-operation-host'
export declare const CURRENT_E1_CONTRACT:Readonly<{id:'profitia.current-e1-authority';version:'1.0.0'}>
export declare const currentE1AuthoritySchemaUrl:string
export declare const currentE1ReceiverSchemaUrl:string
export declare function currentE1SchemaDigest(side:'authority'|'receiver'):string
export declare function createCurrentE1OperationHost<T>(options:Omit<Parameters<typeof createPrivateOperationHost<T>>[0],'createAuthenticator'|'module'|'requestLedger'|'requestContinuation'|'locationAdmission'|'reportAdmission'|'prepareInputs'|'describeOutcome'>&{fetch?:typeof fetch}):Readonly<OperationExecutor<T>&{hostContract:typeof CURRENT_E1_CONTRACT;ready():Promise<boolean>}>
export interface CurrentE1Authority{knowledgeReady?():Promise<boolean>;authorizeKnowledgeHuman?(request:Request,input:unknown):Promise<unknown>;authorizeKnowledgeWorker?(request:Request,input:unknown):Promise<unknown>;recurringReady?():Promise<boolean>;recurringComponentReady?(request:Request,input:unknown):Promise<Readonly<{ready:true}>>;recurringConsent?(request:Request,input:unknown):Promise<unknown>;authorizeRecurring?(request:Request,input:unknown):Promise<Readonly<{payload:string;signature:string}>>;ready():Promise<boolean>;authorize(request:Request,input:unknown):Promise<Readonly<{payload:string;signature:string}>>;sourceReady?():Promise<boolean>;authorizeSource?(request:Request,input:unknown):Promise<Readonly<{payload:string;signature:string}>>}
export declare function createCurrentE1Authority(options:{query:AccessQuery;client:ClerkIdentityClient;binding:AccessStoreBinding;now?:()=>number}):Readonly<CurrentE1Authority>

export declare const currentE1CalendarAuthoritySchemaUrl:string
export declare const currentE1CalendarReceiverSchemaUrl:string
export declare function currentE1CalendarSchemaDigest(side:'authority'|'receiver'):string

export declare const currentE1InsightsAuthoritySchemaUrl:string;
export declare const currentE1InsightsReceiverSchemaUrl:string;
