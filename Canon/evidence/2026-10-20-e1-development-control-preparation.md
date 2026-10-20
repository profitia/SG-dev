# E1 — przygotowanie wspólnej warstwy Development, 20.10.2026

Status: **SHARED_SCHEMA_PREPARATION_VERIFIED / PRODUCTS_NOT_DEPLOYED / E1_IN_PROGRESS**. Zadanie ARCHITECTURE-E1-DEVELOPMENT-CONTROL-PREPARATION-20261020, profil ARCHITECTURE, TARGET_ENVIRONMENT=development. [Zapis maszynowy](../registries/e1-development-control-preparation-2026-10-20.json). Stan obserwowany do 09:30:20 UTC. To datowany zapis przygotowania wspólnej warstwy; nie zastępuje odbioru SG2 i SRM.

## Zakres i authority

Przyjęty kod produktu: profitia/SG-dev, main 05a7d705e1aeeae04465e59b371ea0cd5a0d4c06, PR560–562. Podstawa dokumentacji przygotowania: main 760ef0a607221a66e14a1408ce285aab844ab571. Dokładne ciała SQL porównano z przyjętym commitem przed instalacją; nie zmieniano kodu migracji. Bieżące profile, routing, manifest, oddzielne rejestracje PMOS i bramki z require-begin przeszły ponowną weryfikację.

Poprzedni [punkt odniesienia przed wydaniem](2026-10-20-e1-development-release-readiness.md) pozostaje historycznie prawidłowy. Obecny dokument rejestruje późniejsze, autoryzowane przygotowanie baz. Nie utworzono projektu, repozytorium ani organizacji dostawcy. Nie badano ani nie zmieniano Staging lub Production.

## Kopie odzyskiwania i próba

| Istniejący projekt | Zachowana kopia bez endpointu | Gałąź próby odtworzona z kopii | Punkt źródłowy |
| --- | --- | --- | --- |
| spring-bread-28217539 | br-raspy-mode-b9d4x8rp | br-dark-bird-b9qw3as8 | LSN 0/24A0248 |
| autumn-waterfall-65938876 | br-delicate-butterfly-b2jeoigm | br-old-term-b2b2qi17 | LSN 1/9283D158 |

Odczyt rzeczywistych katalogów kopii potwierdził stan sprzed zmian. W prywatnej kopii początkowo było 43 kontrolowanych tabel i wyłączone aplikacje; w rynkowej kopii 18 oryginalnych tabel publicznych. Zmiany przećwiczono na tych kopiach. Niezależny odczyt dostawcy potwierdził brak endpointów kopii zapasowych oraz po jednym endpointcie próbnym: minimum i maksimum 0.25 CU, usypianie po 300 sekundach. Nie zmieniono planu organizacji Neon.

Skopiowany rekord instalacji nie dowodzi powiązania z nową gałęzią. W próbie rynkowej jawnie powiązano wyłącznie skopiowany rekord odczytu z fizyczną gałęzią próbną. Nie zmieniano tego powiązania w źródłowym Development. Nie resetowano ani nie odtwarzano działającej gałęzi i nie usuwano danych.

## Instalacja Development i niezależny odczyt

| Cel | Zakres własny ARCHITECTURE | Wynik |
| --- | --- | --- |
| spring-bread-28217539 / br-sparkling-term-b99l107x / platform_private | SQL005–007, 010–011, 013–017 | 10 zapisów instalacji odczytanych; dokładne sumy zgodne |
| Ten sam cel prywatny | SQL008–009, 012, 018 | 4 zapisy instalacji odczytane; dokładne sumy zgodne |
| autumn-waterfall-65938876 / br-dry-hall-b294222f / neondb | SQL008–009, 012, 018 | 4 zapisy instalacji odczytane; dokładne sumy zgodne |

Każdy etap wykonano w jednej sprawdzanej transakcji, z blokadą instalacji, ograniczeniem czasu i odmową przy nieoczekiwanym stanie. Tymczasowe prawa CREATE odebrano przed commit. Właściciele profitia_access_owner i profitia_ingestion_owner mają NOLOGIN, NOINHERIT, brak uprawnień administracyjnych, brak omijania RLS i brak członkostwa w innych rolach. Nie są rolami aplikacji. Zachowane administracyjne uprawnienie twórcy do zarządzania rolą nie nadaje aplikacji członkostwa ani praw właściciela.

Odczyt 09:28:43.962 UTC potwierdził zero niebezpiecznych tabel w kontrolowanej prywatnej warstwie: właściciel zgodny, RLS i FORCE RLS włączone. Obie aplikacje pozostają DISABLED; prywatna warstwa Source ma zero powiązań runtime. Brak wyborów benchmarków oraz organizacyjnych i osobistych przypisań dostawców. Porównanie 163 definicji funkcji w 19 przestrzeniach nazw wykazało dokładną zgodność kopii próbnej z przygotowanym Development. Jest to porównanie definicji funkcji, a nie dowód zgodności każdej konfiguracji lub działającej sesji produktu.

Dokładne ścieżki migracji, sumy i tabele zapisów instalacji znajdują się w JSON. Przyjęcie tych migracji nie nadaje samoistnie dostępu do produktów, nie finansuje operacji Source i nie aktywuje aplikacji.

## Dowody odbiorców i granice odpowiedzialności

SG2 i SRM prowadzą odrębne zadania SG2-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020 oraz SRM-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020. Przyjęty source SHA jest wspólną referencją; ich historia i przyszłe closeouty pozostają w właściwych PMOS. Status w tym punkcie: IN_PROGRESS / NOT_DEPLOYED. Nie kopiowano rekordów między bazami PMOS.

Na kopiach potwierdzono rzeczywiste logowanie wszystkich 11 nowych ról runtime: current_user = session_user, brak podwyższonych flag, członkostwa i prawa tworzenia obiektów. Trzy role prognoz otrzymały ograniczenia w tej samej transakcji co włączenie logowania. Kopia zawierała 148 dotychczasowych zadań, a nieuprawnione odczyty tych ról zwracały zero wierszy. Dostęp do surowych polityk został odrzucony. To dowód ograniczeń ról na kopii, nie odbiór tożsamości rzeczywistego użytkownika.

Kontrole wykryły nadmiarowe bezpośrednie uprawnienie do wewnętrznej funkcji native_admission w naszym planie ACL kopii. Deskryptor prawidłowo odmówił pracy; odebrano ten grant i oba deskryptory workerów potwierdziły kompletne ograniczenia. Nie zmieniano zaakceptowanej funkcji ani nie osłabiano kontroli. Plan instalacji odbiorcy musi zachować tę korektę.

Na Development przygotowano 11 dokładnie wskazanych nowych ról jako NOLOGIN, z ograniczeniami połączeń i bez członkostwa. Hasła i połączenia tych ról nie są częścią dokumentacji. Początkowa próba użycia API tworzenia roli w kopii nadała nieoczekiwane flagi dostawcy; dopiero po potwierdzeniu braku obiektów i sesji usunięto wyłącznie tę własną, nieużytą rolę i odtworzono ją zwykłym SQL. Stan końcowy sprawdzono niezależnie.

API nie nadawało pierwszego hasła rolom bez hasła, a Neon odrzucił wcześniej hashowane hasła. Ostateczna metoda w kopii generuje losową wartość po stronie bazy i używa zarządzanego połączenia Neon. Próba przekazania poświadczenia operatora do lokalnego procesu została odrzucona przez automatyczny przegląd i nie została wykonana. Nie zapisano ani nie wyświetlono wartości poświadczeń w kodzie lub dowodach.

## Odzyskiwanie i bezpieczeństwo istniejących aplikacji

Nieudana początkowa transakcja cofa własne DDL. Przy niepewnym wyniku wymagany jest odczyt zapisu instalacji, sum, definicji, właścicieli i polityk; nie wolno powtarzać migracji w ciemno. Po udanym dodaniu schematów zachowuje się ich dane. Nie wykonuje się automatycznie DROP, resetu ani odwrotnej migracji.

Działające produkty nadal korzystają z dotychczasowych wdrożeń i powiązań baz. Nowe aplikacje prywatne są wyłączone. Ewentualne odtworzenie danych wymaga zachowania uszkodzonej gałęzi, utworzenia sprawdzanej gałęzi odzyskiwania z zachowanej kopii, weryfikacji danych i osobnego potwierdzenia fizycznych powiązań odbiorcy. Samo przepięcie adresu na kopię jest niewystarczające.

Zadania wydania SG2 i SRM osobno odpowiadają za zachowany artefakt Render, jego digest, zgodną konfigurację i wykonalny rollback. W tym zadaniu nie wykonano rollbacku Render ani przywrócenia działającej bazy. Weryfikacja kopii danych nie zastępuje tych dowodów.

## Stan otwarty

Instalacja rynkowych odbiorców prognoz została zatrzymana przed wykonaniem przez automatyczny przegląd: zakwalifikował nowego właściciela widoków profitia_forecast_read_owner i mechanizm ograniczeń jako nieobjęte zgodą na 11 ról runtime. Wysłano konkretną prośbę o rozszerzenie zgody. Nie obchodzono odmowy. Wspólne schematy Source w tej bazie są zainstalowane; odbiorcy prognoz pozostają osobnym, nieukończonym zakresem SG2.

Przed wydaniem pozostają jawne polityki produktów, operacji, limitów i retencji, poprawne powiązania zwykłych ról, konfiguracja istniejących usług, kontrolowany rollout i rzeczywiste testy. Efemeryczne wyniki Findera mają osobny limit retencji od trwałych wyborów benchmarków i kategorii; istniejących luk fizycznego czyszczenia nie uznaje się za zamknięte.

Historia starego SRM i 41 przypisań dostawców nie została przeniesiona. Nowa Profitia zachowuje własne listy zgodnie z decyzją właściciela. Potwierdzenie konta Clerk i testy kodu nie są prawdziwą sesją produktu ani business UAT. **Pełny E1 oraz jego wydanie pozostają w toku.**
