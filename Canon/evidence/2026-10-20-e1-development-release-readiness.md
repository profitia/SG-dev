# E1 Development — punkt odniesienia przed wydaniem, 20.10.2026

Status: DATED_READ_ONLY_RELEASE_READINESS_BASELINE / E1 IN_PROGRESS. Profil ARCHITECTURE, zadanie ARCHITECTURE-E1-DEVELOPMENT-RELEASE-READINESS-20261020, TARGET_ENVIRONMENT=development. Authority profitia/SG-dev/main: 05a7d705e1aeeae04465e59b371ea0cd5a0d4c06. To odczyt i dokumentacja, bez aktywacji produktu. [Zapis maszynowy](../registries/e1-development-release-readiness-2026-10-20.json).

## Kod przyjęty i sprawdzony

PR560, PR561 i PR562 zostały przyjęte na main 20.10.2026 o 07:40:13 UTC. Pełne drzewo main odpowiada sprawdzonemu kandydatowi c3c261f704e50b1960de156f2e16881eb868c0d6. Kontrolowany odbiór producenta ARCHITECTURE i odbiorców SG2/SRM ma osobne zadania, bramki i PMOS. Niezależnie zweryfikowano zamknięcie 14 zadań źródłowych w ich bazach, integralność archiwum, publikację PHR na zdalnym authority oraz zwolnienie pending slot i blokad. MEMOROS dostarczono dla SG2; dla ARCHITECTURE i SRM pozostaje wyłączony przez profil.

Rzeczywisty CI main 39388041373 zakończył się powodzeniem: kontrakt/laboratorium 1089 testów, governance/workspace 62, SG2 Runtime 698, Dashboard 332 i SRM operation-context 305; odpowiednie kontrole typów oraz buildy przeszły. Odrębne SRM CI 39388041365, Maps 39388041525 i governance 39388041331 także przeszły. Zweryfikowano źródłowe artefakty dowodowe SG2, Dashboard i SRM z dokładnym SHA main. Te dowody dotyczą kodu i testów izolowanych, nie tożsamości rzeczywistego użytkownika ani wydania.

Sześć wejść Findera SG2 i dziewięć wejść dostawcy SRM korzysta w kodzie ze wspólnego kontraktu platform1.23. Nie wynika z tego, że wszystkie funkcje E1 lub późniejszego SaaS są wdrożone. Izolowane testy SQL/HTTP nie są testami aktualnej konfiguracji usług.

## Rzeczywisty stan bazy

Odczyt właściciela neondb_owner 20.10.2026 o 07:44:09.928 UTC: projekt spring-bread-28217539, gałąź br-sparkling-term-b99l107x, baza platform_private. Katalog obejmuje 43 tabele w profitia_access, profitia_modules, sg_runtime_benchmarks i srm, wszystkie z właścicielem profitia_access_owner, RLS i FORCE RLS. Powiązania prywatnych aplikacji spendguru i srm nadal są DISABLED. W próbkowanym stanie brak opcjonalnych schematów wykonania zleceń/usług/Source i nowych przepływów Findera. Przed aktywacją wymagana jest kontrolowana instalacja dokładnych przyjętych wersji i odrębnych polityk; ten audyt jej nie wykonuje.

Odrębne rzeczywiste logowania zwykłych ról potwierdziły current_user = session_user oraz platform_private: SG2 Runtime 07:33:00.840 UTC, Dashboard 07:34:16.703 UTC, SRM 07:34:21.940 UTC. Każda z trzech ról nie ma SELECT do tabeli kont. SG2 Runtime bez kontekstu widzi zero wyborów; Dashboard i SRM nie mają SELECT do tabeli wyborów SG2. Pierwsze próby sprawdzenia ACL po kwalifikowanych nazwach obcego schematu otrzymały odmowę; powtórzono je przez OID bez zmiany praw. Nie przedstawia się tych błędów jako pozytywnych odczytów.

Przegląd administracyjny istniejącego market Development autumn-waterfall-65938876 / br-dry-hall-b294222f / neondb wykazał schemat profitia_market_read oraz istniejącą ograniczoną rolę sg2_market_read_development_runtime. Nie potwierdzono instalacji nowych ról Source/metadata Findera. Odczyt starego SRM Development snowy-breeze-40315151 / br-dark-surf-b1vrhda9 / neondb wykazał srm_app_runtime z LOGIN, INHERIT i brakiem limitu połączeń. Nie utożsamia się tej starej roli z nowym runtime prywatnej platformy. Nie zmieniano jej ACL, danych ani konfiguracji usług.

## Działające usługi i odzyskiwanie

Aktualny odczyt Render 20.10.2026 potwierdza wyłączony automatyczny deployment siedmiu obserwowanych usług oraz dotychczasowe wersje zapisane w JSON. Merge kodu nie uruchomił ich wydania. Odświeżony przegląd obejmował rzeczywiste listy usług, wdrożeń i gałęzi Neon; nie zastępowano odczytu zmianą daty w starszym snapshot.

Istniejący Render CLI2.25.0 potwierdził konto i właściwy workspace. Próba ograniczonego odczytu przez SSH do istniejącego SG2 Runtime zakończyła się Permission denied(publickey), zanim wykonano polecenie na usłudze. Nie dodawano klucza ani nie zmieniano dostępu. W tym audycie nie zmierzono digestu uruchomionego artefaktu, nie potwierdzono dostępności zachowanego buildu do rollbacku, zgodności poprzedniej konfiguracji ani wykonalności odzyskania. Sam identyfikator wdrożenia lub SHA nie zastępuje tych dowodów.

Dokumentacja Render potwierdza, że one-off job używa najnowszego udanego buildu oraz aktualnie zapisanej konfiguracji; nie jest automatycznie próbką historycznej konfiguracji działającej usługi. W audycie nie utworzono joba. Native rollback przywraca zachowany build zgodnie z kontraktem dostawcy; nie przywraca danych Neon. Źródła: https://render.com/docs/one-off-jobs, https://render.com/docs/rollbacks, https://render.com/docs/configure-environment-variables.

## Granice i dalsza realizacja zaakceptowanego E1

Przed kontrolowanym wydaniem pozostają odrębnie rejestrowane przygotowania: kopie i sprawdzona procedura odzyskania, właściwe opcjonalne migracje, zwykłe role i ograniczone połączenia, jawne polityki uprawnień/produktów/limitów/retencji, bezpieczna konfiguracja istniejących usług, a następnie wydanie dokładnej wersji i rzeczywiste pozytywne oraz negatywne testy. Niedostępny SSH jest brakiem dowodu tej metody, nie upoważnieniem do zmiany dostępu; możliwy bezpieczny zamiennik wymaga własnego zakresu przygotowania.

Własność dotychczasowej historii SRM pozostaje bez zmian. Nowa Profitia zaczyna z pustymi listami i historią zgodnie z decyzją właściciela; nie przenosi się historycznych działań SHARED_DEMO do Tomasza. Potwierdzenie konta w panelu Clerk nie jest rzeczywistym logowaniem do produktu ani business UAT.

Nie odczytywano prywatnych wierszy biznesowych ani wartości sekretów Render. Nie pobrano NPM_TOKEN, nie wykonano płatnego wywołania danych, migracji, zmiany danych/uprawnień/konfiguracji, tworzenia zasobu, restartu lub deploymentu. Nie badano ani nie zmieniano Staging/Production. Zapis tej datowanej obserwacji nie zamyka pełnego E1.

