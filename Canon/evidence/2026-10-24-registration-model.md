# Resumable registration model — Development evidence

Task ARCHITECTURE-REGISTRATION-MODEL-20261024; owner ARCHITECTURE; authority profitia/SG-dev main. PMOS registration cmvm8mn0c000013ygx7u9cucf. Both user PMOS/E1 and Full Autopilot wrappers refreshed before work. Scope: backend reserved registration, first-OTP avatar/language, resumable Unfinished, atomic Finished and organisation affiliation status. No Staging/Production or product membership grants.

## Provider contract proof (live Development)

On24 October2026 a task-created isolated test reservation used explicit reserved identification. Clerk readback showed reserved=true, no verification and no sessions. Preparing an OTP produced a signed email.created containing the exact user_id, email_address_id and server-written opaque attempt marker. Wrong code retained unverified state. The real provider-issued code verified the address. A60-second sign-in ticket consumed through official Frontend API ticket strategy created an active session for exactly that user (10:20:06Z). No internal account or product grants were created by this proof. Preparing another verification after prior verification also succeeded, proving resumability. Official provider API/schema consulted; no test bypass credential or automatic email verification.

## Source and isolated verification

SQL005 and IDENTITY-REGISTRATION-1 are additive. Forced RLS, no raw runtime grants, transaction HMAC and explicit policy. Local PostgreSQL checks cover pending versus active account separation, concurrent starts, wrong/cross-attempt proof, immutable four-variant email snapshots, delayed events, transactional rollback, existing profile preservation and organisation affiliation. The reservation is always locked before an attempt; remote verification and ticket preparation hold a bounded lease against concurrent resend.

Local Identity suite: 299 passed, zero failed/skipped; lint, typecheck and build passed. Platform contracts: 1072 passed, zero failed, two pre-existing Source tests skipped (not registration coverage). Final SQL concurrency suite after lease hardening: 8 passed, zero failed/skipped. Exact schema CI: controlled SG2 run40087469379 and required integration run40087420148 passed. Exact runtime candidate d77260171400f203b8a58aaffcd282d88a72f4b3 passed Identity40087995350 and governance40087995300. Schema PR683 and runtime PR682 merged normally without bypass.

Fresh Neon snapshot snap-plain-hall-b9b8ge28 (10:36:31Z) was restored with finalize:false into br-plain-salad-b9jbepn7. SQL005 digest 78af6bfebf483db2d49df5a11caf7fecfc608ac5768725f20adacdc1079cedd1 installed successfully there. All 14 accounts, 14 identity bindings, 14 profile preferences and 3 memberships were preserved. The three affiliation backfills normally incremented profile version/updated_at; whole-row byte equality is not claimed. Backfill: Finished for all 14; Assigned for 3, Unassigned for 11. Ordinary runtime raw table reads denied. Retained seven-field mail queue protocol still projected male/pl with registration disabled; synthetic probe rolled back.

LKG measured in the actual running Identity container at 10:42:06Z: retained deployment dep-dbe7303ncjis73d82qj0, commit 9841f3d6166b56811b02dca8874f1a968dfdb641. SHA256 of sorted path/content hashes for runtime dist, runtime dependencies and platform-contracts (2849 regular files): 154467adfc844c9664f1b9f6ab900b18eaf2ff24b4295d8d330c2b398a13ac60. Runtime configuration digest: 915525880f1275390a006a3984091d354ed55a29e2c9da23a5c0c0883e3578b8. Exact configuration retained privately; no secrets in source. Rollback retains SQL005/data and restores the prior artifact/configuration; no automatic whole-database restoration.

## Release status

Live SQL005 installed transactionally at10:59:13Z on Development br-sparkling-term-b99l107x / platform_private, initially disabled. Counts remained14 accounts,14 identity bindings,14 profiles,3 memberships. Raw runtime table reads denied; legacy queue compatibility passed. Policy and exact runtime enabled only after final source CI.

Identity-only deployment dep-dbe8vjtg1s2s73eq7n7g is live at commit136cf51218fc749832ad85d5458b0f491eb90bf1. Health and readiness returned200. Actual running container measurement at11:04:08Z:2856 files, artifact SHA256014c66d0d39cf06fe917a5e8ec9bc3136979c6c671b64403d78d55a688a6b680; runtime configuration SHA256dc77d5dfa58c45aca0f5a40bcbde99a63108b704d82178c7247f8c94d29a774c.

## Live acceptance

- One reserved Clerk identity and one Unfinished registration were reused across attempts; no internal account or E1 binding existed before completion. No duplicate user was created.
- Signed events and durable outbox selected all four first-registration variants. Mailgun confirmed SMTP250 with exact pinned templates: pl/male v-dc872c44f0ce2d539f65ad69, pl/female v-1ea6a65396dae8946fafcdf3, en/male v-22dcaa140441ebfeeb3a0733, en/female v-f40b100a1cf62f511cf94ddd. Accepted outbox payloads were erased.
- Real wrong code returned400 INVALID_CODE; foreign receipt failed closed503; foreign origin returned403. Local repeat cooldown returned429. Clerk separately rate-limited repeated code generation; one attempt stayed preparing. After waiting, the ordinary browser flow resumed the same reservation successfully. No limit or authentication bypass was used.
- Real browser choice of female avatar and primary browser language en produced the English female email. Real Clerk code, short ticket and official browser session completed the account. The UI displayed Konto gotowe with the female assistant.
- Database readback: Finished / Unassigned, female / en / browser, completed attempt finished and encrypted draft erased. New user has zero organisation memberships. Final counts15 accounts,15 identities,15 profiles and the same3 memberships;3 Assigned and12 Unassigned, allFinished.
- Existing-account login via real OTP also reached Konto gotowe. Existing account data, preferences and memberships remained identical. Existing identity columns matched except expected expiry/version renewal for the two authorised browser test sessions; no identity, tenant or grant reassignment.
- Clerk verification_code and invitation delivery remain disabled on the Clerk side; Mailgun handles delivery. No template, DNS, Staging, Production, SG2/SRM/KRS service or product entitlement change in this release.

SMTP250 proves recipient-server acceptance, not inbox placement or rendered graphics. Mailgun stored-message retrieval returned404, so no new mailbox visual acceptance is claimed. Unknown/unbound invitation still uses the pre-existing neutral fallback and is not treated as a personalised registration. PMOS/PHR publication follows this source evidence closeout.
