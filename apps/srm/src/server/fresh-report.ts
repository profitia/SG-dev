import type {PoolClient} from 'pg'
import {createCurrentFreshReportHost,type CurrentFreshReportReadOptions} from '@profitia/platform-current-fresh-report'
import {createDelegatedJobStore} from '@profitia/platform-contracts/delegated-job'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {isCompanyReportRestricted} from '@profitia/srm-xray'
import type {SupplierXRayCard} from '@profitia/srm-xray'
import targets from '../../deployment/private-runtime-targets.json'
import {createSrmReadyCompanyReadPhase} from './ready-report-read'
import {createSrmNativePgDriver} from './native-pg-driver'
import {srmSupplierRequestDefinition} from './supplier-request-host'
import {persistSupplierRequest} from './supplier-request-operation'
import {createSrmCompanyCardRead} from './supplier-company-read'
import {searchRegistryByNip} from './registry-search'
import type {SupplierApiOptions,SupplierHttpInput} from './supplier-api-composition'
import type {SupplierNativeWorkSelection} from './supplier-request-work'
import {measureSupplierStage} from './supplier-telemetry'

const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
type CompanyOptions=SupplierApiOptions['company']
type Ports=Readonly<{
 classify?:(selection:SupplierNativeWorkSelection,signal:AbortSignal)=>Promise<'JDG'|'NOT_JDG'|'UNAVAILABLE'>
 company:(selection:SupplierNativeWorkSelection)=>Promise<SupplierXRayCard>
 jdg:(input:SupplierHttpInput)=>Promise<Response>
}>

/** Only these already protected alternate outcomes can leave COMPANY FRESH
 * before its final shared read. No native Work card is released this way. */
class AlternateRoutingOutcome extends Error {
 constructor(readonly response:Response){super('Non-prepared-company routing outcome')}
}

async function companyResponse(response:Response,request:Request,nip:string){
 const {metadata,...card}=await response.json()
 if(card.identity?.nip!==nip)return refuse()
 return Response.json({entityType:'COMPANY',card,...(metadata?{metadata}:{})},{headers:{...headers,
  ...(new URL(request.url).origin===targets.environments.development.summaryPeerRead.targetOrigin?{'X-SRM-Prepared-Company':nip}:{})}})
}

function phaseOptions(phase:ReturnType<typeof createSrmReadyCompanyReadPhase>):CurrentFreshReportReadOptions<PoolClient>{
 const base=phase.hostOptions
 if(base.module?.id!=='supplier_report')return refuse()
 return {application:base.application,binding:base.binding,module:{...base.module,id:'supplier_report'},
  independentQuery:base.independentQuery,transact:base.transact,readResources:base.readResources,
  ...(base.transactionTimeoutMs?{transactionTimeoutMs:base.transactionTimeoutMs}:{}),
  projectOutput:async(value,context,client)=>{
  const accepted=await base.projectOutput(value,context,client)
  if(accepted!==phase.result())return refuse()
  const result=phase.result()
  return result.response?{status:'READY',value:result.response}:{status:'MISS'}
 }}
}

/** A server-owned composition over the SAME domain readers, command ledger,
 * delegated dispatch, routing and native engines. Construct once per opening;
 * neither an authorization observation nor an ALLOW survives this invocation. */
export function createSrmFreshReportSearch(options:CompanyOptions,ports:Ports){
 const {ready,read,request,lookup}=options
 if(!ready||read.reportAdmission||request.reportAdmission||lookup.work.reportAdmission
  ||read.application.environment!=='development'||!read.identity.requestBoundary)return refuse()
 const receiverBoundary={...read.identity.requestBoundary,publicOrigins:read.identity.requestBoundary.publicOrigins
  .filter(origin=>origin!==targets.environments.development.summaryPeerRead.sourceOrigin)}
 const definition=srmSupplierRequestDefinition(request)
 const jobs=createDelegatedJobStore({binding:request.binding,...lookup.work.job})
 return async(input:SupplierHttpInput,childIdempotencyKey:string):Promise<Response>=>{
  const nip=input.command.nip
  const probe=createSrmReadyCompanyReadPhase(read,ready.schemaDigest,ready.secret,input.request,input.organisationId,nip)
  const final=createSrmReadyCompanyReadPhase(read,ready.schemaDigest,ready.secret,input.request,input.organisationId,nip)
  const root={application:request.application,binding:request.binding,module:request.module,
   ...createSrmNativePgDriver(request.pool,request.auditPool),requestLedger:request.requestLedger,
   transactionTimeoutMs:request.transactionTimeoutMs,...definition}
  const host=createCurrentFreshReportHost<PoolClient>({clerk:read.clerk,identity:read.identity,receiverBoundary,
   probe:phaseOptions(probe),refresh:root,read:phaseOptions(final),...(read.now?{now:read.now}:{})})
  try{
   const result=await host.execute<Response>({request:input.request,organisationId:input.organisationId,nip,
    idempotencyKey:childIdempotencyKey},{
    probe:probe.action,
    refresh:async(context,client)=>{
     const receipt=await persistSupplierRequest(context,client)
     const dispatch=await jobs.createDispatch(client.query.bind(client),context)
     if(dispatch.requestId!==receipt.requestId)return refuse()
     return receipt
    },
    work:async(selection,signal)=>{
     let companyCard:SupplierXRayCard|undefined
     const result=await searchRegistryByNip(input.organisationId,{identifier:{type:'NIP',value:nip}},{
      catalog:async(org,selected)=>{if(org!==input.organisationId||selected!==nip)return refuse();return probe.result().known},
      jdg:async(org,selected)=>{
       if(org!==input.organisationId||selected!==nip)return refuse()
       return measureSupplierStage('CEIDG_LOOKUP',async()=>{
        if(ports.classify){const classification=await ports.classify(selection,signal)
         if(classification!=='JDG')return {status:classification==='NOT_JDG'?'EMPTY':'ERROR',data:null}
        }
        const response=await ports.jdg(input)
        if(!response.ok)throw new AlternateRoutingOutcome(response)
        return (await response.json()).section
       })
      },
      company:async(org,selected)=>{
       if(org!==input.organisationId||selected.identifier.value!==nip)return refuse()
       signal.throwIfAborted()
       const card=await ports.company(selection)
       signal.throwIfAborted()
       if(card.identity.nip!==nip)return refuse()
       companyCard=card
       return card
      },
     })
     if(result.entityType==='JDG')throw new AlternateRoutingOutcome(Response.json(result,{headers}))
     if(result.entityType==='COMPANY'){
      if(result.card.general.data&&!isCompanyReportRestricted(result.card.general.data))return
      // The unchanged restricted/empty-company reader performs its own current
      // authorization. It never substitutes Work output for a prepared read.
      throw new AlternateRoutingOutcome(await companyResponse(await createSrmCompanyCardRead(read,result.card)
       .read(input.request,input.organisationId),input.request,nip))
     }
     // The previous company path also performed a current protected read for
     // EMPTY/invalid identity before disclosing its neutral routing status.
     if(companyCard)await createSrmCompanyCardRead(read,companyCard).read(input.request,input.organisationId)
     throw new AlternateRoutingOutcome(Response.json({error:result.entityType==='NOT_FOUND'
      ?'Nie znaleziono podmiotu o podanym numerze NIP.':result.unavailableProvider==='CEIDG'
       ?'Baza CEIDG chwilowo niedostępna. Spróbuj później.':'Nie udało się ustalić typu podmiotu. Spróbuj ponownie później.'},
      {status:result.entityType==='NOT_FOUND'?404:503,headers}))
    },
    read:final.action,
   })
   return companyResponse(result,input.request,nip)
  }catch(error){if(error instanceof AlternateRoutingOutcome)return error.response;throw error}
 }
}
