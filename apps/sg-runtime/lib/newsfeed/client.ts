export type Observation={id:string;contractVersion:'1.2.0';readOnly?:boolean;name:string;subjectKind:string;subject:string;status:'ACTIVE'|'PAUSED';version:number;phrases:string[];request:{contractVersion:string;family:string;provider:string;operation:string;criteria:Record<string,unknown>};schedule:Schedule|null;notifications:boolean;monitoringState:string;nextDueAt:string|null;updatedAt:string}
export type Schedule={frequency:'DAILY'|'WEEKLY'|'MONTHLY';timeZone:string;localTime:string;startDate:string;endDate:string|null;weekdays?:number[];monthDay?:number|null}
export type Publication={id:string;kind:string;url:string;headline:string|null;publishedAt:string|null;detectedAt:string;provider?:string;excerpt:string|null;excerptStatus:string;topics?:Array<{id:string;name:string}>}
export type Run={id:string;status:string;createdAt:string;completedAt:string|null;detectedCount:number;publicationCount:number;observationVersion:number;criteriaSnapshot:unknown}
export type Page<T>={items:T[];nextCursor:string|null}
export type Statistics={status:'AVAILABLE'|'PARTIAL'|'NO_HISTORY';total:number;undated:number;timeZone:string;dateBasis:string;phrases:Array<{phrase:string;count:number}>;days:Array<{date:string;total:number;counts:number[]}>}
export class NewsfeedError extends Error{constructor(readonly code:string,readonly status:number){super(code)}}
export function createNewsfeedClient(getToken:()=>Promise<string|null>,fetcher:typeof fetch=fetch){
 return async<T>(path:string,{method='GET',body,signal,idempotencyKey}:{method?:string;body?:unknown;signal?:AbortSignal;idempotencyKey?:string}={}):Promise<T>=>{
  if(!/^\/(observations|notifications|invitations|feed)(?:\/[^?#]*)?(?:\?[^#]*)?$/.test(path))throw new NewsfeedError('INVALID_REQUEST',400)
  const token=await getToken();if(!token)throw new NewsfeedError('AUTHENTICATION_REQUIRED',401)
  signal?.throwIfAborted()
  const r=await fetcher('/api/v1/newsfeed'+path,{method,headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'}),...(idempotencyKey?{'idempotency-key':idempotencyKey}:{})},body:body===undefined?undefined:JSON.stringify(body),signal,cache:'no-store',credentials:'omit',redirect:'error'})
  const value=await r.json().catch(()=>null)
  signal?.throwIfAborted()
  if(!r.ok)throw new NewsfeedError(typeof value?.error?.code==='string'&&/^[A-Z_]{1,80}$/.test(value.error.code)?value.error.code:'NEWSFEED_UNAVAILABLE',r.status)
  if(!value||typeof value!=='object')throw new NewsfeedError('NEWSFEED_UNAVAILABLE',503)
  return value as T
 }
}
export function newsfeedErrorMessage(error:unknown,locale:'pl'|'en'){
 const code=error instanceof NewsfeedError?error.code:''
 if(code==='AUTHENTICATION_REQUIRED')return locale==='pl'?'Zaloguj się ponownie.':'Please sign in again.'
 if(error instanceof NewsfeedError&&error.status===403)return locale==='pl'?'Nie masz dostępu do tej operacji.':'You do not have access to this operation.'
 if(code==='OBSERVATION_VERSION_CONFLICT')return locale==='pl'?'Obserwacja została zmieniona. Otwórz jej aktualną wersję.':'This observation has changed. Open its current version.'
 return locale==='pl'?'Nie udało się wykonać operacji. Zapisane dane nie zostały zastąpione.':'The operation could not be completed. Saved data has not been replaced.'
}
