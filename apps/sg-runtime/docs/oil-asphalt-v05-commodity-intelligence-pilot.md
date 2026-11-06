# Oil v0.5 Commodity Intelligence — rzeczywisty wynik

Task `SG2-OIL-V05-COMMODITY-INTELLIGENCE-20261106`, Development. **PARTIAL_SUCCESS: raport dostarczony, ograniczony zakres kalendarza i STEO.**

Powstał rzeczywisty czterostronicowy PDF A4 `OIL_ASPHALT_MARKET_OUTLOOK_v0.5_COMMODITY_INTELLIGENCE_PL.pdf`, pełny Markdown (9991 znaków tekstu głównego z tabelami, 19 przypisów), aneks danych, evidence/provenance, telemetria i porównanie z rzeczywistą próbką Extended TE. PDF przeszedł oględziny wszystkich stron i kontrolę przypisów. SHA-256: `347c9dc505ca5ae7d57943f935c9f12968b81c6b71864b0eb421d17a9c5a16f8`.

Pakiet: `/Users/tomaszuscinski/Documents/Visual Code Studio/profitia-development/oil-v05-commodity-intelligence-20261106/deliverables-final-v2`. Stan wiedzy: `2026-11-06T22:35:39.376Z`. Wybrane ceny, porównania i historyczny Forecast Core są identyczne z faktycznym Extended TE o asOf `2026-11-06T22:17:25.278Z`; nie dokonano kolejnego pobrania TE, wiadomości ani ponownego obliczenia prognoz.

## Dane i wartość biznesowa

Siedem autoryzowanych wywołań SourceHub potwierdziło siedem upstream requests: EIA pięć, CFTC jedno, bezpłatny kalendarz commodities.sh jedno. Pozyskano 40 rekordów, w tym 2 metadane, 32 obserwacje i 6 harmonogramów. W raporcie wykorzystano 14 obserwacji rynkowych oraz 2 metadane selekcji; pozostałe 24 wyłączono z publikowanego wyboru. To selekcja analityczna, a nie błąd dostawcy. Szczegółowa korekta agregacji licznika przyjętych rekordów jest jawna w końcowej telemetrii, a oryginalne receipts i telemetria operatora są zachowane bez zmian.

EIA: WCESTUS1, WDISTUS1, WPULEUS3, WCRRIUS2, WGFUPUS2 i WDIUPUS2 — porównanie tygodni 30/23 października. CFTC: 72hh-3qpy, Disaggregated Futures Only, WTI-PHYSICAL NYMEX 067651, pozycje 3 listopada/27 października; Managed Money netto = long minus short i porównywalny Open Interest. Daty publikacji i vintage pozostają UNKNOWN. Product Supplied jest przybliżeniem konsumpcji, a pozycjonowanie nie mierzy popytu fizycznego.

Mniejsze zapasy i większa aktywność rafinerii dostarczają rzeczowej przeciwwagi dla tezy o załamaniu popytu po spadku cen. Redukcja pozycji netto funduszy wzbogaca ocenę nastrojów. Dane USA nie dowodzą dostępności bitumenu w Polsce. Nie przeliczono cen ropy na PLN/t asfaltu. Chiński Bitumen pozostaje odrębnym benchmarkiem. Procurement Outlook zachowuje warunkowe decyzje, koszty pomyłki i sygnały rewizji.

Kalendarz pobrano LIVE, lecz żadnej konkretnej daty nie uznano za dostatecznie potwierdzoną. Nie ekstrapolowano cykliczności ani wyjątków świątecznych. STEO nie użyto bez potwierdzonej edycji i publikacji. Importu/eksportu nie pobrano bez dodatkowej potrzeby analitycznej. TE Economic Calendar i płatne endpointy commodities.sh pozostały wyłączone. Braku aktualnej prognozy Forecast Core nie zastąpiono nieporównywalnym instrumentem.

## Uprawnienia, koszt i zakończenie

Właściciel zatwierdził dokładnie cztery granty Oil, dodatkowy własny klucz i dwie ograniczone role Source oraz odrębne 5 USD. Po potwierdzonym bezpiecznym oknie aktywnego ownera zainstalowano je wyłącznie w Development, z terminem najpóźniej 7 listopada 20:49 UTC / 21:49 Warszawy. Nie przejęto wcześniejszej tożsamości ani liczników. Po zakończeniu wycofano dokładnie własne cztery granty, dodatkowy klucz i własne polityki; dwie własne role Source ustawiono NOLOGIN. Niezależny readback z 22:58 UTC potwierdza wynik. Wspólna aplikacja/SERVICE/login i cudze polityki pozostały bez zmian; calls, usage i audyty zachowano. Owner otrzymał informację o zakończeniu zależności.

Jedno liczenie wejścia (14669 tokenów), jedno generowanie `gpt-6.1-sol`, HTTP 200, bez retry. Usage: 14669 wejścia + 9261 wyjścia, w tym 6482 reasoning; 23930 łącznie. Generowanie 139523,163459 ms, obliczony koszt 0,129281 USD. Koszt licznika UNKNOWN, zachowana rezerwa 0,10 USD. Pozostała niezobowiązana kwota 4,770719 USD. To koszt obliczony z usage, nie faktura.

Pełny mierzony przebieg workera do ukończenia raportu i Quality Gate: 1210456,029041 ms. PDF build 21,573292 ms; cały renderer 69,067375 ms; końcowy Quality Gate 26,503167 ms. Osobne czasy dostawcy, E1/SERVICE/Admission i niezmierzona część przygotowania pozostają UNKNOWN. Całkowite nowe upstream requests: 7 Hub + 2 OpenAI. Surowe odpowiedzi dostawców z retencją 0 nie są archiwizowane; pamięć robocza została wyczyszczona i proces zamknięty.

Siedem testów nowych obliczeń/kontraktów przeszło. Zachowano istniejące mechanizmy SourceHub, E1/SERVICE, Source Admission, receipts, model execution i telemetry. Moduł obliczeniowy nie wykonuje HTTP ani Forecast compute; renderer ponownie wykorzystuje sprawdzony układ Extended TE. Kanon v0.5 niezmieniony, SHA-256 `5edb1848d3abd5b90ce7bcee2e894e764b354a6482665d8307e1f6d42a42ad41`. Nie ma nowych konektorów, nowych dostawców, deploymentu ani zmiany poza Development.

Porównanie jakości wskazuje wyraźną poprawę opisu fizycznego rynku USA i pozycjonowania oraz umiarkowaną poprawę argumentacji zakupowej. Nie dowodzi wzrostu trafności prognoz. Wynik pozostaje PARTIAL, a trwałe przyjęcie źródeł do kanonu wymaga osobnej oceny właściciela. Materiał wymaga przeglądu człowieka przed zewnętrznym wykorzystaniem.
