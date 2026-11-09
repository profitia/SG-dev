# Harmonogramy publikacji — SourceHub, ECR Stage 01

Profil ARCHITECTURE, wyłącznie Development. Kanon ECR v1.2 pozostaje bez zmian.
Kontrakt harmonogramu **1.2.0**, SDK **1.5.0**. Starsze kontrakty Hub1.0.0
i commodity1.1.0 oraz ich operacje pozostają dostępne bez zmiany semantyki.
To źródło harmonogramu; nie jest to runtime, scheduler ani historia ECR.

## Odczyt

Istniejący klient `@profitia/platform-source-hub-contracts/client` wywołuje
`POST /v1/acquire`. Korzysta z własnego istniejącego podpisu komponentu,
bieżącego SERVICE/HUMAN E1, uprawnienia `knowledge.read / market` do dokładnego
zasobu i niezależnego Source Admission. Poświadczenia providera nie są kryteriami.

| Dostawca | Request 1.2.0 / criteria | Kanał źródłowy |
| --- | --- | --- |
| commodities-sh | `publication-calendar / calendar`, opcjonalnie `limit` | `https://api.commodities.sh/v1/calendar` |
| eia | `publication-calendar / calendar`, `publication=wpsr`, `from`, `to`, opcjonalnie `limit` | `https://www.eia.gov/petroleum/supply/weekly/schedule.php` |
| eia | jak wyżej, `publication=steo` | `https://www.eia.gov/outlooks/steo/release_schedule.php` |

Daty `from/to` to dni lokalne harmonogramu, włącznie. Maksymalnie 366 dni
i 1000 rekordów odpowiedzi ograniczają rozmiar operacji; nie są budżetem wywołań.
Nie ma automatycznego ponawiania. Każdy nowy odczyt ma nowy klucz idempotencji.
Retencja 0 uniemożliwia odtwarzanie starego wyniku po tym samym kluczu.

## Znaczenie odpowiedzi

- `scheduleId` to identyfikator zwrócony przez dostawcę albo `null`.
  Brak ID nie jest zastępowany indeksem tablicy. `correlationKey` to wskazówka
  oparta na jawnych faktach, nie zaakceptowana tożsamość wydarzenia.
  Obecność ID nie dowodzi jego wieloletniej stabilności.
- `publicationRef` rozróżnia definicję publikacji. ECR później przyjmie
  właściwą korelację wielu dostawców; SourceHub nie scala ich wydarzeń.
- `scheduledAt` jest terminem planowanym, `scheduledUntil` końcem zwyczajowego
  okna publikacji, `dateOnly` datą lokalną. `timePrecision` opisuje dokładność.
  Nie przypisujemy północy UTC do daty bez godziny.
- `America/New_York` jest przeliczana z użyciem reguł IANA, w tym DST.
  Nieistniejące lub niejednoznaczne godziny lokalne są odrzucane.
- WPSR: jawny wyjątek z oficjalnej tabeli zastępuje standardową środę 10:30.
  Pozostałe terminy wynikające z reguły mają status
  `RULE_DERIVED_UNCONFIRMED`: nie dowodzą braku późniejszych wyjątków.
- STEO: konkretna data pochodzi z tabeli wydań. Typowe 12:00–12:15 jest
  oznaczonym oknem, a nie gwarantowaną godziną publikacji.
- `referencePeriod` dla WPSR oznacza tydzień kończący się wskazanego dnia;
  dla STEO identyfikuje wydanie miesięczne, nie horyzont prognozy.
- `sourceTiming` zachowuje ograniczone tekstowe informacje o terminie,
  cykliczności i wskazówce dostawcy; nie zawiera całego payloadu.
- `lastVerifiedAt=metadata.retrievedAt` odsyła do rzeczywistego czasu odczytu.
  Ten czas nie wpływa na fingerprint treści. Kolejność rekordów nie jest ID.
- `actual`, `previous`, `forecast`, `publishedAt` i `sourceUpdatedAt` pozostają
  `null`. Termin WPSR nie dowodzi dostępności wyników w APIv2.
- `coverage.scope=SOURCE_SCHEDULE_PROJECTION` odróżnia projekcję reguł od
  bezpośrednich wierszy API. `providerRows=null` oznacza brak policzonej
  liczby źródłowych wierszy EIA; `ruleDerived` liczy terminy wynikające z reguły.
  Żaden wynik nie deklaruje kompletności całego kalendarza dostawcy.

Źródła i ograniczenia: [oficjalne harmonogramy EIA](https://www.eia.gov/reports/upcoming.php),
[wyjątki WPSR](https://www.eia.gov/petroleum/supply/weekly/schedule.php),
[STEO](https://www.eia.gov/outlooks/steo/release_schedule.php),
[robots.txt EIA](https://www.eia.gov/robots.txt),
[EIA Copyrights & Reuse](https://www.eia.gov/about/copyrights_reuse.php),
[commodities.sh reference](https://commodities.sh/docs/reference).
Sprawdzone 2026-11-09. Jawne ścieżki EIA są dozwolone przez robots.txt.
Nie pobieramy RSS ani innych zabronionych katalogów. Nie ma ogólnego scrapera,
arbitralnych adresów, redirectów, płatnych operacji lub x402.

## Dokładna, odrębna aktywacja właścicielska EIA

Nowa operacja jest domyślnie wyłączona. Sam zapis źródeł nie udziela dostępu.
[Gotowy packet](../operations/publication-schedule-owner-plan.json) i
[SQL Identity](../operations/enroll-publication-schedule-service.sql)
wymagają osobnego GO właściciela Source/Identity przed wykonaniem.

Zakres: istniejąca centralna baza Identity Development oraz istniejący Hub
`delicate-queen-44677134 / br-orange-salad-ba2llks7 / neondb`.
Migracja 007 rozszerza wyłącznie zgodną parę provider/family i metadane EIA.
Jedna nowa licencja/Source policy obejmuje tylko dwa wskazane GET na www.eia.gov,
UNMETERED, bez retencji, bez płatności i bez uprawnień do innych źródeł.
Jeden nowy grant `api.eia.publication-calendar / knowledge.read / market`
trafia do istniejącego `source-hub-catalogue-development`, zwykłej roli
`source_hub_catalogue_development_ingest`, organizacji
`225e465b-8b89-467d-92d1-7fef61b555fe`, do `2026-12-04T22:19:09Z`.
Nie powstają nowe role, klucze, komponenty lub zasoby.

Po GO i przyjętym exact-SHA CI: potwierdzić aktualny main, kolizje, role,
LSN/PITR i zachowany artefakt LKG. Zwykły migrator stosuje 007 przez istniejące
`db:migrate` z `SOURCE_HUB_INSTALL_FIRST_PARTY=true` oraz
`SOURCE_HUB_INSTALL_PUBLICATION_SCHEDULES=true`; pozostałe opcje instalacji
pozostają wyłączone. Oddzielny `installPublicationScheduleSource` wymaga dokładnego
digestu JSON packetu i prawdziwej referencji decyzji. Identity SQL sprawdza
ten sam pełny packet i bieżący klucz istniejącego komponentu.
Zmiana `SOURCE_HUB_EIA_SCHEDULES_ENABLED=true` następuje dopiero po instalacji
i readbacku. Wszystkie pobrania wykonuje istniejący klient i transport należący do SourceHub.

Po wdrożeniu użyć `scripts/verify-publication-schedules.mjs`: po dwa odczyty
commodities.sh, WPSR i STEO przez SourceHub. Receipt potwierdzić w Source.
Skrypt zapisuje wyłącznie liczniki, fingerprinty i dowody operacyjne.
Różnica terminu WPSR u agregatora i oficjalnego źródła jest różnicą danych,
nie powodem zmiany oficjalnego harmonogramu lub arbitralnego scalenia ID.

Sekrety: EIA APIv2 zachowuje istniejący klucz w magazynie usługi; publiczne
harmonogramy EIA i darmowy kalendarz commodities.sh nie otrzymują kluczy.
Załączone klucze nie upoważniają do płatnych endpointów. Chroniony klucz SERVICE
pozostaje w istniejącym magazynie poza Git. Żadnych sekretów ani pełnych
payloadów w logach, PMOS, PHR lub tym dokumencie.

Monitoring: REUSED — istniejące zdarzenia Hub obejmują provider/family,
czas, wynik, liczbę rekordów, cache i liczbę prób bez treści harmonogramów.
Rollback: wyłączyć nową flagę i nowy grant/licencję przez ownera; zachować
audyt oraz addytywny schemat. W razie własnej regresji użyć zweryfikowanego
zachowanego artefaktu usługi po ponownym sprawdzeniu kolejki. Nie odtwarzać
globalnej bazy i nie cofać cudzych wdrożeń.
