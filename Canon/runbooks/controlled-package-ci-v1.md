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

## Zamknięty przegląd G1 Package & Limits — 2026-10-30

Wykonanie zatwierdzonego przez ownera pełnego planu Development wymaga przyjęcia rejestracji źródła/CI. PR #814 jest dopuszczony wyłącznie przez stałą LIMITS_G1_GOVERNANCE_REVIEW: osiem dokładnych blobów kandydata b6f1772ecc23b9efcbac6cb4e7265cfbea375c42, numer PR i jego gałąź. Techniczna aktualizacja bazy zachowująca te bloby jest dopuszczalna; zmiana któregokolwiek blobu wymaga nowego przeglądu polityki. Nie jest to ogólne dopuszczenie aplikacji, workflow, narzędzi ani kanonów.

Obowiązuje opisana wyżej sekwencja osobnego bootstrap PR sg2/ z profilem ARCHITECTURE, dokładnym preflight/PMOS, testami negatywnymi i rzeczywistą walidacją starego kontrolera. Po jego przyjęciu nowy kontroler z main sprawdza exact SHA PR814. Zestaw nie zawiera kodu aplikacji ani nowego workflow. Kompletność, API/Git/tree/blob, owner/routing, aktor, main-only, prywatne pakiety, credential-free execution i source-bound proof zachowują poprzednie bramki. Brak fikcyjnego producer delta i brak zmian SG2/SRM/Identity. Zwykły revert usuwa wyłącznie tę klasę. To dopuszczenie G1 nie dowodzi LIVE.

## Zamknięty przegląd opcjonalnego producenta FRESH — 2026-10-30

Formalna koordynacja wspólnego E1, wymagana w zleceniu SRM Performance Recovery v2, obejmuje osobny task ARCHITECTURE-FRESH-CI-ADMISSION-20261030. Stała FRESH_REPORT_PRODUCER_REVIEW dopuszcza wyłącznie PR817, jego dokładną gałąź i dziesięć blobów źródła 9f23dc13902f942c31fe7d86ba5bf7bc2e9c6363. Są to siedem plików opcjonalnej paczki current-fresh-report, datowany dowód, receipt laboratorium i istniejący workflow producenta. Ostatni plik dodaje wyłącznie publiczną instalację lokalnego peer oraz jawny test glob; jego pełny blob jest zamrożony. Nie dopuszcza to innych paczek, ścieżek apps, workflow ani zmiany kontrolera w kandydacie817. Nie dodaje zależności SG2 ani pozycji do LOCAL_PACKAGES.

Stosuje się dotychczasowy osobny bootstrap sg2/ z profilem ARCHITECTURE, własnym PMOS, pełnym przeglądem i testami negatywnymi. Stary zaufany main wykonuje rzeczywisty kontrolowany CI dokładnego bootstrapu. Dopiero po jego przyjęciu nowa polityka main może sprawdzić dokładnego producenta817; nowy digest polityki wymaga nowego proof. Techniczna aktualizacja bazy817 może zachować przyjęcie wyłącznie przy identycznych dziesięciu blobach; każda zmiana blobu lub zestawu wymaga nowego przeglądu. Nadal obowiązują owner, API/Git/tree, aktualny HEAD, main-only, dotychczasowe pakiety prywatne i piny, brak lifecycle w fazie poświadczenia, usunięcie poświadczeń przed wykonaniem oraz rzeczywiste testy i weryfikacja proof. Nie zmienia się Environment ani dostępu do infrastruktury. Zwykły revert usuwa jedynie tę klasę.

Przejście kontrolowanego CI nie przyjmuje paczki w SRM, nie daje prawa do deploymentu i nie dowodzi celu FRESH≤6s. Producent i odbiorca zachowują oddzielne zadania oraz dowody. Do SOURCE GO potrzebny jest kompletny wynik CI dokładnego źródła, niezależnie od przejścia samego dopuszczenia.


## Projekt zamkniętego przeglądu payload capture — wymaga decyzji ownera

Status tego dodatku: DRAFT_ONLY / OWNER_DECISION_PENDING. Task
ARCHITECTURE-PAYLOAD-CAPTURE-CI-BOOTSTRAP-CANDIDATE-20261031 przygotowuje
kandydata polityki; nie upoważnia do jego merge, aktywacji ani SOURCE_GO.
Aktywny kontroler na main pozostaje niezmieniony do osobnej decyzji.

Proponowana stała PAYLOAD_CAPTURE_PRODUCER_REVIEW obejmuje wyłącznie otwarty
PR827, gałąź architecture/payload-capture-source-publication-20261031,
HEAD9d44684b968ca3a067d414f7c450b6016ecc8d19 i dokładnie dziesięć jawnych
blobów added. Zestaw to sześć plików optional data-only payload-capture1.0.0,
dwa istniejącego laboratorium i dwa datowane dowody. Nie zawiera workflow,
kontrolera, zmian SDK1.32.3, aplikacji ani receiptów odbiorców. Każda zmiana
HEAD, blobu, statusu lub zestawu wymaga nowego przeglądu; nie dopuszcza się
technicznego rebase na podstawie samych niezmienionych blobów.

Nie powstaje ogólna reguła dla optional packages, apps/architecture-lab ani
Canon. Obowiązują kompletne metadane API i ponowny odczyt, rzeczywisty diff,
tree/blob i regularny plik bez symlinków, bieżący routing/owner/ALIGNED,
wewnętrzny autor/repozytorium, main-only kontroler, dotychczasowe nazwy/piny
pakietów prywatnych i rozdzielenie instalacji od wykonania bez poświadczeń.
LOCAL_PACKAGES, workflow, Environment, sekret, format i weryfikacja proof
pozostają bez zmian. Admission nie jest uprawnieniem do danych produktu.

Osobny draft bootstrapu używa udokumentowanego namespace sg2/ wyłącznie jako
transportu polityki; profil, własność czterech ścieżek i PMOS pozostają
ARCHITECTURE. Sam draft nie zmienia aktywnej polityki. Po osobnej zgodzie
właścicielskiej możliwa jest istniejąca kolejność: rzeczywisty kontrolowany CI
dokładnego bootstrapu ze starego main, właściwe wymagane checki, kontrolowany
merge polityki, niezależny odczyt nowego main, nowe validate-sg2 dokładnego
PR827, nowy proof i ponowienie jego publicznego weryfikatora. Żaden z tych
przyszłych kroków nie jest autoryzowany przez niniejszy projekt dodatku.
Nowy digest polityki nie akceptuje starych proofów, w szczególności PR817.

Dopiero pełne CI dokładnego producenta i formalny SOURCE_GO umożliwiają jego
osobne przyjęcie przez SRM. Przyjęcie kontraktu, wdrożenie i wynik FRESH≤6s
pozostają osobnymi dowodami. Brak deploymentów, SQL/ról, uprawnień dostawców,
sekretów i nowych zasobów. Przed aktywacją można zamknąć draft; po osobno
zaakceptowanym merge wycofanie polega na zwykłym przeglądanym revercie tej
jednej klasy, z zachowaniem historii i aktualnych wymagań proof.
