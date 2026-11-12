# Punkt przywracania — Etap I rejestracji SpendGuru

**Stan: WSTRZYMANE NA ŻYCZENIE UŻYTKOWNIKA, 12 listopada 2026, ok. 23:10 Europe/Warsaw.**
Wznowienie dopiero po wyraźnym poleceniu użytkownika **„kontynuuj”**.
Nie uruchamiać w czasie przerwy implementacji, łączenia gałęzi, testów wdrożeniowych, zmian bazy/konfiguracji, dostawców ani maili. Utworzenie tego punktu i jego zapisu PMOS/PHR jest jedyną dozwoloną czynnością zamykającą.

## Wynik biznesowy pozostaje otwarty

Celem jest dokończenie **Etapu I — pełny proces od konta do działającej organizacji i zespołu na Development**. **Etap I NIE jest jeszcze wdrożony ani odebrany biznesowo.** Nie oznaczać rodziców ani całego etapu jako ukończonych. Źródła, testy, wdrożenie, rzeczywiste działanie i akceptacja biznesowa to odrębne stany.

Tryb po wznowieniu: zaakceptowany Full Autopilot / E1 / PMOS / PHR, bez kolejnych pytań o zwykłe, odwracalne poprawki techniczne. Dowody i kod na GitHubie oraz w istniejącym zdalnym PMOS/PHR; nie tworzyć artefaktów na laptopie. Nie zmieniać produkcji, nie tworzyć płatnej infrastruktury, nie wysyłać wiadomości innym osobom ani nie przejmować równoległych prac. Nie uruchamiać subagentów bez wymaganej wyraźnej podstawy.

Kanon: [rejestracja i organizacja](https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-spendguru-registration-and-organisation-onboarding-canon.md).
Obowiązują zaakceptowane decyzje i projekty z tego wątku. „Upshell” oznacza AppShell. Kalendarz był pomyłką nazewniczą i nie jest celem tego wdrożenia.

## Odtwarzalny kod i gałęzie

Baza tej gałęzi przywracania zawiera dokładnie opublikowaną wspólną wersję kodu **2d3f8edc8a119b28a54bfbce972dc28a7dcfac6f**. Zmiany tego punktu są dokumentacyjne. Po poleceniu wznowienia odczytać ten plik i ponownie sprawdzić rzeczywiste gałęzie, main, PMOS i środowiska.

| Zakres | Gałąź / opublikowany commit | Zdalny katalog |
|---|---|---|
| Wspólna wersja robocza, SDK1.37 | architecture/registration-release-stage-i-20261112 — **2d3f8edc8a119b28a54bfbce972dc28a7dcfac6f** | /workspaces/registration-stage-i-20261110/registration-release-integration |
| Identity, lifecycle, projekcja pakietu, kontekst | architecture/registration-native-organisation-20261112 — **9cc92b4288c13fa7327b42daf01810c160c0c5d1** | /workspaces/registration-stage-i-20261110/native-organisation-runtime |
| AppShell i SaaS asystenta, po integracji źródeł b18b | sg2/registration-organisation-access-20261112 — **8f57b09b0c9d8943edae61375b75c151df0183bb** | /workspaces/registration-stage-i-20261110/sg2-organisation-access |
| SRM, własny gateway MGBI — nadal oddzielny input | srm/registration-company-bootstrap-20261112 — **9a1dda6e626b5eeb9d95b0829c6cb9a32c5fdae2** | /workspaces/registration-stage-i-20261111/srm-company-bootstrap |
| Wcześniejsza kompozycja źródeł w PR983 | architecture/registration-bootstrap-stage-i-20261111 — **b18b5eee15aab07c7ff3968cafbfd50ddd5e9b5a** | /workspaces/registration-stage-i-20261110/final-source-publication |

Zdalne Codespaces:
- Architecture: **architecture-pmos-x5jj67ggx7wqfp49v**
- SRM: **srm-pmos-activation-jjxx6vpp9v4x2q9vr**

Po poleceniu pauzy potwierdzono czysty HEAD wspólnego katalogu **2d3f8edc…** oraz czysty SRM **9a1dda6e…**. **Oczekujące pobranie/merge wspólnej gałęzi do SRM zostało odrzucone przez automatyczną kontrolę ze względu na pauzę; nie wykonano go i nie ponawiać podczas przerwy.**

Problem rozliczeń Codespaces HTTP402 został usunięty po aktualizacji budżetu przez użytkownika. Dostęp do obu istniejących środowisk działał. Nie zakładać, że stan usług lub zasobów nie zmieni się podczas przerwy.

Ostatnia podstawa main użyta w poprawnym preflight: **0240de8a27b2dbe4f785939caa34305c259323a8**, zachowana we wspólnej gałęzi. To równoległa polityka PI1070 zachowująca ECR1065; wcześniejsze main: fe5c0a3… (ECR), 537660ed… (PI1059), 97f891b… (nasze1068). Nie nadpisywać równoległych PI, Calendar, CIC, BSDC ani ich odbiorów.

## Co znajduje się w kodzie

### Identity i wspólna platforma

- Istniejący host Identity; oficjalny Clerk, rzeczywisty AccessStore/Root/transakcje/audyt.
- Trwały profil i szkic, atomowe PL/NIP i slug, własne kategorie organizacji/użytkownika, brak checkboxa umocowania.
- Własne zaproszenia z proof7dni; GET bez konsumpcji, POST po zweryfikowanej sesji i adresie; replay, cofnięcie uprawnień, aktywny/zawieszony członek i członkostwo w innej organizacji.
- Szyfrowany, idempotentny outbox; jedna próba dostawcy, UNKNOWN bez automatycznego ponowienia, uszkodzona wiadomość CANCELLED.
- Istniejące szablony żeński/męski, awatar i wołacz ze słownika; neutralna forma dla nieznanego adresata.
- Minimalny licencjonowany snapshot spółki, bez używania prywatnych archiwów innej organizacji.
- Oddzielny opcjonalny Root23 z ośmioma operacjami lifecycle. Domyślny Root16 nie został rozszerzony:
  organisation.onboarding.read, organisation.company.lookup, organisation.slug.check,
  organisation.procurement.write, organisation.invitation.create, organisation.invitation.accept,
  organisation.activation.read, organisation.access.synchronise.
- SQL010: jawne mapowanie aktualnego pakietu na krótkie, zarządzane lease E1 do28s; zachowanie niezależnych grantów i DENY, cofnięcie/wygaśnięcie blokuje odnowienie; bez powielania uprawnień i bez zbędnego przepisywania bieżących lease.
- Odczyt zewnętrznego pakietu odbywa się **poza** transakcjami Root i globalną blokadą uprawnień; po odczycie następuje ponowna weryfikacja aktora i organizacji.
- SQL011 i organisation-context: jawny, wyłączony domyślnie reader własnej bieżącej organizacji przez istniejące account.settings.read / Root16. Preferencja jak w Identity, opcjonalny stary domyślny tenant wyłącznie przy aktualnym własnym członkostwie. Wynik tylko userId, organisationId, expiresAt; bez grantów biznesowych.
- Ograniczony podpisany peer AppShell→Identity: wyłącznie GET snapshot oraz POST pustej synchronizacji dostępu. Oryginalna sesja Clerk; nagłówki bez rzeczywistego receipt nie są autorytetem.
- Instalatory przygotowują plany/digests i oddzielne enrolment; nie wykonano instalacji w żywej bazie.

### Packages and Limits

- Reuse istniejącej usługi, operatora i katalogu. Osobne, wyłączone domyślnie odczyty /v1/organisation-access i /v1/organisation-entitlements; SQL005/006/007.
- Odczyt bieżącego SPENDGURU assignment, capabilities i revision wyłącznie dla aktualnego własnego zakresu.
- Istniejący exact-path bearerPeerReads dla oryginalnej sesji SG2 przekazanej przez Identity; osobny server-owned endUserOrigin, bez zmiany ścieżek operatora.
- Capabilities: SEATS, BENCHMARK, FORECAST, REPORTS, OPENAI_ASSISTANCE, SUPPLIER_INTELLIGENCE, EXPORTS.
- Nie utworzono rzeczywistego pakietu/assignment. **Użytkownik sam utworzy i przypisze pełny pakiet PORR w panelu, po konkretnym sygnale na gotowym etapie.** Nie przypisywać pakietu nie tej organizacji.

### AppShell / SG2

- POST /api/account/organisation-access: pusty same-origin command, dwa dokładne podpisane wywołania Identity, oryginalny bearer; bez cookies i caller-selected user/org/URL/permissions.
- Istniejący GET /api/account nie zmienił protokołu.
- Brak firmy lub kategorii / oczekujący pakiet kieruje do istniejącej centralnej rozmowy.
- Bieżący lease jest odnawiany bez utraty pracy w tym samym zakresie; zmiana kanonicznej organizacji, sesji/konta, potwierdzona odmowa lub upływ pierwotnego czasu usuwa stary widok i kontekst asystenta.
- Jawny SPENDGURU_SAAS: request-local organisation resolver w istniejących API benchmark/category/forecast/supplier-summary/calendar/newsfeed; zapomniany dynamiczny default rzuca błąd zamiast wybierać poprzedni tenant.
- Jawny wariant dla istniejącego członka starej organizacji zachowuje wcześniejszy ACCOUNT_SELF shell. Nie tworzy pakietu ani praw do modułów; każdy moduł dalej sprawdza E1.
- Asystent SaaS: application.organisationId pozostaje null; osobny, server-resolved selector instancji organizacji. Wspólne istniejące history/usage/model i jeden timer retencji, bez tworzenia puli na każde żądanie; odrębne gateway/selector, brak cache tożsamości/grantów. PORR_SUITE bez zmiany zasad.

### SRM / MGBI — jeszcze nie połączone

- Własny8-plikowy input9a1… reuse fetchMgbiGeneral/parser/paginator, nowy wąski cel srm.provider.mgbi-onboarding i wyłącznie GET /v1/models/pl-krs-wp-record/records.
- Oddzielny role/app Source, licencja/budżet; nie dziedziczyć wyjątku UNMETERED pilota KRS.
- Tylko spółki; minimalne8pól; wykluczenie JDG/fundacji/wykreślonych; podpisany peer, własny NIP/draft/null-org.
- **Do zbadania po wznowieniu:** istniejący główny SRM private-runtime nadal wymaga PROFITIA_FIXED_ORGANISATION_ID i PORR_SUITE, defaultOrganisationId z konfiguracji. Wskazane punkty: private-runtime.ts, report-runtime.ts, financial-excel-runtime.ts, shared-financial-runtime.ts, assistant-context-runtime.ts, supplier-request-handler.ts, supplier-acquisition-http.ts, xray-presentation.ts i app/api/supplier-locations/route.ts. Nowe SaaS nie może po cichu wybierać Profitia internal.
- Istniejący bindSrmIdentity w private-operation-host.ts obsługuje oryginalną sesję tylko po zweryfikowanym peer receipt; powinien być ponownie użyty, nie osłabiony.
- Nie rozstrzygnięto jeszcze zgodności inicjalizacji domeny SRM dla nowej kanonicznej organizacji; nie dopisywać danych ani grantów w ciemno.

## Weryfikacja — co udowodniono, a czego nie

- **Identity pełne lint/typecheck/build oraz459/459 testów PASS**, zero fail/skip/cancel, ok.36.8s. Wspólna wersja runtime z SDK1.37 i poprawionym peer istniejącego E1 authority.
- SQL011 / własny kontekst: **6/6 PASS** na rzeczywistym izolowanym PostgreSQL i Root16.
- Łączne context/Identity/bootstrap/store/Package Limits: **47/47 PASS**; dodatkowo rozszerzony incoming signed peer/native store **15/15 PASS**. Rzeczywiste transakcje i bazy testowe; zewnętrzne provider/Clerk w tych testach to fixture.
- SG2 boundary/context/React: **17/17 PASS**, w tym równoległe zakresy, zachowanie pracy, reset organizacji, odmowy401/403/409 i wygaśnięcie. Osobna kompozycja asystenta z rzeczywistym konstruktorem SDK i fixture sterownika: **1/1 PASS**.
- Wcześniejszy SRM gateway: **5/5 PASS**, istniejący provider transport **25/25 PASS**, scoped TS PASS. Brak pełnego aktualnego SRM build/CI i live.
- Cały lokalny SG2 typecheck w public-only fixture **NIE jest PASS**: brak istniejących trzech prywatnych pakietów (@profitia/advisory-widget, cic-core, cic-procurement), React DOM types i odpowiedniego istniejącego Insights linku. Naprawiono własne błędy typów nowej bramki; potrzebne pełne kontrolowane CI z zadeklarowanymi prawdziwymi zależnościami. Nie podstawiać atrap pakietów.
- Próba clean install SDK1.37 prawidłowo wykryła dokładny peer1.36 w istniejącym E1 authority; naprawiono zakres do **1.36.0 || 1.37.0** i odpowiadające locki. Kolejny clean install i powyższe pełne testy Identity przeszły.
- PR1068 i PMOS/PHR jego polityki są wcześniej całkowicie zamknięte. Nie otwierać ich ponownie.
- Wcześniejszy source b18b…: protected43304414524 SUCCESS; oryginalny artifact13983799085, ZIP SHA256 **4312589df42743aa20f7b76a020e90c4f0336687c8aea060159116610c6bc2d2**, niezależnie zweryfikowany (control537660ed…, digest fc80070e18054a55f15770f244d1f86181939953fcb7d4b007de1866698fcade).
- Protected43309943338 również SUCCESS dla b18b… na controlfe5c0a3…, artifact13987611226 / ZIP metadata **783fc208bb638e3fd07a5a297d34e81b381ad33444f4fb939749393dd51b72ee**. **Ostatnia próba niezależnej weryfikacji tego drugiego ZIP nie powiodła się przez brak funkcji z ulotnego store po nowej wiadomości użytkownika. Nie traktować go jako niezależnie zweryfikowanego.** Nie ponawiać podczas pauzy.
- Publiczny stary PR983 miał brak proof, a po zmianie main także CONTROL_POLICY_PROVENANCE_MISMATCH. SRM wykazał historyczną rozbieżność scripts/private-host.integration.test.mjs: aktualne804e2cda… kontra stary101469a1…; nie usuwać sprawdzenia, trzeba korzystać z w pełni zweryfikowanych currentSourceDigests, zachowując stary rekord.
- **Żaden z powyższych wyników nie jest dowodem uruchomienia nowego procesu na Development ani odbioru rzeczywistych maili/MGBI/Clerk/UI.**

## Krytyczne niedokończone elementy źródeł

W SDK1.37 istnieje przygotowany source-only verifier:
packages/platform-contracts/test/organisation-lifecycle-sdk-compatibility.mjs.
**acceptedRecordSha256 nadal ma PENDING_EXACT_SOURCE_RECORD.**
Nie istnieje jeszcze finalny organisation-lifecycle-sdk-compatibility.json ani trzy paired source-adoption receipts. Nie wdrażać tej roboczej wersji.

Poprzedni organisation-sdk-compatibility.mjs importuje nowy verifier; jeżeli record nie istnieje, zachowuje wcześniejszą kontrolę. Oryginalny rekord022f0a4c… jest zachowany. SDK1.37 potrzebuje kompletnej nowej, zamkniętej akceptacji źródeł; stara74-plikowa polityka nie dopuszcza nowej produkcyjnej implementacji.

Przygotowana logika nowego source verifiera:
- pełne current SDK/tests/consumer/preserved digests przed udostępnieniem historycznej projekcji;
- bazowy immutable source b18b…, oryginalny rekord022…;
- exact previousSourceDigests i rzeczywiste proven absence dla nowych plików;
- paired ARCHITECTURE / SG2 / SRM receipts, source-only false flags i rzeczywiste owner commit inputs;
- zachować stary continuation.record, dodać lifecycle.currentRecord dla acceptedSdkSource; nie zmieniać znaczenia dawnego previousReceipt/previousSource;
- oddzielna, exact CI admission po kompletnym złożeniu źródeł; brak pytań do użytkownika o zwykłe korekty techniczne w zaakceptowanym celu.

Nazwy tasków oczekiwane w jeszcze NIEutworzonych receiver receipts:
SG2-REGISTRATION-LIFECYCLE-SDK-ADOPTION-20261112,
SRM-REGISTRATION-LIFECYCLE-SDK-ADOPTION-20261112.
**Nie są jeszcze zarejestrowane.** Przed mutacją rejestrować właściwy owner input. apps/dashboard-preview należy do SG2, nie ARCHITECTURE.

## PMOS / PHR i kontynuacja

Aktywne rodzice pozostają otwarte:
- ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110 — cmwb5rbpa000012rdxjs5g20i
- SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110 — cmwb9tb720000xf7dyq1d2q3e

Nowsze, zarejestrowane i nadal otwarte inputy:
- ARCH-REGISTRATION-ENTITLEMENT-SYNCHRONISATION-20261112 — cmwdyrkwi0000yd5m40k8yrr6
- ARCH-REGISTRATION-CURRENT-ORGANISATION-CONTEXT-20261112 — cmwe12ssm0000xsgvhho6ilwv
- SG2-REGISTRATION-ORGANISATION-ACCESS-20261112 — cmwe1aeg60000g2czl51bt0vk
- SG2-REGISTRATION-ASSISTANT-SAAS-BINDING-20261112 — cmwe2hy2m00006zf3vn269utr
- ARCH-REGISTRATION-LIFECYCLE-SDK-SOURCE-20261112 — cmwe2xzq000006etchcrf2zeq
- ARCH-REGISTRATION-AUTHORITY-LIFECYCLE-PEER-20261112 — cmwe36n3f00003oymjx679o8w
- SRM-REGISTRATION-COMPANY-BOOTSTRAP-20261112 — cmwdv4i2h0000uiae77760jgn

Istnieją też otwarte owner inputy wcześniejszej kompozycji: ARCH-REGISTRATION-FINAL-SOURCE-ADOPTION-20261112, ARCH-REGISTRATION-RECURRING-COMPOSITION-TEST-20261112, SG2-REGISTRATION-COMPOSED-CONSUMER-CONTEXT-20261112, SG2-REGISTRATION-PI-COMPOSITION-TEST-20261112, SG2-REGISTRATION-COMPOSED-INTEGRITY-TESTS-20261112, ARCH-REGISTRATION-ORGANISATION-LIFECYCLE-20261112, ARCH-REGISTRATION-PACKAGE-ACTIVATION-20261112. Nie wykonywać ponownego begin tych samych tasków; sprawdzać rzeczywiste wiersze i pending/lock.

Zakończone1068: ARCH-REGISTRATION-COMPOSED-TEST-CI-20261112 — cmwdwqqzn0000wcmtqa79eeqz; PHR commit **1beb1f0bf1347c51225affefc4801b43bf033c62**, repo profitia/project-history-repository, manifest history/2026/11/12/2026-11-12-20-39-04Z__architecture-arch-registration-composed-test-ci-20261112/manifest.json. SUCCESS dotyczy tylko tamtej polityki, nie całego etapu.

PMOS moduł to **apps/pmos**. Używać jego .env.local, nie root .env.local. Nie kopiować dodatkowych sekretów. Parent prompt enum nie ma PAUSED; nie oznaczać rodziców completed/failed tylko ze względu na pauzę. Jawne wstrzymanie jest zapisane tutaj i w osobnym wpisie punktu przywracania.

Profile:
- ARCHITECTURE / SG-dev Architecture / codespaces, PHR /workspaces/registration-stage-i-20261110/architecture-phr
- SpendGuru 2.0 / SG-dev / codespaces, PHR /workspaces/registration-stage-i-20261110/sg2-phr
- SRM / SG-dev Codespaces SRM / codespaces, PHR /workspaces/registration-stage-i-20261111/srm-phr

Istniejące remote pending inputy w /tmp/registration-*-input.json mogą pomóc, ale nie są trwałą podstawą po restarcie. Ulotne functions.store **nie przetrwało nowej wiadomości użytkownika**; nie polegać na nim przy wznowieniu.

## Kolejność po „kontynuuj”

1. Odczytać ten punkt, bieżące GitHub main/gałęzie, canonical PMOS oraz stan zasobów. Przywrócić kod z powyższych opublikowanych SHA bez gubienia innych prac i bez resetowania oryginalnego brudnego /workspaces/SG-dev.
2. Dokończyć SRM owner input: zintegrować gateway z właściwą wspólną wersją, sprawdzić niezbędny własny kontekst nowej organizacji i zakres uprawnień/mirrorów domeny. Reuse SDK011 oraz istniejącego verified peer/pg driver; bez nowego silnika autoryzacji.
3. Zarejestrować właściwe SG2/SRM source-adoption inputy, uzupełnić zgodne locki i paired receipts.
4. Dokończyć zamknięty SDK1.37 record, verifier pin i meaningful negative tests. Zachować wszystkie dawne odbiory i aktualne PI/ECR/CIC/BSDC. Nie używać starego proof jako proof nowego kodu.
5. Przygotować jedną konkretną, dokładną kontrolowaną integrację/CI/admission i wymagane owner/full/main checks. Rutynowe korekty realizować samodzielnie w zaakceptowanym celu.
6. Dopiero po właściwej akceptacji źródeł: LKG, addytywne Development SQL, osobne enrolment/purpose/licencja/budżet/klucze, jawne flagi, exact-SHA deploy istniejących usług, rzeczywisty browser/provider/mail/tenant-isolation odbiór i obserwowalność.
7. Dać użytkownikowi konkretny sygnał do ręcznego utworzenia/przypisania pełnego pakietu rzeczywistej PORR, kiedy prawdziwa organizacja i runtime będą gotowe. Nie używać Profitia internal jako PORR.
8. Zamknąć rodziców PMOS/PHR dopiero po rzeczywistym wyniku Etapu I.

Istniejąca zatwierdzona przestrzeń Render: **PROFITIA WORKSPACE / tea-d7lps8rbc2fs73cn80dg**. Nie pytać ponownie.
Canonical private Neon Development: spring-bread-28217539 / br-sparkling-term-b99l107x / platform_private.
Limits: lingering-thunder-05075810 / br-green-hall-b9s837k0 / neondb.
Canonical225e465b-8b89-467d-92d1-7fef61b555fe to **Profitia internal, nie PORR**; nie zmieniać jego właściciela, nazwy ani danych.
Ostatni znany przed nową implementacją Identity LKG: f78f5867064c96f4497e13bcd53c97af2da2e07a; zweryfikować ponownie przed wdrożeniem. Nowego runtime nie uruchamiano.

StageII (profilowy kontekst ACG/CIC i moduł ostatnich aktywności/PHR wow), trial/płatności oraz produkcyjny wildcard DNS pozostają poza bieżącym etapem zgodnie z kanonem.

## Potwierdzenie zapisu punktu przywracania

Osobny task **ARCH-REGISTRATION-RESTORE-PAUSE-20261112-2310** został zapisany i zakończony wyłącznie jako punkt przywracania:
- rejestracja PMOS: **cmwe3y9ox0000gz83iqtvdynv**;
- conversation: **pmos-task-v2:527256789605166ba76ae217218d2c739c4db254db08292a844e0ac61b821108**;
- archive integrity **PASS**, execution trail PRESENT / BASELINE_PRESENT, bez issues;
- PMOS runtime/context integrity i handoff **PASS**; pending slot i advisory lock clear;
- rodzic Etapu I i task nowego SDK pozostają running / completedAt=null; instrukcja użytkownika wstrzymuje ich wykonywanie;
- PHR **PUBLISHED**, 5 artefaktów, commit **0ba1c93b0ddeb643ad89b9b673780ca11d00051d**;
- [oryginalny manifest PHR](https://github.com/profitia/project-history-repository/blob/0ba1c93b0ddeb643ad89b9b673780ca11d00051d/history/2026/11/12/2026-11-12-22-18-14Z__architecture-arch-registration-restore-pause-20261112-2310/manifest.json) odczytano niezależnie z GitHuba: SUCCESS / CLOSEOUT_COMPLETE, blob09fc4bc2c49afd7c569f8f98a82fa5e3e44a2a61.

SUCCESS powyżej oznacza wyłącznie zapis punktu i wstrzymanie pracy. Wdrożenie Etapu I pozostaje nieukończone. Oczekiwać na **„kontynuuj”**.
