import type {BenchmarkAnalyticsSeriesResult} from '../benchmark/contracts'
import type {PciAnalysisRequest} from './price-change-index-contracts'
import {createCalendarTargetPeriod,normalizeForecastSourceFrequency} from '../forecast/cadence'

/** Buyer-facing explanations only; the engine's refusal codes and rules stay authoritative. */
export function pciIssueMessage(issue: {code:string;message:string}):string {
  if(['REFERENCE_DATE_OUTSIDE_HISTORY','CATEGORY_NOT_READY','INVALID_COMPOSITION','BENCHMARK_UNAVAILABLE','DATA_VOLUME_LIMIT','NO_OBSERVATIONS','INCOMPATIBLE_ECONOMIC_BASIS'].includes(issue.code))return issue.message
  const messages:Record<string,string>={
    INVALID_RANGE:'Wybrana data benchmarku nie mieści się w dostępnej historii. Sprawdź datę odniesienia. Nie zmieniamy daty zakupu ani nie zastępujemy brakujących notowań.',
    MISSING_BASE_NODE:'Dla wybranej daty nie ma kompletu notowań wszystkich komponentów. Wybierz datę z dostępnymi danymi. Jeśli porównujesz miesiąc lub kwartał, wskaż początek tego okresu i świadomie potwierdź takie porównanie.',
    BASE_NODE_NOT_ALIGNED:'Wybrana data nie jest początkiem wspólnego okresu danych. Dla danych miesięcznych wskaż pierwszy dzień miesiąca, a dla kwartalnych pierwszy dzień kwartału. Data zakupu pozostaje bez zmian.',
    NO_COMPARABLE_CADENCE:'Tych benchmarków nie można porównać przy wybranym sposobie łączenia danych. Sprawdź częstotliwość notowań i to, czy dane przedstawiają cenę z dnia, koniec okresu czy średnią. Nie wybieraj metody na próbę.',
    UNSUPPORTED_CANONICALIZATION:'Wybrany sposób łączenia danych nie pasuje do znaczenia lub częstotliwości notowań. Sprawdź opis benchmarków; aplikacja nie tworzy brakujących wartości ani nie uśrednia ich bez zgodnej metody.',
    NO_COMPLETE_NODES:'Brakuje wspólnego okresu z kompletem notowań wszystkich komponentów. Wybierz inne benchmarki lub okres, dla którego dostępne są dane.',
    UNAPPROVED_PERIOD_MAPPING:'Dane opisują okres, a nie notowanie dokładnie z dnia zakupu. Potwierdź porównanie zakupu z wartością dla tego okresu. Data zakupu pozostanie bez zmian.',
    PURCHASE_OUTSIDE_BASE_PERIOD:'Data zakupu nie należy do wskazanego okresu benchmarku. Wybierz okres obejmujący rzeczywisty dzień zakupu. Samo zaznaczenie potwierdzenia nie pozwala przenieść zakupu do innego okresu.',
    UNKNOWN_FREQUENCY:'Źródło nie podaje obsługiwanej częstotliwości notowań. Wybierz benchmark z określoną częstotliwością; nie tworzymy sztucznych obserwacji.',
    INVALID_QUALIFICATION:'Nie potwierdzono, czy benchmark zawiera ceny czy indeks oraz jaki okres opisują jego wartości. Sprawdź opis źródła zamiast zgadywać ustawienia.',
    INVALID_REDUCTION:'Wybrany sposób łączenia częstotliwości wymaga zgodnej, jawnie określonej metody. Sprawdź opis notowań.',
    DUPLICATE_NATIVE_PERIOD:'W zapisanej historii występuje więcej niż jedno notowanie w tym samym okresie. Model wymaga jednego notowania na okres i nie wybiera ani nie uśrednia ich automatycznie. Wybierz inny właściwy benchmark albo zgłoś weryfikację danych źródłowych. Sama zmiana daty zakupu nie usuwa konfliktu w historii.',
    DUPLICATE_OBSERVATION:'W zapisanej historii występują powtórzone znaczniki czasu. Model nie usuwa ich automatycznie. Wybierz inny właściwy benchmark albo zgłoś weryfikację danych źródłowych.',
    INVALID_PRICE_LEVEL:'Zapisana historia zawiera zero, wartość ujemną lub nieprawidłową liczbę. Ten model względnych zmian wymaga dodatnich, skończonych poziomów cen. Wybierz inny właściwy benchmark albo zgłoś weryfikację danych; nie usuwamy obserwacji i nie zastępujemy ich innymi wartościami.',
  }
  return messages[issue.code]??'Nie można obliczyć ceny dla wybranych danych. Sprawdź dostępność notowań, datę odniesienia i sposób porównania. Wpisane wartości zostały zachowane.'
}

/** Explain only the actual Core issue, using the same supplied history and UTC
 * period function. This does not qualify, repair, filter or canonicalize data. */
export function pciCategoryIssues<T extends {code:string;message:string;componentId?:string}>(issues:readonly T[],input:PciAnalysisRequest,histories:ReadonlyMap<string,BenchmarkAnalyticsSeriesResult>):(T&{message:string})[]{
  return issues.map(issue=>{
    const index=input.declarations.findIndex(d=>d.componentId===issue.componentId)
    const component=index<0?undefined:input.category.components[index]
    const history=component&&histories.get(component.businessBenchmarkId)
    let detail=''
    if(history&&issue.code==='DUPLICATE_NATIVE_PERIOD'){
      const cadence=normalizeForecastSourceFrequency(history.frequency),seen=new Set<string>()
      if(cadence)for(const point of history.historical){
        try{
          const day=createCalendarTargetPeriod(point.date,cadence).start.toISOString()
          if(seen.has(day)){detail=` Konflikt dotyczy okresu zaczynającego się ${day.slice(0,10)} (UTC).`;break}
          seen.add(day)
        }catch{break}
      }
    }
    if(history&&issue.code==='INVALID_PRICE_LEVEL'){
      const point=history.historical.find(p=>p.value!==null&&(!Number.isFinite(p.value)||p.value<=0))
      if(point)detail=` Nieprawidłowa obserwacja: ${point.date}${Number.isFinite(point.value)?`, wartość ${point.value}`:''}.`
    }
    const label=component&&history?`${component.name.trim()||'Komponent bez nazwy'} — ${history.displayName} (${history.providerSeries.providerSeriesId}): `:''
    return {...issue,message:label+pciIssueMessage(issue)+detail}
  })
}
