import type pg from 'pg'
import {createOrganisationContextReader,organisationContextSchemaDigest,type OwnOrganisationContext} from '@profitia/platform-contracts/organisation-context'
import {createClerkIdentityAuthenticator,type ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import type {PublicIdentityApplication} from '@profitia/platform-contracts/public-request'
import type {Application} from '@profitia/platform-contracts/operation-context'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import type {AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import {createSrmNativePgDriver} from './native-pg-driver'
import {bindSrmIdentity} from './private-operation-host'
export function organisationContextConfiguration(env:Readonly<Record<string,string|undefined>>){
 const flag=env.PROFITIA_ORGANISATION_CONTEXT_ENABLED
 if(flag===undefined||flag==='false')return undefined
 if(flag!=='true'||env.TARGET_ENVIRONMENT!=='development'||env.PROFITIA_ORGANISATION_CONTEXT_SCHEMA_DIGEST!==organisationContextSchemaDigest())throw new OperationDenied('POLICY_UNAVAILABLE')
 return Object.freeze({schemaDigest:organisationContextSchemaDigest()})
}
export function createSrmOrganisationContextReader(options:{pool:pg.Pool;auditPool:pg.Pool;clerk:ClerkIdentityClient;application:Application;identity:PublicIdentityApplication;binding:AccessStoreBinding;schemaDigest:string}){
 const identity=structuredClone(options.identity)
 return createOrganisationContextReader<pg.PoolClient>({binding:options.binding,schemaDigest:options.schemaDigest,
  application:{...options.application,organisationId:null,profileId:'SPENDGURU_SAAS',features:['account'],operations:['account.settings.read']},
  ...createSrmNativePgDriver(options.pool,options.auditPool),
  createAuthenticator:({resolveBinding})=>bindSrmIdentity(createClerkIdentityAuthenticator({client:options.clerk,application:identity,resolveBinding}),identity)})
}
/** Select only from verified current account metadata. Every business Root
 * independently rechecks membership, products, permissions and SQL scope. */
export async function bindSrmRequestRuntime<T extends {provider:string;defaultOrganisationId?:string;currentOrganisation?:(request:Request)=>Promise<OwnOrganisationContext>}>(runtime:T,request:Request):Promise<T>{
 if(runtime.provider!=='clerk'||!runtime.currentOrganisation)return runtime
 const current=await runtime.currentOrganisation(request)
 if(!current||!/^([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.test(current.organisationId??''))throw new OperationDenied('ACCESS_BASIS_INVALID')
 return Object.freeze(Object.create(Object.getPrototypeOf(runtime),{...Object.getOwnPropertyDescriptors(runtime),defaultOrganisationId:{value:current.organisationId,enumerable:true}}))
}
