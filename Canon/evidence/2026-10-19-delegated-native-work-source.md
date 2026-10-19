# Native SQL work — shared producer source, 2026-10-19

Status: source candidate, locally verified; no consumer or cloud activation.

Own task `ARCHITECTURE-E1-DELEGATED-NATIVE-WORK-20261019`, ARCHITECTURE/Development/local, authority `profitia/SG-dev/main` at `546cdc6aad9aeba4a3d27ad6f5d6cb6313bba29e`. Continues accepted E0/E1 after the separately completed F17 SRM/SG2 tasks, PR532/533 and their own verified PMOS/PHR closeouts. This is an additive producer, not completed E1 or native SRM/MSR integration.

## Business reason and implemented boundary

The original company/cache/MSR engine has sixteen server-owned ports. Its document preparation and durable REQUESTED/RECEIVED/READY/BLOCKED state changes require multiple short SQL transactions around external work. A committed read must not become a writer, a four-phase replay must not silently skip a different domain write, and a transaction must not be held across paid acquisition. Existing MSR/source state owns replay and uncertain-delivery recovery; duplicating it in a second effect ledger would change the business behavior.

Platform1.20 / operation candidate.13 / host1.11 adds `createDelegatedNativeWorkHost` and optional SQL016. It reuses the same executor, original job/directory lease, real native driver and canonical audit writer. There is no new runtime, domain writer, provider client, queue, quota reservation or effect ledger. Each reviewed unit belongs to its original application, with immutable unit purpose/access mode and a finite, versioned policy. Current original subject, ordinary Service, request/application/organization and input digest remain mandatory. Logical command provenance comes from the original accepted immutable request; the receiving application must still verify its actual stored domain command and every affected row.

Actual transaction-local canonical INTENT is required before scope binding. Actual matching OUTCOME is required by a deferred constraint at COMMIT. Evidence records unit/access mode, input digest, physical transaction, policy version/source/expiry and schema digest. The factory returns only a receipt after commit; callbacks return void. A receiving server adapter must verify and discard any captured result on error. Receipt acceptance is not report READY, provider delivery or user access to a returned dataset.

READ never grants WRITE. A native unit cannot rebind the job, claim dispatch, observe delivery or reserve a once-only phase. SQL016 preserves original SQL001–015 bytes and adds an early native-frame refusal to those existing control functions. It does not replace their normal behavior. The shared canonical writer rejects inspection/phase/work mode mixing; a caller setting a transaction marker cannot create the required physical audit evidence.

No table rights or application row predicates are conferred by a unit policy alone. App-specific command checks, exact unit/row/field predicates, ordinary runtime grants, domain lifecycle/replay tests and output boundaries require independent receiving tasks. In particular, this is no authorization for KYS/personal data, arbitrary module writes or a new product operation.

## Actual isolated evidence

Full current producer/laboratory suite: **933 passed, zero failures/skips**, including the existing HUMAN, Forecast, four-phase and inspection behavior. Build/syntax validation: PASS. New export types compile with the unchanged canonical compiler settings and all existing type fixtures plus the new work fixture; its test driver adds that fixture without weakening the baseline type check or modifying the canonical compiler configuration.

Actual PostgreSQL/ordinary-role tests verify atomic installation rollback, preservation of existing function definitions on rollback, original Service/subject and physical transaction, correlated INTENT/OUTCOME, existing non-empty foreign rows excluded by RLS, READ denied INSERT/UPDATE/DELETE despite actual DML ACLs, wrong owner/org/unit/access mode, metadata privilege drift, current permission/account revocation and finite unit policy.

Two invocations execute the callback twice while the original domain ON CONFLICT retains one domain row: the authorization unit does not pretend to provide domain replay. Original phase effects, quota counters and dispatch attempt counts remain unchanged. Direct dispatch/job-rebind/phase-reserve attempts inside the unit are refused, also through a savepoint. Expiry after an actual SQL mutation rolls it back. Missing physical INTENT stops the callback; omitted OUTCOME fails actual COMMIT. Inspection/work switching in both directions is refused by the canonical writer. Arbitrary callback output is rejected.

The first full run passed929/930 and correctly failed the obsolete operation fingerprint literal. The new explicit fingerprint was accepted after examining the source/version change; no security or behavior test was weakened. The final933/933 includes the additional type/expiry/mixed-mode cases. Initial logs retain their failed status.

All original SQL001–015 remain byte-identical to authority. The changed existing core is limited to operation/host implementation and declarations; the new work implementation/declaration/SQL extend the exact source set from48 to51. Identity, access-store, old job/phase/inspection implementations and business/UI/provider code remain unchanged. The laboratory lock was declared as a possible target but needs no mutation: no dependency was added. Product and Maps source/locks/peer acceptance are not performed by this ARCHITECTURE task.

## Remaining acceptance and release boundary

Each actual receiver must independently accept exact source/locks and preserve its original behavior before integration. Producer tests are not evidence that the complete native SRM engine, MSR download/recovery, SG2 flow or Maps embedding uses this scope. Existing real APIs, remaining working Finder/SRM ingress, actual owner login, live least-privilege/data/recovery verification and controlled Development release remain IN_PROGRESS for full E1. Staging retains its own protected review; no Production/E2–E4 is added.

This producer performs no cloud schema, role/grant, customer data, identity, configuration, credential, resource, vendor or product deployment change. Prepared Profitia remains empty; legacy demo history keeps its original owner. No Render package credential is reread. Own ARCHITECTURE PMOS/PHR uses its ordinary `architecture_pmos_runtime`; receiving histories remain in their own profiles.
