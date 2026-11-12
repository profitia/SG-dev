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

## Zamknięty przegląd Source Hub G1 — PR878

Właściciel jawnie zatwierdził tę osobną poprawkę CI i dalszą aktywację w odpowiedzi „Zatwierdzam poprawkę CI i dalszą aktywację”, po przeglądzie dokładnego14-blobowego zestawu PR878. Authority wynika z kontrolowanego przyjęcia bootstrapu na main. Dopuszcza wyłącznie PR878, jego dokładną gałąź i kompletny zestaw14 zamrożonych blobów/statusów kandydata aef76dd768aa52b0fe0f17349cb1c972d6c67eae. Techniczna aktualizacja podstawy może zachować te same14blobów; bieżący HEAD i expected_sha nadal muszą się zgadzać. Zmiana blobu/statusu, brak/dodatkowa ścieżka, rename/delete/copy lub inny PR/branch są odrzucane.

Wszystkie ścieżki to Governance Source Layer / ALIGNED / ARCHITECTURE. Nie powstaje ogólne dopuszczenie Canon, runtime, apps/packages lub workflow. Nie zmieniają się poświadczenia, reguły Environment/main-only, prywatne pakiety/piny ani instalacja bez lifecycle i wykonanie bez credentiali. Stosuje się istniejący osobny bootstrap sg2/ wyłącznie jako namespace transportowy, z profilem ARCHITECTURE, jego routingiem i PMOS. Najpierw wymagany jest exact-SHA dowód starego trusted-main kontrolera dla bootstrapu i kontrolowany merge; dopiero potem nowy main waliduje PR878. Nowy digest unieważnia stare proof. Rollback: zwykły revert wyłącznie tej zamkniętej klasy, bez produktu/bazy/sekretu.

## Projekt zamkniętego przeglądu universal first-party Hub — PR904

DRAFT / OWNER_DECISION_PENDING. Stała SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW dopuszcza wyłącznie PR904, gałąź architecture/source-hub-universal-consumers-20261105 oraz39 dokładnych blobów/statusów/trybów i ownerów kandydata20cd23cec09657562b39bed8904cc1bb9981e08f, baza817c671e31606536a1536dd187165ac07145a0fc. Nie jest to ogólne dopuszczenie kanonów, aplikacji, optional packages ani nowych nazw konsumentów. Inny PR/branch, brak/dodatkowa ścieżka, zmiana blobu/statusu/owner/routingu, rename/copy/delete, duplikat, symlink i executable mode są odrzucane. Techniczne odświeżenie main może zachować wyłącznie identyczne39 wersji plików; expected_sha musi zawsze odpowiadać bieżącemu HEAD.

Osobna czteroplikowa propozycja używa istniejącego bootstrap namespace sg2/ przy profilu ARCHITECTURE. Przed aktywacją wymaga odrębnej decyzji ownera, pełnych testów polityki, rzeczywistego exact-SHA proof starego trusted-main kontrolera i wymaganych checków. Dopiero jej kontrolowane przyjęcie pozwala nowemu main sprawdzić dokładnego kandydata904, z nowym digestem polityki i świeżym proof. Dotychczasowe klasy i ich historyczne dowody nie są przepisywane.

Main-only Environment, owner/actor/repo/SHA fencing, zakres credentiala, prywatne nazwy/piny, instalacja bez lifecycle oraz wykonanie bez credentiali pozostają bez zmian. Żaden workflow, sekret, pakiet prywatny, produktowy grant, Source UNMETERED, infrastruktura, migracja live, deployment ani wywołanie providera nie jest zmieniane przez tę poprawkę. Po aktywacji rollback to zwykły przeglądany revert wyłącznie tej klasy, z zachowaniem historii i obowiązkiem świeżego proof.

Owner acceptance in the same execution chat (2026-11-05): „Zatwierdzam poprawkę CI i dalsze przyjęcie”. This accepts the completed four-file PR905 proposal32c261c527d52501442a29178a461a5e1ba037a2 and its PR904/39-file review. The preceding DRAFT status records preparation before that decision. Activation still requires exact trusted-main bootstrap proof, mandatory checks and controlled main acceptance; no live migration, deployment, Render configuration or paid call is authorized.

## Zamknięty przegląd SDK1.34 / TE Markets — PR915

Osobna propozycja dopuszcza wyłącznie PR915, gałąź `architecture/source-hub-te-markets-20261106` oraz 77 dokładnych wersji plików kandydata `1739f9ef55dd758837701d249955901fb97b7df0` względem `4628637868ed8eeb109d1f10ff4bff35bc6f6c07`. Wersje blobów, statusy, regularne tryby100644 i trasy trzech właściwych profili są zamrożone w SOURCE_HUB_MARKET_SYMBOL_REVIEW. Nie jest to ogólne dopuszczenie konsumentów, testów, Canon ani workflow. Nawet zredukowany PR915 nie może wrócić do ogólnej klasy producenta. Dokładny HEAD jest nadal sprawdzany z API i w proof.

Jawna zmiana peer Maps0.1.2 dodaje tylko SDK1.34 do istniejącego zakresu; przejście przed przyjęciem wymaga powyższej zamkniętej klasy, właściwego blobu, identycznej nazwy/wersji i spójnego lockfile. Historyczna klasa1.33 i wszystkie jej fingerprinty pozostają bez zmian. Rekonstrukcja historycznego testu oddziela1.33 od późniejszego przyjęcia1.34.

Przed aktywacją tej czteroplikowej poprawki wymagane jest osobne zatwierdzenie właściciela kontrolera, testy bez sekretów, bootstrap ze starego zaufanego main i właściwe bramki. Po przyjęciu wymagany jest nowy exact-SHA trusted-main proof dla PR915 i wynikowego main. Nie zmieniają się workflow, sekret, main-only Environment, prywatne piny ani format proof. Revert tej poprawki usuwa tylko nową klasę i przejściepeer; nie cofa produktu ani baz. Pakiet M1 nie zastępuje odrębnej zgody na kontroler.

Owner decision (execution chat,2026-11-06): „Zatwierdzam poprawkę CI i dalsze kontrolowane przyjęcie”. This accepts the completed four-file PR918 proposal99fb044364c29eb5335346229c26e9b03e78e4ca / patchSHA256afc63f92038968704dfeca656eeaba26d19257924d607c2bab9c69f3c523661a and its exact PR915/77-file review. The preceding PROPOSED status records preparation before this decision. Activation still requires old trusted-main exact-SHA bootstrap, mandatory checks and controlled acceptance; this record adds no workflow, secret or infrastructure change.

Final pin update proposed after full SRM CI: three current-digest projections in two already-reviewed tests now include the latest SDK1.34 adoption layer; all historical records remain immutable. Only those two test blobs and the two corresponding SG2/SRM receipt blobs change within the same77-file closure. Controller logic, controller-test logic, paths, statuses, modes and owner routes are identical to the approved initial proposal. Existing owner approval remains a historical record for that original pin; this exact four-pin replacement requires separate owner acceptance before activation. Source candidate `1739f9ef55dd758837701d249955901fb97b7df0`; current base `4628637868ed8eeb109d1f10ff4bff35bc6f6c07`. Targeted seven unique assertions and complete paired current/historical validator PASS.

Final four-pin owner decision (execution chat,2026-11-06): „Zatwierdzam aktualizację czterech fingerprintów i dalsze przyjęcie”. This accepts PR918 proposal8aa83a4ca5a476b12233a836444ced754b56475f / deltaSHA256e037a31caabe8f0501d3b3f64c29c170f6ce2fbeee602f888a08364392c9b1c3, exact PR915 candidate1739f9ef55dd758837701d249955901fb97b7df0 and the same77 reviewed file paths. The preceding pin-update proposal records its earlier pending status. No controller logic, controller tests, permissions, workflow or credentials change through this decision record. New exact-head trusted-main bootstrap and all mandatory gates remain required.


## Exact Insights G1 adoption — PR848, 2026-11-07

The owner's final-design execution request explicitly authorizes controlled merge of847/848/CIC18/921 and directs the minimal properly owned trusted CI correction needed by848. This is the actual new scope; old per-PR approvals are not transferred. [Decision and exact review](../evidence/2026-11-07-procurement-insights-g1-ci-admission.md).

INSIGHTS_G1_REVIEW is restricted to the existing PR848, its original `governance/procurement-insights-g1-20261101` branch and four frozen real file blobs/statuses/regular100644 modes. Only that exact PR/branch pair is classified as Architecture before the full closed review; there is no new generic governance prefix. Changed/missing/extra/renamed/duplicate files, another PR/branch, SG2 fallback, fork, actor or stale expectedSHA fail closed. All existing owner/routing/ALIGNED, actual Git/API/tree/blob/realpath/size checks remain. Technical main refresh may preserve the same four blobs; the current expectedSHA must still exactly match GitHub.

The separate `sg2/` bootstrap keeps ARCHITECTURE ownership and its own PMOS. It must pass the old trusted-main exact-SHA proof and required checks before controlled merge. Only then may the new main controller validate848 and produce its fresh source-bound proof. Workflow, Environment/main-only rules, private package names/pins, credential scope, install-without-lifecycle and credential-free execution stay unchanged. Existing historical classes/fingerprints remain untouched. Rollback is a reviewed revert of this class alone; no product, database or deployment rollback is implied.


## Proposed exact Newsfeed saved-search review — PR969

OWNER_DECISION_PENDING. This separate controller proposal admits only PR969,
branch `architecture/pi-end-to-end-20261110`, and its18 exact blob/status/mode/owner
entries at source `8fa964a159a468968293337c9d0c79c326cb84e5`, base `1e0dc1ca4057437805561a841105e291d028df10`.
No general runtime, Canon, workflow or SDK permission is introduced. A different
PR/branch, missing/additional/changed/renamed/duplicate file, wrong owner, symlink
or executable mode is refused. A technical main refresh may preserve only the
identical18 source blobs; current expected SHA still has to match GitHub HEAD.

Activation requires a separate controller-owner decision, full policy tests, the
old trusted-main exact-SHA proof for this bootstrap and controlled acceptance.
Then PR969 and resulting main require fresh trusted-main proof under the new
policy digest. Existing historical fingerprints, private package pins, main-only
Environment, credential scope and credential-free execution remain unchanged.
No live migration, runtime grant, source policy, paid call, deployment or Render
change is authorized by this proposal. Rollback is a reviewed revert of this
closed class alone. Additional evidence and the owner decision packet live in PHR.

Owner decision in the execution chat, 2026-11-10: “Zatwierdzam poprawkę CI i dalsze przyjęcie”.
This accepts the three-file PR971 proposal and its exact PR969/18-blob review at
`8fa964a159a468968293337c9d0c79c326cb84e5`. The preceding pending status records
preparation before that decision. Trusted-main exact-head bootstrap and mandatory
checks remain required before controlled main acceptance. The decision grants no
live migration, deployment, infrastructure, entitlement or paid-provider action.

## Propozycja zamkniętego przeglądu Platform Knowledge G1 — PR999

DRAFT / CONTROLLER_OWNER_DECISION_PENDING. W ramach zleconego etapu pierwszego przygotowano wąskie dopuszczenie wyłącznie PR999, gałęzi `architecture/platform-knowledge-stage1-g1-20261111`, dokładnego HEAD `174cb59fd9770f1ced8d4b1108f6090934937a4f` i siedmiu zamrożonych blobów/statusów. Zestaw obejmuje dowód G1, trzy istniejące rejestry, harmonogram, instrukcję przygotowania Development i test routingu. Nie obejmuje kodu aplikacji, prywatnych pakietów, nowych nazw zależności, nowego workflow lub poświadczeń.

Inny PR, branch, HEAD, zmiana blobu/statusu, brak/dodatkowa ścieżka, rename/copy/delete, duplikat, symlink lub executable mode są odrzucane. Wcześniejsze klasy i fingerprinty pozostają niezmienione. Wszystkie siedem powierzchni musi rozstrzygać się na trusted-main jako Governance Source Layer / ALIGNED / ARCHITECTURE. Nie jest to ogólne dopuszczenie Canon, runtime lub pakietów Platform Knowledge.

Aktywacja wymaga odrębnej decyzji właściciela kontrolera, testów polityki, exact-SHA proof dotychczasowego trusted-main dla bootstrapu oraz kontrolowanego przyjęcia. Namespace `sg2/` bootstrapu jest wyłącznie transportem; profil, routing i PMOS pozostają ARCHITECTURE. Po aktywacji nowy main waliduje dokładnego PR999 i wymagany jest świeży proof oraz ponowienie publicznego weryfikatora. Digesty historyczne, main-only Environment, nazwy i piny prywatnych pakietów, zakres credentiala oraz wykonanie bez credentiali pozostają bez zmian. Revert tej zamkniętej klasy jest lokalnym rollbackiem polityki; nie cofa produktu lub danych.

[Pakiet decyzji i testów](../evidence/2026-11-11-platform-knowledge-stage1-ci-admission.md). Propozycja nie jest jeszcze aktywną zmianą authority.


## Prywatne cykle Procurement Insights — zamknięty przegląd PR995

Kontroler dopuszcza wyłącznie PR995, gałąź `architecture/pi-private-recurring-20261111` i pełny zestaw119 dokładnych blobów/statusów/mode100644 określony w PRIVATE_RECURRING_REVIEW. Przegląd przygotowano dla źródła `a5e271a60f7faf0c0a97deea70c2e78665066824`, względem przyjętego main `c4e0b750c7e7f32f9ae07c4274b90fc06378ebd4`. SHA256 kanonicznego JSON zestawu entries: `0e92b98f27170fb1345301025e4101bdc37d07290a0f2ea83b9c07cc5b8e22bd`. Techniczna aktualizacja podstawy jest dopuszczalna tylko przy wszystkich niezmienionych blobach, statusach i właścicielach. Obcy PR/branch/autor, fork, brak lub dodatkowy plik, duplikat, rename/copy/delete, symlink i executable mode kończą się odmową. Routing ARCHITECTURE / SG2 / SRM pozostaje rzeczywisty i jest weryfikowany na zaufanym main.

Nowy rekord źródeł `apps/architecture-lab/private-recurring-source.json`, SHA256 `9e9dd40ee05fb5c8889868f6c3b5282d74c6b05d68914b8652d16bbd1f0021c8`, wiąże364 źródła, trzy oddzielne przyjęcia konsumentów i jedenaście niezmienionych historycznych receiptów z `141cc559063c43cefa991acb9260b32ac5b92615`. Kontroler czyta wyłącznie ograniczone, regularne pliki i dane JSON; nie importuje kodu kandydata w fazie poświadczeń. Zaufany rekord dopuszcza tylko zamknięte peer lanes Maps0.1.2 / SDK1.36, current E1_1.3 i Hub1.7.1, z zachowaniem nazwy/właściciela, poprzedniej authority i dokładnych wersji. Nazwy lokalnych i prywatnych pakietów, registry piny oraz zakres tokenu pozostają bez zmian.

Historyczny Root candidate16 i jego receipt pozostają niezmienione. Nowy proof wiąże jego dokładne bajty z aktualnym sourceDigest `1722f1604df42aec084df0ff7610240a25e687caffd58547dbed320a200676ed` przez powyższy rekord; nie podmienia historycznego fingerprintu. Statyczny układ dodaje wyłącznie jawne zależności assistant i recurring-job, bez wykonania źródeł przy tokenie. Wszystkie flagi aktywacji w rekordzie są false. Publiczne CI Source Hub i Package & Limits muszą osobno przejść rzeczywisty exact-candidate routing/proof.

Decyzja właściciela z czatu wykonawczego zatwierdziła korektę polityki, jej osobny bootstrap, controlled proof i dalsze przyjęcie po wszystkich bramkach. Pierwotny pakiet obejmował117 wersji, entrySet `f10c5d6f22e268dcb3e4c41f144950be939356464f41950c5bf62ab1af76a7ba` i rekord `01286674ac9f0e6ae7cc9d02ea716c284ca7c69b15344525fa1556cfac6df138`. Po równoległym przyjęciu precyzji ECR i osobnej zgodzie na jednoliniową poprawkę awatara SRM końcowy zestaw ma119 wersji: dochodzi wyłącznie pomocnik akceptacji precyzji ECR i zatwierdzony ekran logowania SRM, a rekord/pomocnik/adopcje dostają ich nowe dokładne piny. Zgoda wykonawcza obejmuje aktualizację tych pinów; osobna decyzja właściciela zatwierdza dokładnie jednoliniową poprawkę SRM. Pomocnik ECR zachowuje przyjętą równolegle historię, bez zmiany funkcjonalności. Status: **OWNER_SCOPE_APPROVED / CONTROLLED_CI_PENDING**. Przyjęcie jest dopuszczalne wyłącznie po pełnym dowodzie i wymaganych bramkach dla końcowych wersji.

Kolejność: testy nowej polityki i pełny przegląd trzech plików → osobny bootstrap PR z profilem ARCHITECTURE i dotychczasowego namespace sg2/ → exact-SHA proof dotychczasowego trusted-main i obowiązkowe CI → kontrolowane przyjęcie polityki → świeży proof dokładnego HEAD PR995 pod nowym digestem → wszystkie bramki PR995 → dozwolony merge i proof wynikowego main. Nowa polityka nie jest obejściem testów SRM/SG2 ani zgody deploymentowej. Revert tej zamkniętej klasy pozostawia historię i wcześniejsze dopuszczenia. Dodatkowe dowody i handoff trafiają do PHR; nie powstaje lokalny pakiet dowodowy. Ta zmiana polityki nie wykonuje migracji, grantów, płatnych wywołań, zmian Render ani deploymentu.


## Końcowa zgodność SG2 z prywatnym SDK — kontynuacja PR995

Status przygotowania: **OWNER_APPROVED / CONTROLLED_CI_PENDING**. Trusted-main proof43021942865 dla źródła eaac2c79 wykonał1374 testy głównej grupy:1364 PASS i10 FAIL. Wszystkie porażki dotyczyły czterech testów źródłowego przyjęcia SG2: wersji zainstalowanego SDK1.36 wobec historycznej1.34, bieżących digestów i dwóch brakujących wpisów w kontroli pokrycia zakresu. Nie jest to dowód PASS. Korekta porównuje aktualne instalowane bajty z uwierzytelnionym nowym rekordem, a bajty producentów/historyczne receipty nadal z ich niezmiennymi Git blobami; negatywne testy dryfu pozostają.

PRIVATE_RECURRING_FINAL_REVIEW obejmuje wyłącznie ten sam PR995/branch i123 dokładne regularne bloby kandydata `c48bc060ad6dd2d2ba51e198d9a29a33d4d22030`: dotychczasowe źródła, cztery wymienione istniejące testy SG2 i pięć wynikowych pinów metadanych. Entries SHA256: `4764a4c5a77d84f7751626ab77fcba4b204b134e9e71f4fb282ea46275f1eec9`; nowy rekord367 źródeł: `ae3641b3a874922a95d7dfc0cc4b3a2f758595e0b60a5b1d197b84b85cb19432`. PRIVATE_RECURRING_REVIEW i PRIVATE_RECURRING_PROVENANCE z przyjętego PR1006 pozostają bajtowo niezmienione, z oryginalnym119-elementowym zestawem0e92b98f i rekordem9e9dd40e. To osobny zamknięty następca, bez nadpisania poprzedniego fingerprintu.

Brak otwarcia ścieżek, wersji, ownerów, workflow, tokenu lub uprawnień. Pełna lista API/Git/tree/blob, actual HEAD, routing trzech właścicieli, ograniczone pliki, brak wykonania kandydata w fazie poświadczenia, historyczne receipty i false activation flags nadal są wymagane. Zastosować tę samą zaufaną ścieżkę bootstrapu i nowy controlled proof dokładnego źródła; wcześniejszy FAIL ani proof innego SHA nie zastępują walidacji. Nie wykonuje się żadnej migracji lub deploymentu w tej poprawce. Dowody i handoff pozostają w PHR, bez lokalnych pakietów.

Decyzja właściciela w czacie wykonawczym, 2026-11-11: „Zatwierdzam tę deltę CI i dalsze przyjęcie”. Dotyczy trzech plików PR1009, czterech dodatkowych testów SG2 i wynikowych pinów zamkniętego123-elementowego zestawu PR995, SHA2564764a4c5a77d84f7751626ab77fcba4b204b134e9e71f4fb282ea46275f1eec9. Pierwotne119 fingerprintów pozostaje niezmienione. Nowe przyjęcie nadal wymaga exact-head controlled proof, pełnego CI i kontrolowanego merge; osobne wcześniej zatwierdzone czynności Development pozostają zależne od przyjęcia kodu.


## Pozostała kontrola FRESH — zamknięta delta PR995

Status: **DRAFT / CONTROLLER_OWNER_DECISION_PENDING**. Po przyjęciu PR1009 trusted-main proof43030318502 dla dokładnego źródła5b6e34be wykonał1374/1374 testy głównej grupy bez pominięć. Następny osobny krok zatrzymał się na czterech przypadkach w istniejącym `apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs`: odczyty aktualnego SDK1.36 nadal porównywano ze starszym przyjęciem1.34. To rzeczywisty FAIL całego proof, nie PASS. Minimalna korekta tego jednego pliku weryfikuje bieżący SDK i jego digesty przez uwierzytelniony rekord; historyczne producer Git bloby, receipty i negatywne testy dryfu pozostają.

Proponowany PRIVATE_RECURRING_COMPLETION_REVIEW obejmuje wyłącznie PR995, tę samą gałąź `architecture/pi-private-recurring-20261111`, źródło `710ca9054870cf3c7ec007bfa3e253ab01d5e831`, bazę `1abc68e248334fbdf03d1741561158fde020a27b` oraz124 regularne bloby/statusy/ownerów. Zestaw entries SHA256 `e575efe03510f7096e2cdfd7119880be79d0fdf1c28dac37d479b4af67846782`; rekord368 źródeł `75877d5750e07d1c8172be0af76bc5933f2eeefc22cc39747a2621b9cab24619`. Względem przyjętego123-elementowego zestawu dochodzi wyłącznie powyższy test; zmienia się pięć wynikowych pinów rekordu/pomocnika/trzech adopcji. Pozostałe118 wersji z tego zestawu są identyczne. Obie przyjęte klasy119 i123 oraz ich rekordy pozostają niezmienione. Nie zmienia się kod produktu, workflow, Environment, sekret, infrastruktura, wymagane testy, piny prywatnych pakietów, format proof ani zakres credentiala.

Ta osobna dokładna delta wymaga decyzji właściciela kontrolera przed jej aktywacją. Przygotowanie Draft nie aktywuje polityki. Po zgodzie wymagane są pełne testy, dotychczasowy trusted-main proof bootstrapu, kontrolowany merge, świeży proof dokładnego PR995 i obowiązkowe CI; wcześniejszy FAIL lub inny SHA nie zastępują dowodu. Wszystkie granice routing/API/Git/tree/blob/owner, odrzucenie dodatkowych lub zmienionych ścieżek i wykonanie po usunięciu credentiali pozostają. Dowody i handoff trafiają do PHR, bez lokalnego pakietu.

Decyzja właściciela w czacie wykonawczym, 2026-11-11: „Zatwierdzam tę dokładną deltę i dalsze przyjęcie”. Dotyczy wyłącznie trzech plików PR1011, jednego dodatkowego testu FRESH i pięciu wynikowych pinów zamkniętego124-elementowego zestawu PR995, SHA256 e575efe03510f7096e2cdfd7119880be79d0fdf1c28dac37d479b4af67846782. Status decyzji: OWNER_APPROVED / CONTROLLED_CI_PENDING. Przyjęcie nadal wymaga pełnego exact-head proof, CI i kontrolowanego merge. Obie wcześniejsze klasy119 i123 pozostają niezmienione; techniczna aktualizacja podstawy zachowuje dokładne124 bloby.


## Procurement Insights — domknięcie wejścia, biblioteki i jawnego kontekstu

DRAFT / OWNER_DECISION_PENDING. Propozycja zastępuje nieaktywowany pięcioplikowy szkic PR1015, zgodnie z nowym właścicielskim zadaniem zamknięcia etapów1–7. Kandydat PR1014 `f76fdf30ed10131c94a869ce6790ca50b534339d`, gałąź `architecture/pi-neutral-shell-routing-20261111`, baza `a9194acae09132e6570fe8071bf327125ebb8577`, zachowuje równoległą rejestrację1016. PRIVATE_RECURRING_SHELL_REVIEW obejmuje dokładnie18 regularnych blobów/statusów/ownerów, zestaw SHA256 `9833b46d3daf5335c5166919be7fe40544c8f408c42ed4b809fb2d7c86176ac9`.

Zakres produktu: przyjęta neutralna strona PL/EN bez rozszerzania API; Biblioteka raportów jako domyślna, kompaktowe wydania, filtry na serwerze przed paginacją20, jawny harmonogram wspierany przez profil, potwierdzenie rzeczywistego kopiowania linku i wybór uprawnionego materiału dla wspólnego asystenta. Nowe zamknięte przyjęcie źródeł zachowuje wszystkie16 wcześniejszych receiptów/rekordów. Baza kontynuacji1ab05e29 jest wcześniejszym kandydatem tego samego PR, nie deklaracją jego przyjęcia na main. Zestawy119/123/124 i rekord368 pozostają bajtowo niezmienne. Nie zmienia się autoryzacja, SDK, migracja ani grant.

Osobna trzyplikowa propozycja kontrolera wymaga jawnej decyzji ownera przed aktywacją. Bootstrap `sg2/` zachowuje profil ARCHITECTURE, PMOS, stary trusted-main proof oraz wszystkie wymagane checki. Dopiero kontrolowany merge polityki dopuszcza nowy exact-head proof PR1014. Inny PR/branch, zmieniony lub dodatkowy blob, rename/delete/copy, symlink i executable mode nadal są odrzucane. Lista ownerów wynika wyłącznie z zamrożonych entries; dotychczasowe zestawy nadal wymagają tych samych trzech profili. Nowy digest polityki unieważnia poprzednie proof. Bez zmian workflow, Environment, credentiali, prywatnych pakietów i historycznych fingerprintów. Draft nie oznacza przyjęcia, deploymentu ani odbioru LIVE. Dowody i handoff trafiają do PHR.

Zaufany kontroler przed dostępem do niezmiennego rekordu368 uwierzytelnia nowy receipt ukończenia dokładnym Git blob ID, następnie wszystkie13 bieżących źródeł oraz16 zachowanych receiptów względem ich dokładnej bazy. Dopiero po tej kontroli danych udostępnia jawny poprzedni widok do historycznych asercji. Nie importuje i nie wykonuje kodu kandydata w fazie z credentialami. Niezmienny rekord368, Root/SDK, receipt operacyjny i jego provenance są nadal sprawdzane; nowy proof wiąże dokładny kandydat i nowy digest kontrolera.

## PI — zgodność z przyjętym równoległym main 12 listopada

OWNER_APPROVED / CONTROLLED_CI_PENDING. Właściciel zatwierdził dokładny zestaw21, SHA2562879e91d5a653714e131711893db6172789d3f56a8ef5e5dd3a9ef56f317cc01, słowami „Zatwierdzam dokładną deltę CI i dalsze przyjęcie”. Zgoda właściciela z 12.11 na pierwotny pakiet18 wersji pozostaje zachowana. Kandydat PR1014 01f348e8f9520861c80e6ef1c85845d73bea7131 względem ec8afc3a6ec3501c97f4af49425626f868572b8a obejmuje21 dokładnych wersji; zestaw SHA256 2879e91d5a653714e131711893db6172789d3f56a8ef5e5dd3a9ef56f317cc01. Trzy dodatkowe ścieżki to istniejące testy Architecture Market Calendar, SG2 ECR weeks i SG2 PCI source coverage. Zachowują wszystkie asercje i przypadki negatywne, zmieniając tylko kolejność walidacji zamkniętych manifestów. Bez nowych funkcji produktu, SDK, autoryzacji, migracji, grantów lub workflow.

Osobna klasa PRIVATE_RECURRING_SHELL_CURRENT_REVIEW zachowuje pierwotne18 entries oraz przyjęte klasy119/123/124 i rekord368 bajtowo. Zaufana projekcja uwierzytelnia20 bieżących źródeł i17 niezmiennych receiptów względem przyjętego main924f803f, jako dane przed historycznymi kontrolami. Nie wykonuje kodu kandydata z credentialami. Aktywacja tej delty wymaga osobnej decyzji, pełnych testów, bootstrapu ze starego trusted main, nowego controlled proof i kontrolowanego merge. Inne pliki, wersje, PR, branch, owner lub tryb są odrzucane. Dowody wyłącznie PHR.

## PI — zgodność z przyjętym Calendar i rendererem Oil

OWNER_DECISION_PENDING dla nowej dokładnej kompozycji; wcześniejsza zatwierdzona klasa21 i wszystkie historyczne zestawy pozostają bajtowo niezmienione. Kandydat PR1014 `0c5a6ce71127f13402a14b256745e0fb0ffd5a1d`, baza `42e9d43ea846a5e6216faa18bfec8f939aac6971`, zachowuje przyjęte Calendar1043/1044 i Oil975/1049/1050. PRIVATE_RECURRING_SHELL_CALENDAR_REVIEW obejmuje21 regularnych wersji, entries SHA256 `e5472bb16f11fcc2e8e997f8b15e6568b6f6b01ddc79d90f22d57c23507d01ec`.

Neutralny routing middleware jest już na main, więc opuszcza własny diff. Dochodzi wyłącznie istniejący test integralności konsumenta Calendar, z zachowaniem jego wszystkich asercji. Zmiany pozostałych plików obejmują konieczne połączenie trzyzakładkowego Calendar z istniejącym UI PI oraz walidację dokładnych źródeł. Zaufana projekcja uwierzytelnia20 źródeł i20 niezmiennych receiptów, w tym nowy przyjęty receipt renderera Oil. Nie importuje kodu kandydata z credentialami. Przyjęty kontroler Oil, zabezpieczenie trybu plików i pełne negatywne testy są zachowane.

Nie zmienia się zakres produktu, SDK, autoryzacja, SQL, granty, workflow, poświadczenia, retencja ani polityki. Ten nowy zamknięty zestaw wymaga odrębnej decyzji przed aktywacją. Dalsza ścieżka pozostaje niezmienna: testy polityki i źródeł → bootstrap exact-head ze starego trusted-main → wszystkie checki → kontrolowany merge polityki → świeży proof PR1014 i wymagane CI → kontrolowane przyjęcie. Poprzedni proof jest historią, nie dowodem dla nowego SHA. Dowody wyłącznie PHR.

## PI — poprawny transport zgody na monitoring, bez zmiany decyzji E1

OWNER_DECISION_PENDING. Proponowany PRIVATE_RECURRING_CONSENT_TRANSPORT_REVIEW rozszerza wyłącznie istniejący PR1014, gałąź architecture/pi-neutral-shell-routing-20261111, kandydat 19002e5b43e4546552c541e691dff7432990a9e2, bazę 99cd4aa1591ba2fc3a387ce637f920dac74880be. Zestaw27 regularnych źródeł, entries SHA256 b09ab1e109ba131a3d44c059d51546fc5ac6e56456eaf7472835f8bd78b1c5d7. Poprawka usuwa błędne odrzucanie małej litery s w tokenie Bearer. Prawidłowy niebiałoznakowy token jest przekazywany do aktualnego centralnego E1; jego odmowa pozostaje odmową. Negatywne kontrole długości, schematu i whitespace pozostają. Nie zmienia się protokół, granty, migracje, polityki, Source ani warunki kosztowe.

Kontynuacja uwierzytelnia dwanaście dokładnych źródeł oraz20 niezmiennych receiptów, a następnie odsłania poprzedni widok0c5a6ce7 dla dotychczasowych asercji. Zachowuje równoległe poprawki Calendar1052 i wszystkie wcześniejsze klasy119/123/124/18/21, ich źródła, fingerprinty i testy. Nie importuje kodu kandydata w fazie credentiali. Nowe sześć ścieżek to jedna poprawka SDK, jej test, testowy pomocnik i dokładny rekord źródeł oraz dwa istniejące pliki publicznego routingu CI. Publiczny routing wymaga całego zamkniętego27-elementowego diffu, rzeczywistych ownerów, regularnych plików i kompletu uwierzytelnionych źródeł; nie uznaje pojedynczej ścieżki za dowód. Zmiana dwóch dotychczasowych pomocników oraz CSS zapewnia kompozycję z przyjętym Calendar, bez przepisania historycznych receiptów.

Wymagana osobna zgoda na ten zamknięty zestaw przed aktywacją. Dalej obowiązują pełne bramki, trusted-main exact-head proof, kontrolowany merge polityki i źródeł oraz niezależny odbiór Development. Przygotowanie kodu nie stanowi zgody na nowy rollout lub aktualizację konfiguracji. Dowody i decyzja w istniejącym PHR, bez lokalnego pakietu.


## PI recurring consumer test continuation — exact29 proposal

Status: **PROPOSED / OWNER_DECISION_PENDING**. The accepted exact27 admission is unchanged. Real source validation43221540407 found one historical shell-source assertion still targeting the predecessor four-file closure; public SRM43221506527 found six historical SDK comparisons in two existing consumer tests. No runtime or identity failure is concealed.

The prepared continuation changes only those three existing tests, the matching public routing test and three resulting transport test/source-record files. SRM reads the independently authenticated current transport digests separately from its unchanged historical manifest. The shell negative tests cover the actual twenty-file completion closure; middleware is independently compared to accepted main and the PL/EN authorization cases remain.

PRIVATE_RECURRING_CONSUMER_TEST_REVIEW admits only the existing PR1014/branch and29 exact regular file versions at af1e774d277b04e63d974158ad96b70885c30d83, entries SHA2564dc65bcc37bcc7a5fe06fb1d77bc4ca23dd7db2db67ea6847045fdf7a09f103f. All22 other versions from the exact27 set and all20 immutable receipts are preserved. The existing27 class, every older class and historical fingerprint remain byte-identical. The trusted reader selects only an exact known record Git blob and validates15 current sources before historical projection, without importing candidate JavaScript in the credential phase.

This separate three-file policy proposal requires the owner's explicit decision for the two additional test paths and five revised pins, then original trusted-main exact-head bootstrap, all mandatory checks and a normal merge. The source requires a fresh proof and resulting-main CI afterwards. Existing approved version bindings, eight nonsecret Save only values and NF→SG rollout remain dependent on accepted code; their authority is not expanded or requested again. No workflow, credential, schema, product grant, provider call, model call, infrastructure or deployment is changed by this proposal. Rollback is a reviewed revert of this new bounded class only. Evidence stays in the existing PHR record.


## PI live acceptance corrections — proposed exact eleven-file continuation

OWNER_DECISION_PENDING. PR1058, branch `architecture/pi-live-acceptance-corrections-20261112`, initial candidate `ff221387a047f64afe7b48945732ac47447d7ce6`, base `df2214265e577ef653c35fa18a38c717ffe8905e`; entries SHA256 `6df2cc5cdd3d6e15291b508f22cd25f487d50fb53be296fb2ff056250acf9260`. Only two runtime repairs are admitted: exact saved publication navigation and separation of transaction/independent report connections, preserving the total ceiling of two per role. Tests and a separate data-only source continuation preserve all22 historical receipts from82bcb788. No historical fingerprint, workflow, private package pin, grant, schema or secret is changed.

The new trusted projection authenticates every one of the ten current sources and all22 current/historical receipt digests before exposing the exact previous accepted graph. It never executes candidate JavaScript. Unknown files, changed blobs/modes, wrong PR/branch/actor/fork and widened record flags fail closed. This proposal requires its own controller-owner acceptance, old-main bootstrap, full CI, new exact-candidate controlled proof, normal merge and resulting-main proof. Preparation does not authorize activation or deployment. Earlier approved classes remain byte-identical.
