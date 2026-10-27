# Platform AppShell v1.0 — źródła, zgodność i przekazanie do zatwierdzenia

Data: **2026-10-27**. Zadanie: `ARCHITECTURE-PLATFORM-APPSHELL-FREEZE-V1-20261027`.
Profil: **ARCHITECTURE**. Workspace: **SG-dev Architecture**. Środowisko analizy: **development**.
Authority: **profitia/SG-dev/main**. Początkowa świeża baza: `930a4586e1f9e12807b3ee9829590bf72a6db09d`.
Dokument: [Platform AppShell — Business & Architecture Canon v1.0](../v1.0-platform-appshell-business-and-architecture-canon.md).

## 1. Zakres i status zatwierdzenia

**PROPOZYCJA DO ZATWIERDZENIA — APPROVAL_PENDING.** Użytkownik zlecił formalizację i przekazanie do procesu governance, wykluczając implementację, automatyczne zmiany kanonów produktów, konfigurację i wdrożenia. Nie zapisano zatwierdzenia biznesowego, decyzji merge ani aktywacji produktu.

Zmiana obejmuje dokładnie nowy kanon, ten raport i jeden wpis aktywnego manifestu z podniesieniem `3.28.0` → `3.29.0`. Status `ACTIVE` wpisu jest proponowanym stanem po zatwierdzeniu i przyjęciu PR do main, zgodnie z istniejącym formatem manifestu. Validator obsługuje `ACTIVE`, `ACTIVE_ADAPTER`, `SUPERSEDED`; nie dodano nieobsługiwanego `DRAFT` ani równoległego rejestru. Gałąź robocza nie staje się authority przez zmianę JSON. Kanon wyraźnie warunkuje swoją moc zatwierdzeniem i przyjęciem do main.

Ścieżki `Canon/**` rozwiązały się do **Governance Source Layer / ALIGNED**, z prawem profilu ARCHITECTURE. Baseline routingu, jego frozen reference i transitional epoch pozostają bez zmian. Brak nested `AGENTS.md` dla tych ścieżek. Załączony wrapper SG2 został odczytany jako materiał wejściowy; jawny wybór ARCHITECTURE w bieżącym zadaniu określa właściwy profil.

## 2. Bieżące źródła MagicPath — tylko odczyt

| Projekt | Projekt ID | Component ID | Odczytana bieżąca rewizja |
| --- | --- | --- | --- |
| [AppShell](https://www.magicpath.ai/files/465533749308841984) | `465533749308841984` | `465804082116980736` | `465855381789360128` |
| [Arkusz Danych Podstawowych](https://www.magicpath.ai/files/465405993031966720) | `465405993031966720` | `465415479037693952` | `465859267208024064` |

Odczytano aktualny kontekst kodu obu komponentów, a nie wcześniejsze podglądy. AppShell zawiera etykietę Price Change Index i lokalne, oznaczone odpowiedzi demonstracyjne. Są to symulacje prezentacji; nie dowodzą rozmowy z CIC lub działania Screen Context. ADP pozostaje klikalnym prototypem bez docelowych mechanizmów biznesowych/backendowych. Nazwa „Ankieta” widoczna w AppShellu nie została potraktowana jako nowe ownership produktu wobec biznesowego „Arkusz Danych Podstawowych”.

Nie otwierano sesji edycji, nie zmieniano projektów ani biblioteki. Nie wykonywano w tym zadaniu wizualnego odbioru responsywności, interakcji lub inspektora. Te kontrole należą do późniejszego odbioru UI; obecny odczyt służy identyfikacji zakresu i statusu źródeł, nie akceptacji prototypu.

## 3. Celowana zgodność z aktualnym authority

Wykorzystano aktywny manifest `3.28.0` z **48 aktywnymi dokumentami**, obowiązujące źródła CORE/ARCHITECTURE oraz wskazane kanony SRM. Sprawdzono nowsze wpisy i poprawki manifestu. Nie znaleziono odrębnego aktywnego kanonu Platform AppShell. Odczytano nowszy amendment Maps v1.2 jako granicę sąsiedniej capability; nie zastępuje on X-Ray v1.1. Historyczne wersje finansowe v1–v3 są superseded przez v4 i nie wyznaczają nowej logiki AppShella.

| Ustalenie | Źródło i konsekwencja |
| --- | --- |
| `SRM AppShell` oznacza lokalny composition root | SRM Architecture & Component Placement v1.0, sekcje 3–5; X-Ray v1.1. Nowy kanon rozróżnia Local Application Shell, Platform AppShell i AppShield, zachowując istniejące obowiązki SRM. Nie edytuje dokumentu SRM. |
| X-Ray ma publiczny kontrakt, nie dowód przyjęcia w platformowym hoście | `packages/srm-xray/**` i amendment v1.1: GeneralCompanyDataMount, FinancialDataMount, VerclyKysMount i SupplierXRayMount. Backend/integracje pozostają w SRM. Nie przyjęto domyślnego iframe ani zgodności dowolnych hostów. |
| Benchmark Finder i PCI to różne powierzchnie | SG Runtime: `app/[locale]/benchmark-finder/page.tsx`, `components/benchmark-finder/benchmark-finder-client.tsx`; PCI: `packages/sg2-price-change-index-ui/README.md`, `apps/sg2-price-change-index-demo/README.md`, onboarding z 2026-10-26. PCI jest osobnym frontendem z syntetycznym hostem; nie jest automatycznie backendem lub zamiennikiem Findera. Wiązanie pierwszej pozycji pozostaje otwarte przed rzeczywistą aktywacją. |
| ADP i umowy mają istniejący zakres SRM | SRM-CAP-001/005 i SRM-CAP-007. Nowa nazwa karty nie tworzy aplikacji/ścieżki; przykład Contract Management najpierw rozstrzyga pokrycie z istniejącą capability. |
| Identity i E1 zachowują ownership | Kanon Identity Runtime v1.0 i aktualny Operation Context & Access Contract/matrix. AppShell konsumuje sesję; serwer autoryzuje każdą operację. Nie deklaruje się zbiorczego przyjęcia E1. |
| CIC ma osobny tor authority | Aktualny project registry i startup bridge wskazują `profitia/conversational-intelligence-core`. AppShell nie przejmuje kodu, backendu, wiedzy lub danych CIC. |
| Host, owner kanonu i owner modułu są różni | Routing v1.1 i aktualny baseline: `apps/sg-runtime/**` → SG2, `apps/srm/**` → SRM, publiczne platform-contracts → ARCHITECTURE. Kanon nie daje ARCHITECTURE praw do kodu produktów i nie rejestruje nowego hosta. |
| Niezależny rozwój nie zawsze oznacza niezależne wdrożenie UI | Publiczne pakiety i runbook integracji producent/konsument. Wbudowany NATIVE VIEW wymaga wydania hosta; niezależne API/runtime zachowują kompatybilne osobne wydania. |

Nie stwierdzono nierozstrzygniętej sprzeczności normatywnej wymagającej zmiany nadrzędnych kanonów. Zidentyfikowane niejednoznaczności nazewnicze opisano jawnie. Wybór realizacji cenowej i docelowy kontrakt ADP pozostają decyzjami zależnej realizacji, nie są przedstawione jako ukończone integracje.

## 4. Governance i walidacja

Praca odbywa się w odrębnej gałęzi `architecture/platform-appshell-freeze-v1-20261027`, checkoutcie i własnym klonie PHR. Cudzych checkoutów ani niezatwierdzonych gałęzi nie użyto jako authority. Aktualne otwarte propozycje sprawdzono pod kątem AppShella; nie znaleziono konkurencyjnego PR tej funkcji.

Początkowy runtime gate nowego checkoutu wskazał brak lokalnego kontekstu/integrity. Kanoniczne `pmos:context` odtworzyło je z istniejącego ARCHITECTURE PMOS. Pełny preflight i powtórzenie z `--require-begin` następnie dały **PASS dla wszystkich właściwych bramek przed pierwszą zmianą źródeł**. Nie użyto offline/CI/skip-runtime/allow-dirty jako obejścia.

Kanoniczne `pmos:begin` zwróciło:

- task registration: `cmvqwo0eu0000c2flzsewdt9t`;
- task conversation: `pmos-task-v2:7f7342be231c205167525a3ba96fb8f32599f60f3cd04839215b0885d346e2e0`;
- rzeczywisty host conversation: `01a17d49-61a6-7821-ba8e-18b45d3c4048`.

Potwierdzono bazę `architecture_pmos` i rolę runtime `architecture_pmos_runtime`, bez superuser/BYPASSRLS/create-role/create-db. Są to istniejące zasoby continuity, nie produktowa baza PORR. PMOS i PHR są wymagane; Memoros jest wyłączony przez profil. Końcowy closeout i zdalny PR są oddzielnymi dowodami wykonania; nie stanowią zatwierdzenia nowego kanonu. Ich rzeczywiste identyfikatory i wyniki zapisuje kanoniczny handoff po wykonaniu.

Wyniki walidacji propozycji są uzupełniane po sprawdzeniu końcowego diffu. Nie wykonuje się buildów produktu lub testów integracji usług dla dokumentacyjnej zmiany bez implementacji. CI właściwe dla manifestu pozostaje wymagane przed przyjęciem.

## 5. Zakres zatwierdzenia i dalsze granice

Do zatwierdzenia przekazuje się rolę AppShella, macierz ownership, Module Host i Dock, trzy modele integracji, logiczny Screen Context, granice Identity/E1/CIC, wieloorganizacyjność, procedurę nowego modułu i zasady wersjonowania. Wpis manifestu ma aktywować tylko ten kanon po prawidłowym przyjęciu.

Przejściowe pozostają: możliwy pierwszy host SG Runtime, prototyp ADP, wizualny asystent i ewentualny osobno zatwierdzany adapter osadzenia SRM. Redakcyjna etykieta przejściowości nie zmienia formalnej klasyfikacji kodu.

Otwarte pozostają: wiązanie cenowe, fizyczny kontrakt ADP, przyszły osobny host, trwałość preferencji, transport/integracja CIC i ewentualna współpraca międzydomenowa. Nie blokują formalizacji zasad; blokują tylko zależny zakres przed jego rzeczywistą realizacją/aktywacją.

Przed przyjęciem odrzucenie lub korekta PR pozostawiają authority bez zmian. Po przyjęciu korekta kanonu wymaga zwykłego review i oceny konsumentów. Nie usuwa się historii PMOS/PHR ani danych aplikacji. Nie wykonano zmian produktu, migracji, nowych usług, konfiguracji dostawców, zmian MagicPath lub wdrożeń.
