# Mailgun: testy awatarów w Development

Status: **SANDBOX_TRANSPORT_PREPARED; CLERK_DELIVERY_UNCHANGED**.
Zadanie: ARCHITECTURE-MAILGUN-AVATAR-DELIVERY-20261023. Właściciel: ARCHITECTURE / wspólny Identity. PMOS: `architecture_pmos`. MEMOROS pozostaje wyłączony.

## Przyjęty zakres

Użytkownik dostarczył istniejące konto i klucz Mailgun, następnie wybrał: „Na razie testy w sandboxie; przygotuj integrację male/female”. Ten etap obejmuje adapter wysyłki, renderowanie i rzeczywiste próbki. Nie przełącza produkcyjnego ani developerskiego procesu uwierzytelnienia. Nie tworzy webhooka, usługi, uprawnień, migracji, konfiguracji Render ani synchronizacji prywatnego profilu do publicznych metadanych.

Mailgun sandbox pozwala dostarczać tylko do odbiorców, którzy potwierdzili adres. Wyłączenie `Delivered by Clerk` dla wspólnego szablonu OTP zablokowałoby pozostałych użytkowników. Dlatego obecna wysyłka kodów przez Clerk pozostaje włączona. Nie ma bezpiecznego natywnego przełącznika tego globalnego szablonu per odbiorca.

## Komponenty i działanie

- `email-templates/render.mjs`: zatwierdzone grafiki, konwersacyjna chmurka, stopka Profitia, HTML tabelaryczny i tekst alternatywny. Źródła czterech plików przyjęto z PR #668, SHA `6f634c815fd841b5d3081756f79b85ca94303c60`; pierwotny PR pozostaje oddzielny.
- `renderResolved`: jednorazowe podstawienie zmiennych, escapowanie HTML, walidacja kodu i jawna lista originów HTTPS dla zaproszeń. Nie wykonuje zagnieżdżonego szablonu z danych wejściowych. Rodzaj wiadomości musi pochodzić z potwierdzonego procesu, nie być zgadywany z adresu lub samego sluga `verification_code`.
- `renderSandboxSample`: tylko próbka z nagłówkiem **WIADOMOŚĆ TESTOWA**, tematem `[TEST SANDBOX]` i niedziałającym kodem `000000`. Obecny transport odmawia nieoznaczonych wiadomości.
- `email-avatar.ts`: zamknięty enum `male` / `female`; nieznany wybór daje neutralny znak SG. To wygląd asystenta, nie płeć użytkownika ani podstawa uprawnień.
- `mailgun-delivery.ts`: wyłącznie Development i domena sandbox; dokładny endpoint US/EU, jeden odbiorca z jawnej listy, brak CC/BCC, brak przekierowania klucza na inny host, śledzenie kliknięć/otwarć wyłączone. TLS do API weryfikowany; dostarczenie do serwera odbiorcy wymaga TLS i poprawnego certyfikatu.
- `email-dispatch.ts`: wariant i odbiorca są związane z konkretną próbką; równoległe male/female nie przełączają globalnego szablonu. Ten sam identyfikator próbki nie wysyła ponownie w obrębie procesu, zmiana danych pod tym samym ID jest odrzucana. Limit 100 próbek. Jest to ochrona jednej sesji operatora, **nie trwały rejestr webhooków**.

### Grafiki osadzone w wiadomości

Pierwszy test z publicznymi adresami obrazów został doręczony, ale odbiorca zgłosił zaślepki zamiast grafik. Przyczyna po stronie konkretnego klienta pocztowego nie jest ustalona. W poprawionej wysyłce obrazy są częściami MIME `inline`, a HTML odwołuje się do `cid:spendguru-logo.png`, `cid:porr-logo.png` i dokładnie jednego z `cid:assistant-male.png` / `cid:assistant-female.png`. Skrzynka nie musi pobierać tych obrazów z zewnętrznego serwera. Nie wymaga to zmniejszenia ochrony pobierania obrazów w kliencie pocztowym.

`inlineAssetsForAvatar` zwraca manifest trzech wymaganych plików (dwa dla neutralnego). Operator pobiera je z zatwierdzonych URL-i z weryfikacją TLS i zgodnością SHA-256 z manifestem; przekazuje binarne PNG do transportu. `renderSandboxSample(avatar, time, {inlineImages:true})` tworzy referencje CID; tryb domyślny z URL służy lokalnemu podglądowi w przeglądarce. Transport odrzuca obrazy zewnętrzne, brakujące/niepowiązane CID, duplikaty, nieznane nazwy i nieprawidłowe PNG. Limity: trzy pliki, 2 MB na plik, 4 MB łącznie. Nie zapisuje się grafik ani klucza w repo. Awatary mają obecnie 1,35–1,49 MB; przed masową wysyłką należy przygotować lżejsze zatwierdzone zasoby, zachowując oba warianty i testy odbioru.

Adapter zwraca `accepted`, `rejected` lub `unknown`. `accepted` oznacza przyjęcie przez API, nie doręczenie. Po timeout/429/5xx/niepoprawnej odpowiedzi nie ponawia automatycznie: pierwsza próba mogła już zostać przyjęta. Operator sprawdza zdarzenia Mailgun. Nie zapisuje się treści kodów, kluczy ani surowych błędów dostawcy. Nie dodawać kodów lub prywatnego profilu do tagów/metryk.

## Powtórzenie testu

1. Odświeżyć `origin/main`, potwierdzić profil i izolowaną gałąź; przeprowadzić preflight i właściwy PMOS begin przed mutacją. Zachować bieżące ustawienia dostawców.
2. Uruchomić lint, typecheck, build i testy `apps/identity-runtime`. Klucz dostarczyć z chronionego środowiska procesu; nigdy jako argument CLI, plik w repo ani komunikat logu.
3. Odczytać `GET /v5/sandbox/auth_recipients`; na liście operatora umieścić wyłącznie jawnie uzgodnione i aktywowane adresy. Nazwa sandboxa i region są konfiguracją, nie ID użytkownika/organizacji.
4. Złożyć `createMailgunSandboxSender` i `createSandboxDispatcher` z `renderSandboxSample(..., {inlineImages:true})`, dołączając zweryfikowane PNG z manifestu jako `inline: [{filename,bytes}]` i zachowując stały czas renderowania dla jednej próbki. Przed wysyłką zapisać lokalną intencję `wx` z ID próbki, wariantem i adresatem, bez klucza/treści. Zachować ją również po wyniku niepewnym. Nie wznawiać automatycznie po restarcie.
5. Wysłać po jednej próbce male/female. Zachować tylko bezpieczny receipt z provider ID/status. Potwierdzić `delivered` w zdarzeniach Mailgun. Wygląd i położenie w folderze inbox/spam sprawdza odbiorca; status SMTP nie potwierdza tych dwóch kwestii.
6. Po teście zatrzymać proces. Nie wyłączać Clerk i nie wdrażać runtime tylko po to, żeby uruchomić próbki.

## Warunki pełnego uruchomienia — odrębny etap

1. Zweryfikowana domena nadawcza (DNS/SPF/DKIM i uzgodniona polityka DMARC), właściwy region, monitoring dostarczania i klucz o ograniczonym zakresie w menedżerze sekretów.
2. Weryfikacja podpisu `email.created` oficjalnym SDK, dokładnego `instance_id`, zamkniętych slugów, czasów i odbiorcy pochodzącego z podpisanego zdarzenia. Żaden publiczny endpoint nie przyjmuje dowolnego `to`, HTML, kodu lub gotowego kontekstu uprawnień.
3. Istniejące konto: jawnie przyjęta operacja E1 dla ograniczonego SERVICE, wiązanie tożsamości Clerk do wewnętrznego konta oraz minimalna projekcja preferencji. Nie udawać aktora HUMAN ani używać adresu e-mail do łączenia prywatnych kont. Obecny profil pozostaje w `platform_private`, `profitia_profile.user_profiles.avatar_sex`.
4. Pierwsza rejestracja: wybór istnieje w `SignUp.unsafeMetadata` przed `prepareEmailAddressVerification`. Nie wystarcza to do korelacji zdarzenia mailowego. Trzeba udowodnić wiązanie konkretnej próby rejestracji i identyfikatora dostawcy ze zdarzeniem. Przykład schematu `email.created` i `EmailJSON` nie zawiera `sign_up_id`; sam adres lub „ostatni wybór dla tego adresu” nie jest wiarygodnym powiązaniem. Niejednoznaczność daje neutralny wariant, nigdy awatar innej próby. To nadal otwarta bramka integracji.
5. Zaproszenie przed wyborem awatara: neutralne; po znanym wyborze: wyłącznie zgodna z E1 minimalna projekcja. Nie rozpoznawać płci po imieniu.
6. Trwała idempotencja, kolejka/outbox, obsługa kolejności, replay, niejednoznacznej odpowiedzi dostawcy, wygaśnięcia kodu i awarii. Nie deklarować exactly-once na podstawie pamięci procesu. Wrażliwe kody/linki nie mogą trafiać do zwykłych logów, PMOS ani niezaszyfrowanego rejestru.
7. Testy prawdziwego pierwszego OTP, logowania, weryfikacji e-maila, zaproszeń, male/female/neutral, dwóch równoległych kont, resend, wygaśnięcia i awarii. Osobno potwierdzić, że kod wydany przez Clerk nadal weryfikuje Clerk.
8. Przed każdym deploymentem: LKG z zachowanym artefaktem i digestem, SHA, wersją konfiguracji, stanem migracji i wykonalnym rollbackiem; dla zmian danych odwracalny snapshot/branch i próba odtworzenia. Dopiero po tym kontrolowane przełączenie `Delivered by Clerk`, z mechanizmem zapobiegającym podwójnej wysyłce.

## Rollback tego etapu

Nie zmieniono działającego wydania ani schematu bazy. Zatrzymanie operatora kończy testy; nadane uprawnienie odbiorcy sandbox można później usunąć osobną zatwierdzoną operacją. Nie da się wycofać już dostarczonej wiadomości. Kod pozostaje na izolowanej gałęzi do przeglądu. Nie ma potrzeby odtwarzania bazy ani przełączania Clerk.

## Źródła

- [Mailgun sandbox](https://documentation.mailgun.com/docs/mailgun/user-manual/domains/domains-sandbox)
- [Mailgun Messages API](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages)
- [Mailgun obrazy inline i CID](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-attachments)
- [Clerk własna wysyłka](https://clerk.com/docs/guides/development/troubleshooting/email-deliverability)
- [Clerk webhooks](https://clerk.com/docs/guides/development/webhooks/overview)
- `@clerk/backend` 3.25.0: typy `EmailJSON`, `SignUpJSON`; panel Development i API Mailgun sprawdzone 23.10.2026.

## Rozszerzenie 24.10.2026: przygotowany runtime Clerk → Mailgun

Zadanie `ARCHITECTURE-MAILGUN-CLERK-INTEGRATION-20261024`, profil ARCHITECTURE,
status **PREPARED_NOT_INSTALLED**. Powyższy opis sandboxa jest zapisem wcześniejszego
etapu. Nowy kod nie został uruchomiony na Render ani zainstalowany w Neon. Nie
przełączono szablonów Clerk. Uzgodnione punkty 2–4 obejmują kod, testy i pakiet
uruchomienia; późniejsze rozszerzenie obejmuje potwierdzenie własnej domeny.

### Przygotowane zachowanie

1. Oficjalne SDK Clerk sprawdza podpis dokładnych bajtów `email.created`, instancję,
   czas, typ szablonu i odbiorcę. Zdarzenie dostarczone przez Clerk jest ignorowane.
   HTTP 204 następuje dopiero po trwałym zapisie albo rozpoznaniu duplikatu. Błąd
   bazy daje 503. Endpoint jest nieobecny przy wyłączonej integracji.
2. Zaszyfrowany outbox AES-256-GCM wiąże dane z instancją i ID wiadomości. Kolejka,
   leasing i wynik są trwałe. Jedna wiadomość ma najwyżej jedną automatyczną próbę
   wysłania. Awaria po rozpoczęciu próby daje `unknown`, a nie ponowną wysyłkę.
   Ponawiana może być tylko weryfikacja przed wysłaniem. Przyjęcie przez Mailgun
   nie jest dowodem doręczenia do skrzynki.
3. Preferencja awatara jest odczytywana przez jawny, ograniczony grant SERVICE
   `IDENTITY-EMAIL-1`. Wymagane są podpisane `user_id`, zgodny aktualny użytkownik
   Clerk, jego `email_address_id` i adres oraz aktywne powiązanie z kontem w bazie.
   Projekcja zwraca wyłącznie `male`, `female` albo `neutral`; nie tworzy sesji,
   członkostwa ani uprawnień. Wygasła sesja człowieka nie jest odnawiana.
4. **Pierwsze OTP rejestracji nadal wymaga dowodu korelacji z konkretną próbą.**
   Samo `unsafeMetadata` albo adres e-mail nie wystarczą. W razie braku dowodu
   wysyłana jest wersja neutralna. To nie jest zakończona personalizacja pierwszego
   maila rejestracyjnego. Wspólny slug `verification_code` dostaje neutralny tytuł
   „Kod weryfikacyjny”; nie zgadujemy, czy trwa rejestracja czy logowanie.
5. Zaproszenia są domyślnie wyłączone. Parser `invitation` i dokładne originy HTTPS
   są przygotowane i przetestowane syntetycznie. Przed włączeniem konieczne jest
   potwierdzenie rzeczywistego podpisanego payloadu Clerk, w tym `action_url` i
   `invitation.expires_in_days`. Kod/token/link pozostają własnością Clerk.
6. Cztery zatwierdzone PNG mają kontrolę SHA-256 i limit rozmiaru. Są pobierane do
   pamięci z zamkniętego katalogu, osadzane przez CID; nie trafiają do repo ani
   logów. OTP, link, adres odbiorcy i treść nie trafiają do audytu/PMOS.

### Ścisłe wiązanie i konfiguracja przyszłego uruchomienia

Docelowe zasoby: Identity Development `srv-dbcse6jrjlhs73eib3sg`; Neon projekt
`spring-bread-28217539`, branch `br-sparkling-term-b99l107x`, baza `platform_private`,
zwykła rola `identity_b1_runtime`. Nie używać roli administracyjnej w runtime.
Mailgun: własna domena `spendguru.app`, region EU. Stan domeny 24.10.2026:
`active`, SPF/DKIM/CNAME `valid`; publiczny DMARC `p=quarantine`, `pct=100`,
wyrównanie `adkim=r`, `aspf=r`. Zachowano delegowany łańcuch SPF GoDaddy.
Rekordów MX Mailgun nie dodano: odbiór poczty nie jest zakresem tej integracji.

Nowe ustawienia pozostają **niezainstalowane**:

- `IDENTITY_EMAIL_ENABLED=false` albo brak zmiennej utrzymuje dotychczasowy proces.
- `IDENTITY_EMAIL_CONFIGURATION`: zamknięty JSON zawierający dokładnie
  `instanceId`, `serviceId`, `schemaDigest`, `keyId`, `region`, `domain`, `from`,
  `senderName`, `appName`, `authorizedRecipients`, `allowedInvitationOrigins`.
  `schemaDigest` jest SHA-256 dokładnych bajtów migracji 003. Nadawca musi należeć
  do skonfigurowanej własnej domeny. Originy zaproszeń początkowo puste.
- `CLERK_EMAIL_SIGNING_SECRET`: sekret jednego dedykowanego endpointu Development.
- `MAILGUN_SENDING_KEY`: klucz wyłącznie wysyłki dla właściwej domeny, nie klucz
  administracyjny konta przekazany do diagnozy.
- `IDENTITY_EMAIL_PROOF_KEY` i `IDENTITY_EMAIL_ENCRYPTION_KEY`: dwa różne losowe
  klucze po 32 bajty, zapis szesnastkowy; `keyId` wskazuje wersję. Nie rotować
  szyfrowania nad aktywną kolejką bez kontrolowanego opróżnienia.

Transport ma listę 1–5 jawnie uprawnionych odbiorców pilota i limit prób w bazie
(domyślnie 60/h), maksymalnie 1000 oczekujących wpisów. **Nie wolno wyłączyć
globalnego `Delivered by Clerk` na współdzielonej instancji, jeśli pozostali
użytkownicy nie zostaliby obsłużeni.** Test takiej konfiguracji wymaga wydzielonej
instancji lub potwierdzenia, że wszyscy użytkownicy tej instancji mieszczą się
w uzgodnionym zakresie. Rozszerzenie odbiorców wymaga osobnego kontrolowanego
uruchomienia, nie usunięcia blokady w ciemno.

### Kolejność uruchomienia po odrębnym dopuszczeniu deploymentu

1. Odświeżyć authority, powtórzyć governance/routing/code-state i PMOS begin.
   Potwierdzić cały zestaw zasobów i brak kolizji z pracą równoległą.
2. Utworzyć **zweryfikowany LKG**: działający SHA, deployment/artifact ID, digest
   zachowanego artefaktu, wersja konfiguracji i stan migracji; zapisać procedurę
   przywrócenia. Dotychczasowy odczyt Render nie zastępuje pomiaru artefaktu.
3. Zrobić prywatny branch/snapshot Neon. Na nim wykonać migrację 003 jako istniejący
   ograniczony `profitia_access_owner`, w transakcji z niezależną weryfikacją
   digestów bazowych instalacji, właścicieli i FORCE RLS. Migracja nie daje grantów.
   Zapisać dokładny digest 003 do `email_installation`. Dodać politykę dokładnej
   roli/instancji/SERVICE z `enabled=false`, osobnym kluczem dowodu i budżetami.
   Jawnie nadać runtime tylko EXECUTE na `email_descriptor()` i
   `email_command(text,bigint,text)`; żadnego dostępu do tabel.
4. Na izolowanym branchu sprawdzić readback/granty, negatywne przypadki, profil,
   rejestrację i rollback do poprzedniego wydania przy pozostawionej migracji 003.
   Potwierdzić odtwarzalność snapshotu. Dopiero wtedy rozważyć identyczną instalację
   Development i deployment wyłączonego runtime. Nie kopiować połączenia z brancha
   testowego do działającej usługi.
5. Osobny etap aktywacji: ograniczony klucz Mailgun, właściwy webhook/signing secret,
   polityka włączona, konfiguracja i readiness. Sprawdzić realny format zdarzeń oraz
   zakres odbiorców przed wyłączeniem dostarczania Clerk dla obsługiwanych slugów.
   Globalna zmiana szablonu nie jest przełącznikiem per użytkownik.
6. Realne E2E: Clerk wydaje i weryfikuje kod; Mailgun dostarcza. Potwierdzić oba
   awatary, neutralny brak preferencji, resend, wygaśnięcie, równoległe konta,
   zaproszenie, awarię i odczyt grafiki w Office 365 oraz home.pl. Nie przedstawiać
   testów syntetycznych ani przyjęcia przez API jako odbioru wiadomości.

### Zatrzymanie i odzyskiwanie

Wyłączyć przyjmowanie nowych zdarzeń i politykę email, zatrzymać worker, ustalić
stan wpisów `sending/unknown` w Mailgun przed ręczną akcją. Przywrócić właściciela
wysyłki po stronie Clerk; stare zdarzenia z `delivered_by_clerk=false` nie mogą być
ponownie opróżnione przez Mailgun po przywróceniu Clerk. W razie potrzeby odtworzyć
zweryfikowany LKG aplikacji/konfiguracji. Zachować addytywne tabele 003 i ślady
deduplikacji, nie wykonywać automatycznego destrukcyjnego down-migration. Wysłanej
wiadomości nie da się cofnąć. Szyfrogramy terminalnych wiadomości są usuwane od
razu; wygasłe po następnym uruchomieniu sweepa. W czasie przerwy workera mogą
pozostać zaszyfrowane dłużej niż 5 minut, bez prawa do wysłania. Tombstone 7 dni,
minimalny audyt 30 dni, sprzątanie przy pracy workera. Operacyjne ponowienie
niepewnej wysyłki wymaga diagnozy, nie automatycznego retry.

Dowody i granice: `Canon/evidence/2026-10-24-mailgun-clerk-integration.md`.
