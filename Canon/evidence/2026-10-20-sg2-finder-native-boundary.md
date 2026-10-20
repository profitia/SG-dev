# SG2 — prywatna granica zlecenia i wyniku Findera

Zadanie SG2-E1-FINDER-NATIVE-BOUNDARY-20261020. Development. Status: LOCAL_NATIVE_BOUNDARY_VERIFIED_NOT_ACTIVATED.

Przyrost wykorzystuje istniejące AM35/AM36, rezerwację Root, delegację i NativeWork z SQL017. Nie zmienia wspólnego silnika ani nie tworzy drugiego rejestru skutków. Pięć zamkniętych wariantów komendy obsługuje sześć istniejących metod HTTP: zwykłe i zaawansowane wyszukiwanie, metadane, wartości metadanych, kontekst i AI. Zlecenie oraz wynik mają jednocześnie właściciela użytkownika i organizacji. Trwały wynik jest niezmienny, ma własną wersję i ograniczenie retencji. Zapis wyboru benchmarku do organizacji pozostaje osobną operacją.

Nowy, opcjonalny SQL006 aplikacji tworzy wyłącznie instalację, komendy i wyniki. Kontrolowany właściciel NOLOGIN i wyłączona aplikacja są wymagane przy instalacji. Brak domyślnego okresu retencji; operator musi zainstalować jawną politykę przed aktywacją. Aktualny HUMAN przyjmuje zlecenie w transakcji Root i tworzy jego standardową delegację. Odrębna zwykła tożsamość SERVICE wykonuje krótkie jednostki READ/SAVE; nie przejmuje tożsamości użytkownika ani prawa do sieci. Wymagane są aktualne uprawnienia inicjatora i chroniony audyt. Świeży odczyt HUMAN wymaga dokładnego użytkownika, organizacji, wersji, bieżącego produktu i uprawnienia odczytu. Samo poprzednie przyjęcie nie daje dostępu do wyniku.

Opcjonalny SQL003 metadanych udostępnia tylko zatwierdzone aktywne dane Macrobond. Oryginalny wygenerowany ORM i istniejąca logika filtrowania/sortowania korzystają z widoków o dotychczasowych nazwach. Ograniczona rola ma jeden limit połączenia; nie może czytać tabel źródłowych, zapisywać danych ani wykonywać obcych funkcji SECURITY DEFINER. Loader weryfikuje rzeczywistą bazę, login, rolę, właściciela, obiekty, ACL, źródło i ważność instalacji. Po wygaśnięciu instalacji również SQL widoków wstrzymuje odczyt.

Weryfikacja lokalna:

- 15/15 testów komend, projekcji i selektorów, bez pominięć.
- 13/13 testów w nowych klastrach PostgreSQL16 i rzeczywistych ograniczonych rolach: atomowe przyjęcie i delegacja, trwały wynik, osobny odczyt, druga osoba i organizacja, cofnięcie praw po przyjęciu, błąd audytu, fałszywy kontekst, fizyczna zmiana FORCE RLS/TRUNCATE oraz oryginalny ORM metadanych i retencja widoków. Bez pominięć.
- Osobne sprawdzenie typów nowych modułów według ustawień TypeScript; pełne CI dokładnego kandydata pozostaje wymagane.

W czasie testów poprawiono minimalny predykat instalacji zlecenia, obsługę wyniku void kanonicznego audytu, jawne wymaganie produktu dla osobistego wyniku oraz techniczne id wymagane przez istniejący ORM. Nie osłabiono odmów ani testów. Testy wykorzystują wyłącznie nowe bazy loopback i syntetyczną odpowiedź na interfejsie SDK tożsamości; nie dowodzą rzeczywistego logowania do produktu.

Plik celów opisuje planowane role, istniejące zasoby i default-disabled. Nie potwierdza utworzenia ról, instalacji, aktywnego źródła, polityk ani deploymentu. Pozostają: rzeczywisty transport Source dla Macrobond/OpenAI, połączenie wszystkich metod HTTP i klienta, sprawdzenie prywatnej treści błędów, kontrolowany harmonogram usuwania wygasłych wyników, pełny odbiór wersji oraz wydanie Development z odzyskiwaniem i rzeczywistą sesją użytkownika. Wygaśnięcie dostępu do wyniku nie jest dowodem fizycznego usunięcia danych. E1 nadal w toku.

Dokładny kandydat 8f8a6fb45591eeb688452defc291ce5e9323b77f przeszedł [kontrolowane CI39380434094](https://github.com/profitia/SG-dev/actions/runs/39380434094):645/645 testów, bez pominięć, typecheck i build. Status tej granicy: CONTROLLED_CI_VERIFIED_NOT_ACTIVATED. Nie obejmuje późniejszego transportu Source, rzeczywistego HTTP użytkownika ani deploymentu.
