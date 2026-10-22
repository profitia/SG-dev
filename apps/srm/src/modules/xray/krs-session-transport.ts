const paths=new Set(['/api/xray/krs/status','/api/xray/krs/search','/api/xray/krs/verify','/api/xray/krs/lookup'])
/** Refresh the existing Clerk session before each bounded KRS request. No
 * custom token, identity claim, organisation selector or authority is created. */
export function createKrsSessionTransport(getToken:(options:{skipCache:true})=>Promise<string|null>,transport:typeof fetch=fetch):typeof fetch{
 return async(input,init)=>{
  if(typeof input!=='string'||!paths.has(input))return transport(input,init)
  const token=await getToken({skipCache:true})
  if(!token)throw Error('Sesja wygasła. Zaloguj się ponownie.')
  const headers=new Headers(init?.headers);headers.set('Authorization','Bearer '+token)
  return transport(input,{...init,headers})
 }
}
