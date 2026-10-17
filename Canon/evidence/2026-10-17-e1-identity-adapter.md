# E1 — kandydat adaptera tymczasowej tożsamości

Status: IMPLEMENTED_CANDIDATE / ISOLATED_SDK_VERIFICATION. Nie jest odbiorem rzeczywistych kont, członkostw, aktywacji produktów ani całego E1.

Zadanie `ARCHITECTURE-E1-IDENTITY-ADAPTER-20261017`, profil ARCHITECTURE, Development/local, workspace SG-dev Architecture. Authority profitia/SG-dev/main, źródło bazowe `f21dac6faf2a23b486872ebba74a6f3d93251166`, po [zakresie i baseline E0/E1](2026-10-17-e0-e1-scope-and-baseline.md). Begin `cmvc0piyg0000j22x12b9wbsz`, conversationId `pmos-task-v2:5b0296352715d71bee4557aeb5d499affc46c71de51216f2980f342d5387c2d5`, rzeczywisty host `01a133c2-c245-77a0-bb6b-33165e2ad80c`; własne architecture_pmos. Rejestracja nie jest dowodem closeout.

## Zmiana i granice

W istniejącym pakiecie platform-contracts1.2.0 dodano export `identity-provider`1.0.0, z osobnym digestem implementacji/typów `7db7627d36a5b0296c3620c1888a118da665682815aa19c8881d01c7cae2a0e6`. Korzysta ze wstrzykniętego, serwerowego oficjalnego klienta Clerk i autorytatywnego czytnika bindingów; pakiet nie tworzy własnej usługi sieciowej ani nie zależy od Reacta/Next. Laboratorium przypina oficjalny `@clerk/backend`3.25.0 wyłącznie jako zależność testową. Synchronizacja lockfile pakietu1.2.0 usuwa wcześniejszą niespójność metadanych1.0.0; brak zmiany prywatnych pinów SG2.

Weryfikacja obejmuje podpis/ważność przez SDK, dokładny issuer i origin/azp, aktywną bieżącą sesję i nieodwołane konto dostawcy, a następnie bieżący binding environment+issuer+subject do wewnętrznego UUID Profitii. Wymagany jest ważny wersjonowany binding ze źródłem; brak danych, outage, blokada/banned/locked/deprovisioned, impersonacja i cudza konfiguracja odmawiają dostępu. Nie odczytuje się ról/organizacji/produktu z Clerk ani userId/orgId z nagłówków. Nie ma automatycznego provisioningu ani dopasowania kont po e-mailu.

Wynik to aktor HUMAN, nie grant dostępu. Audience oznacza serwerowe powiązanie zweryfikowanego issuer/azp z aplikacją; nie deklaruje nieistniejącego JWT aud. Członkostwo, polityka, zasób, produkt i audyt nadal muszą być sprawdzone przez executor w chronionej transakcji gospodarza. Odczyty sesji i konta nie są cacheowane, ale nie ustanawia to samo z siebie liniowej gwarancji unieważnienia już trwającej operacji; dowód tego zachowania należy do integracji i jobów.

Dotychczasowy development-context i operation-context pozostają byte-identical. Digest implementacji/typów operacji nadal `e37a11798ed41b1c0a30f2ac3b539c6d19db59246c8ceae94005afeb10a08455`, kontrakt1.0.0 / implementacja1.0.0-candidate.3. Żadna żywa trasa nie importuje nowego adaptera, nie włączono fallbacku demo, nie utworzono rzeczywistych kont ani ról.

## Wykonane testy lokalne

- 119 testów kontraktów i laboratorium,0 failed/skip, z rzeczywistym lokalnym PostgreSQL16 i zwykłą rolą dla dotychczasowego fixture.
- W tym45 nowych testów tożsamości:36 przypadków kontraktu i9 z rzeczywistym SDK. Poprawnie podpisany syntetyczny token RSA przechodzi SDK i lokalne odczyty sesji/konta. Fałszywy podpis, expiry, obcy issuer/azp, przyszłe nbf, odwołanie sesji, banned account i outage nie uzyskują dostępu.
- SDK testuje prawdziwy HTTP do lokalnego fixture, z blokadą fetch poza jego loopback origin i wyłączoną telemetrią. Brak prawdziwego klucza, sesji, logowania, Clerk tenant API lub danych klientów. Fixture używa aktualnych odpowiedzi API SDK; początkowy błąd podwójnego /v1 w adresie fixture został poprawiony, bez poluzowania odmów.
- 4 istniejące testy przyjęcia kontraktu SG2/SRM oraz33 testy governance/workspace/kontrolera CI przechodzą,0 skip. Build pakietu i laboratorium poprawny.
- Ścisły typecheck interfejsu adaptera z rzeczywistym ClerkClient3.25.0 przechodzi; zwrot toAuth jest unknown i walidowany w runtime, obejmując także odmowne/machine warianty SDK.

Pełne aplikacyjne buildy i SQL/API obu odbiorców wymagają odrębnego dowodu CI dla dokładnego kandydata; ten zapis lokalny ich nie zastępuje. Żaden wynik syntetyczny nie jest testem rzeczywistego konta startowego.

## Stan zasobu utworzonego przez właściciela

Właściciel utworzył `profitia-platform-development`, app `app_3KoJk9FmKeTC4hhlQwTgX6PMZmD`, instance `ins_3KoJk8us60Ywqei67JBwUx6R5pi`, Development. Odczyt panelu potwierdził Open i włączoną Allowlist z jednym adresem wskazanym przez właściciela. Nie publikujemy tego adresu w repozytorium. Kody e-mail i weryfikacja przy rejestracji są włączone. Ostatni odczyt Email nadal pokazywał włączone linki; pełna konfiguracja code-only, telefon/hasło/SSO, Organizations oraz issuer, klucze i działanie logowania nie są jeszcze odebrane. Nie zmieniano ustawień dostawcy z tego zadania.

[Runbook](../runbooks/temporary-identity-provider-setup-v1.md) rozdziela utworzenie przez właściciela, konfigurację i późniejszą integrację. Brak nowego kosztu, projektu GitHub/Render/Neon, Production lub zmian domen/DNS. Clerk Development nie jest dopuszczony przez adapter do logicznego Staging/Production. Kolejne wydanie potrzebuje osobnej konfiguracji i odbioru.

## Pozostałe zależności E1

Aktualny binding/konto i kontrolowany bootstrap muszą zostać wdrożone w odpowiednim magazynie z ograniczonymi rolami; laboratorium nie jest takim magazynem. Nadal wymagane są członkostwa i granty Profitii, integracje rzeczywistych handlerów SG2/SRM/dashboard, rozszerzenie reguł operacji i audytu, role/RLS, joby/cache/pliki, drugi gospodarz modułu oraz kontrolowane wydania Development/Staging. Historia demo zachowuje swoje znaczenie organizacyjne. Własny system obsługi kont jest osobnym zakresem właściciela.
