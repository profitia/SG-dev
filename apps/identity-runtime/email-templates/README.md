# SpendGuru PORR — przygotowane szablony e-mail

Stan: **PREPARED_NOT_ACTIVATED**. Zakres obejmuje mapowanie, przygotowanie plików i rozpoznanie możliwości Clerk Development. Ten katalog nie jest importowany przez runtime, nie odczytuje profili i nie wysyła wiadomości.

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
