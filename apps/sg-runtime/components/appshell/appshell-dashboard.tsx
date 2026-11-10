'use client'

import React, {useSyncExternalStore,useEffect,useLayoutEffect,useRef,useMemo, useState} from 'react'
import {AssistantConversationSession} from './assistant-conversation-session'
import {createAssistantConversationTransport} from './assistant-conversation-transport'
import {productAnalytics} from '@/lib/product-analytics/adapter'
import {usePathname, useRouter, useSearchParams} from 'next/navigation'
import {useAssistantScreenContext,type AssistantModule} from './assistant-screen-context';
import {PlatformAppShell} from './platform-appshell'
import {XRayModuleHost} from './xray-module-host'
import {isXrayPath,xrayPath} from '@/lib/appshell/xray-navigation'
import {AdpModuleHost} from './adp-module-host'
import {adpPath, dashboardPath, isAdpPath, parseAdpNavigation} from '@/lib/appshell/adp-navigation'
import {BenchmarkFinderClient} from '../benchmark-finder/benchmark-finder-client'
import {Sg2ModuleSession} from '../auth/session-boundary'
import {ProcurementInsightsWorkspace} from '../procurement-insights/workspace'
import {ProcurementInsightsNotifications} from '../procurement-insights/notifications'

export function AppShellDashboard(props: {
  locale: 'pl' | 'en'; salutation?: string | null; assistantAvatar?: 'male' | 'female' | null
  organisationBranding?: 'porr' | null; onLogout: () => void
  assistantCredential?:()=>Promise<string|null>;assistantScope?:string
}) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams()
  const xrayActive=isXrayPath(pathname,props.locale)
  const active = isAdpPath(pathname, props.locale)
  const benchmarkPath=`/${props.locale}/dashboard/benchmark-finder`
  const benchmarkActive=pathname===benchmarkPath||pathname===benchmarkPath+'/'
  const insightsPath=`/${props.locale}/dashboard/procurement-insights`
  const insightsActive=pathname===insightsPath||pathname===insightsPath+'/'
  const assistantModule:AssistantModule=xrayActive?'xray':active?'adp':benchmarkActive?'benchmark_finder':insightsActive?'procurement_insights':'appshell';
  const {context:assistantContext,onXrayContext,assistantReference,onBenchmarkContext,onNewsfeedContext}=useAssistantScreenContext(assistantModule);
  const conversationInputs=useRef<{credential?:()=>Promise<string|null>;locale:'pl'|'en';module:AssistantModule;reference:typeof assistantReference}>({credential:props.assistantCredential,locale:props.locale,module:assistantModule,reference:assistantReference})
  conversationInputs.current={credential:props.assistantCredential,locale:props.locale,module:assistantModule,reference:assistantReference}
  const conversation=useMemo(()=>new AssistantConversationSession(createAssistantConversationTransport({
    getToken:async()=>conversationInputs.current.credential?.()??null,
    view:()=>({locale:conversationInputs.current.locale,module:conversationInputs.current.module,reference:conversationInputs.current.reference}),
  })),[])
  useLayoutEffect(()=>{conversation.activate(props.assistantCredential&&props.assistantScope?props.assistantScope:null);return()=>conversation.activate(null)},[conversation,props.assistantScope,!!props.assistantCredential])
  const viewKey=JSON.stringify([assistantModule,assistantReference])
  useLayoutEffect(()=>{conversation.changeView()},[conversation,viewKey])
  const [xrayOpened,setXrayOpened]=useState(xrayActive)
  useEffect(()=>{if(xrayActive)setXrayOpened(true)},[xrayActive])
  const [opened, setOpened] = useState(active)
  const [benchmarkOpened,setBenchmarkOpened]=useState(benchmarkActive)
  const [insightsOpened,setInsightsOpened]=useState(insightsActive)
  useEffect(()=>{if(insightsActive)setInsightsOpened(true)},[insightsActive])
  useEffect(() => {if (active) setOpened(true)}, [active])
  useEffect(()=>{if(benchmarkActive)setBenchmarkOpened(true)},[benchmarkActive])
  const navigation = parseAdpNavigation(search.toString())
  const analyticsReady=useSyncExternalStore(productAnalytics.subscribe,productAnalytics.isReady,productAnalytics.serverReady)
  const analyticsModule=xrayActive?'xray':active?'adp':benchmarkActive?'benchmark_finder':'appshell'
  useEffect(()=>{
    if(!analyticsReady)return
    productAnalytics.once('app','app_opened',{module:'appshell',entry_point:'appshell'})
    if(analyticsModule==='appshell')productAnalytics.clearTransition('module')
    else productAnalytics.transition('module',analyticsModule,'module_opened',{module:analyticsModule,entry_point:'appshell'})
    if(analyticsModule!=='adp')productAnalytics.transition('screen',analyticsModule,'screen_viewed',{module:analyticsModule,view:analyticsModule})
  },[analyticsReady,analyticsModule])
  return <PlatformAppShell {...props} assistantConversation={props.assistantCredential?conversation:undefined} assistantContext={assistantContext}
    assistantSelectionLabel={assistantReference?.source==='NEWSFEED'?(props.locale==='pl'?'Wybrana obserwacja Newsfeed':'Selected Newsfeed observation'):null}
    assistantNotifications={props.assistantCredential&&props.assistantScope?<ProcurementInsightsNotifications key={props.assistantScope} getToken={props.assistantCredential} locale={props.locale} onOpen={(observationId,publicationId)=>{setInsightsOpened(true);router.push(insightsPath+'?observation='+encodeURIComponent(observationId)+'&publication='+encodeURIComponent(publicationId))}} onOpenReport={id=>{setInsightsOpened(true);router.push(insightsPath+'?tab=reports&edition='+encodeURIComponent(id))}}/>:null}
    moduleActive={active||benchmarkActive||xrayActive||insightsActive}
    onLaunchXray={()=>{setXrayOpened(true);router.push(xrayPath(props.locale))}}
    onLaunchBenchmark={()=>{setBenchmarkOpened(true);router.push(benchmarkPath)}}
    onLaunchAdp={() => {setOpened(true); router.push(adpPath(props.locale))}}
    onLaunchInsights={()=>{setInsightsOpened(true);router.push(insightsPath)}}
    moduleWorkspace={theme => <>
      <section hidden={!insightsActive} aria-label="Procurement Insights" data-appshell-module="procurement-insights">
        {insightsOpened&&<Sg2ModuleSession key={props.assistantScope??'anonymous'} locale={props.locale}><ProcurementInsightsWorkspace locale={props.locale} active={insightsActive} onContext={onNewsfeedContext} onReturn={()=>router.push(dashboardPath(props.locale))}/></Sg2ModuleSession>}
      </section>
      <section hidden={!xrayActive} aria-label="X-Ray Supplier Intelligence" data-appshell-module="xray">
        {xrayOpened&&<Sg2ModuleSession locale={props.locale}><XRayModuleHost locale={props.locale} theme={theme} active={xrayActive} onAssistantContextChange={onXrayContext} onReturn={()=>router.push(dashboardPath(props.locale))}/></Sg2ModuleSession>}
      </section>
      <section hidden={!benchmarkActive} aria-label="Benchmark Finder" data-appshell-module="benchmark-finder">
        {benchmarkOpened&&<Sg2ModuleSession locale={props.locale}><div className="as-benchmark-module">
          <button type="button" className="as-secondary-button" onClick={()=>router.push(dashboardPath(props.locale))}>{props.locale==='en'?'Back to AppShell':'Wróć do AppShella'}</button>
          <BenchmarkFinderClient locale={props.locale} active={benchmarkActive} assistantOwner="host" headerOwner="host" hostTheme={theme} onAssistantContextChange={onBenchmarkContext}/>
        </div></Sg2ModuleSession>}
      </section>
      <section hidden={!active} data-appshell-module="adp">{opened || active ? <AdpModuleHost locale={props.locale} theme={theme} active={active}
      organizationDisplayName={props.organisationBranding === 'porr' ? 'PORR' : 'SpendGuru'} navigation={navigation}
      onNavigate={next => router.push(adpPath(props.locale, next), {scroll: false})}
      onReturn={() => router.push(dashboardPath(props.locale))} /> : null}</section>
    </>} />
}
