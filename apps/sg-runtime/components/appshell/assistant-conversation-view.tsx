'use client'

import React,{useEffect,useRef} from 'react'
import type {AssistantConversationSession,AssistantConversationSnapshot,AssistantConversationError} from './assistant-conversation-session'

const errors:Record<AssistantConversationError,readonly [string,string]>={
 CONTEXT_CHANGED:['Kontekst lub dostęp do danych zmienił się. Odpowiedź została zatrzymana; możesz zadać nowe pytanie.','The context or data access changed. The response was stopped; you can ask a new question.'],
 AUTH_REQUIRED:['Zaloguj się ponownie, aby kontynuować.','Sign in again to continue.'],
 DENIED:['Nie masz teraz dostępu do tej rozmowy lub jej kontekstu.','This conversation or its context is no longer accessible.'],
 LIMIT_EXCEEDED:['Limit rozmowy został wykorzystany. Spróbuj po jego odnowieniu.','The conversation allowance has been used. Try after it renews.'],
 UNAVAILABLE:['Nie udało się zakończyć odpowiedzi. Sprawdź historię przed wysłaniem kolejnej wiadomości.','The response could not be completed. Check history before sending another message.'],
 INTERRUPTED:['Połączenie zostało przerwane. Sprawdź zapisaną rozmowę przed kontynuowaniem.','The connection was interrupted. Check the saved conversation before continuing.'],
}
const sourceStatus={OK:['',''],EMPTY:['Brak danych','No data'],PARTIAL:['Dane częściowe','Partial data'],DENIED:['Brak dostępu','Access denied'],UNAVAILABLE:['Źródło niedostępne','Source unavailable'],STALE:['Dane zmieniły się','Data has changed']} as const
export function AssistantConversationView({session,state,en,historyOpen,onCloseHistory,inputId,avatar}:{
 session:AssistantConversationSession;state:AssistantConversationSnapshot;en:boolean;historyOpen:boolean;onCloseHistory:()=>void;inputId:string;avatar?:React.ReactNode
}){
 const draft=state.draft,setDraft=session.setDraft,tail=useRef<HTMLDivElement>(null)
 useEffect(()=>{tail.current?.scrollIntoView?.({block:'nearest'})},[state.messages])
 function send(){if(!state.active||state.busy||!draft.trim())return;const message=draft;setDraft('');void session.send(message)}
 return <>
  {historyOpen&&<section className="srm-chat-history" aria-label={en?'Conversation history':'Historia rozmowy'}>
   <button type="button" className="as-secondary-button" disabled={!state.active} onClick={()=>{session.newConversation();setDraft('');onCloseHistory()}}>{en?'New conversation':'Nowa rozmowa'}</button>
   {state.loadingHistory?<p role="status">{en?'Loading…':'Wczytywanie…'}</p>:state.history.length===0?<p>{en?'No saved conversations.':'Brak zapisanych rozmów.'}</p>:<ul>{state.history.map(entry=><li key={entry.id}><button type="button" disabled={state.busy} onClick={()=>{setDraft('');void session.open(entry.id);onCloseHistory()}}>{entry.title}</button><button type="button" className="as-secondary-button" disabled={state.busy} onClick={()=>void session.deleteConversation(entry.id)} aria-label={(en?'Delete ':'Usuń ')+entry.title}>{en?'Delete':'Usuń'}</button></li>)}</ul>}
   <button type="button" className="as-secondary-button" onClick={onCloseHistory}>{en?'Return to conversation':'Wróć do rozmowy'}</button>
  </section>}
  <div className="srm-chat-transcript" role="log" aria-label={en?'Conversation with SpendGuru':'Rozmowa ze SpendGuru'} aria-live="polite" aria-relevant="additions text" aria-busy={state.busy} tabIndex={0}>
   {state.messages.length===0&&<div className="srm-chat-incoming">{avatar}<p>{en?'Ask about procurement or the benchmark you are viewing.':'Zapytaj o zakupy lub benchmark, który oglądasz.'}</p></div>}
   {state.messages.map(message=><div key={message.id} className={message.role==='assistant'?'srm-chat-incoming':'srm-chat-outgoing'}>{message.role==='assistant'&&avatar}<article className={'srm-chat-message srm-chat-turn srm-chat-turn-'+message.role} aria-label={message.role==='user'?(en?'Your message':'Twoja wiadomość'):'SpendGuru'}>
    <p>{message.content|| (message.status==='streaming'?(en?'Preparing a response…':'Przygotowuję odpowiedź…'):'')}</p>
    {message.status==='interrupted'&&<small>{en?'Response stopped':'Odpowiedź zatrzymana'}</small>}
    {message.status==='failed'&&<small>{en?'Response incomplete':'Odpowiedź niepełna'}</small>}
    {!!message.sources.length&&<ul className="srm-chat-sources" aria-label={en?'Sources':'Źródła'}>{message.sources.map(source=><li key={source.id}>{source.label}{source.asOf?' · '+source.asOf:''}{source.status!=='OK'?' · '+sourceStatus[source.status][en?1:0]:''}</li>)}</ul>}
   </article></div>)}<div ref={tail}/>
  </div>
  {state.error&&<p className="srm-chat-window-error" role="alert">{errors[state.error][en?1:0]}</p>}
  <form className="srm-chat-composer" onSubmit={event=>{event.preventDefault();void send()}}>
   <label htmlFor={inputId}>{en?'What would you like to ask?':'O co chcesz zapytać?'}</label>
   <div className="srm-chat-input-wrap"><textarea id={inputId} value={draft} onChange={event=>setDraft(event.target.value)} maxLength={8000} rows={2} placeholder={en?'Write a message…':'Napisz wiadomość…'} disabled={!state.active||state.busy}/>
    {state.busy?<button className="as-primary-button" type="button" onClick={session.cancel}>{en?'Stop':'Zatrzymaj'}</button>:<button className="as-primary-button" type="submit" disabled={!state.active||!draft.trim()}>{en?'Send':'Wyślij'}</button>}
   </div>
  </form>
 </>
}
