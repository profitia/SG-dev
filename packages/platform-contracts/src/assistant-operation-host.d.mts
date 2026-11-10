import type {Application,OperationExecutor,OperationContext,BoundRequest,Actor,Resource} from './operation-context.mjs'
import type {AccessStoreBinding,AccessQuery} from './access-store.mjs'
import type {createAssistantUsageStore} from './assistant-usage.mjs'
export declare const ASSISTANT_OPERATION_HOST_CONTRACT:Readonly<{id:'profitia.assistant-operation-host';version:'1.0.0'}>
export declare function createAssistantOperationHost<Transaction>(options:{
 application:Application;binding:AccessStoreBinding;assistantSchemaDigest:string;now?:()=>number
 independentQuery:AccessQuery
 transact<T>(work:(session:{query:AccessQuery;transaction:Transaction})=>Promise<T>,limits:{timeoutMs:number;maxWaitMs:number}):Promise<T>
 createAuthenticator(options:{resolveBinding:(key:import('./identity-provider.mjs').ExternalIdentityKey)=>Promise<import('./identity-provider.mjs').IdentityBinding|null>}):(request:Request)=>Promise<Readonly<Actor>|null>
 readResources(input:{actor:Readonly<Actor>;request:Readonly<BoundRequest>;scope:Readonly<{applicationId:'spendguru';environment:'development';userId:string;organisationId:string|null}>;query:AccessQuery;transaction:Transaction}):Promise<{resource:Resource}>
 projectOutput(value:unknown,context:Readonly<OperationContext>):Promise<unknown>
 usage:ReturnType<typeof createAssistantUsageStore>
}):OperationExecutor<Transaction>&{hostContract:typeof ASSISTANT_OPERATION_HOST_CONTRACT}
