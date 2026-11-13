import type {Prisma,PrismaClient} from '@prisma/client'
import {createOrganisationContextReader,organisationContextSchemaDigest} from '@profitia/platform-contracts/organisation-context'
import {createClerkIdentityAuthenticator,type ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import {bindPublicIdentityAuthenticator,type PublicIdentityApplication} from '@profitia/platform-contracts/public-request'
import type {Application} from '@profitia/platform-contracts/operation-context'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import type {AccessStoreBinding,AccessQuery} from '@profitia/platform-contracts/access-store'
export function organisationContextConfiguration(env:Readonly<Record<string,string|undefined>>){
 const flag=env.PROFITIA_ORGANISATION_CONTEXT_ENABLED
 if(flag===undefined||flag==='false')return undefined
 if(flag!=='true'||env.TARGET_ENVIRONMENT!=='development'||env.PROFITIA_ORGANISATION_CONTEXT_SCHEMA_DIGEST!==organisationContextSchemaDigest())throw new OperationDenied('POLICY_UNAVAILABLE')
 return Object.freeze({schemaDigest:organisationContextSchemaDigest()})
}
const queryFor=(client:PrismaClient|Prisma.TransactionClient):AccessQuery=>async(sql,values=[])=>{
 if(/^\s*SELECT\b/i.test(sql)&&sql!=='SELECT profitia_access.append_audit($1::jsonb)')return {rows:await client.$queryRawUnsafe<Record<string,unknown>[]>(sql,...values)}
 await client.$executeRawUnsafe(sql,...values);return {rows:[]}
}
export function createSg2OrganisationContextReader(options:{prisma:PrismaClient;auditPrisma:PrismaClient;clerk:ClerkIdentityClient;application:Application;identity:PublicIdentityApplication;binding:AccessStoreBinding;schemaDigest:string}){
 const identity=structuredClone(options.identity)
 return createOrganisationContextReader<Prisma.TransactionClient>({binding:options.binding,schemaDigest:options.schemaDigest,
  application:{...options.application,organisationId:null,profileId:'SPENDGURU_SAAS',features:['account'],operations:['account.settings.read']},
  independentQuery:queryFor(options.auditPrisma),
  transact:(run,limits)=>options.prisma.$transaction(transaction=>run({transaction,query:queryFor(transaction)}),{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs}),
  createAuthenticator:({resolveBinding})=>{
   const authenticate=createClerkIdentityAuthenticator({client:options.clerk,application:identity,resolveBinding})
   return identity.requestBoundary?bindPublicIdentityAuthenticator(authenticate,identity.requestBoundary):authenticate
  }})
}
/** A request-local selector only. Every downstream Root still independently
 * checks current user, membership, products, permissions and SQL scope. */
export async function bindSg2RequestRuntime<T extends {provider:string;defaultOrganisationId?:string;assistantForOrganisation?:(organisationId:string)=>Promise<unknown>;currentOrganisation?:(request:Request)=>Promise<{organisationId:string|null}>}>(runtime:T,request:Request):Promise<T>{
 if(runtime.provider!=='clerk'||!runtime.currentOrganisation)return runtime
 const current=await runtime.currentOrganisation(request)
 if(!current||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(current.organisationId??''))throw new OperationDenied('ACCESS_BASIS_INVALID')
 const descriptors=Object.getOwnPropertyDescriptors(runtime)
 return Object.freeze(Object.create(Object.getPrototypeOf(runtime),{...descriptors,defaultOrganisationId:{value:current.organisationId,enumerable:true},...(runtime.assistantForOrganisation?{assistant:{value:()=>runtime.assistantForOrganisation!(current.organisationId!),enumerable:true}}:{})}))
}
