# AppShell — odczyt własnego imienia i wołacza w Identity

Status: kandydat źródeł, przed CI, merge i wdrożeniem. Profil ARCHITECTURE, Development, authority profitia/SG-dev/main.
Task: ARCHITECTURE-APPSHELL-ACCOUNT-SALUTATION-READ-20261027.

Użytkownik doprecyzował, że AppShell ma korzystać z wołacza zapisanego w bazie podczas rejestracji. Następnie jawnie zatwierdził minimalny, osobny odczyt Identity i jego wydanie Development odpowiedzią „Tak — dodaj niezbędny odczyt Identity”, w host conversation 01a17d49-61a6-7821-ba8e-18b45d3c4048. Zakres nie obejmuje zmiany rejestracji, słownika, avatarów, członkostwa lub uprawnień PORR.

Nowy kontrakt: GET `/v1/account/salutation`. Zwraca wyłącznie `{userId,firstName,vocative,dictionaryVersion,version}` lub null dla nieistniejącego profilu. Źródłem są istniejące `first_name`, `name_vocative`, `name_dictionary_version` w `profitia_profile.user_profiles`, odczytane przez istniejącą funkcję `read_current()` i E1 `account.settings.read`, w trybie ACCOUNT_SELF. Bez nowego modelu uprawnień, SQL, migracji, tabel i grantów. Istniejący audyt E1 pozostaje aktywny.

Użyto publicznego `createPrivateOperationHost` oraz istniejącego w Identity protokołu transakcyjnego poświadczenia profilu. Zweryfikowane konto, bieżąca sesja i przypisanie UserID wyznaczają odbiorcę. Identyfikator w query, cookies innej domeny lub nagłówki klienta nie wybierają użytkownika. Dopuszczenie bearer peer jest ograniczone do zarejestrowanego SG2 origin, dokładnej ścieżki i GET. Brak CORS, brak przekazywania sekretów lub rozszerzania operacji.

Endpoint nie zwraca telefonu, stanowiska, płci słownikowej, preferencji awatara ani organizacji. Nie odmienia ponownie imienia, nie czyta go z Clerk metadata i nie aktualizuje istniejącego profilu. Preferencja awatara pozostaje odrębnym istniejącym kontraktem `/v1/account/assistant-avatar`, zgodnie z niezależnym wyborem użytkownika.

Pełny preflight i require-begin przeszły przed edycją. Nowy task ma własny checkout, config, node_modules, PMOS/context i klon PHR. Bez zmian źródeł SG2/SRM lub wspólnych pakietów. Wydanie wyłącznie do istniejącego Identity Development nastąpi po CI i przyjęciu źródła; identyfikatory i dowody końcowe będą zapisane po ich rzeczywistym odczycie.

Lokalnie: typecheck, build i lint PASS; pełna regresja Identity 358/358 PASS, w tym rzeczywisty izolowany PostgreSQL, E1/RLS, dwóch użytkowników, cofnięta sesja, niezweryfikowany e-mail, odmowa peer SRM, zamknięta projekcja i GET-only. Testy potwierdziły brak zmiany wersji/danych profilu, preferencji awatara oraz brak nowych membership/product grants. Nie używały Neon ani kont klientów.

Istniejący cel wydania: `identity-runtime-development`, `srv-dbcse6jrjlhs73eib3sg`, workspace `tea-d7lps8rbc2fs73cn80dg`, environment `evm-db717krrjlhs739jgo1g`. Zaobserwowany LKG: `dep-dbf6fjtg1s2s73elc3kg`, source `59179d2026932dec10d4849081481956e36d9832`, manual deploy, bez nowej usługi. Build ma istniejącą blokadę `IDENTITY_RUNTIME_EXPECTED_SOURCE_SHA`; przy wydaniu wymaga wyłącznie aktualizacji tego niesekretnego pinu do przyjętej rewizji, bez zmiany credentiali lub reguł sesji.

Porównanie z LKG wykazało także wcześniej przyjęte na main zmiany wspólnego platform-contracts 1.43. Ten task ich nie modyfikuje ani nie przypisuje sobie ich ownership. Regresja Identity sprawdza dokładne aktualne źródło wraz z tą zależnością; osobne aplikacje nie są wdrażane przez ten release.
