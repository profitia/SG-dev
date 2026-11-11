import type {Application,Json,OperationContext} from '@profitia/platform-contracts/operation-context';
import type {AccessQuery,AccessStoreBinding} from '@profitia/platform-contracts/access-store';
import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider';
export declare const RECURRING_E1_CONTRACT:'profitia.current-private-recurring/1.0.0';
export declare const recurringAuthoritySchemaUrl:URL,recurringReceiverSchemaUrl:URL;
export declare function recurringSchemaDigest(side:'authority'|'receiver'):string;
export interface RecurringProof{payload:string;signature:string}
export declare function createRecurringSigner(configuration:{environment:'development';authorityOrigin:string;componentId:string;keyId:string;privateKey:unknown},options?:{now?:()=>number}):(body:unknown)=>RecurringProof;
export declare function createRecurringAuthority(options:{query:AccessQuery;client:ClerkIdentityClient;binding:AccessStoreBinding;now?:()=>number;authorizeHuman:(request:Request,input:unknown)=>Promise<RecurringProof>}):Readonly<{ready():Promise<boolean>;componentReady(request:Request,input:unknown):Promise<Readonly<{ready:true}>>;consent(request:Request,input:unknown):Promise<unknown>;authorize(request:Request,input:unknown):Promise<RecurringProof>}>;
export declare function createRecurringOperationHost<T>(options:{application:Application;binding:AccessStoreBinding;independentQuery:AccessQuery;transact:<R>(action:(session:{query:AccessQuery;transaction:T})=>Promise<R>,options:unknown)=>Promise<R>;signer:(body:unknown)=>RecurringProof;readResource:(query:AccessQuery,proof:unknown,input:unknown)=>Promise<OperationContext['resource']>;fetch?:typeof fetch;now?:()=>number}):Readonly<{ready():Promise<boolean>;execute<R>(input:{operation:string;organisationId:string;resourceId:string;payload:Json},action:(context:Readonly<OperationContext>,transaction:T,admission:{sourceGrant:null|{grantId:string;resourceId:string;expiresAt:string;sourceRef:string}})=>Promise<R>):Promise<R>}>;


export declare function createRecurringConsentClient(options?:{fetch?:typeof fetch}):Readonly<{consent(query:AccessQuery,request:Request,command:unknown):Promise<RecurringProof>}>;
