import type {AccessQuery,AccessStoreBinding} from '@profitia/platform-contracts/access-store';
import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider';
export const KNOWLEDGE_E1_CONTRACT:'profitia.current-e1-knowledge/1.0.0';
export const KNOWLEDGE_OPERATIONS:readonly string[];
export interface KnowledgePrincipal{environment:'development';internalUserId:string;organisationIds:string[];allowedScopes:('ACCOUNT_PRIVATE'|'PROFITIA_SHARED')[];sharedKnowledgeAllowed:boolean;operator:boolean;publishBindingStandard:boolean;usePurpose:'PROFITIA_INTERNAL'|'CUSTOMER_SERVICE'}
export interface KnowledgeScope{readonly principal:Readonly<KnowledgePrincipal>;readonly delegation:Record<string,unknown>|null;readonly expiresAt:string;readonly transaction?:{query:AccessQuery}}
export function createKnowledgeAuthority(options:{query:AccessQuery;client:ClerkIdentityClient;binding:AccessStoreBinding;now?:()=>number}):{
 ready():Promise<boolean>;human(request:Request,input:unknown):Promise<unknown>;worker(request:Request,input:unknown):Promise<unknown>};
export function createKnowledgeOperationHost(options:{independentQuery:AccessQuery;application:{applicationId:string;environment:'development';deploymentId:string};transact:<T>(run:(connection:{query:AccessQuery})=>Promise<T>)=>Promise<T>;fetch?:typeof fetch;workerCredential?:{keyId:string;privateKey:string}|null;now?:()=>number}):{
 ready():Promise<boolean>;execute<T>(request:Request,command:{operation:string;resourceId:string;scopes:string[];requestDigest:string;delegation:unknown},action:(scope:KnowledgeScope)=>Promise<T>):Promise<T>;
 authorizeJob(job:Record<string,unknown>):Promise<KnowledgeScope>;release(scope:KnowledgeScope):void;
 authorizeProvider(input:{scope:KnowledgeScope;operation:string;model:string;reservationMicrousd?:number}):Promise<boolean>;
 createDelegation(scope:KnowledgeScope,command:Record<string,unknown>):Record<string,unknown>;
};
