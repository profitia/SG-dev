# Private forecast-request reservation candidate — 18 October 2026

Status: locally verified producer source candidate. Separate SG2/SRM adoption, exact candidate/main CI and canonical closeout remain required. This is not job execution, measured compute/provider cost accounting or product release acceptance.

Task `ARCHITECTURE-E1-FORECAST-REQUEST-RESERVATION-20261018`; ARCHITECTURE; workspace SG-dev Architecture; target Development; execution local. Sixteen aligned exact paths; full manifest/before/begin/require-begin preflight. Own registration `cmvdl7jhp0000ix3m4u9oa9pg` in architecture_pmos; MEMOROS disabled by profile. Basis: accepted E0/E1 steps01–11, after independently verified PR474 and three canonical closeouts. No one-time PHR authority exception is reused.

## Bounded contract and existing authority

Platform-contracts1.10.0, operation implementation candidate.6 and private-operation-host1.4.0 extend the same executor with the HUMAN-only private subset of AM20 forecast.request. Its effect is REQUEST_COMPUTE, but the bounded effect here is acceptance of a private OPERATION_AUDIT request intent. SERVICE delegation, job.execute, PLATFORM knowledge.ingest, global source writes, external acquisition and actual computation remain unsupported. The existing fifteen operations retain their behavior and NOT_APPLICABLE usage policy; current identity/access/module/SQL001–005 sources are unchanged.

Current human identity, account/member, explicit permission/DENY, product/forecast feature, physical store, module binding and user/organisation ownership are required. The request does not infer a right from a session, role label, opaque key, previous success or an administrator name. The existing benchmark module fence is mandatory. The private host explicitly opts into SQL006 by its accepted digest in the same ordinary-role private transaction; no source or connection is selected from HTTP input.

An explicit finite, current PRODUCT_POLICY defines one accepted-request unit, source/version, window and expiry. No missing/null/infinite limit becomes an unmetered offer. This unit is not a currency charge, measured CPU allocation or proof of reserved vendor credits. Request acceptance grants no global execution permission.

The opaque key is hashed with application/environment/actor/operation; a separate binding fingerprint also covers organisation, resource and canonical payload digest. An altered scope/data under that actor key conflicts. Current rights and policy are checked again for replay, which does not call the private effect or consume another unit. Raw keys, command bodies, sessions, provider/scientific data and arbitrary cached output are absent from this ledger. The internal receipt has only requestId/status:ACCEPTED and is projected anew for each authorised response.

After durable INTENT, the same private transaction locks policy, reserves a unit, writes the host's private intent and its closed receipt, validates projection/expiry/current scope, and commits OUTCOME. Any failure rolls back quota, receipt and private SQL effect; independently durable correlated INTENT/FAILURE survives. The adapter binds per-request query/transaction/policy/reservation provenance and rejects reuse in another transaction. Accepted request metadata is immutable. A product-specific typed private command can reference the intent in the same transaction; the existing forecast queue/worker remains the sole computation implementation.

## Database enforcement

Additive SQL006 creates only profitia_requests installation/policies/intents under the existing controlled NOLOGIN/NOINHERIT/NOBYPASSRLS profitia_access_owner. No additional owner role, parallel authority or client is introduced. FORCE RLS applies to all three tables. Current scoped ordinary SELECT admits only the actual user/organisation and applicable operation/product/module. Restrictive policies prevent runtime table INSERT/UPDATE/DELETE even after an accidental broad grant. Closed functions alone perform reservation and acceptance.

Composite policy/application/organisation and membership keys enforce owner consistency. Policy definitions and accepted intents cannot be rewritten; counters are monotonic. Quota is checked before inserting a new reserved row, so a denied request cannot be accepted later without funding. A deferred database constraint rejects committing RESERVED metadata before acceptance. Descriptor/schema digest, actual ordinary role, controlled owner, source/physical binding and transaction/module fences are independently checked. As with the existing authority model, this is not a guarantee against a database administrator or stolen fully privileged backend credentials.

## Local evidence

499 whole-package/laboratory tests pass, zero failed/cancelled/skipped:332 original package tests,35 new pure contract tests,118 existing laboratory tests and14 new genuine PostgreSQL cases. Package syntax build and strict public declarations pass; prior real Node/browser MessagePort declarations also remain valid. Negative declarations reject an omitted request schema binding, a replacement physical role and unimplemented job.execute.

Actual ordinary-role SQL cases prove concurrent same-key single effect/quota, concurrent distinct-key capacity, current replay at capacity, changed payload/resource/org conflicts, account membership/product/permission denial, separate users/orgs, source mismatch, expired/revoked policy, scoped SELECT, fenced direct DML, current foreign-scope refusal, rejected premature COMMIT, immutable accepted/policy rows and owner foreign keys. OUTCOME outage leaves zero private command/intent/quota and independently durable correlated INTENT/FAILURE. Network/provider calls are trapped.

An initial local invocation was automatically rejected before execution due concern about a shared fixture reset. The safer test creates a uniquely named new database, refuses adoption and verifies the actual database before fixture reset. Validation ran in newly initialised local PostgreSQL16 clusters on separate ports; existing clusters and cloud were untouched. Full parallel testing exposed the new test's missing participation in the existing shared role-bootstrap lock. It now uses that same canonical laboratory lock; the final full suite is green. Failed diagnostics remain preserved.

## Adoption boundaries and fingerprints

| Source | SHA256 |
| --- | --- |
| Operation candidate.6 | f642b1c7bdaff44a1ff649d8a3d415253e39885f5e2a50d31d57d8b7641f3ec2 |
| Private host1.4, including ledger provenance | fad21055156587109ee1a24856b3471ea54211cb76eb4708d08bcc0e376f446b |
| Request ledger source/types/SQL | 9f132054b196580e2ac59c6d2adb7306cbb75f76cb66c430fbb5d249cd5cb916 |
| SQL006 | 8eb2b2d12f16e68bed1c2e0498df002b36d21efe42ecb84ba2dd65eef826a1d1 |

No package registry publication, automatic migration/bootstrap/policy/grant, cloud data/schema/role/secret/configuration/flag/resource change or deployment. Existing Development and Staging products continue using their current artifacts. No Production or E2–E4 expansion.

Separate receivers must explicitly accept changed version/fingerprints and exercise their real drivers and business code. Source acceptance is not the complete AM20 row, delegated background execution, forecast preparation/UI parity or full E0/E1. Those remaining tasks, recovery and controlled Development then Staging releases remain in the accepted programme.
