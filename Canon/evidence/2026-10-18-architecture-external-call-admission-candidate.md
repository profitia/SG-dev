# E1: bounded external-call admission — source candidate

Date: 2026-10-18. Profile ARCHITECTURE, TARGET_ENVIRONMENT=development.
Task: ARCHITECTURE-E1-EXTERNAL-CALL-ADMISSION-20261018.
Authority base: profitia/SG-dev main 9ebdabd53da99fea3244a0b0923ba5fb7d1096f7.
Status: SOURCE CANDIDATE; programme E0/E1 remains IN_PROGRESS.

## Accepted boundary

Optional package 1.13.0 export `external-call` and SQL009 reuse the existing
PLATFORM_INTERNAL physical source authority, operation executor, stored control
transactions and sole canonical source audit writer. Root SQL008, its host,
operation-context candidate, private request/delegation and old browser channels
are unchanged. There is no extra runtime, worker, queue, scheduler, identity or
audit implementation. Ordinary runtime roles get exact security-definer function
access only; extension tables remain owner-controlled with FORCE RLS.

A source intent requires an explicit current finite policy with fixed server
origin/path/method and request/JSON-response/deadline limits. The policy unit is
UPSTREAM_ATTEMPT_ADMISSION, distinct from the existing SOURCE_TRANSACTION control
unit and distinct from vendor actual requests/cost or customer billing. A new
admission consumes PLAN, ATTEMPT and SETTLE control transactions separately. There
is no automatic refund or network retry. A private 256-bit intent secret derives
per-intent HMAC request/response bindings and stable phase keys. Global metadata
and source audit contain opaque controls; no raw request, response, credential,
human actor or organisation is stored. Temporary local fixtures are synthetic.

PLAN acknowledgement loss may recover a still PLANNED intent. Network I/O needs
a fresh ATTEMPT write and its observed real commit; a replay/serialized receipt
cannot mint this observation. ATTEMPT acknowledgement loss may leave an unused
admission and never allows another automatic fetch. Response/SETTLE loss never
fabricates an available result. A timeout/cancellation cannot undo a committed
control or a remote effect. Returned bodies are not persisted for replay. Generic
certainty and no-retry errors preserve that distinction. HTTP error status is an
observed response, never a claim of successful business processing.

Actual current actor/binding, source policy and external policy/configuration are
checked at transitions and immediately before I/O and publication. The I/O
deadline is capped by observed authority expiry. Revocation after a response can
refuse publication; SQL checks and vendor I/O cannot form an atomic transaction.
Trusted server adapters/projectors remain part of the trust boundary. No exactly
once network/billing guarantee, DBA isolation or general tenant-security proof is
claimed. Token exchange, operator reconciliation, entitlement, licensing,
retention and customer scope need their separately accepted caller contracts.

## Verification recorded so far

- Real disposable PostgreSQL 16, actual ordinary login and native driver commits,
  local HTTP fixture: 29 checks passed, none skipped.
- Full existing contract/laboratory suite including this addition: 664 passed,
  none skipped, including the authority deadline and actor/configuration-rotation
  intent regression; full validation repeated after a workstation restart.
- Public strict TypeScript positive and expected-negative API checks: passed
  repeated on the final current declarations.
- Package syntax build passed. Optional schema installation under the wrong
  owner refused; transaction rollback left no partial extension.
- Finite admission/concurrency, repeated intent/conflicting content, PLAN/ATTEMPT/
  SETTLE acknowledgement loss, canonical OUTCOME audit rollback, credential
  failure, fixed destinations/methods/size, real timeout/cancellation, redirects,
  malformed/oversize JSON, current revocation, wrong role/schema/configuration,
  direct table and column ACL drift, history and FORCE RLS covered by real tests.
- An actual service-actor rotation test exposed a duplicate-intent risk in the
  first local candidate. A unique opaque intent index now survives actor, role,
  policy and configuration changes; changed technical authority cannot reopen
  that intent. The failing regression and configuration-rotation case both pass.
- The workstation restart preserved all nine source paths and the existing PMOS
  registration. Temporary fixtures/logs were lost and recreated; the final full
  suite above is a fresh observed run, not a claim that an interrupted run passed.
  Public CI exposed a timing-dependent cancellation test: a fixed delay could
  cancel before any send. The test now cancels from the actual local server
  request-observation event; the after-send assertion is retained. No production
  source or access check was relaxed. Final exact-SHA CI remains required.
  Recovery reused the original registration and verified architecture_pmos with
  its actual ordinary architecture_pmos_runtime role; no replacement begin.
- Governance 40/41: the existing exact SG2 local dependency version guard
  correctly refuses producer 1.13.0 against receiver 1.12.0. It remains enabled;
  separate SG2 and SRM adoption, exact candidate/main CI and own closeouts are
  pending. No failed check is presented as a pass.

## Non-delivery and remaining boundaries

No package registry publication, cloud migration, runtime role/grant, secret,
flag, provider request, resource or cost change, product deployment or Stage/
Production action occurred in this source unit. The extension is not installed
or used by applications merely because its source exists. This candidate grants
no HUMAN supplier refresh, Finder AI, KYS/PII, new account/organisation permission,
all-business-route coverage or tenant access. Six actual Finder and nine SRM
legacy business methods in the source-coverage baseline still require deliberate
caller adoption and parity tests before switching product identity. Real Clerk
login/bootstrap, ownership mapping, database migration/ordinary roles, retained
artifact recovery, Development/Stage releases and business UAT remain independent
programme requirements. Existing Development/Stage products are not switched by
this source candidate.
