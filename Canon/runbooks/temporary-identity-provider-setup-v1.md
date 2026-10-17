# Tymczasowy dostawca tożsamości — Development

Status: RUNBOOK / E1_IDENTITY_ADAPTER_CANDIDATE. Nie jest zgodą na utworzenie zasobów, nowy koszt, migrację kont ani deployment. Wykonanie wymaga odrębnego zadania profilu i właściwych bramek.

## Odpowiedzialności

Clerk potwierdza logowanie; Profitia nadaje stabilny userId, organisationId, członkostwa, uprawnienia i dostęp produktu. Powiązanie dostawcy to environment + issuer + subject. Adres e-mail sam nie scala kont i nie nadaje roli. Zmiana dostawcy lub własny system obsługi kont to osobny zakres z potwierdzeniem właściciela i bez automatycznego przenoszenia haseł albo historii demo.

Aktualny zasób utworzony przez właściciela: `profitia-platform-development`, application `app_3KoJk9FmKeTC4hhlQwTgX6PMZmD`, instance `ins_3KoJk8us60Ywqei67JBwUx6R5pi`, tryb Development. Publiczny identyfikator nie jest credentialem. Nie utworzono organizacji Clerk, repozytorium, projektu Render/Neon ani instancji Production w ramach tego zadania.

## Czynności właściciela przy tworzeniu

1. W istniejącym workspace Clerk utwórz aplikację `profitia-platform-development`, typ **Consumer**. B2B w kreatorze włącza Organizations dostawcy, które nie są tutaj autorytatywnym modelem organizacji Profitii.
2. Włącz e-mail, wymagany adres i weryfikację przy rejestracji. Zostaw kod e-mail do rejestracji/logowania; wyłącz linki e-mail, telefon, połączenia społecznościowe i inne nieprzyjęte metody.
3. W Configure → User & authentication → Access mode pozostaw Open, włącz Allowlist i dodaj wyłącznie adres konta startowego wskazany przez właściciela. Zapisz i potwierdź zapis odczytem panelu. Nie stosuj domenowego wildcard zamiast konkretnego adresu.
4. Organizations i Clerk Billing pozostają wyłączone. Pozostaw Development; nie wybieraj Go to prod ani płatnych dodatków. Funkcje płatne są dostępne do testów w Development; żądanie zakupu wymaga weryfikacji, nie domyślnej akceptacji.
5. Przekaż tylko adres panelu lub application/instance ID. Nie przesyłaj Secret key, kodu jednorazowego ani sesji do czatu. Nie twórz drugiej aplikacji z powodu wyświetlanego przewodnika instalacji Next.js — integracja istniejących aplikacji jest zadaniem wykonawczym.

Źródło ustawień: [Clerk access restrictions](https://clerk.com/docs/guides/secure/restricting-access), [środowiska](https://clerk.com/docs/guides/development/managing-environments). Development ma ograniczenia i inny mechanizm sesji; nie stanowi konfiguracji do odbioru klientowskiego Staging lub Production. Przed takim wydaniem wymagane są osobny zasób/kontrakt, właściwy issuer/domena i upoważnienie do ewentualnych zmian domenowych; nie wolno współdzielić sesji Dev/Stage ani zmieniać etykiety środowiska.

## Integracja wykonawcza — odrębne zadania SG2/SRM

Użyj jawnie zaakceptowanego `identity-provider` oraz oficjalnego SDK backendowego. Core nie zależy od Reacta ani Next.js. Przypięta wersja SDK w laboratorium to `@clerk/backend`3.25.0, Node>=20.9.0. Nie instaluj automatycznie najnowszego `@clerk/nextjs` w SG2/Next14 i nie wymuszaj peer dependencies. Sposób osadzenia UI, handshake, logowanie i wylogowanie wymagają własnego testu gospodarza.

Konfiguracja serwera wiąże applicationId Profitii, rzeczywiste TARGET_ENVIRONMENT, dokładny issuer i jawne authorizedParties. Lista ma zawierać dokładne origins; bez wildcard i bez dowolnego URL z żądania. SDK telemetry ustaw jako disabled, aby ścieżka chronionej operacji nie wysyłała dodatkowych danych użycia. Dostawca API i secretKey pochodzą z zatwierdzonego miejsca, nigdy z parametrów żądania. Adapter nie implementuje własnej kryptografii tokenów; korzysta z [authenticateRequest](https://clerk.com/docs/reference/backend/authenticate-request) oraz świeżych odczytów sesji i użytkownika.

Secret key jest zapisywany osobiście przez właściciela dopiero po wskazaniu dokładnych istniejących zasobów i sposobu wdrożenia. Osobna instrukcja ma podać właściwy Environment secret lub chronioną zmienną konkretnej usługi i potwierdzić ich odbiorców. Nie zapisuj credentiala jako zwykłej GitHub Variable, w repo, PMOS, PHR, screenshotcie ani w logu. Ten runbook nie upoważnia do odczytu starego Render NPM_TOKEN lub do pożyczania sekretu z innego profilu.

Przyjęcie przez produkt musi dostarczyć autorytatywnego czytnika bindingów i kont, kontrolowany bootstrap zweryfikowanego konta właściciela, ograniczone role, aktualne członkostwa/granty i chroniony audyt. Brak bindingu daje odmowę; adapter nie tworzy konta automatycznie. Tożsamość jest sprawdzana dla każdej operacji. Bieżące odwołanie sesji jest sprawdzane przy uwierzytelnieniu; semantyka operacji już trwającej i delegowanych jobów wymaga osobnych dowodów transakcyjnych. Nie zapisuj actor jako cache ALLOW.

Przed aktywacją zweryfikuj rzeczywiste konto, sesję, wylogowanie, odwołanie, email verification, konfigurację origin/issuer, rolę bazy, profil produktu i pełną ścieżkę operacji. Wyłączenie dostawcy, outage lub brak polityki nie mogą włączać demo ani zaufania do nagłówków. Istniejący development i staging pozostają działające aż do własnej, kontrolowanej migracji i odbioru.
