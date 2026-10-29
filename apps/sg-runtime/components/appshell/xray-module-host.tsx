'use client'
import React,{Component,useMemo,type ReactNode} from 'react';
import {SupplierXRayWorkflow} from '@profitia/srm-xray/workflow';
import '@profitia/srm-xray/workflow.css';
import {useSg2SessionCredential} from '../auth/session-boundary';
import {createAppShellXRayTransport} from '@/lib/appshell/xray-transport';
type Props={locale:'pl'|'en';theme:'light'|'dark';active:boolean;onReturn:()=>void};
class XRayBoundary extends Component<{locale:'pl'|'en';active:boolean;onReturn:()=>void;children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 componentDidUpdate(previous:{locale:"pl"|"en";active:boolean}){if((previous.locale!==this.props.locale||previous.active&&!this.props.active)&&this.state.failed)this.setState({failed:false});}
 render(){return this.state.failed?<div role="alert"><p>{this.props.locale==='pl'?'Nie udało się wyświetlić X-Ray. Wróć do biurka i uruchom moduł ponownie.':'X-Ray could not be displayed. Return to Dashboard and reopen the module.'}</p><button type="button" className="as-secondary-button" onClick={this.props.onReturn}>{this.props.locale==='pl'?'Wróć do biurka':'Back to Dashboard'}</button></div>:this.props.children;}
}
export function XRayModuleHost(props:Props){
 const credential=useSg2SessionCredential();
 const transport=useMemo(()=>createAppShellXRayTransport(credential??(async()=>null)),[credential]);
 return <XRayBoundary active={props.active} locale={props.locale} onReturn={props.onReturn}><SupplierXRayWorkflow {...props} transport={transport}/></XRayBoundary>;
}
