# DASHBOARD PREVIEW FORECAST RUNTIME & PERSISTENCE CANON

**Status:** CANONICAL
**Scope:** Forecast runtime architecture / persistence / PostgreSQL / reuse / compute efficiency
**Related application:** `apps/dashboard-preview`

---

# 1. PURPOSE

Ten dokument definiuje trwałe zasady dotyczące:

* Forecast runtime,
* Forecast persistence,
* Historical Verification persistence,
* PostgreSQL usage,
* reuse wyników,
* stale detection,
* Forecast Library,
* compute efficiency,
* on-demand forecasting,
* przyszłego warm-up / batch forecasting.

Celem jest zapewnienie:

```text
fast user experience
+
deterministic calculations
+
reuse between users
+
minimal unnecessary compute
+
simple architecture
```

Ten dokument nie definiuje Visual UX dashboardu.

Visual UX jest osobnym obszarem.

---

# 2. FIRST RULE — DISCOVER CURRENT DATA ARCHITECTURE BEFORE CHANGING IT

Przed implementacją Forecast persistence Visual Studio Code MUSI sprawdzić faktyczny obecny przepływ:

```text
Benchmark Finder
→ Dashboard Preview
→ Macrobond integration
→ persistence/cache/database
```

Należy ustalić:

* jaka baza danych jest obecnie używana,
* gdzie zapisywane są benchmark metadata,
* gdzie zapisywane lub cache'owane są dane Macrobond,
* jak działa preload/cache,
* jakie modele Prisma / tabele / repositories już istnieją,
* jaki runtime jest właścicielem persistence.

Nie wolno zakładać konkretnego schema lub database ownership wyłącznie na podstawie wcześniejszych eksperymentów.

---

# 3. FORECAST CORE REMAINS PROVIDER-NEUTRAL

Forecast Core odpowiada za matematykę.

Twardy boundary:

```text
Forecast Core
= compute

Forecast persistence layer
= remember

Dashboard Preview
= serve and visualize
```

PostgreSQL nie może stać się miejscem implementowania Forecast mathematics.

Dashboard Preview nie może implementować Forecast mathematics.

---

# 4. FORECAST LIBRARY

Persisted Forecast results należy traktować jako:

# SpendGuru Forecast Library

a nie wyłącznie jako transient cache HTTP.

Forecast Library przechowuje reusable analytical results związane z:

```text
benchmark
+
historical input state
+
forecast model
+
model/method version
+
forecast results
+
verification results
+
calculation metadata
```

Biblioteka powinna rosnąć wraz z realnym wykorzystaniem benchmarków.

Forecast Library nie jest wyłącznie cache latest result.

Jest to temporalna i audytowalna biblioteka Forecast Runs, w której wcześniejsze wyniki zachowują wartość jako:

```text
historical Forecast evidence
realized verification candidate
audit trail
analytical asset
```

---

# 5. CORE RUNTIME PATTERN

Podstawowa zasada:

```text
CHECK
→ REUSE
→ COMPUTE IF MISSING OR STALE
→ PERSIST
→ SERVE
```

Nie:

```text
REQUEST
→ ALWAYS COMPUTE FROM ZERO
```

Każde wywołanie Forecast capability powinno w pierwszej kolejności sprawdzić, czy istnieje aktualny reusable result.

Ten request-time pattern pozostaje wymaganym fallbackiem i safety netem.

Docelowy lifecycle Forecast Library nie powinien jednak zależeć wyłącznie od:

```text
user opens dashboard
```

---

# 6. USER-INDEPENDENT REUSE

Jeżeli dwóch użytkowników żąda forecastu dla:

```text
same benchmark
same historical input
same model
same method version
```

system powinien reuse'ować ten sam wynik.

Nie należy ponownie liczyć Forecast tylko dlatego, że:

* jest to inny użytkownik,
* inna sesja,
* inna karta przeglądarki,
* inny host Dashboard Preview.

Forecast results są związane z analytical input, a nie z konkretnym użytkownikiem.

Tenant/security boundaries muszą być respektowane tam, gdzie dane są tenant-specific.

---

# 7. HISTORICAL INPUT IDENTITY

Każdy persisted Forecast Run musi być jednoznacznie związany z historycznymi danymi użytymi do kalkulacji.

Preferowany mechanizm:

```text
historyFingerprint
```

lub równoważny deterministic input identity.

Fingerprint powinien reprezentować rzeczywisty stan lawful Historical observations użytych przez Forecast Core.

Może uwzględniać m.in.:

```text
series identity
observation dates
observation values
frequency
latest historical observation
```

Dokładny format należy dobrać podczas implementacji.

Nie budować nadmiernie skomplikowanego hashing frameworka.

---

# 8. STALE DETECTION

Persisted Forecast jest reusable tylko wtedy, gdy jego historical input state nadal odpowiada aktualnemu inputowi.

Przykład:

```text
Stored:
historyFingerprint = AAA
```

Current Macrobond history:

```text
historyFingerprint = AAA
```

Result:

```text
REUSE
```

Jeżeli nowa obserwacja powoduje:

```text
historyFingerprint = BBB
```

Result:

```text
OLD RESULT = historical/audit result
NEW RESULT = requires calculation
```

Nie wolno zwracać stale Forecast jako aktualnego bez jawnej decyzji.

---

# 9. MODEL / METHOD VERSION IS PART OF RESULT IDENTITY

Zmiana historycznych danych nie jest jedynym powodem invalidacji.

Jeżeli zmienia się lawful Forecast method implementation, persisted result może również stać się nieaktualny.

Dlatego Forecast Run powinien posiadać identity obejmującą odpowiednią:

```text
model
methodVersion
```

lub równoważne pole.

Nie wiązać wyników wyłącznie z nazwą:

```text
ETS
```

jeśli implementacja ETS może się zmienić.

---

# 10. FORECAST RUN

Forecast Run powinien logicznie opisywać pojedynczą kalkulację dla:

```text
benchmark
+
historical input state
+
model
+
method version
```

Powinien przechowywać minimum potrzebne do:

* odtworzenia provenance,
* określenia Forecast Origin,
* reuse wyniku,
* stwierdzenia stale/fresh,
* audytu calculation state.

Nie przechowywać niepotrzebnych technicznych szczegółów modelu bez wartości produktowej lub audytowej.

---

# 11. CURRENT FORECAST PERSISTENCE

Current Forecast powinien być persisted jako wynik Forecast Run.

Dla Monthly MVP może zawierać np.:

```text
1M
3M
6M
12M
```

lub canonical forecast point representation.

Dashboard nie powinien wymuszać ponownego fittingu modelu, jeśli aktualny Forecast Run istnieje.

Current Forecast jest lifecycle-specific surface.

Current Forecast może obejmować wyłącznie target periods znajdujące się poza:

```text
latest lawful known Actual
```

w canonical forecast frequency.

Twarda zasada:

> Current Forecast MUST NEVER overlap lawful known Actuals.

Jeżeli lawful Actual dla target period już istnieje, ten target nie może być dalej prezentowany jako Current Forecast.

---

# 12. HISTORICAL VERIFICATION PERSISTENCE

Historical Forecast Verification jest również reusable analytical result.

Powinna być persistowana w sposób umożliwiający odtworzenie:

```text
model
+
verification horizon
+
forecast origin
+
target date
+
forecast value
+
actual value
+
error/delta
```

Verification powinna być jednoznacznie identyfikowana co najmniej przez:

```text
benchmark
+
historical input state
+
model
+
method version
+
horizon
```

W aktualnym kanonie należy rozróżniać dwa różne typy verification provenance:

```text
A. Rolling-Origin Backtest Verification
B. Realized / Ex-post Verification
```

Obecny persisted verification layer dotyczy rolling-origin backtest verification.

Realized / Ex-post Verification jest osobnym canonical concept i osobnym future persistence concern.

---

# 13. CURRENT FORECAST AND VERIFICATION ARE LOGICALLY SEPARATE

Nie należy wymuszać jednego monolitycznego calculation object obejmującego zawsze:

```text
Current Forecast
+
full Historical Verification
+
all quality metrics
```

Current Forecast i Verification mają różny runtime cost i różny moment użycia.

Powinny móc być:

```text
computed independently
persisted independently
served independently
```

przy zachowaniu wspólnego provenance.

Ten dokument rozróżnia trzy różne runtime/product surfaces:

```text
Current Forecast
Realized / Ex-post Verification
Rolling-Origin Backtest Verification
```

Nie wolno ich mieszać ani prezentować jako tego samego typu evidence.

---

# 14. HISTORICAL CHART IS THE FAST PATH

Podstawowa UX/runtime zasada:

```text
Historical data
→ render as fast as possible
```

Forecast computation nie może blokować Historical Chart.

Docelowy flow:

```text
User selects benchmark
        ↓
Historical request
        ↓
Historical chart rendered
```

równolegle lub później:

```text
Forecast Library lookup
```

---

# 15. CURRENT FORECAST IS THE MEDIUM PATH

Jeżeli Current Forecast jest już persisted:

```text
Forecast Library HIT
→ serve immediately
```

Jeżeli nie istnieje lub jest stale:

```text
compute
→ persist
→ serve
```

Current Forecast nie powinien automatycznie wymagać pełnego rolling-origin backtestu.

---

# 16. HISTORICAL VERIFICATION IS THE HEAVIER PATH

Historical Verification jest potencjalnie znacznie droższą kalkulacją.

Preferowany flow:

```text
Historical
    ↓
Current Forecast
    ↓
Historical Verification when needed
```

Nie należy automatycznie wykonywać ciężkiego full backtestu dla każdego użytkownika i każdego otwartego wykresu, jeśli użytkownik go nie potrzebuje.

---

# 17. LAZY / ON-DEMAND COMPUTE

Domyślna zasada:

```text
compute expensive analytical capability when needed
```

Samo otwarcie dashboardu nie powinno bezwarunkowo uruchamiać:

* wszystkich modeli,
* wszystkich horizons,
* wszystkich verification runs,
* wszystkich quality metrics.

Zakres pre-compute może być zwiększony dopiero po realnych pomiarach runtime.

---

# 18. COMPUTE ONCE PER INPUT STATE WHERE POSSIBLE

Jeżeli wynik jest deterministyczny, nie powinien być liczony wielokrotnie dla tego samego inputu.

Conceptually:

```text
first qualifying request
        ↓
calculate
        ↓
persist
        ↓
next requests
        ↓
reuse
```

Forecast Library ma eliminować powtarzanie tej samej pracy.

---

# 19. CONCURRENT REQUEST DEDUPLICATION

Docelowa implementacja powinna unikać sytuacji:

```text
10 users request same missing forecast
→ 10 identical expensive calculations
```

Preferowany rezultat:

```text
first calculation starts
other requests detect calculation/current result
→ reuse when available
```

Należy zastosować najprostszy mechanizm zgodny z istniejącą bazą/runtime.

Nie budować distributed locking infrastructure bez potrzeby.

---

# 20. BACKTEST OPTIMIZATION — FIT ONCE PER ORIGIN

Independent Forecast review wykazał, że część obecnego runtime cost wynika z ponownego fittingu tego samego origin dla różnych horizons.

Preferowany future optimization:

```text
origin T
    ↓
fit model once
    ↓
forecast up to max required horizon
    ├── extract 1M
    ├── extract 3M
    ├── extract 6M
    └── extract 12M
```

Nie:

```text
fit model separately for 1M
fit model separately for 3M
fit model separately for 6M
fit model separately for 12M
```

Optymalizacja nie może zmieniać locked mathematical methodology ani backtest fairness.

---

# 21. POSTGRES PERSISTENCE

Jeżeli discovery potwierdzi PostgreSQL jako właściwą operational persistence warstwę dla Benchmark Finder / Dashboard Preview, Forecast Library powinna być implementowana w tej architekturze.

Preferujemy:

```text
existing operational database
+
separate clear Forecast domain tables/models
```

zamiast tworzenia:

```text
new standalone forecast database
```

bez rzeczywistej potrzeby.

Dokładne modele danych muszą wynikać z current architecture discovery.

---

# 22. DO NOT COUPLE FORECAST CORE TO POSTGRES

Nawet jeśli Forecast Library używa PostgreSQL:

```text
Forecast Core
```

musi pozostać provider-neutral i persistence-neutral.

Preferowany model:

```text
Historical Provider
        ↓
Canonical Time Series
        ↓
Forecast Core
        ↓
Forecast Result
        ↓
Persistence Adapter / Forecast Library
```

Nie:

```text
Forecast Core directly depends on specific Postgres tables
```

---

# 23. CURRENT LABORATORY PHASE

Obecne zweryfikowane Forecast Core rezultaty powstały na controlled PostgreSQL laboratory input.

To jest prawidłowy etap do:

* walidacji Forecast UX,
* walidacji contracts,
* walidacji persistence schema,
* walidacji backtest representation.

Nie oznacza to, że PostgreSQL laboratory dataset pozostaje docelowym providerem benchmark history.

---

# 24. TARGET MACROBOND PHASE

Docelowo użytkownik wybiera benchmark w Benchmark Finder.

Flow:

```text
Benchmark Finder
        ↓
selected Macrobond benchmark
        ↓
Historical data
        ↓
Canonical Time Series
        ↓
Forecast Library lookup
        ↓
reuse or Forecast Core compute
        ↓
persist
        ↓
Dashboard Preview
```

Zmiana source:

```text
Postgres laboratory input
→
Macrobond live benchmark input
```

nie powinna zmieniać Forecast mathematics.

---

# 25. FORECAST AVAILABILITY

Nie każdy benchmark dostępny w Macrobond musi być forecastable.

System powinien obsługiwać jawne capability states, np.:

```text
AVAILABLE
NOT_AVAILABLE
UNSUPPORTED
FAILED
```

Forecast Library nie może zakładać:

```text
discoverable benchmark
=
forecast-capable benchmark
```

---

# 26. DO NOT COMPUTE THE ENTIRE MACROBOND UNIVERSE

Macrobond może zawierać bardzo dużą liczbę serii.

Nie należy wykonywać Forecast computation dla wszystkich benchmarków.

Domyślny mechanizm:

```text
on-demand based on actual use
```

Forecast Library rośnie organicznie wraz z realnym wykorzystaniem aplikacji.

---

# 27. CURATED WARM-UP IS ALLOWED

W przyszłości można utrzymywać niewielką listę strategicznych benchmarków, np.:

```text
10–20 most popular benchmarks
```

i okresowo wykonywać dla nich Forecast warm-up.

Conceptually:

```text
for benchmark in POPULAR_BENCHMARKS:
    get current historical state
    check Forecast Library
    compute missing/stale results
    persist
```

Ten mechanizm powinien używać **tej samej Forecast Library i tego samego Forecast Core**, co on-demand requests.

Nie tworzyć osobnej logiki batch forecastingu.

---

# 28. NO HEAVY SCHEDULER YET

Na obecnym etapie nie budujemy bez realnej potrzeby:

* distributed scheduler,
* complex queue infrastructure,
* worker fleet,
* distributed computing cluster,
* sophisticated multi-level caching framework.

Najpierw:

```text
on-demand persistence
+
reuse
+
simple warm-up
+
runtime measurement
```

Dopiero realne bottlenecks uzasadniają dalszą infrastrukturę.

---

# 29. OLD RESULTS MAY BE PRESERVED

Kiedy historyczne dane się zmieniają i powstaje nowy Forecast Run, stary wynik nie musi być kasowany.

Może zostać zachowany jako:

```text
historical calculation record
audit evidence
previous Forecast Run
```

Current/latest state musi jednak być możliwy do jednoznacznego rozpoznania.

Forecast values MUST remain immutable.

Po nadejściu lawful Actual nie wolno:

```text
replace Forecast with Actual
rewrite earlier Forecast Run
overwrite earlier Forecast value
```

Prawidłowy model brzmi:

```text
earlier Forecast Point
+
later lawful Actual
=
Realized / Ex-post Verification
```

---

# 30. QUALITY METRICS

Metrics takie jak:

```text
MAE
RMSE
MASE
sMAPE
Directional Accuracy
Bias
```

mogą być częścią persisted Forecast quality evidence.

Nie oznacza to, że Dashboard musi pobierać je przy każdym otwarciu.

Persistence i transport do UI należy rozdzielić.

---

# 31. DATABASE IS NOT THE UX CONTRACT

Dashboard Preview nie powinien znać tabel PostgreSQL bezpośrednio.

Preferowany boundary:

```text
Database
    ↓
Forecast Library service/repository
    ↓
Forecast application contract
    ↓
Dashboard Preview
```

UX powinien otrzymywać canonical forecast structures, nie database rows.

---

# 32. PERSISTENCE MUST NOT CHANGE MATHEMATICS

Cache, persistence, reuse i batch warm-up nie mogą powodować zmiany:

* model formulas,
* fitting rules,
* expanding-window rolling-origin methodology,
* lawful Historical training data,
* Forecast Origin rules,
* error convention.

Mathematical authority pozostaje w Forecast Core authority documents.

---

# 33. NO LLM FORECAST GENERATION

LLM nie generuje Forecast values.

LLM nie może zastępować persisted deterministic Forecast Core result.

---

# 34. OBSERVABILITY

Każdy Forecast result powinien umożliwiać ustalenie minimum:

```text
what benchmark
what model
what input state
what Forecast Origin
when calculated
what method/version
whether current or stale
```

Nie budować ciężkiej observability platformy.

Wystarczy metadata potrzebne do audytu i diagnostyki.

---

# 35. FAILURE BEHAVIOR

Jeżeli Forecast calculation zakończy się błędem:

```text
Historical Chart
```

musi nadal działać.

Nie wolno blokować benchmark visualization przez Forecast failure.

Forecast może zwrócić:

```text
FAILED
```

z możliwością późniejszego retry.

---

# 36. FORECAST LIBRARY IS A PRODUCT CAPABILITY

Forecast persistence nie jest jedynie techniczną optymalizacją.

Z czasem Forecast Library tworzy reusable SpendGuru analytical asset obejmujący popularne benchmarki.

Conceptually:

```text
SpendGuru Forecast Library
        │
        ├── Brent
        │     ├── Forecast Runs
        │     └── Verification
        │
        ├── WTI
        │     ├── Forecast Runs
        │     └── Verification
        │
        ├── Copper
        │
        └── ...
```

Ta biblioteka może później wspierać także inne moduły SpendGuru.

---

# 37. IMPLEMENTATION SEQUENCE

Preferowana kolejność:

```text
1. Discover current Benchmark Finder / Macrobond persistence architecture

2. Define minimum Forecast Library persistence schema

3. Connect existing verified Forecast Core outputs

4. Persist Current Forecast

5. Persist Historical Verification

6. Implement check → reuse → compute → persist

7. Validate with controlled laboratory benchmarks

8. Connect live Macrobond Canonical Time Series

9. Measure actual latency

10. Optimize backtest compute

11. Add simple curated warm-up if valuable

12. Consider heavier infrastructure only if measurements justify it
```

---

# 38. AUTHORITY RULE

Każdy przyszły task dotyczący:

* Forecast persistence,
* Forecast database schema,
* Forecast caching,
* Forecast calculation triggers,
* Verification persistence,
* Macrobond Forecast runtime,
* Forecast warm-up,
* batch calculation,
* Forecast performance optimization

MUSI najpierw przeczytać i respektować:

```text
DASHBOARD_PREVIEW_FORECAST_RUNTIME_PERSISTENCE_CANON.md
```

Jeżeli task wymaga odstępstwa, powinno ono zostać jawnie opisane i uzasadnione.

---

# 39. CORE PRINCIPLE

Najważniejsza zasada:

> Forecast computation should be performed only when a valid reusable result does not already exist for the same benchmark, historical input state and model version. Persist deterministic Forecast and Verification results as a reusable SpendGuru Forecast Library, render Historical data independently and quickly, grow the library primarily through real user demand, and add lightweight curated warm-up only where it creates measurable user value.

---

# 40. FORECAST LIFECYCLE

Fundamentalny lifecycle Forecast Library brzmi:

```text
LAWFUL ACTUAL HISTORY
        ↓
latest lawful period = N
        ↓
Forecast Origin = N
        ↓
Current Forecast:
N+1
N+2
N+3
...
        ↓
new lawful Actual arrives
        ↓
forecast target matched by Actual
        ↓
that earlier Forecast Point becomes
REALIZED / EX-POST VERIFICATION
        ↓
lawful Historical Input State advances
        ↓
new Forecast Origin = new N
        ↓
new Current Forecast starts at new N+1
```

Ten lifecycle jest canonical principle Forecast Library.

---

# 41. NO-OVERLAP INVARIANT

Current Forecast MUST NEVER overlap lawful known Actuals.

Current Forecast może obejmować wyłącznie target periods, dla których nie istnieje jeszcze lawful Actual w canonical forecast frequency.

Conceptually:

```text
ACTUAL                           CURRENT FORECAST
────────────────────────●────────────────────────────>
                        N
                  Forecast Origin
                          \
                           N+1
                           N+2
                           N+3
```

Jeżeli lawful Actual dla `N+1` już istnieje, wcześniejszy Forecast Point `N+1` nie jest już Current Forecast.

Może pozostać:

```text
AVAILABLE
ALIGNED
historically preserved
```

ale nie jest już lifecycle-current.

---

# 42. REALIZED / EX-POST VERIFICATION

Realized / Ex-post Verification oznacza rzeczywisty historyczny Forecast Point wygenerowany wcześniej przez SpendGuru jako Current Forecast, dla którego później pojawił się lawful Actual dla tego samego canonical target period.

Definicja:

> Forecast Point generated earlier as Current Forecast becomes Realized / Ex-post Verification when a lawful Actual becomes available for the same lawful target period.

Przykład:

```text
September 2026

Forecast Origin:
2026-09

Current Forecast:
2026-10 = 125
```

później:

```text
Macrobond Actual:
2026-10 = 121
```

wtedy wcześniejszy Forecast:

```text
Forecast 2026-10 = 125
```

nie jest już Current Forecast.

Staje się:

```text
Realized Forecast = 125
Actual = 121
Error = 125 - 121 = +4
```

Persistence intent for Realized / Ex-post Verification remains FUTURE IMPLEMENTATION WORK.

Ten task nie wprowadza jeszcze:

```text
realized verification tables
actual-matching service
lifecycle worker
batch refresh scheduler
```

---

# 43. BACKTEST VERIFICATION VS REALIZED VERIFICATION

Rolling-Origin Backtest Verification i Realized / Ex-post Verification mają różne provenance.

## A. Rolling-Origin Backtest Verification

To laboratoryjna/statystyczna metodologia:

```text
historical origin
→ fit using only information available then
→ historical target forecast
→ compare against known Actual
```

Służy do:

```text
model validation
comparative quality metrics
historical simulation
model evidence
```

## B. Realized / Ex-post Verification

To rzeczywisty wcześniej wygenerowany Forecast Run działającego SpendGuru:

```text
real Current Forecast generated at T
        ↓
time passes
        ↓
Actual becomes known
        ↓
compare stored Forecast with Actual
```

Służy do:

```text
production forecast accuracy
audit evidence
user-facing proof of forecast performance
real history of SpendGuru forecasting
```

Canonical rule:

```text
BACKTEST VERIFICATION
!=
REALIZED VERIFICATION
```

Obecnych `forecast_verification_*` nie wolno reinterpretować jako realized verification tylko dlatego, że przechowują forecast-vs-actual evidence.

---

# 44. DATA-DRIVEN REFRESH AND ON-DEMAND FALLBACK

Macrobond Actuals są upstream authority dla market-history recency.

Poprawna zależność brzmi:

```text
Macrobond Actuals
        ↓
canonical lawful Forecast input
        ↓
latest lawful period = N
        ↓
Forecast Core
        ↓
Current Forecast from N+1
```

Jednocześnie:

```text
raw provider observation
!=
lawful Forecast Core input period
```

Nowy provider row powinien uruchomić:

```text
evaluate forecast lifecycle
```

ale nie oznacza automatycznie:

```text
recompute every model immediately
```

Recompute Current Forecast jest wymagany wtedy, gdy zmienia się:

```text
lawful canonical Historical Input State
```

dla częstotliwości używanej przez Forecast Core.

Przykład bezpieczeństwa:

```text
display frequency = DAILY
forecast frequency = MONTHLY
```

Nowy daily tick nie oznacza automatycznie nowego lawful monthly Forecast Origin.

Docelowy target behavior:

```text
Macrobond hydration / ingestion
        ↓
new provider observations stored
        ↓
evaluate canonical Historical Input State
        ↓
did lawful Forecast input change?
   │
   ├── NO
   │     ↓
   │   no Forecast recompute required
   │
   └── YES
         ↓
      realize eligible earlier Forecast Points
         ↓
      new Current Forecast calculation
         ↓
      persist new Forecast Run
```

Request-time path pozostaje wymaganym fallbackiem:

```text
CHECK
→ REUSE
→ COMPUTE IF MISSING OR STALE
→ PERSIST
→ SERVE
```

Forecast Library może więc docelowo mieć dwa complementary triggers:

```text
A. DATA-DRIVEN REFRESH
B. ON-DEMAND FALLBACK
```

---

# 45. CANONICAL ACTUAL MATCHING AND PARTIAL PERIOD SAFETY

Realized Verification może zostać utworzone wyłącznie wtedy, gdy Forecast target i Actual odnoszą się do tego samego lawful canonical period.

Canonical rule:

```text
Forecast target period
=
Actual canonical period
```

Nie wolno matchować wyłącznie po przypadkowym raw timestampie, jeśli Forecast frequency operuje na period semantics.

Jeżeli Forecast Core działa MONTHLY, a provider daje DAILY observations, to:

```text
first daily observation in October
!=
lawful monthly Actual for October
```

Partial periods MUST NOT be prematurely realized.

Ten canon nie definiuje jeszcze methodology:

```text
DAILY → MONTHLY
```

Lifecycle obowiązuje dopiero po uzyskaniu lawful canonical period.

---

# 46. FORECAST LIBRARY AS TEMPORAL PRODUCT MEMORY

SpendGuru Forecast Library należy rozumieć jako temporalną bibliotekę Forecast Runs, a nie tylko cache latest result.

Conceptually:

```text
Benchmark
│
├── Forecast Run @ Origin N1
│   ├── future point
│   ├── realized point
│   └── realized point
│
├── Forecast Run @ Origin N2
│   ├── realized point
│   └── future point
│
└── Current Forecast Run @ latest N
    ├── N+1
    ├── N+2
    └── ...
```

Wcześniejsze Forecast Runs mają trwałą wartość jako analytical asset i audit trail.

---

# 47. MONTHLY LIFECYCLE EXAMPLE

### September

```text
Actual:
... → 2026-09

N:
2026-09

Forecast Origin:
2026-09

Current Forecast:
2026-10 = 125
```

### October Actual arrives

```text
Actual:
2026-10 = 121
```

Then:

```text
Old Forecast:
2026-10 = 125

Realized Verification:
Forecast = 125
Actual = 121
Error = +4
```

Historical state advances:

```text
new N = 2026-10
```

New Current Forecast:

```text
Forecast Origin = 2026-10

First Forecast Target:
2026-11
```

No overlap exists.

---

# 48. RECOMMENDED FUTURE IMPLEMENTATION DIRECTION

Recommended next lifecycle sequence:

```text
1. Macrobond Actual arrives

2. Determine whether lawful canonical Historical state changed

3. Match newly lawful Actual periods
   against earlier Current Forecast Points

4. Materialize Realized / Ex-post Verification

5. Advance N

6. Recompute Current Forecast from new N

7. Persist new Forecast Run

8. Dashboard consumes:
   Historical Actual
   +
   Realized Verification
   +
   Current Forecast
```

Logical next task after this canon update:

```text
Forecast Lifecycle & Realized Verification Persistence Foundation
```

whose purpose should be to inspect the current `forecast_current_*` and `forecast_verification_*` schema and design the minimum lawful persistence model for:

```text
earlier persisted Forecast Point
+
later lawful Actual
=
Realized Verification
```

without changing Forecast Core mathematics and without mutating existing backtest artifacts.
