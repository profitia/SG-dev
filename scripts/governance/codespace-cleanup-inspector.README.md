# Task-scoped cleanup inspector and managed worker

There are two explicit modes. The legacy process observer stays read-only;
its incomplete `/proc` evidence never authorizes ordinary directory deletion.
The new `managed-private-v1` mode handles only **new**
`managed-private-directory` resources created by its own trusted ordinary worker.
No old directory, worktree, cache or prior task can be adopted. Source publication
installs no elevated component, global hook, schedule or Stage05 policy.

## Resource-specific proof instead of a global process snapshot

A root-owned0700 guard contains each resource from before its creation. A fixed
worker is forked by the trusted broker, closes every inherited descriptor except
its private inner directory and private parent channel, drops groups/UID/GID and
all effective/permitted/inheritable/ambient capabilities, enables no-new-privileges,
becomes nondumpable and works from `/`. Only then does it create the cache and
owner marker. It executes no shell, external program, arbitrary Python or user
path. The bounded producer writes only `payload.bin` and the exact owner marker.
Neither file nor directory FDs are ever exported to a caller; replies contain
metadata only. The ordinary client cannot obtain FDs through the worker's `/proc`.

Thus the broker and its known worker are the only holders inside the operating
system's ordinary-user boundary. Administrative principals able to override DAC
are trusted administrators, not ordinary consumers. This model is limited to
managed allocations; it is not a claim about unknown existing resources. It
requires no global `/proc` scan, PID whitelist, namespace creation or SYS_PTRACE.
Legacy resources still fail closed on EACCES/EPERM.

An ACTIVE producer lease prevents cleanup. A lifecycle release freezes the
producer; it cannot create a new consumer afterward. Before deletion the broker
rechecks the root guard, object/marker/content digest, phase and all four release
attestations. It durably journals DELETING before instructing the same ordinary
worker to remove its cache through FD-relative operations. It commits only after
physical absence and a successful worker exit; a later status request independently
checks absence again. This is a held lifetime boundary, not a reusable idle scan.

The fixed cache producer is sufficient for controlled Stage04 acceptance. It is
not an arbitrary build-job executor and does not automatically convert today's
Codex worktrees/build directories into managed resources. Such adoption or global
automation is outside this update and must not be silently claimed.

## Scope, identity, concurrency and recovery

An immutable root policy binds project/task/source/scope, source SHA-256,
execution UID/GID, exact allowed cache names and per-cache byte bounds. Root
module, policy, interpreter and socket ancestors are root-controlled and cannot
be replaced by the execution user. The client verifies kernel SO_PEERCRED and
request nonce; the broker validates the exact task and resource identity. No
SCM_RIGHTS data is returned to ordinary clients. Kernel process identity comes
from a child created by the broker, not an arbitrary caller's claimed PID/code.

A root guard inode and flock serialize brokers. Parent/root moves, including
ABA rename and ancestor relocation, are refused. The ordinary lifecycle state
lock remains mandatory; distinct resource IDs cannot address one another.
The task-local `managed-index.json` is a technical recovery journal, not another
global ownership or PMOS/PHR registry.

CREATING, ACTIVE, FROZEN, DELETING and COMMITTED record the real state. A repeated
identical allocation recovers its existing ID, never duplicates a cache. A restart
may attach a new trusted worker only after verifying the exact private bytes and
that the old worker identity is no longer live. A live worker, changed content,
policy, marker, inode, symlink, hardlink or incomplete operation means retain/review.
DELETING is never blindly replayed. Stopping a worker closes FDs but retains named
private cache data for recovery. Public stop is accepted only after every cache
is COMMITTED. Root journals remain retained; no completed PMOS evidence is edited.

## Privilege boundary and administrator admission

Normal cleanup and the worker stay at the registered ordinary UID. Only the
fixed broker uses UID0 with exactly **DAC_OVERRIDE, SETGID and SETUID** in its
effective/permitted/bounding sets, empty inherited/ambient sets and
NoNewPrivs=1. DAC_OVERRIDE lets it validate only its admitted private tree;
SETGID/SETUID are used to launch the ordinary worker. There is no SYS_PTRACE,
SYS_ADMIN, blanket agent sudo, setuid/setcap interpreter, privileged container,
shared rebuild, `/proc` change or persistent startup mechanism.

The operator installs the exact reviewed Python source in a root-owned immutable
directory, verifies its SHA-256 **after copying**, creates a fresh task-only root
guard and root socket directory, writes the exact policy, and starts one bounded
broker with `setpriv`. Do not execute a privileged source from a writable checkout.
A missing installer or runtime admission retains resources. The task's prepared
administrator packet contains exact paths, source digest, commands and rollback;
those commands are not executed by source publication.

Policy fields: schemaVersion1.0, protocolPROFITIA_CLEANUP_INSPECTOR_V1,
mode`managed-private-v1`, repository`profitia/SG-dev`, exact projectKey/taskId,
executionUid/Gid, canonical sourceRoot/scopeRoot, modulePath/moduleSha256,
pythonPath, socketPath, guardRoot/guardIdentity, maxEntries/maxBytes and
resources`[{name,maxBytes}]`. guardRoot is a fresh root-owned0700 child of the
exact task scope and uses the workspace filesystem. No wildcard or historical
resource admission is accepted. Socket ancestors contain a root-owned regular
`.deployment-anchor`; the socket is root:executionGid0660.

Legacy `serve` remains observation-only and requires its original separately
admitted read capabilities. Its public clean is still disabled; policy flags
cannot activate the earlier isolated transaction prototype.

## Lifecycle integration and acceptance

Set `inspectorDescriptor` to the admitted root policy. Allocate with existing
lifecycle `allocate --kind managed-private-directory --name <admitted-name>
--bytes <bounded-count> --seed <reproducible-cache-input>`. State stores the
actual canonical private path, ID, inode and ownership proof. Existing release
and pre/post-closeout gates remain. release additionally freezes the managed
producer. Audit/clean use the authenticated managed endpoint; no failure falls
back to ordinary path deletion. Worktrees keep their original Git/proc checks.
The descriptor remains protected recovery/control data.

Reports separate logical bytes, allocated bytes and the **signed observed**
free-space delta on the shared disk. The latter is an observation, not exclusive
attribution. Canonical pre-closeout evidence must be captured before pmos:save;
PHR/PMOS closeout and readback remain unchanged. No closed history is amended.

Run all four unfiltered Linux suites:

```bash
node --test scripts/governance/codespace-cleanup.test.mjs scripts/governance/codespace-cleanup-lifecycle.test.mjs scripts/governance/codespace-cleanup-inspector.test.mjs scripts/governance/codespace-cleanup-managed.test.mjs
```

Ordinary-user tests exercise real worker forks, privilege-free execution,
nondumpability, private FD protocol, state transitions, actual fixture removal,
concurrency, tampering and recovery. Their guard-owner injection is unit isolation;
it does not prove a deployed root boundary. Actual root-owned workspace acceptance
must separately prove denied external access, actual CLEANED, physical absence,
measurements, regression/CI and canonical continuity. Until then report partial
readiness, not completed business success.
