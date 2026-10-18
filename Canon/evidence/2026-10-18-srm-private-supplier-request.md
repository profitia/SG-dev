# SRM — prywatne zlecenie raportu, 18.10.2026

Status: SOURCE CANDIDATE / LOCAL NATIVE, PRODUCT, TYPES AND BUILD PASS; EXACT CI REQUIRED. Pełne E0/E1 pozostaje IN_PROGRESS.
Zadanie SRM-E1-PRIVATE-SUPPLIER-REQUEST-20261018; profil SRM, workspace
SG-dev Codespaces SRM, TARGET_ENVIRONMENT=development, wykonanie lokalne.
Authority profitia/SG-dev/main; baza źródłowa bd5a468630fc2e794afab055fdd875931ef5d3ad.

## Zmiana

Przyjęty producent ARCHITECTURE-E1-EXTERNAL-REQUEST-ADMISSION-20261018,
PR488/source70e6ebbd1bb931911fd3e3801f04e03d2d45b5df, dostarcza platform1.14,
root candidate8 i host1.6. Własne zadanie odbiorcy nie zmienia tego pakietu,
SQL006/010, wspólnego silnika ani kanonicznego writera audytu.

Istniejący natywny adapter pg przekazuje opcjonalne requestLedger. Osobny host
supplier_report dopuszcza wyłącznie HUMAN supplier.report.refresh: bieżące konto,
członkostwo, prawo, SUPPLIER_INTELLIGENCE, wiązanie modułu i jawną skończoną
politykę liczby zleceń. Nie pożycza praw odczytu, projekcji, eksportu lub Forecast.

Addytywne POST /api/xray/requests przyjmuje zamknięte zlecenie SUPPLIER_REPORT
z poprawnym NIP oraz kluczem idempotencji. Organizacja pochodzi z konfiguracji
gospodarza lub sprawdzanego selektora członkostwa; użytkownik pochodzi z oficjalnego
adaptera tożsamości. Nagłówki x-clerk i pola body nie nadają uprawnień. Odczyt
rzeczywistego strumienia JSON ma limit1024B,3s i anulowanie, niezależnie od
deklarowanego Content-Length. Duplikaty/obce parametry, pole destination i dowolne
dane źródłowe są odrzucane. Odpowiedź zawiera tylko requestId/status ACCEPTED,
private/no-store i Vary Cookie,Authorization. To przyjęcie intencji, nie raport.

W tym samym ograniczonym połączeniu i transakcji pg zapisuje się rezerwację,
prywatną komendę i OUTCOME. Rejestr wspólnego ledgera jest jedynym mechanizmem
idempotencji i limitu. Klucz jest związany z aktorem/aplikacją/środowiskiem/operacją;
fingerprint wiąże go również z organizacją, zasobem i treścią. Zmiana organizacji
tego samego aktora z wcześniej użytym kluczem oznacza konflikt409; nowa intencja
wymaga nowego klucza. Inny użytkownik nie otrzymuje starego receiptu.

Nowy addytywny SQL profitia_supplier_requests nie nadaje ról ani ACL. Kontrolowany
NOLOGIN owner, FORCE RLS i restrykcyjne polityki wymagają bieżącej fizycznej
aplikacji/środowiska oraz zakresu organizacji i osoby. Komenda jest związana
z rodzicem, payload digestem, decyzją i stanem RESERVED; nie ma prawa UPDATE/DELETE
dla runtime. Nieprzewidziany szeroki GRANT nie znosi ogrodzenia. To granica zwykłej
roli runtime; nie deklaracja odporności na administratora bazy lub przejęty backend.

## Konfiguracja i zakres dowodów

PROFITIA_SUPPLIER_REQUEST_ENABLED domyślnie false. Opt-in wymaga osobnej dokładnej
wersji konfiguracji i fingerprintów przyjętych SQL006/010 oraz komendy. Zwykły host
report/read/export zachowuje własną listę operacji. Wersje historycznych zapisów
source compatibility pozostają zachowane; aktualne przyjęcie intencji ma osobny
wpis supplierRequestAdoption. Nie zmieniono frameworków, zależności lub pinów.

Lokalne testy obejmują rzeczywisty PostgreSQL i zwykłe loginy, nie uprzywilejowane
połączenie udające runtime przez SET ROLE. Weryfikowane są dwa konta, dwie
organizacje i inna aplikacja z poprawnymi własnymi prawami do tego samego modułu.
Fixture SDK pozostaje syntetyczny; nie jest rzeczywistym logowaniem Clerk.
Pierwszy przebieg ujawnił błędne oczekiwanie testu dotyczące przeniesienia klucza
między organizacjami. Poprawiono oczekiwanie zgodnie z przyjętym ledgerem; nie
osłabiono odmowy409. Aktualny komplet testów, typy, build i exact-source CI
wymagają potwierdzenia przed closeoutem.

## Granice

Nie uruchomiono pobrania u dostawcy, KYS/PESEL, ingestu wspólnego katalogu,
dispatchera, kolejki, nowego runtime ani rozliczeń. Obecne search/lookup/KYS
nie zostały zastąpione przez202 i zachowują swój kod. Ten endpoint jest
przygotowaniem zlecenia do kolejnego, osobno sprawdzanego wykonania; nie dowodzi
parytetu pełnego przepływu biznesowego.

Nie wykonywano migracji chmury, zmian ról/grantów, kont, organizacji, historii,
sekretów, flag, połączeń lub deploymentu. Konto i katalog przygotowano już
17.10; ich receiptu nie odtwarza się. Właściciel ponownie autoryzował późniejsze
Development po pełnych kryteriach E1; ten przyrost go nie uruchamia. Brak zakresu
Production/E2–E4 lub nowego kosztu. Własne PMOS/PHR SRM; MEMOROS wyłączony profilem.

Lokalna walidacja finalnego kodu:88natywnych kontroli pg/API oraz496testów
biznesowych i311kontroli wydania PASS, bez pominięć. Sześć nowych testów
parsera/HTTP należy do zestawu496; liczb nie sumuje się. Ścisłe typy i build
Next16/React19 PASS. Jedyny wygenerowany import root-params zapisano poza
źródłem i przywrócono dokładny poprzedni next-env po sprawdzeniu różnicy bajtów.
Actual native API covers concurrent replay, key conflict, separate people/orgs,
foreign permitted app, current revocations/expiry, wrong metadata and receipt,
SQL owner/environment/decision binding, bounded body cancellation and audit rollback.
