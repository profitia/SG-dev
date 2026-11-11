'use client'
import type {PublishedReportReference} from '../../../../packages/assistant-context-contracts/src/index.mjs'
import React,{useEffect,useMemo,useRef,useState} from 'react'
import {CanonButton,CanonInput,CanonSelect} from '@profitia/srm-xray'
import type {ReportProfile as Profile,Subscription as Order,PublishedEdition as Published,PublicationShares} from '@profitia/insights-contracts/subscriptions'
type Page<T>={items:T[];nextCursor:string|null}
type Run={id:string;producerJobId:string|null;status:string;createdAt:string;emailDelivery?:string|null}
const contract='procurement-insights.subscription/1.0.0'
const statusLabel:Record<string,string>={READY:'Monitoring aktywny',WAITING_AUTHORIZATION:'Oczekuje na dopuszczenie wykonania',QUEUED:'Zaplanowany',RUNNING:'W przygotowaniu',AWAITING_REVIEW:'Weryfikacja jakości',PUBLISHED:'Opublikowany',FAILED:'Nie można przygotować',UNCERTAIN:'Wynik wymaga wyjaśnienia',CANCELLED:'Anulowany'}
function ReportText({text}:{text:string}){
 return <div className="pi-report-text">{text.split(/\n\s*\n/).map((block,i)=>{
  const heading=/^(#{1,4}) (.+)$/.exec(block)
  if(heading)return heading[1].length<3?<h3 key={i}>{heading[2]}</h3>:<h4 key={i}>{heading[2]}</h4>
  const lines=block.split('\n')
  if(lines.length>2&&/^\s*\|?[\s:|-]+\|/.test(lines[1])){
   const cells=(line:string)=>line.replace(/^\s*\||\|\s*$/g,'').split('|').map(x=>x.trim())
   return <div className="pi-table-scroll" key={i}><table><thead><tr>{cells(lines[0]).map((c,n)=><th key={n}>{c}</th>)}</tr></thead><tbody>{lines.slice(2).map((line,n)=><tr key={n}>{cells(line).map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
  }
  return <p key={i} style={{whiteSpace:'pre-wrap'}}>{block}</p>
 })}</div>
}
export function ReportsWorkspace({active,locale,getToken,editionId=null,onEdition,onContext}:{active:boolean;locale:'pl'|'en';getToken:()=>Promise<string|null>;editionId?:string|null;onEdition?:(id:string|null)=>void;onContext?:(reference:PublishedReportReference|null)=>void}){
 const [view,setView]=useState('orders'),[profiles,setProfiles]=useState<Profile[]>([]),[orders,setOrders]=useState<Page<Order>>({items:[],nextCursor:null}),[selected,setSelected]=useState<Order|null>(null)
 const [runs,setRuns]=useState<Page<Run>>({items:[],nextCursor:null}),[published,setPublished]=useState<Page<Published>>({items:[],nextCursor:null}),[reader,setReader]=useState<Published|null>(null)
 useEffect(()=>{onContext?.(null);return()=>onContext?.(null)},[active,reader?.producerJobId,onContext])
 const [sharing,setSharing]=useState<{jobId:string;title:string;value:PublicationShares}|null>(null),[inviteLink,setInviteLink]=useState(''),[invitation,setInvitation]=useState<string|null>(null)
 const [revision,setRevision]=useState(0),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[ordering,setOrdering]=useState(false),[editing,setEditing]=useState<Order|null>(null)
 const [name,setName]=useState(''),[profileKey,setProfileKey]=useState(''),[recurring,setRecurring]=useState(false),[weekday,setWeekday]=useState(2),[time,setTime]=useState('08:00')
 const [start,setStart]=useState(new Date().toLocaleDateString('en-CA')),[end,setEnd]=useState(''),[notify,setNotify]=useState(false),[email,setEmail]=useState(false),[search,setSearch]=useState('')
 const lifecycle=useMemo(()=>({controller:new AbortController()}),[getToken]),lock=useRef(false),orderKey=useRef<string|null>(null),downloadUrl=useRef<string|null>(null)
 useEffect(()=>{const match=/^#reportInvite=([a-f0-9]{64})$/.exec(window.location.hash);if(match){setInvitation(match[1]);window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search)}},[])
 useEffect(()=>{if(lifecycle.controller.signal.aborted)lifecycle.controller=new AbortController();return()=>{lifecycle.controller.abort();if(downloadUrl.current)URL.revokeObjectURL(downloadUrl.current)}},[lifecycle])
 const transport=useMemo(()=>async(path:string,method='GET',body?:unknown,key?:string)=>{
  const signal=lifecycle.controller.signal,token=await getToken();signal.throwIfAborted();if(!token)throw Error('AUTHENTICATION_REQUIRED')
  const response=await fetch('/api/v1/insights/subscriptions'+path,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{}),...(key?{'idempotency-key':key}:{})},body:body?JSON.stringify(body):undefined,credentials:'omit',cache:'no-store',redirect:'error',signal})
  signal.throwIfAborted()
  if(!response.ok){await response.body?.cancel();if([401,403,404].includes(response.status)){setProfiles([]);setOrders({items:[],nextCursor:null});setSelected(null);setRuns({items:[],nextCursor:null});setPublished({items:[],nextCursor:null});setReader(null);setSharing(null);setInviteLink('');setOrdering(false);setEditing(null);setMessage('');orderKey.current=null}throw Error([401,403].includes(response.status)?'ACCESS_DENIED':response.status===409?'ORDER_CHANGED':'REPORTS_UNAVAILABLE')}
  return response
 },[getToken,lifecycle])
 const api=useMemo(()=>async<T,>(path:string,method='GET',body?:unknown,key?:string):Promise<T>=>{const signal=lifecycle.controller.signal,value=await(await transport(path,method,body,key)).json();signal.throwIfAborted();return value},[transport,lifecycle])
 useEffect(()=>{
  if(!active)return;let current=true;setLoading(true);setError('')
  void api<{catalog:Profile[];orders:Page<Order>;editions:Page<Published>}>('/workspace').then(v=>{if(current){setProfiles(v.catalog);setOrders(v.orders);setPublished(v.editions)}})
   .catch(e=>{if(current&&e.name!=='AbortError')setError(e.message==='ACCESS_DENIED'?'Nie masz dostępu do raportów.':'Raporty są chwilowo niedostępne. Twoje zlecenia nie zostały zmienione.')})
   .finally(()=>{if(current)setLoading(false)})
  return()=>{current=false}
 },[active,api,revision])
 useEffect(()=>{
  if(!active||!selected)return;let current=true;setRuns({items:[],nextCursor:null})
  void api<Page<Run>>('/'+selected.id+'/runs').then(v=>{if(current)setRuns(v)}).catch(e=>{if(current&&e.name!=='AbortError')setError('Nie udało się odczytać historii wydań.')})
  return()=>{current=false}
 },[active,selected?.id,api,revision])
 useEffect(()=>{if(!active||!editionId)return;let current=true;setReader(null);void api<Published>('/editions/'+encodeURIComponent(editionId)).then(p=>{if(current)setReader(p)}).catch(e=>{if(current&&e.name!=='AbortError')setError('Nie udało się odczytać opublikowanego wydania.')});return()=>{current=false}},[active,editionId,api])
 function openEdition(id:string){if(onEdition){onEdition(id);return}void act(async()=>setReader(await api<Published>('/editions/'+id)))}
 async function act(action:()=>Promise<void>){
  if(lock.current||lifecycle.controller.signal.aborted)return;lock.current=true;setBusy(true);setError('');setMessage('')
  try{await action()}catch(e){if(!lifecycle.controller.signal.aborted&&!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error&&e.message==='ORDER_CHANGED'?'Zlecenie zmieniło się. Odśwież jego aktualną wersję.':'Nie udało się wykonać operacji. Zapisane zlecenia nie zostały zastąpione.')}
  finally{lock.current=false;if(!lifecycle.controller.signal.aborted)setBusy(false)}
 }
 const profile=profiles.find(p=>p.definitionId+'@'+p.profileVersion===profileKey)
 function configure(order:Order|null=null){
  if(order){setEditing(order);setName(order.name);setProfileKey(order.definitionId+'@'+order.profileVersion);setRecurring(!!order.schedule);setWeekday(order.schedule?.weekday??2);setTime(order.schedule?.localTime??'08:00');setStart(order.schedule?.startDate??new Date().toLocaleDateString('en-CA'));setEnd(order.schedule?.endDate??'');setNotify(order.notifications.assistant);setEmail(order.notifications.email)}
  else if(!ordering){setEditing(null);setNotify(false);setEmail(false);orderKey.current=crypto.randomUUID()}
  setOrdering(true);setReader(null)
 }
 async function order(){
  if(!name.trim()||!profile||recurring&&(!start||end&&end<start)){setError('Podaj nazwę, wybierz dostępny profil i sprawdź daty.');return}
  await act(async()=>{
   orderKey.current??=crypto.randomUUID()
   const value=await api<Order>(editing?'/'+editing.id:'',editing?'PATCH':'POST',{contractVersion:contract,name:name.trim(),definitionId:profile!.definitionId,profileVersion:profile!.profileVersion,subjectRef:editing?.subjectRef??null,
    schedule:recurring?{frequency:'WEEKLY',weekday,localTime:time,timeZone:'Europe/Warsaw',startDate:start,endDate:end||null}:null,notifications:{assistant:notify,email},...(editing?{version:editing.version,status:editing.status}:{})},editing?undefined:orderKey.current)
   setSelected(value);setOrdering(false);setEditing(null);orderKey.current=null;setRevision(x=>x+1);setMessage(value.executionState==='WAITING_AUTHORIZATION'?'Zapisano harmonogram. Wykonanie oczekuje na dopuszczenie.':'Zapisano zlecenie. Rzeczywisty status jest widoczny w historii.')
  })
 }
 async function status(next:string){if(!selected)return;await act(async()=>{
  const value=await api<Order>('/'+selected.id,'PATCH',{contractVersion:contract,version:selected.version,status:next});setSelected(value);setRevision(x=>x+1);setMessage('Zapisano ustawienia przyszłych wydań.')
 })}
 async function openSharing(jobId:string){await act(async()=>{setInviteLink('');setSharing({jobId,title:reader?.title??'Opublikowany raport',value:await api<PublicationShares>('/editions/'+jobId+'/shares')})})}
 async function share(mode:'ORG'|'USER_LINK'){if(!sharing)return;await act(async()=>{
  const result=await api<{token?:string}>('/editions/'+sharing.jobId+'/shares','POST',{contractVersion:'procurement-insights.publication-sharing/1.0.0',mode});if(result.token)setInviteLink(window.location.origin+window.location.pathname+'?tab=reports#reportInvite='+result.token)
  setSharing({...sharing,value:await api<PublicationShares>('/editions/'+sharing.jobId+'/shares')});setMessage('Zapisano dostęp do tego opublikowanego wydania.')
 })}
 async function revokeShare(id:string,kind:'SHARE'|'INVITATION'){if(!sharing)return;await act(async()=>{await api('/editions/'+sharing.jobId+'/shares?id='+encodeURIComponent(id)+'&kind='+kind,'DELETE');setInviteLink('');setSharing({...sharing,value:await api<PublicationShares>('/editions/'+sharing.jobId+'/shares')});setMessage('Cofnięto dostęp lub zaproszenie do wydania.')})}
 async function more(kind:'orders'|'runs'|'published'){
  await act(async()=>{const page=kind==='orders'?orders:kind==='runs'?runs:published;if(!page.nextCursor)return
   const prefix=kind==='orders'?'':kind==='runs'?'/'+selected?.id+'/runs':'/editions'
   const value=await api<Page<never>>(prefix+'?cursor='+encodeURIComponent(page.nextCursor))
   if(kind==='orders')setOrders(p=>({items:[...p.items,...value.items],nextCursor:value.nextCursor}));else if(kind==='runs')setRuns(p=>({items:[...p.items,...value.items],nextCursor:value.nextCursor}));else setPublished(p=>({items:[...p.items,...value.items],nextCursor:value.nextCursor}))
  })
 }
 async function download(edition:Published){await act(async()=>{
  const response=await transport('/editions/'+edition.producerJobId+'/pdf'),reader=response.body?.getReader();if(!reader)throw Error('UNAVAILABLE')
  const chunks:Uint8Array[]=[];let length=0
  try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>20971520)throw Error('UNAVAILABLE');chunks.push(part.value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')
  lifecycle.controller.signal.throwIfAborted();if(hash!==edition.pdfSha256||response.headers.get('x-report-publication')!=='PUBLISHED')throw Error('VERSION_MISMATCH')
  if(downloadUrl.current)URL.revokeObjectURL(downloadUrl.current);const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));downloadUrl.current=url
  const link=document.createElement('a');link.href=url;link.download='insights-'+edition.producerJobId+'.pdf';link.click()
  setMessage('Pobrano PDF tej samej opublikowanej wersji.');setTimeout(()=>{URL.revokeObjectURL(url);if(downloadUrl.current===url)downloadUrl.current=null},30000)
 })}
 const sections=[['orders','Moje zlecenia'],['cycles','Raporty cykliczne'],['library','Opublikowane raporty'],['archive','Archiwum'],['shared','Udostępnione mi'],['catalog','Dostępne analizy']]
 const shownOrders=orders.items.filter(o=>view==='cycles'?!!o.schedule&&o.status!=='ENDED':view==='orders'?o.status!=='ENDED':view==='archive'?o.status==='ENDED':false)
 const shownPublications=published.items.filter(p=>(view!=='shared'||p.readOnly)&&(!search||p.title.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale))))
 return <div className="pi-layout"><aside className="pi-sidebar"><nav aria-label="Raporty">{sections.map(([id,label])=><button key={id} type="button" aria-current={view===id?'page':undefined} onClick={()=>{setView(id);setSelected(null);setReader(null);setMessage('')}}>{label}</button>)}</nav>
  <h3>Moje raporty</h3><ul>{shownOrders.map(o=><li key={o.id}><button type="button" aria-current={selected?.id===o.id?'page':undefined} onClick={()=>{setSelected(o);setReader(null)}}>{o.name}</button></li>)}</ul>
  {orders.nextCursor&&['orders','cycles','archive'].includes(view)&&<button type="button" disabled={busy} onClick={()=>void more('orders')}>Pokaż kolejne zlecenia</button>}
 </aside><section className="pi-content" aria-busy={loading||busy}>
  <div className="pi-heading"><div><h2>Raporty</h2><p>Zamawiaj pogłębione analizy i zarządzaj regularnymi wydaniami.</p></div><CanonButton canonId="SRM-C01" usage="PI:new-report" type="button" onClick={()=>configure()}>+ Zamów raport</CanonButton></div>
  {loading&&<p role="status">Wczytywanie raportów…</p>}{error&&<p role="alert" className="pi-error">{error}</p>}{message&&<p role="status">{message}</p>}
  {invitation&&<section className="pi-form"><h3>Zaproszenie do opublikowanego raportu</h3><p>Uzyskasz dostęp tylko do tego wydania, w swojej organizacji. Nie otrzymasz uprawnień do zmiany zlecenia.</p><button type="button" disabled={busy} onClick={()=>void act(async()=>{const result=await api<{producerJobId:string}>('/invitations','POST',{token:invitation});setInvitation(null);setRevision(x=>x+1);setView('shared');openEdition(result.producerJobId)})}>Przyjmij zaproszenie</button><button type="button" onClick={()=>setInvitation(null)}>Odrzuć</button></section>}
  {sharing&&<section className="pi-form"><h3>Udostępnij: {sharing.title}</h3><p>Przekazujesz odczyt raportu i PDF, bez zlecenia, harmonogramu i innych wersji.</p><div className="pi-actions"><button type="button" disabled={busy} onClick={()=>void share('USER_LINK')}>Zaproszenie dla jednej osoby</button><button type="button" disabled={busy} onClick={()=>void share('ORG')}>Udostępnij organizacji</button><button type="button" onClick={()=>{setSharing(null);setInviteLink('')}}>Zamknij udostępnianie</button></div>
   {inviteLink&&<><p>Przekaż link prywatnie wybranej osobie. Pierwsza zalogowana osoba z Twojej organizacji może go przyjąć raz, w ciągu 24 godzin.</p><label>Link zaproszenia<CanonInput canonId="SRM-C06" usage="PI:report-share-link" readOnly value={inviteLink} onFocus={e=>e.target.select()}/></label></>}
   <ul>{sharing.value.grants.map(g=><li key={g.id}>{g.mode==='ORG'?'Organizacja':'Odbiorca zaproszenia'} <button type="button" disabled={busy} onClick={()=>void revokeShare(g.id,'SHARE')}>Cofnij dostęp</button></li>)}{sharing.value.invitations.filter(i=>!i.claimedAt).map(i=><li key={i.id}>Zaproszenie ważne do {new Date(i.expiresAt).toLocaleString(locale)} <button type="button" disabled={busy} onClick={()=>void revokeShare(i.id,'INVITATION')}>Unieważnij zaproszenie</button></li>)}</ul>
  </section>}
  <div hidden={!ordering} className="pi-form"><h3>{editing?'Edytuj zlecenie':'Zamów raport'}</h3>
   <fieldset disabled={busy}><legend>Co analizujemy?</legend><label>Nazwa zlecenia<CanonInput canonId="SRM-C06" usage="PI:report-name" value={name} maxLength={200} onChange={e=>setName(e.target.value)}/></label>
    <label>Dostępny profil<CanonSelect canonId="SRM-C16" usage="PI:report-profile" value={profileKey} disabled={!!editing} onChange={e=>setProfileKey(e.target.value)}><option value="">Wybierz profil</option>{profiles.map(p=><option key={p.definitionId+'@'+p.profileVersion} value={p.definitionId+'@'+p.profileVersion}>{p.label}</option>)}</CanonSelect></label>
    {profile&&<><p>{profile.description}</p><ul>{profile.sections.map(s=><li key={s}>{s}</li>)}</ul></>}
   </fieldset>
   <fieldset disabled={busy}><legend>Jak często?</legend><label><input type="checkbox" checked={recurring} disabled={!profile?.cadences.includes('WEEKLY')} onChange={e=>setRecurring(e.target.checked)}/> Raport cykliczny</label>
    {recurring&&<div className="pi-schedule-grid"><label>Dzień tygodnia<CanonSelect canonId="SRM-C16" usage="PI:report-weekday" value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'].map((d,i)=><option key={d} value={i}>{d}</option>)}</CanonSelect></label>
     <label>Godzina · Europe/Warsaw<CanonInput canonId="SRM-C06" usage="PI:report-time" type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
     <label>Początek<CanonInput canonId="SRM-C06" usage="PI:report-start" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
     <label>Koniec (puste = bezterminowo)<CanonInput canonId="SRM-C06" usage="PI:report-end" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>}
   </fieldset>
   <fieldset disabled={busy}><legend>Dostęp i powiadomienia</legend><p>Prywatne zlecenie. Autor i organizacja wynikają z Twojego bieżącego dostępu.</p><label><input type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)}/> Powiadomienie o opublikowanym wydaniu</label><label><input type="checkbox" checked={email} disabled={!profile?.deliveryChannels.includes('EMAIL')&&!email} onChange={e=>setEmail(e.target.checked)}/> E-mail z odnośnikiem do opublikowanego wydania</label></fieldset>
   <div className="pi-actions"><CanonButton canonId="SRM-C01" usage="PI:order-report" type="button" disabled={busy||!profile} onClick={()=>void order()}>{editing?'Zapisz zmiany':'Zamów raport'}</CanonButton><CanonButton canonId="SRM-C02" usage="PI:cancel-report" type="button" disabled={busy} onClick={()=>setOrdering(false)}>{locale==='pl'?'Anuluj':'Cancel'}</CanonButton></div>
  </div>
  {!ordering&&selected&&<><h3>{selected.name}</h3><p>{selected.status==='PAUSED'?'Przyszłe wydania wstrzymane':selected.status==='ENDED'?'Cykl zakończony':statusLabel[!selected.schedule&&runs.items[0]?runs.items[0].status:selected.executionState]??'Status wykonania jest niedostępny'}</p>
   <p>{selected.nextDueAt?'Następny termin: '+new Date(selected.nextDueAt).toLocaleString(locale):'Brak kolejnego zaplanowanego terminu'}</p>
   {selected.status!=='ENDED'&&<div className="pi-actions"><button type="button" disabled={busy} onClick={()=>configure(selected)}>Edytuj</button>{selected.schedule&&<><button type="button" disabled={busy} onClick={()=>void status(selected.status==='PAUSED'?'ACTIVE':'PAUSED')}>{selected.status==='PAUSED'?'Wznów cykl':'Wstrzymaj przyszłe wydania'}</button><button type="button" disabled={busy} onClick={()=>{if(window.confirm('Zakończyć przyszłe wydania tego raportu?'))void status('ENDED')}}>Zakończ cykl</button></>}</div>}
   <ul className="pi-history">{runs.items.map(r=><li key={r.id}><span>{new Date(r.createdAt).toLocaleString(locale)} · {statusLabel[r.status]??'Status wykonania jest niedostępny'}{r.emailDelivery&&<small> · E-mail: {({QUEUED:'oczekuje',LEASED:'oczekuje',SENDING:'wysyłanie',ACCEPTED:'przyjęty przez operatora — doręczenie niepotwierdzone',REJECTED:'niewysłany',UNKNOWN:'wynik niepotwierdzony',EXPIRED:'wygasł'} as Record<string,string>)[r.emailDelivery]??'status niedostępny'}</small>}</span>{published.items.some(p=>p.producerJobId===r.producerJobId)&&<button type="button" disabled={busy} onClick={()=>r.producerJobId&&openEdition(r.producerJobId)}>Czytaj opublikowane wydanie</button>}</li>)}</ul>
   {!runs.items.length&&<p>Brak przygotowanych wydań. Raport pojawi się po rzeczywistym wykonaniu i wymaganej weryfikacji.</p>}
   {runs.nextCursor&&<button type="button" disabled={busy} onClick={()=>void more('runs')}>Wcześniejsze wykonania</button>}
  </>}
  {!ordering&&['library','archive','shared'].includes(view)&&<><label>Filtruj wczytane wydania<CanonInput canonId="SRM-C06" usage="PI:report-filter" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   {shownPublications.map(p=><article className="pi-publication" key={p.producerJobId}><div className="pi-publication-body"><h3>{p.title}</h3><p>Wydanie: {new Date(p.publishedAt).toLocaleString(locale)} · Dane na: {new Date(p.asOf).toLocaleString(locale)}</p><div className="pi-actions"><button type="button" disabled={busy} onClick={()=>openEdition(p.producerJobId)}>Czytaj raport</button><button type="button" disabled={busy} onClick={()=>void download(p)}>Pobierz PDF</button></div></div></article>)}
   {!loading&&!shownPublications.length&&<p>Nie ma opublikowanych wydań pasujących do tego widoku. Raport oczekujący na recenzję pozostaje w historii zlecenia.</p>}
   {published.nextCursor&&<button type="button" disabled={busy} onClick={()=>void more('published')}>Wcześniejsze wydania</button>}
  </>}
  {!ordering&&view==='catalog'&&profiles.map(p=><article className="pi-publication" key={p.definitionId+'@'+p.profileVersion}><div className="pi-publication-body"><h3>{p.label}</h3><p>{p.description}</p><button type="button" onClick={()=>{setProfileKey(p.definitionId+'@'+p.profileVersion);configure()}}>Skonfiguruj zlecenie</button></div></article>)}
  {!ordering&&!selected&&!reader&&!loading&&!error&&['orders','cycles'].includes(view)&&<div className="pi-empty"><h3>{shownOrders.length?'Wybierz raport po lewej stronie':'Nie masz jeszcze zleceń w tym widoku'}</h3><p>Możesz zamówić raport z aktualnie dostępnego katalogu.</p></div>}
  {!ordering&&reader&&<article className="pi-report-reader"><header><h3>{reader.title}</h3><p>Opublikowano: {new Date(reader.publishedAt).toLocaleString(locale)} · Aktualność danych: {new Date(reader.asOf).toLocaleString(locale)}{reader.readOnly?' · Udostępnione tylko do odczytu':''}</p><button type="button" onClick={()=>{setReader(null);onEdition?.(null)}}>Zamknij czytnik</button><button type="button" disabled={busy} onClick={()=>void download(reader)}>Pobierz tę wersję PDF</button>{!reader.readOnly&&<button type="button" disabled={busy} onClick={()=>void openSharing(reader.producerJobId)}>Udostępnij to wydanie</button>}</header>{onContext&&<div className="pi-actions"><button type="button" onClick={()=>onContext({version:'2.1.0',source:'PUBLISHED_REPORT',producerJobId:reader.producerJobId,pdfSha256:reader.pdfSha256,markdownSha256:reader.markdownSha256})}>Wybierz tę wersję dla asystenta</button><button type="button" onClick={()=>onContext(null)}>Usuń wybór</button></div>}<ReportText text={reader.markdown??''}/></article>}
 </section></div>
}
