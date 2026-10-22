# Kontrolowany dostęp CI do prywatnych pakietów — v1

Profil ARCHITECTURE, TARGET_ENVIRONMENT=development. Repozytorium profitia/SG-dev jest publiczne. Ten mechanizm nie nadaje mu Manage Actions access do prywatnych pakietów, nie tworzy repozytorium/projektu, nie pobiera sekretów Render i nie wdraża produktu. Korzysta z obecnego workflow platform-contracts-ci.yml i aktywnego środowiska architecture-development / 24168168252.

## Granica zaufania

GitHub Environment dopuszcza dokładnie jedną regułę: main, type=branch, custom_branch_policies=true, protected_branches=false. Nie dopuszcza tagu main ani refs/pull/*/merge. Kontroler odczytuje rzeczywiste ID/politykę u dostawcy i porównuje je z aktywną topologią ARCHITECTURE; nie rozszerza reguł, aby przepuścić uruchomienie. Przed dodaniem tokenu należy potwierdzić istniejącą politykę i brak repo-level SG2_PACKAGES_READ_TOKEN.

Uprzywilejowany job działa z kontrolera z dokładnego SHA main i workflow_ref wskazującego main. Dopuszczone zdarzenia to push main i workflow_dispatch validate-sg2. Actor i triggering_actor muszą być profitia. Wskazany PR musi być otwarty, skierowany do main, utworzony przez profitia i pochodzić z jednej z jawnych przestrzeni gałęzi sg2/, srm/ lub architecture/ tego samego repozytorium (z niepustą nazwą po prefiksie). Oczekiwany 40-znakowy SHA musi odpowiadać bieżącemu HEAD PR. Fork, obcy aktor/aplikacja/ref, zmieniony SHA lub brak jawnego przyjęcia kontraktu są odrzucane.

Weryfikacja PR oznacza dopuszczenie kodu przejrzanego w zaufanej gałęzi wewnętrznej. Nie uruchamiamy kodu forka z poświadczeniem lub prywatnymi pakietami. Ten model nie izoluje złośliwego administratora ani świadomie zaakceptowanego złośliwego kodu na main. Uprawnieni administratorzy mogą zmienić polityki GitHub; wymagany jest nadzór nad main, workflow i sekretami. Warunek if w YAML jest dodatkową kontrolą, a nie samodzielną granicą dostępu.

## Fazy wykonania i dowody

1. Zaufany kontroler odczytuje metadane GitHub i jawny operation-integration.json kandydata. Nie importuje jego JavaScript. Checkout kontrolera i kandydata jest oddzielny, dokładny i nie zachowuje poświadczenia Git.
2. Przed instalacją weryfikuje dokładną konfigurację npm oraz nazwy, wersje i sumy integralności prywatnych zależności względem lockfile na main. Dozwolone prywatne pobrania to advisory-widget, cic-core i cic-procurement. Lokalne @profitia/platform-contracts oraz @profitia/srm-xray pochodzą wyłącznie z odpowiednich packages/platform-contracts i packages/srm-xray tego samego dokładnego checkoutu; nie są nowymi pobraniami GitHub Packages. Manifest, lockfile, rzeczywista ścieżka i nazwa lokalnego pakietu muszą się zgadzać; alias, podmiana na rejestr, zagnieżdżony pakiet, brak źródła authority i dowiązanie symboliczne dają odmowę przed instalacją. Lokalne manifesty są odczytywane jako JSON i porównywane z polityką zaufanego main, bez importu ich JavaScript. Inny rejestr, ścieżka, niezatwierdzony pakiet lub zmiana pinów daje odmowę. Zmiana prywatnych wersji wymaga uprzedniego przeglądu authority, bez opcji skip.
3. SG2_PACKAGES_READ_TOKEN jest przekazany jako NPM_TOKEN wyłącznie do kroku instalacji. Kontroler pyta GitHub o właściciela, zakres i wygaśnięcie: tylko konto profitia, wyłącznie read:packages, przyszłe wygaśnięcie nie dalsze niż 31 dni. Brak/błędny token kończy job przed testami.
4. npm ci --install-links --ignore-scripts --no-audit --no-fund wykonuje czystą instalację bez lifecycle. Wyjście npm nie jest publikowane; własny cache jest usuwany. Token nie trafia do pliku .npmrc, argumentów polecenia, cache artefaktu ani proof.
5. Dopiero po zakończeniu kroku z tokenem uruchamiane są lifecycle, istniejący test:operation-context, typecheck i build. NPM_TOKEN, NODE_AUTH_TOKEN, GH_TOKEN oraz GITHUB_TOKEN są w tej fazie puste. Testy korzystają tylko z syntetycznego kontenera PostgreSQL16, bez połączeń produktu/PMOS.
6. Po sukcesie powstaje wyłącznie proof.json: dokładny kandydat, kontroler/main, run ID, kontrakt/digest i wyniki. Nie publikuje się node_modules, tarballi, .next, logów instalatora ani cache. Sekret nie jest dostępny w kroku proof.
7. Publiczny job SG2 nie instaluje prywatnych pakietów. Kontroler z authority sprawdza pochodzenie uruchomienia i artefaktu, dokładny SHA oraz kontrakt. Digest kontrolera, workflow i topologii musi odpowiadać zarówno obecnemu authority weryfikatora, jak i rzeczywistym plikom GitHub z controlSha run. Stary dowód po zmianie polityki nie zastępuje nowej walidacji. Ponownie odczytywana jest też aktualna polityka środowiska. Dowód dla innego SHA, innego workflow/aktora, porażki lub niepełnej walidacji jest odrzucany. Dla tego samego push main dopuszcza dowód już zakończonego uprzywilejowanego joba tego uruchomienia; dla zewnętrznego uruchomienia wymaga całego run conclusion=success. Brak dowodu nie jest zielonym pominięciem.

Brak przyjęcia SG2 na main oznacza NOT_ADOPTED i brak dowodu runtime. Ręczna walidacja PR bez przyjęcia kończy się odmową. SRM zachowuje własne rzeczywiste testy i nie otrzymuje tego poświadczenia. Zielony odczyt dowodu w publicznym jobie nie jest ponownym wykonaniem testów; odsyła do kontrolowanego run, który faktycznie je wykonał.

## Czynność właściciela — dopiero po weryfikacji polityki

Token jest nowym poświadczeniem uwierzytelniającym; właściciel tworzy go osobiście. Nie wysyła go do czatu, PMOS, PHR, pliku repozytorium ani agenta.

1. W koncie profitia otwórz [utworzenie tokenu classic](https://github.com/settings/tokens/new). Nazwa: SG-dev controlled CI packages read. Wygaśnięcie: 30 dni. Zaznacz wyłącznie read:packages; nie repo, workflow, write:packages, delete:packages ani admin. Jeśli interfejs zaznaczy inne zakresy, usuń je. Kontroler odrzuci szerszy token.
2. Wygeneruj token i skopiuj go bezpośrednio do [GitHub Environment architecture-development](https://github.com/profitia/SG-dev/settings/environments/24168168252/edit), sekcja Environment secrets → Add environment secret.
3. Nazwa sekretu: SG2_PACKAGES_READ_TOKEN. Wartość: nowy token. Nie twórz Repository secret ani Organization secret; nie zmieniaj main-only i nie dodawaj Actions access pakietów dla SG-dev.
4. Poinformuj jedynie, że sekret został zapisany. Nie podawaj jego wartości. Agent potwierdzi metadane umiejscowienia i rzeczywiste użycie/zakres, następnie wznowi osobno profil SG2 i odbiór programu.

**Rzeczywisty zakres:** read:packages tokenu classic uprawnia do odczytu pakietów dostępnych kontu, a nie tylko trzech nazw z tego projektu. Kontroler ogranicza wykonywane pobrania do zatwierdzonych trzech, ale nie zmienia uprawnień samego tokenu. Wymaganie technicznego ograniczenia credentiala wyłącznie do tych trzech wymaga odrębnej tożsamości z odpowiednimi prawami; nie jest tutaj deklarowane. To nie jest token GitHub fine-grained. Nie ustawiono go w istniejących usługach Render i nie udostępniono forkom.

## Sterowanie i powrót

Agent uruchamia istniejący Platform contract integration na main, mode=validate-sg2, candidate_pr i expected_sha odczytane z aktualnego PR. Po sukcesie ponawia publiczny CI dokładnego kandydata. Zmiana HEAD wymaga nowej walidacji. Push main z przyjęciem SG2 uruchamia chroniony tor dla dokładnego main automatycznie.

mode=policy-probe nie pobiera pakietów ani nie używa tokenu. Na main ma zakończyć się MAIN_ONLY_ENVIRONMENT_POLICY_PASS. To samo wywołanie na niedozwolonej gałęzi ma zostać odrzucone przez GitHub przed pierwszym krokiem joba. Jest to test polityki, nie test biznesowy ani dowód poprawnego tokenu. Nie tworzy się forka/repozytorium w imieniu właściciela tylko do testu; rzeczywisty test forka należy rozróżniać od testów macierzy kontekstu i od rzeczywistej odmowy gałęzi.

Wycofanie kodu CI: normalny revert PR w main. Można usunąć wyłącznie nowy sekret CI lub odwołać nowy token w ustawieniach właściciela, bez zmiany tokenów produktu/Render i bez cofania baz. Historia dowodów/PMOS/PHR zostaje zachowana. Zdarzenie GitHub Environment jest zapisem dopuszczenia joba CI, nie deploymentem aplikacji w Render.

Źródła ograniczeń: [GitHub npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry), [GitHub Environment i reguły ref](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [zarządzanie PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens). Wariant bezpośredniego grantu pakietów do publicznego repozytorium pozostaje wycofany.

Publiczny weryfikator PR pobiera kontroler z aktualnego zaufanego main, a nie z historycznego pull_request.base.sha. Metadane długo otwartego PR mogą wskazywać SHA sprzed utworzenia kontrolera mimo aktualizacji gałęzi kandydata. Dla push main pozostaje dokładny github.sha. W obu przypadkach aktualny digest polityki i rzeczywiste pliki controlSha run nadal muszą pasować do proof; zmiana authority nie dopuszcza starego dowodu.

Zmiana samej polityki lokalnych źródeł jest osobnym zadaniem ARCHITECTURE; nie zmienia zależności ani uprawnień aplikacji. Przed merge takiego PR testuje się nowy kontroler bez sekretów, a niezmienione zależności SG2 można zweryfikować dotychczasowym kontrolerem z main. Po merge nowy digest obowiązuje nowe walidacje main. Dopiero osobny task SG2 przyjmuje lokalny moduł i otrzymuje dowód z nowej polityki dla własnego exact SHA. Nie stosuje się wyjątku dla starych digestów ani zastępczego kontrolera. Przyjęcie źródła lokalnego nie stanowi dowodu biznesowego użycia modułu lub wydania produktu.

## Kandydaci SRM i ARCHITECTURE — zgodność kontrolowanego CI

Te same warunki ownera, otwartego wewnętrznego PR do main i dokładnego SHA obejmują jawnie prefiksy `sg2/`, `srm/` i `architecture/`. Inne prefiksy, pusty sufiks, fork, obcy autor, zmieniony HEAD lub niezaufany kontroler pozostają odrzucane. Prefiks nie zmienia profilu governance, routingu, PMOS ani praw do źródeł aplikacji. Każdy kandydat przechodzi ten sam rzeczywisty tor SG2; SRM nie uzyskuje poświadczenia w swoim jobie i nie pomija testów SG2. Nazwa trybu `validate-sg2` oraz format dowodu SG2 są zachowane, ponieważ wskazują sprawdzanego konsumenta, nie profil autora PR.

Aktualizacja tej polityki jest odrębnym pierwszym PR w zadaniu ARCHITECTURE. Jej kandydat bootstrap korzysta z dotychczas dopuszczonego namespace `sg2/`, przy niezmienionym profilu ARCHITECTURE i wyłącznie jego targetach. Nie zmienia się brancha/HEAD istniejącego PR SRM. Stary zaufany kontroler main może sprawdzić dokładne niezmienione zależności SG2 tego pierwszego kandydata. Dopiero po jego rzeczywistym przyjęciu nowy kontroler z main waliduje kandydatów SRM/ARCHITECTURE. Nowy digest polityki wymaga nowych dowodów; przed scaleniem odśwież authority i powtórz wymagane bramki. Nie udostępnia się sekretu kandydatowi, nie zmienia reguł Environment i nie publikuje pakietów/cache.

Kontroler rozpoznaje także zamknięty układ Root `1.0.0-candidate.16`: pięć plików candidate15 oraz dokładnie `src/supplier-location.mjs`, `src/supplier-location.d.mts` i `migrations/access/019-supplier-location-operations.sql` we wspólnym pakiecie. Hashuje rzeczywiste bajty regularnych plików bez wykonywania kodu kandydata. Układy historyczne zachowują dotychczasowe znaczenie; nieznane przyszłe wersje, brak pliku, symlink, rozbieżna tożsamość i lista ścieżek podana przez kandydata są odrzucane. Obsługa układu nie przyjmuje wersji w aplikacji ani nie zmienia jej receiptów.

## Zamknięty przegląd onboardingu KRS — TASK01B

Oddzielna klasa dopuszcza wyłącznie kompletny zestaw15 dokładnych ścieżek z zamrożonej stałej `KRS_GOVERNANCE_REVIEW_FILES` w zaufanym kontrolerze: jeden istniejący workflow governance, sześć datowanych dowodów KRS (foundation/G1/01B, MD+JSON), trzy rejestry (onboarding/baseline/manifest), handoff Stage02, kanon KRS, kanon routingu i dwa istniejące testy onboardingu. Kandydat nie podaje własnej allowlisty. Każda ścieżka musi mieć status added/modified, prawidłowy blobSHA i unikalną nazwę; brak choć jednej, dodatkowa ścieżka, usunięcie, rename/copy, duplikat lub mieszanie z producentem daje odmowę. Nie wymaga się fikcyjnego delta platform-contracts.

To nie jest ogólne dopuszczenie `Canon/**`, `.github/**`, JSON, testów ani narzędzi. Runtime/pakiet/nowy workflow KRS, kod SRM/Maps/Identity, kontroler CI, topology/project registry i każdy inny plik pozostają poza tą klasą. Wszystkie15 ścieżek muszą nadal rozstrzygać się na zaufanym main jako Governance Source Layer / ALIGNED / ARCHITECTURE ALLOWED. Zmiana zestawu wymaga kolejnego przeglądu polityki. Istniejąca klasa producenta zachowuje poprzedni zakres i wymóg rzeczywistej zmiany platform-contracts.

Zachowane są bieżące owner/actor/triggering_actor, wewnętrzny otwarty PR do main, dokładny HEAD, pełna lista GitHub i ponowny odczyt metadanych, rzeczywisty Git diff/tree/blob, brak symlinków/ucieczki realpath i limit rozmiaru. Admission nie importuje kodu kandydata. Token pozostaje wyłącznie w dotychczasowej instalacji bez lifecycle; wykonanie/testy/proof nie mają poświadczeń. Nie zmieniają się workflow, Environment, zakres tokenu, prywatne pakiety, konfiguracja/lockfile produktu, format ani weryfikacja proof. Nowy digest polityki wymaga nowego dowodu.

Kolejność przyjęcia: osobny governance PR polityki przez opisany wyżej bootstrap `sg2/`, niezmieniony profil ARCHITECTURE i jego własny PMOS; lokalne testy bezpieczeństwa i przegląd dokładnego diff; rzeczywisty exact-SHA kontrolowany CI ze starego zaufanego main; wszystkie właściwe checki i dopiero dozwolony merge. Następnie niezależny odczyt nowego main/polityki, bieżącego HEAD PR603 i dokładnych15 plików, nowe `validate-sg2` ze zaufanego main, nowy source-bound proof i ponowienie publicznego CI. Zmiana HEAD/polityki unieważnia poprzedni proof. KRS routing staje się przyjęty dopiero po drugim dozwolonym merge i niezależnym odczycie main. Zmiana polityki nie uruchamia Stage02, deploymentu ani płatnego providera. Równoległy kandydat Identity ma osobny zakres i nie jest przyjmowany przez tę klasę.

Rollback: przed przyjęciem pozostawić/odrzucić oddzielny PR; po przyjęciu zwykły przeglądany revert usuwa tylko nową klasę, zachowując historię i poprzednią klasę producenta. Ponownie wymagany jest proof zgodny z aktualnym digestem. Nie cofa się produktu ani bazy i nie zmienia sekretu/Environment w ramach tego powrotu.

## Zamknięta klasa przeglądu Identity Lifecycle — propozycja B2-E-CI-01

Status: propozycja źródłowa, do osobnego przyjęcia przez właściciela. Rejestracja zadania i lokalny PASS nie aktywują nowej polityki na main ani nie stanowią kontrolowanego dowodu SG2.

Oprócz istniejącej klasy producenta kontroler dopuszcza jeden zamknięty zestaw **wszystkich pięciu** ścieżek, wyłącznie added/modified, bez żadnej innej ścieżki:

1. `Canon/evidence/2026-10-22-identity-runtime-porr-first-decision.md`
2. `Canon/evidence/2026-10-22-identity-runtime-lifecycle-b2-e.md`
3. `Canon/runbooks/identity-runtime-lifecycle-and-persistent-login-v1.md`
4. `apps/identity-runtime/test/lifecycle-resilience.test.mjs`
5. `apps/architecture-lab/test/access-store-postgres.test.mjs`

Tylko dla kompletnego zestawu nie wymaga się fikcyjnej zmiany `packages/platform-contracts/**`. Kolejność plików nie ma znaczenia; brak, dodatkowa ścieżka, deletion/rename/copy, duplikat, zły blob/SHA lub zmieniony routing powodują odmowę. Nie ma ogólnego wyjątku dla `apps/**`, rozszerzenia `.test.mjs`, innych dokumentów, przyszłych plików albo mieszania tej klasy z producentem. Zmiana zestawu wymaga kolejnego przeglądu polityki.

Niezmienione pozostają owner/actor i triggering_actor, otwarty wewnętrzny PR do main, dokładny HEAD, kompletne pobranie listy GitHub z ponownym odczytem metadanych, liczność, brak rename, trusted routing ALLOWED/ALIGNED, Git diff/tree/blob, zwykły plik/realpath/limit rozmiaru oraz ponowne sprawdzenie przed instalacją i proof. Owner obu plików testowych musi być Architecture Platform; trzech dokumentów — Governance Source Layer. Kandydat nie podaje własnej allowlisty. Testy są wykonywalnym kodem i wymagają przeglądu; nazwa pliku nie dowodzi nieszkodliwości. Żaden kod kandydata nie jest importowany do admission.

Workflow i GitHub Environment protection nie zmieniają się. Poświadczenie nadal trafia tylko do istniejącej instalacji `--ignore-scripts`; późniejsze wykonanie i proof pozostają bez poświadczeń. Format i weryfikacja proof nie mają wyjątku dla tej klasy. Zmiana kontrolera zmienia istniejący policy digest; stary proof nie może spełnić nowej walidacji.

### Owner GO i późniejsza walidacja

1. Właściciel przegląda osobny DRAFT PR korekty i dokładny source SHA z jego handoffu. Niniejsze zadanie nie wykonuje żadnego merge ani uprzywilejowanego dispatchu. PR #600 i jego źródła pozostają bez zmian.
2. Jeżeli przed przyjęciem korekty wymagany jest kontrolowany proof jej samej, wymaga to jawnego GO. Canonical bootstrap używa namespace `sg2/` przy niezmienionym profilu ARCHITECTURE oraz wyłącznie governance targets; to nie daje prawa zapisu do SG2. Istniejący kontroler main może zweryfikować niezmienione zależności konsumenta dla exact SHA korekty. Nie kopiuje się nowej polityki do procesu z sekretami przed przyjęciem, nie poszerza Environment i nie pomija wymaganego checka. Brak tego proof pozostaje jawnym owner gate, a nie PASS.
3. Po odrębnym zatwierdzeniu właściciel scala wyłącznie przyjęty exact source. Odczytać rzeczywisty merge SHA i aktualny main, porównać zaakceptowane pliki/digest, wymagane kontrole i politykę Environment. Merge SHA może różnić się od source SHA. Różnica kodu, sekret/polityka środowiska wymagająca zmiany lub niespójność zatrzymuje wykonanie.
4. W osobnej autoryzowanej jednostce odświeżyć main i PR #600, właściwy preflight/BEGIN oraz cały current diff. Jeżeli synchronizacja z main/rebase zmieniła HEAD, pobrać nowy exact SHA; nie używać automatycznie historycznego `70b4b05a870f93921529319f3a1693dd345ed0af`. Aktualny zestaw musi nadal przechodzić nowe admission i Git blob validation; nie edytować metadanych lub dodawać sztucznego producenta dla obejścia odmowy.
5. Dopiero po GO uruchomić istniejący workflow na **main**, mode=`validate-sg2`, candidate_pr=`600`, expected_sha=`<odczytany aktualny SHA>`. Wymagany jest rzeczywisty sukces testów/API/typecheck/build, istniejący ograniczony sekret bez ujawniania i nowy proof wiążący candidate SHA, control/merge SHA, run ID oraz aktualny policy digest. Brak/wygaśnięcie sekretu lub dodatkowe wymagania dostępu oznaczają STOP i działanie właściciela, bez automatycznej zmiany secrets/Environment.
6. Po sukcesie ponowić publiczny check dla tego samego aktualnego SHA i potwierdzić niezależnie wszystkie wymagane wyniki. Zmiana HEAD lub polityki unieważnia proof i wymaga nowej walidacji. Brak proof nie jest PASS. PR #600 nadal pozostaje DRAFT do odrębnego odbioru; zgoda na walidację nie jest zgodą na jego merge, deployment ani Live Clerk Acceptance.

Rollback propozycji: pozostawić/odrzucić draft, bez zmiany main. Po przyjęciu ewentualny przeglądany revert usuwa wyłącznie nową klasę; historia dowodów zostaje. Ponieważ digest się zmienia, nowe walidacje wymagają proof zgodnego z przywróconym main — bez wyjątków dla starego digestu i bez cofania produktu/bazy.

## Uzgodnienie KRS i Identity — B2-E-CI-02

Propozycja Identity jest uzgodniona z zaakceptowanym main `0ad9525f1397d41b965787fb487492a713ba0e54`, zawierającym PR606 i onboarding KRS. Jeden kontroler zachowuje trzy niezależne klasy: dotychczasowy producent, dokładny zestaw15 KRS oraz dokładny zestaw5 Identity. Stała KRS, jej predykat kompletności, wszystkie15 przyjętych plików i pięć testów KRS pozostają zachowane. Wspólna kontrola zamkniętych zestawów wymaga added/modified; mieszanie klas, dodatkowe i podmienione ścieżki nie korzystają z wyjątku. Nie dodaje się sztucznego producenta.

Owner KRS workflow/scripts i Canon pozostaje Governance Source Layer. Jedynie dwie ścieżki aplikacyjnych testów należące do kompletnej klasy Identity wymagają Architecture Platform; producent zachowuje istniejących ownerów. Nie powstaje ogólne dopuszczenie aplikacji, testów lub workflow. Zamiana ownera na inną prawidłową nazwę, błędny profil i state nadal dają odmowę dla właściwej klasy, bez zmiany pozostałych.

Historia PR605 jest łączona z aktualnym main zwykłym, przeglądalnym commitem, bez force-push. Bieżący task autoryzuje wyłącznie źródła i testy. Poprzednie GO dla `e357327f8790296a6ea0016b67218e26ac8101e5` nie obejmuje nowego SHA. Właściciel otrzymuje aktualny exact SHA i parametry istniejącego `validate-sg2` z ref main, candidate_pr605. Żaden uprzywilejowany dispatch, merge605/600 ani aktywacja nie jest wykonywana w tym tasku. Brak proof w publicznym CI pozostaje FAIL.

Po osobnym GO i faktycznie zakończonej kontrolowanej walidacji trzeba odczytać proof dla tego samego SHA, sprawdzić controlSha/runId/aktualny digest i powtórzyć publiczny check. Merge wymaga kolejnej odrębnej zgody. Następnie osobny task może sprawdzić aktualne HEAD/diff PR600 i uzyskać proof z przyjętego main. Revert samego dodatku Identity zachowuje przyjętą klasę KRS oraz historię; nie zmienia workflow, secrets, Environment ani produktu.
