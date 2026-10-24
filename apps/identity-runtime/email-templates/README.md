# SpendGuru PORR — szablony e-mail

## Stan bieżący — Development, 24.10.2026

**Aktywna integracja Clerk → Mailgun na Development.** Identity importuje ten
katalog i wysyła rzeczywiste kody oraz zaproszenia Clerk przez spendguru.app.
Opublikowano 12 przypiętych wersji szablonów: kod/zaproszenie × PL/EN ×
male/female/neutral. Ograniczona projekcja profilu wybiera język i awatar istniejącego
konta; pierwszy niepowiązany mail pozostaje neutralny i angielski. Clerk nadal
generuje i weryfikuje kody. Własna wysyłka Clerk dla tych dwóch slugów jest wyłączona.

Cztery kombinacje PL/EN × male/female zweryfikowano rzeczywistymi kodami w
przeglądarce i potwierdzeniami SMTP250. Nie oznacza to sprawdzenia wyglądu w skrzynce.
[Dowody i ograniczenia](../../../Canon/evidence/2026-10-24-communication-language.md),
[procedura](../../../Canon/runbooks/communication-language-development-v1.md).

Poniższe rozdziały opisują historyczne etapy przygotowania i sandboxu. Ich dawne
statusy oraz status eksportu projektowego w templates.json nie są bieżącym stanem
wdrożenia. Treści zależne od procesu rejestracja/logowanie nadal nie są aktywowane
bez wiarygodnego rozróżnienia procesu; wspólny kod używa tekstu weryfikacyjnego.

## Historia przygotowania

Pierwotny stan: **PREPARED_NOT_ACTIVATED**. Zakres obejmował mapowanie, przygotowanie
plików i rozpoznanie możliwości Clerk Development, bez importu przez runtime.

### Aktualizacja: testy Mailgun, 23–24.10.2026

Użytkownik wybrał zakres „Na razie testy w sandboxie; przygotuj integrację male/female”. Dodano adapter testowej wysyłki oraz czyste funkcje `renderResolved` i `renderSandboxSample`. Adapter jest uruchamiany przez operatora, poza działającym HTTP Identity. `renderResolved` bezpiecznie podstawia dane i dopuszcza link zaproszenia wyłącznie z jawnej listy zaufanych originów. `renderSandboxSample` dodaje widoczne oznaczenie testu i kod **000000**, który nie jest kodem Clerk i nie umożliwia logowania.

Wysyłka próbki pozwala sprawdzić rzeczywisty transport i obie grafiki. Nie dowodzi automatycznego odczytu preferencji z Neon ani personalizacji pierwszego kodu rejestracyjnego. W Clerk Development działa obecnie wspólny graficzny szablon OTP, z zachowaniem `Delivered by Clerk`. Poniższy opis pierwotnego rozpoznania i natywnych wariantów warunkowych pozostaje historycznym materiałem projektowym; nie jest instrukcją ich aktywacji. Bieżący zakres, ograniczenia i droga do pełnej integracji: [runbook Mailgun](../../../Canon/runbooks/mailgun-avatar-delivery-development-v1.md).

Po zgłoszeniu przez odbiorcę zaślepek zamiast obrazów wprowadzono tryb `inlineImages:true` dla próbek Mailgun: oba logotypy i wybrany awatar są dołączane do maila jako PNG z odwołaniami CID. `inlineAssetsForAvatar` wyznacza pliki, ich adresy i hashe; pobranie oraz sprawdzenie hashy należy do operatora. Transport wymaga kompletnego powiązania CID i odmawia wysłania maila odwołującego się do zewnętrznych obrazów. Natywne eksporty Clerk i podglądy HTML pozostają oddzielne i nadal używają URL-i.

## Co zawiera pakiet

Pięć rodzajów treści × trzy warianty wyglądu: `male`, `female`, `neutral` (15 zestawów). Dla każdego: temat, HTML tabelaryczny, źródło Revolvapp dla edytora Clerk (`.re.html`) i tekst alternatywny. Dwa dodatkowe pliki `conditional-candidate.re.html` są kandydatami do testu natywnej personalizacji; nie stanowią potwierdzonej integracji.

Wariant awatara oznacza wygląd asystenta, **nie płeć użytkownika**. Brak preferencji oznacza neutralny znak SG. Stopka Profitia, logotypy i kolory pochodzą z zaakceptowanego projektu MagicPath „Logowanie PORR”. Zapisane identyfikatory komponentów i rewizji w `templates.json` zapewniają pochodzenie projektu. Eksport jest wersjonowaną kopią: późniejsza zmiana MagicPath wymaga świadomego ponownego eksportu oraz weryfikacji, nie aktualizuje automatycznie wiadomości Clerk.

## Mapowanie rzeczywistych procesów

| Projekt / treść | Faktyczny szablon Clerk | Warunek użycia |
| --- | --- | --- |
| Email link - Sign in - male/female | `verification_code` przy obecnym logowaniu kodem | Treść dedykowana logowaniu wymaga wiarygodnego rozróżnienia procesu. |
| Email link - Sign up - male/female | `verification_code` przy obecnej rejestracji kodem | Pierwszy kod jest wysyłany przed utworzeniem trwałego konta. |
| Email link - Verify email - male/female | `verification_code` | Nie jest to oddzielny slot szablonu kodu. |
| `verification-code-*` — wspólna treść | `verification_code` | Kandydat zgodny ze wszystkimi powyższymi zastosowaniami kodu. |
| Email link invitation - male/female | `invitation` | Zaproszenie do aplikacji; nie szablon zaproszenia do organizacji. |

W panelu Development 23.10.2026 aktywne są `Invitation` i `Verification code`. `Email link - Sign in`, `Email link - Sign up` i `Email link - Verify email` są w sekcji **Unavailable templates**; ich slugi to `magic_link_sign_in`, `magic_link_sign_up`, `magic_link_user_profile`. Nie włączać magic links tylko dla zgodności nazw makiet. Nie wklejać treści „Dokończ rejestrację” do wspólnego szablonu używanego również przy logowaniu.

## Zmienne i wynik rozpoznania Clerk

Menu zmiennych `verification_code` udostępnia: `app.domain_name`, `app.logo_image_url`, `app.name`, `app.url`, `locale,omitempty` (tak wyświetla UI), `otp_code`, `requested_at`, `requested_by`, `requested_from`, `user.email_address`, **`user.public_metadata`**.

Menu `invitation` udostępnia: `action_url`, `app.domain_name`, `app.logo_image_url`, `app.name`, `app.url`, `invitation.expires_in_days`, **`invitation.public_metadata`**, `inviter_name`.

Wnioski:

- Natywne szablony mają miejsce na preferencję z publicznych metadanych. Nie ma podstaw, aby już teraz wymagać wymiany dostawcy wysyłki.
- Zapis `avatar_sex` w Neon nie jest automatycznie zmienną Clerk. Przyszła integracja musi projektować wyłącznie wygląd asystenta do publicznych metadanych; nie kopiować prywatnego profilu, telefonu, stanowiska ani uprawnień.
- Proponowany kontrakt prezentacyjny: `assistantAvatar: { isMale: true, isFemale: false }`, analogicznie dla female; oba false dla nieznanego wyboru. Producent ma przyjmować tylko enum male/female/null i zapisywać rzeczywiste wartości boolean. Oba true dają neutralny wariant w przygotowanym warunku. Kontrakt jest propozycją do przyszłej integracji, obecnie **nie jest zapisywany** do Clerk.
- Dla kodu używany byłby `user.public_metadata.assistantAvatar`, dla zaproszenia `invitation.public_metadata.assistantAvatar`. Nie należy zakładać istnienia `user` przy pierwszym kodzie rejestracyjnym ani kopiowania `SignUp.unsafeMetadata` do kontekstu maila. Tego nie potwierdzono.
- Zaproszenie wysłane przed wyborem awatara powinno być neutralne. Nie zgadywać wyglądu po imieniu ani adresie e-mail.
- Wspólny szablon OTP używa treści bez odmiany „Przygotowałem/Przygotowałam”, więc warunek może zmieniać tylko grafikę. Oddzielne wersje tekstów pozostają dostępne w pakiecie.
- Nie wolno przełączać globalnego szablonu przed każdą wysyłką. Równoległe żądania pomieszałyby warianty użytkowników.

Próba roboczego podglądu w obecnym panelu Clerk pokazała zapisany szablon domyślny mimo zmiany niezapisanego źródła i tematu. W konsekwencji nie potwierdzono wykonania warunku przez backend Clerk. Próby odrzucono i odświeżono stronę; wysyłka `Delivered by Clerk` pozostała włączona. Obecność zmiennych w menu jest potwierdzona; pełny test male/female w rzeczywistej wysyłce pozostaje niezrealizowany. Test lokalnego Handlebars nie zastępuje tego dowodu.

## Grafiki

Eksport używa publicznych, niepodpisanych adresów HTTPS obecnych w projekcie MagicPath; każdy zawiera hash treści. Wszystkie cztery pliki zostały pobrane kontrolnie z poprawną weryfikacją TLS i potwierdzone jako PNG. Nie zawierają parametrów śledzenia ani tokenów.

Próby adresów `/porr-demo/{spendguru-email-logo,porr-logo,spendguru-avatar-male}.png` na `demo-srm-porr.spendguru.app` oraz `srm-development-runtime.onrender.com` zwróciły 404. Samo istnienie plików w repo nie dowodzi ich publikacji. Żeński awatar nie występuje w obecnym `apps/srm/public/porr-demo`. Nie wdrażano SRM w celu naprawy hostingu.

Przed aktywacją mailingu warto opublikować zoptymalizowane wersje obu awatarów na zarządzanym hostingu grafik. Oryginały 1254×1254 mają około 1,3–1,5 MB; są poprawne w podglądzie, lecz za ciężkie jak na docelowe wiadomości. Zmianę domeny/zasobów należy wykonać przez właściciela tego hostingu. Nie używać adresu GitHub `/upload/` ani adresów wymagających sesji. Sam kod, CTA, treść i stopka pozostają czytelne również po zablokowaniu obrazów przez klienta pocztowego.

## Użycie i granice

Z katalogu głównego repozytorium:

```sh
node apps/identity-runtime/email-templates/render.mjs /absolute/path/to/NEW-directory
node --test apps/identity-runtime/test/email-templates.test.mjs
```

Generator odmawia zastąpienia istniejącego katalogu. Nie ma opcji `send`, połączenia z bazą ani kluczy Clerk. Wszystkie `{{otp_code}}`, `{{action_url}}`, `{{requested_from}}`, `{{requested_at}}`, `{{invitation.expires_in_days}}`, `{{current_year}}`, `{{app.name}}` zostają zachowane. Przykładowe kody można wstawiać wyłącznie do osobnych podglądów, nigdy do plików przeznaczonych do importu.

Pliki `.re.html` przeznaczone są do edytora źródła Clerk. `.html` są osobnymi, przenośnymi wersjami tabelarycznymi; nie zakładać, że można wkleić je zamiennie do edytora Revolvapp. Nie publikować `conditional-candidate` przed testem rzeczywistego kontekstu. Nie zastępować istniejących mailingów na podstawie samego podglądu przeglądarkowego. Zachować wysyłkę, mechanizm kodów, ważność i weryfikację po stronie Clerk.

## Następny etap aktywacji (poza tym pakietem)

1. Potwierdzić kontekst szablonu na kontrolowanych przypadkach: istniejące konto male, female, bez preferencji; pierwsza rejestracja; zaproszenie przed rejestracją i po znanym wyborze; ponowna wysyłka oraz równoległe konta.
2. Jeśli natywne metadane wystarczą, wdrożyć małą projekcję preferencji z konta do Clerk, z retry i ochroną przed nadpisaniem nowszego wyboru. Zachować E1 ACCOUNT_PRIVATE i serwerowo wyznaczone konto; bez nowych grantów czy przypisania organizacji. Publiczna projekcja nie jest źródłem uprawnień ani źródłem prawdy profilu.
3. Jeżeli wymagany jest spersonalizowany **pierwszy OTP** i Clerk nie udostępnia wiarygodnego kontekstu przed rejestracją, przetestować odrębny mechanizm korelacji/wysyłki. Dopiero wtedy rozważać `email.created` i własny sender. Nie wystarczy odczyt `user_id`, który może jeszcze nie istnieć. Wymagane: weryfikacja podpisu, deduplikacja, bounded retry, bezpieczne dane kodów/linków, wygaśnięcie, ochrona przed wyciekiem między kontami i sprawdzony fallback.
4. Przed aktywacją zachować wszystkie aktualne treści, tematy, nadawcę, flagi dostarczania i ich hashe; sprawdzić rollback. Przetestować rzeczywiste Gmail/Outlook, desktop/mobile, obrazy wyłączone, dostępność i działanie kodu/linku. Testy przesłania wiadomości wymagają jawnie ustalonego adresata.

## Źródła

- [Clerk — Email and SMS templates](https://clerk.com/docs/guides/customizing-clerk/email-sms-templates)
- [Clerk — delivery](https://clerk.com/docs/guides/development/troubleshooting/email-deliverability)
- [Clerk — metadata](https://clerk.com/docs/guides/users/extending)
- [Revolvapp — syntax](https://imperavi.com/legacy/revolvapp/docs/syntax/tags)
- Odczyt panelu Development, projektu MagicPath i przypiętego SDK `@clerk/backend` 3.25.0 z 23.10.2026. Panel i SDK używają nazwy zdarzenia `email.created` (liczba pojedyncza).


## Kandydat integracji Mailgun — 24.10.2026

Źródłowy wariant `email-runtime.ts` wykorzystuje `renderResolved` i dokładnie ten katalog. Przy starcie pobiera cztery zatwierdzone PNG do pamięci, sprawdza SHA-256 oraz limity i wysyła je jako MIME/CID. Nie wybiera globalnie jednego szablonu: każda wiadomość ma własny wariant z ograniczonej projekcji konta. Nie kopiuje preferencji do publicznych metadanych Clerk.

Wspólny slug `verification_code` otrzymuje neutralny procesowo tekst „Twój kod weryfikacyjny”; nie udaje rozpoznania rejestracji albo logowania. Awatar istniejącego konta może być male/female. Brak udowodnionego subjectu, w tym pierwszy mail rejestracyjny, daje SG. Szablon `invitation` jest osobno dopuszczany dokładnymi originami linku i wymaga odbioru rzeczywistego payloadu. Organizacyjne zaproszenia i pozostałe slugi nie są przejmowane.

Uruchomienie, klucze, polityka SQL i przełączenie dostarczania pozostają wyłączone; procedura i otwarte bramki są w `Canon/runbooks/mailgun-avatar-delivery-development-v1.md`. Starszy rozdział o natywnej projekcji metadanych jest historyczną alternatywą, nie bieżącym planem aktywacji.

## Communication language

PL source copy and EN catalog share the same graphic canon and CID attachments.
Runtime uses domain-scoped Mailgun templates pinned by SHA256-derived version,
with two delivered kinds (verification-code/invitation), two languages and
three avatar variants. Other process-specific copy remains authored only until
Clerk provides a verified process discriminator. Variables use t:variables and
are never Mailgun event metadata. An unmapped pre-account event uses EN/neutral.
