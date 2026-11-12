# Stage I — preserve registration and accepted ECR weeks in the same67 sources

Status: PROPOSED / EXACT OWNER DECISION REQUIRED. Inert review packet only.
Task ARCH-REGISTRATION-ECR-WEEK-RECONCILIATION-PROPOSAL-20261111.

## Why this successor is necessary

The owner approved1026 frozen249eec42. That exact B5 source5fd7b833 passed
68/68 focused cases,2089/2089 producer cases with isolatedPG16,401/401 native
Identity cases and Identity typecheck/build/lint. These are real results for that
earlier653 baseline, not results for this new composition.

The later independently accepted ECR week source main38a9fe37 modifies two of
the same proof files: the shared recurring guard and SG2 PCI source-coverage test.
Overwriting either with the old B5 blob would discard accepted parallel work.
The strict existing SDK and ECR proofs each require their own authenticated
current graph. Merely merging text, changing an expected digest, substituting
a reader, catching failures or skipping a guard does not establish both graphs.

The original1026 decision remains valid for its frozen B5 source. This proposal
is a precise additional source/version decision, not a request to repeat it.

## Proposed composition and boundaries

Preserve the complete physical SDK/receiver graph and every actual immutable
producer before exposing a predecessor. For this one exact new record only,
also authenticate the exact ECR receipt31ce8f1d, its current source graph and
all12 unchanged current/immutable receipts. Then two explicitly pinned source-
proof paths return their actual immutable38a9 ECR versions; other SDK predecessor
paths still return0775. This is a closed two-path composition, never a caller-
supplied or general replacement reader.

The recurring guard applies the validated SDK frame first, then the accepted
ECR frame, then the already accepted recurring frame. The SG2 source-coverage
test retains both additive bindings and the newest exact SDK hashes.
All production ECR code and the exact ECR receipt are retained byte-for-byte;
only the two overlapping proof files receive the described combined versions.

The data record changes only three hash entries: shared guard, its regression
test and SG2 PCI scope test. Its schema, all165 SDK production bytes,48 SDK and
3 optional fingerprints,21 actual historical guards,13 supplemental pins,
receipts, defaultRoot16 and optional21/22 remain unchanged. No runtime operation,
identity/grant/licence, schema, budget, provider or deployment is added.

## Exact scope

Same67 paths/statuses/modes/owners:36 Architecture,17 SG2,14 SRM.
61 B5 source blobs are identical. Six replacements:

| Source path | Approved B5 Git blob | Proposed Git blob |
|---|---|---|
| apps/architecture-lab/private-recurring-source.mjs | 7f58fb9f40c136a79152455642ad339dfa5d057c | 47377ce94aa52e9687b5cf356049548f79d1bbd7 |
| apps/architecture-lab/test/private-recurring-source.test.mjs | 8572ef047e09e2a3bed536c00d7fb0c9f54a0aa8 | 7d6c623052e74c3e4e22a5ba82b24a0a17e15319 |
| apps/sg-runtime/tests/pci-smart-integrity.test.mjs | 67a4d7c372dad41e70db60fab3cf362298195c35 | 4a8aae88bbcb068b1ffaa831b95647def563c65d |
| packages/platform-contracts/test/organisation-sdk-compatibility.json | 12e90a641f7c7dde6efa0be9be3d7e41eae27fb4 | 7ddcac2570422cade9b724601579018e1783b583 |
| packages/platform-contracts/test/organisation-sdk-compatibility.mjs | e8443e149ea2e7d09bbb2e21b3e8eab88dad8fd9 | 49a2199251dba0a4cafe09e588c0aa8d3bd80aa3 |
| packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs | b8c80258bb25722ae33d963343f3beaa8ffe7d8b | ea26f536012e19cdbe5c44f03e73bb39726efda9 |

Prepared unpublished source: b9779781e06e239535a0fe2883fe37ca569fdfd2
Tree: 1d603dee57bd3e5c24f2da65bb8cbe69d6f62cf7
Source base: 38a9fe371e7993b47e2358d297647086ea999428
New recordSHA256: b0b9ceb1799499cb2088ed8be523d6c1758573995e65ca53693b15eeaeafe698
Exact67 entry-mapSHA256: 4086004f71548683f31510656a2b1ad54a628e4bc1ab9dbd5cb7297515314106
Trusted-policy patchSHA256: a176cf99b8eca801cc6d668ed011a70010a0b145b59452b019f55dc7f1c39add
Trusted-policy patch base: 413b00163f47fe7fd613fd86d63fb79a625e8137
Patch format: full Git blob identities with zero context; apply using git apply --3way --unidiff-zero. The original blob identities remain mandatory.

The source commit retains current ECR main and the actual B5 source ancestry.
Neither it nor a common executable aggregate has been published or admitted.
Original transport PR983 source head remains unchanged.

## Additional checks described in the proposal

Keep all old assertions and negative cases. Add actual immutable B5 regression,
positive SDK+ECR direct/layered agreement, current ECR tampering and forged
immutable guard-history rejection. The trusted controller retains the full
B5 and FFE67 maps, both65 maps and every older review; its physical fixtures cover
all three67 graphs and both65 graphs, plus missing/tampered ECR and mixed/native/
recurring drift. All14 prior ECR/Market Calendar tests remain text-identical.

The controller authenticates all67 current physical files/modes and the complete
SDK record before its bounded ECR canonical view. The existing strict ECR record
validator still authenticates the ECR graph and12 receipts. A C-frame cannot omit
the ECR record. Credentials, private pins, main-only Environment, ignore-scripts,
token removal, actual owners, complete-diff and exact-head/race fences remain.

## Evidence available before the decision

Static syntax checks only for the proposed code; Git hashes/modes/trees, exact
six-file difference, three data-hash changes,165 actual immutable producer files,
12 receipt hashes against both0775 and ECR base, unchanged ECR production source
and receipt, and unchanged14 ECR/Market Calendar test bodies. Static dependency
ordering was checked and corrected without evaluating the new module.

No new strict helper, controller, test or record was imported/evaluated/executed.
The proposed regressions and full combined source remain UNEXECUTED until this
separate exact decision. Syntax and static data checks are not a CI or runtime
acceptance claim.

## After approval

Apply only this frozen source/policy with ordinary current-main preservation.
Require fresh registered producer and actual SG2/SRM owner scopes; all helper,
shared-guard, historical, full producer/PG16/Identity and consumer checks; exact
protected/public/governance and entire resulting-main CI; actual SOURCE GO
under the existing coordinated983 procedure. Record canonical PMOS/PHR.
No producer-first merge or unknown changed graph is allowed.

Policy1032 for the already approved B5 graph is independent: its exact protected
run43111924532 passed1509 tests,0 failures/skips, types/build; artifact13897745715
and actual control digest were independently verified. It was merged983f45a4
after public/governance/fresh registered gates; resulting-main checks remain
their own obligation. Prior1024 policy is canonically complete with PHR8867ce2f.
Neither means StageI or product onboarding is deployed.

## Frozen material

[Exact source review/data/texts](../proposals/registration-ecr-week-reconciliation-20261111/source-review.json),
[helper text](../proposals/registration-ecr-week-reconciliation-20261111/organisation-sdk-compatibility.mjs.txt),
[helper test text](../proposals/registration-ecr-week-reconciliation-20261111/organisation-sdk-compatibility.test.mjs.txt),
[trusted-policy patch](../proposals/registration-ecr-week-reconciliation-20261111/controller-amendment.patch).

All durable evidence GitHub plus canonical Architecture PMOS/PHR. Existing
remote environment only, no laptop artifacts. No productSQL/data/roles/grants/
packages/mail/provider/model/DNS/activation/deployment. Full StageI remains open.
