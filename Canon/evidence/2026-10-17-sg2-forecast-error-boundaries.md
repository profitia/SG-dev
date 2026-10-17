# E1 — komunikaty błędów i diagnostyka forecastów, 17.10.2026

**Status: SOURCE CANDIDATE / NOT DEPLOYED.** Profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority profitia/SG-dev/main, baseline2c44cc356db845698080de566eab6f2f2ff7bfd7. Przyjęte E0/E1 kroki01–11, bez Production/E2–E4.

## Odrębne tożsamości i korekta faktów

Implementacja: SG2-E1-FORECAST-ERROR-BOUNDARIES-20261017, begin cmvcvzjv20000olrbov9929k8, conversationId pmos-task-v2:ca5ea2a5c3dec185e77d44f8e99f4a396b70d20e27c0219c5476696f6640e0e6. Osobna korekta istniejącego testu: SG2-E1-FORECAST-ERROR-REGRESSION-EXPECTATION-20261017, begin cmvcw0epz00001ouwfkkqiow2, conversationId pmos-task-v2:71b779c898b90694fe3b1c6afb5109788e075c959f46656d7f26cad6d8a5b7da. Własne SG2 PMOS/MEMOROS/PHR; rejestracja nie jest closeout.

Opis [PR450](https://github.com/profitia/SG-dev/pull/450) i jego datowanego dowodu był zbyt szeroki: przesłona withInternalForecastServiceAuth ukrywała **nieobsłużone** wyjątki. Starsze handlery same przechwytywały wyjątki i zwracały ich message przez cognitionError; traced span zapisywał ten message do pełnego logu. Istniejący test wprost oczekiwał ujawnienia syntetycznego wyjątku. Ten dokument koryguje interpretację; nie przepisuje niezmiennych rekordów PMOS ani historycznego dowodu.

## Zmiana i zachowane zachowanie

Istniejący centralny cognitionError normalizuje treść wszystkich swoich odpowiedzi 5xx do stałego Operation unavailable. Zachowuje status, code, requestId i timestamp. Odpowiedzi walidacji/biznesowych 4xx oraz sukcesów zachowują poprzednie komunikaty i wyniki. Nie utworzono drugiego mechanizmu autoryzacji lub obsługi błędów.

Forecast diagnostic span zapisuje stałe Operation failed. przy wyjątku, zachowując outcome, timing, metryki i **ponownie rzucając ten sam oryginalny wyjątek wewnątrz procesu**. Oba handlery przygotowania nie przekazują exception.message do publicznego konstruktora. Błąd niekrytycznej obserwacji gotowości nadal pozwala zwrócić poprawny wynik biznesowy; log zachowuje nazwę zdarzenia i korelację, bez treści wyjątku.

Nowy test obejmuje kody500/502/503/599, niezmienione400/401/403/404/409/422/429, rzeczywiste pięć fabryk interaktywnych i dwie przygotowania pod poprawnym syntetycznym legacy credentialem. Każda ścieżka wykonuje callback rzucający Error lub wartość niebędącą Error; odpowiedź, traced span i log nie mogą zawierać prywatnego sentinela. Dodatkowo sprawdza izolację dwóch równoległych kontekstów diagnostycznych, tożsamość wewnętrznego wyjątku, metryki/czas, sukces200 i błąd niekrytycznej telemetrii. Żadne żądanie sieciowe ani płatne źródło nie jest potrzebne. Istniejąca regresja bounded-header zachowuje limit nagłówka, pełny duży snapshot, code/status/correlation i teraz odmawia ujawnienia syntetycznego wyjątku.

## Bieżąca walidacja i jawne granice

Pierwszy pełny lokalny przebieg279 wykrył błędne syntetyczne query dla dwóch fabryk ze strict series-only schema oraz różnicę kropki w poprzednim bezpiecznym komunikacie natywnego503. Nie osłabiono produkcyjnej walidacji. Query fixture poprawiono; dodatkowy plik natywnej regresji wymaga własnej rejestracji przed jego zmianą. Aktualny focused przebieg77 testów forecastów PASS0skip. Pełny typecheck/build produktu i dokładne kontrolowane CI pozostają obowiązkową bramką publikacji.

Ta zmiana **nie usuwa** dawnych job.failureReason/reason w wynikach200 i nie czyści przechowanej historii. Nie gwarantuje sanitizacji dowolnych metryk użytkownika, innych pól zdarzeń ani wszystkich głębszych logów providerów/workerów. Są to jawne pozostałe granice E1 dla projekcji wyników i przyjęcia jobów. Nie potwierdzono rzeczywistego wycieku sekretu z wdrożenia; odkrycie opiera się na kodzie i syntetycznych testach.

Tryb Clerk nadal odmawia wejścia do starego technicznego API przed handlerem. Nie nadano grantów SERVICE, nie aktywowano aplikacji ani flag i nie zmieniono cloud config, sekretów, ról, danych, instalacji SQL lub wdrożeń. Całe E0/E1 pozostaje IN_PROGRESS; source test nie jest odbiorem Development/Staging ani sprawdzonym rollbackiem.
