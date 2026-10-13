# Start trzech torów i most ARCHITECTURE

Status: ACTIVE_RUNBOOK po odbiorzeE0-A-09. Jedno źródło profitia/SG-dev/main i jeden PMOS lifecycle; osobne checkouty, konfiguracje, artefakty i klony PHR.

## Zweryfikowane miejsca pracy

Lokalny parent: /Users/tomaszuscinski/Documents/Visual Code Studio/profitia-development. Tory: sg2, srm, architecture; ich osobne klony historii: sg2-phr, srm-phr, architecture-phr. Te nazwy katalogów nie są authority; authority/profil/baza muszą być potwierdzone.

| Projekt | Workspace | PMOS port | Pozostałe |
| --- | --- | --- | --- |
| SG2 | SG-dev | 3201 | runtime3001/dashboard3002 |
| SRM | SG-dev Codespaces SRM | 3202 | runtime3400 |
| ARCHITECTURE | SG-dev Architecture | 3203 | technicznyCLI;3500 reserved |

Nie współdziel node_modules, .next, .context, .pmos lub roboczego PHR clone. Każdy task ma nowy taskId i actual hostConversationId. CIC zachowuje własne repo/tor/PMOS; nie jest czwartym checkoutem SG-dev.

## Selektor i pełna bramka

Z właściwego checkoutu uruchom np.:

```bash
node scripts/governance/development-bridge.mjs select --project ARCHITECTURE
```

Selektor weryfikuje właściwy workspace/config i pokazuje profile, Development, porty i uporządkowaną listę aktualnego Canon. Nie jest GO do mutacji. Przeczytaj AGENTS.md, aktywne dokumenty oraz nested AGENTS dla każdego target.

```bash
node scripts/governance/development-bridge.mjs preflight --project ARCHITECTURE --task-id ARCHITECTURE-NAZWA-ZADANIA --title 'Rzeczywisty tytuł' --scope architecture --host-conversation-id RZECZYWISTE-ID-CZATU --target DOKLADNA-SCIEZKA
```

Podstaw rzeczywiste wartości i powtórz --target dla każdej ścieżki. Gdy host nie udostępnia ID, użyj jawnie --host-conversation-unavailable. Po PASS output zawiera template beginInput; uzupełnij pełny rzeczywisty request, zachowaj oryginalne ID/środowisko/gates i zapisz w ignored lokalnym miejscu. W apps/pmos użyj npm run pmos:begin -- --input /absolute/input.json. Następnie powtórz bridge preflight z tymi samymi danymi oraz --require-begin. Dopiero PASS zezwala na mutację. Brak --ci/--offline/--skip-runtime/--allow-dirty w moście jest świadomy; wyjątki techniczne mają własną kontrolowaną ścieżkę kanonu, nie bypass tego selektora.

Most jedynie wybiera istniejący profil i deleguje pełny governance-preflight. Nie pisze bezpośrednio do DB/PHR, nie wdraża, nie tworzy runtime lub drugiego lifecycle. Wyświetlone porty pochodzą z rejestru. Do lokalnego widoku PMOS po bramkach: z apps/pmos załaduj własny .env.local i uruchom Next na wskazanym PMOSporcie, np. node_modules/.bin/dotenv -e .env.local -- node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3203. PrivateRenderArchitecturePMOS nie ma publicznego URL.

## Krótki prompt mostu do pracy architektonicznej

> Pracujesz nad ARCHITECTURE w profitia/SG-dev, authority main, workspace SG-dev Architecture, TARGET_ENVIRONMENT development. Użyj repozytoryjnego AGENTS.md, aktualnego manifestu i pełnego Canon CORE/ARCHITECTURE. Przed mutacją sprawdź Git/main/istniejącą pracę, dokładne targety, pełny preflight, canonical pmos:begin i require-begin z rzeczywistym hostConversationId. Scope musi być kanoniczny. Korzystaj wyłącznie z własnej konfiguracji/PMOS/context/lock/PHR. Nie zmieniaj bezpośrednio produktówSG2/SRM; ich przyjęcie jest osobnym zadaniem właściwego projektu z referencją PR/SHA. Chroniony runtime ma ograniczone role własnych nowych baz. Zakończ canonical pmos:save i niezależną weryfikacją PMOS/remotePHR. Nie uruchamiaj E0–E4, Staging/Production, billing/domen lub nowych uprawnień poza odrębnie autoryzowanym zakresem. Most jest selektorem; nie zastępuje tych zasad.

SG2/SRM używają tych samych poleceń z własnym --project/workspace. Nadwzorowanie tej samej wspólnej ścieżki/kontraktu wymaga kontrolowanej integracji i świeżego main, nie blokady całego biznesowego developmentu.

## Źródła, zależności i powrót

Po każdej zmianie main sprawdź status/branch/HEAD i zachowaj cudzą pracę. Nie resetuj dirty checkout. Pracuj w osobnej gałęzi task; uzgodnij main przed merge/closeout. Każdy release ma własny zaakceptowany source SHA. Merge tooling nie wdraża SG2/SRM produktów.

Lokalna zależność file może być zainstalowaną kopią: po zmianie packages/srm-xray odśwież SRM npm ci --install-links z obecnego lockfile. Nie polegaj na samym version label. Installer development-workspace install --project SRM --root /absolute/srm --product używa tej opcji. SG2 instalacja wymaga własnego autoryzowanego dostępu do prywatnych pakietów; zakończony jednorazowy odczyt NPM_TOKEN nie jest zgodą na przyszłe ponowne odczyty. Nigdy nie zapisuj go w Canon/PMOS/PHR.

Build może wygenerować tracked outputs (SG2market-client lub SRMnext-env). Rozpoznaj istniejące zmiany przed build; zachowaj output i uzgodnij wyłącznie własne artefakty. Nie usuwaj pracy innego zadania. PHR retry zachowuje pending/recovery na niepowodzenie; wracaj przez kanoniczną ścieżkę, bez force-push i bez zmiany completed historii.

Codespaces/devcontainers są przygotowanymi receptami, nie potwierdzonym chmurowym wykonaniem. Pełne role/tenancy/auth/billing produktu i pełne userE2E pozostają poza odbioremE0-A. Konfiguracja runtime różni się od szerszego dostępu administracyjnego właściciela/agentów.
