# SG2 Project Adapter v1

Status: ACTIVE_ADAPTER

Use project key `SG2`. Canonical repository: `profitia/SG-dev`; authority branch: `main`; workspace profile: `SG-dev`; routing registry: `Canon/registries/current-architecture-baseline-v1.json`.

PMOS, MEMOROS, and PHR are required according to `Canon/registries/profitia-projects-v1.json` only for SG2 tasks with `TARGET_ENVIRONMENT = development`. SG2 binds the complete continuity control plane to `development`. The PMOS runtime, PMOS database, PMOS credentials, PMOS write path, task history, and closeout lifecycle must not be duplicated into, redirected to, or created for Staging or Production. Database identity must match the registered SG2 PMOS Neon project, database, and endpoint. This adapter adds no lifecycle rules beyond the registered SG2 environment binding.

Short selector wrapper: `Pracujesz nad SG2 w repozytorium GitHub profitia/SG-dev. Użyj repozytoryjnego AGENTS.md, aktywnego manifestu, profilu SG2 i pełnego fail-closed preflightu. Nie używaj lokalnej nazwy folderu jako źródła authority.`
