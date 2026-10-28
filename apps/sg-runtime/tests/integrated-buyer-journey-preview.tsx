/** Isolated browser fixture. Never imported by product entry points. */
import React from 'react'
import {NextIntlClientProvider} from 'next-intl'
import messages from '../messages/pl.json'
import {createRoot} from 'react-dom/client'
import {AppShellDashboard} from '../components/appshell/appshell-dashboard'
import {Sg2IdentityProvider} from '../components/auth/session-boundary'
const root=createRoot(document.getElementById('root')!)
const state=globalThis as typeof globalThis&{__adpTestAuth:unknown;__setJourneyAuth:(v:unknown)=>void}
state.__adpTestAuth={isLoaded:true,isSignedIn:true,userId:'synthetic-user-a',sessionId:'synthetic-session-a',orgId:'synthetic-org-a',getToken:async()=> 'synthetic.browser.signature'}
function render(){root.render(<NextIntlClientProvider locale="pl" messages={messages} timeZone="UTC"><Sg2IdentityProvider mode="clerk" publishableKey="pk_test_fixture" locale="pl"><AppShellDashboard locale="pl" salutation="Kupujący" onLogout={()=>{}}/></Sg2IdentityProvider></NextIntlClientProvider>)}
state.__setJourneyAuth=v=>{state.__adpTestAuth={...(state.__adpTestAuth as object),...(v as object)};render()}
render()
