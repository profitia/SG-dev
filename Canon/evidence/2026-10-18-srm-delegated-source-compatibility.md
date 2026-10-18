# SRM — kompatybilność z platform-contracts1.11, 18.10.2026

Status: SOURCE_COMPATIBILITY_CANDIDATE / LOCAL_VALIDATION_PASS / RELEASE_NOT_PERFORMED. Brak deklaracji gotowości produkcyjnego modelu kont lub zakończenia E1.

Zadanie `SRM-E1-DELEGATED-SOURCE-COMPATIBILITY-20261018`, profil SRM, workspace SG-dev Codespaces SRM, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority profitia/SG-dev/main odczytane jako `22474ca52fa5bfe13ec7a46cd9dcb2b8a4cb23f2`. Osobny begin w `srm_pmos`; MEMOROS wyłączony profilem. Producent ARCHITECTURE i natywna integracja SG2 mają osobne zadania oraz historię. Begin nie stanowi closeout.

Przyjęty producent: `ARCHITECTURE-E1-DELEGATED-EXECUTION-INGESTION-20261018`, source `0948a10c99626a6096df4c2fd1e25586ef318b72`; pakiet1.11.0, operation candidate7 i private host1.5.0. Checkpoint źródłowy SRM: `114c6ac85a0573ee6e7ed95012cb4a93c4aa1013`.

Zmieniono wyłącznie lock pakietu, bieżący manifest przyjęcia i jawne fingerprinty w istniejącym natywnym teście, a następnie niniejszy dowód. Zachowano poprzednie przyjęcia jako historię. Wersja pakietu nie przyznaje SRM uprawnień: nie włączono forecast.request, job.execute ani knowledge.ingest, nie zmieniono dotychczasowych handlerów i logiki biznesowej.

| Weryfikacja | Wynik |
| --- | --- |
| Istniejące natywne API, oficjalny adapter z syntetycznymi odpowiedziami, prawdziwy pg i zwykła rola |69/69 PASS,0 fail/skip/cancel |
| Regresje produktu, migracja finansów i separacja danych |490/490 PASS,0 fail/skip/cancel |
| Kontrole procesu promocji i odzyskiwania |311/311 PASS,0 fail/skip/cancel |
| Pełna kontrola typów |PASS |
| Rzeczywisty build Next16/React19 |PASS |

Natywne przypadki nadal sprawdzają aktualną tożsamość, organizację, użytkownika, granty, jawne odmowy, produkty, klasyfikację, eksporty, brakujące dane, awarie audytu i brak fallbacku po odmowie. Właściwe stare zachowanie SRM zostało uruchomione z dokładną nową biblioteką; samo porównanie haszy nie zastąpiło testów produktu.

Pierwsze wywołanie regresji po natywnym teście wykryło nieprawidłowe przygotowanie lokalnej bazy przez harness: oba używały nazwy srm_app, a testy produktu same ją tworzą i odmawiają przy istniejącej bazie. Nie resetowano ani nie adoptowano tej bazy i nie zmieniono testów dla uzyskania sukcesu. Poprawione uruchomienie użyło odrębnego nowego klastra z samym srm_migration_test; wszystkie490 przypadków przeszły bez pominięć. Oba klastry należały wyłącznie do tego zadania i zostały zatrzymane.

Genuine local SDK1.10 zachowano w lokalnej kopii odzyskiwania; przyjęte pliki1.11 zweryfikowano z dokładnym źródłem producenta. Nie odczytano poświadczeń Render ani prywatnego registry i nie opublikowano pakietu. Kontrolowane CI oraz zdalny main muszą stanowić osobne dowody przed finalnym closeout tego kandydata.

Nie zmieniono usług, sekretów, ról, grantów, schematów lub danych chmurowych ani żadnego wdrożenia Development/Staging. Testy procesu promocji nie są wykonanym deploymentem. Nie sprawdzono rzeczywistego OTP, zdalnego Clerk, UAT, wykonalności konkretnego wydania ani pełnej ochrony wszystkich efektów jobów. Dalszy przyjęty program E0/E1 pozostaje IN_PROGRESS.
