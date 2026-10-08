# SRM Staging Readiness Report

Task: SRM-STAGING-READINESS-20261008. Profil SRM, TARGET_ENVIRONMENT=development, docelowa promocja staging. Data audytu 2026-10-08. Raport dotyczy przygotowania, nie autoryzacji wdrożenia.

## EXECUTIVE RESULT

STAGING_READY_TO_DEPLOY = NO. Wykonano i zweryfikowano bezpieczną część przygotowania A–F. Pierwszy onboarding środowiska RESERVED/NOT_ONBOARDED oraz obsługa zmiany provider baseline pozostają krytyczną brakującą implementacją. Nie przedstawiamy tych luk jako testów możliwych dopiero na działającym Staging. Operacje Staging/Production nie zostały wykonane.

## VERIFIED BASELINE

Authority: profitia/SG-dev (repository ID 1247665550), main. Weryfikowana baza main: 437aa3ddc5e132700b1da32abf5fc1ab201d660e (po integracji równoległego release PDF). Kod autorowany w izolowanym worktree /workspaces/srm-staging-readiness-20261008 w Codespace srm-pmos-activation-jjxx6vpp9v4x2q9vr, profil SG-dev Codespaces SRM. Oryginalny checkout oraz niezwiązane lokalne worktree zachowano.

Root AGENTS.md, governance manifest 3.6.0, wspólny Canon, registry środowisk, SRM adapter i aktywne dokumenty SRM załadowano. Wszystkie target paths należą do SRM Runtime / ALIGNED. Nie dodano wyjątków governance; MEMOROS pozostaje kanonicznie wyłączony. Pełny Development preflight z require-begin przechodzi przed zmianami. Stage preflight poprawnie odrzuca RESERVED.

## IMPLEMENTATION

- W istniejącym srm-ci.yml dodano wyłącznie ręczną ścieżkę workflow_dispatch: jawne SHA i YES, koszt owner, guard przed jobem przypisanym do GitHub environment. Push main/PR uruchamiają testy; nie promocję.
- Promotion CLI wymaga zaakceptowanego pełnego SHA, potwierdzenia main/CI i Development live, zgodności kontraktu i DDL, jawnej autoryzacji ograniczonej w czasie. Weryfikuje metadata GitHub/Render/Neon oraz faktyczny odczyt roli i organizacji bazy. Ponowienie rozpoznaje trwający lub działający deploy dokładnego SHA; nie przyjmuje nieznanego stanu.
- Osobny staging-migrate zachowuje istniejący Development migrator. Kontroluje projekt, branch, database, owner/direct TLS URL, checksums, kolejność ledger i transakcję. Inicjalizację roli, schematu i syntetycznej organizacji wykonuje atomowo tylko po przyszłej autoryzacji i pełnym preflight. Nie tworzy teraz bazy Neon ani usług.
- Równoległy release PDF z main zintegrowano bez utraty zmian; eksport KYS korzysta również z własnej organizacji i sesji Staging, z testem odrzucenia Development token i niewłaściwego branchu.
- Runtime odrzuca cross-environment host/database/role/query override oraz Production. Stage wymaga własnej organizacji; nie korzysta z Development fallback. Development zachowuje bieżącą konfigurację.
- Pozostaje ten sam model aplikacji i provider-managed Render. Nie zastosowano render.yaml ani mechanizmów SG2. Nie powstała osobna linia rozwoju Staging.

Pełna macierz: [environment-dependency-matrix.md](environment-dependency-matrix.md). Baza: [database-promotion-contract.md](database-promotion-contract.md). Kontrakt Render: [staging-contract.json](staging-contract.json). Instrukcja: [staging-promotion-runbook.md](staging-promotion-runbook.md). Dowody: [validation-evidence.json](validation-evidence.json).

## GIT EVIDENCE

Branch przygotowania: chore/srm-staging-readiness-20261008. Checkpointy: 9ef47a2, b0b5112, 91b98f8. PR: https://github.com/profitia/SG-dev/pull/148. Dalsze checkpointy: 3ab915f, 5bd8156. Finalne CI, merge SHA i publikacja PHR są zapisywane w końcowym handoff oraz kanonicznym Development Flight Record po publikacji. Ten raport nie deklaruje przyszłego merge ani nie przypisuje sobie własnego końcowego SHA.

## DATABASE EVIDENCE

Produkt Neon: snowy-breeze-40315151. Development br-dark-surf-b1vrhda9 ma srm_app, 11 migracji w ledger zgodnych ze źródłem, schematy public/srm, plpgsql, 15 tabel produktowych FORCE RLS oraz runtime role srm_app_runtime bez superuser/BYPASSRLS. Odczyt katalogu i checksums był read-only.

Staging br-broad-butterfly-b11t4v01 ma tylko neondb; brak srm_app i roli runtime. Endpoint ep-autumn-wildflower-b1mv0vda jest istniejącym zasobem, nie onboardingiem aplikacji. Production br-nameless-bar-b1wlhjhx jest protected; sprawdzono wyłącznie metadata. Nie wykonano zapisów do żadnej produktowej bazy Neon. Zapisy continuity dotyczą wyłącznie osobnego projektu bold-breeze-68888550 / srm_pmos (SRM Development), nigdy SG2/CIC.

## RENDER EVIDENCE

Workspace tea-d7lps8rbc2fs73cn80dg, projekt prj-dapbd3hsrm7s73es53fg. Development srv-db1vu6gm7kps73d0e3r0 ma main, Node, Frankfurt, plan 0.5c-512mb, jedną instancję, health /api/health i autoDeploy off. Aktualny odczyt live deploy dep-db3t3s2jnfac73ao9pkg zawiera SHA 437aa3ddc5e132700b1da32abf5fc1ab201d660e; nie jest stałym przyszłym release target.

Staging environment evm-dapbdbbbc2fs73f4g7gg nie ma usługi SRM. Kontrakt przygotowano bez jej utworzenia, bez domen/DNS i sekretów. Cena Compute odczytana w Dashboard: 7 USD/miesiąc dla wybranego planu. Koszt Neon zależy od taryfy i czasu aktywnego compute; obecny istniejący Stage endpoint ma suspend_timeout=-1. Nie zmieniono jego kosztu ani konfiguracji. Koszt owner zatwierdza przyszły budżet przed aktywacją.

## VALIDATION

189 testów SRM, 64 testy promotion/migration na realnym localhost PostgreSQL (zero skip), 36 testów governance/routing PASS. Typecheck, jednostkowe testy SRM, governance manifest, routing/governance regression i build wykonano. Promotion test suite ma odrębny rzeczywisty test PostgreSQL 16, uruchamiany na disposable lokalnym srm_migration_test, nigdy Neon. Sprawdza komplet 11 DDL, retry zero pending, checksums drift, RLS/tenant isolation oraz rollback transakcji po rzeczywistym błędzie SQL (bez pozostawionej roli/schematu). Szczegółowe liczniki i zakresy znajdują się w validation-evidence.json.

Zbudowana aplikacja uruchomiona na localhost w Codespace z syntetycznym hasłem i bez poświadczeń providerów/bazy: health Stage PASS, API bez sesji 401, błędne hasło odrzucone, poprawne hasło wydaje Secure/HttpOnly cookie, strona z sesją 200, logo i Next static asset 200, API przy brakującym bindingu bazy 503. To symulacja, nie deployment Staging.

## RELEASE MECHANISM

Symulacja offline: npm --prefix apps/srm run promote:staging -- --simulate. Plan rzeczywistych metadata: promote:staging -- --plan --sha <approved40hexSHA>. Pełny kontrakt argumentów i przyszły workflow_dispatch opisuje runbook. Obecnie future apply jest blokowany na S0; nie można uzyskać gotowości przez samo wpisanie ACTIVE do registry.

## GOVERNANCE & CONTINUITY

Development PMOS registration cmuzqa7rt00001hsbdqitngvf, conversationId pmos-task-v2:f600081a7b6e8a43ae49d51d79945fbdf8e2344109a08a4c09efaeae63338c3b, hostConversationId 01a11c3a-6570-7292-99b4-5666c5a2496b. Canonical closeout i PHR należą do Development i zapisują PARTIAL_SUCCESS z brakującym S0. Nie wykonuje się Staging PMOS/PHR. MEMOROS disabled nie ma env override.

## ROLLBACK

Schema initialization/updates mają transakcję i ledger. Nie cofa się SQL ani nie resetuje branchy Neon. Code rollback wymaga konkretnego poprzedniego SHA oraz jawnego rollbackSchemaCompatible; aktualny ledger musi w całości zgadzać się z tym SHA (zero pending i zero unknown). Odrzucany jest stary kod sprzed guardów lub innego DDL. Render deploy używa commitId; deactivated deploy nie jest uznawany za obecny live. Symulacyjny rollback plan i SQL rollback przetestowano; provider rollback Staging wymaga aktywnego środowiska i pozostaje DEPLOYMENT_TIME_PENDING.

## REMAINING RISKS / BLOCKERS

1. S0 first onboarding: współdzielony fail-closed Canon i comparator wymagają ACTIVE/VERIFIED oraz istniejącego zarejestrowanego provider baseline przed mutacją. Brakuje legalnej, wąsko ograniczonej procedury RESERVED → kontrolowany provisioning → VERIFIED, z etapowymi snapshotami i bez aktywacji w tasku przygotowania.
2. Exact first-source: Render create-service uruchamia pierwszy deploy dla branch; API tego kroku nie przyjmuje commitId. Istniejąca usługa przyjmuje commitId dla kolejnych deploymentów. Pierwszy serwis potrzebuje sprawdzonego immutable artifact albo kontrolowanego, niezmiennego release pointer. Tego nie zaimplementowano. Samo main + późniejszy redeploy nie gwarantuje pierwszego SHA.
3. Provider baseline reconciliation po poprawnej promocji: brakuje kanonicznego mechanizmu aktualizacji oczekiwanego deployed SHA/deployId i verified snapshot. Ręczne wpisanie wartości lub wyłączenie porównania obniżyłoby governance.

Rozwiązanie wymaga SRM Runtime wraz z właścicielem wspólnego Profitia Governance lifecycle. Wszystkie te luki trzeba zaimplementować i przetestować przed uznaniem przyszłej jednej komendy za gotową. Nie są to nieznane wymagania aplikacji, tylko znane brakujące mechanizmy kontrolowanego uruchomienia.

## FINAL DECISION

STAGING_READY_TO_DEPLOY = NO
STAGING_DEPLOYMENT_AUTHORIZED = NO
STAGING_DEPLOYED = NO
STAGING_DATABASE_MUTATED = NO
PRODUCTION_MUTATED = NO
DEVELOPMENT_NON_REGRESSION = PASS (testy przygotowania; bieżący publiczny runtime i eventual Development release w final handoff)
GOVERNANCE = PASS (Development; oczekiwany Stage rejection)
PROMOTION_DRY_RUN = PASS (symulacja, bez provider writes)
DATABASE_MIGRATION_READINESS = PASS
RENDER_DEPLOYMENT_READINESS = FAIL (S0 / pierwszy pinned deploy)
AUTHENTICATION_READINESS = PASS (kod i rzeczywisty localhost smoke)
ENVIRONMENT_ISOLATION = PASS
RELEASE_PROVENANCE = FAIL (pierwszy service-create; kontrola SHA istniejącego serwisu przetestowana)

PENDING_DEPLOYMENT_TIME_CHECKS = [Stage live health/TLS/UI, real credentials and supplier API entitlement, real Neon runtime role and RLS, authenticated persistence smoke, exact live SHA, code rollback compatibility, actual approved costs]
BLOCKERS = [S0 legal onboarding, pinned first service source, canonical provider baseline reconciliation]

Status przygotowania: bezpieczne artefakty opublikowane; pełny cel jednej komendy nieosiągnięty. Staging i Production pozostają poza zakresem mutacji.
