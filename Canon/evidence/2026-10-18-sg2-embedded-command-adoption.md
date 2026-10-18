# SG2 — jawne polecenia z istniejącego wykresu, 18.10.2026

Status: SOURCE_CANDIDATE / LOCAL_VALIDATION_PASS / NOT_DEPLOYED. Zadanie `SG2-E1-EMBEDDED-COMMAND-ADOPTION-20261018`, profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority przed zmianą: `d63605dbb6dcc1105150dd0e3a59d6c7b6342b99`. Własny begin PMOS i późniejszy własny closeout, MEMOROS oraz PHR; rejestracja nie stanowi odbioru. Program E0/E1 nadal trwa.

## Przyjęcie i zachowanie

Producent ARCHITECTURE: `ARCHITECTURE-E1-EMBEDDED-COMMAND-CHANNEL-20261018`, dokładne źródło `a0e6bbee0ce44e2d3472183ef67749f3ef8f4e45`, PR481, pakiet1.12.0. SG2 jawnie przyjmuje neutralny rdzeń transportu, wrappery odczytu i polecenia oraz deklaracje typów; ich aktualne hasze zapisano w operation-integration.json. Poprzedni zapis przyjęcia odczytu pozostaje historyczny. SRM otrzymuje odrębne zadanie kompatybilności i własną historię. Żaden z tych zapisów nie dowodzi wdrożenia aplikacji.

Istniejące przyciski przygotowania Current i Verification używają osobnego, domyślnie wyłączonego kanału poleceń. Odczyt zachowuje READ1.0 i nadal odmawia POST. Nie dodano kolejnych kontrolek, automatycznego przygotowywania ani drugiego mechanizmu odpytywania. Rodzic i dziecko uzgadniają dokładne okno, origin i dokument. Rodzic ustala własną serię i organizację, pobiera bieżącą sesję i wywołuje jeden istniejący chroniony endpoint. Do dziecka nie trafiają poświadczenia, uprawnienia aktora ani prywatny identyfikator zlecenia.

Handler wymaga jawnie skonfigurowanego atomowego zapisu delegacji. Starszy tryb samego przyjęcia odmawia przed zapisem. Rodzic uznaje wyłącznie zgodną odpowiedź202, wersję konfiguracji, projekcję, digest konkretnego polecenia i oznaczenie DELEGATED. Dziecko otrzymuje jedynie potwierdzenie ACCEPTED. Nie jest ono stanem QUEUED, PREPARING ani READY obliczeń. Gotowość naukowa pochodzi z odrębnego autoryzowanego odczytu rzeczywistych wspólnych artefaktów.

Niepewna odpowiedź nie powoduje automatycznego powtórzenia ani nowego klucza. Ponowna jawna próba zachowuje ten sam zamiar, również po zmianie i powrocie do modelu lub rodzaju obliczenia. Pamięć obejmuje maksymalnie24 dozwolone kombinacje w bieżącym dokumencie, bez tożsamości lub cache decyzji o dostępie. Dopiero niezależnie zaobserwowane ukończenie pozwala zwolnić dany lokalny zamiar. Zmiana sesji, dokumentu lub selekcji zamyka starą obserwację; anulowanie nie jest deklaracją cofnięcia zatwierdzonego efektu.

## Walidacja i ograniczenia

| Kontrola | Rzeczywisty wynik lokalny |
| --- | --- |
| Cały zestaw Runtime, nowe bazy i zwykłe role |576/576 PASS, bez pominięć |
| Dashboard, rzeczywiste kontrolery okien i MessageChannel |332/332 PASS, bez pominięć |
| Skupione kontrole Runtime |30/30 PASS |
| Oryginalne regresje biznesowe i kolejki |61/61 oraz38/38 PASS |
| Pełne typy dashboardu i dotknięte typy Runtime |PASS |

Zestawy częściowo się pokrywają i nie są sumowane jako unikalne przypadki. Test API z prawdziwym Prisma, dwoma magazynami i zwykłą rolą potwierdza pojedynczy zapis po powtórzeniu zamiaru, odmowę starej konfiguracji bez zapisu, obcej organizacji, aktualnie zablokowanego konta i spreparowanego polecenia. Test okien potwierdza brak automatycznych wywołań, brak przekazania tożsamości do dziecka, jawne ponowienie po utracie odpowiedzi i zamknięcie kanału. Pierwsza wersja nowego testu miała niepełny URL osadzenia; poprawiono fixture do rzeczywistego, wymaganego formatu, zachowując kontrolę zamkniętej listy parametrów.

Dowody: `/private/tmp/e1-embedded-command-sg2-full-{whole,original-business,original-queue,strict}-20261018.log` oraz `/private/tmp/e1-embedded-command-sg2-focused-{runtime,dashboard,types}-20261018.log`. Dokładne CI, pełne buildy kandydata i main oraz publikacje ciągłości wymagają osobnych rzeczywistych dowodów przed closeout. Dodano nowy test polecenia do obowiązkowej komendy CI; zakres rozszerzono z27 do28 ścieżek po ponownej pełnej bramce, zachowując pierwotną rejestrację i żądanie, bez powtarzania begin.

Nie zmieniono żywych baz, schematów, ról, grantów, danych, sekretów, flag, usług ani wdrożeń. Dotychczasowe Development i Staging działają na swoich wcześniejszych artefaktach. Testy używają kontrolowanych odpowiedzi SDK; nie są dowodem rzeczywistego OTP/TLS ani odbiorem UI przez użytkownika. Pozostają pełny przegląd wejść, niecodzienna proweniencja źródeł, brak prywatnego API historii zleceń, przygotowanie zasobów i kontrolowane wydania Development oraz Staging z wykonalnym odzyskiwaniem. Limity SQL nie są budżetem CPU lub płatnego dostawcy. Ten przyrost nie kończy E1.
