import type {Prisma,PrismaClient} from '@prisma/client'
import {createPrivateOperationHost} from '@profitia/platform-contracts/private-operation-host'
import {createClerkIdentityAuthenticator,type ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import {bindPublicIdentityAuthenticator,type PublicIdentityApplication as IdentityApplication} from '@profitia/platform-contracts/public-request'
import type {AccessQuery,AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import {OperationDenied,type Application} from '@profitia/platform-contracts/operation-context'
import {DISCOVERY_REQUEST_PROJECTION,DISCOVERY_RESULT_PROJECTION,discoveryRequestResourceId,discoveryResultResourceId,discoveryUuid,
 readDiscoveryCommand,readDiscoverySelection,projectDiscoveryRequest,projectPrivateDiscovery} from './discovery-operation'

export type DiscoveryHostOptions={prisma:PrismaClient;auditPrisma:PrismaClient;clerk:ClerkIdentityClient;
 application:Application;identity:IdentityApplication;binding:AccessStoreBinding;
 module:{id:'benchmark';schemaDigest:string;auditSchemaDigest:string};boundaryDigest:string;
 now?:()=>number;transactionTimeoutMs?:number}
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
export const discoveryQuery=(client:Pick<Prisma.TransactionClient,'$queryRawUnsafe'|'$executeRawUnsafe'>):AccessQuery=>async(sql,values=[])=>{
 const audit=['SELECT profitia_access.append_audit($1::jsonb)','SELECT profitia_jobs.append_audit($1::jsonb)','SELECT profitia_ingestion.append_audit($1::jsonb)'].includes(sql)
 if(/^\s*SELECT\b/i.test(sql)&&!audit)return{rows:await client.$queryRawUnsafe<Record<string,unknown>[]>(sql,...values)}
 if(!/^SET LOCAL\b/.test(sql)&&!audit)return refuse()
 await client.$executeRawUnsafe(sql,...values);return{rows:[]}
}
function base(options:DiscoveryHostOptions,operation:'benchmark.discovery.request'|'benchmark.discovery.read'){
 const {prisma,auditPrisma,clerk,now}=options
 if(typeof window!=='undefined'||!prisma||!auditPrisma||prisma===auditPrisma||!options.module||options.module.id!=='benchmark'
  ||options.application.appId!=='spendguru'||options.identity.appId!=='spendguru'||options.binding.applicationId!=='spendguru'
  ||options.application.operations.length!==1||options.application.operations[0]!==operation
  ||options.identity.environment!==options.application.environment||options.binding.environment!==options.application.environment
  ||options.identity.issuer!==options.application.identityIssuer||!/^[a-f0-9]{64}$/.test(options.boundaryDigest))throw TypeError('Explicit native Finder host binding required')
 return {application:structuredClone(options.application),binding:structuredClone(options.binding),module:structuredClone(options.module),now,
  transactionTimeoutMs:options.transactionTimeoutMs,independentQuery:discoveryQuery(auditPrisma),
  transact:<T>(work:(session:{query:AccessQuery;transaction:Prisma.TransactionClient})=>Promise<T>,limits:{timeoutMs:number;maxWaitMs:number})=>
   prisma.$transaction(tx=>work({query:discoveryQuery(tx),transaction:tx}),{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs}),
  createAuthenticator:({resolveBinding}:Parameters<Parameters<typeof createPrivateOperationHost<Prisma.TransactionClient>>[0]['createAuthenticator']>[0])=>{
   const authenticate=createClerkIdentityAuthenticator({client:clerk,application:options.identity,resolveBinding,now})
   return options.identity.requestBoundary?bindPublicIdentityAuthenticator(authenticate,options.identity.requestBoundary):authenticate
  }}
}
async function installed(query:AccessQuery,boundaryDigest:string){
 const rows=await query('SELECT profitia_benchmark_discovery.runtime_descriptor() AS descriptor')
 const d=rows.rows[0]?.descriptor as Record<string,unknown>|undefined
 if(rows.rows.length!==1||!d||d.applicationId!=='spendguru'||d.discoverySchemaVersion!=='1.0.0'
  ||d.discoveryBoundaryDigest!==boundaryDigest)throw new OperationDenied('POLICY_UNAVAILABLE')
}
export function createSg2DiscoveryRequestHost(options:DiscoveryHostOptions&{requestLedger:{schemaDigest:string;externalSchemaDigest:string;operationSchemaDigest:string}}){
 return createPrivateOperationHost<Prisma.TransactionClient>({...base(options,'benchmark.discovery.request'),requestLedger:options.requestLedger,
  readResources:async({actor,request,scope,query})=>{
   const command=readDiscoveryCommand(request.payload)
   if(actor.kind!=='HUMAN'||!scope.organisationId||!scope.userId||scope.userId!==actor.actorId
    ||request.resourceId!==discoveryRequestResourceId(command))return refuse()
   await installed(query,options.boundaryDigest)
   return{resource:{id:request.resourceId,type:'benchmark_discovery_request',dataClass:'OPERATION_AUDIT',environment:scope.environment,
    ownerOrganisationId:scope.organisationId,ownerUserId:actor.actorId,version:'sg2-private-discovery-command-v1',projectionVersion:DISCOVERY_REQUEST_PROJECTION}}
  },projectOutput:projectDiscoveryRequest})
}
export function createSg2DiscoveryReadHost(options:DiscoveryHostOptions){
 const now=options.now??Date.now
 return createPrivateOperationHost<Prisma.TransactionClient>({...base(options,'benchmark.discovery.read'),
  readResources:async({actor,request,scope,query})=>{
   const selected=readDiscoverySelection(request.payload)
   if(actor.kind!=='HUMAN'||!scope.organisationId||scope.userId!==actor.actorId||request.resourceId!==discoveryResultResourceId(selected.requestId))return refuse()
   await installed(query,options.boundaryDigest)
   const rows=await query('SELECT profitia_benchmark_discovery.result_metadata($1::uuid) AS metadata',[selected.requestId])
   const m=rows.rows[0]?.metadata as Record<string,unknown>|undefined
   if(rows.rows.length!==1||!m||m.requestId!==selected.requestId||m.ownerOrganisationId!==scope.organisationId||m.ownerUserId!==actor.actorId
    ||typeof m.resultVersion!=='string'||!discoveryUuid.test(m.resultVersion)||typeof m.retentionUntil!=='string'
    ||!Number.isFinite(Date.parse(m.retentionUntil))||Date.parse(m.retentionUntil)<=now())return refuse()
   return{resource:{id:request.resourceId,type:'benchmark_discovery_result',dataClass:'USER_IN_ORGANISATION_PRIVATE',environment:scope.environment,
    ownerOrganisationId:scope.organisationId,ownerUserId:actor.actorId,version:m.resultVersion,projectionVersion:DISCOVERY_RESULT_PROJECTION,
    contentRequirements:[{product:'SPENDGURU',feature:'benchmark'}]}}
  },projectOutput:projectPrivateDiscovery})
}
