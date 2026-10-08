export type IndicatorPreview = { name: string; description: string; formula: string; requirement?: string; code?: string };

export const indicatorGroups: { title: string; description: string; indicators: IndicatorPreview[] }[] = [
  { title: "Płynność", description: "Pokazuje, czy dostawca ma zasoby na najbliższe zobowiązania. Dla kupca to sygnał, czy napięta gotówka może utrudnić terminowe zakupy materiałów, produkcję lub dostawy.", indicators: [
    { name: "Płynność bieżąca", description: "Pomaga ocenić krótkoterminową zdolność do regulowania zobowiązań. Niska wartość może oznaczać ryzyko przerw w dostawach; bardzo wysoka wymaga sprawdzenia, czy aktywa nie są zamrożone w zapasach i należnościach.", formula: "Aktywa obrotowe ÷ zobowiązania krótkoterminowe", code: "CURRENT_RATIO" },
    { name: "Kapitał obrotowy netto", description: "Pokazuje finansowy bufor po pokryciu zobowiązań krótkoterminowych. Ujemna wartość może utrudnić dostawcy sfinansowanie bieżących zamówień i wzrostu produkcji.", formula: "Aktywa obrotowe − zobowiązania krótkoterminowe", code: "NET_WORKING_CAPITAL" },
    { name: "Płynność szybka", description: "Sprawdza pokrycie krótkoterminowych zobowiązań bez zapasów, których nie zawsze można szybko spieniężyć. Jest użyteczna, gdy dostawca utrzymuje duży magazyn.", formula: "(Aktywa obrotowe − zapasy) ÷ zobowiązania krótkoterminowe", requirement: "Wymaga potwierdzonej wartości zapasów.", code: "QUICK_RATIO" },
  ] },
  { title: "Finansowanie i zadłużenie", description: "Pokazuje, jak dostawca finansuje działalność i jak duże ma obciążenia. Kupiec może dzięki temu ocenić odporność firmy na spadek sprzedaży lub wzrost kosztów finansowania.", indicators: [
    { name: "Udział zobowiązań i rezerw w aktywach", description: "Wskazuje część majątku finansowaną zobowiązaniami i rezerwami. Rosnący udział może zmniejszać odporność dostawcy na trudniejszy okres; ta pozycja nie oznacza wyłącznie kredytów.", formula: "Zobowiązania i rezerwy ÷ aktywa razem × 100%", code: "LIABILITIES_TO_ASSETS" },
    { name: "Udział kapitału własnego w aktywach", description: "Pokazuje, ile majątku jest finansowane własnym kapitałem. Wyższy udział może dawać dostawcy większy bufor na straty i nieprzewidziane wydatki.", formula: "Kapitał własny ÷ aktywa razem × 100%", code: "EQUITY_TO_ASSETS" },
    { name: "Pokrycie odsetek", description: "Pomaga ocenić, czy wynik operacyjny wystarcza na obsługę odsetek. Słabe pokrycie może ograniczyć środki potrzebne na wykonanie kontraktu.", formula: "Wynik operacyjny ÷ koszty odsetek", requirement: "Wymaga wyodrębnienia odsetek z kosztów finansowych.", code: "INTEREST_COVERAGE" },
    { name: "Dług netto / EBITDA", description: "Orientacyjnie pokazuje skalę długu wobec wyniku operacyjnego przed amortyzacją. Wysoka wartość może sygnalizować ograniczoną zdolność do nowych inwestycji; EBITDA nie jest gotówką.", formula: "(Dług oprocentowany − środki pieniężne) ÷ EBITDA", requirement: "Wymaga potwierdzenia długu, gotówki i definicji EBITDA.", code: "NET_DEBT_TO_EBITDA" },
  ] },
  { title: "Rentowność i trend", description: "Pokazuje, czy dostawca zarabia na działalności i w jakim kierunku zmienia się jego skala. Dla kupca istotna jest trwałość wyniku, a nie tylko pojedynczy dobry rok.", indicators: [
    { name: "Marża operacyjna", description: "Pokazuje, jaka część przychodów pozostaje po kosztach podstawowej działalności. Spadek marży może zapowiadać presję na ceny, jakość lub terminowość dostaw.", formula: "Wynik operacyjny ÷ przychody × 100%", code: "OPERATING_MARGIN" },
    { name: "Marża netto", description: "Pokazuje końcowy wynik przypadający na przychody. Utrzymujące się straty mogą osłabiać zdolność dostawcy do realizacji długich kontraktów.", formula: "Wynik netto ÷ przychody × 100%", code: "NET_MARGIN" },
    { name: "Zmiana przychodów rok do roku", description: "Pozwala zobaczyć, czy skala działalności rośnie czy maleje. Gwałtowny spadek może wymagać rozmowy o obłożeniu zakładu i ciągłości dostaw; sam wzrost nie dowodzi dobrej kondycji.", formula: "(Przychody bieżące ÷ przychody poprzedniego roku − 1) × 100%", code: "REVENUE_YOY" },
    { name: "Rentowność aktywów (ROA)", description: "Pokazuje, jak skutecznie majątek firmy tworzy wynik. Spadek może sugerować słabsze wykorzystanie zasobów potrzebnych do obsługi zamówień.", formula: "Wynik netto ÷ średnie aktywa × 100%", code: "ROA", requirement: "Wymaga porównywalnych danych za dwa lata." },
    { name: "Rentowność kapitału własnego (ROE)", description: "Pokazuje wynik osiągany na kapitale właścicieli. Pomaga ocenić trwałość finansowania, lecz przy niskim lub ujemnym kapitale może być mylący.", formula: "Wynik netto ÷ średni kapitał własny × 100%", code: "ROE", requirement: "Wymaga dwóch lat danych; przy kapitale niedodatnim wynik wymaga osobnej interpretacji." },
    { name: "Marża EBITDA", description: "Pokazuje relację wyniku przed amortyzacją do przychodów. Ułatwia porównanie trendu operacyjnego, ale nie potwierdza dostępnej gotówki na realizację zamówień.", formula: "(Wynik operacyjny + amortyzacja) ÷ przychody × 100%", requirement: "Wymaga potwierdzonej amortyzacji i jednej definicji EBITDA.", code: "EBITDA_MARGIN" },
  ] },
  { title: "Koszty i przepływy pieniężne", description: "Pokazuje wrażliwość kosztów oraz to, czy działalność tworzy gotówkę. Dla kupca są to sygnały, czy dostawca może finansować materiały, pracę i inwestycje bez zakłócania dostaw.", indicators: [
    { name: "Udział materiałów i energii w kosztach", description: "Pomaga ocenić wrażliwość dostawcy na wzrost cen surowców i energii. Wysoki udział może uzasadniać rozmowę o zabezpieczeniu cen i terminów dostaw.", formula: "Koszty materiałów i energii ÷ koszty działalności operacyjnej × 100%", code: "MATERIALS_ENERGY_SHARE" },
    { name: "Pokrycie zobowiązań przepływami operacyjnymi", description: "Pokazuje, w jakim stopniu bieżąca działalność dostarcza gotówki na krótkoterminowe zobowiązania. Niskie pokrycie może oznaczać większą zależność od finansowania zewnętrznego.", formula: "Przepływy operacyjne ÷ zobowiązania krótkoterminowe", requirement: "Wymaga rachunku przepływów pieniężnych." },
    { name: "Wolne przepływy pieniężne", description: "Przybliżają gotówkę pozostającą po nakładach inwestycyjnych. Ujemna wartość wymaga sprawdzenia, czy wynika z rozwoju firmy, czy z trudności operacyjnych.", formula: "Przepływy operacyjne − nakłady inwestycyjne", requirement: "Wymaga rachunku przepływów i potwierdzenia nakładów inwestycyjnych.", code: "FREE_CASH_FLOW" },
    { name: "Cykl konwersji gotówki", description: "Pokazuje, jak długo środki są związane w zapasach i należnościach przed odzyskaniem gotówki. Długi cykl może utrudniać finansowanie kolejnych zamówień.", formula: "Dni zapasów + dni należności − dni zobowiązań", requirement: "Wymaga szczegółowych pozycji bilansu, kosztu sprzedaży i porównywalnych okresów.", code: "CASH_CONVERSION_CYCLE" },
  ] },
];

export const indicatorReasons: Record<string, string> = {
  MISSING_FIELD: "W zapisanym sprawozdaniu brakuje potrzebnej pozycji.",
  SOURCE_MAPPING_UNCONFIRMED: "Nie potwierdzono jeszcze dokładnego mapowania pól źródłowych dla tego wzoru.",
  UNVERIFIED_FIELD: "Wartość źródłowa wymaga potwierdzenia.",
  UNSUPPORTED_UNIT: "Jednostka lub waluta danych nie jest porównywalna.",
  UNVERIFIED_COST_SIGN: "Nie potwierdzono sposobu zapisu kosztów.",
  UNVERIFIED_SOURCE: "Brakuje potwierdzonego dokumentu źródłowego.",
  INVALID_AMOUNT: "Kwota źródłowa ma nieprawidłowy format.",
  DOCUMENT_MISMATCH: "Kwoty nie zgadzają się z wybranym sprawozdaniem.",
  MIXED_SOURCE: "Pozycje okresu pochodzą z różnych pobrań.",
  PERIOD_NOT_ANNUAL: "Dostępny okres nie obejmuje pełnego roku.",
  PRIOR_YEAR_NOT_COMPARABLE: "Brakuje porównywalnego poprzedniego roku.",
  NON_POSITIVE_DENOMINATOR: "Podstawa obliczenia jest zerowa lub ujemna.",
  NON_POSITIVE_EQUITY: "Średni kapitał własny nie jest dodatni.",
};


export const healthGroups = {
  liquidity: ["CURRENT_RATIO", "QUICK_RATIO", "NET_WORKING_CAPITAL", "CASH_CONVERSION_CYCLE"],
  debt: ["LIABILITIES_TO_ASSETS", "EQUITY_TO_ASSETS", "INTEREST_COVERAGE", "NET_DEBT_TO_EBITDA"],
  profitability: ["OPERATING_MARGIN", "NET_MARGIN", "EBITDA_MARGIN", "ROA", "ROE", "REVENUE_YOY", "MATERIALS_ENERGY_SHARE"],
  cashFlow: ["FREE_CASH_FLOW"],
} as const;
export type HealthArea = keyof typeof healthGroups;
export const indicatorContent = Object.fromEntries(indicatorGroups.flatMap(group => group.indicators).filter(item => item.code).map(item => [item.code!, item]));
export const indicatorPresentation: Record<string, { unit: "PERCENT" | "RATIO" | "PLN" | "DAYS"; importance: 1 | 2 | 3 }> = {
  CURRENT_RATIO: { unit: "RATIO", importance: 3 }, QUICK_RATIO: { unit: "RATIO", importance: 3 },
  NET_WORKING_CAPITAL: { unit: "PLN", importance: 2 }, CASH_CONVERSION_CYCLE: { unit: "DAYS", importance: 2 },
  LIABILITIES_TO_ASSETS: { unit: "PERCENT", importance: 3 }, EQUITY_TO_ASSETS: { unit: "PERCENT", importance: 2 },
  INTEREST_COVERAGE: { unit: "RATIO", importance: 3 }, NET_DEBT_TO_EBITDA: { unit: "RATIO", importance: 2 },
  OPERATING_MARGIN: { unit: "PERCENT", importance: 3 }, NET_MARGIN: { unit: "PERCENT", importance: 2 },
  EBITDA_MARGIN: { unit: "PERCENT", importance: 2 }, ROA: { unit: "PERCENT", importance: 2 }, ROE: { unit: "PERCENT", importance: 1 },
  REVENUE_YOY: { unit: "PERCENT", importance: 2 }, MATERIALS_ENERGY_SHARE: { unit: "PERCENT", importance: 1 }, FREE_CASH_FLOW: { unit: "PLN", importance: 3 },
};
const reportReasons: Record<string, string> = {
  NO_PREVIOUS_PERIOD: "Brak wcześniejszego okresu do porównania.", NON_ADJACENT_PERIODS: "Okresy nie są kolejnymi pełnymi latami. Nie interpolujemy brakujących danych.",
  VALUE_UNAVAILABLE: "W jednym z okresów brakuje dostępnej wartości.", EVIDENCE_UNVERIFIED: "Nie potwierdzono wszystkich danych źródłowych.",
  DOCUMENT_COMPARABILITY_UNCONFIRMED: "Brakuje potwierdzenia porównywalności dokumentów, w tym ewentualnych korekt.",
  METHODOLOGY_MISMATCH: "Wersje metodologii nie są zgodne.", INDICATOR_SCOPE_OR_UNIT_MISMATCH: "Wskaźnik, zakres lub jednostka nie są zgodne.",
  CALCULATION_NOT_STORED: "Brak zapisanego wyniku obliczenia dla tego okresu.", NO_STORED_FINANCIAL_PERIODS: "Brak zapisanych okresów finansowych.",
  JDG_FINANCIAL_REPORT_NOT_AVAILABLE: "Sprawozdanie finansowe spółki nie dotyczy JDG.", MAPPING_VERSION_OUTDATED: "Zapisana reprezentacja wymaga aktualizacji.",
  INDICATOR_CONTRACT_MISMATCH: "Wynik nie odpowiada obowiązującemu kontraktowi wskaźnika.", STORED_EVIDENCE_MISMATCH: "Nie potwierdzono zgodności wyniku z zapisanymi danymi źródłowymi.",
  INVALID_STORED_VALUE: "Zapisana wartość ma nieprawidłowy format.", SOURCE_FACT_NOT_STORED: "Pozycja źródłowa nie została zapisana.", REPRESENTATION_MISMATCH: "Pozycja nie jest zgodna z wybraną reprezentacją.",
};
export function financialReason(code: string | null | undefined): string {
  return indicatorReasons[code ?? ""] ?? reportReasons[code ?? ""] ?? "Nie można potwierdzić danych do obliczenia lub porównania.";
}
export const importanceLabels = { 1: "Pomocniczy", 2: "Istotny", 3: "Kluczowy" } as const;
