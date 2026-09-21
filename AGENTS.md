# Profitia Governance Agent Entrypoint

This is the stable, tool-neutral loader for governed work in this repository.

Before any mutation:

1. Identify the project through `Canon/registries/profitia-projects-v1.json`; unknown projects fail closed.
2. Load `Canon/v3.0-profitia-agent-execution-canon.md` and every active document whose `appliesTo` contains `CORE` or the selected project key, in declared order.
3. Load every nested `AGENTS.md` covering the exact target paths.
4. Run `node scripts/governance/validate-governance-manifest.mjs`.
5. Run `node scripts/governance/governance-preflight.mjs` with the project, task identity, and every exact target path.
6. Register the task with `npm run pmos:begin -- --input <file>` from `apps/pmos`, then rerun preflight with `--require-begin`.

All gates fail closed. No source, configuration, schema, data, deployment, or infrastructure mutation is allowed before the applicable gates pass. Read-only audits still use PMOS registration but do not create closeout evidence until factual findings exist.

Tool adapters and short project wrappers only select a project profile. They never replace or weaken the active Canon, routing registry, executable preflight, or PMOS lifecycle.
