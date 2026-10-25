# New-device mail transport corrective — Development

Task: ARCHITECTURE-NEW-DEVICE-EMAIL-20261025. Owner: Architecture Platform.
Authority: profitia/SG-dev:main. Existing ARCHITECTURE registration is retained.

## Accepted release and bounded stop

The owner approved the Development packet in host conversation
01a15aed-8d94-7fe0-9cff-c54f72b5f8a8. The immutable packet SHA256 is
96df479957853234bd81eaa18734db676adf271364d3a7fb2e334f109b0e116e.
PR718 source886dd3b9d05822e94a0dd80cbc050d73a800e997 was accepted as
30f888c068987c07c189d88bd8760a202190ab68. Its complete tree matched an isolated
integration with current main;349 Identity tests, lint, types, build and full
registered governance passed. Concurrent KRS/SRM request-contract changes were
preserved. No SG2/SRM/Benchmark service was deployed by this task.

Six immutable PL/EN Mailgun versions were published and independently read back.
Actual Clerk event msg_3LC9IqwE8rLb3xQIeDx87BvAnuB established field types,
non-null current user/address pairing and the trusted revocation origin. The
existing signed webhook returned204. Recipient policy is signed-clerk with no
allowlist. Private body, IP, recipient, signature and opaque URL were not logged.

One permitted Render build deployed30f888c0 as dep-dbf5lh5g1s2s73eio0q0
in48seconds; health/readiness were200. A final combined renderer/sender probe
then reproduced `Invalid stored template` before any network call. The existing
sender allowed only verification-code/invitation names and variable schemas.
The original renderer/worker tests had replaced the final sender with a stub,
so they did not cover this connection. This is a real release defect, not a
provider outage or evidence of a successful notification.

Native Clerk new_device_sign_in delivery was NEVER switched off. No new-device
mail was dropped, no live sample was sent, and no account/session was revoked by
this task. The new feature was not accepted as operational.

## Verified rollback

Supported retained-artifact rollback dep-dbf5mvdg1s2s73eish0g restored source
503782cc812b08a60d3ed75c1d0cd67a0f74de6a from dep-dbehbncs728c73c86kc0,
without another build. Actual container measurements before and after match:

-2874 runtime files; artifact SHA256
 1bc69568adb2135eabe7740f29952eb218bb0f6d315fd812c015a7b3bee6d74e.
-Private running configuration SHA256
 f5bab9e19c989112af5361a06dfd9bcd0fafcb0907efb14c6c7043d73614f099.
-Health/readiness200; native security notification and delivery remain enabled.
-All previous saved configuration values are restored; only the new opt-in key
 remains explicitly false for future standard deploys. In the retained running
 artifact the key is absent and the feature is disabled by default.

No product migration/data write, new resource, secret, plan change, Staging or
Production operation was performed. The six published templates are retained
for the proposed corrected release. No uncertain message is replayed.

## Minimal correction and acceptance boundary

Only add the exact new-device template family, its exact nine variable keys and
the already-validated opaque URL's4096-character bound to the transport. Existing
verification/invitation limits, one-recipient policy, pinned versions, TLS,
tracking suppression, CID-only assets, no redirects and no automatic retries
remain. New-template keys cannot be used with an old template or vice versa.

Regression coverage includes all six PL/EN/avatar variants through the actual
multipart sender, missing/extra/wrong-family variables, unpinned versions,
control/template injection, field bounds, absent action and a bounded long URL.
The existing ordinary PostgreSQL test now runs the actual worker, durable
encrypted store and actual sender, replacing only the external provider HTTP
response. It checks persisted language/avatar, single submission, opaque action,
queue settlement and ciphertext removal. It is synthetic source acceptance,
not live mailbox/session-revocation evidence.

This corrective is a separate DRAFT review candidate. The original one-build
approval is exhausted. No merge or additional deployment is authorized by this
document. A new owner decision must pin the corrective SHA, one additional
Development build, existing resources/configuration and retained-artifact
rollback before operational work resumes. Keep native Clerk delivery ON until
that corrected runtime and its provider acceptance pass.

Local corrective validation:356/356 complete Identity tests;31/31 targeted
transport/new-device tests;24/24 governance regressions; lint, types, executable
build and manifest validation PASS. The public candidate CI must independently
verify the exact committed source before any owner decision to merge/deploy.
