import type {ManualLocationInput,SupplierLocationGroup,SupplierLocationPage} from '@profitia/srm-xray'
export type LocationViewState=Readonly<{page:SupplierLocationPage|null;busy:boolean;error:string|null;blocked:boolean;sync:'PENDING'|'CURRENT'|'UNAVAILABLE'}>
class LocationRequestError extends Error{}
const initial=():LocationViewState=>({page:null,busy:false,error:null,blocked:false,sync:'PENDING'})
/** Session-scoped presentation state only. No persisted browser data, actor or
 * permission. Abort + generation fencing removes late cross-supplier results. */
export class SupplierLocationController{
 private state=initial();private generation=0;private pending=new Set<AbortController>();private listeners=new Set<()=>void>();private keys=new Map<string,string>();private sequence=0
 constructor(private readonly supplierId:string,private readonly transport:typeof fetch=(input,init)=>fetch(input,init),private readonly newKey=()=>crypto.randomUUID()){}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
 getSnapshot=()=>this.state
 private update(patch:Partial<LocationViewState>){this.state={...this.state,...patch};for(const listener of this.listeners)listener()}
 dispose=()=>{this.generation++;this.sequence++;for(const request of this.pending)request.abort();this.pending.clear();this.keys.clear();this.update(initial())}
 private async request(body:unknown,key?:string,parentSignal?:AbortSignal){
  const generation=this.generation,controller=new AbortController();this.pending.add(controller)
  try{
   const r=await this.transport('/api/supplier-locations',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(body),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000),...(parentSignal?[parentSignal]:[])])})
   if(controller.signal.aborted||generation!==this.generation)throw new DOMException('Stale location context','AbortError')
   if(!r.ok){
    if(r.status===403&&(body as {action?:string})?.action!=='READ'){
     // Denied WRITE/SYNC does not imply denied READ. Withhold the old map
     // immediately, then let a fresh protected read decide current access.
     this.update({page:null})
     await this.request({action:'READ',supplierId:this.supplierId,group:'SUPPLIER_LOCATIONS',offset:0,limit:1},undefined,controller.signal)
    }else if([401,403].includes(r.status)){this.generation++;for(const request of this.pending)request.abort();this.keys.clear();this.update({page:null,blocked:true})}
    throw new LocationRequestError(r.status===409?'Lokalizacja zmieniła się. Odczytaj aktualny zapis przed kolejną zmianą.':r.status===429?'Limit zapisu został osiągnięty. Spróbuj później.':'Nie można teraz odczytać lub zapisać lokalizacji.')
   }
   const value=await r.json();if(controller.signal.aborted||generation!==this.generation)throw new DOMException('Stale location context','AbortError')
   return value
  }catch(error){if(error instanceof LocationRequestError||controller.signal.aborted||generation!==this.generation)throw error;throw new LocationRequestError('Nie można teraz połączyć się z lokalizacjami. Ponów odczyt.')}finally{this.pending.delete(controller)}
 }
 async load(group:SupplierLocationGroup|'ALL'='ALL',offset=0){
  const seq=++this.sequence,g=this.generation;this.update({busy:true,error:null})
  try{const page=await this.request({action:'READ',supplierId:this.supplierId,group,offset,limit:50}) as SupplierLocationPage
   if(seq!==this.sequence||g!==this.generation)return
   if(page.supplierId!==this.supplierId||!Array.isArray(page.items)||page.offset!==offset||!Number.isInteger(page.total)||page.total<page.items.length)throw Error('Nieprawidłowa odpowiedź lokalizacji.')
   const previous=this.state.page
   // Each poll still reauthorizes. Keep the projection mounted only when the
   // fresh protected response is identical; errors/revocation still clear it.
   this.update({page:previous&&JSON.stringify(previous)===JSON.stringify(page)?previous:page,busy:false})
  }catch(e){if(g===this.generation&&seq===this.sequence)this.update({page:null,busy:false,error:e instanceof Error?e.message:'Lokalizacje niedostępne.'});else if(this.state.blocked)this.update({busy:false})}
 }
 async mapPage(group:SupplierLocationGroup,offset:number,signal:AbortSignal):Promise<SupplierLocationPage>{
  const result=await this.request({action:'READ',supplierId:this.supplierId,group,offset,limit:50},undefined,signal) as SupplierLocationPage
  signal.throwIfAborted()
  if(this.state.blocked||result.supplierId!==this.supplierId||!Array.isArray(result.items)||result.items.length>50)throw Error('Lokalizacje niedostępne.')
  return result
 }
 async sync(){
  const g=this.generation;this.update({sync:'PENDING'})
  try{const r=await this.request({action:'SYNC',supplierId:this.supplierId});if(g===this.generation)this.update({sync:r.status==='CURRENT'?'CURRENT':'UNAVAILABLE'})}
  catch{if(g===this.generation)this.update({sync:'UNAVAILABLE'});else if(this.state.blocked)this.update({busy:false,sync:'UNAVAILABLE'})}
 }
 async save(action:'CREATE'|'UPDATE'|'DEACTIVATE',locationId:string|null,expectedVersion:string|null,command:ManualLocationInput|null){
  if(this.state.blocked)throw Error('Odczytaj ponownie raport po potwierdzeniu dostępu.')
  const body={action,supplierId:this.supplierId,locationId,expectedVersion,command},logical=JSON.stringify(body)
  const key=this.keys.get(logical)??this.newKey();this.keys.set(logical,key)
  // Keep the same logical key on an uncertain network response; delete only
  // after the admitted response is received. A changed command gets a new key.
  await this.request(body,key);this.keys.delete(logical)
 }
}
