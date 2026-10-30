import React,{useEffect,useRef,useState} from 'react'
import type {PciBusinessController} from './business-contracts'

const frequency:Record<string,string>={DAILY:'dzienna',Daily:'dzienna',WEEKLY:'tygodniowa',Weekly:'tygodniowa',MONTHLY:'miesięczna',Monthly:'miesięczna',QUARTERLY:'kwartalna',Quarterly:'kwartalna',ANNUAL:'roczna',Annual:'roczna'}
const status:Record<string,string>={COMPLETE:'Dane dostępne',MISSING_OBSERVATION:'Brak notowania w wybranym okresie',INCOMPLETE_COVERAGE:'Niepełne dane okresu',EXCLUDED_ZERO_WEIGHT:'Udział 0% — poza obliczeniem',OPEN_PERIOD:'Okres jeszcze otwarty',NO_MATCHING_PERIOD:'Brak zgodnego okresu',NO_OBSERVATIONS:'Brak notowań',NOT_ASSESSED:'Dostępność nie została sprawdzona',DUPLICATE_NATIVE_PERIOD:'Konflikt notowań w jednym okresie',DUPLICATE_OBSERVATION:'Powtórzone znaczniki czasu',INVALID_PRICE_LEVEL:'Historia nie spełnia wymagań modelu'}
export function BasePeriodFields({controller:c}:{controller:PciBusinessController}){
 const p=c.purchase,a=c.preparation,data=a?.data,alert=useRef<HTMLDivElement>(null)
 const [year,setYear]=useState('')
 useEffect(()=>{if(c.error)alert.current?.focus()},[c.error])
 const years=[...new Set(data?.periods.map(v=>v.start.slice(0,4))??[])].sort().reverse()
 const shownYear=years.includes(year)?year:years.includes(p.purchaseDate.slice(0,4))?p.purchaseDate.slice(0,4):years[0]
 const eligible=data?.periods.filter(v=>v.eligible)??[]
 return <div className="pci-base-fields" role="region" aria-label="Data zakupu i dostępne okresy benchmarków" tabIndex={0}>
  <h2>Kiedy ostatnio kupowałeś?</h2>
  <p>Data zakupu opisuje Twoją transakcję. Okres bazowy opisuje dane benchmarków i musi obejmować ten dzień. Nie zastępujemy brakujących notowań.</p>
  <div className="pci-date-grid">
   <label>Data zakupu<input type="date" value={p.purchaseDate} onInput={e=>c.onPurchaseChange({purchaseDate:e.currentTarget.value})}/></label>
   <label>Data benchmarku do porównania<input type="date" value={p.referenceDate} aria-describedby={c.error?'pci-period-help pci-analysis-error':'pci-period-help'} aria-invalid={!!c.error} onInput={e=>c.onPurchaseChange({referenceDate:e.currentTarget.value})}/></label>
  </div>
  <p id="pci-period-help">Dla danych okresowych jest to początek okresu, a nie dzień notowania transakcji. Wybierz go z potwierdzonych okresów poniżej.</p>
  {c.error&&<div ref={alert} id="pci-analysis-error" role="alert" tabIndex={-1} className="pci-base-error">{c.error} Wpisane dane zostały zachowane.</div>}
  <details open className="pci-method-fields"><summary>Znaczenie danych i sposób porównania</summary>
   <p>Ustawienia muszą wynikać z opisu źródła. Częstotliwość i jednostka nie potwierdzają, że seria jest ceną. Ilość zapasów lub produkcji nie jest ceną ani indeksem cenowym.</p>
   <div className="pci-date-grid">
    <label>Co oznaczają wartości benchmarków?<select value={p.periodBasis} onChange={e=>c.onPurchaseChange({periodBasis:e.target.value as typeof p.periodBasis})}><option value="">Sprawdź opis źródła i wybierz</option><option value="POINT_IN_TIME">Wartość z danego dnia</option><option value="END_OF_PERIOD">Wartość na koniec okresu</option><option value="PERIOD_AVERAGE">Średnia za okres</option></select></label>
    <label>Porównanie różnych częstotliwości<select value={p.reduction} onChange={e=>c.onPurchaseChange({reduction:e.target.value as typeof p.reduction})}><option value="NATIVE_ONLY">Bez przeliczania częstotliwości</option><option value="END_OF_PERIOD">Zatwierdzona wartość końca okresu</option><option value="OBSERVATION_AVERAGE">Zatwierdzona średnia obserwacji</option></select></label>
   </div>
   <p>Wybrany opis stosuje się do wszystkich komponentów. Jeśli źródła opisują różne zjawiska lub okresy, nie zgaduj metody — zmień benchmark albo zweryfikuj jego dokumentację.</p>
  </details>
  <div className="pci-series-declarations" role="region" aria-label="Dane wszystkich komponentów" tabIndex={0}>{c.components.map((component,index)=>{
   const info=data?.components.find(v=>v.id===component.id)
   return <div className="pci-series-availability" key={component.id} data-component-availability={component.id}>
    <strong>{index+1}. {component.name.trim()||'Bez nazwy'}</strong><p>{component.benchmark.displayName}</p>
    <p>Częstotliwość źródła: {frequency[info?.frequency??component.benchmark.frequency??'']??info?.frequency??component.benchmark.frequency??'niepodana'} · Jednostka: {info?.unit??component.benchmark.unit??'niepodana'}</p>
    {info&&<p>Historia: {info.firstDate??'brak'} – {info.lastDate??'brak'}<br/><b>{status[info.status]??'Sprawdź zgodność danych'}</b></p>}
    <label>Rodzaj danych według opisu źródła<select aria-label={'Rodzaj danych komponentu '+(index+1)} value={component.valueKind} onChange={e=>c.onComponentChange(component.id,{valueKind:e.target.value as typeof component.valueKind})}><option value="">Nie potwierdzono rodzaju danych</option><option value="PRICE_LEVEL">Cena, np. USD/tona</option><option value="PRICE_INDEX">Indeks cenowy, np. 2020 = 100</option></select></label>
    <button onClick={()=>c.onPickBenchmark(component.id)}>Zmień benchmark komponentu {index+1}</button>
   </div>
  })}</div>
  <section className="pci-period-availability" aria-label="Dostępne wspólne okresy" aria-busy={a?.status==='loading'}>
   <h3>Dostępne wspólne okresy</h3>
   {c.onPrepare&&<button onClick={c.onPrepare} disabled={a?.status==='loading'||!p.purchaseDate||!p.referenceDate||!p.periodBasis||c.components.some(v=>!v.valueKind)}>{a?.status==='loading'?'Sprawdzanie notowań…':'Sprawdź dostępność danych'}</button>}
   {!a?.data&&a?.status!=='loading'&&<p>Uzupełnij daty i potwierdź znaczenie danych każdego komponentu. Następnie sprawdź dostępność; aplikacja nie wybierze daty za Ciebie.</p>}
   {a?.error&&<p role="alert" className="pci-base-error">{a.error}</p>}
   {data&&<><p>Wspólna częstotliwość: {frequency[data.cadence??'']??data.cadence??'nie ustalono — sprawdź przyczynę poniżej'}. Dopuszczalne okresy dla daty zakupu: {eligible.length}.</p>
    {data.issues.length>0&&<ul className="pci-base-error" aria-live="polite">{data.issues.map((i,index)=><li key={i.code+index}>{i.message}</li>)}</ul>}
    {data.periods.length>0&&<div className="pci-date-grid"><label>Rok dostępnej historii<select value={shownYear} onChange={e=>setYear(e.target.value)}>{years.map(v=><option key={v}>{v}</option>)}</select></label>
     <label>Wspólny zamknięty okres<select aria-label="Wspólny zamknięty okres" value={data.periods.some(v=>v.start===p.referenceDate&&v.start.startsWith(shownYear))?p.referenceDate:''} onChange={e=>c.onPurchaseChange({referenceDate:e.target.value})}><option value="">Wybierz okres obejmujący datę zakupu</option>{data.periods.filter(v=>v.start.startsWith(shownYear)).map(v=><option key={v.start} value={v.start} disabled={!v.eligible}>{v.start} – przed {v.endExclusive}{v.eligible?'':' · poza datą zakupu'}</option>)}</select></label></div>}
    <p>Stan dostępnej historii sprawdzono: {data.cutoff.slice(0,10)}. Braków nie uzupełniamy inną datą.</p>
   </>}
  </section>
  <label className="v3-confirm pci-period-approval"><input type="checkbox" checked={p.economicPeriodApproved} onChange={e=>c.onPurchaseChange({economicPeriodApproved:e.target.checked})}/>Potwierdzam porównanie mojego zakupu z wartością dla wskazanego okresu, zamiast z notowaniem dokładnie z dnia zakupu.</label>
  <p>Potwierdzenie jest potrzebne dla danych okresowych. Nie zmienia daty zakupu i nie pozwala użyć okresu, który jej nie obejmuje.</p>
 </div>
}
