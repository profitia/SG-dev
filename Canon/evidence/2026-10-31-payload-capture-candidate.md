# Optional finite immutable payload capture candidate

Task: ARCHITECTURE-IMMUTABLE-PAYLOAD-CAPTURE-20261031.
Status: LOCAL_CANDIDATE_VERIFIED; SOURCE_GO_NOT_GRANTED.
Target Development; execution local; producer ARCHITECTURE.

## Public data-only contract

@profitia/platform-payload-capture1.0.0 exports captureFinitePayload and its
DATA_ONLY contract. Its exact peer is the unchanged SDK1.32.3. It has no second
SDK, runtime, database, credentials, network, actor, tenant authorization, Source
admission or audit writer. It calls the existing public operationPayloadDigest;
the canonicalization/hash algorithm is not copied or changed.

The helper copies, normalizes, bounds and deeply freezes plain finite JSON data
in one traversal, then obtains the canonical digest from the existing SDK.
Undefined object fields are omitted; undefined/sparse array entries become null;
signed zero becomes zero. Null-prototype dictionaries become inert ordinary JSON
objects, including an own __proto__ data property. The original input is neither
frozen nor retained as an index key. Repeated aliases are copied as JSON values.

The weak data index recognizes only the module's own deeply immutable snapshots.
It can return the same capture without repeating copy/hash. A mutable original,
serialized copy or foreign frozen root is never treated as one of those snapshots.
Stricter byte/depth/node bounds still apply to a reused capture. This index stores
only captured data metadata; it is never a cached ALLOW, session or classification.

Default limits are32MiB, depth128 and1,000,000 nodes. The API permits explicit
bounded limits up to32MiB, depth512 and2,000,000 nodes. Array length is checked
against the remaining node budget before allocation. Limits and errors never
include raw input. Accessors/toJSON hooks, function/symbol values, non-finite
numbers, BigInt, custom prototypes, dates/collections/typed arrays and cycles are
rejected. This is deliberately narrower than arbitrary JavaScript serialization;
it must not be silently substituted for an adapter that accepts such objects.

## Verification

- 22/22 tests PASS, zero skips; syntax build PASS.
- 4000 deterministic generated cases check accepted normalized values against
  the unchanged SDK digest and JSON byte length, with undefined roots refused.
- Negative tests cover mutation, foreign frozen roots, stale mutable originals,
  aliases, accessors without invocation, prototype-named data, Unicode/unpaired
  surrogates, non-finite/unsupported values, cycles and stricter reuse limits.
- Packed ESM/CommonJS imports and strict readonly public types PASS. The packed
  helper and caller resolve operation-context to the same SDK module path. Peer
  acceptance is exactly1.32.3 and the helper has no SDK dependency of its own.

All accepted SDK and application files remain unchanged. No product regression
or live adoption is claimed from these producer tests.

## Local CPU comparison and its limits

The receiver supplied a previously retrieved, sanitized retained Financial graph.
The measured input file is607035 bytes; normalized data is607034 bytes,8685 nodes,
depth8. Its SHA256 is recorded in the laboratory receipt. URLs/secrets had already
been sanitized by the receiver. The file is not an original provider response,
not a full mapped MgbiFinancialResult and not a new live FRESH request. It was
read locally only and is not committed or copied into PMOS/PHR.

The reference is the current SRM copy path: finite-number JSON.stringify,
JSON.parse, canonical operationPayloadDigest and deep freeze. Two warmup pairs
precede11 alternating measurements of each implementation. The mutable input is
never the reusable snapshot key, so these are first-capture comparisons.

Final local medians: reference11.600583ms, helper9.403458ms. The normalized bytes
and canonical digests match exactly. Separately,1000 repeated captures of an
already owned immutable snapshot take0.628459ms in that run. These are CPU-only
observations under local load, not guaranteed timings, production latency or
proof that the previously observed383.788ms FRESH span has been reduced.
No paid acquisition, database or browser call occurs in this benchmark.

## Exact consumer and publication boundary

The package can be adopted independently of the separate Source checkpoint
candidate. It works with one current SDK1.32.3, so neither the SDK nor the exact
current-fresh-report1.0.0 peer needs upgrading for this pure-data path. Running
SG2 and its receipts/installations need no automatic change.

Formal SOURCE_GO and exact-candidate CI/publication remain pending. The receiver
must use a separate SRM adoption task, add the reviewed optional package/lock
entry, and replace only the approved json capture adapter in
src/server/supplier-native-work-store.ts. Existing input-size checks, actor,
request/work manifest digests, Source/RLS/revocation/audit/COMMIT and returned
business values remain mandatory. Its existing capturedDigests map can record
the returned immutable value and digest; no local canonicalization algorithm is
needed. Raw operation manifests must continue to use the exact original digest.

The consumer must verify its complete mapped Financial input, unsupported-value
assumptions, current receipt/application hashes and actual business regressions.
Producer raw-graph timing is not consumer acceptance. No SRM source, package lock,
receipt, service configuration or deployment has been changed by this task.

The separate Source descriptor/lock1.33 patch is still a different producer path,
with its own SDK/peer/consumer gates. This helper does not implement that SQL
checkpoint or grant its adoption.

Only producer code, tests, aggregate/hash evidence and canonical ARCHITECTURE
PMOS/PHR reporting are in this task. No repository/project, package-registry
publication, push, PR, merge, migration, new role, secret or deployment occurs.
