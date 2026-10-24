# Identity Development — resumable registration v1

Owner ARCHITECTURE. SQL005 + IDENTITY-REGISTRATION-1. Only the shared Identity Development service. No Staging, Production, KRS/SRM deployment, product grants or organisation onboarding.

## Preconditions

Fresh origin/main, exact isolated branch and declared paths, canonical routing/code-state and full preflight; PMOS begin in architecture_pmos. Source CI must pass. Verify exact live Clerk instance, provider policy, retained Render deployment/commit/artifact digest/configuration, migrations and reversible Neon recovery. Capture a fresh snapshot and rehearse restore into a separate branch with `finalize:false`; never move the Development endpoint. Do not deploy without measured LKG and tested rollback.

## Installation and release

1. Test additive SQL005 as existing controlled NOLOGIN owner on restored isolated branch. Verify constraints, RLS, raw-grant denial, statuses/backfill, profile/identity/outbox compatibility and failed completion rollback. Pin exact migration digest in registration_installation.
2. Live migration in one controlled transaction after snapshot; no destructive rewrites of SQL001–004. Existing profile values and membership rows must match the before snapshot except new status fields. Insert disabled registration policy. Grant only registration_descriptor and registration_command to the ordinary bound runtime role. No direct table grants.
3. After compatibility validation, enable the matching SQL policy and deploy verified exact source to Identity Development using IDENTITY_REGISTRATION_ENABLED=true plus exact IDENTITY_REGISTRATION_SCHEMA_DIGEST. Keep all prior flags and settings. The retained old runtime ignores these new flags until the controlled deployment completes. Existing email proof/encryption keys are reused with separate cryptographic domain; keys never enter source or diagnostics. The old email outbox API remains accepted.
4. Verify readiness, actual backend registration/OTP/ticket/official session/profile through both language and avatar combinations; wrong code, resume, duplicate, foreign token, legacy login and no organisation membership. Confirm provider delivery versus mailbox acceptance separately. No Clerk bypass token and no created-session API.
5. Publish exact runtime evidence and PMOS/PHR closeout. Remove only this task's disposable fixtures and secret evidence files according to controlled retention.

## Rollback

Stop new registration intake by the registration flag and policy. Preserve existing outbox work and deduplication; current queued registration messages may be rejected under disabled policy, so users request a fresh code after restoration. Roll back to measured retained Render artifact with saved configuration. SQL005 is additive and may stay installed: old provisioning/profile/email signatures remain compatible. Do not automatically restore the whole database or delete newly created accounts/Clerk identities. Such restoration could discard registrations or mail deduplication and requires a separate data reconciliation decision. Verify old readiness, login, profile and email paths after rollback. Preserve pending reservation-to-provider mappings so unfinished addresses remain recoverable on re-enable.

## Reconciliation and limits

Start failures/ambiguous provider creation are reconciled only by the server-generated registration external_id. Another existing user for that email directs to login; it is never adopted. A failed response after OTP verification or ticket issuance requires a fresh attempt/code. The new attempt reuses the reservation; old mail still references its immutable snapshot. Backend error responses never disclose prior names or preferences. Completed-account retries preserve later profile changes.

Initial policy:30 starts/hour globally,5 starts/hour/address,30-second cooldown,5 code attempts,15-minute attempt. The1000-pending capacity fails closed. Encrypted abandoned drafts expire after30 days and are scrubbed at the next start; minimal HMAC/provider mappings remain until controlled reconciliation. Do not delete a provider user solely because it is old or Unfinished. Review actual sessions, identities, bindings and account state before any future cleanup. Membership status is informational affiliation, never access authority.
