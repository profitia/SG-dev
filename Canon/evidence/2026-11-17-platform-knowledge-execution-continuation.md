# Platform Knowledge — aneks wykonania CI i właściciela Identity

**PROPOSED / OWNER_DECISION_REQUIRED**. Decyzja `ARCH-PK-STAGE2-EXECUTION-CONTINUATION-20261117` dotyczy tylko dwóch nowych warunków. Pierwotny GO i aneks public-proof pozostają ważne; dokładne wydanie aplikacji **123d4d7df165b73852724d5e09056424f4ce631a**, SQL001/015/016, dwa bindingi,11 grantów, terminy, istniejące trzy usługi Development i budżet USD10/USD1 nie zmieniają się. Nie wykonano nowych grantów ani migracji.

## 1. Zachowanie przyjętej równoległej polityki CI

Pełny [resulting-main44049612648](https://github.com/profitia/SG-dev/actions/runs/44049612648) naprawy1092 jest SUCCESS. Następnie authority przyjęła politykę Kalendarza w **df57c042e2fbd60fc14ea7f883f245ea6be8e2ee**. Nie wolno jej zastąpić wcześniejszym pełnym plikiem zatwierdzonym dla PK.

Nowa kotwica polityki **a03b3318c1a1e62ef63bae1fbf4da07d1f2c985f** jest zwykłym, bezkonfliktowym merge wcześniejszego kandydata9d9da030 z tym przyjętym main. Zachowuje wszystkie zmiany Kalendarza, transport1092 i dokładną własną poprawkę PK. Nie dodano ręcznie nowej logiki polityki.

| Plik | SHA256 pełnego kandydata |
| --- | --- |
| `scripts/governance/controlled-package-ci.mjs` | `903fc539c3ae08c3b389dd33a3f45207a2d6ee885f028477baea99830afb3964` |
| `scripts/governance/controlled-package-ci.test.mjs` | `2a972a846ffafe3225092b91e28c024affabe36e97b321659ad47103541b2435` |
| `scripts/governance/platform-knowledge-routing.test.mjs` | `a742682f9e12ba76f469b3c847df886ac3b936fd5f0666bb2a3d679598ea972d` |

[Pełny patch względem przyjętego main](../proposals/platform-knowledge-stage2-sdk-20261111/ci-continuation.patch), SHA256 **7780e7f0265d86df75955eed0d6a1df0b38820aeaba84328f781275e208436cb**. [Maszynowy zakres](../proposals/platform-knowledge-stage2-sdk-20261111/execution-continuation.json) wiąże kotwicę, hashe i warunki.

- ci-continuation-full-regression: ℹ tests 625, ℹ pass 625, ℹ fail 0, ℹ skipped 0; exit=0
- ci-continuation-source-full-regression: ℹ tests 666, ℹ pass 665, ℹ fail 0, ℹ skipped 1; exit=0

W rozszerzonej sesji źródłowej pominięto wyłącznie test centralnego SQL wymagający osobnego natywnego PostgreSQL. Nie jest on zaliczony przez tę sesję i pozostaje obowiązkowym natywnym gate przed wdrożeniem. Nie usunięto testu ani nie zastąpiono go mockiem. Rzeczywisty resulting-main Kalendarza44053970212 na df57c042 również jest SUCCESS.

Dopuszczone odświeżenia obejmują wyłącznie bezkonfliktowy merge późniejszych, już prawidłowo przyjętych niezwiązanych zmian main, przy zachowaniu kotwicy, wszystkich bajtów authority i identycznych własnych dodanych/usuniętych linii PK, ścieżek i trybów. Nie ma delegacji ręcznego rozwiązywania konfliktu polityki ani nowej logiki CI. Każdy rzeczywisty HEAD wymaga świeżego controlled proof, pełnego zwykłego CI i resulting-main CI; brak wyjątku bootstrap/admin/force/sztucznych statusów. Zmiana własnego patchu lub runtime wymaga odpowiedniej nowej decyzji.

## 2. Rzeczywista rola wykonawcza centralnego Identity

Odczytowe wykonanie `SET LOCAL ROLE profitia_access_owner` zostało odrzucone przez bazę kodem **42501**. `neondb_owner` ma MEMBER, lecz obie istniejące krawędzie mają SET=false; metadane członkostwa nie dowiodły prawa wykonania. Nie próbujemy migracji jako administrator. Osobny rzeczywisty odczyt potwierdził działające przejście produktu `platform_knowledge_migrator → platform_knowledge_owner`.

Minimalny wnioskowany zakres: w `spring-bread-28217539 / br-sparkling-term-b99l107x / platform_private`, tylko istniejąca własna krawędź **OID139949**, `neondb_owner → profitia_access_owner`, dostaje **SET=true wyłącznie wewnątrz transakcji**. Po wykonaniu zatwierdzonego payloadu następuje powrót do session role, przywrócenie SET=false i dokładne porównanie obu krawędzi przed COMMIT. ADMIN=false i INHERIT=false tej krawędzi zostają zachowane. Krawędź providerowa OID24577 oraz role runtime są nietknięte.

[Pełna transakcja instalacji](../proposals/platform-knowledge-stage2-sdk-20261111/identity-owner-install.sql), SHA256 **75ee6a624e34685735b1e0762aaef783d9177a1db05bb25d7a34ca600bd48a37**, zawiera niezmieniony SQL015 o wcześniej zatwierdzonym hashu, dwa exact application/receiver enrollmenty i11 dokładnych UUID grantów. Dopuszczamy maksymalnie24 krótkie transakcje do **2026-11-24T23:59Z**, wyłącznie: próbę z ROLLBACK, instalację i już zatwierdzone testy revoke/expire/restore nowych grantów/delegacji PK. Każda wymaga tego samego warunku startowego i przywrócenia przed COMMIT; błąd oznacza pełny ROLLBACK, bez trwałego rozszerzenia SET. Limity transakcji: lock5s, statement120s, idle60s. Pierwsza próba tej nowej drogi nastąpi dopiero po decyzji; obecny dokument nie twierdzi, że sprawdzono jej prawo zapisu.

Mechanika SET/ADMIN/INHERIT i zachowania niewskazanych opcji jest określona w [PostgreSQL18 GRANT](https://www.postgresql.org/docs/18/sql-grant.html). Fakty z obu rzeczywistych odczytowych prób zapisano w JSON. Nie wykorzystujemy cloud_admin, nowej roli, alternatywnej tożsamości ani szerokiego grantu operatora.

## Decyzja i automatyczna kontynuacja

Wniosek: **GO dla obu powyższych ograniczonych elementów i opisanych odświeżeń**, z niezmienionymi wszystkimi warunkami pierwotnego wdrożenia. Odrębna decyzja wynika z [CORE §10.1](../v3.0-profitia-agent-execution-canon.md#101-mandat-i-ponowne-używanie-zgód): nowe bajty chronionego CI i nowe prawo użycia roli nie są objęte wcześniejszą dokładną zgodą. Po decyzji wykonawca kontynuuje wymagane CI, przyjęcie źródeł, instalację, Development deployment i rzeczywisty E2E bez nowego pytania o cel. Nadal nie jest to formalny odbiór pełnego Etapu2/3.
