# E0-A-01 i 02: dowody wykonania

**Status:** FROZEN_IMPLEMENTATION_EVIDENCE — datowane dowody ukończenia dwóch etapów przygotowania.

**Data:** 13 października 2026, Europe/Warsaw.

**Zakres:** 01 i 02 ukończone; instrukcja 03 przygotowana w odrębnej publikacji, wykonanie serwisowe 03 oczekuje na użytkownika. ARCHITECTURE nie jest jeszcze aktywnym profilem. Etapy 04–09 nie zostały wykonane.

## E0-A-01

Opublikowano [plan wykonawczy onboardingu](../v1.0-architecture-parallel-development-onboarding-plan.md), mapę odpowiedzialności i projektów, kryteria regresji, politykę raportowania oraz sekwencję przygotowania zasobów. Manifest 3.10.0 zarejestrował 26 aktywnych dokumentów.

Publikacja: [PR #267](https://github.com/profitia/SG-dev/pull/267), merge SHA d3ce82a27dfa68a9e488e83c169b319267306e35. Diff względem uzgodnionego main obejmował wyłącznie plan i manifest.

Podczas publikacji main przesunął się przez [PR #266](https://github.com/profitia/SG-dev/pull/266), dotyczący funkcji SRM. Kontrola odrzuciła merge na starej podstawie; zmianę SRM uwzględniono bez nadpisania pracy, a preflight i CI ponowiono.

Walidacja: preflight i require-begin PASS, governance 12/12 PASS, odnośniki i diff check PASS; [PR CI 38377953272](https://github.com/profitia/SG-dev/actions/runs/38377953272) i [main CI 38378104837](https://github.com/profitia/SG-dev/actions/runs/38378104837) SUCCESS. Zdalny GitHub Contents API potwierdził zgodność opublikowanych dwóch plików.

PMOS: task SG2-GOVERNANCE-E0-A-01-20261013, registration cmv6hd0bu0000l55wdrlowf71, conversation pmos-task-v2:554fa82546c96890f0f6eb22df82752d2ef4f8381bbe2ddacb60ddd8628259ca. Niezależny odczyt bazy potwierdził completed, CLOSEOUT_COMPLETE, PMOS save i runtime-context refresh SUCCEEDED, archive PASS, execution trail PRESENT oraz Memoros DELIVERED do kanonicznego projektu SG2. Pending input i lock zostały zwolnione.

PHR: commit 090d433168ccb3cb5ee479dcb2c21386a93a0185, publikacja SG2:SG2-GOVERNANCE-E0-A-01-20261013, status PUBLISHED. Reachability z origin/main niezależnie potwierdzona. Dla tego przebiegu użyto własnego klonu PHR.

## E0-A-02

Publikacja: [PR #268](https://github.com/profitia/SG-dev/pull/268), merge SHA ae4981284bbf6964d8c9a549951aea112ebbec81. Zakres to dokładnie pięć plików:

- Canon/registries/current-architecture-baseline-v1.json;
- scripts/governance/routing-engine.mjs;
- scripts/governance/governance.test.mjs;
- apps/pmos/scripts/pmos-save.ts;
- apps/pmos/scripts/pmos-save.test.ts.

Baseline otrzymał EXPLICIT_SURFACE_PROJECT_KEYS oraz allowedProjectKeys dla 21 istniejących surfaces. Po usunięciu tych nowych pól porównanie z wersją przed zmianą jest identyczne: wszystkie ownery, wzorce, klasyfikacje, reference SHA i epoch SHA zachowane.

Po fizycznym rozstrzygnięciu najbardziej szczegółowej ścieżki wykonywana jest kontrola projektu. SG2 wskazujący źródła SRM i SRM wskazujący źródła SG2 są odrzucane. Mieszana lista dozwolonych i niedozwolonych ścieżek nie przechodzi kontroli. Brak flagi polityki w SG-dev, pusta lista, wildcard, duplikat lub nieprawidłowy identyfikator blokują routing. Dotychczasowy warunek wyjątku dla LEGACY pozostaje egzekwowany.

Ścieżka PMOS z wyłączonym Memoros korzysta z potwierdzonego profilu zadania przy budowie kandydata PHR, komunikatach oraz decyzji o zakończeniu. Zachowano istniejące helpery SRM jako zgodne adaptery. SG2 i CIC nadal wymagają Memoros; SRM ma wyłączony Memoros. Błędy PHR zachowują recovery i nie uprawniają do zwolnienia pending slot ani deklaracji zakończenia.

Nowy profil ARCHITECTURE sprawdzono jako syntetyczną fixture w testach czystych funkcji. Próba rzeczywistego preflightu ARCHITECTURE jest nadal BLOCKED jako unknown project. Nie utworzono jego rekordów PMOS, zasobów ani aktywnego wpisu rejestru.

### Testy i build

| Kontrola | Wynik |
| --- | --- |
| Baseline PMOS: registration, profiles, PHR, closeout | 40/40 PASS |
| Governance oraz classifier po zmianie | 41/41 PASS |
| Wybrane PMOS registration, profiles, PHR, closeout po zmianie | 44/44 PASS |
| Typecheck i lifecycle typecheck | PASS |
| Pełny build PMOS przed zmianą i po zmianie | PASS |
| Canonical preflight z require-begin na pięciu ścieżkach | PASS |
| Lokalny Event Ledger i historia własnego zadania 01 | HTTP 200; tożsamość z kanonicznego Flight Record potwierdzona |
| Lokalny bezpośredni zapis ConversationArtifact | HTTP 410, PMOS_CANONICAL_SAVE_REQUIRED |
| Zdalny odczyt pięciu opublikowanych plików | Zgodność bajtów i SHA-256 PASS |

[PR CI 38380159732](https://github.com/profitia/SG-dev/actions/runs/38380159732) oraz [main CI 38380647491](https://github.com/profitia/SG-dev/actions/runs/38380647491) zakończyły się SUCCESS na właściwych SHA. GitHub workflow obejmował także testy historycznego estate i recovery oraz bramki SG2 i SRM Development.

### Rzeczywiste wdrożenie

Render: workspace tea-d7lps8rbc2fs73cn80dg, service srv-d88utm77f7vs73blrj1g, deploy dep-db703gqjnfac73ee6vtg, LIVE SHA ae4981284bbf6964d8c9a549951aea112ebbec81. Odczyt dostawcy potwierdził status live po automatycznym deployu z main.

O 12:06 czasu warszawskiego kontrola po wdrożeniu potwierdziła HTTP 200 dla Event Ledger i odczytu własnego zadania PMOS, health SG2 i SRM oraz dashboardu SG2. Odczyt historii sprawdził project i taskId w kanonicznym payloadzie. Nie było płatnych wywołań MGBI/Vercly ani zapisów biznesowych.

Przed zmianą PMOS LKG miał deploy dep-dapnv7gjo6nc73cskt1g i SHA 1abae93c972290ae8af5e2689320551824055ea7. Nowym punktem odniesienia dla przetestowanego zapisu i odczytu PMOS jest potwierdzone wdrożenie etapu 02. Nie wykonano rollbacku ani resetu baz.

### Ciągłość etapu 02

PMOS: task SG2-GOVERNANCE-E0-A-02-20261013, registration cmv6hwyfv0000ypdn4njk9rqu, conversation pmos-task-v2:29cbdacbc0b26a82ce7ba164cc21cedfbc6f290dfa2b718da7f5dcc814c98f37. Niezależny odczyt bazy potwierdził completed, CLOSEOUT_COMPLETE, PMOS save i runtime-context refresh SUCCEEDED, archive PASS, execution trail PRESENT oraz Memoros DELIVERED do kanonicznego projektu SG2. Pending input i lock zostały zwolnione.

PHR: [commit f37152a5a3ccd914110a7cd6d2351c255ae6b37e](https://github.com/profitia/project-history-repository/commit/f37152a5a3ccd914110a7cd6d2351c255ae6b37e), publikacja SG2:SG2-GOVERNANCE-E0-A-02-20261013, status PUBLISHED. Reachability z origin/main niezależnie potwierdzona.

## Znane ograniczenia i findings

Log odczytu historii PMOS wskazał brak public.conversation_roadmap_nodes. Istniejący fallback obsłużył odczyt, a kanoniczne dane zadania zostały potwierdzone. Kod fallbacku, API conversations i schema.prisma są identyczne z poprzednim LIVE SHA 1abae93; w etapach 01–02 nie wykonywano migracji ani odtwarzania tabel relacji.

Pierwsza próba lokalnego smoke sprawdzała top-level project, którego fallback nie zwraca. Test poprawiono na weryfikację flightRecordJson.metadata.project; kod aplikacji nie został zmieniony z tego powodu. Tożsamość rekordu potwierdzono również bezpośrednim odczytem PMOS.

Kontrole dostępności nie są pełnym biznesowym E2E ani testem bezpieczeństwa całego ekosystemu. Zmiany narzędzi przygotowują pracę, nie zamykają luk L-01 do L-10 historycznego audytu. Profil, raportowanie i równoległość ARCHITECTURE wymagają dalszego onboardingu. Kodu aplikacji, danych produktu i schematów biznesowych nie zmieniono w tych dwóch etapach; równoległy PR SRM został zachowany.

## Dalszy punkt wykonania

Obowiązuje [instrukcja czynności serwisowych E0-A-03](../runbooks/architecture-development-resource-setup-v1.md). Agent oczekuje na potwierdzenie wykonania i polecenie kontynuacji. Etapy 04–09 nie rozpoczęły się.
