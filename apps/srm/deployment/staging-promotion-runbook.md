# SRM — Staging Promotion Runbook

Task SRM-STAGING-READINESS-20261008. Stan: przygotowanie mechanizmu, bez prawa wdrażania w tym tasku. **STAGING_READY_TO_DEPLOY=NO: S0 i bezpieczne przejście baseline wymagają odrębnego kanonicznego rozstrzygnięcia.** Nie uruchamiać workflow dispatch YES teraz.

## Prerequisites i bramka S0

1. Repo profitia/SG-dev, main, profil SRM. Root AGENTS, aktywny manifest, Profitia Governance Canon, adapter SRM i ownership exact targets; świeży origin/main, pełny preflight. Kod mechanizmu musi być dokładnie reviewed origin/main, niezależnie od wybranego starszego release SHA.
2. Odrębne jawne polecenie wdrożenia Staging, dokładny zaakceptowany Development SHA, cost owner i uprawnienia do istniejącego Render/Neon projektu SRM. Production pozostaje wyłączone. Nie tworzyć SRM PMOS/PHR dla zadania Staging; nie dostarczać PMOS credentials do produktu/jobów.
3. S0: Staging nadal RESERVED/NOT_ONBOARDED. Nie ma srm-staging GitHub environment, Render runtime ani srm_app. Obecny full preflight zabrania inactive target i wymaga live zarejestrowanego baseline. Obecny proces celowo nie tworzy tych zasobów i nie ustawia ACTIVE bez dowodów. To bloker implementacji kompletnego pierwszego wdrożenia.
4. Rozstrzygnięcie S0 należy do właścicieli Profitia Governance i SRM Runtime: przygotować i przetestować w Development osobny, wąski kontrakt pierwszego onboardingu, z etapami provisioning/baseline reconciliation i niezależną walidacją exact IDs. Zachować wszystkie dotychczasowe blokady dla zwykłych RESERVED/Production tasków. Zmiana polityki wymaga właściwego manifestu/routingu/negative tests i review; nie wykonywać jej jako ad-hoc override env.
5. Pierwszy Render create automatycznie rozpoczyna initial deploy. API create service przyjmuje branch, a nie explicit commitId. Zwykłe utworzenie z ruchomego main nie spełnia gwarancji source SHA. Przed provisionowaniem właściciel musi przyjąć i przetestować jedno rozwiązanie: immutable artifact/image wskazany digestem albo zweryfikowany, czasowy release pointer do zaakceptowanego SHA oraz kontrolowane przejście na main z autoDeploy off. Release pointer nie może stać się osobną linią rozwoju. Nie twierdzimy, że rozwiązanie to jest już zaimplementowane w obecnym tasku. Źródła API: [create service](https://api-docs.render.com/reference/create-service), [explicit commit deploy](https://api-docs.render.com/reference/create-deploy).
6. Legalny S0 dopiero po osobnej autoryzacji powinien: potwierdzić branch Neon exact ID; utworzyć wyłącznie brakujące srm_app; ustalić database ID/owner; skonfigurować osobne sekrety i GitHub srm-staging z required reviewers i deployment branch main; utworzyć exact-source Render runtime z kontraktu, bez domen; potwierdzić live/health/auth; zarejestrować zweryfikowany baseline. Po dopuszczeniu full preflight zainicjalizować role/schema/organization przygotowanym kodem. Nie resetować Neon, nie kopiować records, nie obchodzić preflightu.
7. W tym samym kontrakcie należy rozwiązać publikację nowego baseline po każdej promocji/rollbacku. Obecny comparator wymaga zgodności z zapisanym baselineSha/baselineDeployId. Mechanizm produkuje evidence, ale celowo nie modyfikuje automatycznie wspólnego registry ani nie akceptuje driftu. Bez legalnego reconciliation po deploy kolejne uruchomienie zostanie zablokowane. To drugi aspekt tego samego krytycznego S0/lifecycle blokera.
8. Dopiero gdy te punkty są zaimplementowane i przetestowane, można zmienić readiness na YES. Nie oznaczać braku tej implementacji jako zwykłego live smoke DEPLOYMENT_TIME_PENDING.

## Release candidate selection

Odczytać aktualny live Development deploy, pełny 40-znakowy SHA i GitHub main/checks. Użytkownik akceptuje konkretną wersję w ramach polecenia promocji. Nie wybierać automatycznie nowego main. Żądać SHA obecnego na main, przechodzącego najnowszy srm-build dla tego SHA i live w srv-db1vu6gm7kps73d0e3r0. Wybrany release musi zawierać staging runtime capability i ten sam DDL/kontrakt co reviewed mechanizm; inaczej wraca przez Development/PR. Same-source SHA jest obecnym minimum; bit-identical artifact digest pozostaje PLANNED_HARDENING, nie jest deklarowaną gwarancją.

## Read-only preflight i symulacja

Bez żadnych provider credentials ani połączenia z bazą:

~~~sh
npm --prefix apps/srm run migrate:staging:plan
npm --prefix apps/srm run promote:staging -- --simulate --sha "$APPROVED_SHA"
~~~

Symulacja jawnie oznacza SYNTHETIC_EVIDENCE / RELEASE_PROVENANCE=NOT_VERIFIED. Nie może być łączona z apply/rollback i nie dowodzi stanu providerów. Factual read-only plan wymaga odrębnych provider read credentials i exact direct binding, jeśli srm_app istnieje:

~~~sh
npm --prefix apps/srm run promote:staging -- --plan --sha "$APPROVED_SHA"
~~~

Nie dołączać credential values do stdout, repo ani evidence. Plan odczytuje metadata GitHub/Render/Neon i rolę/organizację SQL read-only. Sam UUID w env nie jest dowodem obecności tenanta. Zastany Staging credential nie może równać się odpowiedniemu Dev credential; dev tenant var nie może trafić do Staging runtime.

## Docelowe wywołanie jednym poleceniem — dopiero po S0

~~~sh
gh workflow run srm-ci.yml --repo profitia/SG-dev --ref main -f approved_sha="$APPROVED_SHA" -f staging_deployment_authorized=YES -f cost_owner="$COST_OWNER" -f initialize=false
~~~

Pierwsza atomowa inicjalizacja po utworzeniu bazy wymaga initialize=true. Zwykły PR/push main nie uruchamia żadnego Staging joba. srm-staging-guard najpierw sprawdza autoryzację, reviewed source i ACTIVE/VERIFIED exact registry; przed entering environment job weryfikuje GitHub environment ID i required reviewers. RESERVED odrzuca przed aktywacją joba. srm-staging-promote jest jedynym manualnym jobem związanym z srm-staging; pobiera wyłącznie environment-scoped RENDER_API_KEY, NEON_API_KEY, SRM_APP_DIRECT_URL, SRM_APP_DATABASE_PASSWORD, SRM_DEMO_PASSWORD oraz organization var. Konfiguracja Render produktu posiada osobne provider API keys i session secret; nie ma owner/API deployment credentials.

Chronione review w GitHub nadal obowiązuje; polecenie biznesowe nie wyłącza ochrony platformy. Jeśli wymagany reviewer nie zaakceptuje runu, nie ma deploymentu. Approval JSON jest przypisany do workflow run/attempt, aktora, SHA, kosztów i dozwolonych operacji; wygasa po 1 godzinie. Nie ponawiać z innym SHA pod tą samą approval identity.

Po gate: świeży full preflight z read-only snapshot <=15 minut, exact service/config/branch/DB/secrets, transaction migration, runtime login/RLS/tenant proof, ponowiony preflight i service contract, deploy explicit commitId. Retry wyszukuje istniejący nieudany/aktywny/live deploy dla tego SHA i nie resetuje bazy. Inflight matching deploy jest obserwowany, failed deploy wymaga kontrolowanego retry. Brak live po 20 minutach blokuje sukces. Evidence zawiera requested SHA, deploy ID, migration list, health/auth checks i LKG; bez sekretów.

## Post-deployment verification

PENDING do aktywnego Staging: Render live exact SHA/ID; /api/health service=srm/environment=staging; statyczne logo/style; unauthenticated API 401; wrong password rejection; poprawny form login i Secure/HttpOnly cookie; authenticated page; odczyt pod Stage tenant/RLS; jawnie autoryzowany provider/write/persistence smoke na Stage data; logi/metrics; potwierdzenie baseline reconciliation w kanonicznym registry. HTTP200 i formularz logowania nie są dowodem zapisu danych. Mechanizm nie raportuje productPersistence=PASS bez tej dodatkowej kontroli.

## Rollback

Przed promocją zapisać live deploy ID, SHA i konfigurację jako LKG. Schema nie jest cofana. Przy SQL failure cała transakcja wycofuje się; przy awarii Render po COMMIT zachować ledger/data, naprawić w Development lub przywrócić kompatybilny kod.

Przygotowana explicit ścieżka operatora, z uprawnionego SRM Codespace po osobnej autoryzacji rollback:

~~~sh
npm --prefix apps/srm run promote:staging -- --apply --rollback --sha "$LKG_SHA" --authorization /secure/rollback-approval.json
~~~

Approval musi zawierać operations=[rollback], rollbackSchemaCompatible=true, exact repo/branch/DB/service, expiry i owner. Release musi przejść CI, istnieć na main i mieć identyczny zgodny zestaw DDL/kontraktu; migrator jest użyty tylko w BEGIN READ ONLY. Różnica schema manifest albo brak Stage capability blokuje rollback. Nigdy nie wnioskować, że starszy kod na pewno obsłuży nowy schema. W takim przypadku forward fix albo osobna data-safe decyzja ownera, bez automatycznego resetu czy down-migration. Po rollback wymagane te same health/auth/data controls i legalny baseline reconciliation.

## Blocker handling

Nieprzeterminowana autoryzacja nie omija RESERVED, source/CI, credential, owner, environment ani schema gate. Przerwać przed mutation przy missing IDs, foreign host/PMOS/Prod, ambiguous service, niezgodnym build/start/region/plan, shared secret lub niezweryfikowanym executorze. Zachować LKG, ledger, workflow/evidence i przyczynę; nie tworzyć fallback resource. Zmiany funkcjonalne zawsze Development → PR/main → approved Development release → Staging.
