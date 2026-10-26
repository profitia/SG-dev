import type {SupplierSelection,SupplierXRayCard} from '@profitia/srm-xray'
import type {SupplierHttpInput,SrmSupplierApi} from './supplier-api-composition'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {measureSupplierStage} from './supplier-telemetry'
export type RegistryRoute=Readonly<{provider:'KRS'|'MGBI';fallbackReason?:string}>
export type KrsNipCompany=Readonly<{company(input:SupplierHttpInput,afterCeidg:boolean):Promise<Response>;search(input:SupplierHttpInput):Promise<Response>}>
type Resolution={status:'PRIMARY';selection:SupplierSelection;general:SupplierXRayCard['general']}|{status:'FALLBACK';reason:string}
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
const publicSection=<T extends {source:unknown}>(v:T)=>{const {source,...value}=v;return value}
const classifyAbsence=new Set(['GUS_NO_RECORD','GUS_NOT_LEGAL_ENTITY','GUS_LOCAL_UNIT_UNSUPPORTED','GUS_REPORT_EMPTY','GUS_KRS_MISSING','GUS_REGISTER_NOT_KRS_ENTREPRENEURS','GUS_REGON_MISSING'])
/** Only native server composition supplies the resolver. HTTP callers never
 * choose provider, CEIDG classification, identities or paid retry policy. */
export function createKrsNipCompany(options:{api:SrmSupplierApi;resolve(input:SupplierHttpInput):Promise<Resolution>;
 observe:(event:Readonly<{event:'REGISTRY_ROUTE';provider:'KRS'|'MGBI';reason:string;durationMs:number}>)=>void;now?:()=>number;primary?:RegistryRoute['provider']}):KrsNipCompany{
 if(options.primary!==undefined&&!['KRS','MGBI'].includes(options.primary))throw new OperationDenied('POLICY_UNAVAILABLE')
 const now=options.now??Date.now,primary=options.primary??'KRS'
 async function resolve(input:SupplierHttpInput,afterCeidg:boolean):Promise<{kind:'COMPANY'|'JDG'|'ERROR';response:Response}>{
  // A server-selected MGBI primary enters the existing native company flow
  // directly. It never spends the GUS/KRS deadline before a planned MGBI call.
  const start=now(),resolved:Resolution=primary==='MGBI'
   ?{status:'FALLBACK',reason:'MGBI_PRIMARY'}:await options.resolve(input)
  input.request.signal.throwIfAborted()
  if(resolved.status==='FALLBACK'){
   if(!/^[A-Z0-9_]{1,100}$/.test(resolved.reason))throw new OperationDenied('POLICY_UNAVAILABLE')
   let ceidgEmpty=afterCeidg
   const classify=async()=>{
    const r=await measureSupplierStage('CEIDG_LOOKUP',()=>options.api.jdg(input));if(!r.ok)return {kind:'ERROR' as const,response:r}
    const value=await r.json(),section=value.section
    if(['SUCCESS','PARTIAL'].includes(section?.status)&&section.data?.entries?.some((entry:{nip?:unknown})=>entry.nip===input.command.nip))
     return {kind:'JDG' as const,response:Response.json({entityType:'JDG',nip:input.command.nip,section},{headers})}
    if(section?.status!=='EMPTY')return {kind:'ERROR' as const,response:Response.json({error:'Baza CEIDG chwilowo niedostępna. Spróbuj później.'},{status:503,headers})}
    ceidgEmpty=true;return null
   }
   // Registry absence is a classification result, never an availability error.
   // A technical GUS/KRS failure retains the separately authorized MGBI fallback.
   if(!afterCeidg&&classifyAbsence.has(resolved.reason)){
    const classified=await classify();if(classified)return classified
   }
   const response=await options.api.company(input);if(!response.ok)return {kind:'ERROR',response}
   const card=await response.json();if(card.identity?.nip!==input.command.nip)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
   options.observe({event:'REGISTRY_ROUTE',provider:'MGBI',reason:resolved.reason,durationMs:now()-start})
   if(card.general?.status==='EMPTY'){
    if(!ceidgEmpty){const classified=await classify();if(classified)return classified}
    return {kind:'ERROR',response:Response.json({error:'Nie znaleziono podmiotu o podanym numerze NIP.'},{status:404,headers})}
   }
   if(!['SUCCESS','PARTIAL'].includes(card.general?.status))return {kind:'ERROR',response:Response.json({error:'Nie udało się ustalić typu podmiotu. Spróbuj ponownie później.'},{status:503,headers})}
   if(card.general.data?.nip!==input.command.nip)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
   return {kind:'COMPANY',response:Response.json({...card,registryRoute:{provider:'MGBI',fallbackReason:resolved.reason}},{headers})}
  }
  const {selection,general}=resolved
  if(selection.nip!==input.command.nip||general.data?.nip!==selection.nip||general.data.krs!==selection.krs||general.source.provider!=='KRS')throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const financial={status:'NOT_REQUESTED',retrievedAt:null,effectiveAt:null,data:null,warnings:[]}
  options.observe({event:'REGISTRY_ROUTE',provider:'KRS',reason:'VERIFIED',durationMs:now()-start})
  // Existing KRS Financial BFF is the sole continuation; no new MGBI client.
  return {kind:'COMPANY',response:Response.json({identity:{nip:selection.nip,krs:selection.krs,name:selection.name},general:publicSection(general),financial,kys:financial,
   krsSelection:selection,registryRoute:{provider:'KRS'}},{headers})}
 }
 return Object.freeze({async company(input:SupplierHttpInput,afterCeidg:boolean){
  const result=await resolve(input,afterCeidg)
  return result.kind==='JDG'?Response.json({error:'Podany NIP ma wpis CEIDG. Użyj wyszukiwania dostawcy.'},{status:409,headers}):result.response
 },async search(input:SupplierHttpInput){
  const result=await resolve(input,false)
  if(result.kind!=='COMPANY')return result.response
  const {krsSelection,registryRoute,...card}=await result.response.json()
  return Response.json({entityType:'COMPANY',card,...(krsSelection?{krsSelection}:{}),registryRoute},{headers})
 }})
}
