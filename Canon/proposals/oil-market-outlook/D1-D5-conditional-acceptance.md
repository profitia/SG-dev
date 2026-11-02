# Owner conditional acceptance — Oil Market Outlook

Status: OWNER_ACCEPTED_FOR_PREPARATION_ONLY / NOT_ACTIVE.

The two adjacent attachment files preserve the exact approved bytes. This record activates neither the parent Insights canon nor a nine-section renderer. Existing PR847 I1–I4 and PR848 G1 decisions remain valid; their separate main adoption is pending. No reapproval is requested here.

# OWNER DECISION — OIL MARKET OUTLOOK
## D1–D5 · Conditional Acceptance for Preparation

Po przeanalizowaniu pakietu decyzji v1.0, raportu zgodności i 18 blokad podejmuję następujące decyzje właścicielskie.

### D1 — APPROVE_WITH_CONDITIONS

Zatwierdzam biznesowo dokładny dokument `Procurement Oil Insight — Report Canon v0.2` o SHA-256:

`031f9d88f4da52fdaea64f173b9ca5acd258973670f648bf0d3fd38239f23222`

Obowiązują wszystkie warunki BC1–BC6.

Zatwierdzenie dotyczy specjalizacji Oil Market Outlook. Nie aktywuje kanonu nadrzędnego ani nie zmienia automatycznie jego czterosekcyjnego kontraktu i limitu 4000 znaków.

### D2 — APPROVE_PILOT_PROFILE_SPECIFICATION

Zatwierdzam jako specyfikację kandydata `OpenAI Execution Profile — Pilot v0.1` o SHA-256:

`fa71e18c3be77cf5e109ffde33e2e8da1e3548ba8c90eb3da06adaffde2c8240`

Obowiązują warunki EP1–EP6.

`gpt-6.1-sol` jest kandydatem dla pierwszej próby raportowej, nie globalnym modelem SpendGuru. Nie wolno zmieniać globalnego `OPENAI_MODEL`.

### D3 — AUTHORIZE_BOUNDED_CHANGE_PREPARATION_ONLY

Zezwalam na przygotowanie w odpowiednich repozytoriach i profilach właścicielskich dokładnych kandydatów zmian wymaganych dla pilota.

Zakres obejmuje dedykowaną operację Author/Composer, projekcję Evidence Bundle, walidację raportu, kontrolę kosztów, diagnostykę i niezbędne kontrakty E1/Source.

Dopuszczam prace na izolowanych gałęziach i przygotowanie Draft PR zgodnie z aktualnym routingiem i lifecycle.

Nie zatwierdzam merge, deploymentu, aktywacji nowych grantów ani zmian konfiguracji Development.

### D4 — CONDITIONAL_BUDGET_FOR_ONE_SOL_ATTEMPT

Akceptuję budżet całego pilota do 5 USD jako górną granicę biznesową.

Na obecnym etapie zakres finansowy ograniczam do jednej przyszłej próby `gpt-6.1-sol`, z rezerwacją do 0,15 USD, maksymalnie 15 000 tokenów wejścia, 8000 tokenów wyjścia wraz z reasoning i limitem body 65 536 bajtów UTF-8.

To nie jest zgoda na natychmiastowe płatne wywołanie.

Przed wykonaniem wymagane są wszystkie warunki D4, zaakceptowany dokładny kandydat D3, kontrolowane wydanie oraz potwierdzenie projektu aktywnego klucza, E1/Source i rozliczenia wcześniejszego `UNVERIFIED`.

Po spełnieniu bramek przedstaw gotowy zakres jednej próby do ostatecznej decyzji GO. Nie wykonuj jej samoczynnie.

Brak zgody na retry, dodatkowe modele, Web Search, płatną recenzję lub wykorzystanie pozostałej części budżetu bez osobnej decyzji.

### D5 — ALLOW_FROZEN_D0_FOR_INTERNAL_PILOT_ONLY

Zgadzam się na wykorzystanie niezmienionego eksperymentu D0 do wewnętrznego przygotowania i oceny Oil Market Outlook.

D7 pozostaje `EXPERIMENTAL_7D / PARTIAL_READY`. Nie udzielam produkcyjnej certyfikacji Forecast, zgody na nowe dopasowanie modeli, zmianę matematyki ani publikację automatyczną.

Każde wydanie przeznaczone do prezentacji klientowi wymaga odrębnej kontroli jakości i jawnego zatwierdzenia dokładnej wersji raportu.

### Następny etap

Przejdź do przygotowania odpowiednich Draft PR i dokładnych kandydatów technicznych.

Zachowaj istniejące decyzje właścicielskie dotyczące PR #847/#848 i ich warunków — nie żądaj ponownie już udzielonych zgód.

Przed jakąkolwiek zmianą środowiska przedstaw:

- dokładny diff i SHA;
- dowody CI i regresji Benchmark Findera;
- przyjęcie kontraktów przez właściwych właścicieli;
- stan E1/Source i kosztów;
- LKG i rollback;
- listę pozostałych blokad.

**Zakaz merge, deploymentu, płatnych wywołań i publikacji pozostaje w mocy.**

### PMOS

Powyższe decyzje nie stanowią osobnej zgody na trwałą rejestrację poprzedniego audytu w PMOS.

Jeżeli do dalszego lifecycle potrzebny jest zapis, przedstaw dokładny zakres, miejsce i treść rejestracji do odrębnego zatwierdzenia. Nie obchodź wcześniejszej odmowy.


## Accepted conditions, retained verbatim

BC1: dziewięć elementów jest specjalizacją redakcyjną Oil. Mapowanie: analiza statystyczna -> wykresy i obie tabele; kalendarium -> przeszły i przyszły tydzień; realna gospodarka -> mechanizmy wydarzeń i Executive Snapshot; Procurement Insights -> końcowe 3–5 zdań; Header i caveats są wspólne. Formalne odejście od czterech top-level sekcji wymaga zgodnej rewizji kanonu nadrzędnego przed aktywacją.
BC2: zachować 4000 znaków łącznie z widocznymi nagłówkami, tabelami i tekstowymi etykietami wykresów; bibliografia i techniczne lineage osobno. Proponowany licznik: NFC, Unicode code points, jedna wersjonowana serializacja widocznego tekstu, LF liczone jako jeden znak; nie używać odmiennego licznika UTF-16 w innym rendererze. Nie wyłączać tabel ani ostrzeżeń bez osobnej decyzji.
BC3: nazwa historicalAverageVerificationPercent oznacza clamp(100 - mean(sMAPE_i),0,100), a nie mean(clamp(100-sMAPE_i,0,100)). Procent nie jest prawdopodobieństwem sukcesu. Trafność kierunku jest osobną miarą; Naive przewiduje brak ruchu.
BC4: Composer zwraca narrację i evidenceRefs oraz referencje do deterministycznych tabel/wykresów. Nie tworzy liczb tabel, cen, sMAPE ani ścieżek Forecast. Dziewięciosekcyjny schemat i renderer wymagają odrębnego wersjonowanego przyjęcia.
BC5: status sprawdzenia źródła opisuje próbę dotyczącą konkretnego URL i czasu; brak dostępu nie jest brakiem nowości. Historia UserID i kategoria pozostają prywatne do jawnego uprawnionego udostępnienia.
BC6: przyjęcie treści nie aktywuje #847/#848, nie zatwierdza produkcyjnego D7 ani wydania, Source grantów, budżetu lub publikacji raportu.

EP1: gpt-6.1-sol, reasoning.effort=medium, Responses, store=false, Standard, strict json_schema; wybór związany wyłącznie z operacją raportową. Nie ustawiać globalnego OPENAI_MODEL. Bez automatycznego fallbacku.
EP2: <=15000 tokenów wejścia planistycznie, <=8000 wyjścia łącznie z reasoning; dodatkowo całe serializowane body <=65536 bajtów UTF-8 lub osobno zatwierdzony limit dedykowanej operacji. Nie przesyłać pełnego D0.
EP3: dedykowany Source deadline=120000 ms po przyjęciu i instalacji; kandydat zewnętrznego deadline operacji=150000 ms, z osobnym zmierzeniem czasu admission/settlement; brak deklaracji SLA. Bieżąca polityka musi być świeżo odczytana przed wydaniem.
EP4: pierwsza próba bez hosted Web Search, background, tools i retry. GET modeli/statusu/anulowanie wymagają własnego przyjęcia, nie nieautoryzowanego HTTP.
EP5: przechować dokładny surowy wynik; COMPLETED/INCOMPLETE/REFUSED/FAILED/UNVERIFIED, model i wersje, request/response IDs, tokeny/latencję/koszt albo UNKNOWN. Człowiek zatwierdza dokładny hash raportu.
EP6: parametry specyfikują kandydata pilota; aktywacja wymaga wykazanego projektu klucza, D7 scope, E1/Source, rezerwacji kosztu, testów oraz oddzielnej decyzji wydania.

D4 also requires a later final explicit owner GO for one exact attempt. The USD5 envelope does not authorize spending the balance.
