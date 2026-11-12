# TASK A — SpendGuru Identity Runtime: Architecture, Ownership & Routing

Status: **ARCHITECTURE PROPOSAL — PENDING OWNER / ARCHITECTURE APPROVAL**. Data audytu: 2026-10-21.
Profil wykonawczy: **SG2**, workspace **SG-dev**, TARGET_ENVIRONMENT=**development**.
Authority: **profitia/SG-dev**, source authority **main**, audited SHA **faa97ee433a9f60de28b417b4ee323759c7c9ffb**.
Task ID: **SG2-IDENTITY-RUNTIME-TASK-A-20261021**.

Ten handoff jest propozycją do zatwierdzenia. Nie aktywuje modułu, ścieżek, ownera, kontraktów, migracji ani zasobów. Jedyna zmiana źródłowa Task A to niniejszy dokument. Etapy B–E wymagają oddzielnych zadań, właściwych profili i własnych preflightów. Zatwierdzenie dokumentu nie oznacza zgody na wdrożenie.

## A. Architecture Decision Record

### A1. Decyzja proponowana

Utworzyć w przyszłości niezależnie wdrażalną aplikację `apps/identity-runtime/`, odpowiedzialną za konwersacyjną rejestrację, logowanie, odzyskiwanie hasła i orkiestrację przejścia do właściwej aplikacji. Rejestracja i logowanie mają oddzielne scenariusze i ekrany, wspólny zestaw komponentów oraz adaptery. Rozmowa jest deterministycznym scenariuszem; nie wymaga LLM ani swobodnych pytań użytkownika.

Clerk pozostaje jedynym dostawcą uwierzytelniania, haseł, e-mail OTP i sesji. Profitia pozostaje właścicielem User ID, Organisation ID, bindingów, członkostw, uprawnień i dostępu do produktu. Wspólne kontrakty pozostają w `packages/platform-contracts/`; nie przenosić ich do nowej aplikacji ani kopiować do konsumentów.

**Rekomendowany formalny owner: istniejący Architecture Platform.** „Identity & Access Platform” może opisywać zakres odpowiedzialności, ale nie jest obecnie zatwierdzonym ownerem ani profilem PMOS. Nowy runtime jest wspólną capability, dlatego preferowane jest jego objęcie profilem ARCHITECTURE po osobnym zatwierdzeniu. SG2 i SRM zachowują własność swoich integracji. Jeśli właściciel wybierze nowego ownera, najpierw musi osobno zatwierdzić jego odpowiedzialności, profil, continuity i rejestry; nie wolno nadać tych uprawnień samą nazwą katalogu.

### A2. Dlaczego osobny runtime

Jedna implementacja rozmowy i integracji Clerk ogranicza rozjazdy między SG2, SRM i przyszłymi aplikacjami. Oddzielne wdrożenie umożliwia niezależne wersjonowanie i odbiór. Kosztem są dodatkowy serwis, konfiguracja domen/sesji, zależność logowania od jego dostępności oraz konieczność kompatybilnych kontraktów. Istniejąca sesja nie może wymagać wywołania nowego UI przy każdej operacji: konsument sprawdza Clerk i źródło uprawnień bezpośrednio przez wspólne kontrakty.

Odrzucone warianty:

- Kopie konwersacji i provisioningu w SG2 i SRM: duplikacja, ryzyko różnych reguł i migracji.
- Runtime wystawiający własne tokeny sesyjne lub decyzję ALLOW jako uprawnienie: konkurencyjny system tożsamości/autoryzacji.
- Clerk metadata lub Clerk Organizations jako autorytatywny rejestr praw Profitii: sprzeczne z istniejącym modelem.
- Rozbudowa tabel bezpieczeństwa o dowolny JSON profilu: miesza preferencje z kontrolą dostępu.
- Pusty katalog/stub aplikacji w Task A: brak zatwierdzonego routingu i brak wartości odbiorowej.
- Sam redirect albo wspólna lista authorizedParties jako dowód przenoszenia sesji: nie spełnia obecnego sprawdzania azp i bieżącej sesji.

### A3. Zweryfikowany punkt wyjścia

| Warstwa | Fakt zweryfikowany 2026-10-21 | Granica dowodu |
|---|---|---|
| GitHub | Repo ID 1247665550, default main; source SHA podany wyżej | Main nie jest automatycznie SHA działających usług |
| Source SG2 | Next 14.2.35 / React 18.3.1; jawny adapter Clerk | Nie dowodzi działania nowego flow |
| Source SRM | Next 16.4.1 / React 19.2.4; jawny adapter Clerk | Nie uruchamiano profilu SRM |
| Shared | @clerk/backend 3.25.0, @clerk/react 6.17.8, @clerk/localizations 4.23.0; framework-neutral mjs + d.mts | Nie aktualizowano zależności produktu |
| Identity | `createClerkIdentityAuthenticator` i `createClerkAccountStatusReader`; binding z autorytatywnego store | Żaden z nich nie tworzy nowego konta/bindingu |
| UI auth | Oficjalny SignIn z routing=hash, withSignUp=false | Brak implementacji konwersacyjnej rejestracji w runtime |
| Prywatny Neon | profitia-platform-private / spring-bread-28217539 / br-sparkling-term-b99l107x / platform_private | Odczyt administracyjny katalogu, nie test runtime RLS |
| Access | 12 tabel profitia_access, wszystkie ENABLE i FORCE RLS; spendguru i srm ACTIVE | ACTIVE nie oznacza gotowości logowania ani uprawnień człowieka |
| Profil | Brak schematu profitia_profile; brak avatar_sex, job, phone w profitia_access | Nie utworzono tabel ani pól |
| Render | Istnieją SG2, SRM, dashboard i PMOS; brak identity-runtime w inwentarzu | Nie przeglądano sekretów ani nie zmieniano konfiguracji |
| Health | GET /api/health SG2: status ok, service sg-runtime, development; SRM: status ok, service srm, development | Health nie jest UAT auth, sesji ani izolacji tenantów |

Zbadane źródła: `apps/sg-runtime/lib/platform/identity-runtime.ts`, `apps/srm/src/server/identity-runtime.ts`, `packages/platform-contracts/src/{identity-provider,clerk-configuration,access-store}.mjs`, deklaracje i testy tych kontraktów, migracje access/001 i access/004, granice sesji obu aplikacji oraz aktywne kanony.

## B. Ownership & Routing Matrix

### B1. Stan aktualny i proponowany

| Dokładny target / rodzina ścieżek | Capability i owner aktualny → proponowany | Project key wykonawczy | Code state / zgoda |
|---|---|---|---|
| `Canon/evidence/2026-10-21-sg2-identity-runtime-task-a-handoff.md` | Governance Source Layer, SG2-BASE-019 | SG2 | ALIGNED; routing Task A PASS |
| `apps/identity-runtime/**` | **NO_MATCH** → Identity Runtime / Architecture Platform | ARCHITECTURE, dopiero po onboardingu | Baseline nieprzypisany; propozycja ALIGNED wymaga approval; nowe delty produktu TRANSITIONAL według aktywnej polityki |
| `packages/platform-contracts/src/identity-provider.mjs` i `.d.mts` | ARCH-BASE-001 / Architecture Platform | ARCHITECTURE | ALIGNED baseline; zmiany poza uprawnieniami SG2 |
| `packages/platform-contracts/src/identity-provisioning.mjs` i `.d.mts` (propozycja) | Architecture Platform, wspólne Identity Binding | ARCHITECTURE | Rodzic ALIGNED; nowy kontrakt i delta wymagają osobnego odbioru |
| `packages/platform-contracts/src/user-profile.mjs` i `.d.mts` (propozycja) | Architecture Platform, User Profile | ARCHITECTURE | Jak wyżej; nie tworzyć równoległego authz |
| `packages/platform-contracts/migrations/profile/001-user-profile.sql` (propozycja) | Architecture Platform, migracje profilu | ARCHITECTURE | Nie istnieje; migracja dopiero w B z osobnym planem rollbacku |
| `packages/platform-contracts/test/{identity-provisioning,user-profile}.test.mjs` (propozycja) | Architecture Platform | ARCHITECTURE | Testy nowych kontraktów w B |
| `apps/sg-runtime/lib/platform/identity-runtime.ts`, `apps/sg-runtime/components/auth/**` i jawnie wybrane strony wejścia | SG2-BASE-001 / SG Runtime | SG2 | ALIGNED; integracja wyłącznie w E-SG2 |
| `apps/srm/src/server/identity-runtime.ts`, `apps/srm/app/login/**`, `apps/srm/app/session-boundary.tsx` | SG2-BASE-016 / SRM Runtime | SRM | ALIGNED; osobny handoff E-SRM |
| `apps/dashboard-preview/**` | Dashboard Preview | SG2 | ALIGNED; brak potrzeby zmiany w B–D; osobny zakres jeśli E ujawni integrację |
| `Canon/registries/current-architecture-baseline-v1.json` i wskazane niżej kanony | Governance Source Layer | ARCHITECTURE w zadaniu onboardingu | Dokumentacyjne przygotowanie dozwolone SG2; **aktywacji nie wykonano** |
| `.github/workflows/identity-runtime-ci.yml` (propozycja) | Nowa powierzchnia CI Identity Runtime — do jawnego zarejestrowania | ARCHITECTURE po approval | Nie zakładać odziedziczenia ze wspólnego .github; wymaga osobnego sprawdzenia routingu |

Baseline classification opisuje istniejącą powierzchnię; TRANSITIONAL opisuje nową deltę po aktywnym epoch, nie nowego ownera ani stan całej aplikacji. W Task A nie klasyfikowano implementacji, bo jej nie ma.

### B2. Wymagany osobny architecture handoff

Zatwierdzić ADR i ownera; dopiero potem zmienić rejestr baseline, target architecture canon, routing/ownership canon i roadmap. Jeśli powstaje aktywny nowy canon/runbook, dodać go do aktywnego manifestu z poprawnym statusem, zależnościami i kolejnością ładowania. Profile registry zmieniać tylko wtedy, gdy rzeczywiście zmienia się formalny profil. Bez nowego profilu rekomendacja pozostawia ARCHITECTURE i jego continuity.

Przygotować jawny plan instalacji w `Canon/registries/architecture-onboarding-v1.json` i aktualizację obowiązującego resource/setup runbook; po utworzeniu zasobów przez właściciela zarejestrować ich rzeczywiste identyfikatory w odpowiedniej topologii. Nie przypisywać wspólnego serwisu potajemnie do produktu SRM lub SG2. Uwzględnić niezależne CI i integration acceptance kontraktów w obu konsumentach.

**Szkic wpisu — NIEAKTYWNY, nie kopiować bez zatwierdzenia:**

```json
{
  "id": "IDENTITY-BASE-001",
  "capability": "Identity Runtime",
  "name": "SpendGuru Identity Runtime",
  "pathPatterns": ["apps/identity-runtime/**"],
  "currentOwner": "Architecture Platform",
  "currentResponsibility": "Conversational authentication UI and orchestration using Clerk and canonical Profitia identity/access contracts; no independent authorization engine.",
  "baselineClassification": "ALIGNED",
  "parentSurfaceId": null,
  "cleanupReason": null,
  "classificationReferenceSha": "<actual-approved-onboarding-source-sha>",
  "allowedProjectKeys": ["ARCHITECTURE"],
  "onboardingAuthorization": "<explicit-owner-architecture-approval-reference>"
}
```

ID ma zostać sprawdzony pod kątem kolizji w chwili onboardingu. Nie rozszerzać SG2 allowedProjectKeys na wspólne kontrakty, aby ominąć granicę właściciela.

## C. Identity Runtime Structure & Contracts

### C1. Minimalna struktura proponowana

```text
apps/identity-runtime/
  app/
    (auth)/register/page.tsx
    (auth)/login/page.tsx
    (auth)/recover/page.tsx
    api/account/ensure/route.ts
    api/profile/me/route.ts
    api/health/route.ts
  components/
    conversation/
    avatar/
    inputs/
  lib/
    clerk/          # konfiguracja oficjalnego SDK, bez własnego JWT
    identity/       # cienka orkiestracja wspólnych kontraktów
    profile/        # cienki adapter storage, bez własnych ról
    session/        # allowlist powrotów i lifecycle SDK
  tests/
  package.json
  package-lock.json
```

To plan, nie polecenie tworzenia wszystkich plików. Route groups nie są częścią URL. Nie tworzyć teraz `(onboarding)`: organizacja/rola/branża pozostają poza rejestracją i poza projektem UI B–D. W E przewidzieć wyłącznie poprawne przekazanie stanu do aplikacji.

Repo ma aplikacje z osobnymi pakietami i lockfile; brak root package.json/workspace zarządzającego wszystkimi aplikacjami. Nowy runtime powinien mieć własny build i zależności, pobierać framework-neutral platform-contracts w istniejącym modelu file-package i podlegać source-digest acceptance. Nie importować prywatnego UI SRM/SG2 ani wymuszać ich aktualizacji React/Next. Proponowany Next App Router i zgodna oficjalna integracja Clerk SSR wymagają wyboru wersji, lockfile i testu wielodomenowego przed C; wersja ma być przypięta w B, nie zgadywana na podstawie starej makiety.

### C2. Granice kontraktów

| Kontrakt | Wejście z zaufanego źródła | Wynik i ograniczenie |
|---|---|---|
| Provider auth | Oficjalny SDK, konfiguracja środowiska, request bieżącej sesji | Zweryfikowana tożsamość zewnętrzna; nie zawiera grantów |
| Existing authenticator | Provider proof + autorytatywny aktywny binding | Profitia HUMAN actor; brak bindingu daje odmowę, nie auto-provisioning |
| Proposed ensureAccount v1 | Serwerowo zweryfikowane environment/issuer/subject/session; jawna polityka rejestracji | Idempotentny userId i profil; bez organisationId, membership i product grant |
| Proposed Profile v1 | ACCOUNT_SELF, bieżąca sesja/binding, expectedVersion, allowlisted patch | Wersjonowany profil własnego userId; client nie wybiera cudzego właściciela |
| Organisation resolution | Bieżący internal actor i autorytatywne członkostwa | Zero / jedna / wiele organizacji; wybrana organizacja ponownie sprawdzana |
| Consumer entry | Docelowy appId z konfiguracji, oficjalnie zsynchronizowana sesja | Konsument wylicza własny operation context i dostęp do produktu |
| Return routing | Server-owned targetApp + returnRoute key, ewentualny jednorazowy flow state | Allowlisted URL; nigdy bearer token, grant ani dowolny callback URL |

Nazwy nowych kontraktów są propozycją. Wspólny verifier może być addytywnym wydzieleniem części obecnego adaptera, z zachowaniem wszystkich jego warunków. Nie wolno w tym celu poluzować existing authenticator, stworzyć domyślnego użytkownika ani użyć account-status-reader jako dowodu uwierzytelnienia. Profiler nie zwraca rozszerzonego aktora z PII.

### C3. Lifecycle i stany błędów

1. Scenariusz rejestracji zbiera wyłącznie dane Clerk oraz wybór awatara. Avatar preference przed sesją pozostaje stanem tymczasowym przeglądarki, bez zapisu w bazie.
2. Clerk tworzy/weryfikuje tożsamość, potwierdza e-mail i wymagane provider session tasks. Konto bez aktywnej sesji nie przechodzi do chronionego sukcesu.
3. Serwer uzyskuje verified external identity. Ten stan nie jest jeszcze Profitia HUMAN actor.
4. Jawny account provisioner w jednej transakcji tworzy/odnajduje konto, external binding i początkowy profil. Klucz idempotencji: environment + issuer + subject. Fizyczna instalacja DB jest związana z environment; obecny klucz SQL external_identities to issuer + subject.
5. Concurrent retry/unikalność musi zwrócić to samo userId, bez orphan profilu lub drugiego konta. Nie scalać po e-mailu; alias e-mail nie jest kluczem migracji tożsamości.
6. Disabled/revoked/expired binding i nieaktywne konto nie mogą zostać automatycznie reaktywowane przez ensureAccount. Polityka odnowienia finite expires_at i rozwiązywania konfliktów musi być jawnie zatwierdzona w B.
7. Po sukcesie ponownie przejść przez istniejący authenticator; dopiero potem odczytać profil i członkostwa.
8. Zero organizacji: **ACCOUNT-only entry w aplikacji**, z brakiem dostępu do operacji ORGANISATION. „Konto gotowe” przenosi do aplikacji, ale nie nadaje praw produktowych. Przyszłe BOOTSTRAP tworzenia organizacji/akceptacji zaproszenia jest odrębnym procesem.
9. Jedna organizacja: można zaproponować kontekst po weryfikacji; wiele: wybór spośród bieżących członkostw. Każda operacja ponownie sprawdza właściwy kontekst i product grant.
10. Fixed organisation w konfiguracji deploymentu jest ograniczeniem, nie grantem. Brak zgodnego członkostwa kończy się odmową, nie przypisaniem do tej organizacji.

| Stan proponowany | Zachowanie / ponowienie |
|---|---|
| PENDING_EMAIL | Pozostanie przy kodzie; resend/expiry według Clerk, ograniczenie prób |
| PENDING_PROVIDER_TASK | Obsłużyć wymagany krok Clerk, nie aktywować sukcesu przedwcześnie |
| VERIFIED_UNBOUND | Dozwolony tylko kontrolowany ensureAccount przy zatwierdzonej polityce |
| PROVISIONING_RETRY | Clerk konto istnieje, DB niedostępna: zachować recoverable stan, późniejsze logowanie ponawia ten sam binding |
| ACCOUNT_ONLY | Wejście do własnego konta w aplikacji, brak fikcyjnego Organisation ID |
| ORGANISATION_SELECTION | Wybrać istniejące, aktualnie dozwolone członkostwo |
| PRODUCT_DENIED | Konto/sesja mogą być poprawne, lecz brak uprawnień do produktu |
| READY | Zweryfikowane konto, organizacja i dostęp zgodne z konkretną operacją |
| POLICY_UNAVAILABLE | Błąd techniczny fail-closed, bez stale ALLOW i bez ujawniania diagnostyki DB |

Nie usuwać konta Clerk jako automatycznego rollbacku błędu DB. Istniejący operatorowy bootstrap_receipts wymaga organizacji/członkostwa; nie udawać nim rejestracji konta bez organizacji. Organisation ID powstanie przy odrębnej, atomowej operacji tworzenia organizacji, nie z nazwy firmy wpisanej w czacie.

## D. User Profile v1 Specification

### D1. Rekomendowane przechowywanie

**Osobny schemat `profitia_profile`, tabela `user_profiles` w istniejącej prywatnej bazie platform_private**, jeden rekord na `profitia_access.accounts.user_id` z FK i unikalnym/primary key user_id. Profil jest globalną preferencją użytkownika danej instalacji, nie profilem organizacji. Nie tworzyć nowego projektu Neon ani kopii accounts, external_identities czy memberships.

Uzasadnienie: schemat oddziela dane i preferencje od tabel bezpieczeństwa, zachowuje relacyjną integralność i atomowość provisioningu. Dodatkowa tabela w profitia_access jest technicznie możliwa, ale rozszerza zakres security store. Kolumny na accounts zwiększają sprzężenie; Clerk metadata nie zapewnia właściwej własności i nie jest źródłem praw.

| Pole | Kontrakt v1 | Właściciel / kontrola |
|---|---|---|
| user_id | UUID, FK accounts.user_id, jeden profil | Serwer, immutable dla edycji profilu |
| avatar_sex | nullable enum male/female; brak wyboru = null | Preferencja awatara, **nie płeć użytkownika**; edytowalna, pamiętana po logowaniu |
| job | nullable tekst; proponowany limit 160 znaków po trim, bez znaków sterujących | Opcjonalne, edytowalne; nigdy rola ani grant |
| phone | nullable tekst w kanonicznym E.164; + oraz maksymalnie 15 cyfr, walidacja biblioteką numerów | Opcjonalne, **unverified**; brak SMS/OTP i brak użycia do auth/recovery |
| version | Monotoniczna wersja rekordu | Optimistic concurrency, expectedVersion; konflikt nie nadpisuje zmiany po cichu |
| created_at / updated_at | Serwerowe timestampy UTC | Nie pochodzi od klienta |

Brak kraju w wejściu telefonu nie uzasadnia zgadywania prefiksu. Wybrać kraj lub wpisać +country code; pusty input normalizować do null. Normalizacja nie potwierdza istnienia numeru, jego właściciela ani dostarczalności. W v1 verification status jest stałym kontraktem UNVERIFIED, bez pozornej daty weryfikacji.

### D2. Dostęp i ochrona

- ACCOUNT_SELF i istniejące account.settings.read/write z operation matrix (AM-01/AM-02) są semantycznym punktem odniesienia; do B należy addytywne pokrycie profilu przez wspólny store/transaction boundary. Nie tworzyć lokalnej alternatywy authz.
- RLS ENABLE + FORCE, rola runtime o minimalnych prawach, bez owner/superuser/BYPASSRLS/CREATEDB/CREATEROLE/INHERIT. Zweryfikować rzeczywisty login, projekt, branch, DB i installation digest.
- Runtime korzysta wyłącznie z dozwolonego account scope. Tożsamość userId pochodzi z serwera; organizationId=null w ACCOUNT. Nie podstawiać fake org, aby zadowolić istniejące org-lock API.
- Autoryzacja, efekt i kanoniczny audit muszą zachować wspólny transaction boundary; audit zapisuje bezpieczny typ zdarzenia/wersję, bez numeru telefonu, hasła, OTP lub rozmowy.
- TLS, ochrona sekretów dostawcy i minimalny dostęp operacyjny; telefon traktować jako prywatne PII. Nie dodawać go do JWT, cookies, URL, analytics, PMOS/MEMOROS/PHR ani szerokich katalogów użytkowników.
- Nie ogłaszać szyfrowania pola end-to-end. Jeżeli właściciel wymaga szyfrowania aplikacyjnego, przed B zatwierdzić key management, rotację i odzyskiwanie; samo „zaszyfrowane pole” bez tych mechanizmów nie jest planem.
- Użytkownik może wyczyścić pola opcjonalne. Retencja, eksport i usunięcie/pseudonimizacja wymagają jawnej polityki spójnej z istniejącym lifecycle konta i audytu; nie implementować automatycznego kaskadowego usuwania security history.
- Job i phone zbierane dopiero po założeniu konta, w przyszłej edycji profilu/onboardingu. Nie wydłużają minimalnej rejestracji.

### D3. Imię, nazwisko, e-mail i wersjonowanie

Clerk jest źródłem aktualnej tożsamości uwierzytelniającej, podstawowego e-maila i jego weryfikacji. Imię/nazwisko zbierane przez flow Clerk mogą służyć prezentacji; istniejące accounts.display_name to metadata katalogowe, nie dowód tożsamości. Nie dodawać drugiej autorytatywnej wersji e-maila w profilu ani nie synchronizować loginu edycją profilu.

Jeśli później potrzebny będzie display cache, wymaga jawnego źródła, observedAt i zasad odświeżania; nie nadaje uprawnień i nie scala kont. Zmiana e-maila w Clerku nie zmienia internal userId. Zmiana issuer/Clerk instance wymaga kontrolowanej migracji bindingów, nigdy automatycznego dopasowania po e-mailu.

Kontrakt `profitia.user-profile` v1: typowane pola, allowlist patch, unknown fields reject, serwerowa walidacja, nullable dodatki w przyszłych addytywnych migracjach. Każda migracja ma własny digest/installation receipt i zgodność starych konsumentów. Nie zmieniać istniejącego access/001 digest przez dopisanie do historycznego pliku.

## E. Clerk & Session Integration Contract

### E1. Zachować istniejące reguły

Obecny adapter wymaga SDK-verified session_token, zgodnych issuer/sub/sid/azp/expiry, braku impersonation, bieżącego active session i active user oraz aktualnego ACTIVE bindingu z wersją, sourceRef i skończonym expiresAt. Błędy authority kończą się POLICY_UNAVAILABLE; nie wolno użyć cached ALLOW.

Zwykły request wymaga **azp równego origin odbiorcy**. Obecny wyjątek bearer peer read obejmuje tylko jawnie zatwierdzony serwerowy GET, dokładne source/target/path, bez Cookie i Origin. Nie wolno rozszerzyć tego wyjątku na browser login, profile write, POST ani ogólną współdzieloną sesję.

Konsument po przejściu z auth host musi uzyskać oficjalnie zsynchronizowaną sesję i własny aktualny dowód dla receiving origin. Token z auth-dev nie staje się dowodem chronionego POST SG2 tylko dlatego, że oba originy wpisano do authorizedParties.

### E2. Domeny i środowiska

| Środowisko | Kandydat auth host | Wymagany wariant Clerk | Status |
|---|---|---|---|
| Development | auth-dev.spendguru.app | Dedykowane Development test keys/issuer, zgodne ze wspólnym adapterem | Host i konfiguracja nieutworzone; bieżące ustawienia Clerk NOT_VERIFIED |
| Staging | auth-staging.spendguru.app | Odrębne release-mode keys/issuer; obecny parser wymaga live keys i issuer spoza accounts.dev | Wymaga decyzji o osobnej instancji/aplikacji Clerk dla Staging; bez użycia sekretów Production |
| Production | auth.spendguru.app | Oddzielne produkcyjne keys/issuer, właściwy root domain i ograniczenia subdomen | Poza wykonaniem Task A; future release gate |

W produkcji Clerk dokumentuje współdzielenie sesji między subdomenami tego samego root domain. To nie oznacza izolacji środowisk samą nazwą hosta: dev/staging/prod na spendguru.app wymagają osobnej konfiguracji instancji, domen/cookies i testów braku wzajemnego akceptowania sesji. Nie zakładać współdzielenia sesji różnych hostów onrender.com jak własnych subdomen.

Dla różnych domen stosować oficjalny primary/satellite flow Clerk, o ile wybrana integracja go wspiera; production satellite wymaga odpowiedniego płatnego planu. Oficjalna dokumentacja wymaga integracji z SSR i ostrzega przed ogólnym React bez SSR/hydration. Obecny @clerk/react wewnątrz Next nie jest sam w sobie dowodem zgodności. W B/E wykonać ograniczony spike kompatybilnego adaptera bez aktualizacji całego hosta.

Jeśli satelliteAutoSync pozostaje false, używać SDK buildSignInUrl/buildSignUpUrl i zachować oficjalny sync marker. Nie budować ręcznych linków pomijających handshake. Źródła: [Clerk satellite domains](https://clerk.com/docs/guides/dashboard/dns-domains/satellite-domains), [production setup](https://clerk.com/docs/guides/development/deployment/production). Szczegóły planu i konfiguracji muszą być ponownie sprawdzone przed wdrożeniem.

### E3. Bezpieczna nawigacja i sesja

1. Aplikacja wybiera server-owned targetApp i returnRoute z zamkniętego rejestru środowiska. Użytkownik nie podaje appId/organisationId/role/ALLOW jako wiążących danych.
2. Powrót dopuszcza tylko dokładne HTTPS originy i kanoniczne ścieżki należące do aplikacji; development localhost tylko jawnie skonfigurowany. Bez wildcard, schematu względnego //, credentials/userinfo, backslash, control chars, fragmentów, path traversal i zakodowanych/dwukrotnie dekodowanych obejść.
3. Jeśli potrzebny jest flow state: losowy, krótko żyjący, jednorazowy, związany z browser flow/celem i sprawdzany serwerowo; nie jest nowym tokenem logowania ani nośnikiem praw. Oddzielić go od oficjalnego stanu Clerk.
4. Nie wysyłać hasła/OTP/bearer tokenów przez return URL, postMessage bez ścisłego origin/source, localStorage lub logi. Pola w rozmowie są maskowane, hasło i kod nie trafiają do trwałej historii dymków.
5. Mutacje cookie-based: dokładny Origin, dozwolona metoda, CSRF protection zgodna z frameworkiem/SDK i brak skutków ubocznych GET. CORS nie zastępuje autoryzacji; nie otwierać wildcard credentials.
6. Session fixation: aktywacja i rotacja według oficjalnego SDK, brak przyjmowania sid od klienta i brak własnego kopiowania cookies. Przejście auth → SG2 → SRM zawsze kończy się niezależną weryfikacją odbiorcy.
7. Logout: użyć Clerk signOut dla bieżącej sesji; jawnie oddzielić „wyloguj wszystkie sesje”. Odwołanie musi być widoczne w następnej chronionej operacji obu konsumentów. Oczyścić/remountować klientowy stan poprzedniego principal; nie przenosić jego danych do kolejnego konta.
8. Auth outage: brak nowych chronionych ALLOW; czytelny retry bez ujawniania istnienia konta. Rate limits, resend/expiry i anti-bot korzystają z mechanizmów Clerk; bez omijania captcha/device/MFA/reset wymuszonych przez provider.
9. Legacy demo pozostaje jawnie oddzielnym trybem. Brak kompletnej konfiguracji przy explicit Clerk mode ma nadal fail-closed; nie przełączać automatycznie do demo. Dowód DEMO/ANONYMOUS nie spełnia testu HUMAN.

Minimalne flow opierają się na oficjalnych [email/password custom flows](https://clerk.com/docs/guides/development/custom-flows/authentication/email-password), [password recovery](https://clerk.com/docs/guides/development/custom-flows/authentication/forgot-password) i [session tasks](https://clerk.com/docs/guides/development/custom-flows/authentication/session-tasks). W B trzeba potwierdzić rzeczywistą konfigurację Profitia Clerk: wymagane pola, password policy, e-mail code, anti-bot, nowe urządzenie, reset i ewentualne zadania sesji. Nie wykonano tej weryfikacji ustawień dashboardu w Task A. Uprawnienia i PII nie powinny trafiać do custom claims; [session tokens](https://clerk.com/docs/guides/sessions/customize-session-tokens) nie zastępują bieżących odczytów dostępu.

## F. Infrastructure Plan — bez utworzenia zasobów

### F1. Stan działających usług a source

Render workspace: **PROFITIA WORKSPACE / tea-d7lps8rbc2fs73cn80dg**. Odczytane najnowsze live deploymenty:

| Usługa | Service ID / environment | Live deploy / source SHA |
|---|---|---|
| SG2 Development | srv-dapa3tid0e5s73f8bc5g / evm-dap98hm0tbcc738rro10 | dep-dbbpblom7kps73dj51mg / f03968d474a937cfe5badcc192e1bc81781bcb91 |
| SRM Development | srv-db1vu6gm7kps73d0e3r0 / evm-dapbd70ae00c73cgrup0 | dep-dbbnb22fngtc73bn0i90 / 260ade12608faaea27376c1c976db392f046f267 |
| SG2 dashboard | srv-dapa3ujm8hqs73a9t2og / evm-dap98hm0tbcc738rro10 | dep-dbbr34rncjis738t5phg / 873d4655bed828b401f3b480b08cc40d46c6c8ff |
| SG2 PMOS | srv-d88utm77f7vs73blrj1g / logical Development | dep-db79kn6i0phs738rhutg / e03454fdf484c51a251bf3c736d82769821af117 |

SG2/SRM/dashboard autoDeploy=no. Istniejący PMOS ma autoDeploy=yes i historyczny provider environment evm-d88urem7r5hc73csgga0; kanonicznie jest kontrolną płaszczyzną Development. Task A go nie przenosi ani nie rekonfiguruje. Dlatego PR pozostaje draft, bez merge i bez uruchamiania deploymentu. Digest artefaktu/config nie był odczytywany: **to nie jest LKG receipt**.

### F2. Prywatna baza

Odczytany branch Development projektu spring-bread-28217539 jest ready; DB platform_private. Istniejące konta/organizacje/granty pozostają w profitia_access. Zarejestrowane role runtime sześciu istniejących aplikacji mają ograniczone flags, ale nowy Identity Runtime nie otrzymuje ich poświadczeń.

Instalacja access: schema 1.0.0, revision 73, digest **356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2**. Directory installation: schema 1.0.0, digest **7004cc968183fdf1406b143066134138426eecfeaae823a3765321e72a9a4811**. Oba porównano z source migrations 001 i 004. Nie znaleziono ogólnego ledgera migracji profitia_access; używa receipts instalacji. Istniejący srm.schema_migrations ma 0001–0018, ale nie jest ledgerem profilu/platform-access. Nie wnioskować „wszystkie migracje wdrożone” z samej obecności tabel.

Produktowa topologia SG2 ma też własny branch br-dry-hall-b294222f. Nie jest to prywatny platform branch ani baza PMOS. Nowy profil należy do istniejącej prywatnej platform DB, nie do baz SG2/SRM/PMOS.

### F3. Proponowany model wdrożenia

Niezależny Render Web Service, Frankfurt, Linux Node, manual deployment, własny build/lockfile i brak persistent disk. Ograniczona aplikacja Next, build context repo pozwalający na lokalny package platform-contracts; dokładne rootDir/buildFilter/build/start muszą wynikać z zaakceptowanego kodu w B, nie z pustego stubu. Publiczny /api/health zwraca minimalną identyfikację usługi/środowiska, bez PII i sekretów; read-only readiness ma kontrolować niezbędne authority bez skutków ubocznych.

Poza publicznym auth UI: serwerowe konto runtime w istniejącym private DB, osobny ograniczony role/binding, oddzielny migrator/operator, ścisła konfiguracja issuer/app/environment/origins i rate limits. Management tokenów Render/Neon i admin DB nie umieszczać w runtime. Sekrety przekazywane przez zatwierdzony secret/env mechanism, bez rozmowy i commitu.

Development realizować jako pierwsze i jedyne środowisko obecnych kolejnych zadań. Staging i Production wymagają oddzielnych resource IDs, konfiguracji, secret scopes, deployment approvals, runtime evidence i promotowalnego artefaktu. Ich gotowość jest **NOT_VERIFIED**. Nie kopiować Development DB ani test keys do release; dokładne private DB branches/resources muszą odpowiadać zatwierdzonej topologii, a nie nazwie podobnej usługi.

Przed każdym przyszłym deploy: LKG zawierające działający source SHA, artifact ID+digest, config revision i wszystkie schema/installation receipts; odwracalny snapshot/backup/branch przy zmianie danych oraz przetestowany rollback. Pierwsza instalacja: udokumentować również poprzedni stan „brak usługi/profilu”, kompatybilne hosty i możliwość wyłączenia wejścia bez niszczenia kont Clerk. Zatrzymać propagację przy regresji; żadnych automatycznych destrukcyjnych down migrations.

## G. OWNER ACTION REQUIRED

Poniższe instrukcje są **warunkami przyszłych etapów**, nie uruchomionymi operacjami. Właściciel nie musi tworzyć zasobów, aby zaakceptować sam Task A.

| Akcja / dostawca | Dokładny zakres i ustawienia | Bezpieczeństwo / koszt / potwierdzenie |
|---|---|---|
| **G1: Architecture owner approval** | Zatwierdzić ownera Architecture Platform, ścieżkę apps/identity-runtime/**, model profilu i zakres B–E. Osobne zadanie ARCHITECTURE aktualizuje routing/CI/onboarding | Przekazać referencję decyzji i zaakceptowane ścieżki/project keys; bez niej B jest pending |
| **G2: Render — identity-runtime-development (proponowana nazwa)** | Web Service w tea-d7lps8rbc2fs73cn80dg, Frankfurt, repo profitia/SG-dev, zaakceptowany commit/branch, manual deploy, bez disk; środowisko Architecture Development ustalone w G1 | Nie podpinać przypadkowo SG2/SRM environment. Owner zatwierdza plan compute i miesięczny koszt. Po stworzeniu przekazać service ID, environment/project ID, region, public URL i niesekretne build/start settings. Agent nie tworzy ani nie deployuje usługi |
| **G3: Neon — istniejący private project** | W spring-bread-28217539, br-sparkling-term-b99l107x, platform_private przygotować osobny least-privilege runtime role/binding i kontrolowany migrator po odbiorze B | Nie tworzyć nowej bazy ani projektu dla profilu. DDL i role są zmianą osobno autoryzowaną, z backupem i RLS tests. Przekazać nazwę roli, receipt/digest i referencję sekretu, **bez connection stringu** |
| **G4: Clerk — Profitia Development** | Potwierdzić istniejące app/instance IDs, issuer hostname, test-mode, wymagane pola i metody; owner konfiguruje oficjalne primary/satellite/allowed redirects dopiero po spike B | Nie tworzyć aplikacji/instancji ani płatnego planu w Task A. Podać niesekretne IDs/issuer/origins i potwierdzenie ustawień; sekret wyłącznie przez bezpieczny provider UI |
| **G5: Domain/DNS — auth-dev.spendguru.app** | Owner wybiera zatwierdzony domain plan, tworzy custom domain Render i wymagane rekordy/TLS oraz Clerk DNS zgodnie z faktycznymi wymaganiami dostawcy | Nie zgadywać CNAME target. Zweryfikować DNS, certyfikat, exact redirect allowlist i brak cross-environment session acceptance. Podać hostname/status/certificate evidence, bez kluczy |
| **G6: GitHub/CI** | Użyć istniejącego repo i zatwierdzonej tożsamości Development; workflow Identity Runtime bez auto-deploy | Nowy GitHub Environment tylko jeśli owner zdecyduje, z osobnym approval. Podać environment ID i politykę, nie sekrety. Nie dodawać repo |
| **G7: Release planning później** | Oddzielnie zaplanować auth-staging/auth, instancje Clerk release-mode, private DB topology i Render services | Wymaga osobnej zgody, budżetu i LKG/rollback/UAT. Żadnych działań Staging/Production z obecnego zadania |
| **G8: Product/privacy decisions** | Zatwierdzić TTL/renewal bindingu, account provisioning admission policy, retencję profilu/telefonu i granicę konto bez organizacji | Przekazać decyzje i kryteria akceptacji; job/phone nie wchodzą do rejestracji, brak SMS kosztów |

Kosztów nie wyceniono fikcyjną ceną: nowy Render compute, użycie Neon, liczba użytkowników i ewentualne funkcje paid Clerk wymagają aktualnej oferty właściciela. Brak odpowiedzi G1/G4/G8 zatrzymuje zależny zakres B; brak G2/G3/G5 zatrzymuje wdrożenie/UAT, nie prace nad zatwierdzonym kontraktem. Nie prosić o hasła, private keys ani DSN w czacie.

## H. Execution Roadmap

| Etap / owner | Mały zakres i zależności | Kryterium odbioru |
|---|---|---|
| **B0 — architecture onboarding / ARCHITECTURE** | G1, exact routing/CI, manifest i kontrakty; decyzja środowisk Clerk i domain spike | Zero NO_MATCH dla autoryzowanych targetów, właściwy profil/PMOS, żadnego rozszerzenia praw SG2 na shared owner |
| **B1 — Identity & Profile Backend / ARCHITECTURE** | Shared verified-external-identity + ensureAccount; account profile storage; instalacja dopiero po G3 i LKG | Równoległe retry dają jeden userId; brak email merge/auto-reactivation/auto grants; outage retry bez orphan rows; rzeczywiste limited-role account-self RLS, obcy użytkownik i tenant denied, version conflicts, audit/PII checks; zgodne digest/receipts |
| **B2 — Session compatibility / ARCHITECTURE z odbiorami konsumentów** | Oficjalny SDK/SSR, issuer/environment, redirect allowlist i nowe originy; bez produkcyjnego cutover | SG2 i SRM receiver azp zgodny; cross-origin POST/mixed environment denied; zły return URL i CSRF denied; brak kopiowania tokenów; revocation widoczna; brak rozszerzenia bearer peer-read |
| **C — Conversational Registration / ARCHITECTURE** | Po B, na bazie istniejącej makiety V2 i kanonu visual; minimum pól wymaganych przez Clerk, e-mail code, avatar | Enter i strzałka wysyłają dymek; dots/typewriter/subtelny ruch zachowane; keyboard/focus/reduced-motion; sekrety maskowane; błędny/expired code, resend/anti-bot/session tasks i retry obsłużone; koniec „Konto gotowe” → aplikacja; żadnych pytań o firmę/rolę/branżę/job/phone |
| **D — Conversational Login & Recovery / ARCHITECTURE** | Oddzielne scenariusze hasło/e-mail code/reset; współdzielone bezpieczne komponenty | Testy existing/unbound/revoked kont, nowe urządzenie/MFA jeśli Clerk wymaga, recovery, rate limits i session tasks; brak account enumeration/sekretów w historii; prawidłowy logout |
| **E-SG2 — Consumer Integration / SG2** | Jawnie określone auth/entry targety SG2, brak zmian wspólnych pod SG2; ręczny Development release po LKG | Pełne przejście nowego i istniejącego HUMAN konta; zero/jedna/wiele org; brak product grant denied; expiry/revoke i przełączenie użytkownika bez wycieku; poprawny safe return; source vs artifact vs UAT odrębnie |
| **E-SRM — Consumer Integration / SRM** | Osobne zadanie, profil i PMOS SRM po zaakceptowanych shared contracts | Analogiczne testy SRM i SG2↔SRM session/revocation; brak mieszania workspace/DB/continuity |
| **E-UAT — wspólny odbiór Development** | Właściciel produktu + oba ownerzy; wszystkie G2–G5 i dowody B–D | Rzeczywiste logowanie/rejestracja/recovery, multi-user/multi-org negatywne próby, kompatybilność i rollback rehearsal; dopiero wtedy decyzja o następnym środowisku |

Przyszły onboarding organizacji i roli jest poza B–E UI: osobny zakres po wejściu do aplikacji. Nie dopisywać pytań do C pod pretekstem „podstawowego onboardingu”.

## I. Governance & Evidence

### I1. Autorstwo i granice wykonania

Root AGENTS, aktywny manifest, Governance Canon v3, SG2 adapter, routing/baseline, target architecture, operation context/matrix, lifecycle i topologia zostały załadowane. Manifest: 46 aktywnych dokumentów, walidacja PASS. Isolated branch: **docs/sg2-identity-runtime-task-a-20261021**, utworzony z odświeżonego main. Istniejący checkout i cudza praca zachowane. Brak przełączenia do ARCHITECTURE/SRM/CIC.

Jedyny target Task A: `Canon/evidence/2026-10-21-sg2-identity-runtime-task-a-handoff.md`, owner Governance Source Layer, baseline ALIGNED; change classification NOT_APPLICABLE dla propozycji dokumentacyjnej. Pełny Development preflight z require-begin: **PASS**, w tym manifest/profile/topology/target/repository/code-state/routing/PMOS runtime/begin. LIVE_PROVIDER_DRIFT_GATE i PMOS_ESTATE_GATE: kanonicznie NOT_APPLICABLE dla tego source scope, nie podszywają się pod wykonany runtime UAT. Oddzielny odczyt Render/Neon wykonano jak wyżej.

PMOS begin: **REGISTERED**; task-scoped conversation **pmos-task-v2:24b915b82b5e4774b45452d5dacc0e55c9d11399960edc2b166d1cbb8c76dfc7**, registration **cmvhtzlyp00001zity0od8cu1**, host **01a15aed-8d94-7fe0-9cff-c54f72b5f8a8**. Tylko SG2 PMOS: project lucky-dream-96138453, neondb, host ep-plain-king-al45f92h; MEMOROS project cmptxz92m000023gjw2r3gbf5; PHR profitia/project-history-repository. Własne task-scoped .pmos/.context i klon PHR, bez wspólnych writerów.

### I2. Walidacja

- Governance manifest / routing / Development bridge / isolated workspace: **26/26 testów PASS**.
- Existing identity-provider, clerk-configuration, identity-peer-read, operation-context, access-store: **294/294 testów PASS**, zero skipped/fail.
- Publiczne health checki SG2 i SRM: PASS, development. Nie wykonano auth runtime UAT ani aktualizacji wdrożeń.
- Profile/provisioner runtime tests: NOT_EXECUTED — kod nie istnieje w Task A.
- Pełne buildy produktów: NOT_EXECUTED — brak zmian produktu; nie są dowodem gotowości przyszłego runtime.
- Git diff/whitespace i finalny stan PR/CI: zapisywane w końcowym execution receipt po commicie tego dokumentu.

### I3. Publikacja i odczyt persisted evidence

Ten source handoff powstaje przed canonical closeout. Sam nie deklaruje sukcesu późniejszego PMOS save/MEMOROS/PHR. Po commicie i utworzeniu draft PR należy uruchomić kanoniczny `pmos:save --bootstrap-input`, bez ręcznie ustawionego completionEvidence, i odczytać zapisane rekordy oraz receipt publikacji. Końcowy execution receipt w PMOS/PHR i odpowiedź zadania muszą zawierać rzeczywisty source commit, PR URL/status/checks, wyniki testów i identyfikatory publikacji.

Task A wolno uznać za zamknięty dopiero po: PMOS save/context refresh/handoff SUCCEEDED, MEMOROS DELIVERED, PHR publication SUCCEEDED z commit obecnym na zdalnym main PHR, persisted FlightRecord i zamkniętym begin, pending slot CLEAR oraz advisory lock CLEAR. Ewentualną blokadę publikacji raportować jako PARTIAL, nie „zrobione”. Nie wykonywać nowego source commitu wyłącznie po to, aby dokument zawierał własny hash/późniejszy receipt; unikać samoodnoszącego się łańcucha closeoutów.

### I4. Werdykt zakresu architektury

```text
TASK_A_VERDICT = PASS (warunkowo po potwierdzonym canonical closeout; do tego PENDING_CLOSEOUT)
ARCHITECTURE_PROPOSAL_READY = YES
ROUTING_APPROVED = NO (nowy moduł; dokument Task A ma ROUTING_GATE=PASS)
NEW_RUNTIME_CREATED = NO
INFRASTRUCTURE_MUTATED = NO
DATABASE_MUTATED = NO (produktowa baza; wykonano wymagane zapisy continuity w SG2 PMOS)
DEPLOYMENT_PERFORMED = NO
OWNER_ACTION_REQUIRED = YES
NEXT_RECOMMENDED_TASK = B0 — Architecture approval & routing onboarding, profil ARCHITECTURE
```

Brak zatwierdzonego nowego ownera/routingu jest jawną zależnością przyszłej implementacji, nie błędem wymagającym obejścia. Task A dostarcza kompletną propozycję A–I, kontrolowany dokumentacyjny PR i listę działań właściciela; nie dostarcza działającej usługi.
