# Newsfeed & Source Hub — Infrastructure Provisioning Guide v1.0

**Status: instrukcja planowanej konfiguracji; PROPOSED_NOT_ACTIVE.** Stan zweryfikowany 2026-11-03. Właściciel sam tworzy i konfiguruje wszystkie zasoby Neon/Render. Codex w Stage 1B wykonał tylko odczyt metadanych i przygotował dokumentację; nie wykonał SQL, migracji, deployu ani wywołania providera.

## 1. Co już istnieje

[Projekt Neon Newsfeed](https://console.neon.tech/app/projects/shiny-bonus-85532609), ID `shiny-bonus-85532609`, AWS Frankfurt `aws-eu-central-1`, PostgreSQL **18**, organizacja na planie **Scale**:

| Branch w panelu | Branch ID | Endpoint ID | Stan odczytany |
| --- | --- | --- | --- |
| development | br-solitary-star-b9i144lk | ep-restless-sea-b9ducsrh | idle |
| staging | br-frosty-cell-b9hzdh6e | ep-wandering-term-b9v57pi9 | idle |
| production (root/default) | br-wispy-bonus-b9ohunab | ep-mute-night-b9o332my | idle |

Podany adres Development jest zgodny z odczytem Neon:
`ep-restless-sea-b9ducsrh-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`.

To metadane połączenia, bez roli i hasła. Nie jest to kompletne poświadczenie ani dowód zwykłej roli, poprawnego E1, pustej bazy, schematu czy gotowości aplikacji. Nie badano danych i ról SQL. Nazwy baz Staging/Production należy potwierdzić w panelu; plan używa `neondb`, bez automatycznego tworzenia kolejnej bazy.

Wszystkie trzy endpointy: 0.25–8 CU; `suspend_timeout_seconds=0`, czyli **globalny domyślny timeout 300 s**, a nie „zawsze włączony”. Odczyt potwierdził `idle`. Żaden branch nie miał ochrony. Historia projektu: **1 dzień**. Nie zmieniono tych ustawień. Znaczenie 0/-1 opisuje [Neon agent integration](https://neon.com/docs/guides/ai-agent-integration); zasady uśpienia i ustawień per endpoint: [Scale to Zero](https://neon.com/docs/guides/scale-to-zero-guide).

## 2. Docelowy podział — cztery projekty, trzy środowiska

Rekomendacja: **oddzielne projekty Production dla obu capability; wspólne Dev/Staging tylko w granicach tej samej capability.** To cztery projekty łącznie, z czego jeden już istnieje. Pozwala zachować obecne Development/Staging i rozdziela dane/licencje Source Hub od prywatnych danych Newsfeed. Osobne projekty Production dają niezależny cykl historii/odzyskiwania, poświadczenia i mniejszy zasięg pomyłki administratora. Nie tworzą osobnych organizacji ani automatycznej izolacji administratorów.

| Środowisko | Newsfeed — projekt / branch / baza | Source Hub — projekt / branch / baza |
| --- | --- | --- |
| Development | istniejący Newsfeed / development / neondb | nowy profitia-source-hub-nonprod / development / neondb |
| Staging | istniejący Newsfeed / staging / neondb do potwierdzenia | profitia-source-hub-nonprod / staging / neondb |
| Production | nowy profitia-newsfeed-production / production / neondb | nowy profitia-source-hub-production / production / neondb |

Wspólny projekt Dev/Staging oznacza wspólną historię/limity/administrację projektu; branch nie jest osobnym kontem bezpieczeństwa. Role, hasła i binding środowiska muszą być oddzielne. Jeśli Staging wymaga niezależnych polityk projektu, późniejsza decyzja może rozdzielić go do osobnych projektów; nie jest to warunek przygotowania obecnego Dev.

Obecny root Newsfeed nazwany `production` zostaje **bez zmian i bez przypisania do uruchamianego Production**. Nie usuwać, nie resetować, nie kopiować ani nie zmieniać jego nazwy w ramach tej instrukcji. Nie potwierdzono jego zawartości. Produkcyjne dane prywatne nie mogą stać się rodzicem Dev/Staging. Istniejących branchy nie resetować z roota bez osobnej kontroli danych i odzyskiwania. Mechanizm kopiowania ról/hasła między gałęziami wymaga uwagi; ochrona rodzica zmienia zachowanie nowych haseł, lecz nie stanowi sanitizacji danych. [Neon protected branches](https://neon.com/docs/guides/protected-branches)

PMOS Architecture pozostaje w `billowing-credit-07394675 / architecture_pmos`, zwykła rola `architecture_pmos_runtime`. Nie używać projektu Newsfeed ani Source Hub dla ciągłości PMOS/PHR.

## 3. Teraz — ręczne przygotowanie Neon

Wszystkie poniższe kliknięcia wykonuje właściciel. Nie ma potrzeby podawać Codexowi hasła administratora. Przed utworzeniem sprawdź listę projektów, aby nie powielić równolegle przygotowanych zasobów.

1. Otwórz istniejący projekt **Newsfeed** i zachowaj branche Development/Staging. Potwierdź w panelu bazę i region oraz zapisz bezpieczne ID z tabeli. Nie twórz duplikatu projektu ani Development. Proponowany na start limit każdego nieprodukcyjnego compute: **0.25–1 CU**, Scale to Zero **włączone / 5 minut**. Obecne 8 CU jest odczytanym maksimum, nie rekomendacją budżetu. Zmiany limitów wykonujesz świadomie sam; Codex ich nie wykonał.
2. Opcjonalnie utwórz **profitia-source-hub-nonprod**, AWS Frankfurt `aws-eu-central-1`, PG18, baza domyślna `neondb`. Root nazwij **seed**, pozostaw wyłącznie bez danych prywatnych; utwórz z niego **development** i **staging**. Nie klonuj Production. Ustaw każdy potrzebny compute 0.25–1 CU i uśpienie po 5 minutach.
3. Jeśli chcesz przygotować Production już teraz, utwórz niezależnie **profitia-newsfeed-production** i **profitia-source-hub-production**, w obu AWS Frankfurt, PG18, root **production**, baza `neondb`. Zachowaj uśpienie po 5 minutach i limit 0.25–1 CU podczas przygotowania. Nie podłączaj aplikacji, harmonogramów ani testów odpytujących bazę. Po braku aktywności compute może spać; storage/historia nadal podlegają rozliczeniu.
4. W Settings / Storage ustaw proponowaną historię odzyskiwania **1 dzień nonprod / 7 dni Production**; dostępne maksimum i koszty sprawdź w panelu organizacji. Obecny Newsfeed ma 1 dzień. Production oznacz jako **protected** przed danymi produkcyjnymi. Proponowana ochrona nie została zastosowana do istniejącego roota.
5. Pozostaw zwykłe połączenia TLS. Docelową allowlistę IP Production ustal po uzyskaniu rzeczywistych adresów wyjściowych usług Render i kanału migracji/odzyskiwania; nie wpisuj wymyślonych IP i nie blokuj sobie odzyskiwania. Przed runtime zweryfikuj reguły dostępu; otwarty adres endpointu nie jest sam w sobie akceptacją bezpieczeństwa.

Konsola: wybierz branch → **Postgres database / Computes / Edit** → zakres compute i Scale to Zero. Zmiana **Compute defaults** dotyczy nowych endpointów, nie aktualizuje istniejących. Po każdej ręcznej zmianie sprawdź każdy endpoint osobno. Wybór pięciu minut jest obsługiwany przez panel; niestandardowe progi mogą wymagać API i nie są potrzebne w tym etapie. [Neon konfiguracja uśpienia](https://neon.com/docs/guides/scale-to-zero-guide)

Przy gotowości backendu dobierz ponownie limity na podstawie pomiaru. Ewentualne always-on Production (`-1`) wymaga jawnej decyzji koszt/SLO; nie ustawiaj go na potrzeby pustego środowiska.

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

## 5. Teraz — puste środowiska Render

W [Render Dashboard](https://dashboard.render.com) użyj istniejącego właściwego workspace Profitii; zapisz jego ID i plan. Nie twórz drugiego workspace tylko dla tego modułu. Sprawdź, czy ktoś już nie przygotował projektu o poniższej nazwie.

1. **New → Project**: `profitia-newsfeed-source-hub`, pierwsze środowisko **development**.
2. Dodaj **staging** i **production**. Dla trzech środowisk w jednym projekcie wybierz istniejący lub nowy plan workspace **Pro**, jeżeli obecny plan nie udostępnia wymaganych funkcji. Aktualnie Hobby pozwala na dwa środowiska/projekt, Pro na więcej; nie zakładaj, że plan został już kupiony.
3. W każdym środowisku włącz **Block cross-environment connections**. Production oznacz jako **Protected**. Oddzielne konfiguracje i grupy pozostają w swoim środowisku.
4. **Zatrzymaj się na pustych środowiskach.** Nie twórz Web Service, Private Service, Cron Job, Worker, dysku, Redis/Key Value ani Render Postgres. Dane będą w Neon.

Puste środowisko jest obsługiwane przez Render i nie potrzebuje placeholdera aplikacji. Opłata planu workspace jest osobna od compute; istnienie innych usług w workspace ma znaczenie dla rachunku. Izolacja prywatnej sieci nie blokuje publicznych URL usług; ochrona środowiska nie zastępuje kontroli uprawnień aplikacji. [Render projects/environments](https://render.com/docs/projects), [cennik](https://render.com/pricing)

Obecny kod Newsfeed jest biblioteką/CLI, bez zaakceptowanego serwera subskrypcji. Nie ma zatwierdzonych build/start/health komend dla przyszłych usług Hub/Newsfeed. Dlatego ich tworzenie jest odłożone. Nie uruchamiaj obecnego `discover` jako serwera i nie twórz atrap usług z `echo`/sleep. `Auto-Deploy Off` kontroluje kolejne automatyczne wdrożenia; nie traktuj go jako gwarancji „utwórz usługę bez pierwszego wdrożenia”. [Render deploys](https://render.com/docs/deploys)

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

Ceny USD bez podatków, region Frankfurt, weryfikacja **2026-11-03**. Aktualny cennik/dostępność w panelu mają pierwszeństwo. Organizacja Neon jest na Scale; nie zakładaj zmiany planu. Neon nie nalicza osobnej opłaty za projekt ani miesięcznego minimum; rachunek zależy od użycia. Scale compute **0.222 USD/CU-h** (Launch **0.106**), storage **0.35 USD/GB-mies.**, historia **0.20 USD/GB-mies.** przechowywanej historii, snapshoty **0.09 USD/GB-mies.**. W Scale 25 branchy/projekt w limicie, ponad limit **1.50 USD/branch-mies.**; planowane gałęzie mieszczą się w limicie. Limity/sleep nie usuwają opłat za przechowywanie. [Neon pricing](https://neon.com/pricing)

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

## 9. Co przekazać po ręcznym przygotowaniu

Bez sekretów, osobno dla każdego środowiska:
- Neon: nazwa/ID projektu, branch i parent ID, endpoint ID, region/PG, nazwa bazy, pooled i direct hostname, zakres CU, ustawienia uśpienia, historia/protection/allowlist status. Nazwy ról i ich uprawnienia dopiero po osobnym zatwierdzeniu; bez hasła lub pełnego URL z poświadczeniem.
- Render: workspace/project/environment ID i nazwy, potwierdzony plan, status izolacji/protection; teraz **usługi: NIE UTWORZONO**. Przy późniejszym backendzie: service/cron ID, typ/region/klasa, root/commands, auto-deploy Off, SHA/deploy ID, health URL, cron UTC/status i konfiguracja sieci.
- Bezpieczny kanał sekretów: wyłącznie informacja „zapisano w danej usłudze/grupie” albo uzgodniona lokalna ścieżka poza repo — nigdy wartość. Pochodzenie i zakres licencji/provider entitlement bez klucza.
- Zaznacz każdy niepotwierdzony element. Nie podawaj wymyślonych ID ani statusu runtime PASS.

## 10. Warunki rozpoczęcia kolejnego etapu

Wymagane: dokładne G1 i przyjęcie dokumentów, kontrolowane main acceptance, wersjonowane przyjęcie Hub/Newsfeed i każdego konsumenta, per-operation E1/Source i revocation, licencja/retencja/budżet, ręcznie przygotowane i zweryfikowane zasoby/role, backend z rzeczywistymi komendami/health, testy izolacji oraz recovery/rollback. Każdy runtime/deploy wymaga osobnego zadania. Staging/Production pozostają planem infrastruktury, bez aktywacji profilu ARCHITECTURE w tych środowiskach.

Powiązania: [kanon Hub](../proposals/v1.0-platform-source-hub-business-and-architecture-canon.md), [amendment Newsfeed](../proposals/v1.1-newsfeed-source-hub-responsibility-amendment.md), [machine-readable environment plan](../proposals/platform-source-hub-environment-plan-v1.json), [Stage 1B evidence](../evidence/2026-11-03-platform-source-hub-stage1b-foundation.md).
