# CIC Project Adapter v1

Status: ACTIVE_ADAPTER

Use project key `CIC`. Canonical repository: `profitia/conversational-intelligence-core`; authority branch: `main`; workspace profile: `conversational-intelligence-core`.

PMOS, MEMOROS, and PHR are required. Database identity must match the registered CIC Neon project, database, and endpoint. Product mutation remains fail-closed until the CIC repository publishes an active ownership/routing registry.

The first governance onboarding may modify only the exact `routingBootstrapPaths` declared in the project profile. This exception exists solely to create the project-local entrypoint, routing/code-state registry, validator, adapter, CI gate, and compatibility notices. The shared preflight must run against the CIC repository through `--repository-root`. As soon as the routing registry exists, bootstrap routing is no longer used and every target is resolved by the normal most-specific-match policy. Database onboarding and read-only audit remain permitted throughout.

Short selector wrapper: `Pracujesz nad CIC w repozytorium GitHub profitia/conversational-intelligence-core. Użyj aktywnego Profitia Governance Canon, profilu CIC oraz repozytoryjnego routingu. Nie rozpoczynaj mutacji, jeśli profil, repozytorium, routing lub PMOS nie przejdą preflightu.`
