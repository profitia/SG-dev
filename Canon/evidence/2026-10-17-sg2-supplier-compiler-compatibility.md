# E1 — zgodność kompilacji wspólnego modułu w SG2, 17.10.2026

**Task:** SG2-E1-SUPPLIER-COMPILER-COMPATIBILITY-20261017; SpendGuru 2.0 / SG-dev / development / local. Własny begin cmvcrflvm0000fqfh1rpy4yy0; conversationId pmos-task-v2:344248099eda1045c68c16f35cfebf4d701e3473876109b8b65ff1a0ceb9a077. Własne PMOS, wymagane MEMOROS/PHR. Osobna tożsamość obejmuje dokładnie tsconfig i ten dowód; nie przepisuje rejestracji integracji.

Kontrolowane CI39060293811 dla source1230fb52cc0dcca057b93981a56b0cf7cdeb4d50 wykonało wszystkie129 testów API/Prisma/UI bez pominięć, lecz typecheck odmówił BigInt literals w niezmienionych financial-quality i financial-value publicznego pakietu. SG2 miał targetES2017. Ograniczony lokalny typecheck używał ES2022, dlatego nie wykazał tej różnicy i nie był dowodem pełnego buildu.

Zmiana podnosi wyłącznie target sprawdzania TypeScript do ES2020, najniższego standardu obsługującego te literały. Nadal obowiązuje noEmit; Next/SWC i jego polityka przeglądarek, Next14/React18, pakiety prywatne oraz dokładna arytmetyka i formatowanie finansowe pozostają bez zmian. Brak zaokrąglania przez Number, obejścia błędów typów, wyłączenia kontroli albo upgrade frameworka.

Korekta należy do przyjętego E1 oraz integracji SG2-E1-SUPPLIER-SUMMARY-ADOPTION-20261017 (PR447) i producenta SRM-E1-SHARED-SUMMARY-CONTRACT-PORT-20261017 (PR446, source702fc1d70ce4ed4797c5030ddae093694bc04e21). Wymaga nowego pełnego kontrolowanego test/typecheck/build na dokładnej połączonej wersji i wszystkich bramek przed merge; pierwszy nieudany przebieg pozostaje dowodem. Nie wykonano deploymentu, aktywacji, zmiany roli, bazy, sekretu ani konfiguracji dostawcy. Ta jednostka nie stanowi odbioru całego E1.
