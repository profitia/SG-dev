# Communication language — Development acceptance, 2026-10-24

Owner ARCHITECTURE. Tasks ARCHITECTURE-COMMUNICATION-LANGUAGE-20261024 and
ARCHITECTURE-COMMUNICATION-LANGUAGE-RUNTIME-20261024. Full Autopilot within the
accepted Development scope; no Staging, Production, SG2/SRM or KRS service deployment.
Preceding Clerk activation was recorded in architecture_pmos before language work.
MEMOROS remains disabled.

## Source, tests and live version

- Producer PR678: c3e97d5088e85ec5b05f1f1436ec8641abcc7cc2.
- Runtime PR679: a7fe529ae02952696578e41afbf903f6453e1f14.
- Queue shutdown PR680: 9841f3d6166b56811b02dca8874f1a968dfdb641.
- Live Identity service srv-dbcse6jrjlhs73eib3sg, deployment
  dep-dbe7303ncjis73d82qj0, exact PR680 merge SHA above. Health and readiness 200.
- Final measured artifact SHA256:
  8beeb484a56c37a88b9c46e831c81f5549e36f138e8063b8f6e631110928b1b9.
- Configuration SHA256:
  8289fe66a766a7eb4a8d66692df340e3bbd541cf4c0871d8ddf31783e401d1c3.
- Final Identity suite: 282 passed, zero failed/skipped; lint, types, build passed.
  GitHub exact-head run40079474058 passed both Identity security/governance and
  unchanged producer/isolated PostgreSQL jobs. Earlier producer40077435656 and
  controlled SG2 integration40077456408 passed; runtime40078240667 passed.
- Tests cover primary browser mapping, existing PL migration, concurrent creation,
  first browser write, explicit future override/version conflict, account isolation,
  revocation, queued language immutability and 30 rendered message/avatar/language
  combinations. Public adopted user-profile module stayed unchanged.

## Persistence and recovery

Neon project spring-bread-28217539, original Development branch
br-sparkling-term-b99l107x, endpoint ep-late-heart-b9mxo8oi, database platform_private.
SQL004 installed as constrained profitia_access_owner at08:30:35Z after rehearsal
on separate br-old-math-b9rb95c3. SQL004 SHA256:
1fdff82e8d9638338662f898c06b41c54bed6a23fc2fd8dc710bf36687fecd2b.

Before/after migration:14 accounts,14 external identities,3 memberships; profiles
8→14. Existing account, binding, membership and non-language profile fields were
compared and preserved. All14 existing accounts received pl/migration. Runtime
raw installation access denied; unbound profile read returned zero rows. Only
identity_b1_runtime received bounded language projection. Signed queue compatibility
probe was rolled back entirely without persisting or sending synthetic mail.

New accounts initialize once from primary browser/system language (pl/pl-*→pl,
otherwise en). Stored migration/browser/user preference wins at later logins.
Real browser initialization was exercised on one authorized test-account default
fixture; it stored en/browser. The two test accounts retained EN during subsequent
login and were restored to original PL/migration after mail tests. Avatars and
membership ownership remained unchanged. Expected session renewal changed expiry
and version only on those two test bindings; all other binding fields matched the
pre-test rehearsal copy. Final counts remained14/14/3.

Snapshot snap-fancy-truth-b92cw4md was created at08:21:06Z (expiry2026-10-31T10:00Z).
Before language rollout the retained df003418997937122b9ea2a3e3357fec788998ae artifact
was measured (1e070621105a49a15caab2a78bd4e08260d9ff05347dbcc352dcb46c2bb21c7f).
Before shutdown fix, LKG dep-dbe6qghsrm7s73b3tcb0 / a7fe529a was measured:
artifact2186910f23246e8d887f4df13644d159fefb54be8be3918c06f8c0e4807b4c75,
configuration3f9e28e727ac1727eeab01dc17c66d163bc31c6680d7819d8d4f54f4bf354535.
Configuration was privately saved. Retained-deployment rollback availability was
verified. Code rollback preserves SQL004, new accounts, outbox and deduplication;
no automatic database snapshot restore or irreversible down-migration.

## Real Clerk → Mailgun → Clerk acceptance

Twelve stored Mailgun templates (verification-code/invitation × pl/en ×
male/female/neutral) published on spendguru.app and exact version contents read
back; provider CRLF normalization accounted for. Runtime pins content-hash versions.
Clerk remains issuer/verifier; verification_code/invitation delivery_by_clerk=false.
No local code generation. Codes/links are encrypted in queue and purged at settlement.

| Variant | Clerk email ID | Mailgun delivered event, SMTP250 | Template version |
|---|---|---|---|
| PL/female | ema_3L8MCIkLwbOinezaVKCV7Y41g1O | vmpLKY5_Qky5hQD2vszO1Q | v-1ea6a65396dae8946fafcdf3 |
| PL/male | ema_3L8Nut7GrXcpS5EKqfXjCYrgfd4 | tZRh0EWXQgqTOS1Pa7WgmA | v-dc872c44f0ce2d539f65ad69 |
| EN/male | ema_3L8O2bm6Tt5RBezdAlHziDWuEJZ | 342td3TlQvW2JcEkTXYokQ | v-22dcaa140441ebfeeb3a0733 |
| EN/female | ema_3L8OAxp2ZvhxCTeVfxsNFFqAfi2 | OWP_w-q6SA6936KU_WRo-w | v-f40b100a1cf62f511cf94ddd |

All four real OTPs were accepted through browser login, with the corresponding
existing account and assistant avatar shown on the account-ready page. Male tests
used the authorized Office365 mailbox; female tests the authorized home.pl mailbox.
English test profiles were explicitly temporary fixtures; the future settings UI
was not added. Invitations were verified end-to-end in the preceding activation
stage; every invitation language/avatar template was rendered and published, but
no additional English live invitation is claimed.

## Cutover correction and verification boundaries

Initial EN test ema_3L8LyONC0PFmaC2PCGzg8XKuvbI had EN in the queue but Polish-only
old renderer output without stored-template metadata. It is EXCLUDED from language
acceptance. Overlap with the old worker is the inferred cause. Inspection found
email.stop was deferred until HTTP connections drained. PR680 stops intake/polling
immediately at signal, releases not-yet-started claims and drains one durable
attempt. Five race regression tests passed. Acceptance resumed only after old
deployment deactivation and the sole new instance xzhtv was visible. Subsequent
three messages used the expected pinned variants, with no pending/rejected jobs.

An unbound first signup OTP or pre-account invitation still uses neutral EN: current
signed Clerk events cannot safely identify that browser's pending preference. No
email-based identity lookup or unverified client identity was introduced. Full
first-message personalization is not claimed. Communication language is not a
country field, and this change does not translate the application interface.

SMTP250 proves recipient-server acceptance, not user inbox location or graphics
rendering. Mailgun stored-message retrieval returned404; no inbox-render acceptance
is claimed. Canonical CID assets, escaping and all language variants were verified
in automated tests and published-template readback. No secrets, OTPs, action links
or mail bodies are retained in this evidence.
