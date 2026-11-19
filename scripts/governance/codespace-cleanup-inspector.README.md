# Restricted cleanup inspector — Stage04R

Status: opt-in source implementation; **no privileged runtime installation and no
shared-Codespace CLEANED acceptance**. This component does not activate Stage05.

## Business result and boundary

The inspector provides bounded process/thread observations and a fail-closed
integration with `codespace-cleanup`. It does not turn a successful `/proc` read
into unconditional permission to delete. It supports ephemeral directories only;
worktrees stay with the original engine and its original restrictions.

A `/proc` walk is not an atomic kernel reference snapshot. A descriptor can move
between processes while their tables are read; references can also be queued in
a Unix socket. An additional scan or root UID does not eliminate that problem.
Consequently guarded removal is admitted only in an **exclusive reference domain**
independently established by an administrator: the resource has been private to
that domain since allocation, outside ordinary processes could never obtain a
reference, root administration is trusted, and the nondumpable trusted client is
the only remaining ordinary process. A normal shared Codespace with an agent,
Node controller, editor and ssh sessions does not meet this condition. The gate
refuses before renaming any data. Do not claim that installing the broker alone
resolves real E2E acceptance or permits shared-resource deletion.

## Privilege separation and protocol

`codespace-cleanup.mjs` runs as the normal user. An explicit
`--inspector-descriptor` selects the isolated Python client; configuration and
module paths must have root-owned, non-writable, non-symlink ancestors, and the
module SHA-256 must match. The client remains the admitted ordinary UID/GID,
sets itself nondumpable before receiving any private descriptor, starts no child
commands, and uses a close-on-exec Unix `SOCK_SEQPACKET` connection.

The broker is a separately admitted root component, not root cleanup. It needs
`SYS_PTRACE` for otherwise inaccessible process metadata and `DAC_OVERRIDE` for
complete bounded traversal. It does not request `SYS_ADMIN`, change `/proc`,
whitelist sshd or install capabilities on a general interpreter. Both peers check
kernel `SO_PEERCRED`; namespace/UID/start-time checks bind the client. The socket
and all its ancestors are root-controlled. Private directory descriptors use
`SCM_RIGHTS` with exact count, truncation checks and close-on-exec. Protocol,
request nonce, policy digest, project/task/source/scope, dev/inode, allocation ID,
owner-marker SHA-256 and substantive content digest are bound at admission.

The observer examines cwd, root, all file descriptors and mappings for every
visible process/thread, including different UIDs. It checks process and thread
population stability and start times, filesystem mount aliases and namespaces.
Any EACCES/EPERM, changed population, missing live observation, bound exhaustion
or unsupported namespace fails closed. An `OBSERVED_IDLE` response is a bounded
observation and is never a removal lease or a universal process proof.

## Guarded removal and recovery

Only after both substantive validation and the reference-domain gate pass may
the broker atomically rename an admitted directory into its workspace-backed
root-owned guard. The guard inode is pinned and watched for moves, including ABA
renames beneath the user-writable `/workspaces` parent. A root-only outer
boundary encloses a group-accessible inner lease directory. The ordinary client
receives only its private inner FD, with no executable child or exported FD.

The broker verifies content/object identity and process/reference-domain evidence
again after sealing and before `begin-delete`. It durably journals `DELETING`
before acknowledging that request. The ordinary client removes through
FD-relative operations; the root broker never unlinks candidate contents. It
commits only after verifying physical absence. The engine accepts only the
request-bound committed receipt and reports logical bytes, allocated bytes and
observed free-space delta separately. Shared-disk delta is not attributed wholly
to one operation.

PREPARED/SEALED abort or recovery restores only unchanged bytes to the original,
still-identical parent with an atomic no-replace rename. A recreated source name
is never overwritten. A live lease holder blocks recovery. A crash after
DELETING retains the root journal/remnants and requires explicit reconciliation;
there is no blind replay, forced restore, forced delete or fictitious success.
Unresolved recovery blocks subsequent transactions. COMMITTED/RESTORED journals
are retained. Candidate content with symlinks, hardlinks, special files, nested
filesystems or protected data is refused. Bounds: 32 admitted resources, 10,000
entries/64 MiB per tree, 4,096 processes/16,384 threads/30,000 observations,
2 MB messages or mappings, 60-second connection timeout, 64 requests and a
300-second idle timeout. Exhaustion means refusal, not truncated proof.

## Deployment descriptor

A descriptor is root-owned and immutable to the execution user. Required fields:

- `schemaVersion: "1.0"`, `protocol: "PROFITIA_CLEANUP_INSPECTOR_V1"`.
- `repository: "profitia/SG-dev"`, exact `projectKey`, `taskId`, `executionUid`
  (nonzero), `executionGid`, canonical `sourceRoot` and separate `scopeRoot`.
- Root-controlled regular `modulePath`, exact `moduleSha256`, and a canonical
  root-controlled regular `pythonPath` (resolve the Python symlink first).
- Root-controlled `socketPath`; its parent contains a root-owned regular
  `.deployment-anchor`. Socket mode is 0660 for the exact execution group.
- `guardRoot`, a dedicated root-owned 0700 direct child of `/workspaces`, on the
  candidate filesystem, outside source/scope, plus exact `guardIdentity` dev/ino.
- `maxEntries`, `maxBytes` within the bounds above.
- `resources`: exact admitted `{path, dev, ino, allocationId, markerSha256}` rows.
- For clean, `referenceDomain`: `mode: "exclusive-reference-domain-v1"`,
  `resourceExposure: "private-since-allocation"`, exact `pidNamespace`,
  `mntNamespace`, `userNamespace`, and `authorityEvidenceSha256` referencing the
  administrator's independently verified isolation evidence. Writing these
  strings or hashing a proposal does not establish that isolation.

The policy cannot authorize a foreign task, adopt historical resources or relax
Git, retention, PMOS, PHR or owner controls. Module publication is not installation.

## Administrator intervention and rollback

There is **no safe one-command sudo workaround for the current shared Codespace**.
Two distinct conditions must be admitted and proved before live clean:

1. A trusted broker installation for the exact published module SHA, task and
   resources. Use a root-owned non-writable deployment directory (for example
   `/opt/profitia-cleanup-inspector/<module-sha256>/`), root-controlled descriptor
   and socket directory, workspace-backed pinned guard, and a task-bounded broker
   process with UID0, the execution GID and only the needed observation/traversal
   capabilities. Normal cleanup remains unprivileged. Do not run directly from
   a user-writable checkout or use setuid/setcap on Python or Node.
2. An independently demonstrated private reference domain for **newly allocated**
   resources and a trusted, sole remaining ordinary client. The current shared
   Codespace does not qualify. Establishing this requires a separately approved
   execution/isolation change; no rebuild, process suspension, namespace change
   or resource migration is authorized by this source publication. In particular
   the normal unprivileged Node parent is itself another ordinary process, so
   the current synchronous controller cannot pass this gate. A future controller
   change must preserve the entire lifetime boundary, not exempt its PID/name.

Only after those conditions are actually satisfied may an administrator launch
`<trusted-python> -I <trusted-module> serve --descriptor <root-policy>`. This is
not an instruction to install privileges now. Recovery uses the same admitted
policy and `recover --transaction <exact-token>` for a preserved SEALED
transaction, never a DELETING transaction. There is no privilege installer.

Rollback: disable the opt-in descriptor in the owning task's configuration and
return to the original fail-closed engine; stop only the task-bound broker after
checking its exact PID/start-time and resolving live leases. Preserve every
nonempty guard, transaction journal and recovery input. Remove a stale socket
only after proving no broker owns it. Revoke only the newly granted component
admission and remove only independently verified empty deployment artifacts.
Do not delete evidence, old resources, shared mounts or other processes.

## Verification

```bash
node --check scripts/governance/codespace-cleanup.mjs
node --check scripts/governance/codespace-cleanup-lifecycle.mjs
python3 -c 'import ast,pathlib; ast.parse(pathlib.Path("scripts/governance/codespace-cleanup-inspector.py").read_text())'
node --test scripts/governance/codespace-cleanup.test.mjs scripts/governance/codespace-cleanup-lifecycle.test.mjs scripts/governance/codespace-cleanup-inspector.test.mjs
```

Tests isolate their own temporary files. Filesystem transaction tests inject a
synthetic process observation and owner UID; they verify state/recovery/ordinary
unlink behavior, **not a privileged live proof**. Separate tests cover actual
Unix peer credentials, FD passing, nondumpability, full synthetic process/thread
tables, missing/writable deployments, cross-language content binding, optional
lifecycle forwarding and protected descriptor retention. Public server startup
as an ordinary user refuses rather than elevates. No user data, hook, schedule,
17 prior Stage04 assets or existing PMOS/PHR history is modified by these tests.
A real shared `/workspaces` CLEANED is still required for business acceptance;
source tests and safe refusal do not satisfy that outcome.
