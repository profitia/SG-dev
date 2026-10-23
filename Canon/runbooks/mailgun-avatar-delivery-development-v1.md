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
