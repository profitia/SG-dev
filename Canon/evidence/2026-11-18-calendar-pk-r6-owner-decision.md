# Kalendarz — uzupełniająca decyzja zgodności ze źródłem PK R6

Status: PROPOSAL / OWNER_DECISION_PENDING. To jest pakiet przeglądu dokładnych bajtów, bez aktywacji produktu.

## Jedna decyzja

Prośba obejmuje źródło `3b078cf760901c810acd27618f781e027e0d6af5`, politykę `045d6d78b9579290e240311d63dfb6ab7d8eab83` i zwykłą kontrolowaną integrację w opisanej kolejności. [Pełny diff źródła](./2026-11-18-calendar-pk-r6-source.patch), [pełny diff polityki](./2026-11-18-calendar-pk-r6-policy.patch), [dokładne postimages i dowody](./2026-11-18-calendar-pk-r6-validation.json).

Podstawa: [Canon v3 §10.1](../v3.0-profitia-agent-execution-canon.md#101-mandat-i-ponowne-używanie-zgód), istniejące zlecenie Calendar Complete Functional Delivery, zgoda R5 na `073808bd1d7129f80734a0494204033a9b656687` / `c4248d8803f0e60623ace8b59a491a5e84c533fc` oraz zgoda na koordynację z Platform Knowledge. Poprzednia zgoda wiązała dokładne bajty; niniejsze nowe postimages i zamknięty przegląd83 wymagają jej uzupełnienia.

## Zamrożony rezultat biznesowy

Development: 15 rzeczywistych serii EIA i cztery oficjalne harmonogramy przez SourceHub → ECR → Kalendarz SG2; opt-in na uzgodnionym koncie i jeden oznaczony e-mail do zatwierdzonej skrzynki, potwierdzony podpisanym callbackiem DELIVERED i odbiorem; odmowa powtórzenia, wyłączenie po opt-out i ograniczonym cofnięciu uprawnienia; końcowy PMOS/PHR z odczytem publikacji. [Kryteria PR1063](https://github.com/profitia/SG-dev/pull/1063) i [źródło odbiorcy PR1064](https://github.com/profitia/SG-dev/pull/1064) pozostają obowiązujące. Plan `complete-functional-owner-plan.json` zachowuje SHA256 `e43b5d49abef12818956f2195f0b11225fa4aef28d4fb1f2895900f8d721be9c`.

## Dokładne wejścia i zachowanie prac równoległych

- Obserwowany main: `037c15fdc3c4edce163a3811e2e7e7e6b0b7435b`, po `a03956b6752227a7a14e44887feabd50a0ad1054` i przyjęciu wyłącznie osobnego ledger dokumentacji #1196.
- PK R6: publiczne źródło `65b0e573f270ded93bfda088a88e736abc45f56a` i polityka `627f4bfa43b073c3228bbf8293f7fe4b82f88af2`. Zgoda i faktyczne przyjęcie PK mają własne dowody. Ich testy ani niniejszy pakiet nie stanowią zastępczego handoff.
- Neutralne wejście źródła `7a003e546268077c51059db564e297723334e98d` to zwykła historia PK65 + zaakceptowany main037, bez własnych zmian funkcjonalnych Kalendarza. Neutralne wejście polityki `17fb5197c8ee556aec75ccfb8df4dd54c2d0b75f` zachowuje PK627 i ten sam main.
- Źródło zachowuje w historii oryginalne `073808bd`, `69d02834`, zakres #1063/#1064 i wszystkie wcześniejsze rejestracje. Obecny HEAD PR1063 `ef7c0bc78fbb422230114d722077d31da2bb289c` jest jego przodkiem. Transport odbywa się bez force push.

## Co zmienia propozycja

Zamknięty przegląd źródła obejmuje 83 konkretne pliki: 67 ARCHITECTURE i16 SG2, bez własnych zmian SRM. Względem dotychczasowych82 dodany jest istniejący `scripts/governance/controlled-package-ci.test.mjs`. Jego asercje są zachowane: najpierw uwierzytelniony jest pełny fizyczny graf Kalendarza, następnie historyczne testy PK/ACG korzystają z kompletnej, czystej kopii dokładnego wcześniejszego wejścia. Osobne bieżące testy sprawdzają rzeczywiste83 postimages, wszystkie579 surowych wejść i negatywne przypadki uszkodzenia, pominięcia, podmiany oraz nieprawidłowego pochodzenia dowodów.

Record PK zachowuje SHA256 `7bde334dda3ec7068d3cb532ccd8a94f3477cea707abe250431ee16c3b044bf4`, pełne478 wejść i33 receipts; jego oryginalny test `a0f26ab670c49766e78b50cc801c879448ccc8f6` pozostaje dokładnym wejściem historycznym. Nowy aktualny blob testu Kalendarza jest jawnie częścią przeglądu83 i fizycznego grafu. Record nie jest przepisywany. Kod Root SDK, właściwości E1 i zaakceptowane implementacje współbieżnych prac są zachowane.

Polityka ma dwa własne pliki: `controlled-package-ci.mjs` i istniejący `controlled-package-ci-path-coverage.test.mjs`. Cztery pełne regresje Kalendarza są w tym drugim pliku. Dopuszczenie wskazuje wyłącznie PR1063, jego oryginalną gałąź, dokładne83 bloby, statusy, tryby, ownerów i lineage. Wyjątek pakietu nadal obejmuje wyłącznie dokładny SourceHub1.7.1→1.8.0 z niezmienionymi metadanymi peer. Nie powstaje kontrolerowy projektor historii.

## Przyjęcie po decyzji

1. Potwierdzić rzeczywisty handoff i prawidłowe przyjęcie źródła/polityki PK R6; odczytać świeży main, otwarte prace, kontrole i bramki ownerów.
2. Opublikować dokładne źródło jako nieaktywne wejście przeglądu. Wybrać zgodny transport polityki w istniejącym mandacie ARCHITECTURE. Normalne merge z aktualnym main muszą zachować pełny własny diff; neutralne wejście może zostać włączone dopiero gdy wszystkie jego publiczne źródła są rzeczywiście przyjęte. Żadne `ours`, reset ani force push nie zastępują tego warunku.
3. Z aktualnego zaufanego main uruchomić istniejący `validate-sg2` dla rzeczywistego PR i dokładnego HEAD polityki. Zweryfikować oryginalny artefakt, cały udany run, właściwe bieżące dziesięć wejść kontrolera, izolowany checkout i niezmienione wejście przed/po wykonaniu. Wymagane publiczne kontrole pozostają obowiązkowe. Politykę przyjąć dopiero zgodną procedurą, następnie zweryfikować wynikowy main.
4. Pod nową zaufaną polityką wykonać nowy kontrolowany przebieg dokładnego wspólnego kandydata Kalendarza, niezależnie zweryfikować artefakt i publiczne kontrole, normalnie przyjąć źródło i sprawdzić wynikowy main. Każdy nowy candidate SHA ma własne dowody; historyczny PASS nie jest zamiennikiem.
5. Przed aktywacją ponownie odczytać pięć zasobów i sześć bindings, sprawdzić pełny LKG i brak konkurencyjnej zmiany. Jeżeli dotychczasowy dokładny release GO nie obejmuje wynikowego przyjętego SHA, przedstawić aktualizację dla konkretnego SHA i zasobów. Ta decyzja nie przyznaje blankietowej zgody na nieznane przyszłe wydanie.
6. Następnie wykonać dopuszczoną aktywację istniejącego planu, dokładne wdrożenia Development, odbiór LIVE15/4 +1e-mail +scenariusze negatywne i prawidłowy końcowy closeout. PMOS/PHR nie zostaną zamknięte na podstawie samego kodu lub CI.

Nie jest proponowane wyłączenie bramki, rozszerzenie main-only, nowy token CI, nowe konto/zasób/koszt, Staging, Production ani onboarding. Jeśli aktualny trusted checker odmówi nowej chronionej zmiany, przyczyna zostanie ustalona z konkretnego logu; niniejszy pakiet nie daje ogólnego prawa do jej pominięcia.

## Odtworzenie i rollback

Przed przyjęciem propozycje pozostają nieaktywne. Po przyjęciu wycofanie własnej polityki wymaga zwykłego przeglądanego revertu, zachowania równoległych zmian i świeżych dowodów. Plan odzyskania runtime jest sprawdzany osobno na rzeczywistym LKG przed release; ten pakiet nie przywraca bazy ani cudzej wersji. Wszystkie historyczne receipts i rejestracje pozostają zachowane.

## Rzeczywiste dowody

| Zakres | Dokładny SHA | Wynik | Pominięte |
| --- | --- | --- | --- |
| Integralność źródła, 25 plików testowych | `3b078cf760901c810acd27618f781e027e0d6af5` | 308/308 PASS | 0 |
| Pełny governance polityki, 18 plików testowych | `045d6d78b9579290e240311d63dfb6ab7d8eab83` | 693/693 PASS | 0 |
| Pełny governance wspólnej kompozycji, 18 plików testowych | `cc90da35be61519f7ea23cf62d0455eae8ba7121` | 700/700 PASS | 0 |

Każdy przebieg zachował dokładny HEAD i czysty śledzony working tree po zakończeniu. Adres origin odpowiada rzeczywistemu repozytorium GitHub. Pełne komendy, czasy, identyfikatory i SHA256 logów są w załączonym JSON. Wcześniejsze porażki zostały zachowane w dzienniku; powyższe wyniki dotyczą końcowych dokładnych wersji.


Prywatne testy wykonano wyłącznie w Codespaces, bez poświadczeń produktu i bez wdrożeń. Ich wyniki są przygotowaniem decyzji; nie stanowią kanonicznego kontrolowanego CI ani odbioru LIVE.
