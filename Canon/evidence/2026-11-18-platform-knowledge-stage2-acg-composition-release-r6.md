# Platform Knowledge — dokładna kompozycja ACG i techniczne wydanie R6

Decyzja proponowana: **ARCH-PK-STAGE2-R6-GO-20261118**. Stan: **DO DECYZJI WŁAŚCICIELA; BRAK AKTYWACJI I ODBIORU E2E**.

## Cel i przyczyna aktualizacji

Uruchomić na istniejącym Development rzeczywisty przepływ: dokument → Worker/OpenAI → PostgreSQL/pgvector → publikacja → autoryzowane wyszukiwanie → kontrakt CIC i adapter ACG ze źródłami → wycofanie/cache. [Kanon funkcjonalny v1.0](https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-platform-knowledge-business-and-architecture-canon.md) i formalne kryteria Etapu 2/3 pozostają bez zmian.

R5 zostało faktycznie zatwierdzone. Jego polityka b3838a8b i wynikowy main 5f3f91be przeszły wymagane kontrole; nie oznaczało to wdrożenia silnika. Następnie ACG #1142 zostało przyjęte na 53691e90. Integracja ujawniła stary priorytet hashy ACG nad bieżącym Knowledge w 12 testach SG2/SRM/Newsfeed oraz trzy niezgodne konteksty testów kontrolera. Poprawiono odwołania, zachowując wszystkie asercje, sześć oryginalnych napraw ACG i 33 historyczne receipty. Nie osłabiono testów ani źródłowej autoryzacji.

**Ta decyzja aktualizuje R5 dla nowych dokładnych bajtów źródeł, chronionego CI i jawnie opisanej selekcji końcowego SHA.** Jest wymagana przez [CORE §10.1–10.5](https://github.com/profitia/SG-dev/blob/main/Canon/v3.0-profitia-agent-execution-canon.md#101-mandat-i-ponowne-używanie-zgód). Niezmienione prawa, zasoby i budżet nie są ponownie rozszerzane.

## Zamrożone źródła i polityka

- Źródłowy freeze: **65b0e573f270ded93bfda088a88e736abc45f56a**, tree **16a90438b1f5cadbb46fb0f2eec9dd25361efc27**, istniejący [PR #1019](https://github.com/profitia/SG-dev/pull/1019). Podpis GitHub potwierdzony; zwykła historia poprzednich prac i accepted main zachowana.
- [Dokładny wykaz](../proposals/platform-knowledge-stage2-r6/closed-source-review.json): **145** plików, ARCHITECTURE 110 / SG2 21 / SRM 14. Każdy ma konkretny blob, status, mode i ownership. **478** raw inputs, **33** niezmienione historyczne receipty. Rekord SHA-256 **7bde334dda3ec7068d3cb532ccd8a94f3477cea707abe250431ee16c3b044bf4**; aktualny Root **93647cb57be869f7dfd5114d56b5ff8e9caaaae3e094d3eb5e6b793a61a56893**.
- Własne dwa pliki polityki: oryginalna podpisana propozycja **e105a31c8f9047f51cc8fd9b41b74afcbd565747**, normalny odświeżony transport **627f4bfa43b073c3228bbf8293f7fe4b82f88af2**, [PR #1194](https://github.com/profitia/SG-dev/pull/1194). Oba własne postimages są identyczne. Transport zachowuje accepted main **a03956b6752227a7a14e44887feabd50a0ad1054** i trzy przyjęte pliki Finder poza grafem 478.
- `controlled-package-ci.mjs`: SHA-256 **95845d9169f580f7a4316b33fb445a8d3d4a51426f6883bceb4a05ab3dcb1b36**. `controlled-package-ci-path-coverage.test.mjs`: **4404819247280bf631dd13f7782dbdb617353e1e214902952984fc3be1b5c9f3**.
- Policy-first zachowuje accepted ACG `controlled-package-ci.test.mjs` blob **13ac0dc1e997359e8da2452d841ec6887f36b31a**. Produkt ma jawnie przeglądany blob **a0f26ab670c49766e78b50cc801c879448ccc8f6**, obejmujący trzy poprawione konteksty. Ten plik jest w grafie 478.

Kontroler najpierw uwierzytelnia wszystkie aktualne wejścia Knowledge. Następnie stosuje dokładny zaakceptowany czysty guard ACG wewnątrz chronionej polityki, bez wykonywania helpera kandydata, i dopiero wtedy weryfikuje niezmienioną historię. Immediate Knowledge predecessor pozostaje osobnym, dokładnym widokiem. Aktualny proof używa rzeczywistego digestu SDK, nie historycznej wartości. Brak pliku, zmiana źródła, receipt, mode lub dodatkowy wpis nadal kończy się odmową.

Całe katalogi API/Workera Platform Knowledge, Identity runtime, Knowledge Core i Knowledge Contracts są bajtowo identyczne z R5. Zmiana SDK zachowuje przyjęte ACG; SQL006 nie jest instalowany przez PK. Nie przejmujemy nieprzyjętych źródeł Login/SDK1.38, Kalendarza, PI lub pełnego CIC host.

## Wyniki, które rzeczywiście istnieją

[Pełny zapis](../proposals/platform-knowledge-stage2-r6/predeployment-test-summary.json) oddziela prywatne testy, natywne CI i przyszłą aktywację.

- Pełna prywatna regresja **17 plików governance**: **686/686 PASS** policy-first i **687/687 PASS** produkt, 0 błędów i 0 pominięć; dokładne własne dwa postimages bez zmian. Były to konteksty na 2faf; późniejsze trzy przyjęte pliki Finder zachowano w 627f. To nie jest controlled proof nowego transportu.
- Natywne SRM dokładnego 65b0: [44329044347](https://github.com/profitia/SG-dev/actions/runs/44329044347), **1488/1488 PASS**, 0 skip; typecheck i rzeczywisty build PASS. Staging jobs SKIPPED, bez zmian Staging.
- Natywna integracja operacji SRM z izolowanym PostgreSQL: job 134888114758 w [44329044075](https://github.com/profitia/SG-dev/actions/runs/44329044075), **762/762 PASS**, 0 skip; rzeczywisty API, role, persistence, revocation, audit rollback i build PASS.
- Silnik PK [44329044286](https://github.com/profitia/SG-dev/actions/runs/44329044286), Newsfeed [44329045274](https://github.com/profitia/SG-dev/actions/runs/44329045274), ACG [44329045794](https://github.com/profitia/SG-dev/actions/runs/44329045794), Identity [44329044120](https://github.com/profitia/SG-dev/actions/runs/44329044120) SUCCESS. Łącznie 12/13 workflow źródła SUCCESS.
- Wspólne Platform CI pozostaje FAIL przed dopuszczeniem polityki i nowym dokładnym kontrolowanym proof SG2. Architecture contract ma 2130 PASS, 0 FAIL i 1 odziedziczony SKIP testu centralnego prywatnego konta; późniejszy governance odmawia brakującego eksportu nowego kontrolera. Nie przedstawiamy tego workflow jako PASS ani pominiętego testu jako E2E.
- **17/17** kontroli guardu selekcji wydania PASS: odrzucenie starego niespójnego SHA, podmienionych blobów, chronionej polityki i niedokładnego/brakującego CI; render SQL zmienia dokładnie 15 odwołań wydania. Są to jawne testy syntetyczne guardu, nie LIVE.
- Wcześniejsze błędy i przerwane próby zachowano. Nową disposable fixture przypięto do faktycznej review.baseSha; brak zaufanego main nadal jest odrzucany. Prywatne problemy loadera/cache nie zostały przemianowane na PASS; właściwe natywne CI SRM potwierdza poprawny kod w kompletnym środowisku.

## Jedna jawna zgoda na końcowy dokładny SHA

**Do Render trafi dokładny końcowy SHA, dla którego przejdą wymagane źródłowe CI, niezależny oryginalny controlled proof i przyjęcie źródeł, a następnie CI wynikowego main. Nie wdrażamy historycznego 65b0 z niekompletnym CI.**

Przyjęcie oddzielnej polityki tworzy nowy trusted main; zwykłe włączenie go do istniejącego PR tworzy nowy commit. R6 jawnie zatwierdza tę ograniczoną aktualizację SHA i odwołań wykonawczych, aby nie powtarzać decyzji dla samych metadanych commitu. Jest to właściwa aktualizacja granicy R5, a nie domniemana zgoda z samego FULL AUTOPILOT.

Dopuszczona jest wyłącznie mechaniczna kompozycja, w której: 65b0 i 627f pozostają w prawdziwej historii; bieżący trusted main jest włączony; wszystkie **145 własnych blobów/modes**, cały graf **478** i 33 receipty są identyczne; dwa własne pliki polityki zachowują powyższe hashe; przyjęte obce zmiany są zachowane. To obejmuje również normalne transporty polityki z zachowaniem identycznych dwóch własnych postimages. Zmiana któregokolwiek własnego bajtu, granicy, prawa lub budżetu wymaga nowej właściwej decyzji.

[Wykonawca selekcji](../proposals/platform-knowledge-stage2-r6/render-r6-selected-release.py) może przypiąć runtime wyłącznie po faktycznym GO R6 oraz gate zawierającym końcowy SHA, sourceAccepted, requiredReleaseCi i resultingMainCi PASS, sourceCiValidatedSha = sourceProofCandidateSha = wybrane SHA, rzeczywisty control SHA i hashe niezależnie sprawdzonych oryginalnych artefaktów. Wybrane źródło musi być potomkiem freeze i trusted control oraz przodkiem accepted main. Weryfikowane są wszystkie 145/478 wejść i oba pliki CI; gate ani nazwa brancha nie nadają praw dostawcy.

Publiczne wykonawcy i owner SQL są dokładnymi szablonami. Dozwolone podstawienie to jedynie końcowy SHA w oznaczonych miejscach oraz wyliczony hash wynikowego SQL; SQL ma dokładnie 15 odwołań wydania. Nie zmienia się DDL, adresat, scope, termin, grant ani operacja. Publiczne szablony pozostają niezmienne; osobny receipt wyboru i aktywne wyrenderowane bajty są kontrolowane względem ich opublikowanych hashy przed każdą operacją. Nie tworzy się fikcyjnego bezpośredniego GO człowieka dla nieznanego wcześniej commitu.

## Niezmienione granice i odzyskiwanie

- Development wyłącznie. Te same Neon: **sparkling-sky-79692560 / br-billowing-grass-b9ko5s4f / platform_knowledge** oraz **spring-bread-28217539 / br-sparkling-term-b99l107x / platform_private**. SQL001 **9a049aa46804f5fea4e84cb6dcedc4be358ffd983183ac7d21129b663654e9d7**, SQL015 **2122522771623b8becc5cd46b12aa87fd7d9f9a8e5fea82194335913458c630a**, SQL016 **66d4432cedf3364085624d9cc9a5166cb7958e82a0573d9da48df1711060fe9f** pozostają identyczne. Właściciel produktu przez zatwierdzonego migratora instaluje SQL001/016; centralny właściciel Identity SQL015.
- Dwa istniejące rodzaje bindingów API/Worker, 11 ograniczonych grantów konta **092c2d9f-a84b-4c18-b3d6-e172a61399b8**, do **11 grudnia 2026 23:59Z**; brak Memory i osobistego publish. Ten sam jednorazowy stale query grant ACTIVEv1→REVOKEDv2→ACTIVEv3. Brak nowej roli lub puli praw.
- Czasowe SET wyłącznie własnej istniejącej krawędzi `neondb_owner → profitia_access_owner` wewnątrz zatwierdzonych transakcji, z odtworzeniem obu członkostw przed COMMIT i niezależnym readback. Limit pozostaje **24 łączne transakcje centralne do 24 listopada 2026 23:59Z**; nie zerujemy dziennika. Krawędź cloud_admin bez zmian.
- Trzy istniejące usługi PROFITIA WORKSPACE, w kolejności **Identity srv-dbcse6jrjlhs73eib3sg → Worker srv-dbq6njec6qcc738fjf50 → API/panel srv-dbq6n2m7bikc73dmvs8g**. Te same sześć zapisów pojedynczych kluczy aktywacji, SaveOnly; osobny publiczny `IDENTITY_RUNTIME_EXPECTED_SOURCE_SHA` zsynchronizowany do tego samego dokładnego release, jak jawnie przewidziano w pierwotnym GO. Zachować build guard i AutoDeploy=no. Nie wdrażamy SG2/SRM ani nowych usług.
- Te same istniejące OpenAI i prywatny storage, **USD10 łącznie / USD1 na dokument**, te same trzy dopuszczone małe dokumenty i parser failure probe. Retencja raw ≤24h, wcześniejsze automatyczne usunięcie po sukcesie, Worker i recovery według kanonu. GIN i dokładny filtrowany ranking wektorowy1536; brak niezatwierdzonego ANN indeksu.
- Te same cztery niezmienione pomocniki transportu Render, istniejąca sesja operatora i klucz podpisu Workera. Brak nowego tokena, pożyczonej sesji lub eksportu poświadczeń dostawców do Codespaces. Kod/testy wyłącznie Codespaces; klient natywny tylko transport.
- LKG API **dep-dbq71vutlv9c73epgb2g**, Worker **dep-dbq72f5g1s2s739m10dg**, oba **1fef8b3837c1bdd6ea9ff95dd4e976cc71cf9526**; Identity **dep-dbq9bn0m7kps738pq75g / f78f5867064c96f4497e13bcd53c97af2da2e07a**. Odczytane ponownie, nadal LIVE. Brak Knowledge schematów/bindingów/grantów; pgvector0.8.6 istnieje, owner SET nadal false. Przed każdą mutacją świeży odczyt i kontrola cudzych nowszych wydań.
- Odzyskiwanie pozostaje zatwierdzoną alternatywą bez Render OCI digestu: najpierw zatrzymanie przetwarzania przez PK_PROCESSING_ENABLED=false, następnie dokładny source rebuild własnego LKG; dla Identity najpierw przywrócenie publicznego pinf78. Brak obietnicy binarnej identyczności rebuild, restore współdzielonej bazy lub cofania obcego LIVE. Zachować dodatnie schematy, audit, historię i koszty; nie ponawiać wyniku UNKNOWN bez rozstrzygnięcia.

Po GO: właściwe controlled/ordinary CI polityki i jej przyjęcie, normalne odświeżenie źródła, pełne dokładne source CI/proof/source admission i wynikowy main, przypięcie faktycznego release, trial/rollback i instalacja, readback grantów/owner restoration, konfiguracja i trzy dokładne deploymenty. Potem rzeczywisty import/processing/publish/retrieval/CIC-ACG/withdraw, odmowy scope i nieaktualnych grantów, persistence/ledger/koszty, recovery/retencja, API+Worker Sentry i panel w przeglądarce. Zwykłe uwierzytelnienie operatora; żadnych mocków w zastępstwie usług.

Stan tego pakietu: **0 trwałych migracji, 0 grantów/bindingów, 0 konfiguracji, 0 deploymentów, 0 importów, 0 płatnych wywołań**. PMOS ARCH/SG2/SRM RUNNING. Końcowy PHR/PMOS/MEMOROS i TECHNICAL DEPLOYMENT SUCCESS dopiero po rzeczywistych dowodach; formalny odbiór jakości Etapu2/3 pozostaje osobny.

## Dokładne załączniki

Manifest SHA-256: **e393702e79d79cdcd232a0b3a81eaea978662322dcaa0d8a8afd547107c4a1d9**.

| Plik | SHA-256 szablonu |
| --- | --- |
| [approved-policy-inputs.json](../proposals/platform-knowledge-stage2-r6/approved-policy-inputs.json) | af0d47b7f7a0bcb0bcec67551a2994283ddec1bdb8e66818092bb2124cbd4920 |
| [closed-source-review.json](../proposals/platform-knowledge-stage2-r6/closed-source-review.json) | 9a845a4a24970c4786fb3e8367f6f224283996f44d38681677375c9265fb4c9b |
| [execute-reviewed-identity-r6.mjs](../proposals/platform-knowledge-stage2-r6/execute-reviewed-identity-r6.mjs) | da6b4648089620216594c50d2be935ff95f41a5c8480df7e984fc34488e1f03f |
| [execute-reviewed-product-r6.mjs](../proposals/platform-knowledge-stage2-r6/execute-reviewed-product-r6.mjs) | 9315acded40714cececd477d10e1b7db155e9e4a520653baaf07477ce04c45fb |
| [identity-owner-install-r6.sql](../proposals/platform-knowledge-stage2-r6/identity-owner-install-r6.sql) | 956fd947842e64eef210d962ac14e3b7b1a912193c4a000e59ad43529dd96fee |
| [identity-release-pin-r6-envelope.mjs](../proposals/platform-knowledge-stage2-r6/identity-release-pin-r6-envelope.mjs) | 056117e2af3079ed7eb25190d7617adcd8d47bdf7fd2a40bb1463bd3fa2f153b |
| [live-stale-grant-probe-plan.json](../proposals/platform-knowledge-stage2-r6/live-stale-grant-probe-plan.json) | 629e479156261228872928684b21b9f44c39b56f0177846da32331851d05dc45 |
| [native-identity-release-pin-r6.py](../proposals/platform-knowledge-stage2-r6/native-identity-release-pin-r6.py) | 5cdd3b68e97c310f6e038d2cb3cd27d7d19eb2a76a3c12a8c8626df56d04e024 |
| [native-render-existing-session-bootstrap.py](../proposals/platform-knowledge-stage2-r6/native-render-existing-session-bootstrap.py) | 463edcdb3008c0ea786eacb08209a10fec4f52423ba25300890b39619460b44b |
| [native-render-operator-relay.py](../proposals/platform-knowledge-stage2-r6/native-render-operator-relay.py) | 3c2876367196e1a4e957a9849f3d576f87fde7273877c8627ab2d8e913dde340 |
| [pk-r6-execution-guard.mjs](../proposals/platform-knowledge-stage2-r6/pk-r6-execution-guard.mjs) | 2c6133d178f6a25c3f6e51c4d78b7ef161bfd1dfcd2f0abf5302389831af77e8 |
| [predeployment-test-summary.json](../proposals/platform-knowledge-stage2-r6/predeployment-test-summary.json) | 84d1eebb4570437335dc7710e81659dfb8aaef43929215fd9e92c53f701e2fee |
| [read-failed-parser-proof.mjs](../proposals/platform-knowledge-stage2-r6/read-failed-parser-proof.mjs) | 5e5dbaf95fa69ae70a6e6312246782340091448657fb78dd0cecfb1ba08c23fb |
| [read-stale-grant-cost-proof.mjs](../proposals/platform-knowledge-stage2-r6/read-stale-grant-cost-proof.mjs) | 4ab7b8219fa5b663271eb5d83e08abd2ab0d9c4b0100a325bd93a1210ae750c1 |
| [record-native-render-result.py](../proposals/platform-knowledge-stage2-r6/record-native-render-result.py) | 22b061a623ff1dff4651aa3342cff194ac9e885828757faf4d5d2cb75ca2efe9 |
| [render-native-execution-plan.json](../proposals/platform-knowledge-stage2-r6/render-native-execution-plan.json) | 1a79d1d1befa0b39a5ff6f2ad2d40eb58dffdf96d243967f85dfdf8ab95aa5f2 |
| [render-operation-envelope.mjs](../proposals/platform-knowledge-stage2-r6/render-operation-envelope.mjs) | 67722e6b19b972acb4dc2c14550defd190e2f934a912e3fd8715dfec27207247 |
| [render-r6-selected-release.py](../proposals/platform-knowledge-stage2-r6/render-r6-selected-release.py) | bca196229cd054474417cf2021aaee31a65301085833c127dc426ccd25382e0d |
| [stale-query-grant-restore-r6.sql](../proposals/platform-knowledge-stage2-r6/stale-query-grant-restore-r6.sql) | dc631b6f9ef3a748fcfd213ec27284f7f2233c47ee7fe6abdc543d2d9f04d5c6 |
| [stale-query-grant-revoke-r6.sql](../proposals/platform-knowledge-stage2-r6/stale-query-grant-revoke-r6.sql) | ab24024e1a6f4ce0c181ad59b24c3dffaeff1e8600eaa053bb72974a5792a2f1 |
| [execution-asset-digests.json](../proposals/platform-knowledge-stage2-r6/execution-asset-digests.json) | e393702e79d79cdcd232a0b3a81eaea978662322dcaa0d8a8afd547107c4a1d9 |
