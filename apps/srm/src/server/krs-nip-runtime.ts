import type {SupplierSelection,SupplierXRayCard} from '@profitia/srm-xray'
import type {SupplierHttpInput,SrmSupplierApi} from './supplier-api-composition'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
export type RegistryRoute=Readonly<{provider:'KRS'|'MGBI';fallbackReason?:string}>
export type KrsNipCompany=Readonly<{company(input:SupplierHttpInput,afterCeidg:boolean):Promise<Response>}>
type Resolution={status:'PRIMARY';selection:SupplierSelection;general:SupplierXRayCard['general']}|{status:'FALLBACK';reason:string}
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
const publicSection=<T extends {source:unknown}>(v:T)=>{const {source,...value}=v;return value}
/** Only native server composition supplies the resolver. HTTP callers never
 * choose provider, CEIDG classification, identities or paid retry policy. */
export function createKrsNipCompany(options:{api:SrmSupplierApi;resolve(input:SupplierHttpInput):Promise<Resolution>;
 observe:(event:Readonly<{event:'REGISTRY_ROUTE';provider:'KRS'|'MGBI';reason:string;durationMs:number}>)=>void;now?:()=>number}):KrsNipCompany{
 const now=options.now??Date.now
 return Object.freeze({async company(input,afterCeidg){
  if(!afterCeidg){
   const r=await options.api.jdg(input);if(!r.ok)return r
   const value=await r.json();if(value.section?.status!=='EMPTY')return Response.json({error:'Nie potwierdzono braku wpisu CEIDG.'},{status:409,headers})
  }
  const start=now(),resolved=await options.resolve(input)
  input.request.signal.throwIfAborted()
  if(resolved.status==='FALLBACK'){
   if(!/^[A-Z0-9_]{1,100}$/.test(resolved.reason))throw new OperationDenied('POLICY_UNAVAILABLE')
   const response=await options.api.company(input);if(!response.ok)return response
   const card=await response.json();if(card.identity?.nip!==input.command.nip)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
   options.observe({event:'REGISTRY_ROUTE',provider:'MGBI',reason:resolved.reason,durationMs:now()-start})
   return Response.json({...card,registryRoute:{provider:'MGBI',fallbackReason:resolved.reason}},{headers})
  }
  const {selection,general}=resolved
  if(selection.nip!==input.command.nip||general.data?.nip!==selection.nip||general.data.krs!==selection.krs||general.source.provider!=='KRS')throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const financial={status:'NOT_REQUESTED',retrievedAt:null,effectiveAt:null,data:null,warnings:[]}
  options.observe({event:'REGISTRY_ROUTE',provider:'KRS',reason:'VERIFIED',durationMs:now()-start})
  // Existing KRS Financial BFF is the sole continuation; no new MGBI client.
  return Response.json({identity:{nip:selection.nip,krs:selection.krs,name:selection.name},general:publicSection(general),financial,kys:financial,
   krsSelection:selection,registryRoute:{provider:'KRS'}},{headers})
 }})
}
