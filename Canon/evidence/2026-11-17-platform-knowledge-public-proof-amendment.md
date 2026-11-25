# Platform Knowledge — korekta publicznej weryfikacji zatwierdzonego SDK

Stan: **PROPOSED / OWNER_CI_AMENDMENT_REQUIRED**. To ograniczona korekta dwóch plików chronionego CI. Pierwsza zgoda `ARCH-PK-STAGE2-TECHNICAL-GO-20261117` została udzielona w tym samym czacie i nadal obowiązuje dla zamrożonego wydania `123d4d7df165b73852724d5e09056424f4ce631a`, migracji, powiązań,11 grantów, istniejących zasobów, budżetu USD10/USD1 i odzyskiwania. Ten dokument nie prosi o ponowne zatwierdzenie celu ani tego zakresu.

## Potwierdzony wynik wykonania pierwszego GO

Opublikowano wspólny skład źródeł `906d102f24d974f1a99cd3d532fec5e0c007ae18` w istniejącym PR1019 oraz zatwierdzoną politykę `392136fd4b389370332cfa4284180ad66eb03115` w PR1093. [Rzeczywisty kontrolowany przebieg44043642667](https://github.com/profitia/SG-dev/actions/runs/44043642667) zakończył się **SUCCESS**, włącznie z prawdziwymi testami, typecheck i build po usunięciu poświadczeń. Oryginalny proof14311646306 pobrano bez przepisywania; ZIP SHA256 `e22bf68d464887496a2285c63f75ce08f76837b194e6bb3296390c8884a0762e`. Niezmieniony zaufany `assertProof` z765e995 przyjął go z rzeczywistą tożsamością run/candidate/control i digestem polityki `af5eae6d9a931fb7a25daf1fd62cc46c2fbb761b370e57ab15b21ae6931c4706`.

To nie jest publiczne CI PASS ani przyjęcie main. Publiczna kontrola pozostaje zależna od naprawy odczytu dużych plików w równoległym [PR1092](https://github.com/profitia/SG-dev/pull/1092). Tamta poprawka ma własną jawną zgodę właściciela; wykorzystujemy ją z zachowaniem jej dokładnego kodu i warunków przyjęcia. Nie tworzymy drugiej naprawy tego samego transportu.

## Nowa, rozstrzygnięta rozbieżność

Na rzeczywistych, zamrożonych źródłach biblioteki nowy producent wylicza kontrakt Root candidate16 z digestem `8e19bc106da0ff03f6ad2b50e9fd9c3ac9b95ebce1b55a4a18987a8311d50315`. Dotychczasowy niezależny publiczny weryfikator nadal używa starszej recepty receiptów i dla tego samego wejścia otrzymuje `1722f1604df42aec084df0ff7610240a25e687caffd58547dbed320a200676ed`.

Korekta wiąże publiczną receptę z tym samym, dokładnie uwierzytelnionym rekordem PK, który już zatwierdzono dla producenta. Wymagany SHA256 rekordu pozostaje `4e815bd8238285419a49a0f3a0718d7356a2ad9aafba214954004acd7f5d9ca9`; rekord jest danymi, nie importowanym kodem. Historyczny kontrakt i jego walidacja zostają zachowane. Przy obecnym, dokładnym rekordzie PK zmienia się wyłącznie oczekiwany digest na już zatwierdzony digest SDK. Zmieniony/stary/fałszywy rekord nadal daje odmowę; prawdziwy brak rodziny wiedzy zachowuje dotychczasową ścieżkę. Nie osłabiamy pełnego porównania kontraktu, integralności źródeł ani dowodu wykonania.

## Konkretny zakres dopuszczenia

Kotwica nowego kandydata polityki: **`c5ba5f23a6552e29faef3109873bcbd4c2f41749`**; aktualna podstawa **`3dbbac199a99d89bcb98e25fe4fd55b34bb1ba6a`**, z zachowaniem równoległego CIC #1074. Zatwierdzony wcześniej commit392136fd i osobno zatwierdzony transport1092 są rodzicami/zachowanymi wejściami; nowe bajty dotyczą dwóch plików:

| Plik | SHA256 pełnego proponowanego pliku |
| --- | --- |
| `scripts/governance/controlled-package-ci.mjs` | `e5401a50b6fda4da3b972c3d9cb52dd8600130a51ccb359c0cd3f33ad6022719` |
| `scripts/governance/controlled-package-ci.test.mjs` | `0ac7dfcf6febabbbb81eb73fa12cc2e9ceaa748c250b37de0374dfe07ee9b770` |

Patch względem poprzednio zatwierdzonej polityki: SHA256 **`96466f56c372334e2272f54d916c365e458ad0d3890da31dd30548195bc00797`**. [Pełny patch](../proposals/platform-knowledge-stage2-sdk-20261111/public-proof-amendment.patch) i [maszynowy zakres/warunki](../proposals/platform-knowledge-stage2-sdk-20261111/public-proof-amendment.json) są nieaktywną propozycją. Wydanie aplikacji,92 pliki kompozycji,407-source record,15 historycznych receiptów, migracje oraz zakres kont nie zmieniają się.

## Walidacja

- **624/624 PASS** pełnej regresji governance/polityki,0 failures/skips.
- **651/651 PASS** pełnej regresji z rzeczywistymi źródłami PK,0 failures/skips.
- Nowy test na rzeczywistym składzie źródeł potwierdza zgodność publicznego kontraktu z kontrolowanym producentem; odrzuca sfałszowany lub stary rekord, zmieniony receipt i obcy profil. Cztery dodatnie/ujemne testy odczytu pełnych bajtów z1092 również przechodzą.
- Te wyniki są lokalnymi testami w Codespace. Ten nowy kandydat nadal potrzebuje własnego kontrolowanego CI, zwykłych wymaganych kontroli PR i CI wynikowego main. Wcześniejszy SUCCESS44043642667 nie jest przypisywany nowemu SHA.

## Ograniczone odświeżenia i kolejność

Decyzja może obejmować rutynowe odświeżenie transportu tego samego kandydata na niezwiązany nowszy main, aby nie powtarzać pytania z powodu samych rodziców commitu. Warunki są łączne: kotwica `c5ba5f23a6552e29faef3109873bcbd4c2f41749` pozostaje przodkiem; pełne dwa pliki mają dokładnie powyższe hashe, a trzeci zatwierdzony wcześniej test routingu pozostaje `a742682f9e12ba76f469b3c847df886ac3b936fd5f0666bb2a3d679598ea972d`; zachowane są niezwiązane zmiany authority; nie zmieniają się właściwe drzewa runtime/zależności ani zasady CI poza już włączoną poprawką1092; każda próba wskazuje rzeczywisty nowy expected_sha i przechodzi pełne wymagane kontrole. Zmiana tych bajtów/warunków nie jest delegowana.

Najpierw prawidłowe przyjęcie1092 i kontrola wynikowego main we właściwym zadaniu. Potem dopuszczenie tej korekty przez obecną ścieżkę polityki, świeży controlled proof dla jej dokładnego aktualnego HEAD, pełne wymagane CI oraz normalny merge i wynikowy main. Ten aneks **nie wnioskuje o wyjątek bootstrap, pominięcie kontroli, force/admin merge ani sztuczne zielone statusy**. Następnie automatycznie kontynuujemy pierwotne GO: exact release123d4d7d, migracje, enrollment/granty, Development deploy oraz rzeczywisty E2E. Zmiana SHA aplikacji nadal wymaga właściwej aktualizacji decyzji.

## Decyzja

Odrębna decyzja właściciela jest potrzebna, ponieważ pierwszy GO dotyczył dokładnych innych bajtów chronionej polityki CI. Zakres: **zatwierdzenie `ARCH-PK-STAGE2-PUBLIC-PROOF-AMENDMENT-20261117`, wskazanych dwóch plików i ograniczonych odświeżeń transportu, przez wymagane CI i kontrolę wynikowego main**. Pozostała zgoda trwa bez ponownego pytania; Etap3 i formalne kryteria Etapu2 nie są zmieniane. Niczego nie wdrożono i nie zainstalowano w bazach podczas przygotowania tego aneksu.
