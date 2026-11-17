# Platform Knowledge — skonsolidowane GO R3 dla Development

Decyzja: **ARCH-PK-STAGE2-R3-GO-20261118**. Stan publikacji: **PROPOZYCJA DO ZATWIERDZENIA, BRAK WDROŻENIA**.

## Wynik objęty decyzją

Uruchomić na istniejącym Development import dokumentu przez panel operatora/API, trwałe zadanie rzeczywistego Workera, opracowanie przez istniejący OpenAI, zapis wiedzy i embeddingów PostgreSQL/pgvector, publikację, autoryzowane wyszukiwanie oraz pobranie kontekstu ze źródłami przez istniejący CIC/ACG. Wycofanie ma odcinać wiedzę także przy ponowieniu zapytania z cache. Test obejmie odmowy, cofnięty grant, koszty, historię zadań, błędy Workera i usuwanie materiału.

Kanon funkcjonalny pozostaje [Platform Knowledge v1.0, revision 4](../v1.0-platform-knowledge-business-and-architecture-canon.md). Nie zmieniamy kanonicznego DoD Etapu 2/3. Sukces tego zlecenia jest kamieniem milowym technicznym; nie obejmuje pełnej prywatnej biblioteki w SpendGuru, pamięci między rozmowami, cyklu życia konta ani eksperckiej oceny wszystkich odpowiedzi końcowego asystenta.

## Dokładne źródła i przyjęcie jako spójna całość

- Podstawa zamrożenia R3 i polityki: `1888f0f707ab382e8886f31bedb5983e1f5a1026`. **Najnowszy zweryfikowany main przy publikacji: `4ffb545ecda7462be655f49a2ffc2f73bdddd6d8`**, po równoległym #1163. Zmiana obejmuje wyłącznie dwa pliki publishera CIC/AQC, poza zamkniętym grafem 458 źródeł PK; dwa pliki kontrolera pozostają identyczne z bazą propozycji. Zachować poprawkę #1163 w rzeczywistym merge walidacyjnym i wynikowym main. Zamrożone źródło artefaktu R3 pozostaje dokładnym SHA 8c1e7e3f; kontekst walidacji/transportu integruje aktualny main, bez przepisywania źródła i historycznych dowodów.
- **Wydanie do wdrożenia R3:** [`8c1e7e3fe9bfd719cce462ac21377916e791f32a`](https://github.com/profitia/SG-dev/tree/8c1e7e3fe9bfd719cce462ac21377916e791f32a), opublikowane na `architecture/pk-stage2-r3-review-20261117`.
- **Osobna propozycja polityki chronionego CI:** [`acf96efbf9eea206d05c80f660777bded98d6a16`](https://github.com/profitia/SG-dev/compare/1888f0f707ab382e8886f31bedb5983e1f5a1026...acf96efbf9eea206d05c80f660777bded98d6a16), branch `sg2/pk-stage2-r3-ci-review-20261117`. Samo opublikowanie branchy nie uruchomiło przyjęcia źródeł, PR-owego CI ani deploymentu.
- [Pełny zamknięty przegląd źródeł](../proposals/platform-knowledge-stage2-r3/closed-source-review.json): **114 plików**, ARCHITECTURE 100, SG2 9, SRM 5, dokładne hashe i tryby. Rekord Knowledge `0291175ed6bce7dde0d0c5d72abd4c8f75dd3a3e2fcc454b3a2110a298d626fe`; **458 źródeł i 32 zachowane niezmienione historyczne potwierdzenia**.
- SDK Root 1.37.0, Current E1 1.4.0, SourceHub 1.7.1. Zachowane istniejące granice pakietów oraz widoki Root 16/23. R3 zawiera obecny zaakceptowany Finder, Kalendarz 74 i politykę PI z #1160; nie importuje nieprzyjętego runtime Kalendarza 75 ani prywatnego kandydata Stage I logowania.
- Wykorzystujemy rozpoczęte #1019, #1033, #1034, #1035 i zaakceptowany kontrakt CIC #24. Zgoda obejmuje skoordynowane, atomowe przyjęcie tego dokładnego kompatybilnego zestawu z #1019 po wymaganych bramkach wszystkich trzech właścicieli; #1033/#1034 zachowują rodowód adopcji SDK. Starego zestawu CI z #1035 nie scalać w ciemno; ten zapis aktualizuje jego pakiet decyzyjny, zachowując historię.

## Nowe dokładne bajty chronionego CI

Dwa pliki propozycji `acf96ef…` pochodzą z przyjętego `main` 1888f0f7; ich przyjęta podstawa pozostaje identyczna także po #1163, zachowując późniejsze poprawki kontrolera i zasady innych projektów:

| Plik | SHA-256 |
| --- | --- |
| `scripts/governance/controlled-package-ci.mjs` | `ab88327a434dd1582575cfc9888d0a2bad1757d86c3a3eeb60f4f85c17aaddc7` |
| `scripts/governance/controlled-package-ci.test.mjs` | `71b4b6748a221424d30fc96cd7fa54aebef12c899e5eb242c99def0b23fa5c41` |

Zmiany dopisują dokładny nowy zamknięty przegląd R3 i selektor rekordu Knowledge; pozostawiają wcześniejszy przegląd R1 i jego dowody. Walidują rzeczywistą pełną różnicę, przodków Git, SHA, bajty i tryby w niezależnym checkout. Zachowują dotychczasowe asercje i dodają niezależny negatywny test R3 działający także na samym branchu polityki. Nie ma nowego ogólnego wyjątku peer dependencies: przyjęta polityka już dopuszcza SourceHub 1.7.1 z E1 1.4.0. Nie usuwamy testów ani strażników.

Dodatkowo R3 zmienia chroniony workflow [`krs-registry-ci.yml`](https://github.com/profitia/SG-dev/blob/8c1e7e3fe9bfd719cce462ac21377916e791f32a/.github/workflows/krs-registry-ci.yml), SHA-256 `25498e2272d290013f0a93651699c38e475688109efda6a1b05c8911d7aef9f9`: budowanie dokładnego źródłowego SHA w `source/`, niezależny rzeczywisty kontekst walidacyjnego merge GitHub w `validation/`, te same wymagane testy oraz kontrola pary źródło/merge. To wymaga nowej jawnej zgody na dokładne bajty. Workflow Platform Knowledge pozostaje identyczny z wcześniej zatwierdzonym R1 (SHA-256 `81d307634428957ec0336692928e51afe3296354f617eb20d0e82b7f174386d8`).

## Ustalone przyczyny i wyniki dotychczasowych testów

Problem obejmował niespójny wspólny zestaw źródeł SDK i odbiorców, użycie nieprzyjętych eksportów polityki przez publiczny routing oraz różnicę między dokładnym źródłem artefaktu a rzeczywistym kontekstem merge CI. Naprawiono routing bez importowania prywatnych eksportów CI, pełny zamknięty przegląd i selekcję właściwego widoku SDK. Trzy końcowe naprawy testów zachowują ich asercje: właściwy jednorazowo uwierzytelniony widok dla Findera/recurring, dokładny skończony peer Root 1.37 oraz dotychczasową zatwierdzoną syntetyczną próbkę routingu recurring.

[Załączony zapis kontroli](../proposals/platform-knowledge-stage2-r3/predeployment-test-summary.json) rozróżnia fakty:

- Na dokładnym R3 `8c1e7e3f…`: testy źródeł, SDK, publikacji pakietu, typów readonly, Findera, PI i SourceHub **67/67 PASS, 0 skipped**.
- Na R3 z nieaktywną propozycją dwóch plików polityki: pełna prywatna symulacja governance **677/677 PASS, 0 skipped**; test propozycji w jej własnym czystym checkout również PASS. To **nie jest wymagane GitHub CI ani source admission**.
- Native PostgreSQL/E1/Root/ACG **58/58 PASS** i PCI **68/68 PASS**, bez pominięć, na przodku `5196726aa142ef928b59f22f26d0689a9a74eb4d`. Kod Identity, PK runtime/migracji, SDK i ACG nie zmienił się od tego testu do R3; nie opisujemy tych przebiegów jako testów dokładnego późniejszego SHA.
- Historyczne nieudane próby i dowody pozostają zachowane. Nie przepisujemy ich na PASS.

**Warunki wykonania:** po GO przyjąć właściwą politykę normalną ścieżką PR, uruchomić pełne wymagane CI oraz controlled source admission dla rzeczywistej pary dokładne źródło R3 / walidacyjny merge GitHub i niezależnego przyjętego kontrolera. Zweryfikować wymagane kontrole i wynikowy `main`, oryginalny artefakt i niezależne proof. Dopiero ich PASS dopuszcza migracje oraz deployment. Sam ten dokument, 677 prywatnych testów lub LIVE/HTTP 200 niczego nie odbiera.

Zachować obce równoległe zmiany. Odświeżenie transportu/main/polityki jest dopuszczone wyłącznie przy identycznych zatwierdzonych własnych bajtach, ścieżkach i trybach, zachowaniu cudzych zmian oraz świeżych pełnych kontrolach. Ta decyzja nie zatwierdza nieznanego przyszłego wydania runtime: jeżeli obowiązująca bramka wymusi inne wdrażane SHA lub nowe własne bajty chronione, potrzebna jest rzeczywista aktualizacja decyzji.

## Migracje, role i ograniczone uprawnienia

Pozostaje zakres pierwotnego GO i aneksu wykonania: **SQL001 produktu** `9a049aa46804f5fea4e84cb6dcedc4be358ffd983183ac7d21129b663654e9d7`, **SQL015 centralnego Identity/E1** `2122522771623b8becc5cd46b12aa87fd7d9f9a8e5fea82194335913458c630a`, **SQL016 natywnego odbiorcy w bazie produktu** `66d4432cedf3364085624d9cc9a5166cb7958e82a0573d9da48df1711060fe9f` (SHA-256). Nie zmieniono bajtów migracji.

- Produkt: Neon `sparkling-sky-79692560`, branch `br-billowing-grass-b9ko5s4f`, DB `platform_knowledge`, migrator `platform_knowledge_migrator`, właściciel NOLOGIN `platform_knowledge_owner`. SQL001 i SQL016 wykonać w prawidłowej roli produktu. SQL016 nie tworzy alternatywnego katalogu użytkowników/uprawnień.
- Centralne Identity/E1: Neon `spring-bread-28217539`, branch `br-sparkling-term-b99l107x`, DB `platform_private`, właściciel NOLOGIN `profitia_access_owner`. Zastosować SQL015 i [dokładny payload właściciela R3](../proposals/platform-knowledge-stage2-r3/identity-owner-install-r3.sql). Wobec pierwotnego zatwierdzonego pliku zmieniono tylko 15 odwołań do SHA R1 na R3: 2 deploymentId i 13 source_ref. Schema, operacje, podmiot, zakres i wygaśnięcia są te same.
- Dwa logiczne powiązania odbiorców: API i Worker, zgodne po stronie centralnej oraz natywnej produktu; cel `PROFITIA_INTERNAL`.
- Operator `092c2d9f-a84b-4c18-b3d6-e172a61399b8`: **11 skończonych grantów** — Shared import/read/query/publish/withdraw/delete i Private import/read/query/withdraw/delete. Bez grantów pamięci, bez nowego katalogu uprawnień. Wygaśnięcie grantów/powiązań **2026-12-11 23:59Z**.
- Uprawnienie wykonania pozostaje do **2026-11-24 23:59Z**, wspólny maksymalny limit **24 transakcji** czasowego użycia właściciela centralnego. Wyłącznie własna krawędź `neondb_owner→profitia_access_owner`: SET false→true→false wewnątrz tej samej transakcji, dokładne odtworzenie członkostwa przed COMMIT. Krawędź dostawcy `cloud_admin` pozostaje bez zmian. Stan właściciela odczytać przed/po każdej próbie; wynik nieznany najpierw uzgodnić z bazą, bez ślepego ponowienia.

## Jeden ograniczony rzeczywisty test nieaktualnego grantu

Dodatkowa jawna zgoda obejmuje [dokładny plan](../proposals/platform-knowledge-stage2-r3/live-stale-grant-probe-plan.json) i załączone dwa pliki SQL: wyłącznie własny Shared `document.query` grant `cd095168-466f-581e-a99c-95fbc0db6912`, **ACTIVE v1 → REVOKED v2 → ACTIVE v3, maksymalnie jeden cykl**. Nie cofamy wersji ani nie przywracamy starego dowodu. Ten sam zwykły operator, sesja Clerk i zapytanie z cache mają dać allow → 403 → allow. Odmowa ma nie uruchomić płatnego wywołania ani zmienić budżetu; niezależny odczyt SQL potwierdza stan oraz koszty. Przywrócenie własnego grantu jest objęte zgodą także po niepowodzeniu fazy HTTP, po ustaleniu rzeczywistego zatwierdzonego stanu. Bez zmian obcych grantów, członkostw i bez dodatkowej puli transakcji ponad pierwotne 24.

## Dokładne istniejące usługi i sześć zapisów konfiguracji

Workspace Render **PROFITIA WORKSPACE `tea-d7lps8rbc2fs73cn80dg`**. Wszystkie operacje tylko Development. Istniejące usługi, bez tworzenia nowych:

| Usługa | ID | Ostatni potwierdzony LIVE / SHA do odzyskiwania |
| --- | --- | --- |
| PK API i panel operatora pod `/` | `srv-dbq6n2m7bikc73dmvs8g` | `dep-dbq71vutlv9c73epgb2g` / `1fef8b3837c1bdd6ea9ff95dd4e976cc71cf9526` |
| PK Worker | `srv-dbq6njec6qcc738fjf50` | `dep-dbq72f5g1s2s739m10dg` / `1fef8b3837c1bdd6ea9ff95dd4e976cc71cf9526` |
| Centralny Identity runtime | `srv-dbcse6jrjlhs73eib3sg` | `dep-dbq9bn0m7kps738pq75g` / `f78f5867064c96f4497e13bcd53c97af2da2e07a` |

[Dokładny plan konfiguracji i wdrożenia](../proposals/platform-knowledge-stage2-r3/render-native-execution-plan.json) obejmuje sześć zapisów pojedynczych kluczy: API `PK_PROCESSING_ENABLED=true` oraz publiczny `PK_CLERK_PUBLISHABLE_KEY` dla istniejącego issuer `unified-drum-7191.clerk.accounts.dev`; Worker `PK_PROCESSING_ENABLED=true`, `PK_E1_WORKER_KEY_ID=pk-development-7d109c436139e110`, przygotowany prywatny klucz podpisu E1 zgodny z zaakceptowanym publicznym SPKI; Identity `IDENTITY_CURRENT_E1_ENABLED=true`. Publicznego klucza Clerk brakowało w istniejącej konfiguracji API; jest konieczny dla zwykłego logowania panelu operatora. Nie powstaje nowy system tożsamości.

OpenAI, AWS/storage, DB i sekret Clerk pozostają w istniejących miejscach. Nie odczytujemy/nie publikujemy ich wartości. Nie tworzymy nowych usług, baz, kolejek, loginu Render ani tokenu. Kod, checkouty i dowody pozostają w GitHub Codespaces. Istniejący zalogowany oficjalny klient Render na komputerze służy wyłącznie jako transport operacji usługowych; publiczny wykonawca pobierany z Codespaces jest weryfikowany hashem i wykonywany w pamięci, bez lokalnego projektu. Istniejący token jest użyty prywatnie w pamięci tego klienta, nie kopiowany do Codespaces/logów/czatu. Nie wylogowujemy współdzielonej sesji.

Zapisy konfiguracji odbywają się pojedynczym kluczem **bez deploymentu**. Następnie osobny deployment każdej usługi z dokładnym `commitId=8c1e7e3fe9bfd719cce462ac21377916e791f32a`; nie wdrażać latest. Wykonawca wymaga GO o zgodnych hashach, pełnego PASS CI/admission/migracji, odtworzonych członkostw właściciela i świeżego zgodnego LIVE. Wcześniej zapisuje zamiar; wynik nieznany blokuje dalsze zależne operacje do uzgodnienia. Przed każdą mutacją sprawdza workspace, nazwę usługi, autoDeploy off, brak aktywnego deploymentu i dokładny własny oczekiwany LIVE; cudza zmiana oznacza stop zależnej czynności.

## Odzyskiwanie i zachowanie cudzych prac

Pozostaje zaakceptowana alternatywa bez dostępnego OCI digestu Render: odtworzenie z dokładnego uprzednio potwierdzonego źródła LKG powyżej, bez obietnicy binarnej identyczności przebudowanego artefaktu. Weryfikacja rzeczywistego LKG poprzedza mutacje.

Nowy wykonawca zawiera ograniczony tryb odzyskiwania wyłącznie własnych zapisów i prób deploymentu. **Przed odtworzeniem API/Workera zapisać `PK_PROCESSING_ENABLED=false` bez deploymentu**, gdyż poprzednia wersja Etapu 1 odrzuca flagę true; dopiero potem przebudować dokładny LKG. Save-only nie zatrzymuje już działającego procesu — wyłączenie stosuje deployment. Identity może odtworzyć tylko swój zapisany LKG. Dodatnie schematy, istniejące powiązania/uprawnienia oraz ewidencja finansowa i audyt pozostają; odtworzenie kodu nie jest cofnięciem migracji ani całego stanu konfiguracji. Nie wykonujemy restore współdzielonej bazy ani kasowania danych innych zadań. Cudzy LIVE lub nierozstrzygnięty wynik operacji wymagają uzgodnienia przed odzyskiwaniem. Klucze dodane na potrzeby funkcji pozostają nieaktywne przy wyłączonym przetwarzaniu.

## Test rzeczywistych usług po aktywacji

1. Zwykłe logowanie operatora Clerk, upload dopuszczonych własnych krótkich dokumentów referencyjnych, rzeczywista automatyczna praca Workera i monitoring stanu. Bez sesji administratora, impersonacji ani zastąpienia usługi mockiem.
2. Niezależny SQL potwierdza źródła, trwałe zadania/lease, jednostki wiedzy, embeddingi 1536, indeks tekstowy GIN i wektorowy ranking. Zatwierdzony SQL001 stosuje dokładne filtrowane wyszukiwanie wektorowe; nie obiecujemy nieistniejącego fizycznego indeksu ANN.
3. Publikacja, autoryzowane wyszukiwanie, kontekst rzeczywistego zaakceptowanego CIC i adaptera ACG ze źródłami; ten sam cache/query przed i po wycofaniu ma odciąć materiał. CIC bez nowych zmian runtime; przed próbą sprawdzić jego aktualny zaakceptowany kontrakt.
4. Brak tokenu/uprawnień, zły zakres, zmieniony lub nieaktualny dowód oraz jeden cykl cofnięcia/przywrócenia grantu mają poprawnie odmawiać. E1 pozostaje centralnym autorytatywnym źródłem.
5. Własny mały niepoprawny PDF sprawdza rzeczywisty błąd parsera Workera, trzy trwałe próby i stan FAILED, brak płatnych wywołań, audyt i rzeczywiste zdarzenie w Sentry. Osobny odczyt SQL i Sentry weryfikują wynik; sama odpowiedź API nie wystarcza.
6. Koszt z rzeczywistego provider ledger: **USD 10 łącznie / USD 1 dokument**, istniejący budżet i klucz OpenAI; bez nowych kredytów/modeli/usług. Rzeczywiste embeddingi oraz opracowanie wykona Worker.
7. Wycofanie i API delete, potem automatyczny cykl retencji Workera co 60 sekund potwierdzą usunięcie surowego obiektu i treści/embeddingów przy zachowaniu wymaganego rozliczenia/audytu. Sprawdzimy limit surowej retencji 24h; dowód natychmiastowego delete nie będzie opisywany jako obserwacja całych 24 godzin. Bez sztucznego backdating SQL i bez testowania pełnego cyklu życia konta Etapu 3.
8. Dokładne SHA uruchomionych trzech usług, schema/bindingi, przywrócenie właściciela, konfiguracja, Worker, koszty i monitoring zostaną zapisane w końcowym PHR. Dopiero rzeczywisty pełny wynik może dać TECHNICAL DEPLOYMENT SUCCESS; PMOS/MEMOROS muszą odpowiadać faktom.

## Relacja do wcześniejszych GO i zakres tej decyzji

Pierwotne GO `4153178f65cf99fe014fe02e798c130f26210353`, aneks public proof `c50893bd6fa4f3c8ba9260271abaf1c12e87c391` i aneks wykonania `df0384c9d48880c03b0355ec4e31b4ca5201b0d8` pozostają historyczne i ważne w niezmienionym zakresie. R3 aktualizuje dokładne wdrażane źródło, dwa pliki polityki CI oraz workflow KRS, source_ref instalacji, sześć ograniczonych zapisów konfiguracji, istniejący natywny transport i opisaną procedurę odzyskiwania oraz jeden cykl testowego cofnięcia własnego grantu. Nie zwiększa budżetu, limitu 24 transakcji, środowiska ani liczby zasobów.

CORE §10.1 wymaga decyzji właściciela przy zmianie dokładnego wydania oraz bajtów chronionego CI. Zgoda na całość tego zapisu zezwala wykonać pozostały zakres automatycznie po spełnieniu wszystkich bramek, bez ponownego uzgadniania celu. Nie jest obejściem required CI, bramek migracyjnych ani uprawnień.

Przy publikacji tego pakietu: **0 wykonanych migracji biznesowych, 0 zapisanych grantów/bindingów, 0 deploymentów, 0 płatnych wywołań, 0 importów dokumentów**. Zadania kontynuacyjne ARCHITECTURE/SG2/SRM pozostają RUNNING. Brak końcowego odbioru PHR/MEMOROS.

## Dokładne załączniki wykonawcze — SHA-256

| Załącznik | SHA-256 |
| --- | --- |
| [closed-source-review.json](../proposals/platform-knowledge-stage2-r3/closed-source-review.json) | `58ad2ffb331b2c79b2a5685d6b642337514eb1e6058b242147a37159e3ee2550` |
| [identity-owner-install-r3.sql](../proposals/platform-knowledge-stage2-r3/identity-owner-install-r3.sql) | `a9835ad9cf171f6de1ee966c434448ea90f103f181395b096f1489fde71a16cd` |
| [live-stale-grant-probe-plan.json](../proposals/platform-knowledge-stage2-r3/live-stale-grant-probe-plan.json) | `3165a1500f903811a84819c8f07ac609d247f63247b42d77c40958b8687be950` |
| [native-render-operator-relay.py](../proposals/platform-knowledge-stage2-r3/native-render-operator-relay.py) | `3c2876367196e1a4e957a9849f3d576f87fde7273877c8627ab2d8e913dde340` |
| [read-failed-parser-proof.mjs](../proposals/platform-knowledge-stage2-r3/read-failed-parser-proof.mjs) | `df2993b947f858bbdc9039cfe268c2e0dbb666dc87a440c4ed3754852f37833e` |
| [read-stale-grant-cost-proof.mjs](../proposals/platform-knowledge-stage2-r3/read-stale-grant-cost-proof.mjs) | `a79c1fc28629f1c2659e59360b76672cd06eca894b9e46ea32db0537712bc4a7` |
| [record-native-render-result.py](../proposals/platform-knowledge-stage2-r3/record-native-render-result.py) | `22b061a623ff1dff4651aa3342cff194ac9e885828757faf4d5d2cb75ca2efe9` |
| [render-native-execution-plan.json](../proposals/platform-knowledge-stage2-r3/render-native-execution-plan.json) | `4c51785d7d10e02b59a624e554d41438c82ff2c0091c732d519002470f65aa17` |
| [render-operation-envelope.mjs](../proposals/platform-knowledge-stage2-r3/render-operation-envelope.mjs) | `67722e6b19b972acb4dc2c14550defd190e2f934a912e3fd8715dfec27207247` |
| [stale-query-grant-restore-r3.sql](../proposals/platform-knowledge-stage2-r3/stale-query-grant-restore-r3.sql) | `3861918ac51a8aff591589b253566276203ee067bb813196365eeb062dd1e3d3` |
| [stale-query-grant-revoke-r3.sql](../proposals/platform-knowledge-stage2-r3/stale-query-grant-revoke-r3.sql) | `670a6472bb27668f755ebbd35338166cd9870970e80c607a61863cbd6be320cf` |
