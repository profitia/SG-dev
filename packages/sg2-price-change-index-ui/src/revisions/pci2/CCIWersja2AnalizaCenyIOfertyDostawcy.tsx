import {usePresentationScope,usePresentationMedia} from '../../PresentationScope';
import React, { useEffect, useRef, useState } from 'react';
import { CanonButton, CanonInput, CanonSelect, CanonTextarea } from './CanonElements';
import { CanonHeader } from './CanonHeader';
import { CanonSideMenu } from './CanonSideMenu';
import { CanonHistoryDialog } from './CanonHistoryDialog';
import { spacingCSS } from './spacing-contract';
import { canonTokens, tokenVariables } from './canon-tokens';
import { fontRoles } from './library-names';
import { Icon } from './cci-icons';
import {createPriceHistoryChart} from './PriceHistoryChart';
import type {Analysis,Purchase,Offer,Component,Comparison,Scenario,Currency,Unit} from '../../data-contracts/pci2';
export function createCCIWersja2AnalizaCenyIOfertyDostawcy(data:typeof import('../../data-contracts/pci2')){
const {categories,sourceComponents,cloneComponents,defaultPurchase,defaultOffer,seedAnalysis,snapshot,isStructureReady,observation,cci,indexedPrice,contribution,compare,fmt,sign,dates,fromDates,scenarios,canonAuthority}=data;
const {PriceHistoryChart}=createPriceHistoryChart(data);






type Screen = 'home' | 'setup' | 'result' | 'saved';
function Action({
  kind = 'secondary',
  icon,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: 'primary' | 'secondary' | 'link';
  icon?: string;
}) {
  return <CanonButton canonId={kind === 'primary' ? 'SRM-C01' : kind === 'link' ? 'SRM-C03' : 'SRM-C02'} usage={'CA2:' + String(props['aria-label'] ?? icon ?? 'action')} {...props} className={(kind === 'link' ? 'srm-text-link ' : '') + (props.className ?? '')}>{icon && <Icon name={icon} size={16} />} {children}</CanonButton>;
}
function Notice({
  title,
  children,
  tone = 'info',
  action
}: {
  title: string;
  children?: React.ReactNode;
  tone?: 'info' | 'warning' | 'danger';
  action?: React.ReactNode;
}) {
  return <div className={'ca-notice ' + tone} role={tone === 'danger' ? 'alert' : 'status'}><Icon name={tone === 'danger' ? 'lock' : tone === 'warning' ? 'warning' : 'info'} size={18} /><div><strong>{title}</strong>{children && <p>{children}</p>}{action && <div className="ca-notice-action">{action}</div>}</div></div>;
}
function Badge({
  ready = true,
  children
}: {
  ready?: boolean;
  children: React.ReactNode;
}) {
  return <span className={'ca-badge ' + (ready ? 'ready' : 'warning')}><Icon name={ready ? 'check' : 'warning'} size={12} />{children}</span>;
}
function Heading({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return <div className="ca-section-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</div>;
}
function CanonTypography() {
  const bindings: [string, string][] = [['.ca-section-head h2,.ca-root h3,.ca-summary-label,.ca-metric-label', 'SRM-T03'], ['.ca-money,.ca-result-value,.ca-driver-value', 'SRM-T04'], ['.ca-caption,.ca-section-head p,.ca-root small,.ca-description,.ca-source-meta,.ca-footer', 'SRM-T05'], ['.ca-table th,.ca-chart-readout-date,.ca-y-labels,.ca-x-labels', 'SRM-T10'], ['.ca-table td,.ca-table tfoot', 'SRM-T09'], ['.ca-fields :is(input,textarea),.ca-price-input', 'SRM-T15'], ['.ca-fields label>span,.ca-structure-fields label>span', 'SRM-T15']];
  return <style>{bindings.map(([selectors, id]) => {
      const r = fontRoles.find(f => f.id === id)!;
      return selectors.split(',').map(s => '.ca-root ' + s).join(',') + '{font-family:' + r.family + ';font-size:' + r.size / 16 + 'rem;font-weight:' + r.weight + ';line-height:' + r.lineHeight + ';}';
    }).join('\n')}</style>;
}
const CCIWersja2AnalizaCenyIOfertyDostawcy = () => {
  const presentation=usePresentationScope();
  const mobileScenarios=usePresentationMedia('(max-width:1050px)');
  const [screen, setScreen] = useState<Screen>('home'),
    [step, setStep] = useState(1),
    [scenario, setScenario] = useState<Scenario>('complete'),
    [mode, setMode] = useState<'monitor' | 'compare'>('monitor');
  const [analysis, setAnalysis] = useState<Analysis>(() => seedAnalysis()),
    [draft, setDraft] = useState<Analysis>(() => seedAnalysis()),
    [structureMode, setStructureMode] = useState<'existing' | 'build'>('existing'),
    [categoryId, setCategoryId] = useState('cable'),
    [selectedMonth, setSelectedMonth] = useState(4),
    [offer, setOffer] = useState<Offer>(() => defaultOffer()),
    [evaluated, setEvaluated] = useState(true),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Analysis[]>(() => [seedAnalysis()]),
    [history, setHistory] = useState<Comparison[]>(() => [{
      id: 'CMP-DEMO-001',
      analysis: seedAnalysis(),
      offer: defaultOffer(),
      reference: 1060,
      normalizedOffer: 1100,
      created: '14.06.2024 · przykład demonstracyjny'
    }]);
  const [panel, setPanel] = useState<'method' | 'assumptions' | 'history' | 'navigation' | null>(null),
    [component, setComponent] = useState<Component | null>(null),
    [toast, setToast] = useState(''),
    [viewSnapshot, setViewSnapshot] = useState(false);
  const main = useRef<HTMLElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const currentMonth = mode === 'compare' ? offer.month : selectedMonth;
  const reference = indexedPrice(analysis, currentMonth, scenario),
    anchor = cci(analysis, analysis.purchase.month, scenario),
    coverage = analysis.components.filter(c => observation(c, currentMonth, scenario) != null).length;
  const marketChange = reference == null ? null : (reference / Number(analysis.purchase.price) - 1) * 100;
  const comparison = compare(analysis, offer, scenario);
  const units = analysis.purchase.currency + '/' + analysis.purchase.unit;
  const savedDefinition = saved.some(a => a.id === analysis.id && a.version === analysis.version);
  const hasDraftAnchor = cci(draft, draft.purchase.month, scenario) != null;
  const totalWeight = draft.components.reduce((sum, c) => sum + c.weight, 0);
  const go = (s: Screen) => {
    setScreen(s);
    setPanel(null);
    setComponent(null);
    requestAnimationFrame(() => {
      main.current?.focus({
        preventScroll: true
      });
      presentation.onNavigate?.(s);
      presentation.surface.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' as ScrollBehavior
      });
    });
  };
  const start = () => {
    setDraft({
      ...seedAnalysis(),
      id: 'CA-DEMO-' + String(new Set(saved.map(a => a.id)).size + 1).padStart(3, '0')
    });
    setCategoryId('cable');
    setStructureMode('existing');
    setEditing(false);
    setScenario('complete');
    setStep(1);
    go('setup');
  };
  const demo = (target: 'monitor' | 'compare') => {
    setAnalysis(seedAnalysis());
    setDraft(seedAnalysis());
    setOffer(defaultOffer());
    setMode(target);
    setSelectedMonth(4);
    setEvaluated(true);
    setViewSnapshot(false);
    setScenario('complete');
    go('result');
  };
  const chooseCategory = (id: string) => {
    const c = categories.find(c => c.id === id)!;
    setCategoryId(id);
    setDraft(p => ({
      ...p,
      categoryId: id,
      name: c.name,
      components: cloneComponents(c.components)
    }));
  };
  const purchase = (patch: Partial<Purchase>) => setDraft(p => ({
    ...p,
    purchase: {
      ...p.purchase,
      ...patch
    }
  }));
  const updateComponent = (id: string, patch: Partial<Component>) => setDraft(p => ({
    ...p,
    components: p.components.map(c => c.id === id ? {
      ...c,
      ...patch
    } : c)
  }));
  const updateOffer = (patch: Partial<Offer>) => {
    setOffer(p => ({
      ...p,
      ...patch,
      converted: 'converted' in patch ? patch.converted! : 'price' in patch || 'currency' in patch || 'unit' in patch || 'month' in patch ? false : p.converted
    }));
    setEvaluated(false);
    setViewSnapshot(false);
  };
  const calculate = () => {
    if (!isStructureReady(draft.components) || !hasDraftAnchor || Number(draft.purchase.price) <= 0) return;
    setBusy(true);
    const next = snapshot(draft);
    timer.current = setTimeout(() => {
      setAnalysis(next);
      setMode('monitor');
      setSelectedMonth(scenario === 'stale' ? 4 : 4);
      setOffer({
        ...defaultOffer(),
        currency: next.purchase.currency,
        unit: next.purchase.unit,
        tax: next.purchase.tax,
        delivery: next.purchase.delivery,
        price: '',
        termsConfirmed: false
      });
      setEvaluated(false);
      setViewSnapshot(false);
      setBusy(false);
      go('result');
    }, 900);
  };
  const editAssumptions = () => {
    const version = Math.max(analysis.version, ...saved.filter(a => a.id === analysis.id).map(a => a.version)) + 1;
    setDraft({
      ...snapshot(analysis),
      version
    });
    setCategoryId(analysis.categoryId);
    setStructureMode(analysis.categoryId === 'custom' ? 'build' : 'existing');
    setEditing(true);
    setStep(1);
    go('setup');
  };
  const saveAnalysis = () => {
    if (!savedDefinition) setSaved(p => [...p, snapshot(analysis)]);
    setToast('Analiza i założenia v' + analysis.version + ' zapisane w bieżącej sesji makiety.');
  };
  const saveComparison = () => {
    if (!comparison.valid || !evaluated) return;
    const record: Comparison = {
      id: 'CMP-DEMO-' + String(history.length + 1).padStart(3, '0'),
      analysis: snapshot(analysis),
      offer: {
        ...offer
      },
      reference: comparison.ref!,
      normalizedOffer: comparison.normalized!,
      created: '20.10.2026 · sesja makiety'
    };
    setHistory(p => [record, ...p]);
    if (!savedDefinition) setSaved(p => [...p, snapshot(analysis)]);
    setToast('Zapisano porównanie z definicją v' + analysis.version + ' i wersją danych ' + analysis.dataRevision + '.');
  };
  const openComparison = (h: Comparison) => {
    setAnalysis(snapshot(h.analysis));
    setOffer({
      ...h.offer
    });
    setScenario('complete');
    setEvaluated(true);
    setMode('compare');
    setViewSnapshot(true);
    go('result');
  };
  const setScenarioView = (s: Scenario) => {
    setScenario(s);
    setAnalysis(seedAnalysis());
    setDraft(seedAnalysis());
    setOffer(defaultOffer());
    setEvaluated(true);
    setViewSnapshot(false);
    if (s === 'no-anchor') {
      setStep(3);
      go('setup');
      return;
    }
    setMode(s === 'stale' || s === 'missing' ? 'monitor' : 'compare');
    setSelectedMonth(s === 'missing' ? 2 : 4);
    if (s === 'unpublished') setOffer({
      ...defaultOffer(),
      month: 5
    });
    if (s === 'conditions') setOffer({
      ...defaultOffer(),
      price: '255000',
      currency: 'EUR',
      unit: 'km',
      tax: 'brutto',
      delivery: 'bez dostawy',
      termsConfirmed: false
    });
    if (s === 'fx-missing') setOffer({
      ...defaultOffer(),
      price: '255',
      currency: 'EUR'
    });
    go('result');
  };
  const titleQuestion = step === 1 ? 'Z czego składa się Twój produkt?' : step === 2 ? 'Ile ostatnio zapłaciłeś?' : 'Kiedy dokonano tego zakupu?';
  const structureTable = (cs: Component[], editable = false) => <div className="ca-table-scroll"><table className="ca-table ca-structure-table"><thead><tr><th>Komponent</th><th>Udział</th><th>Benchmark rynkowy</th>{editable && <th><span className="ca-sr">Usuń</span></th>}</tr></thead><tbody>{cs.map(c => <tr key={c.id}><td>{editable ? <CanonInput canonId="SRM-C06" usage="CA2:component-name" aria-label={'Nazwa komponentu ' + c.name} value={c.name} onChange={e => updateComponent(c.id, {
              name: e.target.value
            })} /> : <span><i className="ca-dot" style={{
                background: c.color
              }} />{c.name}</span>}</td><td>{editable ? <label className="ca-weight-input"><CanonInput canonId="SRM-C06" usage="CA2:component-weight" aria-label={'Udział ' + c.name} type="number" min="0" max="100" value={c.weight} onChange={e => updateComponent(c.id, {
                weight: Math.max(0, Number(e.target.value))
              })} /><span>%</span></label> : c.weight + '%'}</td><td>{editable ? <CanonSelect canonId="SRM-C07" usage="CA2:component-benchmark" aria-label={'Benchmark dla ' + c.name} value={c.seriesId} onChange={e => {
              const b = sourceComponents.find(b => b.seriesId === e.target.value);
              updateComponent(c.id, b ? {
                seriesId: b.seriesId,
                benchmark: b.benchmark,
                values: [...b.values],
                currency: b.currency,
                unit: b.unit,
                frequency: b.frequency,
                aggregation: b.aggregation
              } : {
                seriesId: '',
                benchmark: 'Nie przypisano'
              });
            }}><option value="">Wybierz benchmark</option>{sourceComponents.map(b => <option key={b.id} value={b.seriesId}>{b.benchmark}</option>)}</CanonSelect> : <><span>{c.benchmark}</span><small>Źródło demonstracyjne · {c.frequency.toLowerCase()}</small></>}</td>{editable && <td><CanonButton canonId="SRM-C04" usage="CA2:remove-component" className="ca-icon-button" aria-label={'Usuń komponent ' + c.name} onClick={() => setDraft(p => ({
              ...p,
              components: p.components.filter(x => x.id !== c.id)
            }))}><Icon name="close" size={14} /></CanonButton></td>}</tr>)}</tbody><tfoot><tr><th>Łącznie</th><td>{fmt(cs.reduce((s, c) => s + c.weight, 0), 0)}%</td><td>{isStructureReady(cs) ? <span className="ca-good"><Icon name="check" size={13} />Struktura gotowa</span> : <span className="ca-caution">Wymagane: 100% udziałów, min. 2 komponenty i przypisane benchmarki</span>}</td>{editable && <td />}</tr></tfoot></table></div>;
  return <div className="srm-ui ca-root" style={tokenVariables(canonTokens) as React.CSSProperties} data-canonical-source={canonAuthority.revisionId}>
 <style>{spacingCSS}</style><CanonTypography />
 <div className="ca-prototype"><span>CCI · WERSJA 2</span><nav aria-label="Widoki makiety wersji 2">{[['home', '01', 'Punkt wyjścia'], ['setup', '02', 'Trzy pytania'], ['monitor', '03', 'Monitorowanie ceny'], ['compare', '04', 'Weryfikacja oferty'], ['saved', '05', 'Zapisane analizy']].map(([target, n, label]) => <CanonButton canonId="SRM-C08" usage={'CA2:prototype-' + target} key={target} aria-pressed={target === screen || screen === 'result' && target === mode} onClick={() => {
          if (target === 'monitor' || target === 'compare') demo(target);else if (target === 'setup') start();else go(target as Screen);
        }}><small>{n}</small>{label}</CanonButton>)}</nav><label>Scenariusz{mobileScenarios ? <CanonSelect canonId="SRM-C07" usage="PCI:scenario-mobile" className="pci-scenario-compact" aria-label="Scenariusz biznesowy makiety" value={scenario} onChange={e => setScenarioView(e.target.value as Scenario)}>{scenarios.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</CanonSelect> : <select aria-label="Scenariusz biznesowy makiety" value={scenario} onChange={e => setScenarioView(e.target.value as Scenario)}>{scenarios.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</label></div>
 <CanonHeader title="Cost Analysis"><span className="ca-demo-mark"><i />Dane demonstracyjne</span><span className="ca-language">PL</span><span className="ca-avatar">AK</span></CanonHeader>
 <CanonSideMenu defaultActive="Cost Analysis" items={['Benchmark Finder', 'Category Builder', 'Cost Scan', 'Cost Analysis', 'Moje analizy', 'Should Cost Analysis · Później']} onNavigate={label => {
      if (label === 'Cost Analysis') go('home');else if (label === 'Moje analizy') go('saved');else setPanel('navigation');
    }}>
 <main className="ca-main" ref={main} tabIndex={-1}>
 <div className="ca-breadcrumb"><CanonButton canonId="SRM-C03" usage="CA2:breadcrumb" onClick={() => go('home')}>Cost Analysis</CanonButton>{screen !== 'home' && <><Icon name="chevron" size={12} /><span>{screen === 'setup' ? 'Nowa analiza ceny' : screen === 'saved' ? 'Moje analizy' : analysis.name}</span></>}</div>

 {screen === 'home' && <>
 <div className="ca-home-intro"><p className="ca-eyebrow">PUNKT ODNIESIENIA DO ROZMOWY Z DOSTAWCĄ</p><h1>Czy nowa cena Twojego dostawcy<br />wynika ze zmian na rynku?</h1><p>Opisz produkt, podaj ostatnią cenę i datę zakupu. SpendGuru wyznaczy cenę referencyjną na podstawie wybranych benchmarków rynkowych.</p><div className="ca-home-actions"><Action kind="primary" icon="plus" onClick={start}>Rozpocznij analizę ceny</Action><Action kind="link" icon="history" onClick={() => go('saved')}>Moje analizy</Action></div></div>
 <div className="ca-home-grid"><section className="ca-panel ca-three-questions"><Heading title="Na początek wystarczą trzy odpowiedzi" description="Istniejącą kategorię można wykorzystać bez ponownego wpisywania udziałów." />{[['01', 'Z czego składa się produkt?', 'Wybierz kategorię lub zbuduj strukturę kosztów z pomocą Category Buildera.', 'layers'], ['02', 'Ile ostatnio zapłaciłeś?', 'Cena zakupu, waluta i jednostka, np. 1 000 PLN/mb netto z dostawą.', 'file'], ['03', 'Kiedy dokonano zakupu?', 'Powiąż cenę z konkretnym miesiącem, np. majem 2024.', 'calendar']].map(([n, title, text, icon]) => <div className="ca-question" key={n}><span className="ca-question-number">{n}</span><div><h3>{title}</h3><p>{text}</p></div><Icon name={icon} size={20} /></div>)}<footer><Icon name="info" size={15} /><p>Pierwszym wynikiem będzie historia ceny indeksowanej. Nową ofertę możesz dodać później.</p></footer></section>
 <section className="ca-panel ca-example"><div className="ca-example-label"><span>PRZYKŁAD HISTORYCZNY</span><Badge>Wspólna waluta i jednostka</Badge></div><h2>Kabel miedziany 3 × 2,5 mm²</h2><p>Ostatni zakup: maj 2024 · 1 000 PLN/mb</p><div className="ca-example-reference"><span className="ca-metric-label">Cena referencyjna · czerwiec 2024</span><strong className="ca-money">1 060,00 <small>PLN/mb</small></strong><span>Zmiana według modelu: +6,00%</span></div><div className="ca-example-offer"><span>Oferta dostawcy</span><strong>1 100,00 PLN/mb</strong></div><div className="ca-example-gap"><span>Różnica do wyjaśnienia</span><strong className="ca-money">+40,00 <small>PLN/mb</small></strong><p>3,77% powyżej ceny referencyjnej</p></div><Action kind="link" icon="arrow" onClick={() => demo('compare')}>Zobacz przykład porównania</Action></section></div>
 <div className="ca-paths"><div><Icon name="chart" size={21} /><div><h3>Chcę monitorować cenę</h3><p>Zobacz, jak ostatnia cena zakupu zmieniałaby się wraz z rynkiem.</p></div><Action kind="link" onClick={() => demo('monitor')}>Zobacz przykład <Icon name="arrow" size={14} /></Action></div><div><Icon name="compare" size={21} /><div><h3>Mam nową ofertę</h3><p>Porównaj ją z ceną referencyjną z tego samego miesiąca.</p></div><Action kind="link" onClick={() => demo('compare')}>Zobacz przykład <Icon name="arrow" size={14} /></Action></div></div>
 </>}

 {screen === 'setup' && <>
 <div className="ca-page-head"><div><p className="ca-eyebrow">{editing ? 'NOWA WERSJA ZAŁOŻEŃ · V' + draft.version : 'NOWA ANALIZA CENY'}</p><h1>{titleQuestion}</h1><p>{step === 1 ? 'Wykorzystaj gotową kategorię albo przygotuj strukturę produktu.' : step === 2 ? 'Ta cena będzie punktem odniesienia całej analizy.' : 'Odniesiemy cenę do poziomu kosztów rynkowych w miesiącu zakupu.'}</p></div><span className="ca-step-count">Krok {step} z 3</span></div>
 <nav className="ca-stepper" aria-label="Postęp analizy">{[['1', 'Struktura produktu'], ['2', 'Ostatnia cena'], ['3', 'Data zakupu']].map(([n, label]) => <CanonButton canonId="SRM-C08" usage={'CA2:step-' + n} key={n} aria-pressed={step === Number(n)} disabled={Number(n) > step} onClick={() => setStep(Number(n))}><span>{Number(n) < step ? <Icon name="check" size={13} /> : n}</span>{label}</CanonButton>)}</nav>
 {editing && <Notice title={'Powstanie definicja założeń v' + draft.version}>Zapisane analizy i porównania z poprzednich wersji zachowają swoją cenę, strukturę oraz wersję danych.</Notice>}
 <div className="ca-setup-grid"><section className="ca-panel ca-step-panel">
 {step === 1 && <><div className="ca-choice-tabs" role="group" aria-label="Sposób określenia struktury"><CanonButton canonId="SRM-C08" usage="CA2:existing" aria-pressed={structureMode === 'existing'} onClick={() => setStructureMode('existing')}>Wybierz zapisaną kategorię</CanonButton><CanonButton canonId="SRM-C08" usage="CA2:build" aria-pressed={structureMode === 'build'} onClick={() => {
                    setStructureMode('build');
                    setDraft(p => ({
                      ...p,
                      categoryId: 'custom',
                      name: '',
                      components: []
                    }));
                  }}>Zbuduj strukturę produktu</CanonButton></div>
 {structureMode === 'existing' ? <div className="ca-existing-categories">{categories.map(c => <div className="ca-category-item" key={c.id}><CanonButton canonId="SRM-C02" usage={'CA2:category-' + c.id} className="ca-category-choice" aria-pressed={categoryId === c.id && draft.categoryId === c.id} disabled={!c.ready} onClick={() => chooseCategory(c.id)}><span className="ca-category-title"><strong>{c.name}</strong><small>{c.components.length} komponentów · {c.components.reduce((s, x) => s + x.weight, 0)}% kosztów · {c.revision}</small></span><Badge ready={c.ready}>{c.ready ? 'READY' : 'DRAFT'}</Badge></CanonButton>{!c.ready && <div className="ca-draft-action"><small>Uzupełnij udziały i brakujące benchmarki.</small><Action kind="link" onClick={() => {
                        chooseCategory(c.id);
                        setStructureMode('build');
                        setDraft(p => ({
                          ...p,
                          categoryId: 'custom'
                        }));
                      }}>Dokończ strukturę w Category Builderze <Icon name="arrow" size={13} /></Action></div>}</div>)}{draft.components.length > 0 && <details className="ca-disclosure"><summary>Sprawdź pobraną strukturę i benchmarki <Icon name="down" size={14} /></summary>{structureTable(draft.components)}<p className="ca-caption">Wagi i źródła są pobierane z zapisanej kategorii. Nie trzeba definiować ich drugi raz.</p></details>}</div> : <><div className="ca-fields"><label><span>Nazwa produktu lub kategorii</span><CanonInput canonId="SRM-C06" usage="CA2:product-name" value={draft.name} onChange={e => setDraft(p => ({
                        ...p,
                        name: e.target.value
                      }))} placeholder="np. Kabel miedziany 3 × 2,5 mm²" /></label><div className="ca-builder-info"><Icon name="layers" size={17} /><div><strong>Category Builder · struktura produktu</strong><p>Ten krok pokazuje wykorzystanie istniejącego kreatora w procesie analizy ceny.</p></div><Action kind="link" onClick={() => setDraft(p => ({
                        ...p,
                        categoryId: 'custom',
                        name: 'Kabel miedziany 3 × 2,5 mm²',
                        components: cloneComponents(sourceComponents)
                      }))}>Użyj przykładowej struktury kabla</Action></div></div>{structureTable(draft.components, true)}<div className="ca-builder-footer"><Action kind="link" icon="plus" onClick={() => setDraft(p => ({
                      ...p,
                      components: [...p.components, {
                        ...sourceComponents[0],
                        id: 'custom-' + Date.now(),
                        name: 'Nowy komponent',
                        weight: 0,
                        seriesId: '',
                        benchmark: 'Nie przypisano benchmarku'
                      }]
                    }))}>Dodaj komponent</Action><span className={Math.abs(totalWeight - 100) < .001 ? 'ca-good' : 'ca-caution'}>Suma udziałów: {fmt(totalWeight, 0)}%</span></div><p className="ca-caption ca-pad">Benchmark wybierasz po nazwie. Przydatność historii zostanie sprawdzona w kroku daty zakupu. Zmiany tej makiety nie zapisują się do rzeczywistego Category Buildera.</p></>}
 </>}
 {step === 2 && <><Heading title="Ostatnia cena zakupu" description="Ustalmy wspólną podstawę późniejszego porównania." /><div className="ca-fields"><label className="ca-purchase-price"><span>Ile ostatnio zapłaciłeś?</span><CanonInput canonId="SRM-C06" usage="CA2:purchase-price" type="number" min="0.01" step="0.01" value={draft.purchase.price} onChange={e => purchase({
                      price: e.target.value
                    })} /></label><div className="ca-two-fields"><label><span>Waluta</span><CanonSelect canonId="SRM-C07" usage="CA2:purchase-currency" aria-label="Waluta ostatniej ceny" value={draft.purchase.currency} onChange={e => purchase({
                        currency: e.target.value as Currency
                      })}><option>PLN</option><option>EUR</option><option>USD</option></CanonSelect></label><label><span>Za jednostkę</span><CanonSelect canonId="SRM-C07" usage="CA2:purchase-unit" aria-label="Jednostka ostatniej ceny" value={draft.purchase.unit} onChange={e => purchase({
                        unit: e.target.value as Unit
                      })}><option value="mb">mb — metr bieżący</option><option value="km">km — kilometr</option><option value="szt.">szt. — sztuka</option></CanonSelect></label></div><div className="ca-two-fields"><label><span>Podstawa ceny</span><CanonSelect canonId="SRM-C07" usage="CA2:purchase-tax" aria-label="Podstawa ceny zakupu" value={draft.purchase.tax} onChange={e => purchase({
                        tax: e.target.value as Purchase['tax']
                      })}><option>netto</option><option>brutto</option></CanonSelect></label><label><span>Warunki dostawy</span><CanonSelect canonId="SRM-C07" usage="CA2:purchase-delivery" aria-label="Warunki dostawy ostatniego zakupu" value={draft.purchase.delivery} onChange={e => purchase({
                        delivery: e.target.value as Purchase['delivery']
                      })}><option>z dostawą</option><option>bez dostawy</option></CanonSelect></label></div><label><span>Dodatkowe warunki <small>opcjonalnie</small></span><CanonTextarea canonId="SRM-C06" usage="CA2:purchase-terms" rows={2} value={draft.purchase.terms} onChange={e => purchase({
                      terms: e.target.value
                    })} placeholder="np. specyfikacja, wielkość zamówienia, miejsce dostawy" /></label><Notice title="Cena zakupu będzie punktem odniesienia">Wynik pokaże zmianę tej ceny zgodnie z modelem rynku. Wprowadzenie ceny nie potwierdza, że była ona optymalna.</Notice></div></>}
 {step === 3 && <><Heading title="Miesiąc ostatniego zakupu" description="Używamy danych miesięcznych dla wszystkich składników kosztu." /><div className="ca-fields"><label><span>Kiedy obowiązywała cena {fmt(Number(draft.purchase.price))} {draft.purchase.currency}/{draft.purchase.unit}?</span><CanonSelect canonId="SRM-C07" usage="CA2:purchase-date" aria-label="Miesiąc ostatniego zakupu" value={draft.purchase.month} onChange={e => purchase({
                      month: Number(e.target.value)
                    })}>{dates.map((d, i) => <option key={d} value={i}>{d}{i === 5 ? ' · dane nieopublikowane' : ''}</option>)}</CanonSelect></label><div className="ca-readiness-title"><strong>Sprawdzamy dane dla Twojego zakupu</strong><Badge ready={hasDraftAnchor}>{hasDraftAnchor ? 'Można wyznaczyć historię ceny' : 'Brak pełnej podstawy'}</Badge></div><ul className="ca-check-list">{draft.components.map(c => {
                      const ready = observation(c, draft.purchase.month, scenario) != null;
                      return <li key={c.id}><Icon name={ready ? 'check' : 'warning'} size={16} /><span><strong>{c.name}</strong><small>{c.benchmark}</small></span><small className={ready ? 'ca-good' : 'ca-caution'}>{ready ? 'Dane z miesiąca zakupu dostępne' : 'Brak obserwacji dla zakupu'}</small></li>;
                    })}</ul>{!hasDraftAnchor && <Notice tone="danger" title="Nie można odnieść ceny do wybranego zakupu" action={<Action kind="link" onClick={() => {
                    setStep(2);
                  }}>Wróć do ceny zakupu <Icon name="arrow" size={14} /></Action>}>Brakuje wymaganych obserwacji dla rzeczywistego zakupu. Potrzebne są te dane albo inna rzeczywista cena i data zakupu. Nie zmieniamy daty automatycznie.</Notice>}<details className="ca-disclosure"><summary>Jak przygotowujemy różne częstotliwości danych? <Icon name="down" size={14} /></summary><p>Reguły wynikają z semantyki benchmarku: średnia dla dziennych szeregów cenowych, opublikowany poziom dla wskaźnika miesięcznego. Luki pozostają lukami. Szczegóły są dostępne przy komponentach.</p><p>Data zakupu może różnić się od pierwotnej bazy metodologii. Cena będzie odnoszona do poziomu modelu w wybranym miesiącu zakupu.</p></details></div></>}
 </section><aside className="ca-panel ca-setup-summary"><Heading title="Twoja analiza" /><div className="ca-summary-product"><Icon name="layers" size={22} /><div><strong>{draft.name || 'Nowy produkt'}</strong><small>{draft.components.length} komponentów · {fmt(totalWeight, 0)}% udziałów</small></div></div><div className="ca-summary-progress"><div><span>01</span><p><strong>Struktura kosztów</strong><small>{isStructureReady(draft.components) ? 'Udziały i benchmarki gotowe' : 'Do uzupełnienia'}</small></p><Icon name={isStructureReady(draft.components) ? 'check' : 'edit'} size={15} /></div><div><span>02</span><p><strong>Ostatnia cena</strong><small>{step >= 2 ? fmt(Number(draft.purchase.price)) + ' ' + draft.purchase.currency + '/' + draft.purchase.unit : 'W następnym kroku'}</small></p></div><div><span>03</span><p><strong>Miesiąc zakupu</strong><small>{step === 3 ? dates[draft.purchase.month] : 'W następnym kroku'}</small></p></div></div><div className="ca-setup-result-note"><Icon name="chart" size={19} /><h3>Co otrzymasz?</h3><p>Historię rynkowo indeksowanej ceny w swojej walucie i jednostce. Nową ofertę dostawcy możesz dodać w kolejnym kroku.</p></div></aside></div>
 <div className="ca-step-actions"><Action icon="back" onClick={() => step === 1 ? go('home') : setStep(step - 1)}>Wróć</Action><span>{step === 1 ? 'Struktura jest definiowana tylko raz.' : step === 2 ? 'Waluta, jednostka i warunki będą widoczne przy porównaniu.' : 'Cena z zakupu pozostaje punktem odniesienia.'}</span><Action kind="primary" icon={step === 3 ? 'chart' : 'arrow'} disabled={busy || step === 1 && (!isStructureReady(draft.components) || !draft.name.trim()) || step === 2 && Number(draft.purchase.price) <= 0 || step === 3 && !hasDraftAnchor} onClick={() => step === 3 ? calculate() : setStep(step + 1)}>{busy ? 'Wyznaczanie historii ceny…' : step === 3 ? 'Wyznacz cenę referencyjną' : 'Dalej'}</Action></div>
 {busy && <div className="ca-loading" role="status"><span /><strong>Wyznaczanie historii ceny</strong><p>{draft.name}</p><small>Sprawdzanie benchmarków i odniesienie do ostatniej ceny zakupu…</small></div>}
 </>}

 {screen === 'result' && <>
 <div className="ca-page-head"><div><p className="ca-eyebrow">{mode === 'monitor' ? 'MONITOROWANIE CENY ZAKUPU' : 'WERYFIKACJA OFERTY DOSTAWCY'}</p><h1>{analysis.name}</h1><p>Ostatni zakup: <strong>{fmt(Number(analysis.purchase.price))} {units}</strong> · {dates[analysis.purchase.month]} · {analysis.purchase.tax} · {analysis.purchase.delivery}</p></div><div className="ca-result-actions"><Action icon="history" onClick={() => setPanel('history')}>Historia</Action><Action icon={savedDefinition ? 'check' : 'save'} disabled={savedDefinition} onClick={saveAnalysis}>{savedDefinition ? 'Analiza zapisana' : 'Zapisz analizę'}</Action></div></div>
 <div className="ca-result-mode"><div className="ca-mode-tabs" role="group" aria-label="Cel analizy"><CanonButton canonId="SRM-C08" usage="CA2:monitor" aria-pressed={mode === 'monitor'} onClick={() => setMode('monitor')}><Icon name="chart" size={16} />Monitoruj cenę</CanonButton><CanonButton canonId="SRM-C08" usage="CA2:verify" aria-pressed={mode === 'compare'} onClick={() => {
                setMode('compare');
                if (!offer.price) setOffer(p => ({
                  ...p,
                  month: Math.max(analysis.purchase.month, 2)
                }));
              }}><Icon name="compare" size={16} />Sprawdź ofertę dostawcy</CanonButton></div><Action kind="link" icon="info" onClick={() => setPanel('assumptions')}>Założenia v{analysis.version} · dane {analysis.dataRevision}</Action></div>
 {viewSnapshot && <Notice title="Zapisany punkt odniesienia">To porównanie wykorzystuje zachowaną definicję v{analysis.version} i dane {analysis.dataRevision}. Zmiany w nowej analizie nie nadpisują tej historii.</Notice>}
 {reference == null && <Notice tone="danger" title={currentMonth > 4 ? 'Dane dla tego miesiąca nie zostały opublikowane' : 'Brak pełnych danych do wyznaczenia ceny'} action={<Action kind="link" onClick={() => {
            if (mode === 'compare') updateOffer({
              month: scenario === 'stale' ? 3 : 4
            });else setSelectedMonth(scenario === 'stale' ? 3 : 4);
          }}>Wybierz kompletny miesiąc: {scenario === 'stale' ? 'lipiec' : 'sierpień'} 2024 <Icon name="arrow" size={14} /></Action>}>Cena referencyjna nie jest wyświetlana. Pokrycie: {coverage}/{analysis.components.length} komponentów. Brakujące obserwacje nie są zastępowane zerem ani prognozą.</Notice>}
 {scenario === 'missing' && <Notice tone="warning" title="Historia zawiera lukę w czerwcu 2024">Brak obserwacji Praca. Czerwiec pozostaje bez pełnej ceny referencyjnej; pozostałe kompletne miesiące można analizować.</Notice>}
 {scenario === 'stale' && <Notice tone="warning" title="Opóźniona publikacja benchmarku Energia">W scenariuszu oczekiwano danych za sierpień 2024. Ostatni dostępny miesiąc Energy: lipiec 2024.</Notice>}
 <div className={'ca-result-grid ' + (mode === 'compare' ? 'with-offer' : '') + (evaluated && comparison.valid ? ' has-result' : '')}><div className="ca-result-main">
 <section className="ca-panel ca-reference"><div className="ca-reference-head"><div><p className="ca-eyebrow">CENA REFERENCYJNA WEDŁUG MODELU RYNKU</p><h2>{dates[currentMonth]}</h2></div><Badge ready={reference != null}>{reference != null ? 'Pełne dane' : coverage + '/' + analysis.components.length + ' komponentów'}</Badge></div><div className="ca-reference-price"><strong className="ca-result-value">{fmt(reference)} <small>{reference == null ? '' : units}</small></strong><div><strong>{marketChange == null ? '—' : sign(marketChange) + '%'}</strong><span>od zakupu z {fromDates[analysis.purchase.month]}</span></div></div><p>Twoja cena zakupu skorygowana o zmiany modelowanych kosztów rynkowych.</p>{mode === 'monitor' && <div className="ca-monitor-month"><span>Sprawdź miesiąc</span><CanonSelect canonId="SRM-C07" usage="CA2:monitor-date" aria-label="Miesiąc ceny referencyjnej" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>{dates.map((d, i) => i >= analysis.purchase.month && <option key={d} value={i} disabled={i < analysis.purchase.month}>{d}{i === 5 ? ' · brak opublikowanych danych' : ''}</option>)}</CanonSelect></div>}</section>
 {mode === 'compare' && <section className="ca-panel ca-verdict"><Heading title="Różnica między ofertą a punktem odniesienia" />{evaluated && comparison.valid ? <><div className="ca-gap-money"><strong className="ca-money">{sign(comparison.gap)} <small>{units}</small></strong><span>{sign(comparison.gapPct)}% względem ceny referencyjnej</span></div><div className="ca-rate-comparison"><div><span>Zmiana ceny proponowana przez dostawcę</span><strong>{sign(comparison.supplierChange)}%</strong></div><div><span>Zmiana modelowanych kosztów rynkowych</span><strong>{sign(comparison.marketChange)}%</strong></div></div><div className="ca-interpretation"><Icon name="info" size={18} /><p>{comparison.gap! > 0 ? 'Oferta jest o ' + fmt(comparison.gap) + ' ' + units + ' wyższa od ceny indeksowanej. Warto wyjaśnić dodatkową różnicę przed zaakceptowaniem oferty.' : comparison.gap! < 0 ? 'Oferta jest o ' + fmt(Math.abs(comparison.gap!)) + ' ' + units + ' niższa od ceny indeksowanej. Warto sprawdzić zgodność zakresu i pozostałych warunków zakupu.' : 'Oferta odpowiada cenie referencyjnej według przyjętego modelu kosztów.'}</p></div><details className="ca-disclosure"><summary>Co jeszcze może wyjaśniać różnicę? <Icon name="down" size={14} /></summary><p>Specyfikacja produktu, wielkość zamówienia, warunki dostawy i płatności, marża dostawcy albo wcześniejsza nierynkowa cena zakupu. Model daje punkt odniesienia do negocjacji, bez werdyktu o uczciwości oferty.</p></details><Action kind="primary" icon="save" onClick={saveComparison}>Zapisz analizę i porównanie</Action></> : <div className="ca-verdict-empty"><Icon name={reference == null ? 'lock' : 'compare'} size={25} /><h3>{reference == null ? 'Porównanie wymaga pełnej ceny referencyjnej' : 'Dodaj porównywalną ofertę dostawcy'}</h3><p>Wskaż cenę i miesiąc oferty, potwierdź wspólną podstawę, a następnie uruchom porównanie.</p></div>}</section>}
 <section className="ca-panel ca-history"><Heading title="Jak zmieniałaby się cena zakupu?" description={'Punkt odniesienia: ' + dates[analysis.purchase.month] + ' · ' + fmt(Number(analysis.purchase.price)) + ' ' + units}><Action kind="link" icon="info" onClick={() => setPanel('method')}>Jak to liczymy?</Action></Heading><PriceHistoryChart analysis={analysis} scenario={scenario} month={currentMonth} onMonth={mode === 'monitor' ? setSelectedMonth : undefined} offer={mode === 'compare' && evaluated && comparison.valid ? offer : undefined} /><p className="ca-caption ca-pad">Dane historyczne. Wykres nie przedstawia prognozy ani niezależnie skalkulowanego kosztu produkcji.</p></section>
 <section className="ca-panel ca-drivers"><Heading title="Co zmieniło cenę referencyjną?" description={dates[analysis.purchase.month] + ' → ' + dates[currentMonth]}><span className="ca-caption">Wpływ w {units}</span></Heading><div className="ca-driver-list">{analysis.components.map(c => {
                    const v = contribution(analysis, c, currentMonth, scenario);
                    const max = Math.max(...analysis.components.map(x => Math.abs(contribution(analysis, x, currentMonth, scenario).cash ?? 0)), 1);
                    return <CanonButton canonId="SRM-C03" usage={'CA2:driver-' + c.id} key={c.id} className="ca-driver-row" aria-label={'Dane i wpływ komponentu ' + c.name} onClick={() => setComponent(c)}><span className="ca-driver-name"><i className="ca-dot" style={{
                          background: c.color
                        }} /><strong>{c.name}</strong><small>{c.weight}% udziału</small></span><span className="ca-driver-line"><i className="ca-zero" /><i className={v.cash != null && v.cash < 0 ? 'negative' : ''} style={{
                          left: v.cash != null && v.cash < 0 ? 20 - Math.min(Math.abs(v.cash) / max * 70, 18) + '%' : '20%',
                          width: v.cash == null ? '0%' : Math.max(Math.min(Math.abs(v.cash) / max * 70, v.cash < 0 ? 18 : 70), .7) + '%'
                        }} /></span><strong className="ca-driver-value">{sign(v.cash)} <small>{units}</small></strong><Icon name="chevron" size={14} /></CanonButton>;
                  })}</div><div className="ca-driver-total"><span>Łączny wpływ zmian rynku</span><strong>{sign(reference == null ? null : reference - Number(analysis.purchase.price))} {units}</strong></div><details className="ca-disclosure ca-pad"><summary>Pokaż udziały, zmiany benchmarków i wkłady w p.p. <Icon name="down" size={14} /></summary><div className="ca-table-scroll"><table className="ca-table"><thead><tr><th>Komponent</th><th>Udział</th><th>Zmiana benchmarku</th><th>Wkład w zmianę ceny</th></tr></thead><tbody>{analysis.components.map(c => {
                          const v = contribution(analysis, c, currentMonth, scenario);
                          return <tr key={c.id}><td>{c.name}<small>{c.benchmark}</small></td><td>{c.weight}%</td><td>{v.change == null ? 'Brak danych' : sign(v.change) + '%'}</td><td>{sign(v.pp)} p.p.</td></tr>;
                        })}</tbody><tfoot><tr><th>Łącznie</th><td>100%</td><td>—</td><td>{sign(marketChange)} p.p.</td></tr></tfoot></table></div></details></section>
 </div>{mode === 'compare' ? <aside className="ca-panel ca-offer-form"><Heading title="Nowa oferta dostawcy" description="Porównujemy ceny dla tego samego miesiąca." /><div className="ca-fields"><label><span>Cena z oferty</span><CanonInput canonId="SRM-C06" usage="CA2:offer-price" type="number" min="0.01" step="0.01" value={offer.price} placeholder="np. 1 100" onChange={e => updateOffer({
                    price: e.target.value
                  })} /></label><div className="ca-two-fields"><label><span>Waluta</span><CanonSelect canonId="SRM-C07" usage="CA2:offer-currency" aria-label="Waluta oferty" value={offer.currency} onChange={e => updateOffer({
                      currency: e.target.value as Currency
                    })}><option>PLN</option><option>EUR</option><option>USD</option></CanonSelect></label><label><span>Za jednostkę</span><CanonSelect canonId="SRM-C07" usage="CA2:offer-unit" aria-label="Jednostka oferty" value={offer.unit} onChange={e => updateOffer({
                      unit: e.target.value as Unit
                    })}><option>mb</option><option>km</option><option>szt.</option></CanonSelect></label></div><label><span>Miesiąc oferty</span><CanonSelect canonId="SRM-C07" usage="CA2:offer-date" aria-label="Miesiąc nowej oferty" value={offer.month} onChange={e => updateOffer({
                    month: Number(e.target.value)
                  })}>{dates.map((d, i) => <option key={d} value={i} disabled={i < analysis.purchase.month}>{d}{i === 5 ? ' · dane nieopublikowane' : ''}</option>)}</CanonSelect></label><div className="ca-two-fields"><label><span>Podstawa ceny</span><CanonSelect canonId="SRM-C07" usage="CA2:offer-tax" aria-label="Podstawa ceny oferty" value={offer.tax} onChange={e => updateOffer({
                      tax: e.target.value as Offer['tax']
                    })}><option>netto</option><option>brutto</option></CanonSelect></label><label><span>Dostawa</span><CanonSelect canonId="SRM-C07" usage="CA2:offer-delivery" aria-label="Warunki dostawy oferty" value={offer.delivery} onChange={e => updateOffer({
                      delivery: e.target.value as Offer['delivery']
                    })}><option>z dostawą</option><option>bez dostawy</option></CanonSelect></label></div><label><span>Dostawca <small>opcjonalnie</small></span><CanonInput canonId="SRM-C06" usage="CA2:supplier-name" value={offer.supplier} onChange={e => updateOffer({
                    supplier: e.target.value
                  })} /></label>
 <div className="ca-comparability"><h3>Porównywalność cen</h3><ul>{[[offer.currency === analysis.purchase.currency, 'Waluta', analysis.purchase.currency + ' ↔ ' + offer.currency], [offer.unit === analysis.purchase.unit, 'Jednostka', analysis.purchase.unit + ' ↔ ' + offer.unit], [comparison.taxMatch, 'Podstawa ceny', analysis.purchase.tax + ' ↔ ' + offer.tax], [comparison.deliveryMatch, 'Dostawa', analysis.purchase.delivery + ' ↔ ' + offer.delivery]].map(([ok, label, value]) => <li key={String(label)}><Icon name={ok ? 'check' : 'warning'} size={14} /><span>{label}</span><strong>{value}</strong></li>)}</ul></div>
 {comparison.needsConversion && (comparison.rate == null || comparison.factor == null) ? <Notice tone="danger" title={comparison.rate == null ? 'Brak wymaganego kursu walutowego' : 'Nieporównywalne jednostki'}>{comparison.rate == null ? 'Bez kursu z miesiąca oferty nie można przeliczyć jej na walutę ceny zakupu.' : 'Sztuk nie można przeliczyć na metry bez danych o produkcie.'}</Notice> : comparison.needsConversion && !offer.converted ? <Notice tone="warning" title="Wymagane przeliczenie oferty" action={<Action kind="link" onClick={() => updateOffer({
                  converted: true
                })}>Zastosuj przeliczenie na {units} <Icon name="arrow" size={13} /></Action>}>{fmt(Number(offer.price))} {offer.currency}/{offer.unit} = {fmt(comparison.normalized)} {units}. Kurs {offer.currency}/{analysis.purchase.currency}: {fmt(comparison.rate, 4)} · {dates[offer.month]} · dane FX demonstracyjne.</Notice> : comparison.needsConversion ? <Notice title="Oferta przeliczona do wspólnej podstawy">{fmt(Number(offer.price))} {offer.currency}/{offer.unit} → {fmt(comparison.normalized)} {units}. Zastosowano jawne przeliczenie jednostki i kurs z miesiąca oferty.</Notice> : null}
 {(!comparison.taxMatch || !comparison.deliveryMatch) && <Notice tone="warning" title="Najpierw ujednolić podstawę ceny">Potrzebna jest cena na tej samej podstawie podatkowej i z tym samym zakresem dostawy. Różnica nie będzie liczona automatycznie.</Notice>}
 <label className="ca-confirm"><input type="checkbox" checked={offer.termsConfirmed} onChange={e => updateOffer({
                    termsConfirmed: e.target.checked,
                    converted: offer.converted
                  })} /><span>Potwierdzam porównywalną specyfikację produktu i pozostałe warunki oferty.</span></label><Action kind="primary" icon="compare" disabled={!comparison.valid || !offer.termsConfirmed} onClick={() => setEvaluated(true)}>Porównaj ofertę z ceną referencyjną</Action><p className="ca-caption">Porównanie nie rozstrzyga o uczciwości oferty. Różnica jest punktem wyjścia do rozmowy z dostawcą.</p></div></aside> : <aside className="ca-monitor-aside"><section className="ca-panel"><Heading title="Masz nową ofertę?" /><div className="ca-monitor-invite"><Icon name="file" size={28} /><p>Dodaj proponowaną cenę i jej miesiąc. Sprawdzisz różnicę względem ceny referencyjnej z tego samego okresu.</p><Action kind="primary" icon="arrow" onClick={() => {
                    setMode('compare');
                    setOffer(p => ({
                      ...p,
                      month: Math.min(4, Math.max(analysis.purchase.month, 2))
                    }));
                  }}>Sprawdź ofertę dostawcy</Action></div></section><section className="ca-panel"><Heading title="Wspólny punkt odniesienia" /><dl className="ca-baseline-meta"><div><dt>Ostatnia cena zakupu</dt><dd>{fmt(Number(analysis.purchase.price))} {units}</dd></div><div><dt>Miesiąc zakupu</dt><dd>{dates[analysis.purchase.month]}</dd></div><div><dt>Warunki</dt><dd>{analysis.purchase.tax} · {analysis.purchase.delivery}</dd></div><div><dt>Struktura</dt><dd>{analysis.components.length} komponentów · stałe udziały</dd></div></dl><div className="ca-pad"><Action kind="link" icon="info" onClick={() => setPanel('assumptions')}>Sprawdź założenia analizy</Action></div></section></aside>}</div>
 <div className="ca-method-footer"><span><Icon name="lock" size={14} />Założenia v{analysis.version} · cena i data zakupu zachowane w analizie</span><Action kind="link" onClick={() => setPanel('method')}>Metodologia CCI i dane źródłowe <Icon name="arrow" size={14} /></Action></div>
 </>}

 {screen === 'saved' && <><div className="ca-page-head"><div><p className="ca-eyebrow">POWRÓT DO WCZEŚNIEJSZYCH USTALEŃ</p><h1>Moje analizy ceny</h1><p>Otwórz istniejącą analizę i sprawdź kolejną ofertę bez budowania struktury od początku.</p></div><Action kind="primary" icon="plus" onClick={start}>Nowa analiza ceny</Action></div><section className="ca-panel"><Heading title="Zapisane analizy" description="Przykłady i zapis w bieżącej sesji makiety" /><div className="ca-saved-list">{saved.filter(a => !saved.some(b => b.id === a.id && b.version > a.version)).map(a => <div key={a.id}><span className="ca-saved-symbol"><Icon name="layers" size={23} /></span><div><h3>{a.name}</h3><p>{fmt(Number(a.purchase.price))} {a.purchase.currency}/{a.purchase.unit} · {dates[a.purchase.month]} · założenia v{a.version}</p><small>{a.dataRevision} · {a.components.length} komponentów</small></div><Action onClick={() => {
                  setAnalysis(snapshot(a));
                  setOffer({
                    ...defaultOffer(),
                    currency: a.purchase.currency,
                    unit: a.purchase.unit,
                    tax: a.purchase.tax,
                    delivery: a.purchase.delivery,
                    price: '',
                    termsConfirmed: false
                  });
                  setSelectedMonth(4);
                  setMode('monitor');
                  setScenario('complete');
                  setEvaluated(false);
                  setViewSnapshot(false);
                  go('result');
                }}>Otwórz analizę <Icon name="arrow" size={14} /></Action></div>)}</div></section><section className="ca-panel ca-saved-comparisons"><Heading title="Historia porównań ofert" description="Zachowane ceny, założenia i wersje danych pozwalają wrócić do poprzedniego wyniku." /><div className="ca-table-scroll"><table className="ca-table"><thead><tr><th>Produkt / dostawca</th><th>Miesiąc oferty</th><th>Cena referencyjna</th><th>Oferta po przeliczeniu</th><th>Różnica</th><th /></tr></thead><tbody>{history.map(h => <tr key={h.id}><td>{h.analysis.name}<small>{h.offer.supplier || 'Dostawca'} · założenia v{h.analysis.version} · {h.analysis.dataRevision}</small></td><td>{dates[h.offer.month]}</td><td>{fmt(h.reference)} {h.analysis.purchase.currency}/{h.analysis.purchase.unit}</td><td>{fmt(h.normalizedOffer)}</td><td>{sign(h.normalizedOffer - h.reference)}</td><td><Action kind="link" onClick={() => openComparison(h)}>Otwórz <Icon name="chevron" size={14} /></Action></td></tr>)}</tbody></table></div></section></>}
 <footer className="ca-footer"><span><i />Makieta UX · CCI, wersja 2 · wszystkie ceny, serie i kursy FX są demonstracyjne</span><span>Zapis i historia działają w bieżącej sesji</span></footer>
 </main></CanonSideMenu>

 {panel === 'method' && <CanonHistoryDialog title="Jak powstaje cena referencyjna?" subtitle="CCI jest metodologią pomocniczą analizy ceny" onClose={() => setPanel(null)}><div className="ca-dialog-body ca-method"><p>Cena referencyjna to ostatnia cena zakupu skorygowana o zmianę modelowanych kosztów rynkowych między miesiącem zakupu a wybranym miesiącem analizy.</p><div className="ca-formula">Cena referencyjna = cena zakupu × CCI w miesiącu analizy / CCI w miesiącu zakupu</div><h3>Data zakupu i baza modelu mogą być różne</h3><p>W przykładzie baza modelu przypada na kwiecień 2024. Poziom CCI w maju to 105,00, a w czerwcu 111,30. Cena 1 000 PLN z maja daje w czerwcu: <strong>1 000 × 111,30 / 105,00 = 1 060 PLN</strong>.</p><PriceHistoryChart analysis={analysis} scenario={scenario} month={currentMonth} indexMode /><h3>Stała definicja, jawne pochodzenie danych</h3><p>CCI agreguje benchmarki według zapisanych udziałów. Miesięczne wartości przygotowuje się odpowiednio do semantyki źródeł. Brak obserwacji dla zakupu lub analizowanego miesiąca uniemożliwia pełne wyliczenie ceny.</p><h3>Waluty i wkłady komponentów</h3><p>W tej makiecie model pokazuje zmiany benchmarków w ich oryginalnych walutach, bez dodatkowego FX wpływającego na koszty. Waluta ceny zakupu określa jednostkę wyniku. Osobne przeliczenie waluty oferty korzysta z jawnego kursu z jej miesiąca.</p><p>Wkład komponentu w zmianę ceny jest liczony względem poziomu całego modelu w miesiącu zakupu. Wkłady w p.p. sumują się do zmiany modelu, a wkłady w walucie — do różnicy ceny referencyjnej względem ceny zakupu.</p><Notice title="Zakres interpretacji">Wprowadzona cena zakupu nie jest niezależnie potwierdzonym kosztem produkcji. Wynik wspiera negocjacje i ocenę założeń.</Notice></div></CanonHistoryDialog>}
 {panel === 'assumptions' && <CanonHistoryDialog title="Założenia analizy ceny" subtitle={analysis.id + ' · definicja v' + analysis.version + ' · dane ' + analysis.dataRevision} onClose={() => setPanel(null)}><div className="ca-dialog-body"><dl className="ca-assumption-meta"><div><dt>Produkt / kategoria</dt><dd>{analysis.name}</dd></div><div><dt>Ostatnia cena zakupu</dt><dd>{fmt(Number(analysis.purchase.price))} {units} · {analysis.purchase.tax}</dd></div><div><dt>Miesiąc zakupu</dt><dd>{dates[analysis.purchase.month]}</dd></div><div><dt>Warunki</dt><dd>{analysis.purchase.delivery} · {analysis.purchase.terms || 'Nie podano dodatkowych warunków'}</dd></div></dl>{structureTable(analysis.components)}<Notice title="Wersje założeń i danych są rozdzielone">Zmiana struktury lub ceny referencyjnego zakupu tworzy nową definicję. Nowe notowania otrzymują osobną wersję danych. Wcześniejsze porównania zachowują obie informacje.</Notice><div className="ca-dialog-actions"><Action icon="edit" onClick={editAssumptions}>Edytuj jako nową wersję założeń</Action><Action kind="link" onClick={() => setPanel('method')}>Sprawdź metodologię CCI</Action></div></div></CanonHistoryDialog>}
 {panel === 'history' && <CanonHistoryDialog title="Historia porównań" subtitle={analysis.name + ' · zachowane wyniki i założenia'} onClose={() => setPanel(null)}><div className="ca-dialog-body">{history.filter(h => h.analysis.id === analysis.id).length ? history.filter(h => h.analysis.id === analysis.id).map(h => <div key={h.id} className="ca-history-record"><div><h3>{h.offer.supplier || 'Oferta dostawcy'} · {dates[h.offer.month]}</h3><p>Oferta {fmt(h.normalizedOffer)} · referencja {fmt(h.reference)} {h.analysis.purchase.currency}/{h.analysis.purchase.unit}</p><small>Założenia v{h.analysis.version} · {h.analysis.dataRevision}</small></div><strong>{sign(h.normalizedOffer - h.reference)} {h.analysis.purchase.currency}/{h.analysis.purchase.unit}</strong><Action onClick={() => openComparison(h)}>Otwórz</Action></div>) : <div className="ca-verdict-empty"><Icon name="history" size={27} /><h3>Brak zapisanych porównań tej analizy</h3><p>Po sprawdzeniu oferty użyj akcji „Zapisz analizę i porównanie”.</p></div>}<div className="ca-dialog-actions"><Action kind="link" onClick={() => go('saved')}>Wszystkie zapisane analizy <Icon name="arrow" size={14} /></Action></div></div></CanonHistoryDialog>}
 {panel === 'navigation' && <CanonHistoryDialog title="Wspólny proces SpendGuru" onClose={() => setPanel(null)} compact><div className="ca-dialog-body ca-method"><h3>Category Builder</h3><p>Właściciel komponentów, udziałów i przypisań benchmarków. W tym wariancie jego krok jest częścią procesu rozpoczęcia analizy ceny.</p><h3>Benchmark Finder</h3><p>Pomaga wybrać i sprawdzić źródłowe szeregi rynkowe, bez wymagania znajomości ich kodów.</p><h3>Cost Scan i CCI</h3><p>Wspólne dane rynkowe wspierają analizę kosztów. CCI działa w tle, aby indeksować cenę zakupu i porównywać nową ofertę.</p><Notice title="Koncepcja UX">Połączenia z pozostałymi funkcjonalnościami są pokazane jako makieta. Nie zmieniają działającej aplikacji ani pozostałych projektów.</Notice></div></CanonHistoryDialog>}
 {component && <CanonHistoryDialog title={component.name} subtitle={component.benchmark + ' · dane i wpływ na cenę'} onClose={() => setComponent(null)}><div className="ca-dialog-body"><div className="ca-component-kpis"><div><span>Udział w strukturze</span><strong className="ca-money">{component.weight}%</strong></div><div><span>Wpływ na cenę</span><strong className="ca-money">{sign(contribution(analysis, component, currentMonth, scenario).cash)} <small>{units}</small></strong></div><div><span>Wkład w zmianę modelu</span><strong className="ca-money">{sign(contribution(analysis, component, currentMonth, scenario).pp)} <small>p.p.</small></strong></div></div><section className="ca-component-history"><Heading title="Historia źródłowego benchmarku" description="Indeks 100 w kwietniu 2024 · dane demonstracyjne" /><PriceHistoryChart analysis={analysis} scenario={scenario} month={currentMonth} indexMode component={component} /></section><dl className="ca-provenance"><div><dt>Benchmark</dt><dd>{component.benchmark}</dd></div><div><dt>Dostawca i identyfikator</dt><dd>Źródło demonstracyjne · {component.seriesId}<small>Fikcyjny identyfikator, bez połączenia z Macrobond</small></dd></div><div><dt>Jednostka / waluta źródłowa</dt><dd>{component.unit} · {component.currency}</dd></div><div><dt>Częstotliwość / agregacja</dt><dd>{component.frequency} · {component.aggregation}</dd></div><div><dt>Wartość w miesiącu zakupu</dt><dd>{fmt(observation(component, analysis.purchase.month, scenario))} · {dates[analysis.purchase.month]}</dd></div><div><dt>Wartość w miesiącu analizy</dt><dd>{fmt(observation(component, currentMonth, scenario))} · {dates[currentMonth]}</dd></div><div><dt>Zmiana benchmarku od zakupu</dt><dd>{sign(contribution(analysis, component, currentMonth, scenario).change)}%</dd></div><div><dt>Ostatnia obserwacja</dt><dd>{scenario === 'stale' && component.id === 'energy' ? 'Lipiec' : 'Sierpień'} 2024 · dane demonstracyjne</dd></div><div><dt>Wersja danych</dt><dd>{analysis.dataRevision}</dd></div></dl><Notice title="Przejrzysta interpretacja">Wpływ w {units} pokazuje część zmiany ceny przypisaną temu komponentowi. Zmiana benchmarku w procentach i wkład w p.p. opisują różne wielkości.</Notice></div></CanonHistoryDialog>}
 {toast && <div className="ca-toast" role="status"><Icon name="check" size={17} />{toast}<CanonButton canonId="SRM-C04" usage="CA2:toast-close" onClick={() => setToast('')} aria-label="Zamknij powiadomienie"><Icon name="close" size={14} /></CanonButton></div>}
 </div>;
};
return {CCIWersja2AnalizaCenyIOfertyDostawcy};
}
