# Platform Knowledge — skonsolidowany pakiet GO do technicznego uruchomienia Development

Stan 17 listopada 2026: **PROPOSED / OWNER_GO_REQUIRED / NIC NIE WDROŻONO**. Decyzja `ARCH-PK-STAGE2-TECHNICAL-GO-20261117`; ważność wykonania do 24 listopada 2026, 23:59 UTC. Ten dokument opisuje konkretny pakiet do decyzji i nie jest samodzielną zgodą. Oryginalne dowody i decyzje z 11 listopada pozostają historyczne i niezmienione.

## Przedmiot jednej decyzji

GO obejmuje jednocześnie publikację oraz prawidłowe przyjęcie poniższej zamkniętej poprawki CI, wspólnych źródeł ARCHITECTURE/SG2/SRM, trzech migracji, dwóch wpisów aplikacji i bindingów E1, jedenastu ograniczonych grantów operatora, konfiguracji oraz wdrożeń trzech istniejących usług Development i rzeczywistego testu technicznego. Osobnej decyzji wymagają te operacje na podstawie obowiązującego CORE §10.1/10.4/10.5 i runbooka aktywacji E1. Wymóg nie wynika z samej nazwy FULL AUTOPILOT.

## Dokładne źródła

| Element | Zamrożony SHA / identyfikator |
| --- | --- |
| Aktualna podstawa authority, z zachowanym równoległym przyjęciem Stage I #1086 | `765e995ca9b1eacef83a562b46e9c23876992e9b` |
| ARCHITECTURE, istniejący PR #1019 | `d6a923a77a675e08a36de7470fc79804d93c2289` |
| SG2, istniejący PR #1033 | `87b6326a60a7b581db280641545c2a47e8532ea6` |
| SRM, istniejący PR #1034 | `836374fed6500310a75d9546ef5026e7c1e29593` |
| Wspólna kompozycja 92 plików właścicieli | `906d102f24d974f1a99cd3d532fec5e0c007ae18` |
| Osobny commit proponowanej polityki CI, 3 pliki | `392136fd4b389370332cfa4284180ad66eb03115` |
| **Dokładny proponowany release API, Workera i Identity** | **`123d4d7df165b73852724d5e09056424f4ce631a`** |
| Drzewo tego release | `a771554b18ad7fb0e3101ea4201282f1b54548ca` |
| SHA-256 proponowanego patcha kontrolera | `9a95d3dc70ff04ebac214bb5fd0e079934ce86522f4192d08bc1046af5994261` |

Kompozycja, commit polityki i release są przygotowanymi obiektami Git w Codespace; nie zostały opublikowane ani przyjęte na main. Ich kompletne wejścia, 92 blob/status/mode/owner/surface oraz trzy poprzednie i proponowane hashe polityki są w [source-review.json](../proposals/platform-knowledge-stage2-sdk-20261111/source-review.json). Sama poprawka jest w [controller-amendment.patch](../proposals/platform-knowledge-stage2-sdk-20261111/controller-amendment.patch).

Release już zawiera commit polityki jako rodzica. Po jego prawidłowym przyjęciu kontrolowany workflow na trusted main może zweryfikować dokładnie ten SHA. Deployment jest dopuszczony wyłącznie po przejściu CI tego dokładnego release, normalnym przyjęciu źródeł i pełnym CI wynikowego main, potwierdzeniu ancestry oraz identyczności właściwych plików runtime i zależności z przyjętą authority. Zmiana bajtów aplikacji lub wymaganego release SHA wymaga aktualizacji tej konkretnej decyzji; pakiet nie deleguje dowolnego wdrażania zmieniającego się main.

## Co poprawiono i sprawdzono

Włączono aktualny main i zachowano równoległą politykę Stage I z #1086. Nie zmieniono istniejących prywatnych pinów pakietów. Zamknięty, jeszcze nieprzyjęty record PK uwierzytelnia 407 bieżących plików, 31 zastąpień i 25 dodatków; zachowano 15 niezmiennych receiptów. Uzgodniono kolejność uwierzytelnienia PK przed poprzednikami notification/Calendar/PI/registration oraz dokładne wersje peer dependencies Maps, E1 i Source Hub. Historycznych receiptów nie przepisano.

Zwykły rejestr source admissions nie może przyjąć zmiany wersji/peerów SDK ani plików workflow/Canon. Dlatego wykorzystujemy istniejącą, zamkniętą propozycję PK, odświeżoną do aktualnej polityki. Zmiana zachowuje automatyczny token Actions, preflight trzech prywatnych artefaktów, brak tokenów podczas testów, izolowany checkout wykonania, exact-source proof i wszystkie wcześniejsze dopuszczenia. Nie usuwa testów ani strażników integralności.

- Pełna lokalna regresja governance na aktualnej podstawie: **618/618 PASS, 0 fail, 0 skip** dla samej proponowanej polityki.
- Pełna lokalna regresja governance i powiązanych źródeł: **645/645 PASS, 0 fail, 0 skip** dla kompozycji z polityką.
- [Natywne CI silnika](https://github.com/profitia/SG-dev/actions/runs/44038723098): SUCCESS na ARCH wejściu `d6a923a77a675e08a36de7470fc79804d93c2289`; rzeczywisty PostgreSQL18.6, pgvector0.8.6 i parsery10 referencyjnych formatów w obrazie nonroot z izolacją Linux.
- [CI ACG](https://github.com/profitia/SG-dev/actions/runs/44038723012): SUCCESS na tym samym wejściu.
- Pełne GitHub CI wspólnego release: **jeszcze niewykonane**; potrzebuje najpierw dopuszczenia polityki przez właściciela. Nie przedstawiamy lokalnego PASS jako tego dowodu. Rzeczywisty Development E2E i wywołania płatne: **jeszcze niewykonane**.

## Migracje i granice ról

| SQL | Baza / wykonawca | SHA-256 |
| --- | --- | --- |
| Produkt SQL001 | `sparkling-sky-79692560` / `br-billowing-grass-b9ko5s4f` / `platform_knowledge`; istniejący `platform_knowledge_migrator` → `SET LOCAL ROLE platform_knowledge_owner` | `9a049aa46804f5fea4e84cb6dcedc4be358ffd983183ac7d21129b663654e9d7` |
| Centralny Identity/E1 SQL015 | `spring-bread-28217539` / `br-sparkling-term-b99l107x` / `platform_private`; istniejący `profitia_access_owner` | `2122522771623b8becc5cd46b12aa87fd7d9f9a8e5fea82194335913458c630a` |
| Odbiorca native SQL016 | ta sama baza PK i ten sam migrator → właściciel NOLOGIN | `66d4432cedf3364085624d9cc9a5166cb7958e82a0573d9da48df1711060fe9f` |

Przed instalacją rzeczywista próba w transakcji zakończonej rollbackiem i niezależne potwierdzenie braku skutku. Odczyt bazy potwierdził0 tabel produktu, vector0.8.6 i brak tabel knowledge centralnego E1. Migrator może przyjąć rolę właściciela; API i Worker nie są jego członkami. Centralny owner jest NOLOGIN; połączenie administracyjne służy wyłącznie do przyjęcia tej dokładnej roli w transakcji, bez wykonania instalacji jako administrator.

## Enrollment i ograniczone granty

Centralny registry nie ma jeszcze aplikacji `platform-knowledge-development-api` i `platform-knowledge-development-worker`. GO obejmuje wyłącznie ich dwa wpisy ACTIVE z `fixed_organisation_id=NULL`, dwie rejestracje knowledge_receivers oraz odpowiadające dwa native bindingi w PK. Wszystkie bindingi wskazują Development, właściwy project/branch/database/login role, hash SQL001 i dokładny release `123d4d7df165b73852724d5e09056424f4ce631a`. Nie tworzymy kont ani kopii uprawnień w PK.

Operator: `092c2d9f-a84b-4c18-b3d6-e172a61399b8`, potwierdzone konto ACTIVE/version1 i jedno aktywne powiązanie zewnętrznej tożsamości. Purpose `PROFITIA_INTERNAL`; expiry **2026-12-11T23:59:00Z**. Jedenaście dokładnych UUID grantów znajduje się w JSON:

- `PROFITIA_SHARED`: import, read, query, publish, withdraw, delete; jedynie publish ma `binding_standard=true`.
- `ACCOUNT_PRIVATE`: import, read, query, withdraw, delete; wszystkie `binding_standard=false`.

Brak grantów pamięci, nowych kont i automatycznego udostępniania organizacji. Testy odwołania/wygaśnięcia/przywrócenia dotyczą wyłącznie tych nowych grantów/delegacji. Issuer `https://unified-drum-7191.clerk.accounts.dev`, jedyna authorizedParty/origin API `https://platform-knowledge-development-api.onrender.com`.

Proponowany niepowiązany klucz Workera: `pk-development-7d109c436139e110`. Publiczna część w JSON; prywatna przygotowana z uprawnieniami0600 w odizolowanym Codespace, nieopublikowana, bez aktywnego uprawnienia. GO obejmuje związanie tej dokładnej publicznej części w E1 i umieszczenie prywatnej wyłącznie w istniejącym Render Workerze; po readbacku kopia robocza jest usuwana. Nie powstaje nowy sekret OpenAI ani nowy zakres dostępu do GitHub Packages.

## Istniejące usługi i konfiguracja

| Usługa Development | Service ID | Obecne LKG |
| --- | --- | --- |
| Platform Knowledge API i panel operatora | `srv-dbq6n2m7bikc73dmvs8g` | `dep-dbq71vutlv9c73epgb2g` / `1fef8b3837c1bdd6ea9ff95dd4e976cc71cf9526` |
| Platform Knowledge Worker | `srv-dbq6njec6qcc738fjf50` | `dep-dbq72f5g1s2s739m10dg` / `1fef8b3837c1bdd6ea9ff95dd4e976cc71cf9526` |
| Centralny Identity Development | `srv-dbcse6jrjlhs73eib3sg` | `dep-dbq9bn0m7kps738pq75g` / `f78f5867064c96f4497e13bcd53c97af2da2e07a` |

Workspace Render: `tea-d7lps8rbc2fs73cn80dg`. Wszystkie trzy usługi mają autoDeploy OFF. Wdrażany jest wyłącznie dokładny release z tabeli źródeł, po przyjęciu i CI. Najpierw Identity, potem Worker i API. Konfiguracja to merge wskazanych pól z istniejącą konfiguracją: processing=true, istniejące role DB z verify-full, publiczny klucz Clerk dla wskazanego issuer, klucz podpisu wyłącznie Workera i dokładny expectedSourceSha Identity. Pozostałe klucze, sekrety, bucket, Sentry, plany i niezwiązane funkcje Identity pozostają zachowane. Panel operatora jest istniejącym kodem serwowanym przez API; nie powstaje kolejna usługa.

## Koszty, test rzeczywisty i recovery

Budżet pozostaje **USD10 łącznie / USD1 na dokument**, z istniejącym OpenAI key i prywatnym bucketem `platform-knowledge-uploads`. Płatne żądania przed GO:0. Wykorzystamy istniejące dopuszczone syntetyczne dokumenty referencyjne, których archiwum z natywnego CI pobrano i zmierzono w Codespace. Sprawdzimy upload, rzeczywisty Worker, units/embeddingi/indeksy, publikację, autoryzowany retrieval, aktualny zaakceptowany moduł CIC i rzeczywisty adapter ACG → Development API, cache/revocation, koszty, persistence, retencję, recovery i monitoring API/Workera. Sam status LIVE ani HTTP200 nie będzie odbiorem. Pełna adopcja prywatnej biblioteki/pamięci, końcowa jakość odpowiedzi i formalny Etap3 pozostają poza zleceniem; prywatne host pins CIC nie są podmieniane dla tego technicznego testu kontraktu.

**Odrębny element tej samej decyzji GO: ograniczona alternatywa recovery.** Render nie ujawnia zmierzonego digestu zbudowanego artefaktu git-backed. Digest obrazu bazowego nie jest przedstawiany jako digest aplikacji. Dla tej jednej aktywacji Development proponujemy zamiast niego: dokładne zachowane provider deploy ID i source SHA, tylko wymienione zmiany konfiguracji, potwierdzenie dostępności odzyskania w Dashboard przed mutacją, istniejące24h historii Neon, natywne testy PostgreSQL18.6/vector0.8.6 i rzeczywiste owner-role SQL trial/ROLLBACK. Odczyt Dashboard pokazał zachowane opcje Rollback, w tym tę samą wersję foundation API `dep-dbq6s5mi0phs73bgeccg` i Workera `dep-dbq6sp6i0phs73bgfpmg`; dostępność bieżących LKG sprawdzamy ponownie po ich zastąpieniu. Brak wykonalnego odzyskania zatrzymuje zależną operację. Żadnego rollbacku jeszcze nie wykonano.

Po pojawieniu się danych pozostaje kompatybilny Worker etapu2 w trybie processing=false, wykonujący retencję. Nie cofamy bazy, cudzych deploymentów ani danych innych projektów. Odcięcie dostępu, tombstones, koszty i historia pozostają trwałe. Każdy kolejny zapis poprzedza świeży odczyt main, aktywnych deploymentów i stanu migracji; obca zmiana lub niezgodność zamrożonego zakresu blokuje dany zapis.

## Continuity i znaczenie wyniku

Kontynuacje PMOS: ARCH `cmwkbdly10000ggnmiawtu7vv`, SG2 `cmwkbdoxs0000ybwgqozg99mx`, SRM `cmwkbds8l00006tv1ye701i02`; wszystkie RUNNING, własne profile/PHR, istniejąca polityka MEMOROS zachowana. Historyczne zadania i receipts nie są nadpisane. Po realnym odbiorze powstanie właściwy końcowy PHR oraz closeout osiągniętego kamienia technicznego. Ten pakiet nie zamyka formalnego Etapu2 ani Etapu3.

Decyzja do udzielenia przez właściciela: **GO dla całego dokładnego pakietu `ARCH-PK-STAGE2-TECHNICAL-GO-20261117`, w tym polityki `392136fd4b389370332cfa4284180ad66eb03115`, release `123d4d7df165b73852724d5e09056424f4ce631a`, wymienionych migracji/enrollmentu/grantów/konfiguracji oraz opisanej ograniczonej alternatywy recovery.** Zgoda uruchamia automatycznie pozostały dozwolony przebieg, bez ponownego uzgadniania celu biznesowego. Brak GO nie jest zgodą.
