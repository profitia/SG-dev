# E1 — jawne zależności odczytu Verification i gotowości forecastów

Data: 18.10.2026. Profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development; wykonanie lokalne. Zadanie `SG2-E1-EXPLICIT-VERIFICATION-READ-20261018` realizuje ograniczony przyrost osobno zaakceptowanego programu E0/E1. Bazą źródłową jest `profitia/SG-dev/main` na `a2281ec192e1860e3f4ef21fc3b8520ff087928f`, po zamknięciu PR #462.

PMOS begin: `cmvd58cmq000012wmj7l74evi`. Task conversationId: `pmos-task-v2:8c82c89c7295010be69c70078abbf8bdf2c4147ecbadd0963dd679e68d4ecc06`. Rzeczywisty hostConversationId: `01a133c2-c245-77a0-bb6b-33165e2ad80c`. Rejestracja nie jest dowodem closeout; późniejsze wyniki dokładnego CI, merge, MEMOROS i publikacji PHR należą do kanonicznego closeout tego zadania.

## Zmiana

Oryginalne `readVerificationRunFromPrisma` i `readLatestVerificationRunFromPrisma` przyjmują opcjonalną, jawną zależność z wygenerowaną metodą `forecastVerificationRun.findFirst`. Odczyt latest przekazuje tę samą zależność do odczytu pełnego artefaktu. Pominięcie zależności zachowuje dotychczasowe zachowanie globalnego klienta. Jawny błędny lub pusty klient nie uruchamia powrotu do globalnego połączenia.

`readForecastPreparedVariants` oraz fabryki Rolling Daily FULL, FAST i RECENT udostępniają wąskie typy istniejących metod odczytu, zgodne z rzeczywistym wygenerowanym klientem i `Prisma.TransactionClient`. Jawne pole `prisma` z wartością null lub undefined oznacza odmowę, a nie wybór klienta globalnego. Dla Rolling Daily sprawdzenie wymaganych metod następuje przed wywołaniem czytnika historii; niekompletny klient nie może uruchomić domyślnego pobierania historii.

Zapytania, mapowanie danych, wybór AVAILABLE, zgodność modeli/metod/kadencji, polityki statystyczne, fingerprinty, obliczanie metryk i dotychczasowe fallbacki brakujących kolumn pozostają bez zmian. Najnowsza nieudana próba nadal może oznaczać STALE w gotowości, mimo istnienia starszego artefaktu AVAILABLE do odczytu. Nie utożsamiono tych dwóch reguł biznesowych.

## Dowody lokalne

- Nowy test integracyjny tworzy wyłącznie stały, syntetyczny schemat w jawnie sprawdzonej bazie PostgreSQL na loopback. Schemat powstaje z aktualnego `prisma-market-data/schema.prisma` przez istniejący Prisma CLI, bez generowania nowego klienta lub nowych zależności.
- Rzeczywisty klient wygenerowany dla aplikacji odczytuje relacje run/metrics/points przez zwykłą rolę SQL. Sprawdzone są bieżąca baza, current_user, session_user oraz brak SUPERUSER i BYPASSRLS. Rola ma SELECT wyłącznie na wymaganych tabelach fixture; zapis i odczyt dodatkowej tabeli prywatnej są odrzucane.
- Exact/latest, gotowość miesięczna i dzienna oraz FULL/FAST/RECENT wykonują się w rzeczywistej transakcji Repeatable Read z potwierdzonym READ ONLY. Odczyt latest i jego pełny artefakt korzystają z przekazanego klienta transakcyjnego.
- Sprawdzone są zera, wartości null, relacje, kompletna tożsamość utrwalonego artefaktu, najnowszy AVAILABLE, reguły READY/STALE, błędne zależności i rzeczywista odmowa SELECT. Zatruty klient globalny oraz zabroniony transport zewnętrzny potwierdzają brak wyjścia z jawnego odczytu po błędzie. Odrębny test zachowuje zachowanie klienta domyślnego, opcji samego `now` i starszego schematu.
- Pierwszy test negatywny wykazał, że niekompletny czytnik Rolling Daily mógł uruchomić domyślny resolver historii. Walidacja wymaganych metod przed resolverem usuwa ten problem; test pozostaje w CI. Błędy nowej fixture dotyczące nazwy pola identity i oczekiwania gotowości poprawiono zgodnie z istniejącymi kontraktami; nie zmieniano polityki produktu.
- `test:operation-context`: 398 testów PASS, 0 pominiętych. Obejmuje osiem nowych przypadków integracyjnych i istniejące testy prepared-state oraz Rolling Daily Verification, dopisane do tego samego polecenia CI.
- Oryginalne testy biblioteki forecastów i snapshotów Current: 61 PASS, 0 pominiętych. Osobny zestaw biblioteki/gotowości/Rolling Daily: 67 PASS, 0 pominiętych; zestawy częściowo się pokrywają i nie stanowią sumy unikalnych testów.
- Ścisły typecheck zmienionych źródeł i testów oraz lokalny probe rzeczywistego `PrismaClient`/`TransactionClient`: PASS. Wąskie porty nie udostępniają metod zapisu ani surowego SQL.

## Granice dowodu i dalsza integracja

To wewnętrzne porty odczytu, a nie kompletna granica autoryzacji lub sanitacji. Test korzysta z surowych tabel fixture i zachowuje wewnętrzny inputRunId. Nie dowodzi bezpiecznej publikacji takiego wyniku bez zamkniętej projekcji i kontekstu dostępu. W przyszłym natywnym adapterze Rolling Daily trzeba przekazać także zatwierdzony czytnik historii; dotychczasowy domyślny resolver pozostaje zachowaniem legacy. Sama jawna zależność Prisma nie zastępuje tego adaptera.

Nie zmieniono kontraktów ani uprawnień wspólnej bazy rynkowej, zainstalowanego SQL001, kandydata źródła forecastów, ról chmurowych, sekretów, flag ani powiązań aplikacji. Nie wykonano wdrożenia produktu. Nie ma nowego runtime, estymatora, writera, mechanizmu PMOS ani ścieżki obliczeń zastępczych.

Natywne wejścia Verification i gotowości, ich zamknięte projekcje źródłowe, przyjęcie w interfejsie, zadania delegowane oraz kontrolowane wydania Development i następnie Staging pozostają dalszą częścią E1. Ten dokument nie stanowi odbioru całego E1, aktywacji Clerka, dowodu biznesowego UAT ani zgody na Production lub E2–E4.
