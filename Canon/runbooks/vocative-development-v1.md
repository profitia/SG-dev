# Persisted vocative salutations — Identity Development

Status: SOURCE_CANDIDATE_NOT_DEPLOYED. Task ARCHITECTURE-VOCATIVE-20261024; transport dependency ARCHITECTURE-VOCATIVE-TRANSPORT-20261024. Owner Architecture Platform. No SG2/SRM/KRS deployment, Staging or Production.

## Business contract

Primary browser locale initializes the existing persisted PL/EN preference. A name matching a reviewed Polish entry receives its vocative only when communication_language=pl. EN uses the original first name. Unknown/ambiguous/unreviewed names fall back to the original, with name_gender=Unknown. Empty names produce Cześć!/Hello! without a dangling comma. Explicit user language preference wins over browser initialization. No country inference.

name_gender is dictionary-derived lexical metadata, not verified personal gender. avatar_sex remains the user's independent assistant choice. Marek + female assistant + PL => Cześć, Marku! with the female image. The same name in EN => Hello, Marek!.

## Dictionary quality and persistence

User source: vocative_names.csv, SHA256 fdea48c80c48b401b6d9613636c877d1ae46081699530017fa3ed586c7f38620. Preserve 24,708 nonempty source rows, including duplicates/conflicts, as inactive review evidence in vocative_source. Source contains systematic malformed forms (e.g. John/Joho) and 34 conflicting normalized names. Importing all as approved would produce incorrect greetings.

The private vocative-dictionary.mjs module byte-preserves the CSV and embeds a readable reviewed JSON list that explicitly enumerates 259 common Polish names/form/gender triples reviewed for this release; corrections of source conflicts are explicit here. This is a conservative reviewed subset, not a linguistic certification of the entire CSV. All remaining source rows are quarantined by absence from the active dictionary. No suffix algorithm, accent removal, punctuation stripping or compound-name splitting. NFC, whitespace and case normalization only. The list, source hash, review hash and version are pinned. Future additions require a reviewed source change, tests and controlled migration; existing names do not change at mail-send time.

SQL006 stores first_name, first_name_source, name_vocative, name_gender, name_resolution and name_dictionary_version in the private user profile. The registration attempt stores its own immutable name resolution before Clerk prepares the first OTP. Completion copies the winning verified attempt into the Finished profile. Later sign-ins use the persisted profile. Profile language changes recompute eligibility, preventing stale vocative in English. Current UI and E1 membership behaviour are unchanged.

## Security and retention

Separate allow_salutation_projection policy defaults false. Installation is controlled-owner-only on Development with pinned SQL005. FORCE RLS on dictionary and source; runtime has descriptor and signed command execution, no direct dictionary/attempt/outbox reads. firstName is covered by the transaction HMAC. Legacy SQL005 functions become private implementation details. Audit remains mandatory and excludes names, codes and message bodies.

enqueue freezes name/vocative alongside existing language/avatar snapshots. Deduplicated events cannot replace snapshots. begin rechecks current service policy and account; the runtime additionally checks live Clerk mailbox ownership. Unbound invitations stay neutral EN with a generic greeting. Names in terminal queue rows are erased with the encrypted message. Minimal pending name metadata has the same 30-day cleanup boundary as abandoned drafts; full drafts remain AES-GCM encrypted. User profile names persist.

## Release and backfill

1. Fail-closed governance, canonical PMOS begin, exact paths and clean isolated branch. Schema-only producer PR/controlled CI separately from Identity runtime PR.
2. Capture retained live Identity deployment SHA, actual artifact digest, configuration digest and migration hashes. Save configuration privately. Snapshot the exact Identity Development Neon branch; restore into a separate rehearsal branch without moving production computes.
3. Install SQL006 + installVocativeDictionary(query) in one owner transaction; insert manifest hashes only after all rows load. Grant runtime only vocative_descriptor and the two existing wrapper command signatures. Initially leave salutation policy disabled. Verify original accounts, bindings, preferences, memberships and statuses unchanged.
4. Rehearse retained SQL005 command compatibility, rejected raw/forged access and rollback. Existing-user backfill reads first_name only through exact active Clerk issuer/subject mappings; skip missing names, do not parse display_name/email. Set first_name_source=clerk-backfill only where first_name is NULL. No overwrite of registrations or preferences. Keep before-images privately.
5. Publish and read back 12 immutable Mailgun versions (2 message kinds x 2 languages x 3 avatar variants), preserving old versions. greeting is a bounded template-only variable, not an event/user metadata field. HTML escapes values; plain text remains readable; images use existing CID attachments.
6. Enable salutation projection only after rehearsal/CI; deploy only the approved Identity Development SHA. Verify health, provider version, first and later mails, DB persistence and no new runtime errors.
7. PMOS/PHR closeout with exact evidence and residual dictionary coverage limitation.

## Rollback

Use retained Render artifact and its saved environment; leave autodeploy disabled. Retain all old Mailgun versions so the old runtime pins its prior templates. SQL006 accepts original seven-field registration starts and existing email commands. It adds no destructive data change. Disable allow_salutation_projection if required, while preserving ordinary registration/email policies. Do not automatically reverse migrations, delete new accounts, or overwrite live DB with the snapshot. Snapshot recovery is a separately controlled contingency; rehearse it into a new branch. Backfill before-images permit narrowly restoring only this task's name fields, without replacing preferences or memberships.

## Acceptance matrix

PL/EN x male/female/neutral; Marek/Marku, Anna/Anno, Unicode/case, unknown and malformed source candidates; HTML injection and missing names; first OTP before internal account exists; Finished persistence; restart; EN language change; immutable queued/delayed events; duplicate and wrong-subject protection; revoked policies/accounts; invalid HMAC/unknown keys; no raw table/function access; terminal PII cleanup; legacy protocol compatibility; existing registration and email regressions. Provider acceptance and mailbox delivery must be reported separately.
