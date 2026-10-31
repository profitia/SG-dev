"use client";
import React,{useMemo} from 'react';
import {FullXRayWorkflow} from './full-workflow';
import {createXRayWorkflowTransport,xrayOperation} from './workflow-contract';
import {createSupplierSearchGateway} from './supplier-search-gateway';
export type SupplierXRayWorkflowProps={locale:'pl'|'en';theme:'light'|'dark';active:boolean;transport:typeof fetch;onReturn:()=>void};
/** Compatibility export. It mounts the same full product; no embedded UI remains. */
export function SupplierXRayWorkflow({transport,...props}:SupplierXRayWorkflowProps){
 const wire=useMemo(()=>{const legacy=createXRayWorkflowTransport(transport);return ((input,init)=>typeof input==='string'&&xrayOperation(input)?legacy(input,init):transport(input,init)) as typeof fetch},[transport]);
 const gateway=useMemo(()=>createSupplierSearchGateway(wire),[wire]);
 return <div lang={props.locale} data-theme={props.theme}><FullXRayWorkflow {...props} transport={wire} searchGateway={gateway} observeWorkflowTiming/></div>;
}
