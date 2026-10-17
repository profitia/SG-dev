# SG2 E1 — column-level source privilege drift

Status: SOURCE_CANDIDATE_NOT_DEPLOYED. Date: 2026-10-18 Europe/Warsaw (2026-10-17 UTC). Task `SG2-E1-MARKET-SOURCE-ACL-DRIFT-20261018`, SG2 / SG-dev / local / TARGET_ENVIRONMENT=development, authority `profitia/SG-dev/main`; base `c9cc2c7cc7956fc89a212f76179f9d92885869c7` after PR #458. Three exact paths passed before/begin/require-begin governance and current provider/routing checks. This is an independent follow-up to the gap explicitly recorded in the stored-forecast receipt; earlier evidence is not rewritten.

## Finding and source behavior

The existing stored-market reader inspected table-level privileges to detect unintended access outside its three approved objects. PostgreSQL can grant SELECT on one column while `has_table_privilege(...,'SELECT')` remains false. Consequently that descriptor alone could miss accidental column-level access. This is a confirmed gap in privilege-drift detection, not evidence of a deployed customer data leak or a new unauthorized cloud grant.

The same native reader now checks `has_any_column_privilege` alongside table privileges. It refuses unintended column-level SELECT/INSERT/UPDATE/REFERENCES outside the approved objects and write/reference/SELECT-with-grant-option privileges inside its source schema. It also verifies that the runtime lacks replication and source-schema CREATE rights and that the existing controlled owner is NOLOGIN with ordinary flags and no inherited role membership. A correct installation retains the existing behavior.

The read signature, history query/formatter, range/null/zero/unit semantics, three approved objects, bounded read-only transaction, installation receipt, SQL001 and its digest remain unchanged. The shared data-query helper and separate forecast reader are unchanged. No new policy engine, runtime, role, SQL migration, connection or application flag is introduced.

## Verification

- **357 local SG2 operation tests pass, with no failures, cancellations or skips.** Existing legacy, private API/SQL, market preview/analytics and stored-current forecast regressions remain active. The seven original snapshot DAO tests also pass independently. Strict changed-source and typed-test checking passes.
- Real ordinary PostgreSQL logins prove that column-only private/base SELECT gives `table_select=false` and `column_select=true`, while the source reader refuses it. The test uses synthetic private rows only.
- Column-only INSERT, UPDATE, REFERENCES and SELECT delegation; source schema CREATE; and runtime replication drift are refused. Every temporary fixture grant/flag is restored; the original shared read still works afterward. Shared fixture-owner flags are not changed concurrently.
- Exact candidate and merged-main controlled/public/dashboard/governance CI and build remain required for publication; their actual references belong to the canonical closeout.

No cloud role/grant/DDL, customer data, credential, configuration, activation or deployment is changed. This source increment does not establish live Prisma/TLS, browser login, business UAT, retained-artifact recovery or an E1 release. Forecast source initialization, remaining entrances/effects/jobs/cache/files and controlled Development then Staging releases remain E1 work. Production and E2–E4 remain outside this task.
