# Calendar — naprawa historii kontrolowanego CI i zachowanie bieżącej polityki

Status: **PROPOZYCJA NIEAKTYWNA — wymagana decyzja właściciela**. Development, istniejące zadanie Calendar Complete Functional Delivery. Ten dokument nie oznacza wdrożenia ani odbioru biznesowego.

## Dokładny przedmiot decyzji

Zatwierdzenie źródła `e1728a034e40e0a7004cff7b61bbe79094b145a6`, polityki `44c3517fb79b61371ece06802ba33c35de4c0bff`, opartej na rzeczywistym `main` `c4965a445867601275cbb75dc4de993123414ba2`, oraz ograniczonego, jednorazowego sposobu jej przyjęcia opisanego poniżej. Polityka zmienia dokładnie trzy pliki względem tego main. Wspólny wniosek obejmuje też źródło `e1728a034e40e0a7004cff7b61bbe79094b145a6`: dwie korekty danych testowych w jednym pliku oraz odświeżenie dwóch plików odcisków, łącznie trzy własne pliki źródła.

Względem zatwierdzonego źródła R6 `3b078cf760901c810acd27618f781e027e0d6af5` zachowano **80** postimages. Trzy zmienione pliki to `controlled-package-ci.test.mjs` oraz rekord i walidator `calendar-current-main-source`. Lista **83** ścieżek, ich statusy, tryby i ownership pozostają niezmienione. Wszystkie pliki funkcjonalne produktu i wcześniejsze receipts zachowują zaakceptowane bajty. Ich zakres pozostaje bez zmian: 15 rzeczywistych serii EIA, cztery oficjalne harmonogramy, powiadomienia opt-in, potwierdzenie doręczenia i testy negatywne. Ta decyzja nie dodaje funkcjonalności ani uprawnień do produktu.

- [Dokładny commit proponowanej polityki](https://github.com/profitia/SG-dev/commit/44c3517fb79b61371ece06802ba33c35de4c0bff).
- [Dokładne źródło do przeglądu](https://github.com/profitia/SG-dev/commit/e1728a034e40e0a7004cff7b61bbe79094b145a6).
- [Pełny diff trzech korekt źródła względem R6](./2026-11-18-calendar-ci-history-recovery-source.diff).
- [Pełny diff trzech plików polityki](./2026-11-18-calendar-ci-history-recovery-policy.diff).
- [Wyniki i odciski](./2026-11-18-calendar-ci-history-recovery-validation.json).
- [Diagnoza pierwotnej odmowy](./2026-11-18-calendar-ci-history-recovery-diagnosis.json).
- [Poprzednio zatwierdzony pakiet R6](https://github.com/profitia/SG-dev/blob/e4697e8913273caa02eade109a2bafc49daa8843/Canon/evidence/2026-11-18-calendar-pk-r6-owner-decision.md).

## Przyczyna wymagająca uzupełnienia decyzji

[Oryginalny kontrolowany przebieg 44382232260](https://github.com/profitia/SG-dev/actions/runs/44382232260) uruchomiono z trusted main `608efe22d4a994d4cdbfcddc111c0dfd4732d698` dla dokładnego HEAD PR #1206 `3d275ff6457607270e1ea0b77e60dacf61013f84`. Etap „Validate candidate files without executing candidate code” zakończył się odmową `CONTROLLED_CI_FAILED_CLOSED`. Instalacja, wykonanie kandydata i wystawienie kontrolowanego dowodu zostały pominięte. Dwa artefakty zwykłych kontraktów SG2/SRM nie są takim dowodem.

Diagnoza odtworzyła ograniczony checkout trusted control: domyślny fetch-depth 1 nie zawiera historycznego `03eb7c82853ecac617544d81abc61e1350af383b`, wymaganego do weryfikacji zaakceptowanego źródła Knowledge. Błąd powstaje w `assertLocalPackageSources` → `knowledgeStage2Filesystem`, przy odczycie historycznego `apps/sg-runtime/operation-integration.json`.

Dla tego samego oryginalnego kandydata i niezmienionego kontrolera samo pobranie autentycznej historii usuwa tę odmowę; kontrola lokalnych pakietów i zgodność kontraktu przechodzą. Jest to **diagnoza prywatna, bez kanonicznego proof**, a nie zamiennik nieudanego przebiegu.

Następnie przyjęty równoległy #1204 zmienił wspólny kontroler i jego testy. Propozycja zachowuje cały przyjęty zakres SDK z `c4965a44`, zamiast przywracać wcześniejsze wersje plików.

[Canon v3 §10.1](https://github.com/profitia/SG-dev/blob/c4965a445867601275cbb75dc4de993123414ba2/Canon/v3.0-profitia-agent-execution-canon.md#101-mandat-i-ponowne-używanie-zgód) wymaga nowej decyzji, ponieważ trzy własne pliki źródła różnią się od zatwierdzonego `3b078cf7`, dokładne chronione bajty polityki różnią się od `045d6d78`, dochodzi jeden plik workflow i potrzebna jest jawna ścieżka przyjęcia poprawki samego CI.

## Zmiany

1. Trusted control nadal pobiera dokładnie `${{ github.sha }}`, z nieutrwalanym poświadczeniem; otrzymuje `fetch-depth: 0`, aby móc weryfikować wymagane historyczne wejścia. Kontekst main-only, Environment i uprawnienia `contents:read`, `actions:read`, `packages:read` pozostają obowiązkowe.
2. Kontroler zachowuje nowy trzeci argument walidacji przejść pakietów SDK. Dokładny przegląd Kalendarza otrzymuje oddzielny czwarty argument. Obie walidacje zachowują własne warunki; przegląd Kalendarza nie może podszyć się pod tabelę przejść SDK. Lista 83 dopuszczonych ścieżek R6 pozostaje identyczna. Dokładne odciski trzech korekt, nowy źródłowy SHA i aktualny bazowy main zostają jawnie związane nowym zamkniętym przeglądem.
3. Testy zachowują wszystkie przyjęte scenariusze SDK i Kalendarza oraz sprawdzają rozdzielenie argumentów, pełną historię trusted control, dokładny SHA, brak utrwalenia poświadczenia i niezmienione uprawnienia joba.

Nie dodano rekordu zwykłego dopuszczenia dla chronionych plików: obecna procedura takiego dopuszczenia ich nie obejmuje. Nie użyto cudzej zgody ani historycznego wyjątku innego zadania.

4. W dwóch historycznych testach kopia **bieżących** wejść kontrolera pochodzi teraz z rzeczywistego katalogu aktualnego źródła. Zamknięty historyczny fixture nadal obsługuje stare dane i asercje. Kopiowana jest pełna, dynamiczna lista `CONTROL_POLICY_FILES`, obecnie **12** pozycji, w tym dwa nowe wejścia odcisku z #1204. Nie pominięto żadnej asercji. Odciski rekordu 579 plików i jego walidatora zostały odświeżone. Pierwsza wspólna próba 713/715 PASS (dwa błędy ENOENT) pozostaje zapisana, a poprawiona kompozycja ma odrębny dokładny wynik.

## Weryfikacja propozycji

- Źródło `e1728a034e40e0a7004cff7b61bbe79094b145a6`: **308/308 PASS**, 0 FAIL, 0 SKIP; 25 modułów źródła.
- Dokładna kompozycja `d7c6651c242fb982226bcfd8ee00542908eb20fa` źródła i polityki: **715/715 PASS**, 0 FAIL, 0 SKIP; pełne 18 modułów governance.
- Bieżące testy obu granic polityki: **25/25 PASS**; obie naprawione regresje: **2/2 PASS**; zamknięty graf źródła: **11/11 PASS**.
- Rzeczywiste uwierzytelnienie 83 plików kompozycji, całego diffu, pochodzenia, trybów i granic pakietów: **PASS**.
- Weryfikacja jest prywatna, bez instalacji z tokenem i bez oryginalnego kontrolowanego artefaktu GitHub. Wszystkie wcześniejsze nieudane próby pozostają w dowodach.


Powyższe wyniki prywatne służą ocenie propozycji. Nie są oryginalnym artefaktem GitHub Actions ani dowodem wydania. Dokładne publiczne przebiegi i wynikowe main pozostają wymagane w opisanej kolejności.

## Jednorazowy sposób przyjęcia

1. Po decyzji ponownie odczytać main, PR #1206, okno dwóch wspólnych plików CI i aktualne kontrole. Zachować wszystkie równoległe zmiany. Zwykły transport potomny jest dopuszczalny wyłącznie przy identycznej kompletnej liście trzech plików oraz ich postimages/statusach/trybach z manifestu. Konflikt wymagający nowych chronionych bajtów nie jest objęty tą decyzją.
2. Opublikować dokładną propozycję w istniejącym #1206 zwykłym push, bez force, i uruchomić wymagane kontrole publiczne oraz `validate-sg2` z aktualnego zaufanego main dla dokładnego nowego HEAD. Zachować jego rzeczywisty wynik i log.
3. **Wyłącznie dla przyjęcia tej poprawki CI** dopuścić normalny merge #1206 z kontrolą oczekiwanego HEAD, jeżeli wszystkie pozostałe kontrole są poprawne, a jedynym brakiem pozostaje kontrolowany proof, którego zaufany poprzednik nie może wystawić z powodu potwierdzonego braku historii przed instalacją. Publiczny verifier może wówczas wykazywać tylko `CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA`. Oryginalnego failure nie wolno oznaczyć jako PASS. Inna przyczyna błędu zatrzymuje integrację. Bez admin/force merge, zmiany ochrony gałęzi, wyłączania jobów lub zamiany testów na wcześniejszy wynik.
4. Obowiązkowo wykonać pełny, kontrolowany przebieg **wynikowego main**, już z pełną historią trusted control. Wymagać rzeczywistej czystej instalacji, usunięcia poświadczeń przed wykonaniem, testów/typecheck/build, oryginalnego artefaktu, niezależnej weryfikacji jego bajtów, tożsamości przebiegu i controlPolicyDigest oraz poprawnych publicznych kontroli. Bez tego nie przyjmować źródła Kalendarza ani nie rozpoczynać aktywacji.
5. Dopiero następnie włączyć rzeczywisty zaakceptowany main polityki do wspólnego kandydata PR #1063. Zachować wszystkie 83 postimages zatwierdzonego w tym pakiecie `e1728a03` oraz historię pierwotnego R6. Bazowy przegląd wiąże rzeczywisty zaakceptowany `c4965a44`; wcześniejsze neutralne źródło PK pozostaje w zachowanej historii. Dla nowego dokładnego SHA wykonać zwykły kontrolowany przebieg źródła, zweryfikować jego oryginalny artefakt i pełne kontrole publiczne. Zintegrować normalnie i sprawdzić wynikowy main. **Jednorazowy sposób przyjęcia nie obejmuje źródła produktu.**
6. Wydanie pięciu istniejących zasobów Development wymaga osobnej kontroli świeżego LKG, bieżącej konfiguracji i powiązań oraz właściwego release GO dla znanego już dokładnego zaakceptowanego main. Ten pakiet nie przyznaje release GO dla nieznanego przyszłego SHA. Dotychczasowe zgody na zakres i operacje Kalendarza zachowują ważność.

Dla źródła zwykły transport potomny musi zachować pełne 83 postimages/statusy/tryby z manifestu. Sama zgoda na cel nie dopuszcza dodatkowych chronionych korekt.

## Stan biznesowy i przygotowanie Development

Business status: **IN_PROGRESS**. Nie wykonano migracji, nowych grantów, zapisu powiązań/config, deploymentu Kalendarza, pobrania nowych serii ani wysyłki e-maila w tej kontynuacji. PMOS/PHR zadania biznesowego pozostają otwarte.

Odświeżono odczyt pięciu istniejących zasobów, sześciu powiązań wersji, publicznej gotowości ECR/SourceHub/Identity i rzeczywistego widoku SG2. Mailgun EU `spendguru.app` jest dostępny; podpis przechowywany jest wyłącznie w prywatnym profilu wykonawczym. Uwzględniono nowe równoległe wdrożenie Identity `cfa76c86`; jego nowszej konfiguracji nie wolno cofnąć do wcześniejszego baseline.

Końcowy odbiór nadal wymaga 15 rzeczywistych serii i czterech oficjalnych harmonogramów w SG2, jednego oznaczonego e-maila z podpisanym statusem DELIVERED i odczytem skrzynki, odmowy ponownej wysyłki, opt-out i cofnięcia uprawnienia oraz potwierdzonej publikacji PMOS/PHR/MEMOROS.

Gałąź tego dokumentu służy wyłącznie przeglądowi dowodów. **Nie scalać jej jako poprawki CI ani źródła produktu**; właściwa adopcja dotyczy odrębnego commitu polityki i późniejszej zwykłej integracji źródła.
