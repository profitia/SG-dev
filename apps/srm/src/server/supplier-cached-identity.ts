import type {PoolClient} from 'pg'
import type {SupplierSelection} from '@profitia/srm-xray'
import {createCurrentHumanReadHost} from '@profitia/platform-contracts/current-human-read'
import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import type {CompanyReadOptions} from './supplier-company-read'
import {createSrmNativePgDriver} from './native-pg-driver'
import {readSupplierRequest} from './supplier-request-operation'
import {catalogFreshnessMs,isFreshCatalogEntry} from './shared-catalog'
import {COMPANY_IDENTITY_VERSION} from './company-continuity'

type GeneralIdentity={status?:unknown;source?:{provider?:unknown;model?:unknown};data?:{nip?:unknown;legalName?:unknown;krs?:unknown;registryHistory?:{version?:unknown;currentKrs?:unknown;members?:Array<{krs?:unknown}>}}}
export type CachedSupplierIdentityRow=Readonly<{general_json?:GeneralIdentity;general_sha256?:unknown;general_checked_at?:Date|string|null;general_source_snapshot_id?:unknown}>
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][0-9a-f]{3}-[a-f0-9]{12}$/i
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
/** The reference is the existing persisted General content version, not a new
 * supplier ID or a KRS pilot selection. The accepted catalog publication owns
 * provenance; this read never opens the tenant-private source payload. */
export function projectCachedSupplierIdentity(row:CachedSupplierIdentityRow|undefined,nip:string,at:Date,env:Readonly<Record<string,string|undefined>>=process.env):SupplierSelection{
 const section=row?.general_json,data=section?.data,history=data?.registryHistory
 if(!row||!section||!['SUCCESS','PARTIAL'].includes(String(section.status))
  ||section.source?.provider!=='MGBI'||section.source.model!=='pl-krs-wp-record'
  ||!data||data.nip!==nip||typeof data.legalName!=='string'||!data.legalName.trim()||data.legalName.length>1000
  ||typeof data.krs!=='string'||!/^\d{10}$/.test(data.krs)
  ||history?.version!==COMPANY_IDENTITY_VERSION||history.currentKrs!==data.krs
  ||!Array.isArray(history.members)||history.members.filter(member=>member?.krs===data.krs).length!==1
  ||typeof row.general_sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.general_sha256)
  ||typeof row.general_source_snapshot_id!=='string'||!uuid.test(row.general_source_snapshot_id)
  ||!isFreshCatalogEntry(row.general_checked_at??null,at,catalogFreshnessMs(env)))return refuse()
 return Object.freeze({nip,krs:data.krs,name:data.legalName,locality:null,selectionRef:row.general_sha256})
}

/** Reuses the configured native pools, current Clerk/E1 host and its H1/H2
 * resource revalidation. Factory construction leaves isolated pilots unchanged. */
export function createSrmCachedSupplierIdentityRead(options:CompanyReadOptions){
 return Object.freeze({async read(request:Request,organisationId:string,rawNip:string):Promise<Response>{
  if(options.reportAdmission||options.application.environment!=='development'
   ||options.application.operations.join(',')!=='supplier.report.read')return refuse()
  const {pool,auditPool,clerk,identity,application,binding,module,now}=options
  const nip=readSupplierRequest({kind:'SUPPLIER_REPORT',nip:rawNip}).nip,resourceId='supplier-report:COMPANY:'+nip
  let accepted:SupplierSelection|undefined,reads=0
  const host=createCurrentHumanReadHost<PoolClient>({application,binding,module,clerk,identity,now,
   ...createSrmNativePgDriver(pool,auditPool),
   readResources:async({actor,request:operation,scope,query})=>{
    if(actor.kind!=='HUMAN'||scope.userId!==actor.actorId||scope.organisationId!==organisationId
     ||operation.operation!=='supplier.report.read'||operation.resourceId!==resourceId||++reads>2)return refuse()
    const row=(await query('SELECT c.general_json,c.general_sha256,c.general_checked_at,c.general_source_snapshot_id FROM srm.catalog_companies c WHERE c.nip=$1',[nip])).rows[0] as CachedSupplierIdentityRow|undefined
    const selected=projectCachedSupplierIdentity(row,nip,new Date(now?.()??Date.now()))
    if(reads===1)accepted=selected
    const version=operationPayloadDigest({selection:selected,generalCheckedAt:new Date(row!.general_checked_at!).toISOString(),snapshotId:row!.general_source_snapshot_id as string})
    return {resource:{id:resourceId,type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:scope.environment,
     ownerOrganisationId:null,ownerUserId:null,version,projectionVersion:'srm-cached-supplier-identity-v1',approvedSharedProjection:true} as const}
   },
   projectOutput:(value,context)=>{
    if(!accepted||value!==accepted||context.operation!=='supplier.report.read'||context.organisationId!==organisationId
     ||context.resourceId!==resourceId)return refuse()
    return Response.json(accepted,{headers})
   },
  })
  const outcome=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
   operation:'supplier.report.read',organisationId,resourceId,payload:{nip,entityType:'COMPANY'},request},async()=>accepted!)
  if(!(outcome.value instanceof Response)||reads!==2)return refuse()
  return outcome.value
 }})
}
