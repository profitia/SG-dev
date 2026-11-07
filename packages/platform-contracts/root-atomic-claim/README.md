# Optional atomic Root dispatch claim

This is a Development producer candidate with an independent package, schema
and fingerprint. It composes the accepted SDK 1.32.3 and read-only MISS 1.0.0;
their source, exports, defaults and fingerprints remain unchanged. Installation,
receiver activation, product adoption and release require their own acceptance.

## Exact authority boundary

The canonical Root first completes its request. Its projection then performs
one typed claim of the same new Supplier dispatch, through the query port of
that exact Root transaction. It cannot claim a previous request, another actor,
organisation, operation, binding, source, or executor. Root remains HUMAN.

The ordinary fresh H3 and Root OUTCOME still follow. A deferred SQL constraint
prevents the claim from committing without that successful Root OUTCOME in the
same physical transaction. Claim state, attempt, lease and append-only control
provenance commit or roll back with Root. The existing Root INTENT/OUTCOME and
the private claim log audit this composite control effect; no fictitious Jobs
SERVICE event or separate audit writer is substituted.

Only the canonical post-COMMIT work callback receives an opaque, once-only
rootClaim object. It is valid only during that callback, for its original
request, command, organisation, actor, binding, expiry and abort signal.
Serialization and cloning do not preserve authority. No SQL port or lease is
exposed in the object, final report, browser response or network transport.
The receiver must await its delivery inside work; detached background delivery
is not this contract. The existing job path owns subsequent retry/recovery.

The delivery adapter additionally checks the committed Root provenance and the
current receiver inside the real Jobs transaction. It then calls the unchanged
canonical Jobs deliver port. Its current SERVICE/subject checks, original
Source port, actual Source COMMITTED evidence, budget, audit and reconciliation
remain in force. Neither native Work host or its late OUTCOME recheck changes.
Final H4 remains the accepted independent current disclosure check.

## Explicit recovery

A canonical Root replay receives rootClaim=null. The receiver must keep its
existing ordinary admit/deliver path for that case, including BUSY, lease,
attempt and uncertain Source recovery. An error, expired/forged proof, missing
installation or disabled receiver never silently falls back. A Root COMMIT
whose acknowledgement is uncertain does not issue a proof or start work.

READY uses the existing path without Root or claim. The report shape, existing
READY metadata callback, private data boundaries and public supplier knowledge
classification remain those of the receiver and accepted composers.

## SQL and activation

The migration is source only. It seeds no roles, grants, accounts, products,
receivers or enabled flags and changes none of the existing SQL functions.
Its owner must be the controlled NOLOGIN, NOINHERIT, non-administrative private
owner. All three new tables force RLS. Installation and control provenance are
immutable; receiver changes advance the existing authority revision.

The future operator must explicitly record the exact migration fingerprint,
configure the intended ordinary foreground/executor pair, and grant only the
new descriptor/claim or provenance-check function to the corresponding role.
This producer work performs such installation only in isolated local fixtures.
It does not install SQL in Neon, activate a runtime, change CI or grant live
permissions. Existing ordinary Root roles remain unable to call the canonical
SERVICE claim function directly.

## Acceptance

Require real PostgreSQL positive and refusal cases: Root rollback and missing
OUTCOME, current account revocation at H3/delivery/H4, no work before actual
COMMIT, uncertain COMMIT with ordinary replay recovery, stale/foreign/forged
proof, receiver revocation, expiry, abort, cross-role and cross-organisation
attempts, immutable audit and RLS, and separate actual Source COMMIT.

The candidate targets one initial admit boundary. It does not claim a particular
account count, SQL reduction, live timing or achievement of the FRESH latency
target. Producer acceptance is distinct from consumer integration and release.
