'use client'

import React, { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react'
import { connectNativeEmbeddedRead, type NativeEmbeddedConfiguration, type NativeEmbeddedSelection } from '../lib/platform/native-embedded-read'

const legacyFetch:typeof fetch=(input,init)=>globalThis.fetch(input,init)
const legacy=Object.freeze({fetch:legacyFetch,readOnly:false,parentOrigin:null as string|null})
const Presentation=createContext<{fetch:typeof fetch;readOnly:boolean;parentOrigin:string|null}>(legacy)
export function useEmbeddedReadPresentation(){return useContext(Presentation)}

export function NativeEmbeddedReadProvider({configuration,context,children}:{configuration:NativeEmbeddedConfiguration;context:NativeEmbeddedSelection;children:ReactNode}){
  const scopeTag=JSON.stringify([configuration.configurationVersion,context.locale,context.seriesId,context.organisationId])
  const [ready,setReady]=useState<{scopeTag:string;fetch:typeof fetch;instanceId:string;parentOrigin:string}|null>(null)
  const [failed,setFailed]=useState(false)
  useEffect(()=>{
    setReady(null);setFailed(false)
    try{
      const channel=connectNativeEmbeddedRead({hostWindow:window,configuration,context,
        onReady:(fetch,instanceId,parentOrigin)=>setReady({scopeTag,fetch,instanceId,parentOrigin}),
        onUnavailable:()=>{setReady(null);setFailed(true)}})
      return()=>channel.close()
    }catch{setReady(null);setFailed(true)}
  },[configuration,context,scopeTag])
  if(!ready||ready.scopeTag!==scopeTag)return <p role="status">{context.locale==='pl'
    ?failed?'Podgląd jest chwilowo niedostępny.':'Łączenie z aplikacją…'
    :failed?'Preview is temporarily unavailable.':'Connecting to the application…'}</p>
  return <Presentation.Provider value={{fetch:ready.fetch,readOnly:true,parentOrigin:ready.parentOrigin}}>
    <Fragment key={ready.instanceId}>{children}</Fragment>
  </Presentation.Provider>
}
