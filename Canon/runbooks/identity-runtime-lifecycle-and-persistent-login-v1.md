# Identity Runtime lifecycle and persistent login — B2-E preparation

Owner Architecture Platform. ARCHITECTURE / Development. Task `ARCHITECTURE-IDENTITY-B2-E-LIFECYCLE-20261022`. This runbook implements no policy and installs no SQL. The single owner decision remains [PR600's decision record](../evidence/2026-10-22-identity-runtime-porr-first-decision.md); this document supplies its technical preparation, not a competing decision.

## Six lifecycles and verified baseline

| Object | Authority | Lifetime / consequence |
| --- | --- | --- |
| Permanent Profitia User ID | B1 account | Stable identity; independent of organisation membership |
| External issuer/subject mapping | B1 external identities | Same user mapping, status and version; never reassign on renewal |
| Current identity proof | SDK + B1 | Minimum of verified token/session/abandon and binding expiry |
| Browser session | Clerk | SDK-managed session; an active session alone grants no product access |
| Organisation membership | Access Store | Explicit, current membership in the chosen organisation |
| Product permission | Access Store + protected-operation host | Current product grant and action permission, enforced per transaction |

Accepted B1 migration `packages/platform-contracts/migrations/profile/001-user-profile.sql`, digest `a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3`, permits at most 300000 ms of binding validity. Actual provisioning is additionally capped by the observed JWT/session deadlines. `provision_account` returns the existing active unexpired mapping without extending it; expired/revoked/disabled cases deny. The authenticator requires current binding validity, so calling the normal authenticator first cannot bootstrap expired-binding recovery. No new user/profile/organisation may be created by a future renewal endpoint.

B1/B2/B2-D acceptance is reused, not reopened. B2-D runs the accepted `aa95c0a0a14fb2f2ba5af7338c8d83a6fb349269` health-only artifact. Current main includes unrelated SRM evidence; it is not an identity drift. SDK remains `@clerk/backend` 3.25.0, contracts remain 1.24.0 and their runtime/migration files are unchanged.

## Renewal alternatives and recommended policy proposal

| Approach | Benefit | Boundary |
| --- | --- | --- |
| Increase binding TTL to the Clerk session lifetime | Fewer writes | Rejected: changes proof semantics and revocation exposure |
| Extend only a still-valid binding on demand | Smallest new operation | Does not solve returning after hours/days |
| Bounded on-demand revalidation, explicit expired-active recovery mode | Supports return without requesting a password solely for B1 expiry | Recommended for owner review; new privileged operation/policy/migration required |
| Background renewal / permission polling | Keeps idle proofs alive | Not required; unnecessary load and lifecycle complexity |

Proposed defaults: renewal disabled, expired recovery disabled, existing 300000 ms ceiling unchanged; renew only on a request requiring identity when remaining validity is <=30000 ms. Actual new deadline is `min(DB now + configured ceiling, freshly verified token expiry, session expiry, abandon deadline)`. Thus a short token may make the effective period much shorter than five minutes. Expired recovery is an independently selectable policy; propose maximum age 7 days, capped by still-current provider session validity, to match the observed Development session horizon. Until explicitly approved, its maximum age is zero and all expired bindings deny. Never interpret a valid Clerk session as that approval.

Repeated browser token refresh is official SDK activity, not permission polling. Do not renew the binding for idle background clients merely to keep it alive. Short proof expiry must be displayed as a revalidation/service problem when policy disallows renewal; do not prompt for a password as if that repaired B1. A real Clerk challenge/expiry must still run the official flow.

### Proposed backend contract (not exported or implemented)

`POST /v1/identity/binding/revalidate`, same exact receiver origin, POST JSON and CSRF rules as B2. Closed browser body `{}` only. Browser supplies no subject, user, account, organisation, expected version, policy mode, expiry or redirect. Rate-limit per verified session and receiver; one bounded conflict retry, then fail closed. No raw token/proof/key enters logs, chat, traces or audit.

Future adapter reuses `createClerkIdentityAuthenticator`'s **existing binding callback pattern** from `createIdentityProvisioner`: official request authentication, exact issuer/authorized party/session subject, active provider session and nonblocked current provider user precede the callback. In that callback, read protected renewal metadata for this already verified issuer/subject, inspect policy, attest the exact CAS mutation and resolve the newly current binding. Use the same host-owned transaction, descriptor/schema digest/ordinary runtime-role validation and 5-second attestation expiry as B1. Repeat fresh provider session/user verification before commit and roll back on any error/change. Do not create a second JWT verifier or accept an unsigned SQL/GUC identity assertion. The final authenticator actor must match the renewed row/user/version and still be unexpired before commit.

Outcomes: current not-near-expiry is read-only; missing mapping denies rather than provisioning; revoked/account-disabled denies; policy-disabled/DB/provider/audit unavailable denies; version mismatch returns conflict with at most one wholly fresh verification retry. Responses contain only current internal User ID, binding version and expiry, never secrets or permissions.

### Exact proposed SQL delta for review, not an executable installation

No accepted migration is edited. A later separately reviewed additive migration must establish its own registered digest and installation descriptor compatibility, verify the exact existing B1/access digests and controlled NOLOGIN owner, and default every new capability off. No automatic downgrade of installation metadata is allowed.

```sql
ALTER TABLE profitia_profile.runtime_policies
  ADD COLUMN allow_binding_renewal boolean NOT NULL DEFAULT false,
  ADD COLUMN allow_expired_binding_recovery boolean NOT NULL DEFAULT false,
  ADD COLUMN expired_recovery_max_age_ms integer NOT NULL DEFAULT 0
    CHECK (expired_recovery_max_age_ms BETWEEN 0 AND 604800000),
  ADD CHECK (NOT allow_expired_binding_recovery OR
    (allow_binding_renewal AND expired_recovery_max_age_ms > 0));
```

The existing policy mutation triggers already advance the access authority revision. Retain ENABLE/FORCE RLS and owner-only policy access. Add these exact SECURITY DEFINER operations with fixed search path `pg_catalog,profitia_profile,profitia_access`; PUBLIC gets no EXECUTE. Only the explicitly reviewed ordinary runtime receives EXECUTE. Runtime still gets no direct table DML, policy/key SELECT, ownership, CREATE or BYPASSRLS.

1. `binding_renewal_metadata(p_issuer text,p_subject text,p_identity_until bigint,p_until bigint,p_signature text) RETURNS jsonb`: same shared authority row `FOR UPDATE`; enabled profile/receiver descriptor and exact policy issuer; nonempty bounded control-free subject; `p_identity_until>DB now`, `p_until<=p_identity_until`; require existing `valid_attestation('identity.binding.inspect',p_subject,p_issuer,p_until,p_identity_until,p_signature)`. Select only the exact existing issuer/subject; deny absent/revoked/nonactive account. Return its immutable user ID, binding ID, binding row version, account version, expiry, current authority revision and renewal flags; never the proof key. This is metadata for the verified callback, never browser authority. It is not the ordinary `identity_binding` lookup, which must continue denying expired rows.
2. `renew_binding(p_issuer text,p_subject text,p_expected_version text,p_mode text,p_expected_revision bigint,p_identity_until bigint,p_until bigint,p_signature text) RETURNS jsonb`: exact CAS mutation below. `p_expected_version` is the current `binding_id:row_version:account_version`, read inside this transaction. Every field is backend-derived. No input can replace a subject/user or omit expected state.

The proposed signed metadata reader is explicit below. It cannot repair a row and discloses no key. Its HMAC purpose is separate from mutation; the backend signs it only after fresh provider verification, inside the owned transaction.

```sql
CREATE FUNCTION profitia_profile.binding_renewal_metadata(
  p_issuer text,p_subject text,p_identity_until bigint,p_until bigint,p_signature text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb; p profitia_profile.runtime_policies%ROWTYPE;
  e profitia_access.external_identities%ROWTYPE; av bigint; rev bigint;
BEGIN
  SELECT revision INTO rev FROM profitia_access.installation WHERE singleton FOR UPDATE;
  d:=profitia_profile.runtime_descriptor();
  SELECT * INTO p FROM profitia_profile.runtime_policies WHERE login_role=session_user AND enabled;
  IF p_issuer IS DISTINCT FROM p.issuer OR p_subject IS NULL
    OR length(p_subject) NOT BETWEEN 1 AND 256 OR p_subject ~ '[[:cntrl:]]'
    OR p_identity_until IS NULL OR p_identity_until<=floor(extract(epoch FROM clock_timestamp())*1000)
    OR p_until IS NULL OR p_until>p_identity_until
    OR profitia_profile.valid_attestation('identity.binding.inspect',p_subject,
      p_issuer,p_until,p_identity_until,p_signature) IS NOT TRUE
  THEN RAISE EXCEPTION 'Verified identity required' USING ERRCODE='PT403'; END IF;
  SELECT * INTO e FROM profitia_access.external_identities WHERE issuer=p_issuer AND subject=p_subject;
  IF NOT FOUND OR e.status<>'ACTIVE' THEN
    RAISE EXCEPTION 'Binding unavailable' USING ERRCODE='PT403'; END IF;
  SELECT version INTO av FROM profitia_access.accounts WHERE user_id=e.user_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='PT403'; END IF;
  RETURN jsonb_build_object('userId',e.user_id,'version',e.binding_id::text||':'||e.version::text||':'||av::text,
    'expiresAt',e.expires_at,'revision',rev,'allowRenewal',p.allow_binding_renewal,
    'allowExpiredRecovery',p.allow_expired_binding_recovery,'maxRecoveryAgeMs',p.expired_recovery_max_age_ms);
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.binding_renewal_metadata(text,text,bigint,bigint,text) FROM PUBLIC;
```

The complete critical mutation body below relies only on existing B1 primitives and the proposed columns; grants, digest registration and the signed metadata reader above must be reviewed/tested together in the later migration. It is a source proposal, not evidence of installed or executable renewal.

```sql
CREATE FUNCTION profitia_profile.renew_binding(
  p_issuer text,p_subject text,p_expected_version text,p_mode text,
  p_expected_revision bigint,p_identity_until bigint,p_until bigint,p_signature text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb; p profitia_profile.runtime_policies%ROWTYPE;
  e profitia_access.external_identities%ROWTYPE; av bigint;
  rev bigint; ms bigint; deadline timestamptz; principal text;
BEGIN
  SELECT revision INTO rev FROM profitia_access.installation
    WHERE singleton FOR UPDATE;
  d:=profitia_profile.runtime_descriptor();
  SELECT * INTO p FROM profitia_profile.runtime_policies
    WHERE login_role=session_user AND enabled;
  ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  IF p.allow_binding_renewal IS DISTINCT FROM true
    OR p_issuer IS DISTINCT FROM p.issuer
    OR p_subject IS NULL OR length(p_subject) NOT BETWEEN 1 AND 256
    OR p_subject ~ '[[:cntrl:]]' OR p_mode IS NULL
    OR p_mode NOT IN ('RENEW','RECOVER_EXPIRED')
    OR p_identity_until IS NULL OR p_identity_until<=ms
    OR p_until IS NULL OR p_until>p_identity_until
  THEN RAISE EXCEPTION 'Renewal denied' USING ERRCODE='PT403'; END IF;
  IF p_expected_revision IS DISTINCT FROM rev THEN
    RAISE EXCEPTION 'Authority changed' USING ERRCODE='PT409'; END IF;
  SELECT * INTO e FROM profitia_access.external_identities
    WHERE issuer=p_issuer AND subject=p_subject;
  IF NOT FOUND OR e.status<>'ACTIVE' THEN
    RAISE EXCEPTION 'Binding unavailable' USING ERRCODE='PT403'; END IF;
  SELECT version INTO av FROM profitia_access.accounts
    WHERE user_id=e.user_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='PT403'; END IF;
  IF p_expected_version IS DISTINCT FROM
    e.binding_id::text||':'||e.version::text||':'||av::text
  THEN RAISE EXCEPTION 'Binding changed' USING ERRCODE='PT409'; END IF;
  principal:=encode(public.digest(convert_to(jsonb_build_array(
    'binding-renewal-v1',p_subject,p_expected_version,p_mode,p_expected_revision
  )::text,'UTF8'),'sha256'),'hex');
  IF profitia_profile.valid_attestation('identity.binding.renew',principal,
    p_issuer,p_until,p_identity_until,p_signature) IS NOT TRUE
  THEN RAISE EXCEPTION 'Proof unavailable' USING ERRCODE='PT403'; END IF;
  IF e.expires_at<=clock_timestamp() THEN
    IF p_mode<>'RECOVER_EXPIRED' OR NOT p.allow_expired_binding_recovery
      OR p.expired_recovery_max_age_ms<=0
      OR e.expires_at<clock_timestamp()-p.expired_recovery_max_age_ms*interval '1 millisecond'
    THEN RAISE EXCEPTION 'Recovery policy denied' USING ERRCODE='PT403'; END IF;
  ELSIF p_mode<>'RENEW' OR e.expires_at>clock_timestamp()+interval '30 seconds' THEN
    RAISE EXCEPTION 'Renewal not due' USING ERRCODE='PT403';
  END IF;
  deadline:=to_timestamp(least(p_identity_until,ms+p.max_binding_lifetime_ms)/1000.0);
  IF deadline<=clock_timestamp() OR deadline<=e.expires_at THEN
    RAISE EXCEPTION 'Fresh proof required' USING ERRCODE='PT403'; END IF;
  UPDATE profitia_access.external_identities SET expires_at=deadline
    WHERE binding_id=e.binding_id AND version=e.version AND status='ACTIVE'
    RETURNING version INTO e.version;
  IF NOT FOUND THEN RAISE EXCEPTION 'Binding changed' USING ERRCODE='PT409'; END IF;
  -- Existing trigger advances row version AND installation revision.
  PERFORM profitia_access.append_audit(jsonb_build_object(
    'applicationId',d->>'applicationId','environment',d->>'environment',
    'decisionId',gen_random_uuid()::text,'phase','DECISION','decision','ALLOW',
    'reasonCode','SUCCEEDED','operation','identity.binding.renew',
    'actorId',e.user_id::text,'actorKind','HUMAN','organisationId',NULL,
    'identityIssuer',p_issuer,'identityProofRef','binding-renewal-v1:'||p_mode,
    'accessVersion',e.binding_id::text||':'||e.version::text||':'||av::text,
    'accessSourceRef','previous-binding:'||p_expected_version,
    'policyVersion','access-v1:'||(SELECT revision FROM profitia_access.installation WHERE singleton)));
  RETURN profitia_access.identity_binding(p_issuer,p_subject);
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.renew_binding(
  text,text,text,text,bigint,bigint,bigint,text) FROM PUBLIC;
```

Attestation signing contract: the backend obtains `principal` from a parameterized database `SELECT encode(public.digest(convert_to(jsonb_build_array(...same five typed values...)::text,'UTF8'),'sha256'),'hex')` in the same transaction. It validates those values against its verified provider subject and metadata, then uses **existing `createProfileSql.attest`** with operation `identity.binding.renew`, principal above, exact issuer and observed minimum identity deadline. Do not imitate JSON serialization in a different language or sign arbitrary browser content. Existing HMAC also binds environment, application, runtime role, SQL transaction ID, purpose and both deadlines. A signature cannot be replayed across transactions; within one transaction the first CAS changes the expected version/revision. No new credential/session store or signing oracle is introduced.

This draft does not solve distributed atomicity with Clerk: provider revocation can race the final API read/DB commit. Keep renewed proof short, repeat current provider checks at protected admission, and preserve the explicit revocation SLA. Never promise instantaneous global revocation from a binding TTL. Owner must accept that boundary before activation.

### Security and concurrency matrix / later migration acceptance

| Case | Required outcome | Current evidence / remaining proof |
| --- | --- | --- |
| Current / near expiry | Current read-only; near expiry only explicit renewal policy + fresh token/session | Existing authenticator and new deadline regression; proposed renewal not run |
| Expired ACTIVE / return days later | Deny today; future recovery only explicit policy/window | Fixed-binding days-later regression; policy APPROVAL_REQUIRED |
| REVOKED, globally disabled, subject/issuer mismatch, impersonation | Always deny; no implicit repair | B1 integration and official-SDK negative tests |
| Provider/DB outage or incomplete challenge | Fail closed, no cached ALLOW | B1/B2 and new database-outage regression |
| Concurrent renew / replay | Authority fence + expected revision/version: one update; loser fresh read/at most one retry | Existing B1 transaction/version regression; new SQL-specific proof required before install |
| Revoke races renewal | DB fence orders revocation; after revoke commit renewal denies | Existing Access Store fence proof; new SQL-specific cases required |
| Provider session/device switch | New provider verification; old navigation proof unusable; no identity substitution | B2 version/switch/actual SDK tests; live device acceptance pending |
| Audit fails / provider fails before commit | Renewal/version/revision/audit all roll back | Existing B1 audit rollback; future renewal failure injection required |
| Concurrent session renews global binding | Version changes invalidate old flow, safe fresh navigation may recover | Existing version-bound state regression; do not return raw state across users |
| No organisation / no grants | Renewal must leave all membership/product/permission counts unchanged | Existing provisioning no-grant proof; mandatory future renewal SQL count assertions |

Future synthetic real-PostgreSQL renewal suite must install the additive proposal in a disposable loopback database, verify exact attestation encoding, expiry boundaries, both modes disabled-by-default, concurrent renew/revoke with real observed lock waits, no-row/mapping substitution, stale account version, cross-role/app/env/transaction replay, missing key, audit/provider rollback and unchanged organisation/grant counts. None of those unimplemented renewal tests is claimed executed here.

Rollback: before install, leave/reject PR; current runtime unchanged. Future owner GO must require fresh verified restore protection, inactive service/app/binding, reviewed additive migration/digest and recovery rehearsal. On regression disable renewal/recovery policy under the authority fence and runtime, revoke only new function EXECUTE, retain canonical audit and original IDs; never restore old versions or extend an expired mapping manually. Revert additive schema only after dependency checks and tested rollback; otherwise leave it inert. Never replay historical B1 migration or overwrite its digest. No Neon mutation is authorised by B2-E.

## Persistent Login design and evidence boundaries

Authenticated read-only Clerk Dashboard on 22 October: app `app_3KoJk9FmKeTC4hhlQwTgX6PMZmD`, Development instance `ins_3KoJk8us60Ywqei67JBwUx6R5pi`; maximum lifetime **7 days**, inactivity timeout **off**, multi-session handling **off**, reverification **10 minutes**. No setting/key/user/session changed.

Use official browser SDK restoration and token maintenance. Clerk controls session persistence; browser cookies/expiry can end it sooner. The [official session options](https://clerk.com/docs/guides/secure/session-options) define maximum lifetime/inactivity and browser limits. The [official JavaScript Session API](https://clerk.com/docs/js-frontend/reference/objects/session) provides current session status and token acquisition; use fresh token acquisition when needed, without persisting credentials in application storage. The backend remains pinned to the accepted SDK; selecting/pinning a compatible frontend SDK and validating its cookie/domain integration belong to the browser acceptance task, not an unreviewed dependency change here.

| Browser event | Proposed behaviour | Evidence status |
| --- | --- | --- |
| Reload / new tab / same device return | Wait for SDK load, restore valid Clerk session, independently revalidate B1, then current product authority | Design; live browser pending |
| Token refresh while session valid | SDK obtains short-lived proof; no password merely for JWT expiry; backend still verifies fresh session | Official SDK docs + synthetic SDK/expiry tests; live pending |
| Hours/days later | Clerk may persist; expired B1 still denies until explicit recovery approval/implementation | New fixed-binding regression; live pending |
| Maximum lifetime / cleared cookies / closed private session | Official login flow; never promise permanent login | Official policy/browser limitations; live pending |
| Device trust / pending challenge / reset / MFA task | Complete official SDK task; no B1 bootstrap or product access until authenticated | SDK task model; synthetic nonauthenticated tests; live pending |
| Logout / provider revoke | Revoke through official provider, confirm status, then show success; provider failure is explicit error | Synthetic real SDK transport and store replacement tests; live pending |
| Switch account | Clear user conversation/pending navigation/context, load selected current SDK session and binding | B2 cross-user/version proof; current multi-session off; live pending |
| Membership removed | Session may remain valid, show access loss on next operation; other organisation independently authorised | Actual Access Store PostgreSQL tests; browser pending |

`REMEMBER_ME_SUPPORT=PENDING` for a user-selectable duration policy. Dashboard lifetime is an instance-wide policy; no reviewed frontend SDK/version or per-sign-in persistence switch is installed. The public [SignIn API](https://clerk.com/docs/js-frontend/reference/objects/sign-in) describes session creation/task completion; this is not evidence that a checkbox controls per-session duration. Recommend **omit the checkbox** and use normal SDK persistence. Never label the absence of a documented option as universal unsupported functionality. Any future choice needs a supported API, explicit semantics for both checked/unchecked states, owner duration approval and real browser tests. No cosmetic checkbox or local token mechanism.

Passwords/OTP/keys/authentication tokens never become conversation bubbles, messages, analytics or persisted transcript. Show a generic submitted marker for sensitive answers and clear input memory. Persist no authority in an avatar choice or chat history. Existing conversation UI is out of this task's implementation scope.

## Restart resilience: recommendation A

Current `flow-store.ts` stores hashed random state in a bounded Map; state expires within 60 seconds and synchronous `take` is atomic **only in one process**. A real two-process regression demonstrates lost state, not shared-state support.

Recommend **Option A: one bounded fresh navigation attempt**, for initial PORR Development and a future separately authorised paid single steady-state instance. Unknown/expired state remains409; do not revive/replay it. Future frontend retains only closed target ID/route key/flow in memory, reloads official SDK identity, checks the user has not changed and issues a NEW flow once. It must consume at the exact receiving origin, independently authenticate arrival and request current business authority. On another409, provider outage, switch or invalid binding stop with a safe retry/sign-in instruction as appropriate. Never automatically retry logout, provisioning, grants, admin commands or product effects under this navigation rule. **The retry orchestration is design only**, not a newly installed frontend feature.

Provider-confirmed logout survives restart because fresh provider checks still deny it. Failed provider revocation returns503; local deny currently blocks that process only. A regression intentionally proves it disappears after store replacement while Clerk remains active. This is a documented limitation, not successful durable logout. On failure show “Wylogowanie nie zostało potwierdzone. Spróbuj ponownie.”, do not claim global logout, stop navigation and complete official provider sign-out/revocation only in an authorised later task. Durable local denial would itself need a reviewed shared state policy. Client-side success or process memory cannot replace provider authority.

Paid compute removes Free idle sleep, **not** crashes/restarts/deploy overlap. A new process cannot consume old process state. Multiple replicas, rolling overlap and strict cross-process exactly-once navigation remain unaccepted. A must not silently upgrade these claims.

Option B is deferred: a future existing private PostgreSQL schema could store `state_hash PK`, environment/application/receiver, user/proof binding, closed target and deadline. Issue must cap lifetime/capacity; atomic parameterized `DELETE ... WHERE state_hash=$1 AND environment=$2 AND application_id=$3 AND receiving_origin=$4 AND expires_at>clock_timestamp() RETURNING ...` has one transaction winner. Validate session/proof before consumption and again before returning a closed route; bind all stored authority fields, burn mismatched same-receiver states, deny foreign origins. Use isolated runtime-owned namespace, FORCE RLS and narrowly scoped SECURITY DEFINER API; no direct table access or credentials in clients; no authentication key/token in state rows. Bounded opportunistic expiry cleanup and explicit global/per-principal capacity, statement deadlines and connection budgets are required. Reuse only approved existing private infrastructure after owner authorization: no Redis/new DB/resource here. Measure additional round trips, connections and cleanup/storage cost before acceptance. A SQL sketch is not accepted replica safety; require two real processes, at least16 simultaneous consumes, crash/commit ambiguity, expiry and cross-tenant isolation tests. `SHARED_STATE_REQUIRED=DEFERRED`.

## Transactional Authorization reuse and administration boundary

Reused accepted source: `private-operation-host.mjs`, `access-store.mjs`, `operation-context.mjs`, access SQL001. `lock_access` holds the installation row FOR SHARE through business transaction completion. Mutations of accounts/identities/orgs/memberships/products/permissions/runtime bindings take the conflicting revision update via existing triggers, including INSERT/DELETE/TRUNCATE. SQL GUC scope is transaction-local and checked against `txid_current`, binding/account versions, current revision and <=30-second deadline. Host verifies scope, operation permission/product evidence and OUTCOME inside the same transaction; INTENT/FAILURE are independently durable. No ALLOW survives an earlier transaction.

New actual PostgreSQL regressions use the existing ordinary-role fixture and `createPrivateOperationHost.execute`: baseline allowed operation, committed membership suspension/permission removal/product revocation, next callback denied, other organisation still allowed and account/binding ACTIVE. Rollback preserves effective rights/revision; re-added permission is visible on the next authoritative operation. The concurrency test observes `pg_blocking_pids` while an actual product effect and OUTCOME hold the fence; product commit finishes, waiting administration commits, then next operation denies. Existing suite also covers admin-first committed changes, expired leases, stale contexts, revocation/reenablement versions, RLS, missing audit and rolled-back effects. Synthetic identities do not prove live Clerk UI acceptance.

Future admin UI/API is not implemented: exact admin operation names, delegation grants and least-privilege mutation/audit API still need review. The tests' controlled fixture owner performs administrative DML solely to exercise the existing fence; this is **not** a proposed product owner-role connection. Future backend must authenticate the administrator, lock/verify current own-organisation delegated authority, validate expected versions, update canonical rows and record actor/provenance/outcome in a single short real transaction. Beware FOR SHARE -> UPDATE upgrades: order a reviewed exclusive authority fence before admin reads/validation to avoid parallel admin lock-upgrade deadlocks; bounded timeout/retry may not replay committed changes. No customer admin cross-organisation or PII wildcard authority; no event-driven eventual grant path.

## Exact owner decisions and controlled activation plan

1. Accept the exact updated PR600 source and separately decide merge. Owner Event-Driven Administration + Transactional Authorization requirement is already accepted; do not request it again.
2. Approve bounded ACTIVE renewal and separately approve/deny **expired ACTIVE recovery**, proposed <=7-day age, unchanged <=300000 ms maximum, <=30000 ms near-expiry threshold, fresh provider proof, CAS and audit; never revive REVOKED/DISABLED. Approve its additive SQL/API implementation/review scope and external revocation race/SLA before installation. No policy activation is included in this PR.
3. Confirm intended Clerk 7-day/inactivity policy and supported browser SDK/version/domain/redirect/session-task integration for live tests. Recommend omit Remember me; any per-user duration choice needs verified provider capability and explicit policy.
4. Accept A's one-attempt navigation retry and single-process limitations; separately decide whether strict cross-process navigation or durable failed-logout denial makes B necessary. No paid plan upgrade/multiple replicas/shared-store activation is authorised.
5. Authorise a later bounded Development activation packet: exact source/artifact/config, restore snapshot with verified recovery and immutable backup lifetime, existing app/binding policy/attestation credentials via secret store, explicit synthetic accounts/orgs/grants, duration/cost/cleanup budget and tested LKG disable/rollback. No secrets in PMOS/PHR/chat. Live Clerk/browser and product authorization tests must finish before real-user onboarding or SG2/SRM adoption.

Before that later activation: full profile preflight/BEGIN; approve/install/test the new migration on disposable fixtures then owner-approved Neon with recovery protection; confirm B1 app/binding are still disabled and accepted digest unchanged; repeat provider configuration readbacks. After explicit operational GO only, run same-device/reload/new-tab/token-refresh/session-expiry/challenge/revoke/switch/return-days-later/expired-B1/race/outage acceptance with synthetic scope, then disable and clean up per packet, independently verify and close Architecture PMOS/PHR. No real user, deployment, schema, policy, credentials or Render/Clerk configuration is changed by this preparation task.
