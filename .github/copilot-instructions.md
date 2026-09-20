---
applyTo: "**"
---

# SG-dev GitHub Copilot Adapter

This file adapts GitHub Copilot to the repository-wide governance contract. It is not an independent PMOS or execution lifecycle.

Before analysis that may lead to mutation, load and apply:

1. `AGENTS.md`
2. `Canon/v2.0-mandatory-agent-execution-canon.md`
3. Active documents, in order, from `Canon/registries/governance-manifest-v2.json`

Then run the manifest validator and canonical governance preflight declared by `AGENTS.md`. Treat every gate as fail-closed. Do not mutate source, configuration, schema, data, deployments, or infrastructure until applicable gates pass and the managed task is registered through `pmos:begin`.

Preserve existing work, use the routing resolver for every exact target path, do not invent architecture classifications, do not fabricate `pending-artifact.json`, and do not record completion evidence before work occurs.

For SRM work, also apply the SRM adapter listed by the governance manifest. Tool-specific behavior must never weaken the v2 Canon or executable validators.
