# E1 — kandydat rozszerzonych reguł i audytu modułu

Status: **CANDIDATE_PENDING_SEPARATE_CONSUMER_ACCEPTANCE**. Profil ARCHITECTURE, TARGET_ENVIRONMENT=development, wykonanie lokalne. Zadanie `ARCHITECTURE-E1-ACCESS-COMPLETION-20261017`, baseline main `cd0603602864a05ab589536342c6dda8709d6bf3`. Pełny E1 pozostaje **IN_PROGRESS**.

## Dostarczona granica

Pakiet1.6.0 zachowuje jeden executor, identity adapter, access-store i writer audytu. Executor operation-context1.0.0-candidate.4 ma14 jawnych operacji zamiast9: dodatkowo category.read/write, supplier.assignment.read/write oraz forecast.read. Kategorie i przypisania mają właściciela organizacji; forecast jest zatwierdzoną wiedzą wspólną bez prywatnego właściciela/metadanych. Permission, DENY, ceiling profilu, bieżące członkostwo oraz produkt i feature są niezależne. Przypisania wymagają jawnej oferty SPENDGURU lub SUPPLIER_INTELLIGENCE udostępniającej supplier_workspace; Standalone nie pożycza SPENDGURU. Po wygaśnięciu silnik nie zamienia wybranej oferty na inną podczas skutku.

Prawidłowy null/false authority oznacza brak podstawy dostępu, a brakujące lub malformed wiersze, niezgodny login/rola/baza oraz awaria pozostają technicznym fail-closed. Wygaśnięcie przy INTENT lub OUTCOME zachowuje przyczynę odmowy i nie jest udawane jako awaria writera; skutki są cofane. Dedykowany SQLSTATE PT403 oznacza wyłącznie miniony termin modułu; rozpoznawane są kształty błędów pg i Prisma, bez diagnostyki w odpowiedzi.

Private-operation-host1.1.0 może jawnie przyjąć module id, digest SQL002 oraz auditSchemaDigest SQL003. Na tej samej transakcji ustanawia istniejący module-scope, weryfikuje osobną capability audytu i przekazuje zamrożone moduleEvidence do kontekstu oraz wspólnej koperty zdarzeń. Dane nie pochodzą z HTTP i nie nadają uprawnienia. Niepełne jawne ustawienie modułu jest odrzucane; bazowy host bez dodatku zachowuje instalację bazową.

SQL001 i002 oraz identity-provider zachowano bajtowo. Addytywny SQL003 ma osobny hash i jedną dodatkową tabelę instalacji z ENABLE/FORCE RLS, pod kontrolowanym ownerem NOLOGIN. Migracja wymaga tego ownera. Ograniczony descriptor wymaga osobnego EXECUTE. Rozszerza się tę samą funkcję append_audit, zachowując poprzednie ordinary ACL; nie tworzy się konta, roli, aplikacji, członkostwa lub grantu. Sprawdzane są zamknięta koperta, aktualny binding/produkt/schemat/termin; OUTCOME wymaga rzeczywistego scope i transakcji. Historyczne moduleEvidence pozostaje w DENY/FAILURE po rollbacku/unieważnieniu. Runtime nie otrzymuje bezpośredniego SELECT/UPDATE/DELETE audytu lub authority.

Wspólny clerk-configuration1.0.0 przygotowuje jeden parser serwerowej konfiguracji dla obu produktów, niezależny od SDK i React. Zwraca wyłącznie publiczny klucz i zamrożoną konfigurację aplikacji, środowiska, issuer i dokładnych origins. Nie zwraca sekretów lub danych konta/organizacji. Development wymaga kluczy testowych, a release live/HTTPS i właściwego issuer. Składnia konfiguracji nie dowodzi ważności klucza ani sesji. Odbiorcy muszą odrębnie zastąpić lokalny parser i potwierdzić kompatybilność SDK/UI; producent nie deklaruje tego jako już przyjęte.

## Weryfikacja producenta

**276 testów kontraktu i laboratorium — zero błędów i skipów**. **33 testy governance/workspace/kontrolera — zero błędów i skipów**. Build pakietu i diff-check przechodzą. W tym68 rzeczywistych testów PostgreSQL obejmuje bazowe granice, moduł i audyt: ordinary logins, własność organizacji/osoby, odmowę bez capability/EXECUTE/digestu, aktualne unieważnienie, zakaz autocommit replay, fałszywe/nadmiarowe/wrażliwe metadane, ownera migracji, blokowanie zmiany instalacji przez istniejącą fence, rollback rzeczywistego zapisu po wygaśnięciu oraz oddzielną awarię OUTCOME. Użyto wyłącznie strzeżonej bazy loopback platform_access_test i danych syntetycznych. Testy kształtu transportu Prisma nie zastępują osobnego rzeczywistego odbioru tej nowej migracji przez sterownik aplikacji.

- operation: `579b289b2437e2c04741a4b9b88ce96c94fe392a4d6cf305fb2f5792b1de8d1f`.
- access: `e0d3fb3c2201816755b76546976c964791adee21a8b528c05b0adbd1af09a8ca`.
- baseSql: `356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2`.
- moduleAuditSql: `af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac`.
- privateHost: `d6911d606898d7df06c09755947bec2a81c777cc3549a71b4cb3074022bee18c`.
- clerkConfiguration: `b3bdad865a16cbf677db1dd7450f594870abca30f8a252bd4d361d2387417246`.

## Publikacja i pozostałe granice

Zmieniły się fingerprinty operation/store/host: wymagane są osobne zadania i PR SG2/SRM z rzeczywistymi testami i jawnym przyjęciem. Rozbieżny digest nadal blokuje publikację. Source SHA producenta, skoordynowane dokładne źródło i CI muszą zostać zapisane w PR/PMOS po commitach; same testy lokalne nie są finalnym closeout lub odbiorem aplikacji.

Nie wykonano remote DDL/SQL, grantów lub danych, bootstrapu, zmiany sekretów/konfiguracji dostawców, live route activation, deploymentu, Staging lub Production. Nie zastąpiono Clerka i nie utworzono runtime logowania. Brak kolejnego writera audytu/PMOS. Operator nadal ma uprzywilejowaną granicę migracji: source_ref i wersja nie są pełnym dziennikiem wszystkich działań DBA. Retencja, reconciliation i zewnętrzna ochrona audytu nie zostały odebrane. Test RLS nie jest gwarancją przeciw DBA lub posiadaczowi skradzionego poświadczenia backendu.

Pozostałe operacje, rzeczywiste usługi/delegacje/limity, cache/pliki/eksporty, pełne wejścia, własne konta/członkostwa, drugi gospodarz modułu biznesowego oraz wydania Development i Staging pozostają osobnymi dowodami E1. Płatne żądania i E2–E4 nadal są odrzucane. Żaden wykonany test nie został nazwany realną sesją Clerk lub wdrożeniem produktu. Własne PMOS/PHR ARCHITECTURE wymaga publikacji i potwierdzonego closeout; begin tego nie dowodzi.
