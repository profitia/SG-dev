'use client'
import React,{useEffect,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {CanonButton,CanonInput,CanonSelect} from '@profitia/srm-xray'
// Stroke paths reused from approved MagicPath471304520744468480/PIControls.
export function CalendarIcon({name='calendar',size=18}:{name?:string;size?:number}){
 const paths:Record<string,React.ReactNode>={home:<><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 21v-7h6v7"/></>,news:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h5v5H7zM15 8h3M15 12h3M7 16h11"/></>,report:<path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7"/>,calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M13 14h2"/></>,chart:<path d="M4 3v17h17M7 14l4-5 4 3 5-7"/>,history:<><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6M12 7v5l3 2"/></>,arrow:<path d="m9 5 7 7-7 7M4 12h12"/>,back:<path d="m14 5-7 7 7 7M7 12h13"/>,plus:<path d="M12 4v16M4 12h16"/>,bell:<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4"/>,check:<path d="m4 12 5 5L20 6"/>,close:<path d="m6 6 12 12M18 6 6 18"/>,edit:<path d="m4 16 12-12 4 4L8 20H4zM13 7l4 4"/>,trash:<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>}
 return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]??paths.calendar}</svg>
}
export function CalendarButton({primary=false,plain=false,icon,children,className='',...props}:React.ComponentPropsWithoutRef<'button'>&{primary?:boolean;plain?:boolean;icon?:string}){
 return <CanonButton type="button" canonId={primary?'SRM-C01':plain?'SRM-C03':'SRM-C02'} usage="PI:market-calendar" {...props} className={'pi-btn '+(primary?'primary ':'')+(plain?'plain ':'')+className}>{icon&&<CalendarIcon name={icon}/>} {children}</CanonButton>
}
export function CalendarInput({label,error,...props}:React.ComponentPropsWithoutRef<'input'>&{label:string;error?:string}){return <label className="pi-field"><span>{label}</span><CanonInput canonId="SRM-C06" usage="PI:market-calendar" {...props} aria-invalid={!!error}/>{error&&<small role="alert">{error}</small>}</label>}
export function CalendarSelect({label,...props}:React.ComponentPropsWithoutRef<'select'>&{label:string}){return <label className="pi-field"><span>{label}</span><CanonSelect canonId="SRM-C16" usage="PI:market-calendar" {...props}/></label>}
export function CalendarEmpty({title,text,onReset}:{title:string;text:string;onReset?:()=>void}){return <section className="pi-empty"><CalendarIcon size={30}/><h3>{title}</h3><p>{text}</p>{onReset&&<CalendarButton primary onClick={onReset}>Pokaż wszystkie wydarzenia</CalendarButton>}</section>}
/** Native modal supplies focus trapping, inert background and focus restoration. */
export function CalendarDialog({title,subtitle,onClose,drawer=false,children}:{title:string;subtitle?:string;onClose:()=>void;drawer?:boolean;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),close=useRef(onClose);close.current=onClose
 useEffect(()=>{const d=ref.current,previous=document.activeElement as HTMLElement|null;if(!d)return
  if(!d.open)d.showModal();const cancel=(e:Event)=>{e.preventDefault();close.current()};d.addEventListener('cancel',cancel)
  return()=>{d.removeEventListener('cancel',cancel);d.close();if(previous?.isConnected)previous.focus()}
 },[])
 return <dialog ref={ref} aria-label={title} className={drawer?'pi-cal-drawer pi-cal-dialog':'pi-cal-modal pi-cal-dialog'} onMouseDown={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose()}}}>
  <header className="pi-cal-drawer-header"><div><strong>{title}</strong>{subtitle&&<p>{subtitle}</p>}</div><CalendarButton plain icon="close" aria-label="Zamknij" onClick={onClose}/></header>{children}
 </dialog>
}
/** Presentation adapter of approved SRM-C107–111. Native AppShell router and
 * browser history own navigation; no prototype history or automatic binding. */
export function CalendarNavigation({locale,onHome,onParent}:{locale:'pl'|'en';onHome:()=>void;onParent:()=>void}){
 const router=useRouter(),[history,setHistory]=useState({back:false,forward:false})
 useEffect(()=>{const navigation=(window as unknown as{navigation?:EventTarget&{canGoBack:boolean;canGoForward:boolean}}).navigation
  const read=()=>setHistory({back:navigation?.canGoBack??window.history.length>1,forward:navigation?.canGoForward??false});read();navigation?.addEventListener('currententrychange',read);window.addEventListener('popstate',read)
  return()=>{navigation?.removeEventListener('currententrychange',read);window.removeEventListener('popstate',read)}
 },[])
 const en=locale==='en',crumbs=[['home',en?'Dashboard':'Biurko'],['insights','Procurement Insights'],['calendar',en?'Market calendar':'Kalendarz rynkowy']],go=(id:string)=>{if(id==='home')onHome();else if(id==='insights')onParent()}
 return <nav className="gn-bar" data-canon-reference="SRM-C107" data-canon-source-revision="471304520744468480" aria-label={en?'Global navigation':'Nawigacja globalna'}><div className="gn-actions" role="group" aria-label={en?'History and dashboard':'Historia i biurko'}><CanonButton canonId="SRM-C04" usage="PI:GN-home" data-canon-reference="SRM-C108" className="gn-control gn-home" type="button" onClick={onHome} aria-label={en?'Go to dashboard':'Przejdź do biurka'}><CalendarIcon name="home"/></CanonButton><span className="gn-separator" aria-hidden="true"/><CanonButton canonId="SRM-C04" usage="PI:GN-back" data-canon-reference="SRM-C109" className="gn-control" type="button" disabled={!history.back} onClick={()=>router.back()} aria-label={en?'Back':'Wstecz w historii ekranów'}><CalendarIcon name="back"/></CanonButton><CanonButton canonId="SRM-C04" usage="PI:GN-forward" data-canon-reference="SRM-C109" className="gn-control" type="button" disabled={!history.forward} onClick={()=>router.forward()} aria-label={en?'Forward':'Dalej w historii ekranów'}><CalendarIcon name="arrow"/></CanonButton></div><ol className="gn-crumbs" data-canon-reference="SRM-C110" aria-label={en?'Location':'Położenie w aplikacji'}>{crumbs.map(([id,label],i)=><li key={id}>{i>0&&<span className="gn-chevron" aria-hidden="true">›</span>}{i===crumbs.length-1?<span className="gn-current" aria-current="page">{label}</span>:<CanonButton canonId="SRM-C03" usage="PI:GN-ancestor" className="gn-ancestor" type="button" onClick={()=>go(id)}>{label}</CanonButton>}</li>)}</ol><label className="gn-mobile-select" data-canon-reference="SRM-C111"><span>{en?'You are here':'Jesteś tutaj'}</span><select aria-label={en?'Navigation levels':'Poziomy nawigacji'} value="calendar" onChange={e=>go(e.target.value)}>{crumbs.map(([id,label],i)=><option key={id} value={id}>{'› '.repeat(i)+label}</option>)}</select></label></nav>
}
