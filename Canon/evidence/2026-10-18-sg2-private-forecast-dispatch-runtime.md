# E1 — prywatne zlecenie Forecast i kompozycja istniejącego workera

**Status:** SOURCE_CANDIDATE / NOT_DEPLOYED. Zadanie `SG2-E1-PRIVATE-FORECAST-DISPATCH-RUNTIME-20261018`, profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority przed zmianą: `5e9c601393e8fcccc2bbec2e6f6892106b275f59`. Odrębna rejestracja PMOS i własny closeout; odbiór kodu nie jest odbiorem E1 ani wydania.

## Zakres i zachowanie

Nowa, domyślnie wyłączona kompozycja łączy istniejący handler HTTP z atomowym zapisem polecenia, limitu, delegacji i wyniku audytu. Dotychczasowy tryb samego przyjęcia pozostaje dostępny zgodnie z własną konfiguracją; nowa flaga wymaga jawnie włączonego przyjmowania zleceń. Powtórzenie tego samego żądania nie tworzy drugiej delegacji.

Dodatkowy SQL005 udostępnia wyłącznie do ośmiu identyfikatorów istniejących delegacji naraz. Nie tworzy kolejnej kolejki ani tabeli zadań. Osobny rekord instalacji opisuje wersję, źródło i ważność projekcji; obowiązują ograniczone prawa oraz FORCE RLS. Przy braku aktualnej roli technicznej, bieżącego członkostwa, produktu, delegacji lub limitu prób zlecenie nie zostaje zwrócone. Wykrycie identyfikatora nie stanowi zgody na wykonanie.

Istniejący proces Current może jawnie dołączyć ten etap przed własnym obliczeniem. Nie powstaje nowa usługa, harmonogram, silnik polityk ani algorytm. Verification nie przejmuje dostępu do prywatnych poleceń. Prywatny wykonawca oraz wspólny odbiorca kolejki mają odrębne zwykłe loginy i po dwa połączenia, niezależne od roli obliczeniowej. Konfiguracja przypina właściwe istniejące projekty, gałęzie, bazy, usługę, wersje i dostawcę tożsamości; obce hosty, role, środowiska i brakujące ustawienia powodują odmowę przed otwarciem klienta. W źródłach nie ma sekretów.

Przed każdym przekazaniem wspólny host ponownie sprawdza prawa i aktualny stan konta Clerk. Po wygaśnięciu dzierżawy zachowane zostają oryginalne zasady ponawiania i uzgadniania potwierdzeń. Limit prób nie jest automatycznie resetowany. Przesunięcie kursora po identyfikatorach zapobiega blokowaniu kolejnych stron przez odrzucone konta; kursor nie przechowuje aktora ani decyzji. Błąd przekazania nie zatrzymuje już przyjętych, niezależnie autoryzowanych obliczeń wspólnego workera. Zatrzymanie procesu nie przyjmuje kolejnej pracy, a rozpoczęte efekty podlegają istniejącym dzierżawom.

Do wspólnego źródła trafiają wyłącznie cztery pola istniejącego polecenia i techniczny klucz dostarczenia. Konto, organizacja, zleceniodawca i szczegóły sesji pozostają prywatne. Limity SOURCE_TRANSACTION opisują przyjęcia i efekty SQL; nie są rachunkiem CPU ani budżetem płatnego dostawcy.

## Dowody i granice

W nowym izolowanym lokalnym klastrze: **572/572 testy całościowe, 61/61 oryginalnych regresji biznesowych, 38/38 regresji kolejki oraz ścisła kontrola typów — PASS, bez skipów**. Zbiory częściowo się pokrywają; nie sumuje się ich jako unikalnych przypadków. Rzeczywiste Prisma i dwa magazyny potwierdzają atomowość handlera, wykrycie zlecenia bez wybierania jego prywatnego ID, zwykłe role, odmowę dla obcej bazy/roli, ważność instalacji, dryf FORCE RLS i uprawnień, bieżące odebranie członkostwa, odmowę Clerk dla dziewięciu zleceń na stronach po osiem, trwałość po awarii potwierdzenia oraz wyczerpanie limitu bez fałszywego CONFIRMED. Kontrola formatu audytu używa kanonicznej fazy DECISION z decyzją DENY; faza DENY nie istnieje.

Dowody lokalne: `/private/tmp/e1-private-dispatch-runtime-sg2-pass3-{whole,original-business,original-queue,strict}-20261018.log`. Dokładne źródło, CI kandydata i main oraz publikację PMOS/MEMOROS/PHR potwierdza osobny closeout po rzeczywistym wykonaniu. Ten dokument nie zastępuje tych dowodów.

Odpowiedzi dostawcy tożsamości w testach są kontrolowanymi odpowiedziami SDK, a nie rzeczywistym logowaniem. Nie zmieniono żywych schematów, ról, grantów, danych, sekretów, flag ani konfiguracji usług. Dotychczasowe Development i Staging zachowują artefakty. Pozostają rzeczywiste OTP/TLS, pełne osadzenie wysyłania poleceń w UI, przegląd pozostałych wejść, przygotowanie i kontrolowane wydania Development oraz Staging z wykonalnym odzyskiwaniem i odbiorem. Program E0/E1 jest kontynuowany.
