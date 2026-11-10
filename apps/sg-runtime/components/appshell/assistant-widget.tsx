'use client'

import React,{useId,useRef,useState,useSyncExternalStore} from 'react'
import {createPortal} from 'react-dom'
import {createAssistantContent,type AssistantContent} from './assistant-content'
import {SpendGuruLogo} from './appshell-brand'
import {useAssistantWindow} from './use-assistant-window'
import {AssistantConversationView} from './assistant-conversation-view'
import type {AssistantConversationSession} from './assistant-conversation-session'

type AvatarChoice='male'|'female'|null|undefined
type Props={locale:'pl'|'en';salutation?:string|null;avatar:AvatarChoice;theme:'light'|'dark';content?:AssistantContent;conversation?:AssistantConversationSession;notifications?:React.ReactNode;onCollapsedChange?:(collapsed:boolean)=>void}
const noSubscription=()=>()=>{},noConversation=()=>null
function Glyph({kind}:{kind:'collapse'|'expand'|'detach'|'attach'|'clock'|'more'|'send'}){
 return <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {kind==='collapse'&&<path d="m9 6 6 6-6 6"/>}{kind==='expand'&&<path d="m15 6-6 6 6 6"/>}
  {kind==='detach'&&<><path d="M14 4h6v6M20 4l-9 9"/><path d="M11 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/></>}
  {kind==='attach'&&<><path d="M9 4H4v5m0-5 7 7M15 20h5v-5m0 5-7-7"/></>}
  {kind==='clock'&&<><circle cx={12} cy={12} r={9}/><path d="M12 7v5l3 2"/></>}
  {kind==='more'&&<g fill="currentColor" stroke="none"><circle cx={5} cy={12} r={1.5}/><circle cx={12} cy={12} r={1.5}/><circle cx={19} cy={12} r={1.5}/></g>}
  {kind==='send'&&<path d="m5 12 7-7 7 7M12 5v14"/>}
 </svg>
}
function Avatar({choice,en,ribbon=false}:{choice:AvatarChoice;en:boolean;ribbon?:boolean}){
 const [failed,setFailed]=useState<string|null>(null),src=choice==='female'?'/appshell/assistant-female.png':choice==='male'?'/appshell/assistant.png':null
 return <span className={ribbon?'srm-chat-ribbon-avatar':'srm-chat-avatar srm-chat-message-avatar'}>
  {src&&failed!==src?<img src={src} onError={()=>setFailed(src)} alt={en?'Your selected SpendGuru avatar':'Wybrany awatar SpendGuru'} width={61.44} height={61.44}/>
   :<span className="srm-chat-neutral" role="img" aria-label={en?'SpendGuru — no avatar selected':'SpendGuru — nie wybrano awatara'} title={en?'No avatar selected':'Nie wybrano awatara'}><SpendGuruLogo width={61} portrait/></span>}
 </span>
}

/** One host-owned widget; a report context label does not invoke a model or grant data access. */
export function AssistantWidget({locale,salutation,avatar,theme,content=createAssistantContent(locale,salutation),conversation,notifications,onCollapsedChange}:Props){
 const en=locale==='en',id=useId(),inputId=useId(),[collapsed,setCollapsed]=useState(false)
 const state=useSyncExternalStore(conversation?.subscribe??noSubscription,conversation?.getSnapshot??noConversation,conversation?.getSnapshot??noConversation)
 const [historyOpen,setHistoryOpen]=useState(false)
 const collapseTrigger=useRef<HTMLButtonElement>(null),expandTrigger=useRef<HTMLButtonElement>(null),detachTrigger=useRef<HTMLButtonElement>(null)
 const host=useAssistantWindow(()=>{setCollapsed(false);onCollapsedChange?.(false);requestAnimationFrame(()=>detachTrigger.current?.focus({preventScroll:true}))},en)
 function collapse(){setCollapsed(true);onCollapsedChange?.(true);requestAnimationFrame(()=>expandTrigger.current?.focus({preventScroll:true}))}
 function expand(){setCollapsed(false);onCollapsedChange?.(false);requestAnimationFrame(()=>collapseTrigger.current?.focus({preventScroll:true}))}
 const greeting=(en?'Hello':'Cześć')+(salutation?`, ${salutation}`:'')+'!'
 const panel=<div className="srm-chat-motion" id={id} aria-hidden={collapsed&&!host.target||undefined} ref={node=>{if(node)node.inert=collapsed&&!host.target}}>
  {!host.target&&<button ref={collapseTrigger} className="srm-chat-collapse" type="button" onClick={collapse} aria-expanded={!collapsed} aria-controls={id} aria-label={en?'Hide assistant':'Schowaj asystenta'} title={en?'Hide assistant':'Schowaj asystenta'}><Glyph kind="collapse"/></button>}
  <div className="srm-chat-window"><header className="srm-chat-header">
   <div className="srm-chat-greeting"><h3>{greeting} {en?'I am SpendGuru, your advisor.':'Jestem SpendGuru, Twój doradca.'}</h3></div>
   <div className="srm-chat-tools"><button ref={detachTrigger} autoFocus={!!host.target} className="srm-chat-tool" type="button" onClick={host.target?host.attach:host.detach} aria-label={host.target?(en?'Return assistant to workspace':'Przyłącz asystenta do biurka'):(en?'Open assistant in a separate window':'Otwórz asystenta w osobnym oknie')} title={host.target?(en?'Return to workspace':'Przyłącz do biurka'):(en?'Open in a separate window':'Otwórz w osobnym oknie')}><Glyph kind={host.target?'attach':'detach'}/></button>
    <button className="srm-chat-tool" type="button" disabled={!conversation||!state?.active} aria-expanded={conversation?historyOpen:undefined} onClick={()=>{if(!conversation)return;setHistoryOpen(!historyOpen);if(!historyOpen)void conversation.refreshHistory()}} aria-label={en?'Conversation history':'Historia rozmowy'} title={en?'Conversation history':'Historia rozmowy'}><Glyph kind="clock"/></button>
    <button className="srm-chat-tool" type="button" disabled aria-label={en?'Change SpendGuru avatar':'Zmień awatar SpendGuru'} title={en?'Change avatar':'Zmień awatar'}><Glyph kind="more"/></button>
   </div>
  </header>
  {!host.target&&content.contextLabel&&<p className="srm-chat-screen-context" aria-label={en?"Assistant context":"Kontekst asystenta"}>{content.contextLabel}</p>}
  {notifications}
  {host.error&&<p className="srm-chat-window-error" role="alert">{host.error}</p>}
  {conversation&&state?<AssistantConversationView key={state.scopeRevision} session={conversation} state={state} en={en} historyOpen={historyOpen} onCloseHistory={()=>setHistoryOpen(false)} inputId={inputId} avatar={<Avatar choice={avatar} en={en}/>}/>:<><div className="srm-chat-transcript" role="region" aria-label={en?'SpendGuru introduction':'Powitanie SpendGuru'} tabIndex={0}>
   <div className="srm-chat-welcome-live"><div className="srm-chat-incoming"><Avatar choice={avatar} en={en}/>
    <article className="srm-chat-message srm-chat-welcome-bubble" aria-label={en?'SpendGuru greeting':'Powitanie SpendGuru'}>
     <p><strong>{content.welcomeLead}</strong></p>
     <p>{content.welcomeDetail}</p>
    </article>
   </div></div>
  </div>
  <div className="srm-chat-composer"><label htmlFor={inputId}>{en?'What would you like to ask?':'O co chcesz zapytać?'}</label>
   <div className="srm-chat-input-wrap"><textarea id={inputId} rows={2} placeholder={en?'Write a message…':'Napisz wiadomość…'} disabled/>
    <button className="as-primary-button" type="button" disabled aria-label={en?'Send message':'Wyślij wiadomość'} title={en?'Send message':'Wyślij wiadomość'}><Glyph kind="send"/></button>
   </div>
  </div></>}</div>
 </div>
 return <>
  <div data-analytics-exclude="assistant" className={'srm-chat-slot'+(collapsed?' is-collapsed':'')+(host.target?' is-detached':'')}>
   {host.target?<div className="srm-chat-detached-ribbon"><Avatar choice={avatar} en={en} ribbon/><span className="srm-chat-detached-caption">{en?'Assistant in a separate window':'Asystent w osobnym oknie'}</span><button type="button" className="srm-chat-attach-button" onClick={host.attach} aria-label={en?'Return assistant to workspace':'Przyłącz asystenta do biurka'}><Glyph kind="attach"/></button></div>:panel}
   {!host.target&&<button ref={expandTrigger} className="srm-chat-ribbon" type="button" onClick={expand} tabIndex={collapsed?0:-1} aria-hidden={!collapsed||undefined} aria-expanded={!collapsed} aria-controls={id} aria-label={en?'Show assistant':'Pokaż asystenta'} title={en?'Show assistant':'Pokaż asystenta'}><Avatar choice={avatar} en={en} ribbon/><Glyph kind="expand"/></button>}
  </div>
  {host.target&&createPortal(<div className="appshell srm-detached-shell" data-theme={theme} style={{colorScheme:theme}}><section data-analytics-exclude="assistant" className="srm-chat-slot is-window" aria-label={en?'SpendGuru assistant':'Asystent SpendGuru'}>{panel}</section></div>,host.target)}
 </>
}
