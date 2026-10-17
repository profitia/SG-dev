# E1 — konfiguracja tymczasowego Clerk Development

Status: DEVELOPMENT_CONFIGURED_WITH_NOTED_VARIATION / NOT_INTEGRATED. Nie jest odbiorem logowania w aplikacjach, bootstrapu konta, nadania praw administratora ani pełnego E1.

Zadanie `ARCHITECTURE-E1-CLERK-DEVELOPMENT-CONFIG-20261017`, ARCHITECTURE / SG-dev Architecture / Development / local. Baseline `6dfe8363e68ebd0588399b6c27d5a116b0721038`. Begin `cmvc2mg150000h52svc6yuroo`; conversationId `pmos-task-v2:79921e3a48888e4072dbc9d8e09dbf70b8237f06f2ca58fa08543ef5290de87a`. Rejestracja nie jest dowodem closeout.

## Zasób i stan końcowy

[Rejestr](../registries/temporary-identity-provider-v1.json) zawiera istniejącą aplikację i instancję utworzoną osobiście przez właściciela. Panel potwierdza Development, workspace Hobby, Open i włączoną Allowlist z dokładnie jednym wskazanym adresem. Nie publikujemy tego adresu ani subject/username konta w repozytorium lub historii zadania. Allowlist jest ograniczeniem rejestracji dostawcy, nie członkostwem lub autoryzacją produktu.

Wymagany e-mail, weryfikacja przy rejestracji i kody do rejestracji/logowania są włączone. Oba warianty linków były nadal włączone w odczycie przed zmianą. Wyłączono je i zapisano; ponowne otwarcie strony potwierdziło oba pola0 oraz pozostawione kody1.

Google i Microsoft były aktywne przy współdzielonych domyślnych credentialach dostawcy. Wyłączono oba przez odwracalne Disable connection; każde przejście pokazało Disabled i możliwość Enable connection. Nie kasowano konfiguracji ani nie odczytywano credentiali. Telefon, passkeys i mobilna biometria są wyłączone. Username przy rejestracji jest opcjonalny, logowanie nim jest wyłączone; istniejącego identyfikatora konta nie zmieniano.

Organizations nie są uruchomione: panel pokazuje Enable organizations. Clerk User Billing ma stan0. Nie włączono instancji Production, domen, planu lub dodatków i nie utworzono nowej organizacji.

## Jawne odstępstwo: ustawienia hasła i Device Trust

Wstępna instrukcja sugerowała wariant wyłącznie kodów e-mail. Panel miał włączone Sign-up with password i Add password to account oraz Device Trust. Próba wyłączenia drugiego ustawienia w **niezapisanym formularzu** zmieniła wskazanie Device Trust na disabled. Bieżący zakres zabraniał jego wyłączenia, dlatego użyto Reset, przywrócono oba poprzednie przełączniki i ponownie potwierdzono enabled. Nie zapisano zmiany hasła, nie zmieniano ani nie resetowano indywidualnego credentiala.

Końcowego stanu nie przedstawiamy jako strict code-only. Kody są dostępne, ale ustawienia hasła zachowano wraz z dotychczasową ochroną. To odwracalna korekta sposobu realizacji minimalnej tożsamości, nie zgoda na osłabienie Device Trust/MFA. Integracja musi jawnie obsłużyć przyjęty sposób logowania; nie może twierdzić, że dostawca akceptuje wyłącznie kod. Ewentualna dalsza zmiana wymaga osobnej oceny skutków, a nie cichego zapisu tego formularza.

## Konto i granica dowodu

Panel zawiera konto wskazanego administratora, flagę Verified adresu i Never active. Jest to potwierdzenie istnienia rekordu i jego ustawień, nie wykonania logowania lub samodzielnego potwierdzenia posiadania skrzynki przez działającą sesję. Nie nadano mu biznesowych ról lub produktów i nie utworzono bindingu Profitii. Odbiór rzeczywistej sesji oraz kontrolowany bootstrap nadal wymagają własnego zadania i dowodów; e-mail sam nie scala kont ani nie nadaje uprawnień.

Nie otwierano/revealowano Secret key, nie kopiowano kluczy do PMOS/PHR, nie logowano się w imieniu użytkownika i nie tworzono danych osobowych w ARCHLAB. Istniejące produkty Development/Staging pozostały bez zmian i bez deploymentu. Ten rejestr zasobu nie zastępuje ich topologii lub przyjęcia adaptera.

## Kompatybilność klienta

Aktualny publiczny npm metadata potwierdza, że `@clerk/react`6.17.8 dopuszcza React18 i używaną wersję React19; Node>=20.9.0. Wersja `@clerk/clerk-js`6.39.1 ma ten sam minimalny Node. Istniejący SG2 deklaruje React^18.3.1 i Next14.2.29, SRM React19.2.4 i Next16.3.8. Pozwala to przygotować adapter prezentacji bez wymuszania aktualizacji Reacta lub Next. Nie zainstalowano jeszcze tych klientów w produktach i nie odebrano ich UI. Źródła: [metadata Clerk React](https://registry.npmjs.org/@clerk%2Freact/6.17.8), [metadata Clerk JS](https://registry.npmjs.org/@clerk%2Fclerk-js/6.39.1).

Zmiany stanu dostawcy potwierdzono odczytem panelu po zakończeniu zapisu, weryfikując rzeczywiste application/instance IDs. Governance preflight i begin przeszły przed zmianą, a ponowne sprawdzenie authority poprzedziło publikację dowodów. Nie zastępuje to testów sesji, issuer/origin, ograniczonych ról, chronionych operacji, migracji i wydań. Cały E0/E1 pozostaje IN_PROGRESS.
