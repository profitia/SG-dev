# E1 — osadzanie źródłowego pakietu w bundlerze SG2, 17.10.2026

**Task:** SG2-E1-SUPPLIER-BUNDLE-COMPATIBILITY-20261017; SpendGuru 2.0 / SG-dev / development / local. Begin cmvcrn5bd000011aw8rf8jx1v; conversationId pmos-task-v2:4e5fedb6868cfc0dfe2ec58c4d7e7e2c0c7cd148857ae93012a40543d840b852. Własne PMOS/MEMOROS/PHR, dokładnie next.config.mjs i ten dowód. Pierwszy begin utracił odpowiedź po zamknięciu połączenia; identyczne idempotentne ponowienie zwróciło RESUMED, a pełny require-begin preflight potwierdził zapis. Nie zdublowano zadania ani nie zmieniono jego treści.

Po korekcie noEmit targetES2020 kontrolowane CI39060534388 dla source4ee46eb53c290f441a240670c7a36540c46e73cc przeszło wszystkie129 testów i pełny typecheck. Next14 build odmówił następnie przetworzenia import type/as const w źródłowych .ts publicznych portów @profitia/srm-xray. Nie jest to błąd reguł finansowych lub nowa odmowa dostępu. Szczegóły potwierdzono dopiero w rzeczywistym logu; przejściowy błąd TLS przy jego pobraniu nie uzasadniał zmiany kodu.

Receiver jawnie wskazuje istniejący pakiet w standardowym transpilePackages. Jest to wzorzec już używany przez SRM; zachowano istniejący alias @, plugin next-intl, wersje Next14/React18, private pins, reguły i dokładną arytmetykę producenta. Bez nowego loadera, równoległego buildu biblioteki lub runtime.

Korekta jest częścią przyjętego E1, integracji SG2-E1-SUPPLIER-SUMMARY-ADOPTION-20261017 (PR447) i producenta SRM-E1-SHARED-SUMMARY-CONTRACT-PORT-20261017 (PR446). Wymaga ponownego pełnego czystego kontrolowanego test/typecheck/build na dokładnej połączonej wersji, osobnych kontroli SRM/dashboard/public React18/governance i zielonych bramek przed merge. Nie przedstawia nieudanych przebiegów jako dowodu odbioru.

Osobne wywołanie39060509953 z omyłkowym expected SHA zostało anulowane, a poprawne39060534388 wskazywało rzeczywisty HEAD. Nie uzyskano ani nie zaakceptowano dowodu dla innej wersji. Źródła i historia błędów pozostają zachowane.

Brak aktywacji, deploymentu, zmiany grantów, baz, poświadczeń, konfiguracji dostawców lub Staging/Production. Pełny E1 i rzeczywiste wydania nadal wymagają odrębnych dowodów.
