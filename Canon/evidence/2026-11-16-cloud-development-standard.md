# Wspólny standard Development Cloud — pakiet do aktywacji

Data: 2026-11-16. Status: PARTIAL / EXACT_OWNER_ACTIVATION_PENDING.
Task: ARCH-CLOUD-DEVELOPMENT-STANDARD-20261116. Profil: ARCHITECTURE / Development.
Owner: Governance Source Layer.

## Stan i granice

Prace wykonano wyłącznie na zatwierdzonym Linux Codespace sg-dev-shared-development-pjxxv4556rx52rvww, device b588b158-1bba-440f-be50-7baa063fb2ee, w izolowanym checkout /workspaces/sgdev-tasks/cloud-process-standard-20261116/architecture i własnym PHR clone. Authority main przy rozpoczęciu i przed publikacją: 80875d8f0e9451cd9afd34e8baf2a8f6059bc064.

PMOS begin: cmwja1fb60000wccjfqtj04fn; conversationId pmos-task-v2:712a30a472dbeedb6fff0636e4be6a78a374628fcd679b3f880b2cc5adae43bb. Platforma nie udostępniła stabilnego hostConversationId: zapisano null / UNAVAILABLE. Niezależny odczyt Neon potwierdził architecture_pmos, rolę architecture_pmos_runtime, właściwy projekt/workspace/codespaces i status running. Nie wyeksportowano pełnego kontekstu ani historii continuity.

Pakiet nie aktywuje sam siebie. Nie wznowiono funkcjonalności ECR/Calendar, ACG, rejestracji, CIC/AQC, SRM ani Procurement Insights. Ich PR, źródła, zgody i ownership pozostają odrębne. Nie zmieniono konfiguracji, kluczy, grantów, zasobów ani wdrożeń Render/Neon. Sentry/PostHog/MagicPath: NOT_APPLICABLE dla tego pakietu bez runtime/UI/telemetry changes.

## Potwierdzona diagnoza

Oryginalny diagnostyczny run 43868814288 / job 133304229839 potwierdza GITHUB_API_401 w fazie credential, po poprawnej kontroli źródła i przed npm install. Kod main wywoływał GET /user i sprawdzał login, read:packages oraz termin do 31 dni. Nie ustalono przyczyny odrzucenia tokena; nie przypisuje się jej urządzeniu ani Cloud.

Dopuszczenia konkretnych zadań są zapisane w dużym wspólnym kontrolerze. Osobno potwierdzono zależność historycznych dowodów od dokładnych bajtów manifestu i AGENTS. Pakiet korzysta z już ładowanego CORE Canon; aktywny manifest, root AGENTS i historyczne źródła/receipts pozostają bajtowo niezmienione.

CIC zweryfikowano niezależnie w jego repozytorium: AGENTS, lokalny kanon, routing i trzy workflow. Publiczne packages CI nie wymaga osobistego tokena; publikacja już używa GITHUB_TOKEN. Centralny standard jest dziedziczony przez wymagany shared CORE, z zachowaniem lokalnego CI, routingu i własnej continuity. Nie deklaruje się lokalnej modyfikacji CIC przez zmianę SG-dev.

## Zakres przygotowanych zmian

- Jedna norma w sekcji 10 istniejącego kanonu CORE; wrappery i adaptery odwołują się do niej przez krótki pointer.
- Macierz rutynowej autonomii i decyzji ownera, ponowne użycie zgód tylko w ich realnym zakresie, kontrola transportu przed publikacją.
- Job-level packages:read i automatyczny github.token; brak osobistego tokena jako fallbacku w nowej polityce.
- Wczesny probe dokładnych prywatnych artefaktów trusted main; izolowany npm environment/cache; ignore-scripts; sprawdzenie braku tokenów przed lifecycle.
- Dane dopuszczeń z trusted main, pełny path/blob/status/mode/project/owner/surface closure, ważność i niezależna approvalRef. Puste rejestry nie przyznają zgody żadnemu zadaniu.
- Generator PROPOSED rekordu z rzeczywistego Git i routingu; kandydat nie może sam aktywować rekordu.
- Nowy proof 2.0 dla dopuszczonego dokładnego źródła oraz zaakceptowanego authority main. Legacy proof i zamknięte reviews zachowano.
- Bieżące, identyczne metadane zależności authority zamiast nowego projektora historii dla każdego zwykłego źródła; niezmienne private pins i brak historycznych wyjątków peer w nowym modelu.
- Wykonywalne kontrole mandatu, świeżego stanu wydania, LKG/first deployment, konfliktu równoległego i wznowienia. Czyste funkcje nie zastępują odczytów providera i jego autoryzacji ani istniejących executorów.

## Walidacja

Końcowa regresja kontrolera, path coverage i wspólnego standardu: **310/310 PASS**, zero failed/cancelled/skipped. SHA-256 pięciu plików wykonawczych/testowych potwierdziły brak zmian w trakcie całej próby. Governance/workspace: **51/51 PASS**. PMOS/PHR lifecycle: **74/74 PASS**. Łącznie **435 testów PASS**; nie jest to proof CI na GitHub ani odbiór LIVE.

Dodatkowo: pełny require-begin preflight PASS; manifest validator PASS; oba typechecki PMOS PASS; YAML parser PASS i tylko contents:read/actions:read/packages:read w kontrolowanym jobie; git diff --check PASS. Próba git push --dry-run potwierdziła możliwość publikacji bez odczytu poświadczeń. Render potwierdził wyłączone previews dla powiązanych usług SG-dev; Draft PR nie uruchamia nowego kontrolowanego joba z poświadczeniem, który pozostaje main-only.

Testy obejmują rzeczywiste Git checkouty, merge świeżego main, zmienione bajty/mode, ekstra pliki, niedopuszczone ścieżki polityki, duplikaty, expiry/revocation, błędne repo/owner/profile, wyścig API, brak tokenów, niezgodne private pins/peer metadata, nowe koszty/dostęp, równoległy deploy, rollback danych i wznowienie. Lifecycle PMOS/PHR używał izolowanego lokalnego PostgreSQL i przypiętego rzeczywistego publishera PHR, bez połączenia z bazą produktu. Nie jest to dowód wdrożenia lub rzeczywistej instalacji prywatnych pakietów przez nowy token Actions.

## Jeden wniosek właściciela i administratora

Do decyzji jest dokładny commit i cały diff wskazany przez ten Draft PR, łącznie z nowym modelem zaufanych rekordów i job-level packages:read. Publikacja propozycji nie jest zatwierdzeniem merge ani aktywacją polityki.

Obecny main nadal wymaga sprawnego SG2_PACKAGES_READ_TOKEN dla kontrolowanego dowodu przed przyjęciem poprawki. Jeśli odrzucenie utrzymuje się, administrator musi jednorazowo przywrócić to poświadczenie w dotychczasowych granicach: profitia, wyłącznie read:packages, prawidłowa ważność do 31 dni; bez repo/write, bez przekazywania wartości agentowi. Nie ma uprawnienia do samodzielnego tworzenia nowego klucza ani pobrania go z Maca. Nie można bezpiecznie uruchomić niezaakceptowanej polityki jako jej własnego zaufanego bootstrapu.

W tej samej decyzji należy określić dopuszczenie normalnej aktywacji po wszystkich wymaganych CI oraz — wyłącznie jeśli probe faktycznie wykaże brak — ograniczony READ dla repozytorium profitia/SG-dev w Manage Actions access dokładnie @profitia/advisory-widget, @profitia/cic-core i @profitia/cic-procurement. Żaden grant nie został wykonany.

Po decyzji agent ma bez kolejnych pytań o rutynową technikę:
1. Odświeżyć main/head i potwierdzić identyczność zatwierdzonego pakietu.
2. Przejść istniejącą ścieżkę publicznego i trusted-main CI, normalnego merge i resulting-main verification.
3. Wykonać rzeczywisty credential-preflight i czystą instalację z nowym job tokenem, z weryfikacją exact artifacts i sanitizowanego dowodu.
4. Przeprowadzić pilotaż własnego wydania standardu governance: owner Governance Source Layer, profil ARCHITECTURE, authority main, bez runtime deploymentu produktu; następnie exact-source probe nowej ścieżki na osobnym, owner-routed neutralnym źródle laboratoryjnym.
5. Przekazać istniejącym zadaniom wersję kontraktu, SHA i dowody. Ich właściciele zachowują swoje zgody i wykonują własne release scenariusze; żadne inne zadanie nie jest przejmowane.
6. Zakończyć wymagany PMOS/PHR closeout dopiero po rzeczywistym odbiorze. Do tego czasu rejestracja pozostaje running; brak końcowego PHR nie jest oznaczany jako PUBLISHED.

Rzeczywisty pilotaż runtime release wymaga przed uruchomieniem konkretnego ownera, ID zasobu, exact SHA, mandatu, LKG i dostępnej ścieżki behawioralnej weryfikacji. Pakiet nie deklaruje jego wykonania ani kompletnego Business Outcome.

Rollback aktywacji: kontrolowany revert wyłącznie własnego przyjętego pakietu przez normalny PR i wymagane kontrole, po ponownym sprawdzeniu równoległych zmian. Nie cofa danych, grantów ani cudzych deploymentów. Poprzedni source baseline to main 80875d8f; jego CI-auth nie jest potwierdzonym funkcjonalnym LKG. Jednorazowe poświadczenie bootstrapu należy zachować zgodnie z jego ważnością do potwierdzenia nowej ścieżki i możliwości zgodnego wycofania. Nowe proofy tracą ważność po zmianie aktywnej polityki.
