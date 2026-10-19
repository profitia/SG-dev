# E1 Development — rzeczywisty stan przygotowania bazy, 19.10.2026

Status: DATED READ-ONLY BASELINE / E1 IN_PROGRESS. Zadanie `ARCHITECTURE-E1-DEVELOPMENT-PREPARATION-READBACK-20261019`, profil ARCHITECTURE, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority: `profitia/SG-dev/main`, source `505a23800fbd8a74f40a5a1e1947f3b2a62093bc`. Własny PMOS/PHR; MEMOROS wyłączony. Ten odczyt nie aktywuje aplikacji ani nie odbiera wydania.

## Potwierdzone fakty

Odczyt SQL wykonano 19.10.2026 od 18:03:49 do 18:06:23 UTC w istniejącym projekcie `spring-bread-28217539`, gałęzi `br-sparkling-term-b99l107x`, bazie `platform_private`. Rzeczywisty current_database oraz metadane instalacji potwierdzają ten cel. Nie pobierano ani nie eksportowano connection stringów lub sekretów. [Maszynowy zapis](../registries/e1-development-preparation-readback-2026-10-19.json) zachowuje daty, odrębne role, ACL i granice dowodów.

Odrębny odczyt właściciela `neondb_owner` potwierdził 43 tabele z właścicielem `profitia_access_owner`, RLS i FORCE RLS. Rola właściciela schematów nie ma LOGIN, SUPERUSER, BYPASSRLS, INHERIT, CREATEDB, CREATEROLE ani REPLICATION. Zapisano rzeczywiste wersje i hasze instalacji dostępu, modułów, audytu i katalogu kont. W katalogu wewnętrznym istnieje po jednym koncie, organizacji i potwierdzeniu bootstrap. Nie odczytywano ich danych osobowych ani zasobów biznesowych; same liczniki nie są ponownym potwierdzeniem tożsamości konkretnej osoby.

Dla każdej z trzech ról wykonano rzeczywiste logowanie. current_user i session_user odpowiadają roli docelowej:

| Rola | Potwierdzony zakres próbki ACL |
| --- | --- |
| sg2_private_development_runtime | SELECT/INSERT/UPDATE wyborów benchmarków; brak dostępu do tabeli kont i snapshotów SRM |
| sg2_private_development_dashboard | Brak bezpośredniego dostępu do próbkowanych tabel kont, wyborów i snapshotów |
| srm_private_development_runtime | SELECT snapshotów SRM; brak dostępu do tabeli kont i wyborów SpendGuru |

Wszystkie trzy role mają wyłączone SUPERUSER, BYPASSRLS, INHERIT, CREATEDB i CREATEROLE, nie są członkami właściciela i nie mają CREATE w próbkowanych schematach. Prawa tabelowe nie zastępują aktualnego kontekstu i RLS. Bez kontekstu zwykły Runtime SpendGuru widzi zero wyborów, a zwykły Runtime SRM — zero snapshotów. Dashboard otrzymuje rzeczywistą odmowę SELECT z tabeli kont. Pierwsza próba przeglądu ACL po kwalifikowanych nazwach tabel zatrzymała się na obcych schematach; powtórzono ją przez OID katalogu bez nadania dodatkowych praw. Nie liczono tych błędów jako pozytywnego odczytu.

## Stan aktywacji i luka wobec przyjętego kodu

Rekordy nowych prywatnych aplikacji `spendguru` i `srm` nadal mają stan DISABLED. To stan tych powiązań w bazie, nie wyłączenie działających dotąd usług biznesowych. Nie odczytywano wartości zmiennych środowiskowych Render.

Obecne są cztery rodzaje początkowych grantów ALLOW: benchmark.selection.read/write i supplier.report.read/project. Nie potwierdzono nimi prawa do zewnętrznego odświeżania, eksportu lub wszystkich pozostałych funkcji. Próbkowane opcjonalne schematy kategorii, requestów, usług, jobów, Source, kontroli zewnętrznych wywołań i natywnej pracy nie są zainstalowane w tej bazie. Złożone przepływy przyjęte w kodzie i testach izolowanych nie są z tego powodu aktywnym przepływem tej bazy. Odczyt nie rozszerza grantów i nie uruchamia migracji.

## Granice dowodu

Przegląd metadanych i odmowy bez kontekstu potwierdzają przygotowanie oraz granice próbkowanych ról. Nie zastępują pozytywnych operacji autoryzowanej organizacji, pełnych testów separacji wszystkich wejść, rzeczywistego logowania użytkownika, kontrolowanego uruchomienia zwykłych ról, wydania lub sprawdzonego odzyskania. Nie testowano tu zapisu, nie nadawano uprawnień i nie wykonywano prób mutacji danych.

Nie odczytywano prywatnych wierszy biznesowych, adresów e-mail, oryginałów źródeł, ustawień ani poświadczeń. Nie zmieniono schematów, danych, ról, grantów, konfiguracji, zasobów, dostawców ani wdrożeń. Nie badano SQL Staging lub Production. Istniejąca własność historii demo pozostaje polityką osobnego odbioru; ten audyt jej nie przenosi ani nie przedstawia starszych obserwacji jako nowego dowodu. Pełne E1 i wdrożenie Development pozostają IN_PROGRESS.
