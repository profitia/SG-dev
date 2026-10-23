const paths=new Set(['/api/xray/krs/status','/api/xray/krs/search','/api/xray/krs/verify','/api/xray/krs/lookup','/api/xray/search','/api/xray/lookup','/api/xray/report-data'])
/** Refresh the existing Clerk session before each bounded KRS request. No
 * custom token, identity claim, organisation selector or authority is created. */
export function createKrsSessionTransport(getToken:(options:{skipCache:true})=>Promise<string|null>,transport:typeof fetch=fetch):typeof fetch{
 return async(input,init)=>{
  if(typeof input!=='string'||!paths.has(input))return transport(input,init)
  init?.signal?.throwIfAborted()
  const start=performance.now()
  const token=await getToken({skipCache:true})
  if(!token)throw Error('Sesja wygasła. Zaloguj się ponownie.')
  const sessionMs=performance.now()-start
  init?.signal?.throwIfAborted()
  const headers=new Headers(init?.headers);headers.set('Authorization','Bearer '+token)
  const at=performance.now();let status=0
  try{const response=await transport(input,{...init,headers});status=response.status;return response}
  finally{try{console.info(JSON.stringify({event:'srm_client_request_timing',path:input,httpStatus:status,sessionMs:Math.round(sessionMs*100)/100,fetchMs:Math.round((performance.now()-at)*100)/100}))}catch{}}
 }
}
