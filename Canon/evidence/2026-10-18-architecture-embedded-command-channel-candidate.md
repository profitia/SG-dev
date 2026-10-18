# E1 — jawny kanał poleceń dla osadzonego UI

**Status:** PRODUCER_SOURCE_CANDIDATE / CONSUMER_ADOPTION_PENDING / NOT_DEPLOYED. Zadanie `ARCHITECTURE-E1-EMBEDDED-COMMAND-CHANNEL-20261018`, profil ARCHITECTURE, Development, workspace SG-dev Architecture, wykonanie lokalne. Authority przed zmianą: `d63605dbb6dcc1105150dd0e3a59d6c7b6342b99`. Własny PMOS/PHR, MEMOROS wyłączony przez profil.

## Kontrakt i granice

Pakiet źródłowy1.12.0 dodaje `profitia.embedded-command@1.0.0`: jawne polecenie z identyfikatorem intencji i odpowiedź202 oznaczającą przyjęcie. Nie oznacza ona stanu wspólnej kolejki, rozpoczętego obliczenia ani gotowego wyniku. Odczyty zachowują publiczne API, komunikaty odmowy i protokół `profitia.embedded-read@1.0.0`;200 nie staje się potwierdzeniem polecenia. Komunikaty protokołów są wzajemnie odrzucane.

Oba adaptery używają jednego wewnętrznego silnika portów i ograniczonego JSON. Nie dodano drugiej kolejki, silnika uprawnień, sesji, aktora ani magazynu. Kanał poleceń dopuszcza jedno równoległe żądanie,16KiB wejścia,64KiB odpowiedzi i15 sekund obserwacji; limity można jedynie obniżyć. Obowiązują dokładne klucze, wersja i identyfikator instancji, rosnący numer komunikatu, ograniczenie złożoności i poprawności JSON oraz zamknięcie przy naruszeniu protokołu.

Gospodarz aplikacji nadal sprawdza konkretne okno i origin, wyprowadza własny kontekst, zachowuje poświadczenie poza komunikatami, parsuje zamknięte polecenie i wywołuje bieżący chroniony backend. Identyfikator intencji i port nie nadają żadnych praw. Aplikacja odpowiada za projekcję odpowiedzi i stabilny klucz idempotencji przy świadomym ponowieniu. Biblioteka nie wybiera URL-a, nie deduplikuje efektów backendu i nie ponawia żądania.

Timeout, anulowanie lub zamknięcie strony/sesji kończą obserwację. Backend mógł już zapisać efekt. Zdarzenia te nie dowodzą braku dostarczenia, rollbacku, zwrotu limitu ani niepowodzenia operacji. Późna odpowiedź nie może odtworzyć zamkniętego kanału. Niewspółpracujący callback pozostaje liczony w limicie równoległości do zakończenia.

## Dowody producenta i zależności

Nowy izolowany lokalny PostgreSQL potwierdził **616/616 testów pakietu i laboratorium, bez skipów**. Obejmuje to dotychczasowe rzeczywiste testy SQL i nowe testy prawdziwych MessageChannel. Podzbiór kanałów:88/88, cały pakiet bez laboratorium:470/470; zbiorów nie sumuje się. Build pakietu i ścisły browserowy dowód typów — PASS. Typy odrzucają polecenie bez intencji, status200 jako przyjęcie, wymyślone pole użytkownika, zapis przez klienta odczytu i odczyt przez klienta poleceń.

Dowody: `/private/tmp/e1-embedded-command-architecture-{whole,channel-tests,platform-tests,build,types}-20261018.log`.

Testy governance:40/41 PASS; jedyna odmowa to `LOCAL_PACKAGE_VERSION_MISMATCH`, ponieważ lock aplikacji nadal wskazuje1.11.0. Jest to prawidłowa bramka wymagająca osobnego przyjęcia nowej wersji w SG2; nie zmieniono ani nie osłabiono kontrolera CI. SRM również wymaga własnego zadania zgodności i jawnego przyjęcia. Do czasu tych przyjęć kandydat nie jest gotowy do wspólnej publikacji.

Akceptacja źródła odbiorcy musi objąć hash wewnętrznego `embedded-channel-core.mjs`, odpowiedniego adaptera i typów. Sam dawny hash pliku odczytu nie opisuje już całej zależności wykonawczej. Przyjęcia aplikacji pozostają odrębnymi tożsamościami, kryteriami, commitami i raportami. Pełne dowody CI konkretnego kandydata i main oraz closeouty są wymagane przed odbiorem źródeł; nie zastępują wdrożenia.

Nie zmieniono macierzy uprawnień, danych, schematów, ról, grantów, sekretów, flag, konfiguracji usług ani działających artefaktów. Nie uruchomiono zapytania do zewnętrznego dostawcy i nie utworzono zasobu. Wysłanie polecenia przez istniejący przycisk, faktyczny backend i oba wydania produktu pozostają osobnymi odbiorami w kontynuowanym E0/E1.
