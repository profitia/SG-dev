# SG2 D1 consumer — installation held

Exact producer source: `cb150a9e48f4f58db9f553191d434db5641dd995`. Consumer task SG2-FINDER-D1-AUDIT-READER-20261103. This is prepared file-level adoption, not accepted producer/consumer release or installation authority.

| Approved source artifact | SHA256 |
|---|---|
| packages/platform-contracts/src/sg2-denial-audit-reader.mjs | bb2c0b14a2c3de455808484db91c485f7371d82ac806c683db60a6780be23c9b |
| packages/platform-contracts/migrations/denial-audit/private.sql | 011cd8a550f738a69fb6983f0ea4437c3a4f2a51374aa7d9048af04d2e7a47cc |
| packages/platform-contracts/migrations/denial-audit/source.sql | 7f1c21546abc8bfe47908f30b9cab836ada272948ce3ea2ddfdd0eea5475efa7 |
| packages/platform-contracts/migrations/denial-audit/roles.sql | 09ace8f3621d31c4d411a375b1b31f2f6a48a9f53f86da3b5bb4e05b292f692b |
| packages/platform-contracts/migrations/denial-audit/expire.sql | 8855e8fabaa95758799a54f366654be1e475d9e1f9270b477bcebe33d5ebdd2b |

The existing SDK version/exports/receipts remain unchanged. No route, application import, provider, worker or build command imports this optional operator script. The producer has a separate Architecture Draft PR; this consumer Draft PR contains only SG2 files. Neither implies approval of the other.

## Execution contract

prepareD1Consumer verifies the exact producer git HEAD and every pinned file byte against immutable git blobs before loading the standalone producer module. It never fetches code or accepts a changed SHA. Dedicated ordinary clients are confined to fixed read_case calls. Each query is wrapped in BEGIN READ ONLY with server statement/lock deadlines and a client timeout. The live session_user/current_user/database must match the dedicated role and store. Exceptions expose no query, row, credential or partial result.

The only reader operation is read() with no arguments: H1/H2/H3/H4/C1 from both stores, exactly[T−5s,T+7s), total100rows max before disclosure. Raw client filters/IDs are rejected. Missing store, expired authorization, bad projection or missing durable audit outcome discards all buffered output. No reason/checkpoint is reconstructed from missing evidence. Native SQL logs use execution references distinct from private historical IDs.

## Required installation approvals and operators

INSTALLATION_APPROVED=NO; LIVE_READER_INSTALLED=NO; OPERATOR_AUTHORITY=NOT_ASSIGNED_OR_APPROVED. Identify a named existing authenticated role administrator and a controlled-schema operator independently for each database. The adapter must never substitute a tool default owner connection. Private installation is under profitia_access_owner; Source under profitia_ingestion_owner, both existing NOLOGIN owners. Operator must have separately approved CREATEROLE and temporary SET ROLE authority for the matching controlled owner, with no superuser/BYPASSRLS. Restore approved temporary operator memberships after completion. Role administrator creates only the matching ordinary sg2_d1_private_denial_reader or sg2_d1_source_denial_reader, never a product runtime grant. Secret provisioning/credential expiry <=30minutes uses the protected provider mechanism; no values enter source/PMOS/PHR.

Require explicit Private producer, Source producer, SG2 consumer and operations approvals of exact source/SQL digests and the specified operator identities. The audit adapter must be bound to real canonical PMOS begin/save acknowledgements, native Neon LOG retrieval and expiry policy before any protected read. In isolated tests those acknowledgements are synthetic; no operational backing is claimed. A callback returning durable:true without a real verified receipt is not sufficient. No alternate PMOS database write or parallel audit framework is authorized.

## Controlled future sequence

1. Capture and hash permissions snapshot: exact endpoint/project/branch/database, store schema/columns/constraints/RLS/policies, audit owner, existing/new role attributes and memberships, table/function grants and new object absence. Read Access/Source descriptors with appropriate ordinary roles and compare revisions339/70 to the accepted fresh baseline; a later change requires review, not an automatic reset. Establish canonical PMOS execution registration with the exact5case scope, authorization/expiry and operators before protected SELECT.
2. Verify digest of roles.sql and matching private.sql/source.sql and the actual native logging path/retention. Execute role preparation only under separately authorized role administrator. Verify that the role has no inherited/admin/base-table rights. Execute each matching projection SQL atomically under its controlled owner. There is no shared transaction across databases. Verify actual compiled function owner/search_path/ACL and expires_at, while preserving FORCE RLS and all original data.
3. Before real reads, verify ordinary-role raw SELECT/DML/binding-update/SET ROLE denials, fixed case/scope/expiry guards, read-only transaction behavior, native LOG INTENT/OUTCOME/REJECTED retrieval and durable execution intent. Limit positive checks to explicitly approved historical cases; no new Finder/Forecast/providers.
4. Run read() once through the approved operator/audit adapter. Keep both databases available. Persist outcome counts/hash and10native invocation references before release. Publish only the bounded redacted result under the separately authorized execution task; retain WINDOW_ONLY/NOT_RECORDED or ambiguity, not inferred root cause. If commit/audit acknowledgement is uncertain, stop and reconcile before any retry.
5. Under the same separate approval execute expire.sql independently in both exact databases. Verify EXECUTE/USAGE removal, NOLOGIN, outstanding sessions and unchanged base RLS/binding versions/revisions. Retain schema objects, original events, source receipts and operator evidence. Do not drop, lower revisions, reset budgets or change Source history.

If one role/schema install fails, stop reads. Disable only that new role if no projection exists; expire the successful projection using its exact approved expire.sql if the other side fails. Preserve partial attempt receipts and permissions snapshots. Recovery concerns D1 access only; no Finder binding, runtime, deploy, worker or business effect is reverted.

## Validation and product state

Run node --test apps/sg-runtime/scripts/denial-audit/d1-reader.test.mjs with the producer exact git object available in the repository. Tests create/remove only their own local synthetic worktree and use fake clients/audit; no database or provider connection. Producer PostgreSQL16/18 tests independently prove ordinary-role RLS/ACL, immutable logs, native execution LOG after rollback, query boundaries and access expiry. Consumer tests do not prove installation or operational PMOS/native-log availability.

Historical reasonCode remains NOT_OBSERVED. Finder503 is not repaired. Forecast status is the prior scoped PARTIAL result, not retested. PostHog remains OFF under prior verified runtime observation, activation prohibited; no SDK/env/deployment/binding changes. Monitoring: NOT_APPLICABLE to unchanged runtime; controlled execution audit is required before installation.
