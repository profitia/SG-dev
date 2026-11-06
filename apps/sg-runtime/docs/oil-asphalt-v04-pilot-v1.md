# Oil & Asphalt Market Outlook v0.4 — kontrolowany profil wewnętrzny

Status: PREPARED_NOT_ADMITTED. Kategoria: Asfalt drogowy. Autor: OpenAI przez osobne E1/Source, bez nowych connectorów Insights. Dwa PMOS: ARCH-OIL-ASPHALT-V04-CONSUMER-ADMISSION-20261105 i SG2-OIL-ASPHALT-V04-FIRST-REPORT-20261105. Rejestracja przygotowania nie oznacza instalacji, LIVE, końcowego model GO ani publikacji.

## Obowiązujący standard

Kanon v0.4 jest ACTIVE po #901: `Canon/v0.4-procurement-oil-insight-report-canon.md`, SHA-256 7ad7d1695e7fa608a38ae17b01b26cd9fd43e201e6b79d64a9a555d762399c4d. Własny profil `oil-asphalt-v04-internal-20261105` nie zmienia historycznego B1, jego walidatora 4000 znaków, forecast mathematics lub globalnego OPENAI_MODEL. Główny materiał: dwie rzeczywiste A4, około 6000–8000 znaków, osiem bloków/niewyłączone dziewięć elementów logicznych. Osiem niezależnych prognoz, wykresy i pełne metryki w aneksie. Znane kwoty/daty i wszystkie liczby są renderowane deterministycznie z dowodów; tekst AI ma wyłącznie interpretować.

Domyślny kalendarz kanoniczny: wtorek–poniedziałek Europe/Warsaw, z granicą wiedzy asOf. Specyfikacja wykonawcza preferuje 168 h dla jednej ewaluacji: kod obsługuje ten wariant jedynie jako jawnie oznaczony wyjątek wymagający dopuszczenia. Nie jest to zmiana domyślnej kadencji. asOf zostanie zamrożone po realnym pobraniu i kwalifikacji dowodów; czasy query/retrieval/publication/event/referencePeriod/availability są oddzielne. Zakres faktycznie pobrany i ewentualna luka względem końcowego asOf pozostają w coverage.

## Źródła i uprawnienia

Tylko istniejący Hub `/v1/acquire`, nowy caller `procurement-insights-oil-v04`, osobny ograniczony peer, oryginalna aktywna sesja osoby i centralne E1. Origin proof odpowiada rzeczywistemu źródłu sesji (istniejący portal), nie nowej fikcyjnej domenie. AppId/klucz konsumenta nie są pożyczone od Newsfeed. Serwer rozstrzyga uprawnienia i organizację. Bez prawidłowej sesji lub licencji: fail closed, bez ustawiania własnego ALLOW. Maksymalnie 12 intencji: NewsAPI 3, Brave 4, TE News 1, TE Calendar 2, TE Indicators 1, TE External Forecasts indicators 1. Markets OFF, bez retry. Warianty nieprzetestowane LIVE nie otrzymują takiej etykiety. Nie zmieniamy sześciu UNMETERED ani vendor keys.

Retencja raw/native 0 s. Tylko dopuszczone pochodne streszczenia, wybrane dane deterministyczne i publiczne metadata/refs/fingerprint/receipt trafiają do bundle. Discovery/snippet nie jest pełną publikacją ani niezależną weryfikacją. Brak potwierdzonego kalendarza: PARTIAL/BLOCKED_FOR_FULL. Nie tworzymy wyniku zdarzenia przyszłego. Region, ekspozycja i formuła cenowa są UNSPECIFIED do czasu rzeczywistej informacji; rekomendacje warunkowe.

Forecast: najpierw istniejący uprawniony odczyt kanonicznego, już policzonego wyniku (bez fit). Zamrożony D0 pozostaje wyłącznie oznaczonym fallbackiem referencyjnym: 2026-10-30 → 2026-11-06, EXPERIMENTAL_7D/PARTIAL_READY, brak przedziałów, brak zatwierdzonego rollover/PIT. Nie nazywamy go nową prognozą na tydzień publikacji. Fingerprint D0 ec11c696cdd4e9577c462fdadf45953aba57bb76d7281bf034363513dbde006b; osobna weryfikacja 251b521a3fa71441eab299e946f0fb7ab706027d85a23c234cade92830944da7.

## Wykonanie i budżet

Kandydat: gpt-6.1-sol, Responses, store=false, strict JSON schema, reasoning high, default service tier, limit wejścia 15000, limit output+reasoning 16000, body 65536 UTF-8, timeout 600000 ms. Bez background/storage, hosted search/tools, fallbacku, retry lub płatnego review. Model jest kandydatem, a aktualna dostępność i projekt klucza wymagają rzeczywistego potwierdzenia. Nie ma aktywnego model policy ani budżetu tej próby.

Admission GO obejmie oddzielne, wygasające Source bindings (v04, nie B1), read-only metadata modelu oraz jeden licznik dokładnego zamrożonego requestu, z osobno proponowaną rezerwą 0,10 USD o niepotwierdzonej taryfie. Model policy jest nieobecne do finalnego GO. Ostateczny request, SHA, bundle, token receipt, model/projekt, koszt i jego niepewność będą przedstawione przed generowaniem. Stare kwoty i wykorzystane liczniki nie są zerowane ani przenoszone.

Obecny CLI obsługuje przygotowanie research planu i projekcję zamrożonego Forecast. Adapter akwizycji i composer są funkcjami przygotowanymi do związania dopiero po przyjęciu instalacji. Rozkazy live wymagają aktualnych, sprawdzonych bindingów i odrębnego finalnego GO; stan przygotowania nie jest pełnym wykonaniem.

## Walidacja i telemetria

Testy: okna czasu/DST, wszystkie kryteria rzeczywistych providerów offline, granica asOf, brak przyszłego Actual, zamknięte osiem bloków i refs, zakaz liczb w narracji, zachowanie raw przed walidacją, brak automatycznego retry, UNKNOWN zamiast fikcyjnego zera. PDF QA: osobny syntetyczny materiał około 7100 znaków, faktycznie dwie A4, font 10,1 pt, wizualnie obejrzany; nie jest raportem rynkowym ani wynikiem OpenAI.

Telemetria: UTC oraz monotonic duration, runId, etap, status, provider/family/queryId, logical requests/confirmed upstream attempts/cache/unknown attempts, czas kwalifikacji/evidence/freeze/count/OpenAI/validation/render/editorial/end-to-end. Sentry otrzymuje wyłącznie techniczne dane bez treści, promptów, zapytań użytkownika, bearerów, tożsamości, prywatnych danych i raw payload. Brak dostarczenia telemetrii nie jest potwierdzeniem działania. Czas sprzed uruchomienia zegara pomiarowego: NOT_MEASURED. Oryginalna odpowiedź modelu jest zapisana przed parsowaniem i nigdy ręcznie zastępowana.

Niezależny Quality Gate porówna liczby i daty z bundle/Forecast, rzeczywiste refs/coverage, świeżość, kompletność ośmiu bloków, zakres 2A4, ryzyko nadmiernej pewności i przydatność dla kupca. Osobna recenzja redakcyjna jest niezależna od autora API; nie uruchamia płatnego modelu. Wynik PASS/NEEDS_REVISION/BLOCKED nie nadaje APPROVED_FOR_PUBLICATION. Każdy raport pozostaje HUMAN_REVIEW_REQUIRED.
