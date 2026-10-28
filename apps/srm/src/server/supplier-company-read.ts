import type {PoolClient} from 'pg'
import type {SupplierXRayCard} from '@profitia/srm-xray'
import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest,type Json} from '@profitia/platform-contracts/operation-context'
import {createSrmPrivateOperationHost} from './private-operation-host'
import {readCorporatePacket,CORPORATE_PUBLICATION_VERSION} from './corporate-source-store'
import {projectPublicFinancialData} from './corporate-knowledge'
import {readSupplierRequest} from './supplier-request-operation'
import {toPublicSection} from './xray-lookup'
import {emptyCard} from '../demo/fixture'
import {bindOrganizationTransaction} from './db'
import {readFreshCompany} from './shared-catalog'
import {isKnownMgbiCompany,isEmptyMgbiCompany} from './company-source-policy'

type DriverOptions=Parameters<typeof createSrmPrivateOperationHost>[0]
export type CompanyReadOptions=Omit<DriverOptions,'readResources'|'projectOutput'|'prepareInputs'|'describeOutcome'|'requestLedger'>
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const publication=(value:unknown):Response=>{if(!(value instanceof Response))return refuse();return value}
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}

/** This input is the original server-owned native COMPANY result, never an
 * HTTP body or a private KYS/JDG projection. Current HUMAN authority and audit
 * are checked again after provider/native work, before releasing its DTO. */
export function createSrmCompanyCardRead(options:CompanyReadOptions,input:SupplierXRayCard){
 if(typeof window!=='undefined'||options.application.operations.length!==1||options.application.operations[0]!=='supplier.report.read')return refuse()
 const nip=readSupplierRequest({kind:'SUPPLIER_REPORT',nip:input?.identity?.nip}).nip
 if(Object.keys(input).sort().join(',')!=='financial,general,identity,kys'
  ||Object.keys(input.identity).sort().join(',')!=='krs,name,nip'
  ||input.kys.data!==null||input.kys.status!=='NOT_REQUESTED')return refuse()
 const section=<T extends SupplierXRayCard['general']|SupplierXRayCard['financial']>(value:T)=>({
  status:value.status,source:value.source,data:value.data,retrievedAt:value.retrievedAt,effectiveAt:value.effectiveAt,warnings:value.warnings})
 const packet=isEmptyMgbiCompany(input.general,input.financial)
  ?{general:{...section(input.general),data:null},financial:{...section(input.financial),data:null}}
  :readCorporatePacket({version:CORPORATE_PUBLICATION_VERSION,nip,preserveGeneral:false,
  general:section(input.general),financial:section({...input.financial,data:projectPublicFinancialData(input.financial.data)}),facts:[]})
 if(input.identity.krs!==(packet.general.data?.krs??null)||input.identity.name!==(packet.general.data?.legalName??null))return refuse()
 const body={identity:{nip,krs:input.identity.krs,name:input.identity.name},
  general:toPublicSection(packet.general),financial:toPublicSection(packet.financial),kys:toPublicSection(emptyCard.kys)}
 const version=operationPayloadDigest(body as unknown as Json),resourceId='supplier-report:COMPANY:'+nip
 const host=createSrmPrivateOperationHost({...options,
  readResources:async({actor,request,scope})=>{
   const payload=request.payload as {nip?:unknown;entityType?:unknown}
   if(actor.kind!=='HUMAN'||!scope.organisationId||scope.userId!==actor.actorId
    ||request.operation!=='supplier.report.read'||request.resourceId!==resourceId
    ||!payload||Object.keys(payload).sort().join(',')!=='entityType,nip'||payload.nip!==nip||payload.entityType!=='COMPANY')return refuse()
   return {resource:{id:resourceId,type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:scope.environment,
    ownerOrganisationId:null,ownerUserId:null,version,projectionVersion:'srm-native-company-card-v1',approvedSharedProjection:true}}
  },
  projectOutput:(value,context)=>{
   if(value!==body||context.operation!=='supplier.report.read'||context.resourceId!==resourceId||context.resource.version!==version
    ||operationPayloadDigest(body as unknown as Json)!==version)return refuse()
   return Response.json(body,{headers})
  },
 })
 return Object.freeze({async read(request:Request,organisationId:string):Promise<Response>{
  const result=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
   operation:'supplier.report.read',organisationId,resourceId,payload:{nip,entityType:'COMPANY'},request},async()=>body)
  return publication(result.value)
 }})
}

/** Cache routing is itself a current audited HUMAN read, not an unscoped
 * catalogue query before authentication. Reuse the existing freshness rules. */
export function createSrmKnownCompanyRead(options:CompanyReadOptions){
 const host=createSrmPrivateOperationHost({...options,
  readResources:async({actor,request,scope,query})=>{
   const payload=request.payload as {nip?:unknown;entityType?:unknown}
   const nip=readSupplierRequest({kind:'SUPPLIER_REPORT',nip:payload?.nip}).nip
   if(actor.kind!=='HUMAN'||scope.userId!==actor.actorId||!scope.organisationId
    ||request.operation!=='supplier.report.read'||payload.entityType!=='COMPANY'
    ||Object.keys(payload).sort().join(',')!=='entityType,nip'||request.resourceId!=='supplier-report:COMPANY:'+nip)return refuse()
   const row=(await query('SELECT general_sha256,financial_sha256 FROM srm.catalog_companies WHERE nip=$1',[nip])).rows[0]
   for(const field of ['general_sha256','financial_sha256'])if(row?.[field]!=null&&(typeof row[field]!=='string'||!/^[a-f0-9]{64}$/.test(row[field] as string)))return refuse()
   return {resource:{id:request.resourceId,type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:scope.environment,
    ownerOrganisationId:null,ownerUserId:null,version:operationPayloadDigest({general:(row?.general_sha256 as string|undefined)??null,financial:(row?.financial_sha256 as string|undefined)??null}),
    projectionVersion:'srm-known-company-v1',approvedSharedProjection:true}}
  },
  projectOutput:(value,context)=>{
   if(typeof value!=='boolean'||context.operation!=='supplier.report.read')return refuse()
   return Response.json({known:value},{headers})
  },
 })
 return Object.freeze({async read(request:Request,organisationId:string,nip:string){
  const result=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
   operation:'supplier.report.read',organisationId,resourceId:'supplier-report:COMPANY:'+nip,payload:{nip,entityType:'COMPANY'},request},
   async(context,client)=>{
    await client.query("SELECT set_config('srm.organization_id',$1,true)",[context.organisationId])
    return isKnownMgbiCompany(await readFreshCompany(context.organisationId!,nip,new Date(),bindOrganizationTransaction(context.organisationId!,client)),nip)
   })
  return (await publication(result.value).json()).known===true
 }})
}
