# Resumable registration model — Development evidence

Task ARCHITECTURE-REGISTRATION-MODEL-20261024; owner ARCHITECTURE; authority profitia/SG-dev main. PMOS registration cmvm8mn0c000013ygx7u9cucf. Both user PMOS/E1 and Full Autopilot wrappers refreshed before work. Scope: backend reserved registration, first-OTP avatar/language, resumable Unfinished, atomic Finished and organisation affiliation status. No Staging/Production or product membership grants.

## Provider contract proof (live Development)

On24 October2026 a task-created isolated test reservation used explicit reserved identification. Clerk readback showed reserved=true, no verification and no sessions. Preparing an OTP produced a signed email.created containing the exact user_id, email_address_id and server-written opaque attempt marker. Wrong code retained unverified state. The real provider-issued code verified the address. A60-second sign-in ticket consumed through official Frontend API ticket strategy created an active session for exactly that user (10:20:06Z). No internal account or product grants were created by this proof. Preparing another verification after prior verification also succeeded, proving resumability. Official provider API/schema consulted; no test bypass credential or automatic email verification.

## Source and isolated verification

SQL005 and IDENTITY-REGISTRATION-1 are additive. Forced RLS, no raw runtime grants, transaction HMAC and explicit policy. Local PostgreSQL checks cover pending versus active account separation, concurrent starts, wrong/cross-attempt proof, immutable four-variant email snapshots, delayed events, transactional rollback, existing profile preservation and organisation affiliation. The reservation is always locked before an attempt; remote verification and ticket preparation hold a bounded lease against concurrent resend.

Local Identity suite: 299 passed, zero failed/skipped; lint, typecheck and build passed. Platform contracts: 1072 passed, zero failed, two pre-existing Source tests skipped (not registration coverage). Final SQL concurrency suite after lease hardening: 8 passed, zero failed/skipped. Exact candidate CI follows in the PR.

Fresh Neon snapshot snap-plain-hall-b9b8ge28 (10:36:31Z) was restored with finalize:false into br-plain-salad-b9jbepn7. SQL005 digest 78af6bfebf483db2d49df5a11caf7fecfc608ac5768725f20adacdc1079cedd1 installed successfully there. All 14 accounts, 14 identity bindings, 14 profiles and 3 memberships were preserved exactly. Backfill: Finished for all 14; Assigned for 3, Unassigned for 11. Ordinary runtime raw table reads denied. Retained seven-field mail queue protocol still projected male/pl with registration disabled; synthetic probe rolled back.

LKG measured in the actual running Identity container at 10:42:06Z: retained deployment dep-dbe7303ncjis73d82qj0, commit 9841f3d6166b56811b02dca8874f1a968dfdb641. SHA256 of sorted path/content hashes for runtime dist, runtime dependencies and platform-contracts (2849 regular files): 154467adfc844c9664f1b9f6ab900b18eaf2ff24b4295d8d330c2b398a13ac60. Runtime configuration digest: 915525880f1275390a006a3984091d354ed55a29e2c9da23a5c0c0883e3578b8. Exact configuration retained privately; no secrets in source. Rollback retains SQL005/data and restores the prior artifact/configuration; no automatic whole-database restoration.

## Release status

Source, isolated tests and recovery rehearsal complete. Live migration, exact release CI/PR, deployment and end-to-end acceptance remain to be recorded before completion.
