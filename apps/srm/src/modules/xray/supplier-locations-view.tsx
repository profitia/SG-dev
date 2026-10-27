'use client'
import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react'
import {CanonButton,FinancialHistoryDialog,displayPostalAddress,currentLocationCoordinates,supplierLocationsMapProjection,type SupplierLocation,type SupplierLocationGroup,type ManualLocationInput} from '@profitia/srm-xray'
import {SupplierLocationController} from './supplier-location-controller'
import {mountSupplierMapWithStartupRetry} from './supplier-map-startup'
import targets from '../../../deployment/supplier-location-targets.json'
const groups=[['SUPPLIER_LOCATIONS','Siedziba i oddziały'],['USER_LOCATIONS','Własne lokalizacje']] as const
const button=(label:string,onClick:()=>void,disabled=false)=><CanonButton canonId="SRM-C02" usage="supplier-locations:01" type="button" onClick={onClick} disabled={disabled}>{label}</CanonButton>
const empty:ManualLocationInput={label:'',description:'',address:{line1:'',postalCode:'',locality:'',country:'Polska'},position:null}
export function SupplierLocations({supplierId,supplierName,refreshKey}:{supplierId:string;supplierName?:string;refreshKey:string}){
 const [controller]=useState(()=>new SupplierLocationController(supplierId)),state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot)
 const [group,setGroup]=useState<SupplierLocationGroup>('SUPPLIER_LOCATIONS'),[offset,setOffset]=useState(0),[open,setOpen]=useState(false),[editing,setEditing]=useState<SupplierLocation|null|undefined>(undefined)
 const [form,setForm]=useState<ManualLocationInput>(empty),[formError,setFormError]=useState<string|null>(null),[saving,setSaving]=useState(false),[mapStatus,setMapStatus]=useState<'loading'|'ready'|'error'>('loading'),[mapAttempt,setMapAttempt]=useState(0),[selectedLocation,setSelectedLocation]=useState<string|null>(null),[positionDraft,setPositionDraft]=useState({lat:'',lng:''})
 const map=useRef<HTMLDivElement>(null),formStart=useRef<HTMLInputElement>(null)
 useEffect(()=>()=>controller.dispose(),[controller])
 useEffect(()=>{let current=true;void controller.sync().then(()=>{if(current&&open)void controller.load(group,offset)});return()=>{current=false}},[controller,refreshKey])
 useEffect(()=>{if(open)void controller.load(group,offset)},[controller,open,group,offset])
 useEffect(()=>{if(!open)return;const timer=setInterval(()=>void controller.load(group,offset),30000);return()=>clearInterval(timer)},[open,controller,group,offset])
 useEffect(()=>{if(!state.blocked)return;setEditing(undefined);setForm(empty)},[state.blocked])
 // Losing the visible browser session or page clears the projection/iframe;
 // restoration always performs a current protected read.
 useEffect(()=>{
  const clear=()=>{controller.dispose();setOpen(false);setEditing(undefined);setForm(empty)}
  window.addEventListener('pagehide',clear);const visibility=()=>{if(document.visibilityState==='hidden')clear()};document.addEventListener('visibilitychange',visibility)
  return()=>{window.removeEventListener('pagehide',clear);document.removeEventListener('visibilitychange',visibility)}
 },[controller])
 useEffect(()=>{
  if(!open||!map.current||!state.page||state.blocked||!state.page.items.some(v=>currentLocationCoordinates(v)))return
  setMapStatus('loading');setSelectedLocation(null)
  let disposed=false,view:{close():void}|undefined
  void import('@profitia/maps-embed').then(({mountMaps})=>{
   if(disposed||!map.current)return
   const container=map.current
   view=mountSupplierMapWithStartupRetry(onStatus=>{
    const attempt=mountMaps({container,runtimeOrigin:targets.mapsRuntimeOrigin,readLocations:async({signal})=>supplierLocationsMapProjection((await controller.mapPage(group,offset,signal)).items),onSelect:id=>{if(!disposed)setSelectedLocation(id)},onStatus})
    container.querySelector('iframe')?.setAttribute('style','width:100%;height:100%;border:0')
    return attempt
   },s=>{if(!disposed)setMapStatus(s)})
  }).catch(()=>{if(!disposed)setMapStatus('error')})
  return()=>{disposed=true;view?.close()}
 },[open,state.page,state.blocked,controller,group,offset,mapAttempt])
 useEffect(()=>{if(editing!==undefined)formStart.current?.focus()},[editing])
 const begin=(location:SupplierLocation|null)=>{setEditing(location);setForm(location?{label:location.label,description:location.description,address:location.address??empty.address,position:location.coordinates?.origin==='USER_INPUT'?location.coordinates.position:null}:empty);setPositionDraft(location?.coordinates?.origin==='USER_INPUT'?{lat:String(location.coordinates.position.lat),lng:String(location.coordinates.position.lng)}:{lat:'',lng:''});setFormError(null)}
 const save=async()=>{setSaving(true);setFormError(null);try{if((positionDraft.lat==='')!==(positionDraft.lng===''))throw Error('Podaj obie współrzędne albo pozostaw oba pola puste.');const position=positionDraft.lat===''?null:{lat:Number(positionDraft.lat),lng:Number(positionDraft.lng)};await controller.save(editing?'UPDATE':'CREATE',editing?.id??null,editing?.version??null,{...form,position});setEditing(undefined);await controller.load(group,offset)}catch(e){setFormError(e instanceof Error?e.message:'Nie udało się zapisać lokalizacji.')}finally{setSaving(false)}}
 const deactivate=async(location:SupplierLocation)=>{setSaving(true);setFormError(null);try{await controller.save('DEACTIVATE',location.id,location.version,null);await controller.load(group,offset)}catch(e){setFormError(e instanceof Error?e.message:'Nie udało się usunąć lokalizacji.')}finally{setSaving(false)}}
 const close=()=>{setOpen(false);setEditing(undefined);setForm(empty);setSelectedLocation(null)}
 return <>
  <CanonButton canonId="SRM-C103" usage="supplier-locations:open" className="srm-google-maps-button" type="button" aria-label="Otwórz lokalizację dostawcy w Google Maps" aria-haspopup="dialog" aria-expanded={open} onClick={event=>{event.currentTarget.focus({preventScroll:true});setOpen(true)}}>
   <img src="https://www.gstatic.com/images/branding/product/2x/maps_48dp.png" width={30} height={30} alt="" draggable={false}/>
  </CanonButton>
  {open&&<FinancialHistoryDialog title="Lokalizacja dostawcy" subtitle={supplierName} onClose={close} className="srm-supplier-map-dialog">
   <div className="srm-supplier-map-body" data-canon-id="SRM-C104">
   <p>Lokalizacje zapisane dla organizacji są dostępne jej uprawnionym członkom.</p>
   <nav aria-label="Grupy lokalizacji">{groups.map(([key,label])=><CanonButton key={key} canonId="SRM-C02" usage="supplier-locations:02" type="button" aria-pressed={key===group} onClick={()=>{setGroup(key);setOffset(0);setEditing(undefined)}}>{label}</CanonButton>)}</nav>
   {state.sync==='PENDING'&&<p role="status">Uzgadnianie lokalizacji z zapisanymi raportami…</p>}
   {state.sync==='UNAVAILABLE'&&<p>Nie potwierdzono pełnej synchronizacji raportów. Możesz odczytać dostępne zapisane lokalizacje.</p>}
   {state.error&&<p role="alert">{state.error}</p>}{state.busy&&<p role="status">Wczytywanie lokalizacji…</p>}
   {group==='SUPPLIER_LOCATIONS'&&<p>Oddziały: dostępność danych nie została potwierdzona u dostawcy raportów.</p>}
   {state.page&&<p>Wyświetlono {state.page.items.length} z {state.page.total}. Na tej stronie: {state.page.items.filter(v=>!!currentLocationCoordinates(v)).length} ze współrzędnymi, {state.page.items.filter(v=>!currentLocationCoordinates(v)).length} bez współrzędnych.</p>}
   {state.blocked&&<p role="alert" data-canon-id="SRM-C105">Brak dostępu do lokalizacji. Potwierdź aktualny dostęp do raportu.</p>}
   {state.page&&!state.blocked&&(state.page.items.some(v=>currentLocationCoordinates(v))?<section className="srm-supplier-map-panel" aria-label="Mapa zapisanych lokalizacji">
    <div ref={map} className="srm-supplier-map-canvas"/>
    {mapStatus==='loading'&&<p role="status" data-canon-id="SRM-C105">Wczytywanie mapy…</p>}
    {mapStatus==='error'&&<div role="alert" data-canon-id="SRM-C105"><p>Mapa jest chwilowo niedostępna. Zapisane adresy pozostają na liście.</p>{button('Spróbuj ponownie',()=>setMapAttempt(v=>v+1))}</div>}
    {mapStatus==='ready'&&<span className="srm-sr-only" role="status">Mapa lokalizacji jest gotowa.</span>}
   </section>:<p role="status" data-canon-id="SRM-C105">{state.page.total===0?'Brak dostępnych lokalizacji.':state.page.items.some(v=>displayPostalAddress(v.address))?'Brak potwierdzonych współrzędnych. Zapisane adresy pozostają na liście.':'Brak adresu do wyświetlenia na mapie.'}</p>)}
   <ul>{state.page?.items.map(location=><li key={location.id} aria-current={selectedLocation===location.id?'location':undefined}><strong>{location.label}</strong><p>{displayPostalAddress(location.address)||'Brak potwierdzonego adresu'}</p>
    <p>{location.origin==='MANUAL'?'Lokalizacja własna organizacji':location.sources.map(source=>source.kind==='KYS'?'Raport KYS':'Rejestr KRS (MGBI)').join(' · ')}{location.relationship?.type&&<> · Relacja: {location.relationship.type}</>}</p>
    <p>{location.verification==='INCOMPLETE'?'Adres wymaga doprecyzowania. ':location.verification==='UNRESOLVED'?'Brak potwierdzonego adresu. ':''}{location.lifecycle==='INACTIVE'?'Relacja nieaktywna':currentLocationCoordinates(location)?'Lokalizacja na mapie':'Brak potwierdzonych współrzędnych'}</p>
    {location.origin==='MANUAL'&&<>{button('Edytuj',()=>begin(location),saving)}{button('Dezaktywuj',()=>void deactivate(location),saving)}</>}
   </li>)}</ul>
   {state.page?.total===0&&!state.busy&&<p>Brak dostępnych lokalizacji w tej grupie.</p>}
   {button('Poprzednia strona',()=>setOffset(Math.max(0,offset-50)),offset===0||state.busy)}{button('Następna strona',()=>setOffset(offset+50),!state.page?.hasMore||state.busy)}
   {button('Ponów odczyt',()=>void controller.load(group,offset),state.busy)}
   {group==='USER_LOCATIONS'&&button('Dodaj lokalizację',()=>begin(null),saving||state.blocked)}
   {formError&&<p role="alert">{formError}</p>}
   {editing!==undefined&&<form onSubmit={event=>{event.preventDefault();void save()}}><h3>{editing?'Edytuj lokalizację':'Nowa lokalizacja'}</h3>
    <label>Nazwa<input ref={formStart} required maxLength={160} value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></label>
    {([['line1','Ulica i numer'],['postalCode','Kod pocztowy'],['locality','Miejscowość'],['country','Kraj']] as const).map(([key,label])=><label key={key}>{label}<input required maxLength={key==='postalCode'?20:key==='line1'?200:key==='country'?80:100} value={form.address[key]??''} onChange={e=>setForm({...form,address:{...form.address,[key]:e.target.value}})}/></label>)}
    <label>Opis<textarea maxLength={1024} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    <p>Współrzędne są opcjonalne. Sam adres zostanie zapisany również bez współrzędnych.</p>
    <label>Szerokość geograficzna<input type="number" min={-90} max={90} step="any" value={positionDraft.lat} onChange={e=>setPositionDraft({...positionDraft,lat:e.target.value})}/></label>
    <label>Długość geograficzna<input type="number" min={-180} max={180} step="any" value={positionDraft.lng} onChange={e=>setPositionDraft({...positionDraft,lng:e.target.value})}/></label>
    <CanonButton canonId="SRM-C02" usage="supplier-locations:03" type="submit" disabled={saving}>Zapisz</CanonButton>{button('Anuluj',()=>setEditing(undefined),saving)}
   </form>}
   </div>
  </FinancialHistoryDialog>}
 </>
}
