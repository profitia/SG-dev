'use client'
import React,{Component,useMemo,useRef,useLayoutEffect,useCallback,type ReactNode} from 'react';
import type {AssistantApplicationContext} from '@profitia/srm-xray/full-report';
import {FullXRayWorkflow} from '@profitia/srm-xray/full-workflow';
import {createSupplierSearchGateway} from '@profitia/srm-xray/supplier-search-gateway';
import '@profitia/srm-xray/full-report.css';
import {useSg2SessionCredential} from '../auth/session-boundary';
import {createAppShellFullXRayTransport,loadXRayMap,XRAY_MAP_RUNTIME_ORIGIN} from '@/lib/appshell/xray-full-transport';
type Props={locale:'pl'|'en';theme:'light'|'dark';active:boolean;onReturn:()=>void;onAssistantTargetChange?:(target:HTMLElement|null)=>void;onAssistantContextChange?:(context:AssistantApplicationContext|null)=>void};
class XRayBoundary extends Component<{locale:'pl'|'en';active:boolean;onReturn:()=>void;children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 componentDidUpdate(previous:{locale:"pl"|"en";active:boolean}){if((previous.locale!==this.props.locale||previous.active&&!this.props.active)&&this.state.failed)this.setState({failed:false});}
 render(){return this.state.failed?<div role="alert"><p>{this.props.locale==='pl'?'Nie udało się wyświetlić X-Ray. Wróć do biurka i uruchom moduł ponownie.':'X-Ray could not be displayed. Return to Dashboard and reopen the module.'}</p><button type="button" className="as-secondary-button" onClick={this.props.onReturn}>{this.props.locale==='pl'?'Wróć do biurka':'Back to Dashboard'}</button></div>:this.props.children;}
}
function AssistantTarget({active,onTarget}:{active:boolean;onTarget:(target:HTMLElement|null)=>void}){
 const target=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{onTarget(active?target.current:null);return()=>onTarget(null)},[active,onTarget]);
 return <div ref={target} className="srm-host-assessment as-xray-assistant-host"/>;
}
export function XRayModuleHost(props:Props){
 const credential=useSg2SessionCredential();
 const onContext=useCallback((value:AssistantApplicationContext|null)=>props.onAssistantContextChange?.(props.active?value:null),[props.active,props.onAssistantContextChange]);
 const transport=useMemo(()=>createAppShellFullXRayTransport(credential??(async()=>null)),[credential]);
 const searchGateway=useMemo(()=>createSupplierSearchGateway(transport),[transport]);
 return <XRayBoundary active={props.active} locale={props.locale} onReturn={props.onReturn}><div data-theme={props.theme} lang={props.locale}><FullXRayWorkflow locale={props.locale} transport={transport} searchGateway={searchGateway} active={props.active} observeWorkflowTiming onAssistantContext={onContext} assistantHost={props.onAssistantTargetChange?<AssistantTarget active={props.active} onTarget={props.onAssistantTargetChange}/>:undefined} onReturn={props.onReturn} loadMap={loadXRayMap} mapRuntimeOrigin={XRAY_MAP_RUNTIME_ORIGIN}/></div></XRayBoundary>;
}
