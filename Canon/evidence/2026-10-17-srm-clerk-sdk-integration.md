# E1 — integracja oficjalnego logowania Clerk w SRM

Status: **CANDIDATE_NOT_ACTIVATED**. Zadanie `SRM-E1-CLERK-SDK-INTEGRATION-20261017`, profil SRM, TARGET_ENVIRONMENT=development, wykonanie lokalne. Baseline source `b4595b40826a201592d07d0aae838d99e6db51f2`. Pełny E1 pozostaje **IN_PROGRESS**.

## Zakres i zachowanie

Właściciel potwierdził, że Clerk pozostaje obecnym dostawcą logowania; własny system jest kontekstem przyszłego, odrębnego kroku. Własne identyfikatory Profitii, członkostwa i uprawnienia nadal należą do wspólnego prywatnego hosta i access-store. Samo logowanie nie nadaje dostępu do danych lub produktu.

SRM dołącza oficjalne `@clerk/backend` 3.25.0, `@clerk/react` 6.17.8 i `@clerk/localizations` 4.23.0. Next16.3.8 i React19.2.4 zachowano. Nie dodano własnego JWT, cookie, OTP, resetu hasła lub silnika uprawnień. Oficjalny komponent obsługuje także dodatkowe wymagania sesji i Device Trust; ma polską lokalizację, wyłączoną telemetrię i nie prezentuje samoobsługowej rejestracji.

Istniejący układ strony, branding i informacje o funkcjach pozostają. Wybrany przez serwer komponent otrzymuje tylko publishable key, bez klucza backendowego lub połączenia bazy. Komponent używa routingu hash i stałego lokalnego celu `/xray`; nie przyjmuje przekierowania z danych użytkownika. Publiczny obiekt konfiguracji ma zamknięty zestaw pól i zamrożone origins. SDK backendu komponuje się z istniejącym wspólnym identity-provider.

## Granica aktywacji

Brak `SRM_AUTH_PROVIDER` zachowuje aktualny `legacy_demo`. Jawny tryb `clerk` wymaga kompletnej, zgodnej konfiguracji środowiska, issuer, publishable key, sekretu oraz dokładnych dozwolonych origins. Błędna jawna konfiguracja zwraca ogólną niedostępność logowania; nie wraca do demo i nie ujawnia wartości konfiguracji. Klucz publiczny musi wskazywać ten sam host co issuer. Staging/Production odrzucają klucze testowe i `.accounts.dev` oraz origins bez HTTPS, zgodnie z przyjętym adapterem tożsamości.

Ta jednostka **nie aktywuje trybu Clerk w usłudze**. Istniejące middleware, demo login/logout i wejścia biznesowe nie zostały tu przełączone. Nie należy włączać trybu przed osobnym przyjęciem serwerowego uwierzytelnienia, pełnej macierzy chronionych operacji i kontrolowanym wydaniem. Sam zapis sekretu w Render nie włącza trybu. Nie zapisano ani odczytano rzeczywistego klucza Clerk, nie wykonano bootstrapu konta i nie deklaruje się dowodu rzeczywistej sesji.

## Dowody i ograniczenia

Nowe siedem testów potwierdza domyślną zgodność obecnego wdrożenia, odmowę przy każdym brakującym polu, redakcję błędów, zamkniętą publiczną konfigurację, błędne/zdublowane origins, niezgodny host klucza, niezgodne środowiska, kompozycję rzeczywistego SDK ze wspólnym adapterem oraz renderowanie oficjalnego UI na React19. Używają syntetycznych kluczy, bez żądań do konta Clerk. Test renderowania serwerowego nie dowodzi interakcji przeglądarki, otrzymania kodu lub zalogowania.

Dotychczasowe **28 testów rzeczywistych API/SQL przechodzi bez pominięć** na strzeżonym lokalnym PostgreSQL. Typecheck i build aplikacji są wymagane przed publikacją. Pełny produktowy CI uruchamia również istniejące testy migracji w osobnym PostgreSQL; dowód jego dokładnego SHA należy do PR i closeout, nie do wcześniejszego przebiegu.

Instalacja używa kanonicznego `--install-links`, zgodnie z CI. Nie zmieniono wersji pozostałych zależności produktu. Audyt zależności zgłosił istniejące `sharp` 0.34.5 (high), `exceljs` 4.4.0 i jego `uuid` 8.3.2 (moderate); wszystkie trzy wersje są takie same w baseline. Nie przeprowadzono automatycznej aktualizacji z możliwą zmianą zachowania eksportu lub obrazów. Te znane ustalenia wymagają oceny przed odbiorem wydania; nie przypisano ich SDK Clerk i nie pominięto ich w raporcie.

Nie wykonano zdalnego SQL, migracji danych, zmiany sekretów lub usług dostawców, deploymentu, Staging lub Production. Własny PMOS/PHR SRM wymaga potwierdzonego closeout po publikacji; MEMOROS pozostaje disabled według profilu. Ta jednostka nie jest odbiorem logowania żywego produktu lub pełnego E1.

Źródła API: [oficjalny backend SDK](https://clerk.com/docs/reference/backend/overview), [authenticateRequest](https://clerk.com/docs/reference/backend/authenticate-request), [metody i stany logowania](https://clerk.com/docs/guides/development/custom-flows/authentication/email-sms-otp).
