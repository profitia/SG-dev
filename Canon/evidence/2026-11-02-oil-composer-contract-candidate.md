# Oil Composer producer — preparation evidence

Status: SOURCE_CANDIDATE_ONLY / NOT_ACTIVE / NO_INSTALLATION.
Task `ARCH-OIL-COMPOSER-CONTRACT-PREP-20261102`, profile ARCHITECTURE,
workspace SG-dev Architecture, execution local, target development.

The owner separately approved the two new PMOS begin inputs in packet
`4749acee5fa4c71119f24986b46ab269ae6271c20fcc33a18e3518cb845654cb`.
Own begin readback: `cmvzk7blc00009q79ir890mbh`, status running;
require-begin preflight passed. This is not a closeout or permission to persist
the previous audit. No MEMOROS/PHR or closeout was authorized/executed.

Exact D1/D2 attachment bytes, conditions and the complete candidate specification
are retained in separate documentation Draft PR #868, SHA
`8637a6fa905b7c1e1c1c6a3942b0a335d6b6792b`, under
`Canon/proposals/oil-market-outlook/`. That PR is not merged or active.
This source-only partition preserves the trusted CI allowlist. The contract describes
the proposed human E1 operation, separate Source service controls, optional
request-ID projection, atomic single-attempt USD hold and protected usage
estimate. No active matrix or grant is changed. SQL028 remains unapplied.

Local SQL acceptance uses actual SQL008/009/012/028 and Source hosts in a
disposable loopback PostgreSQL 16. Provider I/O is replaced by a controlled
synthetic fetch with a synthetic credential, never a real OpenAI call. It checks
owner/rollback, missing policy, input-token denial, concurrency, response IDs,
usage immutability, NULL rejection, ordinary-role denial, revoked Source and
UNVERIFIED hold retention. A deferred SQL constraint also prevents legacy
base-control bypass without the model hold, including under a synthetic extra
EXECUTE grant; a normal non-model policy remains usable. The model role must
not have direct base-control EXECUTE, and a disabled/missing coupling trigger
closes the model descriptor. This does not certify a live human E1 adoption,
real key/project, exact provider tokenization or live billing.

The final local evidence index and exact source SHA are supplied in the handoff
beside the Draft PR. GitHub CI is a separate observation; no future PASS is
claimed here. Required shared consumer adoption, exact-head CI, candidate
acceptance, controlled release, LKG/rollback and final one-attempt GO remain
gates. Source preparation does not constitute release or publication approval.
