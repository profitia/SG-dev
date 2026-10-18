# SpendGuru — regresja przy natywnej adopcji dostawców SRM, 19.10.2026

Status: SOURCE_VALIDATION_CANDIDATE / pełne E0/E1 IN_PROGRESS. Zadanie `SG2-E1-NATIVE-PROVIDER-SOURCE-REGRESSION-20261019`, profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority profitia/SG-dev/main. Własne PMOS, MEMOROS i PHR; odrębna tożsamość od producenta SRM. Rejestracja nie jest closeout.

Kandydat zawiera dokładny commit SRM `e1a9d251a52a8c2ce6c4695a6c73141e5e15f1dd`, PR504 i zadanie `SRM-E1-NATIVE-PROVIDER-ADMISSION-20261019`. Właściciel siedmiu ścieżek tej implementacji pozostaje SRM. SG2 zapisuje wyłącznie ten własny dokument regresji. Rzeczywiste źródła Runtime, dashboardu i wspólnego pakietu pozostają identyczne z authority `7a9a101ee7415547902fceb3eb6661fc9bb06edf`.

Kontroler na main dopuszcza wewnętrznego kandydata SG2. Pierwsze uruchomienie39177463828 dla gałęzi SRM otrzymało rzeczywistą odmowę UNTRUSTED_CANDIDATE przed fazą poświadczenia i nie jest dowodem PASS. Osobny kandydat integracyjny SG2 zapewnia wymagany profil i rzeczywistą kontrolę odbiorcy. Nie zmieniono polityki, uprawnień, Environment ani sekretów; nie odczytano ponownie tokenu z Render.

Wymagany odbiór tej jednostki obejmuje dokładny combined SHA, faktyczny artefakt zaufanego kontrolowanego CI oraz publiczne testy API i zwykłych ról PostgreSQL, typy/buildy Runtime i dashboardu, odmowę niedozwolonego HTTP dashboardu oraz niezależne SRM/governance. Lokalna walidacja SRM132, produkt499 i promocja311 bez skipów nie zastępuje tych testów SG2. Po normalnym merge wymagane są trzy rzeczywiste artefakty main, logi, zgodność blobów i własny kanoniczny closeout. Wyniki zakończonych uruchomień są dowodami tego closeoutu; samo sformułowanie wymagania w tym dokumencie ich nie wykonuje.

SG2 nie przyjmuje przez tę zmianę nowego endpointu dostawcy, HTTP odświeżania ani dostępu do danych osobowych. Nie zmieniono aplikacji, konfiguracji, danych, migracji, ról, flag, zasobów ani wdrożeń SpendGuru. Techniczny SOURCE SRM nie przyznaje HUMAN prawa produktu. Adopcja oryginalnych klientów w izolacji nie jest odbiorem sesji użytkownika, pozostałych wejść, publikacji wspólnego katalogu, odzyskiwania ani Development release.

Po przyjęciu tego przyrostu trwa pełne E1 i dopiero po jego właściwym odbiorze nastąpi odrębne kontrolowane wydanie Development. Brak wydania Staging/Production i brak E2–E4. Ich zadań nie raportuje się pozornie jako Development.
