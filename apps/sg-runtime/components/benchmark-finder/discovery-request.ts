/** Session credentials come from the official SDK getter. No organisation,
 * role, user ID, database selector or client-side ALLOW is manufactured here. */
export function createDiscoveryRequester(options:{mode:()=> 'clerk'|'legacy_demo'|'unavailable';getToken:()=>Promise<string|null>;
 origin:()=>string;fetch:typeof fetch;newKey:()=>string}){
 const pending=new Map<string,string>();let closed=false
 const request=async(input:string,init:RequestInit={}):Promise<Response>=>{
  if(closed)throw Error('Session unavailable')
  const mode=options.mode()
  if(mode==='legacy_demo')return options.fetch(input,init)
  if(mode!=='clerk')throw Error('Session unavailable')
  const origin=options.origin(),url=new URL(input,origin),method=init.method??'GET'
  const accepted=(url.pathname==='/api/benchmark/search'&&['GET','POST'].includes(method))
   ||(url.pathname==='/api/benchmark/metadata'||/^\/api\/benchmark\/metadata\/[^/]+\/values$/.test(url.pathname))&&method==='GET'
   ||['/api/benchmark/context','/api/benchmark/ai-search'].includes(url.pathname)&&method==='POST'
  if(url.origin!==origin||url.username||url.password||url.hash||!accepted||init.body!==undefined&&typeof init.body!=='string'
   ||init.credentials!==undefined&&init.credentials!=='same-origin'||init.redirect!==undefined&&init.redirect!=='error')throw Error('Finder request unavailable')
  const token=await options.getToken();if(closed||!token||/[\s,]/.test(token)||token.length>8192)throw Error('Session unavailable')
  const signature=JSON.stringify([method,url.pathname+url.search,init.body??null])
  let key=pending.get(signature);if(!key){key=options.newKey();if(!/^finder_[A-Za-z0-9_-]{16,100}$/.test(key))throw Error('Finder request unavailable');pending.set(signature,key)}
  const headers=new Headers(init.headers)
  if(headers.has('authorization')||headers.has('x-profitia-idempotency-key'))throw Error('Finder credential is server verified')
  headers.set('authorization','Bearer '+token);headers.set('x-profitia-idempotency-key',key)
  const response=await options.fetch(url.pathname+url.search,{...init,headers,cache:'no-store',credentials:'same-origin',redirect:'error'})
  if(closed)throw Error('Session unavailable')
  if(response.ok&&response.status!==202&&pending.get(signature)===key)pending.delete(signature)
  return response
 }
 return Object.assign(request,{close:()=>{closed=true;pending.clear()}})
}
