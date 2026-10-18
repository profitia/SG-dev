# ARCHITECTURE — prywatne fazy przyjętego zlecenia, 18.10.2026

Status: SOURCE CANDIDATE / LOCAL TESTS PASS / EXACT INTEGRATION CI REQUIRED.
Całe E0/E1 pozostaje IN_PROGRESS. Zadanie
ARCHITECTURE-E1-PRIVATE-REQUEST-CONTINUATION-20261018, workspace SG-dev Architecture,
TARGET_ENVIRONMENT=development, wykonanie lokalne; authority profitia/SG-dev/main,
baza06d5356a1b082f71c209e88f2b2df1057337330b. Własne PMOS/PHR, MEMOROS wyłączony.

## Jawne rozszerzenie wspólnego kontraktu

Platform1.15 / candidate9 / host1.7 dodaje opcjonalną kontynuację przyjętego
HUMAN supplier.report.refresh. Ten sam adapter tożsamości, access store, aktualne
członkostwo, prawa, produkt, moduł i skończona polityka zleceń obowiązują przy
każdej fazie. Nie wystarcza historyczny receipt ani nazwa roli administratora.

Nowy SQL011 dotyczy wyłącznie PRIVATE_SQL_PHASE: kontrolowany NOLOGIN owner,
FORCE RLS, fizyczne powiązanie zwykłej roli, jawne ograniczone polityki faz,
kolejność i poprzednik, parent/phase/input digest, jednorazowy efekt i zakończenie.
Definicji polityki nie można przepisać; zmiana statusu lub terminu zwiększa wersję.
Odczyt polityki używa blokady współdzielonej, bez globalnego blokowania wszystkich
organizacji przez wyłączną blokadę tej samej definicji fazy.

Zlecenie nadrzędne musi już być ACCEPTED i odpowiadać osobie, organizacji,
aplikacji, środowisku, zasobowi, treści i oryginalnemu kluczowi. Wspólny ledger
pozostaje jedynym mechanizmem klucza i limitu. Zmieniony klucz nie może zatwierdzić
nowego parent: ewentualna NEW jest odrzucana przed akcją i cała transakcja jest
cofana. Kontynuacja nie zatwierdza drugiej jednostki limitu zleceń.

Efekt prywatnego SQL i receipt fazy zatwierdzają się z kanonicznym OUTCOME.
Ograniczenie odroczone odmawia COMMIT dla RESERVED oraz dla fazy oznaczonej
ACCEPTED bez właściwego OUTCOME tej samej transakcji/decyzji/aktora/organizacji.
Zmieniona treść tej samej fazy oznacza konflikt; powtórka nie wykonuje ponownie
akcji. Nie zmienia się SQL001-010 ani ich historycznych receiptów.

## Sprawdzone granice

Pełny lokalny zestaw745kontroli kontraktu i laboratorium PASS, bez pominięć,
w tym21kontroli nowej rzeczywistej ścieżki PostgreSQL. Osobny podzbiór158testów
jednostkowych należy do tego zestawu; liczb nie sumuje się. Publiczne typy,
w tym oczekiwane odmowy kompilacji, oraz build składni pakietu PASS.

Fixture tworzy własną nową bazę w nowym lokalnym klastrze. Zwykły login nie ma
CREATE/TEMP, uprawnień ownera, superuser ani BYPASSRLS. Weryfikowane są konkurencja,
replay/konflikt/kolejność, odwołanie konta/członkostwa/prawa/produktu/modułu/polityki,
wygaśnięcie podczas akcji, błędny parent/source i inna fizycznie dopuszczona
aplikacja mająca poprawne własne uprawnienia do tej samej osoby i organizacji.
Sprawdzono cofnięcie zapisów po błędzie biznesowym lub audytu, niezmienność
receiptów, odmowę przedwczesnego COMMIT i szerokiego przypadkowego ACL.

Nowy negatywny test ujawnił początkowo ciche potraktowanie jawnego null jako
wyłączenia opcji. Poprawiono konstruktor; końcowy pełny zestaw745PASS zawiera
odmowę null. Nie osłabiono testu ani podstawowej polityki. Argument konfiguracji
jest kopiowany przy konstrukcji; późniejsza mutacja obiektu wywołującego nie
zmienia fazy. SDK IdP w fixture jest syntetyczny; nie jest rzeczywistą sesją.

## Zależności i granice odbioru

SRM-E1-SUPPLIER-PRIVATE-CONTINUATIONS-20261018 pozostaje osobnym zadaniem odbiorcy.
Przegląd przed edycją wykazał, że użycie projectOutput do kolejnych zapisów
rozszerzałoby intent-only semantykę candidate8 bez jawnego wspólnego wsparcia.
Skorygowano sposób realizacji: najpierw ten producent, potem osobne przyjęcie
źródła i domenowy adapter SRM. Pierwotnej rejestracji zadania nie przepisano.

Źródło nie wykonuje pobrania MGBI/Vercly, nie nadaje globalnego zapisu ani prawa
odczytu/eksportu danych osób. Nie jest dodatkowym runtime, kolejką, silnikiem
uprawnień lub writerem audytu. Kontynuacja wymaga krótkiej transakcji SQL; sieć
ma własną autoryzację źródła poza nią, a ujawnienie wyniku własną aktualną kontrolę.

Nie zmieniano żywych schematów, ról, grantów, danych, sekretów, flag, kosztów lub
wdrożeń. Przygotowane wcześniej konto i organizacja pozostają zachowane.
Źródłowe testy nie są odbiorem pełnego przepływu SRM/SG2, rzeczywistego logowania,
odzyskiwania ani wydania. Właściciel ponownie autoryzował późniejsze Development
po pełnych kryteriach E1; ta jednostka go nie uruchamia. Brak zakresu
Staging/Production/E2-E4 lub nowego wyjątku authority.
