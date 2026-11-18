# Platform Knowledge — R7: naprawa błędów rzeczywistego uruchomienia Development

Status: **PROPOSED / OWNER_DECISION_REQUIRED**. Pakiet `ARCH-PK-STAGE2-R7-GO-20261118` kontynuuje to samo zadanie; nie oznacza odbioru Etapu 2 ani 3. [Kanon funkcjonalny](../v1.0-platform-knowledge-business-and-architecture-canon.md) pozostaje niezmieniony.

## Stan rzeczywisty i przyczyna aktualizacji

Wydanie R6 `cfa76c865083b43d14408f4bbfa27b2287c03972` jest prawidłowo przyjęte i wdrożone na trzech istniejących usługach. Wszystkie 13 wymaganych przebiegów źródła i 13 wynikowego main zakończyły się sukcesem. SQL001/015/016, dwa powiązania odbiorców i 11 ograniczonych grantów są rzeczywiście zainstalowane.

Zwykła sesja operatora przyjęła trzy autorskie dokumenty testowe. Worker rzeczywiście uzyskał wyniki OpenAI i zapisał fragmenty oraz embeddingi, lecz wszystkie trzy zadania zatrzymały się na VERIFY. Potwierdzone przyczyny i brakujące elementy:

- Weryfikacja i wyszukiwanie używają niekwalifikowanego operatora pgvector. Przy rzeczywistym search_path zapytanie zwraca 42883; jawny operator public działa.
- Retencja audytu ma DELETE, ale brakuje SELECT na kolumnie created_at użytej w predykacie. Rzeczywista rola Workera odrzuca tę operację kodem 42501.
- CSP panelu nie dopuszcza wymaganych zasobów Clerk Protect, dlatego formularz logowania nie powstaje. Korekta odpowiada [oficjalnym wymaganiom Clerk](https://clerk.com/docs/guides/secure/best-practices/csp-headers) i nie wyłącza ochrony.
- Świeży katalog tymczasowy Render nie zawierał /tmp/pk utworzonego przy budowie obrazu. Potrzebne jest jego bezpieczne odtworzenie przez parser.

Sentry zarejestrował faktyczne JOB_FAILED i RETENTION_FAILED. Dotychczasowe sześć rozliczonych wywołań kosztowało 508 microUSD, czyli 0,000508 USD; rezerwacja wynosi zero. Ponowienia wykorzystały checkpointy bez kolejnych płatnych wywołań. Pełnego E2E jeszcze nie zaliczono. [Bieżący zapis PHR](https://github.com/profitia/project-history-repository/blob/main/reports/2026/11/18/ARCHITECTURE/ARCH-PK-STAGE2-TECHNICAL-CONT-20261117/R6_ACTUAL_RUNTIME_AND_FIRST_PROCESSING_FAILURE.md) zachowuje te rozróżnienia.

## Dokładne źródło

[PR #1208](https://github.com/profitia/SG-dev/pull/1208), podpisany źródłowy commit **445b35ef278b957d02d6477bc90a534a288ac052**, baza **c4965a445867601275cbb75dc4de993123414ba2**, drzewo **1d0024c26226ebb23252690ba70a99d3dcec4fce**.

[Maszynowy zakres](../proposals/platform-knowledge-stage2-r7-runtime-repair/source-review.json) przypina wszystkie osiem plików, ich Git blobs, tryby i SHA256 oraz kompletną propozycję zwykłego SOURCE_VALIDATION_ONLY:

1. src/database.mjs — Worker z aktywnym silnikiem wymaga prawa odczytu daty retencji; tryb foundation bez tabel pozostaje dostępny.
2. src/extraction.mjs — odtworzenie nieobecnego katalogu tymczasowego, odmowa symlinków i zachowanie prywatnych katalogów zadań.
3. src/knowledge.mjs i src/processing.mjs — jawny operator OPERATOR(public.<=>), bez rozszerzenia search_path.
4. src/server.mjs — dokładnie wymagane hosty Clerk Protect/Cloudflare i worker-src; nadal default-src none i frame-ancestors none, bez unsafe-eval lub inline skryptów.
5. test/database.test.mjs i test/runtime-acceptance.test.mjs — rzeczywiste ograniczone role, odzyskanie od VERIFY bez nowego modelu, retrieval, retencja, CSP i katalog parsera.
6. db/migrations/002-worker-audit-retention.sql — wyłącznie SELECT(created_at) dla istniejącego platform_knowledge_worker.

Wszystkie ścieżki powyżej mają prefiks apps/platform-knowledge-runtime/. **SQL001, istniejące SDK, historyczne rekordy oraz pliki CI pozostają identyczne.** Hash nowego SQL002: **4b2823f3f338f1347e0e5963481a5291a9741faa92c36fd69e4c0931ee7b690c**.

## Dopuszczenie źródeł i przypięcie wydania

Zgoda obejmuje te osiem dokładnych postimages, ich normalne przyjęcie oraz kompletny własny rekord SOURCE_VALIDATION_ONLY na trusted main, z rzeczywistym aktorem, odniesieniem do tej decyzji i ważnością najpóźniej do 24 listopada 2026, 23:59 UTC. Rekord jest danymi dopuszczenia, nie uprawnieniem do runtime. Propozycja w JSON nie jest jeszcze ACTIVE i nie podszywa się pod decyzję.

Dopuszczone mechaniczne odświeżenie zachowuje commit 445b35ef w historii, wszystkie osiem blobów/trybów i kompletny własny diff; włącza wyłącznie prawidłowo przyjęte zmiany main innych zadań. Nie wolno ukrywać nowych plików, zmieniać private pins, usuwać kontroli ani przepisywać historycznych rekordów. Kolejność uzgodniona z innymi zadaniami: SDK1.38 i wynikowy main → przyjęty mechanizm bieżącej autentykacji SVO z zadania PI → osobne dopuszczenie ośmiu źródeł PK.

Końcowe wdrażane SHA zostaje przypięte **po rzeczywistym przejściu pełnego CI i przyjęciu**: to wynikowy main tej linii, zachowujący wskazane osiem blobów i mający własne pełne wymagane CI oraz niezależnie zweryfikowany oryginalny proof. Każdy faktyczny kandydat ma własny exact-source proof; końcowy main ma osobny AUTHORITY_MAIN_VALIDATION. Zachowujemy oba oryginalne artefakty i dokładne SHA przed jakąkolwiek operacją na środowisku.

Ten pakiet **nie zatwierdza nowej polityki CI ani wyjątku bootstrap/ominięcia kontroli**. Bieżąca autentykacja musi obejmować rzeczywiste kompletne źródła i właściwe już przyjęte zależności. Zmiana któregokolwiek z ośmiu własnych blobów, payloadu SQL, uprawnień lub zasobów wymaga właściwej aktualizacji decyzji; odświeżenie identycznych źródeł według powyższych warunków nie wymaga ponownego uzgadniania celu.

## Ograniczone operacje Development

Po wymaganych kontrolach, świeżym odczycie providera, potwierdzeniu braku konkurencyjnego deploymentu i aktywnych zadań:

- W istniejącej bazie Platform Knowledge: właściwy migrator, SET LOCAL istniejącego właściciela; próba z ROLLBACK, następnie dokładny SQL002 i [product-rebind.sql](../proposals/platform-knowledge-stage2-r7-runtime-repair/product-rebind.sql). Aktualizacja wyłącznie deploymentId dwóch istniejących native bindingów z Cfa do końcowego SHA. SQL001 i jego digest, limity, dane, RLS, pozostałe pola i terminy pozostają zachowane.
- W istniejącym centralnym Identity: [identity-rebind.sql](../proposals/platform-knowledge-stage2-r7-runtime-repair/identity-rebind.sql), wyłącznie deploymentId/source_ref tych samych dwóch knowledge_receivers i monotoniczne version+1. Bez ponownej instalacji SQL015/016, zmiany kont, aplikacji, 11 grantów operatora, kluczy lub terminów. Stosujemy już przyjęty przepis transakcyjnego SET roli właściciela: tylko własna krawędź OID139949, obie oryginalne krawędzie przywrócone i porównane przed COMMIT. Ten sam dziennik, nadal maksymalnie 24 transakcje łącznie do 24 listopada; dwie już zużyto, limit się nie zeruje.
- W Render: wdrożenie wyłącznie istniejących API/panelu srv-dbq6n2m7bikc73dmvs8g oraz Workera srv-dbq6njec6qcc738fjf50 w PROFITIA WORKSPACE. Zwykły manualny deploy dokładnego wybranego SHA, brak autoDeploy. Bez nowych usług, baz, kolejek, sekretów i dodatkowych konfiguracji normalnego uruchomienia. **Identity runtime pozostaje na Cfa w tej operacji**; ewentualny cudzy rollout pozostaje w jego osobnym mandacie i uzgodnionej kolejności.

Między atomowymi transakcjami dwóch baz a cutoverem obu usług możliwe jest krótkie, jawne fail-closed odrzucanie operacji przez stary kod z niezgodnym pinem. Nie oznaczamy wtedy gotowości jako PASS. Po obu deploymentach wymagamy rzeczywistych zgodnych bindingów, readiness oraz pełnego testu technologicznego. Odczyt lub wynik niepewny wymaga uzgodnienia rzeczywistego skutku przed ponowieniem; nie odtwarzamy zakończonych migracji.

Payload produktu SHA256: **a797ab4a3d30b2666eca8e07ab64efc52b591517640fb0a57dc079e3403e643a**. Payload centralny SHA256: **c5346b7b1cae28fe4f04aa35626e9044bd989854df3206414998a6d218059474**. Parametrami są wyłącznie końcowy zaakceptowany release SHA i jawny kierunek własnego odzyskiwania; nie dowolna treść SQL.

## Walidacja i rzeczywisty test

W Codespace: **23/23 PASS, 0 skip** na rzeczywistym PostgreSQL18.7/pgvector0.8.6 z osobnymi loginami API i Workera. Dokładne payloady powiązań: **12/12 PASS** w izolowanej bazie, obejmujące zmianę tylko dwóch wierszy, powrót, wersjonowanie oraz odmowę niewłaściwych parametrów. Centralny test payloadu używa dokładnego DDL odbiorcy z SQL015; nie zastępuje rzeczywistego E1 ani procedury właściciela. Pierwsze błędy odtwarzania syntetycznego fixture zachowano, bez przepisywania wyniku. Te próby nie są wymaganym kontrolowanym CI ani realnym E2E usług.

Po aktywacji wykonawca kontynuuje automatycznie import → prawdziwy Worker/OpenAI → zapis → publikacja → wyszukiwanie → rzeczywisty kontrakt CIC/adapter ACG/API → withdraw i cache, odmowy dostępu i nieaktualnego grantu, ledger, retencję, recovery oraz monitoring API/Workera i działający panel. Brak mocków jako zastępstwa tego testu.

Budżet **10 USD łącznie / 1 USD na dokument obejmuje już wydane 0,000508 USD**. Nowe próby użyją odrębnych identyfikatorów; trzy nieudane oryginalne zadania i ich historię zachowujemy. Usuwamy wyłącznie własne materiały testowe przez zwykłe autoryzowane operacje; nie zmieniamy ręcznie FAILED w READY. Zwykła sesja operatora pozostaje wymaganym źródłem autoryzacji, bez eksportowania JWT lub kluczy.

## Odzyskiwanie i kontynuacja

Aktualny własny stan poprzedni: API dep-dbv005d6e07s73aa20mg i Worker dep-dbuvu2etlv9c73fc63og, oba Cfa. Jest to zweryfikowany LIVE stan częściowy, nie zaakceptowane funkcjonalne LKG. Przed operacją odczytujemy ponownie jego dostępność oraz brak cudzego wydania.

Przy niepowodzeniu nowej wersji wolno wyłączyć kosztowne przetwarzanie przez PK_PROCESSING_ENABLED=false wyłącznie w tych dwóch usługach, rozstrzygnąć własne aktywne zadania, wykonać opisany odwrotny update dwóch powiązań i odbudować dokładne Cfa. Retencja może wtedy działać, ponieważ ograniczony SELECT(created_at) zostaje zachowany. Wersje centralnych odbiorców nadal rosną, nie cofamy historii. Bez restore bazy, usuwania danych, cofania cudzego deploymentu lub dotykania Identity runtime. Nie przedstawiamy tego jako odtworzenia sprawnej biblioteki.

Zachowujemy wcześniej zatwierdzoną alternatywę Render bez dostępnego digestu obrazu aplikacji: dokładny source/deploy ID, dostępność zachowanego buildu i wykonalna odbudowa, jawnie bez obietnicy identycznego binarnego OCI. Nie zastępujemy go digestem bazowego Node. Wykonawca prowadzi bieżący dziennik i niezależny readback; rutynowe poprawki samej obsługi odczytu/wyniku nie rozszerzają zatwierdzonych źródeł, SQL, uprawnień lub zasobów.

Po bezpośrednim GO dla R7 dalszy dozwolony zakres jest automatyczny, pod warunkiem przejścia kontroli. PMOS pozostaje RUNNING do faktycznego wyniku; końcowy PHR/MEMOROS i rozróżnienie kamienia milowego technicznego od formalnego Etapu 2/3 pozostają obowiązkowe.
