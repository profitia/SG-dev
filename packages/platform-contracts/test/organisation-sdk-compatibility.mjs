import {organisationLifecycleSdkPredecessor} from './organisation-lifecycle-sdk-compatibility.mjs'
import {recurringConsentTransportPredecessor} from './recurring-consent-transport-source.mjs'
import {procurementInsightsCompletionPredecessor} from '../../../apps/sg-runtime/tests/procurement-insights-completion-integrity.mjs'
import {marketCalendarSourcePredecessor,bsdcManifestContinuityCurrent} from '../../../apps/architecture-lab/market-calendar-source.mjs'
import {posix} from 'node:path'
// Source acceptance and historical verification only. Never imported by a
// product runtime or used as an identity, permission, licence or activation.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'

const root=new URL('../../../',import.meta.url)
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const immutableHistory=new WeakMap()
function historicalSource(reader,sha,path){
 assert.equal(typeof reader,'function')
 let cache=immutableHistory.get(reader);if(!cache){cache=new Map();immutableHistory.set(reader,cache)}
 const key=sha+':'+path
 // Git object bytes are immutable. Current workspace bytes are always re-read.
 if(!cache.has(key))cache.set(key,Buffer.from(reader(sha,path)))
 return Buffer.from(cache.get(key))
}
const receiptPath=project=>'apps/'+(project==='SG2'?'sg-runtime':'srm')+'/operation-integration.json'
const tasks={SG2:'SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110',SRM:'SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111'}
const known=Object.freeze({
 'organisation-bootstrap-v1':Object.freeze({path:'packages/platform-contracts/test/organisation-sdk-compatibility.json',sha256:'020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e',successorSha256s:Object.freeze(['25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c','ccf680f0a83b61f3944dd2823259e9487ddae5c2a7707b8d05e793241c4aae40','ffe2065f84e7a9808a74f896170588b9ff5fc66973096a15a407a7cbf006808d','b5a228db0a77f4cd7e2235506738a994fffcd741ff942e67717633d858c5b94a','b0b9ceb1799499cb2088ed8be523d6c1758573995e65ca53693b15eeaeafe698','8e3eb5304ba9f3270b8021341a7220dff29acd5bbcf6fcd8c4cb301bf7071059','52f6fbeba63a7585d3b909ca6cb5b91c1b6b2ebdeb118975473f312acc6ba7f3','49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba','a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8','c26ca9c1c02b788bd010b315d5c522c8247fedb5b72d858eafd7780667c76bcb','61c57570f25fe90c89a5d2bd0f27f2b228091a6bd239a72a7f1fc87e06ae36ad','0174f13d576346174ab07e50bff31abcacc57400d0f8779531c8aa146994bb1f','022f0a4c774cc93856c7219518ac99d23712cd3961bab508fa0d2b25c9113ea1'])})
})
// All supplemental reviewed source bytes are verified before exposing0775.
// These pins add no runtime authority and apply only to reconciled1.36 history.
const reconciledSourceOverlay=Object.freeze({
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
})

const parallelEcrWeek=Object.freeze({recordSha256:'b0b9ceb1799499cb2088ed8be523d6c1758573995e65ca53693b15eeaeafe698',receipt:'apps/sg-runtime/assistant-ecr-week-integration.json',receiptSha256:'31ce8f1d7e5ca1d9c3aedf80f92e23fe0f1a93cb8f5fd5d003eb54a244859dd4',sourceSha:'38a9fe371e7993b47e2358d297647086ea999428',guardPins:Object.freeze({"apps/architecture-lab/private-recurring-source.mjs":"9035324816864e64040c1ad3d29e064284ad2e3f8eb626a9b3c1ede55fbb4b28","apps/sg-runtime/tests/pci-smart-integrity.test.mjs":"aa9b2199d5d2cd1554f808a02f7fd63bf397adca045f4d535e7d2af0f158c080"})});
/** Exact source-only composition, not a generic reader or runtime grant.
 * All physical SDK/receiver bytes have already passed verifyRecord and both
 * receiver frames before this authenticates the separately accepted ECR graph.
 * Only two explicitly pinned source-proof paths use actual ECR history. */
const parallelEcrWeekFrames=Object.freeze({
 'b0b9ceb1799499cb2088ed8be523d6c1758573995e65ca53693b15eeaeafe698':parallelEcrWeek,
 '8e3eb5304ba9f3270b8021341a7220dff29acd5bbcf6fcd8c4cb301bf7071059':Object.freeze({...parallelEcrWeek,recordSha256:'8e3eb5304ba9f3270b8021341a7220dff29acd5bbcf6fcd8c4cb301bf7071059',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})}),
 '52f6fbeba63a7585d3b909ca6cb5b91c1b6b2ebdeb118975473f312acc6ba7f3':Object.freeze({...parallelEcrWeek,recordSha256:'52f6fbeba63a7585d3b909ca6cb5b91c1b6b2ebdeb118975473f312acc6ba7f3',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})}),
 '49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba':Object.freeze({...parallelEcrWeek,recordSha256:'49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})}),
 'a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8':Object.freeze({...parallelEcrWeek,recordSha256:'a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})}),
 'c26ca9c1c02b788bd010b315d5c522c8247fedb5b72d858eafd7780667c76bcb':Object.freeze({...parallelEcrWeek,recordSha256:'c26ca9c1c02b788bd010b315d5c522c8247fedb5b72d858eafd7780667c76bcb',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})}),
 '61c57570f25fe90c89a5d2bd0f27f2b228091a6bd239a72a7f1fc87e06ae36ad':Object.freeze({...parallelEcrWeek,recordSha256:'61c57570f25fe90c89a5d2bd0f27f2b228091a6bd239a72a7f1fc87e06ae36ad',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})}),
 '0174f13d576346174ab07e50bff31abcacc57400d0f8779531c8aa146994bb1f':Object.freeze({...parallelEcrWeek,recordSha256:'0174f13d576346174ab07e50bff31abcacc57400d0f8779531c8aa146994bb1f',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})}),
 '022f0a4c774cc93856c7219518ac99d23712cd3961bab508fa0d2b25c9113ea1':Object.freeze({...parallelEcrWeek,recordSha256:'022f0a4c774cc93856c7219518ac99d23712cd3961bab508fa0d2b25c9113ea1',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})})
})
function verifiedParallelEcrGuards(record,current,historical,profile=parallelEcrWeek){
 const bytes=cloneBytes(current(profile.receipt));assert.equal(hash(bytes),profile.receiptSha256,'exact parallel ECR source record');
 const w=JSON.parse(bytes),guards=new Map();
 for(const[p,h]of Object.entries(profile.guardPins)){
  const b=cloneBytes(historicalSource(historical,profile.sourceSha,p));assert.equal(hash(b),h,'actual immutable parallel ECR guard '+p);guards.set(p,b);
 }
 for(const[p,h]of Object.entries(w.sourceDigests))assert.equal(hash(guards.get(p)??current(p)),h,'current parallel ECR source '+p);
 for(const[p,h]of Object.entries(w.previousReceipts)){
  const b=[receiptPath('SG2'),receiptPath('SRM')].includes(p)?historicalSource(historical,record.previousSourceSha,p):current(p);
  assert.equal(hash(b),h,'preserved parallel ECR receipt '+p);
  assert.equal(hash(historicalSource(historical,w.previousSourceSha,p)),h,'actual immutable parallel ECR receipt '+p);
 }
 return guards;
}

const recordKeys=['schemaVersion','acceptanceId','taskId','targetEnvironment','scope','platformVersion','previousSourceSha','producer','sourceDigests','compatibilityTestSourceDigests','sdkDigests','optionalPackageDigests','consumerSourceDigests','preservedSourceDigests','defaultRootImplementation','optionalRootImplementation','optionalOperations','runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed']
const compatibilityTests=[
 'apps/platform-source-hub/scripts/ci-routing.mjs',
 'apps/platform-source-hub/test/ci-routing.test.mjs',
 'apps/newsfeed-runtime/test/runtime.test.mjs',
 'apps/architecture-lab/test/sdk-compatibility.test.mjs',
 'packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs',
 'packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs',
 'packages/platform-contracts/test/private-operation-host.test.mjs'
].sort()
// The owner's1041 mandate composes only the two overlapping proof files.
// SDK and both receivers are authenticated first; Calendar source and every
// preserved receipt are authenticated before any Calendar history is exposed.
const acceptedCalendarFrames=Object.freeze({"49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba":{"sourceSha":"877c55c6ef7879c088255284dd852d5cab6d5f44","pins":{"apps/architecture-lab/private-recurring-source.mjs":"7cc45765fb91657a78eba8d48214886664e0648680c4cd3ea19119386e499b4d","apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":"e3b350ed2013c89f6d4215e9b68965685551198fd1463442b50aa0ae2e7e1d99","apps/architecture-lab/test/market-calendar-source.test.mjs":"618f9e9643f17c7db385572bdd11e8b8c940504a55b0bae317094352878ca6a1"},"helperSha256":"fb08a9a2d21a59be5422a313663d5191473385a28faa8c253ffdddb166fcbfcd"},"a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8":{"sourceSha":"334273b2b5af0ad41a1489f31bc6bb56f36d3dbf","pins":{"apps/architecture-lab/private-recurring-source.mjs":"7cc45765fb91657a78eba8d48214886664e0648680c4cd3ea19119386e499b4d","apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":"e3b350ed2013c89f6d4215e9b68965685551198fd1463442b50aa0ae2e7e1d99","apps/architecture-lab/test/market-calendar-source.test.mjs":"36772de9ab30b19a07089debefcc01729abf5f125a07fd3f09eef7b5a4226edf"},"helperSha256":"034abe33e17cd8a6247a43f14a62eba3437831bb1f0d59d851e5efc45a7abb86","compatibilityReceipt":{"path":"apps/architecture-lab/market-calendar-test-compatibility.json","sha256":"52e859d4a99bc4c8e4d986f38afea2d58e9c1fe1ee1e0eb62cc2672dbdb60078"},"restoreReceipts":true},"c26ca9c1c02b788bd010b315d5c522c8247fedb5b72d858eafd7780667c76bcb":{"sourceSha":"334273b2b5af0ad41a1489f31bc6bb56f36d3dbf","pins":{"apps/architecture-lab/private-recurring-source.mjs":"7cc45765fb91657a78eba8d48214886664e0648680c4cd3ea19119386e499b4d","apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":"e3b350ed2013c89f6d4215e9b68965685551198fd1463442b50aa0ae2e7e1d99","apps/architecture-lab/test/market-calendar-source.test.mjs":"36772de9ab30b19a07089debefcc01729abf5f125a07fd3f09eef7b5a4226edf"},"helperSha256":"034abe33e17cd8a6247a43f14a62eba3437831bb1f0d59d851e5efc45a7abb86","compatibilityReceipt":{"path":"apps/architecture-lab/market-calendar-test-compatibility.json","sha256":"52e859d4a99bc4c8e4d986f38afea2d58e9c1fe1ee1e0eb62cc2672dbdb60078"},"restoreReceipts":true,"consumer":{"sourceSha":"46094e5654066552768264dd47027eaa18e833a4","recordPath":"apps/sg-runtime/market-calendar-integration.json","recordSha256":"42406b5b07071408d35e39d5b9bb20d18402e52581d3c516bb08fb68b718f119","guardPins":{"apps/sg-runtime/tests/pci-smart-integrity.test.mjs":"1f837dceece388807c2d149b8c1301e185fcc93e9ec374ef282047c83dfdda35"},"preservedOverrides":{"apps/sg-runtime/package.json":"d2ed74190322d0e5315212519709ca2e06a6cbfc32def8e23e64794101ee1517"}}},"61c57570f25fe90c89a5d2bd0f27f2b228091a6bd239a72a7f1fc87e06ae36ad":{"sourceSha":"334273b2b5af0ad41a1489f31bc6bb56f36d3dbf","pins":{"apps/architecture-lab/private-recurring-source.mjs":"7cc45765fb91657a78eba8d48214886664e0648680c4cd3ea19119386e499b4d","apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":"e3b350ed2013c89f6d4215e9b68965685551198fd1463442b50aa0ae2e7e1d99","apps/architecture-lab/test/market-calendar-source.test.mjs":"36772de9ab30b19a07089debefcc01729abf5f125a07fd3f09eef7b5a4226edf"},"helperSha256":"034abe33e17cd8a6247a43f14a62eba3437831bb1f0d59d851e5efc45a7abb86","compatibilityReceipt":{"path":"apps/architecture-lab/market-calendar-test-compatibility.json","sha256":"52e859d4a99bc4c8e4d986f38afea2d58e9c1fe1ee1e0eb62cc2672dbdb60078"},"restoreReceipts":true,"consumer":{"sourceSha":"99cd4aa1591ba2fc3a387ce637f920dac74880be","recordPath":"apps/sg-runtime/market-calendar-integration.json","recordSha256":"b66d88e724f84d513677554e77484bc29a2021b238ce28d4b7db7492aba9903c","guardPins":{"apps/sg-runtime/tests/pci-smart-integrity.test.mjs":"1f837dceece388807c2d149b8c1301e185fcc93e9ec374ef282047c83dfdda35"},"preservedOverrides":{"apps/sg-runtime/package.json":"d2ed74190322d0e5315212519709ca2e06a6cbfc32def8e23e64794101ee1517"}},"oil":{"sourceSha":"42e9d43ea846a5e6216faa18bfec8f939aac6971","recordPath":"apps/sg-runtime/oil-renderer-integration.json","recordSha256":"6afdd65e66d8a7d8ceb4ab68601ba6d1c1bfac43bbac879d01bb61c9962e7ad6"}},"0174f13d576346174ab07e50bff31abcacc57400d0f8779531c8aa146994bb1f":{"sourceSha":"334273b2b5af0ad41a1489f31bc6bb56f36d3dbf","pins":{"apps/architecture-lab/private-recurring-source.mjs":"7cc45765fb91657a78eba8d48214886664e0648680c4cd3ea19119386e499b4d","apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":"e3b350ed2013c89f6d4215e9b68965685551198fd1463442b50aa0ae2e7e1d99","apps/architecture-lab/test/market-calendar-source.test.mjs":"36772de9ab30b19a07089debefcc01729abf5f125a07fd3f09eef7b5a4226edf"},"helperSha256":"034abe33e17cd8a6247a43f14a62eba3437831bb1f0d59d851e5efc45a7abb86","compatibilityReceipt":{"path":"apps/architecture-lab/market-calendar-test-compatibility.json","sha256":"52e859d4a99bc4c8e4d986f38afea2d58e9c1fe1ee1e0eb62cc2672dbdb60078"},"restoreReceipts":true,"consumer":{"sourceSha":"99cd4aa1591ba2fc3a387ce637f920dac74880be","recordPath":"apps/sg-runtime/market-calendar-integration.json","recordSha256":"b66d88e724f84d513677554e77484bc29a2021b238ce28d4b7db7492aba9903c","guardPins":{"apps/sg-runtime/tests/pci-smart-integrity.test.mjs":"1f837dceece388807c2d149b8c1301e185fcc93e9ec374ef282047c83dfdda35"},"preservedOverrides":{"apps/sg-runtime/package.json":"d2ed74190322d0e5315212519709ca2e06a6cbfc32def8e23e64794101ee1517"}},"oil":{"sourceSha":"42e9d43ea846a5e6216faa18bfec8f939aac6971","recordPath":"apps/sg-runtime/oil-renderer-integration.json","recordSha256":"6afdd65e66d8a7d8ceb4ab68601ba6d1c1bfac43bbac879d01bb61c9962e7ad6"}},"022f0a4c774cc93856c7219518ac99d23712cd3961bab508fa0d2b25c9113ea1":{"sourceSha":"334273b2b5af0ad41a1489f31bc6bb56f36d3dbf","pins":{"apps/architecture-lab/private-recurring-source.mjs":"7cc45765fb91657a78eba8d48214886664e0648680c4cd3ea19119386e499b4d","apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":"e3b350ed2013c89f6d4215e9b68965685551198fd1463442b50aa0ae2e7e1d99","apps/architecture-lab/test/market-calendar-source.test.mjs":"36772de9ab30b19a07089debefcc01729abf5f125a07fd3f09eef7b5a4226edf"},"helperSha256":"034abe33e17cd8a6247a43f14a62eba3437831bb1f0d59d851e5efc45a7abb86","compatibilityReceipt":{"path":"apps/architecture-lab/market-calendar-test-compatibility.json","sha256":"52e859d4a99bc4c8e4d986f38afea2d58e9c1fe1ee1e0eb62cc2672dbdb60078"},"restoreReceipts":true,"consumer":{"sourceSha":"99cd4aa1591ba2fc3a387ce637f920dac74880be","recordPath":"apps/sg-runtime/market-calendar-integration.json","recordSha256":"b66d88e724f84d513677554e77484bc29a2021b238ce28d4b7db7492aba9903c","guardPins":{"apps/sg-runtime/tests/pci-smart-integrity.test.mjs":"1f837dceece388807c2d149b8c1301e185fcc93e9ec374ef282047c83dfdda35","apps/sg-runtime/tests/market-calendar-integrity.mjs":"cb83f9f3142dbbfa7c4a3a649dc3559ff493a2402bac3abe5061d24cb5c4a8b5"},"preservedOverrides":{"apps/sg-runtime/package.json":"d2ed74190322d0e5315212519709ca2e06a6cbfc32def8e23e64794101ee1517"}},"oil":{"sourceSha":"42e9d43ea846a5e6216faa18bfec8f939aac6971","recordPath":"apps/sg-runtime/oil-renderer-integration.json","recordSha256":"6afdd65e66d8a7d8ceb4ab68601ba6d1c1bfac43bbac879d01bb61c9962e7ad6"}}})

/** Authenticate the accepted renderer and every preserved receipt before exposing
 * its old helper. The SDK and both current receiver receipts were closed first. */
function verifiedOilPredecessor(current,historical,cfg){
 const bytes=cloneBytes(current(cfg.recordPath))
 assert.equal(hash(bytes),cfg.recordSha256,'accepted Oil renderer record')
 assert.equal(hash(historicalSource(historical,cfg.sourceSha,cfg.recordPath)),cfg.recordSha256,'actual accepted Oil record')
 const a=JSON.parse(bytes)
 for(const[p,digest]of Object.entries(a.sourceDigests))assert.equal(hash(current(p)),digest,'current accepted Oil source '+p)
 for(const[p,digest]of Object.entries(a.preservedReceipts)){
  assert.equal(hash(current(p)),digest,'current preserved Oil receipt '+p)
  assert.equal(hash(historicalSource(historical,a.previousSourceSha,p)),digest,'actual preserved Oil receipt '+p)
 }
 const cache=new Map()
 return p=>{
  if(p===cfg.recordPath)throw Object.assign(Error('Oil successor absent from predecessor'),{code:'ENOENT'})
  if(!Object.hasOwn(a.sourceDigests,p))return current(p)
  if(!cache.has(p))cache.set(p,cloneBytes(historicalSource(historical,a.previousSourceSha,p)))
  return Buffer.from(cache.get(p))
 }
}

function verifiedCalendarPredecessor(record,current,historical,recordDigest){
 const cfg=acceptedCalendarFrames[recordDigest];if(!cfg)return null
 const cache=new Map()
 assert.equal(hash(current('apps/architecture-lab/market-calendar-source.mjs')),cfg.helperSha256,'accepted Calendar verifier bytes')
 if(cfg.compatibilityReceipt)assert.equal(hash(current(cfg.compatibilityReceipt.path)),cfg.compatibilityReceipt.sha256,'accepted Calendar test-only record')
 for(const[p,h]of Object.entries(cfg.pins)){const b=cloneBytes(historicalSource(historical,cfg.sourceSha,p));assert.equal(hash(b),h,'actual accepted Calendar overlap '+p);cache.set(p,b)}
 if(cfg.consumer){
  assert.equal(hash(current(cfg.consumer.recordPath)),cfg.consumer.recordSha256,'accepted Calendar consumer record')
  for(const[p,h]of Object.entries(cfg.consumer.guardPins)){const b=cloneBytes(historicalSource(historical,cfg.consumer.sourceSha,p));assert.equal(hash(b),h,'actual Calendar consumer overlap '+p);cache.set(p,b)}
 }
 if(cfg.restoreReceipts)for(const project of ['SG2','SRM']){const p=receiptPath(project);cache.set(p,cloneBytes(historicalSource(historical,record.previousSourceSha,p)))}
 let reader=p=>cache.has(p)?Buffer.from(cache.get(p)):current(p)
 const acceptedCurrent=reader
 const first=marketCalendarSourcePredecessor(reader,historical);assert(first,'accepted Calendar source is required')
 reader=first.previousBytes
 for(let prior;(prior=marketCalendarSourcePredecessor(reader,historical));)reader=prior.previousBytes
 if(cfg.oil)reader=verifiedOilPredecessor(reader,historical,cfg.oil)
 return {current:acceptedCurrent,previousBytes:reader}
}
function exactKeys(value,keys,label){assert(value&&Object.getPrototypeOf(value)===Object.prototype,label);assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),label)}
function fileMap(value,label){assert(value&&Object.getPrototypeOf(value)===Object.prototype,label);assert(Object.keys(value).length>0,label);for(const[p,h]of Object.entries(value)){assert(/^[a-zA-Z0-9_./-]+$/.test(p)&&!p.split('/').includes('..')&&!p.startsWith('/'),label);assert(/^[a-f0-9]{64}$/.test(h),label)}}
function cloneBytes(value){assert(value!==null&&value!==undefined,'missing source bytes');return Buffer.from(value)}
function verifyRecord(a,current,historical,recordDigest){
 const complete=['ffe2065f84e7a9808a74f896170588b9ff5fc66973096a15a407a7cbf006808d','b5a228db0a77f4cd7e2235506738a994fffcd741ff942e67717633d858c5b94a','b0b9ceb1799499cb2088ed8be523d6c1758573995e65ca53693b15eeaeafe698','8e3eb5304ba9f3270b8021341a7220dff29acd5bbcf6fcd8c4cb301bf7071059','52f6fbeba63a7585d3b909ca6cb5b91c1b6b2ebdeb118975473f312acc6ba7f3','49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba','a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8','c26ca9c1c02b788bd010b315d5c522c8247fedb5b72d858eafd7780667c76bcb','61c57570f25fe90c89a5d2bd0f27f2b228091a6bd239a72a7f1fc87e06ae36ad','0174f13d576346174ab07e50bff31abcacc57400d0f8779531c8aa146994bb1f','022f0a4c774cc93856c7219518ac99d23712cd3961bab508fa0d2b25c9113ea1'].includes(recordDigest)
 exactKeys(a,recordKeys,'closed organisation SDK source record')
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.acceptanceId,'organisation-bootstrap-v1')
 assert.equal(a.taskId,'ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110')
 assert.equal(a.targetEnvironment,'development');assert.equal(a.scope,'OPTIONAL_ORGANISATION_SDK_SOURCE_ONLY')
 const reconciled=a.platformVersion==='1.36.0'
 assert.equal(a.platformVersion,reconciled?'1.36.0':'1.34.0')
 assert.equal(a.previousSourceSha,reconciled?'0775f8a18d2fbeca462bb0a9d654914b15c53dad':'b2fccbb8b9132a63c2c39507a1ebc838cf6228e1')
 assert.deepEqual(a.producer,{projectKey:'ARCHITECTURE',taskId:a.taskId,pullRequest:983,sourceSha:reconciled?'5a963f313317d57e1946e1d7aabd28192db9c7bd':'c373be45a5bf52c93034f5a1b6878e531c81b2ca'})
 assert.equal(a.defaultRootImplementation,'1.0.0-candidate.16');assert.equal(a.optionalRootImplementation,'1.0.0-candidate.21')
 assert.deepEqual(a.optionalOperations,['organisation.create'])
 for(const flag of ['runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 for(const field of ['sourceDigests','compatibilityTestSourceDigests','preservedSourceDigests'])fileMap(a[field],field)
 assert.deepEqual(Object.keys(a.compatibilityTestSourceDigests).sort(),complete?[...compatibilityTests,...["apps/architecture-lab/private-recurring-source.mjs","apps/architecture-lab/test/private-recurring-source.test.mjs"],...(['49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba','a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8','c26ca9c1c02b788bd010b315d5c522c8247fedb5b72d858eafd7780667c76bcb','61c57570f25fe90c89a5d2bd0f27f2b228091a6bd239a72a7f1fc87e06ae36ad','0174f13d576346174ab07e50bff31abcacc57400d0f8779531c8aa146994bb1f','022f0a4c774cc93856c7219518ac99d23712cd3961bab508fa0d2b25c9113ea1'].includes(recordDigest)?['apps/architecture-lab/test/market-calendar-source.test.mjs']:[]),...(recordDigest==='022f0a4c774cc93856c7219518ac99d23712cd3961bab508fa0d2b25c9113ea1'?['apps/sg-runtime/tests/market-calendar-integrity.mjs']:[])].sort():compatibilityTests,'closed compatibility test changes')
 for(const[p,h]of Object.entries(a.sourceDigests)){
  assert(/^packages\/platform-contracts\/(?:src\/[a-z0-9-]+\.(?:mjs|d\.mts)|migrations\/(?:access|profile)\/[a-z0-9-]+\.sql|(?:current-e1-authority\/)?[a-z0-9/.-]+|package\.json)$/.test(p)||/^packages\/platform-contracts\/(?:(?:readonly-miss-report|root-atomic-claim)\/)?README\.md$/.test(p),'SDK source path '+p)
  assert.equal(hash(current(p)),h,'current organisation SDK '+p)
  assert.equal(hash(historicalSource(historical,a.producer.sourceSha,p)),h,'actual immutable SDK producer '+p)
 }
 for(const[p,h]of Object.entries(a.compatibilityTestSourceDigests))assert.equal(hash(current(p)),h,'current compatibility test '+p)
 for(const[p,h]of Object.entries(a.preservedSourceDigests)){
  assert.equal(hash(current(p)),acceptedCalendarFrames[recordDigest]?.consumer?.preservedOverrides?.[p]??(complete&&["apps/architecture-lab/private-recurring-source.mjs","apps/architecture-lab/test/private-recurring-source.test.mjs"].includes(p)?a.compatibilityTestSourceDigests[p]:h),'preserved source '+p)
  assert.equal(hash(historicalSource(historical,a.previousSourceSha,p)),h,'actual predecessor guard '+p)
 }
 exactKeys(a.consumerSourceDigests,['SG2','SRM'],'both consumer owners required')
 for(const project of ['SG2','SRM']){
  fileMap(a.consumerSourceDigests[project],project+' consumer closure')
  const pattern=project==='SG2'?/^apps\/sg-runtime\/tests\/[a-z0-9.-]+\.(?:mjs|ts)$/:/^apps\/srm\/(?:app\/login\/porr-account\.tsx|scripts\/[a-z0-9.-]+\.(?:mjs|ts)|src\/server\/(?:root-atomic-claim-adoption|peer-read-boundary|supplier-location-geocoding-runtime)\.test\.ts)$/
  for(const[p,h]of Object.entries(a.consumerSourceDigests[project])){
   assert(pattern.test(p),'source-only consumer path '+p)
   assert.equal(hash(current(p)),h,'current '+project+' acceptance '+p)
  }
 }
 if(reconciled)for(const[p,pin]of Object.entries(reconciledSourceOverlay)){
  assert.equal(hash(current(p)),pin.sha256,'current reviewed supplemental source '+p)
  assert.equal(hash(historicalSource(historical,pin.producerSha,p)),pin.sha256,'actual immutable supplemental producer '+p)
 }
 for(const field of ['sdkDigests','optionalPackageDigests']){assert(a[field]&&Object.keys(a[field]).length);for(const[name,digest]of Object.entries(a[field])){assert(/^[a-zA-Z][a-zA-Z0-9]+Digest$/.test(name));assert.match(digest,/^[a-f0-9]{64}$/)}}
}
/** Validates current producer, both receivers and unchanged guards BEFORE any
 * predecessor bytes are exposed. A source frame does not change product grants.
 */
const mainComposition=Object.freeze({
  "registrationSourceSha": "e4b15372cea245f396034105b609e877cca5fa77",
  "registrationRecordSha256": "022f0a4c774cc93856c7219518ac99d23712cd3961bab508fa0d2b25c9113ea1",
  "acceptedMainSha": "82bcb78813937331d7822a96c5319b26e788abe1",
  "transportRecordSha256": "0c9ffe5bfd89cf2bd65cd9adc7ad241a04e7468b5821f97171f4a6c550aaba36",
  "projectedPaths": [
    "apps/architecture-lab/private-recurring-source.mjs",
    "apps/architecture-lab/test/market-calendar-source.test.mjs",
    "apps/architecture-lab/test/private-recurring-source.test.mjs",
    "apps/architecture-lab/test/sdk-compatibility.test.mjs",
    "apps/insights-runtime/src/publication-query.mjs",
    "apps/insights-runtime/src/subscription-api.mjs",
    "apps/insights-runtime/src/subscription-store.mjs",
    "apps/insights-runtime/tests/report-library.test.mjs",
    "apps/insights-runtime/tests/subscriptions.test.mjs",
    "apps/newsfeed-runtime/test/runtime.test.mjs",
    "apps/platform-source-hub/scripts/ci-routing.mjs",
    "apps/platform-source-hub/test/ci-routing.test.mjs",
    "apps/sg-runtime/components/procurement-insights/inline-item.tsx",
    "apps/sg-runtime/components/procurement-insights/reports.tsx",
    "apps/sg-runtime/components/procurement-insights/workspace.css",
    "apps/sg-runtime/components/procurement-insights/workspace.tsx",
    "apps/sg-runtime/package.json",
    "apps/sg-runtime/procurement-insights-completion-integration.json",
    "apps/sg-runtime/procurement-insights-shell-integration.json",
    "apps/sg-runtime/tests/assistant-ecr-integrity.mjs",
    "apps/sg-runtime/tests/assistant-ecr-integrity.test.mjs",
    "apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs",
    "apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs",
    "apps/sg-runtime/tests/assistant-m1-integrity.mjs",
    "apps/sg-runtime/tests/assistant-m2-integrity.mjs",
    "apps/sg-runtime/tests/assistant-m2-source-view.mjs",
    "apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs",
    "apps/sg-runtime/tests/assistant-send-arrow-integrity.test.mjs",
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs",
    "apps/sg-runtime/tests/market-calendar-integrity.mjs",
    "apps/sg-runtime/tests/market-calendar-integrity.test.mjs",
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs",
    "apps/sg-runtime/tests/operation-context.test.mjs",
    "apps/sg-runtime/tests/organisation-sdk-history.test.mjs",
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs",
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts",
    "apps/sg-runtime/tests/private-host.integration.test.mjs",
    "apps/sg-runtime/tests/procurement-insights-completion-integrity.mjs",
    "apps/sg-runtime/tests/procurement-insights-completion.test.mjs",
    "apps/sg-runtime/tests/procurement-insights-shell-integrity.mjs",
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs",
    "apps/sg-runtime/tests/xray-platform-compatibility.test.mjs",
    "apps/srm/app/login/porr-account.tsx",
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs",
    "apps/srm/scripts/native-execution-adoption.test.mjs",
    "apps/srm/scripts/operation-context.test.mjs",
    "apps/srm/scripts/porr-account-ui.test.mjs",
    "apps/srm/scripts/private-host.integration.test.mjs",
    "apps/srm/scripts/request-quota-adoption.test.mjs",
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs",
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs",
    "apps/srm/scripts/xray-performance-adoption.test.mjs",
    "apps/srm/src/server/peer-read-boundary.test.ts",
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts",
    "apps/srm/src/server/supplier-location-geocoding-runtime.test.ts",
    "packages/platform-contracts/current-e1-authority/recurring.mjs",
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs",
    "packages/platform-contracts/test/organisation-sdk-compatibility.mjs",
    "packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs",
    "packages/platform-contracts/test/private-operation-host.test.mjs",
    "packages/platform-contracts/test/recurring-consent-transport-source.json",
    "packages/platform-contracts/test/recurring-consent-transport-source.mjs",
    "packages/platform-contracts/test/recurring-consent-transport.test.mjs"
  ],
  "physicalDigests": {
    "Canon/evidence/2026-11-11-registration-native-draft-http.md": "9baa883a9af8beb2e658a351ce022c57fa8c869f126e35e0da95b4400c626c7a",
    "apps/architecture-lab/assistant-m1-sdk-compatibility.json": "f9bd750bd7c4af2b1123a41396cfeacac90bb1744f9abdd5331c76260872b70c",
    "apps/architecture-lab/market-calendar-test-compatibility.json": "52e859d4a99bc4c8e4d986f38afea2d58e9c1fe1ee1e0eb62cc2672dbdb60078",
    "apps/architecture-lab/private-recurring-source-adoption.json": "a79c186897851acb93142949fe7aee19184cbfe68b3acdf51cbda084c00c1254",
    "apps/architecture-lab/private-recurring-source.json": "75877d5750e07d1c8172be0af76bc5933f2eeefc22cc39747a2621b9cab24619",
    "apps/architecture-lab/private-recurring-source.mjs": "6a8297614d0f819fda50f765f39ce79bbc61f0c2f90611d3ccd9dd69ed7c459b",
    "apps/architecture-lab/sdk-1.33-compatibility.json": "3e3c8f43813d5c4888e206ac31433f60470eac4310abaa62bd32e1c901a0df3e",
    "apps/architecture-lab/sdk-1.34-compatibility.json": "458ddbf661ce1a5666260a072a03f24ac016346bdd9a9efef7f2a1d497eee403",
    "apps/architecture-lab/test/market-calendar-source.test.mjs": "f0ad19aefa29ded610305c3b196010a911686842ea694e9bb2c10c2d30acd1d0",
    "apps/architecture-lab/test/private-recurring-source.test.mjs": "af7e93f69c80cdef1bd9e277693d3b3b9ab8083d8e8d56afee2061aa7a26cd47",
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": "66e7706c48f4831ec1b0331629bd46f25e48d15e2599a70d7472fcac1a441078",
    "apps/economic-calendar-runtime/market-calendar-preferences-integration.json": "e3bc27ddf22b9165555c05f938a3c5d8f9f4f09334fcb7c55e760da44e9a59b6",
    "apps/identity-runtime/README.md": "f5b66a9294e6c74d2973911779e1ac9b7a3bd898ccd330581885e05e081aa30b",
    "apps/identity-runtime/src/http-handler.ts": "362687ff03605bc908443992844f887aba69d7e263383f2f38893bbb2fca3ca0",
    "apps/identity-runtime/src/main.ts": "5396d018303d3356c73523ee4edfc06ab8725d29c42125c7c8e60087e4345fd4",
    "apps/identity-runtime/src/organisation-draft.ts": "bba7165ae3bbd799778312722725e888b7a33347918f393618c67ca4026b3a4f",
    "apps/identity-runtime/src/organisation-onboarding.ts": "2bd52ce90cbb522cf465298228524ba7f51e87646e3dcbcbbd8ae49a2203ad53",
    "apps/identity-runtime/test/organisation-draft.test.mjs": "128683cefed1ba9ee0dadf271a66320678a2d5babbb4f69c794e8b643a1c0328",
    "apps/identity-runtime/test/organisation-onboarding.test.mjs": "8e63ae4b5b21724f13fa29659f546424804bf63e2ea0568a238a26f365506e8b",
    "apps/insights-runtime/src/publication-query.mjs": "61a3b2b606af726b835a91e4592ea049bf37efaa596ce08bafae59bb74996243",
    "apps/insights-runtime/src/subscription-api.mjs": "0ded6891898033e4a5657c54bace8c56b11e9911a016c593733cd5320d14e327",
    "apps/insights-runtime/src/subscription-store.mjs": "dd159b75554c429660fc04276993fb19e02e8bc794b4d98e26e1ddfae4693a9b",
    "apps/insights-runtime/tests/report-library.test.mjs": "f17dc930fc82e33cb9141257b0965581f5d49e56eb1d686593f7222bacd078c4",
    "apps/insights-runtime/tests/subscriptions.test.mjs": "f3a33986059e5f985478f786c90a532b5d0ea55e87974593baeab62db17822f4",
    "apps/newsfeed-runtime/assistant-context-integration.json": "4057379e02c7b698f3f24348c40b84275d92c3a892b55e96b1c6d23175298dfc",
    "apps/newsfeed-runtime/operation-integration.json": "a8b43f4f6213806843160d4373bb62bfd9357ba03cfbc16865fb2bce266f88f1",
    "apps/newsfeed-runtime/saved-searches-integration.json": "fcfea3ae736cfd3446dac7c70c34f6f59a723a48bdae11234706d76f01652a6c",
    "apps/newsfeed-runtime/test/runtime.test.mjs": "0a1d761d740f11c676f22831adb2f2433df6c78eee8fbfeaa423f4b2b5d23e3a",
    "apps/platform-source-hub/scripts/ci-routing.mjs": "a38f573c142dd835fdfe5293caa0918997a536f116fafafc3f6e202440b5a718",
    "apps/platform-source-hub/test/ci-routing.test.mjs": "ab2c5b6e6b64ba35066ee5651a80be18e2b6ab3d3247bd68a02c28a938696b86",
    "apps/sg-runtime/assistant-context-integration.json": "d932f227977789643086b6a9eb179598a6f48071964b2d26ba82d25fceb7b2ec",
    "apps/sg-runtime/assistant-ecr-integration.json": "5814e2e5cbdf1a32d22cff3aa55de806ec34c9debdecc21ff06c4f9f887a82bc",
    "apps/sg-runtime/assistant-ecr-precision-integration.json": "a017c2b971e3c72606847264150715c983fa9483537d26be90144a64e0377ee7",
    "apps/sg-runtime/assistant-ecr-week-integration.json": "31ce8f1d7e5ca1d9c3aedf80f92e23fe0f1a93cb8f5fd5d003eb54a244859dd4",
    "apps/sg-runtime/assistant-markdown-integration.json": "27ff06aff8bc44592f0073732748834b7759182fa4307d901c7d63304381a38b",
    "apps/sg-runtime/assistant-send-arrow-integration.json": "62c6af6817a022c31788d801cc0eac293a24b3f25d9e529d32b1bff4908fa230",
    "apps/sg-runtime/components/appshell/assistant-conversation-view.tsx": "a4cd2979aa331ec67709b113784043318627c91a29cdb3dcbc886928c8c2aacd",
    "apps/sg-runtime/components/procurement-insights/inline-item.tsx": "4920e9315509d0e053ce50501cdf24ef1c5bddd306ecd1db430f51e495eb297a",
    "apps/sg-runtime/components/procurement-insights/market-calendar.css": "5c7e8db2f6eac2241ab568028a8abcb2ace7fc65fc587ad81cbf3b0b371cb4f0",
    "apps/sg-runtime/components/procurement-insights/market-calendar.tsx": "a712cd3acedf4e4a578aab6934e3c49e9fb35b97307bd6ef80e0c9643532bf34",
    "apps/sg-runtime/components/procurement-insights/reports.tsx": "b888e0b328bd93898e78f526bf9a9f3eb0eef8d61265ff2ac6438b3e2ee45e3e",
    "apps/sg-runtime/components/procurement-insights/workspace.css": "59b202600210bffc554d8417c05c3229ab7380ce865812e6cbc6092197edb9cd",
    "apps/sg-runtime/components/procurement-insights/workspace.tsx": "5b9c9b31b1a9a2787b639b9496cfa4b9aa021304e1734bcf2ade9a6d4341179b",
    "apps/sg-runtime/deployment/assistant-ecr-targets.json": "edc6e1632845f8aa0648dcfed3caf0fddfacc3c6a2ebc06e8c2c1b6ce4f2b8a7",
    "apps/sg-runtime/market-calendar-integration.json": "b66d88e724f84d513677554e77484bc29a2021b238ce28d4b7db7492aba9903c",
    "apps/sg-runtime/middleware.ts": "d8736f570d537e5f9841f5120470f1c46a617233756c12038df0a5a9215c9179",
    "apps/sg-runtime/oil-renderer-integration.json": "6afdd65e66d8a7d8ceb4ab68601ba6d1c1bfac43bbac879d01bb61c9962e7ad6",
    "apps/sg-runtime/operation-integration.json": "453a6e19d6ce19984cec14097eb535f1257a96298c9d27c868ac7ac08f50105e",
    "apps/sg-runtime/package-lock.json": "3a8d14447e21fa9ab879dcd0094b5d8c4401196d2db632bc39540ed66e8440de",
    "apps/sg-runtime/package.json": "2c9b703fb76ae597046aa40b947adb395969a15b688d5f5a08753f2d408851f6",
    "apps/sg-runtime/private-recurring-source-adoption.json": "edf9d51c199251e148b39c92a3084944c1a4b8419be29175c88b6e2583df11f2",
    "apps/sg-runtime/procurement-insights-completion-integration.json": "095ab52d695419d34ed053a6961e389024067a8ab4a16a9b6bb2c379571832a0",
    "apps/sg-runtime/procurement-insights-integration.json": "6dca06d8b0731e585925100b0578d41a61711f335940350d1ea32c296a3d7177",
    "apps/sg-runtime/procurement-insights-shell-integration.json": "1b1279e669e955e604c7c646482a6ce119eac5eeb09491ade78a37aa7fc133a1",
    "apps/sg-runtime/registration-stage-i-integration.json": "4a7a572e67e12ed73c523502cef4cb432009e735737df851419d80898653f414",
    "apps/sg-runtime/tests/assistant-ecr-integrity.mjs": "ce659aa104c58cbbbb9be16b75bc37ff21094515a136c88e57cbf8bd63772e16",
    "apps/sg-runtime/tests/assistant-ecr-integrity.test.mjs": "675c864b0e13e2646553942ef6e0e9416b694baf2666f5e09672873799d9df57",
    "apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs": "53ae9558cb5dac431ae0035a363713dccb2ce59dd61700167fa3a521a6421508",
    "apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs": "27cf7075108a33a7fc52a1ae67fac3b42294c015f6778365eba9fd429c8508b9",
    "apps/sg-runtime/tests/assistant-m1-integrity.mjs": "b172eab829d4b8e3b141e067d10e2effd166725b6a4aee585663c3c9c80d916c",
    "apps/sg-runtime/tests/assistant-m2-integrity.mjs": "a9a761bd0742406f8a36c0ce5f44045d2783bfe505284e34c58057f3f204220e",
    "apps/sg-runtime/tests/assistant-m2-source-view.mjs": "37ff427f894617700e46b5bb70e1f090649c544140c3366bddba6e41d8167031",
    "apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs": "04f9a2b75f9b64b400f34f39cafd35fdd1d895280c1093ec565d7370c885d6cc",
    "apps/sg-runtime/tests/assistant-send-arrow-integrity.test.mjs": "54e91a6ffdf611d5cb49efefb43c42e1c08b36502b59a73c26821c9417412a00",
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": "d236f361ed38a9d5b18e348eca79378b7dcf921eec3eb9613bbfdaa9916d0806",
    "apps/sg-runtime/tests/market-calendar-integrity.mjs": "b1c2086196bb3b7827fb92f54014971692e239a2edc9fa3adc6bb91fedc62e61",
    "apps/sg-runtime/tests/market-calendar-integrity.test.mjs": "498c5c718c6748a02162f2fb078762e355909d4546ac9449b3903f5a51bdaf15",
    "apps/sg-runtime/tests/market-calendar.test.tsx": "46f758d97137fd35dddaae0392049f245335653ac2bdb2c6ec5f89c3e2007482",
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": "ce45cd52dde814db21c746ac8a22902f1405295534dbcc509f4f7f9a98a195fe",
    "apps/sg-runtime/tests/operation-context.test.mjs": "6bfdde26ff7214056c84e6964b05bcbec8fe68ad20799323d53bd41feb77db77",
    "apps/sg-runtime/tests/organisation-sdk-history.test.mjs": "3661d42f176f07c377f45fa582cf9baab844d9924a2cccd2dc64a8d871827eed",
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": "f630a829fd33969020d9cee324cc3a60e7a8da5efdac2d3d3e2e45446bb3b0c3",
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts": "0e3191fd8e47dfc88b4753db8e0cebc999b27d7838e3c4f3b386ffce25b18cfc",
    "apps/sg-runtime/tests/private-host.integration.test.mjs": "2f76d4df55adb4b1e9c391482f3372c45573955c348f5869e2048657476de955",
    "apps/sg-runtime/tests/procurement-insights-completion-integrity.mjs": "0359f3796885e91be502c39465eababadab49e489ae207cf5abde2facf449e4e",
    "apps/sg-runtime/tests/procurement-insights-completion.test.mjs": "69c235e9a74cfc780f600f93b21e359a58adaf8d938e2139858e3980976ed3ed",
    "apps/sg-runtime/tests/procurement-insights-shell-integrity.mjs": "007a689567e7eb179eaae1a2e24077dd7335f8b88fc8cf5b523e8dacb82e6e52",
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": "1bc8fa65799503d8554518aa1c55c98b4e486e2f7a451c51a97d762652fca5fe",
    "apps/sg-runtime/tests/xray-platform-compatibility.test.mjs": "d9602b68580641c217673d27124321ee2590d6cf77ec6f13d215467284cf3c73",
    "apps/srm/app/login/porr-account.tsx": "8c9d56ac4c8487d4382a171db0de7f7328101f8f361b3d8083250ab74012a839",
    "apps/srm/operation-integration.json": "08f2a7f0fa113373f49dc6fc64e6297c40bc81c31d0cb261db29a1f7c61e0fad",
    "apps/srm/private-recurring-source-adoption.json": "88d0252f634eface35b34adf31ac97cbf0d396fcf1fe6da452c74bdc23c7c633",
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": "a09194ec75871198cff53d9307425a82288584b820dba23ba1f1f18cb6455b66",
    "apps/srm/scripts/native-execution-adoption.test.mjs": "ab6fb2df4fcd98d37ff3a981c4bd0dd23b4e0ff22da9c51cd5c6030aa9518f21",
    "apps/srm/scripts/operation-context.test.mjs": "282792e61fdbf1fdc279d6408e4fe5dbe5e66a78f8268d947caa54a183669173",
    "apps/srm/scripts/porr-account-ui.test.mjs": "d27b744dbd0f54e0dfe7ee6986fb65dddc29c3cbe3f0da9cf2de1d5f0b2a39ac",
    "apps/srm/scripts/private-host.integration.test.mjs": "804e2cdafd0a0b8f4a233403df3edb8db4040110b42749cd26c8131a6f03905e",
    "apps/srm/scripts/request-quota-adoption.test.mjs": "4ab4acacc61780797da0993d2faa894089d5094ad5e95362dd0f2d89c5faaa49",
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": "fea4b1fe8d6804a8ecada0de4368c70bd24a11710ef3143ed1be233aac8a80d8",
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": "03e49d0e38c181bfb7c2fe367906de1948554e0e8fc2a2dc24592be0b42b4b6b",
    "apps/srm/scripts/xray-performance-adoption.test.mjs": "8ab92e886689cbe3953e41f06e7d7c934f4e6144c2aee6fb779a18699f1171b8",
    "apps/srm/src/server/peer-read-boundary.test.ts": "fe1ccf72c24460b1e2edc26b44e307fa271de55c5a215b488c6b0592bc93fcd6",
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": "53da443fa12c8830a3940b29fc8f31b6b6fa00a9e9a397c4c9e281eb19470c37",
    "apps/srm/src/server/supplier-location-geocoding-runtime.test.ts": "63ee7b29f2b8d6651be9423a2cbca17b1517a6e35c53b7c53a3b7334080c72c2",
    "packages/platform-contracts/README.md": "36e013b6f6692566004e152020d3d43b38a4567680b5dd0b53677edc519bc1e7",
    "packages/platform-contracts/current-e1-authority/first-party.d.mts": "7e5aa9c6c113387532bb78fac80d5aa42cf95e5599bda64197d2f71a28be31df",
    "packages/platform-contracts/current-e1-authority/first-party.mjs": "3bfe6952dff2d2c407489960d3cc2c9b6bf63d6eb02859462abf1eff86e02eae",
    "packages/platform-contracts/current-e1-authority/index.d.mts": "3c0cf13371421d278f5472f941519608ec73a9aa47bdb93e350c10adc33988af",
    "packages/platform-contracts/current-e1-authority/index.mjs": "f842e8f894b8e4465d509aa6ac2be7e73effc339e86a3bb520b8dd19fd47962d",
    "packages/platform-contracts/current-e1-authority/insights-service.mjs": "5f641f094211733ca18fe82af0a4700dc0b9acbb00a036067d00e4f6834d5da3",
    "packages/platform-contracts/current-e1-authority/install-recurring.mjs": "8374ad340ae9e314b5405f1dbd6fe669c2ad0bad2a8883a84a927fce8bb10f50",
    "packages/platform-contracts/current-e1-authority/migrations/001-authority.sql": "2346e2f1b099e40eb633651530c15bfb2ca109c20fbf6b5a9b98243447afc00d",
    "packages/platform-contracts/current-e1-authority/migrations/002-receiver.sql": "28db9a012f7408e28b3a742abdc7870f80974aef977cf40615bd07216beafc10",
    "packages/platform-contracts/current-e1-authority/migrations/003-first-party-authority.sql": "646bdab4fb112c553bc376107872c1be2610068d80754809aca222513e20f82f",
    "packages/platform-contracts/current-e1-authority/migrations/004-first-party-receiver.sql": "1cc8dff949bf632b7288a705cee13bbf65a8aa5e6eba5a3edfa3d7e694c40938",
    "packages/platform-contracts/current-e1-authority/migrations/005-calendar-authority.sql": "a6615f8cab67bbff19f490604ee02d67b44ed7143bdaa8b51409491ea026a010",
    "packages/platform-contracts/current-e1-authority/migrations/006-calendar-receiver.sql": "d96f386d5aa26d71cd358e9c56ad38fdc686036a6e278cfa53ba04b5b2057445",
    "packages/platform-contracts/current-e1-authority/migrations/007-insights-authority.sql": "30d8534fc1b315bef1d7f8657f69a6476fb23bfe445c96d0684bc04d528380c3",
    "packages/platform-contracts/current-e1-authority/migrations/008-insights-receiver.sql": "e24bf4a2be8cdba0e27fc8d2a03d6c0194dafbfba32f605ea28ff6f30546c5c3",
    "packages/platform-contracts/current-e1-authority/migrations/009-insights-service.sql": "704b130e908078df70902e4fc3572b744d1646b938a1c1e8848b144adfd308c8",
    "packages/platform-contracts/current-e1-authority/migrations/010-ecr-service-continuity.sql": "8ec9e142019f43fce27c962483bb913ff76914043523e80a5cffcd6da8a343a3",
    "packages/platform-contracts/current-e1-authority/migrations/011-ecr-source-continuity.sql": "3f18fa53b7ebcd6c6674a6014dabcda5b87f395cdddeeca1f0edd2df926007d1",
    "packages/platform-contracts/current-e1-authority/migrations/012-recurring-authority.sql": "96856496b273af8fb197cec117a179357d03497a4109e2a16787e12a9d8c85fa",
    "packages/platform-contracts/current-e1-authority/migrations/013-recurring-receiver.sql": "f81922d83dcb2f27c4bea0cdd8c2150c6f585fe64b16ecd96fa9f531db76f6d8",
    "packages/platform-contracts/current-e1-authority/migrations/014-recurring-delivery.sql": "a68531d41f2e1cbd3ac443efbbf7641beec2a263affff6c84f2463dd3d32482e",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "fec4cc17dabea286ff2a803816c51380c8d3ed668a277b6e1bb0d40cfbbe2c51",
    "packages/platform-contracts/current-e1-authority/package.json": "2542f68ab8c599784307d9d42fe3c25dfef1cae1a993ef6bec2310d1c7cded9a",
    "packages/platform-contracts/current-e1-authority/recurring.d.mts": "82bc456fa8c962923ef70414e16573e974daa8f81bd54a1e51605b63c3cf00ee",
    "packages/platform-contracts/current-e1-authority/recurring.mjs": "b1795c5b90f95b07ab0c5b3694a5cf89b219ef79d6bde599c59c1272119ea052",
    "packages/platform-contracts/current-fresh-report/package-lock.json": "a4aa3080a474d5c7190035e61cdfe0626ce90e9cc7d0a3a05db807b944e5e221",
    "packages/platform-contracts/current-fresh-report/package.json": "60efe7d6154fa19a698db403780585e118dd7c7ab0700482592d9045f987d3ca",
    "packages/platform-contracts/current-fresh-report/src/current-fresh-report.d.mts": "2da701f79cb5aaf4447239255a96169b5394f6ddd62713c19b213a240fe39a38",
    "packages/platform-contracts/current-fresh-report/src/current-fresh-report.mjs": "29c8a0fb5d048217afd25a3678c35ff03d0d5a663ba76b338a1e8117875176cb",
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": "8687139600d51ef87b553fd2461aafc5515c225ca7341229b40a03777488d4a7",
    "packages/platform-contracts/migrations/access/001-internal-access.sql": "356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2",
    "packages/platform-contracts/migrations/access/002-module-scope.sql": "c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed",
    "packages/platform-contracts/migrations/access/003-module-audit.sql": "af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac",
    "packages/platform-contracts/migrations/access/004-initial-directory.sql": "7004cc968183fdf1406b143066134138426eecfeaae823a3765321e72a9a4811",
    "packages/platform-contracts/migrations/access/005-service-read.sql": "f7757dc5805b3759959505fa852715e70d207e94bf5d85827db3d52b0a5d0d49",
    "packages/platform-contracts/migrations/access/006-request-reservation.sql": "0af5eed241ad1db08bfed89c95c47ef21a7dbeed0ee54bcccce52164ddcc4127",
    "packages/platform-contracts/migrations/access/007-delegated-jobs.sql": "6a12132efab396e6e647e15d1a9711d0a1bacaaab4482639178acd0258d518cb",
    "packages/platform-contracts/migrations/access/008-platform-ingestion.sql": "14d46ec280e624d79930833b022a46866864557cecbf2e3b55b1a1143fb9d66b",
    "packages/platform-contracts/migrations/access/009-external-call-admission.sql": "69db4ec3787937b24922f7acfc267e5aae400ddc44e0799eff09fa7e6d87e206",
    "packages/platform-contracts/migrations/access/010-external-request-admission.sql": "8244a3a02d4ef5821822a6684023148c41bc9caac355c9f1200215e1a339df79",
    "packages/platform-contracts/migrations/access/011-request-continuation.sql": "d12b2e404cd6a9174f954c233982633076501f7ea493facd0cabf34c709604c1",
    "packages/platform-contracts/migrations/access/012-native-external-transport.sql": "6faff5f258b71cf2525d705c8fcf38c8aef9331c4e8f0bdd6f1af74e6cf76bde",
    "packages/platform-contracts/migrations/access/013-supplier-delegation.sql": "cd12f9b88397da88241499548b8a5977d0aca830ad83c53a1bcf146265503555",
    "packages/platform-contracts/migrations/access/014-delegated-private-phases.sql": "13f4bb374cbfb31604823083261bbc8f5142e88be7443b704c792a232defb6e3",
    "packages/platform-contracts/migrations/access/015-delegated-private-inspection.sql": "00db4ebae666f6cd94475b789fecfbb775c0ebb2d66f87e595d674b827cdf13d",
    "packages/platform-contracts/migrations/access/016-delegated-native-work.sql": "19fb1d9045bccdb3299317b4c5b7df41e361e971c83ab683a55b56d6fbc8e5fe",
    "packages/platform-contracts/migrations/access/017-additional-request-operations.sql": "a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94",
    "packages/platform-contracts/migrations/access/018-public-web-transport.sql": "f334e0efe99aac742ecad53e9cfa4d0199dbd2333a56792c58c387621b5b174d",
    "packages/platform-contracts/migrations/access/019-supplier-location-operations.sql": "34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5",
    "packages/platform-contracts/migrations/access/020-supplier-location-admission.sql": "90ac1d28103f689edc8d11979210ce83cd6218e9f3549f37150fd307d165e9cc",
    "packages/platform-contracts/migrations/access/021-native-soap-transport.sql": "f80ae5a06cfc621e92847f0c197b5b8adfca1b261fbea168488742e85adc2bc2",
    "packages/platform-contracts/migrations/access/022-organisation-location-grants.sql": "88211a1c8e601fe81cb04ad73321f86135f4585e45d3f176f34507e136632e11",
    "packages/platform-contracts/migrations/access/023-current-work-audit-index.sql": "93cb4edee303c3c104eb3cf4fd1be598deebe26256f3a66acf6851b1bcc6561e",
    "packages/platform-contracts/migrations/access/024-unmetered-public-sources.sql": "9fe56c54c22fe54aa4869966cf00e7347e8c0d040b1d3d8110fc7952a78d5e13",
    "packages/platform-contracts/migrations/access/025-form-report-admission.sql": "296ca7ea39f6baeaa9ea5de4846a946e5804a0bc5ff53d0ca52ccaa08eb9e98e",
    "packages/platform-contracts/migrations/access/026-role-source-quotas.sql": "b3e8ec02ccaff27b99d1bb961a7ae3d8df7663e5d6cd20da6bb09647c7dfa6c4",
    "packages/platform-contracts/migrations/access/027-unmetered-supplier-requests.sql": "88c5014db027c40568fcc737acbcf27766bb5db1c434c32ce6c236af859d90ef",
    "packages/platform-contracts/migrations/access/028-api-path-transport.sql": "bd35367f22eccb34dc6c8f62b3a82bfc8947471142fc5daab45a32d67c07707c",
    "packages/platform-contracts/migrations/access/029-market-symbol-transport.sql": "fee0f8738f7ccb8481ce2894b6e5a84792256d5230ef0ef1585fc34ac851d504",
    "packages/platform-contracts/migrations/access/030-assistant-operations.sql": "4cf61265cbff5244dd48484e321f969cb10440d097fcc72d735a34ea861f74b2",
    "packages/platform-contracts/migrations/access/030-model-execution.sql": "196a6e056141cdb1a65626afae8e6091c94d6427d54ff36363d19905c6d0b891",
    "packages/platform-contracts/migrations/access/031-model-execution-long-report.sql": "a034ad1eb21fd3b54061b2a50446c698954c6e82465d18b71b387ecb8587382f",
    "packages/platform-contracts/migrations/access/032-report-model-templates.sql": "c6f5dacb81ecff2b8d270a180efcb59c65e1fdf8cc510acf059544391aeb6dab",
    "packages/platform-contracts/migrations/denial-audit/expire.sql": "8855e8fabaa95758799a54f366654be1e475d9e1f9270b477bcebe33d5ebdd2b",
    "packages/platform-contracts/migrations/denial-audit/private.sql": "a964115f6bf51e4038ad7c63db7b1a741590e86672a66bdba2f9dfb7cc9ee3e1",
    "packages/platform-contracts/migrations/denial-audit/roles.sql": "09ace8f3621d31c4d411a375b1b31f2f6a48a9f53f86da3b5bb4e05b292f692b",
    "packages/platform-contracts/migrations/denial-audit/source.sql": "4712a2cd706219a23eccd3fbf5804f6f8bff9c3c9f1cd9588f1407cb6b2099c8",
    "packages/platform-contracts/migrations/profile/001-user-profile.sql": "a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3",
    "packages/platform-contracts/migrations/profile/002-binding-renewal.sql": "ea8a23a4d9db92587b1be1abde67bfa54cf061b79ce63eae09e96db3da20ee76",
    "packages/platform-contracts/migrations/profile/003-email-delivery.sql": "f8e8ca3ecebaa9bc73f87310e43a93765d516a454e05270606261ded78f95e45",
    "packages/platform-contracts/migrations/profile/004-communication-language.sql": "1fdff82e8d9638338662f898c06b41c54bed6a23fc2fd8dc710bf36687fecd2b",
    "packages/platform-contracts/migrations/profile/005-registration.sql": "78af6bfebf483db2d49df5a11caf7fecfc608ac5768725f20adacdc1079cedd1",
    "packages/platform-contracts/migrations/profile/006-vocative.sql": "6dd18a5b044bd1e7448f4ed298270fa2a37edad8f94374160d333718322f89ab",
    "packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql": "cec63fc31e2ed9caf6a7146bacc0954d7698e784c60284d1695f080c443e7b18",
    "packages/platform-contracts/migrations/profile/008-organisation-create.sql": "4da9e422e95e46c55d592040789b29202b54362dded8cddea356e3f036e1feec",
    "packages/platform-contracts/package-lock.json": "79c75571d479c2519179427f433d72b328a84c7249103b61a419be42227c5a90",
    "packages/platform-contracts/package.json": "27afaea41565e2b2b226adcc91f41a63ccef38dc0b86d221f8567a833e6e834e",
    "packages/platform-contracts/payload-capture/package.json": "fbdbe94b1e7ef3eb628bed8fbe6dfc9c7297669b211fe55b178f748b9cbd3f12",
    "packages/platform-contracts/payload-capture/src/payload-capture.d.mts": "ac8c8399b33ee143a4191530fd7a236f04b6055c437b6a38bf69a888f86d2634",
    "packages/platform-contracts/payload-capture/src/payload-capture.mjs": "7eabea213158e6193c481dcbe2721b98837cfd729ae1af3bac7d2396c950f08f",
    "packages/platform-contracts/readonly-miss-report/README.md": "1512a31ec3d2af928b1c77ea5a26e1b090f4175e614302eb94d59fb215c5ddbc",
    "packages/platform-contracts/readonly-miss-report/package-lock.json": "bcbdc1fbfabcf2094445afcf1e107ce8ebe11e39de1b01e0645b88a62310dc54",
    "packages/platform-contracts/readonly-miss-report/package.json": "c7952cc07a0df9794b9600fa29d4dc91414427bf16b180f1a6446ad3ce7f97d3",
    "packages/platform-contracts/readonly-miss-report/src/readonly-miss-report.d.mts": "84939e1327f7260523f39a7f82385f6285013f8013c0fd8b33675ce676418493",
    "packages/platform-contracts/readonly-miss-report/src/readonly-miss-report.mjs": "ed0337acb60b334faef60273d9913cf9c71c731fbc7ea6b2bf75f85f2e0d9b3d",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": "edbb99d5ade23ee483587d19352602ec55353932128b523655ddd76b509fe57e",
    "packages/platform-contracts/root-atomic-claim/README.md": "e08d5c64e78c02d69e46e059fa0c2147e1998e53f05e9607b8cdf70ca6070224",
    "packages/platform-contracts/root-atomic-claim/migrations/001-root-atomic-claim.sql": "1c1784b3c92753ccc28f7c34af89e26f1784a632859d5dbe45a9f5f3d08f6c0d",
    "packages/platform-contracts/root-atomic-claim/package-lock.json": "e537fea8debcddf68b0b478aa3a2e9f248e4a6c08c7cf68d5a07b08df0624d78",
    "packages/platform-contracts/root-atomic-claim/package.json": "55fd670cdc18f4a3764bfa86958af6dd7273d4cda90e0f6642a8678b9e729f82",
    "packages/platform-contracts/root-atomic-claim/src/root-atomic-claim.d.mts": "955b2d6076a8e5a34ac6add66920fb6d4ec27dfccd1e5308932ae9bfef1c2d75",
    "packages/platform-contracts/root-atomic-claim/src/root-atomic-claim.mjs": "fab1780877f66ba582be74bd3944649628624bfcc62754b0256275236d960398",
    "packages/platform-contracts/src/access-store.d.mts": "90cb7cfb0aa6413382a7936cd9001d533b44de70e622c7e50fbaabee3ea54cd1",
    "packages/platform-contracts/src/access-store.mjs": "f1e6c382e4d91d8ac7f366e755ad918857c710265b6ba3b22ddfd8779e5b0934",
    "packages/platform-contracts/src/assistant-operation-host.d.mts": "32b5e76f35024cacea5a2f3814b8c9d0107054f71399ed7b24204195373531fd",
    "packages/platform-contracts/src/assistant-operation-host.mjs": "776624aae620a5b655c1e8e628f39e488937227ad25bd863b7a87d54f16177bc",
    "packages/platform-contracts/src/assistant-usage.d.mts": "9aedd45fccca1aa51364ff34d147e4be4f4f7562945ce31787d19a13c0b6504e",
    "packages/platform-contracts/src/assistant-usage.mjs": "89aeb035a96f5e425c6914c1f174cd1662c9c94b2f161db29f60b093e1f2189b",
    "packages/platform-contracts/src/clerk-configuration.d.mts": "f81af5115df7054bb131ec95a63eb7cb6316744052fea8098492e762caa46f08",
    "packages/platform-contracts/src/clerk-configuration.mjs": "1c9b688960d6fa9a1875195cac6d2d9a9c07a03c41f37c56623a4179b35171e2",
    "packages/platform-contracts/src/current-human-read.d.mts": "0b3858e217511522ae8be2df5b8ff9f433ce360c435056ae4ef7055631f9f17d",
    "packages/platform-contracts/src/current-human-read.mjs": "81a8977e119d1c844812c6598ac79024530830e3eaed5e57cbfa2a45f4379325",
    "packages/platform-contracts/src/database-lease.mjs": "0d6d6366ea12b48d3f06cbaffb5f2ce6b3dacdb4617ab41e346ae28344774183",
    "packages/platform-contracts/src/delegated-job.d.mts": "ad19381623d2a8bd31baac9a2bfa667026e79bffd2ab3c6bf97b585389d012c2",
    "packages/platform-contracts/src/delegated-job.mjs": "c40206b03e24ee1d2b719fda4bd37f573f6e568dd51f97fb6c9b2a3cdbde5772",
    "packages/platform-contracts/src/development-context.d.mts": "5b9f8bde428fa8dd65b7cc515f2b2e0485d6aced4709f257e215ae724e9975a4",
    "packages/platform-contracts/src/development-context.mjs": "7b82e5d3fe3fc0e3826c6b165c9bcdd7b1ffd5505a1380e3dc6a86a5bc481013",
    "packages/platform-contracts/src/diagnostic-phase.d.mts": "51497cfa548f7a4876c4884b7b139e907ee4a8526ce37a400c9bff6d48376ea7",
    "packages/platform-contracts/src/diagnostic-phase.mjs": "0317fa7ef0d95c7574c1b0143094012f75876dee0b3fcd4602ee1a1a17f2bc07",
    "packages/platform-contracts/src/embedded-channel-core.mjs": "337530ea6df1387b9383065ac65b8f55f90afaa598f85ec9ad1628480335911a",
    "packages/platform-contracts/src/embedded-command-channel.d.mts": "d137964bc0ca86ab3908313b0837a5f3ec3b4d461a674e1029c37b040a733389",
    "packages/platform-contracts/src/embedded-command-channel.mjs": "ea67d7d0ed9bdcd5739e6d42493e0457688af2c9d87db153f6fefcbe5bb8dc78",
    "packages/platform-contracts/src/embedded-read-channel.d.mts": "79cd32e83cfa19e13fc3ebfd874cf0b45cde53213d4c5438c7a63cbb99a5ccaa",
    "packages/platform-contracts/src/embedded-read-channel.mjs": "d134041c197a7fb3c7653810c18b27c65e001733f156cd489ecc1ef7b2fd5a89",
    "packages/platform-contracts/src/external-call.d.mts": "043c43ce8027305e36a9b9684bb8b390ffceb813a08cf07b97614d2361545bbe",
    "packages/platform-contracts/src/external-call.mjs": "7681dc9521f93c8769a943f66b192550c60e46658903b44d97aca007645c43a8",
    "packages/platform-contracts/src/identity-profile-sql.mjs": "20b0d3ebeb2fbe3b37b5c2deab75e226d250275be1249de204058e8a7930d259",
    "packages/platform-contracts/src/identity-provider.d.mts": "1a91eccce21baa063cbb508f1df34d19287d49e05e3182cda0fb1f643ec15734",
    "packages/platform-contracts/src/identity-provider.mjs": "1fc428a14196509a6493d96404e5f4c3ff9fc0fdfdcecfebcf8f18394e6a68c3",
    "packages/platform-contracts/src/identity-provisioning.d.mts": "77ad3313ebb337a37e1ddb4af15ed6ecbad8fb198f5cbcbba57ba4fb26196289",
    "packages/platform-contracts/src/identity-provisioning.mjs": "e6082719dc27405100326cf285f1d216ba08e2e59ef80b8fe42eff5b95b7c45b",
    "packages/platform-contracts/src/identity-renewal.d.mts": "9d4fb57b174f64ee21fba13ff9e8f5a07f2a46d44725c0820eb56af6c144e4dd",
    "packages/platform-contracts/src/identity-renewal.mjs": "01e869250f5bab3c9b10fbc6f25aef3f7c06aa8e8572b3559a681739607318ca",
    "packages/platform-contracts/src/model-execution.d.mts": "347864802b2ae361ed50b08ea55cfb2ad2688a672eb0bc4fce29ad69a02614f1",
    "packages/platform-contracts/src/model-execution.mjs": "bab7297f4835a3c87d581d2b9c8f54cc15c3d9b5e629d0e43f7de3a97d1d84e0",
    "packages/platform-contracts/src/module-scope.d.mts": "123d4b08864acbb2dc2509f3fbad21fd50f1b5d0e42ca00f6f21b2275d280db6",
    "packages/platform-contracts/src/module-scope.mjs": "0dd5d00dc1571b3712fbe42d04fbada7a655bf29af2e89ff3812ff575ac3d629",
    "packages/platform-contracts/src/native-external-transport.d.mts": "165a7ea0703ec31b1af89ed8b980a215ddee2fb181dbbe1498a5bea77cbd44da",
    "packages/platform-contracts/src/native-external-transport.mjs": "09c6595500f5b10fbf16b57b460c2064fe573bf6f1e1b754b3b39a9e53e40c9b",
    "packages/platform-contracts/src/operation-context.d.mts": "bb5a7d25e02d7f30d169697a2db202a567363031f889044d293f237c30a3588f",
    "packages/platform-contracts/src/operation-context.mjs": "e4a09838907176171b09303092c1916cb78620f99f5cfce098b9896a0d945764",
    "packages/platform-contracts/src/organisation-bootstrap.d.mts": "80a7ecc043ee71bf96c000167c32d67759ab878ed274c8ee41d56986f5c056a1",
    "packages/platform-contracts/src/organisation-bootstrap.mjs": "15b08b09019d9d34c89dd0df3966f3859d67823fe09f380722384ef64a151941",
    "packages/platform-contracts/src/organisation-invitations.d.mts": "e20325e5903b0a529604bb2e45a6f6caade74eec9288c6149031e546436e70b6",
    "packages/platform-contracts/src/organisation-invitations.mjs": "4ef4077e77b5c0870ebfb3cb316001d4c3c7eb67c6ecd93998453dcc174eda4f",
    "packages/platform-contracts/src/organisation-profile.d.mts": "f5e134b1c43b773d2a399ad0e5dce9cbff4e90ed1639eaeb64568a75d5b521f1",
    "packages/platform-contracts/src/organisation-profile.mjs": "da6b8101bcc23d6a7edebf2f3bd8d12985159d452657317f24c0d0d19ac2b582",
    "packages/platform-contracts/src/peer-operation.d.mts": "a3f6d6463bc508475674667f3abb5b136a1cb4d2b0bbafa1c4eb5974c935f6b5",
    "packages/platform-contracts/src/peer-operation.mjs": "316282f0b9b76c927427c62cdbd2dbda2c917457dfd91e280e652b89bde36a10",
    "packages/platform-contracts/src/platform-ingestion.d.mts": "4335070ca01216b5ce651264f72328b24483d66a850feffbf7dfe14f5b4161d0",
    "packages/platform-contracts/src/platform-ingestion.mjs": "4159bcd2bdc6de7e32e573461ac07d73572d0ab9c4d9bf6aafc1b3fe41036a1f",
    "packages/platform-contracts/src/private-operation-host.d.mts": "248a3b60f525afb102c7aaaf230c6d10fde6793dcbb71c94e1f9b9db9ee57897",
    "packages/platform-contracts/src/private-operation-host.mjs": "8de0db0d5cc2e0e5fd0fdaf0583c4bb1d89fbaeb3170be33aa732720591e2034",
    "packages/platform-contracts/src/public-request.d.mts": "c92a6faa2764eb7d40671971abc531cf72b92f1c12d74f30be3f4f54c632722b",
    "packages/platform-contracts/src/public-request.mjs": "7d23cbe9ee5742f9305ff4c97c76254ea1cba55dd64594864a5536b2bea1de6b",
    "packages/platform-contracts/src/public-web-transport.d.mts": "9d386895e800bf5fc42135d9e0dd152e5596c86938954e47c694509122ee8f35",
    "packages/platform-contracts/src/public-web-transport.mjs": "ba32dd4cc97b7e6de9290c1047242cf793484e03e5817b5b301759a55bf2e9c7",
    "packages/platform-contracts/src/recurring-job.d.mts": "a6333cde217596c4b957cfa62052c109911f8f30b7c383a892180aa9d8f668a4",
    "packages/platform-contracts/src/recurring-job.mjs": "35577567eb2ead8ffc751c03795d535d302dd623182ec2202442291effba291b",
    "packages/platform-contracts/src/report-admission.d.mts": "397f8c861e85215587c4bc88e696908ec0d4f50ca6917cd2e74f6df9163100c5",
    "packages/platform-contracts/src/report-admission.mjs": "60752635661a60fb1fc18f44656cff3a3052b6488d4ce9be94e277966e6d10a7",
    "packages/platform-contracts/src/request-continuation.d.mts": "a2d587a34766a3d3fd27838261ec9d0a258252fbd81e4c6d116bc4dbb2afa45f",
    "packages/platform-contracts/src/request-continuation.mjs": "a6ff274d4f780f961789be9bf4e87b07db0ee9335e0acff86bff13f0c15b4ed8",
    "packages/platform-contracts/src/request-inspection.d.mts": "dcf7335c34e9437fd63c492b0af0458bb346104d5af07f32421e8181b6ef90f9",
    "packages/platform-contracts/src/request-inspection.mjs": "8a3006c80be2ba8df0357592981ab6fd6a9172067ff3c16d300a0b76aafc8c59",
    "packages/platform-contracts/src/request-ledger.d.mts": "6bc6786ddee0e5b410959061a7bf4464f7a4eca5e8c887731693b39f15478697",
    "packages/platform-contracts/src/request-ledger.mjs": "07118e6e21ae7074c7f01aca800d56e9aa0464a51c7c7562d640cb16864c0f41",
    "packages/platform-contracts/src/request-operations.d.mts": "df96b4da0f7f92f6d2e6d710451325b21b6037ab701dfc9fa4e698f63559adbd",
    "packages/platform-contracts/src/request-operations.mjs": "5f157b92e630f1f0720e3c920dad55696368058fa1e4d6574178bcb927192c9f",
    "packages/platform-contracts/src/request-work.d.mts": "1413741b67e20e11ec8e26755e054857ab2d0efea92a9a65f839516acbf1a1b8",
    "packages/platform-contracts/src/request-work.mjs": "45e849b3bb4bd1c50cd0e1296588f2de6562c9ab0cbcd99f3ab989540f5fd73b",
    "packages/platform-contracts/src/sg2-denial-audit-reader.mjs": "92625af7db8ada25e8226f4f31db5845bca2a93151b0232325f76d68fae88170",
    "packages/platform-contracts/src/supplier-location.d.mts": "627a809c7ccb0104ca37cb6f93b959cb09a458ad29503f6518d5baf2998084b4",
    "packages/platform-contracts/src/supplier-location.mjs": "41fcd54d03bbf42e7d448f34ab63b6c054e02b18266be5d0c0e4cafc0711461b",
    "packages/platform-contracts/src/user-profile.d.mts": "ece7aaa04d9100fd4379038995454e3a2b46da9d21b7def98ac2bb5817b6b94a",
    "packages/platform-contracts/src/user-profile.mjs": "9933887cbfabaa5c709e00d013274eb0ad344e56192456d5e9c622c461202347",
    "packages/platform-contracts/src/vocative-dictionary.mjs": "e767aaaacb020b959bb16221c1c70e7e78bbb34c1ebf793e96a4b4cd1e01ad47",
    "packages/platform-contracts/test/external-call.test.mjs": "3107f59bdf15198448894f0f20f4b86fdd534028b91d1ce94a23696b346654a1",
    "packages/platform-contracts/test/operation-context.test.mjs": "f00169504167c1b208cd0b51f2f2d7927fcffed33a70480cd3980d21c44f3e80",
    "packages/platform-contracts/test/organisation-bootstrap-postgres.test.mjs": "15165c930440ceb7cbe7dbfdd0263637951f31b83c0a33d01a1f065d7dd1fd08",
    "packages/platform-contracts/test/organisation-bootstrap.test.mjs": "ed13fb983ef78aeab7210ebb26a122af8ba96d0529769c1db6fa8458bcfc690d",
    "packages/platform-contracts/test/organisation-invitations.test.mjs": "2deaad88c6b70f57e8cb72d98221f58c976afa1fcf029868d67191289e6e7ed2",
    "packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs": "fd9d06252c3342d956d0db0755a3200660b6db9ac9d458fa1c6162935627248e",
    "packages/platform-contracts/test/organisation-profile.test.mjs": "3a6ddbf6ee633a7245d14608792ec412d5acd3c72879e0104e3105476990091c",
    "packages/platform-contracts/test/organisation-sdk-compatibility.json": "022f0a4c774cc93856c7219518ac99d23712cd3961bab508fa0d2b25c9113ea1",
    "packages/platform-contracts/test/private-operation-host.test.mjs": "604a1459b33a8b45ec76f3af21974459d481bc48197f9894b2d203553f62b287",
    "packages/platform-contracts/test/recurring-consent-transport-source.json": "0c9ffe5bfd89cf2bd65cd9adc7ad241a04e7468b5821f97171f4a6c550aaba36",
    "packages/platform-contracts/test/recurring-consent-transport-source.mjs": "cdd6edb2f7018545ad60dd62b2b8fee2d46de01c7123e8a4d5f1aaac32df816d",
    "packages/platform-contracts/test/recurring-consent-transport.test.mjs": "20bcb51d4f35e82e889eaee49c1d006f047f46452225ea708b24b40b768538c2",
    "apps/architecture-lab/market-calendar-source.mjs": "8f57073b55c1233c4573e54185e352d6400d7baa47bd5303fefb7b893b123847",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "dadd4f9fcc5be03afee02ae51038efa48b07b3f9b2b62e9476a7b288c1d42d77",
    "Canon/evidence/2026-11-12-bsdc-v11-manifest-continuity.json": "92fe69f99bbda13a9971d841cc391207d9e7944ccc516a68d9cc48b7a9151160"
  },
  "acceptedMainDigests": {
    "apps/architecture-lab/market-calendar-test-compatibility.json": "52e859d4a99bc4c8e4d986f38afea2d58e9c1fe1ee1e0eb62cc2672dbdb60078",
    "apps/architecture-lab/private-recurring-source-adoption.json": "a79c186897851acb93142949fe7aee19184cbfe68b3acdf51cbda084c00c1254",
    "apps/architecture-lab/private-recurring-source.json": "75877d5750e07d1c8172be0af76bc5933f2eeefc22cc39747a2621b9cab24619",
    "apps/architecture-lab/private-recurring-source.mjs": "f89a8527e2ffda7531a2dae4be3202b0a267e093591a8dec610cb13e114dd3a9",
    "apps/architecture-lab/test/market-calendar-source.test.mjs": "2c68bd444e13b16c171100fc3c2f3a786ed6cad2fc896eff4ad463b4d9feac27",
    "apps/economic-calendar-runtime/market-calendar-preferences-integration.json": "e3bc27ddf22b9165555c05f938a3c5d8f9f4f09334fcb7c55e760da44e9a59b6",
    "apps/insights-runtime/src/publication-query.mjs": "61a3b2b606af726b835a91e4592ea049bf37efaa596ce08bafae59bb74996243",
    "apps/insights-runtime/src/subscription-api.mjs": "0ded6891898033e4a5657c54bace8c56b11e9911a016c593733cd5320d14e327",
    "apps/insights-runtime/src/subscription-store.mjs": "dd159b75554c429660fc04276993fb19e02e8bc794b4d98e26e1ddfae4693a9b",
    "apps/insights-runtime/tests/report-library.test.mjs": "f17dc930fc82e33cb9141257b0965581f5d49e56eb1d686593f7222bacd078c4",
    "apps/insights-runtime/tests/subscriptions.test.mjs": "f3a33986059e5f985478f786c90a532b5d0ea55e87974593baeab62db17822f4",
    "apps/newsfeed-runtime/assistant-context-integration.json": "4057379e02c7b698f3f24348c40b84275d92c3a892b55e96b1c6d23175298dfc",
    "apps/newsfeed-runtime/operation-integration.json": "a8b43f4f6213806843160d4373bb62bfd9357ba03cfbc16865fb2bce266f88f1",
    "apps/newsfeed-runtime/saved-searches-integration.json": "fcfea3ae736cfd3446dac7c70c34f6f59a723a48bdae11234706d76f01652a6c",
    "apps/platform-source-hub/scripts/ci-routing.mjs": "39da4bc9fc2045ba03163c4030ca3aaa382dd6c5b1ddf7b207b6239f02134a85",
    "apps/platform-source-hub/test/ci-routing.test.mjs": "cb055b84ae1cf587bd34fcd9d8db16d0c6992f8426281680706d4682800943c8",
    "apps/sg-runtime/assistant-context-integration.json": "d932f227977789643086b6a9eb179598a6f48071964b2d26ba82d25fceb7b2ec",
    "apps/sg-runtime/assistant-ecr-integration.json": "5814e2e5cbdf1a32d22cff3aa55de806ec34c9debdecc21ff06c4f9f887a82bc",
    "apps/sg-runtime/assistant-ecr-week-integration.json": "31ce8f1d7e5ca1d9c3aedf80f92e23fe0f1a93cb8f5fd5d003eb54a244859dd4",
    "apps/sg-runtime/assistant-markdown-integration.json": "27ff06aff8bc44592f0073732748834b7759182fa4307d901c7d63304381a38b",
    "apps/sg-runtime/assistant-send-arrow-integration.json": "62c6af6817a022c31788d801cc0eac293a24b3f25d9e529d32b1bff4908fa230",
    "apps/sg-runtime/components/procurement-insights/inline-item.tsx": "4920e9315509d0e053ce50501cdf24ef1c5bddd306ecd1db430f51e495eb297a",
    "apps/sg-runtime/components/procurement-insights/reports.tsx": "b888e0b328bd93898e78f526bf9a9f3eb0eef8d61265ff2ac6438b3e2ee45e3e",
    "apps/sg-runtime/components/procurement-insights/workspace.css": "59b202600210bffc554d8417c05c3229ab7380ce865812e6cbc6092197edb9cd",
    "apps/sg-runtime/components/procurement-insights/workspace.tsx": "5b9c9b31b1a9a2787b639b9496cfa4b9aa021304e1734bcf2ade9a6d4341179b",
    "apps/sg-runtime/oil-renderer-integration.json": "6afdd65e66d8a7d8ceb4ab68601ba6d1c1bfac43bbac879d01bb61c9962e7ad6",
    "apps/sg-runtime/operation-integration.json": "a6bf50993c98a71aeccd349dd904baafb53b3cd653324d97bab3fc5e34ac509f",
    "apps/sg-runtime/package.json": "2c9b703fb76ae597046aa40b947adb395969a15b688d5f5a08753f2d408851f6",
    "apps/sg-runtime/private-recurring-source-adoption.json": "edf9d51c199251e148b39c92a3084944c1a4b8419be29175c88b6e2583df11f2",
    "apps/sg-runtime/procurement-insights-completion-integration.json": "095ab52d695419d34ed053a6961e389024067a8ab4a16a9b6bb2c379571832a0",
    "apps/sg-runtime/procurement-insights-integration.json": "6dca06d8b0731e585925100b0578d41a61711f335940350d1ea32c296a3d7177",
    "apps/sg-runtime/procurement-insights-shell-integration.json": "1b1279e669e955e604c7c646482a6ce119eac5eeb09491ade78a37aa7fc133a1",
    "apps/sg-runtime/registration-stage-i-integration.json": "4a7a572e67e12ed73c523502cef4cb432009e735737df851419d80898653f414",
    "apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs": "297a0eaa12b5782d124c578d7766c9e6345e9acff65936dc8abd4c4f8bf72b41",
    "apps/sg-runtime/tests/market-calendar-integrity.test.mjs": "09e8c1161148a0b40dd60f68ea81f5d390689cd7f3ab3ede9be89c18d3dca32d",
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": "aab40510f409559e3a023c53e069ca5c50bf1bd3bb6a5dd9f2f9e2e177f3caa7",
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts": "79e186a98cf1d964330cdbe2f9c13add1b30bdf703ef865a310812d295c3d820",
    "apps/sg-runtime/tests/procurement-insights-completion-integrity.mjs": "0359f3796885e91be502c39465eababadab49e489ae207cf5abde2facf449e4e",
    "apps/sg-runtime/tests/procurement-insights-completion.test.mjs": "ea0b0cba039ff6555cd94f7ff9c9495a37e71e15603209efa40896a0f2d39429",
    "apps/sg-runtime/tests/procurement-insights-shell-integrity.mjs": "007a689567e7eb179eaae1a2e24077dd7335f8b88fc8cf5b523e8dacb82e6e52",
    "apps/srm/operation-integration.json": "1303ac82c0570ca4929f64e1620e2ec7a6bfd3809607f57eb33da621c8ecd06d",
    "apps/srm/private-recurring-source-adoption.json": "88d0252f634eface35b34adf31ac97cbf0d396fcf1fe6da452c74bdc23c7c633",
    "apps/srm/scripts/private-host.integration.test.mjs": "5aa33ff01ae8e6ebadf55d4cd460a5b8b8efa39c9181e09d821507db8dab1c33",
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": "bff94cdbd24cb1eac6d5c8ad3bc9b585eeada63b3c47e3433f6f6b2b3edb2e78",
    "packages/platform-contracts/current-e1-authority/recurring.mjs": "b1795c5b90f95b07ab0c5b3694a5cf89b219ef79d6bde599c59c1272119ea052",
    "packages/platform-contracts/test/recurring-consent-transport-source.json": "0c9ffe5bfd89cf2bd65cd9adc7ad241a04e7468b5821f97171f4a6c550aaba36",
    "packages/platform-contracts/test/recurring-consent-transport-source.mjs": "cdd6edb2f7018545ad60dd62b2b8fee2d46de01c7123e8a4d5f1aaac32df816d",
    "packages/platform-contracts/test/recurring-consent-transport.test.mjs": "45fe37eb2d44e73705fc0612c927da53a34796abd8593335182a61f4b4dc45b4"
  },
  "absentFromRegistration": [
    "apps/insights-runtime/src/publication-query.mjs",
    "apps/insights-runtime/tests/report-library.test.mjs",
    "apps/sg-runtime/procurement-insights-completion-integration.json",
    "apps/sg-runtime/procurement-insights-shell-integration.json",
    "apps/sg-runtime/tests/procurement-insights-completion-integrity.mjs",
    "apps/sg-runtime/tests/procurement-insights-completion.test.mjs",
    "apps/sg-runtime/tests/procurement-insights-shell-integrity.mjs",
    "packages/platform-contracts/test/recurring-consent-transport-source.json",
    "packages/platform-contracts/test/recurring-consent-transport-source.mjs",
    "packages/platform-contracts/test/recurring-consent-transport.test.mjs"
  ],
  "acceptedContinuations": [
    {
      "sourceSha": "09a39f3ac3cad19b12d525168f9c719ff842e8cc",
      "sourceDigests": {
        "apps/architecture-lab/market-calendar-source.mjs": "8f57073b55c1233c4573e54185e352d6400d7baa47bd5303fefb7b893b123847",
        "scripts/governance/platform-source-hub-foundation.test.mjs": "dadd4f9fcc5be03afee02ae51038efa48b07b3f9b2b62e9476a7b288c1d42d77",
        "Canon/evidence/2026-11-12-bsdc-v11-manifest-continuity.json": "92fe69f99bbda13a9971d841cc391207d9e7944ccc516a68d9cc48b7a9151160"
      }
    }
  ]
})

/** Exact test-only composition of the accepted registration and PI main graphs.
 * Raw current inputs are closed before either immutable view is exposed. */
function registrationMainComposition(current,historical){
 let transportBytes;try{transportBytes=current('packages/platform-contracts/test/recurring-consent-transport-source.json')}catch(error){
  const message=String(error?.stderr??error?.message??'');
  if(error?.code==='ENOENT'||error?.status===128&&message.includes('recurring-consent-transport-source.json')&&/does not exist|exists on disk/.test(message))return null;throw error;
 }
 if(hash(current('packages/platform-contracts/test/organisation-sdk-compatibility.json'))!==mainComposition.registrationRecordSha256)return null;
 assert.equal(hash(transportBytes),mainComposition.transportRecordSha256,'exact accepted parallel transport record');
 for(const[p,digest]of Object.entries(mainComposition.physicalDigests))assert.equal(hash(current(p)),digest,(p.startsWith('apps/sg-runtime/tests/')?'current SG2 acceptance ':'current composed registration/PI source ')+p);
 for(const[p,digest]of Object.entries(mainComposition.acceptedMainDigests))assert.equal(hash(historicalSource(historical,mainComposition.acceptedMainSha,p)),digest,'immutable accepted parallel source '+p);
 for(const continuation of mainComposition.acceptedContinuations)for(const[p,digest]of Object.entries(continuation.sourceDigests))assert.equal(hash(historicalSource(historical,continuation.sourceSha,p)),digest,'immutable accepted continuity '+p);
 const documentation=bsdcManifestContinuityCurrent(current,historical);
 const mainView=p=>historicalSource(historical,mainComposition.acceptedMainSha,p);
 const transport=recurringConsentTransportPredecessor(mainView,historical);assert(transport,'accepted transport closure required');
 const completion=procurementInsightsCompletionPredecessor(mainView,historical);assert(completion,'accepted PI closure required');
 const mapped=new Set(mainComposition.projectedPaths);
 const absent=new Set(mainComposition.absentFromRegistration);const registration=p=>{if(absent.has(p))throw Object.assign(Error('Parallel addition absent from registration predecessor'),{code:'ENOENT'});return mapped.has(p)?historicalSource(historical,mainComposition.registrationSourceSha,p):documentation(p)};
 return {registration,transport,completion,acceptedMain:mainView,physicalDigests:mainComposition.physicalDigests};
}

export function sdkContinuationPredecessor(receipt,current,historical,{projectKey='SG2',validatePeer=true}={}){
 assert(['SG2','SRM'].includes(projectKey))
 const lifecycle=organisationLifecycleSdkPredecessor(current,historical,{projectKey})
 if(lifecycle){const previous=sdkContinuationPredecessor(receipt,lifecycle.previousBytes,historical,{projectKey,validatePeer});assert(previous,'complete prior SDK source closure required');return {...previous,lifecycle,currentSourceDigests:lifecycle.currentSourceDigests}}
 const frames=receipt.sdkSourceContinuations
 if(frames===undefined)return null
 const composition=registrationMainComposition(current,historical)
 if(composition){
  const previous=sdkContinuationPredecessor(receipt,composition.registration,historical,{projectKey,validatePeer})
  assert(previous,'original complete registration frame required')
  return {...previous,currentSourceDigests:composition.physicalDigests,composition}
 }

 assert(Array.isArray(frames)&&frames.length===1,'closed supported source continuation sequence')
 const frame=frames.at(-1);exactKeys(frame,['schemaVersion','acceptanceId','taskId','targetEnvironment','previousReceiptSha256'],'closed receiver source frame')
 assert.equal(frame.schemaVersion,'1.0');assert.equal(frame.taskId,tasks[projectKey]);assert.equal(frame.targetEnvironment,'development')
 const entry=known[frame.acceptanceId];assert(entry,'reviewed SDK continuation required')
 const recordBytes=cloneBytes(current(entry.path));assert([entry.sha256,...(entry.successorSha256s??[])].includes(hash(recordBytes)),'exact organisation SDK source acceptance')
 const record=JSON.parse(recordBytes);verifyRecord(record,current,historical,hash(recordBytes))
 assert.equal(frame.acceptanceId,record.acceptanceId)
 const file=receiptPath(projectKey),actual=JSON.parse(current(file));assert.deepEqual(receipt,actual,'receiver metadata must be the current source view')
 const priorBytes=cloneBytes(historicalSource(historical,record.previousSourceSha,file));assert.equal(hash(priorBytes),frame.previousReceiptSha256,'immutable previous receiver bytes')
 const prior=JSON.parse(priorBytes),preserved=structuredClone(receipt);delete preserved.sdkSourceContinuations
 assert.deepEqual(preserved,prior,'all prior acceptance fields remain unchanged')
 const peer=projectKey==='SG2'?'SRM':'SG2',peerFile=receiptPath(peer)
 if(validatePeer){
  const other=JSON.parse(current(peerFile));assert.equal(other.sdkSourceContinuations?.at(-1)?.acceptanceId,frame.acceptanceId,'paired receiver adoption')
  sdkContinuationPredecessor(other,current,historical,{projectKey:peer,validatePeer:false})
 }
 const mapped=new Set([...Object.keys(record.sourceDigests),...Object.keys(record.compatibilityTestSourceDigests),
  ...Object.values(record.consumerSourceDigests).flatMap(v=>Object.keys(v)),...(record.platformVersion==='1.36.0'?Object.keys(reconciledSourceOverlay):[]),file,peerFile])
 const parallelProfile=parallelEcrWeekFrames[hash(recordBytes)]
 const calendar=verifiedCalendarPredecessor(record,current,historical,hash(recordBytes))
 const calendarCurrent=calendar?.previousBytes??current
 const parallel=parallelProfile?verifiedParallelEcrGuards(record,calendarCurrent,historical,parallelProfile):null
 const cache=new Map([[file,priorBytes],...(parallel??[])])
 return {record,prior,...(calendar?{calendarCurrent:calendar.current}:{}),previousBytes:inputPath=>{
  const path=posix.normalize(inputPath)
  assert(!posix.isAbsolute(path)&&path!=='..'&&!path.startsWith('../'),'source path remains inside the repository')
  if(!mapped.has(path))return calendarCurrent(inputPath)
  if(!cache.has(path))cache.set(path,cloneBytes(historicalSource(historical,record.previousSourceSha,path)))
  return Buffer.from(cache.get(path))
 }}
}
const currentBytes=path=>fs.readFileSync(new URL(path,root))
const historicalBytes=(sha,path)=>execFileSync('git',['show',sha+':'+path],{cwd:root,stdio:['ignore','pipe','pipe']})
/** Exact current digests alongside immutable historical acceptance. Tests must
 * compare actual runtime fingerprint functions to this verified successor.
 */
export function acceptedSdkSource(){
 const receipt=JSON.parse(currentBytes(receiptPath('SG2')))
 const continuation=sdkContinuationPredecessor(receipt,currentBytes,historicalBytes)
 if(continuation)return continuation.lifecycle?.currentRecord??continuation.record
 const previous=receipt.oilAutonomousReportCompatibility??receipt.assistantM1SourceCompatibility
 assert(previous?.sdkDigests&&previous?.optionalPackageDigests,'existing accepted SDK source required')
 return {sdkDigests:previous.sdkDigests,optionalPackageDigests:previous.optionalPackageDigests}
}
