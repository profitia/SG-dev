# SG2 Agent Entrypoint

This file is the stable, tool-neutral loader for repository work in `profitia/SG-dev`.

Before any repository mutation:

1. Load and apply `Canon/v2.0-mandatory-agent-execution-canon.md`.
2. Load every active document in `Canon/registries/governance-manifest-v2.json` in its declared order.
3. Run `node scripts/governance/validate-governance-manifest.mjs`.
4. Run `node scripts/governance/governance-preflight.mjs` with the exact task identity and target paths.
5. Register the task through `apps/pmos` command `npm run pmos:begin -- --input <file>` before implementation.

All gates are fail-closed. No source, configuration, schema, data, deployment, or infrastructure mutation is allowed before the applicable gates pass. Read-only work follows the read-only policy in the v2 Canon and still requires PMOS continuity, but must not fabricate a final closeout artifact before findings exist.

Tool-specific instruction files are adapters only. If an adapter conflicts with the v2 Canon, the v2 Canon and executable validation win.
