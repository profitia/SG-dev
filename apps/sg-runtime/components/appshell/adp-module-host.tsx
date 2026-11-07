'use client'

import React, {useSyncExternalStore,useEffect, useId, useRef, useState} from 'react'
import {productAnalytics} from '@/lib/product-analytics/adapter'
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
  componentDidCatch() {productAnalytics.capture('application_error',{module:'adp',error_kind:'render_failed'})}
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
  const analyticsReady=useSyncExternalStore(productAnalytics.subscribe,productAnalytics.isReady,productAnalytics.serverReady)
  const {view,section,dataArea}=props.navigation
  useEffect(()=>{
    if(!analyticsReady||!props.active)return
    productAnalytics.transition('adp-view',view,'adp_view_opened',{module:'adp',view})
    productAnalytics.transition('screen',`adp:${view}:${section}:${dataArea}`,'screen_viewed',{module:'adp',view,...(view==='data'?{section,data_area:dataArea}:{})})
    if(view==='data')productAnalytics.transition('adp-section',`${section}:${dataArea}`,'adp_form_section_opened',{module:'adp',section,data_area:dataArea})
  },[analyticsReady,props.active,view,section,dataArea])
  useEffect(()=>{if(!props.active){productAnalytics.clearTransition('adp-view');productAnalytics.clearTransition('adp-section')}},[props.active])
  const onReturn=()=>{if(props.active)productAnalytics.capture('adp_returned_to_appshell',{module:'adp'});props.onReturn()}
  function onLocalEvent(event: AdpLocalEvent, incomingInstance: string) {
    if(props.active&&incomingInstance===currentInstance.current)productAnalytics.capture('adp_local_action_performed',{module:'adp',action_type:event.type})
    setModel(previous => applyScopedAdpEvent(currentInstance.current, incomingInstance, previous, event, context.current))
  }
  return <MountBoundary locale={props.locale} onReturn={onReturn}>
    <AdpWorkspace contractVersion={ADP_UI_CONTRACT_VERSION} instanceId={instanceId} locale={props.locale} theme={props.theme}
      model={model} navigation={props.navigation} active={props.active} onNavigate={props.onNavigate} onReturn={onReturn} onLocalEvent={onLocalEvent}/>
  </MountBoundary>
}
