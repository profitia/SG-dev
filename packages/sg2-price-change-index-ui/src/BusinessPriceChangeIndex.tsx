import React,{useEffect,useLayoutEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {createPresentationScope,PresentationScopeProvider,type PresentationScope} from './PresentationScope'
import {ThemeProvider,CanonThemeSwitch} from './Theme'
import type {PriceChangeIndexBusinessProps} from './business-contracts'
import {BusinessPriceChart} from './revisions/pci3/business-chart'
import theme from './canon/theme.css?inline'
import bindings from './revisions/pci3/canon-theme.css?inline'
import shared from './revisions/pci3/canon-shared.css?inline'
import v3 from './revisions/pci3/price-analysis-v3.css?inline'
import stacked from './revisions/pci3/stacked-price-chart.css?inline'
import completion from './revisions/pci3/price-analysis-completion.css?inline'
import fit from './revisions/pci3/price-analysis-layer-fit.css?inline'
import crosshair from './revisions/pci3/canon-chart15/chart-crosshair.css?inline'
import labels from './revisions/pci3/canon-chart15/chart-value-labels.css?inline'
import range from './revisions/pci3/canon-chart15/chart-time-range.css?inline'
import presets from './revisions/pci3/canon-chart15/chart-time-presets.css?inline'
import time from './revisions/pci3/canon-chart15/srm-history-chart.css?inline'
import history from './revisions/pci3/canon-chart15/price-history-line.css?inline'
import business from './business.css?inline'

const styles=[theme,bindings,shared,v3,stacked,completion,fit,crosshair,labels,range,presets,time,history,business].join('\n')
const fmt=(n:number|null)=>n==null?'—':new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2}).format(n)
function ProductView({controller:c}:PriceChangeIndexBusinessProps){
  const [compact,setCompact]=useState(false),[mode,setMode]=useState<'monitor'|'compare'>('monitor')
  const [editing,setEditing]=useState<{id:string;text:string}|null>(null)
  const root=useRef<HTMLDivElement>(null),content=useRef<HTMLElement>(null)
  useLayoutEffect(()=>{const el=root.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setCompact(entry.contentRect.width<650||entry.contentRect.height<700));observer.observe(el);return()=>observer.disconnect()},[])
  useEffect(()=>{content.current?.scrollTo({top:0})},[c.step,mode])
  useEffect(()=>{if(c.error)root.current?.querySelector<HTMLElement>('.pci-error')?.focus({preventScroll:true})},[c.error])
  const previousCount=useRef(c.components.length),focusAdded=useRef<string|null>(null)
  useLayoutEffect(()=>{
    if(c.components.length>previousCount.current){
      focusAdded.current=c.components.at(-1)!.id
    }
    previousCount.current=c.components.length
    if(focusAdded.current){
      const row=Array.from(root.current?.querySelectorAll<HTMLTableRowElement>('tr[data-component-id]')??[]).find(el=>el.dataset.componentId===focusAdded.current)
      if(row){row.scrollIntoView?.({block:'nearest'});row.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});focusAdded.current=null}
    }
  },[c.components])
  const visible=c.components,p=c.purchase
  const purchaseReady=Number(p.amount.replace(',','.'))>0&&!!p.currency.trim()&&!!p.unit.trim()&&!!p.taxBasis&&!!p.deliveryBasis.trim()
  const dateReady=!!p.purchaseDate&&!!p.referenceDate&&!!p.periodBasis&&c.components.every(x=>x.valueKind)
  const result=c.result,last=result?.nodes.slice().reverse().find(n=>n.price!==null)
  return <div ref={root} className="v3-app srm-ui v3-layer-layout pci-business" data-flow-screen={c.step==='result'?'result':'setup'} data-flow-step={c.step}
    data-design-component="463321469305384960" data-design-revision="465857540723474432" data-product-surface="pci-buyer-journey-v1">
    <header className="v3-header"><div><div className="v3-crumb">SpendGuru / Cost Analysis / Price Change Index <b>v3</b></div><h1>{c.step==='result'?c.name:'Nowa analiza ceny'}</h1><p>Struktura produktu · Ostatnia cena · Data zakupu</p></div><nav><CanonThemeSwitch/></nav></header>
    <main className="v3-flow-content" ref={content} aria-busy={c.busy}>
      {c.step!=='result'?<>
        <div className="v3-context"><b>Benchmark Finder → Price Change Index</b><span>Wybrany benchmark został wstawiony do struktury. Uzupełnij resztę kosztów.</span></div>
        <div className="v3-steps" role="tablist" aria-label="Budowa kategorii">{['Z czego składa się produkt?','Ile ostatnio zapłaciłeś?','Kiedy kupowałeś?'].map((title,i)=><button key={title} role="tab" aria-selected={c.step===i+1} className={c.step===i+1?'v3-active':''} disabled={c.busy||(i>0&&!c.ready)||(i>1&&!purchaseReady)} onClick={()=>c.onStep((i+1) as 1|2|3)}><span className="v3-step-number">0{i+1}</span><span className="v3-step-title">{title}</span></button>)}</div>
        <div className="v3-grid2"><section className="v3-panel v3-setup-panel">
          {c.step===1&&<>
            <h2>Jakie komponenty i benchmarki tworzą koszt Twojej kategorii?</h2>
            <p>Uzupełnij strukturę. Benchmark przekazany z wyszukiwarki zostaje zachowany.</p>
            <label className="v3-category-name">Nazwa kategorii<input value={c.name} maxLength={120} onInput={e=>c.onNameChange(e.currentTarget.value)}/></label>
            <div className="v3-table-wrap" role="region" aria-label="Wszystkie komponenty kategorii" tabIndex={0}><table><thead><tr><th>Komponent</th><th>Udział %</th><th>Wybrany benchmark</th><th><span className="pci-sr-only">Usuń</span></th></tr></thead><tbody>{visible.map(component=><tr key={component.id} data-component-id={component.id}>
              <td><input aria-label="Komponent" value={component.name} maxLength={120} onInput={e=>c.onComponentChange(component.id,{name:e.currentTarget.value})}/></td>
              <td><input aria-label={'Udział % '+component.name} type="number" min={0} max={100} step={1} inputMode="numeric" value={editing?.id===component.id?editing.text:component.weightPercent}
                onFocus={()=>setEditing({id:component.id,text:component.weightPercent===0?'':String(component.weightPercent)})}
                onBlur={()=>setEditing(null)} onInput={e=>{const text=e.currentTarget.value;setEditing({id:component.id,text});c.onComponentChange(component.id,{weightPercent:text===''?0:Number(text)})}}/></td>
              <td><button className="pci-benchmark-control" onClick={()=>c.onPickBenchmark(component.id)} title={component.benchmark.displayName}>{component.benchmark.displayName}<span aria-hidden>⌄</span></button></td>
              <td><button aria-label={'Usuń komponent '+component.name} onClick={()=>c.onRemove(component.id)}>×</button></td>
            </tr>)}</tbody></table></div>
            <p className="v3-structure-total">{c.components.length} komponentów · Łącznie: <b>{fmt(c.components.reduce((sum,x)=>sum+x.weightPercent,0))}%</b>{c.ready?' · Struktura gotowa':' · Uzupełnij do 100% i przypisz benchmarki'}</p>
            <div className="v3-actions v3-component-add"><button disabled={c.components.length>=12} onClick={()=>c.onPickBenchmark(null)}>+ Dodaj komponent</button></div>
            <details className="v3-structure-help"><summary>Jak przygotować strukturę?</summary><div><p>Kategoria wymaga co najmniej dwóch komponentów. Udziały to liczby całkowite od 0 do 100; suma musi wynosić 100%.</p></div></details>
          </>}
          {c.step===2&&<>
            <h2>Ile ostatnio zapłaciłeś?</h2><p>Wpisz rzeczywistą cenę zakupu i jej warunki. Nie przeliczamy waluty ani jednostki.</p>
            <label>Ostatnia cena zakupu<input aria-label="Ostatnia cena zakupu" inputMode="decimal" value={p.amount} onInput={e=>c.onPurchaseChange({amount:e.currentTarget.value})}/></label>
            <label>Waluta<input aria-label="Waluta zakupu" value={p.currency} maxLength={3} placeholder="np. PLN" onInput={e=>c.onPurchaseChange({currency:e.currentTarget.value.toUpperCase()})}/></label>
            <label>Jednostka<input aria-label="Jednostka zakupu" value={p.unit} maxLength={64} placeholder="np. tona" onInput={e=>c.onPurchaseChange({unit:e.currentTarget.value})}/></label>
            <label>Cena netto / brutto<select value={p.taxBasis} onChange={e=>c.onPurchaseChange({taxBasis:e.target.value as typeof p.taxBasis})}><option value="">Wybierz</option><option value="NET">Netto</option><option value="GROSS">Brutto</option></select></label>
            <label>Warunki dostawy<input aria-label="Warunki dostawy" value={p.deliveryBasis} placeholder="Określ warunki ceny" maxLength={256} onInput={e=>c.onPurchaseChange({deliveryBasis:e.currentTarget.value})}/></label>
          </>}
          {c.step===3&&<>
            <h2>Kiedy ostatnio kupowałeś?</h2><p>Podaj datę zakupu i sprawdź, z jakimi notowaniami ma być porównana cena. Nie zastępujemy brakujących danych.</p>
            <label>Data zakupu<input type="date" value={p.purchaseDate} onInput={e=>{const value=e.currentTarget.value;c.onPurchaseChange({purchaseDate:value,...(!p.economicPeriodApproved?{referenceDate:value}:{})})}}/></label>
            <label>Data benchmarku do porównania<input type="date" value={p.referenceDate} onInput={e=>c.onPurchaseChange({referenceDate:e.currentTarget.value})}/></label>
            <label>Co oznaczają wartości benchmarku?<select value={p.periodBasis} onChange={e=>c.onPurchaseChange({periodBasis:e.target.value as typeof p.periodBasis})}><option value="">Sprawdź opis źródła i wybierz</option><option value="POINT_IN_TIME">Notowanie z konkretnego dnia</option><option value="END_OF_PERIOD">Wartość na koniec okresu</option><option value="PERIOD_AVERAGE">Średnia za okres</option></select></label>
            <label>Porównanie różnych częstotliwości<select value={p.reduction} onChange={e=>c.onPurchaseChange({reduction:e.target.value as typeof p.reduction})}><option value="NATIVE_ONLY">Bez uśredniania danych</option><option value="END_OF_PERIOD">Wartość na koniec wspólnego okresu</option><option value="OBSERVATION_AVERAGE">Średnia z notowań w okresie</option></select></label>
            <div className="pci-series-declarations">{visible.map(component=><label key={component.id}>Dane komponentu „{component.name}”<select value={component.valueKind} onChange={e=>c.onComponentChange(component.id,{valueKind:e.target.value as typeof component.valueKind})}><option value="">Sprawdź opis źródła i wybierz</option><option value="PRICE_LEVEL">Cena, np. USD/tona</option><option value="PRICE_INDEX">Indeks, np. 2020 = 100</option></select></label>)}</div>
            <label className="v3-confirm pci-period-approval"><input type="checkbox" checked={p.economicPeriodApproved} onChange={e=>c.onPurchaseChange({economicPeriodApproved:e.target.checked})}/>Porównuję zakup z wartością dla wskazanego okresu, zamiast z notowaniem dokładnie z dnia zakupu.</label>
            <details className="v3-structure-help pci-method-help"><summary>Co wybrać i dlaczego?</summary><div><p><b>Data benchmarku</b> to dzień notowania albo początek miesiąca/kwartału, do którego odnosisz zakup. Data zakupu pozostaje rzeczywistą datą transakcji.</p><p><b>Znaczenie wartości</b> i <b>cena lub indeks</b> muszą wynikać z opisu źródła. Potwierdź te informacje w opisie benchmarku. Jeśli źródło ich nie wyjaśnia, nie wybieraj ustawień na próbę.</p><p><b>Różne częstotliwości:</b> dane dzienne i miesięczne można połączyć tylko według zgodnej metody. Średnia za okres i wartość na jego koniec oznaczają co innego.</p><p><b>Potwierdzenie okresu</b> jest potrzebne przy odniesieniu zakupu do miesiąca lub kwartału. Nie oznacza zgody na przesunięcie zakupu do dowolnego innego dnia ani uzupełnienie brakujących notowań.</p></div></details>
          </>}
        </section><aside className="v3-panel v3-setup-summary"><details open={!compact} className="v3-setup-summary-disclosure"><summary>Podsumowanie</summary><div><h3>Twoja kategoria</h3><p>{c.name||'Nadaj nazwę kategorii'}</p><p>{c.components.length} komponentów · {fmt(c.components.reduce((sum,x)=>sum+x.weightPercent,0))}%</p><p>{p.amount&&p.currency&&p.unit?`${p.amount} ${p.currency}/${p.unit}`:'Uzupełnij cenę zakupu'}</p><p>{p.purchaseDate||'Wybierz datę zakupu'}</p><p>Analiza nie zapisuje kategorii ani oferty. Zapis struktury jest osobną, jawną akcją.</p></div></details></aside></div>
      </>:result&&<>
        <div className="v3-actions" role="tablist" aria-label="Cel analizy"><button role="tab" aria-selected={mode==='monitor'} className={mode==='monitor'?'v3-active':''} onClick={()=>setMode('monitor')}>Obserwuj cenę</button><button role="tab" aria-selected={mode==='compare'} className={mode==='compare'?'v3-active':''} onClick={()=>setMode('compare')}>Sprawdź ofertę dostawcy</button></div>
        <div className="v3-grid2"><section><div className="v3-panel"><h2>{mode==='monitor'?'Obserwuj zmiany modelowanej ceny kategorii':'Punkt odniesienia dla oferty dostawcy'}</h2><p>Punktem odniesienia jest Twoja własna cena zakupu.</p><div className="v3-price">{fmt(last?.price??null)} {result.currency}/{result.unit}</div><p>{last?.date.slice(0,10)} · {fmt(last?.changePercent??null)}% względem ostatniego zakupu</p>
          <BusinessPriceChart result={result} components={c.components} name={c.name}/></div>
          <div className="v3-panel"><h3>Które komponenty odpowiadają za zmianę?</h3>{c.components.map((component,i)=><div className="v3-component-line" key={component.id}><span>{component.name}<small>{component.weightPercent}%</small></span><b>{fmt(last?.components[i]?.contribution??null)} {result.currency}/{result.unit}</b></div>)}</div></section>
          <aside className="v3-panel"><h3>{mode==='monitor'?'Zachowaj strukturę kategorii':'Porównanie i zapis oferty'}</h3>
            {mode==='monitor'?<><p>Strukturę możesz zapisać w istniejącym Category Builderze. Zapis nie uruchamia obserwowania ceny.</p><button onClick={c.onSaveCategory} disabled={c.categorySaveStatus==='saving'||c.categorySaveStatus==='saved'||c.categorySaveStatus==='error'}>{c.categorySaveStatus==='saving'?'Zapisywanie…':c.categorySaveStatus==='saved'?'Zapisano strukturę kategorii':'Zapisz strukturę kategorii'}</button><p role="status">{c.categorySaveStatus==='saved'?'Kategoria została zapisana w bieżącej organizacji.':null}</p><p>Stałe obserwowanie i alerty nie są jeszcze dostępne. Zapis struktury nie uruchamia obserwowania.</p><button disabled>Dodaj kategorię do obserwowanych</button></>
            :<><p>Modelowana historia ceny jest dostępna. Porównanie warunków i zapis oferty nie są jeszcze dostępne.</p><button className="v3-primary" disabled>Porównaj cenę dostawcy</button><button disabled>Gotowe, zapisz ofertę</button></>}
            <details><summary>Metoda i ograniczenia</summary><p>Price Change Index pokazuje modelowaną cenę zakupu. Nie dowodzi, że cena historyczna lub marża dostawcy były optymalne.</p><p>Benchmarki pozostają w walutach źródłowych. Wynik nie obejmuje historycznych zmian FX ani potwierdzonego stanu publikacji na dzień zakupu.</p><p>Metoda: {result.methodologyId}; kadencja: {result.cadence}.</p></details>
          </aside></div>
      </>}
    </main>
    <footer className="v3-flow-actions">
      {c.error&&<p className="pci-error" role="alert" tabIndex={-1}>{c.error}</p>}
      <div className="v3-result-navigation"><button className="v3-result-back" disabled={c.busy} onClick={()=>c.step===1?c.onClose():c.onStep(c.step==='result'?3:(c.step-1) as 1|2)}>Wróć</button>
        <div className="v3-result-primary-actions">{c.step==='result'?<button className="v3-primary" onClick={c.onClose}>Gotowe, wróć do Benchmark Findera</button>:<button className="v3-primary" disabled={c.busy||!c.ready||c.step>=2&&!purchaseReady||c.step===3&&!dateReady} onClick={()=>c.step===3?c.onAnalyse():c.onStep(c.step===1?2:3)}>{c.busy?'Obliczanie…':c.step===3?'Przeanalizuj cenę':'Dalej →'}</button>}</div>
      </div>
    </footer>
  </div>
}

/** Native mount using the same public package; no iframe, router, SDK or demo data. */
export function BusinessPriceChangeIndex(props:PriceChangeIndexBusinessProps){
  const mount=useRef<HTMLDivElement>(null),[scope,setScope]=useState<PresentationScope|null>(null)
  useLayoutEffect(()=>{const host=mount.current!,shadow=host.shadowRoot??host.attachShadow({mode:'open'}),surface=document.createElement('div');surface.className='pci-surface';shadow.append(surface);const value=createPresentationScope(shadow,surface);setScope(value);return()=>value.dispose()},[])
  return <div ref={mount} className={props.className} data-price-change-index="pci3" data-pci-mode="business" style={{height:'100%',minHeight:0,width:'100%'}}>{scope&&createPortal(<PresentationScopeProvider value={scope}><ThemeProvider initialTheme={props.theme} onChange={props.onThemeChange}><style>{styles}</style><ProductView {...props}/></ThemeProvider></PresentationScopeProvider>,scope.surface)}</div>
}
