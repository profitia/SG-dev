# Platform Knowledge — aktualizacja dokładnego wydania R4

Decyzja: **ARCH-PK-STAGE2-R4-GO-20261118**. Stan: **PROPOZYCJA DO ZATWIERDZENIA; BEZ AKTYWACJI**.

## Zakres aktualizacji

GO R3 otrzymane w tym czacie pozostaje ważne w niezmienionym zakresie. [Pełny pakiet R3](https://github.com/profitia/SG-dev/blob/5997cf83f5686a09b2747edec77b74c013b813db/Canon/evidence/2026-11-18-platform-knowledge-stage2-development-release-r3.md) nadal określa funkcjonalność, trzy usługi Development, sześć zapisów konfiguracji, migracje, role, 11 ograniczonych grantów, dwa bindingi, budżet, retencję, E2E i odzyskiwanie. **Nie prosimy ponownie o to samo R3.**

Po jego zatwierdzeniu równoległy PR #1153 został przyjęty na rzeczywistym main F `d5eb40a061dd24c5ea65f9f373682179458cb589`. PI 1.2.1 zmieniło pięć wspólnych plików, w tym dwa lockfile, i ujawniło trzy konflikty. R3 nie zawierało tej przyjętej wersji PI. Nowy kandydat zachowuje ją i uwierzytelnia pełny zgodny zestaw bez przepisywania historycznych potwierdzeń.

**Nowa decyzja dotyczy dokładnego wdrażanego SHA, nowych własnych bajtów chronionego CI i wynikających z tego odwołań SHA w załącznikach.** CORE §10.1 i sama granica GO R3 wymagają rzeczywistej aktualizacji; nie traktujemy integracji jako zgody na nieznane przyszłe wydania.

## Dokładne źródła

- **Wydanie do wdrożenia:** [`617ae48d975e241e1df7d6b051ce586e0d5074bd`](https://github.com/profitia/SG-dev/tree/617ae48d975e241e1df7d6b051ce586e0d5074bd), branch `architecture/pk-stage2-r4-review-20261118`, tree `c7fd367b243c782e8f6134632ffc174d73bfaa5b`.
- Wydanie jest normalną podpisaną kompozycją rzeczywistego F i R3. **Całe katalogi runtime PK i Identity, SDK platform-contracts, PK Core/Contracts, ACG oraz migracje są bajtowo identyczne z R3 8c1e7e3f.** Nie ma nowej funkcjonalności, modelu, usługi ani systemu uprawnień.
- [Zamknięty przegląd](../proposals/platform-knowledge-stage2-r4/closed-source-review.json): **115 plików — ARCHITECTURE 100, SG2 10, SRM 5**, dokładne blob/status/mode/ownership. Graf zawiera **460 źródeł i 33 niezmienione historyczne potwierdzenia**, rekord `f48b0959976c01562f92669dacfc83829b31c8013af70ecd041a94bc3f39be6c`.
- Root **1.37.0**, Current E1 **1.4.0**, SourceHub **1.7.1**, PI **1.2.1**. Zatwierdzone wcześniejsze źródła i kontrakt CIC pozostają zachowane. Trzy wspólne hooki wykonują najpierw pełne uwierzytelnienie PK, następnie niezmieniony czytnik przyjętego PI. Dodatkowy dziesiąty plik SG2 to istniejący test integralności pakietu PI odczytujący ten sam uwierzytelniony poprzednik; wszystkie jego asercje pozostają.
- **Osobna nieaktywna propozycja CI:** [`233f288261a587f112b05f7dd6d9a4ec7df0ead2`](https://github.com/profitia/SG-dev/compare/67b81304e08d400aef5872839e24de39b8af8093...233f288261a587f112b05f7dd6d9a4ec7df0ead2), branch `sg2/pk-stage2-r4-ci-review-20261118`. Zachowuje przyjęte CIC #1178. Podstawa polityki `67b81304e08d400aef5872839e24de39b8af8093`; aktualny main przy przygotowaniu publikacji `0a56b29bde15fa5bed2d5ab67cd12757bec0c92a` (po przyjęciu polityki Calendar #1176).

| Chroniony plik propozycji | SHA-256 |
| --- | --- |
| `scripts/governance/controlled-package-ci.mjs` | `5a5ea7ea9c091e44ecf410ec1792cbfa71bda986e2b5342a8ee8ab9aa6db86fb` |
| `scripts/governance/controlled-package-ci.test.mjs` | `08e8bdd602d56a14406f9d474c205bc0f8552069df52094dcaf69a936c8f5177` |

Polityka zachowuje niezmienione przeglądy R1/R3 i dopisuje wyłącznie dokładny nowy przegląd 115 plików oraz rekord Knowledge. Nie dodaje ogólnego wyjątku zależności, peer dependencies, prywatnych pins ani trybu pomijania kontroli. Naprawa dwóch testów uwzględnia trzeci jawny rekord PK i sprawdza historyczny PI we własnym zamrożonym checkout; **literalna asercja kontraktu PI `1722f160…` oraz wszystkie sprawdzenia 10 źródeł i 29 potwierdzeń pozostają**. Workflow KRS i PK mają dokładnie bajty wcześniej zatwierdzone w R3.

## Faktycznie wykonane sprawdzenia

[Pełny zapis przedwdrożeniowy](../proposals/platform-knowledge-stage2-r4/predeployment-test-summary.json) rozdziela źródło, prywatne testy i przyszłe wymagane CI:

- Integralność źródeł PK/PI/Finder: **68/68 PASS**, SDK/Core/ACG: **38/38 PASS**, poprawione przypadki polityki: **10/10 PASS**, bez pominięć. Bajty testowane przed podpisaniem źródła są zamrożone w 617ae48d.
- Pełna prywatna regresja z przyjętym CIC24 oraz dokładną propozycją polityki: **684/684 PASS, 0 skipped**, źródło 617ae48d bez zmian. To **nie jest GitHub controlled CI ani source admission**.
- Pierwszy przebieg 681 testów miał cztery błędy: dwie stare prywatne próbki oraz dwa opisane założenia testów. Ten i późniejsze nieudane przebiegi pozostają zachowane; nie przepisano ich na PASS.
- Historyczne rzeczywiste PostgreSQL/E1/Root/ACG **58/58** i PCI **68/68** dotyczą przodka `5196726aa142ef928b59f22f26d0689a9a74eb4d`. Kod runtime/migracji jest niezmieniony; nie nazywamy ich testami dokładnego późniejszego SHA. Wymagane aktualne CI wykona właściwe testy ponownie.
- Odczyt Render przez istniejącą natywną sesję faktycznie zadziałał: poprawny workspace i API, stary LIVE, brak aktywnego deploymentu, bez nowego logowania/tokenu i bez ujawnienia poświadczeń.

## Niepowiększony zakres operacji Development

1. **SQL001/015/016 pozostają bajtowo identyczne z R3.** Nowy [payload właściciela](../proposals/platform-knowledge-stage2-r4/identity-owner-install-r4.sql), SHA-256 `76f6cf5fd09e5f55867dab488020dbcfa2366a2421da51937632f99f4c7289b8`, zmienia wobec R3 tylko **15 odwołań SHA**: dwa deploymentId i 13 source_ref. Role, schematy, podmiot, operacje i terminy są te same.
2. Te same Neon Development `sparkling-sky-79692560/br-billowing-grass-b9ko5s4f/platform_knowledge` oraz `spring-bread-28217539/br-sparkling-term-b99l107x/platform_private`. SQL001 i SQL016 wykonuje właściwy właściciel produktu przez migratora; SQL015 — centralny właściciel Identity. Brak alternatywnego katalogu uprawnień PK.
3. Nadal **dwa bindingi i 11 grantów** operatora `092c2d9f-a84b-4c18-b3d6-e172a61399b8`, do **2026-12-11 23:59Z**. Nadal tylko własna krawędź neondb_owner, maksymalnie **24 centralne transakcje łącznie** do **2026-11-24 23:59Z**, dokładne przywrócenie członkostwa przed każdym COMMIT i niezależny readback; provider cloud_admin bez zmian.
4. Ten sam jeden cykl własnego Shared query grantu **ACTIVE v1 → REVOKED v2 → ACTIVE v3**, ta sama zwykła sesja/cache/query, odmowa 403 bez płatnego wywołania. Plan i dwa SQL aktualizują wyłącznie odwołania do wydania/decyzji; nie dodają grantu, cyklu ani puli transakcji.
5. Te same sześć zapisów pojedynczych kluczy konfiguracji bez deploymentu, potem oddzielne wdrożenia **dokładnego commitId 617ae48d** na trzech istniejących usługach: API/panel `srv-dbq6n2m7bikc73dmvs8g`, Worker `srv-dbq6njec6qcc738fjf50`, Identity `srv-dbcse6jrjlhs73eib3sg`. Nie wdrażać latest. Wszystkie stare sekrety pozostają we właściwych miejscach.
6. Budżet nadal **USD 10 łącznie / USD 1 dokument**, istniejące OpenAI. Bez nowych zasobów, modeli, tokenu Render lub lokalnego checkoutu Mac. Projekt, skrypty i dowody pozostają w Codespaces.
7. Trzy zatwierdzone wykonawcy transportu Render pozostają bajtowo identyczne. Załączony bootstrap `463edcdb…` utrwala działający sposób użycia tej samej istniejącej sesji CLI w pamięci procesu i istniejącego certifi do pełnej walidacji TLS. Sprawdza stały host Render, właściciela i uprawnienia konfiguracji, wygaśnięcie sesji oraz hash niezmienionego relay; nie tworzy ani nie kopiuje poświadczenia do Codespaces/logów/projektu.

## Obowiązkowa ścieżka po GO

Normalnie przyjąć właściwą politykę po required CI, zachowując rzeczywiście przyjęte równoległe zmiany. Następnie odświeżyć transport istniejącego PR #1019 i powiązane adopcje #1033/#1034, przejść pełne wymagane CI, kontrolowane przyjęcie źródeł, oryginalny artefakt i niezależny proof oraz kontrolę wynikowego main. Sam przegląd, 684 prywatne testy ani cudze proof nie dają dopuszczenia.

Zamrożone źródło artefaktu pozostaje **617ae48d**; rzeczywisty kontekst merge/walidacji może integrować późniejszy trusted main przy identycznych zatwierdzonych własnych źródłach, ścieżkach i trybach. Obydwa rzeczywiste SHA i ich związek muszą być zapisane w CI. Odświeżenie polityki jest dozwolone tylko przy **identycznych własnych zatwierdzonych bajtach względem wskazanego przeglądu**, zachowaniu późniejszych faktycznie przyjętych obcych zmian i nowych wymaganych kontrolach dokładnego kandydata oraz wynikowego main. Koordynacja nie zatwierdza nieprzyjętych źródeł Kalendarza, CIC, SRM, Stage I lub ACG. Inne własne bajty chronione, inny wdrażany SHA albo nowe ryzyko wykraczające poza ten zakres wymagają rzeczywistej aktualizacji decyzji.

Dopiero po spełnieniu warunków wykonać migracje, readback ról/bindingów/grantów, sześć zapisów konfiguracji i trzy dokładne deploymenty. Przy każdej operacji świeży provider readback, zgodny własny LIVE, brak konkurencyjnego deploymentu, zapis zamiaru i rozstrzygnięcie wyniku nieznanego przed ponowieniem.

Pozostaje zaakceptowane odzyskiwanie R3 bez dostępnego OCI digestu: API `dep-dbq71vutlv9c73epgb2g` i Worker `dep-dbq72f5g1s2s739m10dg`, źródło `1fef8b3837c1bdd6ea9ff95dd4e976cc71cf9526`; Identity `dep-dbq9bn0m7kps738pq75g`, źródło `f78f5867064c96f4497e13bcd53c97af2da2e07a`. LKG potwierdzić ponownie bezpośrednio przed mutacją. Przed odbudową API/Workera zapisać PK_PROCESSING_ENABLED=false; SaveOnly nie zatrzymuje obecnego procesu. Zachować dodatnie schematy, granty, audyt i finanse; bez restore współdzielonej bazy, nadpisywania cudzego LIVE i obietnicy binarnej identyczności przebudowy.

Końcem pozostaje rzeczywisty upload → Worker/OpenAI → PostgreSQL/pgvector → publish → autoryzowany retrieval → rzeczywisty CIC/ACG ze źródłami → withdraw/cache oraz odmowy, cofnięty grant, persistence/koszty, błąd Workera/Sentry i automatyczna retencja po delete. Pełne **TECHNICAL DEPLOYMENT SUCCESS** dopiero po tych dowodach i prawidłowym PHR/PMOS/MEMOROS; kanon funkcjonalny revision 4 i formalne kryteria Etapu 2/3 pozostają bez zmian.

Stan przy przygotowaniu pakietu: **0 migracji biznesowych, 0 grantów/bindingów, 0 deploymentów, 0 płatnych wywołań i 0 importów PK**. Trzy istniejące zadania kontynuacyjne pozostają RUNNING. Zgoda na cały ten pakiet umożliwia dalszy dozwolony przebieg automatycznie, bez ponownego uzgadniania celu ani niezmienionego R3.

## Dokładne załączniki

| Plik | SHA-256 |
| --- | --- |
| [closed-source-review.json](../proposals/platform-knowledge-stage2-r4/closed-source-review.json) | `eed5be76b53646bc8afc7fcdb80a50b1b3dc525c8b7091a651040c22e44b2482` |
| [identity-owner-install-r4.sql](../proposals/platform-knowledge-stage2-r4/identity-owner-install-r4.sql) | `76f6cf5fd09e5f55867dab488020dbcfa2366a2421da51937632f99f4c7289b8` |
| [live-stale-grant-probe-plan.json](../proposals/platform-knowledge-stage2-r4/live-stale-grant-probe-plan.json) | `3952c7e5b79e5be0a9e266dfa6d4ba8a71807ef8e82fbb2cb5fea51ca3ad5b96` |
| [native-render-existing-session-bootstrap.py](../proposals/platform-knowledge-stage2-r4/native-render-existing-session-bootstrap.py) | `463edcdb3008c0ea786eacb08209a10fec4f52423ba25300890b39619460b44b` |
| [native-render-operator-relay.py](../proposals/platform-knowledge-stage2-r4/native-render-operator-relay.py) | `3c2876367196e1a4e957a9849f3d576f87fde7273877c8627ab2d8e913dde340` |
| [predeployment-test-summary.json](../proposals/platform-knowledge-stage2-r4/predeployment-test-summary.json) | `22a267ddc0eae3d39aafaa68c03f8d94e3cb9fa6a1f47437bd0d0b51330f5cc0` |
| [read-failed-parser-proof.mjs](../proposals/platform-knowledge-stage2-r4/read-failed-parser-proof.mjs) | `df2993b947f858bbdc9039cfe268c2e0dbb666dc87a440c4ed3754852f37833e` |
| [read-stale-grant-cost-proof.mjs](../proposals/platform-knowledge-stage2-r4/read-stale-grant-cost-proof.mjs) | `a79c1fc28629f1c2659e59360b76672cd06eca894b9e46ea32db0537712bc4a7` |
| [record-native-render-result.py](../proposals/platform-knowledge-stage2-r4/record-native-render-result.py) | `22b061a623ff1dff4651aa3342cff194ac9e885828757faf4d5d2cb75ca2efe9` |
| [render-native-execution-plan.json](../proposals/platform-knowledge-stage2-r4/render-native-execution-plan.json) | `e03045423e1458b9720760cbb4ff97bd71f514f3291e07c6ce9185f1cca12382` |
| [render-operation-envelope.mjs](../proposals/platform-knowledge-stage2-r4/render-operation-envelope.mjs) | `67722e6b19b972acb4dc2c14550defd190e2f934a912e3fd8715dfec27207247` |
| [stale-query-grant-restore-r4.sql](../proposals/platform-knowledge-stage2-r4/stale-query-grant-restore-r4.sql) | `682a8024a246277e144fdbda703798e258289248d5f9cb59fff2d124ab3ec9c5` |
| [stale-query-grant-revoke-r4.sql](../proposals/platform-knowledge-stage2-r4/stale-query-grant-revoke-r4.sql) | `2c047206042460dbea080448e7677729a48bd5eecba46d9b2c875b60cd0bd884` |
