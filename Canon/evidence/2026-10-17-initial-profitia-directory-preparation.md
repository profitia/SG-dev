# Prywatny katalog i konto startowe Profitia — 17.10.2026

Status: PREPARED_NOT_ACTIVATED. Jest to odbiór przygotowania katalogu, a nie pełnego E1, rzeczywistego logowania lub wdrożenia produktów.

Zadanie `ARCHITECTURE-E1-INITIAL-DIRECTORY-PREPARATION-20261017`; ARCHITECTURE, Development, workspace SG-dev Architecture, wykonanie lokalne. Authority `profitia/SG-dev/main`. Właściciel odrębnie wybrał organizację wewnętrzną **Profitia**. Nie utworzono nowej organizacji kont GitHub, Render, Neon ani Clerk.

## Źródło i kontrole

SQL004, README i rzeczywiste testy katalogu zostały opublikowane przez PR #416; osobne zadanie SG2 `SG2-E1-INITIAL-DIRECTORY-COMPATIBILITY-20261017` iPR417 potwierdzają kompatybilność. Producent source `521efc36f2861352b284835a4cc53fe92cd9e076`; skoordynowane source `b28bb48286540f596849d0fcf26a00c04e4bd18b`; merge `6d2518406dabdb9424c2b3435c19f6a8f1e8b6eb`. Istniejące fingerprinty executora, tożsamości, store i hosta nie zmieniły się.

287 testów producenta/laboratorium i 33 governance: PASS, zero pominięć. W tym 11 nowych testów realnego PostgreSQL obejmuje ordinary login, brak implicit grantów, walidację referencji i nazw, rollback, odporność receiptu na zmianę/usunięcie, wymuszony operator/czas i zachowanie historii po odwołaniu powiązania. Wspólna blokada przygotowania testowych ról usuwa wyścig dwóch fixture w jednym klastrze.

Kontrolowany main-only CI `39027792185`: SUCCESS, clean registry install zatwierdzonych prywatnych pinów, credential usunięty przed kodem, 38 testów SG2 oraz typecheck/build PASS. Platform CI `39027754808` i39027757182 attempt2: SUCCESS; SRM wykonał 32 istniejące testy API/SQL. Pierwotna odmowa SG2 wynikała wyłącznie z braku exact-source proof i została rozstrzygnięta przez wymagany kontrolowany test, bez obejścia bramki. Pełny workflow wydania SRM nie był uruchamiany; jego filtr nie obejmuje samodzielnej zmiany tego opcjonalnego schematu.

## Potwierdzone działania

- Oficjalny Clerk backend 3.25.0 potwierdził wskazaną instancję, dokładny subject, zweryfikowany primary e-mail oraz brak banned/locked. Klucz pobrano z jednej nazwanej usługi Development i użyto wyłącznie w pamięci. Nie tworzono sesji ani nie modyfikowano Clerk. Bezpośredni odczyt HTTP zwrócił 403; zainstalowany oficjalny SDK przeszedł poprawnie. Nie uznano403 za dowód nieważnego klucza i nie rozszerzano uprawnień.
- Potwierdzono rzeczywisty nowy projekt spring-bread-28217539, Development br-sparkling-term-b99l107x, endpoint ep-late-heart-b9mxo8oi i bazę platform_private. Początkowo: revision `6`, brak kont, organizacji, członkostw i grantów; obie aplikacje DISABLED. Istniejące trzy loginy są NOINHERIT, bez superuser/BYPASSRLS/CREATE lub członkostwa owner/neon_superuser.
- Przed zmianą powstała kopia br-bitter-term-b9r03hj2 bez endpointu. Odtworzona z niej gałąź br-calm-bar-b91d5vzr i endpoint ep-royal-silence-b9s25ph9 potwierdziły oryginalny pusty stan, rebind metadanych klonu, SQL002–004, syntetyczne konto/receipt oraz rollback przy nieprawidłowym receipcie. To test techniczny na danych syntetycznych.
- SQL002/003 zastosowano addytywnie z kontrolowanym NOLOGIN ownerem. Tymczasowe CREATE na bazie cofnięto w tej samej transakcji. Runtimes otrzymały wyłącznie wskazane funkcje modułu; bez tabel authority.
- Po przyjęciu SQL004 i ponownym preflight nowe nazwy, konto, organizacja, powiązanie, członkostwo, jawne granty i obowiązkowy receipt zapisano w jednej transakcji. Odczyt niezależny potwierdził planDigest `31db7c70132da25147d9f56122811381159068abe1cb1b6912caf361bb919a18` irevision19.

| Element | Potwierdzony stan |
|---|---|
| Konto / organizacja / powiązanie / członkostwo | po 1; organizacja Profitia; wewnętrzne UUID |
| Uprawnienia operacji | 4: benchmark.selection.read/write dla SpendGuru, supplier.report.read/project dla SRM |
| Dostępy produktu / wiązania modułu | po 2, konkretne funkcje i jawny termin 2027-01-15T11:11:30.585005+00:00 |
| Bootstrap receipt | 1, append-only, zgodny z planem; rzeczywisty database session user i czas |
| Tabele kontrolne | 15, wszystkie ENABLE/FORCE RLS i kontrolowany owner |
| Aplikacje w nowym magazynie | obie DISABLED |
| Rzeczywiste loginy runtime | 3; descriptor odmawia, bez bezpośrednich ACL kont/organizacji/ledgeru/receiptu |
| Schematy biznesowe / historia demo | nie migrowano i nie przypisano do nowej osoby/organizacji |

Szczegółowe identyfikatory konta, subject, adres, imię i wartości kluczy nie są publikowane w tym dowodzie ani rejestrach. Prywatny plan operatora i właściwe dane pozostają poza kanonem/PMOS/PHR. Granty nie oznaczają wdrożenia administracji rolami lub wildcardu na przyszłe funkcje.

## Granice i retencja

Faktyczne zasoby i retencję opisuje [rejestr](../registries/platform-initial-directory-v1.json). Rehearsal wygasa 18.10 o 11:00 UTC, ma 0.25 CU i usypianie po 300 s. Kopia sprzed zmian pozostaje bez endpointu i bez terminu: Neon nie pozwala wygasić gałęzi z potomkiem. Po wygaśnięciu potomka wymaga świadomej polityki retencji; nie usuwano zasobów ręcznie. Kopia nie upoważnia do cofnięcia nowych danych.

Minimalny receipt dotyczy kontrolowanego bootstrapu. Nie jest pełną administracją praw, ogólnym audytem wszystkich zmian operatora, reconciliatorem, retencją lub zewnętrznym zabezpieczeniem przed DBA. Wbudowane RLS nie uwierzytelnia posiadacza skradzionego backendowego credentiala SQL.

Świeży odczyt Render potwierdził dotychczasowe pięć deploymentów live, autoDeploy off i te same SHA dla SG2 runtime/dashboard Development, SRM Development oraz obu runtime Staging. Rzeczywista nazwa SG2 Staging to spendguru-porr-demo; tożsamość wynika z rejestru i ID, nie z aliasu. Statuslive i równość SHA nie zastępują biznesowego E2E lub LKG. Nie zmieniono połączeń, konfiguracji usług i sekretów ani nie wykonano deploymentu produktu.

Rozszerzenie zadeklarowanych ścieżek o SQL004 i testy wynikało z potrzeby utrzymania własnych nazw i dowodu bootstrapu; wykonano ponowne pełne bramki przed mutacją. Początkowo rozważane same SQL002/003 nie stanowiły kompletnego katalogu. Niezmieniony oryginalny begin zachowuje tę kolejność decyzji; końcowy closeout opisuje faktyczny, szerszy zakres E1.

Pełny program pozostaje IN_PROGRESS: rzeczywista sesja przeglądarkowa, pozostałe wejścia, prywatne schematy biznesowe, delegacja/cache/pliki, Supplier Intelligence w drugim gospodarzu i kontrolowane wydania Development/Staging wymagają dalszych dowodów.
