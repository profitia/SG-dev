# Forecast Deployment Canon

Status: CANONICAL - POST-MIGRATION ROUTING
Scope: Dashboard Preview forecast and benchmark presentation deployment routing
Canonical repository authority: `profitia/SG-dev` / `main`
Canonical local workspace: `/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev-main`
Canonical write path: `apps/dashboard-preview`
Render deployment identity: `dashboards-library`
Historical standalone repository: `profitia/dashboards-library`

Supersedes for current writes:

- any prior instruction that routes Dashboard Preview changes through `profitia/dashboards-library`
- any prior sync, export, replay, or mirror workflow from `apps/dashboard-preview` into a standalone deployment repository
- any inference that the Render service name `dashboards-library` determines source ownership

## 1. Purpose

This canon removes post-migration ambiguity between Dashboard Preview source ownership and the Render service that deploys it.

The mandatory current rule is:

```text
Dashboard Preview capability
-> logical owner: Dashboard Preview
-> canonical source repository: profitia/SG-dev
-> canonical branch: main
-> canonical source path: apps/dashboard-preview
-> deployment impact: Render service dashboards-library
```

## 2. Source ownership is separate from deployment identity

The following distinction is mandatory:

```text
Dashboard Preview
= logical owner and code owner

dashboards-library
= Render deployment identity only
```

The Render service name must be used only after source routing has already been resolved.

The following inference is forbidden:

```text
Render service name
-> similarly named GitHub repository
-> source authority
```

## 3. Canonical current routing

For Dashboard Preview presentation work, including benchmark chart presentation, Historical visualization, Forecast visualization, Forecast Portfolio controls, Forecast Verification presentation, and related presentation state:

```text
AUTHOR IN:
profitia/SG-dev
main
apps/dashboard-preview

COMMIT/PUSH THROUGH:
profitia/SG-dev
main

DEPLOYMENT IMPACT:
Render dashboards-library
```

## 4. Historical standalone repository classification

`profitia/dashboards-library` is historical topology evidence only.

Current classification:

```text
profitia/dashboards-library
= HISTORICAL
= SUPERSEDED
= NOT canonical source
= NOT deployment handoff repository
= NOT synchronization target
= MUST NOT receive current Dashboard Preview changes
```

Required result:

```text
DUAL_SOURCE_MAINTENANCE_ALLOWED = NO
```

## 5. Relationship to broader canon

This document is subordinate to and must be interpreted consistently with:

- `Canon/v1.0-repository-routing-and-module-ownership-canon.md`
- `Canon/v1.0-post-migration-architecture-state-and-change-classification-canon.md`
- `Canon/v1.0-mandatory-canonical-routing-guard-wrapper.md`

Those broader canons already establish that:

- Dashboard Preview owns forecast presentation behavior in `apps/dashboard-preview`
- `apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts` remains a nested active `LEGACY` bridge
- deployment names are deployment metadata, not ownership authority

## 6. Legacy bridge exception remains separate

This deployment canon does not reclassify product paths.

`apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts` remains classified through the architecture registry and owner canon as a nested `LEGACY` bridge inside the Dashboard Preview app.

That path does not create a second source repository and does not authorize standalone repository writes.

## 7. Acceptance example

If the task is:

```text
Fix a Forecast Portfolio presentation defect in Dashboard Preview and deploy it live.
```

the only lawful answer is:

```text
AUTHOR IN:
profitia/SG-dev/main/apps/dashboard-preview

COMMIT/PUSH THROUGH:
profitia/SG-dev/main

LIVE DEPLOYMENT:
Render service dashboards-library

WRITE/SYNC/REPLAY TO:
profitia/dashboards-library

ANSWER:
NO
```