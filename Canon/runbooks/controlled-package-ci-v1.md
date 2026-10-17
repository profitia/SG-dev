# Kontrolowany dostęp CI do prywatnych pakietów — v1

Profil ARCHITECTURE, TARGET_ENVIRONMENT=development. Repozytorium profitia/SG-dev jest publiczne. Ten mechanizm nie nadaje mu Manage Actions access do prywatnych pakietów, nie tworzy repozytorium/projektu, nie pobiera sekretów Render i nie wdraża produktu. Korzysta z obecnego workflow platform-contracts-ci.yml i aktywnego środowiska architecture-development / 24168168252.

## Granica zaufania

GitHub Environment dopuszcza dokładnie jedną regułę: main, type=branch, custom_branch_policies=true, protected_branches=false. Nie dopuszcza tagu main ani refs/pull/*/merge. Kontroler odczytuje rzeczywiste ID/politykę u dostawcy i porównuje je z aktywną topologią ARCHITECTURE; nie rozszerza reguł, aby przepuścić uruchomienie. Przed dodaniem tokenu należy potwierdzić istniejącą politykę i brak repo-level SG2_PACKAGES_READ_TOKEN.

Uprzywilejowany job działa z kontrolera z dokładnego SHA main i workflow_ref wskazującego main. Dopuszczone zdarzenia to push main i workflow_dispatch validate-sg2. Actor i triggering_actor muszą być profitia. Wskazany PR musi być otwarty, skierowany do main, utworzony przez profitia i pochodzić z gałęzi sg2/ tego samego repozytorium. Oczekiwany 40-znakowy SHA musi odpowiadać bieżącemu HEAD PR. Fork, obcy aktor/aplikacja/ref, zmieniony SHA lub brak jawnego przyjęcia kontraktu są odrzucane.

Weryfikacja PR oznacza dopuszczenie kodu przejrzanego w zaufanej gałęzi wewnętrznej. Nie uruchamiamy kodu forka z poświadczeniem lub prywatnymi pakietami. Ten model nie izoluje złośliwego administratora ani świadomie zaakceptowanego złośliwego kodu na main. Uprawnieni administratorzy mogą zmienić polityki GitHub; wymagany jest nadzór nad main, workflow i sekretami. Warunek if w YAML jest dodatkową kontrolą, a nie samodzielną granicą dostępu.

## Fazy wykonania i dowody

1. Zaufany kontroler odczytuje metadane GitHub i jawny operation-integration.json kandydata. Nie importuje jego JavaScript. Checkout kontrolera i kandydata jest oddzielny, dokładny i nie zachowuje poświadczenia Git.
2. Przed instalacją weryfikuje dokładną konfigurację npm oraz nazwy, wersje i sumy integralności prywatnych zależności względem lockfile na main. Dozwolone są advisory-widget, cic-core i cic-procurement; lokalny platform-contracts nie jest pobraniem prywatnego pakietu. Inny rejestr, ścieżka, niezatwierdzony pakiet lub zmiana pinów daje odmowę. Zmiana prywatnych wersji wymaga uprzedniego przeglądu authority, bez opcji skip.
3. SG2_PACKAGES_READ_TOKEN jest przekazany jako NPM_TOKEN wyłącznie do kroku instalacji. Kontroler pyta GitHub o właściciela, zakres i wygaśnięcie: tylko konto profitia, wyłącznie read:packages, przyszłe wygaśnięcie nie dalsze niż 31 dni. Brak/błędny token kończy job przed testami.
4. npm ci --install-links --ignore-scripts --no-audit --no-fund wykonuje czystą instalację bez lifecycle. Wyjście npm nie jest publikowane; własny cache jest usuwany. Token nie trafia do pliku .npmrc, argumentów polecenia, cache artefaktu ani proof.
5. Dopiero po zakończeniu kroku z tokenem uruchamiane są lifecycle, istniejący test:operation-context, typecheck i build. NPM_TOKEN, NODE_AUTH_TOKEN, GH_TOKEN oraz GITHUB_TOKEN są w tej fazie puste. Testy korzystają tylko z syntetycznego kontenera PostgreSQL16, bez połączeń produktu/PMOS.
6. Po sukcesie powstaje wyłącznie proof.json: dokładny kandydat, kontroler/main, run ID, kontrakt/digest i wyniki. Nie publikuje się node_modules, tarballi, .next, logów instalatora ani cache. Sekret nie jest dostępny w kroku proof.
7. Publiczny job SG2 nie instaluje prywatnych pakietów. Kontroler z authority sprawdza pochodzenie uruchomienia i artefaktu, dokładny SHA oraz kontrakt. Dowód dla innego SHA, innego workflow/aktora, porażki lub niepełnej walidacji jest odrzucany. Dla tego samego push main dopuszcza dowód już zakończonego uprzywilejowanego joba tego uruchomienia; dla zewnętrznego uruchomienia wymaga całego run conclusion=success. Brak dowodu nie jest zielonym pominięciem.

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
