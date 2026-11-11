# Prywatny monitoring i raporty cykliczne — aktywacja Development

## Zakres i trzy sprawdzalne rezultaty

1. Zalogowany użytkownik zapisuje własną obserwację albo zamówienie. Serwer zachowuje wersję kryteriów, harmonogram i aktualnie autoryzowaną zgodę użytkownika. Inny użytkownik i organizacja nie uzyskują dostępu.
2. Po zamknięciu przeglądarki istniejący proces Newsfeed wykonuje należny monitoring, zapisuje historię i trwałe referencje powiadomień. Powrót i odtworzenie historii nie pobierają nowych danych. Jedna niepewna próba upstream nie jest automatycznie ponawiana.
3. Istniejący proces SG Runtime zleca należne wydanie istniejącemu producentowi Raportów. Użytkownik otrzymuje dopiero rzeczywiście opublikowaną, niezmienną wersję w bibliotece/PDF i we wspólnym asystencie. E-mail wymaga osobnego dopuszczenia istniejącego Identity/Mailgun oraz indywidualnego opt-in.

Kod, przyjęcie na main, migracje, konfiguracja, deployment i powyższe testy biznesowe są osobnymi dowodami. Sam QUEUED nie oznacza gotowego raportu. Testy z SYNTHETIC_ONLY nie są dowodem LIVE. Produkcja Oil, jej płatne obliczenia i decyzja publikacyjna pozostają u właściwego ownera. Nie ma nowego Composera, asystenta, bazy, Cron Job ani usługi.

## Warunki przed jakimkolwiek zapisem

- Aktualny przyjęty SHA, wymagane CI i controlled proof dokładnie tego kandydata; świeże sprawdzenie równoległych prac SG2/SRM/Oil/Kalendarza.
- Odczyt gotowych snapshotów Newsfeed `shiny-bonus-85532609` / `br-wispy-bonus-b9ohunab` oraz platformy `spring-bread-28217539` / `br-sparkling-term-b99l107x`, w tym `platform_private`. Metadane i strategia odtworzenia w PHR. Nie wykonywać globalnego restore współdzielonego E1.
- Istniejący autoryzowany instalator z SET do właściwych istniejących ownerów. Instalatory poniżej nie zmieniają członkostwa ról. Jeżeli SET nie jest dostępny: osobna jawna decyzja o dokładnym odwracalnym wyjątku, porównanie oryginalnych ADMIN/INHERIT/SET i grantora, przywrócenie całego oryginalnego stanu przed COMMIT. Nie uruchamiać samodzielnie commitującego CLI wewnątrz takiego wyjątku.
- Tylko Development; żadnych danych Production, nowych projektów/branchy/baz/serwisów ani owner/migrator URL w Render.

## Kolejność migracji

SQL001/002 bieżącego E1, SQL005 `profitia_services`, authority003 oraz dotychczasowe Insights007/008 muszą już istnieć. Newsfeed003 i Reports003 pozostają niezmienione. Nowe pliki są addytywne, instalowane po zweryfikowaniu SHA256 z poniższej tabeli:

| Kolejność / miejsce | Plik | SHA256 |
|---|---|---|
| Central E1 | `packages/platform-contracts/current-e1-authority/migrations/012-recurring-authority.sql` | `96856496b273af8fb197cec117a179357d03497a4109e2a16787e12a9d8c85fa` |
| Oba odbiorniki E1 | `packages/platform-contracts/current-e1-authority/migrations/013-recurring-receiver.sql` | `f81922d83dcb2f27c4bea0cdd8c2150c6f585fe64b16ecd96fa9f531db76f6d8` |
| Newsfeed | `apps/newsfeed-runtime/migrations/004-recurring-monitoring.sql` | `f1b9aafa37d62b9e825b7f18fb6810f7e61db37fb75f435316f6975f60f84671` |
| Raporty | `apps/insights-runtime/sql/004-recurring-subscriptions.sql` | `b6db2ac3c18fe0a15c66d7177b70f68d66a0d3d2b847de237e01e4785386c778` |
| Central E1 / Identity | `packages/platform-contracts/current-e1-authority/migrations/014-recurring-delivery.sql` | `a68531d41f2e1cbd3ac443efbbf7641beec2a263affff6c84f2463dd3d32482e` |
| Raporty / dostarczanie | `apps/insights-runtime/sql/005-report-delivery.sql` | `3613c39df8d494a33e135b1d925131aa5cae4048e46e7c1797ba528254a16dc1` |

Dla receiver013 wykonuje się dwie osobne instalacje: `neondb` Newsfeed i `platform_private` Raportów. Nie instaluje się go ponownie w Hub. Instalatory sprawdzają fizyczny wpis `profitia_access.installation`, login, digest, poprzedniki, marker i blokadę transakcyjną. Ponowienie ze zgodnym markerem weryfikuje istniejący stan; inny digest odmawia. Nie przechwytuj błędu i nie kontynuuj następnej fazy.

Połączenia instalatorów ustawiane są wyłącznie w chronionym procesie lokalnym z zaakceptowanego magazynu sekretów, na właściwy direct endpoint z TLS i channel binding. Nie publikuj ich ani nie importuj pliku administracyjnego do Render. Z katalogu głównego repozytorium:

```sh
node packages/platform-contracts/current-e1-authority/install-recurring.mjs authority 96856496b273af8fb197cec117a179357d03497a4109e2a16787e12a9d8c85fa
node packages/platform-contracts/current-e1-authority/install-recurring.mjs newsfeed-receiver f81922d83dcb2f27c4bea0cdd8c2150c6f585fe64b16ecd96fa9f531db76f6d8
node packages/platform-contracts/current-e1-authority/install-recurring.mjs reports-receiver f81922d83dcb2f27c4bea0cdd8c2150c6f585fe64b16ecd96fa9f531db76f6d8
npm --prefix apps/newsfeed-runtime run db:migrate -- --recurring-monitoring --expected-sha256 f1b9aafa37d62b9e825b7f18fb6810f7e61db37fb75f435316f6975f60f84671
node apps/insights-runtime/scripts/migrate-recurring.mjs recurring b6db2ac3c18fe0a15c66d7177b70f68d66a0d3d2b847de237e01e4785386c778
node packages/platform-contracts/current-e1-authority/install-recurring.mjs delivery-authority a68531d41f2e1cbd3ac443efbbf7641beec2a263affff6c84f2463dd3d32482e
node apps/insights-runtime/scripts/migrate-recurring.mjs delivery 3613c39df8d494a33e135b1d925131aa5cae4048e46e7c1797ba528254a16dc1
```

E1 CLI korzysta z `PI_RECURRING_INSTALLER_DATABASE_URL`, Reports CLI z `PI_REPORT_INSTALLER_DATABASE_URL`, oba wymagają `PI_RECURRING_ENVIRONMENT=development`. Newsfeed CLI korzysta z dotychczasowych `NEWSFEED_ENVIRONMENT` i `NEWSFEED_MIGRATOR_DATABASE_URL`. Dla każdej fazy wybierz właściwą bazę, nie zmieniaj parametrów w celu obejścia odmowy. Zależność `pg` musi być zainstalowana zgodnie z właściwym app lockfile; uruchom E1 CLI z istniejącego narzędziowego środowiska monorepo z dostępem do `pg`.

## Rzeczywiste dopuszczenia E1 i Source

- Newsfeed potrzebuje własnego rzeczywistego komponentu, własnego odwoływalnego Ed25519 i właściwego centralnego technicznego bindingu SQL005. Nie wolno używać tożsamości Raportów, Oil, ECR ani fikcyjnej sesji Clerk. Jeśli takiego principala nie ma, zatrzymaj tylko tę aktywację i przedstaw ownerowi dokładny wpis/klucz/rolę. Nie twórz nowej roli lub sekretu na podstawie samej migracji.
- W `recurring_executors` przyjmij wyłącznie istniejący, zgodny komponent i aktualny key ID, właściwą aplikację-owner, dokładną operację `newsfeed.monitor.execute` albo `insights.subscription.execute`, skończoną datę ważności i źródło decyzji. Istniejący komponent Raportów może obsługiwać własne zamówienia bez nowej tożsamości.
- Każda obserwacja/zamówienie wymaga rzeczywistej zgody własnego zalogowanego użytkownika. Krótki proof jest sprawdzany ponownie przy zakończeniu zapisu. Sprawdzane są aktualne konto Clerk, członkostwo, produkt, ALLOW/DENY, aplikacja, wersja zasobu, harmonogram, lease i klucz komponentu. Nie ma kopii katalogu ani trwałego pozytywnego cache.
- Własny SERVICE grant NF dla Brave News Discovery musi odpowiadać rzeczywistej organizacji i dozwolonemu zasobowi `api.brave.news-discovery`. Grant techniczny nie daje prawa do innej prywatnej obserwacji. Hub ponownie sprawdza Source/licencję.
- Nie zmieniać istniejących Source Policy ID, UNMETERED, retencji 0, providerów ani aktualnego stanu Markets. Nie wprowadzać dodatkowych kwot.
- E-mail: osobna skończona polityka `recurring_delivery_policies` dla rzeczywistej aplikacji Raportów, istniejącej roli i service ID Identity, dokładnego `https://dev-sg2.spendguru.app`. Bez nowych kont, sekretów Mailgun, szablonów OTP lub fikcyjnych webhooków. Nadal wymagane są opublikowana wersja, aktywny opt-in właściciela, aktualne E1, zweryfikowany główny adres Clerk i dowód związany z konkretną dostawą.

## Dokładne ustawienia Render — ręcznie, Save only

Auto-Deploy pozostaje Off. Nie zmieniać innych ustawień ani kluczy providerów.

| Usługa | Nazwa | Wartość / źródło | Sekret |
|---|---|---|---|
| Newsfeed `srv-dbllnv8m7kps73btro5g` | `NEWSFEED_RECURRING_VERSION` | `private-recurring-v1`, dopiero po dopuszczeniu | nie |
| Newsfeed | `NEWSFEED_COMPONENT_ID` | dokładny przyjęty własny komponent NF | nie |
| Newsfeed | `NEWSFEED_COMPONENT_KEY_ID` | dokładny przyjęty własny key ID NF | nie |
| Newsfeed | `NEWSFEED_SIGNING_PRIVATE_KEY` | własny Ed25519 PKCS8 PEM z zatwierdzonego magazynu; nigdy w PHR | tak |
| Newsfeed | `NEWSFEED_DEPLOYMENT_ID` | dokładny przyjęty SHA wdrażany do tej usługi | nie |
| Identity `srv-dbcse6jrjlhs73eib3sg` | `IDENTITY_RUNTIME_EXPECTED_SOURCE_SHA` | ten sam przyjęty SHA rollout | nie |
| Identity | `IDENTITY_REPORT_DELIVERY_ENABLED` | `true`, dopiero po odrębnym dopuszczeniu celu e-mail | nie |
| Identity | `IDENTITY_REPORT_DELIVERY_SCHEMA_DIGEST` | SHA256 `005-report-delivery.sql` z tabeli | nie |
| SG Runtime `srv-dapa3tid0e5s73f8bc5g` | `INSIGHTS_RECURRING_VERSION` | `private-recurring-v1`, dopiero po dopuszczeniu | nie |
| SG Runtime | `INSIGHTS_EMAIL_DELIVERY_VERSION` | `published-report-v1`, dopiero po dopuszczeniu e-mail | nie |
| SG Runtime | `INSIGHTS_CONFIGURATION_JSON` | tylko zgodne deploymentId dla przyjętego SHA istniejących czterech bindingów aplikacyjnych; pozostałe parametry Oil bez zmian | chroniona konfiguracja |

Istniejące ordinary pooled URL, Clerk i klucz Raportów pozostają w ich magazynach. Nie dodawać klucza NF do Identity, Raportów lub asystenta. `PORT` ustawia Render. Centralne bindingi i publiczne klucze muszą odpowiadać rzeczywiście wdrożonej wersji i konfiguracji; nie ustawiaj nowego SHA wyłącznie w Render bez przyjęcia zgodnych bindingów.

## Rollout i acceptance

Kolejność: Identity → Newsfeed → istniejący SG Runtime. Hub nie wymaga nowego deploymentu dla tego zakresu. Przed każdą operacją sprawdź aktywne deploymenty, ostatni SHA i bieżącą pracę Oil. Żadnych konkurencyjnych wdrożeń/cofnięcia nowszej cudzej wersji. Najpierw dotychczasowe ready i nowe `/v1/e1/recurring/ready`; Newsfeed `/ready` wymaga faktycznej rejestracji własnego klucza. Domyślnie nowe flagi są wyłączone i stara ścieżka pozostaje zachowana.

Minimalne testy LIVE wymagają oddzielnego dozwolonego zakresu: rzeczywisty uprawniony użytkownik zapisuje prywatne definicje; zamyka aplikację; należny przebieg pojawia się po powrocie, nie dubluje po restarcie; odtworzenie historii nie robi pobrania; aktualizacja/pauza/odwołanie prywatnej zgody blokuje starego workera; inny użytkownik/organizacja nie odczytuje zasobu. Nie cofaj współdzielonych globalnych grantów SG2/SRM ani klucza Oil tylko dla testu. Testy tych globalnych cofnięć przechodzą w izolowanym PostgreSQL.

Raport: nowe zlecenie musi dojść do istniejącego producenta; tylko faktycznie PUBLISHED wydanie można pobrać i wskazać asystentowi. Nie publikować fixture ani REVIEW jako gotowego raportu. Można użyć istniejącego uprawnionego wydania wyłącznie przy zgodnym profilu i okresie. Brak takiego wydania lub zgody na produkcję/review jest osobną rzeczywistą zależnością, nie powodem do generowania imitacji.

E-mail: jedna wyraźnie zatwierdzona próba do rzeczywistego zweryfikowanego adresu opt-in. `ACCEPTED` znaczy przyjęcie przez Mailgun, nie dowód doręczenia. `UNKNOWN` po niepewnej próbie jest terminalny bez automatycznego resend. Nie wykonuj prób płatnych API lub wysyłki bez właściwego upoważnienia.

Rollback: wyłącz wyłącznie nowe flagi, odwołaj właściwe nowe executor/purpose entries, przywróć zweryfikowane LKG aplikacji w uzgodnionej kolejności. Zachowaj dane i immutable historię. Nie usuwaj tabel, nie wykonuj destrukcyjnego down ani globalnego restore centralnego E1. Handoff, wyniki, dokładne SHA/deploy ID oraz niezależną weryfikację zamknięcia przechowuj kanonicznie w PHR.
