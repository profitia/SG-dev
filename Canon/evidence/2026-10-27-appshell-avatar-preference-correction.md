# AppShell — owner-approved avatar preference correction

Status: factual Development maintenance evidence; no new canon or runtime capability.
Task: ARCHITECTURE-APPSHELL-AVATAR-PREFERENCE-CORRECTION-20261027.
Host: 01a17d49-61a6-7821-ba8e-18b45d3c4048.

The user reported a missing AppShell avatar, identified the account as `tomasz@profitia.pl`, explicitly selected **“Zapisz awatar męski”**, and reinforced **“Zapisz trwale w moim profilu.”** This authorizes only the missing preference on that one account. Separate explicit consents covered a one-time, in-memory use of the existing local Render credential to retrieve only CLERK_SECRET_KEY from Identity Development, then resolve that exact verified email through Clerk. No credential was printed, persisted, changed or reused for another purpose.

A prior aggregate query by first name was rejected by automatic review and was not executed. The approved exact-account lookup resolved the existing Clerk binding, then the existing internal User ID `092c2d9f-a84b-4c18-b3d6-e172a61399b8`. Read-only diagnosis found `avatar_sex = NULL`, profile version `4`, registration status `Finished`, first-name source `clerk-backfill`, and no registered avatar hint in Clerk. No gender was inferred from the name or vocative dictionary.

## Execution and preservation

Authority: profitia/SG-dev/main. Existing private Neon project `spring-bread-28217539`, Development branch `br-sparkling-term-b99l107x`, database `platform_private`, owned relation `profitia_profile.user_profiles`. No schema, permission, configuration, organisation, membership or product grant changed. There was no Identity deployment.

ARCHITECTURE preflight, PMOS begin and full require-begin passed before mutation. Registration: `cmvr2byag0000fgznb9ukozne`; derived conversation `pmos-task-v2:67db00b6767507966709e1f396fa2ead017db3fc724ed8825f70377c9c49f92b`.

This was an explicit controlled-owner maintenance correction, not a forged HUMAN session or an AppShell runtime write. The transaction used SET LOCAL ROLE profitia_access_owner and guarded the exact physical Development installation, database, active account and exact active Clerk issuer/subject binding. It required this profile still to have version 4 and NULL preference. A row-locking, one-row update changed only avatar_sex to male. The existing server_fields trigger advanced version to 5 and updated_at; created_at and the owner remained fixed.

First, a SAVEPOINT rehearsal produced male/version5 and equal hashes over every other profile field, then ROLLBACK TO SAVEPOINT restored NULL/version4. The actual transaction repeated the same guards and update. It returned one row: male/version5, other_profile_fields_unchanged=true. An independent post-commit read confirmed male/version5. The authorization and before/rehearsal/after results are retained by this task's PMOS/PHR closeout. No raw profile PII beyond the selected preference and its version was published as execution output.

## Consumer

AppShell already reads the canonical own preference through the accepted Identity GET. A separate SG2 change, PR #753, restores collapse/expand and controlled detach/reattach presentation behavior, with a neutral canonical brand mark for accounts that have no saved choice. This maintenance does not activate conversation, history, CIC, business modules, a local sex selector, new authentication or a peer write contract.

The SG2 browser acceptance and exact runtime deployment evidence belong to SG2-APPSHELL-PORR-FIRST-DEVELOPMENT-20261027. This document does not assert future PMOS publication success or an unobserved browser result.
