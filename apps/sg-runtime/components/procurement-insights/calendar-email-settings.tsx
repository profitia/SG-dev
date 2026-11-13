'use client'
import React,{useEffect,useState} from 'react'
import {CanonInput} from '@profitia/srm-xray'
import {CalendarButton as Btn} from './calendar-dialogs'
import {readNotifications,notificationEnvelope,calendarErrorMessage,CalendarRequestError,type CalendarClient,type CalendarNotificationEnvelope} from '@/lib/market-calendar/client'

/** A separate explicit channel consent. Favourites, saved calendars and watch
 * checkboxes never call this endpoint or implicitly enable email delivery. */
export function CalendarEmailSettings({client,timeZone}:{client:CalendarClient;timeZone:string}){
 const [state,setState]=useState<CalendarNotificationEnvelope|null>(null),[enabled,setEnabled]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[reload,setReload]=useState(0)
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setState(null)
  void readNotifications(client,controller.signal).then(r=>{if(!controller.signal.aborted){setState(r);setEnabled(r.settings.emailEnabled)}}).catch(e=>{if(!controller.signal.aborted)setError(calendarErrorMessage(e))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[client,reload])
 async function save(){
  if(!state||saving)return;setSaving(true);setError('');setMessage('')
  try{
   const r=notificationEnvelope(await client<unknown>('notifications',{method:'PUT',body:{expectedVersion:state.version,settings:{emailEnabled:enabled,timeZone}}}))
   if(r.version!==state.version+1||r.settings.emailEnabled!==enabled)throw new CalendarRequestError('CALENDAR_NOTIFICATION_WRITE_UNCONFIRMED',503)
   setState(r);setEnabled(r.settings.emailEnabled);setMessage(r.settings.emailEnabled?'Zapisano zgodę e-mail.':'Powiadomienia e-mail zostały wyłączone.')
  }catch(e){setError(calendarErrorMessage(e));if(e instanceof CalendarRequestError&&e.status===403)setState(null)}finally{setSaving(false)}
 }
 const available=state?.channel.email==='AVAILABLE',failures=(state?.delivery.UNKNOWN??0)+(state?.delivery.REJECTED??0)+(state?.delivery.FAILED??0),deferred=state?.delivery.DEFERRED??0
 return <section aria-label="Powiadomienia e-mail kalendarza" className="pi-cal-help" data-canon-reference="SRM-C10" data-canon-source-revision="470946417440075776">
  <strong>Powiadomienia e-mail</strong>
  {loading?<p role="status">Sprawdzamy dostępność kanału…</p>:<>
   <p>{!available?'Doręczanie e-maili nie jest jeszcze aktywne. Możesz nadal zapisać typy obserwowania.':state?.settings.emailEnabled?'Powiadomienia e-mail są włączone dla obserwowanych publikacji.':'Kanał e-mail jest dostępny. Wysyłka dla Ciebie jest wyłączona.'}</p>
   {state&&<><div className="pi-cal-watch-options"><label><CanonInput canonId="SRM-C10" usage="PI:market-calendar-email-consent" type="checkbox" checked={enabled} disabled={saving||!available&&!state.settings.emailEnabled} onChange={e=>{setEnabled(e.target.checked);setMessage('')}}/>Chcę otrzymywać e-maile o obserwowanych publikacjach</label></div>
    <p>Zgoda dotyczy wszystkich Twoich obserwowanych publikacji w bieżącej organizacji. Wiadomości mogą trafić wyłącznie na zweryfikowany główny adres konta. Ulubione i zapisane kalendarze nie włączają wysyłki.</p>
    <p>Przypomnienie: godzinę przed terminem albo o 09:00 w strefie {timeZone}, gdy źródło podaje samą datę. Godzina przypomnienia nie jest godziną publikacji. Wybór rodzajów zmian zapisujesz osobno.</p>
    <Btn disabled={saving||enabled===state.settings.emailEnabled||enabled&&!available} onClick={()=>void save()}>{saving?'Zapisywanie…':'Zapisz ustawienia e-mail'}</Btn>
    {failures>0&&<p role="status">Część prób wysyłki wymaga sprawdzenia. Niepewne wiadomości nie są powtarzane automatycznie.</p>}
    {deferred>0&&<p role="status">Operator poczty zgłosił opóźnienie. Nie wysyłamy drugiej kopii tej samej wiadomości.</p>}
   </>}
  </>}
  {message&&<p role="status">{message}</p>}
  {error&&<p role="alert">{error} <Btn plain disabled={loading||saving} onClick={()=>setReload(n=>n+1)}>Wczytaj aktualne ustawienia</Btn></p>}
 </section>
}
