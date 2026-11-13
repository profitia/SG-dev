'use client'
import React,{useEffect,useMemo,useRef,useState} from 'react'
import {createNewsfeedClient,newsfeedErrorMessage,type Page} from '@/lib/newsfeed/client'
type Notice={id:string;observationId:string;publicationId:string;createdAt:string;readAt:string|null}
type ReportNotice={id:string;producerJobId:string;createdAt:string;readAt:string|null}
/** Persistent references from both domains, without an AI call or browser archive. */
export function ProcurementInsightsNotifications({getToken,locale,onOpen,onOpenReport}:{getToken:()=>Promise<string|null>;locale:'pl'|'en';onOpen:(observationId:string,publicationId:string)=>void;onOpenReport:(producerJobId:string)=>void}){
 const client=useMemo(()=>createNewsfeedClient(getToken),[getToken]),lease=useMemo(()=>({controller:new AbortController()}),[client]),lock=useRef(false)
 const [open,setOpen]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[page,setPage]=useState<Page<Notice>>({items:[],nextCursor:null}),[reports,setReports]=useState<Page<ReportNotice>>({items:[],nextCursor:null})
 useEffect(()=>{if(lease.controller.signal.aborted)lease.controller=new AbortController();return()=>lease.controller.abort()},[lease])
 const reportRequest=useMemo(()=>async<T,>(path:string,method='GET'):Promise<T>=>{
  const signal=lease.controller.signal,token=await getToken();signal.throwIfAborted();if(!token)throw Error('AUTH_REQUIRED')
  const response=await fetch('/api/v1/insights/subscriptions'+path,{method,headers:{authorization:'Bearer '+token},signal,cache:'no-store',credentials:'omit',redirect:'error'})
  if(!response.ok){await response.body?.cancel();throw Error('REPORTS_UNAVAILABLE')}const value=await response.json();signal.throwIfAborted();return value as T
 },[getToken,lease])
 async function load(more:'news'|'reports'|null=null){
  if(lock.current||lease.controller.signal.aborted)return;lock.current=true;setLoading(true);setError('')
  const signal=lease.controller.signal
  try{
   const result=await Promise.allSettled([
    more==='reports'?Promise.resolve(null):client<Page<Notice>>('/notifications'+(more==='news'&&page.nextCursor?'?cursor='+encodeURIComponent(page.nextCursor):''),{signal}),
    more==='news'?Promise.resolve(null):reportRequest<Page<ReportNotice>>('/notifications'+(more==='reports'&&reports.nextCursor?'?cursor='+encodeURIComponent(reports.nextCursor):''))
   ]);signal.throwIfAborted()
   if(result[0].status==='fulfilled'&&result[0].value)setPage({items:more==='news'?[...page.items,...result[0].value.items]:result[0].value.items,nextCursor:result[0].value.nextCursor})
   else if(result[0].status==='rejected')setPage({items:[],nextCursor:null})
   if(result[1].status==='fulfilled'&&result[1].value)setReports({items:more==='reports'?[...reports.items,...result[1].value.items]:result[1].value.items,nextCursor:result[1].value.nextCursor})
   else if(result[1].status==='rejected')setReports({items:[],nextCursor:null})
   if(result.some(r=>r.status==='rejected'))setError(locale==='pl'?'Część powiadomień jest chwilowo niedostępna.':'Some notifications are temporarily unavailable.')
  }catch(e){if(!signal.aborted)setError(newsfeedErrorMessage(e,locale))}finally{lock.current=false;if(!signal.aborted)setLoading(false)}
 }
 async function select(n:Notice|ReportNotice){
  if(lock.current||lease.controller.signal.aborted)return;lock.current=true;setError('')
  // Opening reauthorizes the resource. A read receipt is independent of that
  // navigation and is shown as read only after its durable write succeeds.
  if('producerJobId' in n)onOpenReport(n.producerJobId);else onOpen(n.observationId,n.publicationId)
  setOpen(false)
  try{
   if('producerJobId' in n){await reportRequest('/notifications/'+n.id,'PATCH');setReports(p=>({...p,items:p.items.map(x=>x.id===n.id?{...x,readAt:new Date().toISOString()}:x)}))}
   else{await client('/notifications/'+n.id,{method:'PATCH',signal:lease.controller.signal});setPage(p=>({...p,items:p.items.map(x=>x.id===n.id?{...x,readAt:new Date().toISOString()}:x)}))}
  }catch(e){if(!lease.controller.signal.aborted){setPage({items:[],nextCursor:null});setReports({items:[],nextCursor:null});setError(newsfeedErrorMessage(e,locale))}}finally{lock.current=false}
 }
 const en=locale==='en',items=[...page.items,...reports.items].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
 return <section className="srm-chat-notifications" aria-label={en?'Procurement Insights notifications':'Powiadomienia Procurement Insights'}>
  <button className="srm-chat-tool srm-chat-notifications-trigger" type="button" aria-label={en?'Notifications':'Powiadomienia'} title={en?'Notifications':'Powiadomienia'} aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void load()}}>
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
  </button>
  {open&&<div>{loading&&<p role="status">{en?'Loading…':'Wczytywanie…'}</p>}{error&&<p role="alert">{error}</p>}
   {!loading&&!error&&!items.length&&<p>{en?'No saved notifications.':'Brak zapisanych powiadomień.'}</p>}
   <ul>{items.map(n=><li key={('producerJobId' in n?'report:':'news:')+n.id}><span>{'producerJobId' in n?(en?'Published report':'Opublikowany raport'):(en?'New publication':'Nowa publikacja')} · {new Date(n.createdAt).toLocaleString(locale)}{n.readAt?(en?' · Read':' · Przeczytane'):''}</span><button type="button" disabled={loading} onClick={()=>void select(n)}>{en?'View information':'Zobacz informację'}</button></li>)}</ul>
   {page.nextCursor&&<button type="button" disabled={loading} onClick={()=>void load('news')}>{en?'Earlier Newsfeed notifications':'Wcześniejsze powiadomienia Newsfeed'}</button>}
   {reports.nextCursor&&<button type="button" disabled={loading} onClick={()=>void load('reports')}>{en?'Earlier report notifications':'Wcześniejsze powiadomienia raportów'}</button>}
   <button type="button" disabled={loading} onClick={()=>void load()}>{en?'Refresh':'Odśwież'}</button>
  </div>}
 </section>
}
