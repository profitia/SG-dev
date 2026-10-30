# Package & Limits — wykaz infrastruktury właściciela, 2026-10-30

**Status dokumentu:** `PROPOSED_DOCUMENTATION_UPDATE / OWNER_REVIEW_REQUIRED`.
**Status zasobów:** istniejące zasoby infrastrukturalne; `APPLICATION_NOT_ACTIVATED / GOVERNANCE_ONBOARDING_REQUIRED`.
**Profil zadania:** ARCHITECTURE / Development; wykonanie lokalne, workspace `SG-dev Architecture`.
**Task:** `ARCHITECTURE-PACKAGE-LIMITS-INFRASTRUCTURE-INVENTORY-20261030`.
**Authority:** `profitia/SG-dev/main`, odczytany SHA `5c87c18192b405c907ca5575adc40a4cbb63d074`.
**Okno odczytów dostawców:** 2026-10-30, **09:27:38–09:29:35 UTC / 10:27:38–10:29:35 CET, Europe/Warsaw**. Odczyty nie stanowią atomowego snapshotu.
**Obowiązujący kanon:** [Profitia Package & Limits Management v1.0](../v1.0-profitia-package-and-limits-management-canon.md).

## 1. Znaczenie dowodów i granice zadania

- **VERIFIED** — fakt odczytany z bieżącego API dostawcy, oficjalnego CLI delegującego API albo przypiętego źródła Git. Podane identyfikatory nie są wywnioskowane z nazw.
- **OWNER_DECLARED** — informacja otrzymana od właściciela bez niezależnego potwierdzenia danego aspektu. Utworzenie zasobów samodzielnie przez właściciela ma ten status w zakresie tożsamości osoby wykonującej operację; API potwierdza ich istnienie, nie autorstwo wszystkich działań.
- **NOT_VERIFIED** — aspekt poza dowodami lub zakresem tego odczytu. Nie oznacza zera, braku zasobu ani pozytywnego odbioru.

Tryb: wyłącznie odczyt metadanych i historii; nie wykonywano SQL, połączeń do baz produktu, migracji, pobrania DSN/sekretów, konfiguracji ról, tworzenia/usuwania zasobów, restartu, deploymentu ani aktywacji. Obowiązkowe PMOS/PHR dotyczą wyłącznie continuity tego zadania w istniejącym profilu ARCHITECTURE, nie baz Package & Limits. Załączony wrapper SG2 jest materiałem pomocniczym; właściwy profil określa bieżące polecenie i project registry.

Kanon v1.0 został merytorycznie przyjęty w [PR #796](https://github.com/profitia/SG-dev/pull/796), candidate `90cfd846a55d4cb35928e0e8d5388fcdaacb0a5c`, merge `75ebabcc8ebb4c8c6529b730ba6a261678a22522` z 2026-10-30 — **VERIFIED** przez odczyt PR i Git. Korekta historycznego nagłówka odzwierciedla ten fakt; ten PR inwentaryzacyjny nadal wymaga własnego review. Zamrożone zasady biznesowe pozostają bez zmian.

## 2. Mapa środowisk — VERIFIED

Repository: **profitia/SG-dev**, repository ID **1247665550**, default branch **main**.
Render workspace: **PROFITIA WORKSPACE / tea-d7lps8rbc2fs73cn80dg**.
Render project: **Package & Limits / prj-dbi556u1egvs73euin20** — zgodny z mapą właściciela, potwierdzony listą projektów oraz powiązaniami środowisk.
Neon project: **Package & Limits / lingering-thunder-05075810**, org `org-nameless-field-92563437`, region **aws-eu-central-1**, **PostgreSQL 18**.

| Środowisko logiczne | GitHub Environment / rzeczywiste ID | Render environment / service | Neon branch / database |
| --- | --- | --- | --- |
| Development | `profitia-limits-development` / `25772685296` | `development` / `evm-dbi5932jnfac73cs1nhg`; `limits-development` / `srv-dbi5at9srm7s73da7ol0` | `development` / `br-green-hall-b9s837k0`; `neondb` / `173988` |
| Staging | `profitia-limits-staging` / `25772828577` | `staging` / `evm-dbi59c2fngtc73cbau60`; `limits-staging` / `srv-dbi5eu0m7kps73bupujg` | `staging` / `br-fragrant-voice-b9316y6k`; `neondb` / `173995` |
| Production | `profitia-limits-production` / `25772958864` | `production` / `evm-dbi59vpsrm7s73da5aa0`; `limits-production` / `srv-dbi5fn8m7kps73burl9g` | `production` / `br-lingering-union-b9qcyz0a`; `neondb` / `173916` |

Wszystkie trzy powiązania service → environment → Render project → workspace oraz branch → Neon project są **VERIFIED**. Nazwy środowisk dostawcy są metadanymi; ich istnienie nie nadaje statusu ACTIVE w governance.

## 3. GitHub — provisioning i ochrona

**VERIFIED:** wszystkie trzy Environments istnieją w tym samym repozytorium; każde ma jedną custom deployment branch policy: `main`, typ `branch`, `protected_branches=false`, `custom_branch_policies=true`.

| Environment | Branch policy ID | Wymagany reviewer w API | Pozostałe odczytane ustawienia |
| --- | --- | --- | --- |
| Development | `64890649` | Brak reguły `required_reviewers` w odpowiedzi | `can_admins_bypass=true` |
| Staging | `64890815` | User `profitia`, ID `275643368` | `prevent_self_review=false`; `can_admins_bypass=true` |
| Production | `64890923` | User `profitia`, ID `275643368` | `prevent_self_review=false`; `can_admins_bypass=true` |

**NOT_VERIFIED:** skuteczność ochrony w rzeczywistym procesie wydania Limits, powiązanie deployment joba z dokładnym Environment i jego niezmiennym SHA, credential binding, działanie review w rzeczywistym wydaniu. Same Environments i reguła `main` nie ustanawiają takiego procesu. Ustawień pojedynczego operatora z odrębnego wyjątku SRM nie przenosi się automatycznie na Limits; przed aktywacją odpowiedniego środowiska potrzebna jest jawna polityka właściciela dla tej capability.

## 4. Render — provisioning istnieje, aplikacja nie została odebrana

**VERIFIED, wspólne dla trzech usług:** `web_service`, runtime `node`, region `frankfurt`, repo `https://github.com/profitia/SG-dev`, branch `main`, `rootDir="."`, `autoDeploy=no`, `autoDeployTrigger=off`, plan API `0.5c-512mb`, jedna instancja, PR previews wyłączone. Publiczne adresy przydzielone przez dostawcę: `https://limits-development.onrender.com`, `https://limits-staging.onrender.com`, `https://limits-production.onrender.com`; nie wykonywano prób HTTP ani odbioru TLS/health aplikacji.

**VERIFIED, bieżące komendy we wszystkich trzech usługach:**

```text
build: echo "RESERVED: Profitia Limits - application not installed"; exit 1
start: node -e "process.exit(1)"
```

Ich obecna postać celowo kończy build/start błędem; nie jest instalacją aplikacji. **OWNER_DECLARED:** tymczasowy charakter i zamiar blokowania aktywacji. **NOT_VERIFIED:** rzeczywista przyczyna każdego historycznego niepowodzenia — logów build/runtime nie pobierano i nie przypisuje się im przyczyny wyłącznie na podstawie aktualnych komend.

**VERIFIED:** każde środowisko Render ma `networkIsolationEnabled=false`, `protectedStatus=unprotected`, wpis IP `0.0.0.0/0`, pustą listę Render databases i env groups. Brak Render database nie oznacza braku zewnętrznej bazy Neon. Te flagi nie są dowodem dostępu do danych lub konfiguracji sekretów; połączeń i wartości env nie odczytywano.

### Historia istniejących prób deploymentu — VERIFIED

Wszystkie poniższe wpisy odnoszą się do źródła `5c87c18192b405c907ca5575adc40a4cbb63d074`. Godziny to **UTC, 2026-10-30**. Są to istniejące zdarzenia sprzed tego zadania, nie operacje wykonane w ramach inwentaryzacji. Pole `trigger=manual` nie identyfikuje samo w sobie osoby wykonującej operację.

| Usługa | Deploy ID | Trigger API | Status API | Start → koniec UTC |
| --- | --- | --- | --- | --- |
| Development | `dep-dbi5au1srm7s73da7qf0` | `manual` | `update_failed` | 08:29:44 → 08:30:35 |
| Development | `dep-dbi5bl9srm7s73da9sn0` | `service_updated` | `build_failed` | 08:31:17 → 08:31:34 |
| Development | `dep-dbi5bttg1s2s73e235ig` | `service_updated` | `build_failed` | 08:31:51 → 08:32:07 |
| Staging | `dep-dbi5euom7kps73buq07g` | `manual` | `build_failed` | 08:38:19 → 08:38:35 |
| Production | `dep-dbi5fnom7kps73burmj0` | `manual` | `build_failed` | 08:39:59 → 08:40:18 |

API zwróciło łącznie pięć wpisów przy limicie 20 na usługę; w tym odczycie nie było wpisu `live`. **NOT_VERIFIED:** zdrowy działający runtime Limits, odbiór biznesowy, istniejący poprawny artefakt/LKG. Status `not_suspended` zasobu nie jest dowodem działającej aplikacji. Auto-Deploy OFF nie wyklucza odrębnego ręcznego deploymentu lub deploymentu wywołanego zmianą konfiguracji — istniejąca historia zawiera oba typy triggera.

## 5. Neon — branche, bazy i compute

**VERIFIED:** trzy branche mają `current_state=ready`; Production ma `primary=true`, `default=true`, brak parent. Development i Staging mają parent `br-lingering-union-b9qcyz0a`, `init_source=parent-data`; wszystkie trzy mają `protected=false`. Zawartości kopii danych nie badano.

**VERIFIED:** metadane baz zwróciły wyłącznie `neondb` w każdym branchu, z owner name `neondb_owner` i identyfikatorami z sekcji 2. `profitia_limits` nie występuje w żadnym z trzech odczytanych wykazów — to potwierdzona nieobecność w API w oknie audytu, nie obietnica przyszłego stanu. Nie tworzono tej bazy.

| Branch | Endpoint ID | Typ / stan w API | Expiry branchu |
| --- | --- | --- | --- |
| Development | `ep-muddy-surf-b9vpyy2d` | `read_write` / `idle` | Pole `expires_at` nieobecne w odpowiedzi |
| Staging | `ep-patient-wildflower-b9awgtld` | `read_write` / `idle` | `ttl_interval_seconds=86400`, `expires_at=2026-10-31T09:16:04Z` = **2026-10-31 10:16:04 CET** |
| Production | `ep-gentle-sun-b9o7sbu8` | `read_write` / `idle` | Pole `expires_at` nieobecne w odpowiedzi |

**VERIFIED, trzy endpointy:** region `aws-eu-central-1`, min/max autoscaling **0.25 / 8 CU**, `suspend_timeout_seconds=0`, `pooler_enabled=false`, `passwordless_access=true`, `disabled=false`. Zachowano znaczenie dosłownych pól API; `passwordless_access=true` nie jest dowodem anonimowego dostępu do PostgreSQL ani weryfikacją ról. Nie pobierano connection strings i nie wykonywano próby połączenia.

**VERIFIED, projekt:** `history_retention_seconds=86400`, `block_public_connections=false`, allowlist IP pusta, `protected_branches_only=false`. Są to odczytane ustawienia, nie zatwierdzona polityka bezpieczeństwa/kosztów. **NOT_VERIFIED:** schemat/tabele/instalacja E1, role i uprawnienia runtime, izolacja danych w testach, rzeczywiste połączenie Render → właściwy branch/database/rola, backup/recovery i gotowość aplikacji. Stan endpointu `idle` nie dowodzi odbioru takiego połączenia.

## 6. Różnice względem mapy właściciela

| Obszar | Wynik porównania i status |
| --- | --- |
| Repo, trzy GitHub Environments | Zgodne; **VERIFIED**. Uzupełniono rzeczywiste GitHub Environment IDs i reguły. |
| Render project/service/environment IDs, repo/main/Frankfurt/OFF | Zgodne; **VERIFIED**. Project ID właściciela potwierdzony niezależnie. |
| Tymczasowe blokujące build/start | Komendy **VERIFIED**; zamiar/tymczasowość **OWNER_DECLARED**. Istnieją nieudane manual/service_updated deployments. |
| Neon project/region/PG18/branche/parent/default | Zgodne; **VERIFIED**. |
| `neondb` i brak potwierdzonej `profitia_limits` | Potwierdzono listy baz; `profitia_limits` nieobecna w trzech odczytach API. |
| Production branch protection OFF | Zgodne; **VERIFIED** `protected=false`; także Dev i Stage mają tę wartość. |
| Dodatkowe ograniczenie Stage | Nowy fakt **VERIFIED**: TTL 86400 s i expiry 2026-10-31 10:16:04 CET. Nie wydłużano ani nie usuwano TTL. |
| Dalsza gotowość | Role, SQL/schema, credentials, działający runtime, koszt i recovery **NOT_VERIFIED**; provisioning nie jest ich akceptacją. |

## 7. Relacja do obowiązującej topologii ARCHITECTURE

Źródła: [topology ARCHITECTURE](../registries/architecture-environment-topology-v1.json), [onboarding ARCHITECTURE](../registries/architecture-onboarding-v1.json), [adapter](../adapters/architecture-project-adapter-v1.md), [Environment & Release Promotion Canon](../v1.0-profitia-environment-and-release-promotion-canon.md), [routing v1.1](../v1.1-repository-routing-and-module-ownership-canon.md), [baseline](../registries/current-architecture-baseline-v1.json) i `scripts/governance/environment-profile.mjs` przy powyższym SHA.

**VERIFIED:** bieżąca topologia ma wyłącznie ARCHITECTURE Development `ACTIVE/VERIFIED`; Staging i Production są `RESERVED/NOT_ONBOARDED`. Development wskazuje GitHub `architecture-development / 24168168252`, Render `prj-db717krrjlhs739jgo0g / evm-db717krrjlhs739jgo1g` oraz techniczny lab Neon `fancy-cell-49425728 / br-divine-fog-baohc5ay`, bazy `architecture_sg_lab` i `architecture_srm_lab`. Niezależny PMOS pozostaje w `billowing-credit-07394675 / architecture_pmos`.

Nowe Limits mają inne GitHub nazwy/ID, osobny Render project i Neon project niż powiązania profilu. Nie można podstawić ich za lab/PMOS albo uznać ich istnienia za przyjęcie do obecnego registry. `resolveEnvironmentProfile` wprost egzekwuje istniejące tożsamości ARCHITECTURE i odrzuca nieaktywne środowiska; `validateEnvironmentTopology` wymaga namespacingu GitHub według projectKey i różnych branch/service/environment IDs. Bieżące `profitia-limits-*` nie są aliasami `architecture-*` w tym rejestrze. Nie zmieniono żadnego z tych kontraktów ani ich testów.

**Trzy branche w jednym projekcie Neon:** sam ten model nie jest sprzeczny z sekcją 4 wspólnego kanonu, która dopuszcza odrębny Neon branch lub niezależną bazę per środowisko; validator sprawdza odrębność branch IDs, nie wymaga różnych Neon project IDs dla trzech środowisk. Pole `environmentBranchesAllowed=false` w registry trzeba czytać razem z sekcją 3 dotyczącą długowiecznych gałęzi kodu nazwanych od środowisk — nie jest podstawą do automatycznego uznania branchy Neon za zabronione ani do zmiany tej polityki. Rzeczywista niezgodność dotyczy **braku zatwierdzonego powiązania nowej capability i jej zasobów z aktualnym onboardingiem/topologią**; separacja credentials i danych pozostaje do przyszłego odbioru.

**G1 REQUIRED BEFORE DEPENDENT ACTIVATION, NOT A BLOCKER FOR THIS INVENTORY:** właściciel/Architecture Governance muszą osobno rozstrzygnąć ownera runtime, dokładne source/CI paths i routing, docelowy kontrakt topologii Limits oraz jego relację do profilu ARCHITECTURE bez zastępowania PMOS/lab. Ta inwentaryzacja nie tworzy nowego profilu ani nie onboardinguje Stage/Production. Akceptacja biznesowa PR #796 nie była zgodą na konkretną instalację lub wydanie.

## 8. Decyzje i warunki przed pierwszym Development deploy

| Decyzja / dowód wymagany przed zależną czynnością | Granica |
| --- | --- |
| **D1 — G1 i canonical source/topology binding:** zatwierdzić capability/runtime owner, dokładne source/CI paths i mapowanie rzeczywistych Limits Development IDs do właściwego kontraktu governance | Odrębne zadanie onboardingu i walidowany PR; bez niejawnego przejęcia cudzych ścieżek lub podstawienia zasobów za ARCHITECTURE lab. |
| **D2 — storage i uprawnienia:** rozstrzygnąć `neondb` vs proponowana `profitia_limits`, model danych/ownership, role owner/migrator/runtime i wymagany kontrakt E1 | Przed jakimkolwiek SQL/połączeniem/instalacją osobna zgoda i odbiór ograniczonych ról/izolacji; w tym zadaniu niczego nie skonfigurowano. |
| **D3 — granice środowiska i bezpieczeństwo:** zatwierdzić dokładne Development endpoint/branch/database/role, niezależne credentials i zasady Render network isolation/public access | Odczytane flagi oraz brak Production protection nie są akceptacją. Stage/Production wymagają własnego późniejszego odbioru, w tym polityki single-operator review, admin bypass i branch protection; nie są aktywowane przy Dev. |
| **D4 — koszty i limity techniczne:** zaakceptować plan Render, zakres compute Neon 0.25–8 CU, suspend/retention oraz ownera kosztów i ich granice | Nie ustalono ceny ani nie zmieniono parametrów. Limity techniczne infrastruktury pozostają odrębne od handlowych limitów pakietów. |
| **D5 — gotowa implementacja i release:** zaakceptowany dokładny SHA/artefakt, właściwe build/start/health, CI i jawna zgoda na pierwszy Development deploy | Zmiana blokujących komend jest odrębną operacją konfiguracyjną; ręczny deploy i first build nie są autoryzowane przez zapis inventory. |
| **D6 — first-deploy recovery i odbiór:** jawny brak potwierdzonego LKG aplikacji, procedura stop/cleanup/recovery i właściwe testy E1/tenancy/persistence | Backup/migracje/rehearsal tylko po odrębnej zgodzie. URL, provisioned service, `ready` lub failed build nie zastępują rzeczywistego odbioru. |

**Przed przyszłym Staging:** osobno zdecydować o utrzymaniu branchu z ustawionym expiry, potwierdzić aktualny branch po 2026-10-31 10:16:04 CET oraz zatwierdzić kontrolę wydań i ochronę środowiska. Development nie może zakładać, że ta rezerwacja będzie nadal istnieć, ani korzystać z Production jako fallbacku. Decyzja o TTL nie jest warunkiem zapisu faktów ani nakazem aktywacji Staging.

## 9. Governance, walidacja i handoff

Przed odczytami wykonano pełny preflight, canonical begin i require-begin — **PASS**, projekt ARCHITECTURE / Development, dokładnie dwa target paths → **Governance Source Layer / ALIGNED**, brak nested AGENTS dla `Canon/**`, brak legacy write. Własna czysta gałąź `architecture/package-limits-inventory-20261030` powstała ze świeżego main. Sprawdzono pliki **28 otwartych PR-ów**; nie było przecięcia z dwoma target paths.

Registration ID: `cmvurq82l000047no8hauvtot`; task conversation `pmos-task-v2:00736f102c21f9bcc6aa2bfe92a5adcf1237ae1150ebe72a0b9cecdbe3dfdae7`; rzeczywisty host `01a18b57-efdf-79e3-a75a-9061dc5e57cb`. PMOS i PHR wymagane, Memoros disabled przez profil. Końcowe closeout, publikacja i CI są odrębnymi późniejszymi zdarzeniami; ich rzeczywiste wyniki podaje finalny handoff.

Źródła odczytu: GitHub repo/PR API i `GET /repos/profitia/SG-dev/environments/{name}` oraz `deployment-branch-policies`; Render MCP `get_service`, `list_deploys` i oficjalny CLI `projects`, `environments prj-dbi556u1egvs73euin20` w potwierdzonym workspace; Neon MCP `describe_project`, `list_branches`, `list_postgres_databases`, `list_postgres_endpoints` z jawnym `project_id`. Nie pobierano sekretów ani DSN. Snapshot jest datowany; każda przyszła operacja wymaga nowego odczytu.

| Kontrola lokalna | Wynik |
| --- | --- |
| Governance manifest | PASS, **51 aktywnych wpisów**; manifest pozostaje **3.31.0**, bez nowego wpisu lub zmiany wersji kontraktu. |
| Governance / Identity onboarding / KRS routing | PASS, **40/40**, zero failed/skipped. |
| Wymagany zestaw PMOS lifecycle/profile/publication/recovery | PASS, **59/59**, zero failed/skipped. |
| PMOS typecheck i typecheck:lifecycle | PASS dla obu poleceń. |
| Integralność zamrożonej treści | Sekcje **1–14 BYTE_IDENTICAL** względem świeżego authority; w istniejącym nagłówku zmieniono wyłącznie wiersz statusu. Dodano sekcję 15. |
| Względne linki obu dokumentów | PASS, **17/17** istniejących celów. |
| Transkrypcja ID dostawców | PASS, **20/20** service/environment/deploy/branch/endpoint/database IDs porównanych z odczytanym snapshotem. GitHub IDs i przypisanie Render project potwierdzone odrębnymi odpowiedziami API/CLI. |

Zmiana obejmuje **wyłącznie ten wykaz oraz status i krótki aneks kanonu v1.0**. Manifest, routing, topologia, historyczny freeze i zamrożone sekcje 1–14 pozostają bez zmian. Końcowy staged whitespace/exact-scope check, czysty commit i pełny require-begin preflight są sprawdzane przed publikacją; zdalny CI dotyczy dokładnego opublikowanego candidate HEAD i jest raportowany po fakcie. **STOP: OWNER REVIEW — brak zgody na merge tego PR, implementację lub deployment.**
