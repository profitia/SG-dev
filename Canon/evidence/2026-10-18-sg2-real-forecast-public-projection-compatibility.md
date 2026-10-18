# SG2 — zgodność rzeczywistych wyników Forecast z chronioną projekcją, 18.10.2026

Status: SOURCE_CANDIDATE / LOCAL_VALIDATION_PASS / RELEASE_NOT_PERFORMED. To ograniczony przyrost E1; nie zakończenie programu ani dowód działającego wydania.

Zadanie `SG2-E1-REAL-FORECAST-PRESENTATION-COMPATIBILITY-20261018`, profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority main: `1df8794c7b51c201cfab8af4c36378baa95905c5`, po PR478. Poprzedni worker ma osobny, zweryfikowany closeout PMOS/MEMOROS/PHR; bieżące zadanie ma własną rejestrację. Wspólny platform-contracts1.11.0 i producent ARCHITECTURE `0948a10c99626a6096df4c2fd1e25586ef318b72` pozostają bez zmian.

## Potwierdzone przyczyny i wynik

Rzeczywiste obliczenie oryginalnego workera wykazało problem, którego wcześniejsze ręcznie przygotowane artefakty nie ujawniały. Tożsamość przedziału zawierała daty `YYYY-MM-DD`, a SQL porównywał je z ISO zawierającym godzinę. Osobny zwykły login odczytowy przed poprawką otrzymywał NOT_AVAILABLE pomimo prawidłowo zapisanego Current. To test regresyjny rzeczywistego przepływu, nie wnioskowanie ze statusu workera lub odczytu właściciela.

Projekcja3.0.2 akceptuje dokładne ISO albo tę samą datę odpowiadającą dokładnie północy UTC. Inny dzień, godzina, historia, model, semantyka, horyzont, metoda i polityka pozostają odmową. Dopiero po potwierdzeniu równoważności dat publikowana jest kanoniczna reprezentacja ISO. Nie usuwa się dostarczonej tożsamości i nie przypisuje starego przedziału do innego wyniku. Negatywny test rzeczywiście zmienia również czas zapisanej obserwacji o godzinę; samo wspólne oznaczenie dnia nie wystarcza.

Oryginalny algorytm ARIMA implementuje już `STATSMODELS_ARIMA_FORECAST_DISTRIBUTION` z wersją `statsmodels-arima-conf-int-alpha-0.2-v1`. Brakowało go w zamkniętej projekcji Current. Dopuszczono wyłącznie tę parę, dla modelu ARIMA i źródła MODEL_NATIVE_SHORT_HISTORY. SQL i kontrakt publikacji odmawiają mieszania jej z innym modelem lub wersją. Obliczeń, współczynników, wyboru modelu i liczbowych wyników nie zmieniono.

Po przywróceniu prawidłowej gotowości test wszedł w rzeczywistą ścieżkę wcześniej omijaną przez STALE. Wygenerowane modele Prisma kwalifikowały odczyt jako publiczne tabele bazowe, pomimo ustawionego search_path. Ograniczona rola źródła prawidłowo odmawiała. Oryginalne DAO Current i Verification oraz czytnik Rolling otrzymały jawny wariant STORED_SHARED: rzeczywiste zapytania do literalnie kwalifikowanych zatwierdzonych widoków w tej samej dostarczonej transakcji. Wykorzystują dotychczasowe mapowanie, kompatybilność i reguły biznesowe. Nie przyznano SELECT do tabel bazowych, nie stworzono fasady Prisma, drugiego połączenia, zagnieżdżonego COMMIT ani awaryjnego globalnego klienta. Starsza konfiguracja, oryginalne modele i ich kompatybilność nie zmieniły zachowania.

Rzeczywisty snapshot Rolling ujawnił dodatkowo różne okna historii: oryginalny producent i kontrola gotowości stosują minimalne dopuszczone okno Current, podczas gdy endpoint odczytowy liczył hash pełnej historii. Odczyt korzysta teraz z tej samej oryginalnej funkcji wyboru okna przed obliczeniem fingerprintu. Nie poluzowano kontroli snapshotu. Verification zachowuje pełną historię. Faktyczny odczyt Current oraz FAST Verification po kalibracji potwierdzono oddzielnym zwykłym loginem. Historia bez liczbowych obserwacji daje brak danych, bez sztucznego zero lub przypadkowego błędu źródła.

## Wersje, zakres i ślad

Zwiększono wersję chronionej projekcji do3.0.2 oraz jawnie propagowano jej hash, powiązane granice oryginalnej kolejki/workera i konfigurację kandydata. Historyczne przyjęcia zachowano; `operation-integration.json` wskazuje nowy przyrost i jawne następstwo poprzednich granic. Nie jest to deklaracja ich instalacji w chmurze.

Pierwotne18 ścieżek rozszerzono po odtworzeniu błędu do21, a następnie24: oryginalne DAO i czytniki Verification/Rolling oraz ich regresje. Każde rozszerzenie poprzedził checkpoint wyłącznie własnych zmian i pełny preflight na czystej gałęzi, z tym samym właściwym profilem, środowiskiem i rzeczywistą tożsamością hosta. Wszystkie nowe ścieżki mają routing SG Runtime / ALIGNED. Nie ponawiano pmos:begin z inną treścią i nie zmieniano niezmiennej rejestracji. Zakres, powody rozszerzeń i faktyczne pliki należą do końcowego śladu tego zadania.

## Walidacja lokalna

| Dowód | Wynik |
| --- | --- |
| Pełny zestaw SG2, rzeczywiste API/SQL, role, izolacja i integracje |565/565 PASS,0 fail/skip/cancel |
| Dodatkowe istniejące Forecast Library i snapshot |61/61 PASS |
| Dodatkowe istniejące kolejka, worker i progresywne przygotowanie |38/38 PASS |
| Ścisłe typy zmienionych modułów i zależności |PASS |
| Oryginalny worker → oryginalne algorytmy → zwykły odrębny czytnik |Current naive/damped_holt/ETS/ARIMA; pełna naive Daily→Monthly Verification; Rolling Current i FAST Verification po kalibracji |

Zestawy częściowo się pokrywają; liczb nie sumuje się. Test naukowy obejmuje2191 syntetycznych dziennych obserwacji, oryginalny schemat i wygenerowane klienty Prisma oraz osobne rzeczywiste loginy Current/Verification/źródła/odczytu. Właściciel służy instalacji i kontrolowanym asercjom; nie jest dowodem zwykłego wykonania. Pierwsze poprawne odczyty sprawdzono także przed poprawką i potwierdzono oczekiwaną odmowę. Diagnostyka odróżnia tekst zapisanej daty SQL od lokalnej prezentacji Date przez sterownik; nie stwierdzono na tej podstawie zmiany czasu danych.

Negatywne scenariusze obejmują inne dni/godziny, zmieniony fingerprint/model/politykę, niezgodną parę ARIMA, nadmiarowe prywatne adnotacje oraz brakujące/błędne/root/nieznane wejście wariantu projekcji. Prywatne adnotacje pozostają poza zamkniętą odpowiedzią. Zachowano wcześniejsze próby odebrania praw, RLS, limitów, audytu, awarii po COMMIT, migracji i odzyskiwania. Liczba wywołań globalnego klienta i HTTP pozostaje0 w przepływie natywnym. Faktyczny odczyt metody nie dowodzi rzeczywistego OTP ani pełnego przeglądarkowego UAT.

Powtarzalne wejście: istniejące `npm run test:operation-context` z izolowanym SG2_OPERATION_TEST_OWNER_URL oraz wymaganymi bibliotekami Python. Nie pomijano testów naukowych. Wszystkie nowe klastry lokalne miały wcześniej nieistniejące ścieżki i po zakończeniu zostały zatrzymane. Starych klastrów i cudzej pracy nie resetowano. Dokładne digesty znajdują się w `operation-integration.json`; kontrolowane CI musi jeszcze potwierdzić pełne typy i build konkretnego opublikowanego SHA.

## Granice odbioru

Brak DDL, ról, grantów, danych, sekretów, konfiguracji, flag, zmiany usług, kosztów i deploymentu chmurowego w tym zadaniu. Nowe repozytoria/projekty nie powstały. Wcześniejsze wydania biznesowe zachowano. Nie zmieniono wspólnej macierzy dostępu ani źródeł PMOS/PHR. Brakująca proweniencja non-daily nadal nie jest dorabiana z artefaktu.

Wciąż wymagane są odrębne dowody: runtime prywatnego dispatch, status i parytet przeglądarki, rzeczywiste logowanie/TLS, kontrolowane inicjalizacje, retained-artifact LKG, wydania Development i później Staging. FAST kalibracji nie przedstawia się jako pełnej weryfikacji historycznej każdego modelu. Kontrolowane CI, normalny merge, niezależne dowody main oraz kanoniczny closeout są osobnymi krokami. E0/E1 pozostaje IN_PROGRESS po tym przyroście.
