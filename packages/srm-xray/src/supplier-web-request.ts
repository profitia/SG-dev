import type {SupplierWebIdentityData} from './index'

/** A logical UI request key provides idempotence, never actor or tenant proof.
 * Uncertain delivery and pending work retain the key for the same selection. */
export function createSupplierWebRequest(nip:string,entityType:'COMPANY'|'JDG',options:{fetcher?:typeof fetch;newKey?:()=>string}={}){
 if(!/^[0-9]{10}$/.test(nip)||!['COMPANY','JDG'].includes(entityType))throw Error('Invalid website selection')
 const fetcher=options.fetcher??fetch,newKey=options.newKey??(()=>`srm-web-${crypto.randomUUID()}`)
 let key:string|undefined
 return async(signal:AbortSignal):Promise<SupplierWebIdentityData>=>{
  signal.throwIfAborted();key??=newKey()
  const response=await fetcher('/api/xray/web-identity',{method:'POST',signal,headers:{'Content-Type':'application/json','Idempotency-Key':key},
   body:JSON.stringify({identifier:nip,entityType})})
  if(!response.ok)throw Error('WEBSITE_UNAVAILABLE')
  const data=await response.json() as SupplierWebIdentityData
  if(response.status!==202)key=undefined
  return data
 }
}
