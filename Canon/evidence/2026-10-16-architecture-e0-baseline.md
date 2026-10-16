# Punkt odniesienia architektury i granice zmiany — 16.10.2026

**Status:** DATED_BASELINE / FROZEN_EVIDENCE. Odbiór ograniczonego audytu; nie jest odbiorem całego E0 ani rozpoczęciem E1–E4.

**Podstawa:** osobna instrukcja właściciela: potwierdzenie aktualnego kodu, wdrożeń, powiązań baz i istniejących błędów; scenariusze regresji; rozpoznanie potrzeb zasobowych i automatycznych wdrożeń. Rezultat: punkt odniesienia oraz znane granice zmiany. Pełny Autopilot dotyczy tego zakresu.

**Tożsamość:** ARCHITECTURE-E0-BASELINE-20261016; profil ARCHITECTURE; workspace SG-dev Architecture; TARGET_ENVIRONMENT=development; wykonanie lokalne. Przedmiotem audytu są również odczytowe dowody innych środowisk; nie przeprowadzono operacji wydania Staging ani Production.

**Authority:** profitia/SG-dev, main; źródłowy SHA 81d25a0cd1d98161ce1b40344867bdcc1bbd7969. Odczyty wykonywano 16.10.2026 od około 20:57 do 21:12 UTC, czyli 22:57–23:12 Europe/Warsaw. To sekwencja obserwacji, nie atomowy snapshot wszystkich dostawców.

**PMOS:** architecture_pmos, projekt billowing-credit-07394675; rejestracja cmvbgaf4j00002ktdv4yjnyou; conversationId wyprowadzone przez PMOS: pmos-task-v2:0decca1ce1d882896ddd45a8a0c2215bc73a13f0845f462f864674bea51ca04f. Host nie udostępnia identyfikatora: hostConversationId=null i jawna flaga niedostępności. Nie użyto identyfikatora innej rozmowy.

**Powiązania:** [architektura docelowa](../v1.0-spendguru-srm-target-architecture-canon.md), [freeze 13.10](2026-10-13-spendguru-srm-architecture-freeze-and-gap-audit.md), [roadmapa](../v1.0-spendguru-srm-architecture-delivery-roadmap.md), [odbiór E0-A](2026-10-13-e0-a-04-09-final-acceptance.md). Poprzednich dowodów i wymagań nie przepisano.

## 1. Wynik i znaczenie dowodów

Istnieją cztery odrębne środowiska biznesowe SpendGuru i SRM: Development i Staging każdego produktu. Wszystkie cztery mają wdrożenia oznaczone przez Render jako live oraz poprawne odpowiedzi stron wejścia i /api/health. Nie oznacza to, że każda funkcja biznesowa działa, ani że wdrożono docelowe konta, uprawnienia i SaaS.

SRM Development i Staging działają obecnie na tym samym SHA 6eede5cd19fd3a4519d66298effe9ef94633757a. SpendGuru utrzymuje różne wersje runtime, dashboardów i workerów; część tej kompozycji jest zamierzona i opisana w topologii. Main zawiera także późniejsze dowody wydań. SHA main nie jest SHA działającej aplikacji.

Oddzielny tor ARCHITECTURE, jego PMOS i laboratorium pozostają aktywne. Wspólny pakiet platform-contracts zapewnia tożsamość toru Development i kontrolowane przyjęcie kontraktu. Nie zapewnia jeszcze tożsamości użytkownika produktu, członkostw, uprawnień modułów ani izolacji prywatnych danych SaaS.

Oznaczenia: **FAKT** — aktualny kod lub odczyt dostawcy; **WNIOSEK** — interpretacja faktów; **LUKA** — rozbieżność z celem; **NOT_VERIFIED** — brak wystarczającego dowodu. Dowód pochodzący z wcześniejszego odbioru jest oznaczony jako odczyt istniejącego dowodu, a nie ponownie wykonany test.

## 2. Kod i współdzielenie komponentów

W punkcie źródłowym repozytorium ma 2085 śledzonych plików i osiem głównych aplikacji: sg-runtime, dashboard-preview, srm, vercly, vector, pmos, pcos-explorer, architecture-lab. Analiza granic obejmuje wejścia, połączenia bazowe, kontrakty, schematy, migracje i mechanizmy wdrożeń; nie stanowi przeglądu każdej linii kodu.

| Obszar | Potwierdzony stan | Granica dowodu |
| --- | --- | --- |
| Trzy tory | Oddzielne checkouty, porty, profile, konfiguracje PMOS i przyjęcia kontraktu Development | Nie jest to podział użytkowników biznesowych |
| platform-contracts 1.0.0 | Sprawdza projectKey, workspaceName, development i zaakceptowaną wersję/digest | Brak Organization/User/PermissionContext produktu |
| architecture-lab | Techniczny probe i dwie oddzielne bazy z ograniczonymi rolami | Nie zawiera wdrożonego modelu tenantów |
| srm-xray | Wydzielone kontrakty prezentacji i moduł raportu | Nie dowodzi gotowego osobnego produktu, onboardingu i Stripe |
| SG Runtime | Modele organizacji w przypisaniach benchmarków/kategorii i filtry aplikacyjne | Niepełna granica zaufania oraz brak RLS prywatnych tabel |
| SRM | Transakcyjny kontekst organizacji, ograniczona rola i FORCE RLS | Stała organizacja środowiska i wspólny aktor demo |
| Różne stosy UI | SG Runtime: Next 14/React 18; SRM: Next 16/React 19 | Wspólność kodu nie dowodzi możliwości bezpośredniego przeniesienia dowolnego komponentu |

Porównanie kodu z wdrożonymi SHA potwierdza zgodność kluczowych plików SG Development z main: lib/api/middleware.ts, lib/db/prisma.ts, prisma/schema.prisma i middleware.ts. W SG Staging schema i klient bazy są takie same; pliki middleware różnią się obsługą nazwy/domeny cookie. Sprawdzony fragment przyjmujący nagłówki tożsamości pozostaje w obu wersjach.

W SRM pliki db.ts, demo-auth.ts, runtime-environment.ts, shared-catalog.ts i report-data.ts są zgodne między wdrożonym 6eede5c a punktem main. Weryfikacja dotyczy tych plików, a nie równości całych drzew aplikacji.

## 3. Rzeczywiste wdrożenia Render

Workspace tea-d7lps8rbc2fs73cn80dg. Odczytano 17 usług wskazujących repozytorium SG-dev. Wszystkie były niesuspendowane, a najnowsze odczytane wdrożenia miały status live. Zapis zawiera pełne source SHA i identyfikatory wdrożeń; digest zachowanego artefaktu jest osobnym dowodem.

| Usługa | Service ID | Deployment ID | Source SHA | Powiązanie danych | AutoDeploy |
| --- | --- | --- | --- | --- | --- |
| architecture-development-pmos | srv-db78d82j9qps73bej0c0 | dep-db79knaj9qps73bjddeg | e03454fdf484c51a251bf3c736d82769821af117 | ARCHITECTURE PMOS | off |
| srm-staging-runtime | srv-db496b3tqb8s73eh5sfg | dep-db97qcjl550s73d2f170 | 6eede5cd19fd3a4519d66298effe9ef94633757a | SRM Staging | off |
| srm-development-runtime | srv-db1vu6gm7kps73d0e3r0 | dep-db97cj6k1f9s738na1r0 | 6eede5cd19fd3a4519d66298effe9ef94633757a | SRM Development | off |
| sg2-development-forecast-verification-worker | srv-dapa40ad0e5s73f8bjm0 | dep-dapu7g1srm7s73as83bg | 993f539a46bd2c8d03fb2d99551535641e4efe0b | Market Development | off |
| sg2-development-forecast-current-worker | srv-dapa3vlg1s2s739vp7dg | dep-dapu7es9v7es739uoql0 | 993f539a46bd2c8d03fb2d99551535641e4efe0b | Market Development | off |
| sg2-development-dashboard | srv-dapa3ujm8hqs73a9t2og | dep-daqbksk9v7es73cjdtmg | dbd3e47196b3aeb65b77fe6d76bbf2fae2d68119 | Market Development | off |
| sg2-development-runtime | srv-dapa3tid0e5s73f8bc5g | dep-daqd0uh42hec7398f5vg | c55c551091b3584673726bd0a78254eb091c7197 | Market Development | off |
| spendguru-forecast-current-worker | srv-daoksvuk1f9s73cg4bk0 | dep-dapam0sja7ms73akipp0 | 518f1ad9d6143748d9d5f42a084cae6135b66799 | Market Staging | off |
| spendguru-forecast-preparation-worker | srv-dansibrtqb8s73d0nn3g | dep-dapam0hsrm7s73ep2v50 | 518f1ad9d6143748d9d5f42a084cae6135b66799 | Market Staging | off |
| spendguru-porr-demo | srv-daclno3m8hqs73bb7rrg | dep-db0dhbm1egvs73f70kr0 | 48dfcd8af93fa9f5e9708653a868b89c138b6b91 | Market Staging | off |
| spendguru-porr-dashboard | srv-dacln50jo6nc738lbag0 | dep-dapam17f3r2c73c11th0 | 518f1ad9d6143748d9d5f42a084cae6135b66799 | Market Staging | off |
| dashboards-library | srv-da2i7j9t0dsc73ag7qv0 | dep-db3supp5efls73cm8qpg | 518f1ad9d6143748d9d5f42a084cae6135b66799 | SG private legacy + Market Production | off |
| BENCHMARK-FINDER-CATEGORY-BUILDER | srv-d9tmgddbedkc739jr24g | dep-dasul56q1p3s739o57eg | b7ae5a69f789146bdf209b078bf224e0778c44bb | Finder assignments + Market Production | off |
| spendguru-stage | srv-d98a73btqb8s73fabp90 | dep-daumen97lnhs73em7a10 | bd4139e727fd3f3b237cfa89afa60b7af6bec86c | SG private legacy + Market Production | off |
| sg2-pcos-cognition-explorer-preview | srv-d936ue3tqb8s738njptg | dep-daoi13rtqb8s73bddefg | 5b2628d3d4660bc6f78c921cb4fad8de517700e3 | Brak URL PostgreSQL w konfiguracji | commit |
| Vector-SG20 | srv-d89j9oml51nc738gdsb0 | dep-dannnpp7lnhs73ebj1rg | 67ab6b0c06d63ac3d0d3976609e41aefefebf45e | Vector | commit |
| pmos-spendguru2-development | srv-d88utm77f7vs73blrj1g | dep-db79kn6i0phs738rhutg | e03454fdf484c51a251bf3c736d82769821af117 | SG2 PMOS | commit |

SRM jest w projekcie Render prj-dapbd3hsrm7s73es53fg; SG2 Development w prj-dap98ddg1s2s739ssatg; klientowskie SG2 Staging w prj-d98a52eq1p3s73835qh0; ARCHITECTURE w prj-db717krrjlhs739jgo0g. Historyczna etykieta Render Production przy klientowskim SG2 oznacza logiczne Staging zgodnie z rejestrem, nie uruchomione Production produktu.

Zewnętrzne zależności odczytano osobno: KYS, srv-d9ovb6ugekts73etfuvg, dep-da2cp9nlk1mc73bu5kqg, SHA ae09b8d045f13e35dcc429a994a91c678594c28a; Memoros API, srv-d8dlo999rddc73a289s0, dep-d91oe1jrjlhs73fve0k0, SHA c75daa8efb62135bfd31e8616740fb2467aaacad. Oba live i automatycznie wdrażane ze swoich repozytoriów. Ich pełne API, dane i uprawnienia nie były ponownie testowane.

## 4. Powiązania baz i rzeczywiste kontrole SQL

Powiązania poniżej uzyskano z aktualnej konfiguracji usług Render i mapowania endpointów Neon. Zapisywano wyłącznie host/endpoint, bazę, rolę i dopuszczone etykiety; bez haseł, tokenów i pełnych connection strings.

| Alias | Projekt Neon / branch | Endpoint | Baza / rola | Aktualny odczyt |
| --- | --- | --- | --- | --- |
| SRM Development | snowy-breeze-40315151 / br-dark-surf-b1vrhda9 | ep-red-smoke-b16ih64d | srm_app / srm_app_runtime | 21 tabel: 20 FORCE RLS, 22 polityki, 18 migracji |
| SRM Staging | snowy-breeze-40315151 / br-broad-butterfly-b11t4v01 | ep-autumn-wildflower-b1mv0vda | srm_app / srm_app_runtime | Ten sam zakres tabel/polityk/migracji |
| Market Development | autumn-waterfall-65938876 / br-dry-hall-b294222f | ep-muddy-pine-b22pdyqd | neondb / neondb_owner | 18 tabel public; 0 RLS; brak sg_runtime_benchmarks i dr_* |
| Market Staging | autumn-waterfall-65938876 / br-wandering-dew-b2izo8fg | ep-cool-lab-b2wm8biu | neondb / neondb_owner | 18 tabel public; 0 RLS; brak sg_runtime_benchmarks i dr_* |
| Market Production | autumn-waterfall-65938876 / br-purple-shape-b2az1npx | ep-cool-paper-b22wpbd9 | neondb / neondb_owner w konfiguracji odbiorców | Świeże metadane i konfiguracja; katalog SQL tej gałęzi nieodczytany ponownie |
| SG private legacy | old-smoke-90429853 / br-empty-bird-asg7u58f | ep-snowy-thunder-as5b15io | neondb / neondb_owner | 16 tabel: public oraz sg_runtime_benchmarks; 0 RLS |
| Finder assignments | solitary-night-79751530 / br-icy-butterfly-b1t1tyhy | ep-ancient-bar-b166yngl | neondb / neondb_owner w konfiguracji | Branch ARCHIVED; bez SQL, reaktywacji i migracji |
| Vector | wild-tree-76228125 / br-super-pond-aljkliea | ep-square-heart-alzc9s3v | neondb / neondb_owner w konfiguracji | Świeże metadane i powiązanie; bez ponownego katalogu SQL |
| SG2 PMOS | lucky-dream-96138453 / br-frosty-lab-als8xfyh | ep-plain-king-al45f92h | neondb / neondb_owner w konfiguracji | Metadane i binding; bez zapisu historii ARCHITECTURE |
| SRM PMOS | bold-breeze-68888550 / br-twilight-scene-b10nwmjd | ep-dark-frost-b1fmda7e | srm_pmos | Metadane/rejestr; nie wykonywano tasków w tym profilu |
| ARCHITECTURE PMOS | billowing-credit-07394675 / br-curly-dream-b94be6uh | ep-solitary-unit-b9b3imd3 | architecture_pmos / architecture_pmos_runtime | Rzeczywisty SQL i kanoniczne begin zadania |
| Lab SG | fancy-cell-49425728 / br-divine-fog-baohc5ay | ep-dry-hat-bafvyimb | architecture_sg_lab / architecture_sg_lab_runtime | Dwie tabele techniczne; rola zwykła; CONNECT do Lab SRM=false |
| Lab SRM | fancy-cell-49425728 / br-divine-fog-baohc5ay | ep-dry-hat-bafvyimb | architecture_srm_lab / architecture_srm_lab_runtime | Dwie tabele techniczne; rola zwykła; CONNECT do Lab SG=false |

SRM Render przekazuje host oraz hasło osobno; kod konstruuje połączenie srm_app_runtime/srm_app i waliduje docelowy host. Metadata konfiguracji i osobny SQL jako ta rola są dwoma dowodami. Nie wykonano inspekcji pamięci działającego procesu.

### SRM: potwierdzone fakty bezpieczeństwa

- W Development i Staging rola srm_app_runtime ma superuser=false, bypassrls=false i brak członkostwa neon_superuser.
- SELECT wykonany jako srm_app_runtime z current_setting('srm.organization_id', true)=null zwrócił 0 organizacji i 0 dostawców. Odczyt administracyjny wykazał istniejące rekordy: po jednej organizacji i użytkowniku, odpowiednio 49 oraz 29 dostawców. Zerowy wynik nie wynikał z pustej tabeli.
- Schemat srm ma 21 tabel, z czego 20 z RLS i FORCE RLS. schema_migrations nie ma RLS; sprawdzona rola Staging nie ma do niej SELECT ani INSERT, ani prawa tworzenia baz.
- Wszystkie 18 checksum migracji 0001–0018 w obu bazach jest zgodnych z plikami wskazanego main. Nie wykonano nowych migracji.
- Prywatne polityki używają srm.organization_id. Polityki czterech tabel catalog_* pozwalają wspólnemu runtime na dostęp przy niepustym kontekście organizacji. Jest to celowe współdzielenie katalogu; nie zapewnia niezależnej roli tylko do zapisu wspólnej wiedzy.
- Test braku kontekstu nie zastępuje pełnego testu dwóch organizacji, dwóch użytkowników, zmiany członkostwa, eksportu, pracy kolejki i współbieżnego poolingu. Tego odbioru nie wykonano.

Bazy rynku są świadomie wspólne dla użytkowników w danym środowisku. Sam brak organization_id lub RLS w ogólnej wiedzy nie stanowi luki separacji klienta. Prywatne przypisania, wybory, ustawienia, autorstwo i historia zlecenia wymagają osobnej oceny. neondb_owner ma w sprawdzonym połączeniu legacy BYPASSRLS=true, CREATEROLE=true i CREATEDB=true; nie stanowi ograniczonej roli produktu.

Gałąź SRM Production br-nameless-bar-b1wlhjhx nie zawierała bazy srm_app w aktualnym odczycie listy baz. Status RESERVED i istniejący endpoint nie oznaczają gotowego produktu Production.

## 5. Istniejące błędy, luki i niepewności

| ID | Rodzaj i obecny stan | Dowód i znaczenie dla punktu odniesienia |
| --- | --- | --- |
| B-01 / L-01 | Potwierdzona luka zaufania w SG | resolveCognitionAuth przyjmuje x-clerk-org-id, x-clerk-user-id i rolę przed sesją demo; middleware wyłącza /api. Nie wykonywano eksploatacji ani odczytu obcych danych |
| B-02 / L-03 | Potwierdzona luka ochrony prywatnych tabel SG | Prywatne modele mają pola organizacji/twórcy i filtry aplikacji, ale sprawdzone legacy tabele nie mają RLS; skonfigurowano role właścicielskie |
| B-03 / L-05 | Potwierdzona niespójność kod–binding–schemat | SG Development i klientowskie Staging kierują również SG_RUNTIME_* do baz Market bez tabel przypisań i dr_*. Klient kodu domyślnie dodaje sg_runtime_benchmarks. Awaria konkretnych ekranów/zapisów: NOT_VERIFIED, ponieważ nie wykonano biznesowego zapisu |
| B-04 / L-06 | Potwierdzone powiązanie między logicznymi środowiskami legacy | spendguru-stage i dashboards-library: prywatna baza legacy oraz Market Production; Finder: osobne przypisania oraz Market Production. Rzeczywiste zapisy tych usług w Production nie były testowane |
| B-05 / L-02,04 | Docelowe indywidualne konta i role niewdrożone | SRM używa podpisanej sesji ze wspólnym hasłem, jednej organizacji na środowisko i demo-shared/SHARED_DEMO; user_supplier_interest ograniczone organizacją, a nie tożsamością osoby |
| B-06 / L-08 | Niepełne współdzielenie warstwy źródłowej | Katalog firm/finansów/KYS jest wspólny, a archiwa, dokumenty i projekcje nadal mają zakres organizacji; to rozbieżność z docelową klasyfikacją, nie dowód wycieku |
| B-07 | Potwierdzony błąd automatyzacji Forecast | [Run 38867817816](https://github.com/profitia/SG-dev/actions/runs/38867817816), 16.10 07:32 UTC: instalacja zależności przerwana E401 przy @profitia/cic-procurement z npm.pkg.github.com. Błąd uwierzytelnienia pakietów; nie Render API 401. Nie ustalono, czy token brakował, wygasł lub miał niewłaściwy zakres |
| B-08 | Finder: stan infrastruktury wymagający uwzględnienia | Render live, ale docelowy branch przypisań Neon ARCHIVED od 14.10. Stan funkcji Finder NOT_VERIFIED; branch nie został reaktywowany |
| B-09 | Rejestry zawierają starsze snapshoty | Pola bieżących SHA/deploy w topologiach SG2 runtime, SG2 PMOS i SRM Development są starsze od aktualnego Render. Nie zmieniono rejestrów. Staging SRM baseline wskazuje zgodnie aktualne 6eede5c |
| B-10 | Potwierdzone ograniczenie istniejącego odbioru danych SRM | W aktualnym postReleaseEvidence opisano PARTIAL_SOURCE_VIEW, brak kwalifikacji osi dla konkretnej próbki, BUSINESS_UAT=NOT_PERFORMED i brak testu eksportu XHTML na kwalifikowanym własnym źródle Staging. Nie uznano tego automatycznie za regresję promocji |
| B-11 / L-07,09,10 | Brak pełnego świeżego odbioru całego ekosystemu | KYS, Vector, PMOS UI i pełny audyt bezpieczeństwa pozostają poza nowym testem wejść i wieloorganizacyjnego przepływu. Historyczne luki nie otrzymują statusu zamknięte tylko dlatego, że E0-A wykonano |

Historyczny Render API 401 z [run 38507605415](https://github.com/profitia/SG-dev/actions/runs/38507605415) nie jest bieżącym blokerem tej samej promocji. Aktualny kanoniczny release-state zawiera osobno autoryzowaną naprawę RENDER_API_KEY z 14.10; metadane GitHub potwierdzają updated_at=2026-10-14T04:18:35Z. Nowszy [run 38955678743](https://github.com/profitia/SG-dev/actions/runs/38955678743) zakończył się success i odpowiada aktualnemu wdrożeniu 6eede5c. W tym zadaniu nie odczytywano wartości tego sekretu ani go nie zmieniano.

Dowody kodu: [SG auth](https://github.com/profitia/SG-dev/blob/81d25a0cd1d98161ce1b40344867bdcc1bbd7969/apps/sg-runtime/lib/api/middleware.ts), [SG schema](https://github.com/profitia/SG-dev/blob/81d25a0cd1d98161ce1b40344867bdcc1bbd7969/apps/sg-runtime/prisma/schema.prisma), [SRM db](https://github.com/profitia/SG-dev/blob/81d25a0cd1d98161ce1b40344867bdcc1bbd7969/apps/srm/src/server/db.ts), [SRM kontekst](https://github.com/profitia/SG-dev/blob/81d25a0cd1d98161ce1b40344867bdcc1bbd7969/apps/srm/src/server/runtime-environment.ts), [aktor demo](https://github.com/profitia/SG-dev/blob/81d25a0cd1d98161ce1b40344867bdcc1bbd7969/apps/srm/src/server/shared-catalog.ts), [obecny odbiór SRM](https://github.com/profitia/SG-dev/blob/81d25a0cd1d98161ce1b40344867bdcc1bbd7969/Canon/registries/srm-staging-release-state-v1.json).

## 6. Automatyczne wdrożenia i cykle zewnętrzne

14 usług SG-dev ma AutoDeploy off; trzy mają commit:
1. Vector — rootDir apps/vector.
2. PCOS Explorer — filtry apps/pcos-explorer/** oraz packages/pcos-contracts/**.
3. SG2 PMOS — rootDir apps/pmos oraz filtry apps/pmos/**, Canon/registries/profitia-projects-v1.json, render.yaml.

Zmiana samego niniejszego pliku Canon/evidence nie mieści się w tych rootDir/filtrach. Według [dokumentacji Render](https://render.com/docs/monorepo-support) zmiany poza root directory nie wyzwalają automatycznego wdrożenia; ręczne uruchomienie lub zmiana konfiguracji ma inne zasady. Nie wywoływano takiego uruchomienia.

GitHub:
- Governance preflight reaguje na Canon/**, zatem publikacja raportu uruchamia walidację, bez deploymentu produktu.
- Platform contract integration sprawdza kontrakt, laboratorium i przyjęcia obu odbiorców; nie publikuje produktu.
- SRM CI reaguje na apps/srm, packages/srm-xray i własny workflow. Promocja Staging wymaga workflow_dispatch i jawnej autoryzacji; push main sam nie uruchamia promocji.
- SG2 Staging release korzysta z workflow_dispatch, zaakceptowanego SHA, środowiska sg2-staging i hooka konkretnej usługi.
- Forecast Production Operations ma aktywny harmonogram 07:20 UTC; skrypt korzysta z sekretu repozytorium i może zapisywać forecasty. Odczyt kodu nie dowodzi aktualnego bindingu tego sekretu. Nie uruchomiono, nie zmieniono i nie anulowano harmonogramu.

W GitHub potwierdzono wymaganych reviewerów dla sg2-staging i srm-staging oraz main-only dla architecture-development. Istnieją historyczne Development/Staging/Production. Nie zmieniano nazw ani ochrony. Zarezerwowane architecture-staging/production i srm-production nie występują jako gotowe środowiska w odczytanej liście GitHub.

Publikacja wspólnego pakietu i zmiana wspólnego PMOS mogą uruchomić inne ciągi niż zmiana kontraktu Development. Dostępność prywatnych pakietów, jawne przyjęcie wersji/digestu przez odbiorcę i efekty rootDir/buildFilter to elementy przyszłego zakresu, nie założenie automatycznej aktualizacji aplikacji.

## 7. Scenariusze regresji i status ich wykonania

| ID | Scenariusz i oczekiwany wynik | Dowód obecny / wykonanie |
| --- | --- | --- |
| R-01 | Strony wejścia i health obu produktów, obu środowisk i domen klienta; właściwa etykieta | W tym audycie 21 poprawnych GET zakończonych HTTP 200 po dozwolonych przekierowaniach; dashboard root przekierowuje do aplikacji, nie dowodzi działania iframe |
| R-02 | Sesja demo: błędne hasło, login, cookie, logout, brak przeniesienia sesji między środowiskami | Odczyt istniejącego niezależnego odbioru SRM 16.10: PASS; tutaj bez ponownego logowania. SG: NOT_VERIFIED biznesowo |
| R-03 | Zapis/odczyt przypisań benchmarku i kategorii, wagi i zachowanie dotychczasowych list | Scenariusz opisany; NIE WYKONANO na działających bazach; B-03 jest znaną granicą |
| R-04 | Wykresy i dashboard: seria, jednostka, zakres, brak vs zero, embed i sesja | Wejście HTTP potwierdzone; pełny UI i kompletność danych NOT_VERIFIED |
| R-05 | Current/verification forecast, kolejka, idempotencja, brak zapisu w innym środowisku | Metadata workerów i błąd istniejącego scheduler CI potwierdzone; bez nowych zadań i zapisów |
| R-06 | SRM firma/KRS/JDG/CEIDG, istniejący cache, refresh i jawne koszty pobrania | Aktualny kod/CI i dane odbioru istnieją; pełny przebieg niepowtórzony, brak nowych płatnych wywołań |
| R-07 | SRM źródła finansowe, PL/MSR, wersja projekcji, jednostki, proweniencja, radar i brakujące pola | CI wdrożonego SHA PASS; ograniczenie PARTIAL_SOURCE_VIEW zapisane; brak nowej kwalifikacji wszystkich źródeł |
| R-08 | Eksport Excel/PDF/KYS i kontrola dostępu, zgodność danych ze źródłem | Odczyt istniejącego odbioru Excel XML PASS; eksport XHTML na kwalifikowanym własnym Staging i pełny PDF/KYS NOT_VERIFIED tutaj |
| R-09 | Baza SRM bez kontekstu nie zwraca prywatnych rekordów | W tym audycie SQL jako runtime w Development i Staging: PASS; rekordy faktycznie istnieją |
| R-10 | Dwie organizacje i dwóch użytkowników: odczyt, zapis, eksport, ID podmienione w URL/body/header | Wymagane do docelowego odbioru; NIE WYKONANO i nie zadeklarowano gotowej izolacji użytkownika |
| R-11 | Administrator nadaje/cofa uprawnienia modułu; konto w wielu organizacjach | Kontrakt docelowy; obecny model demo tego nie realizuje |
| R-12 | Wspólny katalog widoczny zgodnie z polityką; prywatne listy i historia pozostają oddzielone | Schemat/polityki odczytane; pozytywny i negatywny pełny test wieloorganizacyjny NIE WYKONANO |
| R-13 | Kontrakt producenta i SG2/SRM odrzuca zły profil, środowisko i nieprzyjęty digest | Lokalne testy kontraktu i obu odbiorców PASS; nie jest to test autoryzacji produktu |
| R-14 | PMOS trafia do własnej bazy; brak obcego profilu i podmiany roli/laboratorium | Pełny begin/preflight i testy governance PASS; closeout/PHR wymagają własnego końcowego potwierdzenia |
| R-15 | Wdrożenie dokładnej wersji, zachowany artefakt LKG, zgodność konfiguracji/migracji i odzyskanie | Odczyt istniejących dowodów SRM; nowego wdrożenia ani rollbacku dostawcy nie wykonywano |
| R-16 | Onboarding organizacji, zaproszenia, Stripe, webhook replay i limity nowego produktu | Docelowy scenariusz; nieuruchomiony zakres E2–E4, bez testu płatności |

Scenariusze wymagające zapisu mają być wykonywane w osobno zatwierdzonym zakresie, na jawnie wskazanych zasobach i kontrolowanych danych. Nie wolno traktować obecnych baz biznesowych jako laboratorium tylko dlatego, że noszą nazwę Development.

Obsługa readReportData może odtwarzać dokumenty z archiwum i utrwalać ramki/projekcje. Nazwa „odczyt raportu” nie stanowi gwarancji braku zapisu. Automatyczny przegląd odrzucił pierwotny smoke obejmujący adres raportu; adres całkowicie usunięto i wykonano bezpieczny wariant wejść/health. Nie wystąpił zapis raportu. Cztery próbne GET do nieistniejącego /porr-demo dały 404; nie są funkcją potwierdzoną w routingu i wyłączono je z 21 właściwych kontroli oraz z listy błędów produktu.

## 8. Potrzeby zasobowe i znane granice zmiany

W tym zakresie nie jest potrzebne nowe repozytorium, projekt GitHub/Render/Neon, instancja produktu ani migracja bazy. Nie utworzono ich, nie zmieniono planów ani kosztów stałych. Odczyty mogą obudzić istniejący autosuspend compute; nie stanowią nowego zasobu.

Istniejące laboratorium obejmuje dwie bazy techniczne, endpoint 0.25–1 CU i role odmawiające CONNECT do przeciwnej bazy. PMOS ARCHITECTURE ma oddzielny endpoint 0.25–1 CU i rolę bez uprawnień administracyjnych. SRM oraz gałęzie Market mają odczytany zakres compute 0.25–8 CU. Są to ustawienia zasobów, nie wyliczony rachunek ani zgoda na zwiększenie zużycia.

CI SRM ma izolowany PostgreSQL 16 do testów migracji. Nie ma potwierdzonego gotowego, trwałego środowiska pełnego testu SaaS z dwiema organizacjami. Laboratorium techniczne nie jest takim środowiskiem i nie otrzymało danych PORR. Dokładne zasoby, region, koszty i granice dostępu następnego zakresu wymagają osobnego planu. Nowe repozytoria/projekty tworzy właściciel według instrukcji; obecny audyt nie rozpoznaje konieczności ich natychmiastowego tworzenia.

Granice obowiązujące przy porównywaniu kolejnych zmian:
- zachowanie obecnych usług, domen, baz, sekretów i cykli wydań SG2/SRM Development/Staging;
- brak automatycznego przepięcia aplikacji do Lab/PMOS lub migracji danych między środowiskami;
- brak zmiany organizacji konta Neon, własności infrastruktury, planów i DNS;
- wspólna wiedza rynku i dostawców nie jest prywatnym przypisaniem użytkownika;
- projekt governance, instancja wdrożenia, organizacja biznesowa i użytkownik to różne tożsamości;
- przygotowanie kontraktu, przyjęcie przez produkt, test izolowany, deployment i odbiór pozostają odrębnymi faktami;
- zarezerwowane Production i nowy Supplier Intelligence/SaaS nie stają się aktywne przez publikację tego raportu;
- nie zamyka się historycznej luki bez dowodu właściwej ścieżki i roli;
- PMOS/PHR ARCHITECTURE zapisuje ten audyt Development; nie tworzy pozornych zadań Development dla przyszłych operacji Staging.

## 9. Weryfikacja i ograniczenia odbioru

Wykonano lokalnie 34 testy bez dostępu do danych biznesowych: 18 governance, 12 kontraktu/laboratorium/mostu/workspace oraz po 2 testy przyjęcia SG2/SRM. Wszystkie PASS, bez skip. Wykonano pełny preflight ARCHITECTURE przed begin, po begin i przed zapisem raportu; manifest obejmował 43 aktywne dokumenty. LIVE_PROVIDER_DRIFT_GATE pozostaje formalnie NOT_APPLICABLE dla źródłowego zadania Development; niniejsze rzeczywiste odczyty dostawców są osobnymi dowodami.

Odczyt istniejącego [SRM CI 38952468420](https://github.com/profitia/SG-dev/actions/runs/38952468420), na dokładnym wdrożonym SHA 6eede5c, potwierdza 464 testy aplikacji, 311 promocji, 165 governance — 940 PASS, 0 skip — oraz typecheck i build PASS. Nie przedstawia się ich jako testów ponownie uruchomionych w tym audycie. [Governance CI źródłowego main](https://github.com/profitia/SG-dev/actions/runs/38957566469) ma success.

Odczyt logów app/error czterech głównych runtime od 19:00 UTC do około 21:07 nie zwrócił wpisów. Jest to wynik konkretnego filtra, nie zapewnienie braku błędów aplikacyjnych.

Nie wykonano nowego biznesowego E2E, testu penetracyjnego, płatnych wywołań dostawców, nowych migracji, wdrożeń aplikacji, resetów baz, reaktywacji gałęzi ARCHIVED, logowania cudzym kontem ani odczytu prywatnych rekordów innej organizacji. Nie naprawiono wykrytych błędów; audyt zachowuje ich tożsamość i wynik.

**Kryterium tego zadania:** datowany punkt odniesienia kodu/wdrożeń/bindingów, lista odróżniająca faktyczne błędy od luk i braków dowodu, scenariusze regresji ze statusem oraz granice zasobów/automatyzacji. Nie stanowi to zgody ani dowodu zakończenia pozostałego programu architektury. Końcowy wynik publikacji Git, CI i kanonicznego closeout PMOS/PHR jest zapisywany w rekordzie tego zadania, po jego rzeczywistym wykonaniu.
