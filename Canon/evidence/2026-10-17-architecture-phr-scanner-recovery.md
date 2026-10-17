# PHR — naprawa klasyfikacji opisu formatu i recovery E1, 17.10.2026

**Zadanie:** ARCHITECTURE-E1-PHR-SCANNER-RECOVERY-20261017; ARCHITECTURE / SG-dev Architecture / development / local. Własne PMOS architecture_pmos; MEMOROS wyłączony przez profil. Begin cmvcoxnol00007uiyqt2qwiv9, conversationId pmos-task-v2:704fc57c6ad85c582ae7a2146776e6a02c0ce5fc5655c38113520ff69f4beb7e. Rejestracja sama nie dowodzi closeout.

## Upoważnienie i zakres

Właściciel wyraźnie zaakceptował jednorazowy wyjątek authority dla naprawy kanonicznego skanera w istniejącym profitia/project-history-repository, z testami, PR i merge, jako osobne zadanie ARCHITECTURE. Nie ustanowiono nowego profilu ani stałego wyjątku governance. Automatyczny preflight SG-dev potwierdził jego własny dokładny target dowodowy oraz lifecycle ARCHITECTURE; nie walidował routingu zewnętrznych plików PHR. To rozróżnienie pozostaje jawne.

Zewnętrzne source targets to wyłącznie scripts/phr-core.mjs oraz tests/phr-hardening.test.mjs. Weryfikacja tożsamości potwierdziła profitia/project-history-repository, świeży origin/main fe801c4d213f2a1148a57078f67c6d889c0717cb, czysty checkout i brak otwartych PR. Zastosowano odrębną gałąź i worktree. README i docs/PHR-v1-contract.md pozostają obowiązujące. Nie zmieniono immutable PMOS, rekordów historycznych, praw dostępu, reguł publikacji ani manifestów profili.

## Potwierdzona przyczyna

Skaner klasyfikował fragment zwykłego polskiego zdania opisującego format uwierzytelniania jako wartość poświadczenia. To zablokowało downstream PHR dwóch zapisanych zadań E1. Oba zachowane pending inputs, archiwa, blokady integralności i dowody błędu pozostały na miejscu. Stwierdzono fałszywe rozpoznanie prozy; nie stwierdzono w tym zdaniu ujawnionego poświadczenia.

Poprawka rozpoznaje wąską konstrukcję opisu nazwy formatu. Rzeczywiste nagłówki autoryzacji są sprawdzane osobno na niezmienionym wejściu; wartości krótkie i samodzielne, przypisania, adresy baz i materiał kluczy pozostają odrzucane. Nie dodano wyłączenia skanera ani wyjątku zależnego od taskId lub archiwum.

## Publikacja i testy source

[PHR PR #5](https://github.com/profitia/project-history-repository/pull/5): source 9193682a8d3638998e0b464a6d97ae664468415f, merge 495d7578bbe517463488157781f8c067ecd3da7a. Dokładnie dwa zatwierdzone pliki; PR CLEAN/MERGEABLE, bez wymaganych zadań CI w tym repozytorium, testy wykonane lokalnie. Merge bez bypassu z kontrolą exact head.

Wszystkie13 testów hardening PASS, zero skipped: zachowanie treści i integralności pierwszej publikacji, idempotentne ponowienie, odmowa rzeczywistych poświadczeń także obok dozwolonej prozy przed zapisem/commitem, konkurencyjni publisherzy, konflikt treści, duplikaty i integralność repozytorium. Fixture używa wyłącznie tymczasowych lokalnych bare Git repositories i syntetycznych danych; nie testowano na sekretach klientów.

Bezpośredni skan obu zachowanych archiwów nowym source PASS, sumy SHA256 przed recovery niezmienione:

| Profil / taskId | SHA256 archiwum przed recovery |
| --- | --- |
| SRM / SRM-E1-SHARED-FINANCIAL-READ-PORT-20261017 | 793ad1e00e6cc2f406c3ba64eb21e2f7218978a2a1b432598c2cc0d92f50c5f1 |
| SG2 / SG2-E1-SHARED-FINANCIAL-PORT-COMPATIBILITY-20261017 | bfddec1685b27a83e6cd1c4d4a8f31055c2fec59ec0a32b0cff5a71cfaab6a70 |

## Recovery — wykonanie i odrębne potwierdzenia

Oba czyste klony publishera zaktualizowano fast-forward do poprawionego main. Wznowiono canonical pmos:save bez argumentu bootstrap, na tych samych rejestracjach i zachowanych pending inputs. Oba procesy exit0; przed odczytem wyników oczekiwano na ich zakończenie. Zachowano pierwotne backupy i kopie archiwów sprzed recovery. Nie wykonano ręcznego zapisu do bazy ani zastępczego publishera.

Przed recovery pełne bramki zgłaszały PMOS_RUNTIME_GATE BLOCKED z powodu prawidłowego istniejącego pending slot, przy runtime/context PASS i advisory lock clear. Nie uznano tej bramki za PASS i nie rozpoczęto nowych mutacji produktu. Kanoniczne recovery tego samego zadania zwolniło slot; dopiero potem powtórzone pełne preflighty obu profili uzyskały PASS bez wyjątków.

Niezależne odczyty rzeczywistej bazy/roli, rejestracji, canonical artifact, MEMOROS oraz remote ancestry PHR potwierdziły:

| Profil | Rejestracja / closeout | Ciągłość | Commit PHR w remote main |
| --- | --- | --- | --- |
| SRM | completed / CLOSEOUT_COMPLETE | save/context/handoff SUCCEEDED, archive PASS, trail PRESENT, MEMOROS DISABLED_BY_PROJECT_PROFILE | d409a8d9e1f402d63a6b06224d8d6ed5e204db9c |
| SG2 | completed / CLOSEOUT_COMPLETE | save/context/handoff SUCCEEDED, archive PASS, trail PRESENT, MEMOROS DELIVERED | d2dd2aaaaefa35413a1561627e0ffb29a66dbfa6 |

W obu przypadkach PHR PUBLISHED, own pending/advisory lock clear, publisher checkout clean i commit potwierdzony jako ancestor origin/main. Endpoint i baza odpowiadają własnemu profilowi. Porównanie zachowanych oryginalnych archiwów z końcowymi potwierdziło równość wszystkich niezmiennych pól; canonical lifecycle zaktualizował wyłącznie pochodne completionEvidence. Nie deklaruje się identyczności SHA całego końcowego pliku, ponieważ te dowody zmieniły się prawidłowo. Pierwotna treść decyzji nie została poprawiona w celu przejścia skanera.

## Istniejący dług historii poza zakresem

Pełny phr:check po recovery zgłosił FAIL: sześć zgłoszeń Duplicate publicationId w starszej historii wrześniowej. Dla wszystkich par odczyt manifestów z fe801c4d213f2a1148a57078f67c6d889c0717cb potwierdził, że istniały przed naprawą. Kontrola nie zgłosiła innych problemów w tym przebiegu818 bundles. Nie usuwa się duplikatów ani historii w ramach tej zgody. Odbiór naprawy skanera i integralności dwóch aktualnych publikacji nie jest stwierdzeniem pełnego zdrowia historycznego estate.


## Granice programu

To naprawa ciągłości, nie wydanie produktów. Nie wdrożono aplikacji, nie zmieniono kluczy, ról, grantów, live flags, danych biznesowych ani zasobów Staging/Production. Faktyczne przyjęcie modułu w SG2, pozostałe wejścia i kontrolowane wydania Development/Staging pozostają dalszym przyjętym E1. Sam producer/consumer compatibility oraz naprawiony PHR nie spełniają pełnego odbioru E1.
