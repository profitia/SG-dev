# Source Hub first-party — jedna instrukcja aktywacji Development

Owner: Architecture Platform / Identity E1. Kod i migracje są przygotowane do kontrolowanego przyjęcia; ten dokument **nie jest zgodą na migrację, deployment ani płatny test**. Nie tworzyć zasobów lub ról. Nie dotykać Staging/Production. Starsza instrukcja [current E1](source-hub-newsfeed-current-e1-development-v1.md) pozostaje źródłem istniejących bindingów i bezpiecznych referencji sekretów.

## 1. Dokładne istniejące cele i kolejność

| Cel | Neon / branch / baza | Rola instalacji / zwykły runtime |
|---|---|---|
| Central Identity | `spring-bread-28217539` / `br-sparkling-term-b99l107x` / `platform_private` | istniejący `profitia_access_owner` / `identity_b1_runtime` |
| Hub | `delicate-queen-44677134` / `br-orange-salad-ba2llks7` / `neondb` | istniejący `profitia_access_owner`, następnie `source_hub_development_migrator` / `source_hub_development_runtime` |
| Newsfeed | `shiny-bonus-85532609` / `br-wispy-bonus-b9ohunab` / `neondb` | brak migracji w tym rozszerzeniu |

Najpierw odświeżyć przyjęty main i CI dokładnego SHA, aktywne PR/deployment queues oraz snapshot/PITR i LSN obu zmienianych baz. Skoordynować współdzielone central E1 i istniejący raport ropy. Nie przywracać globalnego snapshotu centralnej bazy dla lokalnej poprawki.

Po osobnej zgodzie aktywacyjnej, z chronionych lokalnych połączeń direct TLS, transakcyjnie `ON_ERROR_STOP` i pod kontrolowaną blokadą przestrzeni migracji:

1. Central E1: potwierdzić przyjęty SQL005 `profitia_services` (dokładny digest `packages/platform-contracts/migrations/access/005-service-read.sql`), istniejące SQL001 i current-E1 authority001. Jeśli SQL005 nie istnieje, wymaga właściwego ownera i osobno przyjętej instalacji; nie tworzyć zastępczych service grants. Jako `profitia_access_owner` zastosować **tylko** `packages/platform-contracts/current-e1-authority/migrations/003-first-party-authority.sql`. Nie ponawiać 001 na istniejącym schemacie. Zapisać SHA256 pliku i fakt instalacji w kontrolowanym rejestrze migracji aktywacji; rozbieżny istniejący schemat/digest oznacza STOP.
2. Hub: jako `profitia_access_owner` zastosować **tylko** `packages/platform-contracts/current-e1-authority/migrations/004-first-party-receiver.sql`, po istniejącym receiver002. Nadać `GRANT EXECUTE` tylko `source_hub_development_runtime` na `source_descriptor()`, `source_challenge(text,jsonb,jsonb,text,text)`, `source_accept(jsonb)`, `source_scope(text,uuid,text,uuid,text,text)`, `source_application(text)` i `source_append_audit(jsonb)` w schemacie `profitia_e1_receiver`. Runtime ma już USAGE; PUBLIC nie dostaje praw ani klucza.
3. Hub: zaakceptowany migrator z direct connection z Keychain uruchamia z katalogu repo:

```sh
SOURCE_HUB_ENVIRONMENT=development SOURCE_HUB_INSTALL_FIRST_PARTY=true npm --prefix apps/platform-source-hub run db:migrate
```

`SOURCE_HUB_MIGRATOR_DATABASE_URL` ma pochodzić z chronionego środowiska procesu, nie z argumentu polecenia, repo, logu lub czatu. Instalacja dodaje **004-universal-consumers**, weryfikuje istniejące 001/002 i zapisuje digest w `source_hub.migrations`; ponowienie potwierdza ten sam digest. Nie ustawiać `SOURCE_HUB_INSTALL_UNMETERED_SOURCE=true`: sześć polityk UNMETERED jest już przyjętych i nie jest ponownie instalowanych/zmienianych. 004 nie przepisuje historycznych ledgerów ani nie rozszerza licencji.

Nie używać owner/migrator w Render. Weryfikacja instalacji: zwykły Hub runtime może wywołać `source_descriptor`, nie czyta kluczy E1; bez podpisanego proof SELECT nowego ledgeru zwraca 0, INSERT jest odmówiony. Zweryfikować FORCE RLS, brak PUBLIC ACL i dokładny digest 004. Porównać sześć polityk Source, wersje, UNMETERED, retencję i Markets z baseline — muszą pozostać zgodne.

## 2. Zwykłe techniczne powiązanie komponentu i bieżące entitlement

Identity owner zapisuje jedną aktywną rejestrację receivera `profitia_e1_authority.source_receivers`: `application_id=profitia-source-hub-development`, `target_origin=https://source-hub-development.onrender.com`, `product_application_id=spendguru`, skończone `expires_at` i rzeczywiste `source_ref`. To uzupełnia istniejący receiver/proof key; nie generuje nowego globalnego sekretu.

Dla każdego rzeczywistego komponentu użyć istniejącej aplikacji i istniejącej prawidłowej roli runtime z `profitia_access.applications/runtime_bindings`. W `source_components` zapisać `component_id`, `key_id`, tę `application_id/login_role`, receiver, dokładny `source_origin` (HTTPS lub przyjęty service URN), publiczny klucz Ed25519 SPKI PEM, rzeczywisty deployment/configuration, `status=ACTIVE`, skończone expiry i źródło decyzji. Brak kodowej listy modułów; kolejne komponenty wykonują tę samą zwykłą rejestrację. Nie tworzyć dla nich nowej polityki Source ani nowego wyjątku biznesowego. Nie wpisywać przykładowych identyfikatorów z testów.

| Kontekst | Wymagane aktualne dane E1 |
|---|---|
| HUMAN | rzeczywista Clerk session/account, external binding, membership oraz SPENDGURU/market i `knowledge.read/market` w kanonicznej aplikacji `spendguru`; DENY w aplikacji produktu lub komponentu jest nadrzędny |
| SERVICE raportu | istniejący `profitia_services.runtime_bindings` tej samej roli oraz przyjęty `read_grants.grant_id`, organisation, `knowledge.read/market`, właściwy `resource_id` lub jawnie przyjęty cały market, ACTIVE i skończone expiry; wymagany bieżący SPENDGURU/market organizacji |

Nie kopiować kont ani członkostw do Hub, nie zmieniać istniejących grantów SG2/SRM. Jeżeli odpowiedni komponent/rola/grant nie istnieje, owner Identity przyjmuje rzeczywiste dane w swoim zakresie; nie dopisywać globalnego ALLOW. Cofnięcie konta, membership, produktu, aplikacji, komponentu, klucza lub service-grantu obowiązuje przy następnej obserwacji i przed wynikiem transakcji.

Licencje: owner danych potwierdza użycie produktowe sześciu istniejących rekordów `source_hub.provider_licences` i zmienia wyłącznie `consumer_access_mode` na `SPENDGURU_PRODUCT` tam, gdzie obowiązująca licencja pozwala na użycie przez uprawnione komponenty SPENDGURU. Domyślny tryb migracji pozostaje LEGACY_APPLICATION, więc sama instalacja nie przyznaje danych. Nie tworzyć kopii licencji per moduł. Zmiana wersjonuje rekord automatycznie; nie zmieniać `source_policy_id`, source/resource IDs, retencji 0, expiry, UNMETERED ani `allow_market_forecasts=false`.

## 3. Ręczna konfiguracja istniejących usług — tylko brakujące elementy

Identity `srv-dbcse6jrjlhs73eib3sg`: zachować istniejący runtime/login/Clerk, `IDENTITY_CURRENT_E1_ENABLED=true`, wszystkie funkcje kont i SG2/SRM. Nowa wersja udostępnia `/v1/e1/source/ready` i `/v1/e1/source/authorize` bez nowych zmiennych/sekretów.

Hub `srv-dbllmk0n74is73c2eptg`: zachować istniejące pooled runtime/source URL, origin `https://source-hub-development.onrender.com`, issuer, authorized parties, produkt, trzy klucze providerów i przyjęte deployment/configuration bindingi. Nowy protokół nie wymaga żadnej listy konsumentów ani wspólnego klucza w Hub. Istniejącą kompletną trójkę Newsfeed i czasowy dodatkowy peer raportu pozostawić dla zgodności, aż właściwi konsumenci zostaną kontrolowanie przełączeni. Nie udostępniać tych HMAC kluczy nowym modułom. Niepełna grupa legacy jest błędem konfiguracji.

Newsfeed `srv-dbllnv8m7kps73btro5g`: brak nowych wymaganych zmiennych i brak zmiany działającego klienta. Zachować osobną bazę, E1 i aktualny peer. Przyszłe przełączenie na wspólny klient korzysta z własnej tożsamości, bez zmian providerów.

Komponent Procurement Insights / przyszły moduł: właściciel ustawia w jego bezpiecznej konfiguracji pola klienta opisane w [integracji](../../apps/platform-source-hub/docs/first-party-consumers.pl.md). Wyłącznie `privateKey` jest nowym sekretem per komponent. Pozostałe identyfikatory są przyjętymi danymi rejestru; grant ID/org pochodzi z prawdziwego kontekstu zadania. Nie tworzyć nowego Render worker/service w tym zadaniu.

Wspólne parametry Render: Node24.15.0, root repo, Auto-Deploy Off, PR previews Off, `/ready`. Build/start Hub i Newsfeed pozostają zgodne z istniejącą [instrukcją Stage2B](../../apps/platform-source-hub/docs/stage2b-activation.pl.md). Użyć „Save only”, bez automatycznego deploymentu. Żaden sekret ani connection string nie trafia do handoffu.

## 4. Osobno autoryzowany rollout i rollback

Po wszystkich potwierdzeniach: dokładny przyjęty SHA → Identity, `/v1/e1/ready` i `/v1/e1/source/ready`, potem Hub `/ready`; Newsfeed może pozostać na kompatybilnym przyjętym wydaniu. Sprawdzić rzeczywisty HUMAN, drugi komponent pod własną tożsamością, SERVICE bez sesji, izolację i odwołanie grantu. Płatny test upstream wymaga osobnej liczby i zakresu dopuszczonych prób. Offline fixture nie jest wynikiem live.

Rollback bez kasowania danych: REVOKED nowych component/receiver enrollmentów zatrzymuje nowy protokół; zachować ledger/audit i migracje addytywne. Przywrócić wcześniejszy zweryfikowany kod Identity/Hub po sprawdzeniu kolejki deploymentów i wpływu raportu ropy. Dotychczasowe protokoły i licencje legacy pozostają dostępne zgodnie z własnym E1. Nie wykonywać globalnego restore centralnej bazy, drop tabel/kluczy ani modyfikacji Source policies jako rutynowego rollbacku.
