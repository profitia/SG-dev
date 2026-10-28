'use client'
import React,{useLayoutEffect,useRef,useState} from 'react'
import {PriceChangeIndex,type PciBusinessController,type PciBusinessResult} from '@profitia/sg2-price-change-index-ui/business'
import {useSg2SessionCredential,useSg2IdentityMode} from '../auth/session-boundary'
import {SharedBenchmarkPicker} from '../benchmark-picker/shared-benchmark-picker'
import {attachCategoryBenchmark} from '../category-builder/benchmark-picker-draft'
import {createCategoryOperationRequester} from '../category-builder/category-operation-request'
import type {SavedBenchmark} from '../../lib/benchmark/contracts'
import type {PciAnalysisResponse} from '../../lib/cost-analysis/price-change-index-contracts'
import {createPciRequester} from './price-change-index-request'
import {emptyPurchase,seedPciComponent,pciStructureReady,pciInput,pciResult,pciCategoryBody,type PciComponent} from './price-change-index-controller'
import './price-change-index-layer.css'

export function PriceChangeIndexLayer({seed,locale,onClose,onAccessLost}:{seed:SavedBenchmark;locale:'pl'|'en';onClose:()=>void;onAccessLost:()=>void}){
  const getToken=useSg2SessionCredential(),identity=useSg2IdentityMode(),dialog=useRef<HTMLDialogElement>(null),picker=useRef<HTMLDialogElement>(null)
  const current=useRef({getToken,identity});current.current={getToken,identity}
  const active=useRef(true),inflight=useRef(false),dirty=useRef(false),saveLock=useRef(false),savedId=useRef<string|null>(null)
  const [name,setName]=useState(''),[components,setComponents]=useState<PciComponent[]>(()=>[seedPciComponent(seed,'seed')]),[purchase,setPurchase]=useState(emptyPurchase)
  const [step,setStep]=useState<1|2|3|'result'>(1),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[result,setResult]=useState<PciBusinessResult|null>(null)
  const [pickTarget,setPickTarget]=useState<{id:string|null}|null>(null),[saveStatus,setSaveStatus]=useState<PciBusinessController['categorySaveStatus']>('idle')
  const [theme,setTheme]=useState<'light'|'dark'>('light')
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
  const changed=()=>{dirty.current=true;setResult(null);setError(null);if(saveStatus==='saved')setSaveStatus('idle')}
  const close=()=>{if(step!=='result'&&dirty.current&&!window.confirm('Odrzucić niezapisane zmiany i wrócić do Benchmark Findera?'))return;onClose()}
  async function analyse(){
    if(inflight.current||!request.current)return;inflight.current=true;setBusy(true);setError(null);setResult(null)
    try{
      const response=await request.current(JSON.stringify(pciInput(name,components,purchase)))
      if(!active.current)return
      if(response.status===401||response.status===403){onAccessLost();onClose();return}
      const body=await response.json() as PciAnalysisResponse
      if(!response.ok||body.status!=='CALCULATED'){
        const message=body.status==='REFUSED'?body.issues.map(i=>i.message).join(' '):'Nie udało się obliczyć ceny. Sprawdź dane i dostępność źródła.'
        throw Error(message)
      }
      if(active.current){setResult(pciResult(body,components));setStep('result')}
    }catch(e){if(active.current){if(e instanceof Error&&e.message==='SESSION_UNAVAILABLE'){onAccessLost();onClose()}else setError(e instanceof Error?e.message:'Analiza niedostępna.')}}
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
  const controller:PciBusinessController={name,components,purchase,step,busy,error,result,categorySaveStatus:saveStatus,ready:pciStructureReady(name,components),
    onNameChange:value=>{changed();setName(value)},onComponentChange:(id,patch)=>{changed();setComponents(c=>c.map(x=>x.id===id?{...x,...patch}:x))},
    onRemove:id=>{changed();setComponents(c=>c.filter(x=>x.id!==id))},onPickBenchmark:id=>setPickTarget({id}),
    onPurchaseChange:patch=>{changed();setPurchase(p=>({...p,...patch}))},onStep:value=>{setError(null);setStep(value)},onAnalyse:()=>void analyse(),onSaveCategory:()=>void saveCategory(),onClose:close}
  return <dialog className="pci-host-dialog" data-theme={theme} ref={dialog} aria-labelledby="pci-layer-title" onCancel={e=>{e.preventDefault();close()}}>
    <header className="pci-host-bar"><h2 id="pci-layer-title">Price Change Index · Budowa kategorii</h2><button type="button" aria-label="Zamknij Price Change Index" onClick={close}>×</button></header>
    <div className="pci-host-content"><PriceChangeIndex view="pci3" mode="business" locale={locale} theme={theme} onThemeChange={setTheme} controller={controller}/></div>
    {pickTarget&&<dialog className="pci-picker-dialog" ref={picker} aria-label="Wybierz benchmark komponentu" onCancel={e=>{e.preventDefault();setPickTarget(null)}}>
      <SharedBenchmarkPicker locale={locale} initialSelectedBenchmarkId={components.find(c=>c.id===pickTarget.id)?.benchmark.businessBenchmarkId}
        onCancel={()=>setPickTarget(null)} onSelect={benchmark=>{
          if(!active.current)return
          if(benchmark.organizationId!==seed.organizationId){setError('Nie można mieszać benchmarków różnych organizacji.');setPickTarget(null);return}
          changed();setComponents(c=>attachCategoryBenchmark({components:c},benchmark,{componentId:pickTarget.id,newComponent:()=>({id:crypto.randomUUID(),name:''})}).components.map(x=>({...x,valueKind:x.valueKind??''})));setPickTarget(null)
        }}/>
    </dialog>}
  </dialog>
}
