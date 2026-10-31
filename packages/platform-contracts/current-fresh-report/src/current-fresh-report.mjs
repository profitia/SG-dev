import {createHash} from 'node:crypto'
import {createCurrentHumanReadIdentity,currentHumanReadSourceDigest} from '@profitia/platform-contracts/current-human-read'
import {createPrivateOperationHost,privateOperationHostSourceDigest} from '@profitia/platform-contracts/private-operation-host'
import {createAccessStore,accessStoreSourceDigest} from '@profitia/platform-contracts/access-store'
import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest,operationSourceDigest} from '@profitia/platform-contracts/operation-context'
import {validRequestIdempotencyKey} from '@profitia/platform-contracts/request-ledger'
import {createPublicIdentityRequestBoundary} from '@profitia/platform-contracts/public-request'

export const CURRENT_FRESH_REPORT_CONTRACT=Object.freeze({id:'profitia.current-fresh-report',version:'1.0.0'})
const denied=(reason='UNVERIFIED_IDENTITY')=>{throw new OperationDenied(reason)}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const exact=(v,keys)=>!!v&&Object.getPrototypeOf(v)===Object.prototype
 &&Reflect.ownKeys(v).length===keys.length&&Object.keys(v).sort().join(',')===[...keys].sort().join(',')
 &&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d&&d.enumerable)
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const fingerprint=r=>operationPayloadDigest([r.url,r.method,[...r.headers].sort((a,b)=>a[0].localeCompare(b[0]))])
const readEnvelope=value=>{
 if(exact(value,['status'])&&value.status==='MISS')return value
 if(exact(value,['status','value'])&&value.status==='READY')return value
 return denied('POLICY_UNAVAILABLE')
}
const readKeys=['application','binding','module','independentQuery','transact','readResources','projectOutput','transactionTimeoutMs']
const rootKeys=[...readKeys,'requestLedger','describeOutcome']
function configuration(value,operation){
 const allowed=operation==='supplier.report.read'?readKeys:rootKeys
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==Object.keys(value).length
  ||Object.keys(value).some(k=>!allowed.includes(k))||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!('value'in d)||!d.enumerable)
  ||value.application?.operations?.join(',')!==operation||value.application.environment!=='development'
  ||value.module?.id!=='supplier_report'||value.binding?.service!==undefined)throw TypeError('Explicit current HUMAN report configuration required')
 const fixed={...value,application:freeze(structuredClone(value.application)),binding:freeze(structuredClone(value.binding)),module:freeze(structuredClone(value.module))}
 if(value.requestLedger)fixed.requestLedger=freeze(structuredClone(value.requestLedger))
 // Canonical constructor validation performs no external calls.
 createPrivateOperationHost({...fixed,createAuthenticator:()=>async()=>null})
 return Object.freeze(fixed)
}

/** One opening, with short canonical SQL transactions separated by the existing
 * Source/Work flow. No account/ALLOW cache, new authorizer, SQL scope or writer.
 * The immutable official actor may span the operation; current SQL authority is
 * locked on EACH transaction. H2 still closes a MISS. Root outcome and final
 * disclosure each obtain a fresh official session/account/binding observation.
 * Existing READY, native Work and Source hosts are not modified by this module.
 * Construct per ingress: this instance intentionally permits one execute only.
 */
export function createCurrentFreshReportHost(options){
 if(!options||Object.getPrototypeOf(options)!==Object.prototype||Reflect.ownKeys(options).length!==Object.keys(options).length
  ||Object.keys(options).some(k=>!['clerk','identity','receiverBoundary','probe','refresh','read','now'].includes(k))
  ||Object.values(Object.getOwnPropertyDescriptors(options)).some(d=>!('value'in d)||!d.enumerable))throw TypeError('Explicit current FRESH composition required')
 const {clerk,identity,receiverBoundary,probe,refresh,read,now=Date.now}=options
 if(typeof now!=='function')throw TypeError('Current operation clock required')
 // Credential authorizedParties may include the SG2 caller. They are NOT
 // alternate HTTP receiver origins. Preserve the separately owned ingress
 // boundary before the peer adapter normalizes identity-verifier input only.
 const ingress=createPublicIdentityRequestBoundary(receiverBoundary)
 const p=configuration(probe,'supplier.report.read'),r=configuration(refresh,'supplier.report.refresh'),f=configuration(read,'supplier.report.read')
 const same=v=>operationPayloadDigest(v)
 if(!identity||identity.appId!==p.application.appId||identity.environment!==p.application.environment
  ||identity.issuer!==p.application.identityIssuer||same(p.binding)!==same(r.binding)||same(p.binding)!==same(f.binding)
  ||same(p.module)!==same(r.module)||same(p.module)!==same(f.module)
  ||[r,f].some(v=>same({...v.application,operations:p.application.operations})!==same(p.application)))throw TypeError('One exact application, module and private store required')
 const id=freeze(structuredClone(identity)),store=createAccessStore({binding:p.binding,now})
 createCurrentHumanReadIdentity({client:clerk,application:id,resolveBinding:async()=>null,now}).close()
 let used=false
 return Object.freeze({hostContract:CURRENT_FRESH_REPORT_CONTRACT,
  async execute(input,actions){
   if(used)return denied('ACCESS_BASIS_INVALID')
   used=true
   if(!exact(input,['request','organisationId','nip','idempotencyKey'])||!(input.request instanceof Request)
    ||!uuid.test(input.organisationId??'')||!/^\d{10}$/.test(input.nip??'')||input.nip==='0000000000'
    ||input.idempotencyKey!==null&&!validRequestIdempotencyKey(input.idempotencyKey)
    ||!exact(actions,['probe','refresh','work','read'])||Object.values(actions).some(v=>typeof v!=='function'))return denied('CONTEXT_INVALID')
   const request=input.request,transport=fingerprint(request),organisationId=input.organisationId,nip=input.nip,idempotencyKey=input.idempotencyKey
   const callbacks=Object.freeze({...actions})
   const command=freeze({kind:'SUPPLIER_REPORT',nip}),payload=freeze({entityType:'COMPANY',nip})
   let actor=null,key=null,identityBinding=null,phase='PROBE',rootId=null
   const identities=[]
   const alive=()=>{request.signal.throwIfAborted();if(!ingress(request)||fingerprint(request)!==transport)return denied();if(phase==='CLOSED')return denied()}
   const sameActor=fresh=>{alive();if(!fresh||!actor||same(fresh)!==same(actor))return denied();return fresh}
   const currentBinding=async(resolveBinding,capture)=>{
    alive();if(!key||!identityBinding||!actor)return denied()
    const binding=await resolveBinding(key)
    alive();if(!binding||same(binding)!==same(identityBinding))return denied()
    if(capture)capture(freeze(structuredClone(binding)))
    return actor
   }
   let entry=null,entryBindingReads=0
   const initial=resolveBinding=>{
    if(entry)return denied('POLICY_UNAVAILABLE')
    entry=createCurrentHumanReadIdentity({client:clerk,application:id,now,resolveBinding:async selected=>{
     const binding=++entryBindingReads===1?await resolveBinding(selected):await store.resolveBinding(p.independentQuery,selected)
     if(entryBindingReads===1){key=freeze(structuredClone(selected));identityBinding=binding&&freeze(structuredClone(binding))}
     return binding
    }})
    identities.push(entry)
    return entry
   }
   const observe=async(base,lockedBinding=null)=>{
    alive()
    const fresh=createCurrentHumanReadIdentity({client:clerk,application:id,now,
     // Only root OUTCOME supplies this row: the unchanged canonical host has
     // acquired and still holds its current SQL authority fence. Reusing that
     // exact locked binding inside the SAME transaction is not cross-phase
     // authority caching. Disclosure keeps its independent current read.
     resolveBinding:selected=>lockedBinding?(same(selected)===same(key)?lockedBinding:null):store.resolveBinding(base.independentQuery,selected)})
    identities.push(fresh)
    return sameActor(await fresh.authenticate(request))
   }
   const operation=(operation,resourceId,body)=>({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
    operation,resourceId,organisationId,payload:body,request})
   const sharedRead=async(base,action,first)=>{
    let resourceInput=null,version=null,authCalls=0
    const host=createPrivateOperationHost({...base,now,
     createAuthenticator:({resolveBinding})=>async original=>{
      alive();if(original!==request||++authCalls!==1)return denied()
      if(first){actor=await initial(resolveBinding).authenticate(request);if(!actor)return denied();return actor}
      return currentBinding(resolveBinding)
     },
     readResources:async state=>{
      if(resourceInput)return denied('POLICY_UNAVAILABLE')
      resourceInput=state
      const resources=await base.readResources(state)
      if(resources?.resource?.dataClass!=='SHARED_KNOWLEDGE'||resources.inputs!==undefined)return denied('RESOURCE_SCOPE_MISMATCH')
      version=same(resources);return resources
     },
     projectOutput:async(value,context,transaction)=>{
      const output=readEnvelope(await base.projectOutput(value,context,transaction));alive()
      const fresh=first?sameActor(await entry.revalidate(request,actor)):await observe(base)
      const resources=await base.readResources({...resourceInput,actor:fresh})
      if(resources?.resource?.dataClass!=='SHARED_KNOWLEDGE'||resources.inputs!==undefined||same(resources)!==version)return denied('RESOURCE_VERSION_CONFLICT')
      alive();return output
     },
    })
    return readEnvelope((await host.execute(operation('supplier.report.read','supplier-report:COMPANY:'+nip,payload),action)).value)
   }
   try{
    alive()
    const cached=await sharedRead(p,callbacks.probe,true)
    if(cached.status==='READY')return cached.value
    phase='REFRESH'
    if(!validRequestIdempotencyKey(idempotencyKey))return denied('CONTEXT_INVALID')
    let rootAuth=0,rootBinding=null
    const host=createPrivateOperationHost({...r,now,
     createAuthenticator:({resolveBinding})=>async original=>{
      alive();if(original!==request||++rootAuth!==1)return denied()
      return currentBinding(resolveBinding,binding=>{rootBinding=binding})
     },
     projectOutput:async(value,context,transaction)=>{
      const reservation=context.requestReservation
      if(!reservation||!uuid.test(reservation.requestId??''))return denied('POLICY_UNAVAILABLE')
      const output=await r.projectOutput(value,context,transaction)
      rootId=reservation.requestId;return output
     },
     describeOutcome:async(value,context,transaction)=>{
      const outcome=r.describeOutcome?await r.describeOutcome(value,context,transaction):'SUCCEEDED'
      if(!rootBinding)return denied('POLICY_UNAVAILABLE')
      await observe(r,rootBinding);return outcome
     },
    })
    await host.execute({...operation('supplier.report.refresh','supplier-request:'+operationPayloadDigest(command),command),idempotencyKey},callbacks.refresh)
    rootBinding=null
    alive();if(!rootId)return denied('POLICY_UNAVAILABLE')
    phase='WORK'
    // Existing receiver-specific Source/Work hosts keep their own current
    // account, cost, SQL, audit and publication checks. No SQL transaction from
    // probe/admission is live here. Their committed receipts remain their own.
    if(await callbacks.work(freeze({requestId:rootId,organisationId,command}),request.signal)!==undefined)return denied('POLICY_UNAVAILABLE')
    alive();phase='READ'
    const result=await sharedRead(f,callbacks.read,false)
    if(result.status!=='READY')return denied('POLICY_UNAVAILABLE')
    return result.value
   }finally{
    phase='CLOSED';for(const flow of identities)flow.close()
    actor=null;key=null;identityBinding=null;entry=null;rootId=null
   }
  },
 })
}

export async function currentFreshReportSourceDigest(){
 const fs=await import('node:fs')
 return createHash('sha256').update(fs.readFileSync(new URL('./current-fresh-report.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./current-fresh-report.d.mts',import.meta.url)))
  .update(fs.readFileSync(new URL('../package.json',import.meta.url)))
  .update(await currentHumanReadSourceDigest()).update(await privateOperationHostSourceDigest())
  .update(await accessStoreSourceDigest()).update(await operationSourceDigest()).digest('hex')
}
