const paths=new Set(['/api/xray/admission','/api/xray/krs/status','/api/xray/krs/search','/api/xray/krs/verify','/api/xray/krs/lookup','/api/xray/search','/api/xray/lookup','/api/xray/report-data'])
const reportPaths=new Set(['/api/xray/krs/lookup','/api/xray/search','/api/xray/lookup','/api/xray/report-data'])
const freshReportPaths=new Set(['/api/xray/search','/api/xray/lookup','/api/xray/report-data'])
const privateKysPaths=new Set(['/api/xray/kys','/api/xray/jdg/kys'])
type Grant={token:string;nip:string;readyUntil:string;expiresAt:string;bearer:string}
const admissions=new WeakMap<typeof fetch,{grant:Grant|null;prepare:(nip:string,signal:AbortSignal)=>Promise<{readyUntil:string}>}>()
export async function prepareReport(transport:typeof fetch,nip:string,signal:AbortSignal){
 const entry=admissions.get(transport)
 if(!entry)throw Error('Przygotowanie wyszukiwania jest niedostępne.')
 return entry.prepare(nip,signal)
}
/** Prepare one server-authorized report before Search. Its opaque admission
 * and existing session token remain private to this principal-scoped transport. */
export function createKrsSessionTransport(getToken:(options?:{skipCache?:boolean})=>Promise<string|null>,transport:typeof fetch=fetch):typeof fetch{
 const entry:{grant:Grant|null;prepare:(nip:string,signal:AbortSignal)=>Promise<{readyUntil:string}>}={grant:null,prepare:async()=>{throw Error('UNAVAILABLE')}}
 let formDiagnosticFragment:string|null=null
 const run:typeof fetch=async(input,init)=>{
  if(typeof input!=='string'||!paths.has(input)&&!privateKysPaths.has(input))return transport(input,init)
  init?.signal?.throwIfAborted()
  const start=performance.now()
  let grant=reportPaths.has(input)?entry.grant:null
  if(input==='/api/xray/search'&&grant){let body;try{body=JSON.parse(String(init?.body))}catch{};if(body?.identifier!==grant.nip)grant=null}
  if(grant&&Date.parse(grant.expiresAt)<=Date.now())throw Error('Przygotowanie wyszukiwania wygasło. Wpisz ponownie numer NIP.')
  // An ordinary company request can outlive the remaining cached bearer.
  // Refresh before starting; retain the admitted bearer and all final E1 checks.
  const token=grant?.bearer??await getToken(input==='/api/xray/admission'||freshReportPaths.has(input)||privateKysPaths.has(input)?{skipCache:true}:undefined)
  if(!token)throw Error('Sesja wygasła. Zaloguj się ponownie.')
  const sessionMs=performance.now()-start
  init?.signal?.throwIfAborted()
  const headers=new Headers(init?.headers);headers.set('Authorization','Bearer '+token)
  if(grant)headers.set('X-SRM-Report-Admission',grant.token)
  if(grant&&formDiagnosticFragment)headers.set('X-SRM-Diagnostic-Admission',formDiagnosticFragment)
  const at=performance.now();let status=0,retries=0
  try{
   let response=await transport(input,{...init,headers});status=response.status
   // A provider job may outlive the short Clerk bearer. Re-enter the same
   // idempotent private intent once with current authority; never reuse the
   // company admission or retry provider/network errors with a new command.
   if(status===401&&privateKysPaths.has(input)&&init?.method==='POST'&&headers.has('Idempotency-Key')){
    init.signal?.throwIfAborted();const fresh=await getToken({skipCache:true});init.signal?.throwIfAborted()
    if(fresh){await response.body?.cancel();headers.set('Authorization','Bearer '+fresh);retries++
     response=await transport(input,{...init,headers});status=response.status}
   }
   return response
  }
  finally{try{console.info(JSON.stringify({event:'srm_client_request_timing',path:input,httpStatus:status,sessionMs:Math.round(sessionMs*100)/100,fetchMs:Math.round((performance.now()-at)*100)/100,...(retries?{sessionRefreshRetries:retries}:{})}))}catch{}}
 }
 entry.prepare=async(nip,signal)=>{
  entry.grant=null;formDiagnosticFragment=null
  if(!/^\d{10}$/.test(nip))throw Error('Podaj prawidłowy numer NIP.')
  const start=performance.now(),token=await getToken({skipCache:true});signal.throwIfAborted()
  if(!token)throw Error('Sesja wygasła. Zaloguj się ponownie.')
  const at=performance.now()
  const response=await transport('/api/xray/admission',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,
   'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({nip}),cache:'no-store',signal})
  const grant=await response.json();signal.throwIfAborted()
  if(!response.ok||!grant||grant.nip!==nip||!/^fr1\.[a-f0-9-]{36}\.[a-f0-9]{64}$/i.test(grant.token??'')||!(Date.parse(grant.readyUntil)>Date.now())||!(Date.parse(grant.expiresAt)>=Date.parse(grant.readyUntil)))throw Error('Nie udało się przygotować wyszukiwania. Spróbuj ponownie.')
  entry.grant={...grant,bearer:token}
  const diagnostic=response.headers.get('X-SRM-Diagnostic-Fragment');if(diagnostic&&/^[a-f0-9-]{36}$/i.test(diagnostic))formDiagnosticFragment=diagnostic
  const diagnosticTrace=response.headers.get('X-SRM-Diagnostic-Execution')
  console.info(JSON.stringify({event:'srm_client_form_admission_timing',sessionMs:Math.round((at-start)*100)/100,fetchMs:Math.round((performance.now()-at)*100)/100,totalMs:Math.round((performance.now()-start)*100)/100,httpStatus:response.status,
   ...(formDiagnosticFragment&&diagnosticTrace&&/^[a-f0-9-]{36}$/i.test(diagnosticTrace)?{traceId:diagnosticTrace,fragmentId:formDiagnosticFragment,clock:'BROWSER_PERFORMANCE_NOW_NOT_SERVER_CLOCK'}:{})}))
  return {readyUntil:grant.readyUntil}
 }
 admissions.set(run,entry);return run
}
