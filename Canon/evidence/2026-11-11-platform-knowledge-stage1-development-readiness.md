# Platform Knowledge — dowody gotowości etapu 1 na Development

Data: 2026-11-11, Europe/Warsaw. Owner: Architecture Platform / ARCHITECTURE. Zadanie: `ARCH-PK-STAGE1-DEVELOPMENT-ACTIVATION-20261111`. Podstawa: [zaakceptowany harmonogram, etap 1](../runbooks/platform-knowledge-development-delivery-plan-v1.md), [foundation](../runbooks/platform-knowledge-development-foundation-v1.md), [kanon v1, rewizja 4](../v1.0-platform-knowledge-business-and-architecture-canon.md).

**Wynik: gotowość etapu 1 potwierdzona.** Działają dwa bootstrapy `FOUNDATION_ONLY`, z wyłączonym przetwarzaniem dokumentów. Warunki do realizacji silnika są przygotowane; ten dowód nie jest odbiorem biblioteki etapu 2 ani końcowego SpendGuru etapu 3.

## Kryteria etapu pierwszego

| Kryterium harmonogramu | Dowód | Wynik i granica |
|---|---|---|
| Jednoznaczne kontrakty i właściciele zależności | `@profitia/platform-knowledge-contracts` 0.1.0, schematy, typy, semantyka i macierz adopcji; foundation §1–2 | PASS przygotowania. ACG-QUERY, CIC-QUERY, E1-PRIVATE, Identity lifecycle i SG2 host mają dokładny zakres i właścicieli; ich implementacja nie jest przedstawiana jako gotowa |
| Routing i wymagane dopuszczenia | PR [#999](https://github.com/profitia/SG-dev/pull/999), kontrolowane przyjęcie CI [#1000](https://github.com/profitia/SG-dev/pull/1000); PK-BASE-001–004; rejestracje PMOS | PASS. G1 źródeł nie staje się grantem dostępu do dokumentów, uprawnieniem E1 ani adopcją konsumentów |
| Pakiet zasobów, tożsamości i ograniczone role | Właściciel przygotował Neon i Render project/environment; po odrębnym upoważnieniu wykonawca dokończył usługi, GitHub, Sentry i konfigurację. Rzeczywiste readbacki poniżej | PASS. Migrator nie jest w runtime; brak tabel produktu i treści klientów |
| Budżet, dostawca, walidacja i recovery | Zatwierdzony istniejący klucz OpenAI, 10 USD / 1 USD na dokument, katalog modeli200; wersjonowany profil z 10 plikami; rzeczywisty build i smoke obrazu, procedura zatrzymania | PASS przygotowania. Trwały ledger, kontrola prywatności przed rzeczywistymi materiałami i testy jakości retrieval są warunkami aktywacji silnika w etapie 2 |

## Faktyczne zasoby i wdrożenia

Pełny odczyt bez sekretów: [manifest Development](../../apps/platform-knowledge-runtime/deployment/development.json) i [dowody maszynowe](../../apps/platform-knowledge-runtime/deployment/development-evidence.json).

- Render: workspace `tea-d7lps8rbc2fs73cn80dg`, projekt `prj-dbq52nbl550s739jii6g`, środowisko `evm-dbq534rl550s739jjma0`; Frankfurt, Docker, jedna instancja każdej usługi, auto-deploy Off, bez dysku i Redis.
- API: `srv-dbq6n2m7bikc73dmvs8g`, plan 0.5 CPU / 512 MB, [adres](https://platform-knowledge-development-api.onrender.com/health/live). Wydanie [dep-dbq71vutlv9c73epgb2g](https://dashboard.render.com/web/srv-dbq6n2m7bikc73dmvs8g/deploys/dep-dbq71vutlv9c73epgb2g), Live 13:44:02 UTC.
- Worker: `srv-dbq6njec6qcc738fjf50`, plan 1 CPU / 2 GB. Wydanie [dep-dbq72f5g1s2s739m10dg](https://dashboard.render.com/worker/srv-dbq6njec6qcc738fjf50/deploys/dep-dbq72f5g1s2s739m10dg), Live 13:45:01 UTC. Sprawdza bazę i pozostaje bezczynny, nie odpytuje kolejki.
- Końcowa rewizja obu usług: `1fef8b3837c1bdd6ea9ff95dd4e976cc71cf9526`, przyjęta przez PR [#1005](https://github.com/profitia/SG-dev/pull/1005). Render początkowo wdrożył różne nowsze rewizje main; porównanie zamkniętego kontekstu PK potwierdziło identyczny kod. Po ustawieniu konfiguracji obie usługi jawnie przypięto do przyjętej rewizji. Samo wywołanie operacji nie zostało uznane za wynik.
- Neon: projekt `sparkling-sky-79692560`, gałąź `br-billowing-grass-b9ko5s4f`, baza `platform_knowledge`, PostgreSQL18.6, pgvector0.8.6, schemat `platform_knowledge`, zero obiektów produktu. Role owner NOLOGIN i trzy ograniczone LOGIN; API/Worker bez CREATE schematu i członkostwa owner; migrator NOINHERIT z jawnym SET ROLE owner poza runtime. Logowanie każdą rolą i ograniczenia potwierdzone.
- GitHub Environment `platform-knowledge-development`, ID26951998632, wyłącznie gałąź main (policy66315439); brak dodanych sekretów GitHub i zmian innych środowisk.

API `/health/live`200 i `/health/foundation`200 oznaczają działający bootstrap i potwierdzoną bazę. `/health/ready`503 oraz `/v1/import`503 są oczekiwane: capability produktu nie została aktywowana. Logi obu usług `FOUNDATION_PROBE_OK` mają Development i dokładny końcowy release; nie zawierają SQL ani connection strings.

## Storage, OpenAI i monitoring

Prywatny bucket `platform-knowledge-uploads` jest na tej samej gałęzi. Dla obu usług użyto osobnych poświadczeń o jawnych zakresach `storage:read` i `storage:write`, bez AI Gateway lub Functions. Region podpisu `eu-central-1` pochodzi z rzeczywistego `get_storage`, a adresowanie jest path-style. Autoryzowany ListObjectsV2 z MaxKeys=0 zwraca200 dla API i Workera; anonimowy HEAD403. Nie pobrano treści, nie uploadowano dokumentu i nie wykonano testu usuwania — to część etapu2.

W tej instalacji początkowe poświadczenie z samym `storage:write` zwracało403 AccessDenied również w oficjalnym kliencie S3. Zostało zastąpione jawnym read+write. Nie rozwiązano problemu przez publiczny bucket lub poszerzenie innych usług. Dwa zastąpione klucze są objęte osobnym potwierdzeniem ich unieważnienia; stan czyszczenia jest jawny w dowodzie maszynowym.

Właściciel zatwierdził zapis właściwego DATABASE_URL, poświadczeń storage i istniejącego klucza OpenAI bezpośrednio w dwóch usługach. Sekrety nie są częścią repozytorium, raportu lub dowodów. Migrator nie został przekazany do Render. TLS połączeń PostgreSQL jest jawnie `verify-full`. Klucz OpenAI z działającego API odczytał wyłącznie `/v1/models`200, potwierdzając `gpt-6-luna` i `text-embedding-3-small`; liczba płatnych generacji i żądań embeddingów wynosi0. Budżet startowy10 USD i limit1 USD/dokument są wejściem do trwałego ledgera etapu2, a nie deklaracją jego obecnej implementacji.

Sentry `profitia/platform-knowledge`, ID4512413142810704, otrzymało i pokazało kontrolowane zdarzenia syntetyczne z końcowej rewizji: [API182a959f](https://profitia.sentry.io/issues/160316211/events/182a959ff24b4509b87dfc1aab373810/?project=4512413142810704) i [Workerdbfef7cc](https://profitia.sentry.io/issues/160316211/events/dbfef7cc45c742c8aa5df3df3ab48860/?project=4512413142810704). Zdarzenia `FOUNDATION_PROBE_FAILED` są umyślnym testem transportu, **nie rzeczywistą awarią bazy**. Potwierdzono service, environment=development i release; nie przesłano dokumentów ani sekretów. Włączono wyłącznie error monitoring, bez tracing/profiling/logs/metrics i płatnych dodatków. To nie jest jeszcze monitoring procesów poznawczych.

## Weryfikacja źródeł, koszt i odzyskanie

Kontrakty i natywny bootstrap przyjęto w PR [#1004](https://github.com/profitia/SG-dev/pull/1004), merge `c4e0b750c7e7f32f9ae07c4274b90fc06378ebd4`. Własne CI końcowej wersji [43019062423](https://github.com/profitia/SG-dev/actions/runs/43019062423) PASS: 13 testów, build, rzeczywisty nonroot obraz linux/amd64, live200/ready503 bez zewnętrznej sieci, SIGTERM exit0, 10 rzeczywistych plików referencyjnych z DOC/PPT. Pliki i progi nie są dowodem jakości retrieval. Po potwierdzonych problemach resolvera Ubuntu zwykłe CI korzysta z prawdziwych DOC/PPT przyjętego przebiegu43018496713 (artefakt13854630194, digest SHA-256 `37035575edcb595b17c1ffd5656ae42ebfaf152debfdf655b18c65bf40f2c059`). Weryfikuje hashe plików oraz aktualne treści źródłowe TXT/MD i XML DOCX/PPTX; zmiana binarium, tekstu lub treści Word jest odrzucana. Oryginalny round-trip pozostaje dowodem historycznym, a nowy przebieg jest jawnie weryfikacją ponownego użycia, z kompletem10 plików. Regeneracja przez LibreOffice pozostaje dostępna. Własny workflow ma przypięte Ubuntu24.04, skończony czas kroku i nie zależy już od instalacji Office przez apt; nie zmienia progów ani testów produktu. Lokalny końcowy przebieg13/13 PASS; korekta instrukcji ról została osobno sprawdzona w PostgreSQL16.14: guard, powtórzenie bez zmiany haseł i ograniczone uprawnienia. Instrukcja nie zaleca już `psql \password` dla Neon i nie odtwarza istniejących ról.

Wyświetlone plany usług odpowiadały łącznie32 USD/miesiąc. To estymacja compute, bez metered Neon i rzeczywistego rachunku (NOT_MEASURED). Nie włączono autoscaling ani wyższych planów. Dostawca nie zwrócił digestu obrazu Render: nie utożsamiamy go z ID obrazu CI.

Przy pierwszym wdrożeniu poprzedni LKG nie istniał. Bezpieczne zatrzymanie obejmuje wyłącznie te dwie usługi; zachowuje Neon i prywatny bucket, bez globalnego restore lub kasowania schematu. Kolejne wydania wymagają zapisu rzeczywistego poprzedniego wydania i zgodności konfiguracji. Żadna migracja produktu nie została wykonana.

## Kontynuacja i granica ukończenia

Etap2 implementuje import, parsery/OCR, coverage, automatyczne opracowanie, embeddings, hybrid retrieval, trwałe zadania/ledger, panel administratora i wczesny adapter. Każdy owner przyjmuje swoje operacje i kontrakty we właściwym profilu. E1/Clerk nie są wywoływane dla każdego chunka; delegacja zadania i aktualne granice operacji pozostają wymagane.

Historyczna rejestracja G1 opisuje stan przy dopuszczeniu źródeł, przed tworzeniem runtime. Nie jest bieżącym odczytem zasobów ani samodzielną zgodą na ich utworzenie. Aktualne upoważnienia i binding tej capability opisują harmonogram, ten dowód i manifest aplikacji; nie zastępują topologii innych projektów.

Publikacja i closeout są przypisane do istniejących zadań PMOS/PHR: bootstrap kontraktów, Docker bootstrap, korekta instrukcji haseł i aktywacja Development. Ich końcowe potwierdzenia znajdują się w kanonicznej historii projektu. **Cała funkcjonalność Platform Knowledge pozostaje nieukończona, aż do potwierdzenia pełnego §29 kanonu i E3-01–E3-19 na Development.**
