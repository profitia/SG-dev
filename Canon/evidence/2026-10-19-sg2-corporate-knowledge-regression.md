# SpendGuru — zgodność z granicą danych korporacyjnych SRM, 19.10.2026

Status: SOURCE_VALIDATION_CANDIDATE / PROGRAMME_IN_PROGRESS. Zadanie `SG2-E1-CORPORATE-KNOWLEDGE-REGRESSION-20261019`, profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority: profitia/SG-dev/main. Własne PMOS, wymagane MEMOROS i PHR; rejestracja nie jest closeout.

Kandydat zawiera dokładny źródłowy commit SRM `c8dfcd75cc730fc3b47dce219b8294881050b35f`, PR508, z zadania `SRM-E1-CORPORATE-KNOWLEDGE-BOUNDARY-20261019`. Jedyną własną zmianą SG2 jest ten dokument. Runtime SpendGuru, Dashboard i pakiety wspólne są identyczne bajtowo z punktem odniesienia `4ea954de3da61e754a1d1cc81606808a32112e34`.

SRM ogranicza strukturę istniejących danych korporacyjnych oraz usuwa cztery techniczne rozszerzenia kalkulatora z publicznych wskaźników finansowych. Zachowano wszystkie zadeklarowane pola, obliczenia, pełny przebieg raportu, prywatne zapisy i KYS. Lokalnie529 testów produktu (w tym18 nowych),132 natywne i311 promocji przeszły bez pominięć, podobnie jak typy i build SRM. To nie zastępuje testów SpendGuru.

Odbiór SG2 wymaga istniejącego kontrolowanego CI dokładnego połączonego kandydata z zaufanego main, rzeczywistych API/PostgreSQL, typów i builda Runtime, osobnego Dashboardu z produkcyjną odmową HTTP oraz regresji SRM. Po merge wymagane są dokładne artefakty i wyniki main oraz kanoniczny closeout. Identyfikatory wykonań i rezultat niezależnej weryfikacji są zapisywane po faktycznym zakończeniu; ten dokument nie deklaruje ich z wyprzedzeniem.

Nie zmieniono kontrolera, dostępu do pakietów, sekretów ani lokalnie nie instalowano prywatnych pakietów pożyczonym poświadczeniem. Nie zmieniono zasad PII/licencji, danych historycznych, SQL, ról, grantów, konfiguracji i zasobów. Nie odebrano pełnej orkiestracji ani publikacji katalogu i nie wykonano deploymentu. Zgodność żywych projekcji, aktualna sesja/role/directory, odzyskiwanie, pozostałe wejścia i późniejsze wydanie Development nadal wymagają własnych dowodów. Pełne E0/E1 pozostaje IN_PROGRESS; brak odbioru Staging, Production i E2–E4.
