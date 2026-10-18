# SRM — prywatny zapis biznesowy zlecenia, 18.10.2026

Status: SOURCE CANDIDATE, lokalne testy i build PASS; wymagane potwierdzenie
dokładnego candidate/main w CI. SRM-E1-SUPPLIER-PRIVATE-BUSINESS-20261018,
SRM/Development/local, SG-dev Codespaces SRM, profitia/SG-dev/main.
Punkt bazowy: 3b1bce8cb25c09d4939c1b5145a06ab03d831e82.
Własne PMOS/PHR; MEMOROS wyłączony. Całe E0/E1 pozostaje IN_PROGRESS.

## Rzeczywista integracja

Adapter używa istniejących createLookup, persistSection, writerów prób,
snapshotów, projekcji i faktów oraz saveMgbiArchive/saveFinancialDocuments.
Jawna capability wiąże je z tą samą transakcją pg przekazaną przez istniejący
host. Nie tworzy połączenia zapasowego ani drugiego executora, audytu czy
mechanizmu uprawnień. Stare wywołania zachowują dotychczasowy wybór połączenia.

REGISTER_LOOKUP używa UUID przyjętego zlecenia jako stabilnego identyfikatora
wyszukiwania. STORE_GENERAL i STORE_FINANCIAL wymagają tego samego rzeczywistego
rekordu wyszukiwania, NIP, komendy, aktora i organizacji. Każda faza przechodzi
bieżącą kontrolę tożsamości, praw, produktu, modułu i skończonej polityki.
Idempotencja nadal należy do wspólnego ledgera i SQL011. Replay nie wywołuje
writerów; zmienione dane są konfliktem. Zapis kończy się dopiero po natywnym COMMIT.

Wynik dostawcy jest przechwytywany i zamrażany przed pierwszym await. Kompletny
prywatny materiał może mieć do32MiB; przekroczenie powoduje odmowę, bez obcinania
archiwum. Mały manifest fazy zawiera wersję, NIP i digest dokładnych przechwyconych
bajtów. Surowy materiał nie trafia do wspólnego audytu/ledgera ani odpowiedzi
adaptera. Limit ten dotyczy przyjęcia do prywatnego writera; nie jest deklaracją
limitu transmisji ani kosztu HTTP u dostawcy.

Addytywny SQL002 tworzy chroniony receipt i domenową granicę zapisu siedmiu
istniejących tabel. Trigger wiąże rzeczywisty RESERVED efekt SQL011 z bieżącą
transakcją, komendą NIP, użytkownikiem, organizacją i dopuszczoną fazą. Sam GUC
organizacji, uprawnienie modułu lub zwykłe przyjęcie komendy nie wystarczą.
Źródłowy snapshot pozostaje niezmienny; kolejny przyjęty refresh może zmienić
bieżące archiwum tej samej firmy, zachowując wcześniejsze snapshoty.

SQL wymaga kontrolowanego właściciela, wyłączonego SRM i zaakceptowanych schematów.
Nie nadaje praw ról ani nie aktywuje aplikacji. Pierwotne18 migracji, inicjalizator,
private_installation i wspólne SQL001–011 nie zostały przepisane. Numer002 jest
nową granicą biznesowych zapisów; nie jest odrzuconą wcześniej kopią ledgera faz.

## Walidacja lokalna

107 natywnych testów pg/API PASS, bez pominięć, w tym siedem nowych scenariuszy
biznesowych i kontrola pinningu źródeł. 499 testów produktu oraz311 testów promocji
PASS, bez pominięć. Ścisły typecheck i rzeczywisty build Next16/React19 PASS.
Trzy testy jednostkowe dodano do499; zestawów nakładających się nie sumuje się.

Zwykły login rzeczywiście zapisał istniejące tabele, archiwa, dokumenty i fakty.
Sprawdzono dwie organizacje, dwie tożsamości, parent/klucz/NIP, kolejność, aktualną
odmowę i replay, błędny kontekst fazy, brak zgody na KYS, błędne ACL receiptu,
zmianę wejścia po rozpoczęciu oraz rollback rzeczywistych danych po awarii OUTCOME.
W audycie nie ma markerów surowego materiału. Katalog globalny pozostaje pusty.

Pierwsze lokalne uruchomienia wykryły błędne przygotowanie fixture (aktywną drugą
syntetyczną aplikację i brak tymczasowego CREATE przy kolejnym resecie) oraz błąd
składni nowego CASE. Poprawiono testowe przygotowanie i SQL; nie osłabiono
inicjalizatora. Oddzielny zestaw produktu odmówił zastąpienia już istniejącej bazy
testowej po zestawie natywnym. Zachowano tę ochronę i użyto osobnego świeżego
klastra. Końcowe zestawy przeszły. W przeglądzie dodano test drugiego odświeżenia
i uwzględniono istniejący trigger checksumu archiwum w kontroli niezmiennej tożsamości.

Własny wygenerowany import root-params zachowano poza źródłem, a next-env
przywrócono bajtowo do początkowego stanu. Nie usunięto cudzej pracy.

## Granice odbioru

To rzeczywisty prywatny zapis biznesowy w izolacji, bez aktywacji nowego przepływu
HTTP. Pobranie sieciowe, MSR/Vercly, źródłowy ingest SERVICE, wybór dostawcy przez
rzeczywiste konto, pozostałe wejścia i chroniona publikacja wyników wymagają
dalszej integracji E1. Sam receipt fazy nie oznacza dostarczonego raportu.

Nie uruchomiono płatnych wywołań, nie przeniesiono historii demo/PORR, nie
zmieniono istniejących kont/bootstrapu, chmurowych schematów, ról, sekretów,
flag ani wdrożeń. SDK IdP w testach jest fixture, a nie sesją rzeczywistej osoby.
Development będzie wdrożony dopiero po pełnych kryteriach E1 i odzyskiwania.
Nie deklaruje się odbioru Staging/Production lub E2–E4.
