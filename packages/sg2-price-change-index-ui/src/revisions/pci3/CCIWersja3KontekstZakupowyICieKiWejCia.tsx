import {useContent} from '../../PresentationScope';
import { CanonThemeSwitch } from './CanonTheme';








import React, { useState } from 'react';
import type {Analysis,Component,Offer,Purchase,Scenario} from '../../data-contracts/pci3';
import {createStackedPriceHistoryChart} from './StackedPriceHistoryChart';
export function createCCIWersja3KontekstZakupowyICieKiWejCia(data:typeof import('../../data-contracts/pci3')){
const {categories,sourceComponents,cloneComponents,seedAnalysis,defaultOffer,defaultPurchase,observation,cci,indexedPrice,contribution,compare,fmt,sign,dates,fromDates,isStructureReady,DEMO_LAST_AVAILABLE_MONTH}=data;
const {StackedPriceHistoryChart}=createStackedPriceHistoryChart(data);


type Screen = 'home' | 'setup' | 'result' | 'saved';
type Origin = 'direct' | 'benchmark' | 'srm';
type Mode = 'monitor' | 'compare';
const suppliers = data.suppliers;
const money = (n: number | null | undefined, unit = 'PLN/mb') => n == null ? 'Brak danych' : fmt(n) + ' ' + unit;
const Node = ({
  children
}: {
  children: React.ReactNode;
}) => <div className="v3-panel" data-canon-visual-reference="SRM-C13">{children}</div>;
const CCIWersja3KontekstZakupowyICieKiWejCia = () => {
  const content=useContent();
  const [screen, setScreen] = useState<Screen>('home'),
    [origin, setOrigin] = useState<Origin>('direct'),
    [step, setStep] = useState(1),
    [mode, setMode] = useState<Mode>('monitor');
  const [draft, setDraft] = useState<Analysis>(() => seedAnalysis()),
    [analysis, setAnalysis] = useState<Analysis>(() => seedAnalysis());
  const [intent, setIntent] = useState<Mode>('monitor'),
    [offer, setOffer] = useState<Offer>(() => ({
      ...defaultOffer(),
      price: '',
      termsConfirmed: false
    })),
    [compared, setCompared] = useState(false);
  const [linkedSupplier, setLinkedSupplier] = useState(''),
    [supplierChoice, setSupplierChoice] = useState(suppliers[0]),
    [selectedMonth, setSelectedMonth] = useState(DEMO_LAST_AVAILABLE_MONTH);
  const [saved, setSaved] = useState<Analysis[]>([seedAnalysis()]),
    [records, setRecords] = useState<{
      name: string;
      offer: number;
      reference: number;
      period: string;
    }[]>([]);
  const [scenario, setScenario] = useState<Scenario>('complete'),
    [focusComponent, setFocusComponent] = useState<Component | null>(null);
  const [added, setAdded] = useState(false);
  const start = (kind: Origin = 'direct') => {
    const a = data.entryAnalysis(kind);
    setDraft(a);
    setAnalysis(a);
    setStep(1);
    setOrigin(kind);
    setIntent(kind === 'srm' ? 'compare' : 'monitor');
    setMode('monitor');
    setLinkedSupplier(kind === 'srm' ? suppliers[0] : '');
    setSupplierChoice(suppliers[0]);
    setAdded(false);
    setOffer({
      ...defaultOffer(),
      price: '',
      supplier: kind === 'srm' ? suppliers[0] : '',
      termsConfirmed: false
    });
    setScreen('setup');
  };
  const setPurchase = (patch: Partial<Purchase>) => setDraft(p => ({
    ...p,
    purchase: {
      ...p.purchase,
      ...patch
    }
  }));
  const setOfferPatch = (patch: Partial<Offer>) => {
    setOffer(o => ({
      ...o,
      ...patch
    }));
    setCompared(false);
  };
  const ready = isStructureReady(draft.components);
  const anchor = cci(draft, draft.purchase.month, scenario);
  const ref = indexedPrice(analysis, mode === 'compare' ? offer.month : selectedMonth, scenario);
  const result = compare(analysis, offer, scenario);
  const submitSetup = () => {
    setAnalysis({
      ...draft,
      components: cloneComponents(draft.components),
      purchase: {
        ...draft.purchase
      }
    });
    setMode(intent);
    setCompared(false);
    setSelectedMonth(DEMO_LAST_AVAILABLE_MONTH);
    setScreen('result');
  };
  const addOther = () => {
    setDraft(p => ({
      ...p,
      name: seedAnalysis().name,
      components: cloneComponents(sourceComponents)
    }));
    setAdded(true);
  };
  const addOne = () => {
    const next = sourceComponents.find(c => !draft.components.some(d => d.id === c.id));
    if (next) setDraft(p => ({
      ...p,
      components: [...p.components, {
        ...next,
        weight: 0
      }]
    }));
  };
  const save = () => {
    setSaved(p => [...p, {
      ...analysis,
      id: analysis.id + '-' + (p.length + 1),
      version: analysis.version + 1
    }]);
  };
  const linkSupplier = () => {
    setLinkedSupplier(supplierChoice);
    setOfferPatch({
      supplier: supplierChoice,
      termsConfirmed: false
    });
  };
  const header = <header className="v3-header"><div><div className="v3-crumb">SpendGuru / Cost Analysis / CCI <b>v3</b></div><h1>{screen === 'home' ? (content.homeTitle??'Czy cena dostawcy jest zgodna ze zmianami rynku?') : screen === 'setup' ? 'Nowa analiza ceny' : screen === 'saved' ? 'Moje analizy i porównania' : analysis.name}</h1><p>{screen === 'home' ? (content.homeDescription??'Trzy pytania prowadzą do rynkowej ceny referencyjnej i porównania oferty.') : screen === 'setup' ? 'Struktura produktu · Ostatnia cena · Data zakupu' : screen === 'result' ? 'Punktem odniesienia jest Twoja własna cena zakupu.' : 'Ponownie wykorzystuj zapisany kontekst bez budowania kategorii od początku.'}</p></div><nav><button onClick={() => setScreen('home')}>Punkt wejścia</button><button onClick={() => setScreen('saved')}>Moje analizy</button><CanonThemeSwitch /></nav></header>;
  return <div className="v3-app srm-ui" data-canon-reference="460628347660177408:463214697194356736" data-canon-scope="visual-only">{header}
 <nav className="v3-demo-nav"><strong>Przetestuj ścieżkę</strong><button onClick={() => start('direct')}>Bezpośrednio</button><button onClick={() => start('benchmark')}>Z Benchmark Finder</button><button onClick={() => start('srm')}>Z SRM</button><button onClick={() => setScreen('result')}>Wynik analizy</button><select data-canon-visual-reference="SRM-C07" value={scenario} onChange={e => setScenario(e.target.value as Scenario)}><option value="complete">Dane kompletne</option><option value="missing">Luka w danych</option><option value="no-anchor">Brak bazy</option><option value="stale">Opóźniona publikacja</option><option value="fx-missing">Brak FX</option></select></nav>
 {screen === 'home' && <><div className="v3-intro"><h2>Powiedz nam: z czego składa się produkt, ile ostatnio zapłaciłeś i kiedy?</h2><p>SpendGuru pokazuje cenę indeksowaną zmianami rynku. Jeśli masz nową ofertę, od razu porównasz ją z ceną referencyjną. Nie musisz znać matematyki CCI.</p><button data-library-component="SRM-C01" data-canon-usage="cci-v3-primary-action" className="v3-primary" onClick={() => start('direct')}>Rozpocznij analizę</button></div>
 <div className="v3-grid3">
 <Node><small>01 · COST ANALYSIS</small><h3>Zacznij od trzech pytań</h3><p>Wybierz lub zbuduj Cost Breakdown, wpisz ostatnią cenę i datę zakupu.</p><button onClick={() => start('direct')}>Nowa analiza →</button></Node>
 <Node><small>02 · BENCHMARK FINDER</small><h3>Copper → kandydat → prognoza → kategoria</h3><p>Po kliknięciu „Buduj kategorię w oparciu o ten benchmark” wybrany Copper będzie pierwszym komponentem.</p><div className="v3-chip">Macrobond / Copper / DEMO-COPPER</div><button data-library-component="SRM-C01" data-canon-usage="cci-v3-primary-action" className="v3-primary" onClick={() => start('benchmark')}>Przejdź z benchmarkiem →</button></Node>
 <Node><small>03 · SRM</small><h3>Dostawca → powiązana kategoria → oferta</h3><p>Po analizie dostawcy w SRM kupiec przechodzi z kontekstem dostawcy i kategorii do CCI.</p><div className="v3-chip">MetalCable Polska ↔ Kabel miedziany</div><button data-library-component="SRM-C01" data-canon-usage="cci-v3-primary-action" className="v3-primary" onClick={() => start('srm')}>Zweryfikuj cenę dostawcy →</button></Node>
 </div><p className="v3-note">Kontekstowe wejścia z Benchmark Finder i SRM są symulacjami UX. Nie modyfikują tych dwóch aplikacji.</p></>}
 {screen === 'setup' && <>
 {origin !== 'direct' && <div className="v3-context"><b>{origin === 'benchmark' ? 'Benchmark Finder → CCI' : 'SRM → CCI'}</b><span>{origin === 'benchmark' ? 'Copper został już wstawiony do Cost Breakdown. Uzupełnij resztę kosztów.' : 'MetalCable Polska i powiązana kategoria zostały wstępnie wybrane. Po trzech pytaniach trafisz do weryfikacji oferty.'}</span></div>}
 <div className="v3-steps" data-canon-visual-reference="SRM-C08">{['01 · Z czego składa się produkt?', '02 · Ile ostatnio zapłaciłeś?', '03 · Kiedy kupowałeś?'].map((t, i) => <button key={t} className={step === i + 1 ? 'v3-active' : ''} onClick={() => setStep(i + 1)}>{t}</button>)}</div>
 <div className="v3-grid2"><Node>
 {step === 1 && <><h2>Jakie komponenty i benchmarki tworzą koszt Twojej kategorii?</h2><p>Wybierz gotową kategorię lub uzupełnij strukturę. Benchmark przekazany z wyszukiwarki zostaje zachowany.</p>
 <div className="v3-actions"><button onClick={() => {
                const c = categories[0];
                setDraft(p => ({
                  ...p,
                  categoryId: c.id,
                  name: c.name,
                  components: cloneComponents(c.components)
                }));
              }}>Użyj gotowej kategorii kabla</button><button onClick={() => {
                setDraft(p => ({
                  ...p,
                  categoryId: 'custom',
                  name: 'Nowa kategoria',
                  components: origin === 'benchmark' ? [{
                    ...sourceComponents[0],
                    weight: 60
                  }] : []
                }));
              }}>Utwórz własną strukturę</button></div>
 {origin === 'benchmark' && <div className="v3-good">✓ Copper price series został przeniesiony jako pierwszy komponent. Waga 60% jest tylko przykładowa.</div>}
 <label>Nazwa produktu / kategorii<input data-canon-visual-reference="SRM-C06" value={draft.name} onChange={e => setDraft(p => ({
                ...p,
                name: e.target.value
              }))} /></label>
 <div className="v3-table-wrap"><table><thead><tr><th>Komponent</th><th>Udział %</th><th>Wybrany benchmark</th><th></th></tr></thead><tbody>{draft.components.map(c => <tr key={c.id}><td><input data-canon-visual-reference="SRM-C06" value={c.name} onChange={e => setDraft(p => ({
                        ...p,
                        components: p.components.map(x => x.id === c.id ? {
                          ...x,
                          name: e.target.value
                        } : x)
                      }))} /></td><td><input data-canon-visual-reference="SRM-C06" type="number" min="0" max="100" value={c.weight} onChange={e => setDraft(p => ({
                        ...p,
                        components: p.components.map(x => x.id === c.id ? {
                          ...x,
                          weight: Number(e.target.value)
                        } : x)
                      }))} /></td><td><select data-canon-visual-reference="SRM-C07" value={c.seriesId} onChange={e => setDraft(p => ({
                        ...p,
                        components: p.components.map(x => {
                          if (x.id !== c.id) return x;
                          const found = sourceComponents.find(z => z.seriesId === e.target.value);
                          return found ? {
                            ...x,
                            seriesId: found.seriesId,
                            benchmark: found.benchmark,
                            values: [...found.values],
                            currency: found.currency,
                            unit: found.unit,
                            frequency: found.frequency
                          } : {
                            ...x,
                            seriesId: '',
                            benchmark: 'Nie przypisano'
                          };
                        })
                      }))}>{sourceComponents.map(s => <option key={s.id} value={s.seriesId}>{s.benchmark}</option>)}</select></td><td><button aria-label={'Usuń ' + c.name} onClick={() => setDraft(p => ({
                        ...p,
                        components: p.components.filter(x => x.id !== c.id)
                      }))}>×</button></td></tr>)}</tbody></table></div>
 <p>Łącznie: <b>{draft.components.reduce((s, c) => s + c.weight, 0)}%</b> · {ready ? 'Kategoria gotowa' : 'Uzupełnij do 100% i przypisz benchmarki'}</p><div className="v3-actions"><button onClick={addOne}>+ Dodaj komponent</button><button onClick={addOther}>Dodaj przykładową resztę struktury</button></div>
 </>}
 {step === 2 && <><h2>Ile ostatnio zapłaciłeś?</h2><p>Własna cena zakupu będzie podstawą analizy. Jej wpisanie nie potwierdza, że pierwotnie była optymalna.</p>
 <label>Cena ostatniego zakupu<input data-canon-visual-reference="SRM-C06" type="number" min="0.01" value={draft.purchase.price} onChange={e => setPurchase({
                price: e.target.value
              })} /></label>
 <div className="v3-inline"><label>Waluta<select data-canon-visual-reference="SRM-C07" value={draft.purchase.currency} onChange={e => setPurchase({
                  currency: e.target.value as Purchase['currency']
                })}><option>PLN</option><option>EUR</option><option>USD</option></select></label><label>Jednostka<select data-canon-visual-reference="SRM-C07" value={draft.purchase.unit} onChange={e => setPurchase({
                  unit: e.target.value as Purchase['unit']
                })}><option>mb</option><option>km</option><option>szt.</option></select></label></div>
 <div className="v3-inline"><label>Podstawa<select data-canon-visual-reference="SRM-C07" value={draft.purchase.tax} onChange={e => setPurchase({
                  tax: e.target.value as Purchase['tax']
                })}><option>netto</option><option>brutto</option></select></label><label>Dostawa<select data-canon-visual-reference="SRM-C07" value={draft.purchase.delivery} onChange={e => setPurchase({
                  delivery: e.target.value as Purchase['delivery']
                })}><option>z dostawą</option><option>bez dostawy</option></select></label></div>
 <label>Dodatkowe warunki i specyfikacja<input data-canon-visual-reference="SRM-C06" value={draft.purchase.terms} onChange={e => setPurchase({
                terms: e.target.value
              })} /></label></>}
 {step === 3 && <><h2>Kiedy kupowałeś?</h2><p>Wskazanie daty zakupu wyznacza punkt odniesienia dla Twojej ceny.</p><label>Rzeczywisty miesiąc zakupu<select data-canon-visual-reference="SRM-C07" value={draft.purchase.month} onChange={e => setPurchase({
                month: Number(e.target.value)
              })}>{dates.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
 <div className="v3-good">Wynik wymaga wspólnych, porównywalnych węzłów obserwacji. Nie wymuszamy miesięcznych notowań z benchmarków rocznych ani kwartalnych.</div>
 <p>{anchor == null ? 'Brak pełnych danych w miesiącu zakupu. Wybierz rzeczywistą datę z kompletnymi obserwacjami.' : 'Wszystkie komponenty mają demonstracyjne dane dla wybranego miesiąca.'}</p>
 <h3>Co chcesz zrobić dalej?</h3><div className="v3-actions"><button className={intent === 'monitor' ? 'v3-active' : ''} onClick={() => setIntent('monitor')}>Monitoruj cenę</button><button className={intent === 'compare' ? 'v3-active' : ''} onClick={() => setIntent('compare')}>Mam nową ofertę</button></div>
 <p className="v3-note">W scenariuszu SRM wybrano weryfikację oferty — możesz zmienić ten wybór.</p></>}
 <div className="v3-actions"><button onClick={() => step === 1 ? setScreen('home') : setStep(step - 1)}>Wróć</button><button data-library-component="SRM-C01" data-canon-usage="cci-v3-primary-action" className="v3-primary" disabled={step === 1 && !ready || step === 2 && !(Number(draft.purchase.price) > 0) || step === 3 && anchor == null} onClick={() => step < 3 ? setStep(step + 1) : submitSetup()}>{step === 3 ? 'Wyznacz cenę i przejdź dalej' : 'Dalej →'}</button></div>
 </Node><Node><h3>Twoja analiza</h3><p><b>{draft.name}</b></p><p>{draft.components.length} komponentów · {fmt(draft.components.reduce((s, c) => s + c.weight, 0), 0)}% wag</p><p>Ostatnia cena: {money(Number(draft.purchase.price), draft.purchase.currency + '/' + draft.purchase.unit)}</p><p>Zakup: {dates[draft.purchase.month]}</p><p>Źródło: {origin === 'benchmark' ? 'Benchmark Finder' : origin === 'srm' ? 'SRM' : 'Cost Analysis'}</p><p>Dostawca: {linkedSupplier || 'Niepowiązany'}</p><div className="v3-note">Wybrane benchmarki zachowują swoje oryginalne częstotliwości. Ta makieta pokazuje rozbudowaną syntetyczną historię miesięczną — przed i po zakupie. W rzeczywistych danych zachowujemy natywne kadencje.</div></Node></div>
 </>}
 {screen === 'result' && <>
 <div className="v3-context"><b>{origin === 'benchmark' ? 'Kategoria z wybranego Copper' : origin === 'srm' ? 'Kategoria i dostawca z SRM' : 'Cost Analysis'}</b><span>Ostatni zakup: {money(Number(analysis.purchase.price), analysis.purchase.currency + '/' + analysis.purchase.unit)} · {dates[analysis.purchase.month]} · {analysis.purchase.tax} · {analysis.purchase.delivery}</span></div>
 <div className="v3-steps" data-canon-visual-reference="SRM-C08"><button className={mode === 'monitor' ? 'v3-active' : ''} onClick={() => setMode('monitor')}>Monitoruj cenę</button><button className={mode === 'compare' ? 'v3-active' : ''} onClick={() => setMode('compare')}>Sprawdź ofertę dostawcy</button></div>
 <div className="v3-grid2"><div><Node><small>CENA REFERENCYJNA WEDŁUG MODELU RYNKU · {dates[mode === 'compare' ? offer.month : selectedMonth]}</small><h2 className="v3-price">{money(ref, analysis.purchase.currency + '/' + analysis.purchase.unit)}</h2><p>Twoja cena historyczna skorygowana o zmiany modelowanych kosztów rynku: <b>{ref == null ? '—' : sign((ref / Number(analysis.purchase.price) - 1) * 100) + '%'}</b></p>
 {mode === 'monitor' && <label>Wybierz punkt analizy<select data-canon-visual-reference="SRM-C07" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>{dates.map((d, i) => <option key={i} value={i} disabled={i < analysis.purchase.month}>{d}</option>)}</select></label>}
 {ref == null && <div className="v3-warning">Nie ma kompletnych obserwacji dla wybranego punktu. Nie wyliczamy ceny pozornej.</div>}</Node>
 {mode === 'compare' && <Node><h3>Co oznacza różnica względem oferty?</h3>{compared && result.valid ? <><h2 className="v3-price">{money(result.gap, analysis.purchase.currency + '/' + analysis.purchase.unit)}</h2><p>{sign(result.gapPct)}% względem ceny referencyjnej.</p><p>Wzrost proponowany przez dostawcę: <b>{sign(result.supplierChange)}%</b></p><p>Zmiana modelowanych kosztów: <b>{sign(result.marketChange)}%</b></p><div className="v3-good">To różnica do wyjaśnienia w negocjacjach, nie automatyczny werdykt o uczciwości dostawcy.</div><button data-library-component="SRM-C01" data-canon-usage="cci-v3-primary-action" className="v3-primary" onClick={() => {
                setRecords(p => [...p, {
                  name: offer.supplier || 'Dostawca',
                  offer: result.normalized!,
                  reference: result.ref!,
                  period: dates[offer.month]
                }]);
                save();
              }}>Zapisz porównanie</button></> : <p>Uzupełnij ofertę po prawej i uruchom porównanie.</p>}</Node>}
 <Node><h3>Jak zmieniała się cena i jej składniki?</h3><p>Kolorowe warstwy przedstawiają wartości pieniężne komponentów. Ich suma tworzy górną linię modelowanej ceny kategorii, także przed datą ostatniego zakupu.</p>
 <StackedPriceHistoryChart analysis={analysis} scenario={scenario} month={mode === 'compare' ? offer.month : selectedMonth} offer={mode === 'compare' && compared && result.valid ? offer : undefined} onMonth={mode === 'monitor' ? setSelectedMonth : undefined} />
 <p className="v3-note">Historia obejmuje obserwacje przed i po zakupie. Warstwy sumują się do ceny kategorii w każdym kompletnym węźle. W rzeczywistych danych nie wypełniamy luk ani nie zwiększamy sztucznie kadencji.</p></Node>
 <Node><h3>Które komponenty odpowiadają za zmianę?</h3>{analysis.components.map(c => {
              const x = contribution(analysis, c, mode === 'compare' ? offer.month : selectedMonth, scenario);
              return <button className="v3-component-line" key={c.id} onClick={() => setFocusComponent(c)}><span>{c.name} <small>{c.weight}%</small></span><b>{money(x.cash, analysis.purchase.currency + '/' + analysis.purchase.unit)}</b></button>;
            })}<p className="v3-note">Kliknij składnik, aby zobaczyć serię źródłową i jej semantykę.</p></Node></div>
 <div>{mode === 'compare' && <Node><h3>Nowa oferta dostawcy</h3><p>Porównanie wymaga zgodnej jednostki, waluty oraz istotnych warunków handlowych.</p>
 <label>Oferowana cena<input data-canon-visual-reference="SRM-C06" type="number" value={offer.price} onChange={e => setOfferPatch({
                price: e.target.value
              })} /></label>
 <div className="v3-inline"><label>Waluta<select data-canon-visual-reference="SRM-C07" value={offer.currency} onChange={e => setOfferPatch({
                  currency: e.target.value as Offer['currency'],
                  converted: false
                })}><option>PLN</option><option>EUR</option><option>USD</option></select></label><label>Jednostka<select data-canon-visual-reference="SRM-C07" value={offer.unit} onChange={e => setOfferPatch({
                  unit: e.target.value as Offer['unit'],
                  converted: false
                })}><option>mb</option><option>km</option><option>szt.</option></select></label></div>
 <label>Miesiąc oferty<select data-canon-visual-reference="SRM-C07" value={offer.month} onChange={e => setOfferPatch({
                month: Number(e.target.value),
                converted: false
              })}>{dates.map((d, i) => <option key={d} value={i} disabled={i < analysis.purchase.month}>{d}</option>)}</select></label>
 <div className="v3-inline"><label>Netto/brutto<select data-canon-visual-reference="SRM-C07" value={offer.tax} onChange={e => setOfferPatch({
                  tax: e.target.value as Offer['tax']
                })}><option>netto</option><option>brutto</option></select></label><label>Warunki dostawy<select data-canon-visual-reference="SRM-C07" value={offer.delivery} onChange={e => setOfferPatch({
                  delivery: e.target.value as Offer['delivery']
                })}><option>z dostawą</option><option>bez dostawy</option></select></label></div>
 <label>Dostawca<input data-canon-visual-reference="SRM-C06" value={offer.supplier} onChange={e => setOfferPatch({
                supplier: e.target.value
              })} /></label>
 {result.needsConversion && <div className="v3-warning">Dla różnych walut lub jednostek wymagane jest jawne przeliczenie; używamy tylko demonstracyjnych FX.<button onClick={() => setOfferPatch({
                converted: true
              })}>Zastosuj przeliczenie</button></div>}
 {!result.taxMatch || !result.deliveryMatch ? <div className="v3-warning">Różne warunki oferty — porównanie zablokowane do ujednolicenia.</div> : null}
 <label className="v3-confirm"><input type="checkbox" checked={offer.termsConfirmed} onChange={e => setOfferPatch({
                termsConfirmed: e.target.checked
              })} /> Potwierdzam zgodność specyfikacji, wolumenu, jednostki, dostawy i istotnych warunków.</label>
 <button data-library-component="SRM-C01" data-canon-usage="cci-v3-primary-action" className="v3-primary" disabled={!result.valid} onClick={() => setCompared(true)}>Porównaj cenę dostawcy</button></Node>}
 <Node><h3>Kategoria ↔ dostawca w SRM</h3><p>Po stworzeniu Cost Breakdown można powiązać dostawcę, a następnie przechodzić między jego oceną finansową i analizą ceny.</p><div className="v3-chip">{analysis.name} ↔ {linkedSupplier || 'brak powiązania'}</div>
 <label>Wybierz dostawcę SRM<select data-canon-visual-reference="SRM-C07" value={supplierChoice} onChange={e => setSupplierChoice(e.target.value)}>{suppliers.map(x => <option key={x}>{x}</option>)}</select></label><button data-library-component="SRM-C01" data-canon-usage="cci-v3-primary-action" className="v3-primary" onClick={linkSupplier}>Powiąż dostawcę z kategorią</button><p className="v3-note">Powiązanie jest symulowane. Nie zapisujemy go w rzeczywistym SRM.</p></Node>
 <Node><h3>Metodologia i ograniczenia</h3><p>CCI to model zmian względnych względem ceny historycznej. Nie dowodzi, że historyczna cena była optymalna.</p><p>W tej makiecie benchmarki są w walutach źródłowych; wynik w PLN nie obejmuje automatycznie wpływu historycznych zmian FX.</p><p>Roczne i kwartalne serie nie mogą być sztucznie rozciągane na każdy miesiąc. Analiza wymaga prawdziwych wspólnych węzłów.</p><button onClick={() => setScreen('saved')}>Przejdź do zapisanych analiz →</button></Node></div></div>
 </>}
 {screen === 'saved' && <div className="v3-grid2"><Node><h2>Moje modele i ostatnie ceny zakupu</h2>{saved.map((a, i) => <button className="v3-component-line" key={i} onClick={() => {
          setAnalysis(a);
          setDraft(a);
          setMode('monitor');
          setScreen('result');
        }}><span>{a.name}</span><b>{money(Number(a.purchase.price), a.purchase.currency + '/' + a.purchase.unit)}</b></button>)}<button data-library-component="SRM-C01" data-canon-usage="cci-v3-primary-action" className="v3-primary" onClick={() => start('direct')}>Nowa analiza</button></Node><Node><h2>Historia porównań ofert</h2>{records.length ? records.map((a, i) => <p key={i}>{a.name} · {a.period} · oferta {fmt(a.offer)} · referencja {fmt(a.reference)} · różnica {fmt(a.offer - a.reference)}</p>) : <p>Nie zapisano jeszcze porównań. Możesz wrócić do analizy i sprawdzić ofertę.</p>}</Node></div>}
 {focusComponent && <div className="v3-modal-backdrop" onClick={() => setFocusComponent(null)}><aside className="v3-modal" onClick={e => e.stopPropagation()}><button data-canon-visual-reference="SRM-C60" aria-label="Zamknij" title="Zamknij" onClick={() => setFocusComponent(null)}>Zamknij ×</button><h2>{focusComponent.name}</h2><p>Benchmark: {focusComponent.benchmark}</p><p>Udział: {focusComponent.weight}% · źródło: {focusComponent.seriesId}</p><p>Jednostka / waluta: {focusComponent.unit} / {focusComponent.currency}</p><p>Kadencja: {focusComponent.frequency}</p><p>Przygotowanie: {focusComponent.aggregation}</p><p>Wartość bazowa w chwili zakupu: {fmt(observation(focusComponent, analysis.purchase.month, scenario))}</p><p>Wartość w analizowanym okresie: {fmt(observation(focusComponent, mode === 'compare' ? offer.month : selectedMonth, scenario))}</p><p className="v3-note">Dane fikcyjne, nie pobrano Macrobond.</p></aside></div>}
 <footer className="v3-footer">CCI v3 · osobny komponent MagicPath · dane i scenariusze demonstracyjne · Benchmark Finder i SRM bez zmian</footer>
 </div>;
};
return {CCIWersja3KontekstZakupowyICieKiWejCia};
}
