# Exact signed new-device subject — post-closeout corrective

Profile ARCHITECTURE; Development only. Existing module owner Architecture
Platform. Follow-up registration ARCHITECTURE-NEW-DEVICE-SUBJECT-20261025 links
to ARCHITECTURE-NEW-DEVICE-EMAIL-20261025, whose immutable publication is
f3483a720817953cc77e24c44893275fc565f620 in project-history-repository.
The earlier snapshot is retained; this document records a later finding.

A signed actual Clerk new_device_sign_in event carries the subject
`[Development] New device signed in to your SpendGuru PORR account`.
The renderer reconstructed the base English title and omitted the environment
prefix. Native template settings were unchanged, but that did not establish
byte-for-byte equality of the outgoing subject. The two explicitly labelled
PL/EN previews proved transport/body/inbox delivery; their intentionally
substituted test subjects did not cover this real-envelope field.

On discovery, native delivery was restored ON while the security notification
remained enabled. Supported retained-artifact rollback dep-dbf67k2vcj2c73evkia0
restored source503782cc812b08a60d3ed75c1d0cd67a0f74de6a without another build;
the new opt-in is saved false. Independent Svix readback found zero actual
new-device events during the affected cutover window. Only the two approved,
clearly labelled previews were sent by the task. No real session was revoked.

The minimal source change carries the bounded, header-safe subject from the
signed provider envelope into the encrypted instruction and immutable
fingerprint. The delivery worker applies that exact value after rendering the
localized body, so an authoring default cannot replace it. It does not infer,
construct or hard-code an environment prefix. Verification-code/invitation
subjects, body templates, versions, sender, recipient policy, signatures,
trusted action origins, queue security and retry policy remain unchanged.
No schema or infrastructure change is required.

Regression covers missing/empty/oversized/CRLF/template-injected subjects at
the signed boundary; a renderer trying to replace the title; encrypted
persistence; and exact subject arriving at the actual multipart sender through
both PL/EN PostgreSQL worker paths. No provider request occurs in these tests.

This source is a review proposal only. Both previously authorised builds were
used; no further merge/build/cutover is authorised by this document. A new
explicit exact-SHA owner decision is required. Existing six immutable templates
and successful sample receipts remain reusable; no additional sample message
is needed. Preserve the original closed Flight Record and publish this follow-up
through its own canonical registration. Staging/Production and all SG2/SRM,
Benchmark/KRS source and services remain outside this corrective.

The repository-wide PHR checker also reports six pre-existing duplicate legacy
publication IDs from September. The new October25 bundle has no reported issue;
its remote commit and integrity are verified separately. Do not edit legacy
bundles or portray that global historical check as PASS.
