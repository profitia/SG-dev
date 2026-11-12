import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {sdkContinuationPredecessor,acceptedSdkSource} from './organisation-sdk-compatibility.mjs'
const root=new URL('../../../',import.meta.url)
const current=p=>fs.readFileSync(new URL(p,root))
const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']})
const hash=b=>createHash('sha256').update(b).digest('hex')
const sourcePath='packages/platform-contracts/test/organisation-sdk-compatibility.json'
const receiptPath=p=>'apps/'+(p==='SG2'?'sg-runtime':'srm')+'/operation-integration.json'
const receipt=(p,read=current)=>JSON.parse(read(receiptPath(p)))
const sourceOverlay={
  "apps/identity-runtime/src/organisation-onboarding.ts": {
    "sha256": "2bd52ce90cbb522cf465298228524ba7f51e87646e3dcbcbbd8ae49a2203ad53",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "apps/identity-runtime/test/organisation-onboarding.test.mjs": {
    "sha256": "8e63ae4b5b21724f13fa29659f546424804bf63e2ea0568a238a26f365506e8b",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "apps/identity-runtime/src/organisation-draft.ts": {
    "sha256": "bba7165ae3bbd799778312722725e888b7a33347918f393618c67ca4026b3a4f",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/src/main.ts": {
    "sha256": "5396d018303d3356c73523ee4edfc06ab8725d29c42125c7c8e60087e4345fd4",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/src/http-handler.ts": {
    "sha256": "362687ff03605bc908443992844f887aba69d7e263383f2f38893bbb2fca3ca0",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/test/organisation-draft.test.mjs": {
    "sha256": "128683cefed1ba9ee0dadf271a66320678a2d5babbb4f69c794e8b643a1c0328",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/README.md": {
    "sha256": "f5b66a9294e6c74d2973911779e1ac9b7a3bd898ccd330581885e05e081aa30b",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "Canon/evidence/2026-11-11-registration-native-draft-http.md": {
    "sha256": "9baa883a9af8beb2e658a351ce022c57fa8c869f126e35e0da95b4400c626c7a",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "packages/platform-contracts/test/organisation-bootstrap-postgres.test.mjs": {
    "sha256": "15165c930440ceb7cbe7dbfdd0263637951f31b83c0a33d01a1f065d7dd1fd08",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "packages/platform-contracts/test/organisation-bootstrap.test.mjs": {
    "sha256": "ed13fb983ef78aeab7210ebb26a122af8ba96d0529769c1db6fa8458bcfc690d",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "packages/platform-contracts/test/organisation-invitations.test.mjs": {
    "sha256": "2deaad88c6b70f57e8cb72d98221f58c976afa1fcf029868d67191289e6e7ed2",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs": {
    "sha256": "fd9d06252c3342d956d0db0755a3200660b6db9ac9d458fa1c6162935627248e",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "packages/platform-contracts/test/organisation-profile.test.mjs": {
    "sha256": "3a6ddbf6ee633a7245d14608792ec412d5acd3c72879e0104e3105476990091c",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  }
}
test('current165-file producer and both receivers precede accepted recurring main',()=>{
 const record=JSON.parse(current(sourcePath))
 assert.equal(record.platformVersion,'1.36.0');assert.equal(Object.keys(record.sourceDigests).length,165)
 assert.equal(record.previousSourceSha,'0775f8a18d2fbeca462bb0a9d654914b15c53dad')
 assert.equal(record.defaultRootImplementation,'1.0.0-candidate.16')
 assert.equal(record.optionalRootImplementation,'1.0.0-candidate.21')
 for(const projectKey of ['SG2','SRM']){
  const value=sdkContinuationPredecessor(receipt(projectKey),current,historical,{projectKey})
  assert.deepEqual(value.record,record)
  assert.deepEqual(value.prior,JSON.parse(historical(record.previousSourceSha,receiptPath(projectKey))))
  for(const p of ['packages/platform-contracts/src/operation-context.mjs','packages/platform-contracts/package.json','apps/sg-runtime/tests/operation-context.test.mjs','apps/srm/scripts/operation-context.test.mjs'])
   assert.deepEqual(value.previousBytes(p),historical(record.previousSourceSha,p))
  for(const p of Object.keys(sourceOverlay)){
   let prior;try{prior=historical(record.previousSourceSha,p)}catch{
    assert.throws(()=>value.previousBytes(p),'new source absent from actual predecessor: '+p);continue
   }
   assert.deepEqual(value.previousBytes(p),prior,'actual supplemental predecessor: '+p)
  }
  assert.equal(hash(value.previousBytes('apps/architecture-lab/private-recurring-source.json')),'75877d5750e07d1c8172be0af76bc5933f2eeefc22cc39747a2621b9cab24619')
  assert.throws(()=>value.previousBytes('../outside'))
 }
 assert.deepEqual(acceptedSdkSource(),record)
})
test('every physical SDK, recurring guard, receiver and compatibility file remains authenticated',()=>{
 const record=JSON.parse(current(sourcePath))
 const targets=[...Object.keys(record.sourceDigests),...Object.keys(record.compatibilityTestSourceDigests),...Object.keys(record.preservedSourceDigests),...Object.values(record.consumerSourceDigests).flatMap(Object.keys),...Object.keys(sourceOverlay)]
 for(const target of targets){
  const changed=p=>p===target?Buffer.concat([current(p),Buffer.from('\nUNREVIEWED')]):current(p)
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),changed,historical),target)
 }
})
test('forged records, receipts, peer frames and history cannot open the predecessor',()=>{
 for(const mutate of [r=>r.sqlInstalled=true,r=>r.runtimeOptedIn=true,r=>r.previousSourceSha='0'.repeat(40),r=>r.producer.sourceSha='0'.repeat(40),r=>r.sourceDigests['packages/platform-contracts/src/operation-context.mjs']='0'.repeat(64)]){
  const r=JSON.parse(current(sourcePath));mutate(r)
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),p=>p===sourcePath?Buffer.from(JSON.stringify(r)+'\n'):current(p),historical))
 }
 for(const projectKey of ['SG2','SRM'])for(const mutate of [r=>r.sdkSourceContinuations[0].taskId='foreign',r=>r.sdkSourceContinuations[0].previousReceiptSha256='0'.repeat(64),r=>r.sdkSourceContinuations.push({...r.sdkSourceContinuations[0]}),r=>r.contract.sourceDigest='0'.repeat(64)]){
  const bad=receipt(projectKey);mutate(bad)
  assert.throws(()=>sdkContinuationPredecessor(bad,p=>p===receiptPath(projectKey)?Buffer.from(JSON.stringify(bad)):current(p),historical,{projectKey}))
 }
 const other=receipt('SRM');delete other.sdkSourceContinuations
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),p=>p===receiptPath('SRM')?Buffer.from(JSON.stringify(other)):current(p),historical))
 const changedHistory=(sha,p)=>p===receiptPath('SG2')?Buffer.concat([historical(sha,p),Buffer.from('forged')]):historical(sha,p)
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),current,changedHistory))
})
test('original020 and approved25fea retain their actual immutable full source graph',()=>{
 const sha='b4ca8b7072bd105e1ac3f3ead85a1104bf7f04c4',old=p=>historical(sha,p)
 assert.equal(hash(old(sourcePath)),'25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c')
 for(const projectKey of ['SG2','SRM'])assert.equal(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}).record.platformVersion,'1.34.0')
 const doc=old('Canon/evidence/2026-11-11-registration-sdk-ci-complete-review.md').toString(),marker=doc.indexOf('<!-- registration-sdk-fixture -->'),match=/\x60\x60\x60json\n([\s\S]*?)\x60\x60\x60/.exec(doc.slice(marker))
 assert(marker>=0&&match);const bytes=Buffer.from(match[1]),original=JSON.parse(bytes)
 assert.equal(hash(bytes),'020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e')
 const name='apps/sg-runtime/tests/private-host.integration.test.mjs',next="currentSdkRecord.sourceDigests?.['packages/platform-contracts/'+file]??currentSdkRecord.compatibilityTestSourceDigests?.['packages/platform-contracts/'+file]??digest",before="currentSdkRecord.sourceDigests?.['packages/platform-contracts/'+file]??digest",source=old(name).toString()
 assert.equal(source.split(next).length,2)
 const restored=Buffer.from(source.replace(next,before));assert.equal(hash(restored),original.consumerSourceDigests.SG2[name])
 const view=p=>p===sourcePath?bytes:p===name?restored:old(p)
 for(const projectKey of ['SG2','SRM'])assert.deepEqual(sdkContinuationPredecessor(receipt(projectKey,view),view,historical,{projectKey}).record,original)
})

test('every immutable supplemental producer is authenticated before exposing historical sources',()=>{
 for(const [target,pin]of Object.entries(sourceOverlay)){
  const forged=(sha,p)=>sha===pin.producerSha&&p===target?Buffer.concat([historical(sha,p),Buffer.from('\nFORGED')]):historical(sha,p)
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),current,forged),/actual immutable supplemental producer/,'immutable supplemental source '+target)
 }
})

test('the complete67 reviewed source closure has no unverified historical overlay gaps',()=>{
 const reviewed=JSON.parse(historical('b76de15c929389d82d6179203c94ec57cc378cda','Canon/proposals/registration-identity-history-successor-20261111/source-review.json'))
 const r=JSON.parse(current(sourcePath))
 const closed=new Set([...Object.keys(r.sourceDigests),...Object.keys(r.compatibilityTestSourceDigests),...Object.keys(r.preservedSourceDigests),...Object.values(r.consumerSourceDigests).flatMap(Object.keys),...Object.keys(sourceOverlay),receiptPath('SG2'),receiptPath('SRM'),sourcePath,'packages/platform-contracts/test/organisation-sdk-compatibility.mjs','packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs'])
 const reviewedPaths=[...Object.keys(reviewed.entries),...["apps/architecture-lab/private-recurring-source.mjs","apps/architecture-lab/test/private-recurring-source.test.mjs"]]
 assert.equal(new Set(reviewedPaths).size,67)
 assert.equal(Object.keys(sourceOverlay).length,13)
 assert.deepEqual(reviewedPaths.filter(p=>!closed.has(p)),[],'every reviewed path must be verified or the exact known record/verifier')
})

test('approved ccf1.36 source retains its exact actual immutable old guard versions',()=>{
 const old=p=>historical('9b7b54c5490ddc1a84c118d5c919b5fa566be289',p);
 assert.equal(hash(old(sourcePath)),'ccf680f0a83b61f3944dd2823259e9487ddae5c2a7707b8d05e793241c4aae40');
 for(const projectKey of ['SG2','SRM'])assert.equal(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}).record.platformVersion,'1.36.0');
});
test('new current compatibility guards still require the actual unchanged predecessor guard bytes',()=>{
 const r=JSON.parse(current(sourcePath));
 for(const target of ["apps/architecture-lab/private-recurring-source.mjs","apps/architecture-lab/test/private-recurring-source.test.mjs"]){
  const forged=(sha,p)=>sha===r.previousSourceSha&&p===target?Buffer.concat([historical(sha,p),Buffer.from('\nFORGED')]):historical(sha,p);
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),current,forged),/actual predecessor guard/,target);
 }
});

test('approved ffe source remains authenticated at its complete immutable graph',()=>{
 const old=p=>historical('09cf78d48c85986e4973f13007e32638bf040a2f',p);
 assert.equal(hash(old(sourcePath)),'ffe2065f84e7a9808a74f896170588b9ff5fc66973096a15a407a7cbf006808d');
 for(const projectKey of ['SG2','SRM'])assert.deepEqual(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}).record,JSON.parse(old(sourcePath)));
});

test('approved b5 source remains authenticated at its complete immutable graph',()=>{
 const old=p=>historical('a791b5f03abdee49c54c03215f8902f39bda1cdf',p);
 assert.equal(hash(old(sourcePath)),'b5a228db0a77f4cd7e2235506738a994fffcd741ff942e67717633d858c5b94a');
 for(const projectKey of ['SG2','SRM'])assert.deepEqual(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}).record,JSON.parse(old(sourcePath)));
});
test('the SDK view authenticates current ECR and both immutable guard pins before any prior bytes',()=>{
 const w=JSON.parse(current('apps/sg-runtime/assistant-ecr-week-integration.json'));
 for(const target of [...Object.keys(w.sourceDigests),'apps/sg-runtime/assistant-ecr-week-integration.json'])assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),p=>p===target?Buffer.concat([current(p),Buffer.from('\nUNACCEPTED_ECR')]):current(p),historical),target);
 for(const target of ["apps/architecture-lab/private-recurring-source.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs"])assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),current,(sha,p)=>sha==='38a9fe371e7993b47e2358d297647086ea999428'&&p===target?Buffer.concat([historical(sha,p),Buffer.from('\nFORGED_ECR_HISTORY')]):historical(sha,p)),/actual immutable parallel ECR guard/,target);
});

test('approved parallel ECR67 graph remains authenticated at its complete immutable source',()=>{
 const old=p=>historical('b9779781e06e239535a0fe2883fe37ca569fdfd2',p);
 assert.equal(hash(old(sourcePath)),'b0b9ceb1799499cb2088ed8be523d6c1758573995e65ca53693b15eeaeafe698');
 for(const projectKey of ['SG2','SRM'])assert.deepEqual(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}).record,JSON.parse(old(sourcePath)));
});
test('direct ECR test is authenticated before its exactly pinned historical view',()=>{
 const target="apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs",source=sdkContinuationPredecessor(receipt('SG2'),current,historical);
 assert.equal(hash(source.previousBytes(target)),'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f');
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),p=>p===target?Buffer.concat([current(p),Buffer.from('UNREVIEWED')]):current(p),historical),/current SG2 acceptance/);
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),current,(sha,p)=>sha==='38a9fe371e7993b47e2358d297647086ea999428'&&p===target?Buffer.concat([historical(sha,p),Buffer.from('FORGED_HISTORY')]):historical(sha,p)),/actual immutable parallel ECR guard/);
});

test('approved direct ECR68 graph remains authenticated at its immutable owner-reviewed source',()=>{
 const old=p=>historical('28a97557f611055e5a3657db9e46db55137dae66',p);
 assert.equal(hash(old(sourcePath)),'8e3eb5304ba9f3270b8021341a7220dff29acd5bbcf6fcd8c4cb301bf7071059');
 for(const projectKey of ['SG2','SRM'])assert.deepEqual(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}).record,JSON.parse(old(sourcePath)));
});

test('accepted Calendar and registration both authenticate their complete current graph before ECR history',()=>{
 const a=JSON.parse(current('apps/economic-calendar-runtime/market-calendar-preferences-integration.json'));
 for(const p of [...Object.keys(a.sourceDigests),...Object.keys(a.preservedReceipts),'apps/architecture-lab/market-calendar-source.mjs']){
  const changed=f=>f===p?Buffer.concat([current(f),Buffer.from('UNREVIEWED')]):current(f);
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2',changed),changed,historical),p);
 }
 const view=sdkContinuationPredecessor(receipt('SG2',current),current,historical);assert(view);
 assert.throws(()=>view.previousBytes('apps/economic-calendar-runtime/market-calendar-preferences-integration.json'));
});

test('accepted49 Calendar69 graph remains verified at its complete immutable source',()=>{
 const old=p=>historical('f251c7bf94cf7142d43ee512eb7dc0a7d6d7d61d',p);assert.equal(hash(old(sourcePath)),'49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba');
 for(const projectKey of ['SG2','SRM'])assert.deepEqual(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}).record,JSON.parse(old(sourcePath)));
});

test('accepted Calendar corrective record and its physical verifier cannot be omitted or rebound',()=>{
 const p='apps/architecture-lab/market-calendar-test-compatibility.json';assert.equal(hash(current(p)),'52e859d4a99bc4c8e4d986f38afea2d58e9c1fe1ee1e0eb62cc2672dbdb60078');
 for(const f of [p,'apps/architecture-lab/market-calendar-source.mjs']){
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),n=>n===f?Buffer.concat([current(n),Buffer.from('UNREVIEWED')]):current(n),historical),f);
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),n=>{if(n===f)throw Object.assign(Error('Absent'),{code:'ENOENT'});return current(n)},historical),f);
 }
});

test('accepted a805 Calendar corrective69 graph remains complete at its actual immutable source',()=>{
 const old=p=>historical('9c3d52c9f738317801f24b29e148b24127885df7',p);assert.equal(hash(old(sourcePath)),'a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8');
 for(const projectKey of ['SG2','SRM'])assert.deepEqual(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}).record,JSON.parse(old(sourcePath)));
});

test('accepted Calendar consumer closes all20 physical paths and its immutable record before projection',()=>{
 const p='apps/sg-runtime/market-calendar-integration.json',a=JSON.parse(current(p));assert.equal(hash(current(p)),'b66d88e724f84d513677554e77484bc29a2021b238ce28d4b7db7492aba9903c');assert.equal(Object.keys(a.sourceDigests).length,20);
 for(const f of [p,...Object.keys(a.sourceDigests)])assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),n=>n===f?Buffer.concat([current(n),Buffer.from('UNREVIEWED')]):current(n),historical),f);
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),n=>{if(n===p)throw Object.assign(Error('Absent'),{code:'ENOENT'});return current(n)},historical));
});

test('immutable c26 Calendar consumer source remains accepted after navigation correction',()=>{
 const old=p=>historical('b80e7577c3fea1e6c555796089d2336997631996',p)
 assert.equal(hash(old(sourcePath)),'c26ca9c1c02b788bd010b315d5c522c8247fedb5b72d858eafd7780667c76bcb')
 for(const projectKey of ['SG2','SRM'])assert(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}))
})

test('accepted Oil source and record are closed before exposing historical ECR helpers',()=>{
 const paths=['apps/sg-runtime/oil-renderer-integration.json','apps/insights-runtime/render/report.py','apps/insights-runtime/tests/postgres.test.mjs','apps/sg-runtime/tests/assistant-ecr-week-integrity.mjs']
 for(const p of paths)assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),f=>f===p?Buffer.concat([current(f),Buffer.from('UNREVIEWED')]):current(f),historical,{projectKey:'SG2'}),p)
 const prior=p=>historical('b80e7577c3fea1e6c555796089d2336997631996',p)
 assert.equal(hash(prior('apps/sg-runtime/market-calendar-integration.json')),'42406b5b07071408d35e39d5b9bb20d18402e52581d3c516bb08fb68b718f119')
})

test('immutable61 source profile remains verifiable after original recurring routing fixture repair',()=>{
 const old=p=>historical('845eb9137efa96d377b8498414f0b8b08c0ce4ad',p)
 assert.equal(hash(old(sourcePath)),'61c57570f25fe90c89a5d2bd0f27f2b228091a6bd239a72a7f1fc87e06ae36ad')
 for(const projectKey of ['SG2','SRM'])assert(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}))
})

test('separate SG2 Calendar helper is authenticated before the exact accepted Calendar view and all69 history remains closed',()=>{
 const file='apps/sg-runtime/tests/market-calendar-integrity.mjs'
 for(const projectKey of ['SG2','SRM']){
  assert(sdkContinuationPredecessor(receipt(projectKey),current,historical,{projectKey}))
  assert.throws(()=>sdkContinuationPredecessor(receipt(projectKey),p=>p===file?Buffer.concat([current(p),Buffer.from('UNREVIEWED')]):current(p),historical,{projectKey}))
 }
 const old=p=>historical('9f6dc4176bbdd0cbe2a7cfcb2e6dd99351b02506',p)
 assert.equal(hash(old(sourcePath)),'0174f13d576346174ab07e50bff31abcacc57400d0f8779531c8aa146994bb1f')
 for(const projectKey of ['SG2','SRM'])assert(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}))
})

test('accepted PI main and registration close all current physical inputs before either historical view',()=>{
 const view=sdkContinuationPredecessor(receipt('SG2'),current,historical);assert(view.composition)
 assert.deepEqual(view.record,JSON.parse(current(sourcePath)))
 assert.equal(view.composition.transport.manifest.scope,'RECURRING_CONSENT_BEARER_TRANSPORT_CORRECTION')
 assert(view.composition.completion)
 for(const target of ['packages/platform-contracts/current-e1-authority/recurring.mjs','apps/insights-runtime/src/publication-query.mjs','apps/sg-runtime/components/procurement-insights/reports.tsx','apps/sg-runtime/procurement-insights-completion-integration.json','apps/platform-source-hub/test/ci-routing.test.mjs','apps/srm/scripts/private-host.integration.test.mjs']){
  const changed=p=>p===target?Buffer.concat([current(p),Buffer.from('UNREVIEWED')]):current(p)
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),changed,historical),target)
 }
 const forged=(sha,p)=>sha==='82bcb78813937331d7822a96c5319b26e788abe1'&&p==='packages/platform-contracts/current-e1-authority/recurring.mjs'?Buffer.from('forged'):historical(sha,p)
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),current,forged))
})
