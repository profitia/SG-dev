# Embedded account: SRM Development

Owner: Architecture Platform (producer); SRM owns the presentation. Task ARCHITECTURE-EMBEDDED-ACCOUNT-20261024. Scope Development only.

## Contract

- `IDENTITY_EMBEDDED_TARGETS` is a JSON array, default `[]`. Every ID must be a unique target in the closed `IDENTITY_RUNTIME_CONFIGURATION.targets` registry. No implicit opt-in, wildcard or arbitrary callback.
- Add target `srm`, applicationId `srm`, origin `https://srm-development-runtime.onrender.com`, routes `{ "home": "/" }`. Keep all existing targets unchanged. Enable `["srm"]` only after consumer readiness.
- Cross-origin `POST /v1/embedded/srm/registration/start` and `/registration/verify` call the same canonical resumable registration service as the standalone Identity page. Draft avatar and primary browser language are saved before the first Mailgun message. Provider-generated codes/tickets remain authoritative. Existing Finished accounts route to login; Unfinished attempts require fresh mailbox proof.
- `POST /v1/embedded/srm/account` takes `{}` with the real Clerk Bearer session and optional opaque X-Registration-Receipt. It runs the existing transactional ACCOUNT_SELF provision/finish operation, then reads persisted avatar and communication language. The response exposes only authentication, internal user ID, expiry and those two preferences.
- Exact Origin required; no cookies or credentialed CORS, no client-supplied internal user/organisation/role or return URL. POST/JSON only; bounded body; OPTIONS allows only the three contract headers.
- An internal consumer adapter uses its deployment-owned receiver origin to validate the original JWT issuer, subject, session, azp, expiry and current provider/binding state. This is an explicit trusted ingress adapter, not forwarding client identity headers. It retains the Identity runtime's private ordinary SQL role and app binding; SRM never receives private database credentials.
- Public navigation and existing same-origin account routes retain their previous policy. There is no middleware exemption for private SRM data. ACCOUNT_SELF is not an organisation grant. New registrations finish as Unassigned.

## Release and rollback

1. Refresh main, exact paths/routing/preflight and Architecture PMOS begin; separately perform SRM governance.
2. Validate executable tests including existing shared-session and SQL fixtures, plus wrong-origin/issuer/party/revoked/expired tests. Synthetic tests do not prove live delivery.
3. Before each deployment record current deploy ID/SHA, measured artifact and configuration digest, migrations and retained deploy availability. No migration or data backfill is part of this change. Do not print secrets or OTPs.
4. Deploy reviewed Identity SHA, then merge-preserving configuration update for just the target and opt-in. Validate preflight and denied foreign-origin requests; verify existing health and account entry.
5. Consumer release is separately guarded by SRM_PORR_ACCOUNT_ENABLED and SRM_IDENTITY_ACCOUNT_ORIGIN. Deploy consumer only after producer is ready.
6. For regression disable the consumer flag, restore its retained artifact and exact previous config. If needed disable embedded targets and restore the Identity artifact/config. Never reverse existing profile/registration migrations or delete users created during the test.
7. Live acceptance requires real Clerk/mailbox verification, persisted profile/preferences, refreshed session, and unchanged organisation grants. If mailbox confirmation requires user input, report that boundary rather than marking it complete.
8. Publish evidence and PMOS closeout/PHR separately for both owners.
