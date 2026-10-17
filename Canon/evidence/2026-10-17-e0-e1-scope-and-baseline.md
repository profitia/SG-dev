# E0/E1 — zaakceptowany zakres i punkt odniesienia 17.10.2026

**Status:** ACCEPTED_EXECUTION_SCOPE / DATED_BASELINE. Program jest rozpoczęty; pełne E0 i E1 oraz wydania Development/Staging nie są odebrane przez ten dokument.

**Authority:** profitia/SG-dev, main; odczytany source SHA `99d3a408bf7a91a50387ce8efd79ce68c7b2fa9e`. Odczyty dostawców są sekwencją obserwacji, nie atomowym snapshotem. Nie przepisano historycznych freeze ani wcześniejszych odbiorów.

**Zadanie:** `ARCHITECTURE-E0-E1-SCOPE-BASELINE-20261017`; profil ARCHITECTURE, workspace SG-dev Architecture, TARGET_ENVIRONMENT=development, wykonanie lokalne. Bieżąca jednostka realizuje ustalenie zakresu i rozszerzenie baseline; odczyty Staging nie są jego wdrożeniem.

**PMOS:** własna baza `architecture_pmos`, projekt `billowing-credit-07394675`, rola `architecture_pmos_runtime`; begin `cmvbzzlon0000hrqyo3r3g2t3`; task conversationId `pmos-task-v2:ee2cc6aa71d0ff7587d474f6c5b67cfd3b7853f1179fce29f0e9ab9ee6de234a`; rzeczywisty hostConversationId `01a133c2-c245-77a0-bb6b-33165e2ad80c`. Rejestracja nie jest dowodem closeout.

**Źródła:** [docelowy kanon](../v1.0-spendguru-srm-target-architecture-canon.md), [kontrakt i macierz dostępu](../v1.0-operation-context-and-access-contract.md), [baseline 16.10](2026-10-16-architecture-e0-baseline.md), [poprzedni ograniczony odbiór](2026-10-17-operation-context-final-acceptance.md), [maszynowa inwentaryzacja](../registries/e0-e1-protected-surface-inventory-v1.json).

## Podstawa i granice upoważnienia

Właściciel odrębnie zlecił w trybie Full Autopilot kroki01–11 dokończenia E0/E1: wspólne fundamenty, rzeczywista ochrona objętych operacji, ograniczone role i prywatne dane, zadania w tle/cache/pliki, audyt, ponowne użycie modułu biznesowego w drugim gospodarzu, testy oraz kontrolowane wydania Development i następnie Staging. Uniwersalny wrapper sam nie autoryzuje E2–E4. Brak limitu72h i brak zgody na Production.

Nowe repozytoria i projekty GitHub/Render/Neon tworzy właściciel według instrukcji; tworzenie poświadczeń oraz obowiązujące osobiste zatwierdzenia wydania pozostają jego czynnościami. Kontynuacja nie wymaga rutynowych pytań o commit, PR lub przejście między przyjętymi krokami. Blokady governance, utrata danych, nieprzewidziana zmiana dostępu i nieodwracalne operacje nie są uchylane.

| Krok | Przyjęty rezultat | Dowód wymagany przed zakończeniem |
| --- | --- | --- |
|01–02 | Zamknięty zakres, źródła danych, wejścia i regresje, aktualne powiązania oraz granice wydania | Niniejszy baseline, pełna enumeracja wejść w określonych katalogach, odczyty dostawców i jawne braki dowodów |
|03 | Zweryfikowany aktor i minimalne rzeczywiste konto/członkostwo | Weryfikacja dostawcy i bieżącej sesji, własne ID, brak zaufania do nagłówka, odmowa po odebraniu dostępu |
|04 | Ograniczone role i egzekwowana prywatna separacja | Zwykła rola, FORCE RLS tam gdzie właściwe, spójność kluczy właściciela i migracje/odzyskiwanie na danych testowych |
|05 | Rozszerzony wspólny mechanizm i chroniony audyt | Jawne reguły efektów i właścicieli; trwały intent/outcome/failure; brak możliwości dopisywania sobie praw |
|06–07 | Wszystkie objęte wejścia, eksporty, integracje, joby/cache/pliki | Równoważne kontrole na wejściach alternatywnych; aktualna delegacja i unieważnienie dostępu; brak bocznego odczytu |
|08 | Supplier Intelligence w drugim gospodarzu | Rzeczywisty moduł biznesowy i chroniony przepływ w SRM oraz SG2; osobne buildy UI |
|09 | Dowody pozytywne, negatywne i regresyjne | API/SQL/integracja, zachowanie biznesowe i kompletne raporty bez pozornych skipów |
|10 | Wydania Development obu produktów | Odrębne zadania SG2/SRM, właściwe zasoby, retencja artefaktów, LKG i rzeczywisty odbiór |
|11 | Wydania Staging i odbiór programu | Własne kontrakty wydania, osobisty owner review, dokładne źródło, rollback i testy po wdrożeniu |

Pełny AppShell, samoobsługowe tworzenie organizacji i zaproszenia, administracja rolami w UI, transfer własności, Stripe, onboarding samodzielnego SaaS i pełny katalog produktów pozostają E2–E4. Minimalne indywidualne konto i członkostwo niezbędne do E1 są objęte obecnym zakresem; nie wolno zastąpić ich pozornym aktorem HUMAN utworzonym z demo.

## Nowa decyzja dotycząca logowania

Właściciel wskazał brak skonfigurowanego indywidualnego IdP i istniejące konto Clerk; później doprecyzował, że Clerk ma być tymczasowy, a własny system logowania/obsługi kont może powstać w osobnym kroku. Dane konta startowego pozostają w konfiguracji bootstrap, bez publikowania osobowych danych administratora w publicznym repozytorium.

Clerk potwierdza tożsamość. Wewnętrzne userId/organisationId, członkostwa, granty, dostęp produktu i wersje polityk należą do Profitii. Zewnętrzne powiązanie obejmuje środowisko, issuer i subject; nie wolno automatycznie scalać istniejących kont ani nadawać roli administratora tylko na podstawie przesłanego adresu e-mail. Aktywacja konta startowego wymaga zweryfikowanego konta dostawcy i kontrolowanego bootstrap. Historia wspólnego demo nie staje się historią tej osoby.

Przekazano instrukcję utworzenia `profitia-platform-development`, wariant Consumer, e-mail/kod, bez Organizations/Billing, z ograniczonym dostępem. Utworzenie aplikacji potwierdza ekran właściciela; identyfikatory, ustawienia, klucze i działanie sesji nie są jeszcze niezależnie zweryfikowane. Instancja Clerk Development służy integracji technicznej; nie stanowi odbioru zabezpieczeń wydania Staging ani Production. [Środowiska Clerk](https://clerk.com/docs/guides/development/managing-environments).

Nie wymusza się aktualizacji frameworków produktów dla wspólnego kontraktu. SG2 korzysta z Next14.2.29/React18, SRM z Next16.3.8/React19.2.4. Publiczne metadane `@clerk/nextjs`7.9.17 nie deklarują zgodności z Next14; linia6.39.7 ją deklaruje, ale należy do Core2 LTS do stycznia2027. Wybór adaptera wymaga testu zgodności i oceny wspieranego SDK backendowego, zamiast wymuszania zależności lub udawania wspólności UI. [Wymagania Core3](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3), [LTS](https://clerk.com/docs/guides/development/upgrading/versioning).

## Zakres wejść i klasy danych

Rejestr obejmuje wszystkie `route.ts` w App Router trzech aplikacji: **52 SG Runtime, 15 dashboard i14 SRM — 81 plików, 87 metod HTTP**. Każdy zapis ma ścieżkę, metodę, hash źródła, routing, aktualny mechanizm ochrony i kandydatów operacji. Dodatkowe12 powierzchni opisuje joby/CLI, cache, pliki, projekcję oraz moduł X-Ray. To skończony zakres enumeracji, nie deklaracja przeglądu każdej linii repozytorium lub wszystkich API dostawców.

Kandydat mapowania operacji nie nadaje dostępu. Trzeba potwierdzić efekt i zasoby każdego handlera; brak lokalnego wywołania auth nie oznacza braku ochrony, gdy działa middleware lub fabryka handlerów. Rejestr rozróżnia te przypadki. Publiczne health/login/advisory mają własną politykę; nie dostają fikcyjnego wymogu członkostwa.

Obowiązują klasy SHARED_KNOWLEDGE, ORGANISATION_PRIVATE, USER_IN_ORGANISATION_PRIVATE, ACCOUNT_PRIVATE, OPERATION_AUDIT i TECHNICAL_CONTROL. Uniwersalne dane rynku, benchmarków/forecastów oraz katalogi i źródła firm są wspólne; wybory dostawców/kategorii/benchmarków, zleceniodawca, listy, preferencje i eksporty są odrębnie prywatne. Źródłowe dane osobowe KYS/PESEL i ograniczenia ich udostępniania nie stają się publiczną wiedzą przez pochodzenie z MGBI/Vercly. Nie rozszerza się dotychczasowego zakresu PII ani uprawnień dostawców.

Wybór modułu do drugiego gospodarza: istniejący Supplier Intelligence/X-Ray, ponowne użycie jego kontraktów oraz odczytu/projekcji. Samo użycie wspólnego executora lub kopiowanie komponentu nie spełnia tego warunku. Operacja `report-data` zapisuje projekcje i preferencje; jej nazwa nie czyni jej czystym odczytem.

## Aktualne fakty dostawców i kodu

Odczytano17 usług Render wskazujących SG-dev; wszystkie niesuspendowane, najnowsze wdrożenia `live`. Pełne deployment ID i SHA są w rejestrze. Te statusy nie dowodzą biznesowego E2E ani wykonalności rollbacku.

| Główna usługa | Deployment | Source SHA |
| --- | --- | --- |
| SG2 Development | dep-daqd0uh42hec7398f5vg | c55c551091b3584673726bd0a78254eb091c7197 |
| SG2 Staging | dep-db0dhbm1egvs73f70kr0 | 48dfcd8af93fa9f5e9708653a868b89c138b6b91 |
| SRM Development | dep-db97cj6k1f9s738na1r0 | 6eede5cd19fd3a4519d66298effe9ef94633757a |
| SRM Staging | dep-db97qcjl550s73d2f170 | 6eede5cd19fd3a4519d66298effe9ef94633757a |

AutoDeploy jest wyłączone dla produktów, dashboardów i workerów objętych wydaniem. Trzy automatyczne usługi SG-dev to PCOS, Vector i SG2 PMOS. Ich rootDir/buildFilter nie obejmują trzech zmienianych dokumentów. Nowy deployment `dashboards-library` dep-db9cpplckfvc73bu8lj0 zachowuje starszy source SHA518f1ad9; nie utożsamia się czasu deploymentu z nową wersją kodu.

Źródłowe delty względem działających wersji są zapisane osobno dla usług i współdzielonych pakietów. Dla głównego SG2 Development jest13 zmienionych plików aplikacji, SG2 Staging30; dla SRM8. Nie są to zakresy całego repozytorium i nie dowodzą akceptacji wszystkich zmian. Nie wdraża się po prostu bieżącego main bez walidacji tej delty i dokładnej kompozycji dashboard/worker/runtime.

Wąski GET nazwanych zmiennych Render potwierdził aktualne hosty, role i etykiety sześciu usług. Nie pobierano wszystkich env-vars, starego NPM_TOKEN ani wartości haseł SRM. `APP_ENV` dashboardu Staging nie jest ustawiony bezpośrednio na usłudze (HTTP404); to nie dowód braku konfiguracji odziedziczonej ani automatycznie przyczyna awarii.

| Dane | Obserwacja SQL/metadata |
| --- | --- |
| Market Dev / br-dry-hall-b294222f |18 tabel public,0 RLS, brak prywatnego sg_runtime_benchmarks/dr_*; aktualny SG_RUNTIME i dashboard DATABASE_URL wskazują ten sam endpoint ep-muddy-pine-b22pdyqd i neondb_owner |
| Market Stage / br-wandering-dew-b2izo8fg |18 tabel public,0 RLS, analogiczne wskazanie ep-cool-lab-b2wm8biu; współdzielona wiedza sama nie wymaga tenantowego RLS |
| SRM Dev / br-dark-surf-b1vrhda9 | srm_app:21 tabel,20 FORCE RLS,22 polityki; rzeczywisty login srm_app_runtime bez superuser/BYPASSRLS/członkostwa neon_superuser |
| SRM Stage / br-broad-butterfly-b11t4v01 | Te same21/20/22; ograniczona rola potwierdzona osobnym SQL; host ep-autumn-wildflower-b1mv0vda |
| Prywatny legacy SG / old-smoke-90429853 |16 tabel, w tym5 sg_runtime_benchmarks;0 RLS; katalog i kolumny odczytane bez prywatnych rekordów |
| Finder, Vector, Vercly/KYS | Branches archiwalne potwierdzone przez metadata; bez SQL, reaktywacji i przenoszenia danych |

SRM ma egzekwowaną granicę organizacji, ale `user_supplier_interest` nadal nie stanowi kompletnej granicy osobistego użytkownika, a kontekst jest związany z aktorem demo i stałą organizacją środowiska. SG Runtime nadal przyjmuje niezweryfikowane x-clerk-org-id/user-id przed demo. Nowy wspólny executor pozostaje przyjęty w izolacji, `liveRouteUsesContract:false`.

Pozostałe zależności są jawne: starsze SG/dashboards/Finder wskazują również rynek Production według poprzednich dowodów; bieżące metadata gałęzi nie są ponownym odczytem ich sekretów. KYS ma własne repozytorium i publiczny upstream; ochrona proxy SRM nie dowodzi ochrony samego KYS. Zmiany tam wymagają ustalenia właściwej authority/profilu. PMOS i Memoros nie są magazynem tożsamości produktu, a historii nie migruje się przy okazji E1.

## Regresje, odzyskiwanie i zasoby

Rejestr określa18 rodzin REG-01–REG-18: tożsamość, bieżące odwołanie uprawnień, środowisko, wejścia publiczne, izolacja organizacji i osoby, wejścia alternatywne, audyt, benchmark/kategorie, forecast, joby, cache/pliki, Supplier Intelligence, finanse, drugi gospodarz, migracje/recovery, kontrolowane CI pakietów i odbiór wydania. Status tego baseline: **SPECIFIED_NOT_EXECUTED**. Wcześniejszych testów nie przedstawia się jako ponownie wykonanych.

Nie uruchomiono płatnego pozyskiwania danych, vendor refresh, mutujących endpointów report-data ani zapisów klientów. Następne zadania potrzebują testów rzeczywistych ścieżek na syntetycznych fixture, a później kontrolowanego odbioru biznesowego. Negatywny test nie może próbować wyciągać cudzych danych z żywego środowiska.

Nie zatwierdzono samą inwentaryzacją nowego projektu ani kosztu. Rozpoznane potrzeby: miejsce autorytatywnego konta/powiązań/polityki bez zależności od Clerk, właściwe prywatne magazyny SG2 dla Dev/Stage, zwykłe role i konta techniczne oraz bezpieczne odzyskiwanie. ARCHLAB zachowuje tylko dane testowe; nie wolno umieszczać tam rzeczywistych kont klientów. Nowe projekty, jeśli wybrany projekt wykonawczy ich wymaga, otrzymają instrukcję z nazwą, regionem, planem/kosztem i granicami; tworzy je właściciel. Nie przepina się starej bazy legacy ani nie reaktywuje archiwalnych gałęzi jako skrótu.

Każda migracja ma jawny schemat, role, dane początkowe i kopię/branch oraz sprawdzoną procedurę odzyskania; rollback kodu nie cofa automatycznie danych. Istniejące deploymenty nie są jeszcze zweryfikowanym LKG tylko dlatego, że mają SHA i statuslive. Wymagane są zachowany artefakt, zgodna konfiguracja, stan migracji i wykonalne odtworzenie. Pierwsze wdrożenie nowej usługi otrzyma procedurę zatrzymania/odtworzenia bez fikcyjnego poprzedniego artefaktu.

GitHub odczytany na żywo potwierdza wymagany review profitia dla obu Staging. SRM zachowuje osobną bramkę release/rollback; nie używa się bypassu. SG2 Staging ma pięć nazwanych deploy-hook secrets, ale nie ma RENDER_API_KEY; same nazwy sekretów nie dowodzą sprawnych poświadczeń. Otwarty PR154 zawiera wcześniejsze hardening/readiness i migracje, PR156 dotyczy immutable PMOS; zachowano je bez merge i bez deklaracji ich gotowości. Plan nie upoważnia do przejęcia tamtej pracy lub wdrożenia PMOS.

## Odbiór tej jednostki a dalsza realizacja

Zakończenie tej jednostki wymaga walidacji kompletności rejestru, haszy i routingu ścieżek, manifestu oraz pełnego governance, publikacji źródła i kanonicznego closeout PMOS/PHR. Nie zastępuje testów produktu. Po zamknięciu można automatycznie przejść do osobnych zadań producenta ARCHITECTURE i odbiorców SG2/SRM w przyjętym programie.

Stan programu pozostaje **IN_PROGRESS**. Ochrona żywych wejść, pełniejsza macierz efektów/PII, tożsamość i uprawnienia, role SG2, migracje, delegacja jobów, audyt, drugi gospodarz oraz oba cykle wydań wymagają kolejnych dowodów. PMOS/PHR dotyczą Development zgodnie z profilem; Staging ma własne dowody wydania, bez pozornego raportowania jako Development.
