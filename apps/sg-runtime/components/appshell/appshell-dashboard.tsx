'use client'

import React, {useEffect, useState} from 'react'
import {usePathname, useRouter, useSearchParams} from 'next/navigation'
import {PlatformAppShell} from './platform-appshell'
import {AdpModuleHost} from './adp-module-host'
import {adpPath, dashboardPath, isAdpPath, parseAdpNavigation} from '@/lib/appshell/adp-navigation'
import {BenchmarkFinderClient} from '../benchmark-finder/benchmark-finder-client'
import {Sg2ModuleSession} from '../auth/session-boundary'

export function AppShellDashboard(props: {
  locale: 'pl' | 'en'; salutation?: string | null; assistantAvatar?: 'male' | 'female' | null
  organisationBranding?: 'porr' | null; onLogout: () => void
}) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams()
  const active = isAdpPath(pathname, props.locale)
  const benchmarkPath=`/${props.locale}/dashboard/benchmark-finder`
  const benchmarkActive=pathname===benchmarkPath||pathname===benchmarkPath+'/'
  const [opened, setOpened] = useState(active)
  const [benchmarkOpened,setBenchmarkOpened]=useState(benchmarkActive)
  useEffect(() => {if (active) setOpened(true)}, [active])
  useEffect(()=>{if(benchmarkActive)setBenchmarkOpened(true)},[benchmarkActive])
  const navigation = parseAdpNavigation(search.toString())
  return <PlatformAppShell {...props} moduleActive={active||benchmarkActive}
    onLaunchBenchmark={()=>{setBenchmarkOpened(true);router.push(benchmarkPath)}}
    onLaunchAdp={() => {setOpened(true); router.push(adpPath(props.locale))}}
    moduleWorkspace={theme => <>
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
