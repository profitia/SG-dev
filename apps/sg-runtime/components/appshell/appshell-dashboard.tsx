'use client'

import React, {useEffect, useState} from 'react'
import {usePathname, useRouter, useSearchParams} from 'next/navigation'
import {PlatformAppShell} from './platform-appshell'
import {AdpModuleHost} from './adp-module-host'
import {adpPath, dashboardPath, isAdpPath, parseAdpNavigation} from '@/lib/appshell/adp-navigation'

export function AppShellDashboard(props: {
  locale: 'pl' | 'en'; salutation?: string | null; assistantAvatar?: 'male' | 'female' | null
  organisationBranding?: 'porr' | null; onLogout: () => void
}) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams()
  const active = isAdpPath(pathname, props.locale)
  const [opened, setOpened] = useState(active)
  useEffect(() => {if (active) setOpened(true)}, [active])
  const navigation = parseAdpNavigation(search.toString())
  return <PlatformAppShell {...props} moduleActive={active}
    onLaunchAdp={() => {setOpened(true); router.push(adpPath(props.locale))}}
    moduleWorkspace={theme => opened || active ? <AdpModuleHost locale={props.locale} theme={theme} active={active}
      organizationDisplayName={props.organisationBranding === 'porr' ? 'PORR' : 'SpendGuru'} navigation={navigation}
      onNavigate={next => router.push(adpPath(props.locale, next), {scroll: false})}
      onReturn={() => router.push(dashboardPath(props.locale))} /> : null} />
}
