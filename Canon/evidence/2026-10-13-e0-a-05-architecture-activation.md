# E0-A-05 — aktywacja toru ARCHITECTURE

Data dowodów: 13 października 2026. Zakres: Development, przygotowanie E0-A; bez wdrożenia docelowej architektury produktu E0–E4.

## Stan publikacji

Profil, adapter i topologię opublikowano w PR278. Źródło merge: 78e4e669045fb70331202158f08c465af01ef6ec; commit implementacji: 09b10569a7edd615c26fac97dc9ea41dfe9a2e95. CI PR38456484940 i main38456754248: SUCCESS. Wszystkie 17 zadeklarowanych ścieżek źródłowych zweryfikowano niezależnie przez GitHub Contents względem lokalnych bajtów. Odbiór przygotowania profilu i runtime jest potwierdzony poniżej; końcowa publikacja tego dowodu i closeout własnego zadania są następnymi operacjami tego samego odbioru. 06–09 pozostają do wykonania.

## Fakty i izolacja

Oba nowe projekty Neon pozostają w org-nameless-field-92563437 na Scale. PMOS: billowing-credit-07394675 / br-curly-dream-b94be6uh / architecture_pmos (ID17811). Laboratorium: fancy-cell-49425728 / br-divine-fog-baohc5ay / architecture_sg_lab (ID16758) i architecture_srm_lab (ID16767). Endpointy i role zapisano w jawnych rejestrach bez połączeń i haseł.

Przed inicjalizacją wszystkie trzy bazy miały zero relacji niesystemowych. Istniejący schemat PMOS najpierw zweryfikowano na nowej pustej gałęzi br-floral-cell-b96289m1, endpoint ep-raspy-paper-b9phc1va, 0.25 CU i usypianie 300s. Schemat zawiera 24 tabele publiczne; hash źródła 06ef65bfb2f476fea1075467c204cf21f460b4d0065539629c2327e0c2fa2297. Ponowienie zwróciło IDEMPOTENT. Gałąź zachowano jako dowód i wydano polecenie zawieszenia compute.

Ten sam schemat zainicjalizowano w nowej bazie ciągłości. Każda baza laboratorium ma jedną tabelę technical architecture_lab_probes z ograniczeniem właściwego project_key. Nie przeniesiono danych PORR, dostawców ani baz aplikacyjnych i nie wdrożono tam kopii biznesowych aplikacji.

Role utworzone przez API Neon miały uprawnienia neon_superuser; próba odebrania tej roli była odrzucona i cała transakcja wycofana. Wyłącznie te trzy świeżo utworzone, nieużywane role usunięto przez API i utworzono zwykłymi poleceniami SQL. Końcowe architecture_pmos_runtime, architecture_sg_lab_runtime i architecture_srm_lab_runtime mają LOGIN, ale nie SUPERUSER, CREATEDB, CREATEROLE ani BYPASSRLS; zero członkostw. Role mają tylko CONNECT do właściwej bazy oraz CRUD/sequence na publicznych tabelach; bez CREATE w public i bez dostępu do architecture_bootstrap. PUBLIC nie ma uprawnień do trzech nowych baz i schematów. To uprawnienia narzędzi Development, nie dowód izolacji tenantów produktu.

Prywatny Render PMOS: srv-db78d82j9qps73bej0c0, środowisko evm-db717krrjlhs739jgo1g, projekt prj-db717krrjlhs739jgo0g, istniejący workspace tea-d7lps8rbc2fs73cn80dg. Plan 0.5c-512mb, jedna instancja, Frankfurt; autoDeploy off, previews off. Źródło wspólne apps/pmos, main; osobny deployment i ograniczone połączenie Architecture PMOS. Usługa nie otrzymuje publicznego URL. Zablokowane są połączenia między środowiskami Render. Nie podano jej właścicielskich URI baz ani sekretów aplikacji biznesowych.

GitHub architecture-development: ID24168168252, repo profitia/SG-dev ID1247665550, polityka main-only i właściwe niesekretne zmienne profilu. Staging i Production ARCHITECTURE pozostają RESERVED i odrzucane. SG2/SRM/CIC zachowują istniejące profile, bazy i polityki ciągłości.

## Weryfikacja i granice

Inicjalizator odrzuca niezgodny host, bazę, właściciela, pooler, istniejące dane oraz niewłaściwą gałąź walidacyjną. Nie resetuje schematów lub haseł istniejących ról. Chronione konfiguracje mają tryb0600 i pozostają poza Git/Canon/PHR. Niezależne zapytania potwierdziły atrybuty wszystkich trzech ról. Rzeczywiste połączenia SG-role do SRM-lab oraz SRM-role do SG-lab odrzucono komunikatem PostgreSQL permission denied for database. Właściwy odczyt tabel przeszedł; odczyt markera właściciela i CREATE są zabronione. Odbiór runtime opisano poniżej.

Cloud Codespaces nie uruchomiono; odtwarzalne konfiguracje i trzy rzeczywiste lokalne checkouty są wynikiem 04. Pełne logowanie, tenancy, płatności, RLS i SaaS są nadal osobnym zakresem architektury produktu. Pierwotny freeze oraz odrębne dowody 01–04 pozostają historyczne.

## Rzeczywisty runtime i ciągłość

Architecture PMOS LIVE: deploy dep-db78ivrbc2fs73e7ia20, SHA78e4e669045fb70331202158f08c465af01ef6ec. SG2 PMOS po automatycznej publikacji wspólnego rejestru: dep-db78igfavr4c73evmrng, LIVE z tym samym SHA. Żadnego runtime produktu SG2/SRM nie wdrożono w etapie05.

Prawdziwy odczyt HTTP z prywatnej sieci wykonano krótkim one-off job job-db78k4ei0phs73c7tdtg na plan-srv-006: SUCCEEDED. Test sprawdzał API/conversations HTTP200, strukturę odpowiedzi, rzeczywistą bazę architecture_pmos, connected_role architecture_pmos_runtime oraz exact SHA procesu job. Nie dodawano publicznego endpointu lub klucza SSH. Próba SSH nie powiodła się wskutek braku dopuszczonego publickey; zastosowano oficjalny jednorazowy job odczytowy. Job zakończono, bez nowej trwałej usługi.

Własny checkout architektury i chroniona konfiguracja: profitia-development/architecture; własny PHR: profitia-development/architecture-phr. Port lokalny PMOS3203. Workspace check --require-config, budowanie kanonicznego kontekstu i pmos:verify-runtime: PASS. Pierwszy pełny Development preflight i require-begin: PASS. Rzeczywista rejestracja ARCHITECTURE-E0-A-05-ACTIVATION-ACCEPTANCE-20261013: cmv739kj20000c2nekkj7lwxc; conversationId pmos-task-v2:d5fe94121ad6b23efdb08ce5b1c2f07eab08563e30bd6122cbbd1dc78a417b34. Zapis jest w architecture_pmos, a nie SG2 lub SRM.

Walidacja publikacji05: 27/27 testów governance/workspace/initializer, 55/55 lifecycle/PHR, oba typechecki i production build PMOS. Testy nieznanego profilu pozostały; historyczne oczekiwanie, że ARCHITECTURE jest nieznane, zmieniono na stan po legalnym onboardingu. Nowe negatywne testy odrzucają host o obcym suffixie, rolę właściciela, brak TLS oraz podmianę projektów, baz i ról laboratorium. Nie wyłączono bramek ani nie osłabiono polityk starych profili.

Bootstrap był rozliczony osobnymi zarejestrowanymi zadaniami SG2 Development: SG2-GOVERNANCE-E0-A-05-BOOTSTRAP-20261013, SG2-GOVERNANCE-E0-A-05-IDENTITY-GUARDS-20261013 i SG2-GOVERNANCE-E0-A-05-LIFECYCLE-FIXTURES-20261013. Nie jest to docelowy routing zwykłych zadań architektury. Kolejne prace ARCHITECTURE używają własnego profilu i własnej historii; pełne dowody PHR i równoległości będą uzupełnione w07–09.
