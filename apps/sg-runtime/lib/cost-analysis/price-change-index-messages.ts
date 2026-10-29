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
  }
  return messages[issue.code]??'Nie można obliczyć ceny dla wybranych danych. Sprawdź dostępność notowań, datę odniesienia i sposób porównania. Wpisane wartości zostały zachowane.'
}
