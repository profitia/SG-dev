# Platform Knowledge — etap 1: integracja i pakiet przygotowania Development

Data: 2026-11-11, Europe/Warsaw. Owner: Architecture Platform / ARCHITECTURE. Podstawa: [zaakceptowany harmonogram](platform-knowledge-development-delivery-plan-v1.md), etap 1. **Stan: W_TOKU. Rejestracja G1 jest przyjęta na main; właściciel przygotował projekt Neon i projekt/środowisko Render. Pełna konfiguracja usług i adopcja kontraktów pozostają do potwierdzenia.**

## 1. Co ustalono na podstawie aktualnych źródeł

| Obszar | Potwierdzony stan | Konsekwencja dla realizacji |
|---|---|---|
| Memoros | Automat wykonuje compilation → chunking → embeddings → vector index → retrieval probe bez akceptacji każdego chunka | Adaptujemy kolejność i powiązania; nie kopiujemy runtime ani danych Memoros |
| Kompletność | Chunker może zgubić końcówkę długiego akapitu po ostatniej interpunkcji; pojedyncze długie zdanie może przekroczyć limit znaków | Wymagany podział zachowujący zakresy źródła i test odtworzenia treści przed analizą AI |
| Gotowość Memoros | Próba wyszukania używa znanego threadId i tytułu/identyfikatora | Nie jest dowodem odkrycia dokumentu naturalnym pytaniem; nowy profil walidacji ma dokumenty konkurujące |
| Odzyskiwanie | Orkiestracja uruchamia zadanie w procesie i pomija running; brak widocznej w tym mechanizmie dzierżawy porzuconego zadania | W Platform Knowledge zadania muszą mieć trwałe przejęcie, heartbeat, checkpoint i fencing |
| ACG 2.0 | ACTIVE_VIEW, maksymalnie czterech producentów, 16000 bajtów na wynik i 24000 łącznie; brak źródła Platform Knowledge | Potrzebna nowa rodzina żądań zapytaniowych oraz tokenowy budżet, z zachowaniem dotychczasowej ścieżki |
| CIC i host SG2 | Host korzysta z cic-core 1.6.0; selekcja i historia są związane z istniejącymi źródłami i widokiem | Właściciel CIC przyjmuje plan zapytania, SG2 przyjmuje nowe scope i projekcje historii; nie kopiujemy pełnej historii do PK |
| E1 | knowledge.read to market_knowledge / SHARED_KNOWLEDGE; knowledge.ingest to wspólny ingest PLATFORM; ACCOUNT_PRIVATE istnieje dla konta i historii | Żadna z tych operacji nie daje automatycznie prawa do prywatnych dokumentów, pamięci lub ich technicznego usuwania |
| Identity | W przejrzanych źródłach Identity i platform-contracts brak gotowego polecenia likwidacji konta dla PK | Potrzebna wersjonowana komenda istniejącego cyklu życia i trwałe potwierdzenie; implementacja u właściwego ownera |
| Zasoby | Workspace Render PROFITIA i organizacja Neon Scale potwierdzone; nie znaleziono dedykowanej usługi ani projektu Platform Knowledge | Przygotowanie wskazanych niżej zasobów wykonuje właściciel; nie wykorzystujemy PMOS, laboratoriów lub bazy Memoros do produktu |

Źródła odczytu: [Memoros processing](https://github.com/profitia/MEMOS_Profitia/blob/main/apps/api/src/knowledge/knowledge-processing.service.ts), [chunker](https://github.com/profitia/MEMOS_Profitia/blob/main/apps/api/src/chunking/chunking.service.ts), [ACG](https://github.com/profitia/SG-dev/blob/main/packages/assistant-context-gateway/src/index.mjs), [E1](https://github.com/profitia/SG-dev/blob/main/packages/platform-contracts/src/operation-context.mjs), [host SG2](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/assistant/runtime.ts), [CIC amendment](https://github.com/profitia/conversational-intelligence-core/blob/main/docs/Assistant-Context-and-Capability-Integration-Amendment-v1.1.md). Odczyt źródeł nie potwierdza wdrożenia nowych operacji.

## 2. Kontrakt docelowy i przyjęcie przez właścicieli

Rodzina `profitia.platform-knowledge` v0.1.0 jest transportowo neutralna i niezależna od ACG. Publiczny pakiet określi import, stan przetwarzania, wyszukiwanie, paczkę kontekstu, pamięć i cykl życia. Konsument nie czyta tabel ani prywatnych modułów aplikacji.

| Element | Uzgodniona semantyka |
|---|---|
| Zadanie | ANSWER, DOCUMENT_SUMMARY, MEMORY_RECALL; podsumowanie wymaga wszystkich części wskazanego dokumentu |
| Zapytanie | Naturalny tekst i język, opcjonalne jawne documentIds dla pracy na wskazanym pliku; odkrycie źródła działa bez documentId, tytułu i ukrytej referencji |
| Zakres | PROFITIA_SHARED i ACCOUNT_PRIVATE; właściciel prywatny to wewnętrzny UserID właściwego środowiska, ownerOrganisationId=null |
| Zaufanie | Kontekst tożsamości i dopuszczenie operacji pochodzą z serwera i istniejącego E1; pola z przeglądarki, identyfikator w kolejce i JSON ALLOW nie nadają praw |
| K4/K5 | Ograniczenia źródła są łączne; nieznana klasyfikacja nie przypisuje organizacji ani szerszych praw; organizacyjny warunek dostępu nie udostępnia prywatnej biblioteki organizacji |
| Budżet | maxTokens paczki obejmuje treść, metadane i cytowania; tokenizer odpowiada modelowi; PK szereguje lokalnie, ACG dzieli między producentów, host rezerwuje całe okno |
| Wynik | Evidence z dokumentem, wersją i generacją, lokalizacją, treścią wspierającą twierdzenie, kompletnością, rangą i ograniczeniami; jawne pominięcia i następny odczyt |
| Brak wyniku | EMPTY, INSUFFICIENT_EVIDENCE, PARTIAL, DENIED, UNAVAILABLE lub STALE, bez ujawniania istnienia cudzych materiałów |
| Likwidacja konta | Polecenie Identity z commandId, środowiskiem, kanonicznym UserID, zakresem i datą; natychmiastowa blokada użycia, trwała idempotentna realizacja, potwierdzenie; bez aktywnej sesji |

| Zależność | Owner | Co jest gotowe w etapie 1 | Co musi być przyjęte w etapie 2 przed rzeczywistą integracją |
|---|---|---|---|
| PK-CONTRACT | ARCHITECTURE | Publiczne schematy, wersje i testy semantyki | Serwer, storage i rzeczywiste operacje |
| ACG-QUERY | ARCHITECTURE | Kształt demand/result i zasada zachowania istniejącego ACTIVE_VIEW | Adapter i obsługa tokenowego budżetu; regresja obecnych producentów |
| CIC-QUERY | CIC | Dokładna potrzeba planowania, zakres wejścia/wyjścia i zestaw scenariuszy | Przyjęty pakiet CIC planujący nową rodzinę; osobne zadanie właściwego profilu |
| E1-PRIVATE | ARCHITECTURE | Lista klas i operacji: dokument import/read/search/delete, pamięć read/write/forget, publikacja wspólna, zadanie i cleanup | Wersjonowany kontrakt operacji i instalacja przez właściwą rolę; brak odziedziczenia knowledge.read |
| IDENTITY-LIFECYCLE | ARCHITECTURE | Kształt komendy i potwierdzenia, rozdzielenie konta/członkostwa/abonamentu | Wiarygodny producent komendy, trwałe dostarczenie/retry, testy zakresu i usuwania bez sesji |
| SG2-HOST | SG2 | Opis uploadu, opt-in pamięci, projekcji cytowań i unieważnienia historii | Przyjęcie kontraktów w hoście i historii, prawdziwa tożsamość, konfiguracja i testy kont |

Gotowa specyfikacja nie jest gotową adopcją. Statusy implementacji i instalacji pozostają oddzielne. Przyjęcie zmian w istniejących ACG/E1/Identity/SG2/CIC wymaga własnych dokładnych target paths i bramek; ten dokument nie przenosi ich ownership do PK.

## 3. Jeden pakiet przygotowania zasobów dla właściciela

Pakiet dotyczy wyłącznie Development. Właściciel tworzy i przygotowuje zasoby; wykonawca weryfikuje identyfikatory, granice i ograniczone dostępy. Nie przesyłać sekretów przez rozmowę ani Git. Etap pozostaje W_TOKU do potwierdzenia poniższych danych.

### 3.1. Neon

1. W istniejącej organizacji `org-nameless-field-92563437` utwórz projekt **Platform Knowledge Non-Prod**, region **AWS Europe Frankfurt / aws-eu-central-1**, Postgres 18.
2. Domyślną gałąź nazwij **development**. Konsola może utworzyć ją początkowo jako production; etykieta nie stanowi dopuszczenia do środowiska Production. Nie podłączaj baz istniejących PMOS, laboratoriów, Source Hub lub Memoros.
3. Utwórz bazę **platform_knowledge**. Początkowo minimum 0.25 CU, maksimum 1 CU, scale-to-zero po 5 minutach bezczynności, o ile aktualny plan konta to umożliwia. Ciągłe odpytywanie kolejki będzie podtrzymywało compute; nie zakładamy zerowego kosztu podczas pracy workera.
4. W tej bazie włącz `vector` przez SQL Editor: `CREATE EXTENSION IF NOT EXISTS vector;`. Potwierdzenie odczytem: `SELECT extname, extversion FROM pg_extension WHERE extname='vector';`.
5. Przygotuj prywatny bucket **platform-knowledge-uploads** na tej samej gałęzi, access **private**. Endpoint i poświadczenia S3 mają być ograniczone do właściwej gałęzi. Nie włączaj public_read, CDN lub publicznych listingów. Nie twórz kopii gałęzi z prywatnymi plikami do testów; izolowane testy korzystają z danych syntetycznych i jawnych zasad retencji.
6. Zapisz identyfikatory projektu, gałęzi, compute, nazwę bazy i endpoint bucketu. Wykonawca dostarczy przygotowany skrypt ról: owner NOLOGIN oraz osobne api, worker i migrator. Owner/administrator służy wyłącznie przygotowaniu; nie trafi do konfiguracji aplikacji. Bezpieczne przekazanie ograniczonych połączeń następuje po tej instalacji.

[Neon: projekty](https://neon.com/docs/manage/projects), [pgvector](https://neon.com/docs/extensions/pgvector), [prywatne pliki](https://neon.com/docs/storage/overview). Koszty są metered według planu organizacji; bucket nie jest nowym kontem innego dostawcy.

### 3.2. Render

1. Użyj istniejącego **PROFITIA WORKSPACE**, ID `tea-d7lps8rbc2fs73cn80dg`, region **Frankfurt**. Utwórz projekt **Platform Knowledge** i środowisko **platform-knowledge-development**. Nie przenoś istniejących usług SG2, Identity lub PMOS.
2. Docelowo przygotuj **platform-knowledge-development-api** jako Web Service oraz **platform-knowledge-development-worker** jako Background Worker, oba z `profitia/SG-dev`, authority `main`, auto-deploy **wyłączony**. Konfiguracja i konkretna rewizja do utworzenia usług zostaną potwierdzone po publikacji bootstrapu; nie uruchamiaj pustych poleceń ani nie traktuj nieudanego builda jako gotowej usługi.
3. API Web Service jest potrzebne do prostego panelu w przeglądarce. Publiczny adres transportu nie daje dostępu do dokumentów: panel i operacje wymagają istniejącej Identity/E1, a konsumenci własnego zaufanego upoważnienia. W tej topologii nie dokładamy osobnego publicznego proxy tylko do prywatnego serwisu.
4. Początkowo API: najmniejszy płatny plan odpowiedni do stałego API; worker: 2 GB RAM, jedna instancja i współbieżność 1 dla bezpiecznej konwersji/OCR. Sprawdź aktualnie wyświetlaną cenę przed utworzeniem; nie jest udzielona zgoda na autoscaling lub nieograniczone podnoszenie planu.
5. Bez dysku współdzielonego i bez Redis. Uploady są w prywatnym bucketcie, stan i kolejka w Postgres. Worker nie przyjmuje ruchu HTTP; API nasłuchuje na `0.0.0.0:$PORT`.
6. Można zachować izolację sieciową projektu; SG2 i inni odbiorcy będą korzystać z autoryzowanego HTTPS API. Nie wyłączamy izolacji istniejących projektów dla wygody połączenia. Jeżeli późniejsza konfiguracja ma korzystać z prywatnego adresu, musi osobno potwierdzić zgodność workspace, regionu i izolacji obu środowisk.

[Render: projekty](https://render.com/docs/projects), [sieć prywatna i ograniczenia](https://render.com/docs/private-network), [aktualne ceny](https://render.com/pricing). Nie wpisujemy niezweryfikowanej kwoty kosztu usług.

### 3.3. GitHub, konfiguracja i monitoring

- Repozytoria pozostają istniejące: `profitia/SG-dev` i `profitia/conversational-intelligence-core`; nowego repo nie potrzeba.
- Przygotuj environment **platform-knowledge-development** w SG-dev, dopuszczający wydania z main, przypisany tylko do tej capability. Nie zmieniaj istniejących Staging/Production ani wspólnych credentials. Kontrole źródłowe będą credential-free; klucz OpenAI nie trafi do workflow CI.
- OpenAI: właściciel zatwierdził istniejący klucz i budżet 10 USD; limit techniczny wynosi 1 USD/dokument. Odczyt katalogu modeli potwierdził dostępność `gpt-6-luna` i `text-embedding-3-small`, bez płatnej generacji. Przed przetwarzaniem rzeczywistych treści wymagane są trwałe rezerwacje kosztu i potwierdzona konfiguracja prywatności. Nie tworzymy automatycznie nowego projektu lub klucza i nie zakładamy, że dowolny klucz środowiska jest przeznaczony dla Profitii.
- Konfiguracja aplikacji będzie używać ograniczonych połączeń DB, gałęziowego S3 i jawnych identyfikatorów środowiska/usługi. Migrator nie będzie sekretem runtime; wartości trafiają wyłącznie do bezpiecznej konfiguracji, nie do Git i rozmowy.
- Monitoring nowego API i workera wymaga jawnego przypisania do zaakceptowanego projektu Sentry oraz środowiska i release. Nie kierujemy automatycznie nowej usługi do `profitia/sg-porr`. Połączenie do właściwego projektu/DSN lub decyzja o nowym projekcie pozostaje do potwierdzenia; testy z kontrolowanym transportem nie dowodzą odbioru w Sentry.

Do potwierdzenia wystarczą niesekretne identyfikatory zasobów i informacja o skonfigurowaniu bezpiecznych połączeń. Nie trzeba ponownie akceptować harmonogramu lub przejścia do kolejnej dopuszczonej pracy.

## 4. Profil walidacji i odzyskiwanie

Profil `pk-development-quality-v1` obejmie co najmniej po jednym prawdziwym pliku każdego wspieranego rozszerzenia, PDF tekstowy i skanowany, dokument 100 stron, długi akapit z końcówką bez interpunkcji, długie zdanie, tabele, wykres, Markdown z kodami CPV/normami i trzy dokumenty konkurujące. Dane są autorskie/syntetyczne lub dopuszczone do testów, bez kopiowania danych prywatnych klientów.

Kryteria bezwzględne: zero nierozliczonych jednostek źródła, zero cichej utraty odczytanej treści, zero nieuprawnionych ujawnień; błędy odczytu oznaczają jawny partial. Każdy referencyjny kod/identyfikator oraz lokalizacja cytowania mają deterministyczny oczekiwany wynik. Zestaw pytań obejmuje naturalne odkrycie źródła, łączenie dowodów, sprzeczność i brak odpowiedzi. Miary retrieval i progi są wersjonowane przed płatnym przebiegiem; nie obniża się ich dla uzyskania PASS.

Przed pierwszym wydaniem: backup/izolowana gałąź do sprawdzenia migracji, zapis instalacyjnego SHA, brak poprzedniego LKG jawny, możliwość zatrzymania API/workera i zachowania danych. Kolejne wydanie ma rzeczywisty poprzedni artefakt/digest, konfigurację bez sekretów i stan migracji. Nie wykonujemy globalnego restore wspólnej bazy.

## 5. Bieżąca lista gotowości etapu 1

| Obszar | Stan | Dowód lub brak |
|---|---|---|
| Zlecenie etapu | POTWIERDZONE | Właściciel 2026-11-11; [dowód G1](../evidence/2026-11-11-platform-knowledge-stage1-g1-onboarding.md) |
| Cztery powierzchnie źródeł | PRZYJĘTE_MAIN | PR #999, merge fb1d250321623de2bafc4f0fdd5deb937ba2c062; PK-BASE-001–004; nie jest to grant produktu |
| Memoros i luki integracji | ROZPOZNANE | §1–2, bieżące źródła |
| Kontrakty wykonywalne i profil testowy | BOOTSTRAP_I_WALIDACJA | Publiczny pakiet 0.1.0, scenariusze i pliki referencyjne; rzeczywiste retrieval nie jest jeszcze implementowane |
| Zasoby produktu | CZĘŚCIOWO_POTWIERDZONE | Neon sparkling-sky-79692560 / br-billowing-grass-b9ko5s4f, platform_knowledge, PostgreSQL 18.6 / vector 0.8.6, private bucket, cztery role i schemat odczytane; hasła, GitHub environment i dwie usługi Render do readbacku; agent nie tworzył zasobów |
| OpenAI i budżet | ZATWIERDZONE_BINDING_DO_DOMKNIĘCIA | Istniejący klucz, 10 USD; modele dostępne. Brak płatnego przetwarzania i brak deklaracji gotowego ledgera |
| Monitoring | ZAKRES_USTALONY_BINDING_DO_POTWIERDZENIA | Nowy runtime nie dziedziczy projektu Sentry przez monorepo |
| Odbiór etapu pierwszego | W_TOKU | Nie wolno zamknąć przed spełnieniem wszystkich kryteriów etapu |

## 6. Opublikowany pakiet startowy i profil dostawcy

[Instrukcja ról Neon](platform-knowledge-development-owner-db-setup-v1.md) jest sprawdzona lokalnie i opublikowana przez PR #1002; wykonuje ją właściciel. [Bootstrap API i workera](../../apps/platform-knowledge-runtime/README.md) zawiera kompletne polecenia, konfigurację i odróżnienie liveness od gotowości przetwarzania. [Publiczny kontrakt](../../packages/platform-knowledge-contracts/README.md) określa transport, prawa, prywatny UserID, komendy usuwania konta i właścicieli adopcji. Żaden z tych artefaktów nie oznacza zainstalowanych operacji E1 lub gotowego silnika.

Wstępny profil OpenAI: `gpt-6-luna` przez Responses, `store=false`, oraz `text-embedding-3-small`, 1536 wymiarów. Oficjalne stawki zweryfikowane 2026-11-11: Luna 0,10 USD input / 0,50 USD output na milion tokenów; embedding 0,02 USD na milion. Rezerwacja bez dyskonta cache uwzględnia premium regionalne i cache-write; każdy request ma maksymalnie 16384 input i 4096 output tokenów, poniżej progu długiego kontekstu. Nie używamy płatnych narzędzi ani automatycznego przejścia na droższy model. Model nie ma oddzielnego snapshotu w odczytanym katalogu: zapisujemy dokładne zwrócone ID, wersję promptu i generację indeksu. Dostępność katalogu nie dowodzi płatnego wykonania, kwalifikacji jakości ani prywatności projektu. [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [embedding](https://developers.openai.com/api/docs/models/text-embedding-3-small).

Limity startowe: plik 50 MiB, 500 stron, 2 mln odczytanych znaków, zadanie 30 minut, współbieżność 1, maksymalnie 3 próby techniczne. Ponowienie po nieznanym wyniku płatnego requestu wymaga rozliczenia poprzedniej próby; rezerwacja nie znika przy timeout. Właściwy trwały ledger i koszt globalny są częścią aktywacji silnika. Pierwotny plik maksymalnie 24 godziny od uploadu, pamięć i dopuszczone pochodne 180 dni albo krócej według praw źródła. Skasowanie oryginału nie unieważnia samodzielnie pochodnych; wycofanie praw lub usunięcie źródła odcina retrieval natychmiast.

Odczyt Neon po zgłoszeniu właściciela: PASS. `platform_knowledge_owner` NOLOGIN jest właścicielem schematu; API/Worker mają USAGE bez CREATE i bez członkostwa owner. Migrator jest NOINHERIT i ma wyłącznie członkostwo owner; trzy role LOGIN mają `search_path=pg_catalog, platform_knowledge`. Wszystkie cztery role bez superuser/createdb/createrole/replication/bypassrls. Globalne default ACL funkcji pozostawiają EXECUTE wyłącznie owner; schemat zawiera zero obiektów produktu. Hasła i rzeczywiste połączenia usług nie są jeszcze potwierdzone. Readback nie odczytywał hashy haseł ani sekretów.

Bootstrap obu usług używa `runtime=docker`, z przypiętym oficjalnym Node 24.15.0 i digestem. Wcześniejsza instrukcja natywnego runtime Node została zastąpiona przed tworzeniem usług, aby późniejsze parsery Office/OCR nie wymagały ich odtworzenia. Polecenia w kontenerze to `node src/main.mjs` i `node src/worker.mjs`; root repo i Dockerfile określa aktualny pakiet startowy. Nie instalujemy parserów ani tabel produktu w tej poprawce.
