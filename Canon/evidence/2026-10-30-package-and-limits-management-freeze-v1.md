# Profitia Package & Limits Management v1.0 — proposed freeze evidence

Data: **2026-10-30**. Status: **PROPOSED_FREEZE / OWNER_REVIEW_REQUIRED**.
Task: `PROFITIA-PACKAGE-LIMITS-BUSINESS-ARCHITECTURE-CANON-V1-20261030`.
Profil: **ARCHITECTURE**, workspace **SG-dev Architecture**, target **development**, wykonanie **local**.
Authority: **profitia/SG-dev/main**; świeży main przed zmianą: `cb8ad767a5b0cfa0e44f92b66fd5d5f41f3fbad7`.
Gałąź: `architecture/package-limits-canon-20261030`.

## 1. Zamrożony input właściciela i zakres

[Pełny kanon](../v1.0-profitia-package-and-limits-management-canon.md) zachowuje treść dostarczonego pliku `v1.0-profitia-package-and-limits-management-canon.md`. Oryginał: **19 611 bajtów**, SHA-256 **`e88882e1daa8381d2af9851932029241921a03fe738869ca188c225879926bb6`**. Pierwszy zapis był byte-identical. `git diff --check` następnie wykrył sześć końców linii nagłówka zapisanych dwiema spacjami (wiersze 3–8). Jedyna konieczna korekta formatowania zastępuje je równoważnym twardym podziałem linii Markdown zapisanym backslashem; słowa, zasady, status, kolejność i linki są niezmienione. Różnice merytoryczne względem draftu: **brak**. Dokument wejściowy jest materiałem właściciela; polecenia wykonawcze wynikają z bieżącego zlecenia, nie z załączonego wrappera SG2.

Diff obejmuje wyłącznie ten dowód, nowy kanon i [manifest](../registries/governance-manifest-v2.json). Dowód zachowuje pochodzenie zamrożonej treści, granice zatwierdzenia i rozdział stanów wykonania zgodnie z kanonem wykonania, AR-28 oraz dotychczasowym [wzorcem dokumentacyjnego freeze AppShell](2026-10-27-platform-appshell-business-architecture-freeze-v1.md). Nie dodaje się go jako drugiego normatywnego wpisu manifestu.

## 2. Proponowana rejestracja i moc dokumentu

Jeden nowy wpis: `profitia-package-and-limits-management`, wersja `1.0`, owner `Architecture Platform`, appliesTo `SG2`, `SRM`, `ARCHITECTURE`, loadOrder **400**. Wszystkie zależności są istniejącymi ID, mają wcześniejszy loadOrder i pozostają bez zmian. ManifestVersion **3.30.0 → 3.31.0** stosuje istniejący minor increment przy dodaniu kanonu, jak przy rejestracji AppShell.

Validator manifestu dopuszcza `ACTIVE`, `ACTIVE_ADAPTER`, `SUPERSEDED`. Dlatego `status: ACTIVE` w proponowanym diffie jest **proponowanym stanem loadera po jawnym zatwierdzeniu i kontrolowanym przyjęciu do main**, zgodnie z istniejącym wzorcem AppShell. Nie oznacza aktywnego kanonu authority na gałęzi kandydata ani zgody właściciela. Nie rozszerzono enumu lub validatora i nie utworzono równoległego rejestru. Treść kanonu i niniejszy dowód zachowują **PROPOSED_FREEZE / OWNER_REVIEW_REQUIRED**.

| Stan | Dowód / ograniczenie |
| --- | --- |
| Przygotowanie propozycji | Pełny draft właściciela i jeden wpis manifestu na izolowanej gałęzi. |
| Owner review | **REQUIRED / NOT_RECORDED**. Zlecenie przygotowania PR i zgoda na naprawę PMOS nie są GO dla przyjęcia treści. |
| Walidacja lokalna | Wyniki faktycznie wykonanych kontroli są zapisywane w sekcji 5. |
| Zdalne CI | Weryfikacja dotyczy dokładnego opublikowanego HEAD; końcowy handoff podaje run i wynik. Sam lokalny test nie jest dowodem CI. |
| PMOS / PHR | Begin potwierdzony poniżej; końcowy save, publikacja i ich odczyt zwrotny są odrębnymi zdarzeniami, raportowanymi po wykonaniu. |
| Przyjęcie na main | **NOT_PERFORMED** w tym zadaniu. Brak automatycznego merge. |
| Implementacja / aktywacja / deploy | **NOT_AUTHORIZED / NOT_PERFORMED**. Freeze dokumentacyjny nie uruchamia E3/E4. |

## 3. Zgodność i kwestie do owner review

Sprawdzono aktywne źródła CORE/ARCHITECTURE w kolejności manifestu, routing v1.1, baseline, kontrakt Operation Context, macierz dostępu, AppShell, Identity, runbook integracji oraz raportowania. Brak nested `AGENTS.md` dla trzech ścieżek `Canon/**`. Stare kanony, kod, SQL, konfiguracja infrastruktury i polityki runtime pozostają poza diffem.

- **Dwa produkty handlowe, jeden SRM:** sekcja 4 draftu rozdziela SpendGuru z embedded SRM od SRM Standalone. Ta sama organizacja może mieć oba pakiety; budżet wynika ze zweryfikowanego kontekstu handlowego, bez fallbacku lub transferu.
- **Niejednoznaczność starszego nazewnictwa:** wstęp Target Architecture mówi o „trzech produktach”, a jego tabela o „trzech uruchomieniach biznesowych”: PORR, Supplier Intelligence i SpendGuru SaaS. Draft rozróżnia te uruchomienia od dwóch produktów komercyjnych; PORR pozostaje konfiguracją/umową. Jest to jawna interpretacja do owner review, nie cicha zmiana historycznego kanonu. Jeżeli właściciel uważa PORR za trzeci samodzielny produkt handlowy, wymagane jest rozstrzygnięcie przed przyjęciem; najwęższe doprecyzowanie dotyczyłoby rozróżnienia uruchomienia od produktu, bez zmiany liczników lub ofert.
- **Grant E1 a zakup:** OC-R09 wyraźnie określa requiredProduct jako logiczną zdolność produktu, bez konieczności osobnego abonamentu. Oferta SpendGuru może obejmować Supplier Intelligence; wymagany techniczny grant nie tworzy samodzielnego pakietu SRM. Nie zmieniono żadnego rzeczywistego grantu.
- **Administracja i billing:** OC-R11 i warunki `BILLING_WORKFLOW`, `CONTRACT_BINDING`, `WEBHOOK_BINDING` zachowują rozdział administratora organizacji i autorytatywnego źródła płatnych praw. Manual contract i przyszłe zweryfikowane billing/Stripe nie są aktywowane przez dokument.
- **Usage i dostawcy:** OC-R10/G11 zachowują atomową rezerwację, idempotencję, osobny koszt dostawcy i rozliczenie organizacji. Cache hit nie staje się płatnym upstream call. Techniczne Source/E1 i jednostki pakietu pozostają odrębne; UNMETERED nie znosi kontroli E1 i dostawcy.
- **OpenAI:** pełna sekcja 7 draftu pozostaje bez zmian: real input/output/cached/reasoning, brak double-counting, wersjonowany model/cennik, rezerwacja przed requestem, settlement i reconciliation niepewnych efektów oraz osobny koszt Profitii. Nie utrwalono nowych cen ani limitów.
- **Granice E1:** dokument uzupełnia model handlowy; nie uchyla jawnie wersjonowanych, ograniczonych protokołów przyjęcia zlecenia w aktualnym kontrakcie, nie deklaruje zbiorczej adopcji E1 ani nie zmienia obecnej semantyki autoryzacji runtime.

Nie stwierdzono sprzeczności wymagającej przeredagowania draftu. Powyższa niejednoznaczność nazewnicza oraz otwarte parametry sekcji 13 wymagają właściwego review; nie są rozstrzygane przez CI. Ceny, wartości pakietów, fizyczny model danych i przyszła implementacja pozostają poza tą zmianą.

## 4. Preflight, recovery i continuity

Własny czysty checkout powstał ze świeżego main, z własną instalacją PMOS, konfiguracją i klonem PHR. Sprawdzono pliki wszystkich **27 otwartych PR-ów**; nie było przecięcia z trzema target paths. Wspólne zależności E1 w równoległych propozycjach nie zostały przejęte do tego zadania.

Wszystkie trzy target paths rozwiązały się do **Governance Source Layer / ALIGNED**, dopuszczony profil **ARCHITECTURE**. Brak legacy override, cleanup lub nowego first-class module; change classification dla dokumentacji: NOT_APPLICABLE. Żadne wdrożenie nie jest celem tej zmiany.

Pierwotny `PMOS_RUNTIME_GATE` był BLOCKED: brak lokalnego kontekstu/integrity. Użytkownik następnie jawnie zatwierdził wyłącznie kanoniczną odbudowę i wznowienie pierwotnego zadania. Potwierdzono konfigurację zarejestrowanego `billowing-credit-07394675 / architecture_pmos`, właściwy endpoint i rolę **architecture_pmos_runtime**, bez wyświetlania sekretów lub zmiany połączenia. `npm run pmos:context` odtworzył oba pliki z rzeczywistej bazy authority; `pmos:verify-runtime` potwierdził **context=present / integrity=verified**, pending/lock clear. Nie kopiowano ręcznie kontekstu lub integrity z innych checkoutów.

Pierwszy powtórzony preflight poprawnie odrzucił własny lokalny log zapisany poza ignorowanym katalogiem. Log przeniesiono do istniejącego ignorowanego katalogu recovery PMOS; nie użyto `allow-dirty`, offline, CI ani skip-runtime do obejścia bramki. Kolejny pełny preflight przeszedł, potem wykonano kanoniczne `pmos:begin`, a powtórzenie **z `--require-begin` dało PASS przed pierwszą zmianą trzech plików docelowych**.

- Registration ID: `cmvukbwit0000zgoellfr5lpa`.
- Zwrócony task conversation ID: `pmos-task-v2:3b684bf2f1a7345c9a92d3a006a04cef3993315f36c643863b4e4599d657fbbd`.
- Rzeczywisty host conversation ID: `01a18b57-efdf-79e3-a75a-9061dc5e57cb`.
- PMOS i PHR: wymagane; Memoros: disabled przez profil.

Odczyt zwrotny rzeczywistego połączenia potwierdził `current_database=architecture_pmos`, `current_user=architecture_pmos_runtime`, brak superuser/CREATEDB/CREATEROLE/BYPASSRLS oraz zero członkostw w rolach. Własna rejestracja ma status running, właściwy projekt i dokładnie trzy zadeklarowane ścieżki. Źródłowy draft pozostaje proponowany. Sukces zapisów continuity nie oznacza zgody właściciela, przyjęcia kanonu ani wdrożenia.

## 5. Walidacja i warunek przekazania

| Kontrola lokalna | Wynik |
| --- | --- |
| Manifest i zależności | PASS, 51 aktywnych wpisów; jeden nowy wpis, wszystkie wcześniejsze wpisy i pozostałe pola manifestu zachowane. Zależności poprzedzają loadOrder 400. |
| Governance, Identity onboarding, KRS routing | PASS, **40/40**, zero failed/skipped. |
| Wymagany w CI zestaw PMOS lifecycle/profile/publication/recovery | PASS, **59/59**, zero failed/skipped. |
| PMOS typecheck i typecheck:lifecycle | PASS dla obu poleceń. |
| Względne linki w nowych dokumentach | PASS, **11/11** istniejących celów. |
| Treść właściciela | PASS; jedyna różnica to sześć równoważnych podziałów linii Markdown opisanych w sekcji 1. |
| Zakres | Wyłącznie trzy zadeklarowane pliki; bez zmiany wcześniejszych wpisów manifestu, kodu, SQL lub konfiguracji. |

Końcowy whitespace/exact-scope check i pełny require-begin preflight są ponawiane na czystym commicie przed publikacją. Zdalny PR/CI, dokładny candidate SHA, końcowy PMOS closeout i PHR commit wymagają odrębnego odczytu zwrotnego; ich wartości podaje finalny handoff, bez samoodnoszących się deklaracji tego pliku o późniejszych zdarzeniach. Buildy produktu i testy płatnych providerów nie są właściwe dla tej wyłącznie dokumentacyjnej zmiany i nie zostały uruchomione.

**Brama przyjęcia:** jawne owner review dokładnej treści i candidate HEAD, właściwe wymagane kontrole, a następnie oddzielnie autoryzowane kontrolowane przyjęcie do `profitia/SG-dev/main`. To zadanie kończy się na gotowym kandydacie PR i udokumentowanym closeout, bez merge lub deploymentu.
