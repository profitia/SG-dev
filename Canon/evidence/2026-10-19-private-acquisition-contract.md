# E1 — jawne zlecenia prywatne i Finder, przyrost producenta

Status: SOURCE_CANDIDATE; TARGET_ENVIRONMENT=development. Zadanie ARCHITECTURE-E1-PRIVATE-ACQUISITION-CONTRACT-20261019, profil ARCHITECTURE, workspace SG-dev Architecture. Authority początku: `14d208e7ddd3158b66245522aae05b80efd185a5`. Rejestracja PMOS `cmvfsh23x00007w0uwjfwjpvi`, w dedykowanej architecture_pmos, z rzeczywistym hostConversationId. Wykonanie lokalne; zapis zadania nie aktywuje baz produktu.

## Powód i zakres

E1 wymaga ochrony działania istniejących funkcjonalności, również przed wywołaniem dostawcy. Dotychczasowy supplier.report.refresh nie może nadawać domyślnie prawa do pobierania KYS/JDG, a knowledge.read nie upoważnia do prywatnego zapytania AI ani odczytu cudzej intencji. Dodano jawne supplier.private.refresh, benchmark.discovery.request oraz benchmark.discovery.read. Katalog1.2.0, pakiet1.22.0 i candidate.15 zachowują publiczny kontrakt1.0.0.

Rozszerzono istniejący executor, rezerwację, delegację i krótką pracę natywną; zamknięte metadane celu są wspólne dla tych adapterów. Nie dodano równoległego silnika autoryzacji, writera ani usługi. Nowe cele wymagają jawnego przyjęcia dokładnego rozszerzenia zarówno w hoście HUMAN, jak i SERVICE. Dotychczasowy host nie dziedziczy nowego celu. Role i granty nie są automatycznie rozszerzane.

Opcjonalne SQL017 rozszerza te same rejestry. Instalator musi być kontrolowanym NOLOGIN, aplikacje wyłączone, a SQL016 dokładnie potwierdzone. Potwierdzenie SQL017 jest niezmienne i chronione FORCE RLS. Instalacja nie tworzy kont, grantów, polityk produktu, usług ani aktywacji. Wykonywanie nadal wymaga aktualnego konta, tożsamości zewnętrznej, członkostwa, modułu, produktu, operacji, zakresu zasobu i niezależnego prawa wykonawcy. Krótka praca SQL ma fizyczny INTENT/OUTCOME i zobowiązanie weryfikowane przy COMMIT.

Intencja i wynik Findera pozostają osobiste w organizacji; dane rynku pozostają wspólne. Przyjęcie zlecenia zwraca tylko techniczne requestId/status. Uprawnienie pozyskania prywatnych raportów nie zastępuje późniejszego odczytu/ujawnienia/eksportu. Source i dostawca mają niezależną autoryzację oraz budżet; nie przyjmują prywatnego payloadu klienta jako wiedzy wspólnej.

## Weryfikacja lokalna

Pełny zestaw platform-contracts i architecture-lab na nowym, izolowanym PostgreSQL16: **1039/1039**, zero pominiętych i nieudanych testów; build wspólnego pakietu poprawny. Nie użyto chmurowej bazy klienta ani płatnych integracji. Test nowego rozszerzenia rzeczywiście łączy zwykłe loginy, przyjmuje zlecenie i jedną delegację, wykonuje pracę SERVICE oraz czyta osobisty wynik Findera przez rzeczywistą rolę HUMAN.

Sprawdzono brak jawnego grantu, replay i konflikt payloadu, inne organizacje i osoby, aktualne cofnięcie operacji, deaktywowane konto zewnętrzne, odczyt zwykłego loginu bez scope, bezpośrednie wstrzyknięcie zapisu, brak dostępu do instalacji, niezmienność potwierdzenia i rollback przerwanej migracji. Usługa pozostaje SERVICE, a inicjator subjectUserId; prywatny wynik nie trafia do technicznej odpowiedzi ani audytu. Dodatkowe testy jednostkowe i typów sprawdzają osobne prawa, produkty, moduły, limit, audyt, zakaz nadawania nowych celów staremu hostowi i brak prywatnej wartości zwracanej przez callback pracy.

Pierwsza pełna próba ujawniła stałe powiązanie zewnętrznej rezerwacji z supplier_report. Rezerwacja korzysta teraz z dokładnego modułu wybranej operacji; obie rzeczywiste ścieżki przeszły ponowny test. Dwa porównania bieżącej wersji w dawnych testach obsługuje osobne zadanie ARCHITECTURE-E1-PRIVATE-ACQUISITION-REGRESSION-PINS-20261019. Nie usuwano żadnych kontroli zachowania.

Indywidualny test governance źródła producenta ma **41/42**, z jawną zależnością `LOCAL_PACKAGE_VERSION_MISMATCH`: własny lock odbiorcy SG2 nadal wskazuje1.21.0. Nie obchodzono tej bramki. Przyjęcie nowego pakietu i pełna zgodność odbiorców wymagają osobno rejestrowanych zadań SG2 i SRM przed wspólnym CI i merge. Wynik producenta nie jest dowodem ich odbioru.

## Zachowanie wcześniejszego stanu

Porównanie z authority początku potwierdziło identyczne wcześniejsze33 reguły i83 przypadki, role i profile aplikacji oraz wszystkie historyczne SQL wspólnego pakietu. Nie zmieniono źródła produktów, Maps, konfiguracji środowisk, routingu, infrastruktury, sekretów, polityki kontrolowanego CI ani cykli wydań. Nowe pliki kontraktu są niezależne od Reacta i frameworka gospodarza.

## Granice odbioru

Ten dowód nie oznacza instalacji SQL017 w Neon, nadania uprawnień, uruchomienia Source, integracji HTTP/UI, ochrony wszystkich wejść ani wydania produktu. E1, Development, Staging, produkcja oraz biznesowy UAT nie są nim zamknięte. Dalsze integracje i wydanie Development mają odrębne tożsamości, bramki, LKG i testy zgodnie z aktualnym zleceniem właściciela. Staging i Production nie są objęte bieżącym wdrożeniem.

Dalszy test odbiorcy wykrył regresję pomocnika externalRequestSchemaDigest: uwzględniał dodatkowe źródło zamiast wyłącznie historycznego SQL010. Przywrócono dokładną sumę pliku, zachowując rozszerzoną sumę źródła jako osobny dowód. Nowy test sprawdza wszystkie pięć dawnych digestów schematów niezależnie od nowych zależności;29/29 przypadków skoncentrowanych i pełne1039/1039 przeszły. Niezgodny kandydat nie był scalony ani wdrożony.
