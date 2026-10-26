import {usePresentationScope,usePresentationMedia} from '../../PresentationScope';


import React, { useEffect, useRef, useState } from 'react';
import { CanonButton, CanonInput, CanonSelect, CanonTextarea } from './CanonElements';
import { CanonHeader } from './CanonHeader';
import { CanonSideMenu } from './CanonSideMenu';
import { CanonHistoryDialog } from './CanonHistoryDialog';
import { CCICanonStyles } from './CCICanonStyles';
import { spacingCSS } from './spacing-contract';
import { canonTokens, tokenVariables } from './canon-tokens';
import {createCCIChart} from './CCIChart';
import { Icon } from './cci-icons';
import type {Scenario,Screen,Definition,CurrencyPolicy,Component,Category} from '../../data-contracts/pci1';
export function createCCIKlIkalnyPrzepYwAnalizyKosztW(data:typeof import('../../data-contracts/pci1')){
const {categories,categoryOf,createDefinition,componentIndex,totalIndex,monthlyChange,dataStatus,months,fmt,signed,scenarioOptions,currencyLabel,canonSource}=data;
const {CCIChart}=createCCIChart(data);






function Button({
  children,
  kind = 'secondary',
  icon,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: 'primary' | 'secondary' | 'link';
  icon?: string;
}) {
  return <CanonButton canonId={kind === 'primary' ? 'SRM-C01' : kind === 'link' ? 'SRM-C03' : 'SRM-C02'} usage={'CCI:' + String(props['aria-label'] ?? icon ?? 'action')} {...props} className={'cci-button ' + (kind === 'link' ? 'srm-text-link ' : '') + (props.className ?? '')}>{icon && <Icon name={icon} size={16} />} {children}</CanonButton>;
}
function Badge({
  status,
  children
}: {
  status: string;
  children?: React.ReactNode;
}) {
  return <span className={'cci-badge ' + status}><Icon name={status === 'ready' ? 'check' : status === 'draft' ? 'edit' : status === 'blocked' ? 'lock' : status === 'partial' || status === 'stale' ? 'warning' : 'info'} size={12} />{children ?? ({
      ready: 'READY',
      draft: 'DRAFT',
      blocked: 'BLOCKED',
      partial: 'PARTIAL DATA',
      stale: 'Opóźnienie'
    } as Record<string, string>)[status]}</span>;
}
function SectionTitle({
  number,
  title,
  subtitle,
  children
}: {
  number?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return <div className="cci-section-title"><div>{number && <span className="cci-section-number">{number}</span>}<div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</div>;
}
function Notice({
  tone = 'info',
  title,
  children,
  action
}: {
  tone?: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return <div className={'cci-notice ' + tone} role={tone === 'danger' ? 'alert' : 'status'}><Icon name={tone === 'danger' ? 'lock' : tone === 'warning' ? 'warning' : 'info'} size={18} /><div><strong>{title}</strong>{children && <p>{children}</p>}{action && <div className="cci-notice-action">{action}</div>}</div></div>;
}
function Dialog({
  title,
  subtitle,
  children,
  onClose,
  wide = false
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return <CanonHistoryDialog title={title} subtitle={subtitle} onClose={onClose} compact={!wide}><div className="cci-dialog-body">{children}</div></CanonHistoryDialog>;
}
const CCIKlIkalnyPrzepYwAnalizyKosztW = () => {
  const presentation=usePresentationScope();
  const mobileScenarios=usePresentationMedia('(max-width:960px)');
  const [screen, setScreen] = useState<Screen>('dashboard'),
    [scenario, setScenario] = useState<Scenario>('ready');
  const [definition, setDefinition] = useState<Definition>(() => createDefinition()),
    [saved, setSaved] = useState<Definition[]>(() => [createDefinition()]);
  const [selected, setSelected] = useState(2),
    [categoryId, setCategoryId] = useState('cable'),
    [search, setSearch] = useState(''),
    [base, setBase] = useState(0),
    [policy, setPolicy] = useState<CurrencyPolicy>('original'),
    [name, setName] = useState(createDefinition().name),
    [description, setDescription] = useState(''),
    [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState<Component | null>(null),
    [dialog, setDialog] = useState<'method' | 'versions' | 'price' | 'nav' | null>(null),
    [nav, setNav] = useState(false),
    [pin, setPin] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(''),
    [price, setPrice] = useState('10000'),
    [priceCurrency, setPriceCurrency] = useState('PLN'),
    [unit, setUnit] = useState('km');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    main = useRef<HTMLElement>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const category = categories.find(c => c.id === categoryId)!;
  const currentCategory = categoryOf(definition);
  const config: Definition = {
    ...createDefinition(categoryId, base, policy, editing ? Math.max(...saved.filter(m => m.id === definition.id).map(m => m.version), definition.version) + 1 : 1),
    name: name.trim() || category.name + ' — CCI',
    description
  };
  const activeScenario: Scenario = scenario === 'empty' || scenario === 'no-categories' ? 'ready' : scenario;
  const readiness = dataStatus(config, activeScenario);
  const hasBase = base >= 0 && scenario !== 'missing-base' && !(scenario === 'partial' && base === 1);
  const baseMissingName = scenario === 'partial' && base === 1 ? 'Labor' : category.components[0].name;
  const current = totalIndex(definition, selected, activeScenario),
    monthChange = monthlyChange(definition, selected, activeScenario),
    coverage = definition.components.filter(c => componentIndex(c, definition, selected, activeScenario) != null).length;
  const isSaved = saved.some(m => m.id === definition.id && m.version === definition.version);
  const go = (s: Screen) => {
    setScreen(s);
    setDetail(null);
    setDialog(null);
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
    setEditing(false);
    setSearch('');
    go('select');
  };
  const choose = (c: Category) => {
    setCategoryId(c.id);
    setName(c.name + ' — CCI');
    setBase(0);
    setPolicy('original');
    setDescription('');
    go('configure');
  };
  const edit = () => {
    setEditing(true);
    setCategoryId(definition.categoryId);
    setName(definition.name);
    setBase(definition.base);
    setPolicy(definition.currency);
    setDescription(definition.description);
    go('configure');
  };
  const calculate = () => {
    if (readiness === 'blocked') return;
    setBusy(true);
    const next = {
      ...config,
      id: editing ? definition.id : 'CCI-DEMO-' + String(saved.length + 1).padStart(3, '0'),
      components: config.components.map(c => ({
        ...c,
        values: [...c.values]
      }))
    };
    timer.current = setTimeout(() => {
      setDefinition(next);
      setSelected(2);
      setBusy(false);
      go('dashboard');
      setToast('CCI obliczony na danych demonstracyjnych. Model można teraz zapisać w makiecie.');
    }, 1100);
  };
  const save = () => {
    if (isSaved) return;
    setSaved(p => [...p, {
      ...definition,
      components: definition.components.map(c => ({
        ...c,
        values: [...c.values]
      }))
    }]);
    setToast('Zapisano ' + definition.name + ' · v' + definition.version + ' w bieżącej sesji makiety.');
  };
  const showScenario = (s: Scenario) => {
    setScenario(s);
    setDetail(null);
    setDialog(null);
    if (s === 'empty') go('home');else if (s === 'no-categories') go('select');else if (s === 'missing-base') {
      setBase(-1);
      go('configure');
    } else if (s === 'fx') {
      setPolicy('PLN');
      go('configure');
    } else if (screen === 'home' || screen === 'select' || base < 0) {
      setBase(0);
      go('dashboard');
    }
  };
  const openModel = (m: Definition) => {
    setDefinition(m);
    setSelected(2);
    setScenario('ready');
    go('dashboard');
  };
  const renderBreakdown = (c: Category, withAction = true) => <><div className="cci-mini-allocation">{c.components.map(x => <span key={x.id} style={{
        width: x.weight + '%',
        background: x.color
      }} title={x.name + ' ' + x.weight + '%'} />)}</div><div className="cci-table-scroll"><table className="cci-table cci-structure"><thead><tr><th>Komponent</th><th>Udział</th><th>Przypisany benchmark</th></tr></thead><tbody>{c.components.map(x => <tr key={x.id}><td><i className="cci-dot" style={{
                background: x.color
              }} />{x.name}</td><td>{x.weight}%</td><td><span>{x.benchmark}</span><small>{x.currency === '—' ? 'Indeks źródłowy' : x.currency + ' · ' + x.unit}</small></td></tr>)}</tbody><tfoot><tr><th>Łączna alokacja</th><td>{c.components.reduce((s, x) => s + x.weight, 0)}%</td><td>{c.ready ? <span className="cci-good"><Icon name="check" size={13} />Struktura gotowa</span> : <span className="cci-warn">Brakuje 35% udziałów</span>}</td></tr></tfoot></table></div>{withAction && <CanonButton canonId="SRM-C03" usage="CCI:canonical-action-1" className="cci-inline-link" onClick={() => go('category')}><Icon name="external" size={14} />Edytuj strukturę w Category Builder</CanonButton>}</>;
  return <div className="srm-ui cci-root" style={tokenVariables(canonTokens) as React.CSSProperties} data-cci-canon-source={canonSource.revisionId}>
 <style>{spacingCSS}</style><CCICanonStyles />
 <div className="cci-prototype-bar"><span>WIDOKI PROJEKTU</span><nav aria-label="Ekrany makiety">{([['home', '01', 'Moje modele'], ['configure', '02', 'Konfiguracja CCI'], ['dashboard', '03', 'Dashboard indeksu'], ['detail', '04', 'Szczegóły komponentu']] as const).map(([s, n, label]) => <CanonButton canonId="SRM-C08" usage="CCI:canonical-action-2" key={s} aria-pressed={s === 'detail' ? !!detail : screen === s && !detail} onClick={() => {
          if (s === 'detail') {
            go('dashboard');
            setDetail(definition.components[0]);
          } else if (s === 'configure') {
            setEditing(false);
            choose(categories.find(c => c.id === definition.categoryId)!);
          } else go(s);
        }}><small>{n}</small>{label}</CanonButton>)}</nav><label className="cci-scenario"><span>Scenariusz</span>{mobileScenarios ? <CanonSelect canonId="SRM-C07" usage="PCI:scenario-mobile" className="pci-scenario-compact" aria-label="Scenariusz danych makiety" value={scenario} onChange={e => showScenario(e.target.value as Scenario)}>{scenarioOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</CanonSelect> : <select aria-label="Scenariusz danych makiety" value={scenario} onChange={e => showScenario(e.target.value as Scenario)}>{scenarioOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</label></div>
 <CanonHeader title="Cost Analysis"><span className="cci-demo-label"><i />Dane demonstracyjne</span><span className="cci-lang">PL</span><span className="cci-user">AK</span></CanonHeader>
 <CanonSideMenu defaultActive="Price Change Index" items={['Benchmark Finder', 'Category Builder', 'Cost Scan', 'Price Change Index', 'Should Cost Analysis · Później']} onNavigate={label => {
      if (label === 'Category Builder') {
        setCategoryId(definition.categoryId);
        go('category');
      } else if (label === 'Price Change Index') {
        go('home');
      } else setDialog('nav');
    }}>
 <main className="cci-main" ref={main} tabIndex={-1}>
 <div className="cci-breadcrumb"><CanonButton canonId="SRM-C03" usage="CCI:canonical-action-3" onClick={() => go('home')}>Cost Analysis</CanonButton><Icon name="chevron" size={12} /><CanonButton canonId="SRM-C03" usage="CCI:canonical-action-4" onClick={() => go('home')}>Price Change Index</CanonButton>{screen !== 'home' && <><Icon name="chevron" size={12} /><span>{screen === 'select' ? 'Nowy indeks' : screen === 'configure' ? 'Konfiguracja' : screen === 'category' ? 'Category Builder' : currentCategory.name}</span></>}</div>

 {screen === 'home' && <>
 <div className="cci-page-title"><div><p className="cci-eyebrow">HISTORIA KOSZTÓW · JEDNA WSPÓLNA BAZA</p><h1>Price Change Index<span>.</span></h1><p>Analizuj zmiany kosztów kategorii na podstawie benchmarków i ich udziałów w strukturze kosztów.</p></div><Button kind="primary" icon="plus" onClick={start}>Utwórz indeks CCI</Button></div>
 {scenario === 'empty' ? <div className="cci-empty"><span className="cci-empty-icon"><Icon name="chart" size={32} /></span><p className="cci-eyebrow">PIERWSZY KROK DO HISTORII KOSZTÓW</p><h2>Nie masz jeszcze indeksów kosztowych</h2><p>Wybierz gotową kategorię, aby przeanalizować dynamikę jej kosztów.<br />Wagi i benchmarki zostaną pobrane z Category Buildera.</p><Button kind="primary" icon="plus" onClick={start}>Utwórz pierwszy indeks</Button></div> : <><div className="cci-home-subhead"><h2>Moje modele <span>{new Set(saved.map(m => m.id)).size}</span></h2><span>Zapis w bieżącej sesji makiety</span></div><div className="cci-model-grid">{saved.filter(m => !saved.some(n => n.id === m.id && n.version > m.version)).map(m => {
                const idx = totalIndex(m, 2)!;
                return <article className="cci-model-card" key={m.id}><div className="cci-model-top"><span className="cci-model-symbol"><Icon name="cable" size={24} /></span><Badge status="ready">Kompletne dane</Badge></div><h3>{categoryOf(m).name}</h3><p>{m.name}</p><div className="cci-model-values"><div><small>Indeks kosztowy</small><strong>{fmt(idx)}</strong></div><div><small>Zmiana od bazy</small><b>↗ {signed(idx - 100)}%</b></div></div><div className="cci-mini-spark"><svg viewBox="0 0 320 55" aria-hidden="true"><path d="M2 47H318" stroke="#C4D5E2" strokeDasharray="4 4" /><path d="M2 47 160 28 318 6" stroke="#005A9C" strokeWidth="2.5" fill="none" /></svg><span>Baza = 100</span></div><dl className="cci-model-meta"><div><dt>Okres bazowy</dt><dd>{months[m.base]}</dd></div><div><dt>Ostatni kompletny miesiąc</dt><dd>Lipiec 2024</dd></div><div><dt>Wersja definicji</dt><dd>v{m.version}</dd></div><div><dt>Dane wejściowe</dt><dd>{m.dataRevision}</dd></div></dl><div className="cci-model-actions"><Button kind="primary" onClick={() => openModel(m)}>Otwórz analizę <Icon name="arrow" size={15} /></Button><Button kind="link" icon="edit" onClick={() => {
                      setDefinition(m);
                      setEditing(true);
                      setCategoryId(m.categoryId);
                      setName(m.name);
                      setBase(m.base);
                      setPolicy(m.currency);
                      setDescription(m.description);
                      go('configure');
                    }}>Konfiguracja</Button></div></article>;
              })}<CanonButton canonId="SRM-C03" usage="CCI:canonical-action-5" className="cci-new-model" onClick={start}><span><Icon name="plus" size={25} /></span><strong>Nowy indeks kosztowy</strong><p>Gotowa kategoria → okres bazowy → analiza</p><b>Wybierz kategorię <Icon name="arrow" size={15} /></b></CanonButton></div></>}
 <div className="cci-home-how"><div><span>01</span><h3>Wykorzystaj kategorię</h3><p>Jedna struktura kosztów z Category Buildera.</p></div><div><span>02</span><h3>Ustal wspólną bazę</h3><p>Benchmarki otrzymują indeks 100 w wybranym miesiącu.</p></div><div><span>03</span><h3>Zrozum zmianę kosztów</h3><p>Indeks historyczny i wpływ każdego komponentu.</p></div></div>
 </>}

 {screen === 'select' && <>
 <div className="cci-page-title"><div><p className="cci-eyebrow">NOWY INDEKS CCI · KROK 1 Z 2</p><h1>Wybierz kategorię zakupową<span>.</span></h1><p>Wykorzystaj komponenty, wagi i benchmarki zapisane w Category Builderze.</p></div><Button icon="back" onClick={() => go('home')}>Moje modele</Button></div>
 {scenario === 'no-categories' ? <div className="cci-empty"><span className="cci-empty-icon"><Icon name="layers" size={32} /></span><h2>Najpierw potrzebna jest kategoria</h2><p>Utwórz strukturę kosztów w Category Builderze.<br />Następnie wróć, aby nadać jej wymiar czasowy w CCI.</p><Button kind="primary" icon="external" onClick={() => {
              setCategoryId('cable');
              go('category');
            }}>Przejdź do Category Buildera</Button></div> : <section className="cci-panel cci-category-list"><div className="cci-category-tools"><label><Icon name="search" size={16} /><CanonInput canonId="SRM-C06" usage="CCI:category-search" aria-label="Szukaj kategorii" value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj kategorii…" /></label><span>{categories.length} kategorie · 2 gotowe</span></div>{categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => <article className={'cci-category-row ' + (!c.ready ? 'is-draft' : '')} key={c.id}><span className="cci-category-icon"><Icon name="layers" size={23} /></span><div className="cci-category-main"><div><h3>{c.name}</h3><Badge status={c.ready ? 'ready' : 'draft'} /></div><p>{c.components.length} komponentów <span>·</span>{c.components.reduce((s, x) => s + x.weight, 0)}% kosztów <span>·</span>{c.revision}</p>{!c.ready && <small>Brakuje 35% udziałów i przypisania benchmarku Plastic.</small>}</div><div className="cci-category-actions"><Button kind="link" icon="external" onClick={() => {
                  setCategoryId(c.id);
                  go('category');
                }}>Category Builder</Button><Button kind={c.ready ? 'primary' : 'secondary'} disabled={!c.ready} onClick={() => choose(c)}>Wybierz kategorię <Icon name="arrow" size={15} /></Button></div></article>)}{!categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).length && <div className="cci-no-results">Brak pasujących kategorii. <CanonButton canonId="SRM-C03" usage="CCI:canonical-action-6" onClick={() => setSearch('')}>Wyczyść wyszukiwanie</CanonButton></div>}<footer><span><Icon name="info" size={15} />READY potwierdza strukturę kategorii. Historię danych sprawdzimy w następnym kroku.</span><Button kind="link" icon="plus" onClick={() => go('category')}>Utwórz nową kategorię</Button></footer></section>}
 </>}

 {screen === 'configure' && <>
 <div className="cci-page-title"><div><p className="cci-eyebrow">{editing ? 'NOWA WERSJA DEFINICJI MODELU' : 'NOWY INDEKS CCI · KROK 2 Z 2'}</p><h1>Konfiguracja CCI<span>.</span></h1><p>Struktura już jest. Wybierz okres bazowy i sposób interpretacji walut.</p></div><Badge status={readiness}>{readiness === 'ready' ? 'Gotowy do obliczenia' : readiness === 'partial' ? 'Częściowe dane' : 'Wymaga uzupełnienia'}</Badge></div>
 {editing && <Notice title={'Powstanie nowa wersja v' + config.version}>Poprzednia definicja v{definition.version} zachowa zapisane udziały i benchmarki. Odświeżenie notowań ma osobną wersję danych.</Notice>}
 <div className="cci-config-grid"><div className="cci-config-left"><section className="cci-panel"><SectionTitle number="01" title="Informacje o modelu" /><div className="cci-fields"><label><span>Nazwa modelu</span><CanonInput canonId="SRM-C06" usage="CCI:model-name" value={name} maxLength={100} onChange={e => setName(e.target.value)} required /></label><div className="cci-source-category"><small>Kategoria źródłowa</small><strong>{category.name}</strong><span><Icon name="lock" size={12} />{category.revision} · struktura pobrana z Category Buildera</span></div><label><span>Opis <small>opcjonalnie</small></span><CanonTextarea canonId="SRM-C06" usage="CCI:description" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="np. Model do przeglądu zmian cen w kontrakcie" /></label></div></section>
 <section className="cci-panel"><SectionTitle number="02" title="Parametry analizy" /><div className="cci-fields"><div className="cci-field-pair"><label><span>Okres bazowy</span><CanonSelect canonId="SRM-C07" usage="CCI:base-period" aria-label="Okres bazowy" value={base} onChange={e => {
                        setBase(Number(e.target.value));
                        if (scenario === 'missing-base') setScenario('ready');
                      }}><option value={-1}>Kwiecień 2024 · brak danych</option><option value={0}>Maj 2024</option><option value={1}>Czerwiec 2024</option></CanonSelect><small>W tym miesiącu indeks wynosi 100.</small></label><label><span>Częstotliwość</span><div className="cci-readonly">Miesięczna <Icon name="lock" size={14} /></div><small>Jednolita częstotliwość w MVP.</small></label></div>
 <fieldset className="cci-currency"><legend>Polityka walutowa</legend><label className={policy === 'original' ? 'selected' : ''}><input type="radio" name="currency-policy" checked={policy === 'original'} onChange={() => setPolicy('original')} /><span><strong>Oryginalne waluty benchmarków</strong><small>Zmiany rynkowe bez dodatkowego wpływu kursów walut. Wynik jest indeksem, a nie kosztem w PLN.</small></span></label><label className={policy !== 'original' ? 'selected' : ''}><input type="radio" name="currency-policy" checked={policy !== 'original'} onChange={() => setPolicy('PLN')} /><span><strong>Ekspozycja w wybranej walucie</strong><small>Uwzględnia historyczne FX dla szeregów cenowych. Indeksy bez waluty zachowują swoją dynamikę.</small></span></label>{policy !== 'original' && <label className="cci-target-currency"><span>Waluta analizy</span><CanonSelect canonId="SRM-C07" usage="CCI:currency" aria-label="Waluta ekspozycji kosztowej" value={policy} onChange={e => setPolicy(e.target.value as CurrencyPolicy)}><option value="PLN">PLN — polski złoty</option><option value="EUR">EUR — euro</option></CanonSelect></label>}</fieldset>
 <details className="cci-advanced"><summary><span><Icon name="info" size={14} />Ustawienia zaawansowane i metodologia</span><Icon name="down" size={14} /></summary><div><p>Reguły miesięczne wynikają z semantyki źródła. Średnia dla cen dziennych, opublikowany poziom dla wskaźników miesięcznych. Brakujące obserwacje nie są zastępowane zerami.</p><p>Indeks komponentu = wartość w miesiącu / wartość bazowa × 100. CCI = suma indeksów komponentów × ich stałe udziały z zapisanej definicji.</p><CanonButton canonId="SRM-C03" usage="CCI:canonical-action-7" className="cci-inline-link" onClick={() => setDialog('method')}>Sprawdź pełną metodologię <Icon name="arrow" size={13} /></CanonButton></div></details></div></section></div>
 <div className="cci-config-right"><section className="cci-panel"><SectionTitle number="03" title="Struktura kosztów" subtitle="Z Category Buildera · tylko do odczytu"><span className="cci-lock-tag"><Icon name="lock" size={12} />Snapshot</span></SectionTitle>{renderBreakdown(category)}<p className="cci-panel-caption">Zmiany kategorii nie nadpisują wcześniej zapisanych wersji CCI.</p></section>
 <section className="cci-panel cci-readiness"><SectionTitle number="04" title="Gotowość danych" subtitle="Osobna kontrola historii benchmarków"><Badge status={readiness} /></SectionTitle><ul>{[[true, 'Udziały komponentów', '100% · ' + category.components.length + ' komponentów'], [hasBase, 'Wspólny okres bazowy', !hasBase ? 'Brak bazowej obserwacji: ' + baseMissingName : months[base] + ' · dostępny dla wszystkich'], [true, 'Wyrównanie częstotliwości', 'Miesięcznie · zgodnie z semantyką źródeł'], [scenario !== 'partial', 'Ciągłość historii', scenario === 'partial' ? 'Czerwiec: Labor — brak obserwacji' : 'Pełne pokrycie dostępnych miesięcy'], [!(scenario === 'fx' && policy !== 'original'), 'Historyczne kursy FX', policy === 'original' ? 'Nie są wymagane' : scenario === 'fx' ? 'Brak USD/' + policy + ' dla lipca 2024' : 'Dostępne · dane demonstracyjne']].map(([ok, title, text]) => <li key={String(title)}><span className={ok ? 'cci-good' : 'cci-warn'}><Icon name={ok ? 'check' : 'warning'} size={16} /></span><div><strong>{title}</strong><small>{text}</small></div></li>)}</ul>
 {!hasBase && <Notice tone="danger" title="Brak danych dla okresu bazowego" action={<Button kind="link" onClick={() => {
                  setBase(0);
                  setScenario('ready');
                }}>Wybierz wspólny okres: maj 2024 <Icon name="arrow" size={14} /></Button>}>Brak obserwacji {baseMissingName} dla wybranego okresu bazowego. Proponowana baza wymaga świadomego wyboru.</Notice>}
 {scenario === 'fx' && policy !== 'original' && <Notice tone="danger" title="Konwersja walutowa niedostępna" action={<Button kind="link" onClick={() => setPolicy('original')}>Wybierz oryginalne waluty</Button>}>Brak kursu USD/{policy}. Nie można obliczyć indeksu w tej konwencji.</Notice>}
 {scenario === 'partial' && hasBase && <Notice tone="warning" title="Luka w czerwcu 2024">Można obliczyć pełne miesiące. Czerwiec i zmiana m/m za lipiec pozostaną bez wyniku.</Notice>}
 {scenario === 'stale' && <Notice tone="warning" title="Opóźniona publikacja Energy">W scenariuszu oczekiwano sierpnia 2024. Ostatnia obserwacja: lipiec 2024. Analiza kończy się na ostatnim wspólnym miesiącu.</Notice>}
 <div className="cci-complete-period"><Icon name="calendar" size={17} /><div><small>Ostatni kompletny miesiąc</small><strong>{readiness === 'blocked' ? 'Nie można ustalić wyniku' : 'Lipiec 2024'}</strong></div></div></section></div></div>
 <div className="cci-config-footer"><Button icon="back" onClick={() => editing ? go('dashboard') : go('select')}>Wróć</Button><span><Icon name="lock" size={14} />Zapisane udziały pozostają stałe w czasie.</span><Button kind="primary" icon={busy ? 'refresh' : 'chart'} disabled={busy || readiness === 'blocked' || !name.trim()} onClick={calculate}>{busy ? 'Obliczanie CCI…' : editing ? 'Oblicz nową wersję CCI' : 'Utwórz i oblicz CCI'}</Button></div>
 {busy && <div className="cci-calculating" role="status" aria-live="polite"><span className="cci-spinner" /><strong>Obliczanie indeksu</strong><p>{category.name} · baza {months[base]}</p><small>Normalizacja benchmarków i agregacja udziałów…</small></div>}
 </>}

 {screen === 'dashboard' && <>
 <div className="cci-dashboard-title"><div><p className="cci-eyebrow">COST CHANGE INDEX</p><h1>{currentCategory.name}</h1><p><span>Baza: <strong>{months[definition.base]}</strong></span><i>·</i>Miesięcznie<i>·</i>{definition.components.length} komponentów<i>·</i><CanonButton canonId="SRM-C03" usage="CCI:canonical-action-8" onClick={() => setDialog('versions')}>Model v{definition.version}<Icon name="down" size={12} /></CanonButton></p></div><div className="cci-title-actions"><Button icon="edit" onClick={edit}>Edytuj model</Button><Button kind={isSaved ? 'secondary' : 'primary'} icon={isSaved ? 'check' : 'save'} onClick={save} disabled={isSaved}>{isSaved ? 'Zapisano w makiecie' : 'Zapisz model'}</Button></div></div>
 <div className="cci-analysis-strip"><span><Icon name="calendar" size={14} />Analizowany miesiąc <strong>{months[selected]}</strong></span><CanonButton canonId="SRM-C03" usage="CCI:canonical-action-9" onClick={() => setDialog('method')}><Icon name="info" size={14} />{currencyLabel(definition.currency)}<Icon name="chevron" size={12} /></CanonButton><Badge status={activeScenario === 'partial' ? 'partial' : activeScenario === 'stale' ? 'stale' : dataStatus(definition, activeScenario)} /></div>
 {activeScenario === 'partial' && <Notice tone="warning" title="Historia zawiera niekompletny miesiąc">Czerwiec: 4/5 komponentów. CCI nie jest wyliczany dla luki; lipcowa zmiana m/m pozostaje niedostępna.</Notice>}
 {activeScenario === 'stale' && <Notice tone="warning" title="Energy: opóźniona publikacja">Ostatnie dostępne dane: lipiec 2024. Oczekiwany kolejny miesiąc w tym scenariuszu: sierpień 2024. Wynik dotyczy wskazanego miesiąca historycznego.</Notice>}
 {dataStatus(definition, activeScenario) === 'blocked' && <Notice tone="danger" title="Brak danych wymaganych do obliczenia" action={<Button onClick={edit}>Sprawdź konfigurację</Button>}>Wynik nie jest dostępny. Uzupełnij bazę lub wybierz dostępną politykę walutową.</Notice>}
 <div className="cci-kpis"><article className="cci-kpi cci-kpi-primary" data-library-component="SRM-C13"><div><span>Indeks kosztowy</span><Icon name="chart" size={18} /></div><strong>{fmt(current)}</strong><p>Baza = 100 <span>{months[definition.base]}</span></p></article><article className="cci-kpi" data-library-component="SRM-C13"><div><span>Zmiana od bazy</span><Icon name="up" size={17} /></div><strong>{signed(current == null ? null : current - 100)}<small>{current == null ? '' : '%'}</small></strong><p>Od {['maja 2024', 'czerwca 2024', 'lipca 2024'][definition.base]}</p></article><article className="cci-kpi" data-library-component="SRM-C13"><div><span>Zmiana miesięczna</span><Icon name="history" size={17} /></div><strong>{signed(monthChange)}<small>{monthChange == null ? '' : '%'}</small></strong><p>{selected <= definition.base ? 'Miesiąc bazowy' : monthChange == null ? 'Brak pełnego poprzedniego miesiąca' : months[selected] + ' vs ' + months[selected - 1].toLowerCase()}</p></article><article className="cci-kpi" data-library-component="SRM-C13"><div><span>Pokrycie danych</span><Icon name={coverage === definition.components.length ? 'check' : 'warning'} size={17} /></div><strong>{coverage}<small> / {definition.components.length}</small></strong><p>{months[selected]} <span className={coverage === definition.components.length ? 'cci-good' : 'cci-warn'}>{coverage === definition.components.length ? 'Kompletne' : 'Niekompletne'}</span></p></article></div>
 <div className="cci-dashboard-grid"><section className="cci-panel cci-history-panel"><SectionTitle title="Historia indeksu kosztowego" subtitle={'Od ' + ['maja 2024', 'czerwca 2024', 'lipca 2024'][definition.base] + ' do lipca 2024'}><CanonButton canonId="SRM-C03" usage="CCI:canonical-action-10" className="cci-text-action" onClick={() => setDialog('method')}><Icon name="info" size={14} />Metodologia</CanonButton></SectionTitle><CCIChart definition={definition} scenario={activeScenario} selected={selected} onSelect={setSelected} /></section><section className="cci-panel cci-drivers"><SectionTitle title="Co wpłynęło na koszt?" subtitle={'Wpływ od bazy · ' + months[selected]} /><div className="cci-drivers-caption"><span>Komponent / udział</span><span>Wkład w p.p.</span></div><div className="cci-driver-list">{definition.components.map(c => {
                  const idx = componentIndex(c, definition, selected, activeScenario),
                    v = idx == null ? null : (idx - 100) * c.weight / 100;
                  return <CanonButton canonId="SRM-C03" usage="CCI:canonical-action-11" key={c.id} className="cci-driver" onClick={() => setDetail(c)} aria-label={'Szczegóły ' + c.name}><span className="cci-driver-label"><span><i className="cci-dot" style={{
                          background: c.color
                        }} />{c.name}<small>{c.weight}%</small></span><strong className={v != null && v < 0 ? 'is-down' : ''}>{signed(v)} <small>p.p.</small></strong></span><span className="cci-driver-track"><i className="cci-driver-zero" /><i className={'cci-driver-bar ' + (v != null && v < 0 ? 'negative' : '')} style={{
                        left: v != null && v < 0 ? 18 - Math.min(Math.abs(v) / 12 * 74, 16) + '%' : '18%',
                        width: v == null ? '0%' : Math.max(Math.min(Math.abs(v) / 12 * 74, v < 0 ? 16 : 74), .7) + '%'
                      }} /></span></CanonButton>;
                })}</div><div className="cci-drivers-total"><span>Łączna zmiana</span><strong>{signed(current == null ? null : current - 100)} <small>p.p.</small></strong></div><p>Wkład = udział × zmiana benchmarku.<br />Kliknij komponent, aby sprawdzić dane.</p></section></div>
 <section className="cci-panel cci-components-panel"><SectionTitle title="Składniki indeksu" subtitle={months[definition.base] + ' → ' + months[selected] + ' · stałe udziały modelu'}><span className="cci-snapshot-tag"><Icon name="lock" size={12} />Definicja v{definition.version}</span></SectionTitle><div className="cci-table-scroll"><table className="cci-table cci-breakdown"><thead><tr><th>Komponent / benchmark</th><th>Udział</th><th>Indeks komponentu</th><th>Zmiana benchmarku <small>od bazy</small></th><th>Wkład w CCI <small>punkty procentowe</small></th><th><span className="cci-sr">Szczegóły</span></th></tr></thead><tbody>{definition.components.map(c => {
                    const idx = componentIndex(c, definition, selected, activeScenario);
                    return <tr key={c.id}><td><CanonButton canonId="SRM-C03" usage="CCI:canonical-action-12" onClick={() => setDetail(c)}><i className="cci-dot" style={{
                            background: c.color
                          }} /><span><strong>{c.name}</strong><small>{c.benchmark}</small></span></CanonButton></td><td>{c.weight}%</td><td>{fmt(idx)}</td><td>{idx == null ? 'Brak danych' : signed(idx - 100) + '%'}</td><td><strong>{signed(idx == null ? null : (idx - 100) * c.weight / 100)} p.p.</strong></td><td><CanonButton canonId="SRM-C04" usage="CCI:canonical-action-13" className="cci-icon-button" onClick={() => setDetail(c)} aria-label={'Otwórz szczegóły ' + c.name}><Icon name="chevron" size={16} /></CanonButton></td></tr>;
                  })}</tbody><tfoot><tr><th>Łącznie</th><td>100%</td><td>{fmt(current)}</td><td>—</td><td><strong>{signed(current == null ? null : current - 100)} p.p.</strong></td><td /></tr></tfoot></table></div></section>
 <div className="cci-below-dashboard"><div><Icon name="info" size={16} /><p>Stała struktura kosztów z Category Buildera. Dane: <CanonButton canonId="SRM-C03" usage="CCI:canonical-action-14" onClick={() => setDialog('versions')}>{definition.dataRevision}</CanonButton>. <CanonButton canonId="SRM-C03" usage="CCI:canonical-action-15" onClick={() => setDialog('method')}>Sprawdź metodologię i pochodzenie danych</CanonButton></p></div><Button icon="chart" onClick={() => setDialog('price')}>Moja cena <span className="cci-option-tag">Symulacja</span></Button></div>
 </>}

 {screen === 'category' && <><div className="cci-page-title"><div><p className="cci-eyebrow">POWIĄZANIE Z CATEGORY BUILDER · PODGLĄD UX</p><h1>{category.name}<span>.</span></h1><p>Category Builder pozostaje właścicielem komponentów, wag i przypisań benchmarków.</p></div><Badge status={category.ready ? 'ready' : 'draft'} /></div><Notice title="Przejście do istniejącej funkcjonalności">Ten ekran pokazuje punkt wejścia „Analizuj CCI”. Edytor Category Buildera pozostaje poza tą makietą; nie zapisujemy zmian w źródłowej kategorii.</Notice><section className="cci-panel cci-category-preview"><SectionTitle title="Zapisana struktura kategorii" subtitle={category.revision} />{renderBreakdown(category, false)}<div className="cci-category-preview-actions"><Button icon="back" onClick={() => go('select')}>Wróć do kategorii</Button><Button kind="primary" icon="chart" disabled={!category.ready} onClick={() => choose(category)}>Analizuj CCI</Button></div>{!category.ready && <Notice tone="warning" title="Uzupełnij kategorię w Category Builderze">Wagi: 65%. Benchmark Plastic nie został przypisany. Analiza pozostaje niedostępna.</Notice>}</section></>}
 <footer className="cci-footer"><span><i />Makieta UX · wszystkie notowania i identyfikatory są fikcyjne</span><span>CCI MVP v1 <i>·</i> Bez prognoz i eksportu</span></footer>
 </main></CanonSideMenu>

 {detail && <Dialog wide title={detail.name} subtitle={detail.benchmark + ' · komponent modelu v' + definition.version} onClose={() => setDetail(null)}><div className="cci-detail-kpis"><div><small>Udział w kosztach</small><strong>{detail.weight}%</strong></div><div><small>Zmiana od bazy</small><strong>{signed(componentIndex(detail, definition, selected, activeScenario) == null ? null : componentIndex(detail, definition, selected, activeScenario)! - 100)}%</strong></div><div><small>Wkład w CCI</small><strong>{signed(componentIndex(detail, definition, selected, activeScenario) == null ? null : (componentIndex(detail, definition, selected, activeScenario)! - 100) * detail.weight / 100)} <em>p.p.</em></strong></div></div><section className="cci-detail-chart"><SectionTitle title="Historia komponentu" subtitle="Wspólna baza = 100 · porównanie z kategorią" /><CCIChart definition={definition} scenario={activeScenario} selected={selected} onSelect={setSelected} component={detail} compact /></section><div className="cci-detail-values"><div><small>Wartość źródłowa w bazie</small><strong>{fmt(detail.values[definition.base])} <span>{detail.unit}</span></strong><small>{months[definition.base]}</small></div><Icon name="arrow" /><div><small>Wartość źródłowa w wybranym miesiącu</small><strong>{activeScenario === 'partial' && selected === 1 && detail.id === 'labor' ? '—' : fmt(detail.values[selected])} <span>{detail.unit}</span></strong><small>{months[selected]}</small></div></div><details className="cci-provenance" open><summary><h3>Dane źródłowe i metodologia</h3><Icon name="down" size={15} /></summary><dl><div><dt>Dostawca danych</dt><dd>Źródło demonstracyjne <small>Bez połączenia z Macrobond</small></dd></div><div><dt>Identyfikator benchmarku</dt><dd><code>DEMO-{detail.id.toUpperCase()}-001</code><small>Fikcyjny identyfikator makiety</small></dd></div><div><dt>Jednostka / waluta źródłowa</dt><dd>{detail.unit} · {detail.currency === '—' ? 'Bez waluty' : detail.currency}</dd></div><div><dt>Częstotliwość publikacji</dt><dd>{detail.frequency}</dd></div><div><dt>Agregacja miesięczna</dt><dd>{detail.aggregation}</dd></div><div><dt>Normalizacja</dt><dd>Wartość / wartość bazowa × 100</dd></div><div><dt>Polityka walutowa</dt><dd>{currencyLabel(definition.currency)}</dd></div><div><dt>Ostatnia obserwacja</dt><dd>31.07.2024 <small>Data demonstracyjna</small></dd></div><div><dt>Wersja danych wejściowych</dt><dd>{definition.dataRevision}</dd></div><div><dt>Pokrycie historii</dt><dd>{activeScenario === 'partial' && detail.id === 'labor' ? '2/3 miesiące · luka w czerwcu' : '3/3 miesiące w próbce'}</dd></div></dl></details>{activeScenario === 'partial' && detail.id === 'labor' && <Notice tone="warning" title="Brak obserwacji za czerwiec">Wartość nie jest interpolowana. CCI dla czerwca i lipcowa zmiana m/m nie są dostępne.</Notice>}{activeScenario === 'stale' && detail.id === 'energy' && <Notice tone="warning" title="Publikacja opóźniona">Oczekiwany sierpień 2024; ostatnia obserwacja lipiec 2024.</Notice>}<p className="cci-demo-disclaimer"><Icon name="info" size={14} />Wartości pokazują mechanikę CCI. Nie są rzeczywistymi notowaniami ani identyfikatorami Macrobond.</p></Dialog>}

 {dialog === 'method' && <Dialog title="Jak obliczany jest CCI?" subtitle="Stałe udziały · wspólny okres bazowy · miesięczne dane" onClose={() => setDialog(null)}><div className="cci-method"><p>CCI pokazuje historyczną zmianę modelowanego kosztu kategorii. Każdy benchmark otrzymuje indeks 100 w tym samym miesiącu bazowym.</p><div className="cci-formula">CCI(t) = Σ udział(i) × indeks(i,t)<small>Indeks(i,t) = wartość(i,t) / wartość(i,baza) × 100</small></div><h3>Wpływ komponentu, czyli wkład w p.p.</h3><p>Dla Copper: udział 60% × wzrost benchmarku 20% = <strong>+12,00 p.p.</strong> Suma wkładów odpowiada skumulowanej zmianie CCI od bazy. Wkład nie jest zmianą ceny samego komponentu.</p><h3>Oryginalna waluta i ekspozycja kosztowa</h3><p>Analiza w oryginalnych walutach zachowuje dynamikę źródeł. Ekspozycja w PLN lub EUR uwzględnia historyczne FX dla serii cenowych przed normalizacją. Dla indeksów bez waluty nie stosuje się dodatkowego FX. Te warianty mogą dawać różne wyniki.</p><h3>Spójna częstotliwość</h3><p>Dane dzienne i tygodniowe są agregowane zgodnie z semantyką benchmarku. Poziom miesięcznego wskaźnika jest wykorzystywany bez dodatkowego uśredniania. Szczegóły znajdują się przy każdym komponencie.</p><h3>Brakujące obserwacje</h3><p>Brak w bazie blokuje obliczenie. Niekompletny miesiąc pozostaje luką na wykresie; wagi nie są przeliczane na dostępne komponenty. Zmiana m/m wymaga dwóch kolejnych kompletnych miesięcy.</p><h3>Definicja a aktualizacja danych</h3><p>Zmiana bazy, waluty, udziałów lub przypisań benchmarków tworzy nową wersję definicji. Nowe notowania tworzą osobną rewizję danych wejściowych. Obie informacje są potrzebne do odtworzenia wyniku.</p><Notice title="Prototyp, bez danych rynkowych">Wszystkie serie, stawki FX i identyfikatory są fikcyjne. Pochodzenie kanonu: biblioteka SRM i Benchmark Finder, stan z 20.10.2026.</Notice></div></Dialog>}
 {dialog === 'versions' && <Dialog title="Definicja i wersje modelu" subtitle={definition.id + ' · ' + definition.name} onClose={() => setDialog(null)}><Notice title="Dwie niezależne wersje">Definicja v{definition.version} opisuje strukturę, bazę i waluty. Dane {definition.dataRevision} opisują notowania użyte do obliczenia.</Notice><dl className="cci-version-meta"><div><dt>Kategoria źródłowa</dt><dd>{currentCategory.name} · {currentCategory.revision}</dd></div><div><dt>Okres bazowy</dt><dd>{months[definition.base]}</dd></div><div><dt>Polityka walutowa</dt><dd>{currencyLabel(definition.currency)}</dd></div><div><dt>Data utworzenia / aktualizacji w makiecie</dt><dd>{definition.created}</dd></div><div><dt>Status</dt><dd>{isSaved ? 'Zapisany w bieżącej sesji' : 'Obliczony · niezapisany'}</dd></div></dl><h3 className="cci-dialog-section-title">Zapisane definicje</h3><div className="cci-version-list">{saved.filter(m => m.id === definition.id).map(m => <CanonButton canonId="SRM-C03" usage="CCI:canonical-action-16" key={m.version} onClick={() => openModel(m)}><span><Icon name="history" size={18} /><strong>Definicja v{m.version}</strong><small>{months[m.base]} · {currencyLabel(m.currency)}</small></span><span>{m.version === definition.version ? 'Otwarta' : 'Otwórz'}<Icon name="chevron" size={15} /></span></CanonButton>)}</div>{!saved.some(m => m.id === definition.id) && <p>Model nie został jeszcze zapisany.</p>}<div className="cci-dialog-actions"><Button icon="edit" onClick={edit}>Utwórz nową wersję</Button><Button kind="primary" icon="save" disabled={isSaved} onClick={save}>{isSaved ? 'Wersja zapisana' : 'Zapisz tę wersję'}</Button></div><p className="cci-demo-disclaimer">Zapis i historia wersji działają w bieżącej sesji makiety. Trwała persystencja wymaga późniejszej implementacji.</p></Dialog>}
 {dialog === 'price' && <Dialog title="Moja cena" subtitle="Opcjonalna symulacja ceny na podstawie indeksu" onClose={() => setDialog(null)}><div className="cci-price-intro"><Icon name="chart" size={22} /><p>Przenieś zmianę CCI na własną cenę bazową. To symulacja indeksowanej ceny, a nie niezależnie skalkulowany koszt zasadny produktu.</p></div><div className="cci-fields"><label><span>Moja cena bazowa</span><CanonInput canonId="SRM-C06" usage="CCI:base-price" type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></label><div className="cci-field-pair"><label><span>Waluta ceny</span><CanonSelect canonId="SRM-C07" usage="CCI:price-currency" aria-label="Waluta ceny bazowej" value={priceCurrency} onChange={e => setPriceCurrency(e.target.value)}><option>PLN</option><option>EUR</option><option>USD</option></CanonSelect></label><label><span>Jednostka</span><CanonInput canonId="SRM-C06" usage="CCI:price-unit" value={unit} onChange={e => setUnit(e.target.value)} maxLength={20} placeholder="np. km" /></label></div><div className="cci-price-base"><Icon name="lock" size={15} />Okres bazowy: {months[definition.base]} · zgodny z CCI</div></div>{Number(price) > 0 && unit.trim() && current != null ? <div className="cci-price-result"><small>Symulowana cena · {months[selected]}</small><strong>{fmt(Number(price) * current / 100)} <span>{priceCurrency}/{unit}</span></strong><div><span>Cena bazowa: {fmt(Number(price))} {priceCurrency}/{unit}</span><span>CCI: {fmt(current)}</span></div><p>Zmiana: <b>{signed(Number(price) * (current / 100 - 1))} {priceCurrency}/{unit}</b></p></div> : <Notice tone="warning" title="Uzupełnij dane symulacji">Wymagana jest dodatnia cena bazowa, jednostka i kompletny wynik CCI.</Notice>}<p className="cci-demo-disclaimer">Waluta ceny określa jednostkę symulacji. Nie zmienia polityki FX zapisanej w modelu CCI.</p></Dialog>}
 {dialog === 'nav' && <Dialog title="Istniejące funkcjonalności SpendGuru" onClose={() => setDialog(null)}><div className="cci-method"><h3>Benchmark Finder</h3><p>Wyszukiwanie i wybór źródłowych benchmarków. Przypisania do komponentów pozostają w Category Builderze.</p><h3>Cost Scan</h3><p>Szybka analiza zmian w wybranym okresie. CCI rozwija historię indeksu od wspólnej bazy, wykorzystując istniejące szeregi rynkowe.</p><Notice title="Zakres projektu CCI">Nawigacja jest pokazana jako koncepcja UX. Pozostałe projekty MagicPath i działająca aplikacja nie są zmieniane.</Notice></div></Dialog>}
 {toast && <div className="cci-toast" role="status"><Icon name="check" size={17} />{toast}<CanonButton canonId="SRM-C03" usage="CCI:canonical-action-17" onClick={() => setToast('')} aria-label="Zamknij powiadomienie"><Icon name="close" size={14} /></CanonButton></div>}
 </div>;
};
return {CCIKlIkalnyPrzepYwAnalizyKosztW};
}
