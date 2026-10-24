# Communication language PL/EN — Development

Owner ARCHITECTURE; shared Identity and ACCOUNT_PRIVATE profile. No country field,
organisation assignment, new product role, Staging or Production adoption.

## Stored preference

SQL004 is additive after accepted profile SQL001 and email SQL003. Apply once in
a transaction as constrained `profitia_access_owner`; separately record the exact
SQL004 digest. Existing accounts (also those lacking a profile) receive pl/migration.
New accounts start en/default. The authenticated Identity account page initializes
once from the primary browser/system language: pl or pl-* → pl, otherwise en.
Stored migration/browser/user preferences win on later devices. Explicit future
user choice uses the same account-self/versioned API; no settings UI in this stage.
No profile selection by email, client user ID or organisation ID.

## Mail delivery

Clerk remains token issuer/verifier. Mailgun receives only canonical content and
the real code/link. A separate disabled-by-default SQL grant
`allow_language_projection` permits bounded pl/en projection from the exact signed
subject. Snapshot at enqueue; current account/grant and provider mailbox ownership
rechecked before send. Changing profile preference cannot change queued language.
Unknown/revoked/unmapped context has public EN fallback and neutral avatar.
The first signup OTP and pre-account invitation currently lack safe profile
correlation, so matching their browser choice is NOT claimed.

Canonical language catalog, HTML, text and CID assets are source controlled.
Mailgun template versions are pinned to content hashes; runtime does not select
an editable latest version. Template variables use `t:variables`, not event-visible
`v:` variables. Codes, links, recipients and bodies stay out of evidence/logs.

## Install, verify, recover

1. Record fresh main, exact target paths/owner/code state and full preflight; begin
   the Architecture task in architecture_pmos. Preserve unrelated work.
2. Test profile migration, tenant/account isolation, revoke and concurrency on
   isolated PostgreSQL. Test every language/avatar/message variant and injection.
3. Snapshot current Development branch; rehearsal on a separate branch. If using
   Neon restore_snapshot, explicitly set finalize:false. Never rely on its default.
   Compare original account/profile non-language data, bindings and memberships.
4. Measure current retained Render artifact, source SHA, configuration digest and
   migration state. Preserve previous config securely. Verify retained-deploy
   rollback before modifying runtime. Disable only the new language projection if
   needed; never drop profile/outbox/deduplication data to roll back code.
5. Install SQL004/grant exact descriptor access, enable bounded language projection
   only after validated rehearsal. Publish and read back all pinned Mailgun
   templates; deploy exact accepted SHA to Identity Development only.
6. Wait for old worker exit before acceptance. Verify readyz, actual Clerk events,
   Mailgun acceptance/delivery and UI verification, profile persistence and stored
   language on another login. SMTP250 does not itself prove inbox rendering.
7. PMOS closeout + PHR with actual evidence and residual limitations.

The Identity signal handler stops queue intake/polling before waiting for HTTP
drain. Unstarted claims are released, one durable provider attempt is completed,
and an in-progress webhook verification returns503 for retry after shutdown.
When introducing a new rendering contract, still verify old-instance exit before
acceptance: a running historical version may not contain this shutdown behavior.

Code rollback restores retained deployment/configuration. Additive language data
and updated functions remain compatible with previous avatar/queue operations;
turning language projection off returns EN fallback. Restore a database snapshot
only through a separately verified data-preserving recovery procedure; never
silently overwrite registrations created after the snapshot.
