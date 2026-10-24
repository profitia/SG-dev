# PORR account V2 — SRM Development

Tasks: SRM-PORR-ACCOUNT-20261024 and SRM-PORR-ACCOUNT-COMPAT-20261024. Consumer: SRM Runtime. Producer: Architecture Identity, PR #695 (candidate 6e173035ac1780b82d128c306be98542e1c0aa0b, merge 503782cc812b08a60d3ed75c1d0cd67a0f74de6a).

## Candidate

The exact MagicPath project 460980331948945408, component 464295211783319552, revision 464297738012618752 is implemented as a compact conversational registration/login screen. It keeps both brand assets, the feature column, stepper, internal chat scroll, light/dark and responsive layout. Mock registration is replaced by the shared real Clerk conversation engine and the explicit embedded Identity adapter.

Registration sends the independently selected assistant avatar and primary browser language before the first OTP. Verification uses the opaque registration receipt; a real Clerk session then completes ACCOUNT_SELF and reads persisted preferences. Existing Finished email routes to login, resumable Unfinished attempts use the producer's mailbox-proof policy. Login supports email code and password, with the official Clerk form for recovery/additional challenges. Tokens and OTPs are not stored in browser storage or transcript. New users do not gain organisation membership or product access.

The consumer is default-off and constrained to Development and the exact Identity origin. Existing private SRM APIs retain their authority checks. No SQL/schema/data migration or grant change is included. Acceptance receipts are append-only and preserve earlier producers and their fingerprints. Only SRM Development and shared Identity Development may be deployed; KRS pilot, Maps, SG2, Staging and Production are not deployment targets.

## Local validation

- SRM server suite: 714 tests, 706 pass, 0 fail, 8 pre-existing PostgreSQL fixtures skipped without their dedicated URLs.
- Promotion/lifecycle suite: 311 tests, 308 pass, 0 fail, 3 live integration fixtures skipped without dedicated infrastructure.
- Typecheck and Next production/standalone build passed.
- Browser fixture passed registration, code rejection, login, masked code, opaque receipt, persisted avatar, independent language/avatar, mobile and dark mode. This is an isolated synthetic provider/backend fixture using the real React view and conversation engine, not proof of live Clerk/Mailgun delivery.
- Producer exact-head CI passed security, navigation, isolated PostgreSQL and governance before PR #695 merge.

## Last Known Good

Actual running container measurements and configuration backups were captured before any deployment:

- SRM: dep-dbdnbqsipgvc73dl5o8g, SHA fc1e8916f5f7b18a35e96e83165c7b65805a0553, artifact SHA256 32e977f7d5b466dede8f2945c92efc363e53eafa07b8779fc6c9feee9e0babad, configuration digest 78857111e7798c6cf820abc8aacbd8fae78324dedb4d3d46f090c048647a7ace.
- Identity: dep-dbegec1srm7s73c2p0c0, SHA 13da7561edb5d9bbe42788870a63f9c22060a4d7, artifact SHA256 ccf15504ac98cfc9c36ffed5234a5c0c8b756ea6a8598664b70a79e6620698a3, configuration digest 0e75bfd3b43f65db7d62da8d6d29c5e144dd411c58ce58b38d3780bdbb653a5a.
- Both services have auto deploy disabled. Read-only Neon verification confirmed original Development branch and current profile/registration/language/vocative descriptors; 15 accounts/identities/profiles and 3 memberships. No migration is planned.

Rollback restores retained artifacts and saved configuration, consumer first, then producer if required. Preserve current account data and additive schemas; never automatically restore a database snapshot or remove newly registered users. Live release, user-flow acceptance and PMOS/PHR results must be recorded separately after execution.
