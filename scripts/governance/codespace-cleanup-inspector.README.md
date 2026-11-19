# Restricted cleanup inspector — Stage04R draft

**Public functionality: bounded read-only process inspection. Live deletion is
unconditionally disabled. This draft is not ready for merge or cleanup activation.**

The implementation does not resolve the shared Codespace's business acceptance.
No privileged component, hook, schedule, namespace, global configuration or
Stage05 policy is installed. No policy field can enable public clean.

## Implemented

An optional `--inspector-descriptor` integrates the inspector with ephemeral
resource handling in the existing engine. Lifecycle forwards that descriptor in
both phases and protects it as a control/recovery input. Worktrees continue to
use their original process, Git and continuity guards. Missing, writable,
substituted or incomplete inspection never falls back to ordinary deletion.

The isolated Python client stays at the normal UID/GID and becomes nondumpable.
It accepts only a kernel-authenticated root peer on a root-controlled Unix
`SOCK_SEQPACKET` socket. Root-owned non-symlink deployment paths, a pinned module
SHA-256, exact project/task/source/scope and admitted dev/inode/marker identities
bind requests and responses. JSON duplicate keys, truncation, replayed request
identities and unexpected descriptor counts are refused.

The separately admitted read-only broker examines every visible process/thread's
cwd, root, file descriptors and mappings, with process/thread start-time and
population checks. It observes all UIDs, not an sshd/PID whitelist. Inaccessible
live state, changed populations, another mount view, unsupported namespaces,
non-root capable peers, missing metadata or exceeded bounds means refusal.
`OBSERVED_IDLE` is explicitly `deleteAuthorized:false`: a bounded visible-process
observation, not universal inactivity or permission to remove anything. The
opted-in engine therefore retains the resource after that response.

The broker requires UID0, exactly `SYS_PTRACE` and `DAC_READ_SEARCH` in effective,
permitted and bounding sets, no inheritable/ambient capabilities and
`NoNewPrivs=1`. These are capabilities of the fixed trusted component alone.
Ordinary cleanup never becomes root. No setuid/setcap interpreter, general sudo,
SYS_ADMIN, `/proc` modification or shared Codespace rebuild is supplied.

## Why live clean remains unavailable

A `/proc` walk is not an atomic kernel reference snapshot. A descriptor can move
between process tables while they are read; references can also be queued in a
Unix socket. Root read access, repeated walks, a task marker and a written
attestation do not eliminate that race. An unrelated ordinary controller also
cannot be assumed harmless merely because it has the expected UID or PID.

Nondumpability protects a process from peers; it does not authenticate that an
arbitrarily started Python process is executing trusted code. Handing that
caller a private directory FD would create another route to leak references.
The public broker consequently refuses **every clean request before rename or
FD handoff**. The public client also refuses clean. No descriptor, CLI switch,
namespace string or administrator attestation overrides this restriction.

There is an isolated internal transaction prototype: root-owned guard/inode
pinning and move detection, content/marker binding, no-replace sealing, ordinary
FD-relative removal, durable PREPARED/SEALED/DELETING/COMMITTED/RESTORED states,
conservative abort/recovery and no replay after deletion begins. Its clean gate
requires an independently established private reference lifetime and no other
ordinary process. Tests inject this condition to examine the filesystem state
machine. **It is not reachable through the public clean endpoint, not a live
proof, and not a deployable solution for the synchronous Node controller.**

Before live clean is implemented and accepted, the solution still needs a
broker-created trusted ordinary worker, protected resource exposure from
allocation through closeout, and a verified boundary excluding transferred,
queued and future references. The current shared Codespace does not establish
that boundary. Installing observation capabilities alone cannot complete E2E.

## Exact read-only deployment admission

This publication is not permission to install the component. After independent
operator approval of the exact source SHA/diff, an administrator may prepare:

1. A root-owned non-writable module directory such as
   `/opt/profitia-cleanup-inspector/<module-sha256>/`, containing the exact Python
   source. Never execute the privileged broker from a user-writable checkout.
2. A root-owned descriptor and socket directory (for example under `/run`), with
   a root-owned regular `.deployment-anchor`; the socket is root:executionGid
   0660. All ancestors are root-controlled and non-symlinked.
3. A dedicated root-owned 0700 guard direct child of `/workspaces`, pinned by
   exact dev/inode, outside source/scope. Public inspection only uses its broker
   lock and journal-state check; it never seals or removes candidate data.
4. A task-bounded fixed-code process at UID0, execution GID, exactly the two
   read-only capabilities above and no-new-privileges, with the same observation
   PID/user/mount namespaces as the client. No general interpreter capability
   grant, agent privilege, global daemon or automatic startup is permitted.

Descriptor fields are `schemaVersion:"1.0"`,
`protocol:"PROFITIA_CLEANUP_INSPECTOR_V1"`, `repository:"profitia/SG-dev"`, exact
`projectKey`, `taskId`, nonzero `executionUid`, `executionGid`, canonical
`sourceRoot`, separate `scopeRoot`, `modulePath`, `moduleSha256`, `pythonPath`
(resolve its symlink to the root-owned regular executable), `socketPath`,
`guardRoot`, `guardIdentity:{dev,ino}`, `maxEntries`, `maxBytes`, and exact
`resources:[{path,dev,ino,allocationId,markerSha256}]`. Deployment paths must be
root-owned, non-writable by ordinary users, canonical and non-symlinked. There
must be no wildcard resource admission. A descriptor is not an isolation proof.

Only after this read-only admission may an administrator launch
`<trusted-python> -I <trusted-module> serve --descriptor <root-policy>`. Current
Codespace lacks SYS_PTRACE in its capability bounding set; it cannot be acquired
merely by starting a normal child or changing a JSON file. Any container/runtime
change requires separate admission, with protection for all active sessions.

Rollback for an admitted observation-only deployment: remove the opt-in field
from the owning task's configuration; the original engine retains its original
fail-closed behavior. Stop only the task-bound broker after checking its exact
PID/start-time. Revoke only its newly granted admission; preserve all journals,
nonempty guards and recovery input. Remove a stale socket only after proving no
broker owns it. Never remove old assets or change shared mounts/processes.

## Tests and bounds

Run the entire unfiltered Linux suite:

```bash
node --check scripts/governance/codespace-cleanup.mjs
node --check scripts/governance/codespace-cleanup-lifecycle.mjs
python3 -c 'import ast,pathlib; ast.parse(pathlib.Path("scripts/governance/codespace-cleanup-inspector.py").read_text())'
node --test scripts/governance/codespace-cleanup.test.mjs scripts/governance/codespace-cleanup-lifecycle.test.mjs scripts/governance/codespace-cleanup-inspector.test.mjs
```

Tests use their own temporary resources. Real Unix peer credentials, FD passing,
nondumpability, synthetic full process/thread state, source-byte binding,
recovery, closed continuity and unconditional public clean refusal are covered.
The injected transaction tests are not privileged runtime acceptance. An actual
workspace-disk CLEANED remains required; passing tests or safe retention do not
satisfy that business result.

Limits fail closed: 32 admitted resources, 10,000 entries/64 MiB per tree, 4,096
processes/16,384 threads/30,000 path/FD observations, 2 MB messages or mapping
text, 60-second connection timeout, 64 requests and 300-second idle timeout.
The module has no privilege installer and starts no global automation.
