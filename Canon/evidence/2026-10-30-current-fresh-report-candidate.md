# Current FRESH report composition — producer candidate, 2026-10-30

Status: **CANDIDATE_SOURCE_ONLY / CONSUMER_ADOPTION_PENDING**. This record is not
SOURCE GO, installation, activation or a measured supplier-performance result.

Producer: ARCHITECTURE, task `ARCHITECTURE-FRESH-CONSOLIDATION-CANDIDATE-20261030`,
workspace `SG-dev Architecture`, Development, isolated local execution. The human
Performance Recovery v2 instruction of 2026-10-29 explicitly requires formal
ARCHITECTURE coordination of necessary shared E1 changes. The receiving SRM task
is in host conversation `01a17c06-324b-7430-aabb-4b925962407f`; it retains its own
task, PMOS, adoption and release evidence.

## Public boundary and distribution

- Package: `@profitia/platform-current-fresh-report` **1.0.0**.
- Public import: `@profitia/platform-current-fresh-report`.
- Existing exact peer: `@profitia/platform-contracts` **1.32.3**.
- Location: `packages/platform-contracts/current-fresh-report`, inside the
  existing Architecture Platform owned contract surface. This is an optional
  composition library, without a new service, authorizer, writer or runtime.
- Contract: `profitia.current-fresh-report` **1.0.0**. Exact source/blob digests
  are in `apps/architecture-lab/current-fresh-report-acceptance.json`.
- `createCurrentFreshReportHost`, public types and
  `currentFreshReportSourceDigest` are exported through ESM and CommonJS.

Every pre-existing SDK source, root manifest, root lock, default host behavior
and helper fingerprint is unchanged. READY remains `current-human-read` 1.1.0.
SG2, Dashboard, Maps, Identity and pilot files/receipts remain unchanged. A bump
of the entire SDK was discarded before publication because it would needlessly
expand current version/peer receipts across those consumers.

The requested SG2 compatibility patch has **zero changed files**. No SG2 patch
was applied. Existing imports and peer requirements continue to resolve SDK
1.32.3. SRM alone will need to accept the new optional dependency in its own
manifest/lock and source receipt; that is not performed by this producer.

## Operation semantics

One factory instance handles exactly one ingress request and one company NIP.
It captures the actual Request, transport fingerprint, organisation selection,
command and idempotency key. An organisation selection never grants membership.
All three SQL transactions still use the unchanged canonical host, actual
ordinary role, current bindings, product/permission policy, RLS and audit.

1. **Probe:** canonical shared report read. Official identity H1 and fresh H2
   both run, including on MISS. A READY result returns only after H2 and COMMIT.
2. **Refresh admission on MISS:** the same verified immutable actor is bound to
   freshly resolved internal authority, locked by the canonical host in a new
   transaction. The existing request ledger reserves/accepts the command. Its
   outcome obtains a new official session and account observation. The exact
   binding held by that same SQL authority fence is reused within the transaction;
   it is not retained as authority for another phase. Revocation prevents COMMIT.
3. **Source/Work:** admission COMMIT has completed. The callback receives only
   the canonical request ID, organisation and command, without an Actor or
   ALLOW. Existing delegated Source/Work hosts must perform their existing
   account, scope, cost, PLAN/ATTEMPT/SETTLE, publication and audit checks. No
   user SQL transaction spans this callback. Its returned data cannot substitute
   for the protected response.
4. **Final read:** a new canonical transaction locks current authority. It reads
   only SHARED_KNOWLEDGE, projects the report, then performs fresh official SDK,
   session, account and independent binding validation. Resource/projection
   versions must still match. Only the final protected READY value is returned
   after OUTCOME and COMMIT.

The instance clears its request-owned identity flows after success or failure.
There is no TTL ALLOW cache, persisted account cache, supplied Actor, custom
Clerk client, old form-report admission, privileged SQL connection or alternate
audit writer. Credential authorized parties do not determine the receiver's
HTTP authority: a separate explicit `receiverBoundary` validates actual ingress.
Only the existing verified peer adapter changes identity-verifier input to SG2.

A later failure withholds the report and rolls back the current transaction.
It does not claim to undo an earlier committed request or Source publication.
Their actual receipts and normal reconciliation/recovery remain authoritative.

## Integration contract for the SRM owner

The receiver creates one factory per opening, using its existing approved
configuration, native driver, protected resource readers and projectors:

```ts
import {createCurrentFreshReportHost} from '@profitia/platform-current-fresh-report'

const host = createCurrentFreshReportHost({
  clerk, identity, receiverBoundary,
  probe: probeReadOptions,
  refresh: refreshAdmissionOptions,
  read: finalReadOptions,
})
const report = await host.execute({request, organisationId, nip, idempotencyKey}, {
  probe: probeAction,
  refresh: persistCanonicalRequest,
  work: async (selection, signal) => {
    await existingGuardedSourceAndNativeWork(selection, signal)
  },
  read: finalReadAction,
})
```

`probe`/`read` projectors must return exactly `{status:'MISS'}` or
`{status:'READY', value}`. The final result must be READY. The refresh action
retains the canonical request receipt, and Work uses that exact committed ID.
No operation/resource grant, Source authority or ability to call a provider is
inferred from this selection. Retry/replay remains owned by the existing ledger
and Source/Work lifecycle, without another idempotency or cost implementation.

Read configurations admit only `supplier.report.read`, SHARED_KNOWLEDGE and
`supplier_report`; refresh admits only `supplier.report.refresh` in the same
application, configuration, module and private-store binding. Existing JDG,
KYS, private data, exports and other entry points retain their accepted hosts.
Receiver integration must preserve their routing/fallback and business behavior.

The exact candidate HEAD, package/contract version and complete source digest
must be accepted in a separate SRM task, with independent tests and PMOS/PHR.
No SDK merge or product release is implied by this source candidate. No SG2,
Maps or Identity receipt should be rewritten to install the optional package.

## Evidence and limits

The new family passed **68 tests**, without failures or skips, on disposable
loopback PostgreSQL **16.14** and Node 24. It verifies actual ordinary-role RLS,
correlated canonical audit, separate physical transactions, rollback on current
account/session denial at PROBE/ROOT/FINAL, grant/binding denial, resource drift,
abort, outages, peer proof expiry, forged receiver authorities and concurrency.
Strict public type tests also reject alternate authority and Work output.

An actual offline packed consumer installation verifies public ESM/CommonJS
exports, the complete source fingerprint and one deduplicated canonical SDK
1.32.3 peer. It uses empty npm credential configuration, no lifecycle scripts,
no registry, no provider and no database connection. CI installs the optional
test dependency and includes this family through its existing producer globs.

The comparable real-SQL fixture observes:

| HUMAN path | Current composition | Candidate |
|---|---:|---:|
| READY session/account observations | 2 / 2 | 2 / 2 |
| FRESH session/account observations | 5 / 5 | 4 / 4 |
| Canonical SQL calls in comparable fixture | baseline | unchanged |
| FRESH physical user SQL transactions | 3 | 3 |

The ROOT current outcome check remains explicit. The final read reuses immutable
request identity, while current SQL authority and final disclosure are freshly
verified. No Source/Native account check is removed. The previous 11 account /
5 session / 275 E1 SQL production trace is **not** replaced by a lab claim.
One HUMAN pair is eliminated; the receiver must measure the actual complete
standalone and embedded flows after adoption and continue targeted work where
needed. Neither the six-second FRESH goal nor the two-second browser READY goal
is declared achieved by these tests.

Full producer/lab, governance, public build and remote exact-head CI evidence are
reported separately in this task's PMOS/PHR and draft PR. A passing producer test
does not prove consumer adoption, live provider behavior or a product deployment.
No cloud schema, policy, role, secret, service, deployment or data migration is
part of this candidate.
