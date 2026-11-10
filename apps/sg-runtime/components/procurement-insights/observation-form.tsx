'use client'
import React,{useState} from 'react'
import {CanonButton,CanonInput,CanonSelect,CanonSummary} from '@profitia/srm-xray'
import type {Observation} from '@/lib/newsfeed/client'
const queryFor=(phrases:string[])=>phrases.map(x=>'"'+x.replace(/["\\]/g,'\\$&')+'"').join(' OR ')
export function ObservationForm({initial,onSave,onCancel,busy,locale}:{initial:Observation|null;onSave:(body:Record<string,unknown>,search:boolean)=>Promise<void>;onCancel:()=>void;busy:boolean;locale:'pl'|'en'}){
 const [name,setName]=useState(initial?.name??''),[phrases,setPhrases]=useState(initial?.phrases??[]),[term,setTerm]=useState(''),[error,setError]=useState('')
 const [kind,setKind]=useState(initial?.subjectKind??'topic'),[query,setQuery]=useState(initial&&initial.request.criteria.text!==queryFor(initial.phrases)?String(initial.request.criteria.text??''):'')
 const [language,setLanguage]=useState(String(initial?.request.criteria.language??'')),[country,setCountry]=useState(String(initial?.request.criteria.country??'')),[freshness,setFreshness]=useState(String(initial?.request.criteria.freshness??''))
 const [recurring,setRecurring]=useState(!!initial?.schedule),[frequency,setFrequency]=useState(initial?.schedule?.frequency??'DAILY'),[time,setTime]=useState(initial?.schedule?.localTime??'08:00')
 const [timeZone,setTimeZone]=useState(initial?.schedule?.timeZone??'Europe/Warsaw'),[start,setStart]=useState(initial?.schedule?.startDate??new Date().toLocaleDateString('en-CA')),[end,setEnd]=useState(initial?.schedule?.endDate??'')
 const [weekday,setWeekday]=useState(initial?.schedule?.weekdays?.[0]??1),[monthDay,setMonthDay]=useState(initial?.schedule?.monthDay??1),[notifications,setNotifications]=useState(initial?.notifications??false)
 function add(){const value=term.normalize('NFKC').trim().replace(/\s+/gu,' ');if(!value||value.length>200){setError('Wpisz frazę o długości od 1 do 200 znaków.');return}if(phrases.some(x=>x.toLocaleLowerCase('pl-PL')===value.toLocaleLowerCase('pl-PL'))){setError('Ta fraza jest już na liście.');return}if(phrases.length>=20){setError('Obserwacja może zawierać do 20 fraz.');return}setPhrases([...phrases,value]);setTerm('');setError('')}
 async function submit(search:boolean){
  const text=query.trim()||queryFor(phrases)
  if(!name.trim()||!phrases.length){setError('Podaj nazwę i dodaj co najmniej jedną frazę.');return}
  if(text.length>600){setError('Skróć zapytanie wyszukiwania do 600 znaków.');return}
  if(recurring&&(!start||end&&end<start||!time)){setError('Sprawdź początek, koniec i godzinę harmonogramu.');return}
  try{new Intl.DateTimeFormat('pl',{timeZone}).format()}catch{setError('Wybierz poprawną strefę czasową.');return}
  setError('');await onSave({contractVersion:'1.2.0',name:name.trim(),subjectKind:kind,subject:initial?.subject??name.trim(),phrases,
   request:{contractVersion:'1.0.0',family:'news-discovery',provider:'brave',operation:'search',criteria:{text,...(language?{language}:{}),...(country?{country}:{}),...(freshness?{freshness}:{})}},
   schedule:recurring?{frequency,timeZone,localTime:time,startDate:start,endDate:end||null,...(frequency==='WEEKLY'?{weekdays:[weekday]}:{}),...(frequency==='MONTHLY'?{monthDay}:{})}:null,
   notifications,...(initial?{version:initial.version,status:initial.status}:{})},search)
 }
 return <section className="pi-form" aria-label={initial?'Edytuj obserwację':'Nowa obserwacja'}>
  <header><h2>{initial?'Edytuj obserwację':'Nowa obserwacja'}</h2><p>Ustal temat i sposób korzystania z obserwacji.</p></header>
  <fieldset disabled={busy}><legend>1. Co chcesz obserwować?</legend>
   <label>Nazwa obserwacji<CanonInput canonId="SRM-C06" usage="PI:observation-name" value={name} maxLength={200} onChange={e=>setName(e.target.value)}/></label>
   <div className="pi-add-phrase"><label>Słowo kluczowe lub fraza<CanonInput canonId="SRM-C06" usage="PI:phrase" value={term} maxLength={200} onChange={e=>setTerm(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}}/></label><CanonButton canonId="SRM-C02" usage="PI:add-phrase" type="button" onClick={add}>Dodaj</CanonButton></div>
   <ul className="pi-phrases">{phrases.map(p=><li key={p}>{p}<button type="button" aria-label={'Usuń frazę '+p} onClick={()=>setPhrases(phrases.filter(x=>x!==p))}>×</button></li>)}</ul>
   <label>Typ kontekstu<CanonSelect canonId="SRM-C16" usage="PI:context-kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="topic">Inny temat</option><option value="company">Firma lub dostawca</option><option value="product">Produkt lub surowiec</option><option value="category">Branża lub kategoria</option><option value="investment">Inwestycja</option></CanonSelect></label>
  </fieldset>
  <fieldset disabled={busy}><legend>2. Jakie informacje Cię interesują?</legend><p>Wiadomości i artykuły · Brave Search</p>
   <details><CanonSummary canonId="SRM-C49" usage="PI:advanced-search">Zaawansowane ustawienia wyszukiwania</CanonSummary>
    <label>Własne zapytanie (opcjonalnie)<CanonInput canonId="SRM-C06" usage="PI:query" value={query} placeholder={queryFor(phrases)} maxLength={600} onChange={e=>setQuery(e.target.value)}/></label>
    <p className="pi-note">Obsługa operatorów Brave jest eksperymentalna. Wyniki mogą obejmować tylko część dostępnych publikacji.</p>
    <label>Język<CanonSelect canonId="SRM-C16" usage="PI:language" value={language} onChange={e=>setLanguage(e.target.value)}><option value="">Wszystkie</option><option value="pl">Polski</option><option value="en">Angielski</option><option value="de">Niemiecki</option></CanonSelect></label>
    <label>Kraj edycji wyników<CanonSelect canonId="SRM-C16" usage="PI:country" value={country} onChange={e=>setCountry(e.target.value)}><option value="">Wszystkie</option><option value="PL">Polska</option><option value="US">Stany Zjednoczone</option><option value="GB">Wielka Brytania</option><option value="DE">Niemcy</option></CanonSelect></label>
    <label>Świeżość<CanonSelect canonId="SRM-C16" usage="PI:freshness" value={freshness} onChange={e=>setFreshness(e.target.value)}><option value="">Bez dodatkowego filtra</option><option value="pd">Ostatnia doba</option><option value="pw">Ostatni tydzień</option><option value="pm">Ostatni miesiąc</option><option value="py">Ostatni rok</option></CanonSelect></label>
   </details>
  </fieldset>
  <fieldset disabled={busy}><legend>3. Jak chcesz korzystać z obserwacji?</legend>
   <label><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)}/> Monitoruj cyklicznie</label>
   {recurring&&<div className="pi-schedule-grid"><label>Częstotliwość<CanonSelect canonId="SRM-C16" usage="PI:frequency" value={frequency} onChange={e=>setFrequency(e.target.value as typeof frequency)}><option value="DAILY">Codziennie</option><option value="WEEKLY">Co tydzień</option><option value="MONTHLY">Co miesiąc</option></CanonSelect></label>
    {frequency==='WEEKLY'&&<label>Dzień tygodnia<CanonSelect canonId="SRM-C16" usage="PI:weekday" value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'].map((x,i)=><option key={x} value={i+1}>{x}</option>)}</CanonSelect></label>}
    {frequency==='MONTHLY'&&<label>Dzień miesiąca<CanonInput canonId="SRM-C06" usage="PI:month-day" type="number" min={1} max={31} value={monthDay} onChange={e=>setMonthDay(Number(e.target.value))}/></label>}
    <label>Godzina<CanonInput canonId="SRM-C06" usage="PI:time" type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><label>Strefa czasowa<CanonInput canonId="SRM-C06" usage="PI:timezone" value={timeZone} onChange={e=>setTimeZone(e.target.value)}/></label>
    <label>Początek<CanonInput canonId="SRM-C06" usage="PI:start-date" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Koniec (puste = bezterminowo)<CanonInput canonId="SRM-C06" usage="PI:end-date" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
    <p className="pi-note">Nieistniejąca godzina przy zmianie czasu zostaje pominięta; powtórzona godzina oznacza jedno wykonanie.</p>
   </div>}
   <label><input type="checkbox" checked={notifications} onChange={e=>setNotifications(e.target.checked)}/> Powiadamiaj o nowych publikacjach</label>
  </fieldset>
  <fieldset><legend>4. Kto ma mieć dostęp?</legend><p>Prywatna — tylko Ty. Dostęp możesz rozszerzyć w ustawieniach udostępniania obserwacji.</p></fieldset>
  {error&&<p role="alert">{error}</p>}
  <footer className="pi-actions"><CanonButton canonId="SRM-C01" usage="PI:save-observation" type="button" disabled={busy} onClick={()=>void submit(false)}>Zapisz obserwację</CanonButton><CanonButton canonId="SRM-C02" usage="PI:save-and-search" type="button" disabled={busy} onClick={()=>void submit(true)}>Zapisz i sprawdź nowe artykuły</CanonButton><CanonButton canonId="SRM-C02" usage="PI:cancel-observation" type="button" disabled={busy} onClick={onCancel}>{locale==='pl'?'Anuluj':'Cancel'}</CanonButton></footer>
 </section>
}
