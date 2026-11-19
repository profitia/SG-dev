# Codespace cleanup — Stage 02 manual tool

**Project:** ARCHITECTURE; implementation surface: `scripts/governance/**` (`SG2-BASE-020`, Governance Source Layer).
**Status:** manual CLI implementation only; **no lifecycle hook, cron, automatic resource registration, autonomous cleanup, PMOS/PHR write or real-Codespace activation**.
**Normative authority:** accepted `Canon/v3.0-profitia-agent-execution-canon.md` §10.8; this README does not introduce separate cleanup policy.

## What it does

- `audit`: read-only classification of task-declared resources; without task state, enumerates only immediate children of a selected scope root as `UNKNOWN_OWNER`. No directory is deemed disposable from its name or age.
- `clean`: deletion of a **precisely scoped, explicitly marked, task-owned disposable directory**, or a **Git-attached worktree after a verified *attestation* of closeout**. Requires matching task inventory and owner marker, an exact task ID confirmation, all affirmative task-state postconditions, filesystem and Git checks. Re-inspects after an exclusive cooperative lock.
- Results: `OWNED_DISPOSABLE`, `CLEANED`, `RETAINED`, `UNKNOWN_OWNER`, `REVIEW_REQUIRED`, `NOT_APPLICABLE`. Missing resources are `NOT_APPLICABLE` on retry. JSON results include measured logical and allocated bytes before deletion and *observed* free-space delta from `statfs` after deletion. The delta is **not** proof that this process exclusively recovered those bytes (concurrent I/O may change disk availability).

## CLI

Node.js 20+; no npm dependencies.

```bash
# Safe read-only discovery: all unknown directories remain untouched.
node scripts/governance/codespace-cleanup.mjs audit \
  --project ARCHITECTURE \
  --task ARCHITECTURE-CODESPACE-CLEANUP-02-TOOLING \
  --repository profitia/SG-dev \
  --source-root /workspaces/SG-dev \
  --scope-root /workspaces/sgdev-tasks

# Task-scoped inventory audit (no mutation):
node scripts/governance/codespace-cleanup.mjs audit \
  --project ARCHITECTURE --task TASK_ID --repository profitia/SG-dev \
  --source-root /ABSOLUTE/SG-dev --scope-root /ABSOLUTE/TASK-ROOT \
  --state /ABSOLUTE/EXISTING-TASK-STATE.json --phase pre-closeout

# Manual deletion of positively classified task-owned ephemeral directories:
node scripts/governance/codespace-cleanup.mjs clean \
  --project ARCHITECTURE --task TASK_ID --repository profitia/SG-dev \
  --source-root /ABSOLUTE/SG-dev --scope-root /ABSOLUTE/TASK-ROOT \
  --state /ABSOLUTE/EXISTING-TASK-STATE.json \
  --phase pre-closeout --confirm-clean TASK_ID

# Post-closeout epilogue (worktrees are eligible only in this phase):
node scripts/governance/codespace-cleanup.mjs clean \
  --project ARCHITECTURE --task TASK_ID --repository profitia/SG-dev \
  --source-root /ABSOLUTE/SG-dev --scope-root /ABSOLUTE/TASK-ROOT \
  --state /ABSOLUTE/EXISTING-TASK-STATE.json \
  --phase post-closeout --confirm-clean TASK_ID
```

`/ABSOLUTE/...` are illustrative paths, not a suggested live Codespace target. Neither the README nor this CLI authorizes deleting actual workspaces without a verified task mandate. **Do not invoke `clean` against the existing 103 GB historical task collection on the strength of this tool alone.**

## Task state and owner marker contract

Stage 02 accepts **existing, trusted task-state data**; it does not manufacture evidence of task ownership, phase authorization, retention release or PMOS closeout. Stage 03 will integrate resource creation, marker issuance, and retrieval of reliable closeout evidence into the established task lifecycle.

Example state file:

```json
{
  "schemaVersion": "1.0",
  "projectKey": "ARCHITECTURE",
  "taskId": "ARCHITECTURE-SAMPLE-TASK-1234",
  "repository": "profitia/SG-dev",
  "scopeRoot": "/ABSOLUTE/TASK-ROOT",
  "closeout": {
    "status": "CLOSEOUT_COMPLETE",
    "phrPublished": true,
    "pendingSlotCleared": true,
    "readbackVerified": true
  },
  "resources": [
    {
      "kind": "ephemeral-directory",
      "path": "/ABSOLUTE/TASK-ROOT/sample-build-cache",
      "phase": "pre-closeout",
      "allocationId": "0123456789abcdef0123456789abcdef",
      "authorization": {
        "resultVerified": true,
        "retentionReleased": true,
        "recoveryPreserved": true,
        "noActiveConsumers": true
      }
    }
  ]
}
```

The candidate directory must contain an ordinary file named `.codespace-cleanup-owner.json` with the exact matching identity:

```json
{
  "schemaVersion": "1.0",
  "projectKey": "ARCHITECTURE",
  "taskId": "ARCHITECTURE-SAMPLE-TASK-1234",
  "repository": "profitia/SG-dev",
  "scopeRoot": "/ABSOLUTE/TASK-ROOT",
  "path": "/ABSOLUTE/TASK-ROOT/sample-build-cache",
  "kind": "ephemeral-directory",
  "allocationId": "0123456789abcdef0123456789abcdef"
}
```

The unique `allocationId` is a matching technical identifier, **not an authorization token**. Inventory and marker are mutually corroborating information, not independently cryptographic proof. The explicit task-state assertions **must be supplied by the authorized lifecycle**, not fabricated merely to obtain a successful cleanup. The CLI independently checks scope, links, Git, process usage where observable, and resource identity. For post-closeout worktrees, it requires affirmative closeout/PHR/pending/readback state; **it cannot itself query PMOS or independently attest those assertions in Stage 02.**

## Guards

- No automatic deletion without a provided task inventory and matching owner marker; discovery with no inventory is audit-only.
- Protects primary source checkout, the scope root, Git internals, PMOS, PHR, archives, evidence, recovery, secrets and nested symlinks; no broad `git clean`, force removal, reset or prune.
- Candidate must reside strictly below a canonical, non-symlinked, non-protected scope root. The inventory and lock must reside outside the candidate.
- Ephemeral-directory deletion rejects any tracked source files and nested protected names/symlinks/special file types. Inside another Git checkout is rejected.
- Worktree deletion requires a registered, unlocked, unprunable worktree sharing the exact Git common directory and origin with the verified source repo. It rejects all tracked modifications and all ignored/untracked files other than its unique owner marker; `HEAD` must be ancestor of local `origin/main` and local `origin/main` must exactly match live remote `main`. If remote verification is unavailable or stale, it retains the worktree. It uses `git worktree remove` **without force**.
- Explicit task-state quiescence attestation is required; on Linux the CLI additionally checks same-UID `/proc` process CWDs and open FDs. **Restricted `/proc` (EACCES/EPERM) remains `REVIEW_REQUIRED`, never a proof of inactivity and never a deletion permit.** The implementation checks retention/Git/content guards first, so known protected/dirty resources retain their expected reason even when `/proc` is restricted. This is not a substitute for a lifecycle-issued exclusive task lease, which is part of Stage 03.
- Unit tests enumerate a fixture-owned process table and read actual cwd/fd links for fixture child processes, independent of unrelated Codespaces processes. A regression test injects EACCES and verifies `audit` and `clean` both refuse deletion. **Positive synthetic tests do not establish that clean can delete in a Codespace with incomplete `/proc` visibility.** An actual attempt remains blocked until an independently trustworthy process-isolation proof or sufficient inspection capability is available; a relaxed/ignored `/proc` error is not an acceptable workaround.
- A cooperative state lock blocks another instance of this tool; an orphaned lock fails closed (manual reconciliation; no automatic stale lock eviction).
- Status `RETAINED` is safe when expected (phase mismatch, active process, interrupted continuity); `REVIEW_REQUIRED` indicates ambiguity; `UNKNOWN_OWNER` is never a deletion candidate.
- The CLI never reads credentials, calls GitHub write APIs, modifies PMOS or PHR, runs `git fetch`, hooks, schedulers or migrations.

## Tests

```bash
node --test scripts/governance/codespace-cleanup.test.mjs
node --check scripts/governance/codespace-cleanup.mjs
```

Isolated tests create disposable bare Git remotes, detached worktrees and caches beneath `os.tmpdir()`. They do not target the user's Codespace. Review all new files under the correct `ARCHITECTURE` profile with the existing preflight/PMOS gate before integration. The local package test count and integrity manifest accompany the supplied archive.


## Stage04R: optional read-only restricted inspector

`--inspector-descriptor /absolute/root-owned/deployment.json` opts ephemeral
inspection into [the restricted inspector](codespace-cleanup-inspector.README.md).
No option installs or elevates a component. Worktrees retain the original path.
Missing, caller-writable, substituted or incomplete deployment is
`REVIEW_REQUIRED`; the engine never falls back to ordinary deletion.

The public inspector is **observation-only**. It returns `deleteAuthorized:false`;
the engine retains the resource even after a successful bounded idle observation.
Its public clean endpoint refuses before any rename or FD handoff. A `/proc`
walk, root UID, repeated scans, owner marker or a written policy is not an atomic
absence-of-references proof. Queued/transferred FDs remain relevant. Trusted
worker launch and a verified private reference lifetime are not implemented for
the synchronous Node controller. A capability grant alone does not resolve this.

The internal sealed transaction prototype has isolated state/recovery tests; it
is not enabled by any descriptor. This draft adds no live cleanup activation,
hook, schedule, privilege or business acceptance. Run the entire Linux suite:

```bash
node --test scripts/governance/codespace-cleanup.test.mjs scripts/governance/codespace-cleanup-lifecycle.test.mjs scripts/governance/codespace-cleanup-inspector.test.mjs
```
