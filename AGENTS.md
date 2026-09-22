# Profitia Governance Agent Entrypoint

This is the stable, tool-neutral loader for governed work in this repository.

Before any mutation:

1. Identify the project through `Canon/registries/profitia-projects-v1.json`; unknown projects fail closed.
2. Load `Canon/v3.0-profitia-agent-execution-canon.md` and every active document whose `appliesTo` contains `CORE` or the selected project key, in declared order.
3. Load every nested `AGENTS.md` covering the exact target paths.
4. Run `node scripts/governance/validate-governance-manifest.mjs`.
5. Declare `TARGET_ENVIRONMENT` (`development`, `staging`, or `production`) and run `node scripts/governance/governance-preflight.mjs` with the project, target environment, task identity, and every exact target path.
6. When the selected profile's continuity control plane applies to `TARGET_ENVIRONMENT`, register the task with `npm run pmos:begin -- --input <file>` from `apps/pmos`, including that target environment in the input, then rerun preflight with `--require-begin`. SG2 and SRM currently bind PMOS to Development only. Staging and Production never create PMOS or PHR continuity records for those profiles.

All gates fail closed. No source, configuration, schema, data, deployment, or infrastructure mutation is allowed before the applicable gates pass. Read-only audits use PMOS registration only when the selected project's continuity control plane applies; they do not create closeout evidence until factual findings exist.

Tool adapters and short project wrappers only select a project profile. They never replace or weaken the active Canon, routing registry, executable preflight, or PMOS lifecycle.
