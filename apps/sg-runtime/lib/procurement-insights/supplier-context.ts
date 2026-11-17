import {readXRayJson} from '@profitia/srm-xray/workflow-contract'
import {PRESENTATION_ROUTES} from '@profitia/srm-xray/full-report-operations'
import {createAppShellFullXRayTransport} from '../appshell/xray-full-transport'

/** A presentation selection, never permission or an alternative supplier catalog. */
export type SupplierContext=Readonly<{krs:string;name:string;nip:string;selectionRef:string}>
export class SupplierContextError extends Error {constructor(readonly status:number){super('SUPPLIER_CONTEXT_UNAVAILABLE')}}
const record=(value:unknown,keys:string[]):value is Record<string,unknown>=>!!value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).sort().join(',')===[...keys].sort().join(',')
function identity(value:Record<string,unknown>,expectedNip:string):SupplierContext{
 if(!/^\d{10}$/.test(expectedNip)||value.nip!==expectedNip||typeof value.krs!=='string'||!/^\d{10}$/.test(value.krs)
  ||typeof value.name!=='string'||!value.name.trim()||value.name!==value.name.trim()||value.name.length>1000||/[\x00-\x1f\x7f]/.test(value.name)
  ||typeof value.selectionRef!=='string'||!/^[a-f0-9]{64}$/.test(value.selectionRef))throw new SupplierContextError(502)
 return {krs:value.krs,name:value.name,nip:expectedNip,selectionRef:value.selectionRef}
}
export function readSrmSupplierSelection(value:unknown,nip:string):SupplierContext{
 if(!record(value,['krs','name','nip','locality','selectionRef'])||value.locality!==null&&(typeof value.locality!=='string'||value.locality.length>1000))throw new SupplierContextError(502)
 return identity(value,nip)
}
export const supplierNameMatches=(expected:string,actual:string)=>expected.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('pl-PL')===actual.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('pl-PL')
export function supplierObservationSeed(value:SupplierContext){
 return {name:value.name.length<=200?value.name:'NIP '+value.nip,subject:value.nip,subjectKind:'company',phrases:[...new Set([...(value.name.length<=200?[value.name]:[]),value.nip])]}
}
export async function loadSupplierContext(getToken:()=>Promise<string|null>,nip:string,signal:AbortSignal,transport:typeof fetch=fetch):Promise<SupplierContext>{
 if(!/^\d{10}$/.test(nip))throw new SupplierContextError(400)
 signal.throwIfAborted()
 const response=await createAppShellFullXRayTransport(getToken,transport)(PRESENTATION_ROUTES.registrySelection.native,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nip}),signal})
 if(!response.ok){void response.body?.cancel();throw new SupplierContextError(response.status)}
 return readSrmSupplierSelection(await readXRayJson(response,8192,signal),nip)
}
