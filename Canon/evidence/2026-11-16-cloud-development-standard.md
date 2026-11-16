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

## Kontynuacja i końcowy pakiet do decyzji — 2026-11-16

Właściciel zlecił przejęcie istniejącej realizacji. Aktualny hostConversationId to `01a1e538-b4a8-7d43-a3ca-35cf9711e157`; nie przepisano historycznej rejestracji z niedostępnym ID. Kanoniczna rejestracja kontynuacji: task `ARCH-CLOUD-DEVELOPMENT-STANDARD-CONT-20261116`, PMOS `cmwjhw1v70000om1af6ce49f2`, conversationId `pmos-task-v2:2e401e6641b3fddb1075a730f21987407447bb501c7d80a695c309a713427224`. Jest to dalsze wykonanie tego samego celu i PR1087, bez równoległej realizacji produktu. Wykonanie pozostaje w istniejącym Linux Codespace; lokalna rozmowa nie przenosi kodu ani konfiguracji produktu na Maca.

Niezależny przegląd wykrył, że assertSourceCheckout odrzucał zmienione zatwierdzone pliki i dodatkowe pliki w commicie, ale przepuszczał roboczą lub staged zmianę poza dopuszczonym diffem. Regresja najpierw wykazała rzeczywisty błąd (Missing expected exception), następnie przeszła po dodaniu kontroli czystego working tree/index i nieignorowanych plików. Pełna ponowna regresja kontrolera/path coverage/wspólnego standardu: **310/310 PASS**, pięć plików wykonawczych/testowych nie zmieniło się podczas próby. Skorygowano również niespójność starych artefaktów governance-final-result.json (exitCode1) i logu (51PASS) przez nową próbę: **51/51 PASS, exitCode0**. Historyczne pliki pozostają zachowane. Poprzedni PMOS/PHR lifecycle **74/74 PASS** i oba typechecki dotyczą niezmienionych źródeł; nie przedstawia się ich jako nowego wykonania. Łączny właściwy zestaw pozostaje **435 PASS**.

Konkretny pilot jest przygotowany w [PR1088](https://github.com/profitia/SG-dev/pull/1088): źródło `75ef419444f3d7476243c656079b35e504dab81a`, dokładnie jeden nowy zwykły plik `apps/architecture-lab/docs/cloud-development-admission-pilot.md`, blob `f359291d379815c3b443792bab56d83051180a39`, mode100644, owner Architecture Platform, surface ARCH-BASE-002, ARCHITECTURE/Development. Kanoniczny digest dokładnego proponowanego rekordu dopuszczenia w opisie PR1088: `5732d2cea362d8208babf9cde0941c007bc8a7474c5cf6cf9555bf25b3284add`. Rekord jest tylko projektem do decyzji; proponowane ACTIVE i approvalRef nie są aktualną zgodą ani grantem. Ważność proponowana: od 2026-11-16T00:00:00.000Z do 2026-11-23T23:59:59.000Z.

Osobny fizyczny Git fixture potwierdził identyczny blob/mode/pełny diff, linię źródła po symulowanym dołączeniu authority, odmowę zmienionych bajtów i zmian poza diffem, expiry/revocation/obcego ownera oraz odrębne transporty czterech profili. To jest **offline przygotowanie**, bez rzeczywistej instalacji pakietów, aktywacji lub operacyjnego odbioru. CIC AGENTS ponownie odczytano niezależnie z GitHub main i potwierdzono ładowanie aktualnego wspólnego CORE.

GitHub potwierdza, że SG-dev jest publiczne. Dokumentacja GitHub ostrzega, że READ przyznany publicznemu repozytorium może obejmować workflow z forków. Próba odczytu administracyjnej polityki forków istniejącym klientem w Codespace zakończyła się HTTP403; nie jest to dowód jej ustawienia. Warunek nowego dostępu obejmuje potwierdzenie przez administratora `all_external_contributors` (Require approval for all external contributors) i przegląd rzeczywistych uprawnień/kodu przed dopuszczeniem zewnętrznego workflow. Nie wolno utożsamiać main-only Environment jednego joba z izolacją wszystkich workflow publicznego repozytorium. Źródła: https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility oraz https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository .

### Skonsolidowana decyzja SG-DEV-STANDARD-1087-V1 — oczekująca

Do akceptacji: cały końcowy dokładny SHA/diff PR1087 (18 plików), nowy model zaufania i job-level packages:read, warunkowa zwykła integracja po wszystkich obowiązkowych kontrolach oraz scenariusz własnego wydania standardu governance (owner Governance Source Layer, ARCHITECTURE). W tej samej decyzji wskazany jest dokładny neutralny pilot PR1088 i wyżej związany rekord. Po zaakceptowaniu standardu delegowany maintainer może opublikować osobny zwykły PR dodający **wyłącznie ten rekord** do trusted-main ledger, zachowując inne dopuszczenia. Zgoda obejmuje jego dopuszczoną walidację oraz przyjęcie neutralnego źródła po dokładnych CI. Rutynowe dołączenie świeżego main jest dopuszczone tylko przy zachowaniu pierwotnego sourceSha w historii i identycznego pełnego pojedynczego diffu. Nie obejmuje nieznanych przyszłych bajtów reguł zaufania.

Administrator: jednorazowo przywrócić SG2_PACKAGES_READ_TOKEN w istniejącym GitHub Environment architecture-development w dotychczasowym zakresie profitia / tylko read:packages / prawidłowa ważność do31dni, bez wartości w rozmowie lub artefaktach. To umożliwia wymagany dowód pod starą zaufaną polityką. Dla automatycznego tokena administrator potwierdza istniejący dostęp; tylko gdy rzeczywisty probe wykaże brak, dopuszczony jest READ dla profitia/SG-dev do dokładnie @profitia/advisory-widget, @profitia/cic-core i @profitia/cic-procurement, po powyższym potwierdzeniu polityki forków. Jeżeli konieczne jest jej wzmocnienie, wniosek obejmuje wyłącznie zmianę tego ustawienia na all_external_contributors, bez osłabiania innych zabezpieczeń. Konektor nie udostępnia operacji zarządzania sekretami; żadna zmiana sekretu, dostępu lub ustawień nie została wykonana.

Po decyzji i gotowości administratora: istniejący trusted-main bootstrap dla dokładnego standardu, wszystkie wymagane publiczne CI, zwykłe przyjęcie i resulting-main verification; rzeczywista instalacja przez automatyczny token; niezależne przyjęcie dokładnego rekordu pilota; aktualizacja transportu neutralnego źródła, jego exact-source proof i normalne kontrole przyjęcia; sprawdzenie odrzucenia niezatwierdzonej próby/wznowienia we właściwym zakresie; przekazanie referencji istniejącym zadaniom; kanoniczny closeout z dowodami. Własne wydanie governance i neutralny pilot nie obejmują runtime deploymentu produktu, ECR ani innych istniejących funkcjonalności.

Rollback pozostaje normalnym kontrolowanym revertem wyłącznie własnego standardu/pilota lub odwołaniem własnego rekordu po uzgodnieniu aktualnego main. Nie cofa danych ani cudzych wydań. Zachować działające poświadczenie przejściowe w jego ważności do potwierdzenia nowej ścieżki i zgodnego wycofania. Nie deklarować starego CI-auth jako działającego LKG. Operacyjny odbiór i końcowe PMOS/PHR pozostają PENDING.
