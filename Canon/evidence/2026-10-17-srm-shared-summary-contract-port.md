# E1 — publiczny kontrakt wspólnej odpowiedzi finansowej SRM, 17.10.2026

**Task:** SRM-E1-SHARED-SUMMARY-CONTRACT-PORT-20261017; SRM / SG-dev Codespaces SRM / development / local. Begin cmvcpwm2v0000d92wad44ggvm; conversationId pmos-task-v2:e1c30ce0194e653c5b5964a13c541b09f276f60605eef873379d5e6b36a2881c. Własny srm_pmos i wymagany PHR; MEMOROS disabled zgodnie z profilem. Begin nie oznacza closeout.

## Zakres producenta

Istniejący AM21 kontroluje zamkniętą odpowiedź wspólnego finansowego podsumowania. Jej kontrola JSON zostaje publicznym, czystym portem @profitia/srm-xray/shared-financial-summary, aby mógł jej użyć także drugi gospodarz. Dotychczasowy projectSharedFinancialResponse nadal kontroluje rzeczywiste nagłówki HTTP i odpowiedź200; następnie wywołuje tę samą funkcję modułu. Nie powstał drugi projector finansowy, silnik uprawnień, runtime, fetch lub writer.

Lokalny pakiet0.2.1 dodaje eksport bez nowej zależności i bez zmiany publicznych UI/rules/value ports. Lockfile SRM zmienia wyłącznie lokalną wersję0.2.0 na0.2.1. Wspólne operation/identity/access/host digests oraz SQL001–004 pozostają bez zmian.

Kontrakt wiąże schemaVersion/NIP/entityType i zamknięte pola wspólnej projekcji. KYS pozostaje NOT_REQUESTED/ABSENT, bez danych, dat pobrania, eksportu lub preferenceScope. Nieznane dodatkowe pola są odrzucane również w okresach, faktach, historii, comparison, definitionRef i zadeklarowanych opcjonalnych danych korporacyjnych. Nie są po cichu usuwane. Kontrola nie interpretuje wartości, nie przelicza wskaźników i nie zastępuje kwalifikacji pochodzenia/liczb przez obecny projector. Nie upoważnia do żadnego odczytu.

Dla JDG zachowano rzeczywisty brak obserwacji finansowych. Puste tablice points mogą nadal nieść istniejące definicje wskaźników; nie są finansowymi danymi osoby. Przy pierwszej walidacji błędnie uznano samą niepustą listę takich definicji za obserwacje. Test na rzeczywistym wyniku projectora wykrył to; walidator sprawdza teraz obecność obserwacji, zachowując pusty wynik i odmowę danych korporacyjnych podstawionych pod JDG.

## Walidacja lokalna

490 testów produktu,68 testów rzeczywistych API/SQL/konfiguracji i311 testów promocji PASS, zero skipped. Typecheck i build SRM PASS. Te fixture używają oddzielnych, jawnie strzeżonych lokalnych baz, zwykłych ról i syntetycznych danych; nie zmieniają chmury lub danych klientów.

Dziewięć testów celowanych potwierdziło rzeczywiste wartości i brak danych, wspólne summary rules, zachowanie zadeklarowanych sourceRegistration/comparativeData i struktur historii, brak modyfikacji wejścia oraz odmowy pól prywatnych i malformed/wrong context. Dotychczasowy kod zapytania i biznesowego odczytu przed output fence jest byte-for-byte niezmieniony; hash bloku: 1ea8aa90986cb8ee14364439c4cfb6be6c5d68c84c199afe3096546e54a3691a.

Izolowany rzeczywisty gospodarz React18.3.1:4 testy publicznych portów/UI oraz typecheck PASS. Loader rzeczywiście odrzuca React/ReactDOM i mimo tego ładuje także nowy port walidacji. Osobne testy UI nadal używają rzeczywistego React18; nie deklaruje się zgodności wszystkich pozostałych mountów modułu. Weryfikacja porównała zainstalowaną lokalną kopię pakietu z aktualnym source; po npm zachowującym starą kopię odświeżono wyłącznie własny wygenerowany pakiet. Publiczny cache użyto bez credentiali; nie pobierano NPM_TOKEN Render. Usunięto tylko jednoznacznie własny wygenerowany import Next root-params po buildzie.

## Granice odbioru

To producent source oraz testy w izolacji. Osobny task SG2 ma przyjąć wspólny walidator, istniejące UI i rzeczywisty chroniony przepływ z własnym kontem/członkostwem, produktem, module binding i audytem. Sam ten port nie stanowi integracji SG2, działania Clerk live ani kontrolowanego wydania Development/Staging.

Nie zmieniono usług, flag aktywacji, sekretów, ról, grantów, danych biznesowych, staging/production ani historii PMOS. Zdalne exact CI, PR/merge oraz canonical closeout wymagają odrębnego potwierdzenia po tej wersji; aktualizacja dowodów nie zastępuje ich rzeczywistego wykonania.
