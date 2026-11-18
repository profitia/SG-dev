# Platform Knowledge — poprawka SRM Root i dokładne wydanie R5

Decyzja: **ARCH-PK-STAGE2-R5-GO-20261118**. Stan: **PROPOZYCJA DO ZATWIERDZENIA, BEZ AKTYWACJI**.

## Dlaczego potrzebna jest jedna aktualizacja decyzji

R4 zostało rzeczywiście zatwierdzone w bieżącym czacie: GO — zatwierdzam R4 i kontynuację do E2E. Jego polityka została przyjęta przez PR #1180, a wymagane kontrole wynikowego main3109989f przeszły z niezależnie sprawdzonym oryginalnym artefaktem. To potwierdza dopuszczenie polityki, nie wdrożenie silnika.

Pełne natywne CI wspólnego źródła628469c5 ujawniło rzeczywisty błąd istniejący również w zatwierdzonym617ae48d: konfiguracja SRM wskazywała poprzedni digest Root b3d6f2110f41ca93cac6a949b113a8582b6407688d81df1935cd8990424b393a zamiast rzeczywistego producenta SDK1.37 ab8cfef37eb35526ff0d2894e827ad1a22dea8750b9c9d89fbcbea2ce41b1f50. Istniejąca asercja SRM została zachowana i wykryła tę rozbieżność.

Jedyna nowa konfiguracja produktu to poprawny digest w apps/srm/deployment/root-atomic-claim-targets.json. Pozostałe pola, role, schemaDigest i domyślne wyłączenie aktywacji pozostają identyczne. Dodano negatywny test rzeczywistego producenta. Pierwsza wersja testu8abd ujawniła zależność od lokalnego układu node_modules; poprawiona fixture kopiuje rzeczywiste pakiety do własnego katalogu tymczasowego, sprawdza identyczność bajtów i importuje rzeczywisty Root. Nie usuwa żadnej asercji, nie stosuje mocka i nie zmienia workflow ani budżetu.

**Nowa decyzja dotyczy dokładnego poprawionego wydania, nowych własnych bajtów chronionego kontrolera i wynikających z nich odwołań SHA oraz opublikowanych wykonawców.** Jest wymagana przez CORE §10.1 i wyraźne ograniczenie GO R4 do wydania617ae48d oraz zatwierdzonych bajtów. Nie prosimy ponownie o niezmienione migracje, granty, usługi ani budżet R3/R4.

## Dokładne źródła i polityka

- **Wydanie do Render:** [2706f13a5fb37a45daf4aea7be5e9d88ee7e4024](https://github.com/profitia/SG-dev/tree/2706f13a5fb37a45daf4aea7be5e9d88ee7e4024), tree 3e375d7edbc9e91639acad80e0e19f80a48d09db; istniejący PR #1019, normalny merge rzeczywistego main2040e9e7430fd6b164f8726e3f92d3654b804e44 i8abd146e. Historia123d4d7d/617ae48d i wszystkie przyjęte obce zmiany pozostają w ancestry.
- [Zamknięty przegląd](../proposals/platform-knowledge-stage2-r5/closed-source-review.json):116 plików, ARCHITECTURE100/SG2 10/SRM6; dokładny blob/status/mode/ownership. Graf460 surowych źródeł,33 niezmienione historyczne potwierdzenia. Rekord 3517b86c8a86a2cab3bb0e9be98c464a7278d136b43c61ab8cd869f67ece4c62, czytnik a10351fa23857a9299c11f2c7bf66c85ae571e29a30a98f4fedcd619bfeb8b10.
- Całe katalogi silnika Platform Knowledge, Identity runtime, platform-contracts SDK, Knowledge Core/Contracts, ACG oraz SQL001/015/016 są bajtowo identyczne z zatwierdzonym R4. Nie ma nowej funkcjonalności, modelu, zasobu, ani równoległego systemu tożsamości.
- **Osobna nieaktywna propozycja polityki:** [b3838a8bdf80ceb3b36a478ba264e79c7be8a036](https://github.com/profitia/SG-dev/compare/2040e9e7430fd6b164f8726e3f92d3654b804e44...b3838a8bdf80ceb3b36a478ba264e79c7be8a036). Ma dokładnie dwa chronione pliki i zachowuje wszystkie dotychczasowe przeglądy R1/R3/R4 oraz przyjęte reguły CIC/Kalendarza/PI.
- Przyjęte CI46 na main2040 zmienia tylko registry i development-execution.mjs/.test.mjs; wszystkie trzy obce pliki zachowano. Nie są w naszym grafie460. Propozycja nie przyjmuje niezatwierdzonych źródeł Root Stage I, Cal, CIC host ani ACG runtime.

| Chroniony plik | SHA-256 |
| --- | --- |
| scripts/governance/controlled-package-ci.mjs | 678aae73d2385aa7725f6380c433505ad6f10c740e98a3a843e466f18f329038 |
| scripts/governance/controlled-package-ci.test.mjs | f40ced12ae125aebee67a9ee34cf6ede6329074aae48c0c30f3d82627c947677 |

Nowy czwarty przegląd jest skończonym wykazem dokładnych116 wpisów i rekordu3517. Testy wymagają całego zestawu, poprawnych trybów, prawdziwego ancestry i wszystkich460 digestów oraz33 historycznych potwierdzeń. Zmieniony target, dowolny obcy plik, brak wpisu lub zmieniony blob jest odrzucany. Brak ogólnego wyjątku dla peer/private dependencies, usunięcia testów lub zastąpienia historycznego dowodu.

## Faktycznie wykonane sprawdzenia

[Pełny zapis](../proposals/platform-knowledge-stage2-r5/predeployment-test-summary.json) rozdziela źródła, prywatne testy, natywne CI i przyszłe dopuszczenie.

- Czysty publiczny układ bez wejściowych node_modules i z rzeczywistym origin/main:9/9PASS,0skip, wszystkie asercje zachowane. Testowane bajty są identyczne z2706.
- Natywne SRM dla dokładnego2706: [run44288163583](https://github.com/profitia/SG-dev/actions/runs/44288163583) SUCCESS.983/983 główne oraz3+7+311+17+165+1+1 pozostałe testy PASS,0skip, istniejąca asercja Root PASS, typecheck i rzeczywisty build PASS. Staging jobs pozostają SKIPPED, bez operacji Staging.
- Silnik PK [44288163605](https://github.com/profitia/SG-dev/actions/runs/44288163605) i ACG [44288163737](https://github.com/profitia/SG-dev/actions/runs/44288163737) SUCCESS.
- Identity [44288163557](https://github.com/profitia/SG-dev/actions/runs/44288163557): lint/types/build/session oraz oba kontrakty odbiorców PASS,384+2+2 testy PASS. Późniejsze governance odmawia KNOWLEDGE_STAGE2_RECORD_REJECTED, ponieważ aktualna polityka nie zna nowego rekordu. Tego workflow nie nazywamy całym PASS.
- **Pełna prywatna regresja proponowanej polityki:** ℹ tests 690, ℹ pass 690, ℹ fail 0, ℹ skipped 0; źródło i proponowane bajty bez zmian. Jest to prywatna symulacja, nie controlled CI ani source admission.
- Wcześniejsze nieudane próby628 i8abd, problem zależności testu i pierwsze nieudane uruchomienia prywatnych fixture pozostają zachowane. Nie przepisano ich na PASS.
- Wymagane aktualne publiczne i controlled CI oraz wynikowy main muszą jeszcze przejść po rzeczywistym GO. Nie dopuszcza ich ten dokument ani poprzedni zielony przebieg polityki.

## Niezmieniony zakres aktywacji Development

Obowiązują [R3](https://github.com/profitia/SG-dev/blob/5997cf83f5686a09b2747edec77b74c013b813db/Canon/evidence/2026-11-18-platform-knowledge-stage2-development-release-r3.md), [R4](https://github.com/profitia/SG-dev/blob/0f587655f073bf1baf1ff3cce80fe7af12502899/Canon/evidence/2026-11-18-platform-knowledge-stage2-development-release-r4.md) oraz pierwotne GO4153178f. W załącznikach zmieniono wyłącznie odwołania do dokładnego wydania i decyzji, zachowując reguły wykonania.

1. Te same bazy Neon Development: sparkling-sky-79692560/br-billowing-grass-b9ko5s4f/platform_knowledge i spring-bread-28217539/br-sparkling-term-b99l107x/platform_private. SQL001/015/016 bez zmian. SQL001/016 wykonuje właściciel produktu przez zatwierdzonego migratora; SQL015 centralny właściciel Identity.
2. Te same dwa bindingi i11 ograniczonych grantów operatora092c2d9f-a84b-4c18-b3d6-e172a61399b8 do2026-12-11 23:59Z. Bez Memory grantów. Owner SQL zmienia wobec R4 dokładnie15 odwołań SHA, nie zakres DDL lub praw.
3. Ta sama czasowa własna krawędź SET roli profitia_access_owner, tylko wewnątrz transakcji; oba członkostwa wracają do poprzednich wartości przed każdym COMMIT i są niezależnie odczytane. Łączny istniejący limit24 transakcji centralnych do2026-11-24 23:59Z. Krawędź cloud_admin bez zmian. Brak nowej puli.
4. Ten sam jeden cykl Shared query grantu ACTIVEv1→REVOKEDv2→ACTIVEv3, ta sama zwykła sesja/query/cache i403 bez płatnej operacji. Bez nowych grantów i bez drugiego cyklu.
5. Te same sześć zapisów pojedynczych kluczy konfiguracji SaveOnly, a następnie exact commitId2706f13a5fb37a45daf4aea7be5e9d88ee7e4024 na trzech istniejących usługach: Identity srv-dbcse6jrjlhs73eib3sg → Worker srv-dbq6njec6qcc738fjf50 → API/panel srv-dbq6n2m7bikc73dmvs8g. AutoDeploy pozostaje wyłączone. Nigdy latest.
6. Dokładny publiczny IDENTITY_RUNTIME_EXPECTED_SOURCE_SHA jest synchronizowany do tego samego zatwierdzonego wydania, co już wprost obejmuje pierwotne GO4153178f, wiersz70. To osobny publiczny pin wydania, nie nowy sekret ani rozszerzenie sześciokluczowej aktywacji. Zachować istniejącą kontrolę równości w buildCommand. Bounded wykonawca GET/PUT jednego klucza ma świeży readback LKG i brak deploymentu przy SaveOnly.
7. Trzy oryginalne wykonawcy Render i bootstrap pozostają bajtowo identyczne. Ta sama istniejąca natywna sesja CLI, weryfikacja hosta/workspace/operatora i TLS; brak nowego klucza, eksportu sekretu lub przenoszenia poświadczenia do Codespaces.
8. Budżet nadalUSD10 łącznie/USD1 na dokument, istniejące OpenAI, trzy dopuszczone małe dokumenty. Retencja surowego źródła≤24h i automatyczny Worker pozostają zgodne z kanonem. Bez fizycznego ANN indeksu: zatwierdzony GIN i dokładny filtrowany ranking1536, bez obietnicy innego indeksu.
9. Wszystkie operacje tylko Development. Bez nowych usług, baz, kolejek, tokenów, modeli lub lokalnego checkoutu Mac. Kod, skrypty i dowody pozostają w Codespaces.

Pięć opublikowanych wykonawców R5 jest związanych hashami [execution-asset-digests.json](../proposals/platform-knowledge-stage2-r5/execution-asset-digests.json). Guard wymaga rzeczywistego GO z bieżącego czatu, dokładnego immutable review SHA, zgodnych opublikowanych i lokalnych bajtów, osobnego PASS source admission, required CI i resulting-main CI, czystego checkoutu release oraz niezmienionych460 źródeł na faktycznym main. Tryb prepare wykonał0 zapytań i0 odczytów sekretów. Nie istnieje jeszcze owner-r5-execution-go.json.

## Wymagany ciąg po GO oraz odzyskiwanie

Normalnie przyjąć wyłącznie własną poprawioną politykę po właściwym wymaganym CI i oryginalnym kontrolowanym proof. Następnie odświeżyć transport istniejącego PR #1019 z zachowaniem zaakceptowanych równoległych zmian, pełne wymagane CI, kontrolowane przyjęcie całego kompatybilnego zestawu, niezależna kontrola oryginalnego artefaktu oraz required CI wynikowego main. Dopiero potem trial/rollback i instalacja właściwymi rolami, niezależny readback grantów/bindingów i przywróconych członkostw, konfiguracja i trzy dokładne deploymenty.

Zamrożonym wdrażanym źródłem pozostaje2706f13a. Mechaniczne odświeżenia transportu/polityki mogą zachować identyczne własne zatwierdzone bajty, ścieżki i tryby, te same460 źródeł,33 historyczne potwierdzenia i prawdziwe accepted-main ancestry. Wolno zachować późniejsze rzeczywiście przyjęte obce zmiany i aktualizować wyłącznie wynikające z tego referencje SHA zamkniętego przeglądu. Każde odświeżenie wymaga świeżych kontroli dokładnego kandydata i wynikowego main. Nie jest to zgoda na dowolną przyszłą zmianę protected CI, własnego runtime, zmienione źródła SDK/Identity lub nieprzyjęte cudze propozycje.

Przed każdą operacją świeży provider readback: zgodny własny LIVE, brak obcego aktywnego deploymentu, zapis zamiaru i niezależne rozstrzygnięcie nieznanego wyniku przed ponowieniem. LKG: API dep-dbq71vutlv9c73epgb2g i Worker dep-dbq72f5g1s2s739m10dg na1fef8b3837c1bdd6ea9ff95dd4e976cc71cf9526; Identity dep-dbq9bn0m7kps738pq75g naf78f5867064c96f4497e13bcd53c97af2da2e07a. Przed odzyskiwaniem PK_PROCESSING_ENABLED=false i dokładny LKG rebuild; SaveOnly nie zatrzymuje aktualnego procesu. Przy odzyskiwaniu Identity najpierw przywrócić publiczny pinf78, potem dokładny rebuildf78. Obowiązuje zatwierdzona alternatywa R3 bez dostępnego OCI digestu i bez obietnicy binarnej identyczności przebudowy. Zachować dodatnie schematy, historię, audyt, koszty i cudzy LIVE; bez restore współdzielonej bazy.

Koniec to rzeczywisty import→Worker/OpenAI→PostgreSQL/pgvector→publish→autoryzowany retrieval→rzeczywisty CIC/ACG ze źródłami→withdraw/cache, odmowy nieuprawnionego scope i nieaktualnego grantu, historia/persistence/rozliczenie, rzeczywisty błąd Workera/Sentry i automatyczna retencja po delete oraz browser UI. Zwykły login operatora, bez admin impersonation i bez pożyczania sesji równoległych prac.

Kanon funkcjonalnyv1.0revision4 i formalne kryteria Etapu2/3 pozostają bez zmian. TECHNICAL DEPLOYMENT SUCCESS wymaga rzeczywistych dowodów usług i E2E oraz prawidłowego PHR/PMOS/MEMOROS. Sam ten pakiet, CI PASS lub LIVE nie wystarcza.

Stan przy przygotowaniu:0 migracji,0 grantów/bindingów,0 deploymentów,0 importów i0 płatnych wywołań Platform Knowledge. Istniejące trzy kontynuacyjne zadania PMOS pozostają RUNNING; brak formalnego closeout.

## Dokładne załączniki

Manifest wszystkich wykonawców i załączników SHA-256: **7afbc541b93d261a77e1e9fb1293626bac6db149f1fc2b5f8e8aff29a3490092**.

| Plik | SHA-256 |
| --- | --- |
| [closed-source-review.json](../proposals/platform-knowledge-stage2-r5/closed-source-review.json) | bca8b728848709671e312a7ecd40b569cd6dc92e6a6dcb04da5586840f479bec |
| [execute-reviewed-identity-r5.mjs](../proposals/platform-knowledge-stage2-r5/execute-reviewed-identity-r5.mjs) | 3cc1232c0a9b2269cbc2a97330f97ad1cf37dfba292af5f46bf501db51ecfa13 |
| [execute-reviewed-product-r5.mjs](../proposals/platform-knowledge-stage2-r5/execute-reviewed-product-r5.mjs) | f9c709d2db46a8ee57613180b44712a0e682824bb0e4428602f1666717509c59 |
| [identity-owner-install-r5.sql](../proposals/platform-knowledge-stage2-r5/identity-owner-install-r5.sql) | 326254130e9caeef6c0dcec9debff57d9cb73fd7e1e434fc16207e237777eab9 |
| [identity-release-pin-r5-envelope.mjs](../proposals/platform-knowledge-stage2-r5/identity-release-pin-r5-envelope.mjs) | 02238a4feba94882b90e6dcd7cb01aef00814872db218093b7b616cb1f34b7b9 |
| [live-stale-grant-probe-plan.json](../proposals/platform-knowledge-stage2-r5/live-stale-grant-probe-plan.json) | 2b35aa841c4075d4cdd56ab99dda75aa505a10afb06ed0e650e543406d88eb99 |
| [native-identity-release-pin-r5.py](../proposals/platform-knowledge-stage2-r5/native-identity-release-pin-r5.py) | 102381694228d93eb9ca8f38d3fb3e404ae2c99e29b9e634c2c71a3fade43d4e |
| [native-render-existing-session-bootstrap.py](../proposals/platform-knowledge-stage2-r5/native-render-existing-session-bootstrap.py) | 463edcdb3008c0ea786eacb08209a10fec4f52423ba25300890b39619460b44b |
| [native-render-operator-relay.py](../proposals/platform-knowledge-stage2-r5/native-render-operator-relay.py) | 3c2876367196e1a4e957a9849f3d576f87fde7273877c8627ab2d8e913dde340 |
| [pk-r5-execution-guard.mjs](../proposals/platform-knowledge-stage2-r5/pk-r5-execution-guard.mjs) | a99bd459d06e02f3ba06376212d8435d0aeb8ac5e1fed07e1b034009b8811f45 |
| [predeployment-test-summary.json](../proposals/platform-knowledge-stage2-r5/predeployment-test-summary.json) | 8603aaa5b64f3cd684b3e6fd5c35da7968090d38eab497b73799cc67476e5be3 |
| [read-failed-parser-proof.mjs](../proposals/platform-knowledge-stage2-r5/read-failed-parser-proof.mjs) | e0eea25326cfda05b443e54987639aa53f27b8649d3e49a705240dcde56cc81c |
| [read-stale-grant-cost-proof.mjs](../proposals/platform-knowledge-stage2-r5/read-stale-grant-cost-proof.mjs) | d3f7b27b3fafecba9107c86a5c3bb42e99680ee557ab7ebd6241c6b827782468 |
| [record-native-render-result.py](../proposals/platform-knowledge-stage2-r5/record-native-render-result.py) | 22b061a623ff1dff4651aa3342cff194ac9e885828757faf4d5d2cb75ca2efe9 |
| [render-native-execution-plan.json](../proposals/platform-knowledge-stage2-r5/render-native-execution-plan.json) | c42af0c4fc629fbdcad52d52eff4bf48b43f043d0c65d18d7ad4627e432c5d20 |
| [render-operation-envelope.mjs](../proposals/platform-knowledge-stage2-r5/render-operation-envelope.mjs) | 67722e6b19b972acb4dc2c14550defd190e2f934a912e3fd8715dfec27207247 |
| [stale-query-grant-restore-r5.sql](../proposals/platform-knowledge-stage2-r5/stale-query-grant-restore-r5.sql) | 7380f94919311943b1920c60937e4f9a510398dbb3f1be26c100cf3aab039b2d |
| [stale-query-grant-revoke-r5.sql](../proposals/platform-knowledge-stage2-r5/stale-query-grant-revoke-r5.sql) | a8e582fab4992613c51c34397a1f6e283e6d8ea3fe3cc875c2a8b0815d7c37b0 |
| [execution-asset-digests.json](../proposals/platform-knowledge-stage2-r5/execution-asset-digests.json) | 7afbc541b93d261a77e1e9fb1293626bac6db149f1fc2b5f8e8aff29a3490092 |
