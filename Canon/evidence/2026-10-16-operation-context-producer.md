# Operation context — producent kandydata wykonawczego

Rozpoczęcie 16.10.2026; walidacja 17.10.2026. Task `ARCHITECTURE-OPERATION-CONTEXT-ENGINE-20261016`, profil ARCHITECTURE, workspace SG-dev Architecture, wykonanie lokalne, TARGET_ENVIRONMENT=development. Podstawa: odrębna instrukcja właściciela wykonania czterech etapów Full Autopilot po publikacji kontraktu w PR379. Ten dokument odbiera producenta, nie integracje aplikacji ani wdrożenie.

## Zakres i wersje

Źródłowy baseline main: `564f47cb96b1a7eaa6c35d7d35c994f52691ab65`. Istniejący pakiet `@profitia/platform-contracts` 1.1.0 dodaje eksport operation-context. Kontrakt `profitia.operation-context` 1.0.0, implementacja `1.0.0-candidate.1`. Dotychczasowy Development-context 1.0.0 i jego digest `7de5e2d709afad621f7f331069f99a71da7e3ad732f178b9742c58f56d55da56` pozostają niezmienione. Numer pakietu i numer dwóch kontraktów mają odrębne znaczenie.

Dziewięć jawnie zaimplementowanych reguł: account.settings.read/write, knowledge.read, benchmark.selection.read/write, personal.list.read/write, supplier.report.read/project. Pozostałe 21 operacji katalogu i nieznane operacje są odrzucane. Nie utworzono interpretera JSON ani osobnej usługi sieciowej. Kandydat jest celowo ograniczony do lokalnych odczytów i zapisów bez płatnego odświeżania.

## Granica wykonania

Host dostarcza zweryfikowaną tożsamość, aktualny model dostępu i produktu, zablokowany transakcyjnie stan zasobów, ograniczoną transakcję oraz kontrolę projekcji odpowiedzi. Klient nie dostarcza gotowego kontekstu, ALLOW, roli lub flagi verified. Executor wiąże niezmienny payload/digest, aktora, organizację, aplikację, środowisko, zasób i wersje. Dostęp produktu jest niezależny od prawa operacji; rola administratora sama nie nadaje prawa. Dane osobiste zachowują jednocześnie właściciela użytkownika i organizacji. ACCOUNT nie wymaga fikcyjnego tenanta. PORR wymaga stałego mapowania serwera; profil SI ma sufit funkcji.

supplier.report.project osobno wymaga prawa supplier.report.read i kontroli wszystkich wskazanych wspólnych wejść. Samo nazwanie starej funkcji readReportData nie czyni jej czystym odczytem. SERVICE zachowuje własną tożsamość i ograniczony grant; delegacja użytkownika, bootstrap, joby i billing nie są zaimplementowane i nie dostają domniemanego ALLOW.

Przed efektem wymagany jest niezależnie trwały INTENT. OUTCOME jest częścią tej samej transakcji co lokalny efekt; błąd projekcji lub audytu powoduje rollback i brak odpowiedzi z danymi. DENY/FAILURE zachowuje korelację bez payloadu i sekretów. Adapter musi rzeczywiście zapewnić deklarowaną trwałość, ograniczoną rolę, blokady aktualnych praw, zakres transakcji i append-only audyt. Unit test takiego interfejsu nie dowodzi jego realizacji w bazie aplikacji.

## Wykonana walidacja producenta

- 73 testy pakietu, laboratorium i dotychczasowych dwóch odbiorców: PASS, 0 skip. W tym 64 nowe testy wykonania i podpisanej syntetycznej tożsamości oraz 9 dotychczasowych kontroli.
- 25 testów governance, workspace i mostu: PASS, 0 skip.
- Build pakietu, kontrola składni, ścisłe sprawdzenie deklaracji TypeScript i git diff check: PASS.
- Testy obejmują każdą wspieraną regułę pozytywnie i z odmową; obcą organizację/użytkownika/zasób/aplikację/środowisko, podrobione nagłówki i podpis, wygaśnięcie, cofnięcie dostępu, jawne DENY, brak produktu/polityki/audytu, rollback przy błędzie OUTCOME/projekcji oraz zmianę payloadu podczas asynchronicznego wywołania.

Issuer w apps/architecture-lab używa losowego klucza wyłącznie w izolowanych testach. To nie jest dostawca logowania klientów. Zwykły profil demonstracyjny nie staje się indywidualnym użytkownikiem.

## Ochrona środowisk i ograniczenia

Przed mutacją: świeży main, czysta osobna gałąź, pełny preflight, canonical pmos:begin i require-begin PASS. Rejestracja `cmvbidcll000063avudirespy`, conversationId `pmos-task-v2:be2d2d969b17ae9d473bae43be41409dd3a81aa462589bf79e8016c46d12928d`, rzeczywisty hostConversationId `01a133c2-c245-77a0-bb6b-33165e2ad80c`. Routing wszystkich ośmiu targetów ALIGNED; zmiany TRANSITIONAL bez zmiany właścicieli. Publikacja i finalny PMOS/PHR są osobnymi, sprawdzanymi po wykonaniu faktami.

Odczyt Render potwierdził auto-deploy off dla czterech runtime SG2/SRM Development/Staging. Pozostałe automatyczne usługi SG-dev mają root/filtry poza zmienianymi ścieżkami. Zachowane punkty: SG2 Dev dep-daqd0uh42hec7398f5vg/c55c551091b3584673726bd0a78254eb091c7197; SG2 Stage dep-db0dhbm1egvs73f70kr0/48dfcd8af93fa9f5e9708653a868b89c138b6b91; SRM Dev dep-db97cj6k1f9s738na1r0 i Stage dep-db97qcjl550s73d2f170, oba 6eede5cd19fd3a4519d66298effe9ef94633757a. Nie wykonano deploymentu, zmiany sekretów, konfiguracji, domen ani produktu/baz Neon. Techniczne bazy laboratorium nie otrzymały schematów produktu.

Ten etap nie zamyka luk bezpieczeństwa wdrożonych aplikacji ani wszystkich 77 scenariuszy docelowego katalogu. Rzeczywiste API, zwykłe role bazy, RLS, izolacja puli, buildy i regresja biznesowa wymagają odrębnych zadań odbiorców SG2/SRM. Kandydat nie jest zgodą na ich migrację lub wydanie. Pełne logowanie, onboarding organizacji, zarządzanie rolami, Stripe, płatne pobrania, cache/eksport/kolejki i wdrożony SaaS pozostają poza tym odbiorem.
