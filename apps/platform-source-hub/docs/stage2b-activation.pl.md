# Stage 2B — ręczna aktywacja Development przez właściciela

Ten dokument opisuje przyszłe operacje właściciela. Stage 2A nie wykonuje żadnej z nich. Staging i Production pozostają nieaktywne. Kod startowy i migrator odmawiają ich uruchomienia. Nie kopiować danych ani poświadczeń Production do Development.

> Aktualizacja wykonawcza 2026-11-04: [jedna lista brakujących czynności właściciela](development-owner-actions.pl.md) uwzględnia TE News, opcjonalne Markets, addytywną migrację002 i aktualny brak usług/ról. Historyczny Stage2A nie jest ponownie przyjmowany. Nowe upoważnienie do aktywacji pochodzi z osobnego zadania właściciela, nie z tego runbooka.

## 1. Wiążący zakres i identyfikatory

Repozytorium `profitia/SG-dev`, branch `main`, **dokładny SHA przyjętego Stage 2A** z dowodu acceptance. Przed aktywacją zweryfikować wymagane CI tego SHA. Nie używać HEAD roboczego PR ani przypadkowo nowszego main. Osobna zgoda na Stage 2B jest wymagana; ten dokument jej nie udziela.

| Usługa | Render | Neon Development |
|---|---|---|
| `profitia-source-hub-development` | Web Service, Frankfurt, `0.5c-512mb` | `delicate-queen-44677134` / `br-orange-salad-ba2llks7` / `ep-noisy-darkness-barhqoqw` / `neondb` |
| `profitia-newsfeed-api-development` | Web Service, Frankfurt, `0.5c-512mb` | `shiny-bonus-85532609` / `br-wispy-bonus-b9ohunab` / `ep-mute-night-b9o332my` / `neondb` |

Render workspace `tea-d7lps8rbc2fs73cn80dg`, projekt `prj-dbl079ou01pc73eg0ffg`, środowisko Development `evm-dbl079ou01pc73eg0fgg`. Właściciel potwierdza projekt/środowisko w panelu; nie umieszczać usług w domyślnym projekcie. Staging `evm-dbl07c0u01pc73eg0kh0` i Production `evm-dbl07lvf3r2c7383en80` pozostawić bez usług i migracji. Nie tworzyć cron ani workerów.

Hosty Hub: pooled `ep-noisy-darkness-barhqoqw-pooler.c-8.eu-central-1.aws.neon.tech`, direct `ep-noisy-darkness-barhqoqw.c-8.eu-central-1.aws.neon.tech`. Hosty Newsfeed: pooled `ep-mute-night-b9o332my-pooler.c-7.eu-central-1.aws.neon.tech`, direct `ep-mute-night-b9o332my.c-7.eu-central-1.aws.neon.tech`. W obu przypadkach baza `neondb`, TLS z weryfikacją certyfikatu, channel binding. Runtime używa pooled, migrator direct.

## 2. Role PostgreSQL — właściciel przygotowuje ręcznie

W SQL Console właściwego **brancha Development** przygotować wyłącznie poniższe role. Najpierw sprawdzić istniejące role; konflikt właściwości oznacza STOP, nie automatyczną zmianę istniejącej roli. Hasła loginów ustawić bezpośrednio w bezpiecznym interfejsie Neon; nie zapisywać ich w SQL w repo, PR, PMOS, logach lub czacie.

Hub:

```sql
CREATE ROLE profitia_access_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE profitia_ingestion_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE source_hub_development_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE source_hub_development_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE source_hub_development_source_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE source_hub_development_migrator LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT profitia_access_owner,profitia_ingestion_owner,source_hub_development_owner TO source_hub_development_migrator;
GRANT CREATE ON DATABASE neondb TO profitia_access_owner,profitia_ingestion_owner,source_hub_development_owner;
```

Newsfeed, w jego osobnym projekcie/branchu:

```sql
CREATE ROLE profitia_access_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE newsfeed_development_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE newsfeed_development_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE newsfeed_development_migrator LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT profitia_access_owner,newsfeed_development_owner TO newsfeed_development_migrator;
GRANT CREATE ON DATABASE neondb TO profitia_access_owner,newsfeed_development_owner;
```

Żadnemu runtime nie przyznawać członkostwa w owner/migrator/neon_superuser ani bezpośrednich praw do tabel E1/Source. Migrator instaluje dokładne funkcje i minimalne GRANT EXECUTE. Source techniczny nie ma dostępu do prywatnych tabel Hub. Migrator i owner nie trafiają do konfiguracji Render runtime. Sprawdzić brak odziedziczonych uprawnień CREATE w schematach chronionych i brak dostępu PUBLIC do ich tabel/funkcji.

## 3. Instalacja i migracje — rzeczywiste komendy

W zaufanej lokalnej kopii dokładnego przyjętego SHA, Node **24.15.0**:

```sh
npm --prefix apps/platform-source-hub ci --include=dev --install-links --ignore-scripts --no-audit --no-fund
npm --prefix apps/newsfeed-runtime ci --include=dev --install-links --ignore-scripts --no-audit --no-fund
npm --prefix apps/platform-source-hub run build
npm --prefix apps/newsfeed-runtime run build
```

Właściciel wczytuje dwie zmienne migratora z lokalnego pliku sekretów o uprawnieniach 0600 poza repozytorium albo z menedżera sekretów. Nie umieszczać connection strings w argumentach procesu lub historii terminala. Następnie:

```sh
SOURCE_HUB_ENVIRONMENT=development npm --prefix apps/platform-source-hub run db:migrate
NEWSFEED_ENVIRONMENT=development npm --prefix apps/newsfeed-runtime run db:migrate
```

Wymagane sekrety procesu migratora: `SOURCE_HUB_MIGRATOR_DATABASE_URL` i `NEWSFEED_MIGRATOR_DATABASE_URL`, odpowiednie role/direct hosty z sekcji 1–2, `sslmode=require&channel_binding=require`. Nie przekazywać ich usługom. Każdy migrator sprawdza rzeczywisty login i bazę, stosuje transakcję i blokadę oraz odmawia zastąpienia obcego schematu/digestu. Powtórzenie weryfikuje istniejącą instalację.

Hub instaluje kanoniczne SQL001 E1, SQL008 Source, SQL009 external call, SQL012 native transport, opcjonalny SQL028 API_PATH oraz własny `migrations/001-foundation.sql`. Newsfeed instaluje kanoniczny SQL001 E1 i własny `migrations/001-foundation.sql`. SQL001/008/009/012 zachowują bajty kanoniczne. Te komendy nie tworzą użytkowników, członkostw, produktów, licencji, grantów Source ani budżetów.

Migracje Stage 2A są addytywne. Rollback aplikacji nie oznacza cofnięcia bazy. Nie wykonywać DROP schematów po rozpoczęciu korzystania. Przed pierwszą migracją wykonać zaakceptowany backup/snapshot właściciela; przed kolejną wersją zachować last known good i kompatybilność czytania.

## 4. Przyjęcie E1 i dopuszczenie Source

**E1: NOT_ACTIVATED w Stage 2A.** W obu bazach właściciel istniejącego E1 musi przyjąć app ID `profitia-source-hub-development` oraz `profitia-newsfeed-api-development`, powiązać ich zwykłe loginy w `profitia_access.applications/runtime_bindings` i dostarczyć aktualne, kanoniczne `accounts`, `external_identities`, `organisations`, `memberships`, `permission_grants`, `product_grants`. Nie kopiować fixture testowych ani nie produkować tożsamości z request body. Nie używać jednorazowej kopii katalogu bez przyjętego mechanizmu odwołania/wygaśnięcia.

Wymagany kontrakt to istniejące `personal.list.read` / `personal.list.write`, feature `personal_workspace`, zasób `personal_list`, klasa `USER_IN_ORGANISATION_PRIVATE`. Produkt wybiera właściciel: SPENDGURU albo SUPPLIER_INTELLIGENCE, ten sam w konfiguracji i bieżącym grancie produktu. ALLOW musi dotyczyć konkretnej aplikacji/użytkownika/organizacji; DENY ma pierwszeństwo. Oryginalny owner obserwacji, wykonujący actor i app/org to oddzielne pola. M2M nie udziela żadnego z tych praw. Nie zmieniać grantów SG2/SRM przy aktywacji nowych aplikacji.

Obie usługi używają oficjalnego Clerk i kanonicznego private-operation-host. Token musi być ważnym bearer session token dla **dokładnego originu Newsfeed API**, z przyjętego Development issuer/authorized party. Nie wystarczy token z dowolnej strony SG2. Frontend/SSO integruje się w osobnym zakresie. Hub weryfikuje podpis peer, oryginalny bearer, bieżącą sesję/konto i własny aktualny E1; porównuje też server-derived subject/org obu stron. Nie włączać dowolnego `azp` ani nie dopisywać nagłówków UserID jako zastępstwa.

**Source: NOT_ACTIVATED w Stage 2A.** Właściciel Source przygotowuje zwykły binding techniczny `source_hub_development_source_runtime`, profil PLATFORM_INTERNAL, `knowledge.ingest`, feature `knowledge_ingestion`, deployment/configuration z env. Zgodność z aktualną instalacją potwierdza `profitia_ingestion.runtime_descriptor()` jako ten login. SDK wymaga aktualnych, skończonych polityk, grantów i budżetów; nie instalować fikcyjnego unlimited ALLOW.

| Provider / family | source_id | resource_id | HTTPS origin |
|---|---|---|---|
| NewsAPI / News Discovery | `source-hub.newsapi.news-discovery` | `api.newsapi.news-discovery` | `https://newsapi.org` |
| Brave / News Discovery | `source-hub.brave.news-discovery` | `api.brave.news-discovery` | `https://api.search.brave.com` |
| TE / Calendar | `source-hub.trading-economics.economic-calendar` | `api.trading-economics.economic-calendar` | `https://api.tradingeconomics.com` |
| TE / Indicators | `source-hub.trading-economics.indicators` | `api.trading-economics.indicators` | `https://api.tradingeconomics.com` |
| TE / Forecasts | `source-hub.trading-economics.external-forecasts` | `api.trading-economics.external-forecasts` | `https://api.tradingeconomics.com` |

Dokładne `pathRules/nativePathRules` pochodzą z wykonywalnej funkcji `sourceDefinition` w `src/admission.mjs`; nie wpisywać własnych wildcardów. Opis można odczytać bez sekretów i bez połączenia z bazą:

```sh
node --input-type=module -e "const m=await import('./apps/platform-source-hub/src/admission.mjs'); console.log(JSON.stringify(Object.keys(m.SOURCE_DEFINITIONS).map(k=>m.sourceDefinition(...k.split(':'))),null,2))"
```

Każdy source ma payload `external-call-control-v1`, quality `source-hub-api-control-v1`, classification `TECHNICAL_CONTROL_NO_PRIVATE_DATA`, effect `STORED_SQL_TRANSACTION`, projection `source-receipt-v1`. Potrzebne są aktualne wiersze `profitia_ingestion.sources/grants/budgets`, `profitia_external_call.policies`, `profitia_external_native.policies` oraz `source_hub.provider_licences`. Właściciel wyznacza i zatwierdza konkretne UUID, source_ref, okno i pojemność; grant jest ograniczony do source/resource/login, nie do wszystkich providerów/konsumentów.

External: transport HTTPS, request limit 16384, response limit 2097152, timeout 15000ms, unit UPSTREAM_ATTEMPT_ADMISSION, skończone capacity i okno, admission_count zachowuje historię. Native: SERVER_HEADERS, ADMITTED_ATTEMPT_CURRENT_SETTLEMENT, brak redirects, 2097152 bytes, dokładna wersja bazowej polityki. TE używa API_PATH i osobnego przyjętego digestu SQL028. Native policy definition jest niezmienna: nowa definicja wymaga nowego ID bazowej polityki i osobnego przyjęcia; nie nadpisywać istniejącej polityki.

Techniczny Source budget liczy kontrolne transakcje; zwykły fetch ma PLAN, ATTEMPT, SETTLE. Uzgodnić pojemność kontroli dla zatwierdzonego N prób upstream i bezpiecznego settlement. To osobna jednostka od prób providera, nie deklaracja ceny/liczby artykułów. Bezpieczna rezerwa settlement nie może służyć rozszerzeniu liczby opłaconych prób. Timeout/niepewność nie oznacza kosztu zero ani zgody na retry.

Licencja wymaga zgodnego source_id/resource_id/current source_policy_id, jawnego `licence_ref/version/expires_at`, dopuszczenia prywatnego użycia, listy consumer app IDs (początkowo wyłącznie `profitia-newsfeed-api-development`) i uzgodnionej retencji. `redistribution=PRIVATE_AUTHORISED_CONSUMER_ONLY`. Deklarację licencji właściciela traktować jako wejście biznesowe; opisać zakres API/plan i rzeczywiste ograniczenia. Brak przyjętej retencji oznacza `retention_seconds=0`: wynik można wyświetlić w bieżącej uprawnionej operacji, nie zachować treści/historii publikacji. Obsłużone API nie dowodzi uprawnienia konta do API.

Przy retencji >0 potrzebne jest zaakceptowane utrzymanie usuwania wygasłych payloadów przed aktywacją. Odczyty odmawiają danych po wygaśnięciu. Stage 2A nie uruchamia zadania cyklicznego; właściciel może ręcznie wykonać jako owner w swojej bazie:

```sql
-- Hub, w transakcji jako source_hub_development_owner:
UPDATE source_hub.acquisitions SET result=NULL WHERE retention_until<=clock_timestamp() AND result IS NOT NULL;
DELETE FROM source_hub.source_records WHERE retention_until<=clock_timestamp();
-- Newsfeed, w jego osobnej bazie jako newsfeed_development_owner:
DELETE FROM newsfeed.publications WHERE retention_until<=clock_timestamp();
```

## 5. Utworzenie dwóch usług Render — właściciel

W istniejącym projekcie/Development wybrać New → Web Service, repo Profitia/SG-dev, branch main, region Frankfurt, compute 0.5c-512mb. **Root Directory pozostawić puste — kontekst całego monorepo.** Nie wskazywać podkatalogu aplikacji, ponieważ używane są pakiety i migracje z repo. Ustawić Auto-Deploy **Off**, previews wyłączone, health check `/ready`. Nie tworzyć deploy hooka/cron/workera. Bez rewrites, cookie forwarding lub rozszerzania CORS.

| Ustawienie | Source Hub | Newsfeed API |
|---|---|---|
| Build Command | `npm --prefix apps/platform-source-hub ci --include=dev --install-links --ignore-scripts --no-audit --no-fund && npm --prefix apps/platform-source-hub run build` | `npm --prefix apps/newsfeed-runtime ci --include=dev --install-links --ignore-scripts --no-audit --no-fund && npm --prefix apps/newsfeed-runtime run build` |
| Start Command | `npm --prefix apps/platform-source-hub start` | `npm --prefix apps/newsfeed-runtime start` |
| Node | `24.15.0` | `24.15.0` |
| Bind | `0.0.0.0:$PORT` | `0.0.0.0:$PORT` |
| Health | `/ready` | `/ready` |

Te komendy są wykonywalnymi skryptami package.json, nie zastępnikami API. Build i start nie wykonują migracji. Pierwsze utworzenie Render Web Service może automatycznie rozpocząć deployment; przygotować role, migracje, przyjęcia i sekrety wcześniej oraz wykonywać tworzenie dopiero w autoryzowanym Stage 2B. Po utworzeniu zapisać rzeczywiste service ID i publiczny HTTPS origin. Dwa originy muszą być różne i identycznie zapisane po obu stronach.

Pełne uruchomienie po skonfigurowaniu przez właściciela: Manual Deploy → Deploy a specific commit → dokładny zaakceptowany SHA. Najpierw Hub i `/ready`, potem Newsfeed i `/ready`. Nie deployować najnowszego HEAD bez ponownej weryfikacji. Po deploymentcie zachować deploy ID, SHA, log startu, health oraz wyniki testu biznesowego; HTTP200 health samo nie dowodzi uprawnień ani działania dostawcy.

## 6. Pełny katalog środowiska

Wartości sekretów właściciel zapisuje bezpośrednio w odpowiedniej usłudze lub prywatnym menedżerze. Brak wspólnej grupy sekretów wszystkich capability. Przykłady bez sekretów: `examples/development.env.example` obu aplikacji.

| Zmienna | Usługa | Sekret | Przeznaczenie/wartość |
|---|---|---|---|
| NODE_VERSION | obie | nie | 24.15.0, wybór runtime Render |
| PORT | obie | nie | wartość Render; nie używać portów 18012/18013/19099 |
| SOURCE_HUB_ENVIRONMENT | Hub | nie | development |
| NEWSFEED_ENVIRONMENT | Newsfeed | nie | development |
| SOURCE_HUB_DATABASE_URL | Hub | tak | pooled, `source_hub_development_runtime` |
| SOURCE_HUB_SOURCE_DATABASE_URL | Hub | tak | ten sam branch/baza; pooled, odrębny `source_hub_development_source_runtime` |
| NEWSFEED_DATABASE_URL | Newsfeed | tak | jego pooled host, `newsfeed_development_runtime` |
| SOURCE_HUB_MIGRATOR_DATABASE_URL | lokalny migrator Hub | tak | direct + migrator; nie Render |
| NEWSFEED_MIGRATOR_DATABASE_URL | lokalny migrator Newsfeed | tak | direct + migrator; nie Render |
| SOURCE_HUB_PUBLIC_ORIGIN | obie | nie | rzeczywisty HTTPS origin Hub, bez path/końcowego slash |
| NEWSFEED_PUBLIC_ORIGIN | obie | nie | rzeczywisty HTTPS origin Newsfeed |
| SOURCE_HUB_DEPLOYMENT_ID | Hub | nie | przyjęta wersja deploymentu, zgodna z Source binding |
| NEWSFEED_DEPLOYMENT_ID | Newsfeed | nie | przyjęta wersja deploymentu |
| SOURCE_HUB_CONFIGURATION_VERSION | Hub | nie | przyjęta wersja konfiguracji, zgodna z Source policy/binding |
| NEWSFEED_CONFIGURATION_VERSION | Newsfeed | nie | przyjęta wersja konfiguracji |
| SOURCE_HUB_PEER_KEY_ID | obie | nie | identyczny jawny identyfikator pary, małe litery/cyfry/myślniki |
| SOURCE_HUB_PEER_KEY_B64 | obie | tak | ten sam losowy sekret tej pary; minimum 32 bajty po base64 |
| CLERK_SECRET_KEY | każda oddzielnie | tak | przyjęte Development credential `sk_test_`; brak live keys |
| CLERK_PUBLISHABLE_KEY | każda | nie | właściwe Development `pk_test_` |
| PROFITIA_IDENTITY_ISSUER | obie | nie | dokładny przyjęty HTTPS issuer, bez wymyślania wartości |
| PROFITIA_AUTHORIZED_PARTIES | obie | nie | lista dokładnych originów rozdzielonych przecinkiem; musi obejmować właściwy origin Newsfeed; brak wildcardów |
| PROFITIA_REQUIRED_PRODUCT | obie | nie | SPENDGURU lub SUPPLIER_INTELLIGENCE, zgodnie z rzeczywistymi grantami |
| SOURCE_HUB_DEVELOPMENT_NEWSAPI_API_KEY | wyłącznie Hub | tak | istniejący klucz NewsAPI, zakres Development |
| SOURCE_HUB_DEVELOPMENT_BRAVE_API_KEY | wyłącznie Hub | tak | klucz Brave z właściwym planem web/news |
| SOURCE_HUB_DEVELOPMENT_TRADING_ECONOMICS_API_KEY | wyłącznie Hub | tak | istniejący klucz TE, raw Authorization header |

Klucz peer można utworzyć lokalnie do pliku 0600 poza repo poleceniem `openssl rand -base64 32` z przekierowaniem do prywatnego pliku. Nie wklejać wyniku do czatu. Rotacja wymaga kontrolowanej zgodności obu usług; nie zmienia autoryzacji użytkowników. Provider credentials nie trafiają do Newsfeed. Żaden klucz nie jest dopisywany do URL.

Staging/Production mają odrębne projekty/branche w kanonicznym environment baseline, lecz nie mają aktywacji w tym kodzie. Przyszła aktywacja wymaga nowych sekretów, app/peer bindings i osobnego zadania. Samo przestawienie env na production jest odrzucane; nie istnieje fallback na produkcyjne poświadczenia.

## 7. Potwierdzenie gotowości i rollback

1. `/live` i `/health` obu usług potwierdzają proces; `/ready` sprawdza właściwe zwykłe loginy i instalacje. Hub dodatkowo wymaga skonfigurowania trzech kluczy oraz bieżących descriptorów sześciu Source API (w tym TE News) oraz przyjęty digest migracji002. Brak przyjęcia daje 503, nie atrapę gotowości.
2. Bez bearer/M2M, z błędnym podpisem i cudzym subject/org musi wystąpić odmowa bez wywołania providera. Dwie rzeczywiste osoby/organizacje nie mogą czytać ani zmieniać swoich obserwacji. E1 revocation i wygasłe licencje muszą blokować odczyt/pobranie.
3. Ważną sesją utworzyć `POST /v1/observations` z modelem z README, odczytać, zmienić wersjonowany PATCH, wstrzymać, wznowić i usunąć. Wybrać organizację nagłówkiem `x-profitia-organisation-id`; jest selektorem, nie grantem.
4. Dopiero po dopuszczeniu małego, skończonego budżetu i zakresu licencji wykonać `POST /v1/observations/{id}/discover` z nowym `Idempotency-Key`. Ponowienie tego samego klucza ma zwrócić istniejący run bez nowej opłaconej próby. W historii sprawdzić liczbę wykryć, retencję i publication refs. Udokumentować wyniki rzeczywistych testów osobno od fixture.
5. Ograniczony bezpośredni probe Hub dla Brave/TE wymaga podpisanego peer i tej samej ważnej sesji/E1, osobnego klucza idempotencji i jawnie dopuszczonego budżetu. Nie odpalać wszystkich filtrów/stron automatycznie. Kalendarz: kraj/data/przyszłe i historyczne, Forecast ≠ TEForecast; Indicators: zero ≠ missing i reference period ≠ update; Forecasts: horizon/vintage ≠ Forecast Core. Sam HTTP200 nie potwierdza skuteczności filtrów ani planu.
6. W logach sprawdzić wyłącznie request ID, operation/outcome/status/duration/count. Nie mają zawierać tokenów, SQL, haseł, query, odbiorców ani treści źródeł. Monitoring: istniejący kanał JSON/stdout i Render health rozszerzony; Sentry/PostHog nie są automatycznie provisionowane ani skonfigurowane przez Stage 2A.

Przy regresji właściciel zatrzymuje nowe ręczne operacje/wyłącza przyjęcie Source, zachowuje bieżące usage/uncertain calls i wybiera w Render wcześniejszy zweryfikowany deploy obu usług. Nie resetować liczników, nie zmieniać PENDING/UNCERTAIN na sukces i nie ponawiać opłaconego żądania bez uzgodnionego reconciliation. Przed pierwszym deployem brak wcześniejszego runtime: rollback oznacza zatrzymanie nowych usług i odwołanie ich nowych grantów; nie cofa się SG2/SRM. Retained artifact rollback nie cofa danych ani env — zweryfikować je osobno. [Render deploys](https://render.com/docs/deploys), [health checks](https://render.com/docs/health-checks), [environment variables](https://render.com/docs/configure-environment-variables), [rollbacks](https://render.com/docs/rollbacks).

Po zakończeniu przekazać wyłącznie: dwa service ID/URL, project/env/region/compute, deployment ID i SHA, auto-deploy Off, health status, Neon project/branch/endpoint/database i **nazwy** ról, wersje/digesty migracji, E1/Source/licence/admission referencje i testy. Dla sekretów tylko „zapisano w właściwej usłudze”. Nie przekazywać haseł, pełnych connection strings ani kluczy.

### Opcjonalny pojedynczy probe operatora

Dopiero w autoryzowanym Stage2B, w zaufanym środowisku z konfiguracją Hub, skrypt `npm --prefix apps/platform-source-hub run probe:live` wykonuje **jedno** podpisane żądanie Hub API. Nie wysyła nic bez aktualnego E1/Source/licencji i nie wywołuje dostawcy bezpośrednio. Jest testem operatora kanału i API, nie dowodem całej ścieżki biznesowej Newsfeed. Nie uruchamiać go w build/CI/start.

Dodatkowe zmienne wyłącznie operatora: `SOURCE_HUB_OWNER_PROBE_REFERENCE` (jawna referencja osobno zatwierdzonego małego budżetu/operacji, 8–100 znaków), `SOURCE_HUB_PROBE_BEARER_FILE` (prywatny plik 0600 z ważną sesją Development; zawartość sekretna), `SOURCE_HUB_PROBE_REQUEST_FILE` (prywatny plik 0600 z `{context:{organisationId,expectedUserId},request:HubRequest}` i syntetycznym zapytaniem). Te identyfikatory są sprawdzanymi asercjami wejścia, nie grantem: serwer porównuje je z własnym E1. Nie wkładać tokenu do JSON z zapytaniem, argumentów procesu lub czatu.

Reference wyznacza stabilny klucz idempotencji. Ponowienie tej samej operacji używa tej samej reference; zmieniony request z tą samą reference jest konfliktem. Po niepewności nie wybierać nowej reference w celu obejścia reconciliation. Skrypt nie wykonuje retry/paginacji, nie wypisuje treści/query i nie potwierdza skuteczności filtrów na podstawie samego HTTP200. Rzeczywisty wynik i ograniczenia planu trzeba sprawdzić osobno w uprawnionym kontekście.

SQL028 dotyczy nowej, nieaktywnej instalacji Hub na bazowym SQL012. Odmawia przy aktywnym Source binding lub istniejącym rozszerzeniu PUBLIC_WEB/GUS SOAP. Nie uruchamiać go w bazach SG2/SRM ani na wcześniejszej aktywnej instalacji; ich schematy pozostają bez zmian.

Odwołanie/zmiana licencji wymaga kontrolowanego zatrzymania dystrybucji u konsumenta: najpierw odwołać jego właściwe uprawnienie E1 do odczytu/pracy, następnie wyczyścić zachowane payloady Hub i publikacje Newsfeed dla wycofanego `licence_ref`, a dopiero po zaakceptowaniu nowej licencji przywrócić właściwe granty. Nie resetować usage/history. Wersja licencji Hub rośnie automatycznie przy zmianie metadanych, więc wcześniejszy wynik Hub nie może obejść nowej retencji. Automatyczne zadania propagacji/purge należą do kolejnego etapu; dodatnia retencja wymaga przyjętej procedury utrzymania, a bez niej wybrać0.
