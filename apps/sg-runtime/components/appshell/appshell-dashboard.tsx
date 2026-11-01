'use client'

import React, {useEffect, useState, useCallback} from 'react'
import {usePathname, useRouter, useSearchParams} from 'next/navigation'
import type {AssistantScreenContext} from './assistant-widget';
import {PlatformAppShell} from './platform-appshell'
import {XRayModuleHost} from './xray-module-host'
import {isXrayPath,xrayPath} from '@/lib/appshell/xray-navigation'
import {AdpModuleHost} from './adp-module-host'
import {adpPath, dashboardPath, isAdpPath, parseAdpNavigation} from '@/lib/appshell/adp-navigation'
import {BenchmarkFinderClient} from '../benchmark-finder/benchmark-finder-client'
import {Sg2ModuleSession} from '../auth/session-boundary'

export function AppShellDashboard(props: {
  locale: 'pl' | 'en'; salutation?: string | null; assistantAvatar?: 'male' | 'female' | null
  organisationBranding?: 'porr' | null; onLogout: () => void
}) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams()
  const xrayActive=isXrayPath(pathname,props.locale)
  const active = isAdpPath(pathname, props.locale)
  const benchmarkPath=`/${props.locale}/dashboard/benchmark-finder`
  const benchmarkActive=pathname===benchmarkPath||pathname===benchmarkPath+'/'
  const [xrayAssistantTarget,setXrayAssistantTarget]=useState<HTMLElement|null>(null);
  const [xrayAssistantContext,setXrayAssistantContext]=useState<AssistantScreenContext|null>(null);
  const onXrayAssistantContext=useCallback((next:AssistantScreenContext|null)=>setXrayAssistantContext(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next),[]);
  const [xrayOpened,setXrayOpened]=useState(xrayActive)
  useEffect(()=>{if(xrayActive)setXrayOpened(true)},[xrayActive])
  const [opened, setOpened] = useState(active)
  const [benchmarkOpened,setBenchmarkOpened]=useState(benchmarkActive)
  useEffect(() => {if (active) setOpened(true)}, [active])
  useEffect(()=>{if(benchmarkActive)setBenchmarkOpened(true)},[benchmarkActive])
  const navigation = parseAdpNavigation(search.toString())
  return <PlatformAppShell {...props} assistantTarget={xrayActive?xrayAssistantTarget:null} assistantContext={xrayActive?xrayAssistantContext:null} moduleActive={active||benchmarkActive||xrayActive}
    onLaunchXray={()=>{setXrayOpened(true);router.push(xrayPath(props.locale))}}
    onLaunchBenchmark={()=>{setBenchmarkOpened(true);router.push(benchmarkPath)}}
    onLaunchAdp={() => {setOpened(true); router.push(adpPath(props.locale))}}
    moduleWorkspace={theme => <>
      <section hidden={!xrayActive} aria-label="X-Ray Supplier Intelligence" data-appshell-module="xray">
        {xrayOpened&&<Sg2ModuleSession locale={props.locale}><XRayModuleHost locale={props.locale} theme={theme} active={xrayActive} onAssistantTargetChange={setXrayAssistantTarget} onAssistantContextChange={onXrayAssistantContext} onReturn={()=>router.push(dashboardPath(props.locale))}/></Sg2ModuleSession>}
      </section>
      <section hidden={!benchmarkActive} aria-label="Benchmark Finder" data-appshell-module="benchmark-finder">
        {benchmarkOpened&&<Sg2ModuleSession locale={props.locale}><div className="as-benchmark-module">
          <button type="button" className="as-secondary-button" onClick={()=>router.push(dashboardPath(props.locale))}>{props.locale==='en'?'Back to AppShell':'Wróć do AppShella'}</button>
          <BenchmarkFinderClient locale={props.locale} active={benchmarkActive} assistantOwner="host" headerOwner="host" hostTheme={theme}/>
        </div></Sg2ModuleSession>}
      </section>
      <section hidden={!active} data-appshell-module="adp">{opened || active ? <AdpModuleHost locale={props.locale} theme={theme} active={active}
      organizationDisplayName={props.organisationBranding === 'porr' ? 'PORR' : 'SpendGuru'} navigation={navigation}
      onNavigate={next => router.push(adpPath(props.locale, next), {scroll: false})}
      onReturn={() => router.push(dashboardPath(props.locale))} /> : null}</section>
    </>} />
}
