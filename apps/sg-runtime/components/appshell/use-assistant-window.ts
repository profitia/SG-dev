'use client'

import {useCallback, useEffect, useRef, useState} from 'react'

/** One presentation owner: closing, leaving or invalidating the host removes its child. */
export function useAssistantWindow(onReturn: () => void, en: boolean) {
  const [target,setTarget]=useState<HTMLElement|null>(null),[error,setError]=useState('')
  const child=useRef<Window|null>(null),poll=useRef<ReturnType<typeof setInterval>|null>(null)
  const returned=useRef(onReturn); returned.current=onReturn
  const restore=useCallback(()=>{
    if(poll.current!==null)clearInterval(poll.current)
    poll.current=null;child.current=null;setTarget(null);returned.current()
  },[])
  const attach=useCallback(()=>{const previous=child.current;restore();if(previous&&!previous.closed)previous.close()},[restore])
  const detach=useCallback(()=>{
    if(child.current&&!child.current.closed){child.current.focus();return}
    setError('');let next:Window|null=null
    try{
      // Synchronous user activation is required by popup blockers. No token or account data in the URL.
      next=window.open('','_blank','popup=yes,width=600,height=820,resizable=yes,scrollbars=yes')
      if(!next||next.closed)throw Error('WINDOW_UNAVAILABLE')
      next.opener=null
      const doc=next.document
      doc.documentElement.lang=en?'en':'pl'
      const base=doc.createElement('base');base.href=document.baseURI
      const viewport=doc.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1'
      doc.head.replaceChildren(base,viewport);doc.title=en?'SpendGuru — Your assistant':'SpendGuru — Twój asystent'
      document.querySelectorAll('style,link[rel="stylesheet"]').forEach(node=>doc.head.appendChild(node.cloneNode(true)))
      doc.body.style.margin='0';doc.body.style.overflow='hidden'
      const root=doc.createElement('div');root.id='spendguru-assistant-window';doc.body.replaceChildren(root)
      child.current=next;setTarget(root)
      poll.current=setInterval(()=>{
        try{if(next?.closed){restore();return}if(next?.document!==doc){attach()}}
        catch{attach()}
      },300)
      next.focus()
    }catch{
      if(next&&!next.closed)next.close()
      setError(en?'The browser could not open a window. Allow popups for this site and try again. Your assistant stays here.':'Przeglądarka nie otworzyła okna. Zezwól na wyskakujące okna dla tej strony i spróbuj ponownie. Asystent pozostaje tutaj.')
    }
  },[attach,en,restore])
  useEffect(()=>{
    const close=()=>{if(child.current&&!child.current.closed)child.current.close()}
    window.addEventListener('pagehide',close)
    return()=>{window.removeEventListener('pagehide',close);if(poll.current!==null)clearInterval(poll.current);close()}
  },[])
  return{target,error,detach,attach}
}
