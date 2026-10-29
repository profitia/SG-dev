"use client";
import React,{useEffect,useLayoutEffect,useMemo,useState,useId,useRef} from 'react';
import {useSupplierReport} from './workflow';
import {GeneralCompanyDataMount,FinancialDataMount,VerclyKysMount} from './mounts';
import {JdgRegistryMount} from './jdg';
import {CanonButton,CanonInput} from './ui-canon';
import {inactiveSupplier,supplierNip} from './workflow-controller';
import {createXRayWorkflowTransport} from './workflow-contract';
import {XRayLocaleProvider,useXRayText,type XRayLocale} from './i18n';
export type SupplierXRayWorkflowProps={locale:XRayLocale;theme:'light'|'dark';active:boolean;transport:typeof fetch;onReturn:()=>void};
export function SupplierXRayWorkflow(props:SupplierXRayWorkflowProps){return <XRayLocaleProvider locale={props.locale}><Workflow {...props}/></XRayLocaleProvider>;}
function Workflow({locale,theme,active,transport,onReturn}:SupplierXRayWorkflowProps){
 const id=useId(),t=useXRayText(),[nip,setNip]=useState('');
 const wire=useMemo(()=>createXRayWorkflowTransport(transport),[transport]);
 const {state,controller}=useSupplierReport(wire);
 const reportTiming=useRef<{traceId:string;nip:string;startedAt:number;rendered:boolean}|null>(null);
 useEffect(()=>{if(!active)controller.suspend();},[active,controller]);
 useLayoutEffect(()=>{controller.expirePrivate();},[active,controller,state.kys]);
 useEffect(()=>{if(!active)return;const timer=setInterval(controller.expirePrivate,1000);return()=>clearInterval(timer);},[active,controller]);
 const result=state.result,selectedNip=supplierNip(result),restricted=inactiveSupplier(result);
 const searchPending=!!result&&(result.entityType==='COMPANY'?result.card.financial.status==='PENDING':result.section.status==='PENDING');
 useEffect(()=>{
  if(!active||state.error||state.metadataError){reportTiming.current=null;return;}
  const timing=reportTiming.current;
  if(!timing||timing.rendered||!result||selectedNip!==timing.nip||state.busy||state.metadataBusy
    ||state.error||state.metadataError||!state.metadata||searchPending)return;
  const committedViewMs=performance.now();let second=0;
  const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
   if(reportTiming.current!==timing)return;
   timing.rendered=true;
   // Observability contains no supplier data, credentials or access proof.
   // Completion follows the same committed view and current metadata as UI.
   try{console.info(JSON.stringify({event:'srm_workflow_client_rendered',schema:'srm.workflow-render-timing/1.0',
    traceId:timing.traceId,startMs:timing.startedAt,endMs:performance.now(),committedViewMs,
    entityType:result.entityType,generalStatus:result.entityType==='COMPANY'?result.card.general.status:result.section.status,
    financialStatus:result.entityType==='COMPANY'?result.card.financial.status:null,
    completeBasicReport:true,afterCommittedViewAndTwoAnimationFrames:true}));}catch{}
  });});
  return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
 },[active,result,selectedNip,searchPending,state.busy,state.metadataBusy,state.error,state.metadataError,state.metadata]);
 const problem=(message:string)=>t(message.startsWith('XRAY_')?message:'XRAY_UNAVAILABLE');
 const freshness=(kind:'financial'|'kys')=>{const data=state.metadata?.[kind];if(!data)return locale==='pl'?'Aktualność: nie ustalono':'Freshness: unknown';
  const label=data.freshness.freshness==='FRESH'?(locale==='pl'?'Aktualne':'Current'):data.freshness.freshness==='EXPIRED'?(locale==='pl'?'Dane nieaktualne':'Stale data'):data.freshness.freshness==='ABSENT'?t('Brak danych'):(locale==='pl'?'Aktualność: nie ustalono':'Freshness: unknown');
  return label+(data.freshness.retrievedAt?' · '+new Intl.DateTimeFormat(locale==='pl'?'pl-PL':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(data.freshness.retrievedAt)):'');};
 return <div className="srm-xray-workflow" data-theme={theme} lang={locale} aria-busy={state.busy}>
  <header className="xray-workflow-heading"><div><h1>X-Ray Supplier Intelligence</h1><p>{locale==='pl'?'Dane rejestrowe, finanse i weryfikacja dostawcy.':'Supplier registry, financial and compliance information.'}</p></div><CanonButton canonId="SRM-C02" usage="workflow:return" type="button" onClick={onReturn}>{t('Wróć do biurka')}</CanonButton></header>
  <form className="xray-workflow-search" aria-label={t('Wpisz numer NIP')} onSubmit={event=>{event.preventDefault();if(!state.busy&&/^\d{10}$/.test(nip)){
   reportTiming.current=null;
   try{reportTiming.current={traceId:crypto.randomUUID(),nip,startedAt:performance.now(),rendered:false};}catch{}
   void (searchPending&&selectedNip===nip?controller.retrySearch():controller.search(nip));
  }}}>
   <label htmlFor={id+"-nip"}>{t('Wpisz numer NIP')}</label><div><CanonInput canonId="SRM-C06" usage="workflow:nip" id={id+"-nip"} name="nip" inputMode="numeric" autoComplete="off" pattern="[0-9]{10}" maxLength={14} required value={nip} onChange={event=>setNip(event.target.value.replace(/[\s-]/g,''))} disabled={state.busy} aria-describedby={id+"-note"}/>
   <CanonButton canonId="SRM-C01" usage="workflow:search" type="submit" disabled={state.busy||!active}>{t(state.busy?'Wyszukiwanie…':searchPending&&selectedNip===nip?'Kontynuuj pobieranie':'Wyszukaj')}</CanonButton></div>
   <p id={id+"-note"}>{locale==='pl'?'Dane finansowe i rejestrowe pobierasz przy wyszukiwaniu. Raport KYS zamawiasz osobno.':'Search retrieves registry and financial information. Request the KYS report separately.'}</p>
  </form>
  {state.busy&&<p role="status">{t('Raport jest przygotowywany. Poczekaj na wynik…')}</p>}
  {state.error&&<div role="alert"><p>{problem(state.error)}</p><CanonButton canonId="SRM-C02" usage="workflow:retry" type="button" disabled={!active||state.busy} onClick={()=>state.error==='XRAY_SESSION_REQUIRED'||state.error==='XRAY_ACCESS_DENIED'?onReturn():void controller.retrySearch()}>{t(state.error==='XRAY_SESSION_REQUIRED'||state.error==='XRAY_ACCESS_DENIED'?'Wróć do biurka':'Spróbuj ponownie')}</CanonButton></div>}
  {result&&<article className="xray-workflow-result" aria-label={t('Dostawca')} key={selectedNip}>
   <header><h2>{result.entityType==='COMPANY'?result.card.identity.name??selectedNip:result.section.data?.entries[0]?.name??selectedNip}</h2><p>NIP: {selectedNip}</p></header>
   {restricted&&<p role="status">{locale==='pl'?'Podmiot nieaktywny lub dane objęte ograniczeniem. Raport pokazuje wyłącznie dostępne dane rejestrowe.':'The entity is inactive or restricted. Only available registry information is shown.'}</p>}
   {result.entityType==='JDG'?<JdgRegistryMount section={result.section}/>:<GeneralCompanyDataMount section={result.card.general}/>}
   {result.entityType==='COMPANY'&&!restricted&&<><p className="xray-freshness">{freshness('financial')}</p><FinancialDataMount section={result.card.financial} embedded/></>}
   {state.metadataBusy&&<p role="status">{locale==='pl'?'Sprawdzanie aktualności…':'Checking freshness…'}</p>}
   {state.metadataError&&<div role="alert"><p>{problem(state.metadataError)}</p><CanonButton canonId="SRM-C02" usage="workflow:metadata-retry" type="button" disabled={!active||state.metadataBusy} onClick={()=>void controller.refreshMetadata()}>{t('Sprawdź aktualność')}</CanonButton></div>}
   {!restricted&&<section className="xray-section srm-kys" aria-labelledby={id+"-kys-title"}><header className="xray-section-header"><h2 id={id+"-kys-title"}>{t('Raport KYS')}</h2><CanonButton canonId="SRM-C01" usage="workflow:kys" type="button" onClick={()=>void controller.fetchKys()} disabled={state.busy||state.kysBusy||!active}>{t(state.kysBusy?'Pobieranie':state.kys.status==='PENDING'?'Kontynuuj pobieranie':state.kys.data?'Pobierz ponownie':'Pobierz raport KYS')}</CanonButton></header>
    <p className="xray-freshness">{freshness('kys')}</p>
    {state.kysError&&<p role="alert">{problem(state.kysError)}</p>}
    {state.kys.status==='NOT_REQUESTED'?<p role="status">{t('Raport KYS nie został jeszcze pobrany.')}</p>:<VerclyKysMount section={state.kys} entityType={result.entityType}/>}
    {state.kys.data&&<p className="xray-freshness">{locale==='pl'?'Stan danych źródłowych: ':'Source data as of: '}{state.kys.data.stateAsOf??(locale==='pl'?'nie ustalono':'unknown')}</p>}
   </section>}
  </article>}
 </div>;
}
