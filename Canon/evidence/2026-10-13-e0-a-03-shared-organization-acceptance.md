# E0-A-03: odbiór zasobów w obecnej organizacji Neon Scale

**Status:** E0_A_03_COMPLETE — zakończony odbiór zasobów; ARCHITECTURE pozostaje nieaktywnym profilem.

**Data:** 13 października 2026, Europe/Warsaw.

**Podstawa:** [plan E0-A](../v1.0-architecture-parallel-development-onboarding-plan.md), [instrukcja zasobów](../runbooks/architecture-development-resource-setup-v1.md), [historyczna weryfikacja konfiguracji 03](2026-10-13-e0-a-03-resource-configuration-verification.md) i [dowody 01–02](2026-10-13-e0-a-01-02-implementation-verification.md).

## Decyzja właściciela i koszt

Po wyjaśnieniu zakresu planów Neon właściciel odwołał tworzenie osobnej organizacji i polecił kontynuować Full Autopilot w ramach tej samej organizacji. Przyjęty wariant to org-nameless-field-92563437, plan Scale, z dwoma odrębnymi projektami architektury. Nie tworzy się nowej organizacji, nie przenosi projektów ani nie obniża planu wspólnej organizacji.

NEON_PLAN_SCOPE_EXCEPTION z historycznej weryfikacji został rozstrzygnięty przez tę decyzję, a nie przez zmianę infrastruktury. Wymóg najniższego płatnego planu Neon ustępuje świadomie przyjętemu pozostaniu w obecnym Scale. Rozliczenie jest miesięczne, według usage. Nie zadeklarowano twardego limitu całego rachunku w USD; max 1 CU ogranicza moc, nie łączną fakturę.

W obecnym cenniku Scale compute kosztuje 0.222 USD/CU-hour; storage, historia i inne usage mają osobne stawki. Przykład z poprzedniego dowodu — dwa compute po 0.25 CU, aktywne przez 160 godzin miesięcznie — daje 17.76 USD samego compute. Jest to przykład, nie prognoza ani zatwierdzony limit rachunku. [Cennik Neon](https://neon.com/pricing).

Organizacja Neon oznacza organizację konta dostawcy i rozliczeń. Nie zastępuje Organisation ID klienta, członkostw ani User ID w aplikacjach. Kontrole tenancy produktu należą do architektury docelowej i nie są dowiedzione przez ten etap przygotowania.

## Końcowa tożsamość i konfiguracja Neon

Odczyty dostawcy potwierdziły plan Scale, właściwą organizację i dostęp ADMIN do obu projektów. Projekty używają AWS Frankfurt (aws-eu-central-1).

| Przeznaczenie | Projekt | PostgreSQL | Gałąź Development | Bazy | Endpoint |
| --- | --- | --- | --- | --- | --- |
| PMOS architektury | [profitia-architecture-pmos / billowing-credit-07394675](https://console.neon.tech/app/projects/billowing-credit-07394675/branches/br-curly-dream-b94be6uh) | 17 | br-curly-dream-b94be6uh | architecture_pmos | ep-solitary-unit-b9b3imd3 |
| Laboratorium | [profitia-architecture-lab / fancy-cell-49425728](https://console.neon.tech/app/projects/fancy-cell-49425728/branches/br-divine-fog-baohc5ay) | 18 | br-divine-fog-baohc5ay | architecture_sg_lab oraz architecture_srm_lab | ep-dry-hat-bafvyimb |

Obie gałęzie nazywają się development, są domyślnymi gałęziami nowych projektów i nie mają expires_at. Każdy projekt ma jeden endpoint. Endpointy i project defaults mają minimum 0.25 CU, maximum 1 CU i suspend_timeout_seconds 300. ID projektów, gałęzi, endpointów i baz są identyczne z wcześniejszym dowodem; transfer nie nastąpił.

Świeży read-only SQL potwierdził current_database, connected_role, wersję serwera oraz 0 niesystemowych relacji w każdej z trzech baz. PMOS używa właściciela neondb_owner, laboratorium architecture_sg_lab_owner. Bazy nadal są puste. Schematy aplikacji, role runtime i chronione konfiguracje połączeń nie zostały jeszcze wdrożone; należą do dalszego onboardingu.

## GitHub i Render

GitHub API potwierdziło environment architecture-development, ID 24168168252, w profitia/SG-dev. Selected branches and tags zawiera jedynie main typu branch, brak Required reviewers i Wait timer. Trzy niesekretne zmienne: PROJECT_KEY=ARCHITECTURE, TARGET_ENVIRONMENT=development, PMOS_MEMOROS_MODE=disabled. Liczba sekretów: 0. Uwierzytelniony panel Licensing potwierdził GitHub Pro i 4 USD per month. Nie zmieniano planu, środowiska ani innych subskrypcji w tym odbiorze.

Render: PROFITIA WORKSPACE / tea-d7lps8rbc2fs73cn80dg, projekt ARCHITECTURE / prj-db717krrjlhs739jgo0g, environment development / evm-db717krrjlhs739jgo1g. Świeży Dashboard potwierdził nazwę development, Cross-Environment Connections Blocked, 0 usług i 0 env groups. Utrzymany jest istniejący Pro workspace. Nie utworzono nowego runtime ani płatnych dodatków.

Blokada prywatnej sieci Render nie kontroluje zewnętrznych połączeń Neon. Potwierdzono ustawienie, a nie behawioralny test ruchu nowych usług — takich usług jeszcze nie ma. Uprawnienia i połączenia aplikacyjne oraz negatywne testy ich routingu pozostają kolejnymi warunkami odbioru.

## Historia anulowanego transferu

Zadanie SG2-GOVERNANCE-E0-A-03-NEON-TRANSFER-20261013 rozpoczęto przed odwołaniem przez właściciela. Wykonano tylko przygotowanie lokalnego brancha, rejestrację PMOS i odczyty. Nowej organizacji ani transferu nie wykonano.

Rejestrację zamknięto z wynikiem PARTIAL_SUCCESS i jawnym opisem anulowania, bez deklaracji sukcesu transferu. PMOS conversation pmos-task-v2:20a5d38d637f3e1a508608941920fe2f348d07fb8fa0f4487badb8430c1616c9, registration cmv6mze5e0000n6cij9qqh256. Niezależny odczyt potwierdził completed, CLOSEOUT_COMPLETE, PMOS save i runtime-context refresh SUCCEEDED, archive PASS, execution trail PRESENT, Memoros DELIVERED oraz zwolnienie pending i lock.

PHR commit [78bd632a66d99e4363e1f0d0471a6a8dfe01d793](https://github.com/profitia/project-history-repository/commit/78bd632a66d99e4363e1f0d0471a6a8dfe01d793), status PUBLISHED; obecność w origin/main potwierdzona niezależnie. Odbiór przyjętego wariantu otrzymał osobną rejestrację SG2-GOVERNANCE-E0-A-03-ACCEPTANCE-20261013.

## Zakres odbioru i następny punkt planu

Warunek zakończenia E0-A-03 został spełniony: instrukcje wykonane przez właściciela, rzeczywiste zasoby i konfiguracja potwierdzone, kosztowy wariant Scale przyjęty, granice projektów i ustawienie izolacji Render zweryfikowane. Nie wprowadzono nowych zmian serwisowych; publikacja utrwala aktualny odbiór i decyzję właściciela.

E0-A-01, 02 i 03 są zakończone. Etapy 04–09 pozostają niezrealizowane i poza bieżącym zakresem. Profil ARCHITECTURE nie jest ACTIVE, jego PMOS nie działa, bazy nie mają schematów aplikacji, a trzy tory nie przeszły próby równoczesnej pracy. Pełny onboarding nie otrzymuje statusu DONE. Luki L-01 do L-10 historycznego audytu nie są zamknięte przez odbiór zasobów.

Źródłową podstawą odbioru jest aktualny main fc166a46526e1bc1e038738f06eb166bbf5835fe. Uwzględniono równoległy development SRM, zachowując jego kod. Zakres publikacji ogranicza się do nowego dowodu, instrukcji, planu E0-A, roadmapy i manifestu. Historyczne dowody oraz freeze pozostają niezmienione.
