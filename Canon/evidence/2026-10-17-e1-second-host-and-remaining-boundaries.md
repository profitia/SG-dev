# E1 — drugi gospodarz i pozostałe granice ochrony, 17.10.2026

**Status: SOURCE_PROGRESS / E0_E1_IN_PROGRESS.** Supplier Intelligence rzeczywiście przyjęto w źródłowym przepływie dwóch aplikacji. Nie jest to odbiór całego E1, rzeczywistego logowania ani wydania Development lub Staging.

**Własne zadanie:** ARCHITECTURE-E1-SOURCE-PROGRESS-AND-BOUNDARIES-20261017; ARCHITECTURE / SG-dev Architecture / development / local. Begin cmvcrzcr10000pq1rn09iwy7b; conversationId pmos-task-v2:689122f19310c48d7621547b07d99f3ccedb9908ae9c35eafb5fb6b51d74401b. Własne architecture_pmos i PHR, MEMOROS disabled. Ten przegląd nie kopiuje rekordów innych profili i nie przypisuje im swoich kryteriów.

**Authority:** profitia/SG-dev/main, d52c6ac6eab719ab0d82dcd1707a3605b7c31457. [Aktualny rejestr źródłowy](../registries/e1-source-progress-v1.json) zawiera pełny skończony spis metod/ścieżek, hasze i routing. Historyczny freeze13.10, baseline17.10 i poprzednia mapa efektów pozostają niezmienione. Obserwacje źródła i sekwencyjne odczyty CI nie tworzą atomowego snapshotu dostawców.

## Przyjęty przyrost źródłowy

| Odpowiedzialność | Projekt / task | Źródło i PR |
| --- | --- | --- |
| Publiczny kontrakt odczytu i integracja istniejącego projektora | SRM / SRM-E1-SHARED-SUMMARY-CONTRACT-PORT-20261017 | 702fc1d70ce4ed4797c5030ddae093694bc04e21, [446](https://github.com/profitia/SG-dev/pull/446) |
| Rzeczywiste API, własna autoryzacja i wspólny moduł UI | SG2 / SG2-E1-SUPPLIER-SUMMARY-ADOPTION-20261017 | 1230fb52cc0dcca057b93981a56b0cf7cdeb4d50, [447](https://github.com/profitia/SG-dev/pull/447) |
| Zgodność noEmit TypeScript z dokładną arytmetyką | SG2 / SG2-E1-SUPPLIER-COMPILER-COMPATIBILITY-20261017 | 4ee46eb53c290f441a240670c7a36540c46e73cc, PR447 |
| Zgodność kompilacji źródłowego pakietu przez Next14 | SG2 / SG2-E1-SUPPLIER-BUNDLE-COMPATIBILITY-20261017 | fe07eae73eb40022a33cf23172e487c050d27646, PR447 |

Każde zadanie ma własny zakończony i niezależnie zweryfikowany cykl PMOS/PHR; trzy zadania SG2 mają wymagane MEMOROS DELIVERED, SRM ma kanoniczne disabled. Odczytano potwierdzenia zapisów we właściwych bazach, integralności archiwum, zdalnego PHR, pending i blokad. Sam begin nie służy za dowód odbioru.

Wspólny @profitia/srm-xray0.2.1 udostępnia czyste kontrakty/formatter/reguły oraz istniejący ExecutiveSummary, faktycznie osadzony w React18 SpendGuru i React19 SRM. Publiczny JSON odrzuca dodatkowe pola, prywatne KYS i niezgodny wybór. Semantykę i kwalifikację liczb nadal realizuje istniejący projektor SRM; walidator struktury nie jest nowym parserem sprawozdań. Reguły finansowe i SQL odczytu producenta nie zostały zastąpione.

SpendGuru sprawdza własne konto, członkostwo, grant, produkt i module binding, zanim wywoła przypięte API SRM. SRM niezależnie weryfikuje tego użytkownika oraz prawa do swojej aplikacji. Wspólny komponent nie nadaje praw i nie przechowuje ID konkretnej organizacji. Odbiorca nie dziedziczy dostępu z benchmarków ani z SRM. Oba hosty zachowują własne audytowane transakcje READ; nie deklaruje się rozproszonej atomowości, wspólnego rollbacku lub zakończonej delegacji serwisowej.

Wymagane są jawne server-owned opt-in i konfiguracja. Nowego modułu nie aktywowano, nie nadano żywych grantów i nie wykonano deploymentu. Tryb legacy i dotychczasowe działające środowiska nie zostały przepięte. Kod nie kopiuje historii demo do rzeczywistej osoby.

## Dowody walidacji

Kontrolowane [CI39060958945](https://github.com/profitia/SG-dev/actions/runs/39060958945) potwierdza czystą instalację oraz129 testów SG2,129pass,0fail,0cancelled,0skipped, pełny typecheck i build dla dokładnego aggregate fe07eae73eb40022a33cf23172e487c050d27646. Testy rzeczywiście wykonują zwykłe transakcje Prisma/RLS, odmowy bieżących praw, izolację benchmarków od supplier module, awarie audytu, transport i React18 UI. Kandydat uruchamia się po usunięciu poświadczenia. Trzy prywatne pakiety, ich wersje i sumy pozostają niezmienione; nie opublikowano ich artefaktów.

Pobrano i niezależnie zweryfikowano wyłącznie oczyszczone dowody dokładnego source/control/policy, dashboardu i publicznych portów React18. Dashboard ma własne test/typecheck/build/productionHttpRefusal. Publiczne39060962948 i39061004914 attempt2 oraz pełne SRM/publicReact18 39060962943 i39061004916 przeszły. Pierwsze publiczne bramki prawidłowo odmawiały przed powstaniem exact-source proof. Main ma osobny dowód39061248663, candidate/control d52c6ac6eab719ab0d82dcd1707a3605b7c31457 i policyc08bc30b90ad0e289bff6c9306920fc258a01bcd2e8625a309116884548987b7.

Pierwszy pełny przebieg39060293811 przeszedł129 testów, ale wykazał targetES2017 niezgodny z BigInt. Drugi39060534388 przeszedł testy/typecheck, lecz Next14 nie przetwarzał źródłowego pakietu. Naprawiono standardowe ustawienia receivera: noEmit targetES2020 i transpilePackages. Zachowano dokładną arytmetykę, Next14/React18 i ustawienia SWC/przeglądarek. Ograniczony lokalny typecheck wcześniej miał ES2022, dlatego nie był dowodem całego produktu. Wywołanie39060509953 z omyłkowym expected SHA anulowano i zastąpiono odczytem SHA bezpośrednio z Git. Nie przedstawia się tych błędów jako zielonych kontroli.

Ten przegląd nie powtarza testów produktu. Weryfikuje ich rzeczywiste dowody i aktualne pliki; osobne lokalne źródłowe dowody producenta obejmują490product,68API/SQL,311promotion oraz4publicReact18, bez pominięć. Nie jest to dowód prawdziwego browser OTP, dwuserwerowego live E2E, ochrony wszystkich funkcji lub wykonalności rollbacku zachowanego artefaktu.

## Skończone pokrycie wejść i pozostała praca

Obecnie spis obejmuje83 pliki route.ts i89 metod HTTP w tych samych trzech App Router co baseline. Przybyły wyłącznie dwa GET shared financial summary; nie usunięto dawnych wejść. Zweryfikowano routing każdego pliku. **Sześć metod** ma przyjęte wspólne current-access przepływy źródłowe: SG2 selection GET/POST i summary GET, SRM report-data POST, financial-excel POST i summary GET. To liczba metod, nie modułów ani stopień procentowy bezpieczeństwa.

| Granica źródłowa | Metody | Znaczenie |
| --- | ---: | --- |
| Wspólny aktualny dostęp w przyjętych przepływach | 6 | Testowane źródło; brak deklaracji żywego wdrożenia |
| Dashboard odmawia całemu hostowi w Clerk mode | 15 | Bezpieczna odmowa; nie jest integracją biznesową |
| Zachowany Cognition guard odmawia Clerk | 38 | Konieczne własne przyjęcie rzeczywistych operacji i efektów |
| Zachowany techniczny adapter forecast | 14 | Weryfikowany techniczny token nie zastępuje aktualnych service grants/delegacji i granic historii inicjatora |
| Pozostałe wejścia X-Ray zachowują demo guard | 9 | W Clerk mode odmowa; lookup/KYS/PDF/PESEL nie są przez to wdrożone dla kont indywidualnych |
| Wejścia publiczne lub osobna polityka legacy auth | 7 | Brak domniemania członkostwa organizacji; własna polityka wejścia |

Przegląd nie potwierdza każdej linii lub dowolnego dynamicznego upstream. Klasyfikacja odmowy w trybie Clerk nie oznacza braku każdej ochrony w legacy ani regresji działającej starej wersji.

Pozostają: dostęp do danych rynku/discovery i koszty efektów read-through; prywatne kategorie i przypisania; lookup i pozyskiwanie KYS/MGBI; inne eksporty/PII; dashboard; zadania globalne i delegowane; cache/pliki oraz rzeczywiste wydania. Dane wspólne nie nadają globalnych praw zapisu ani wspólności prywatnej historii zapytania. W source route-handlers prepared rolling-daily current pobiera historyczne series przed fingerprint; dlatego nie wolno uznać całego tego call chain za czysty odczyt gotowego artefaktu. Sam analytics eligibility w odczytanej wersji buduje URL; uruchomienie przygotowania po stronie odbiorcy trzeba ocenić oddzielnie.

## Osobna granica KYS

Odczytano publiczny profitia/KYS/main, ae09b8d045f13e35dcc429a994a91c678594c28a, konkretne handlery start/status/poll/report/PDF/dev-smoke i ich warstwy dostępu/orchestracji/repozytorium. W tych ścieżkach start bierze orgId/requestedByUserId z body, status/poll ładuje po ID, raport/PDF stosuje serwerowy dev-local org context, a smoke POST zapisuje testową weryfikację. W śledzonym drzewie nie ma globalnego middleware/proxy. To utrzymująca się luka źródłowa L-07; nie wykonano próby odczytu cudzego raportu, płatnego pobrania, SQL lub testu penetracyjnego. Ekspozycja konkretnego deploymentu i wartości jego konfiguracji nie zostały ponownie zweryfikowane; nie stwierdza się wycieku danych.

Aktywny rejestr ma profile SG2/SRM/CIC/ARCHITECTURE i nie nadaje authority do mutacji profitia/KYS. Jednorazowy wyjątek właściciela dla skanera PHR nie obejmuje KYS. Zmiana zewnętrznej aplikacji wymaga kontrolowanego onboardingu lub osobnej jednoznacznej decyzji authority, a następnie własnych bramek. W tym zadaniu niczego tam nie zmieniono.

Nie utożsamia się osobnej aplikacji Profitia KYS z funkcją KYS w SRM lub API dostawcy Vercly. Aktualny adapter SRM wysyła tablicę zlecenia do konfigurowalnego VERCLY_API_BASE_URL z własnym provider credential; sam podobny path /api/verifications nie dowodzi połączenia z profitia/KYS.

## Granice odbioru programu

Całe E0/E1 pozostaje IN_PROGRESS. Przyrost źródłowy jest przyjęty; żywe konta, właściwe granty/role i połączenia, odzyskiwanie danych, zachowany artefakt LKG oraz wydania Development i następnie Staging nadal wymagają własnych dowodów i zakresów wydania. Staging nie może korzystać z pożyczonej tożsamości/sekretów Development ani być tak raportowany w PMOS. Osobisty owner review pozostaje bramką.

Odczyt metadanych istniejących usług lub dawny status live nie jest proof rollbacku. Ten przegląd nie podnosi planów, nie tworzy projektów i nie zmienia baz, ról, danych, sekretów, routingu, dostawców lub aplikacyjnych flag. Dalsze niezależne zadania istniejącego zakresu mogą być realizowane automatycznie; mutacja osobnego KYS zależy od jego authority. Production, E2–E4 i nowy program nie zostały zlecone tym dokumentem.
