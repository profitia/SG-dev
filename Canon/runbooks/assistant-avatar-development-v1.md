# Assistant avatar preference — Development

Producer task: `ARCHITECTURE-ASSISTANT-AVATAR-20261023`, profile ARCHITECTURE,
workspace SG-dev Architecture; actual execution: isolated local worktree.
Consumer SG2 has a separate task, workspace, PMOS and acceptance.

## Data and ownership

Reuse `platform_private.profitia_profile.user_profiles.avatar_sex`: `male`,
`female`, or NULL. It describes the assistant appearance, not the user's sex.
This is ACCOUNT_PRIVATE, owned and authored by the verified internal User ID,
with organisationId=null. Provider subject, email, organisation, project and
task IDs never select another owner. No organisation, membership or grant is
created. No migration or backfill is needed. Existing RLS, ordinary role,
signed transaction scope, fresh provider checks and atomic audit are retained.

## Registration and restoration

1. The pre-auth choice lives in the conversation and is carried in Clerk signup
   `unsafeMetadata.assistantAvatar` as an untrusted presentation hint only.
2. Clerk completes its normal verification/challenge. No preference proves
   identity, verification or entitlement.
3. The central account surface confirms/provisions the account, then reads the
   canonical avatar through the shared E1 profile backend.
4. If the profile has no preference, the verified account may initialize its
   choice. An expected profile version prevents concurrent overwrites. A
   conflict causes a fresh read, never a blind retry. Missing legacy profiles
   can be initialized through the existing canonical ensure operation.
5. A stored preference wins over metadata and login form defaults. A legacy
   NULL remains NULL unless a valid choice exists. Login does not invent a
   preference. Account changes abort pending requests and discard late results.

The additive endpoint `/v1/account/assistant-avatar` provides GET and same-origin
POST. POST body is exactly `{avatarSex, expectedVersion}`; null expectedVersion
initializes a missing preference without overwriting an existing choice. Other
updates require a positive decimal version. Responses contain only internal
`userId`, `avatarSex` and `version` (or null for a missing profile). There are no
phone/job fields, cookies, permissive CORS, cache, caller owner IDs or tenant
selectors. Configured peers may perform bearer-only GET on this exact path;
they cannot mutate. The original `/v1/account` response contract is unchanged.

## Email consumption boundary

The central database is authoritative. An authenticated account flow or a future
approved email composer must use this preference, with a neutral fallback for
NULL. Metadata must never override a saved value. Invitation recipients may not
yet have a profile. The first signup OTP precedes verified account creation;
it cannot read a profile that does not exist. Clerk signup unsafe metadata is
not asserted to be a supported email-template variable. This change neither
disables Clerk delivery nor installs an external mail sender. Template routing,
its supported variables and first-OTP behavior require real provider acceptance
before claiming avatar-specific email delivery.

## Validation and release

Required tests: both choices, verified/unverified/revoked identity, cross-user
isolation, exact peer origin/path/method, closed payload and projection, RLS,
optimistic conflict, legacy profile, retry, reload and account switching. Run
the identity build/tests and real isolated PostgreSQL profile suite plus shared
producer and both existing consumer contract regressions.

Development release requires exact accepted source, passing CI, retained
previous artifact ID and measured digest, configuration fingerprint, current
schema receipts, and reversible data recovery evidence. Source preparation and
passing local tests are not live acceptance. Roll back the retained deployment
and compatible configuration without deleting user preferences or audit. No
Staging, Production, KRS pilot or shared SRM/Maps deployment is included.

CI target expansion: `.github/workflows/identity-runtime-ci.yml` is an additional
Architecture-owned ALIGNED path, separately preflighted under the same task
before editing, to install existing public dependencies for the real HTTP/SQL
acceptance test. It adds no live credentials or cloud database access.

## Release hold — 2026-10-23

The owner authorized up to USD1 solely for a temporary paid-plan configuration
and a read-only retained-artifact measurement, explicitly without deployment in
that step. Render's Update Service API rejected Free-to-Starter with HTTP400:
`cannot change between free and paid plans`. The subsequent Free restoration
and independent service/deployment reads confirmed the original Free setting,
auto-deploy off and live deployment `dep-dbd7dp2fngtc73fsf0t0`, source
`68f4784d32ab77f77fd9b90d4bbd410171159aea`. No measurement job or deployment was
created by this attempt. No product data, credentials or grants were changed.

The retained deployment ID is known, but its artifact digest remains unmeasured.
This is an unresolved release gate, not a source/test failure and not a reason
to substitute a rebuild or source SHA for the artifact digest. Identity and SG2
deployment, live registration/login acceptance and product rollback rehearsal
remain pending until an authorized, verifiable recovery path is available.
Clerk email-template selection remains outside this persistence implementation.

Source acceptance is ordered: shared profile contract PR661, Identity wiring
PR657, then SG2 consumer PR659. The initial shared CI detected an unrelated KRS
runtime/consumer version mismatch; main PR660 supplies the accepted SRM fix.
The isolated branches incorporate it without editing or deploying KRS/SRM.
