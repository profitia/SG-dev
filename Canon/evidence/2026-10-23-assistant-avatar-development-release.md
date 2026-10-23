# Assistant avatar Development release evidence

Evidence checkpoint: 2026-10-23, following the first live acceptance failure.
Final release and continuity receipts belong to the associated PMOS/PHR records.

## Scope and control

Source authority: `profitia/SG-dev`, `main`. Separate registrations:
`ARCHITECTURE-ASSISTANT-AVATAR-RELEASE-20261023`,
`SG2-ASSISTANT-AVATAR-RELEASE-20261023`, and the corrective source task
`ARCHITECTURE-ASSISTANT-AVATAR-TRANSACTION-FIX-20261023`.
Actual workspaces are isolated local Architecture and SG2 worktrees. Explicit
Development scope only. No Staging, Production, KRS pilot or shared SRM/Maps
release. No schema migration, product grant or organisation assignment.

The owner approved permanent USD7/month Identity compute and completing the
deployment before the upgrade. Render's Free-to-paid API update was rejected;
the dashboard upgrade triggers a build. An isolated branch pinned to the old
source enabled that build without changing main. Identity was then returned to
main with auto-deploy off. Permanent plan: `0.5c-512mb`.

## Measured retained baselines

| Property | Identity | SG2 |
| --- | --- | --- |
| Service | srv-dbcse6jrjlhs73eib3sg | srv-dapa3tid0e5s73f8bc5g |
| Retained deploy | dep-dbdrkvom7kps73bfgjqg | dep-dbd7dha9lscs73ehbms0 |
| Source | 68f4784d32ab77f77fd9b90d4bbd410171159aea | 68f4784d32ab77f77fd9b90d4bbd410171159aea |
| Measurement job | job-dbdrlh7f3r2c73bqqls0 | job-dbdrnr8m7kps73bfp8fg |
| Artifact content SHA256 | 39056cb0c3b6635447856e5bccbaa02aa2bc49c0b7817244cd105ea61ecd8d08 | ffd49bc6d15c013e748717b316df506457993310dae74b321f247a12dd3bc358 |
| Configuration SHA256 | 6c4b420fc85ced3afab4647c3d6a3cc02bec3c39ba676b9b16bd4ba8e318e739 | 5fa2dfc658c7daeb074e7489747a55bfebfb14b25c103d040dbcfd296815a395 |
| Files measured | 2821 | 29492 |

These are native retained-build content fingerprints, not OCI image digests.
Identity includes dist, dependencies, package manifests and contract source.
SG2 includes Next build, dependencies, public assets, manifests, contract source
and the forecasting runtime. No credentials or user data are published.

## Neon recovery incident

Before deployment, snapshot `snap-purple-boat-b9rvs3zs` was captured for
`spring-bread-28217539`, database `platform_private`, original branch
`br-sparkling-term-b99l107x`. A mistaken finalized snapshot restore moved the
live endpoint/default designation to a restored branch. The operator disclosed
the mistake and reversed the endpoint/default routing without deleting data.

Canonical branch `br-sparkling-term-b99l107x` is again `development`, default,
with original endpoint `ep-late-heart-b9mxo8oi`. Restored copy
`br-crimson-scene-b9nofzoh` is preserved as
`avatar-incident-preserved-copy-20261023`; its temporary endpoint
`ep-crimson-night-b9o61ck0` is disabled. Parking branch
`br-hidden-smoke-b9thok33` has no endpoint. All 117 application tables were
compared by row count and content hash before and after routing recovery:
zero differences. This supports no observed data loss; it does not erase the
temporary infrastructure-routing incident. No migration was applied or undone.

## Acceptance failure, rollback and correction

Candidate source `f39359c4f4ab5cd611285909e6dba256d22a0eac` became live on Identity
`dep-dbdrmddg1s2s73arvp5g` and SG2 `dep-dbdrqmbncjis73d9mfk0`. Health checks and
anonymous denial checks passed. Real browser login on an isolated Clerk test
account then created the central account but failed before avatar restoration.
No real user's preference was altered.

The cause was an adapter mismatch: `accountTransactions` rejected the profile
host's 3000ms acquisition policy because it accepted only provisioning's 5000ms.
The original HTTP/SQL test used a fixture transaction and missed this wiring.
The test now uses the real runtime adapter. It reproduced HTTP503 before the
fix; after the bounded acquisition fix, all 172 Identity tests, lint, typecheck
and build passed. Late acquisition timeout/abort releases the connection without
starting SQL. Identity/SQL policies, RLS and closed payloads remain intact.

Both services were restored with retained artifacts, not rebuilt source:
Identity rollback `dep-dbdrss8n74is73emr8h0`, SG2 rollback
`dep-dbdrsr8m7kps73bg8qi0`; both reached live at the original source. The paid
Identity plan remains active. No database rollback was performed. New source
CI, repeat live browser acceptance and final PMOS/PHR publication are pending
at this evidence checkpoint. Clerk avatar-specific email delivery is a separate
integration and is not claimed by this persistence release.
