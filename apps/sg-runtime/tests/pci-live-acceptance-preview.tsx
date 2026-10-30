/** Loopback-only lifecycle fixture. No product imports this entry. */
import React,{useEffect,useState} from 'react'
import {createPortal} from 'react-dom'
import {createRoot} from 'react-dom/client'
import {NextIntlClientProvider} from 'next-intl'
import messages from '../messages/pl.json'
import {AccountLanding} from '../components/auth/account-landing'
import {Sg2IdentityProvider} from '../components/auth/session-boundary'
const state=globalThis as typeof globalThis&{__adpTestAuth:any;__adpTestClerk:any}
let credential=true
const getToken=async()=>credential?'synthetic.browser.signature':null
export function AcceptanceAccount(){return <NextIntlClientProvider locale="pl" messages={messages} timeZone="UTC"><Sg2IdentityProvider mode="clerk" publishableKey="pk_test_fixture" locale="pl"><AccountLanding locale="pl" completionUrl="/pl/account" presentation="workspace" dashboard/></Sg2IdentityProvider></NextIntlClientProvider>}
function Preview(){
 const [target,setTarget]=useState<Element>(document.body)
 useEffect(()=>{const sync=()=>setTarget(document.querySelector('.pci-picker-dialog[open],.pci-host-dialog[open]')??document.body);const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});sync();return()=>observer.disconnect()},[])
 const [version,rerender]=useState(0),[mode,setMode]=useState('normal')
 async function scenario(value:string){await fetch('/__acceptance/account',{method:'POST',body:JSON.stringify({scenario:value})});setMode(value);window.dispatchEvent(new Event('focus'))}
 const identity=(patch:object)=>{state.__adpTestAuth={...state.__adpTestAuth,...patch};rerender(v=>v+1)}
 return <>{createPortal(<aside aria-label="Sterowanie testem — tylko fixture" style={{position:'fixed',bottom:0,left:0,zIndex:10000,background:'white',padding:4,fontSize:12}}>
  <span>Fixture: {mode}, render {version} </span>
  <button onClick={()=>{credential=!credential;setMode(credential?'token dostępny':'token niedostępny')}}>Przełącz dostępność tokenu</button>
  <button onClick={()=>window.dispatchEvent(new Event('focus'))}>Odśwież potwierdzenie</button>
  <button onClick={()=>rerender(v=>v+1)}>Ponowny render hosta</button>
  <button onClick={()=>void scenario('normal')}>Peer 200</button><button onClick={()=>void scenario('503')}>Peer 503</button>
  <button onClick={()=>void scenario('403')}>Peer 403</button><button onClick={()=>void scenario('401')}>Peer 401</button>
  <button onClick={()=>identity({orgId:'synthetic-other-org'})}>Zmień organizację</button>
  <button onClick={()=>identity({isSignedIn:false})}>Wyloguj fixture</button>
 </aside>,target)}<AcceptanceAccount/></>
}
if(document.getElementById('root')){
 state.__adpTestAuth={isLoaded:true,isSignedIn:true,userId:'synthetic-user',sessionId:'synthetic-session',orgId:'synthetic-org',getToken}
 state.__adpTestClerk={signOut:async()=>{state.__adpTestAuth={...state.__adpTestAuth,isSignedIn:false};window.location.assign('/pl/dashboard')}}
 createRoot(document.getElementById('root')!).render(<Preview/>)
}
