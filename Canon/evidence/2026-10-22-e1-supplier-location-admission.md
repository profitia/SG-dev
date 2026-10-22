# P1 — E1 supplier-location CREATE admission and rolling24h source candidate

Observed: 2026-10-22T10:36:53Z. Project ARCHITECTURE; Development target; execution LOCAL on macOS,
Node24.15.0/PostgreSQL16.14. Scope SOURCE_ONLY. This is implemented producer source,
not another analysis package and not an installed feature. Final promotion is blocked
until separately owned consumer/CI source acceptance. No source PR merge is authorised.

Task: `ARCHITECTURE-E1-SUPPLIER-LOCATION-ADMISSION-20261022`.
PMOS registration: `cmvjd3g7q00004pac2xnd37uw`; host chat
`01a133ad-8739-7a21-ac6e-36f0a9bf8ed5`; derived conversation
`pmos-task-v2:cdd40261cadc4548ce9fb3c85a488bda10a1d8fc8e1129e2966778e49116c6be`.
Continuity uses architecture_pmos in billowing-credit-07394675,
ep-solitary-unit-b9b3imd3, ordinary architecture_pmos_runtime; never srm_pmos.

## Authority and preserved continuity

Direct user task attachment595c0527-90f6-43ba-b342-05c589c8caa8 has SHA256
`703e3f561d00a5554eac1e8d219b2dbbc8fbc83f16f87f12f63349e09d1d1f40`.
Extracted P1 prompt from PR602 was verified against
`3410eb503ac55ced6f1bcd5c3066207e36dbbb29b3b61e90ba205b5c8158d0f4`.
No duplicate P1 registration was found in scoped Architecture PMOS/GitHub before begin.

The user's exact documentation acceptance promoted PR602 under SRM governance:
head3742b30907621f4432bc98e1410720153fdb27b1, merge
`1922aab9788ccd191da8a2c517cae9f48ef78ed8`,2026-10-22T09:43:01Z, exactly2evidence files.
An initial automatic-review rejection was resolved by reading the direct owner
attachment's exact promotion clause; the normal expected-head merge then succeeded,
without admin/protection bypass. Architecture did not edit those SRM records.
The SRM coordinator `SRM-SUPPLIER-LOCATIONS-TASK02-R-20261022` remains OPEN/RUNNING;
its final PHR is outside this task.

Own isolated branch: architecture/supplier-location-admission-20261022, based on
fresh authority main1922aab9788ccd191da8a2c517cae9f48ef78ed8. Dedicated source checkout, dependencies, local
PMOS/context and PHR clone; no existing working tree was reset. All20closed candidate
paths were declared; CORE/ARCHITECTURE33documents loaded, no covering nested AGENTS.
Manifest and full preflight/require-begin PASS. Initial missing local PMOS context
was rebuilt canonically before begin; no source edit occurred while blocked.
No profile switch was used to edit another product.

## Implemented source and versions

Package1.25.0 exposes `profitia.supplier-location-admission@1.0.0`.
Legacy default Root candidate16/host1.11 descriptors and FIXED behavior stay intact.
Explicit SQL020 `locationAdmission` selects Root candidate17/host1.12 in the SAME
engine/host/Access Store/ledger. It is not a copied permissions or quota runtime.
Existing consumer source fingerprints must still be explicitly refreshed.

| Fingerprint | SHA256 |
|---|---|
| Root source (default16 plus explicit P1 capability) | `567f8f29e1812ca8ab3c104a72dc17a76e59b54e0e6021678c640d0bdc198cfb` |
| Private host source | `7994d078e24182d024be9150a6e8fac5f80be63de125c73a78f4e13c0ca71351` |
| Request ledger source | `5ba7ab739fae5057e6439088978b5ed83064316267667c96fac3108ef280c414` |
| New SQL020 | `90ac1d28103f689edc8d11979210ce83cd6218e9f3549f37150fd307d165e9cc` |
| Immutable SQL019 | `34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5` |
| Immutable SRM SQL013 | `b3f05a4c56f32bd32c0c59dcc8b60c486d4d4813823665301ce08318f793704b` |

All SQL001–019 files and SQL013 were byte-compared to the authority base and are
unchanged. No receiver file, workflow or CI trust rule was modified. Final source
HEAD/PR/CI references are supplied by GitHub and canonical closeout, avoiding a
self-referential commit/hash claim in this candidate.

## CREATE admission and data boundaries

The existing operation supplier.location.write requires an exact parent collection
ALLOW for CREATE, never resource_id=NULL. A parent or child DENY wins. The producer
recomputes a stable UUIDv8 from the authenticated org/user/supplier/application and
retry key; rotating the proof key does not rename the child. A caller cannot choose
an arbitrary different child. The receiving server supplies a current locked parent
projection in the same transaction. Parent ownership means the organisation's
supplier relationship/map, not exclusive ownership of shared KRS company knowledge.

A private server key, separate from database credentials, signs the actual CREATE/
UPDATE/DEACTIVATE/SYNC action, actor/org, command-payload digest, parent and child
versions, full accepted location/source evidence, physical receiver, schema,
transaction and <=5second DB deadline. SQL checks it against controlled receiver
configuration. No client GUC, subject header or parent flag can substitute it.
The key is never returned in metadata, audit or API data. The migration creates no
key or enabled receiver; keys in tests are synthetic, local and discarded.

UPDATE/DEACTIVATE still need exact-child rights/CAS; CREATE gives no implicit edit
right or automatic grant. Membership, product, module, source retention and
revocation remain E1 checks. Organisation ownership is unchanged; author/editor is
provenance and never a creator-only read filter. Manual domain rows remain
ORGANISATION_PRIVATE. New envelope/accepted-clock fields are existing-ledger
OPERATION_AUDIT metadata with no raw address/label/command body. Receiver attestation
configuration is restricted access material owned by Architecture, not product data.

## Rolling semantics and concurrency

SQL020 adds opt-in quota_mode to existing policies and immutable accepted_at to
existing intents. No second quota table or SRM limiter exists. Each WRITE/SYNC has
100accepted operations over `(DB-now-24h,DB-now]`; the two budgets are independent.
A stable transaction advisory lock covers physical environment/org/operation across
all applications, users and replaceable policy IDs. READ COMMITTED is mandatory for
this optional mode; stale repeatable snapshots fail closed. The acceptance trigger
rechecks the moving count and stamps the RESERVED→ACCEPTED transition in the same
transaction as effect/audit; rollback leaves no committed unit. This is acceptance-
transition time for an ultimately committed operation, not reservation/response time.

The BIGINT lifetime accepted_count is preserved without enforcing lifetime<=100 on
rolling policies. FIXED retains its original cap and reserve/accept behavior. Old
accepted rows with unknown acceptance time block opt-in; no historical timestamp is
invented, history removed or quota refunded. Replacement or FIXED downgrade cannot
reset an established rolling budget. A lawful replay consumes no extra unit; changed
payload conflicts. A stable source-version retry replays, while a newly admitted
source-version SYNC counts once even with no physical domain delta. The receiver
must retain its stable retry key/current source projection.

Current direct request admission remains HUMAN-only. Existing delegated workers
remain SERVICE with original subject provenance and the original accepted unit;
P1 adds no SERVICE impersonation/request grant. Cross-application budget isolation
was tested on two real foreground connections/applications and different users;
existing delegated-service regressions ran in the full producer/lab suite.

## Actual validation

- Build PASS; all declaration/type fixtures included in producer tests PASS.
- Full producer+Architecture laboratory against disposable loopback PostgreSQL16:
  **1342/1342PASS,0FAIL,0SKIP**; no live Neon/provider connection.
- New P1 integration subset: **34/34PASS**, actual ordinary roles/real connections.
- Tests cover exact parent CREATE, foreign org/supplier/child denial, NULL denial,
  old/missing descriptor, wrong parent, exact-child update/deactivation/CAS,
  membership/product/module/identity revocation, child DENY, no raw DML/key read,
  forged GUC, cross-transaction/role proof replay,5second expiry, actual OUTCOME
  audit/output/business rollback,100/101 WRITE and SYNC across users/apps,
  same-key concurrency, policy rotation/downgrade, exact microsecond24h boundary,
  aged-out101st lifetime operation, old reservation/new acceptance, unknown history,
  stable/new source versions, and legacy FIXED behavior.
- SQL020 application and rollback-to-savepoint were exercised before installation
  in the disposable fixture; no partial admission relation survived rollback.
- Basic Development contract consumers: SG2 **2/2PASS**, SRM **2/2PASS**.
- Full independent governance/controlled-source suite: **98/100PASS,2FAIL**.
  Both failures are publication gates: LOCAL_PACKAGE_VERSION_MISMATCH (SG2 lock
  still1.24.0) and current accepted SDK provenance still9fe1ee... while P1 is567f8f....
  They were not silenced by changing an acceptance file/test/allowlist.
- An attempted local full receiver-operation run could not load the uninstalled
  product dependency; it is NOT a compatibility/UAT proof. Static manifest reads
  independently show both consumers still pin the previous Root fingerprint.
- Full preflight remains PASS; this is distinct from the failed publication suite.
  Exact-head remote CI is recorded separately in PR/PHR after publication.

Test log SHA256 receipts (local scratch paths are not runtime resources):

```json
{
  "/private/tmp/p1-full-postgres-ci.log": "806ef98c84741e4724cf79eab54227fb028969ffee96cc6892f2b474342eed11",
  "/private/tmp/p1-governance-tests.log": "ac4ed17d3f19ae7498ecbdb4e6bf0f051e4114a029feb89c1f01eb4196e61d8a",
  "/private/tmp/p1-sg2-consumer.log": "4bb1656fce330321b07b2bb23c50ca13c66c88331010246105f1c0e559581cbe",
  "/private/tmp/p1-srm-consumer.log": "3d5c9bf10f896297e238e2356b85beb629f309c07af96cb10187ef636503ac85",
  "/private/tmp/p1-build.log": "6671b065188725881617c82d624f7d3eb645e3fd289c3dd301ce2921e88d85f4"
}
```

## Live safety readback

Metadata-only ordinary-role read of spring-bread-28217539 /
br-sparkling-term-b99l107x / ep-late-heart-b9mxo8oi / platform_private returned
sql019=NULL,sql020=NULL,sql013=NULL. No protected R2 content was read.
Render read-only deployment inventory:

| Runtime | Current deployment | Source |
|---|---|---|
| SRM | dep-dbbnb22fngtc73bn0i90 | 260ade12608faaea27376c1c976db392f046f267 |
| Maps | dep-dbati9rrjlhs73akpsj0 | db2df0a6cccb994ea4654ae0eb5b3af4b46867ff |
| Identity baseline HEALTH_ONLY | dep-dbcse73rjlhs73eib57g | aa95c0a0a14fb2f2ba5af7338c8d83a6fb349269 |
| SG2 runtime | dep-dbbpblom7kps73dj51mg | f03968d474a937cfe5badcc192e1bc81781bcb91 |
| SG2 dashboard | dep-dbbr34rncjis738t5phg | 873d4655bed828b401f3b480b08cc40d46c6c8ff |

SG2 deployment IDs differ from older topology narratives; actual provider readback
above is authoritative and predates P1. No deployment, config, grant, policy,
identity, snapshot, recovery branch, Finalize Restore or connection change was made
by P1. Identity's previous owner HEALTH_ONLY acceptance is baseline evidence; P1
did not repeat live login/config acceptance. No new paid Google/provider effect,
Staging or Production mutation. Only local test databases/roles were created and
cleaned; this is not live SQL installation. Main only received the separately
accepted SRM documentation PR602, not P1 source.

## Exact handoff to SRM TASK02-R and reserved owner actions

1. Review this bounded Architecture candidate/actual HEAD and separate immutable
   Architecture PMOS/PHR receipt; no P1 source merge is authorised by this task.
2. SG2 owner separately adopts producer1.25/current fingerprints in its consumer
   receipt and local package lock, preserving current features/default descriptors.
   No new supplier feature is required in SG2.
3. Governance owner separately accepts current source provenance and any necessary
   explicit P1 optional-capability treatment in trusted CI. Keep all actor/repo/SHA,
   eight-file legacy provenance/credential boundaries; do not bypass the two failures.
4. SRM owner separately registers consumer adoption tied back to TASK02-R; no new
   TASK03/project is opened here. Exact candidate paths include
   apps/srm/operation-integration.json,apps/srm/package-lock.json,
   apps/srm/src/server/supplier-locations.ts, supplier-location-store.ts,
   supplier-location-sync.ts and their actual affected tests. Recheck routing/new
   paths before edit. Maps acceptance/lock/test changes stay under SRM authority.
5. Compose the new optional locationAdmission port in the existing private host;
   allocate the child using the VERIFIED internal user/org and stable key. Supply
   an actual current locked parent projection, source/version and domain CAS through
   bounded SRM SQL APIs. First evaluate existing READ location_metadata; it already
   verifies srm.suppliers organisation membership. Prove parent locking/recheck and
   avoid the old child-WRITE-before-proof circularity. If an additional receiver
   port is necessary, use separately approved additive SRM migration, not edits to
   immutable013 or broad table grants. No producer code hardcodes SRM tables/IDs.
6. Record SQL020 digest separately from unchanged SQL019 and SQL013. Future approved
   sequence: exact019→020→receiver schema/adoption→disabled configuration/precise APIs
   and policies→independent activation. Source-only does not approve this sequence's
   execution. SQL020 requires apps disabled and preinstalled HMAC; refresh actual
   LKG/artifact/config/schema/recovery and Source in-flight proofs before W1.
7. An operator must provision accepted server attestation configuration/secure key
   delivery under separate authority. Only descriptor/bind/admission_policy plus
   previously approved E1 ports are candidate runtime EXECUTEs; internal aggregate,
   quota-lock/trigger helpers and config tables are not runtime grants.
8. Later child UPDATE/DEACTIVATE needs explicit controlled exact-child grant
   lifecycle; no automatic resource=NULL or creator-based privilege. Genuine I1/U1,
   K1/fence or retention operator, R2 and W1 approvals remain independent.
9. After both consumer/CI gates are properly accepted, rerun exact-head producer,
   controlled CI and receiver tests/types/build, then request exact-source acceptance
   and normal protected merge. Do not represent4basic tests as full new adoption.
10. TASK02-R remains PARTIAL/RUNNING; no final SRM PHR here. Architecture closeout
    reports actual producer completion and unresolved publication gates truthfully.

Current conclusion: P1 CREATE and rolling24h are IMPLEMENTED and locally validated.
Canonical source publication/adoption is PARTIAL, not release GO. The source PR must
remain Draft/unmerged while the independent gates above are unresolved.
