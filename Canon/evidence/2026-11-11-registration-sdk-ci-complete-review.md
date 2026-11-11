# Etap I — pełny przegląd źródeł SDK i zgodności logowania

Status: PROPOSAL / AWAITING_EXPLICIT_OWNER_APPROVAL. Ten dokument przygotowuje dokładne dopuszczenie do istniejącego chronionego CI. Nie aktywuje kontrolera, nie publikuje nowego zbiorczego kandydata i nie oznacza zakończenia Etapu I.

## Decyzja do zatwierdzenia

Dopuścić poniższy zamknięty zestaw 59 plików, wskazanych właścicieli i potwierdzenie SDK do istniejącej ścieżki CI. Po przyjęciu ograniczonej poprawki zaufanego kontrolera i przejściu wszystkich wymaganych testów pozwolić na wspólne przyjęcie źródeł przez Architecture, SG2 i SRM w PR983. Każda niesprawdzona zmiana pozostaje odrzucona.

To następca dokładnych decyzji PR988 i PR990, zachowanych bez przepisywania ich historii. PR990 został wykonany w PR991 (merge 1a0ccee82db7aa54e9c6fe02632899fd38ea2ddf): 191 testów kontrolera, kontrolowany przebieg 42981910989 z 1478 testami, typecheck/build i przebieg wynikowego main 42983936799 zakończyły się sukcesem. PHR potwierdza zamknięcie wyłącznie tej poprawki polityki w commicie 81d86593a3b2d6169ce4890e54f3cb0ab1912040. Sam proces rejestracji pozostał w realizacji.

## Dlaczego zmienia się zestaw

Rzeczywisty kandydat PR983 / 32f0698837885aae197e1b2c210b6bdaccdac071 przeszedł weryfikację przed odczytem prywatnych paczek, lecz pełny przebieg 42984471472 wykazał 63 błędy porównywania bieżącego i historycznego widoku SG2. SRM 42984299308 wykazał też rzeczywiste zatrzymanie interfejsu logowania.

Naprawa SG2 weryfikuje bieżący SDK przed odsłonięciem poprzedniego widoku, wiąże metadane z przekazanym widokiem, sprawdza fizyczną zainstalowaną kopię i zachowuje przyjętą integrację CIC 1.6 / ECR. Kolejność warstw to SDK, native ECR precision, ECR i wcześniejsze potwierdzenia; stare wartości i algorytmy zachowują własne historyczne bajty.

Naprawa SRM porównuje bieżące pliki produkcyjne, testy zgodności oraz kod odbiorcy z tym samym zweryfikowanym potwierdzeniem. Wcześniejsze mapy i porównania do ich commitów pozostają zachowane. Weryfikacja SDK poprzedza również historyczny widok MARKET_SYMBOL, aby przekazana metadana odpowiadała rzeczywistemu widokowi.

Dwa pliki SRM obejmują rzeczywistą zmianę interfejsu: ekran bierze etap z istniejącego modelu (logowanie zaczyna się od wyboru metody, rejestracja zachowuje wybór awatara), przywraca kosmetyczną preferencję awatara, respektuje profil zwrócony przez potwierdzone konto oraz automatycznie wysyła pełne sześć cyfr OTP. Pozostają hasło, odzyskiwanie dostępu, MFA i potwierdzenie ACCOUNT_SELF. Cookie sg_avatar_v1 jest podpowiedzią wyglądu, bez danych sesji i uprawnień.

Równoległa przyjęta poprawka PR998 / b2fccbb8b9132a63c2c39507a1ebc838cf6228e1 zachowuje natywną dokładność kalendarza. Jej 1499 testów, typecheck/build i pełne wymagane CI przeszły przed przyjęciem. Kompozycja zawiera tę poprawkę oraz przyjęte reguły Platform Knowledge z PR1000; nie cofa ich. Dodatkowy testowy guard precision jest jawnie sprawdzany przez nową warstwę SDK, a wcześniejsze algorytmy precision/ECR zachowują swoje dokładne historyczne bajty.

## Zamknięta granica źródeł

Zestaw liczy 28 plików Architecture, 17 SG2 i 14 SRM. Względem poprzednich 48 pozycji 35 jest identycznych, 13 otrzymuje nowe dokładne bajty, a 11 ścieżek jest dopisanych do jawnie weryfikowanego zakresu. Dopisane ścieżki nie oznaczają jedenastu nowych modułów produktu.

Wszystkie 155 plików produkcyjnego SDK nadal odpowiadają producentowi c373be45a5bf52c93034f5a1b6878e531c81b2ca. Zachowane są 48 fingerprintów, trzy fingerprinty paczek opcjonalnych, domyślny Root candidate.16 i opcjonalny candidate.21. Digest domyślnego Root: 58a5d94ba89b8bcc781affa3a9964d5f1d9f3ee11a152cddc7bc9ac098de2acf.

Potwierdzenie SDK zachowuje previousSourceSha b2fccbb8b9132a63c2c39507a1ebc838cf6228e1, przyjęte paczki CIC/ECR, 16 ścieżek weryfikacji SG2 i 13 SRM oraz 15 niezmienionych źródeł. Authority base kandydata zawiera także dokumentację 736396e6818c34bf588896f9435abc389889ed92. Oba poprzednie operation-integration.json zachowują pełne wcześniejsze wartości; dodana warstwa źródeł nie przyznaje uprawnień.

Każdy plik sprawdzono jako regularny blob 100644, a fizyczne bajty porównano z jego Git SHA. Wszystkie 155 źródeł SDK porównano z rzeczywistym niezmiennym producentem. Zbiorczy kandydat pozostaje lokalną kompozycją w Codespace do czasu dopuszczenia; całość kodu jest dostępna w publicznych wejściach właścicieli: PR989, PR987 i PR986. Kompozycja zachowuje też historię opublikowanego PR983, umożliwiając zwykłe przesunięcie gałęzi do przodu po spełnieniu warunków.

## Dokładna poprawka kontrolera po decyzji

Zaufany kontroler ma zachować wcześniejsze manifesty 41 i 48 plików i dodać wyłącznie ten następny zamknięty manifest. Weryfikacja potwierdzenia ma rozpoznawać wskazany poniżej SHA-256 rekordu i jego rzeczywisty predecessor b2fccbb8b9132a63c2c39507a1ebc838cf6228e1. Aktualna fizyczna proweniencja Root nadal musi dawać wskazany digest candidate.16.

Weryfikacja obejmuje pełny graf 155 plików, siedem plików zgodności, oba potwierdzenia odbiorców, dokładny zakres 59 pozycji i zachowane źródła, przed fazą credentials. Czyta JSON i hashe regularnych plików; kod JavaScript kandydata nie jest importowany w tej fazie. Jedyna dopuszczona ścieżka produkcyjnego interfejsu SRM to apps/srm/app/login/porr-account.tsx; nie powstaje ogólne dopuszczenie katalogu aplikacji.

Pozostają wymagane: istniejący workflow i main-only Environment, wewnętrzne repo/autor, aktualne paczki z dokładnymi pinami, read:packages, instalacja ignore-scripts, usunięcie credentialu przed testami i dowód dokładnego kandydata. Regresje kontrolera mają odrzucać podmieniony ekran SRM, nieznany/dodatkowy/brakujący plik, symlink, sfałszowany rekord, zmianę Root i naruszenie którejkolwiek bariery credentials. Ta propozycja nie nadaje nowych credentials, zasobów ani ogólnego prawa omijania kontroli.

## Weryfikacja przed dopuszczeniem

Na końcowej kompozycji:
- SDK, dopasowanie historycznych widoków, ECR/precision i strzałka: 16/16 PASS.
- Naprawione kontrole SRM bieżących źródeł, poprzedników i fingerprintów: 16/16 PASS.
- Rozszerzona zgodność SG2/PCI, ECR, prywatność i niezmienność historii: 65/65 PASS.
- Szerszy przebieg operacji SRM na poprzedniej kompozycji e59cb1b02195ec36067b23af73a573737cef6e9a (identyczne produkcyjne SDK i pliki SRM): 157 zaliczonych; 22 przypadki zatrzymane przed SQL z powodu braku izolowanego PostgreSQL/URL. Są to 18 unikatowych nazw przypadków w kilku importach. Brak innych niezaliczonych asercji w tym przebiegu. Pełny wynik pozostaje niezaliczony i nie zastępuje obowiązkowego CI z jego bazą.
- Wcześniejszy pełny przebieg aplikacji SRM na identycznych plikach produkcyjnych SDK i ekranu SRM: 956 PASS / 8 standardowych pominięć, następnie 3/3 diagnostyki i 7/7 kontraktu X-Ray. Po usunięciu odziedziczonego TARGET_ENVIRONMENT nie było błędów aplikacji. Późniejsze zmiany dotyczą porównań testowych/rekordu, a nie produkcyjnego SDK lub ekranu.
- Typecheck SRM PASS. Syntetyczny test przeglądarkowy rzeczywistego modelu rejestracji/logowania PASS: brak ponownego pytania o awatar, zapamiętany awatar i pierwszeństwo profilu, niepełny kod bez wysłania, automatyczne zatwierdzenie pełnego kodu, błąd kodu, hasło, konto bez hasła, odzyskiwanie, MFA, ukrywanie sekretów, mobile i motyw. Pliki produkcyjne i testu przeglądarkowego pozostają identyczne z wskazanym tu wejściem SRM.
- Manifest/routing i właściwe rejestracje PMOS producenta/odbiorców przeszły. Ten przegląd ma osobny task ARCH-REGISTRATION-SDK-COMPLETE-CI-REVIEW-20261111; conversationId pmos-task-v2:92ffa50f3e5160d0c3fea57d27f42c6db358f5b22bb8361104f2b633c5a1ac86.

Wyniki pochodzą z istniejących zdalnych Codespaces, na danych syntetycznych i publicznych zależnościach testowych. Nie stanowią odbioru żywego Clerk/Mailgun ani wdrożenia. Pełne testy z PostgreSQL, prywatnymi paczkami, build oraz wymagane publiczne i wynikowego main pozostają obowiązkowe. Brak pełnego dowodu nie jest pomijany ani zamieniany w sukces części.

## Następne kroki i granice

Po wyraźnej decyzji właściciela: ograniczona poprawka kontrolera i jego testów → wymagane testy poprawki polityki → przyjęcie polityki → publikacja dokładnie tego zbiorczego źródła → pełne controlled/public CI bez lokalnego wyłączenia przypadków SQL → wspólne przyjęcie źródeł → kontynuacja realizacji Etapu I.

Ta decyzja nie instaluje SQL007/008 w produkcie, nie tworzy rzeczywistego OrgID, nie przyznaje pakietu PORR, nie wysyła zaproszeń i nie wykonuje płatnych wywołań ani wdrożenia. Rzeczywiste API/HTTP, wiring UI i startup, issue/accept/outbox zaproszeń, lookup, projekcja pakietu/E1, domena/sesja, kontrolowany release Development oraz odbiór pozostają częścią aktywnego Etapu I. Rodzice projektu i dopuszczenia nie są zamykani tą propozycją.

Podstawa odrębnego dopuszczenia: Canon/runbooks/shared-development-contract-integration-v1.md, aktywny kanon wykonania oraz wcześniejsze dokładne decyzje PR988/PR990. Full Autopilot pozwala kontynuować zwykłe poprawki i przygotowanie, nie zastępuje tego zamkniętego dopuszczenia do chronionego CI.

## Zamrożony manifest źródeł

Entry-map SHA-256: 6894754702e205691a42c4b32b678169d36d341cf00845d6e2eed54c19e1ec65

SDK record SHA-256: 020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e

```json
{
  "prNumber": 983,
  "branch": "architecture/registration-bootstrap-stage-i-20261111",
  "sourceSha": "23954edbc65b8b404e7491f3bda56b8877b72864",
  "baseSha": "736396e6818c34bf588896f9435abc389889ed92",
  "treeSha": "3907ddec3ec7bda18329a3e8db3d93c5515ceba4",
  "inputs": [
    {
      "projectKey": "ARCHITECTURE",
      "taskId": "ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110",
      "prNumber": 989,
      "sourceSha": "f2725faad33090144ea5768b40dff6d997e7ef4b"
    },
    {
      "projectKey": "SG2",
      "taskId": "SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110",
      "prNumber": 987,
      "sourceSha": "4b756105b6852b036cb51371bc33eb7803e9dd98"
    },
    {
      "projectKey": "SRM",
      "taskId": "SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111",
      "prNumber": 986,
      "sourceSha": "fcb0eae366f4a9b9d26e9305a2163e83db15229e"
    }
  ],
  "entries": {
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": {
      "sha": "184536c22980b5c40df41ce65362caa4130de63c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    "apps/identity-runtime/src/organisation-onboarding.ts": {
      "sha": "98169978b157e0676f513f1b7ce11bac5c0a84d3",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/test/organisation-onboarding.test.mjs": {
      "sha": "f04a4b27f7b39d7031839afb877fe6f5e836ff83",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/newsfeed-runtime/test/runtime.test.mjs": {
      "sha": "36209e9d8c055fbbf695ba546634a25b1e161259",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/platform-source-hub/scripts/ci-routing.mjs": {
      "sha": "54142248b9b8096ed3d3b22e582478d019c505a6",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/ci-routing.test.mjs": {
      "sha": "f7b9d7bebae5d87c7aeb8e669077f6c7547d90f4",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/sg-runtime/operation-integration.json": {
      "sha": "bd3b3d6169ef575c2a79ae9c80ee529014f41632",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-ecr-integrity.mjs": {
      "sha": "ec0e23a87827d130e41210ca3cf0bbc29786efd5",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-ecr-integrity.test.mjs": {
      "sha": "8d2e68fa62b1295d35fbe74b9bdef6e9ab920582",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs": {
      "sha": "751ed6551ab43dd832e232136608a919837d779b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-m1-integrity.mjs": {
      "sha": "9f28f13a7da11d6def28a91a1440d22ea793b59c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-m2-integrity.mjs": {
      "sha": "55d2d9f8cc17adb3dcb7c5a2dfb0495b2b4c8de0",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-m2-source-view.mjs": {
      "sha": "a526345d7c153113ea629f3c16ec5c35c41567cb",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs": {
      "sha": "b19f2eea8f16ddb07d67dc0cbf4a97c15ea51181",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-send-arrow-integrity.test.mjs": {
      "sha": "4189be2d1998d14cfd5f25d74093595b6581b7fa",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": {
      "sha": "5f2c3194cadc617806f2a097e75cbdaebdef21a5",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": {
      "sha": "6836893a46e189aade7a422b4eca912dc9cbc9b1",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/operation-context.test.mjs": {
      "sha": "77a86e00786e8efd17d92fecbeb82aa0a56fec94",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/organisation-sdk-history.test.mjs": {
      "sha": "62b7b2aa205062d4f9598aa619ec3b2df8aff459",
      "status": "added",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": {
      "sha": "b08edf93ef8026ca982a6ce2a2c4d0ca1425f505",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/private-host.integration.test.mjs": {
      "sha": "19cb9afe8792b44ebf2822bf61692827bac49404",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": {
      "sha": "6e53641ad436dbd95568a49c26f7176616c8c686",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-platform-compatibility.test.mjs": {
      "sha": "e2a7d72bc910352bab449ff4cf2e651e015af96b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/srm/app/login/porr-account.tsx": {
      "sha": "f17f19b531cac97f09e87568123f2f71e1114416",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/operation-integration.json": {
      "sha": "7d399125fbb50f8b4f0b00db2662c05b1096995f",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": {
      "sha": "76e92f7822da73f8a74ac0feb10604b5b0789876",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/native-execution-adoption.test.mjs": {
      "sha": "ccbe63d9197e0be179cdfa9b512d80ca03c0de60",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/operation-context.test.mjs": {
      "sha": "1f2857013f176fe740e79539ca6c676cc0afab03",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/porr-account-ui.test.mjs": {
      "sha": "353de6a9e489103b2bea6e02c4bf7639ce624b63",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/private-host.integration.test.mjs": {
      "sha": "6156c9ab32f32ce116df6f58689f2b9a1b7ef878",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/request-quota-adoption.test.mjs": {
      "sha": "85b91a57e72633eee79aceb1a73bece0d1139d74",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": {
      "sha": "efedf34427ba2529e599d1568de31312df63bbda",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": {
      "sha": "555d0af768e006ca1c3e5788629cf749203dc7b5",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/xray-performance-adoption.test.mjs": {
      "sha": "0eea6287d1bb24e84eff8688c0bfa4a5e16bda4a",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/peer-read-boundary.test.ts": {
      "sha": "84a815444776c192eec80211190ff0dea189d26c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": {
      "sha": "d272026e1d3554700eeb87a3096343f0cc34dd23",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/supplier-location-geocoding-runtime.test.ts": {
      "sha": "0cb4a302f931fdbdb93cb3cb34c1e9dcf9d0fca7",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": {
      "sha": "f412f1607a4fca31cb1bbb583d45e7dc0828854c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql": {
      "sha": "a0239d930b8da5333e5589a1734bacb54d67191c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/profile/008-organisation-create.sql": {
      "sha": "5571f58c2ee30e3a0f1a33204ba8af4c53c29660",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/package.json": {
      "sha": "c2b5ab6d8a117c351fa0e03b3878eeec83f5c9f7",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": {
      "sha": "cd02bb919957e9da7cebb4c40fbe9a3ff4940fbe",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/operation-context.d.mts": {
      "sha": "b00220f767db22897bb3ec65233bb39fba715e4e",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/operation-context.mjs": {
      "sha": "d018c17a251abbf698c87a29aded91f93a4e493c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-bootstrap.d.mts": {
      "sha": "ffcacec4080ca608ab00e3aff0b7371f23f08a55",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-bootstrap.mjs": {
      "sha": "008ef066c74bd72a2a546f15f4cc1694db9ef297",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-invitations.d.mts": {
      "sha": "674a1e3d7841bad6194a176ecccd70622bae012b",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-invitations.mjs": {
      "sha": "280935c68a5d1c8194669f8894b87324c2ed6843",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-profile.d.mts": {
      "sha": "a8e933f8f4946ad9459baab93110976be88e97ef",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-profile.mjs": {
      "sha": "be2730964c8af8b32f8c8f2baf45aa26fe807949",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-bootstrap-postgres.test.mjs": {
      "sha": "28e82cc2af6d32f6a7e396c48ad081323680b140",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-bootstrap.test.mjs": {
      "sha": "ea30c87f19cfb0bc064cd922c23a0b0dde354c99",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-invitations.test.mjs": {
      "sha": "64fcb4270f376573c132040eb8fd66642240ecdc",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs": {
      "sha": "203ee38cf32c28327eecd1093100bef54db3a84d",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-profile.test.mjs": {
      "sha": "a6ed612325ad049dded4a4fbfdc00b254bc147e1",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.json": {
      "sha": "33ffdc98f29e6157136b898e704d75fc629a77db",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.mjs": {
      "sha": "6a791a82346ba08e0b7bc8dcacd8fb7737555df1",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs": {
      "sha": "7cc4c3e2b9eefc8bdd1c5ccee426fbb2c49b2c1c",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/private-operation-host.test.mjs": {
      "sha": "b96001f516411487bf6e1ca07aa21cb0a007cc5d",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    }
  }
}
```
