# Committed Supplier phase inspection — source candidate, 2026-10-19

Project: ARCHITECTURE. Task: `ARCHITECTURE-E1-DELEGATED-PRIVATE-INSPECTION-20261019`.
Target: Development, isolated local validation. Authority baseline:
`profitia/SG-dev/main@2f5d968c24f3e5db4905ee63c061ed646b7d2a5f`.
Status: producer source tested; consumer integration and deployment are separate
acceptance boundaries. Full E1 remains IN_PROGRESS.

## Purpose and authority

The existing company workflow needs short authorized reads after a private phase
has actually committed, including identities and stored state needed for recovery.
A replayed write deliberately skips its callback, and an ACCEPTED phase cannot
borrow the original RESERVED write scope. This additive option supplies a distinct
read scope in the SAME delegated host, executor, driver and canonical audit path.
It does not replace the native company workflow or create another business engine.

The actual SERVICE login remains the actor; the initiating internal account is a
separate subject. Every inspection checks current original organization, account,
membership, product, permissions, delegation, runtime binding and external account
status. The historical ACCEPTED phase must match its current exact phase policy,
parent, payload and ownership. It is an anchor, not an access grant, identity proof,
lease extension, new parent, dispatch claim or quota reservation.

## Source contract

Platform package: `1.19.0`; operation implementation: `1.0.0-candidate.12`;
private host: `1.10.0`; optional inspection contract: `1.0.0`.

`createDelegatedPrivateInspectionHost` exposes only the bounded inspection method.
The server callback is void-only. Its public result contains only the accepted
request receipt after actual COMMIT. A trusted consumer capturing private read
results must discard them on any rejection. No private fields are serialized into
the metadata, receipt or audit. A successful producer test does not install an
application read policy or grant any previously unavailable product operation.

Optional SQL015 adds one immutable FORCE RLS installation receipt and read
descriptor/scope functions over existing job and phase records. There is no new
effect/read ledger, queue, runtime, writer, role or runtime grant. Original
SQL001–014 are byte-identical to the authority baseline. Of the 45 existing core
source/migration files, 41 are unchanged and four are explicitly revised host and
operation declarations/implementations. Three inspection source/migration files
are additive.

The physical canonical INTENT is recorded inside the same read transaction.
Binding requires that actual record; a deferred constraint refuses COMMIT without
the matching actual OUTCOME. The original ordinary-operation independent INTENT
path is preserved. A failed inspection rolls back its transactional audit pair;
the existing independent DENY/FAILURE writer retains the diagnostic decision.
An inspection cannot become a write phase in the same transaction.

Exact tested fingerprints:

| Component | SHA-256 |
| --- | --- |
| Operation source contract | `48700161f04fe382ee6cbd0af73bebabb5dfd20229f31ef2d8fd7fcf8440f742` |
| Private host source contract | `2f7866619ad62956389889aeb13b2260ffe196a1e35b4808f019ea20f0ef8784` |
| SQL015 | `00db4ebae666f6cd94475b789fecfbb775c0ebb2d66f87e595d674b827cdf13d` |
| Inspection source contract | `772f1f5a58e8e544d275c4b8bb0ab09774317a6673c1f6bd8563f96fc6a19811` |

## Observed validation

- Full producer and architecture-laboratory suite: 898 PASS, 0 FAIL, 0 skipped,
  using an own disposable PostgreSQL 16 cluster and ordinary runtime roles.
- Focused actual inspection PostgreSQL suite: 17 PASS, 0 FAIL, 0 skipped; included
  in the full suite, not an additional aggregate count.
- Public positive/negative TypeScript declarations: PASS. Package syntax build:
  PASS.
- Initial source-only governance regression: 41 PASS / 1 FAIL. The failure is
  `LOCAL_PACKAGE_VERSION_MISMATCH` in the unchanged controlled SG2 dependency
  validator: producer 1.19 precedes its independently owned consumer lock update.
  This is an explicit integration dependency, not a passed gate or justification
  to change the controller. Combined receiver acceptance must resolve and retest it.
- Physical inspection tests verify accepted reads, existing foreign organization,
  subject and parent row exclusion; no direct read outside scope; rejected DML;
  controlled-owner assumption and metadata-ACL refusal; omitted physical INTENT,
  failed/omitted OUTCOME and refused returned private callback data; current DENY,
  external account revocation, changed/revoked phase policy and wrong anchor.
- Original four write phases and replay still execute, and a default Forecast
  sibling job executes in the SAME isolated database after SQL015. The full suite
  also preserves the existing HUMAN and other producer paths.

The first two diagnostic native runs failed because the proposed read INTENT was
still sent through the independent audit connection. Its required transaction
scope was absent. The correction uses the existing writer in the current read
transaction and requires its explicit session port. No writer/sanitizer bypass,
undeclared source edit or weakening of the physical audit requirements was used.
Original failed logs remain local diagnostic evidence; they are not relabeled as
successful tests.

## Consumer and release boundaries

SRM and SG2 need separately registered compatibility receipts, exact source and
lock acceptance, native regression, types/build and actual combined candidate CI.
Existing Maps is also a real consumer: its embed peer currently pins platform
1.18.0. Publishing a minor source change without separately testing its peer/lock
compatibility would be incomplete. Maps compatibility is a distinct SRM-profile
receiving task; it does not authorize private Maps data functionality or deployment.

No cloud schema, role, grant, account, legacy ownership, data, secret, provider
configuration, resource, paid call or product deployment changed in this task.
Prepared Profitia starts with its own empty history; legacy demo history remains
at its original owner. Actual application read adoption, full native acquisition
and recovery composition, remaining covered callers, real owner session, live
roles/data/recovery and controlled Development release remain required for E1.
Staging retains its separate protected release boundary. No Production or E2–E4
execution is implied.
