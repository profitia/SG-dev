'use client'
import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useAuth, useClerk } from '@clerk/react'
import { useRouter } from 'next/navigation'
import { AppShellDashboard } from '@/components/appshell/appshell-dashboard'
import { dashboardPath } from '@/lib/appshell/adp-navigation'
import {productAnalytics} from '@/lib/product-analytics/adapter'

type State = { key: string; status: 'loading' | 'choosing' | 'ready' | 'failed' | 'expired' | 'signing-out' | 'logout-failed'; userId?: string; expiresAt?: string; assistantAvatar?: 'male' | 'female' | null; organisationId?: string; organisationSlug?:string; choices?:readonly {slug:string;name:string|null}[]; salutation?: { firstName: string | null; vocative: string | null; dictionaryVersion: string | null } | null }
export function AccountLanding({ locale, completionUrl, presentation = 'account', organisationBranding, dashboard = false, organisationAccess = false }: {
  locale: 'pl' | 'en'; completionUrl: string; presentation?: 'account' | 'workspace'; organisationBranding?: 'porr' | null; dashboard?: boolean; organisationAccess?: boolean
}) {
  const { isLoaded, isSignedIn, userId, sessionId, orgId, getToken } = useAuth(), clerk = useClerk()
  const router = useRouter()
  const [choice,setChoice]=useState<string|undefined>(undefined)
  const key = JSON.stringify([userId, sessionId, orgId ?? null,organisationAccess?choice??null:null]), current = useRef<AbortController | null>(null)
  const [retry, setRetry] = useState(0), [state, setState] = useState<State>({ key: '', status: 'loading' })
  const [refreshError, setRefreshError] = useState(false)
  const workspaceReady = presentation === 'workspace' && isLoaded && isSignedIn && !!userId && !!sessionId
    && state.key === key && state.status === 'ready' && Date.parse(state.expiresAt ?? '') > Date.now()
  useEffect(()=>{if(organisationAccess)setChoice(new URL(window.location.href).searchParams.get('organisation')??'')},[organisationAccess])
  useEffect(() => {
    if (workspaceReady && !dashboard) router.replace(dashboardPath(locale)+(state.organisationSlug?'?organisation='+encodeURIComponent(state.organisationSlug):''))
  }, [workspaceReady, dashboard, locale, router,state.organisationSlug])
  useEffect(() => {
    const controller = new AbortController(); current.current?.abort(); current.current = controller
    setState(previous => presentation === 'workspace' && previous.key === key && previous.status === 'ready'
      && Date.parse(previous.expiresAt ?? '') > Date.now() ? previous : { key, status: 'loading' })
    if (organisationAccess&&choice===undefined)return ()=>controller.abort()
    if (isLoaded && isSignedIn && userId && sessionId) void (async () => {
      const attempt=state.key===key&&state.status==='ready'?null:productAnalytics.begin('account','account_verify',controller.signal)
      let denied = false
      try {
        const credential = await getToken({ skipCache: presentation === 'workspace' }); if (!credential) throw Error('SESSION_REQUIRED')
        const response = await fetch('/api/account', { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${credential}` } })
        denied = response.status === 401 || response.status === 403
        const result = await response.json()
        if (!response.ok || result.authenticated !== true || typeof result.userId !== 'string' || !(Date.parse(result.expiresAt) > Date.now())
          || ![null, 'male', 'female'].includes(result.assistantAvatar)
          || !(result.salutation === null || result.salutation && ['firstName', 'vocative'].every(field => result.salutation[field] === null || typeof result.salutation[field] === 'string'))) throw Error('ACCOUNT_UNAVAILABLE')
        let organisationId:string|undefined,organisationSlug:string|undefined
        if(presentation==='workspace'&&organisationAccess){
          const access=await fetch('/api/account/organisation-access',{method:'POST',headers:{Authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify(choice?{slug:choice}:{}),cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal})
          denied=access.status===401||access.status===403||access.status===409
          const currentAccess=await access.json()
          if(!access.ok)throw Error('ORGANISATION_ACCESS_UNAVAILABLE')
          if(currentAccess.status==='SELECTION_REQUIRED'){
            if(!Array.isArray(currentAccess.choices)||currentAccess.choices.length<2||currentAccess.choices.length>50
              ||!(Date.parse(currentAccess.expiresAt)>Date.now())||Date.parse(currentAccess.expiresAt)>Date.now()+30000
              ||currentAccess.choices.some((c:any)=>!c||typeof c.slug!=='string'||c.slug!=='_legacy'&&!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(c.slug)||c.name!==null&&(typeof c.name!=='string'||c.name.length>320))
              ||new Set(currentAccess.choices.map((c:any)=>c.slug)).size!==currentAccess.choices.length)throw Error('ORGANISATION_CHOICES_UNAVAILABLE')
            if(!controller.signal.aborted){productAnalytics.finish(attempt,'success');setRefreshError(false);setState({key,status:'choosing',choices:currentAccess.choices,expiresAt:currentAccess.expiresAt})}
            return
          }
          if(['ONBOARDING_REQUIRED','PENDING_PACKAGE','RECONCILIATION_REQUIRED'].includes(currentAccess.status)){
            if(!controller.signal.aborted){setState({key,status:'loading'});window.location.assign(completionUrl)}
            return
          }
          if(currentAccess.status!=='READY'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(currentAccess.organisationId??'')||!(Date.parse(currentAccess.expiresAt)>Date.now())||Date.parse(currentAccess.expiresAt)>Date.now()+30000)throw Error('ORGANISATION_ACCESS_UNAVAILABLE')
          organisationId=currentAccess.organisationId
          if(currentAccess.slug!==undefined){
            if(typeof currentAccess.slug!=='string'||currentAccess.slug!=='_legacy'&&!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(currentAccess.slug))throw Error('ORGANISATION_ADDRESS_UNAVAILABLE')
            organisationSlug=currentAccess.slug
            if(!controller.signal.aborted){const address=new URL(window.location.href);address.searchParams.set('organisation',organisationSlug!);window.history.replaceState(window.history.state,'',address)}
          }
          result.expiresAt=new Date(Math.min(Date.parse(result.expiresAt),Date.parse(currentAccess.expiresAt))).toISOString()
        }
        if (!controller.signal.aborted) {
          productAnalytics.finish(attempt,'success')
          productAnalytics.once('verified-auth','auth_session_established',{module:'account'})
          setRefreshError(false)
          setState({ key, status: 'ready', userId: result.userId, expiresAt: result.expiresAt, ...(organisationId?{organisationId}:{}),...(organisationSlug?{organisationSlug}:{}), assistantAvatar: result.assistantAvatar, salutation: result.salutation })
        }
      } catch { if (!controller.signal.aborted) {
        productAnalytics.finish(attempt,'error')
        setRefreshError(!denied)
        // A missing SDK token, network error or 5xx is not an access denial.
        // Keep this mounted workspace only while its same-scope proof is valid;
        // never extend that proof, retain it across 401/403, or restore an old scope.
        setState(previous => !denied && presentation === 'workspace' && previous.key === key && previous.status === 'ready'
          && Date.parse(previous.expiresAt ?? '') > Date.now() ? previous : { key, status: 'failed' })
      } }
    })()
    return () => controller.abort()
  }, [isLoaded, isSignedIn, userId, sessionId, getToken, key, retry, presentation, organisationAccess, completionUrl,choice])
  useEffect(() => {
    if (!['ready','choosing'].includes(state.status) || !state.expiresAt) return
    // A workspace rechecks the existing backend account proof with a fresh SDK
    // token. No new session, organisation grant or product permission is minted.
    if (presentation === 'workspace') {
      const remaining = Date.parse(state.expiresAt) - Date.now()
      // The peer reads can take longer than the old five-second renewal window.
      // Start halfway through short proofs and retry transient failures without
      // destroying consumer memory. The original expiry still fails closed.
      const lead = Math.min(30000, remaining / 2)
      const refresh = setTimeout(() => setRetry(n => n + 1), Math.min(2147483647, refreshError ? 1000 : Math.max(1000, remaining - lead)))
      const expiry = setTimeout(() => setState(previous => previous.key === state.key && previous.expiresAt === state.expiresAt && ['ready','choosing'].includes(previous.status)
        ? { key: previous.key, status: 'expired' } : previous), Math.min(2147483647, Math.max(0, Date.parse(state.expiresAt) - Date.now())))
      const focus = () => setRetry(n => n + 1)
      window.addEventListener('focus', focus)
      return () => { clearTimeout(refresh); clearTimeout(expiry); window.removeEventListener('focus', focus) }
    }
    const timer = setTimeout(() => setState(previous => previous.key === state.key && previous.status === 'ready'
      ? { key: previous.key, status: 'expired' } : previous), Math.min(2147483647, Math.max(0, Date.parse(state.expiresAt) - Date.now())))
    return () => clearTimeout(timer)
  }, [state.key, state.status, state.expiresAt, presentation, refreshError, retry])
  async function logout() {
    current.current?.abort(); setState({ key, status: 'signing-out' })
    try { await clerk.signOut({ sessionId: sessionId ?? undefined, redirectUrl: `/${locale}` }) }
    catch { setState({ key, status: 'logout-failed' }) }
  }
  const en = locale === 'en'
  if (!isLoaded) return <p role="status">{en ? 'Checking your session…' : 'Sprawdzamy Twoją sesję…'}</p>
  if (!isSignedIn) return <p><a href={`/${locale}`} className="underline">{en ? 'Sign in' : 'Zaloguj się'}</a></p>
  const status = state.key !== key ? 'loading' : ['ready','choosing'].includes(state.status) && !(Date.parse(state.expiresAt ?? '') > Date.now()) ? 'expired' : state.status
  if(status==='choosing')return <section className="space-y-5" key={key}>
    <h1 className="text-3xl font-semibold">{en?'Choose your organisation':'Wybierz organizację'}</h1>
    <p>{en?'Open one of your available workspaces.':'Otwórz jedną ze swoich dostępnych przestrzeni.'}</p>
    <div className="flex flex-col gap-3">{state.choices?.map(c=><button key={c.slug} type="button"
      data-library-component="SRM-C02" data-canon-source="shared-v1" data-canon-usage="organisation-entry.choice"
      className="rounded-full border border-slate-300 px-5 py-3 text-left text-sm" onClick={()=>{
        const address=new URL(window.location.href);address.searchParams.set('organisation',c.slug);window.history.replaceState(window.history.state,'',address);setChoice(c.slug)
      }}>{c.name??(en?'Existing workspace':'Dotychczasowa przestrzeń')}</button>)}</div>
    <button type="button" className="underline" onClick={()=>void logout()}>{en?'Sign out / switch account':'Wyloguj się / zmień konto'}</button>
  </section>
  if (workspaceReady && !dashboard) return <p role="status">{en ? 'Opening your workspace…' : 'Otwieramy Twoje biurko…'}</p>
  if (workspaceReady && dashboard) return <>
    {refreshError && <p role="status">{en ? 'Session refresh is temporarily unavailable. Retrying; your work is retained while the current access confirmation remains valid.' : 'Odświeżenie sesji jest chwilowo niedostępne. Ponawiamy; Twoja praca pozostaje zachowana, dopóki bieżące potwierdzenie dostępu jest ważne.'}</p>}
    <AppShellDashboard key={JSON.stringify([key, state.userId, state.organisationId??null])} locale={locale} assistantCredential={getToken} assistantScope={JSON.stringify([key,state.organisationId??null])}
    assistantAvatar={state.assistantAvatar} salutation={locale === 'en' ? state.salutation?.firstName : state.salutation?.vocative}
    organisationBranding={organisationBranding} onLogout={() => void logout()} /></>
  return <section className="space-y-5" key={key}>
    {status === 'ready' ? <><h1 className="text-3xl font-semibold">{en ? 'Your account is ready' : 'Konto gotowe'}</h1>
      <p>{en ? 'You are signed in to your Profitia account.' : 'Jesteś zalogowany do swojego konta Profitia.'}</p>
      {state.assistantAvatar && <div className="flex items-center gap-3">
        <Image src={`/advisory/${state.assistantAvatar === 'female' ? 'anna' : 'adam'}-128.webp`} width={48} height={48}
          className="rounded-full" alt={en ? 'Your selected assistant avatar' : 'Wybrany awatar Twojego asystenta'} />
        <span>{en ? 'Your assistant' : 'Twój asystent'}</span>
      </div>}
      <p className="break-all text-xs text-slate-500">{en ? 'Account ID' : 'Identyfikator konta'}: {state.userId}</p>
      <p className="text-sm text-slate-600">{en ? 'Organisation setup will be available in a later step.' : 'Konfiguracja organizacji będzie dostępna w kolejnym etapie.'}</p></>
      : status === 'failed' || status === 'expired' ? <><p role="alert">{status === 'expired'
        ? (en ? 'Confirm your session again to continue.' : 'Potwierdź ponownie sesję, aby kontynuować.')
        : (en ? 'We could not confirm your account. Please try again.' : 'Nie udało się potwierdzić konta. Spróbuj ponownie.')}</p>
        <button onClick={() => setRetry(n => n + 1)} className="underline">{en ? 'Try again' : 'Spróbuj ponownie'}</button><p><a href={completionUrl} className="underline">{en ? 'Finish preparing your account' : 'Dokończ przygotowanie konta'}</a></p></>
      : status === 'logout-failed' ? <p role="alert">{en ? 'Sign-out was not confirmed. Please try again.' : 'Wylogowanie nie zostało potwierdzone. Spróbuj ponownie.'}</p>
      : <p role="status">{status === 'signing-out' ? (en ? 'Signing out…' : 'Wylogowywanie…') : (en ? 'Confirming your account…' : 'Potwierdzamy Twoje konto…')}</p>}
    <button type="button" disabled={status === 'signing-out'} onClick={() => void logout()} className="rounded-full border border-slate-300 px-5 py-3 text-sm disabled:opacity-50">{en ? 'Sign out / switch account' : 'Wyloguj się / zmień konto'}</button>
  </section>
}
