/** Narrow same-origin BFF transport. SDK credentials are acquired per operation;
 * no browser tenant claim authorizes a resource. */
export function createPciRequester(options:{getToken:()=>Promise<string|null>;fetch:typeof fetch}){
  let closed=false;const pending=new Set<AbortController>()
  const request=async(body:string)=>{
    if(closed)throw Error('SESSION_UNAVAILABLE')
    const controller=new AbortController();pending.add(controller)
    try{
      const token=await options.getToken()
      if(closed||controller.signal.aborted)throw new DOMException('Aborted','AbortError')
      if(!token||token.length>8192||! /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('SESSION_UNAVAILABLE')
      const response=await options.fetch('/api/cost-analysis/price-change-index',{method:'POST',body,
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal})
      if(closed||controller.signal.aborted){await response.body?.cancel();throw new DOMException('Aborted','AbortError')}
      return response
    }finally{pending.delete(controller)}
  }
  return Object.assign(request,{close(){closed=true;for(const c of pending)c.abort();pending.clear()}})
}
