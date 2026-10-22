import type {AccessStoreBinding,AccessQuery} from './access-store.mjs'
import type {ExternalIdentityKey} from './identity-provider.mjs'
export declare const IDENTITY_RENEWAL_CONTRACT: Readonly<{id:'profitia.identity-binding-renewal';version:'1.0.0'}>
export declare const renewalSchemaUrl:string
export declare const renewalSchemaDigest:()=>string
export declare function createIdentityRenewalSql(options:{binding:AccessStoreBinding;issuer:string;schemaDigest:string;
  renewalSchemaDigest:string;proofKey:Uint8Array;now?:()=>number}):Readonly<{
  contract:typeof IDENTITY_RENEWAL_CONTRACT
  revalidate(query:AccessQuery,identity:ExternalIdentityKey,identityUntil:number):Promise<boolean>
}>
