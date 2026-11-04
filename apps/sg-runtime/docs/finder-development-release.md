# Finder Development release bindings

SG2 task: `SG2-FINDER-BINDINGS-RECOVERY-20261104`.

The existing Development service's configured Render start command is:

```sh
cd apps/sg-runtime && node scripts/verify-finder-development-bindings.mjs --wait && exec npm run start
```

The readiness step verifies the existing Finder dispatch and Source descriptors against the
instance's actual `RENDER_GIT_COMMIT`, service ID and adopted configuration/schema
versions. A mismatch prevents the new instance from accepting traffic. Other
environments and an explicitly disabled Finder do not open database connections.

The check uses only the already configured ordinary roles and descriptor reads,
with a read-only transaction, bounded timeouts and closed connections. It never
updates a binding, impersonates a user, calls a provider, reserves quota or grants
permissions. E1 still independently verifies every actual Finder operation.

## Existing Development release procedure

1. Refresh authority `main`, preserve concurrent accepted work and validate the
   exact candidate through the required CI. Recheck actual live SHA and that no
   other release is running. Use an explicit SHA, never a moving branch tip.
2. Retain the native rollback artifact/configuration and snapshot both exact
   binding rows, including their versions, identities, status and expiry. The
   recovery procedure restores only these configuration references using CAS;
   no database reset, data rollback or removal of another agent's changes.
3. Build the accepted SHA on the existing SG2 Development service. As the new
   instance starts, the readiness step allows up to 60 seconds for the controlled
   operator to synchronize both existing bindings. Renew only `deployment_id`
   and `source_ref` using exact row/version CAS under the existing controlled
   owner, preserving all other fields. Never put owner credentials in runtime.
   Restore and independently verify any temporary operator SET capability.
4. Verify `FINDER_RELEASE_BINDINGS / READY`, the exact resulting live deploy,
   metadata and all six selectors, a criteria search and a text search with real
   rendered results. Verify ordinary-role descriptors and successful E1 audit.
   A successful build or HTTP 200 alone is insufficient.
5. If a release fails, reconcile its exact state before another mutation. Restore
   compatible captured references with current CAS and retain the current live
   application. Never rebuild or deploy an old application just to match a stale
   binding. Complete canonical SG2 PMOS/MEMOROS/PHR closeout from actual evidence.

The singleton binding intentionally authorizes one deployment. Coordinate the
two CAS updates with startup to keep the cutover short. Preserve the configured
Render start command when updating this existing service. The application npm
scripts and its accepted integration receipts are unchanged. Local `npm start`
alone does not execute this deployment readiness check.

Run `node --test apps/sg-runtime/tests/finder-development-bindings.test.mjs` on
the exact candidate, followed by the existing controlled SG2 CI tests, typecheck
and build. The readiness tests require no credentials or database and do not
change the existing trusted CI controller or package policies.

Observability extends existing Render operational logs with bounded
`FINDER_RELEASE_BINDINGS` events: `WAITING`, `READY` and `BLOCKED`, technical code,
binding name, elapsed time and successful release SHA. No raw driver errors,
credentials, user identifiers or business payloads are logged.

## Metadata dictionaries and search criteria

The Finder selectors explicitly request global value dictionaries from the
existing authorized metadata views. Selected criteria remain on benchmark
SEARCH commands; they are not sent as peer filters when listing dictionary
values. This keeps Region text lookup bounded to the existing local query and
40 visible values, including after choosing Daily or another criterion.

The provider's [documented Web API client](https://github.com/macrobond/macrobond-data-api/blob/main/macrobond_data_api/web/web_types/metadata_methods.py)
uses `list_attribute_values(attribute_name)` for the global dictionary. No new
provider path, Source response limit, quota, permission or metadata schema is
introduced. Existing server contracts and all actual SEARCH criteria remain
unchanged.

For controlled operator work, inspect **every grantor row** in `pg_auth_members`.
A new self-grant can default to INHERIT TRUE. Explicitly keep INHERIT FALSE when
enabling temporary SET, and independently verify effective SET and USAGE FALSE
after restoration. Preserve the existing cloud-admin ADMIN delegation and any
other owner's grants; an inert self-grant must have all three options FALSE.
