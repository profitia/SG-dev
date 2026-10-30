'use client'
import React,{useEffect,useLayoutEffect,useRef,useState} from 'react'
import {PriceChangeIndex,type PciBusinessController,type PciBusinessResult,type PciMarketIndexResult,type PciSmartController} from '@profitia/sg2-price-change-index-ui/business'
import {useSg2SessionCredential,useSg2IdentityMode} from '../auth/session-boundary'
import {SharedBenchmarkPicker} from '../benchmark-picker/shared-benchmark-picker'
import {attachCategoryBenchmark} from '../category-builder/benchmark-picker-draft'
import {createCategoryOperationRequester} from '../category-builder/category-operation-request'
import type {SavedBenchmark} from '../../lib/benchmark/contracts'
import {savedBenchmarkProfile} from '../../lib/benchmark/qualification'
import {presentQualification} from '../../lib/benchmark/qualification-presentation'
import type {SmartPciResponse} from '../../lib/cost-analysis/pci-smart-preparation-contracts'
import {createPciRequester} from './price-change-index-request'
import {emptyPurchase,seedPciComponent,pciStructureReady,pciSmartInput,pciMarketResult,pciResult,pciCategoryBody,type PciComponent} from './price-change-index-controller'
import './price-change-index-layer.css'

export function PriceChangeIndexLayer({seed,locale,onClose,onAccessLost}:{seed:SavedBenchmark;locale:'pl'|'en';onClose:()=>void;onAccessLost:()=>void}){
  const getToken=useSg2SessionCredential(),identity=useSg2IdentityMode(),dialog=useRef<HTMLDialogElement>(null),picker=useRef<HTMLDialogElement>(null)
  const current=useRef({getToken,identity});current.current={getToken,identity}
  const active=useRef(true),inflight=useRef(false),dirty=useRef(false),saveLock=useRef(false),savedId=useRef<string|null>(null)
  const [name,setName]=useState(''),[components,setComponents]=useState<PciComponent[]>(()=>[seedPciComponent(seed,'seed')]),[purchase,setPurchase]=useState(emptyPurchase)
  const [step,setStep]=useState<1|2|3|'result'>(1),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[result,setResult]=useState<PciBusinessResult|null>(null)
  const [pickTarget,setPickTarget]=useState<{id:string|null}|null>(null),[saveStatus,setSaveStatus]=useState<PciBusinessController['categorySaveStatus']>('idle')
  const [preparation,setPreparation]=useState<Pick<PciSmartController,'status'|'data'|'error'>>({status:'idle',data:null,error:null}),[prepareAttempt,setPrepareAttempt]=useState(0)
  const [selectedCandidateId,setCandidate]=useState<string|null>(null),[strictPeriodAccepted,setStrict]=useState(false),[proxyMarketOnlyAccepted,setProxy]=useState(false),[olderYear,setOlderYear]=useState<number|null>(null)
  const [marketResult,setMarketResult]=useState<PciMarketIndexResult|null>(null)
  const preparationAbort=useRef<AbortController|null>(null),generation=useRef(0)
  const [theme,setTheme]=useState<'light'|'dark'>('light')
  const qualifiedComponents=components.map(c=>({...c,qualification:presentQualification(savedBenchmarkProfile(c.benchmark),locale,'PCI',step===3?c.valueKind:undefined)}))
  const incompatible=qualifiedComponents.filter(c=>c.weightPercent>0&&c.qualification.status==='UNSUITABLE')
  const qualificationIssue=incompatible.length ? `${incompatible[0].name||incompatible[0].benchmark.displayName}: ${incompatible[0].qualification.reason}${incompatible.length>1?(locale==='pl'?' Sprawdź też pozostałe oznaczone komponenty.':' Check the other marked components too.'):''}` : null
  const request=useRef<ReturnType<typeof createPciRequester>|null>(null),categoryRequest=useRef<ReturnType<typeof createCategoryOperationRequester>|null>(null)
  useLayoutEffect(()=>{
    active.current=true
    request.current=createPciRequester({getToken:async()=>current.current.getToken?.()??null,fetch:(...a)=>fetch(...a)})
    categoryRequest.current=createCategoryOperationRequester({mode:()=>current.current.identity,getToken:async()=>current.current.getToken?.()??null,
      organisationId:()=>seed.organizationId,origin:()=>window.location.origin,fetch:(...a)=>fetch(...a)})
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow
    document.body.style.overflow='hidden';dialog.current?.showModal()
    const parent=dialog.current?.parentElement?.closest('[data-srm-theme],[data-theme]')??document.documentElement
    const finderTheme=document.documentElement.dataset.benchmarkTheme
    if(finderTheme==='dark'||finderTheme!=='light'&&(parent?.getAttribute('data-srm-theme')==='dark'||parent?.getAttribute('data-theme')==='dark'))setTheme('dark')
    return()=>{active.current=false;request.current?.close();categoryRequest.current?.close();picker.current?.close();dialog.current?.close();document.body.style.overflow=overflow;previous?.focus({preventScroll:true})}
  },[])
  useLayoutEffect(()=>{if(pickTarget)picker.current?.showModal()},[pickTarget])
  const resetReference=()=>{setCandidate(null);setStrict(false);setProxy(false)}
  useEffect(()=>{
    if(step!==3||!pciStructureReady(name,components)||!purchase.amount||!purchase.currency||!purchase.unit||!purchase.taxBasis||!purchase.deliveryBasis||!purchase.purchaseDate)return
    const abort=new AbortController(),version=generation.current;preparationAbort.current=abort
    setPreparation({status:'loading',data:null,error:null});resetReference()
    const timer=setTimeout(async()=>{try{
      if(!request.current)return
      const response=await request.current(JSON.stringify(pciSmartInput(name,components,purchase,locale,'PREPARE',{olderYear})),abort.signal)
      if(!active.current||abort.signal.aborted||version!==generation.current)return
      if(response.status===401||response.status===403){onAccessLost();onClose();return}
      const body=await response.json() as SmartPciResponse
      if(body.status!=='PREPARED'&&body.status!=='REFUSED')throw Error('PREPARATION_UNAVAILABLE')
      setPreparation({status:'ready',data:body.preparation,error:null});setCandidate(body.preparation.recommendedCandidateId)
    }catch(e){if(!abort.signal.aborted&&active.current&&version===generation.current)setPreparation({status:'error',data:null,error:e instanceof Error&&e.message==='SESSION_UNAVAILABLE'
      ?(locale==='pl'?'Chwilowo nie można potwierdzić sesji. Dane pozostają zachowane. Ponów sprawdzenie.':'Session temporarily unavailable. Your data remain intact. Retry preparation.')
      :(locale==='pl'?'Nie udało się sprawdzić notowań. Ponów sprawdzenie.':'Unable to check observations. Retry preparation.')})}},300)
    return()=>{clearTimeout(timer);abort.abort()}
  },[step,name,components,purchase,prepareAttempt,olderYear,locale])
  const changed=()=>{generation.current++;preparationAbort.current?.abort();setPreparation({status:'idle',data:null,error:null});resetReference();dirty.current=true;setResult(null);setMarketResult(null);setError(null);if(saveStatus==='saved')setSaveStatus('idle')}
  const close=()=>{if(step!=='result'&&dirty.current&&!window.confirm('Odrzucić niezapisane zmiany i wrócić do Benchmark Findera?'))return;onClose()}
  async function analyse(){
    if(qualificationIssue){setError(qualificationIssue);return}
    if(inflight.current||!request.current)return;const version=generation.current;inflight.current=true;setBusy(true);setError(null);setResult(null);setMarketResult(null)
    try{
      const response=await request.current(JSON.stringify(pciSmartInput(name,components,purchase,locale,'ANALYSE',{olderYear,reference:preparation.data&&selectedCandidateId?{candidateId:selectedCandidateId,preparationId:preparation.data.id,strictPeriodAccepted,proxyMarketOnlyAccepted}:undefined})))
      if(!active.current||version!==generation.current)return
      if(response.status===401||response.status===403){onAccessLost();onClose();return}
      const body=await response.json() as SmartPciResponse
      if(body.status==='REFUSED'){setPreparation({status:'ready',data:body.preparation,error:null});setStrict(false);setProxy(false);setCandidate(body.preparation.recommendedCandidateId)}
      if(!response.ok||(body.status!=='CALCULATED'&&body.status!=='PROXY_MARKET_ONLY')){
        const message=body.status==='REFUSED'?body.issues.map(i=>i.message).join(' '):'Nie udało się obliczyć ceny. Sprawdź dane i dostępność źródła.'
        throw Error(message)
      }
      if(active.current){setPreparation({status:'ready',data:body.preparation,error:null});if(body.status==='PROXY_MARKET_ONLY')setMarketResult(pciMarketResult(body));else setResult(pciResult(body,components));setStep('result')}
    }catch(e){if(active.current&&version===generation.current)setError(e instanceof Error&&e.message==='SESSION_UNAVAILABLE'
      ?'Chwilowo nie można potwierdzić sesji. Ponów analizę po odzyskaniu połączenia.'
      :e instanceof Error?e.message:'Analiza niedostępna.')}
    finally{inflight.current=false;if(active.current)setBusy(false)}
  }
  async function saveCategory(){
    if(saveLock.current||!categoryRequest.current||saveStatus==='saved')return
    saveLock.current=true;setSaveStatus('saving');setError(null)
    try{
      const response=await categoryRequest.current(savedId.current?'/api/category/'+savedId.current:'/api/category',{method:savedId.current?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pciCategoryBody(name,components))})
      if(!active.current)return
      if(response.status===401||response.status===403){onAccessLost();onClose();return}
      if(!response.ok)throw Error('Nie potwierdzono zapisu kategorii. Sprawdź Category Builder przed ponowną próbą.')
      const record=await response.json()
      if(typeof record.id!=='string'||record.organizationId!==seed.organizationId)throw Error('Nie potwierdzono zapisu kategorii.')
      savedId.current=record.id;if(active.current){setSaveStatus('saved');dirty.current=false}
      // Known resource IDs make future explicit edits updates, not duplicate creates.
      saveLock.current=false
    }catch(e){if(active.current){setSaveStatus('error');setError(e instanceof Error?e.message:'Nie potwierdzono zapisu kategorii.')}}
    // An unconfirmed write is never automatically retried with a new create identity.
  }
  const controller:PciBusinessController={name,components:qualifiedComponents,purchase,step,busy,error,result,qualificationIssue,smart:{...preparation,selectedCandidateId,strictPeriodAccepted,proxyMarketOnlyAccepted,olderYear,marketResult,reference:preparation.data?.candidates.find(c=>c.id===selectedCandidateId)??null,
      onSelectCandidate:id=>{setCandidate(id);setStrict(false);setProxy(false);setError(null)},onStrictPeriodAccepted:setStrict,onProxyMarketOnlyAccepted:setProxy,
      onOlderYear:year=>{changed();setOlderYear(year)},onRetry:()=>{setError(null);setPrepareAttempt(n=>n+1)}},categorySaveStatus:saveStatus,ready:pciStructureReady(name,components),
    onNameChange:value=>{changed();setName(value)},onComponentChange:(id,patch)=>{changed();if('valueKind' in patch)setPurchase(p=>({...p,economicPeriodApproved:false}));setComponents(c=>c.map(x=>x.id===id?{...x,...patch,...('valueKind' in patch&&!('preparationMethod' in patch)?{preparationMethod:{...x.preparationMethod,reduction:x.preparationMethod?.reduction??'AUTO',verified:false}}:{})}:x))},
    onRemove:id=>{changed();setPurchase(p=>({...p,economicPeriodApproved:false}));setComponents(c=>c.filter(x=>x.id!==id))},onPickBenchmark:id=>setPickTarget({id}),
    onPurchaseChange:patch=>{changed();setPurchase(p=>({...p,...patch,...(['purchaseDate','referenceDate','periodBasis','reduction'].some(key=>key in patch)?{economicPeriodApproved:false}:{})}))},onStep:value=>{setError(null);setStep(value)},onAnalyse:()=>void analyse(),onSaveCategory:()=>void saveCategory(),onClose:close}
  return <dialog className="pci-host-dialog" data-theme={theme} ref={dialog} aria-labelledby="pci-layer-title" onCancel={e=>{e.preventDefault();close()}}>
    <header className="pci-host-bar"><h2 id="pci-layer-title">Price Change Index · Budowa kategorii</h2><button type="button" aria-label="Zamknij Price Change Index" onClick={close}>×</button></header>
    <div className="pci-host-content"><PriceChangeIndex view="pci3" mode="business" locale={locale} theme={theme} onThemeChange={setTheme} controller={controller}/></div>
    {pickTarget&&<dialog className="pci-picker-dialog" ref={picker} aria-label="Wybierz benchmark komponentu" onCancel={e=>{e.preventDefault();setPickTarget(null)}}>
      <SharedBenchmarkPicker locale={locale} modelContext="PCI" initialSelectedBenchmarkId={components.find(c=>c.id===pickTarget.id)?.benchmark.businessBenchmarkId}
        onCancel={()=>setPickTarget(null)} onSelect={benchmark=>{
          if(!active.current)return
          if(benchmark.organizationId!==seed.organizationId){setError('Nie można mieszać benchmarków różnych organizacji.');setPickTarget(null);return}
          changed();setPurchase(p=>({...p,economicPeriodApproved:false}));setComponents(c=>attachCategoryBenchmark({components:c},benchmark,{componentId:pickTarget.id,newComponent:()=>({id:crypto.randomUUID(),name:''})}).components.map(x=>({...x,valueKind:x.benchmark.businessBenchmarkId===benchmark.businessBenchmarkId?'':x.valueKind??'',preparationMethod:x.benchmark.businessBenchmarkId===benchmark.businessBenchmarkId?undefined:x.preparationMethod})));setPickTarget(null)
        }}/>
    </dialog>}
  </dialog>
}
