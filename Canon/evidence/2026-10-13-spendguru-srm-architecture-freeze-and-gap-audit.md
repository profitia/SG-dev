# Freeze obecnej architektury SpendGuru i SRM oraz analiza luk

**Status:** FROZEN_EVIDENCE — opublikowany, datowany zapis dowodów; opisuje wyłącznie stan zaobserwowany w audycie.

**Data audytu:** 13 października 2026, Europe/Warsaw.

**Źródło SG-dev:** 854657050c3a9bca909cceb702facece937cf21e.

**Źródło PHR dla uzupełnienia o pracę równoległą:** 5088079e8f9460591fb903a4b0505753f5e9419a.

**Lokalizacja kanoniczna:** Canon/evidence/2026-10-13-spendguru-srm-architecture-freeze-and-gap-audit.md w profitia/SG-dev, gałąź main.

**Powiązania:** [wymagania docelowe](../v1.0-spendguru-srm-target-architecture-canon.md) i [roadmapa architektury](../v1.0-spendguru-srm-architecture-delivery-roadmap.md).

Publikacja nie odświeża historycznych odczytów dostawców. Nowe audyty i dowody zamknięcia luk otrzymują odrębne datowane zapisy.

SRM ma potwierdzone mechanizmy separacji organizacji w bazie. Cały ekosystem nie ma jednak wystarczających dowodów spójnej ochrony prywatnych danych organizacji i indywidualnych użytkowników. Ten zapis opisuje stan zaobserwowany w audycie, a nie docelową zgodność architektury.

## Zakres i sposób interpretacji

Audyt objął aktualny stan GitHub, odczyty konfiguracji i wdrożeń Render oraz katalogi tabel, polityk i ról baz Neon. Zinwentaryzowano całe drzewo SG-dev, 1932 pliki i siedem aplikacji: sg-runtime, dashboard-preview, srm, vercly, vector, pmos oraz pcos-explorer. Szczegółowa analiza koncentrowała się na dostępie, tożsamości, przypisaniach, bazach i przepływach danych.

Ostatnie kontrolne odczyty głównych wdrożeń i main dla pierwotnego audytu wykonano około 08:53 czasu warszawskiego. Poszczególne odczyty nie były atomowym snapshotem. Uzupełnienie dotyczące trzech torów pracy odczytało ten sam SHA SG-dev i wskazany SHA PHR.

FAKT oznacza potwierdzenie kodem lub odczytem dostawcy. WNIOSEK oznacza interpretację faktów. LUKA oznacza różnicę względem wymagań docelowych. NIEZWERYFIKOWANE oznacza brak wystarczającego dowodu i nie jest automatycznie niespełnieniem wymagania.

Nie wykonano pełnego testu penetracyjnego, pełnego biznesowego E2E ani płatnych wywołań MGBI/KYS/Vercly. Brak potwierdzenia wykorzystanego wycieku nie oznacza potwierdzenia jego niemożliwości.

Uniwersalne dane rynkowe, benchmarki, forecasty, dane dostawców i zrzuty MGBI/Vercly są oceniane jako świadomie wspólne. Ich współdzielenie lub brak RLS nie są samodzielnym dowodem luki. Prywatne przypisania i metadane zleceniodawcy są oceniane osobno.

## Usługi Render z repozytorium SG-dev

Workspace: tea-d7lps8rbc2fs73cn80dg. Wszystkie 16 usług było niesuspendowanych; odczytane wdrożenia miały status live. Status ten nie dowodzi poprawności wszystkich funkcji biznesowych.

| Usługa | Service ID | SHA wdrożenia | Powiązanie bazy |
| --- | --- | --- | --- |
| srm-development-runtime | srv-db1vu6gm7kps73d0e3r0 | bbcdccd28e7e01695bfaec9a36323124a05469af | SRM Development, srm_app |
| srm-staging-runtime | srv-db496b3tqb8s73eh5sfg | bbcdccd28e7e01695bfaec9a36323124a05469af | SRM Staging, srm_app |
| sg2-development-runtime | srv-dapa3tid0e5s73f8bc5g | c55c551091b3584673726bd0a78254eb091c7197 | Dynamic Market Data Store Development |
| sg2-development-dashboard | srv-dapa3ujm8hqs73a9t2og | dbd3e47196b3aeb65b77fe6d76bbf2fae2d68119 | Dynamic Market Data Store Development |
| sg2-development-forecast-current-worker | srv-dapa3vlg1s2s739vp7dg | 993f539a46bd2c8d03fb2d99551535641e4efe0b | Dynamic Market Data Store Development |
| sg2-development-forecast-verification-worker | srv-dapa40ad0e5s73f8bjm0 | 993f539a46bd2c8d03fb2d99551535641e4efe0b | Dynamic Market Data Store Development |
| spendguru-porr-demo | srv-daclno3m8hqs73bb7rrg | 48dfcd8af93fa9f5e9708653a868b89c138b6b91 | Dynamic Market Data Store Staging |
| spendguru-porr-dashboard | srv-dacln50jo6nc738lbag0 | 518f1ad9d6143748d9d5f42a084cae6135b66799 | Dynamic Market Data Store Staging |
| spendguru-forecast-current-worker | srv-daoksvuk1f9s73cg4bk0 | 518f1ad9d6143748d9d5f42a084cae6135b66799 | Dynamic Market Data Store Staging |
| spendguru-forecast-preparation-worker | srv-dansibrtqb8s73d0nn3g | 518f1ad9d6143748d9d5f42a084cae6135b66799 | Dynamic Market Data Store Staging |
| spendguru-stage | srv-d98a73btqb8s73fabp90 | bd4139e727fd3f3b237cfa89afa60b7af6bec86c | Starsza aplikacyjna Staging i rynek Production |
| dashboards-library | srv-da2i7j9t0dsc73ag7qv0 | 518f1ad9d6143748d9d5f42a084cae6135b66799 | Starsza aplikacyjna Staging i rynek Production |
| BENCHMARK-FINDER-CATEGORY-BUILDER | srv-d9tmgddbedkc739jr24g | b7ae5a69f789146bdf209b078bf224e0778c44bb | Osobna baza przypisań i rynek Production |
| sg2-pcos-cognition-explorer-preview | srv-d936ue3tqb8s738njptg | 5b2628d3d4660bc6f78c921cb4fad8de517700e3 | Tryb mock; bez skonfigurowanego połączenia z bazą |
| Vector-SG20 | srv-d89j9oml51nc738gdsb0 | 67ab6b0c06d63ac3d0d3976609e41aefefebf45e | Vector |
| pmos-spendguru2-development | srv-d88utm77f7vs73blrj1g | 1abae93c972290ae8af5e2689320551824055ea7 | spendGuru 20 PMOS |

Różne SHA są częściowo jawnie zapisane w topologii jako kompozycja usług. Nie stanowią samodzielnie błędu. Istotne pliki mechanizmów dostępu porównano z odczytanymi wersjami wdrożonymi.

KYS działa poza SG-dev: profitia/KYS, commit ae09b8d045f13e35dcc429a994a91c678594c28a, usługa srv-d9ovb6ugekts73etfuvg. Memoros API również jest zewnętrzne: profitia/MEMOS_Profitia, commit c75daa8efb62135bfd31e8616740fb2467aaacad.

## Odczytane bazy Neon

| Projekt | Gałąź i baza | Tabele | RLS | Ustalenie |
| --- | --- | --- | --- | --- |
| SRM snowy-breeze-40315151 | br-dark-surf-b1vrhda9, srm_app | 17 | 16 FORCE | Development, ograniczona rola srm_app_runtime |
| SRM snowy-breeze-40315151 | br-broad-butterfly-b11t4v01, srm_app | 17 | 16 FORCE | Staging, ograniczona rola srm_app_runtime |
| Dynamic Market Data Store autumn-waterfall-65938876 | br-dry-hall-b294222f, neondb | 18 | 0 | Wspólne dane Development |
| Dynamic Market Data Store autumn-waterfall-65938876 | br-wandering-dew-b2izo8fg, neondb | 18 | 0 | Wspólne dane Staging |
| Dynamic Market Data Store autumn-waterfall-65938876 | br-purple-shape-b2az1npx, neondb | 18 | 0 | Wspólne dane Production |
| sg2-data-runtime-staging old-smoke-90429853 | br-empty-bird-asg7u58f, neondb | 16 | 0 | Data Runtime oraz pięć tabel benchmarków i kategorii |
| BENCHMARK-FINDER-CATEGORY-BUILDER solitary-night-79751530 | br-icy-butterfly-b1t1tyhy, neondb | 5 | 0 | Prywatne przypisania benchmarków i kategorii |
| spendGuru 20 PMOS lucky-dream-96138453 | br-frosty-lab-als8xfyh, neondb | 22 | 0 | Ciągłość prac SG2 |
| profitia-srm-pmos bold-breeze-68888550 | br-twilight-scene-b10nwmjd, srm_pmos | 25 | 0 | Oddzielna ciągłość SRM |
| Vector wild-tree-76228125 | br-super-pond-aljkliea, neondb | 29 | 0 | Projekty, workspace i wykonanie |
| Vercly rapid-pine-17894764 | br-noisy-feather-asnzozyb, neondb | 2 | 0 | Weryfikacje i payloady; używane przez KYS |
| Memoros crimson-brook-67573429 | br-dark-sound-alkn2i1p, neondb | 24 | 0 | Zewnętrzna warstwa wiedzy i ciągłości |

Brak RLS w danych wspólnych nie jest zakwalifikowany jako luka separacji klientów. Sprawdzone połączenia SG, Vector, PMOS, KYS i Memoros korzystały z neondb_owner. Rola ta ma BYPASSRLS i szerokie uprawnienia. SRM ma osobną rolę runtime.

Nie znaleziono zarządzanych baz PostgreSQL ani Key Value w odczytanym workspace Render. Zidentyfikowano projekty PCOS LAB/PROD/SANDBOX i starszy sg2-data-runtime-production, lecz nie potwierdzono ich użycia przez obecne 16 usług SG-dev.

SRM Production było puste w Render, a jego gałąź nie zawierała srm_app. Nie jest to dowód działającego wdrożenia produkcyjnego.

## Potwierdzone mechanizmy zgodne z kierunkiem docelowym

SRM ustawia srm.organization_id lokalnie dla transakcji. Rola srm_app_runtime nie ma superuser, BYPASSRLS ani praw tworzenia ról i baz. Kod sprawdza rzeczywistą rolę połączenia. Prywatne polityki RLS i klucze obejmujące organizację tworzą granicę dostępu. Tabela schema_migrations nie ma RLS, ale sprawdzone prawa roli aplikacyjnej nie pozwalają na jej odczyt ani zmianę. [Dostęp do bazy SRM](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/apps/srm/src/server/db.ts#L36).

SRM ma cztery wspólne tabele katalogowe firm, faktów finansowych, wskaźników i raportów KYS. Polityki dopuszczają dostęp z poprawnym kontekstem organizacji, bez przypisania wspólnych rekordów do jednego klienta. Dynamic Market Data Store ma globalny model rynku i forecastów. [Wspólny katalog SRM](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/apps/srm/db/migrations/0007_shared_financial_catalog.sql).

W repozytorium istnieją wydzielone pakiety srm-xray, pcos-contracts i governance. Kontrakty X-Ray oddzielają prezentację od danych dostarczanych przez aplikację gospodarza. Nie potwierdzono wspólnego kontraktu dostępu dla wszystkich komponentów. [Kontrakty X-Ray](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/packages/srm-xray/src/contracts.ts).

## Analiza luk

| ID | Potwierdzony stan i luka |
| --- | --- |
| L-01 | SG Runtime przyjmuje x-clerk-org-id, x-clerk-user-id i rolę z nagłówków przed sprawdzeniem sesji PORR. Nie znaleziono weryfikacji Clerk dla tych ścieżek, a middleware wyłącza API. Kontekst prywatnych operacji nie ma potwierdzonej granicy zaufania. |
| L-02 | Profile PORR wykorzystują stałe tożsamości demo. SRM Development i Staging mają po jednej organizacji i użytkowniku SHARED_DEMO. Nie ma kompletnego modelu członkostw, zaproszeń i uprawnień komponentów. |
| L-03 | Prywatne modele przypisań SG mają organizationId i filtry aplikacyjne, lecz odczytane tabele nie mają RLS, a połączenia używają roli właścicielskiej. Baza nie egzekwuje dodatkowej granicy organizacji. |
| L-04 | CreatedByUserId opisuje twórcę, nie granicę prywatności. Listy SG są odczytywane według organizacji. RLS user_supplier_interest w SRM ogranicza organizację, nie indywidualnego użytkownika; zapis używa aktora demo. Preferencje sesji nie są trwałym kontem. |
| L-05 | Nowsze SG Runtime i dashboardy wskazują gałęzie rynku bez tabel sg_runtime_benchmarks i dr_* oczekiwanych przez kod. Nie potwierdzono biznesowym E2E wszystkich funkcji trwałego zapisu. |
| L-06 | Starsze spendguru-stage i dashboards-library łączą dane aplikacyjne Staging z rynkiem Production. Samodzielny Finder też wskazuje rynek Production przy profilu Development. Połączenia nie wymuszają dostępu tylko do odczytu. Zakres rzeczywistych zapisów nie został przetestowany. |
| L-07 | Wdrożony KYS przyjmuje orgId i requestedByUserId z body, odczytuje status według ID i stosuje stały kontekst dev-local do raportu. Brakuje wiarygodnego powiązania użytkownika z operacją. |
| L-08 | Katalog finansowy i raporty KYS są wspólne, lecz archiwa MGBI, dokumenty i część snapshotów nadal mają zakres organizacji. To niepełna realizacja wspólnej warstwy źródłowej, nie dowód wycieku. |
| L-09 | PMOS ma odczyt historii bez kontroli użytkownika w sprawdzonym kodzie. Vector ma klucze i bibliotekę Clerk, ale bez jej użycia w sprawdzonych ścieżkach wykonania. Odpowiednie pliki odpowiadają wdrożonym wersjom; nie wykonano anonimowego testu odczytu prywatnych danych. |
| L-10 | SRM ma migracje, pochodzenie danych i dowody wydań. Ślad forecastów i kolejka nie mają kompletnej tożsamości użytkownika i organizacji inicjującej działanie. Nie ma potwierdzonego pełnego, chronionego audytu bezpieczeństwa całego ekosystemu. |

Dowody kluczowych ścieżek: [L-01](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/apps/sg-runtime/lib/api/middleware.ts#L186), [L-03](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/apps/sg-runtime/prisma/schema.prisma), [L-04](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/apps/srm/src/server/report-data.ts#L259), [L-05](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/apps/sg-runtime/lib/db/prisma.ts#L10), [L-07](https://github.com/profitia/KYS/blob/ae09b8d045f13e35dcc429a994a91c678594c28a/src/app/api/verifications/route.ts), [L-08](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/apps/srm/db/migrations/0011_mgbi_raw_reports.sql#L4), [L-09 PMOS](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/apps/pmos/src/app/api/conversations/route.ts#L8), [L-09 Vector](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/apps/vector/src/app/actions/projects.ts#L22).

## Ocena wymagań docelowych

| ID | Ocena na dzień audytu |
| --- | --- |
| AR-01 | Częściowo: organizacyjna granica SRM, filtry aplikacyjne SG. |
| AR-02 | Luka: dominują wspólne i stałe tożsamości demo. |
| AR-03 | Luka: brak pełnego modelu członkostw. |
| AR-04 | Częściowo: rejestry infrastruktury są jawne, kontekst dostępu niepełny. |
| AR-05 | Częściowo: demo jest oznaczone, ale nie zastępuje indywidualnych kont. |
| AR-06 | Luka w SG i KYS; SRM ma podpisaną sesję i stałą organizację. |
| AR-07 | Luka: brak pełnej ścieżki SaaS i wyboru organizacji. |
| AR-08 | Częściowo: brak wspólnej warstwy rozstrzygania dostępu; AppShield występuje też jako prezentacja UI. |
| AR-09 | Częściowo: wydzielone pakiety i zależności. |
| AR-10 | Częściowo: oddzielenie w X-Ray, brak jednolitej ochrony operacji. |
| AR-11 | Częściowo: kontrakty komponentów istnieją, kontrakt dostępu nie jest wspólny. |
| AR-12 | Częściowo: wspólna wiedza działa, przypisania i źródła są niejednolite. |
| AR-13 | Częściowo: pola właściciela i twórcy występują, prawa są niepełne. |
| AR-14 | Luka: brak trwałej, egzekwowanej granicy użytkownika. |
| AR-15 | Luka: brak kompletnej implementacji uprawnień operacji i zasobów. |
| AR-16 | Luka: brak ról związanych z członkostwem. |
| AR-17 | Luka w docelowym modelu administratorów. |
| AR-18 | Luka w tworzeniu organizacji, zaproszeniach i odwoływaniu dostępu. |
| AR-19 | Częściowo w SRM, istotne luki w SG, KYS i narzędziach. |
| AR-20 | Potwierdzona ochrona organizacji w SRM; luka w prywatnych przypisaniach SG. |
| AR-21 | Potwierdzone w SRM; wskazane inne usługi używają roli właścicielskiej. |
| AR-22 | Częściowo; pełny przepływ i atrybucja niezweryfikowane. |
| AR-23 | Częściowo: TLS i sekrety skonfigurowane, niespójne powiązania środowisk. |
| AR-24 | Częściowo: topologia opisana, brak kompletnego profilu SaaS. |
| AR-25 | Częściowo: CI i release istnieją, limity per organizacja niezweryfikowane. |
| AR-26 | Częściowo: pakiety wydzielone, migracja niezweryfikowana. |
| AR-27 | Luka: brak modelu i dowodu pełnej migracji. |
| AR-28 | Częściowo: rejestry i journal istnieją, część pól zawiera starsze SHA. |
| AR-29 | Częściowo w SRM, brak pełnego pokrycia ekosystemu. |
| AR-30 | Częściowo: pochodzenie i wydania udokumentowane, pełny audyt dostępu niepotwierdzony. |

## Dowody i ograniczenia testów oraz odtwarzania

SRM Staging release journal generacja 85 zawiera dowody dla bbcdccd: rola runtime, separacja, persistencja i konfiguracja. CI 38285942282 zakończyło się sukcesem. Bieżący audyt niezależnie sprawdził katalog ról i RLS. Próba dodatkowego testu pod rolą srm_app_runtime przez połączenie audytowe została odrzucona z powodu braku prawa do SET ROLE. Nie rozszerzano uprawnień i nie zapisano sukcesu tego testu. [Release journal](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/Canon/registries/srm-staging-release-state-v1.json), [SRM CI](https://github.com/profitia/SG-dev/actions/runs/38285942282).

Neon miał okno historii 24 godziny dla SRM i Dynamic Market Data Store oraz 6 godzin dla części starszych projektów. Nie znaleziono harmonogramów snapshotów dla odczytanych gałęzi SRM i rynku Development/Staging; znaleziono ręczny snapshot rynku Production. Nie oznacza to braku kopii, ponieważ historia Neon jest osobnym mechanizmem. Nie potwierdzono testem pełnego odtworzenia aplikacji ani odzyskania jednej organizacji.

Nie potwierdzono kompletnych macierzy dostępu kilku organizacji i użytkowników, pełnego przepływu plików/logów/kopii, wszystkich zabezpieczeń sieciowych, pełnej kontroli osób i integracji w systemach dostawców ani migracji PORR do SaaS. Odczyt ochrony main był odmówiony konektorowi, co nie stanowi dowodu braku ochrony gałęzi.

## Uzupełnienie o trzy równoległe tory pracy

Osobne manifesty i buildy SG oraz SRM umożliwiają pracę w oddzielnych checkoutach. Rejestr projektów zawiera SG2, SRM i CIC; ARCHITECTURE jest nieznanym profilem. Scope architecture już istnieje, ale nie tworzy osobnego obszaru wykonania.

Odczytowa próba resolvera dała ok=true dla SG2 wskazującego apps/srm/src/server/db.ts oraz SRM wskazującego apps/sg-runtime/lib/api/middleware.ts. Resolver rozpoznaje właściciela, ale nie egzekwuje pełnej zgodności projektu zadania z właścicielem. Próba nie wykonywała wszystkich bramek ani żadnej zmiany pliku. [Routing](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/scripts/governance/routing-engine.mjs#L44).

PMOS rejestruje zadania jako osobne rekordy i wyprowadza conversationId z projektu oraz taskId. Finalny closeout korzysta jednak z miejsc lokalnych wspólnych dla checkoutu: pending-artifact.json, .pmos-save.lock, active-closeout.json i runtime-context. Wspólna przestrzeń robocza jest potencjalnym miejscem kolizji. [Ścieżki PMOS](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/apps/pmos/scripts/pmos-save.ts#L109).

Walidator profili wymaga unikalnego projektu Neon dla bazy PMOS każdego profilu. Ścieżka closeout z wyłączonym Memoros zawiera bezpośrednie odwołanie do profilu SRM; nie potwierdzono jej neutralności dla nowego projektu. [Walidator](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/scripts/governance/validate-governance-manifest.mjs#L95), [Closeout](https://github.com/profitia/SG-dev/blob/854657050c3a9bca909cceb702facece937cf21e/apps/pmos/scripts/pmos-save.ts#L2067).

PHR projectId jest polem tekstowym bez zamkniętej listy trzech projektów. Publikacje są identyfikowane kluczem projektu i zadaniem. Publisher wymaga czystego checkoutu na main i ma ponawianie po kolizji push. Nie potwierdzono testu trzech równoczesnych closeoutów. [Schemat PHR](https://github.com/profitia/project-history-repository/blob/5088079e8f9460591fb903a4b0505753f5e9419a/schemas/publication-manifest-v1.schema.json#L32), [Publisher](https://github.com/profitia/project-history-repository/blob/5088079e8f9460591fb903a4b0505753f5e9419a/scripts/publish-bundle.mjs#L59).

Preflight wymaga uwzględnienia świeżego origin/main. Zmiana w innym torze może wymagać aktualizacji gałęzi. SRM CI ma filtry ścieżek aplikacji i srm-xray; przyszły pakiet platformowy nie uruchomi automatycznie tych testów bez aktualizacji konfiguracji. Lokalna zależność srm-xray nie stanowi niezależnego, niezmiennego wydania pakietu.

Wniosek: istnieją podstawy trzech równoległych torów, lecz trzeci tor nie jest obecnie przygotowany jako samodzielny, zarządzany obszar. Dokument ten nie uruchamia środowiska ani nie zawiera dowodu jego gotowości.
