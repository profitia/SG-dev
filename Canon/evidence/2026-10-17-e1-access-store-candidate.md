# E1 — kandydat transakcyjnego magazynu tożsamości i dostępu

Status: IMPLEMENTED_CANDIDATE / ISOLATED_POSTGRES_VERIFICATION. Brak live schema, bootstrapu konta, przyjęcia przez produkt lub wydania. Cały E0/E1 pozostaje IN_PROGRESS.

Zadanie `ARCHITECTURE-E1-ACCESS-STORE-20261017`, ARCHITECTURE / SG-dev Architecture / Development / local, baseline `3e26ed229b8cce2415519f228e6ec3e7a26c3289`. Begin `cmvc1r95r0000tg03wubfcp3h`; conversationId `pmos-task-v2:0fa9a69ca40eb481c7621c31a4f633ef58a7b915df0c168f939ae7d100adb9cb`, rzeczywisty host `01a133c2-c245-77a0-bb6b-33165e2ad80c`. Begin nie jest dowodem closeout. Obowiązuje zakres [E0/E1](2026-10-17-e0-e1-scope-and-baseline.md).

## Zakres i wariant

Pakiet platform-contracts1.3.0 dodaje opcjonalny `access-store`1.0.0 i initial SQL1.0.0. Nie powstała nowa usługa sieciowa, zależność od Reacta, SDK lub kopia PMOS. Implementacja wstrzykuje query prawdziwej transakcji gospodarza. Zmiana jest jawnie przyjmowana przez odbiorców.

Wybrano jedną przyszłą prywatną bazę `platform_private` z oddzielnymi schematami/logowanymi rolami aplikacji i wspólnym `profitia_access`. Umożliwia to jedną transakcję kontroli praw, prywatnego skutku i OUTCOME. Wcześniej rozważane osobne bazy tożsamości i SG2 nie zostały utworzone. Nie przypisujemy atomowości oddzielnym bazom ani zewnętrznym wywołaniom. [Zasób właściciela](../registries/platform-private-onboarding-v1.json) nadal jest pusty; jego obecna baza `neondb` nie została zmieniona przez ten task. Nie zmieniono topologii ani połączeń SG2/SRM i nie przeniesiono danych.

## Mechanizmy

- Własne konta UUID, dokładne issuer/subject w środowisku instalacji, unikalny bindingId i rosnące wersje. Brak linkowania przez e-mail lub przywłaszczenia historii demo. Odwołanie/przywrócenie bindingu nie przywraca ważności starego dowodu.
- Aktywne organizacje i członkostwa; jawne prawa aplikacji do operacji/funkcji/zasobu, z osobnymi DENY i grantami produktu. Nazwa roli nie daje wildcard. Pełny onboarding, administracja rolami, last-owner workflow i billing nie są zaimplementowane tym kandydatem.
- Dziesięć tabel authority/audytu z ENABLE i FORCE RLS. Ograniczony interfejs SECURITY DEFINER ma własny search_path i NOLOGIN/NOINHERIT/NOBYPASSRLS ownera z jawną polityką. Runtime nie może przyjąć ownera, czytać/zmieniać authority, przepisywać audytu ani modyfikować schematu. Nie jest to ochrona przed uprzywilejowanym migratorem.
- Kontrola rzeczywistej bazy, loginu, roli i jej flag oraz app/env/project/branch/schema metadata i checksum SQL. Metadane nie są niezależnym dowodem hosta/gałęzi: odbiór połączenia i dostawcy pozostaje wymagany.
- Ponowne sprawdzenie bieżącego bindingu i członkostwa pod wspólnym fence rewizji. Zmiana praw, także nowo dodana odmowa, konfliktuje z transakcją. LOCAL kontekst obejmuje aktora, organizację, aplikację, środowisko, wersję, binding, skończony deadline i transaction ID. Autocommit, stary kontekst puli i serializowany lease są odrzucane.
- Prywatne polityki SQL obejmują dokładny App ID, Organisation ID i gdzie wymagany User ID; kompozytowe klucze obce zachowują właścicielstwo. RLS nie zastępuje serwerowego sprawdzenia operacji i produktu ani ochrony credentiala SQL.
- INTENT jest trwały przed skutkiem, OUTCOME w tej samej transakcji co skutek. Runtime nie czyta ani nie usuwa historii. Niedostępność OUTCOME cofa skutek; niedostępność także FAILURE pozostawia trwały nierozliczony INTENT do recovery. Nie deklarujemy fikcyjnego pełnego audytu przy awarii writera.

## Testy lokalne

Łącznie173 testy kontraktów/laboratorium,0 failed/skip, w tym54 nowe:22 testy granic adaptera i32 testy rzeczywistego PostgreSQL (31 scenariuszy i ich harness). Dane są syntetyczne, wyłącznie w jawnie disposable loopback `platform_access_test`. Pozostałe fixture zachowują swoje oddzielne schematy/bazy. Nie było połączenia z klientowską bazą Neon, sekretu Clerk ani płatnego API.

Scenariusze obejmują dwie organizacje, dwie osoby w jednej i jedną w dwóch, kontekst konta bez członkostwa, własne listy osobiste, obce zapisy i FK, złą aplikację/rolę/środowisko/project/branch/schema, disabled/expired/revoked identity i membership, stałą organizację wdrożenia, autocommit/early commit/pool reuse, błędne i nieskończone deadline, serializację odwołania oraz wstawienia nowego DENY. Rzeczywisty executor odmawia przy cofniętym/wygasłym produkcie lub DENY. Test SQL potwierdza niezależny INTENT, atomowy skutek/OUTCOME oraz rollback skutku przy błędzie akcji lub writera.

33 testy governance/workspace/kontrolera CI i4 wcześniejsze przyjęcia kontraktu przechodzą bez skipów. Build pakietu i laboratorium oraz ścisły typecheck interfejsu z obecnym adapterem i rzeczywistym ClerkClient3.25.0 przechodzą. Buildy/API obu aplikacji dla dokładnego kandydata otrzymują odrębny dowód CI; lokalny typecheck nie jest ich zastępstwem.

Fingerprint implementacji/typów/SQL access-store: `4e56e58220815661c3882c59ec897b0d740bf84bbf0485c84fb82007d6e00e50`. SQL: `356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2`. Dotychczasowe operation-context `e37a11798ed41b1c0a30f2ac3b539c6d19db59246c8ceae94005afeb10a08455` i identity-provider `7db7627d36a5b0296c3620c1888a118da665682815aa19c8881d01c7cae2a0e6` pozostają byte-identical, podobnie jak development-context.

## Ograniczenia i odbiór dalszy

[Runbook](../runbooks/private-access-store-initialization-v1.md) opisuje kontrolowaną inicjalizację, role, zwykłe połączenia i granice odzyskiwania. Brak automatycznej migracji lub konta startowego. Fixture nie dowodzi zachowania danych PORR, gotowości całego katalogu operacji, UI, jobów/cache/plików, nowego gospodarza modułu lub Development/Staging.

Fence obejmuje całą instalację; wymaga timeoutów i osobnej walidacji obciążenia. Zewnętrzna sesja Clerk nie uczestniczy w blokadzie PostgreSQL: nie twierdzimy, że jej odwołanie w trakcie już działającej operacji jest liniowo atomowe ze skutkiem. Odzyskiwanie nierozliczonych INTENT, retencja i zewnętrzne kotwiczenie audytu pozostają nieodebrane. Własny system logowania jest późniejszym zakresem. Rzeczywiste produkty muszą przyjąć i zweryfikować kandydat we własnych zadaniach, z właściwymi rolami, migracją, recovery i wydaniem.
