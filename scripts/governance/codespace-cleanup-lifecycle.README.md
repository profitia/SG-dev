# Codespace cleanup — Stage 03 lifecycle — PUBLICATION v6

Publication project: ARCHITECTURE; owner: Governance Source Layer (SG2-BASE-020).
Authority: active Canon v3 §10.8 and the current Development project profile.
Status: prepared for separately authorized publication; not installed or activated globally.

## Business result and stage boundary

This opt-in adapter connects the real preflight and PMOS task lifecycle with the unchanged Stage02 cleanup engine. The explicit run entrypoint executes start → one authorized work process → finish → limited epilogue.

The controlling Codex task invokes it explicitly. It installs no Codex/PMOS/Git hook, startup action, cron or scheduler. Stage04 live Codespaces acceptance and Stage05 default activation remain separately authorized stages.

The work command owns the original Business DoD and factual handoff. Process exit 0, green tests and CLOSEOUT_VERIFIED do not establish business acceptance or actual space reclaimed. Read the returned cleanup reports separately from continuity status.

## Owner-approved correction — canonical pre-closeout evidence

The actual report returned by the pre-closeout engine is captured before canonical save. It includes individual resource statuses, measurements and observedFreeBytesDelta exactly as returned; null remains null when no delta was measured.

A task-bound WORKSPACE_PRE_CLOSEOUT_REPORT_V1: finding carries the complete JSON report inside the existing findings.findings string array. This uses the existing flight-record schema; it introduces no PMOS, Canon or wrapper contract change. The derived bootstrap is validated by the native handoff validator and passed to pmos:save. The original bootstrap is retained unchanged.

The task-local checkpoint preserves the report, its digest, original/enriched input digests and protected derived input paths before save. Save/validation recovery reuses the same measured report without repeating deletion. Pending recovery requires complete substantive parity with that enriched input. A legacy pending without the captured report is preserved and refused rather than silently rewritten.

Readback requires the exact finding in both remote PHR flight-record.json and conversation-artifact.json after integrity verification. A SUCCESS manifest without the report cannot complete this adapter. Publication acceptance additionally reads the task's canonical ConversationArtifact.flightRecordJson from PMOS and compares the finding digest. Closed PMOS/PHR evidence is never modified retroactively.

## Dependencies and authority

Use the existing scripts/governance/codespace-cleanup.mjs, governance-preflight.mjs, apps/pmos canonical begin/save and pmos-prepare-execution-handoff.ts. Do not replace PMOS persistence or publish history manually. Project profiles continue to control MEMOROS/PHR.

Registered SG2, ARCHITECTURE and SRM configurations are supported. Publication of this ARCHITECTURE tooling does not activate it for any project.

## Task configuration

Place the config in the dedicated task directory outside the source checkout. All paths below are placeholders requiring real authorized locations.

```json
{
  "schemaVersion": "1.0",
  "projectKey": "ARCHITECTURE",
  "taskId": "ARCHITECTURE-EXAMPLE-TASK-1234",
  "repository": "profitia/SG-dev",
  "sourceRoot": "/ABS/SG-dev-CHECKOUT",
  "scopeRoot": "/ABS/TASK-SCOPE",
  "stateFile": "/ABS/TASK-SCOPE/task-lifecycle.json",
  "beginInputFile": "/ABS/TASK-SCOPE/pmos-begin-input.json",
  "phrRoot": "/ABS/PHR-CHECKOUT"
}
```

Source and PHR roots must be canonical checkouts of the registered GitHub repositories. Scope is outside both; task state is inside scope but outside disposable resources.

Config, begin input, work-spec and release evidence use physical paths. A regular file reached through a symlinked parent is refused, as is a file symlink. Missing bootstrap/recovery paths are checked against their nearest existing ancestor; no pending file is fabricated for validation. Persisted control paths are checked again before either destructive phase.

The begin input is the real canonical v2 record with exact task/project/workspace/environment/scope/targets, original request and required gate snapshot. For ARCHITECTURE use project ARCHITECTURE and workspace SG-dev Architecture. Supply the actual hostConversationId or explicit null; omit conversationId because PMOS derives it.

## Automatic opt-in run

Work-spec:

```json
{
  "schemaVersion": "1.0",
  "taskId": "ARCHITECTURE-EXAMPLE-TASK-1234",
  "program": "/ABS/PATH/TO/NODE",
  "args": ["/ABS/PATH/TO/AUTHORIZED-TASK.mjs"],
  "cwd": "/ABS/SG-dev-CHECKOUT",
  "timeoutMs": 120000,
  "bootstrapInputFile": "/ABS/TASK-SCOPE/bootstrap.json",
  "cleanPreCloseout": false,
  "cleanPostCloseout": false
}
```

The program/arguments must represent the actual authorized task. Timeout is 1000–7200000 ms. The work process must create a factual, valid PMOS BootstrapInput before exit, using the existing handoff mechanism. From apps/pmos, for example:

```bash
npx --no-install tsx scripts/pmos-prepare-execution-handoff.ts \
  --input /ABS/TASK-SCOPE/execution-handoff.json \
  --output /ABS/TASK-SCOPE/bootstrap.json
```

The handoff input must be a complete valid flight record, not the reduced test fixture: actual findings, result, changes, validations and matching metadata. Copy the exact derived conversationId and unchanged available hostConversationId. Bootstrap does not contain completionEvidence.

```bash
node scripts/governance/codespace-cleanup-lifecycle.mjs run \
  --config /ABS/TASK-SCOPE/config.json \
  --work-spec /ABS/TASK-SCOPE/work-spec.json
```

Order: real preflight → real begin → require-begin → authorized work → input/progress validation → pre-audit or admitted clean → canonical save/publications → completed registration and cleared pending/active-closeout → remote PHR integrity → post-audit or admitted clean.

Flags do not grant deletion authority. Cleanup still requires the actual mandate, ownership, retention release, recovery and all Stage02 guards.

## Resources and release

Apply reuse first before allocating. Only NEW task-owned directories or detached worktrees can be allocated. Historical collections cannot be adopted. Worktree removal is post-closeout only.

```bash
node scripts/governance/codespace-cleanup-lifecycle.mjs start --config /ABS/TASK-SCOPE/config.json
node scripts/governance/codespace-cleanup-lifecycle.mjs allocate --config /ABS/TASK-SCOPE/config.json --kind ephemeral-directory --name task-cache --phase pre-closeout
node scripts/governance/codespace-cleanup-lifecycle.mjs release --config /ABS/TASK-SCOPE/config.json --evidence /ABS/TASK-SCOPE/release.json
node scripts/governance/codespace-cleanup-lifecycle.mjs pre-closeout --config /ABS/TASK-SCOPE/config.json
node scripts/governance/codespace-cleanup-lifecycle.mjs finish --config /ABS/TASK-SCOPE/config.json --bootstrap-input /ABS/TASK-SCOPE/bootstrap.json
node scripts/governance/codespace-cleanup-lifecycle.mjs post-closeout --config /ABS/TASK-SCOPE/config.json
```

Release evidence outside the disposable resource:

```json
{
  "schemaVersion": "1.0",
  "projectKey": "ARCHITECTURE",
  "taskId": "ARCHITECTURE-EXAMPLE-TASK-1234",
  "allocationId": "<EXACT_ALLOCATION_ID>",
  "kind": "ephemeral-directory",
  "path": "/ABS/TASK-SCOPE/task-cache",
  "verificationRef": "<ACTUAL_RESULT_RETENTION_AND_RECOVERY_EVIDENCE>",
  "authorization": {
    "resultVerified": true,
    "retentionReleased": true,
    "recoveryPreserved": true,
    "noActiveConsumers": true
  }
}
```

These facts must actually hold. A marker or four booleans alone cannot authorize deletion. Config, state, begin input, work-spec, bootstrap and release evidence stay protected in both cleanup phases. A candidate containing required controls stops the destructive attempt before delegation and remains untouched.

Standalone pre-closeout is audit-only; pre-closeout --clean is refused. Destructive pre-clean is part of the verified closeout pipeline, exposed in CLI through run. finish --clean applies only to the post-closeout epilogue.

Git tracked/untracked/ignored state, unpublished commits, active consumers, physical paths, retention and /proc guards remain unchanged. On Linux EACCES/EPERM means REVIEW_REQUIRED, never successful cleanup.

## Recovery and complete evidence parity

- Work confirmed SUCCEEDED is not rerun. Its spec digest, exact physical spec path and bootstrap path are bound to state.
- Completed PMOS skips pre-clean and save on retry; only outstanding publication verification/epilogue continues.
- Existing matching pending uses the canonical pending recovery path without repeated pre-clean. With both pending and bootstrap present, compare the entire payload excluding only completionEvidence and metadata.timestamp. Any different business result, actions, validation or other substantive content blocks continuation.
- A missing bootstrap can be tolerated when valid pending survives or PMOS is completed. Foreign pending and unresolved active closeout require canonical recovery.
- Control paths are persisted before save so a retry omitting the bootstrap argument still protects them. Replacing a previously physical parent with a symlink fails closed.
- After an interrupted epilogue, run or post-closeout rechecks PMOS/PHR before clean. Absent resources are idempotent NOT_APPLICABLE.
- STARTED/FAILED work or changed specs cannot be blindly replayed. Codex diagnoses routine failures within its mandate; review is not automatically a request for new owner approval. Never manufacture SUCCEEDED. Escalate only actual authority/risk boundaries, preserving resume materials and Last Known Good.

## PHR and business reporting

Discovery reads the fetched remote main tree, using the canonical publisher's publicationId slug, including valid task IDs with repeated punctuation. Readback verifies immutable Git blobs, exact identity, full inventory, integrity.json, closeout evidence and flight/conversation records. Unrelated newer publications are allowed when the pinned publication remains reachable and the task bundle is unchanged.

Outputs preserve preCloseoutReport and postCloseoutReport with individual paths, statuses and measurements. The top-level observedFreeBytesDelta retains its legacy post-epilogue meaning; pre-clean measurements are in preCloseoutReport. Do not attribute all shared-disk free-space changes exclusively to this task.

CLOSEOUT_VERIFIED/ALREADY_CLOSED describes continuity. CLEANED/RETAINED/REVIEW_REQUIRED/NOT_APPLICABLE in reports describes resource handling. If freeing space is the business goal, assess its real DoD; safe retention alone does not prove that goal.

Stage04 acceptance correction: canonical PMOS/PHR closeout may truthfully record an incomplete business result. Readback accepts that recorded result only when the manifest and both flight records agree, while all identity, integrity and pre-closeout report checks remain mandatory. The lifecycle checkpoint records businessResult separately from CLOSEOUT_COMPLETE. A non-SUCCESS bootstrap is audited without pre-closeout deletion; a destructive post-closeout epilogue requires a remotely verified SUCCESS. Partial or blocked acceptance therefore preserves resources for resumption and never becomes business SUCCESS through continuity completion.

## Tests and publication

```bash
node --check scripts/governance/codespace-cleanup-lifecycle.mjs
node --check scripts/governance/codespace-cleanup-lifecycle.test.mjs
node --test scripts/governance/codespace-cleanup.test.mjs scripts/governance/codespace-cleanup-lifecycle.test.mjs
```

Full suite: 99 lifecycle tests plus 24 unchanged Stage02 tests (123 total). Tests use only their own temporary resources; PMOS replies are controlled doubles, while PHR uses real isolated Git repositories. This is not live Neon, live PHR or installed Codespaces acceptance. Stage04 regressions cover partial/blocked closeout, retention before and after save, and mismatched business results despite valid bundle hashes.

Publication v6 requires the unfiltered Linux suite, controlled invocation acceptance and current governance/CI. TEST-RESULTS.txt records actual execution; the earlier macOS-only v5 run does not substitute for Linux validation.

## Stage04 continuation: private managed resources

The optional `managed-private-directory` kind is created only by the separately
admitted task-scoped trusted worker. It is private from birth, exposes no FDs,
freezes its producer on release, and removes only its own verified allocation
through an ordinary capability-free worker. It does not adopt old resources.
Use `inspectorDescriptor` and the existing allocation/release/phase/closeout flow;
missing, changed or incomplete deployment fails closed without another deletion
path. Existing ordinary directories and worktrees keep all original guards.

See [the exact worker contract](codespace-cleanup-inspector.README.md) for the
root policy, narrow privilege boundary, recovery and runtime acceptance. No
source publication installs privileges, global hooks or schedules or activates
Stage05. Pre-closeout measurement still belongs in canonical evidence before
save; partial/blocked continuity retains required recovery data.

Run all four Linux suites, including codespace-cleanup-managed.test.mjs. Test
success does not replace real root-owned workspace CLEANED acceptance.
