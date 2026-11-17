import type {Page,Snapshot,Context,PrivateEnvelope} from './model'
import type {CalendarEvent,PublicationData} from '../../../../packages/economic-calendar-contracts/index.mjs'
export class CalendarRequestError extends Error{constructor(readonly code:string,readonly status:number){super(code)}}
export type CalendarClient=<T>(path:string,options?:{method?:'GET'|'PUT';body?:unknown;signal?:AbortSignal})=>Promise<T>
export function createCalendarClient(getToken:()=>Promise<string|null>,fetcher:typeof fetch=fetch):CalendarClient{
 return async<T>(path:string,{method='GET',body,signal}:Parameters<CalendarClient>[1]={}):Promise<T>=>{
  const token=await getToken();signal?.throwIfAborted();if(!token)throw new CalendarRequestError('AUTHENTICATION_REQUIRED',401)
  const r=await fetcher('/api/v1/market-calendar/'+path,{method,headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal,credentials:'omit',redirect:'error',cache:'no-store'})
  const data=await r.json().catch(()=>null);signal?.throwIfAborted()
  if(!r.ok)throw new CalendarRequestError(typeof data?.error?.code==='string'?data.error.code:'CALENDAR_UNAVAILABLE',r.status)
  if(!data||data.contract?.id!=='profitia.economic-calendar'||data.contract.version!=='1.1.0')throw new CalendarRequestError('CALENDAR_CONTRACT_UNAVAILABLE',503)
  return data as T
 }
}
export async function readSnapshot(client:CalendarClient,signal:AbortSignal,previous?:Snapshot):Promise<Snapshot>{
 const more=previous?.more??{events:'',publications:'',context:''}
 const include=(Object.keys(more) as Array<keyof typeof more>).filter(k=>more[k]!==null)
 if(!include.length)return previous!
 const query=new URLSearchParams({limit:'100',include:include.join(',')})
 for(const [collection,key] of [['events','eventAfter'],['publications','publicationAfter'],['context','contextAfter']] as const)if(more[collection])query.set(key,more[collection]!)
 const data=await client<{projection:string;queryContract:{id:string;version:string};events:Page<CalendarEvent>|null;publications:Page<PublicationData>|null;context:Context|null}>('query?'+query,{signal})
 if(data.projection!=='CALENDAR_QUERY'||data.queryContract?.id!=='profitia.calendar-query'||data.queryContract.version!=='1.0.0'
  ||include.some(k=>!data[k]||!Array.isArray(data[k]!.items)||data[k]!.nextAfter!==null&&typeof data[k]!.nextAfter!=='string'))throw new CalendarRequestError('CALENDAR_CONTRACT_UNAVAILABLE',503)
 const {events,publications,context}=data
 const unique=<T,>(rows:T[],key:(r:T)=>string)=>[...new Map(rows.map(r=>[key(r),r])).values()]
 return{events:unique([...(previous?.events??[]),...(events?.items??[])],r=>r.eventId),publications:unique([...(previous?.publications??[]),...(publications?.items??[])],r=>r.publicationId),
  context:{...(context??previous!.context),items:unique([...(previous?.context.items??[]),...(context?.items??[])],r=>r.eventId)},
  more:{events:events?.nextAfter??null,publications:publications?.nextAfter??null,context:context?.nextAfter??null}}
}
export const readPrivate=(client:CalendarClient,signal:AbortSignal)=>client<PrivateEnvelope>('preferences',{signal})
export function calendarErrorMessage(error:unknown){
 if(error instanceof CalendarRequestError){
  if(error.status===401)return 'Sesja wygasła. Zaloguj się ponownie w SpendGuru.'
  if(error.status===403)return 'Brak uprawnienia do tej operacji kalendarza w bieżącej organizacji.'
  if(error.status===409)return 'Preferencje zmieniły się w innej sesji. Wczytaj ich aktualną wersję przed ponownym zapisem.'
 }
 return 'Nie udało się wczytać lub zapisać danych ECR. Spróbuj ponownie.'
}
