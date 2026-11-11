# Stage I registration — complete current and historical source closure

Status: PROPOSED / exact owner decision required. Inert source/test review only.
Task: ARCH-REGISTRATION-COMPLETE-HISTORY-CLOSURE-PROPOSAL-20261111.

## Outcome and reason for this complete review

Finish joint Identity/SG2/SRM source acceptance while preserving accepted recurring
functionality and the native Identity draft API. Do not publish a source set that
fails its required historical checks.

The owner approved [PR1022](https://github.com/profitia/SG-dev/pull/1022),
frozenb76de15c929389d82d6179203c94ec57cc378cda, accepted inert-only at
18d7a66320259c566272309db67c0da56d54854e.
Its exact trusted-controller patch was applied, with212/212 controller and55/55
governance/routing/coverage cases passing, no failures/skips.
The source helper passed5/5. The approved implementation is retained as
[checkpoint0d78cf00](https://github.com/profitia/SG-dev/tree/0d78cf0068fa8aee3fb12836531a53c3d7600a79).
It is not accepted into main; protected acceptance has not been spent on a
known-incomplete source set.

The complete existing producer command ran against isolated PostgreSQL16:
1863 cases,1854 passed,9 failed,0 skipped. All observed failures concern source
history: five supplemental already-reviewed core test files were outside the
SDK predecessor mapping (two cause actual recurring368 hash mismatches), and
several older direct/filesystem callers bypass the new registration layer.
The previously narrower analysis did not cover these whole-suite callers.

Full native Identity, after its required build and correct local PostgreSQL
fixture setup:401/401 passed,0 failures/skips. Typecheck/build/lint passed.
Initial test-setup errors (missing generated dist and local PostgreSQL path)
were corrected; they are not reported as product defects.

## Final source scope:67 paths, actual owners retained

The prior65 paths remain.62 original blobs remain identical to1022; only the
data-only organisation SDK record, source-only helper and its tests change.
Add exactly these two existing Architecture source/test files to the review:

- apps/architecture-lab/private-recurring-source.mjs
- apps/architecture-lab/test/private-recurring-source.test.mjs

Ownership is36 Architecture,17 SG2,14 SRM. Every old path/status/mode/owner binding
is retained; both new paths resolve to Architecture Platform/ARCH-BASE-002.
No SG2/SRM receiver implementation is edited. Existing983 remains the future
coordinated transport; independent owner inputs/tasks remain authoritative.

All165 production SDK source bytes are unchanged and match the actual immutable
producer5a963f313317d57e1946e1d7aabd28192db9c7bd. All application runtime bytes,
48 SDK/3 optional fingerprints, receipts, defaultRoot16 and optional21/22 isolation
remain unchanged. These are source acceptance tools, not product authority.

## One shared check for every historical caller

The recurring source module first authenticates its unchanged exact recurring
record. When current receiver metadata has a registration continuation, it uses
the already shared organisation SDK helper to authenticate that complete current
graph, then performs the existing recurring368 validation on the exact admitted
predecessor view. An already-layered caller has no continuation frame and is not
projected twice. Direct and filesystem callers now use the same validation.

The helper authenticates all13 supplemental paths: the eight already-approved
Identity files and five already-approved onboarding/core test files. Each pin
matches its current bytes and actual immutable5a963 or6dd651 producer before any
historical view is exposed. It projects only the closed reviewed paths, and
new paths remain absent from their real predecessor.

The new exact source record extends the compatibility map from7 to9 files by
adding only the shared recurring module and its test. All21 previous guard hashes
remain unchanged. For precisely these two current guard versions, current bytes
must match the new compatibility pins; their actual0775 predecessor bytes must
still match the old immutable guard hashes. Old records020/25fea/ccf retain
their exact behavior and checks. No guard is silently omitted or relabelled PASS.

Tests cover direct/filesystem entry, already-layered equivalence, full67 overlay
coverage, all13 current/immutable source mutations, both old guard predecessor
mutations, immutable oldccf behavior and the original old/negative cases.
The new code remains unexecuted before the exact decision.

## Trusted CI scope

Preserve1016 full65 and1022 full65 as separate complete reviews, in addition to
all earlier41/48/59/1012 and recurring119/123/124 admissions. Add only the exact
67-entry map below. Select every path/blob/status/mode, not a count alone.

The trusted checker knows the new exact record hash. It validates current bytes,
including both explicitly versioned guards, and independently checks all21 actual
historical guard bytes. Only then may the closed known physical overlay project
to the unchanged368 recurring record. Pure metadata and real filesystem tests
cover the new67 and both old65 complete maps, mixed versions, native tampering,
recurring-only tampering, forged records and wrong guard versions.

Full-diff, real owner/routing, repository/actor/fork/head, regular-file, main-only
Environment, private package pins, read-only credential, ignore-scripts installation,
credential removal before candidate execution and exact-source proof fences remain.
No generic path, package, credential or runtime permission is added.

## Frozen material and static evidence

[Complete review and source data](../proposals/registration-complete-history-closure-20261111/source-review.json),
[helper text](../proposals/registration-complete-history-closure-20261111/organisation-sdk-compatibility.mjs.txt),
[helper test text](../proposals/registration-complete-history-closure-20261111/organisation-sdk-compatibility.test.mjs.txt),
[trusted-controller patch](../proposals/registration-complete-history-closure-20261111/controller-amendment.patch).

The review JSON contains the exact new source record and full additional source
texts. Record bytes are JSON.stringify(sourceRecord,null,2) followed by one newline.
Additional source text is exact UTF-8. All are bound to the Git blobs below.

Prepared source 09cf78d48c85986e4973f13007e32638bf040a2f; tree 6e22af85ac2a105c4225359fe14f379650e58acf; base 18d7a66320259c566272309db67c0da56d54854e.

Exact entry-map SHA256 a12c2d65fc11145654bcd49c74cef6cfe6d84905fac70a4b22b4e2cecba73e26.
New exact source record SHA256 ffe2065f84e7a9808a74f896170588b9ff5fc66973096a15a407a7cbf006808d.
Trusted-controller patch SHA256 35a46e4d693d651f51a232fe0d71122308907d814542166e02232a1e0968d787.

- packages/platform-contracts/test/organisation-sdk-compatibility.json: Git blob 297dfdd726c9a02c3ff454835fa29e4610d55fce; SHA256 ffe2065f84e7a9808a74f896170588b9ff5fc66973096a15a407a7cbf006808d.
- apps/architecture-lab/private-recurring-source.mjs: Git blob 7f58fb9f40c136a79152455642ad339dfa5d057c; SHA256 ad0aa73142c9fa6f7f672bc2eddcec26b05b1e103bc7197beae1628bc19a768e.
- apps/architecture-lab/test/private-recurring-source.test.mjs: Git blob 8572ef047e09e2a3bed536c00d7fb0c9f54a0aa8; SHA256 3007ae603e789b53ca2a33456dcefce3746a1956ae636a7dac83f77cb14a06da.
- packages/platform-contracts/test/organisation-sdk-compatibility.mjs: Git blob 5594bdba4bc4c884abe7f2bf21ec4af84d9703e1; SHA256 4779bfba00d7dc635920481e80aeff1cad37f36d28800d88b8a5a1698b11dcb3.
- packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs: Git blob e39388d98f7e26b717f4364cbfb11c94fca1115f; SHA256 b9547e9625d5c0e2f1e05b8bb2335e3fcbde826e2459000158e740fc9d06db52.

Static checks: all67 source blobs/statuses/modes/routes;62 unchanged original blobs;
unchanged production165 and actual immutable producer; all13 supplemental producer
pins; unchanged receipt/fingerprint metadata; all21 historical guard pins; every
recurring368 path checked against its required source/predecessor hash; zero
uncovered reviewed paths or recurring deltas. Syntax-only parse of every changed
source/controller/test and patch applicability pass.

This is not an executed-helper or successful full-source acceptance claim.
No alternate reader has been run to bypass a failing strict source test.
The new helper, recurring source module and controller have not been imported,
evaluated or executed. Source objects are prepared, not published as an executable
candidate. Canon documents and PMOS/PHR contain the durable review/evidence.

## Required execution after exact acceptance

1. Apply the bounded trusted policy, preserve all predecessor reviews, and run
   old/new/negative plus protected/public/governance and resulting-main checks.
2. Materialize exactly the approved67 source versions. Run all helper/recurring/
   historical cases, the entire producer suite with PostgreSQL16, native Identity,
   actual SG2/SRM receiver suites and exact-source protected/public gates.
3. Obtain actual-owner SOURCE GO, use existing983 jointly, preserve independent
   inputs, and require resulting-main evidence before source adoption.
4. Keep Stage I product work open: full native company/invitation/package/Development
   tenant routing and UAT, canonical PORR reconciliation and governed007/008
   installation remain separate required work.

The [active integration runbook](../runbooks/shared-development-contract-integration-v1.md#stage-i-registration--recurring-reconciliation--approved1016-2026-11-11)
and the accepted1022 frozen review permit only their exact versions; this packet adds
two reviewed paths and a new exact record. A separate concrete decision is needed.
This proposal does not install product SQL, change data/roles/grants/packages,
send invitations, call providers/models, alter DNS, activate runtime or deploy.

## Exact additional shared source texts

### apps/architecture-lab/private-recurring-source.mjs

```javascript
// Source acceptance only. Never imported by an application runtime.
// The reviewed current graph is verified before any immutable predecessor is read.
import assert from 'node:assert/strict'
import {sdkContinuationPredecessor} from '../../packages/platform-contracts/test/organisation-sdk-compatibility.mjs'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
export const RECURRING_SOURCE_RECORD='apps/architecture-lab/private-recurring-source.json'
export const RECURRING_SOURCE_BASE='141cc559063c43cefa991acb9260b32ac5b92615'
const RECORD_SHA256='75877d5750e07d1c8172be0af76bc5933f2eeefc22cc39747a2621b9cab24619'
const hash=b=>createHash('sha256').update(b).digest('hex')
const absent=error=>error?.code==='ENOENT'||error?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>String(error?.stderr??error?.message??'').includes("'"+RECURRING_SOURCE_RECORD+s))
export function recurringSourcePredecessor(current,historical){
 let bytes;try{bytes=current(RECURRING_SOURCE_RECORD)}catch(error){if(absent(error))return null;throw error}
 assert.equal(hash(bytes),RECORD_SHA256,'exact reviewed recurring source record')
 // Current registration is authenticated before either historical graph is exposed.
 // An already-layered caller has no SDK frame, so it cannot be projected twice.
 const receipt=JSON.parse(current('apps/sg-runtime/operation-integration.json'))
 if(receipt.sdkSourceContinuations!==undefined){
  const sdk=sdkContinuationPredecessor(receipt,current,historical)
  assert(sdk,'reviewed registration continuation required')
  return recurringSourcePredecessor(sdk.previousBytes,historical)
 }
 const a=JSON.parse(bytes)
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.scope,'PRIVATE_RECURRING_SOURCE_ACCEPTANCE');assert.equal(a.previousSourceSha,RECURRING_SOURCE_BASE)
 assert.equal(a.platformVersion,'1.36.0');assert.equal(a.legacyImplementation,'1.0.0-candidate.16');assert.equal(a.optionalImplementation,'1.0.0-candidate.22')
 assert.deepEqual(a.taskIds,{ARCHITECTURE:'ARCH-PI-RECURRING-E1-20261111',SG2:'SG2-PI-RECURRING-E2E-20261111',SRM:'SRM-PI-RECURRING-SDK-20261111'})
 for(const flag of ['runtimeActivated','newGrantsInstalled','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 for(const[p,h]of Object.entries(a.sourceDigests))assert.equal(hash(current(p)),h,'current recurring source '+p)
 for(const[p,h]of Object.entries(a.preservedReceipts)){
  assert.equal(hash(current(p)),h,'immutable receipt '+p);assert.equal(hash(historical(RECURRING_SOURCE_BASE,p)),h,'original receipt '+p)
 }
 for(const project of ['ARCHITECTURE','SG2','SRM']){
  const file=project==='ARCHITECTURE'?'apps/architecture-lab/private-recurring-source-adoption.json':'apps/'+(project==='SG2'?'sg-runtime':'srm')+'/private-recurring-source-adoption.json'
  assert.deepEqual(JSON.parse(current(file)),{schemaVersion:'1.0.0',projectKey:project,taskId:a.taskIds[project],targetEnvironment:'development',scope:'SOURCE_ONLY_NO_RUNTIME_ACTIVATION',sourceRecord:RECURRING_SOURCE_RECORD,sourceRecordSha256:RECORD_SHA256})
 }
 const additions=new Set(a.addedPaths),mapped=new Set([...a.changedPaths,...(a.predecessorProjectionPaths??[])]),cache=new Map()
 const authorityCache=new Map(),own=new Set(a.changedPaths),ownAdded=new Set(a.recurringAddedPaths??a.addedPaths)
 return {manifest:a,authorityBytes:p=>{
  if(p===RECURRING_SOURCE_RECORD||p.endsWith('/private-recurring-source-adoption.json')||ownAdded.has(p))throw Object.assign(Error('Recurring source absent from authority predecessor'),{code:'ENOENT'})
  if(!own.has(p))return current(p)
  if(!authorityCache.has(p))authorityCache.set(p,Buffer.from(historical(a.authorityMainSha,p)))
  return Buffer.from(authorityCache.get(p))
 },previousBytes:p=>{
  if(p===RECURRING_SOURCE_RECORD||p.endsWith('/private-recurring-source-adoption.json')||additions.has(p))throw Object.assign(Error('Recurring source absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(RECURRING_SOURCE_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}

// Test/adoption convenience only; every actual source byte is authenticated.
export function recurringSourceFilesystem(root){
 const cwd=root instanceof URL?fileURLToPath(root):root
 const current=p=>fs.readFileSync(path.join(cwd,p))
 const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd})
 return recurringSourcePredecessor(current,historical)??{manifest:null,previousBytes:current}
}
```

### apps/architecture-lab/test/private-recurring-source.test.mjs

```javascript
// SYNTHETIC_ONLY. This checks source provenance, never runtime authority.
import test from 'node:test';
import {sdkContinuationPredecessor} from '../../../packages/platform-contracts/test/organisation-sdk-compatibility.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {recurringSourcePredecessor,recurringSourceFilesystem,RECURRING_SOURCE_RECORD,RECURRING_SOURCE_BASE} from '../private-recurring-source.mjs';
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root));
const cache=new Map(),history=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(key)};
test('current recurring source is closed before the complete immutable predecessor can be used',()=>{
 const view=recurringSourcePredecessor(current,history);assert(view);
 const sdk=sdkContinuationPredecessor(JSON.parse(current('apps/sg-runtime/operation-integration.json')),current,history),accepted=sdk?.previousBytes??current;
 for(const p of Object.keys(view.manifest.preservedReceipts))assert.deepEqual(accepted(p),history(RECURRING_SOURCE_BASE,p));
 for(const p of view.manifest.changedPaths.filter(p=>!view.manifest.addedPaths.includes(p)))assert.deepEqual(view.previousBytes(p),history(RECURRING_SOURCE_BASE,p),p);
 for(const p of [...view.manifest.addedPaths,RECURRING_SOURCE_RECORD])assert.throws(()=>view.previousBytes(p),{code:'ENOENT'});
 assert.equal(recurringSourcePredecessor(view.previousBytes,history),null);
});
test('changed private runtime, SDK, consumer, receipt or candidate record is refused before a historical projection',()=>{
 const view=recurringSourcePredecessor(current,history);
 for(const p of [...view.manifest.changedPaths,...Object.keys(view.manifest.preservedReceipts)])assert.throws(()=>recurringSourcePredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),history),p);
 for(const mutate of [a=>a.runtimeActivated=true,a=>a.platformVersion='1.34.0',a=>a.previousSourceSha='0'.repeat(40),a=>a.sourceDigests['unadmitted.mjs']='a'.repeat(64),a=>a.newGrantsInstalled=true,a=>delete a.sourceDigests[a.changedPaths[0]]]){
  const a=JSON.parse(current(RECURRING_SOURCE_RECORD));mutate(a);assert.throws(()=>recurringSourcePredecessor(p=>p===RECURRING_SOURCE_RECORD?Buffer.from(JSON.stringify(a)):current(p),history));
 }
});
test('a genuinely absent successor is optional; unreadable source and unrelated Git failures remain fatal',()=>{
 assert.equal(recurringSourcePredecessor(()=>{throw Object.assign(Error('Absent'),{code:'ENOENT'})},history),null);
 const denied=Object.assign(Error('Denied'),{code:'EACCES'});assert.throws(()=>recurringSourcePredecessor(()=>{throw denied},history),e=>e===denied);
 const wrong=Object.assign(Error('Other Git error'),{status:128,stderr:"fatal: path 'another-file' does not exist in 'main'"});assert.throws(()=>recurringSourcePredecessor(()=>{throw wrong},history),e=>e===wrong);
});

test('parallel accepted ECR precision stays current and separately reviewable in the authority projection',()=>{
 const view=recurringSourcePredecessor(current,history);
 const receipt='apps/sg-runtime/assistant-ecr-precision-integration.json',helper='apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs';
 assert.deepEqual(view.authorityBytes(receipt),current(receipt));
 assert.deepEqual(view.authorityBytes(helper),history(view.manifest.authorityMainSha,helper));
 assert.throws(()=>view.previousBytes(receipt),{code:'ENOENT'});
 assert.equal(recurringSourcePredecessor(view.authorityBytes,history),null);
 for(const p of view.manifest.predecessorProjectionPaths){
  assert(Object.hasOwn(view.manifest.sourceDigests,p),'parallel current source is explicitly bound');
  assert.throws(()=>recurringSourcePredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),history),p);
 }
});

test('direct and filesystem APIs both validate the current registration before returning recurring history',()=>{
 const view=recurringSourcePredecessor(current,history),physical=recurringSourceFilesystem(root);
 assert.deepEqual(physical.manifest,view.manifest);
 const record=JSON.parse(current('packages/platform-contracts/test/organisation-sdk-compatibility.json'));
 const targets=new Set([...Object.keys(record.sourceDigests),...Object.keys(record.compatibilityTestSourceDigests),'apps/identity-runtime/src/http-handler.ts','packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs','packages/platform-contracts/test/organisation-profile.test.mjs']);
 for(const target of targets)assert.throws(()=>recurringSourcePredecessor(p=>p===target?Buffer.concat([current(p),Buffer.from('\nUNREVIEWED')]):current(p),history),target);
});
test('an explicitly layered caller and direct current source expose the same exact predecessor',()=>{
 const sdk=sdkContinuationPredecessor(JSON.parse(current('apps/sg-runtime/operation-integration.json')),current,history);assert(sdk);
 const direct=recurringSourcePredecessor(current,history),layered=recurringSourcePredecessor(sdk.previousBytes,history);assert.deepEqual(direct.manifest,layered.manifest);
 for(const p of direct.manifest.changedPaths.filter(p=>!direct.manifest.addedPaths.includes(p)))assert.deepEqual(direct.previousBytes(p),layered.previousBytes(p),p);
 assert.equal(recurringSourcePredecessor(direct.previousBytes,history),null);
});
```
