# SRM Project Adapter v2

Status: ACTIVE_ADAPTER

Use project key `SRM`. Canonical repository: `profitia/SG-dev`; authority branch: `main`; workspace profile: `SG-dev Codespaces SRM`; execution environment: Codespaces when required by the task; routing registry: `Canon/registries/current-architecture-baseline-v1.json`.

PMOS and PHR are required. MEMOROS is disabled only because the registered SRM profile says so; an environment variable cannot change that policy. Database identity must match the registered SRM Neon project, `srm_pmos`, and endpoint. This adapter adds no independent lifecycle.

Short selector wrapper: `Pracujesz nad SRM w repozytorium GitHub profitia/SG-dev. Użyj repozytoryjnego AGENTS.md, aktywnego manifestu, profilu SRM i pełnego fail-closed preflightu. Nie stosuj zasad SG2 ani lokalnego folderu jako repository authority.`
