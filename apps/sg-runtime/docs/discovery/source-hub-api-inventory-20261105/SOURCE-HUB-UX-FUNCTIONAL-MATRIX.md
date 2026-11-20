# SpendGuru — funkcjonalna macierz UX Source Hub

Stan 2026-11-05; materiał do projektowania, **bez implementacji UI lub aktywacji konsumentów**. Wspólny Hub dostarcza dane i provenance; Newsfeed przechowuje obserwacje, Macro Calendar preferencje i prezentację, Procurement Insights selekcję/ReportEvidenceBundle/Composer. Priorytet nie stanowi potwierdzenia LIVE ani zatwierdzenia licencji.

## Układ formularzy

**Podstawowy:** cel/temat, provider/tryb, najważniejsze kryteria właściwe tej rodzinie, zakres czasu z właściwą etykietą i przycisk podglądu. Nie prezentować surowych nagłówków ani wszystkich opcji dostawcy. Widok wyników: pochodzenie, czas o znanym znaczeniu, ograniczenia pokrycia, puste wyniki i bezpieczny błąd. Bez sekretów lub identyfikatorów prywatnych w URL.

**Zaawansowany:** kafelki wszystkich/dowolnych/wykluczonych fraz, domeny/wydawcy, pola tekstu, horyzonty/ID, przełączniki zależne od endpointu. Podgląd zawiera czytelne zdanie i rozwijane kryteria Hub + wynikową składnię providera. Brave pokazuje etykietę „operatory eksperymentalne”, a TE text/eventText „filtr lokalny pobranego podzbioru”. Zmiana źródła wskazuje nieprzenoszalne warunki i nie usuwa ich po cichu.

**Future:** kontrolki wymagające nowego kontraktu/entitlement są wyłączone lub pozostają w projekcie z jawną zależnością, nie sugerują gotowej funkcji. E1 i serwerowe uprawnienia nie mogą wynikać z formularza. Domyślne wartości muszą być widoczne: zwłaszcza Brave US/en kontra jawne ALL.


## Newsfeed


### MVP (P0)

| Funkcja | Kontrolka / interakcja | Znaczenie | Zależność od backendu / API | Kryterium akceptacji |
| --- | --- | --- | --- | --- |
| Wybór providera i trybu | NewsAPI artykuły/nagłówki; Brave Web; TE News | Zmiana trybu przelicza dostępne kontrolki; nie po cichu usuwa warunków. | Aktualny Hub1.0.0; istniejący runtime NF; nie oznacza gotowego UI. | Brak nieobsługiwanych pól w wygenerowanym żądaniu. |
| Temat i dokładne frazy | Pole tematu + frazy w osobnych kafelkach | NewsAPI terms; Brave przekazany tekst z oznaczeniem eksperymentalnym; TE tylko lokalny substring. | Obsługiwane dziś, semantyka zależna od providera. | Podgląd wyjaśnia tekst natywny vs projekcja lokalna. |
| Język i właściwe znaczenie kraju | Listy zależne od trybu | Brave kraj wyszukiwania; Headlines edycja US; katalog kraj wydawcy; brak filtra miejsca wydarzenia. | Aktualne enum; nowe języki Brave wymagają ujednolicenia. | Nie ma wspólnego filtra kraj wydarzenia. |
| Domeny włączone i wykluczone | Lista domen z walidacją hosta | NewsAPI natywnie; Brave operator + lokalne sprawdzenie zwróconych URL. | Aktualny Hub; domeny Brave max10 na listę. | Wykluczona domena nie przechodzi projekcji; komunikat o podzbiorze. |
| Czas i kolejność | Zakres publikacji NewsAPI; świeżość Brave; sortowanie dostępne tylko tam gdzie obsługiwane | Nie nazywać freshness datą publikacji. | NewsAPI sort/date; Brave brak osobnego sortBy; TE kolejność providera. | Etykiety dat zgodne z ich pochodzeniem. |
| Podgląd i wynik zapytania | Czytelne zdanie + rozwijany podgląd parametrów | Widoczne filtry natywne/lokalne, ostrzeżenie o kompletności; puste wyniki prawidłowe. | Coverage i page z Hub; żadnych sekretów w podglądzie. | Użytkownik widzi, dlaczego źródła mają różne kryteria. |

### Advanced (P1)

| Funkcja | Kontrolka / interakcja | Znaczenie | Zależność od backendu / API | Kryterium akceptacji |
| --- | --- | --- | --- | --- |
| Wszystkie/dowolne/wykluczone słowa | Kafelki warunków i przełącznik zaawansowany | NewsAPI obsługuje grupowanie; Brave bez obietnicy równoważnego drzewa Boolean. | NewsAPI terms; Brave text; przyszły dowód operatorów. | Wyświetlana składnia odpowiada żądaniu; brak fałszywego ścisłego AND. |
| Katalog wydawców i pola tekstu | Wyszukiwany multi-select; tytuł/opis/fragment | Katalog jest podzbiorem headlines; fields tylko Everything. | Obecny publishers i fields w Hub; nowe wywołanie katalogu wymaga właściwego dopuszczenia. | sources+country/category blokowane w headlines. |
| Istotne metadane wyników | Wybór kolumn; widoczne pochodzenie/snippet | Rozróżnić publikację, modyfikację, pobranie; unknown zostaje unknown. | Dziś nieliczne pola normalized/native. | Nie wymyśla daty publikacji Brave ani języka artykułu NewsAPI. |

### Future (P2)

| Funkcja | Kontrolka / interakcja | Znaczenie | Zależność od backendu / API | Kryterium akceptacji |
| --- | --- | --- | --- | --- |
| Ścisłe operatory i korekta zapytania Brave | Pokazanie query.altered, applied i flag per wynik | Użytkownik widzi złagodzone wyniki i tekst wykonany po korekcie. | Rozszerzenie kontraktu/normalizacji + LIVE semantyki; dziś tylko providerQueryAltered Boolean. | Nie deklaruje ścisłości bez metadanych i dowodu. |
| Goggles i odrębny News Search | Zatwierdzone profile i osobny typ providera | Bez traktowania rankingu jako filtra; dedykowane News ma inne limity niż Web. | Nowy zakres adaptera/kontraktu/entitlement. | Brak mieszania endpointów i domyślnych safesearch. |
| Monitoring, trwałe powiadomienia i AI summary | Osobne przyszłe ustawienia | Nie wynikają z obecności parametru Brave summary. | Kolejny zakres konsumenta Newsfeed, nie Hub. | Brak udawanej aktywacji funkcji. |

## Macro Calendar


### MVP (P0)

| Funkcja | Kontrolka / interakcja | Znaczenie | Zależność od backendu / API | Kryterium akceptacji |
| --- | --- | --- | --- | --- |
| Kraje i okres wydarzeń | Multi-select + zakres dat + właściwa strefa prezentacji | Native TE; Hub UTC i max366 dni, wynik może mieć do1000 zdarzeń dostawcy. | Aktualny adapter, brak LIVE tej rodziny. Aktywny konsument wymaga przyjęcia. | Zakres nie jest okresem referencyjnym danych. |
| Istotność i kategorie | Jedna wartość istotności + wybór wskaźników | Kategoria natywna; pełny katalog kalendarza wymaga przyszłej ekspozycji w Hub. | importance/indicators obecnie; katalog nieobsługiwany. | Nie obiecuje progu >= ani jednego wspólnego katalogu grup. |
| Tabela wydarzeń i rozdzielone wartości | Kolumny termin,kraj,event,Actual,Previous,Forecast,TEForecast | Konsensus i prognoza TE w osobnych kolumnach; Revised to wartość sprzed rewizji. | Normalized calendar; renderowanie po stronie konsumenta. | Puste wartości nie stają się zerem; znana skala/jednostka. |
| Sortowanie i grupowanie widoku | Termin/kraj/istotność; tabela/kalendarz | Lokalne operacje na pobranym podzbiorze, nie parametry natywne TE. | Wymaga UI konsumenta; Hub nie sortuje na życzenie. | Widoczny zakres i ostrzeżenie o niepełnej kolekcji. |

### Advanced (P1)

| Funkcja | Kontrolka / interakcja | Znaczenie | Zależność od backendu / API | Kryterium akceptacji |
| --- | --- | --- | --- | --- |
| Konkretne wydarzenia i tickery | Przełącznik: kryteria / ID / ticker | Tryb ID wyłącza pozostałe selektory; ticker+daty nieobsługiwane w Hub. | Aktualne eventIds/tickers; natywny ticker+date przyszły. | Kontrolki uniemożliwiają niewłaściwe kombinacje. |
| Status i rewizje | Etykiety scheduled/reported/unknown + data aktualizacji | Hub wyprowadza status z Actual i czasu; nie gwarantuje oficjalnego statusu cancelled/postponed. | Obecne releaseStatus/temporalPosition/dateSpan; brak pełnego dziennika rewizji. | Szacunkowy termin oznaczony, unknown nie ukryte. |
| Presety użytkownika | Nazwane zestawy krajów i wskaźników | Konfiguracja należąca do konsumenta, nie stała lista w Hub. | Trwałe preferencje aktywnego konsumenta + E1. | Preset zachowuje znaczenie filtrów i aktualny katalog. |

### Future (P2)

| Funkcja | Kontrolka / interakcja | Znaczenie | Zależność od backendu / API | Kryterium akceptacji |
| --- | --- | --- | --- | --- |
| Dane numeryczne i tłumaczenia | Locale i preferencja wartości numerycznych | values=true; lang i oryginalne nazwy. | Nowe kryteria i pola kontraktu; dziś pomijane. | 178K nie jest parsowane naiwnie na178. |
| Grupy i eksport ICS | Wybór grup / pobierz do kalendarza | Natywne group i span1..12M, brak pełnego katalogu grup i schema ICS. | Nowe ścieżki adaptera i kontrakt eksportu/licencji. | Brak wymyślonej listy grup i automatycznego udostępnienia poza licencją. |
| Point-in-time i streaming | Wybór wersji / aktualizacje push | Historyczny termin wydarzenia nie jest selektorem vintage. | Wymaga wyjaśnienia TE PIT i osobnego kontraktu streaming. | Bez przedstawiania bieżących zrewidowanych wartości jako pierwotnych. |

## Procurement Insights


### MVP (P0)

| Funkcja | Kontrolka / interakcja | Znaczenie | Zależność od backendu / API | Kryterium akceptacji |
| --- | --- | --- | --- | --- |
| Cel raportu i geografia | Temat raportu + kraje/regiony | Regiony rozwijane w krajach przez konsumenta; brak automatycznej lokalizacji wydarzeń. | Wspólne kryteria Hub; selekcja w Insights. | Nie wymaga twardej listy słów dla ropy/asfaltu. |
| Źródła i czynniki rynku | TE News/Calendar/Indicators/Forecast Indicators + Brave/NewsAPI | Osobne rodziny żądań; preferencje źródeł po stronie konsumenta. | Sześć obecnych API; zaawansowane rodziny nadal offline verified. | Raport nie deklaruje sprawdzenia nowych API LIVE. |
| Tematy, synonimy i wykluczenia | Grupy tematyczne:produkcja,popyt,logistyka,sankcje | Kryteria pobierania przekazywane per provider; waga czynnika nie jest APIfilter. | NewsAPI grammar; Brave experimental; TE lokalny substring. | Widać różnice semantyki i pokrycia materiału. |
| Horyzont analizy i wskaźniki | Okres publikacji/zdarzeń + lista wskaźników + horyzonty TE | Nie łączyć zakresu wiadomości, okresu obserwacji i forecast target w jedną datę. | Obecne snapshoty i prognozy; historia Indicators przyszła. | Raport zachowuje jednostki i referencePeriod każdego rekordu. |
| Minimalne evidence | Karta źródła:title,URL,provider,czas,licencja,jakość | Hub dostarcza metadane; Insights ocenia i buduje ReportEvidenceBundle. | Obecna provenance/metadata; retention0 wymaga zgodnego nietrwałego użycia. | Snippet nie staje się pełnym artykułem; cytat wymaga źródła i praw. |

### Advanced (P1)

| Funkcja | Kontrolka / interakcja | Znaczenie | Zależność od backendu / API | Kryterium akceptacji |
| --- | --- | --- | --- | --- |
| Poziom szczegółowości i priorytety czynników | Wagi i ilość materiału na sekcję | Selekcja po pobraniu należy do Insights/Composer. | Bez zmian w Hub; aktywny kontrakt raportu/evidence. | Parametr nie jest wysyłany do providera jako fikcyjny APIfilter. |
| Oryginał, rewizja i porównanie prognoz | Oddzielne kolumny actual/consensus/TE i daty | ExternalForecasts nie zastępuje Forecast Core lub Macrobond. | Obecna normalizacja + późniejszy model prezentacji konsumenta. | Brak mieszania skal/jednostek i vintage. |
| Preferencje źródeł | Listy domen/wydawców + uzasadnienie wyboru | Preferencje to ranking/selekcja w Insights; filtry domen mają własną semantykę. | Obecne pola domen/publisherIds; ocena jakości poza Hub. | Preferowane źródło nie jest automatycznie wiarygodne. |

### Future (P2)

| Funkcja | Kontrolka / interakcja | Znaczenie | Zależność od backendu / API | Kryterium akceptacji |
| --- | --- | --- | --- | --- |
| Prognozy instrumentów Brent/WTI | Wyszukiwarka instrumentów z nieaktywnym przełącznikiem Markets | CO1:COM/CL1:COM są przykładami dostawcy; nie mapa kanoniczna Market Data. | Entitlement + potrzeba raportu + osobne przyjęcie; domyślnie OFF. | Nie wykonuje wywołań ani nie włącza rodziny w tym zadaniu. |
| Historia wskaźników i vintage prognoz | Wykres okresów + źródłowe wersje | TE historia obserwacji jest odrębna od historii kolejnych prognoz. | Nowy kontrakt historii; vintage niepotwierdzone w przejrzanej referencji. | Brak rekonstrukcji starych prognoz z ForecastLastUpdate. |
| Bogatsze dokumenty źródłowe | Goggles,rich clusters,fetch metadata | Nowe pola mogą pomóc selekcji, lecz nie przyznają praw do przechowywania treści. | Rozbudowa normalizacji/kontraktu i uprawnień; nie AI report engine w Hub. | Każde pole ma źródło i ograniczenie retencji. |

## Kryteria pobrania a selekcja raportu

Pobranie: kraj/okres/źródło/kategoria/domeny/tekst, zgodnie z adapterem. Selekcja Insights: istotność dla raportu, waga czynnika, wiarygodność, szczegółowość, eliminacja sprzeczności i wybór cytowalnego evidence. Raport Oil & Asphalt Market Outlook może zawierać zestawy tematów Brent/WTI, asfalt/bitum, OPEC+, rafinerie, logistyka/zapasy, sankcje i geopolityka, lecz użytkownik może je edytować i tworzyć inne raporty. Hub nie otrzymuje fikcyjnych parametrów typu reportPriority/evidenceQuality.

Przy retencji0s nie projektować trwałego magazynu pełnych treści ani bezterminowego evidence cache. Trwałe odniesienia, streszczenia i eksport wymagają zgodnego kontraktu konsumenta oraz licencji. Nie wszystkie branżowe scenariusze mają aktywny runtime; macierz opisuje możliwość zaprojektowania poprawnego wejścia, nie pełne wdrożenie Kalendarza lub Insights.

Źródła kryteriów: [inwentarz](SOURCE-HUB-API-PARAMETER-INVENTORY.md), [parametry](SOURCE-HUB-API-PARAMETERS.csv), [pola](SOURCE-HUB-API-RESPONSE-FIELDS.csv), [kombinacje](SOURCE-HUB-PARAMETER-COMPATIBILITY.md). Kanoniczny Design System zostanie użyty przy późniejszym projektowaniu UI; w tym zadaniu nie modyfikowano MagicPath ani ekranów.
