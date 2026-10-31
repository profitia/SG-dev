/** Same-origin readiness only; the map channel still performs a fresh E1 read. */
export async function prepareSupplierMapRuntime(supplierId:string,signal:AbortSignal,transport:typeof fetch=fetch){
 signal.throwIfAborted()
 const response=await transport('/api/supplier-locations?supplierId='+encodeURIComponent(supplierId),{method:'GET',credentials:'same-origin',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(65000)])})
 signal.throwIfAborted()
 if(!response.ok)throw Error('Mapa jest chwilowo niedostępna.')
 const value=await response.json();signal.throwIfAborted()
 if(!value||Object.keys(value).join(',')!=='ready'||value.ready!==true)throw Error('Mapa jest chwilowo niedostępna.')
}
