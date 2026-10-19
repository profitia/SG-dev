# E1 — kontrakt prywatnego dostępu do raportu dostawcy, 19.10.2026

Status: PRODUCER SOURCE CANDIDATE / APPLICATION ADOPTION PENDING. Profil ARCHITECTURE, workspace SG-dev Architecture, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority profitia/SG-dev/main, badany punkt wyjścia `d671b4d1293f0b2d5cc94e985cff67ff453f7832`. Zadanie `ARCHITECTURE-E1-SUPPLIER-PRIVATE-ACCESS-CONTRACT-20261019`; osobne przypięcia testowe należą do `ARCHITECTURE-E1-PRIVATE-ACCESS-REGRESSION-PINS-20261019`. Każde ma własny PMOS/PHR, MEMOROS wyłączony. Pełne E1 i wydanie Development są IN_PROGRESS.

## Przyjęty zakres źródła

Dotychczasowy odczyt raportu dostawcy przyjmuje SHARED_KNOWLEDGE, a projekcja finansowa jest operacją złożoną z odczytu wspólnego i zapisu prywatnego. Nie uprawniają one do danych osobowych KYS/JDG lub ujawnienia PESEL. W tym samym executorze dodano AM-31–AM-33: supplier.private.read, supplier.private.reveal i supplier.private.export. Rewizja katalogu1.1.0, implementacja1.0.0-candidate.14, pakiet1.21.0; wcześniejsze operacje i publiczna wersja kontraktu1.0.0 zachowują zgodność.

W ograniczonym przyroście operuje HUMAN z aktualnym członkostwem, modułem supplier_report i produktem SUPPLIER_INTELLIGENCE. Backend wybiera organizację, NIP, COMPANY/JDG, UUID snapshotu i termin retencji. Właścicielem jest organizacja; aktor nie zastępuje właściciela. Resource.version identyfikuje snapshot, więc istniejący audyt zapisuje jego tożsamość bez nowego pola z treścią osobową. Retencja jest sprawdzana przed efektem i po projekcji, przed udostępnieniem wyniku.

Reveal i eksport wymagają własnego uprawnienia oraz odczytu dokładnego prywatnego raportu wejściowego, z takim samym zakresem i retencją. Wspólny grant lub etykieta administratora nie wystarcza. Ujawnienie pełnego identyfikatora ma własny projektor; odczyt i eksport zachowują maskowanie. Rozszerzenie nie dodaje grantów do szablonów ról ani aplikacji.

## Weryfikacja i stan odbioru

149 testów samego kontraktu oraz pełny zestaw kontraktu i laboratorium993/993 przeszły bez pominięć. Pełny zestaw obejmuje rzeczywiste, dotychczasowe testy zwykłych ról PostgreSQL; nie jest dowodem adopcji nowych prywatnych tabel lub wejść SRM. Build pakietu przeszedł. Nowe testy sprawdzają obce organizacje i snapshoty, brakujące i jawnie odebrane granty, rozdzielenie service/human, moduł, produkt, niedozwolone metadane i retencję wygasającą podczas projekcji. Awaria kanonicznego OUTCOME wstrzymuje publikację.

Niezależne porównanie zachowuje wcześniejsze30 reguł,77 scenariuszy, szablony ról, profile aplikacji, wszystkie SQL i kod produktów. Root package-lock miał wcześniej metadane wersji1.14.0 przy pakiecie1.20.0; jawnie wyrównano wyłącznie wersje do1.21.0. Wpisy zależności pozostały identyczne.

Trzy osobne testy przypięć wersji/szczegółowego skrótu źródła jawnie przyjmują nowego kandydata; pozostałe asercje, wersja hosta i bazowy SQL pozostały zachowane. Pierwsze przebiegi z nieaktualnymi przypięciami są zachowane jako diagnostyka.

Governance wykonał42 testy:41 przeszło, a kontrola LOCAL_PACKAGE_VERSION_MISMATCH prawidłowo wymaga przyjęcia nowego SDK w pliku zależności SG2. Nie osłabiono walidatora. Przed akceptacją połączonej wersji wymagane są osobne zadania odbiorców SG2/SRM, zgodne pliki zależności i odciski, pełne zielone governance/CI oraz niezależnie zweryfikowane artefakty dokładnego kandydata i main. Sam zapis tego dokumentu nie deklaruje ich wykonania.

## Granice

Producent nie wdraża prywatnego cache KYS, rozszerzonego SQL/ACL/RLS, klientów dostawców, nowych wejść API, PESEL/PDF ani UI. Projektory aplikacji, rzeczywiste role i chronione ścieżki wymagają własnej adopcji oraz testów. Nie nadano użytkownikom lub usługom nowych praw i nie wykonano zmian baz chmurowych, danych, konfiguracji, sekretów, zasobów lub deploymentu. Nie przyjęto usługowego dostępu do danych osób przez nowy odczyt HUMAN. Maps, Staging, Production i E2–E4 pozostają poza tym zadaniem.
