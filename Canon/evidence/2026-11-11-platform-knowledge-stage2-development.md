# Platform Knowledge — dowody etapu 2 na Development

Status: **W_TOKU, bez deklaracji gotowej biblioteki Development**. Zlecenie: samodzielna biblioteka i API, jakość silnika/adapterów niezależnie od końcowej odpowiedzi asystenta. [Runbook](../runbooks/platform-knowledge-stage2-development-v1.md), [plan](../runbooks/platform-knowledge-development-delivery-plan-v1.md), [bieżąca macierz maszynowa](../../apps/platform-knowledge-runtime/deployment/stage2-evidence.json).

## Źródła i zrealizowana weryfikacja

Roboczy SG-dev PR [#1019](https://github.com/profitia/SG-dev/pull/1019) zawiera silnik, neutralny kontrakt0.2, opcjonalny adapter ACG, opcjonalne operacje w tym samym Root, rozszerzenie istniejącego Identity/E1 i prosty panel. Osobno zarejestrowany rzeczywisty kontrakt planu CIC: PR [#24](https://github.com/profitia/conversational-intelligence-core/pull/24). Publikacja źródeł nie jest aktywacją usługi ani dowodem działania konwersacji.

Własny [CI43103230401](https://github.com/profitia/SG-dev/actions/runs/43103230401) potwierdził w job130799791619 rzeczywisty PostgreSQL18.6 z rozszerzeniem vector0.8.6, instalację schematu w bazie jednorazowej, RLS/ledger/kolejkę, istniejący Root i nowe operacje, current E1, Identity build/test i ACG. Nie zastępuje wymaganej adopcji wspólnego źródła ani innych bramek.

Lokalne natywne testy na odizolowanym PostgreSQL16.14 sprawdzają11 scenariuszy: prywatne zakresy i ograniczenia organizacji, leasing/fencing/deadline, brak duplikacji opłaconego wywołania, niepewny wynik, zachowanie aktywnego indeksu przy błędnej przebudowie i reuse tekstu po usunięciu raw, prywatność query cache i globalny limit kosztu dokumentu, idempotencję uploadu, pełny retained-source pipeline do aktywnego indeksu oraz odcięcie cache po wycofaniu dowolnego współtworzącego go źródła. Dodatkowo potwierdzają zgodność dokładnego schematu/bindingu odbiorcy i trwałe sprzątanie niepotwierdzonego uploadu. Usuwanie treści pochodnej działa również podczas awarii storage, zachowując klucz oryginału do ponowienia. Provider w tych testach jest syntetyczny: nie wykonano płatnych zapytań OpenAI i nie jest to odbiór jakości modelu.

[CI43112458270](https://github.com/profitia/SG-dev/actions/runs/43112458270), źródło `58ec34ddce20811fe48868198a87691413278ac4`: foundation130831769741 i parser-container130831770102 PASS. Rzeczywisty kontener Linux nonroot uruchomił API przy512MB i przetworzył wszystkie10 autorskich formatów przy limicie2GB. Potwierdzono rozliczenie jednostek i odtworzenie tekstu z chunków, w tym100stronicowego PDF; jego9114znaków nie stanowi dowodu wydajności100gęstych stron. Odczyt DOC/PPT i OCR pozostaje jawnie PARTIAL tam, gdzie struktura/obrazy nie mają dowodu pełnego odczytu. Testy negatywne potwierdziły blokadę IPv4/IPv6, połączeń adresowanych i przyjmowania poleceń przez IPC oraz odczytu/zapisu poza katalogiem zadania. Anonimowe IPC procesu konwertera pozostaje możliwe. Tymczasowa diagnostyka autorskiego DOC została po tym przebiegu usunięta z kandydata; nie stanowi funkcji runtime.

## Czego jeszcze nie uznano za wykonane

Nie zainstalowano tabel produktu lub knowledge authority w Development, nie dodano grantów, nie włączono processing i nie wdrożono Stage2. Istniejące usługi pozostają na potwierdzonym bootstrapie etapu1. Nie wykonano rzeczywistego importu/retrieval/publikacji/wycofania w panelu Development, płatnego testu OpenAI, niezależnego CIC→ACG→API, pomiaru jakości, potwierdzenia usunięcia raw i recovery na Development ani nowego zdarzenia Stage2 w Sentry. Te pozycje muszą otrzymać rzeczywiste dowody przed zamknięciem.

Wymagane jest kontrolowane przyjęcie nowego SDK z zachowaniem wcześniejszych receiptów. Brak dopuszczenia nie jest obchodzony zmianą starych fingerprintów. Szczególny wymagany GO będzie dotyczyć konkretnego gotowego pakietu, nie ponownej akceptacji harmonogramu.

Budżet pozostaje10USD łącznie i1USD/dokument. Liczba płatnych wywołań OpenAI na tym etapie:0. Estymacja kosztu nie zastępuje rachunku dostawcy. Hasła, connection strings, klucze i treści dokumentów nie należą do publicznego dowodu.

## Warunek zamknięcia

Wszystkie kryteria §5 harmonogramu muszą zostać potwierdzone na Development z rzeczywistym wydaniem, kontrolami jakości, operatorem i kosztami. Następnie właściwe zadania zamykają PMOS/MEMOROS/PHR. Etap3 i całość Platform Knowledge pozostają osobno nieukończone do pełnego odbioru SpendGuru. Obecny dokument jest ewidencją postępu, nie formalnym odbiorem etapu2.
