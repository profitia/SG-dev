'use client';
/** MagicPath C71/C81–C85/C92–C93 presentation adapters. No provider, forecast, search or identity operations. */
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
const CanonButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
    canonId?: string;
    usage?: string;
}>(function VisualButton({ canonId, usage, ...props }, ref) { return <button {...props} ref={ref} data-library-component={canonId} data-canon-usage={usage}/>; });
const CanonElement = React.forwardRef<HTMLElement, {
    as: React.ElementType;
    canonId?: string;
    usage?: string;
    [key: string]: any;
}>(function VisualElement({ as, canonId, usage, ...props }, ref) { return React.createElement(as, { ...props, ref, 'data-library-component': canonId, 'data-canon-usage': usage }); });
function CanonCloseButton({ canonId, usage, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    canonId?: string;
    usage?: string;
}) { return <button {...props} type="button" className="srm-close-window" aria-label="Zamknij"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m6 6 12 12M18 6 6 18"/></svg></button>; }
/** CHT-09 · C81–82 · B58: one source for the chart drawer specimen. */
export const chartControlPanelCanon = {
    surface: 'var(--canvas,#F8F9FA)',
    forecastSurfaceFade: '38%',
    panelShadowBlur: '1rem', panelShadowSpread: '.125rem',
    panelShadowExtent: '1.5rem', panelShadowColor: 'var(--theme-panel-shadow,rgb(0 51 102 / .06))',
    duration: '320ms', easing: 'cubic-bezier(.22,1,.36,1)',
    plotMinHeight: '32rem', edgeInset: '0rem', radius: '0rem', padding: '1rem', gap: '1rem', rows: 3, rowHeight: '2.25rem', rowGap: '.5rem',
    ribbonWidth: '2.25rem', ribbonHeight: '2.25rem', ribbonRadius: '1.125rem',
    toolsRibbonTop: '0rem', toolsWidth: '6rem', toolsColumn: '2.25rem', toolsGap: '.375rem', toolsPadding: '.5rem',
    symbolSize: '2.25rem'
} as const;
export const chartControlPanelVariables = {
    // CHT-12: derives from the face diameter, including future size changes.
    '--chart-control-corner-radius': `calc(${chartControlPanelCanon.symbolSize} / 2)`,
    '--chart-panel-surface': chartControlPanelCanon.surface,
    '--chart-forecast-surface-fade': chartControlPanelCanon.forecastSurfaceFade,
    '--chart-panel-shadow-blur': chartControlPanelCanon.panelShadowBlur,
    '--chart-panel-shadow-spread': chartControlPanelCanon.panelShadowSpread,
    '--chart-panel-shadow-extent': chartControlPanelCanon.panelShadowExtent,
    '--chart-panel-shadow-color': chartControlPanelCanon.panelShadowColor,
    '--chart-panel-edge-inset': chartControlPanelCanon.edgeInset,
    '--chart-tools-width': chartControlPanelCanon.toolsWidth,
    '--chart-tools-ribbon-top': chartControlPanelCanon.toolsRibbonTop,
    '--chart-tools-column': chartControlPanelCanon.toolsColumn,
    '--chart-tools-gap': chartControlPanelCanon.toolsGap,
    '--chart-tools-pad': chartControlPanelCanon.toolsPadding,
    '--chart-controls-duration': chartControlPanelCanon.duration,
    '--chart-controls-easing': chartControlPanelCanon.easing,
    '--chart-controls-radius': chartControlPanelCanon.radius,
    '--chart-controls-pad': chartControlPanelCanon.padding,
    '--chart-controls-gap': chartControlPanelCanon.gap,
    '--chart-controls-rows': chartControlPanelCanon.rows,
    '--chart-controls-row-height': chartControlPanelCanon.rowHeight,
    '--chart-controls-row-gap': chartControlPanelCanon.rowGap,
    '--chart-controls-ribbon-width': chartControlPanelCanon.ribbonWidth,
    '--chart-controls-ribbon-height': chartControlPanelCanon.ribbonHeight,
    '--chart-controls-ribbon-radius': chartControlPanelCanon.ribbonRadius,
    '--chart-controls-symbol-size': chartControlPanelCanon.symbolSize,
};
/** I25/I26. Shared glyphs for the control panel and the icon gallery. */
export function CanonChartControlGlyph({ kind, size = 18, stroke = 1.6, pinned = false }: {
    kind: 'settings-sliders' | 'pin' | 'toolbox';
    size?: number;
    stroke?: number;
    pinned?: boolean;
}) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'settings-sliders' ? <>
      <path d="M3 6h4m4 0h10M3 12h10m4 0h4M3 18h4m4 0h10"/>
      <circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>
    </> : kind === 'toolbox' ? <><rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v3h4v-3"/></> : <g transform={pinned ? undefined : 'rotate(30 12 12)'}>
      <path d="M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6Z" fill={pinned ? 'currentColor' : 'none'} fillOpacity={pinned ? '.15' : undefined}/>
      <path d="M12 15v6"/>
    </g>}
  </svg>;
}
/** Independent chart drawers: ribbon toggles, Escape closes the focused panel. */
export function useChartPanel(onOpenChange?: (open: boolean) => void) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const id = useId().replace(/:/g, '') + '-chart-panel';
    useLayoutEffect(() => {
        if (panel.current)
            panel.current.inert = !open;
        onOpenChange?.(open);
    }, [open, onOpenChange]);
    useEffect(() => {
        if (!open)
            return;
        const key = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || !root.current?.contains(document.activeElement))
                return;
            event.preventDefault();
            setOpen(false);
            trigger.current?.focus({ preventScroll: true });
        };
        document.addEventListener('keydown', key);
        return () => document.removeEventListener('keydown', key);
    }, [open]);
    const toggle = () => setOpen(current => !current);
    return { open, root, panel, trigger, id, toggle };
}
/** C81 panel and C82 edge ribbon. Explicit toggling preserves chart options. */
export function CanonChartControlPanel({ children, content, onOpenChange, onHeightChange }: {
    children: React.ReactNode;
    content?: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
    onHeightChange?: (height: number) => void;
}) {
    const { open, root, panel, trigger, id, toggle } = useChartPanel(onOpenChange);
    // Report the animated layout height, so the plot gives back exactly the same
    // space in each frame. No second animation or height-dependent resize loop.
    useLayoutEffect(() => {
        const element = root.current;
        if (!element || !onHeightChange)
            return;
        const report = () => onHeightChange(element.getBoundingClientRect().height);
        report();
        const observer = new ResizeObserver(report);
        observer.observe(element);
        return () => observer.disconnect();
    }, [onHeightChange]);
    return <div ref={root} className="srm-chart-controls" style={chartControlPanelVariables as React.CSSProperties} data-open={open}>
    <div className="srm-chart-controls-drawer">
      <div ref={panel} id={id} className="srm-chart-controls-clip" aria-hidden={!open || undefined}>
        <CanonElement as="section" canonId="SRM-C81" usage="CanonChartControlPanel:panel" className="srm-chart-controls-card" aria-label="Ustawienia wykresu">
          {content ?? <div className="srm-chart-controls-rows">
            <div className="srm-chart-controls-options" data-controls-row="1">{children}</div>
            <div className="srm-chart-controls-empty-row" data-controls-row="2" aria-hidden="true"/>
            <div className="srm-chart-controls-empty-row" data-controls-row="3" aria-hidden="true"/>
          </div>}
        </CanonElement>
      </div>
    </div>
    <CanonButton canonId="SRM-C82" usage="CanonChartControlPanel:ribbon" ref={trigger} type="button" className="srm-chart-controls-ribbon" aria-expanded={open} aria-controls={id} aria-label={open ? 'Schowaj panel sterowania wykresem' : 'Rozwiń panel sterowania wykresem'} title={open ? 'Schowaj ustawienia wykresu' : 'Ustawienia wykresu'} onClick={toggle}>
      <span className="srm-chart-controls-symbol"><CanonChartControlGlyph kind="settings-sliders" size={18}/></span>
    </CanonButton>
  </div>;
}
/** C84 empty analytical workspace; C85 edge ribbon. No pin control. */
export function CanonChartToolsPanel({ onOpenChange }: {
    onOpenChange?: (open: boolean) => void;
}) {
    const { open, root, panel, trigger, id, toggle } = useChartPanel(onOpenChange);
    return <div ref={root} className="srm-chart-tools" style={chartControlPanelVariables as React.CSSProperties} data-open={open}>
    <div ref={panel} id={id} className="srm-chart-tools-clip" aria-hidden={!open || undefined}>
      <CanonElement as="section" canonId="SRM-C84" usage="CanonChartToolsPanel:panel" className="srm-chart-tools-card" aria-label="Narzędzia wykresu">
        <div className="srm-chart-tools-content"/>
      </CanonElement>
    </div>
    <CanonButton canonId="SRM-C85" usage="CanonChartToolsPanel:ribbon" ref={trigger} type="button" className="srm-chart-controls-ribbon srm-chart-tools-ribbon" aria-expanded={open} aria-controls={id} aria-label={open ? 'Schowaj panel narzędzi wykresu' : 'Rozwiń panel narzędzi wykresu'} title={open ? 'Schowaj narzędzia wykresu' : 'Narzędzia wykresu'} onClick={toggle}>
      <span className="srm-chart-controls-symbol"><CanonChartControlGlyph kind="toolbox" size={18}/></span>
    </CanonButton>
  </div>;
}
type HelpTopic = 'Modele' | 'Wartości' | 'Sprawdzalność' | 'Legenda';
const models = ['Naive', 'Damped Holt', 'ETS', 'ARIMA'];
const methods = ['Dzienna', 'Średnia miesięczna', 'Koniec okresu'];
const modelCopy: Record<string, [
    string,
    string,
    string
]> = {
    Naive: ['Punktem odniesienia jest ostatnia znana cena.', 'Przenosi ostatnią obserwację na kolejne daty.', 'Pomaga sprawdzić, czy bardziej złożony model wnosi dodatkową wartość.'],
    ETS: ['Wygładza wahania i nadaje większą wagę nowszym obserwacjom.', 'Opisuje poziom i trend; sezonowość zależy od konfiguracji modelu.', 'Pokazuje podstawowy przebieg cen bez podążania za każdym krótkim wahaniem.'],
    'Damped Holt': ['Rozpoznaje poziom oraz trend, którego siła stopniowo maleje.', 'Przedłuża trend, coraz mocniej ograniczając jego wpływ w przyszłości.', 'Dalszy przebieg jest łagodniejszy niż proste przedłużenie ostatniego trendu.'],
    ARIMA: ['Szuka zależności pomiędzy kolejnymi wartościami i ich zmianami.', 'Łączy informacje o wcześniejszych wartościach, różnicach oraz błędach prognozy.', 'Wynik opisuje wzorce obecne w historii. Nie przewiduje nowych zdarzeń rynkowych.']
};
function InfoMark() {
    return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" strokeWidth="1.2"/><path d="M10 9v4M10 6.3v.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
function ForecastHelp({ topic: initialTopic, model, onClose, theme }: {
    topic: HelpTopic;
    model: string;
    onClose: () => void;
    theme: React.CSSProperties;
}) {
    const [topic, setTopic] = useState(initialTopic);
    const [helpModel, setHelpModel] = useState(model);
    const dialog = useRef<HTMLDialogElement>(null), id = useId();
    useLayoutEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.current?.showModal();
        return () => {
            document.body.style.overflow = overflow;
            requestAnimationFrame(() => previous?.focus({
                preventScroll: true
            }));
        };
    }, []);
    return createPortal(<CanonElement as="dialog" canonId="SRM-C93" usage="ForecastHelp:dialog" ref={dialog} className="srm-forecast-help" style={theme} aria-labelledby={id} onCancel={(event: React.SyntheticEvent) => {
            event.preventDefault();
            onClose();
        }} onClick={(event: React.MouseEvent<HTMLDialogElement>) => {
            if (event.target !== event.currentTarget)
                return;
            const r = event.currentTarget.getBoundingClientRect();
            if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)
                onClose();
        }}>
    <header><div><span className="forecast-help-eyebrow">PODRĘCZNA POMOC</span><h2 id={id}>Jak czytać prognozę</h2></div><CanonCloseButton canonId="SRM-C60" usage="ForecastHelp:close" onClick={onClose}/></header>
    <nav aria-label="Tematy objaśnień">{(['Modele', 'Wartości', 'Sprawdzalność', 'Legenda'] as HelpTopic[]).map(item => <CanonButton canonId="SRM-C08" usage="ForecastHelp:topic" type="button" key={item} aria-pressed={topic === item} onClick={() => setTopic(item)}>{item}</CanonButton>)}</nav>
    <div className="forecast-help-body">
      {topic === 'Modele' && <><div className="forecast-help-models" role="group" aria-label="Objaśniany model">{models.map(item => <CanonButton canonId="SRM-C08" usage="ForecastHelp:model" type="button" key={item} aria-pressed={helpModel === item} onClick={() => setHelpModel(item)}>{item}</CanonButton>)}</div><h3>{helpModel} <span>w kilku słowach</span></h3><p className="forecast-help-lead">{modelCopy[helpModel][0]}</p><dl><dt>Co oblicza</dt><dd>{modelCopy[helpModel][1]}</dd><dt>Jak interpretować</dt><dd>{modelCopy[helpModel][2]}</dd></dl><p className="forecast-help-note">Prognoza jest szacunkiem na podstawie danych historycznych, a nie gwarancją przyszłej ceny.</p></>}
      {topic === 'Wartości' && <><h3>Trzy sposoby odczytu ceny</h3><dl><dt>Dzienna</dt><dd>Wartość dla konkretnego dnia.</dd><dt>Średnia miesięczna</dt><dd>Średnia wartości w danym miesiącu. Ułatwia porównanie dłuższych okresów.</dd><dt>Koniec okresu</dt><dd>Ostatnia dostępna wartość w wybranym okresie, zamiast jego średniej.</dd></dl><p className="forecast-help-note">Status „Gotowe” dotyczy wybranego połączenia modelu i sposobu wyznaczania wartości.</p></>}
      {topic === 'Sprawdzalność' && <><h3>Prognoza spotyka rzeczywistość</h3><p>Sprawdzalność porównuje wcześniejsze prognozy z później zaobserwowanymi cenami. Horyzont określa, jak daleko naprzód oceniana jest prognoza.</p><dl><dt>Średni poziom sprawdzalności</dt><dd>Podsumowanie zgodności prognoz z obserwacjami. Nie oznacza prawdopodobieństwa przyszłego wyniku.</dd><dt>Zgodność kierunku</dt><dd>Odsetek przypadków, w których model poprawnie wskazał wzrost lub spadek.</dd><dt>Wiarygodność oceny</dt><dd>Informacja o tym, czy dostępne porównania wystarczają do oceny modelu.</dd></dl><p className="forecast-help-note">Wybierz horyzont, aby odczytać dostępne wyniki oceny. Brak gotowej oceny jest oznaczony osobnym statusem.</p></>}
      {topic === 'Legenda' && <><h3>Linie i wstęgi wykresu</h3><ul className="forecast-help-legend"><li><i data-line="history"/><div><strong>Historia</strong><span>Rzeczywiste notowania do ostatniej dostępnej daty.</span></div></li><li><i data-line="central"/><div><strong>Prognoza centralna</strong><span>Główny przebieg oszacowany przez model.</span></div></li><li><i data-line="upper"/><div><strong>Górna granica</strong><span>Wyższa granica korytarza cenowego.</span></div></li><li><i data-line="lower"/><div><strong>Dolna granica</strong><span>Niższa granica korytarza cenowego.</span></div></li><li><i data-line="backtest"/><div><strong>Sprawdzalność</strong><span>Beżowa wstęga pokazuje różnicę wcześniejszej prognozy względem obserwacji.</span></div></li></ul><p className="forecast-help-note">Czerwień i zieleń rozróżniają granice. Nie stanowią oceny, czy zmiana ceny jest korzystna.</p></>}
    </div>
  </CanonElement>, document.body);
}
/** CHT-13: canonical presentation around the viewer's existing forecast controls. */
export function BenchmarkChartControls({ enabled, children }: {
    enabled: boolean;
    children: React.ReactNode;
}) {
    return enabled ? <CanonChartControlPanel content={children}>{null}</CanonChartControlPanel> : <>{children}</>;
}
export function BenchmarkChartTools() { return <div className="bf-canon-tools"><CanonChartToolsPanel /></div>; }
function contentText(value: React.ReactNode): string { return React.Children.toArray(value).map(child => React.isValidElement<{
    children?: React.ReactNode;
}>(child) ? contentText(child.props.children) : typeof child === 'string' || typeof child === 'number' ? String(child) : '').join(' '); }
/** Retains each original option callback and disabled state. The popup is presentation only. */
export function BenchmarkVisualSelect({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    const options = React.Children.toArray(children) as React.ReactElement<{
        className?: string;
        disabled?: boolean;
        children?: React.ReactNode;
    }>[];
    const selected = options.find(child => child.props.className?.includes('is-active')) ?? options[0];
    const [query, setQuery] = useState('');
    const [position, setPosition] = useState<{
        left: number;
        top: number;
        width: number;
    } | null>(null);
    const root = useRef<HTMLDetailsElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const disabled = options.every(option => option.props.disabled);
    function close() { root.current?.removeAttribute('open'); setPosition(null); setQuery(''); }
    function place() { const rect = root.current?.getBoundingClientRect(); if (rect)
        setPosition({ left: rect.left, top: rect.bottom + 5, width: rect.width }); }
    useEffect(() => { const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node))
        close(); }; document.addEventListener('pointerdown', dismiss); return () => document.removeEventListener('pointerdown', dismiss); }, []);
    function keyboard(event: React.KeyboardEvent) {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            root.current?.querySelector('summary')?.focus();
        }
        else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && !disabled) {
            event.preventDefault();
            root.current?.setAttribute('open', '');
            place();
            requestAnimationFrame(() => { const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('div:not([hidden])>button:not(:disabled)') ?? []); const current = buttons.indexOf(event.target as HTMLButtonElement); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length]?.focus(); });
        }
    }
    return <details ref={root} className="bf-model-select" onKeyDown={keyboard} onToggle={event => { if (event.currentTarget.open)
        place();
    else
        setPosition(null); }}>
 <summary aria-label={props['aria-label']} aria-disabled={disabled} tabIndex={disabled ? -1 : 0} onClick={event => { if (disabled)
        event.preventDefault(); }}><span>{selected?.props.children}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m7 10 5 5 5-5"/></svg></summary>
 {position && createPortal(<div ref={menu} className="bf-chart-workspace bf-model-portal" style={{ position: 'fixed', ...position, zIndex: 10000 }} onKeyDown={keyboard}><div className="bf-model-menu"><input aria-label="Szukaj w opcjach" placeholder="Szukaj…" value={query} onChange={event => setQuery(event.target.value)}/><div {...props} onClick={event => { if ((event.target as HTMLElement).closest('button:not(:disabled)')) {
        close();
        root.current?.querySelector('summary')?.focus();
    } }}>{options.map((option, i) => <div key={option.key ?? i} hidden={!contentText(option.props.children).toLocaleLowerCase().includes(query.toLocaleLowerCase())}>{option}</div>)}</div></div></div>, document.body)}
 </details>;
}
export function BenchmarkForecastHelp({ children, model }: {
    children: React.ReactNode;
    model: string;
}) {
    const [open, setOpen] = useState(false);
    const name = ({ naive: 'Naive', damped_holt: 'Damped Holt', ets: 'ETS', arima: 'ARIMA' } as Record<string, string>)[model] ?? 'Naive';
    return <div className="bf-help-control"><button type="button" onClick={() => setOpen(true)}>ⓘ <span>Objaśnienia i legenda</span><span aria-hidden="true">↗</span></button>{open && <ForecastHelp topic="Modele" model={name} onClose={() => setOpen(false)} theme={{}}/>}<div hidden>{children}</div></div>;
}
/** Reuses the viewer's existing zoom window setter; no request or calculation contract is introduced. */
export function BenchmarkChartNavigator({ series, selection, setWindow }: {
    series: {
        kind: string;
        points: {
            date: string;
            value: number | null;
        }[];
    }[];
    selection: {
        start: string;
        end: string;
    } | null;
    setWindow: (range: {
        start: string;
        end: string;
    } | null) => void;
}) {
    const { dates, maximum, path, dateIndex } = React.useMemo(() => {
        const points = series.find(item => item.kind === 'historical')?.points ?? [];
        const dates = Array.from(new Set(series.flatMap(item => item.points.map(point => point.date)))).sort();
        const maximum = Math.max(0, dates.length - 1);
        const dateIndex = new Map(dates.map((date, i) => [date, i]));
        let low = Infinity, high = -Infinity;
        for (const point of points) {
            if (point.value !== null) {
                low = Math.min(low, point.value);
                high = Math.max(high, point.value);
            }
        }
        const stride = Math.max(1, Math.ceil(points.length / 512));
        let path = '', missing = true;
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (point.value === null) {
                missing = true;
                continue;
            }
            if (!missing && i % stride !== 0 && i !== points.length - 1 && points[i + 1]?.value !== null)
                continue;
            const x = maximum ? (dateIndex.get(point.date) ?? 0) / maximum * 1000 : 0;
            const y = 32 - (point.value - low) / (high - low || 1) * 26;
            path += `${missing ? 'M' : 'L'}${x},${y} `;
            missing = false;
        }
        return { dates, maximum, path, dateIndex };
    }, [series]);
    const first = selection ? Math.max(0, dateIndex.get(selection.start) ?? 0) : 0;
    const last = selection ? Math.max(first + 1, dateIndex.get(selection.end) ?? maximum) : maximum;
    const root = useRef<HTMLDivElement>(null);
    const drag = useRef<{
        x: number;
        first: number;
        last: number;
    } | null>(null);
    function commit(start: number, end: number) { if (dates[start] && dates[end] && start < end)
        setWindow(start === 0 && end === maximum ? null : { start: dates[start], end: dates[end] }); }
    return <div className="bf-time-navigator" ref={root} aria-label="Zakres czasu wykresu">
 <svg viewBox="0 0 1000 36" preserveAspectRatio="none" aria-hidden="true"><path d={path}/></svg>
 <div className="bf-time-window" style={{ left: `${maximum ? first / maximum * 100 : 0}%`, right: `${maximum ? (maximum - last) / maximum * 100 : 0}%` }} onPointerDown={event => { if (!root.current || maximum < 2)
        return; drag.current = { x: event.clientX, first, last }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (!drag.current || !root.current)
        return; const offset = Math.round((event.clientX - drag.current.x) / root.current.getBoundingClientRect().width * maximum); const delta = Math.max(-drag.current.first, Math.min(maximum - drag.current.last, offset)); commit(drag.current.first + delta, drag.current.last + delta); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}/>
 <input type="range" min={0} max={maximum} value={first} disabled={maximum < 1} aria-label="Początek zakresu czasu" onChange={event => commit(Math.min(Number(event.target.value), last - 1), last)}/>
 <input type="range" min={0} max={maximum} value={last} disabled={maximum < 1} aria-label="Koniec zakresu czasu" onChange={event => commit(first, Math.max(Number(event.target.value), first + 1))}/>
 </div>;
}
export function BenchmarkHistoryFill({ layers, baseline, top }: {
    layers: {
        entry: {
            kind: string;
        };
        polylines: string[];
    }[];
    baseline: number;
    top: number;
}) {
    const id = useId().replace(/:/g, '');
    // C75: one blue paint through a curve-relative luminance mask. The
    // contours use rendered coordinates only; forecast values are untouched.
    const shading = React.useMemo(() => {
        const parse = (polyline: string) => polyline.trim().split(/\s+/).filter(Boolean).map(point => point.split(',').map(Number));
        const lowerSegments = layers.filter(layer => layer.entry.kind === 'forecast-lower').flatMap(layer => layer.polylines).map(parse);
        const centralSegments = layers.filter(layer => layer.entry.kind === 'forecast-central').flatMap(layer => layer.polylines).map(parse);
        return centralSegments.flatMap(central => lowerSegments.flatMap(lower => {
            const byX = new Map(lower.map(([x, y]) => [x, y]));
            const pairs = central.filter(([x]) => byX.has(x)).map(([x, y]) => ({ x, central: y, lower: byX.get(x)! }));
            if (pairs.length < 2) return [];
            const points = (values: {x:number; y:number}[]) => values.map(point => `${point.x},${point.y}`).join(' ');
            const curve = pairs.map(point => ({ x: point.x, y: point.central }));
            return [{ area: points([...pairs.map(point => ({ x: point.x, y: top })), ...[...pairs].reverse().map(point => ({ x: point.x, y: point.lower }))]),
                contours: Array.from({length:96}, (_, index) => {
                    const distance = 1 - index / 95;
                    const upperOpacity = distance <= .55 ? .18 + (.08 - .18) * distance / .55 : .08 * (1 - distance) / .45;
                    const edge = (target: 'top' | 'lower') => points([...pairs.map(point => ({ x: point.x, y: point.central + ((target === 'top' ? top : point.lower) - point.central) * distance })), ...[...curve].reverse()]);
                    return [{ points: edge('top'), gray: upperOpacity * 255 }, { points: edge('lower'), gray: (.18 + (.035 - .18) * distance) * 255 }];
                }).flat() }];
        }));
    }, [layers, top]);
    return <g className="bf-history-fill" aria-hidden="true">{shading.map((segment,index) => <g key={index}><defs><mask id={`${id}-forecast-${index}`} maskUnits="userSpaceOnUse" style={{ maskType: 'luminance' }} colorInterpolation="sRGB">{segment.contours.map((contour,i) => <polygon key={i} points={contour.points} fill={`rgb(${contour.gray},${contour.gray},${contour.gray})`}/>)}</mask></defs><polygon points={segment.area} fill="var(--brand)" mask={`url(#${id}-forecast-${index})`}/></g>)}<defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand-light)" stopOpacity=".2"/><stop offset="100%" stopColor="var(--brand-light)" stopOpacity=".035"/></linearGradient></defs>{layers.filter(layer => layer.entry.kind === 'historical').flatMap(layer => layer.polylines).map((points, i) => { const parts = points.trim().split(/\s+/); const first = parts[0]?.split(',')[0], last = parts.at(-1)?.split(',')[0]; return <polygon key={i} points={`${points} ${last},${baseline} ${first},${baseline}`} fill={`url(#${id})`}/>; })}</g>;
}
/** Measures presentation only. Drawer reflow never changes data or request state. */
export function useBenchmarkChartLayout<T extends {
    width: number;
    height: number;
    paddingLeft: number;
    paddingRight: number;
}>(surfaceRef: React.RefObject<HTMLElement>, base: T): T {
    const [size, setSize] = useState<{
        width: number;
        height: number;
    } | null>(null);
    useLayoutEffect(() => {
        const surface = surfaceRef.current;
        const workspace = surface?.closest<HTMLElement>('.bf-chart-workspace');
        if (!surface || !workspace)
            return;
        const controls = workspace.querySelector<HTMLElement>('.srm-chart-controls');
        const measure = () => { const width = surface.getBoundingClientRect().width; const panelHeight = controls?.getBoundingClientRect().height ?? 0; const height = Math.max(160, Math.max(512, (workspace.clientWidth - 48) * 316 / 812 + 128) - panelHeight);
            workspace.style.setProperty("--bf-plot-height", `${height}px`); if (width > 0)
            setSize(current => current && Math.abs(current.width - width) < .5 && Math.abs(current.height - height) < .5 ? current : { width, height }); };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(surface);
        if (controls)
            observer.observe(controls);
        return () => observer.disconnect();
    });
    return size ? { ...base, ...size, paddingLeft: 24, paddingRight: 24 } : base;
}
/** The 1M shortcut uses the same local zoom window as dragging the navigator. Server presets retain their original callbacks. */
export function BenchmarkRangeRail({ enabled, series, selection, setWindow, children, ...props }: React.HTMLAttributes<HTMLDivElement> & {
    enabled: boolean;
    series: {
        points: {
            date: string;
        }[];
    }[];
    selection: {
        start: string;
        end: string;
    } | null;
    setWindow: (range: {
        start: string;
        end: string;
    } | null) => void;
}) {
    const dates = React.useMemo(() => Array.from(new Set(series.flatMap(item => item.points.map(point => point.date)))).sort(), [series]);
    const end = dates.length - 1;
    let first = 0;
    if (end > 0) {
        const [year, month, day] = dates[end].slice(0, 10).split('-').map(Number);
        const cutoff = new Date(Date.UTC(year, month - 2, 1));
        const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
        cutoff.setUTCDate(Math.min(day, lastDay));
        const index = dates.findIndex(date => date >= cutoff.toISOString().slice(0, 10));
        first = Math.max(0, Math.min(index < 0 ? end - 1 : index, end - 1));
    }
    const active = selection?.start === dates[first] && selection?.end === dates[end];
    return <div {...props} onClick={event => { if (enabled && (event.target as HTMLElement).closest('button:not([data-bf-month-shortcut])'))
        setWindow(null); }}>{enabled && <button type="button" className={`chart-range-button${active ? ' is-active' : ''}`} data-bf-month-shortcut aria-pressed={active} disabled={end < 1} title="Ostatni miesiąc" onClick={() => setWindow({ start: dates[first], end: dates[end] })}>1M</button>}{children}</div>;
}
export function BenchmarkVerificationPlaceholder({ locale }: {
    locale: string;
}) { return <div className="verification-quality-panel"><div className="verification-quality-metrics">{(locale === 'pl' ? ['Średnia sprawdzalność', 'Zgodność kierunku', 'Wiarygodność oceny'] : ['Average verification', 'Directional accuracy', 'Assessment confidence']).map(label => <div className="verification-quality-metric" key={label}><span>{label}</span><strong>—</strong></div>)}</div></div>; }
