"use client";
import {useEffect, useId, useLayoutEffect, useRef, useState, type RefObject, type KeyboardEvent} from 'react';
import {CanonButton, CanonInput} from './ui-canon';

/** Data selected by the host. A suggestion or selection reference grants no access. */
export type SupplierCandidate = Readonly<{krs:string; name:string; nip:string|null; locality:string|null}>;
export type SupplierSelection = SupplierCandidate & Readonly<{nip:string; selectionRef:string}>;
export type SupplierSearchGateway = Readonly<{
  available(signal:AbortSignal):Promise<boolean>;
  search(query:string,signal:AbortSignal):Promise<Readonly<{candidates:readonly SupplierCandidate[]; coverage:'PROGRESSIVE'}>>;
  verify(krs:string,signal:AbortSignal):Promise<SupplierSelection>;
}>;
type Props={nip:string; onNipChange:(value:string)=>void; onNipSearch:()=>void;
  onNameSearch:(selection:SupplierSelection)=>void; gateway:SupplierSearchGateway; busy:boolean;
  inputRef?:RefObject<HTMLInputElement|null>};
const SearchIcon=()=> <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5"/></svg>;

/** MagicPath EnterPageView / ACT-09, inspected shared revision464012275896954880.
 * The host supplies protected operations; this component owns no provider, session or report. */
export function SupplierSearch({nip,onNipChange,onNipSearch,onNameSearch,gateway,busy,inputRef}:Props){
  const id=useId(), ownInput=useRef<HTMLInputElement>(null), input=inputRef??ownInput;
  const [mode,setMode]=useState<'nip'|'name'>('nip'),[available,setAvailable]=useState(false);
  const [query,setQuery]=useState(''),[results,setResults]=useState<readonly SupplierCandidate[]>([]);
  const [selection,setSelection]=useState<SupplierSelection|null>(null),[error,setError]=useState('');
  const [state,setState]=useState<'idle'|'loading'|'ready'|'error'|'verifying'>('idle');
  const [open,setOpen]=useState(false),[active,setActive]=useState(-1),[retry,setRetry]=useState(0);
  const [layout,setLayout]=useState({above:false,height:200});
  const sequence=useRef(0), verification=useRef<AbortController|null>(null), list=useRef<HTMLDivElement>(null);
  const visible=mode==='name'&&available&&open&&!selection&&query.trim().length>=2&&state!=='verifying';
  useEffect(()=>{const controller=new AbortController();setAvailable(false);
    gateway.available(controller.signal).then(value=>{if(!controller.signal.aborted)setAvailable(value===true)}).catch(()=>{});
    return()=>controller.abort();},[gateway]);
  useEffect(()=>()=>verification.current?.abort(),[]);
  useEffect(()=>{
    const seq=++sequence.current, controller=new AbortController();setActive(-1);setResults([]);
    if(mode!=='name'||!available||selection||query.trim().length<2){setState('idle');return;}
    setState('loading');
    const timer=setTimeout(async()=>{try{
      const found=await gateway.search(query.trim(),controller.signal);
      if(controller.signal.aborted||seq!==sequence.current)return;
      if(found.coverage!=='PROGRESSIVE'||found.candidates.length>10)throw Error('Invalid search response');
      setResults(found.candidates);setState('ready');
    }catch{if(!controller.signal.aborted&&seq===sequence.current)setState('error');}},300);
    return()=>{clearTimeout(timer);controller.abort();};
  },[mode,available,query,selection,retry,gateway]);
  useLayoutEffect(()=>{if(!visible)return;const measure=()=>{
    const rect=input.current?.getBoundingClientRect();if(!rect)return;
    const below=window.innerHeight-rect.bottom-18,aboveSpace=rect.top-18,above=below<180&&aboveSpace>below;
    setLayout({above,height:Math.max(84,Math.min(320,(above?aboveSpace:below)-52))});
  };measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);},[visible,input]);
  useEffect(()=>{const row=list.current?.querySelector<HTMLElement>('[data-active="true"]');
    if(!row||!list.current)return;
    if(row.offsetTop<list.current.scrollTop)list.current.scrollTop=row.offsetTop;
    else if(row.offsetTop+row.offsetHeight>list.current.scrollTop+list.current.clientHeight)list.current.scrollTop=row.offsetTop+row.offsetHeight-list.current.clientHeight;
  },[active]);
  function invalidate(){++sequence.current;verification.current?.abort();verification.current=null;setSelection(null);setError('');setActive(-1);}
  function update(value:string){invalidate();setQuery(value);setResults([]);setOpen(true);}
  function changeMode(next:'nip'|'name'){invalidate();setMode(next);setOpen(false);setState('idle');}
  async function choose(candidate:SupplierCandidate){
    invalidate();const seq=sequence.current, controller=new AbortController();verification.current=controller;
    setOpen(false);setState('verifying');
    try{const selected=await gateway.verify(candidate.krs,controller.signal);
      if(controller.signal.aborted||sequence.current!==seq)return;
      if(selected.krs!==candidate.krs||!selected.nip||!selected.selectionRef)throw Error('Invalid selected company');
      setSelection(selected);setQuery(selected.name);setState('idle');input.current?.focus({preventScroll:true});
    }catch{if(!controller.signal.aborted&&sequence.current===seq){setState('idle');setError('Nie udało się potwierdzić danych wybranej spółki. Wybierz ją ponownie lub wyszukaj po NIP.');}}
  }
  function keyDown(event:KeyboardEvent<HTMLInputElement>){
    if(event.nativeEvent.isComposing)return;
    if(event.key==='Escape'){setOpen(false);setActive(-1);return;}
    if((event.key==='ArrowDown'||event.key==='ArrowUp')&&results.length&&!selection){event.preventDefault();setOpen(true);
      setActive(previous=>event.key==='ArrowDown'?Math.min(previous+1,results.length-1):previous<0?results.length-1:Math.max(previous-1,0));}
    if(event.key==='Enter'&&visible&&state==='ready'&&active>=0&&results[active]){event.preventDefault();void choose(results[active]);}
  }
  return <section id="supplier-search" tabIndex={-1} className="srm-ui srm-krs-entry" aria-label="Wyszukiwanie dostawcy" data-design-source="460628347660177408" data-design-pattern="ACT-09 / SRM-C96">
    <div className="srm-entry-search-shell">
      <div className="srm-entry-intro"><span className="srm-entry-eyebrow">SUPPLIER INTELLIGENCE</span><h1>Wyszukaj dostawcę</h1><p>Wpisz numer NIP lub znajdź spółkę po nazwie.</p></div>
      <div className="srm-entry-card srm-supplier-search">
        <div className="supplier-mode" role="group" aria-label="Sposób wyszukiwania">
          <CanonButton canonId="SRM-C08" usage="SupplierSearch:nip-mode" type="button" aria-pressed={mode==='nip'} disabled={busy} onClick={()=>changeMode('nip')}>Numer NIP</CanonButton>
          <CanonButton canonId="SRM-C08" usage="SupplierSearch:name-mode" type="button" aria-pressed={mode==='name'} disabled={busy||!available} aria-describedby={!available?id+'-unavailable':undefined} onClick={()=>changeMode('name')}>Nazwa spółki</CanonButton>
        </div>
        <form className="supplier-form" aria-label="Wyszukaj dostawcę" onSubmit={event=>{
          event.preventDefault();if(busy)return;
          if(mode==='nip'){onNipSearch();return;}
          if(available&&selection&&state!=='verifying')onNameSearch(selection);
          else setError('Wybierz i potwierdź spółkę z listy podpowiedzi.');
        }}>
          <label className="supplier-label" htmlFor={id+'-input'}>{mode==='nip'?'Wpisz numer NIP':'Zacznij wpisywać nazwę spółki'}</label>
          <div className="supplier-fields">
            <div className="supplier-combobox" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)){setOpen(false);setActive(-1);}}}>
              <div className="supplier-input-wrap" data-invalid={!!error}><span className="supplier-search-icon"><SearchIcon/></span>
                {mode==='nip'?<CanonInput key="nip" canonId="SRM-C06" usage="SupplierSearch:nip" ref={input} id={id+'-input'} name="identifier" inputMode="numeric" pattern="[0-9]{10}" maxLength={14} required placeholder="10 cyfr numeru NIP" value={nip} onChange={event=>onNipChange(event.target.value.replace(/[\s-]/g,''))} aria-describedby={id+'-hint'} disabled={busy}/>
                :<CanonInput key="name" canonId="SRM-C06" usage="SupplierSearch:name" ref={input} id={id+'-input'} role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={visible} aria-controls={visible?id+'-list':undefined} aria-activedescendant={visible&&active>=0?id+'-option-'+active:undefined} aria-invalid={!!error} aria-describedby={id+(error?'-error':'-hint')} autoComplete="off" spellCheck={false} maxLength={150} placeholder="Np. nazwa spółki" value={query} onChange={event=>update(event.target.value)} onFocus={()=>{if(!selection)setOpen(true)}} onKeyDown={keyDown} disabled={busy}/>}
                {(mode==='name'?query:nip)&&<CanonButton canonId="SRM-C04" usage="SupplierSearch:clear" type="button" className="supplier-clear" aria-label="Wyczyść wyszukiwanie" disabled={busy} onClick={()=>{mode==='name'?update(''):onNipChange('');input.current?.focus({preventScroll:true});}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></CanonButton>}
              </div>
              {visible&&<div className="supplier-popup" data-side={layout.above?'above':'below'}>
                <div className="supplier-list" ref={list} style={{maxHeight:layout.height}} role="listbox" id={id+'-list'} aria-label="Pasujące spółki" aria-busy={state==='loading'}>
                  {state==='ready'&&results.map((candidate,index)=><div role="option" key={candidate.krs} id={id+'-option-'+index} aria-selected={active===index} data-active={active===index} className="supplier-option" onMouseEnter={()=>setActive(index)} onMouseDown={event=>event.preventDefault()} onClick={()=>void choose(candidate)}>
                    <span className="supplier-option-main"><strong>{candidate.name}</strong><span>{candidate.nip?'NIP '+candidate.nip:'NIP niepotwierdzony'} · KRS {candidate.krs}</span></span><span className="supplier-option-city">{candidate.locality??'Brak miejscowości'}</span><svg className="supplier-option-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
                  </div>)}
                </div>
                {state==='loading'&&<div className="supplier-feedback" role="status"><span className="supplier-spinner" aria-hidden="true"/>Szukam pasujących spółek…</div>}
                {state==='error'&&<div className="supplier-feedback supplier-feedback-error" role="alert"><strong>Nie udało się pobrać podpowiedzi.</strong><span>Spróbuj ponownie za chwilę.</span><CanonButton canonId="SRM-C03" usage="SupplierSearch:retry" type="button" onClick={()=>setRetry(value=>value+1)}>Spróbuj ponownie</CanonButton></div>}
                {state==='ready'&&!results.length&&<div className="supplier-feedback" role="status"><strong>Brak dopasowań w dostępnym katalogu</strong><span>Zmień nazwę lub wyszukaj po numerze NIP.</span></div>}
                {state==='ready'&&!!results.length&&<div className="supplier-list-footer"><span>{results.length===10?'Pierwsze 10 dopasowań':'Liczba dopasowań: '+results.length}</span><span>↑ ↓ wybór · Enter zatwierdź</span></div>}
              </div>}
            </div>
            <CanonButton canonId="SRM-C01" usage="SupplierSearch:submit" type="submit" className="supplier-submit" disabled={busy||mode==='name'&&(!selection||state==='verifying'||!available)}>{busy?'Wyszukiwanie…':'Wyszukaj'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></CanonButton>
          </div>
          <p id={id+'-hint'} className="supplier-hint">{mode==='nip'?'Wyszukiwanie po dokładnym numerze NIP dostawcy.':state==='verifying'?'Potwierdzam dane rejestrowe spółki…':selection?'Sprawdź wybraną spółkę i zatwierdź wyszukiwanie.':'Wpisz co najmniej 2 znaki, a następnie wybierz spółkę z listy.'}</p>
          {error&&<p id={id+'-error'} className="supplier-error" role="alert">{error}</p>}
          {mode==='name'&&selection&&<div className="supplier-selected" role="status"><span className="supplier-selected-mark" aria-hidden="true">✓</span><div><span className="supplier-selected-label">Wybrana spółka</span><strong>{selection.name}</strong><span>NIP {selection.nip} · KRS {selection.krs} · {selection.locality??'Brak miejscowości'}</span></div><CanonButton canonId="SRM-C03" usage="SupplierSearch:change" type="button" disabled={busy} onClick={()=>{update('');input.current?.focus({preventScroll:true})}}>Zmień</CanonButton></div>}
        </form>
        <div className="supplier-catalog-note">{mode==='name'?'Katalog jest rozwijany. Brak podpowiedzi nie oznacza, że spółka nie istnieje.':'Dane finansowe i rejestrowe są pobierane przy wyszukiwaniu. Raport KYS zamawiasz osobno.'}</div>
        {!available&&<p id={id+'-unavailable'} className="supplier-hint">Wyszukiwanie po nazwie jest obecnie niedostępne. Możesz wyszukać po NIP.</p>}
        <span className="supplier-sr-only" role="status" aria-live="polite">{state==='verifying'?'Potwierdzam dane spółki.':state==='ready'&&visible?'Liczba dopasowań: '+results.length:selection?'Wybrano '+selection.name+', NIP '+selection.nip:''}</span>
      </div>
    </div>
  </section>;
}
