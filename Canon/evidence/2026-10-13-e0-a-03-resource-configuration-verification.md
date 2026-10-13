# E0-A-03: weryfikacja konfiguracji zasobów Architecture Development

**Status:** RESOURCE_CONFIGURATION_VERIFIED / NEON_PLAN_SCOPE_EXCEPTION — zasoby i korekty potwierdzone; nie oznacza aktywacji profilu ani ukończenia całego onboardingu.

**Data:** 13 października 2026, Europe/Warsaw.

**Podstawa:** [plan E0-A](../v1.0-architecture-parallel-development-onboarding-plan.md), [instrukcja zasobów](../runbooks/architecture-development-resource-setup-v1.md), [wykonanie 01–02](2026-10-13-e0-a-01-02-implementation-verification.md).

Właściciel utworzył zasoby, przekazał adresy i polecił samodzielne sprawdzenie oraz bezpieczne korekty. Następnie wybrał najniższe płatne warianty z rozliczeniem miesięcznym. Identyfikacja wykorzystuje odczyt dostawcy i rzeczywiste ID, nie opisy linków w wiadomości.

## Potwierdzone zasoby Neon

Organizacja: org-nameless-field-92563437, obecny plan Scale. Oba projekty są nowe, należą do tej organizacji, używają AWS Frankfurt (aws-eu-central-1) i są odrębne od istniejących zasobów biznesowych oraz PMOS SG2/SRM.

| Przeznaczenie | Projekt | Wersja PostgreSQL | Gałąź | Bazy | Endpoint |
| --- | --- | --- | --- | --- | --- |
| PMOS architektury | [profitia-architecture-pmos / billowing-credit-07394675](https://console.neon.tech/app/projects/billowing-credit-07394675/branches/br-curly-dream-b94be6uh) | 17 | development / br-curly-dream-b94be6uh | architecture_pmos, owner neondb_owner | ep-solitary-unit-b9b3imd3 |
| Laboratorium | [profitia-architecture-lab / fancy-cell-49425728](https://console.neon.tech/app/projects/fancy-cell-49425728/branches/br-divine-fog-baohc5ay) | 18 | development / br-divine-fog-baohc5ay | architecture_sg_lab oraz architecture_srm_lab, owner architecture_sg_lab_owner | ep-dry-hat-bafvyimb |

Opisy dwóch adresów Neon w wiadomości właściciela były zamienione. Nazwy projektów, wersje PostgreSQL i bazy u dostawcy były prawidłowe, dlatego nie zamieniano projektów ani danych.

Obie gałęzie development są domyślnymi gałęziami źródłowymi nowych projektów, bez parent_id i expires_at. Odczyt katalogu każdej z trzech baz potwierdził 0 niesystemowych relacji i wyłącznie schemat public poza schematami systemowymi. Nie ma zaimportowanych danych PORR. Wariant z pustą gałęzią źródłową development przyjęto jako równoważny dla tego celu: osobne projekty i puste magazyny już zapewniają granicę laboratorium. Nie tworzono dodatkowej gałęzi production ani zbędnego compute.

### Korekty i odczyt po zmianie

| Ustawienie | Przed | Po | Zakres |
| --- | --- | --- | --- |
| Autoscaling minimum | 0.25 CU | 0.25 CU | Oba istniejące compute i oba project defaults |
| Autoscaling maximum | 8 CU | 1 CU | Oba istniejące compute i oba project defaults |
| suspend_timeout_seconds | 0 | 300 | Oba istniejące compute i oba project defaults |

Po aktualizacji odczytano ponownie oba projekty i listy endpointów; ustawienia 0.25–1 CU oraz 300 sekund potwierdzone. Pola dotyczące ról, passwordless access, poolera, sieci, historii i wersji PostgreSQL pozostały poza zakresem korekty. Nie wykonywano SQL mutującego ani migracji. Dobór chronionych połączeń i ról aplikacyjnych należy do dalszego onboardingu, a nie do niniejszego potwierdzenia pustych zasobów.

Możliwy powrót do poprzednich ustawień: max 8 CU i suspend timeout 0 w obu project defaults oraz endpointach. Przywrócenie nie wymaga resetu ani utraty danych. Nie było potrzeby rollbacku.

## GitHub

[architecture-development](https://github.com/profitia/SG-dev/settings/environments/24168168252/edit), environment ID 24168168252, repository profitia/SG-dev, ID 1247665550. API potwierdziło Selected branches and tags, jedyną regułę main typu branch (ID 62894583), brak Required reviewers i Wait timer oraz następujące niesekretne zmienne:

- PROJECT_KEY=ARCHITECTURE;
- TARGET_ENVIRONMENT=development;
- PMOS_MEMOROS_MODE=disabled.

Konfiguracja środowiska była poprawna i nie wymagała zmiany. Zmienne nie aktywują profilu ani workflow. Nie przekierowano innych środowisk.

Właścicielem repozytorium jest konto osobiste profitia (typ User), nie organizacja GitHub. Na bezpośrednie polecenie wyboru najniższego płatnego wariantu i rozliczenia miesięcznego wybrano GitHub Pro, 4 USD miesięcznie. Panel przed zatwierdzeniem potwierdził Pay monthly i 4 USD due today; po zatwierdzeniu wyświetlił sukces aktywacji GitHub Pro. Jest to bazowy plan konta, nie abonament pojedynczego Environment. Nie zmieniano subskrypcji Copilot ani danych płatniczych. [Plany GitHub](https://docs.github.com/en/get-started/learning-about-github/githubs-plans), [wybór rozliczenia miesięcznego](https://docs.github.com/en/billing/how-tos/manage-plan-and-licenses/upgrade-plan).

## Render

[ARCHITECTURE](https://dashboard.render.com/project/prj-db717krrjlhs739jgo0g), project prj-db717krrjlhs739jgo0g, workspace PROFITIA WORKSPACE / tea-d7lps8rbc2fs73cn80dg. Environment ID evm-db717krrjlhs739jgo1g.

Uwierzytelniony Dashboard potwierdził 0 usług i 0 env groups. Zmieniono nazwę Development na development oraz Cross-Environment Connections z Allowed na Blocked. Potwierdzenie Restrict connections dotyczyło wyłącznie pustego środowiska ARCHITECTURE. Odczyt po zapisaniu, także po odświeżeniu strony, potwierdził nazwę development i zaznaczone Blocked. Nie było otwartych połączeń usług do ponownego uruchomienia, ponieważ środowisko nie zawiera usług.

Workspace ma plan Pro, najniższy aktualny płatny plan workspace. Panel udostępnił zmianę izolacji w istniejącym planie; nie wykonano upgrade'u ani zmiany planu. [Kontrole środowisk](https://render.com/docs/projects), [aktualne plany workspace](https://render.com/docs/new-workspace-plans).

Możliwy powrót to nazwa Development i Allowed. ID środowiska i projektu pozostają stałe. Nie przenoszono usług biznesowych, nie tworzono nowych runtime, DNS, dysków, workers, cron ani baz Render.

## Koszt i wyjątek zakresu

Decyzja właściciela: rozliczenie miesięczne i najniższe płatne warianty. Nie określono twardego limitu całego rachunku w USD; wybór planu ani limit 1 CU nie jest takim limitem.

| Usługa | Stan po weryfikacji | Konsekwencja miesięczna |
| --- | --- | --- |
| GitHub | Pro, miesięcznie, aktywacja potwierdzona | 4 USD za bazowy plan konta |
| Render | Istniejący wspólny Pro; projekt ARCHITECTURE pusty | Cennik workspace Pro: 25 USD miesięcznie + osobno compute i usage; nie utworzono nowego płatnego workspace ani usług. Najniższy płatny compute dla przyszłych usług to Starter od 7 USD miesięcznie za usługę; uruchomienie poza obecnym etapem |
| Neon | Istniejąca wspólna organizacja Scale, dwa nowe projekty | Aktualna stawka compute Scale: 0.222 USD/CU-hour; storage, historia i inne usage rozliczane osobno. Najniższy płatny Launch ma stawkę 0.106 USD/CU-hour, lecz plan wybiera się dla organizacji, nie projektu |

[Cennik Neon i zakres planu](https://neon.com/pricing), [cennik Render](https://render.com/pricing).

Przykład, nie prognoza ani limit: oba compute działające przez 160 godzin miesięcznie na minimum 0.25 CU oznaczają 2 × 0.25 × 160 × 0.222 = 17.76 USD samego compute Neon. Rzeczywisty rachunek zależy od aktywności, autoscaling, storage i historii.

**NEON_PLAN_SCOPE_EXCEPTION:** nie przełączono wspólnej organizacji Scale na Launch. Zmiana objęłaby istniejące projekty biznesowe i funkcje planu, m.in. dostępne kontrole sieci, SLA oraz monitoring; nie można ustawić Launch wyłącznie dla tych dwóch nowych projektów. Nie przenoszono projektów do innej organizacji ani nie zmieniano własności lub dostępu. Ten punkt wymaga osobnego rozstrzygnięcia przed uznaniem, że wymóg najniższego płatnego planu został spełniony także w Neon.

## Granice potwierdzenia i stan dalszych prac

Konfiguracja nowych zasobów została sprawdzona i skorygowana. Wykonanie serwisowe E0-A-03 zostało wznowione na polecenie właściciela; wcześniejszy checkpoint AWAITING_USER_ACTIONS już nie opisuje tych czynności. Odbiór kosztowego wymogu Neon pozostaje otwarty i nie jest ukrywany jako DONE.

ARCHITECTURE nie jest aktywnym profilem. Bazy są puste i nie mają jeszcze schematu aplikacji, PMOS architektury nie działa, a trzy tory nie przeszły próby równoczesnej pracy. Uprawnienia użytkowników, tenant isolation produktu, testy bezpieczeństwa i billing aplikacji nie są potwierdzone przez ten etap. Etapy 04–09 pozostają poza bieżącym wykonaniem.

Prace prowadzono w wydzielonym checkoutcie. Bieżący main zawierał równoległy rozwój SRM (3573e58b18a43ef6867b46317e7c6998a4ad7009); uwzględniono go bez zmiany zakresu aplikacji biznesowych. Historyczny freeze i dowody 01–02 pozostają zachowane.
