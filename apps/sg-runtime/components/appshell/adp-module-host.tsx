'use client'

import React, {useId, useRef, useState} from 'react'
import {AdpWorkspace, ADP_UI_CONTRACT_VERSION} from '@profitia/srm-adp-ui'
import type {AdpLocalEvent, AdpNavigation, AdpTheme} from '@profitia/srm-adp-ui'
import '@profitia/srm-adp-ui/styles.css'
import {applyScopedAdpEvent, createLocalAdpContext, createLocalAdpModel} from '@/lib/appshell/adp-local-model'

type Props = {
  locale: 'pl' | 'en'; theme: AdpTheme; active: boolean; organizationDisplayName: string
  navigation: AdpNavigation; onNavigate: (navigation: AdpNavigation) => void; onReturn: () => void
}

class MountBoundary extends React.Component<{locale: 'pl' | 'en'; onReturn: () => void; children: React.ReactNode}, {failed: boolean}> {
  state = {failed: false}
  static getDerivedStateFromError() {return {failed: true}}
  render() {
    if (!this.state.failed) return this.props.children
    return <section className="as-module-error" role="alert"><h1>{this.props.locale === 'en' ? 'Could not load the card' : 'Nie udało się wczytać karty'}</h1>
      <button className="as-secondary-button" type="button" onClick={this.props.onReturn}>{this.props.locale === 'en' ? 'Back to AppShell' : 'Wróć do AppShella'}</button></section>
  }
}

/** Session-scoped host. This model has no persistence or business transport. */
export function AdpModuleHost(props: Props) {
  const instanceId = useId(), currentInstance = useRef(instanceId)
  const [model, setModel] = useState(() => createLocalAdpModel(props.organizationDisplayName))
  const context = useRef(createLocalAdpContext(props.locale))
  function onLocalEvent(event: AdpLocalEvent, incomingInstance: string) {
    setModel(previous => applyScopedAdpEvent(currentInstance.current, incomingInstance, previous, event, context.current))
  }
  return <MountBoundary locale={props.locale} onReturn={props.onReturn}>
    <AdpWorkspace contractVersion={ADP_UI_CONTRACT_VERSION} instanceId={instanceId} locale={props.locale} theme={props.theme}
      model={model} navigation={props.navigation} active={props.active} onNavigate={props.onNavigate} onReturn={props.onReturn} onLocalEvent={onLocalEvent}/>
  </MountBoundary>
}
