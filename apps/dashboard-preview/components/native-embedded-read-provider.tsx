'use client'

import React, { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react'
import { connectNativeEmbeddedRead, type NativeEmbeddedConfiguration, type NativeEmbeddedSelection } from '../lib/platform/native-embedded-read'
import {connectNativeEmbeddedCommand,type NativeForecastSubmitter} from '../lib/platform/native-embedded-command'

const legacyFetch:typeof fetch=(input,init)=>globalThis.fetch(input,init)
const legacy=Object.freeze({fetch:legacyFetch,readOnly:false,parentOrigin:null as string|null,commands:null as NativeForecastSubmitter|null})
const Presentation=createContext<{fetch:typeof fetch;readOnly:boolean;parentOrigin:string|null;commands:NativeForecastSubmitter|null}>(legacy)
export function useEmbeddedReadPresentation(){return useContext(Presentation)}

export function NativeEmbeddedReadProvider({configuration,context,children}:{configuration:NativeEmbeddedConfiguration;context:NativeEmbeddedSelection;children:ReactNode}){
  const scopeTag=JSON.stringify([configuration.configurationVersion,context.locale,context.seriesId,context.organisationId])
  const [ready,setReady]=useState<{scopeTag:string;fetch:typeof fetch;instanceId:string;parentOrigin:string}|null>(null)
  const [failed,setFailed]=useState(false)
  const [commands,setCommands]=useState<{scopeTag:string;value:NativeForecastSubmitter}|null>(null)
  useEffect(()=>{
    setReady(null);setFailed(false);setCommands(null)
    let commandChannel:ReturnType<typeof connectNativeEmbeddedCommand>|undefined,channel:ReturnType<typeof connectNativeEmbeddedRead>|undefined,readUnavailable=false
    try{
      channel=connectNativeEmbeddedRead({hostWindow:window,configuration,context,
        onReady:(fetch,instanceId,parentOrigin)=>setReady({scopeTag,fetch,instanceId,parentOrigin}),
        onUnavailable:()=>{readUnavailable=true;commandChannel?.close();setCommands(null);setReady(null);setFailed(true)}})
      if(readUnavailable)throw Error('Embedded presentation unavailable')
      if(configuration.commands)commandChannel=connectNativeEmbeddedCommand({hostWindow:window,configuration,context,documentId:channel.documentId,
        onReady:value=>setCommands({scopeTag,value}),onUnavailable:()=>setCommands(null)})
      return()=>{commandChannel?.close();channel?.close()}
    }catch{commandChannel?.close();channel?.close();setCommands(null);setReady(null);setFailed(true)}
  },[configuration,context,scopeTag])
  if(!ready||ready.scopeTag!==scopeTag)return <p role="status">{context.locale==='pl'
    ?failed?'Podgląd jest chwilowo niedostępny.':'Łączenie z aplikacją…'
    :failed?'Preview is temporarily unavailable.':'Connecting to the application…'}</p>
  return <Presentation.Provider value={{fetch:ready.fetch,readOnly:true,parentOrigin:ready.parentOrigin,commands:commands?.scopeTag===scopeTag?commands.value:null}}>
    <Fragment key={ready.instanceId}>{children}</Fragment>
  </Presentation.Provider>
}
