import React,{useEffect,useId,useRef} from 'react';
import {Button,Icon,useLabel} from './primitives';

export function HistoryDialog({title,children,onClose,compact=true}:{title:string;children:React.ReactNode;onClose:()=>void;compact?:boolean}){
 const node=useRef<HTMLDialogElement>(null),id=useId(),l=useLabel();
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const dialog=node.current;if(!dialog)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const center=()=>{const viewport=window.visualViewport;const top=viewport?.offsetTop??0,h=viewport?.height??window.innerHeight;dialog.style.setProperty('--srm-history-center',`${top+h/2}px`);dialog.style.setProperty('--srm-history-height',`min(${compact?40.625:45}rem, calc(${h}px - 2 * var(--srm-dialog-edge)))`);};
  center();dialog.showModal();
  window.addEventListener('resize',center);window.visualViewport?.addEventListener('resize',center);window.visualViewport?.addEventListener('scroll',center);
  return()=>{window.removeEventListener('resize',center);window.visualViewport?.removeEventListener('resize',center);window.visualViewport?.removeEventListener('scroll',center);dialog.close();if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[compact]);
 return <dialog ref={node} className={`srm-history srm-history-detail srm-statement-dialog adp-dialog ws-dialog ${compact?'is-picker':''}`} aria-labelledby={id} onCancel={e=>{e.preventDefault();close.current();}} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close.current();}}>
  <header className="srm-history-detail-head"><div><h2 id={id}>{title}</h2></div><div className="srm-history-head-actions"><Button variant="link" className="srm-close-window" aria-label={l('Zamknij','Close')} title={l('Zamknij','Close')} onClick={()=>close.current()} autoFocus><Icon kind="close"/></Button></div></header>{children}
 </dialog>;
}
