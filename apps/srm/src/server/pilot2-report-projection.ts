import {createHash,createHmac} from 'node:crypto'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {bindOrganizationTransaction} from './db'
import {readReportData} from './report-data'
import {readSharedFinancialSource} from './shared-financial-read'
import {projectSrmReportDataResponse} from './report-output'
import {measureSupplierStage} from './supplier-telemetry'
import {createPilot2HumanRuntime,getPilot2HumanOptions,type Pilot2PrivateProjection} from './pilot2-human-runtime'

const deny=():never=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
type Env=Readonly<Record<string,string|undefined>>

/** One explicit data port into the original report engine. Public values come
 * from the isolated catalog. Source documents, KYS and persisted Scanner
 * frames are selected by the existing canonical HUMAN transaction and its
 * organisation. No private table in the Staging clone is ever consulted. */
export function pilot2PrivateReportProjection(secret:string):Pilot2PrivateProjection{
 if(typeof secret!=='string'||secret.length<32)return deny()
 return Object.freeze({output:projectSrmReportDataResponse,
  async project(context,privateClient,publicClient,selection,version){
   if(context.operation!=='supplier.report.project'||context.actorKind!=='HUMAN'
    ||!context.organisationId||!context.actorId||context.subjectUserId&&context.subjectUserId!==context.actorId
    ||context.resource.dataClass!=='ORGANISATION_PRIVATE'
    ||context.resource.ownerOrganisationId!==context.organisationId
    ||context.resource.id!=='supplier-report:COMPANY:'+selection.nip||selection.entityType!=='COMPANY')return deny()
   await privateClient.query("SELECT set_config('srm.organization_id',$1,true)",[context.organisationId])
   const pool=bindOrganizationTransaction(context.organisationId,privateClient)
   const body=await measureSupplierStage('REPORT_ASSEMBLY',()=>readReportData(context.organisationId!,selection,new Date(),pool,
    ()=>readSharedFinancialSource(publicClient,context.organisationId!,selection,version)))
   body.preferenceScope=createHmac('sha256',secret).update(JSON.stringify([context.organisationId,
    JSON.stringify([context.applicationId,context.subjectUserId??context.actorId]),'scanner-preferences-v1'])).digest('hex')
   return Response.json(body,{headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}})
  },
 })
}

let runtime:ReturnType<typeof createPilot2HumanRuntime>|undefined,configuration:string|undefined
export function getPilot2ScannerRuntime(env:Env=process.env){
 if(env.SRM_PILOT2_PRIVATE_SCANNER!=='true')return deny()
 const options=getPilot2HumanOptions(env),secret=env.SRM_DEMO_SESSION_SECRET??''
 if(secret.length<32)return deny()
 const key=createHash('sha256').update(secret).digest('hex')
 if(configuration&&configuration!==key)return deny()
 configuration=key
 return runtime??=createPilot2HumanRuntime({...options,privateProjection:pilot2PrivateReportProjection(secret)})
}
