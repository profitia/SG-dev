# Recover a published but not finalized PMOS closeout

Use the existing `pmos:save` entrypoint from the approved PMOS source revision:

```sh
npm run pmos:save -- \
  --recover-published-task-id ORIGINAL_TASK_ID \
  --publication-commit ORIGINAL_FULL_PHR_COMMIT \
  --publication-bundle history/YYYY/MM/DD/ORIGINAL_BUNDLE \
  --state-root /absolute/original/checkout/apps/pmos
```

Omit `--state-root` when source and original PMOS state belong to the same
checkout. The explicit root permits a separately registered repair checkout to
recover the original workspace without replacing its source, pending, identity,
or configuration. The CLI verifies both repository authorities; database and
project/host identity gates still apply. Never begin the original task again.

Recovery uses the same `.pmos/.pmos-save.lock` as ordinary save. A live writer
cannot lose its lock merely because it exceeds a time limit. Another pending or
active-closeout identity blocks recovery before any state change.

Before finalization it fetches PHR main and verifies the original commit's
ancestry, exact bundle path, six immutable files, manifest descriptors, all
SHA-256 digests, bundle integrity, task/project/conversation/host identity and
original source data against both PostgreSQL and the intact local archive.
PostgreSQL JSONB property ordering is excluded from semantic source identity;
PHR bytes and its original source digest remain unchanged. Completion evidence
is operational state and may advance only through the canonical finalization.

No publisher is called. The existing publication sidecar receives an
`IDEMPOTENT` acknowledgement with `verification.mode=VERIFIED_EXISTING`, exact
commit, bundle hash, source hash and verification time. This is evidence of an
independently verified existing publication, not a synthetic publisher response.
Previous failed acknowledgement attempts remain in its history.

The original ConversationArtifact is updated, and the same task-scoped HANDOFF
is finalized. Runtime context is refreshed from actual PMOS authority and
verified. Pending is released only after persistence and context checks and an
exact unchanged-input check. The original registration completes last. Every
write is followed by readback. Repeating recovery after completion verifies the
same proof and returns `ALREADY_COMPLETE` without publication or persistence
writes. Interrupted finalization resumes the missing operations using the same
identities and lock. SG2 still requires its delivered MEMOROS acknowledgement;
SRM and ARCHITECTURE retain their disabled-by-profile policy.

Regression coverage runs in the existing `pmos-save.test.ts` CI suite. It starts
an isolated loopback PostgreSQL instance, publishes with a digest-pinned snapshot
of the real PHR publisher to a disposable local Git remote, interrupts each
finalization boundary and verifies recovery and repeated no-op readback. The
snapshot under `test-fixtures/` is test data only; production continues to use
and validate the authority PHR repository. `PG_BIN` may locate test PostgreSQL
binaries. No test needs Neon, provider credentials or a live PHR write.
