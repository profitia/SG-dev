# SG2 — regresja wobec przyrostu zlecenia SRM, 18.10.2026

Status: SOURCE CANDIDATE / EXACT CI REQUIRED. Zadanie
SG2-E1-SUPPLIER-REQUEST-SOURCE-REGRESSION-20261018; SG2/Development/local,
workspace SG-dev. Authority profitia/SG-dev/main, baza bd5a468630fc2e794afab055fdd875931ef5d3ad.
Własne PMOS, wymagany MEMOROS i PHR. Pełne E0/E1 pozostaje IN_PROGRESS.

SRM-E1-PRIVATE-SUPPLIER-REQUEST-20261018, PR492/source09942fbce309f3b3c85f00bdf3173af6db6c5c70
ma osobne13zarejestrowanych ścieżek i własną historię. Lokalnie88natywnych,
496biznesowych oraz311kontroli wydania SRM, typy i Next16/React19 build PASS,
bez pominięć. Nie stanowi to ponownego testu SG2.

To odrębna jednostka odbiorcy SG2: jawne metadane regresji oraz rzeczywiste testy
niezmienionego Runtime/API/SQL/Clerk/revocation/audytu i types/build, a także
oddzielne testy dashboardu i jego produkcyjnej odmowy HTTP. Obowiązują exact-source
kontrolowane CI kandydata i main, zanim własny closeout uzna tę walidację za wykonaną.
SG2 nie przyjmuje przez to endpointu zleceń SRM ani praw supplier.report.refresh.
Nie zmienia się kodu biznesowego SG2, wersji SDK/pakietów, frameworków, pinów,
połączeń, ról, danych, flag lub wdrożeń.

Pierwszy kontrolowany run39161701404 odmówił UNTRUSTED_CANDIDATE dla PR SRM,
przed fazą poświadczenia. Był to błędny wybór kandydata przez wykonawcę, nie błąd
pakietu. Kontroler wymaga wewnętrznego kandydata sg2/. Nie zmieniono tej reguły,
uprawnień lub sekretów i nie przemianowano zadania SRM na SG2. Ta właściwa jednostka
ma własne dwa dozwolone pliki, osobną rejestrację oraz faktyczną walidację SG2.
Źródło SRM jest integrowane bez zmiany jego bajtów, pod zachowaną tożsamością SRM.
Cały kandydat musi odpowiadać sumie obu rejestracji:15plików.

Nie deklaruje się logowania prawdziwej osoby, aktywacji aplikacji, zewnętrznego
pobrania lub wydania. Wcześniejszy bootstrap i istniejąca praca pozostają zachowane.
Właściciel autoryzował późniejszy Development dopiero po pełnych kryteriach E1.
Obecna publikacja kodu nie uruchamia takiego deploymentu ani Staging/Production.
