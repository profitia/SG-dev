# TASK02-R — bounded KRS CI correction and publication proposal

Profile ARCHITECTURE, Development source only. Linked to running
SRM-SUPPLIER-LOCATIONS-TASK02-R-20261022. This task does not reopen completed
producer/consumer tasks or change product source, protected CI credentials,
SQL, live bindings, Maps configuration, main, deployments or activation.

KRS CI previously asserted that every changed path belonged to KRS and that
all consumer/SDK trees were unchanged. A correct multi-owner dependency
candidate consequently failed after its runtime/contract/PostgreSQL/build tests.
The correction routes **all** NUL-delimited changed paths through canonical
owners, runs each actual owner's complete CI preflight, rejects unknown,
ambiguous, legacy or malformed paths, validates exact HEAD/distinct ancestor
base before and after checking, and records each before/after protected tree.
Changed dependency trees are explicitly labelled OWNER_DEPENDENCY_CHANGED;
only equal trees enter preserved. Existing KRS tests, PostgreSQL/performance,
artifact verification and consumer acceptance assertions remain required.

The routing implementation and six negative/positive tests reuse reviewed
Identity611 source30c07f0684d5a5dce707e8dcb38b8ba63d6db03b under the KRS
owner. No product authorization engine is introduced.

The shared integration runbook contains an explicitly **pending** atomic
publication proposal. It gives no self-executing permission to aggregate
owner source or merge failing PRs. Protected controller policy is unchanged.

Local routing6/6 and governance39/39 PASS, no skipped tests. Remote CI,
exact final source, owner PMOS/PHR and readback are recorded at closeout.
