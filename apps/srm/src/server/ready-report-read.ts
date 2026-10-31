import {createHmac} from 'node:crypto'
import type {PoolClient} from 'pg'
import {createCurrentHumanReadHost} from '@profitia/platform-contracts/current-human-read'
import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest,type OperationContext} from '@profitia/platform-contracts/operation-context'
import type {CompanyReadOptions} from './supplier-company-read'
import {createSrmNativePgDriver} from './native-pg-driver'
import {readSupplierRequest} from './supplier-request-operation'
import {projectPreparedCompanyReport,readPreparedCompanyReport,PREPARED_REPORT_VERSION,type PreparedCompanyReport} from './ready-report'
import {isKnownMgbiCompany} from './company-source-policy'
import {catalogFreshnessMs,isFreshCatalogEntry} from './shared-catalog'
import {measureSupplierStage} from './supplier-telemetry'

type ReadyRow={body_text?:string;body_digest:string;general_sha256:string;financial_sha256:string;
 general_checked_at:Date|string;financial_checked_at:Date|string;schema_digest:string;general_json?:PreparedCompanyReport['general'];financial_json?:PreparedCompanyReport['financial']}
const stamp=(value:Date|string|null|undefined)=>value&&Number.isFinite(new Date(value).getTime())?new Date(value).toISOString():null
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
// Closed server-owned SELECTs for the optional PostgreSQL READ ONLY probe.
// Metadata registration remains a separate action on the ordinary transaction.
export const READY_REPORT_PROBE_STATEMENTS=Object.freeze([true,false].map(first=>
 `SELECT ${first?'r.body_text,CASE WHEN r.body_digest IS NULL THEN c.general_json END AS general_json,CASE WHEN r.body_digest IS NULL THEN c.financial_json END AS financial_json,':''}r.body_digest,r.schema_digest,c.general_sha256,c.financial_sha256,c.general_checked_at,c.financial_checked_at
      FROM srm.catalog_companies c LEFT JOIN LATERAL(SELECT * FROM srm.ready_company_reports r
       WHERE r.nip=c.nip AND r.general_sha256=c.general_sha256 AND r.financial_sha256=c.financial_sha256
        AND r.general_effect=c.general_source_snapshot_id AND r.financial_effect=c.financial_source_snapshot_id
        AND r.schema_digest=$2 ORDER BY r.prepared_at DESC LIMIT 1) r ON true WHERE c.nip=$1`))
type ReadySelection=Readonly<{known:boolean;ready:boolean}>
type ReadyProjection=NonNullable<ReturnType<typeof projectPreparedCompanyReport>>
type ReadyReadOptions=Parameters<typeof createCurrentHumanReadHost<PoolClient>>[0]
type ReadyResourceReader=NonNullable<ReadyReadOptions['readResources']>
type ReadyResourceInput=Pick<Parameters<ReadyResourceReader>[0],'actor'|'request'|'scope'|'query'>

/** One current HUMAN read per opening. Only the classified Source view crosses
 * this boundary. History/frame effects are local metadata, never a refresh,
 * private acquisition or another copy of the financial source payload. */
export function createSrmReadyCompanyReadPhase(options:CompanyReadOptions,schemaDigest:string,secret:string,
 request:Request,organisationId:string,rawNip:string){
 if(options.reportAdmission||!secret||secret.length<32||!/^[a-f0-9]{64}$/.test(schemaDigest))return refuse()
 const {pool,auditPool,clerk,identity,application,binding,module,now}=options
  const nip=readSupplierRequest({kind:'SUPPLIER_REPORT',nip:rawNip}).nip,resourceId='supplier-report:COMPANY:'+nip
  let body:PreparedCompanyReport|null=null,entry:ReadyRow|undefined,reads=0
  let accepted:Readonly<{known:boolean;response:Response|null}>|undefined
  let selection:ReadySelection|undefined,prepared:Readonly<{view:ReadyProjection;actorId:string;organisationId:string;applicationId:string}>|null=null,completed=false
  // The resource reader has only the four read inputs it actually needs.
  // A read-only probe port never masquerades as a raw PoolClient.
  const readResources=async({actor,request:operation,scope,query}:ReadyResourceInput)=>{
    if(actor.kind!=='HUMAN'||scope.userId!==actor.actorId||scope.organisationId!==organisationId
     ||operation.operation!=='supplier.report.read'||operation.resourceId!==resourceId)return refuse()
    const first=++reads===1
    if(reads>2)return refuse()
    const row=(await measureSupplierStage('READY_REPORT_READ',()=>query(
     READY_REPORT_PROBE_STATEMENTS[first?0:1],[nip,schemaDigest]))).rows[0] as ReadyRow|undefined
    if(first){entry=row;if(row?.body_text)body=readPreparedCompanyReport(JSON.parse(row.body_text))}
    return {resource:{id:resourceId,type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:scope.environment,
     ownerOrganisationId:null,ownerUserId:null,version:row?.body_digest??'NO_PREPARED_REPORT',
     projectionVersion:PREPARED_REPORT_VERSION+':'+operationPayloadDigest(row?{general:row.general_sha256,financial:row.financial_sha256,
      generalCheckedAt:stamp(row.general_checked_at),financialCheckedAt:stamp(row.financial_checked_at)}:null),approvedSharedProjection:true} as const}
   }
  const hostOptions:ReadyReadOptions={application,binding,module,clerk,identity,now,
   ...createSrmNativePgDriver(pool,auditPool),readResources,
   projectOutput:(value,context)=>{
    if(value!==accepted||!accepted||accepted.response&&context.resource.version!==entry?.body_digest)return refuse()
    return value
   },
  }
  const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
   operation:'supplier.report.read' as const,organisationId,resourceId,payload:{nip,entityType:'COMPANY'},request}
  // Pure preparation: no raw transaction, alternate pool, writer or provider
  // is captured or called by this callback. Only READY can register metadata.
  const probeAction=(context:Readonly<OperationContext>):ReadySelection=>{
    if(selection||context.organisationId!==organisationId)return refuse()
    const at=new Date(now?.()??Date.now()),ttl=catalogFreshnessMs(process.env)
    const known=!!entry&&(body?isKnownMgbiCompany({general:body.general,financial:body.financial},nip):!!entry.general_json&&!!entry.financial_json&&isKnownMgbiCompany({general:entry.general_json,financial:entry.financial_json},nip))
     &&isFreshCatalogEntry(entry.general_checked_at,at,ttl)&&isFreshCatalogEntry(entry.financial_checked_at,at,ttl)
    const result=entry&&body?projectPreparedCompanyReport(body,{organisationId:context.organisationId!,userId:context.actorId},{
     generalHash:entry.general_sha256,financialHash:entry.financial_sha256,generalCheckedAt:entry.general_checked_at,financialCheckedAt:entry.financial_checked_at},new Date(now?.()??Date.now()),process.env)
      :null
    accepted={known,response:null}
    if(!result)return selection=Object.freeze({known,ready:false})
    if(result.card.identity.nip!==nip||result.metadata.nip!==nip||result.metadata.entityType!=='COMPANY')return refuse()
    prepared={view:result,actorId:context.actorId,organisationId:context.organisationId!,applicationId:context.applicationId}
    return selection=Object.freeze({known:true,ready:true})
   }
  const complete=async(value:unknown,context:Readonly<OperationContext>,client:PoolClient)=>{
    if(value!==selection||!selection?.ready||!prepared||!entry||completed
      ||context.resource.version!==entry.body_digest||context.actorId!==prepared.actorId
      ||context.organisationId!==prepared.organisationId||context.applicationId!==prepared.applicationId)return refuse()
    completed=true
    const result=prepared.view
    const selectedEntry=entry
    const metadata=await measureSupplierStage('READY_REPORT_METADATA',()=>client.query<{metadata:{supplierId:string}}>(
     'SELECT srm.register_ready_report_read($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::jsonb) AS metadata',
     [context.organisationId,context.actorId,nip,selectedEntry.body_digest,context.decisionId,JSON.stringify(result.metadata.financial.scanner??null)]))
    const subject=metadata.rows[0]?.metadata
    if(!subject?.supplierId)return refuse()
    result.metadata.locationSubject={supplierId:subject.supplierId}
    result.metadata.preferenceScope=createHmac('sha256',secret).update(JSON.stringify([context.organisationId,
     JSON.stringify([context.applicationId,context.subjectUserId??context.actorId]),'scanner-preferences-v1'])).digest('hex')
    return accepted={known:true,response:await measureSupplierStage('RESPONSE_SERIALIZATION',async()=>Response.json({...result.card,metadata:result.metadata},{headers}))}
   }
  const action=async(context:Readonly<OperationContext>,client:PoolClient)=>{
   const value=probeAction(context)
   return value.ready?complete(value,context,client):accepted!
  }
  return Object.freeze({hostOptions,input,action,readResources,probeAction,complete,
   probeResult:()=>{if(!selection)return refuse();return selection},result:()=>{if(!accepted)return refuse();return accepted}})
}

/** The ordinary READY host retains exactly the same domain phase and H1/H2.
 * A composed FRESH host can use that phase without a second authorizer or DTO. */
export function createSrmReadyCompanyRead(options:CompanyReadOptions,schemaDigest:string,secret:string){
 if(options.reportAdmission||!secret||secret.length<32||!/^[a-f0-9]{64}$/.test(schemaDigest))return refuse()
 return Object.freeze({async read(request:Request,organisationId:string,rawNip:string):Promise<Readonly<{known:boolean;response:Response|null}>>{
  const phase=createSrmReadyCompanyReadPhase(options,schemaDigest,secret,request,organisationId,rawNip)
  const outcome=await createCurrentHumanReadHost<PoolClient>(phase.hostOptions).execute(phase.input,phase.action)
  const accepted=phase.result()
  if(outcome.value!==accepted)return refuse()
  return accepted
 }})
}
