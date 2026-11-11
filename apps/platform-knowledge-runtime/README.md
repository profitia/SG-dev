# Platform Knowledge Development — bootstrap etapu 1

Ten bootstrap pozwala utworzyć dwie usługi i sprawdzić ograniczone połączenia. **FOUNDATION_ONLY**: nie przyjmuje dokumentów, nie tworzy tabel, nie uruchamia parsera ani OpenAI. Nie jest silnikiem etapu 2 ani odbiorem etapu 3.

## Utworzenie usług przez właściciela

Repozytorium: `https://github.com/profitia/SG-dev`; branch `main`. Użyj dokładnego SHA opublikowanego przy tym pakiecie po wymaganym CI. Nie wybieraj nowszego HEAD automatycznie, jeśli zmieniła się konfiguracja pakietu. Render przy utworzeniu może rozpocząć pierwszy build z bieżącego main; po utworzeniu przy wyłączonym auto-deploy potwierdź ręczne **Deploy a specific commit** i rzeczywisty SHA obu usług. Pełne niesekretne parametry są w [deployment/development.json](deployment/development.json).

| Ustawienie | API | Worker |
| --- | --- | --- |
| Workspace | PROFITIA `tea-d7lps8rbc2fs73cn80dg` | ten sam |
| Project / environment | Platform Knowledge / platform-knowledge-development | te same |
| Region | Frankfurt | Frankfurt |
| Service type | Web Service | Background Worker |
| Name | `platform-knowledge-development-api` | `platform-knowledge-development-worker` |
| Language / Runtime | Docker | Docker |
| Root Directory | puste — katalog główny repozytorium | puste |
| Dockerfile Path | `./apps/platform-knowledge-runtime/Dockerfile` | taki sam |
| Docker Build Context Directory | `.` | `.` |
| Build Command | nie wypełniaj; budowanie określa Dockerfile | tak samo |
| Docker Command (Advanced) | `node src/main.mjs` albo puste (domyślny CMD) | `node src/worker.mjs` |
| Health Check Path | `/health/live` | nie dotyczy |
| Plan | Starter, jedna instancja | Standard, jedna instancja, 2 GB RAM |
| Auto-deploy | wyłączony | wyłączony |
| Persistent disk / Redis / autoscaling | brak | brak |

Obie usługi od początku używają Dockera; wersja Node 24.15.0 i digest oficjalnego obrazu są przypięte w Dockerfile. Nie wybieraj natywnego runtime Node. Pozwoli to dodać narzędzia Office/OCR w etapie 2 do tych samych usług. Obecny obraz nie instaluje jeszcze parserów. Kontekst builda ma zamkniętą listę plików i pomija .env, Git, testy i dokumenty. Żaden sekret nie jest deklarowany jako ARG ani używany podczas budowania. Proces działa jako użytkownik node, bez roota. [Render Docker](https://render.com/docs/docker).

Sprawdź aktualnie wyświetloną cenę przed utworzeniem. Nie podnosimy samodzielnie planu. Standard jest przygotowaniem do konwersji dokumentów etapu 2; bootstrap nie wykorzystuje jeszcze parserów. Nie dodawaj Pre-Deploy Command: ten pakiet nie instaluje migracji.

W obu usługach wpisz niesekretne wartości z [szablonu konfiguracji](examples/development.env.example): `NODE_ENV=production`, `PK_ENVIRONMENT=development`, `PK_PROCESSING_ENABLED=false`, `PK_NEON_PROJECT_ID=sparkling-sky-79692560`, `PK_NEON_BRANCH_ID=br-billowing-grass-b9ko5s4f`, `PK_DATABASE_HOST=ep-wild-mode-b972j8k0-pooler.c-7.eu-central-1.aws.neon.tech`. `RENDER_GIT_COMMIT` dostarcza Render; nie wpisuj ręcznie innego release. Port API bierze się z `PORT` dostarczanego przez Render, domyślnie 10000.

Oddzielny sekret `DATABASE_URL` w API musi używać roli `platform_knowledge_api`; w Workerze `platform_knowledge_worker`. Obie łączą się przez host pooled do `platform_knowledge` z TLS. Najpierw wykonaj [instrukcję ról](../../Canon/runbooks/platform-knowledge-development-owner-db-setup-v1.md). Nie używaj `neondb_owner` ani migratora i nie przesyłaj connection strings w rozmowie.

Jeżeli jest już właściwy projekt Sentry, ustaw jego `SENTRY_DSN` bezpośrednio w obu usługach oraz niesekretne `PK_SENTRY_PROJECT=organisation/project`. Bez wskazania projektu bootstrap nie może przyjąć DSN. Nie stosuj automatycznie `profitia/sg-porr`. Przy braku projektu usługi można przygotować bez DSN, lecz monitoring i etap 1 pozostają nieodebrane. Test kontrolowanego transportu nie zastępuje potwierdzenia odbioru zdarzenia w Sentry. Nigdy nie przesyłamy SQL, treści dokumentów, identyfikatorów użytkowników ani connection strings w telemetry.

OpenAI i S3 nie są potrzebne do uruchomienia samego bootstrapu. Nie kopiuj klucza OpenAI do GitHub CI. Zatwierdzone użycie istniejącego klucza i limit 10 USD pozostają ważne; rzeczywiste przetwarzanie będzie wymagało trwałej rezerwacji kosztu i skonfigurowanych ograniczonych poświadczeń storage. Brak tych elementów nie jest zastępowany kontem administratora.

## Sprawdzenie po utworzeniu

- Przekaż niesekretne ID obu usług, projektu i środowiska oraz URL API. Agent odczyta rzeczywisty deploy SHA i stan; nie potrzeba kolejnej akceptacji etapu.
- `/health/live`: HTTP 200 i `FOUNDATION_ONLY` oznacza wyłącznie działający proces.
- `/health/foundation`: HTTP 200 dopiero po odczycie nazwy bazy, roli, ograniczeń, schematu i rozszerzenia vector. Bez poprawnych ról zwraca 503 bez szczegółów połączenia. Odczyt ma współdzielone krótkie cache, nie generuje zapytania do Neon dla każdego wywołania health.
- `/health/ready`: celowo HTTP 503 `NOT_READY_FOR_PROCESSING`. Każdy `/v1/*` zwraca 503. Nie wgrywaj jeszcze dokumentów.
- Worker sprawdza ograniczoną rolę raz podczas startu i pozostaje bezczynny bez odpytywania kolejki. Błąd blokuje start. SIGTERM zamyka połączenia; nie istnieją jeszcze zadania do ponowienia.

Pierwsze wydanie ma jawny brak poprzedniego LKG. Przy błędzie zawieś tylko te dwie nowe usługi i zachowaj bazę oraz prywatny bucket. Nie cofaj wspólnej bazy ani nie kasuj ról/schematu. Przed pierwszą migracją produktu potrzebna będzie izolowana gałąź testowa i potwierdzony readback instalacji; bootstrap jej nie wykonuje.

## Weryfikacja i dalszy zakres

Lokalnie: `npm ci --prefix apps/platform-knowledge-runtime --ignore-scripts --no-audit --no-fund`, następnie `node --test packages/platform-knowledge-contracts/test/*.test.mjs packages/platform-knowledge-core/test/*.test.mjs apps/platform-knowledge-runtime/test/*.test.mjs` i `npm run build --prefix apps/platform-knowledge-runtime`.

CI działa bez sekretów i środowisk deploymentu. Buduje faktyczny obraz linux/amd64, sprawdza start bez zewnętrznej sieci, nieuprzywilejowanego użytkownika, stan przetwarzania i zamknięcie SIGTERM; zapisuje ID obrazu w artefakcie testu. Render buduje własny artefakt z tego samego Dockerfile i przypiętej bazy; jego rzeczywiste wydanie wymaga osobnego odczytu. Generuje autorskie PDF/DOCX/PPTX/TXT/MD oraz prawdziwe DOC/PPT przez LibreOffice, sprawdza round-trip, 100 stron i marker końcowy; skan wymaga późniejszego OCR. Artefakt referencyjny nie jest dowodem działania retrieval. Progi w `packages/platform-knowledge-core/fixtures/quality-profile-v1.json` są zamrożone przed płatnym przebiegiem. Stosujemy 10 USD łącznie i techniczny limit 1 USD/dokument; timeouty/UNKNOWN nie zwalniają rezerwacji bez rozliczenia. Implementacja trwałego ledgera, parserów, hybrydowego indeksu, uprawnień i adopcji jest pracą etapu 2, pełny odbiór w SpendGuru — etapu 3.
