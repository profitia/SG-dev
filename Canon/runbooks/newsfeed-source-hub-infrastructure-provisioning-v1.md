# Newsfeed & Source Hub — Infrastructure Provisioning Guide v1.0

**Status: canonical infrastructure instructions after controlled main acceptance; provisioned metadata is not runtime acceptance.** Aktualizacja: 2026-11-03. Właściciel sam tworzy i konfiguruje wszystkie zasoby Neon/Render we wszystkich środowiskach. Codex wykonał odczyt metadanych/panelu; nie wykonał SQL produktu, migracji, deployu ani wywołania dostawcy danych.

## 1. Istniejące projekty — nie twórz duplikatów

Właściciel przygotował cztery projekty Neon. Odczyt API potwierdził region **AWS Frankfurt / aws-eu-central-1** i **PostgreSQL18** w każdym:

| Capability | Przeznaczenie | Nazwa w panelu | Project ID |
| --- | --- | --- | --- |
| Newsfeed | Development / Staging | Newsfeed Non-Prod | shiny-bonus-85532609 |
| Newsfeed | Production | Newsfeed Production | twilight-wind-91374750 |
| Platform Source Hub | Development / Staging | Source Hub Non-Prod | delicate-queen-44677134 |
| Platform Source Hub | Production | Source Hub Production | crimson-band-46697896 |

Model jest zgodny z docelowym podziałem: cztery projekty, sześć logicznych środowisk aplikacyjnych. Osobne projekty Production rozdzielają cykl odzyskiwania, konfigurację i poświadczenia od nonprod; nadal mogą mieć wspólnych administratorów organizacji. Branche Dev/Staging współdzielą polityki i administrację projektu danej capability. Nazwy projektów są etykietami; powiązania identyfikuje ID.

Render: istniejący [projekt Source Hub](https://dashboard.render.com/project/prj-dbl079ou01pc73eg0ffg), **prj-dbl079ou01pc73eg0ffg**, workspace **PROFITIA WORKSPACE / tea-d7lps8rbc2fs73cn80dg** wskazany przez właściciela. Nie twórz nowego projektu/workspace ani zastępczego projektu o nazwie z poprzedniej propozycji.

Kanoniczne dane odczytu: [resource baseline](../registries/newsfeed-source-hub-environment-baseline-v1.json). To dokumentacja infrastruktury, nie Architecture execution topology ani runtime grant. PMOS pozostaje w **billowing-credit-07394675 / architecture_pmos**, rola **architecture_pmos_runtime**; żadna baza produktu go nie zastępuje.

## 2. Aktualne branche, endpointy i bazy

| Capability / środowisko | Branch ID | Endpoint ID | Baza |
| --- | --- | --- | --- |
| Newsfeed Development | br-wispy-bonus-b9ohunab | ep-mute-night-b9o332my | neondb |
| Newsfeed Staging | br-frosty-cell-b9hzdh6e | ep-wandering-term-b9v57pi9 | neondb |
| Newsfeed Production | br-noisy-pine-b9i0865t | ep-aged-sun-b9ooczkd | neondb |
| Source Hub Development | br-orange-salad-ba2llks7 | ep-noisy-darkness-barhqoqw | neondb |
| Source Hub Staging | br-snowy-breeze-bahrkgrr | ep-noisy-grass-baszxszx | neondb |
| Source Hub Production | br-flat-resonance-b9dh28bf | ep-empty-water-b9yjwui8 | neondb |

Nazwy branchy to odpowiednio development, staging, production. Nonprod Staging jest dzieckiem Development tej samej capability. Production jest rootem odrębnego projektu. Baza neondb została potwierdzona przez API katalogu, bez wykonywania SQL i bez badania danych. Domyślny owner katalogowy neondb_owner nie jest przyjętą rolą runtime.

**Ważna korekta:** Newsfeed Development to teraz **br-wispy-bonus-b9ohunab / ep-mute-night-b9o332my**, a nie historyczne br-solitary-star-b9i144lk / ep-restless-sea-b9ducsrh. Dawny root nazwany production jest obecnie development. Poprzednich ID nie ma w bieżącym wykazie; nie twierdzimy bez dowodu, że dane zostały przeniesione lub usunięte. W nowej konfiguracji używaj wyłącznie aktualnego ID/hosta.

| Capability / środowisko | Pooled hostname |
| --- | --- |
| Newsfeed Development | ep-mute-night-b9o332my-pooler.c-7.eu-central-1.aws.neon.tech |
| Newsfeed Staging | ep-wandering-term-b9v57pi9-pooler.c-7.eu-central-1.aws.neon.tech |
| Newsfeed Production | ep-aged-sun-b9ooczkd-pooler.c-7.eu-central-1.aws.neon.tech |
| Source Hub Development | ep-noisy-darkness-barhqoqw-pooler.c-8.eu-central-1.aws.neon.tech |
| Source Hub Staging | ep-noisy-grass-baszxszx-pooler.c-8.eu-central-1.aws.neon.tech |
| Source Hub Production | ep-empty-water-b9yjwui8-pooler.c-7.eu-central-1.aws.neon.tech |

Nie ma tu hasła ani pełnego connection string z poświadczeniami. Host/ID/baza nie potwierdzają uprawnień roli, E1, schematu lub działania aplikacji.

## 3. Neon — ustawienia odczytane i ręczne działania właściciela

Wszystkie sześć endpointów w chwili odczytu: **idle**, zakres **0.25–8 CU**, suspend_timeout_seconds **0** (globalna wartość domyślna **300s**, nie always-on). Wszystkie cztery projekty: historia **86400s / 1 dzień**, public connections nieblokowane, lista IP pusta. Żaden z sześciu branchy nie miał ochrony. To stan metadanych, nie test bezpieczeństwa ani dowód pustej bazy. [Neon timeout semantics](https://neon.com/docs/guides/ai-agent-integration), [Scale to Zero](https://neon.com/docs/guides/scale-to-zero-guide)

Przed runtime właściciel ręcznie:

1. Dla każdego potrzebnego endpointu rozważa na start **0.25–1 CU** i zachowuje **Scale to Zero / 5 minut**. Obserwowane maksimum8CU nie jest rekomendowanym budżetem. W Console wybierz branch → Postgres database / Computes / Edit. Zmiana Compute defaults nie aktualizuje istniejących endpointów; sprawdź każdy oddzielnie. Codex niczego tu nie ustawił.
2. W obu projektach Production oznacza branch production jako **protected**, ustala historię (propozycja **7 dni**, dostępność i koszt do potwierdzenia w panelu). Aktualnie potwierdzono brak ochrony i tylko1dzień historii. [Protected branches](https://neon.com/docs/guides/protected-branches)
3. Uzgadnia rzeczywistą allowlistę IP/kanał migracji i odzyskiwania po poznaniu adresów wyjściowych Render. Obecny brak allowlisty jest jawny; nie deklarujemy izolacji sieciowej Production. Nie wpisuj zgadywanych IP ani nie blokuj sobie odzyskiwania.
4. Przy osobnym zaakceptowanym zadaniu schematu/dostępu tworzy właściwe role i uprawnienia; nie używa owner URL w aplikacji. Sekrety dopiero z przyjętym backendem, oddzielnie per capability i środowisko.
5. Ustala backup, RPO/RTO i wykonuje odtworzenie przed Production, zgodnie z sekcją4. Nie resetuje nonprod z danych produkcyjnych; samo parent ID nie dowodzi sanitizacji prywatnych danych.

Teraz pozostaw aplikacje i harmonogramy nieuruchomione. Idle compute nie nalicza aktywnego compute do czasu obudzenia, lecz storage/historia/backup i plan konta nie muszą kosztować0. Testy/połączenia podtrzymujące aktywność mogą zmienić rachunek. Always-on(-1) wymaga osobnej decyzji SLO/koszt; nie jest potrzebny dla pustego środowiska.

## 4. Później — role, schemat i odzyskiwanie

Nie twórz teraz tabel ani schematu. Docelowe nazwy ról w każdym środowisku:

| Środowisko | Role Newsfeed | Role Source Hub |
| --- | --- | --- |
| Development | newsfeed_development_runtime / newsfeed_development_migrator | source_hub_development_runtime / source_hub_development_migrator |
| Staging | newsfeed_staging_runtime / newsfeed_staging_migrator | source_hub_staging_runtime / source_hub_staging_migrator |
| Production | newsfeed_production_runtime / newsfeed_production_migrator | source_hub_production_runtime / source_hub_production_migrator |

Nazwy są planem. Uprawnienia, schema ownership, FORCE RLS i transakcyjny kontekst E1 trzeba przyjąć razem z migracją w osobnym zadaniu. Właściciel tworzy/konfiguruje role zgodnie z tym przyjęciem; runtime nie może być ownerem, `neon_superuser` ani BYPASSRLS. Role Dev/Staging nie dostają praw do Production ani do drugiej capability. Nie używaj automatycznie wygenerowanej roli właścicielskiej z Console w usłudze aplikacji.

Dla aplikacji użyj **pooled URL** z końcówką hosta `-pooler`, zwykłej roli i TLS; migracje/backup używają **direct URL**, oddzielnej roli i osobnego bezpiecznego kanału. Migrator URL nie trafia do runtime ani wspólnej grupy środowiskowej. Pooler działa transakcyjnie: nie polegaj na kontekście sesji między transakcjami; przyszły test musi wykazać brak wycieku E1 przy ponownym użyciu połączenia. Właściwy driver musi potwierdzić obsługę `sslmode=require&channel_binding=require`. [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)

Retencja historii nie jest testem odzyskania ani kompletną polityką backupu. Przed Production: zaakceptuj RPO/RTO (propozycja **RPO ≤24h, RTO ≤4h, do pomiaru**), osobny backup/export z retencją i szyfrowaniem, odtworzenie w izolowanym projekcie bez zmiany działającego endpointu, weryfikację danych/RLS i ścieżkę powrotu. Snapshoty, historia, backup/export i przywrócony compute mogą kosztować. Osobny projekt nie oznacza osobnego regionu DR. Rzeczywisty recovery drill jest zależnością przyszłego wydania, nie dowodem Stage 1B.

## 5. Render — istniejące puste środowiska i ustawienia do wykonania

W projekcie **Source Hub / prj-dbl079ou01pc73eg0ffg** panel udostępnił następujący odczyt:

| Środowisko | Environment ID | Usługi / grupy zmiennych | Ruch między środowiskami | Permissions |
| --- | --- | --- | --- | --- |
| Development | evm-dbl079ou01pc73eg0fgg | 0 / 0 | Allowed | Default |
| Staging | evm-dbl07c0u01pc73eg0kh0 | 0 / 0 | Allowed | Default |
| Production | evm-dbl07lvf3r2c7383en80 | 0 / 0 | Allowed | Default — Protected wyłączone |

**Granica dowodu:** connector MCP nie udostępnia metadanych projektów/środowisk; dla tego kanału pozostaje **OWNER_CONFIRMATION_REQUIRED** przed runtime binding. Oddzielnie odczytano dokładny wskazany przez właściciela projekt i widoczne Environment settings w panelu: UI_VERIFIED_READ_ONLY. Lista usług connectora nie zawiera usług w tych trzech environment ID. Nie przedstawiamy odczytu UI jako potwierdzenia API ani aktywacji środowiska aplikacji. Plan workspace i region nieistniejących usług nie są zweryfikowane.

Nie twórz ponownie projektu ani środowisk. Wszystkie pozostają puste. Właściciel przed runtime:

1. W każdym środowisku włącza **Block cross-environment connections** (obecnie Allowed).
2. Dla Production ustawia **Permissions / Protected** (obecnie Default).
3. Potwierdza bieżący plan workspace i dostępność funkcji w panelu. Nie kupuj drugiego workspace ani nie doliczaj opłaty Pro drugi raz, jeśli jest już opłacona.
4. Dopiero z zaakceptowanym backendem przygotowuje odrębne konfiguracje/sekrety i tworzy procesy z sekcji6. Teraz nie tworzy usług, crona, workera, dysku, Key Value ani Render Postgres na zapas.

Izolacja prywatnej sieci nie blokuje publicznych URL Web Services i nie zastępuje M2M/E1. Protected nie jest aplikacyjną kontrolą dostępu. [Render projects/environments](https://render.com/docs/projects)

Obecny Newsfeed jest biblioteką/CLI, bez zaakceptowanego backendu subskrypcji. Brak zatwierdzonych build/start/health komend dla przyszłych usług. Nie uruchamiaj discover jako serwera ani nie twórz atrap echo/sleep. Auto-Deploy Off kontroluje kolejne wdrożenia; nie gwarantuje utworzenia usługi bez pierwszego deployu. [Render deploys](https://render.com/docs/deploys)

## 6. Dopiero z backendem — minimalne usługi Render

Dla każdego środowiska wybierz **Frankfurt** (parametr `frankfurt`), zgodnie z Neon. Region jest ustawiany przy tworzeniu usługi; późniejsza zmiana wymaga nowej usługi i migracji. [Render regions](https://render.com/docs/regions)

| Środowisko | Web API Source Hub | Web API Newsfeed | Cron monitoringu Newsfeed |
| --- | --- | --- | --- |
| Development | profitia-source-hub-development | profitia-newsfeed-api-development | profitia-newsfeed-monitor-development |
| Staging | profitia-source-hub-staging | profitia-newsfeed-api-staging | profitia-newsfeed-monitor-staging |
| Production | profitia-source-hub-production | profitia-newsfeed-api-production | profitia-newsfeed-monitor-production |

Plan początkowy usług: **0.5c-512mb**, jedna instancja; klasa musi przejść pomiar pamięci/czasu, inaczej świadomie wybrać **1c-2g**. API pozostają odrębnymi procesami i wdrożeniami. Jeden ograniczony czasowo cron na środowisko obsługuje trwałe harmonogramy wszystkich obserwacji; nie jeden cron na użytkownika. Proponowany przykład `15 4 * * *` oznacza **04:15 UTC** (05:15 Warszawa zimą / 06:15 latem), a nie ustaloną lokalną godzinę przez cały rok. To przykład do przyjęcia polityki monitoringu, nie aktywny harmonogram.

Wybrany docelowo **Web Service** Hub zapewni serwisowe HTTPS dla zatwierdzonych konsumentów również poza prywatną siecią Render. Nie ma UI ani anonimowego dostępu; M2M, E1 i ograniczenie środowiska są obowiązkowe. Nie dopuszczać przechodzenia między środowiskami publicznym adresem. Jeżeli przy późniejszym wdrożeniu wszystkie dopuszczone serwisy są w tej samej prywatnej sieci/środowisku, można osobno przyjąć wariant **Private Service**. Nie jest osiągalny spoza tej sieci i ma tylko TCP health checks; nie otwieraj publicznego proxy dla obejścia izolacji. [Private services](https://render.com/docs/private-services), [private network](https://render.com/docs/private-network)

Ustawienia przy późniejszym tworzeniu:
- repozytorium `profitia/SG-dev`, zatwierdzony artefakt/SHA i branch authority; **Auto-Deploy Off**, preview environments **Off**; każda promocja ręczna, na dokładny SHA, niezależnie per środowisko i usługa;
- root i build/start/cron command dopiero z zaakceptowanego backendu: planowane root `apps/platform-source-hub` dla Hub i `apps/newsfeed-runtime` dla Newsfeed nie są dziś gotowymi celami deployu; monorepo/shared contract dependencies muszą być ujęte w rzeczywistym build context;
- serwer Web bind `0.0.0.0:$PORT`; proponowany `/health/ready` dopiero po implementacji i weryfikacji; health nie pobiera providerów ani prywatnych danych. Render HTTP health wymaga Web Service; Private Service domyślnie TCP. [Health checks](https://render.com/docs/health-checks)
- cron musi kończyć proces, mieć bounded work, timeout/retry i trwały lease/idempotency; limit pojedynczego uruchomienia Render wynosi 12h, a ręczne uruchomienie przerywa poprzednie — potrzebna obsługa bezpiecznego wznowienia. Nie używać nieskończonego workera jako cron. [Cron jobs](https://render.com/docs/cronjobs)
- bez dysków, dodatkowego Postgresa, kolejki i zawsze uruchomionego workera na zapas; późniejsze zwiększenie liczby procesów wymaga uzasadnienia rzeczywistym obciążeniem;
- przed pierwszym ruchem: E1/revocation i test izolacji, limity kosztów, telemetryczne metadane bez sekretów, recovery/rollback i negatywne testy. Przygotowany panel lub HTTP200 nie oznacza odbioru biznesowego.

## 7. Zmienne i sekrety — plan nazw, bez wartości

Poniższe nazwy dla przyszłego backendu **nie są już zaimplementowanym interfejsem konfiguracyjnym**. Osobne zadanie runtime musi je potwierdzić. Dla każdego środowiska `<env>` oznacza dokładnie development, staging albo production.

| Właściciel konfiguracji | Nazwa | Typ i plan użycia |
| --- | --- | --- |
| obie usługi API / cron | TARGET_ENVIRONMENT=<env>, NODE_ENV=production | jawne; NODE_ENV także dla uruchomienia kodu na Dev, nie oznacza środowiska biznesowego |
| każda usługa oddzielnie | DATABASE_URL | sekret; pooled URL tylko właściwej zwykłej roli i bazy |
| kanał migracji | DIRECT_URL | sekret migratora; poza usługą/grupą runtime |
| API Web | PORT | wartość dostarczana przez Render; nie sekret |
| Hub | SOURCE_HUB_SERVICE_ID, SOURCE_HUB_ALLOWED_CONSUMERS, SOURCE_HUB_ALLOWED_ENVIRONMENT | jawne; nie dają same uprawnienia |
| weryfikator istniejącego E1 | E1_ISSUER, E1_AUDIENCE, E1_JWKS_URL, E1_OPERATION_POLICY_VERSION | jawne bindingi do przyjętego kontraktu; nie wymyślać URL ani zastępować E1 statycznym OrgID |
| Newsfeed API/cron | SOURCE_HUB_BASE_URL, SOURCE_HUB_CONTRACT_VERSION | jawne, to samo środowisko; docelowo przyjęta wersja, brak obecnej |
| kanał M2M | SOURCE_HUB_CLIENT_ID, SOURCE_HUB_CLIENT_SECRET | ID jawne/sekret; tylko jeśli przyjęty kontrakt użyje credentials; delegacja E1 nadal wymagana |
| Hub — po migracji | NEWSAPI_API_KEY, TRADING_ECONOMICS_API_KEY, BRAVE_SEARCH_API_KEY | sekrety po osobnej adopcji każdego providera; GDELT bez założenia o wymaganym kluczu |
| Hub | PROVIDER_ENTITLEMENT_REFS, PROVIDER_POLICY_VERSION, PROVIDER_REQUEST_BUDGET | referencje/limity do zatwierdzonej polityki, nie lokalna alternatywa Package & Limits |
| telemetria później | SENTRY_DSN / SENTRY_ENVIRONMENT / SENTRY_RELEASE; POSTHOG_PROJECT_API_KEY / POSTHOG_HOST | tylko po przyjęciu istniejącego/oddzielnego projektu i polityki prywatności; nie wysyłać query, odbiorców ani treści |

Nie dodawaj provider secrets do Newsfeed „na zapas”. Istniejący lokalny NewsAPI zachowuje obecne bezpieczne użycie; Stage 1B nie odczytał ani nie przeniósł klucza. Zmiana miejsca sekretu wymaga planu migracji, kompatybilności i wycofania starego dostępu. Każdy env ma oddzielne poświadczenia i zakres licencji; nie kopiuj Production do Dev/Staging.

W Render zapisuj sekrety bezpośrednio w ustawieniach konkretnej usługi lub grupie ograniczonej do właściwego środowiska i capability. Nie twórz wspólnej grupy wszystkich usług dla DATABASE_URL lub provider keys. Nie wpisuj wartości do repozytorium, issue, PR, PMOS/PHR, screenshotu ani czatu. Nie przesyłaj Codexowi plaintext haseł; ewentualne lokalne pliki sekretów ustal dopiero przy zadaniu runtime.

## 8. Koszty — aktualne podstawy i przykłady, nie oferta

Ceny USD bez podatków, region Frankfurt, weryfikacja **2026-11-03**. Aktualny cennik/dostępność w panelu mają pierwszeństwo. Podstawa poprzedniego odczytu organizacji: Scale; aktualny plan i limity konta potwierdź w panelu. Nie zakładaj zmiany planu. Neon nie nalicza osobnej opłaty za projekt ani miesięcznego minimum; rachunek zależy od użycia. Scale compute **0.222 USD/CU-h** (Launch **0.106**), storage **0.35 USD/GB-mies.**, historia **0.20 USD/GB-mies.** przechowywanej historii, snapshoty **0.09 USD/GB-mies.**. W Scale 25 branchy/projekt w limicie, ponad limit **1.50 USD/branch-mies.**; planowane gałęzie mieszczą się w limicie. Limity/sleep nie usuwają opłat za przechowywanie. [Neon pricing](https://neon.com/pricing)

Render: workspace **Pro 25 USD/mies. + compute**, Scale **499 USD/mies. + compute**, Hobby **0 + compute**; plan płaci się za workspace, nie za każdą usługę. Klasa Web/Private/Worker **0.5c-512mb 7 USD/mies.**, **1c-2g 25 USD/mies.**. Cron **0.5c-512mb 0.00016 USD/min**, rozliczany sekundowo, ale **minimum 1 USD/mies. na usługę cron**. Plan Pro wspiera wymagane trzy izolowane środowiska. [Render pricing](https://render.com/pricing), [cron billing](https://render.com/docs/cronjobs)

| Scenariusz | Przybliżony koszt miesięczny | Założenia |
| --- | --- | --- |
| przygotowane, uśpione Neon + puste Render env | compute może wynosić 0; storage/historia/snapshoty i plan workspace osobno | brak zapytań/health/botów podtrzymujących compute; bez deklaracji zerowego całego rachunku |
| dwa Dev compute po 0.25 CU przez 60h + łącznie 2GB storage | 2 × 0.25 × 60 × 0.222 + 2 × 0.35 = **7.36 USD Neon** | Source Hub + Newsfeed, bez historii/snapshotów/egress |
| dwa Production compute 0.25 CU zawsze aktywne przez 730h + 10GB storage | 2 × 0.25 × 730 × 0.222 + 10 × 0.35 = **84.53 USD Neon** | wariant kosztowy, nie wymóg always-on ani pomiar użycia |
| jedno działające środowisko Render | 2 × 7 + minimum cron 1 = **od 15 USD compute** | API 0.5c-512mb; cron 5min/dzień ×30 dni kosztuje 0.024 USD, stosuje się minimum 1 USD |
| wszystkie trzy działające środowiska Render | 3 × 15 = **od 45 USD compute**, +25 Pro = **od 70 USD** | pełny miesiąc, mały cron; nie tworzyć teraz usług tylko dla tej symulacji |

Jeśli workspace Pro jest już opłacony z innymi usługami, nie doliczaj 25 USD po raz drugi jako kosztu nowego modułu. Nie zakładaj zwolnienia workspace z opłaty tylko dlatego, że nasze środowiska są puste. Każdy stale działający API ma koszt; cron ma minimum nawet przy małej liczbie uruchomień. Uśpiony Neon budzi się także od diagnostyki i pooli utrzymujących aktywność. Historia i backup zależą od ilości/zmian danych, nie tylko liczby dni.

Do przykładów dolicz rzeczywiste: transfer, buildy, płatne monitoringi, snapshoty/backup, większą klasę compute, provider plans i licencje. Bieżący cennik Neon deklaruje 500GB egress/projekt paid, następnie 0.10 USD/GB; Render Pro 25GB, następnie 0.15 USD/GB. Sprawdź licznik i zakres rozliczenia w panelu przed budżetem. NewsAPI, Trading Economics, Brave i przyszłe GDELT nie zostały wycenione dla konta użytkownika; koszt/licencja pozostają **DO POTWIERDZENIA**, nie „darmowe”.

## 9. Co przekazać po ręcznej konfiguracji

ID projektów/branchy/endpointów i widocznych środowisk z sekcji1–5 są już zapisane; przekazuj ich zmiany oraz brakujące potwierdzenia konfiguracji. Bez sekretów, osobno dla każdego środowiska:
- Neon: nazwa/ID projektu, branch i parent ID, endpoint ID, region/PG, nazwa bazy, pooled i direct hostname, zakres CU, ustawienia uśpienia, historia/protection/allowlist status. Nazwy ról i ich uprawnienia dopiero po osobnym zatwierdzeniu; bez hasła lub pełnego URL z poświadczeniem.
- Render: workspace/project/environment ID i nazwy, potwierdzony plan, status izolacji/protection; teraz **usługi: NIE UTWORZONO**. Przy późniejszym backendzie: service/cron ID, typ/region/klasa, root/commands, auto-deploy Off, SHA/deploy ID, health URL, cron UTC/status i konfiguracja sieci.
- Bezpieczny kanał sekretów: wyłącznie informacja „zapisano w danej usłudze/grupie” albo uzgodniona lokalna ścieżka poza repo — nigdy wartość. Pochodzenie i zakres licencji/provider entitlement bez klucza.
- Zaznacz każdy niepotwierdzony element. Nie podawaj wymyślonych ID ani statusu runtime PASS.

## 10. Warunki rozpoczęcia kolejnego etapu

Dokładne G1 i dokumenty mają zgodę właściciela wskazaną w dowodzie aktywacji; ich authority wynika dopiero z kontrolowanego main acceptance. Przed runtime nadal wymagane są: wersjonowane przyjęcie Hub/Newsfeed i każdego konsumenta, per-operation E1/Source i revocation, licencja/retencja/budżet, ręcznie przygotowane i zweryfikowane zasoby/role, backend z rzeczywistymi komendami/health, testy izolacji oraz recovery/rollback. Każdy runtime/deploy wymaga osobnego zadania. Staging/Production pozostają planem infrastruktury, bez aktywacji profilu ARCHITECTURE w tych środowiskach.

Powiązania: [kanon Hub](../v1.0-platform-source-hub-business-and-architecture-canon.md), [amendment Newsfeed](../v1.1-newsfeed-source-hub-responsibility-amendment.md), [machine-readable resource baseline](../registries/newsfeed-source-hub-environment-baseline-v1.json), [Stage 1B evidence](../evidence/2026-11-03-platform-source-hub-stage1b-foundation.md).

## Stage 2A / przyszła ręczna aktywacja Stage 2B

Po przyjęciu implementacji obowiązuje [wykonywalny suplement Stage 2](../../apps/platform-source-hub/docs/stage2b-activation.pl.md): dwie usługi Web API, rzeczywiste build/start/migracje, oddzielne role i sekrety, jawne E1/Source/licencje oraz testy i rollback. Wcześniejsze katalogi planistyczne env/cron w tym dokumencie opisują Stage1B; suplement zawiera dokładne nazwy zmiennych zaimplementowanego kodu. Nie tworzyć jeszcze cron ani workerów. Stage2A nie wykonuje provisioningu ani deploymentu.
