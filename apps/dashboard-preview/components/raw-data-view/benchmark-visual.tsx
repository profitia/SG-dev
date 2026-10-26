'use client';
/** MagicPath C71/C81–C85/C92–C93 presentation adapters. No provider, forecast, search or identity operations. */
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {CanonButton,CanonElement,CanonCloseButton} from './magicpath/CanonElements';
import {CanonChartControlPanel} from './magicpath/CanonChartControlPanel';
import {CanonDropdown} from './magicpath/CanonDropdown';
import {spacingCSS} from './magicpath/spacing-contract';
type HelpTopic = 'Modele' | 'Wartości' | 'Sprawdzalność' | 'Legenda';
const models = ['Naive', 'Damped Holt', 'ETS', 'ARIMA'];
const helpEnglish: Record<string, string> = {
  "PODRĘCZNA POMOC": "QUICK HELP",
  "Jak czytać prognozę": "How to read a forecast",
  "Modele": "Models",
  "Wartości": "Values",
  "Sprawdzalność": "Verification",
  "Legenda": "Legend",
  "w kilku słowach": "in a few words",
  "Co oblicza": "What it calculates",
  "Jak interpretować": "How to interpret it",
  "Prognoza jest szacunkiem na podstawie danych historycznych, a nie gwarancją przyszłej ceny.": "A forecast is an estimate based on historical data, not a guarantee of a future price.",
  "Trzy sposoby odczytu ceny": "Three ways to read prices",
  "Dzienna": "Daily",
  "Wartość dla konkretnego dnia.": "The value for a specific day.",
  "Średnia miesięczna": "Monthly average",
  "Średnia wartości w danym miesiącu. Ułatwia porównanie dłuższych okresów.": "The average value in a given month. It makes longer periods easier to compare.",
  "Koniec okresu": "End of period",
  "Ostatnia dostępna wartość w wybranym okresie, zamiast jego średniej.": "The last available value in the selected period, instead of its average.",
  "Status „Gotowe” dotyczy wybranego połączenia modelu i sposobu wyznaczania wartości.": "The “Ready” status applies to the selected combination of model and value method.",
  "Prognoza spotyka rzeczywistość": "Forecasts meet reality",
  "Sprawdzalność porównuje wcześniejsze prognozy z później zaobserwowanymi cenami. Horyzont określa, jak daleko naprzód oceniana jest prognoza.": "Verification compares earlier forecasts with subsequently observed prices. The horizon specifies how far ahead the forecast is evaluated.",
  "Średni poziom sprawdzalności": "Average verification",
  "Podsumowanie zgodności prognoz z obserwacjami. Nie oznacza prawdopodobieństwa przyszłego wyniku.": "A summary of how closely forecasts match observations. It is not the probability of a future outcome.",
  "Zgodność kierunku": "Directional accuracy",
  "Odsetek przypadków, w których model poprawnie wskazał wzrost lub spadek.": "The proportion of cases where the model correctly indicated an increase or decrease.",
  "Wiarygodność oceny": "Assessment confidence",
  "Informacja o tym, czy dostępne porównania wystarczają do oceny modelu.": "Whether the available comparisons are sufficient to assess the model.",
  "Wybierz horyzont, aby odczytać dostępne wyniki oceny. Brak gotowej oceny jest oznaczony osobnym statusem.": "Select a horizon to view available assessment results. An assessment that is not ready has a separate status.",
  "Linie i wstęgi wykresu": "Chart lines and ribbons",
  "Historia": "History",
  "Rzeczywiste notowania do ostatniej dostępnej daty.": "Actual observations up to the latest available date.",
  "Prognoza centralna": "Central forecast",
  "Główny przebieg oszacowany przez model.": "The main path estimated by the model.",
  "Górna granica": "Upper bound",
  "Wyższa granica korytarza cenowego.": "The upper edge of the price corridor.",
  "Dolna granica": "Lower bound",
  "Niższa granica korytarza cenowego.": "The lower edge of the price corridor.",
  "Beżowa wstęga pokazuje różnicę wcześniejszej prognozy względem obserwacji.": "The beige ribbon shows the difference between an earlier forecast and the observations.",
  "Czerwień i zieleń rozróżniają granice. Nie stanowią oceny, czy zmiana ceny jest korzystna.": "Red and green distinguish the bounds. They do not indicate whether a price change is favourable."
};
const modelCopyEnglish: Record<string, [string,string,string]> = {
  "Naive": [
    "The last known price is the reference point.",
    "Carries the latest observation forward to future dates.",
    "Helps assess whether a more complex model adds value."
  ],
  "ETS": [
    "Smooths fluctuations and gives more weight to recent observations.",
    "Describes level and trend; seasonality depends on the model configuration.",
    "Shows the underlying price path without following every short fluctuation."
  ],
  "Damped Holt": [
    "Identifies the level and a trend whose strength gradually decreases.",
    "Extends the trend while progressively reducing its influence.",
    "The longer-term path is gentler than a simple extension of the latest trend."
  ],
  "ARIMA": [
    "Looks for relationships between successive values and their changes.",
    "Combines past values, differences and forecast errors.",
    "Describes patterns present in the historical data. It does not anticipate new market events."
  ]
};
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
function ForecastHelp({ topic: initialTopic, model, onClose, theme, locale }: {
    topic: HelpTopic;
    model: string;
    onClose: () => void;
    theme: React.CSSProperties;
    locale: string;
}) {
    const text = (value: string) => locale === 'pl' ? value : helpEnglish[value] ?? value;
    const copy = locale === 'pl' ? modelCopy : modelCopyEnglish;
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
    <header><div><span className="forecast-help-eyebrow">{text("PODRĘCZNA POMOC")}</span><h2 id={id}>{text("Jak czytać prognozę")}</h2></div><CanonCloseButton canonId="SRM-C60" usage="ForecastHelp:close" onClick={onClose}/></header>
    <nav aria-label={locale === 'pl' ? 'Tematy objaśnień' : 'Help topics'}>{(['Modele', 'Wartości', 'Sprawdzalność', 'Legenda'] as HelpTopic[]).map(item => <CanonButton canonId="SRM-C08" usage="ForecastHelp:topic" type="button" key={item} aria-pressed={topic === item} onClick={() => setTopic(item)}>{text(item)}</CanonButton>)}</nav>
    <div className="forecast-help-body">
      {topic === 'Modele' && <><div className="forecast-help-models" role="group" aria-label={locale === 'pl' ? 'Objaśniany model' : 'Model explained'}>{models.map(item => <CanonButton canonId="SRM-C08" usage="ForecastHelp:model" type="button" key={item} aria-pressed={helpModel === item} onClick={() => setHelpModel(item)}>{item}</CanonButton>)}</div><h3>{helpModel} <span>{text("w kilku słowach")}</span></h3><p className="forecast-help-lead">{copy[helpModel][0]}</p><dl><dt>{text("Co oblicza")}</dt><dd>{copy[helpModel][1]}</dd><dt>{text("Jak interpretować")}</dt><dd>{copy[helpModel][2]}</dd></dl><p className="forecast-help-note">{text("Prognoza jest szacunkiem na podstawie danych historycznych, a nie gwarancją przyszłej ceny.")}</p></>}
      {topic === 'Wartości' && <><h3>{text("Trzy sposoby odczytu ceny")}</h3><dl><dt>{text("Dzienna")}</dt><dd>{text("Wartość dla konkretnego dnia.")}</dd><dt>{text("Średnia miesięczna")}</dt><dd>{text("Średnia wartości w danym miesiącu. Ułatwia porównanie dłuższych okresów.")}</dd><dt>{text("Koniec okresu")}</dt><dd>{text("Ostatnia dostępna wartość w wybranym okresie, zamiast jego średniej.")}</dd></dl><p className="forecast-help-note">{text("Status „Gotowe” dotyczy wybranego połączenia modelu i sposobu wyznaczania wartości.")}</p></>}
      {topic === 'Sprawdzalność' && <><h3>{text("Prognoza spotyka rzeczywistość")}</h3><p>{text("Sprawdzalność porównuje wcześniejsze prognozy z później zaobserwowanymi cenami. Horyzont określa, jak daleko naprzód oceniana jest prognoza.")}</p><dl><dt>{text("Średni poziom sprawdzalności")}</dt><dd>{text("Podsumowanie zgodności prognoz z obserwacjami. Nie oznacza prawdopodobieństwa przyszłego wyniku.")}</dd><dt>{text("Zgodność kierunku")}</dt><dd>{text("Odsetek przypadków, w których model poprawnie wskazał wzrost lub spadek.")}</dd><dt>{text("Wiarygodność oceny")}</dt><dd>{text("Informacja o tym, czy dostępne porównania wystarczają do oceny modelu.")}</dd></dl><p className="forecast-help-note">{text("Wybierz horyzont, aby odczytać dostępne wyniki oceny. Brak gotowej oceny jest oznaczony osobnym statusem.")}</p></>}
      {topic === 'Legenda' && <><h3>{text("Linie i wstęgi wykresu")}</h3><ul className="forecast-help-legend"><li><i data-line="history"/><div><strong>{text("Historia")}</strong><span>{text("Rzeczywiste notowania do ostatniej dostępnej daty.")}</span></div></li><li><i data-line="central"/><div><strong>{text("Prognoza centralna")}</strong><span>{text("Główny przebieg oszacowany przez model.")}</span></div></li><li><i data-line="upper"/><div><strong>{text("Górna granica")}</strong><span>{text("Wyższa granica korytarza cenowego.")}</span></div></li><li><i data-line="lower"/><div><strong>{text("Dolna granica")}</strong><span>{text("Niższa granica korytarza cenowego.")}</span></div></li><li><i data-line="backtest"/><div><strong>{text("Sprawdzalność")}</strong><span>{text("Beżowa wstęga pokazuje różnicę wcześniejszej prognozy względem obserwacji.")}</span></div></li></ul><p className="forecast-help-note">{text("Czerwień i zieleń rozróżniają granice. Nie stanowią oceny, czy zmiana ceny jest korzystna.")}</p></>}
    </div>
  </CanonElement>, document.body);
}
/** CHT-13: canonical presentation around the viewer's existing forecast controls. */
export function BenchmarkChartControls({ enabled, children }: {
    enabled: boolean;
    children: React.ReactNode;
}) {
    const scope=useRef<HTMLDivElement>(null);
    const measure=useCallback((height:number)=>scope.current?.closest<HTMLElement>('.bf-chart-workspace')?.style.setProperty('--chart-controls-measured-height',`${height}px`),[]);
    return enabled ? <div ref={scope} style={{display:'contents'}}><CanonChartControlPanel onHeightChange={measure} content={<div className="bf-controls-content"><style>{spacingCSS.replace(':root', '.bf-chart-workspace')}</style>{children}</div>}>{null}</CanonChartControlPanel></div> : <>{children}</>;
}
function contentText(value:React.ReactNode):string{return React.Children.toArray(value).map(child=>React.isValidElement<{children?:React.ReactNode}>(child)?contentText(child.props.children):typeof child==='string'||typeof child==='number'?String(child):'').join(' ')}
/** Canon C07 appearance, original option callbacks/disabled states. */
export function BenchmarkVisualSelect({children,...props}:React.HTMLAttributes<HTMLDivElement>){
 const options=React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>[];
 const selected=Math.max(0,options.findIndex(option=>option.props.className?.includes('is-active')));
 const optionButtons=useRef<(HTMLButtonElement|null)[]>([]);
 return <div className="bf-model-select"><CanonDropdown aria-label={props['aria-label']} value={String(selected)} disabled={options.every(option=>option.props.disabled)} onChange={event=>optionButtons.current[Number(event.target.value)]?.click()}>{options.map((option,index)=><option key={index} value={String(index)} disabled={option.props.disabled}>{contentText(option.props.children)}</option>)}</CanonDropdown><div hidden>{options.map((option,index)=>React.cloneElement(option,{ref:(node:HTMLButtonElement|null)=>{optionButtons.current[index]=node}} as any))}</div></div>;
}
export function BenchmarkForecastHelp({ children, model, locale = 'pl' }: {
    children: React.ReactNode;
    model: string;
    locale?: string;
}) {
    const [open, setOpen] = useState(false);
    const name = ({ naive: 'Naive', damped_holt: 'Damped Holt', ets: 'ETS', arima: 'ARIMA' } as Record<string, string>)[model] ?? 'Naive';
    return <div className="bf-help-control"><button type="button" onClick={() => setOpen(true)}><InfoMark/><span>{locale === 'pl' ? 'Objaśnienia i legenda' : 'Explanations and legend'}</span><span aria-hidden="true">↗</span></button>{open && <ForecastHelp topic="Modele" model={name} onClose={() => setOpen(false)} theme={{}} locale={locale}/>}<div hidden>{children}</div></div>;
}
export function BenchmarkVerificationPlaceholder({ locale }: {
    locale: string;
}) { return <div className="verification-quality-panel"><div className="verification-quality-metrics">{(locale === 'pl' ? ['Średnia sprawdzalność', 'Zgodność kierunku', 'Wiarygodność oceny'] : ['Average verification', 'Directional accuracy', 'Assessment confidence']).map(label => <div className="verification-quality-metric" key={label}><span>{label}</span><strong>—</strong></div>)}</div></div>; }

export function BenchmarkPreparationMotion() { return <><span className="forecast-status-symbol" aria-hidden="true"><i/></span><span className="forecast-motion-track" aria-hidden="true"><i/></span></>; }
