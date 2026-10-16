# Kontekst operacji — stan odbioru przyrostu i bloker SG2

Data: 17.10.2026, Europe/Warsaw. Stan dowodów: po publikacji SRM przez PR #385, warunku CI przez PR #386 i snapshotu przez PR #387. **PARTIAL — cały plan czterech etapów nie jest zakończony.** Końcowe sprostowanie bezpieczeństwa wycofuje rekomendację bezpośredniego Read dla publicznego SG-dev. Dokument stanowi datowany zapis wykonania, nie nową zgodę na wdrożenie produktu ani potwierdzenie realizacji całych E0–E4.

## Zakres i tożsamość

Właściciel zlecił Full Autopilot: wspólny mechanizm ARCHITECTURE, osobne przyjęcia SG2/SRM w izolowanych uruchomieniach istniejącego kodu, testy API/persystencji/regresji/buildów oraz odbiór z PMOS/PHR. TARGET_ENVIRONMENT=development; miejsce wykonania: odrębne lokalne przestrzenie i GitHub Actions. Nie zlecono aktywacji nowego modelu w istniejących usługach Development/Staging/Production, migracji ich danych, tworzenia projektów/repozytoriów, płatnych pobrań, domen ani Stripe.

Rzeczywisty hostConversationId: `01a133c2-c245-77a0-bb6b-33165e2ad80c`. PMOS wyprowadził osobne conversationId. Zadania i historie pozostają rozdzielone:

| Profil | taskId | Stan tego zapisu |
| --- | --- | --- |
| ARCHITECTURE | ARCHITECTURE-OPERATION-CONTEXT-ENGINE-20261016 | Producent początkowy zakończony; canonical PMOS/PHR niezależnie potwierdzone. |
| ARCHITECTURE | ARCHITECTURE-OPERATION-INTEGRATION-ACCEPTANCE-20261017 | PARTIAL_SUCCESS utrwalony w PMOS/PHR; odbiór całego programu wstrzymany. |
| SG2 | SG2-OPERATION-CONTEXT-INTEGRATION-20261017 | PARTIAL_SUCCESS utrwalony w PMOS/MEMOROS/PHR; kod w PR #384, brak odbioru czystej instalacji CI. |
| SRM | SRM-OPERATION-CONTEXT-INTEGRATION-20261017 | Przyjęcie izolowane zakończone przez PR #385; canonical PMOS/PHR niezależnie potwierdzone. |
| ARCHITECTURE | ARCHITECTURE-OPERATION-CONTEXT-PACKAGE-ACCESS-REVIEW-20261017 | Osobne sprostowanie zalecenia dostępu; nie otwiera ukończonej historii ani nie nadaje uprawnień. |

Dla ARCHITECTURE użyto architecture_pmos i rzeczywistej ordinary roli architecture_pmos_runtime; dla SRM wyłącznie srm_pmos, dla SG2 jego zarejestrowanej bazy PMOS. Nie użyto bazy produktu jako PMOS ani raportowania CIC. MEMOROS: disabled z profilu ARCHITECTURE/SRM; SG2 wymaga własnej publikacji, której ten zapis nie deklaruje.

Po publikacji pierwszego snapshotu wykonanie SG2 i koordynacji zamknięto kanonicznie jako **PARTIAL_SUCCESS**, z blokerem i zakresem niewykonanej walidacji. Stan completed/CLOSEOUT_COMPLETE oznacza zakończenie zapisu i wymaganych publikacji tego częściowego wyniku; nie oznacza przyjęcia integracji ani zakończenia programu. Niezależnie potwierdzono PHR SG2 `6afc4978657548f792c70aba13ebfc7c5fea2a3b` i ARCHITECTURE `7b66838dccaf141b9f48714415a3da7ebbd37aa6`, integralność archiwów, zwolnienie slotów/blokad oraz SG2 MEMOROS DELIVERED. Sprostowanie zalecenia ma nowy task i własny późniejszy closeout; poprzednie historie pozostają zachowane. Kontynuacja otrzyma nowe taskId i referencje do tych historii, nie otwiera ponownie ukończonych rekordów.

## Wynik etapów

| Etap | Potwierdzony rezultat | Granica |
| --- | --- | --- |
| Wspólny mechanizm | Jeden executor w istniejącym packages/platform-contracts; pozytywne/negatywne testy, rzeczywisty ograniczony PostgreSQL, trwały audyt. | Kandydat o jawnym zakresie, bez produkcyjnego dostawcy tożsamości. |
| Osobne integracje | SG2: prawdziwy handler/usługa/repozytorium benchmarków w izolacji. SRM: prawdziwy reportDataHandler/readReportData, projekcja i zapis we wspólnej transakcji. | SRM przyjęte; SG2 PR otwarty z blokerem CI. Dotychczasowe opublikowane trasy nadal używają wcześniejszych granic. |
| Weryfikacja | Testy dwóch organizacji/użytkowników, aktualnych praw i produktu, niewłaściwego kontekstu, ograniczonej roli, RLS, puli, audytu i rollbacku. SRM ma pełny pozytywny CI. | SG2 lokalne testy/build PASS, czysta instalacja CI FAIL; nie zastąpiono jej lokalnym cache. |
| Poprawki i odbiór | Poprawiono współpracę Next/tsx/ESM, rozpoznawanie odmów, blokady rekordów i komplet audytu; osobny closeout producenta i SRM. | Cały plan, końcowy odbiór SG2 i odbiór koordynacji pozostają niezakończone. Częściowy closeout zapisuje bloker, nie nadaje odbioru. |

## Kontrakt i rzeczywiste zachowanie

Kontrakt `profitia.operation-context` 1.0.0, implementacja `1.0.0-candidate.3`, pakiet 1.1.3. Digest SHA-256 implementacji i deklaracji: `e37a11798ed41b1c0a30f2ac3b539c6d19db59246c8ceae94005afeb10a08455`. Przyjęcia wskazują producenta PR #383/main `ea06cd05df9168c01b7621baf6724bc04b74b760`; historia pierwszego producenta PR #380 pozostaje odrębna. Dotychczasowy Development-context 1.0.0 i jego digest `7de5e2d709afad621f7f331069f99a71da7e3ad732f178b9742c58f56d55da56` pozostały zgodne z oboma odbiorcami.

Executor łączy zweryfikowaną przez zaufanego hosta tożsamość, organizację lub konto, aplikację/profil/środowisko, konkretną operację, aktualne prawo, osobny dostęp produktu oraz klasę i właściciela zasobu. Body/nagłówki od klienta nie stanowią dowodu weryfikacji. Etykieta administratora sama nie nadaje prawa. Zakres osobisty wymaga właściwego aktora; wspólne źródła rynkowe pozostają wspólne, prywatne przypisania i projekcje otrzymują właściwy zakres. Wycofane członkostwo lub produkt są odrzucane w kolejnym wywołaniu.

Dziewięć jawnie obsługiwanych operacji: account.settings.read/write, knowledge.read, benchmark.selection.read/write, personal.list.read/write, supplier.report.read/project. Pozostałe 21 reguł macierzy nie otrzymuje ALLOW. Delegacja, zadania asynchroniczne, płatne pobrania, eksport, rezerwacje limitów, billing i wsparcie nie zostały dodane przez domniemanie. Nie powstał interpreter dowolnej polityki JSON ani nowy runtime.

Host zapewnia ograniczoną transakcję i aktualne zablokowane rekordy polityki/zasobów. INTENT musi zostać trwale zapisany przed efektem; OUTCOME jest atomowy z zapisem biznesowym; błąd audytu powoduje odmowę lub rollback. Niezależne DENY/FAILURE pozostają dostępne. Audyt zawiera kontrakt/implementację, czasy UTC operacji i fazy, referencję dowodu tożsamości, aktora/organizację, aplikację/środowisko, operację, źródło i wersję prawa oraz produktu, klasę/właściciela/wersję zasobu i politykę użycia. Surowe payloady, tokeny i dane prywatne nie są treścią tego raportu.

Fixture PostgreSQL ma tylko dane syntetyczne, transakcyjne ustawienia kontekstu, zwykłe role bez SUPERUSER/BYPASSRLS oraz ograniczone prawa do audytu i polityki. Sam fakt istnienia fixture nie jest migracją docelowych tabel kont, członkostw, praw lub RLS produktu. Tymczasowe klastry lokalne i kontenery CI nie stanowią nowych projektów Neon.

## Dowody odbiorców

### SRM — przyjęcie zakończone w izolacji

[PR #385](https://github.com/profitia/SG-dev/pull/385), source `872ca2996fe16ebcb54f94ca5f9f55cf54c9e887`, merge `ee9c5ccce878f4292f1dfb22088949edc4d1a4b3`. Osobna capability serwera wiąże istniejący withOrganization z transakcją executora i dokładną organizacją; nie wykonuje zagnieżdżonego COMMIT. Zwykła dotychczasowa ścieżka pool zachowuje własny BEGIN/COMMIT/ROLLBACK. supplier.report.project wymaga także supplier.report.read; odtwarzanie dokumentów jest operacją mogącą zapisywać dane.

- 14 nowych testów integracji/przyjęcia: PASS, 0 skip. Rzeczywisty handler Request/Response, readReportData, odtworzenie dokumentów i PostgreSQL, w tym wycofanie praw/produktu i rollback rzeczywistego INSERT przy awarii OUTCOME.
- [Standard SRM CI](https://github.com/profitia/SG-dev/actions/runs/38978246151): 464 testy aplikacji, 311 testów promocji, 165 wspólnych testów governance — PASS, 0 skip; czysta instalacja, typecheck i build PASS.
- [Platform CI](https://github.com/profitia/SG-dev/actions/runs/38978246154): faktyczne kroki SRM instalacji, 14 testów, typecheck/build i publikacja operation-context-SRM wykonane. validationSha `771db5ad1904ed84ace327958a919b6f54a0a6a6`, candidateHeadSha zgodny z source PR; artefakt jawnie ma productDeploymentPerformed:false i customerIdentityAdapterVerified:false.
- Merged-main [Platform CI](https://github.com/profitia/SG-dev/actions/runs/38978736766), [SRM CI](https://github.com/profitia/SG-dev/actions/runs/38978736735) i governance 38978736654: SUCCESS na merge SHA.
- PMOS: completed/CLOSEOUT_COMPLETE, archiwum PASS, trail PRESENT, save/context/handoff SUCCEEDED, pending slot i blokada zwolnione. PHR commit `1a3264ecdf54678d0ca982b05a6db5cd749a4f97` niezależnie potwierdzony jako ancestor zdalnego main. MEMOROS_DISABLED_BY_PROJECT_PROFILE nie jest publikacją Memoros.

Lokalna istniejąca regresja miała 457 PASS i 7 zależnych od bazy SKIP z 464 testów. Chmurowy CI niezależnie wykonał pełne 464 bez pominięć. Wszystkie 18 istniejących migracji i obliczenia finansowe zachowano. Nie wykonano przeglądarkowego UAT ani aktywacji nowego adaptera w Render.

### SG2 — lokalnie potwierdzone, odbiór CI wstrzymany

[PR #384](https://github.com/profitia/SG-dev/pull/384), source `bcf4dbcbcfbaf2e2de0b7c50bf5824c6df57a48f`, pozostaje otwarty. Ten sam handler wyboru benchmarków korzysta z istniejącej usługi i repozytorium; nowy jawny adapter może przekazać ograniczoną Prisma.TransactionClient. Domyślne withCognitionAuth zachowano. Nie przepięto produkcyjnej bazy ani obecnych tras na nowy model.

- 14 nowych testów: PASS, 0 skip; 44 wybrane istniejące testy regresji: PASS, 0 skip; lokalny typecheck/build: PASS. Wykazano rzeczywiste odczyty/zapisy, odmowę obcej organizacji i niedozwolonych referencji, brak praw zapisu roli odczytowej, separację osobistą, błędny kontekst, revocation oraz rollback przy awarii audytu.
- Instalacja prywatnych zależności lokalnie korzystała z odrębnej kopii istniejącej instalacji tego profilu. Wersje i hashe drzewa potwierdzono; nie użyto współdzielonego node_modules. To nie dowodzi odtwarzalnej czystej instalacji.
- [Platform CI](https://github.com/profitia/SG-dev/actions/runs/38978235442), job SG2 operation integration: **FAIL przy npm ci**, `403 read_package` dla @profitia/cic-procurement. Kroki rzeczywistych nowych testów i buildu SG2 w tym uruchomieniu nie stanowią PASS.
- Odczyt ustawień GitHub Packages potwierdził, że Manage Actions access dla @profitia/cic-procurement, @profitia/cic-core i @profitia/advisory-widget zawiera tylko conversational-intelligence-core jako Admin; nie zawiera SG-dev. Pakiety są Private. Nie zmieniono widoczności, praw ani sekretów.

Nowy błąd dotyczy dostępu GitHub Packages; nie jest błędem Render RENDER_API_KEY/401 z historycznej promocji. Nie ponowiono jednorazowego historycznego odczytu NPM_TOKEN z Render. Nie podmieniono zależności, nie podniesiono ich do najnowszych wersji i nie osłabiono instalacji/testów, aby ominąć odmowę.

## CI i wersjonowanie dowodów

[PR #386](https://github.com/profitia/SG-dev/pull/386), source `4e6726b59a817f6f19600f20a377e9ab589918ee`, merge `cc9aca6607ffd1b275bc19c3c9d1fe2243637334`, dodaje warunek joba z packages:read: push/manual oraz PR ze źródła we własnym repozytorium. W niezmienionym workflow forki zachowują publiczne testy producenta i dotychczasowych kontraktów. **Ten warunek nie jest niezależną granicą bezpieczeństwa dostępu do pakietów**, ponieważ źródło PR może zmienić workflow. [CI poprawki](https://github.com/profitia/SG-dev/actions/runs/38979017242): SUCCESS; 25 lokalnych testów governance/workspace/bridge PASS. Poprawka nie nadaje sama praw do pakietów i nie dowodzi izolacji wobec zmodyfikowanego workflow z forka.

Zielony job operation integration bez operation-integration.json oznacza brak przyjęcia i pominięte kroki aplikacji, nie dowód działania integracji. Dotyczy m.in. SG2 na źródle PR #385/#386 oraz SRM na źródle PR #384. Odbiór wymaga dowodu faktycznie wykonanych kroków właściwego odbiorcy, dokładnego candidate SHA i validation SHA. CI odrębnych PR nie dowodzi jeszcze wspólnego końcowego main z oboma przyjęciami.

## Publikacje producenta i poprawki

| PR | Merge SHA | Zakres |
| --- | --- | --- |
| [#380](https://github.com/profitia/SG-dev/pull/380) | dde7d08262c693df7c86e0a8f16c6bcb95512f92 | Pierwszy executor, testy i ograniczenia kandydata1. |
| [#381](https://github.com/profitia/SG-dev/pull/381) | fbf2a0c8b8edcd27aa52838c485bb1eeb0b9bb94 | Wspólna ograniczona fixture PostgreSQL i rzeczywisty audyt. |
| [#382](https://github.com/profitia/SG-dev/pull/382) | 52eda56757e48ffe942629767222981cd1c76fbd | Rzeczywista zgodność modułów Next/tsx i joby odbiorców. |
| [#383](https://github.com/profitia/SG-dev/pull/383) | ea06cd05df9168c01b7621baf6724bc04b74b760 | Kandydat3, komplet dowodów audytu i pełna historia źródeł w CI. |

Końcowy zestaw producenta/laboratorium/dotychczasowych odbiorców: 78 PASS, 0 skip, z rzeczywistym PostgreSQL; osobno governance/workspace/bridge 25 PASS, 0 skip. Są to konkretne zestawy testów, nie 78 zrealizowanych wymagań macierzy ani pełny odbiór SaaS. Początkowy producent ma odrębnie zweryfikowany PHR commit `24812ecbc4f779db486fdf917aafc829455c6eb7`; późniejsze poprawki należą do zadania koordynacji, nie zmieniają ukończonej historii producenta.

## Zachowanie działających środowisk

Ponowny odczyt Render po publikacjach wykazał identyczne konfiguracje czterech usług i autoDeploy=off. Odczyt /api/health każdej usługi zwrócił status ok i właściwe development/staging. Wszystkie poniższe wdrożenia pozostały LIVE:

| Produkt / środowisko | Usługa | Wdrożenie | Source SHA |
| --- | --- | --- | --- |
| SG2 Development | srv-dapa3tid0e5s73f8bc5g | dep-daqd0uh42hec7398f5vg | c55c551091b3584673726bd0a78254eb091c7197 |
| SG2 Staging | srv-daclno3m8hqs73bb7rrg | dep-db0dhbm1egvs73f70kr0 | 48dfcd8af93fa9f5e9708653a868b89c138b6b91 |
| SRM Development | srv-db1vu6gm7kps73d0e3r0 | dep-db97cj6k1f9s738na1r0 | 6eede5cd19fd3a4519d66298effe9ef94633757a |
| SRM Staging | srv-db496b3tqb8s73eh5sfg | dep-db97qcjl550s73d2f170 | 6eede5cd19fd3a4519d66298effe9ef94633757a |

Nie wykonano deploymentu, zmiany konfiguracji, schematu lub danych tych środowisk. Merge kodu nie jest aktywacją modelu kont/organizacji. Zachowano istniejące checkouty developmentu biznesowego. Health i identyczny deployment są dowodem ciągłości tych usług; nie są pełnym testem wszystkich funkcji biznesowych.

## Bloker i warunek kontynuacji

**BLOCKER: czysta instalacja SG2 w GitHub Actions nie ma zatwierdzonego i zweryfikowanego bezpiecznego sposobu dostępu do wymaganych prywatnych pakietów.** Obserwowany błąd to 403 read_package. Kontrakt Full Autopilot wymaga decyzji właściciela przy nowej, nieprzewidzianej zmianie dostępu do infrastruktury.

Końcowy odczyt GitHub potwierdził visibility=PUBLIC dla SG-dev. [Oficjalna dokumentacja GitHub Packages](https://docs.github.com/en/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions) ostrzega, że przy nadaniu publicznemu repozytorium dostępu do prywatnych pakietów również forki mogą uzyskać do nich dostęp. [Dokumentacja ustawień Actions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) wyjaśnia możliwość proponowania zmian workflow przez fork. Wniosek: warunek joba z PR #386 sam nie uzasadnia twierdzenia, że pakiety będą dostępne wyłącznie zaufanym źródłom. Nie przeprowadzono próby wykorzystania takiego dostępu i nie stwierdzono wycieku; **żaden grant nie został wykonany**.

Wcześniejsze zalecenie bezpośredniego Manage Actions access → Read dla SG-dev oraz wystawione pytanie w tej postaci są **wycofane**. Nie należy wykonywać tego grantu na podstawie wcześniejszego snapshotu lub odpowiedzi na stare pytanie. Zachowane częściowe rekordy PMOS/PHR dokumentują wcześniejsze rozpoznanie; to sprostowanie je uzupełnia, nie przepisuje historii.

Rekomendowana dalsza decyzja dotyczy kontrolowanej autoryzacji instalacji, w której prywatne pakiety i poświadczenia nie są dostępne dla niezaufanego kodu/workflow z forków. Możliwe są osobno ocenione, ograniczone poświadczenie dla zaufanej walidacji albo prywatny tor walidacji. Konkretne źródło, zakres, przechowywanie, dopuszczone uruchomienia i negatywne testy dostępu wymagają dopracowania i akceptacji przed zmianą uprawnień lub sekretów. Nie utworzono credentiali ani nowego repozytorium/projektu; ewentualne nowe repozytorium tworzy właściciel według uzgodnionej instrukcji. Bezpośredni grant do publicznego repozytorium nie jest domyślną rekomendacją.

Po zaakceptowaniu bezpiecznego modelu pozostają w już zleconym zakresie: uzgodnienie PR #384 z aktualnym main, czysta instalacja i realne testy/buildy SG2 w CI, jego odbiór/merge i osobny PMOS/MEMOROS/PHR nowego wykonania, wspólna walidacja dokładnego końcowego main oraz finalny odbiór ARCHITECTURE. To sprostowanie nie zatwierdza tworzenia zasobów ani nie nadaje tym czynnościom statusu wykonanych.

## Odstępstwa i chronologia governance

- Rzeczywiste testy ujawniły odmienną tożsamość klasy odmowy po załadowaniu ESM/CJS przez tsx. Naprawiono jeden wspólny mechanizm rozpoznawania błędu; nie zamieniono oczekiwanej odmowy403 na dopuszczalne503. Ujawniono także konieczne prawa blokowania rekordów PostgreSQL; ograniczono je do technicznej kolumny, bez prawa modyfikacji polityki JSON.
- Przed rozszerzeniem zmian koordynacji z czterech do dziewięciu dokładnych ścieżek ponowiono routing/preflight. Nie zinterpretowano poprawki kontraktu jako automatycznego przyjęcia przez produkt.
- Przy publikacji trzech linii granicy CI początkowy czysty preflight przed edycją był PASS. Dodatkowy preflight po edycji zwrócił CODE_STATE_GATE=BLOCKED z dirty=true, lecz wadliwie połączone polecenia wykonały mimo tego commit/push `4e6726b59a817f6f19600f20a377e9ab589918ee`. To błąd wykonania fail-closed, nie legalne przejście bramki. Wstrzymano dalsze mutacje; na czystym opublikowanym źródle niezależnie ponowiono pełne bramki, PASS, i sprawdzono dokładny zakres jednej ścieżki. Przed merge ponowiono świeży PASS i CI. Późniejszy PASS nie zmienia wcześniejszej chronologii. Kolejne sekwencje przerywają się przy błędzie.
- Własne pliki wygenerowane przez build zachowano w recovery i przywrócono wyłącznie własne różnice; cudzej pracy nie resetowano. Lokalna próba HTTPS przez Python nie znalazła lokalnego CA; niezależny odczyt systemowym klientem z pełną weryfikacją TLS potwierdził cztery health ok. Nie wyłączono kontroli certyfikatów.

## Dalszy stan docelowy — poza odbiorem tego przyrostu

Nadal potrzebne są osobno zatwierdzone zadania realnego dostawcy tożsamości, kont/organizacji/członkostw i zarządzania prawami, autorytatywnego dostępu produktu, docelowych baz/polityk RLS i migracji, pozostałych operacji macierzy, jobs/cache/export/usage/billing oraz kontrolowanej aktywacji i biznesowego UAT. Dopiero ich rzeczywiste dowody mogą potwierdzić gotowość PORR, stand-alone Supplier Intelligence lub pełnego SaaS. Żadna z tych aplikacji nie została ogłoszona gotową przez same testy laboratorium.
