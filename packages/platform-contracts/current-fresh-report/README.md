# Optional current FRESH report 1.1 candidate

Exact peer: `@profitia/platform-contracts@1.32.3`. Default behavior retains H2 on
every probe, including MISS. No existing host, SQL policy or consumer is changed.

Explicit `probeReadOnly: {statements: [...]}` adoption separates an effect-free
probe from the `ready(value, context, transaction)` action. The producer supplies
resource/probe/projection callbacks only a frozen query port for exact reviewed
single SELECT statements. PostgreSQL READ ONLY inside a private savepoint blocks
business writes, including SELECT functions that write or advance sequences.
The savepoint is rolled back and released before canonical OUTCOME/audit COMMIT.
A failed or swallowed port error fails closed. The genuine MISS envelope has no
value and cannot execute the READY writer. READY effects run before fresh H2;
revocation at H2 rolls them back. Resources are checked again before OUTCOME.

Only this opt-in MISS defers H2 to mandatory current H3 before Root COMMIT and any
Work/Source. Final disclosure retains H4; ordinary native Work and Source checks,
current SQL authority locks, INTENT/OUTCOME and expiry/abort boundaries remain.
The host instance and its ports belong to one request and cannot be reused.

Trust boundary: application adapters and the transaction driver remain reviewed
server code. They must use the supplied ports, enforce the canonical timeout and
have no alternate connection, raw client, provider/global side effect or captured
writer in the probe closure. This library cannot sandbox arbitrary JavaScript.
Review the exact statement bodies and called SQL functions as part of receiver
adoption. Never substitute a caller-controlled allowlist or a forged MISS flag.

This changes the optional contract and fingerprint. Separate producer proof,
exact controlled-CI admission, SOURCE_GO and consumer adoption/replay are required
before release. Earlier pinned CI exceptions do not admit these new blobs.
No live timing improvement or six-second FRESH threshold is claimed. The mode
removes one human session/account pair but adds read-only savepoint SQL; measure
the complete real flow after an independently authorized receiver release.
