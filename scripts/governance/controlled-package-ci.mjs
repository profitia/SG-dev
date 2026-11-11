#!/usr/bin/env node
// Trusted-main CI controller. Never import candidate JavaScript while credentials exist.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync, spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {resolveProjectProfile} from './project-profile.mjs'
import {resolveProjectRouting} from './routing-engine.mjs'

export const REPOSITORY = 'profitia/SG-dev'
export const WORKFLOW = '.github/workflows/platform-contracts-ci.yml'
export const ARTIFACT = 'sg2-controlled-operation-proof'
// Candidate namespace is not a governance profile or deployment permission.
// Every candidate still proves the SAME SG2 consumer at its exact source.
export const CONTROLLED_CANDIDATE_PREFIXES = Object.freeze(['sg2/', 'srm/', 'architecture/'])
const eligibleCandidateBranch = ref => typeof ref === 'string' && CONTROLLED_CANDIDATE_PREFIXES.some(prefix => ref.startsWith(prefix) && ref.length > prefix.length)
export const PRIVATE_PACKAGES = Object.freeze(['@profitia/advisory-widget', '@profitia/cic-core', '@profitia/cic-procurement'])
// One published CIC artifact accepted by the M1 owner; names and token scope
// remain unchanged. No floating version, registry or alternate artifact.
export const CIC_ANALYTICAL_PIN=Object.freeze({version:'1.3.0',resolved:'https://npm.pkg.github.com/download/@profitia/cic-core/1.3.0/b66e166cf5dd698796036ea5ccfedea4fe24ec19',integrity:'sha512-RnA24q7wPkz1cqXUA7g6JfS2uZnLQg3GfXzyihvzvQh2r+DgTwb4z/3v/uCtW63xSvl4GX7ur8pBUuGldEzWBA=='})
// Exact M2 publication; the M1 pin remains accepted independently. Same
// package name, registry and read-only credential phase, without new access.
export const CIC_ANALYTICAL_M2_PIN=Object.freeze({version:'1.5.1',resolved:'https://npm.pkg.github.com/download/@profitia/cic-core/1.5.1/5576c0f96f4a994bf94e056bd1695aadc9cde0bf',integrity:'sha512-8W0RGrX/ghLrM/u2nYxSWBcdcNnjyNpoaGRcBr8BwuAVchTyR9UEIG1gwjdSS33+Mr9ZJF5IuqHghjxtE9BSQg=='})
export const CIC_ANALYTICAL_ECR_PIN=Object.freeze({version:'1.6.0',resolved:'https://npm.pkg.github.com/download/@profitia/cic-core/1.6.0/6201251ccac36d5d207f87dfdd40a1547c351753',integrity:'sha512-F2Kkx37hkbqaa8JKkChrrpLsK/9C92lJYwxw5Rl2s97MZZsLfaQCQQmwjwKvwoj34YdIT7tbZ1TOElhf63GckQ=='})
const analyticalPins=Object.freeze([CIC_ANALYTICAL_PIN,CIC_ANALYTICAL_M2_PIN,CIC_ANALYTICAL_ECR_PIN])
export const LOCAL_PACKAGES = Object.freeze({
  '@profitia/platform-contracts': '../../packages/platform-contracts',
  '@profitia/sg2-price-change-index-ui': '../../packages/sg2-price-change-index-ui',
  '@profitia/srm-xray': '../../packages/srm-xray',
  '@profitia/srm-adp-ui': '../../packages/srm-adp-ui',
  '@profitia/maps-embed': '../../packages/maps-embed',
  '@profitia/maps-contracts': '../../packages/maps-contracts',
  '@profitia/insights-runtime': '../insights-runtime',
  '@profitia/insights-contracts': '../../packages/insights-contracts',
  '@profitia/platform-current-e1-authority': '../../packages/platform-contracts/current-e1-authority',
  '@profitia/platform-source-hub-contracts': '../../packages/platform-source-hub-contracts',
})
// Owner-reviewed peers of the existing MapsEmbed 0.1.2 package only.
// App dependencies and every other local dependency still require exact file paths.
const REVIEWED_MAPS_EMBED_PEERS = Object.freeze({
  '@profitia/maps-contracts': '0.1.0',
  '@profitia/platform-contracts': '1.18.0 || 1.19.0 || 1.20.0 || 1.21.0 || 1.22.0 || 1.23.0 || 1.24.0 || 1.25.0 || 1.26.0 || 1.27.0 || 1.28.0 || 1.29.0 || 1.29.1 || 1.29.2 || 1.30.0 || 1.31.0 || 1.32.0 || 1.32.1 || 1.32.2 || 1.32.3',
})
function reviewedMapsPeer(owner, version, section, name, spec) {
  return owner === '@profitia/maps-embed' && version === '0.1.2' && section === 'peerDependencies'
    && Object.hasOwn(REVIEWED_MAPS_EMBED_PEERS, name)
    && (spec === REVIEWED_MAPS_EMBED_PEERS[name] || name === '@profitia/platform-contracts' && [REVIEWED_MAPS_EMBED_PEERS[name] + ' || 1.33.0',REVIEWED_MAPS_EMBED_PEERS[name] + ' || 1.33.0 || 1.34.0'].includes(spec))
}
const npmrc = '@profitia:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NPM_TOKEN}\n'
const shaPattern = /^[a-f0-9]{40}$/
const fail = code => {throw new Error(code)}

export function assertTrustedContext(c) {
  if (c.repository !== REPOSITORY || c.ref !== 'refs/heads/main' || c.workflowRef !== `${REPOSITORY}/${WORKFLOW}@refs/heads/main`) fail('UNTRUSTED_WORKFLOW_SOURCE')
  if (!['push', 'workflow_dispatch'].includes(c.event) || c.actor !== 'profitia' || c.triggeringActor !== 'profitia' || !shaPattern.test(c.controlSha ?? '')) fail('UNTRUSTED_EXECUTION')
  return c
}

export function assertEnvironment(environment, branches, registered) {
  if (environment.id !== registered.environmentId || environment.name !== registered.environmentName || registered.repository !== REPOSITORY || registered.protectionStatus !== 'MAIN_ONLY') fail('ENVIRONMENT_IDENTITY_MISMATCH')
  const p = environment.deployment_branch_policy
  if (p?.protected_branches !== false || p?.custom_branch_policies !== true || branches.length !== 1 || branches[0].name !== 'main' || branches[0].type !== 'branch') fail('ENVIRONMENT_POLICY_DRIFT')
}

function candidateFamily(context, pr, expectedSha) {
  assertTrustedContext(context)
  if (!pr) {
    if (expectedSha && expectedSha !== context.controlSha) fail('CANDIDATE_SHA_MISMATCH')
    return 'MAIN'
  }
  const exactOilReport=pr.number===OIL_REPORT_E1_REVIEW.prNumber&&pr.head?.ref===OIL_REPORT_E1_REVIEW.branch
  const exactInsightsG1=pr.number===INSIGHTS_G1_REVIEW.prNumber&&pr.head?.ref===INSIGHTS_G1_REVIEW.branch
  if (pr.state !== 'open' || pr.base?.repo?.full_name !== REPOSITORY || pr.base?.ref !== 'main' || pr.head?.repo?.full_name !== REPOSITORY || pr.user?.login !== 'profitia' || !(eligibleCandidateBranch(pr.head?.ref)||exactInsightsG1||exactOilReport)) fail('UNTRUSTED_CANDIDATE')
  const family = exactInsightsG1||exactOilReport||pr.head.ref.startsWith('architecture/') ? 'ARCHITECTURE' : pr.head.ref.startsWith('srm/') ? 'SRM' : 'SG2'
  if (!shaPattern.test(expectedSha ?? '') || pr.head.sha !== expectedSha) fail('CANDIDATE_SHA_MISMATCH')
  return family
}

// Proposed closed Stage1 review of seven governance sources only. Activation
// requires controller-owner acceptance; no generic Canon/runtime/package grant.
export const PLATFORM_KNOWLEDGE_G1_REVIEW = Object.freeze({
  "prNumber": 999,
  "branch": "architecture/platform-knowledge-stage1-g1-20261111",
  "sourceSha": "174cb59fd9770f1ced8d4b1108f6090934937a4f",
  "blobs": {
    "Canon/evidence/2026-11-11-platform-knowledge-stage1-g1-onboarding.md": "29d9e8342832f4f95cd01925d41b43fa5f6450db",
    "Canon/registries/architecture-onboarding-v1.json": "2881780b31947605e9f6127a894b3bcc32eb36fb",
    "Canon/registries/current-architecture-baseline-v1.json": "4e0a9ddb77e99d2a764af9ff2d719a107e66c0dc",
    "Canon/registries/governance-manifest-v2.json": "b77945d874efec290aa50a598c23aae80ed6ad23",
    "Canon/runbooks/platform-knowledge-development-delivery-plan-v1.md": "48e727adbdd5d410d8b87aa59cc190cc68422e5b",
    "Canon/runbooks/platform-knowledge-development-foundation-v1.md": "3f684e8fa49b099bbc174cd8475a0a2cdf4c53e2",
    "scripts/governance/platform-knowledge-routing.test.mjs": "54b736cb6f5410452d281576a77ebb11e44be111"
  },
  "statuses": {
    "Canon/evidence/2026-11-11-platform-knowledge-stage1-g1-onboarding.md": "added",
    "Canon/registries/architecture-onboarding-v1.json": "modified",
    "Canon/registries/current-architecture-baseline-v1.json": "modified",
    "Canon/registries/governance-manifest-v2.json": "modified",
    "Canon/runbooks/platform-knowledge-development-delivery-plan-v1.md": "modified",
    "Canon/runbooks/platform-knowledge-development-foundation-v1.md": "added",
    "scripts/governance/platform-knowledge-routing.test.mjs": "added"
  }
})
function isPinnedPlatformKnowledgeG1Review(files) {
  return Array.isArray(files) && files.length === Object.keys(PLATFORM_KNOWLEDGE_G1_REVIEW.blobs).length
    && new Set(files.map(f=>f?.filename)).size === files.length
    && files.every(f=>Object.hasOwn(PLATFORM_KNOWLEDGE_G1_REVIEW.blobs,f?.filename??'')
      && f.sha===PLATFORM_KNOWLEDGE_G1_REVIEW.blobs[f.filename]
      && f.status===PLATFORM_KNOWLEDGE_G1_REVIEW.statuses[f.filename]
      && !Object.hasOwn(f,'previous_filename'))
}

// The producer class remains deliberately narrower than ARCHITECTURE ownership.
// A separate closed KRS governance review bundle below grants no app or generic
// workflow/tooling admission and never reads a candidate-provided allowlist.
export const KRS_GOVERNANCE_REVIEW_FILES = Object.freeze([
  '.github/workflows/governance-preflight.yml',
  'Canon/evidence/2026-10-22-krs-registry-foundation.json',
  'Canon/evidence/2026-10-22-krs-registry-foundation.md',
  'Canon/evidence/2026-10-22-krs-registry-g1-onboarding.json',
  'Canon/evidence/2026-10-22-krs-registry-g1-onboarding.md',
  'Canon/evidence/2026-10-22-krs-registry-01b-acceptance.json',
  'Canon/evidence/2026-10-22-krs-registry-01b-acceptance.md',
  'Canon/registries/architecture-onboarding-v1.json',
  'Canon/registries/current-architecture-baseline-v1.json',
  'Canon/registries/governance-manifest-v2.json',
  'Canon/runbooks/krs-registry-task02-execution-handoff-v1.md',
  'Canon/v1.0-krs-registry-architecture-and-ownership-canon.md',
  'Canon/v1.1-repository-routing-and-module-ownership-canon.md',
  'scripts/governance/identity-runtime-onboarding.test.mjs',
  'scripts/governance/krs-registry-routing.test.mjs',
])
// One owner-approved ADP governance review, not generic Architecture admission.
// Pins are trusted-main data: no candidate-supplied path/hash/approval manifest.
// Source may be rebased onto a newer main only while these five blobs stay exact.
export const ADP_GOVERNANCE_REVIEW = Object.freeze({
  prNumber: 756,
  branch: 'architecture/srm-adp-ui-onboarding-20261027',
  sourceSha: '202bcd0b4c7e00a03a2a7eee9aeb38338363f3d0',
  blobs: Object.freeze({
    'Canon/v1.1-srm-adp-presentation-mounting-amendment.md': '947ee0f7737dfd062a17af340c5c8667c5d10cab',
    'Canon/evidence/2026-10-27-srm-adp-ui-onboarding.md': '4ba761883e0e94004a37ffd587099c7c0213c2c3',
    'Canon/registries/current-architecture-baseline-v1.json': '8513437b3e5477f9838ab85a80b3a032d26dc79e',
    'Canon/registries/governance-manifest-v2.json': 'bf4b89d9b617180481cce4d75f77ea04b52c313a',
    'scripts/governance/srm-adp-routing.test.mjs': '6f662b75b6e6eced7f3a6a8d5640b786be2ae29d',
  }),
})
function isPinnedAdpGovernanceReview(files) {
  return Array.isArray(files) && files.length === Object.keys(ADP_GOVERNANCE_REVIEW.blobs).length
    && files.every(file => Object.hasOwn(ADP_GOVERNANCE_REVIEW.blobs, file?.filename ?? '')
      && file?.sha === ADP_GOVERNANCE_REVIEW.blobs[file.filename])
}
// Owner-authorised full Development plan: one frozen G1 review, no runtime/CI access.
export const LIMITS_G1_GOVERNANCE_REVIEW = Object.freeze({
  prNumber: 814,
  branch: 'architecture/package-limits-dashboard-g1-20261030',
  sourceSha: 'b6f1772ecc23b9efcbac6cb4e7265cfbea375c42',
  blobs: Object.freeze({
    "Canon/evidence/2026-10-30-package-limits-dashboard-g1-onboarding.md": "5cc118f2867d89945a17d8745c8f64fe036a9a96",
    "Canon/registries/architecture-onboarding-v1.json": "ea344b190af2a8383a3dee47f0279f4deb39cfaa",
    "Canon/registries/current-architecture-baseline-v1.json": "21ef8acac5ff5e978b32c2662a84c0e7573a0ad6",
    "Canon/registries/governance-manifest-v2.json": "bea6b744f88e63ab7f444596857d11a5ca2e8ec2",
    "Canon/runbooks/package-limits-development-v1.md": "602097235f734d539041189163e03844190f57ff",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "85eec6853b67b1945392661c3842bcf1349ab42c",
    "scripts/governance/krs-registry-routing.test.mjs": "301edea91a5a973479f81e649dcbce57c875a610",
    "scripts/governance/package-limits-routing.test.mjs": "093ae020179a975ff71904ccfd82ae031ed6c871"
}),
})
function isPinnedLimitsG1Review(files) {
  return Array.isArray(files) && files.length === Object.keys(LIMITS_G1_GOVERNANCE_REVIEW.blobs).length
    && files.every(file => Object.hasOwn(LIMITS_G1_GOVERNANCE_REVIEW.blobs, file?.filename ?? '')
      && file?.sha === LIMITS_G1_GOVERNANCE_REVIEW.blobs[file.filename])
}
// Owner-approved: one frozen Newsfeed governance review, not generic path admission.
export const NEWSFEED_G1_GOVERNANCE_REVIEW = Object.freeze({
  prNumber: 872,
  branch: 'architecture/newsfeed-g1-activation-20261103',
  sourceSha: 'd7c425651faa354a21bf20c4679e12345365b6be',
  blobs: Object.freeze({
  "Canon/evidence/2026-11-03-newsfeed-canon-save-handoff.md": "911fca6e2326967f459c90064cfc3757e6de967a",
  "Canon/evidence/2026-11-03-newsfeed-g1-governance-activation.md": "c6af94879c083fbe9c212ca0f9616fd363410bd4",
  "Canon/registries/architecture-onboarding-v1.json": "6caac9e7fbf6ef92b66102d9d2962e922a4e6ef9",
  "Canon/registries/current-architecture-baseline-v1.json": "7f70afd307a04ea45f4af05e7b2a88eb86b95157",
  "Canon/registries/governance-manifest-v2.json": "ff46f5b5cea7973e9047e8381ff9bafd3c04b603",
  "Canon/v1.0-newsfeed-business-and-architecture-canon.md": "7b9fccbfb062d13e7ff8c53662cf006703ce5f08",
  "Canon/v1.0-srm-architecture-and-component-placement-canon.md": "4a560258d81c7cc6a9edd1f0a85a6d1643b6b4cb",
  "Canon/v1.0-srm-business-capability-canon.md": "d44c74ca7c95998d04061f45ab53bd36e798e3bf",
  "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "4c72b48110d76bbb56d8fb3890c4af4874250fd1",
  "scripts/governance/governance.test.mjs": "abc57c34556ee6977cb15bf44800f7d67a97fbac"
}),
})
function isPinnedNewsfeedG1Review(files) {
  return Array.isArray(files) && files.length === Object.keys(NEWSFEED_G1_GOVERNANCE_REVIEW.blobs).length
    && files.every(file => Object.hasOwn(NEWSFEED_G1_GOVERNANCE_REVIEW.blobs, file?.filename ?? '')
      && file?.sha === NEWSFEED_G1_GOVERNANCE_REVIEW.blobs[file.filename])
}

// Necessary formal FRESH producer review. This is one exact artifact, never a
// generic optional-package/workflow admission or a new SG2 dependency source.
// Exact Source Hub G1 review, never generic Architecture or workflow admission.
export const SOURCE_HUB_G1_GOVERNANCE_REVIEW = Object.freeze({
  "prNumber": 878,
  "branch": "architecture/platform-source-hub-foundation-20261103",
  "sourceSha": "aef76dd768aa52b0fe0f17349cb1c972d6c67eae",
  "blobs": Object.freeze({
    "Canon/evidence/2026-11-03-platform-source-hub-final-activation.md": "40a8172ebb6603c4e994145437c4b1fa08dae329",
    "Canon/evidence/2026-11-03-platform-source-hub-stage1b-foundation.md": "4dbc04ceb70f2e7ff25701088b0febef7bb5b12a",
    "Canon/proposals/platform-source-hub-g1-onboarding-v1.json": "fe0785b4b872042cc1c5864d3fcd2f43492a04fe",
    "Canon/registries/architecture-onboarding-v1.json": "af76cafcc0eee18082333ca5644ac399dfe6b65d",
    "Canon/registries/current-architecture-baseline-v1.json": "768da623490181646e95d8177c70d89a7d2695fe",
    "Canon/registries/governance-manifest-v2.json": "f16aea6c1710f7471901300566d314c3b4094213",
    "Canon/registries/newsfeed-source-hub-environment-baseline-v1.json": "618653a9ae96cb3b338842e10e43488cef5e3ea0",
    "Canon/registries/platform-source-hub-contract-families-v1.json": "1a472402375482c89f5266a91257b70d7aa62637",
    "Canon/runbooks/newsfeed-source-hub-infrastructure-provisioning-v1.md": "5661e397697b639408ffd9c178a4096199f25b42",
    "Canon/v1.0-platform-source-hub-business-and-architecture-canon.md": "51d2edc51cf0ff31adb742e64d77888dd8c4f0f0",
    "Canon/v1.1-newsfeed-source-hub-responsibility-amendment.md": "addb4b2badd05015738afaa9b4ba7be5ab631957",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "11a2c81b48b6c61efc1296d1e01bc901c7bf5e01",
    "scripts/governance/governance.test.mjs": "125941013df0e2fc027cb57bd3034310499c5072",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "73830ac8aa471cde8ee8f0c1c05133dab7a80fbf"
  }),
  "statuses": Object.freeze({
    "Canon/evidence/2026-11-03-platform-source-hub-final-activation.md": "added",
    "Canon/evidence/2026-11-03-platform-source-hub-stage1b-foundation.md": "added",
    "Canon/proposals/platform-source-hub-g1-onboarding-v1.json": "added",
    "Canon/registries/architecture-onboarding-v1.json": "modified",
    "Canon/registries/current-architecture-baseline-v1.json": "modified",
    "Canon/registries/governance-manifest-v2.json": "modified",
    "Canon/registries/newsfeed-source-hub-environment-baseline-v1.json": "added",
    "Canon/registries/platform-source-hub-contract-families-v1.json": "added",
    "Canon/runbooks/newsfeed-source-hub-infrastructure-provisioning-v1.md": "added",
    "Canon/v1.0-platform-source-hub-business-and-architecture-canon.md": "added",
    "Canon/v1.1-newsfeed-source-hub-responsibility-amendment.md": "added",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "modified",
    "scripts/governance/governance.test.mjs": "modified",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "added"
  })
})
function isPinnedSourceHubG1Review(files) {
  return Array.isArray(files) && files.length === Object.keys(SOURCE_HUB_G1_GOVERNANCE_REVIEW.blobs).length
    && files.every(file => Object.hasOwn(SOURCE_HUB_G1_GOVERNANCE_REVIEW.blobs, file?.filename ?? '')
      && file?.sha === SOURCE_HUB_G1_GOVERNANCE_REVIEW.blobs[file.filename]
      && file?.status === SOURCE_HUB_G1_GOVERNANCE_REVIEW.statuses[file.filename])
}

export const FRESH_REPORT_PRODUCER_REVIEW = Object.freeze({
  prNumber: 817,
  branch: 'architecture/fresh-boundary-coordination-20261030',
  sourceSha: '9f23dc13902f942c31fe7d86ba5bf7bc2e9c6363',
  blobs: Object.freeze({
    '.github/workflows/platform-contracts-ci.yml': '0c2e92d0465a81b48ff64e046567c0d4cf4be79a',
    'Canon/evidence/2026-10-30-current-fresh-report-candidate.md': 'd9bf848cd310550e7d92e3c02c7f694e8bc45dcf',
    'apps/architecture-lab/current-fresh-report-acceptance.json': 'ebf28e9925db85ac61fbb1deba965b6ca5680a43',
    'packages/platform-contracts/current-fresh-report/package-lock.json': '23d5286f6391712107533323ba621c054155329a',
    'packages/platform-contracts/current-fresh-report/package.json': 'dedb0b3d3043d41719185fe00c90044dfeebf729',
    'packages/platform-contracts/current-fresh-report/src/current-fresh-report.d.mts': '1c3f4ab575747d3c2cd1e8e0f11baf2cf215257c',
    'packages/platform-contracts/current-fresh-report/src/current-fresh-report.mjs': 'f5b906ce6df118bbcdadd6e1c5f8d379f87bd985',
    'packages/platform-contracts/current-fresh-report/test/current-fresh-report-postgres.test.mjs': '4768c71455f8682fec55865874a383245b52380b',
    'packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs': '90fce244085b96d5751714dc3d4781fb1c16459c',
    'packages/platform-contracts/current-fresh-report/test/types/current-fresh-report.mts': '0340a97ce9a94408d856037349ae161582f70426',
  }),
})
function isPinnedFreshReportReview(files) {
  return Array.isArray(files) && files.length === Object.keys(FRESH_REPORT_PRODUCER_REVIEW.blobs).length
    && files.every(file => Object.hasOwn(FRESH_REPORT_PRODUCER_REVIEW.blobs, file?.filename ?? '')
      && file?.sha === FRESH_REPORT_PRODUCER_REVIEW.blobs[file.filename])
}
// Proposed closed review of ONE data-only producer. Activation requires owner
// acceptance of this separate bootstrap; no optional-package pattern is opened.
export const PAYLOAD_CAPTURE_PRODUCER_REVIEW = Object.freeze({
  prNumber: 827,
  branch: 'architecture/payload-capture-source-publication-20261031',
  sourceSha: '9d44684b968ca3a067d414f7c450b6016ecc8d19',
  blobs: Object.freeze({
    'Canon/evidence/2026-10-31-payload-capture-candidate.md': '0287f2d237c64d6b1ec76d27e6e02c51105e905d',
    'Canon/evidence/2026-10-31-payload-capture-source-publication.md': 'f7ad9ae50fa0221d8f3c153f4c3ebe125538d6e1',
    'apps/architecture-lab/payload-capture-candidate.json': '4e04c1305a43fff5e9e2d1e8bb14eebc0da92a3a',
    'apps/architecture-lab/test/payload-capture-publication.test.mjs': 'a7422730f1119d340ea03e47a36334a969855c5b',
    'packages/platform-contracts/payload-capture/package.json': '1824149cfba8909aa20a94656188a9ed3cff862f',
    'packages/platform-contracts/payload-capture/src/payload-capture.d.mts': '34c108584d6981e2d848320a20869f7510b6e1ad',
    'packages/platform-contracts/payload-capture/src/payload-capture.mjs': 'd657a5660b6e0989121321d443d16f4b9b04d797',
    'packages/platform-contracts/payload-capture/test/benchmark.mjs': '529282e609ad6c6446c44f5c6029570550a03b1b',
    'packages/platform-contracts/payload-capture/test/payload-capture.test.mjs': '190044c554605316bf8d66d997df17b2fbca0d92',
    'packages/platform-contracts/payload-capture/test/public-package.test.mjs': '9d7ba3a4f6d7f5e2a44323b3e83627e9e5f3d0cf',
  }),
})
function isPinnedPayloadCaptureReview(files) {
  return Array.isArray(files) && files.length === Object.keys(PAYLOAD_CAPTURE_PRODUCER_REVIEW.blobs).length
    && files.every(file => Object.hasOwn(PAYLOAD_CAPTURE_PRODUCER_REVIEW.blobs, file?.filename ?? '')
      && file?.sha === PAYLOAD_CAPTURE_PRODUCER_REVIEW.blobs[file.filename] && file.status === 'added')
}
// Local proposal: activate only after separate owner acceptance. One exact
// independent read-only MISS producer; no generic nested-package admission.
export const READONLY_MISS_REPORT_PRODUCER_REVIEW = Object.freeze({
  prNumber: 831,
  branch: 'architecture/current-fresh-miss-20261031',
  sourceSha: 'b2b52c6a61ab3c3882f60ab5033670046715a5bc',
  blobs: Object.freeze({
    "apps/architecture-lab/test/readonly-miss-report.test.mjs": "1e072a397829f2b6c5bf44cd929387ad46020ff3",
    "packages/platform-contracts/readonly-miss-report/README.md": "a599714ed85033ba18702d9714b822ddd989183c",
    "packages/platform-contracts/readonly-miss-report/package-lock.json": "bfa16e198a13aa8d23a0a82fc9029b8bee5a7f4e",
    "packages/platform-contracts/readonly-miss-report/package.json": "b3f788881a5c2b0af3a982ca8eaeb714ff1cc79f",
    "packages/platform-contracts/readonly-miss-report/src/readonly-miss-report.d.mts": "ecc9f2c55bdcb554acd56ca767a94bc90c0bf77a",
    "packages/platform-contracts/readonly-miss-report/src/readonly-miss-report.mjs": "cd9e4b6824c7306c900409be97a891d19bfeaebc",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report-postgres.test.mjs": "fb39761a2d0aca4ea6f3f268cc263d262a49766e",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": "1d7c9d179eadb4e73bc2dc7a2a619492a7bdb7e0",
    "packages/platform-contracts/readonly-miss-report/test/types/readonly-miss-report.mts": "76516b13cd02286d6c15f23e185f30fbfe9d437f",
  }),
})
function isPinnedReadonlyMissReportReview(files) {
  return Array.isArray(files) && files.length === Object.keys(READONLY_MISS_REPORT_PRODUCER_REVIEW.blobs).length
    && files.every(file => Object.hasOwn(READONLY_MISS_REPORT_PRODUCER_REVIEW.blobs, file?.filename ?? '')
      && file?.sha === READONLY_MISS_REPORT_PRODUCER_REVIEW.blobs[file.filename] && file.status === 'added')
}
// Proposed owner-reviewed test-fixture repair only; not a generic path grant.
export const FRESH_FIXTURE_TEARDOWN_REVIEW = Object.freeze({
  prNumber: 843,
  branch: "architecture/current-fresh-report-fixture-teardown-20261031",
  sourceSha: "a709995993176d79ab8bdf7874f6c14e1ee0028d",
  blobs: Object.freeze({
    "apps/architecture-lab/src/operation-postgres-fixture.mjs": "2c830f159f30e4a84bbf19d4649adc2fdaf57bb6",
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report-postgres.test.mjs": "e606950c4ca5f9b77543b236b6192884ef424b01",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report-postgres.test.mjs": "c6cd4fcb1d24893fb1ab193edca89f2980d35a11"
}),
})
function isPinnedFreshFixtureTeardownReview(files) {
  return Array.isArray(files) && files.length === Object.keys(FRESH_FIXTURE_TEARDOWN_REVIEW.blobs).length
    && files.every(file => Object.hasOwn(FRESH_FIXTURE_TEARDOWN_REVIEW.blobs, file?.filename ?? '')
      && file?.sha === FRESH_FIXTURE_TEARDOWN_REVIEW.blobs[file.filename] && file.status === 'modified')
}

// Proposed exact owner review only; no generic producer or workflow admission.
export const ROOT_ATOMIC_CLAIM_PRODUCER_REVIEW = Object.freeze({
  prNumber: 854,
  branch: "architecture/root-atomic-claim-producer-20261101",
  sourceSha: "3a494b5432555935168c060be5950589d550d276",
  blobs: Object.freeze({
    "apps/architecture-lab/test/root-atomic-claim.test.mjs": "3b383f64c1162b27b16fc40985f2da0bba91b842",
    "packages/platform-contracts/root-atomic-claim/README.md": "5cb096078acddc99e536fb8c078c89c3decfc960",
    "packages/platform-contracts/root-atomic-claim/migrations/001-root-atomic-claim.sql": "5a00e639a60f451eb672229be698d4a1d7ff62b6",
    "packages/platform-contracts/root-atomic-claim/package-lock.json": "3ab364b0d7390d7f8299296bddc2b6329e69d7ad",
    "packages/platform-contracts/root-atomic-claim/package.json": "cc0fbd66fe0fc3da0b7399d0be28ad3b5463e772",
    "packages/platform-contracts/root-atomic-claim/src/root-atomic-claim.d.mts": "c93be86bb81072b5bdc452958be5f9c14e1b189a",
    "packages/platform-contracts/root-atomic-claim/src/root-atomic-claim.mjs": "91af440d729fc8889952c12af422f7719635630e",
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim-postgres.test.mjs": "eb1fd924623a02e74af322bb572aa2a43281f488",
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim-types.mts": "f132ee3e8132a75499e25a69afdb0690b9ffed9e",
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim-types.test.mjs": "796e06efb06f00c318a0a747d3408da000bf5c28",
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs": "4ecf4f28a808c6da724a7475497a48c5b636cc6c"
}),
})
function isPinnedRootAtomicClaimReview(files) {
  return Array.isArray(files) && files.length === Object.keys(ROOT_ATOMIC_CLAIM_PRODUCER_REVIEW.blobs).length
    && files.every(file => Object.hasOwn(ROOT_ATOMIC_CLAIM_PRODUCER_REVIEW.blobs, file?.filename ?? '')
      && file?.sha === ROOT_ATOMIC_CLAIM_PRODUCER_REVIEW.blobs[file.filename] && file.status === 'added')
}

// Unapplied proposal: one complete candidate review, never a generic path grant.
export const SOURCE_HUB_STAGE2A_REVIEW=Object.freeze({
  "prNumber": 885,
  "branch": "architecture/source-hub-newsfeed-stage2a-20261103",
  "reviewedCandidateSha": "5dd883015b5b31b78739ec603f524c0621e29809",
  "reviewedBaseSha": "a3e64a93801cb197af856bf2d282a6158b01c71d",
  "blobs": {
    ".github/workflows/newsfeed-ci.yml": "766413af2f8163f8c5e26ce8f45f4e5fa475a9a6",
    ".github/workflows/platform-source-hub-ci.yml": "2a8293318a56b6c5fbc6ccb4cabddba142af6d5d",
    "Canon/evidence/2026-11-03-source-hub-newsfeed-stage2a.md": "e147de1efcb68ea0b42cca93b8098e1ba96f025d",
    "Canon/registries/platform-source-hub-contract-families-v1.json": "be5ec7f4367e837b3b1a0a767a71ec4219e07e6c",
    "Canon/runbooks/newsfeed-source-hub-infrastructure-provisioning-v1.md": "b363c26fae9ac0083e9664ca1cd484c8839148ef",
    "apps/architecture-lab/sdk-1.33-compatibility.json": "68f9f7845bd5e36f72932da3eb5a7004f9ab235a",
    "apps/architecture-lab/test/payload-capture-publication.test.mjs": "aec767eeb6bad5f05fafd3803ce7d02681cff164",
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": "9abc96b3b1ea16665ecdd749b51681b4d55eda63",
    "apps/dashboard-preview/package-lock.json": "b5be2a1baa59014d0feddc42c4b69a443dbe0149",
    "apps/maps-runtime/package-lock.json": "f4644eb69f232c21d39ec2e507967729528fe49d",
    "apps/maps-runtime/platform-integration.json": "3840b63cc06068ef442d00bc3cc90881ae38bc78",
    "apps/maps-runtime/test/embed.test.mjs": "879ab097817e11026bf7419ac90925a6297d063b",
    "apps/newsfeed-runtime/README.md": "bdc3142b4ed4f08e4930035547fb1e35ee5f3f13",
    "apps/newsfeed-runtime/docs/stage2b-activation.pl.md": "6a36e69580e2a3d68f6ab1d2330a32f9c242f124",
    "apps/newsfeed-runtime/examples/development.env.example": "8da45ddf8a7265d3dcee20184376f3ea823dc0e7",
    "apps/newsfeed-runtime/migrations/001-foundation.sql": "e03be22e190eb6efb8c1d456967bb005c14d640c",
    "apps/newsfeed-runtime/operation-integration.json": "41fe58f7586b2ad34012dd946d0dea5473062631",
    "apps/newsfeed-runtime/package-lock.json": "268eb9c450b93f79397bf81c088785e4093e914c",
    "apps/newsfeed-runtime/package.json": "22cd80275e4d85fc0e871bb651edba1e1f49b333",
    "apps/newsfeed-runtime/scripts/migrate.mjs": "c67c38ac3f7ba7aa79f6199c087c95201a66528b",
    "apps/newsfeed-runtime/src/auth.mjs": "8c5cd84eb9319dacfd7c1485df29b79ad45e9d1c",
    "apps/newsfeed-runtime/src/capabilities.mjs": "3ae8ab7bdc4bf4c5e91d9c2a5f947072f6bc6d77",
    "apps/newsfeed-runtime/src/config.mjs": "79451d255250bf210f0d810edbf2133682d94553",
    "apps/newsfeed-runtime/src/database.mjs": "d48e6b1110ca1e974b346eb9fb7e3c014a3ae477",
    "apps/newsfeed-runtime/src/main.mjs": "be28cbd8853034bb62d5f0c369057550a08bc53e",
    "apps/newsfeed-runtime/src/newsapi.mjs": "c0edf046692d60ea9ad6c9ab5ede2fdc79e4339e",
    "apps/newsfeed-runtime/src/query.mjs": "33ee4dbd9cf37c278345f69e341a172bc0c28fb9",
    "apps/newsfeed-runtime/src/repository.mjs": "6d018bdec318ef64c48e19f29214c6390e64e5f5",
    "apps/newsfeed-runtime/src/server.mjs": "22b1076e999eca14f7c08e0136c79a6e83dd9073",
    "apps/newsfeed-runtime/src/source-hub-client.mjs": "f4f0ef805c636f75de2bcdb548773473d99f18c7",
    "apps/newsfeed-runtime/test/end-to-end.test.mjs": "6613fafad5c3d4e218343f0a10cdafe716d58e6a",
    "apps/newsfeed-runtime/test/fixtures.mjs": "5f887b3fe56f46140f2cde7ca4e7c80c077e9d11",
    "apps/newsfeed-runtime/test/persistence.test.mjs": "fcbdedca84a4d1f241dec06e769fd7d186eb8b2b",
    "apps/newsfeed-runtime/test/runtime-consumer.ts": "c165d458a8cdf1bfb1d76263553790d333e4f285",
    "apps/newsfeed-runtime/test/runtime.test.mjs": "fc9b475f1a1aaaeca2c45c73c5f247045c447683",
    "apps/newsfeed-runtime/tsconfig.json": "30d532250a1e2dd1676626fe0a698ef7847238f7",
    "apps/platform-source-hub/README.md": "ed7d67978fce7041bbe452c22dc2916a54bed302",
    "apps/platform-source-hub/docs/live-evidence.json": "b549043e839706f62d2006b37e67aebf640d1f13",
    "apps/platform-source-hub/docs/provider-capabilities.pl.md": "65cf5b048f58c832bbaddb884088490ecde0e3b4",
    "apps/platform-source-hub/docs/stage2b-activation.pl.md": "d460920957246e2242d1ed8ea29c73093061572f",
    "apps/platform-source-hub/examples/development.env.example": "8c28cca7cf94f0b0fd3e436ad41c31b52fd56dd6",
    "apps/platform-source-hub/migrations/001-foundation.sql": "f6fb870d6a9b952de279dd3213d6d9aeacbb88b8",
    "apps/platform-source-hub/package-lock.json": "a97b9cfcd39c29241b52b31cf2af4d43e2e64d8e",
    "apps/platform-source-hub/package.json": "9abc99e8edf07c0cd55ca943ba8534f30f83d937",
    "apps/platform-source-hub/scripts/ci-routing.mjs": "28812a31fd43cd0c366d2a5972655bb913ed2c71",
    "apps/platform-source-hub/scripts/live-probe.mjs": "4198fe9e5d44e4ff2296e1aa1119237ea6b965a9",
    "apps/platform-source-hub/scripts/migrate.mjs": "d92270bb5bb1ad9dedb960c711887de1ae5d8e05",
    "apps/platform-source-hub/src/admission.mjs": "e97aa54d1851907c4509d0d1411d629c3e77662d",
    "apps/platform-source-hub/src/auth.mjs": "65d3c7d14edeb23100868231bd63e9e0f118802c",
    "apps/platform-source-hub/src/capabilities.mjs": "bcfea058e9abb07b0c3fbe395a83faf8f1248c96",
    "apps/platform-source-hub/src/config.mjs": "ca4eea140e0d5edae1da09d76d681153f6819c2b",
    "apps/platform-source-hub/src/database.mjs": "d48e6b1110ca1e974b346eb9fb7e3c014a3ae477",
    "apps/platform-source-hub/src/errors.mjs": "83fbbb1dc3e7059acde8958eeccc0b522e53107c",
    "apps/platform-source-hub/src/main.mjs": "175ee9c8aca4808aa266167b3e672bfcf27702f6",
    "apps/platform-source-hub/src/observability.mjs": "9028d97b12ae596a072318207eaf6648239200c3",
    "apps/platform-source-hub/src/providers/brave.mjs": "b14fb2ed5b1f9a77f4fa25831ef1897c3b055a2b",
    "apps/platform-source-hub/src/providers/newsapi-capabilities.mjs": "0869539ea3cf587933a7ed4f11a60c4cd3159c81",
    "apps/platform-source-hub/src/providers/newsapi-query.mjs": "30853dece8fbbb01d0b7616c1bb67079b083842f",
    "apps/platform-source-hub/src/providers/newsapi.mjs": "1f8c1fcf1c6874cd1d6253701b48ca20de756ba1",
    "apps/platform-source-hub/src/providers/trading-economics.mjs": "b4066580b97a23dc846f954ec80667676ae4a78b",
    "apps/platform-source-hub/src/repository.mjs": "0a9896a95f3a10da8cfa902532d8475d9f43e772",
    "apps/platform-source-hub/src/server.mjs": "d4356371c66ae619e4ab322cb0f321be3a240a45",
    "apps/platform-source-hub/src/transport.mjs": "2768cd31b67d4b05882d0fabecfffa14d8be69fa",
    "apps/platform-source-hub/test/adapters.test.mjs": "9866d35cbf79faf17c96aed52b03fea1ae575bb9",
    "apps/platform-source-hub/test/ci-routing.test.mjs": "b459dd80f090e1c9c8f518afc481d2c0aba6f6df",
    "apps/platform-source-hub/test/contracts.test.mjs": "779d774a6d98e8991ff3634946d8e0ffb42b9ca6",
    "apps/platform-source-hub/test/fixtures.mjs": "5fc29fe2e1973b24c026ea7af589adf8eb805151",
    "apps/platform-source-hub/test/persistence.test.mjs": "b89da7fbd79e9e5316071173d57e37123c320406",
    "apps/platform-source-hub/test/server.test.mjs": "5e19e55826e0f0879d01389b5e472bb7a5cf7155",
    "apps/platform-source-hub/test/types.ts": "d0882ce9b5708543c5bca6013cf29bf674fc4ed8",
    "apps/platform-source-hub/tsconfig.json": "9333853fd163f039bb2637f93bc8194841fbb3d6",
    "apps/sg-runtime/operation-integration.json": "bcbca8f741066fd604f9ac33ef8367a9cf23cc1b",
    "apps/sg-runtime/package-lock.json": "ef38c4a22f8ca1a0216020f1271fb1e75a726331",
    "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx": "ba624986942e3f458c07680417279e6a990c4dd8",
    "apps/sg-runtime/tests/category-operation.test.ts": "d6c09a0192a96aedf3430a350dafcd05b7dc9353",
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": "0e0357708f690ea46d1805497591d6b0efa75db4",
    "apps/sg-runtime/tests/identity-runtime.test.ts": "92f1b856a21319edf6512afec741d01a2d6074b2",
    "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs": "2e3ec9b21b2d3b59b4e3b6d43f01d8facc8471e8",
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": "018670cdc6adfc8d1c70a766c6849375ac0dd2d7",
    "apps/sg-runtime/tests/operation-context.test.mjs": "7b5dc8f3587592c1d6c7853a92629e4b1ccdfc02",
    "apps/sg-runtime/tests/pci-smart-integrity.mjs": "caa55e4c16e6883411986d1328b3d5e06e8db887",
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": "03a58a88cf4e879dd360032ab0d05419e8a87753",
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts": "2a3356e8bad6cde2f644747fc02accc700971026",
    "apps/sg-runtime/tests/private-host.integration.test.mjs": "61503a54c83fe29d1c725ab44e9c999f0cea3d00",
    "apps/sg-runtime/tests/self-service-account.test.ts": "0533fb4f03f28abfac6e30137bfe4f9253c2d843",
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": "6cfded9a3e5234287a0bfdee2ab8dca80ccd5798",
    "apps/sg-runtime/tests/xray-gateway.test.ts": "dea420e197c65d17e5c0f0058a0a57babe23de4d",
    "apps/srm/deployment/root-atomic-claim-targets.json": "0ab9f6b70f1d0fd43504ff75bc9177fbf111c29a",
    "apps/srm/operation-integration.json": "c3f3de037f439db815612bcda13295ede2e2cb66",
    "apps/srm/package-lock.json": "9d0103822bebd64dcca09e88bb64cbff0a2502c8",
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": "4ef473e448e943fdc5ccba6f66efc539722d9104",
    "apps/srm/scripts/native-execution-adoption.test.mjs": "d1126e98ad794b29985d681bafeea82ba4563770",
    "apps/srm/scripts/operation-context.test.mjs": "afc1b4ebb9fcbf36647df6e0efe67e58c3e079fd",
    "apps/srm/scripts/private-host.integration.test.mjs": "53ec887ed7ab34f0cd71719243436578affb5e3d",
    "apps/srm/scripts/request-quota-adoption.test.mjs": "5eb915870bcb1695c9f012d012f8d5def77df625",
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": "ea4a111814b397be4ba91582588aaa91d7cf1f6a",
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": "6b7daa142d54ee596e0bbfdf45a0a8ce4742a0c5",
    "apps/srm/scripts/xray-performance-adoption.test.mjs": "f18ea53ce3883ef3a018c4ed1abe5255a4df708e",
    "apps/srm/scripts/xray-style-acceptance.mjs": "9cf986a312bd2d1c5a961ed0a254c08e8b8f90ce",
    "apps/srm/src/server/full-ui-parity-adoption.test.ts": "f5fcc33727da18f2e7e92160556bf662554161c5",
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": "b2a5ec5d02ac1796d9e77dcd30779ac92a764dac",
    "packages/maps-embed/package.json": "f40c92fc32619c5a8dbb9e6fb65d94152e8d793d",
    "packages/newsfeed-contracts/README.md": "6f1633d7b487f76c8c315479c80f596df2138e70",
    "packages/newsfeed-contracts/index.d.ts": "e612677375b425c673ab2badbb82af51e34ea627",
    "packages/newsfeed-contracts/index.mjs": "ff3e35aa77084b3eb8f26e495c7645f8643b0a0c",
    "packages/newsfeed-contracts/package.json": "7413bc99d3c945754b49be1c656f4577b71e2ec4",
    "packages/platform-contracts/README.md": "c90e0d862cdf584a5ea3eb1f252c683f478b93ec",
    "packages/platform-contracts/current-fresh-report/package.json": "a96c7a4d97a590d5dd6f448ca7b658c8581bcb45",
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": "baaa0e6b147baa3916ed9604d2927274365fa3a2",
    "packages/platform-contracts/migrations/access/028-api-path-transport.sql": "aa6aa843974218928a687b27c3fecfa7aa4c3312",
    "packages/platform-contracts/package-lock.json": "88e6c39e37f3b059b89a0bf4b4d4c572846287eb",
    "packages/platform-contracts/package.json": "b5c59fa5a970df214d7f23d25edfeda405b23551",
    "packages/platform-contracts/payload-capture/package.json": "cef5610c31e427c9b94749ca1ca495ed52547064",
    "packages/platform-contracts/payload-capture/test/public-package.test.mjs": "520d3009e916c5ab4c097115010cab89d82f2d3d",
    "packages/platform-contracts/readonly-miss-report/package.json": "bad56ae64fa0425a94e32aaffb934da345112a57",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": "57997df452954de5dd02af3d3911d8e4c94db379",
    "packages/platform-contracts/root-atomic-claim/package.json": "4df0b4733084a92b9b722f4658da17ef9112dc43",
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs": "5145a2a4b9ffd5d01104fe4fbf190f5cab3ff204",
    "packages/platform-contracts/src/external-call.d.mts": "33104d22446f73fcdcab8e41f5e8971a35b5afa5",
    "packages/platform-contracts/src/external-call.mjs": "33d3a21797b1af55ec551732f5c4e5c22f12c6ad",
    "packages/platform-contracts/src/native-external-transport.d.mts": "63f4a9eefb482ce7a952765bfa1f81059052ea9f",
    "packages/platform-contracts/src/native-external-transport.mjs": "42dd984abc84a3fd3aa292fd3105d2d609d27b16",
    "packages/platform-contracts/test/api-path-transport.test.mjs": "36bc608cbdfb405b412b55ed41ee7a78430e016b",
    "packages/platform-contracts/test/external-call.test.mjs": "cef1c56ad3e4fbec6e2c7ba837acf72892a51e50",
    "packages/platform-contracts/test/types/api-path.mts": "fdbac1ca23ae2bf114c810002e7506fbca21f53c",
    "packages/platform-contracts/test/types/native-external.mts": "d3cc24cb67cc282c688a4107aafb22be5898bbce",
    "packages/platform-source-hub-contracts/README.md": "b49745c69645157168739b00007279030d5a27f3",
    "packages/platform-source-hub-contracts/index.d.ts": "996c9b73acabdeba83f34bd1f7b3a88648c9c134",
    "packages/platform-source-hub-contracts/index.mjs": "4098de3a42cf1be2001fc8e4714958d4f896f0c6",
    "packages/platform-source-hub-contracts/package.json": "d98b47b859c8b7cfc8f113a8d2b212acdbf10d90",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "8381b9d1b8b04886e5a0b1783884898c71b53139"
  },
  "statuses": {
    ".github/workflows/newsfeed-ci.yml": "modified",
    ".github/workflows/platform-source-hub-ci.yml": "added",
    "Canon/evidence/2026-11-03-source-hub-newsfeed-stage2a.md": "added",
    "Canon/registries/platform-source-hub-contract-families-v1.json": "modified",
    "Canon/runbooks/newsfeed-source-hub-infrastructure-provisioning-v1.md": "modified",
    "apps/architecture-lab/sdk-1.33-compatibility.json": "added",
    "apps/architecture-lab/test/payload-capture-publication.test.mjs": "modified",
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": "added",
    "apps/dashboard-preview/package-lock.json": "modified",
    "apps/maps-runtime/package-lock.json": "modified",
    "apps/maps-runtime/platform-integration.json": "modified",
    "apps/maps-runtime/test/embed.test.mjs": "modified",
    "apps/newsfeed-runtime/README.md": "modified",
    "apps/newsfeed-runtime/docs/stage2b-activation.pl.md": "added",
    "apps/newsfeed-runtime/examples/development.env.example": "added",
    "apps/newsfeed-runtime/migrations/001-foundation.sql": "added",
    "apps/newsfeed-runtime/operation-integration.json": "added",
    "apps/newsfeed-runtime/package-lock.json": "modified",
    "apps/newsfeed-runtime/package.json": "modified",
    "apps/newsfeed-runtime/scripts/migrate.mjs": "added",
    "apps/newsfeed-runtime/src/auth.mjs": "added",
    "apps/newsfeed-runtime/src/capabilities.mjs": "modified",
    "apps/newsfeed-runtime/src/config.mjs": "added",
    "apps/newsfeed-runtime/src/database.mjs": "added",
    "apps/newsfeed-runtime/src/main.mjs": "added",
    "apps/newsfeed-runtime/src/newsapi.mjs": "modified",
    "apps/newsfeed-runtime/src/query.mjs": "modified",
    "apps/newsfeed-runtime/src/repository.mjs": "added",
    "apps/newsfeed-runtime/src/server.mjs": "added",
    "apps/newsfeed-runtime/src/source-hub-client.mjs": "added",
    "apps/newsfeed-runtime/test/end-to-end.test.mjs": "added",
    "apps/newsfeed-runtime/test/fixtures.mjs": "added",
    "apps/newsfeed-runtime/test/persistence.test.mjs": "added",
    "apps/newsfeed-runtime/test/runtime-consumer.ts": "added",
    "apps/newsfeed-runtime/test/runtime.test.mjs": "added",
    "apps/newsfeed-runtime/tsconfig.json": "modified",
    "apps/platform-source-hub/README.md": "added",
    "apps/platform-source-hub/docs/live-evidence.json": "added",
    "apps/platform-source-hub/docs/provider-capabilities.pl.md": "added",
    "apps/platform-source-hub/docs/stage2b-activation.pl.md": "added",
    "apps/platform-source-hub/examples/development.env.example": "added",
    "apps/platform-source-hub/migrations/001-foundation.sql": "added",
    "apps/platform-source-hub/package-lock.json": "added",
    "apps/platform-source-hub/package.json": "added",
    "apps/platform-source-hub/scripts/ci-routing.mjs": "added",
    "apps/platform-source-hub/scripts/live-probe.mjs": "added",
    "apps/platform-source-hub/scripts/migrate.mjs": "added",
    "apps/platform-source-hub/src/admission.mjs": "added",
    "apps/platform-source-hub/src/auth.mjs": "added",
    "apps/platform-source-hub/src/capabilities.mjs": "added",
    "apps/platform-source-hub/src/config.mjs": "added",
    "apps/platform-source-hub/src/database.mjs": "added",
    "apps/platform-source-hub/src/errors.mjs": "added",
    "apps/platform-source-hub/src/main.mjs": "added",
    "apps/platform-source-hub/src/observability.mjs": "added",
    "apps/platform-source-hub/src/providers/brave.mjs": "added",
    "apps/platform-source-hub/src/providers/newsapi-capabilities.mjs": "added",
    "apps/platform-source-hub/src/providers/newsapi-query.mjs": "added",
    "apps/platform-source-hub/src/providers/newsapi.mjs": "added",
    "apps/platform-source-hub/src/providers/trading-economics.mjs": "added",
    "apps/platform-source-hub/src/repository.mjs": "added",
    "apps/platform-source-hub/src/server.mjs": "added",
    "apps/platform-source-hub/src/transport.mjs": "added",
    "apps/platform-source-hub/test/adapters.test.mjs": "added",
    "apps/platform-source-hub/test/ci-routing.test.mjs": "added",
    "apps/platform-source-hub/test/contracts.test.mjs": "added",
    "apps/platform-source-hub/test/fixtures.mjs": "added",
    "apps/platform-source-hub/test/persistence.test.mjs": "added",
    "apps/platform-source-hub/test/server.test.mjs": "added",
    "apps/platform-source-hub/test/types.ts": "added",
    "apps/platform-source-hub/tsconfig.json": "added",
    "apps/sg-runtime/operation-integration.json": "modified",
    "apps/sg-runtime/package-lock.json": "modified",
    "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx": "modified",
    "apps/sg-runtime/tests/category-operation.test.ts": "modified",
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": "modified",
    "apps/sg-runtime/tests/identity-runtime.test.ts": "modified",
    "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs": "modified",
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": "modified",
    "apps/sg-runtime/tests/operation-context.test.mjs": "modified",
    "apps/sg-runtime/tests/pci-smart-integrity.mjs": "modified",
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": "modified",
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts": "modified",
    "apps/sg-runtime/tests/private-host.integration.test.mjs": "modified",
    "apps/sg-runtime/tests/self-service-account.test.ts": "modified",
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": "modified",
    "apps/sg-runtime/tests/xray-gateway.test.ts": "modified",
    "apps/srm/deployment/root-atomic-claim-targets.json": "modified",
    "apps/srm/operation-integration.json": "modified",
    "apps/srm/package-lock.json": "modified",
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": "modified",
    "apps/srm/scripts/native-execution-adoption.test.mjs": "modified",
    "apps/srm/scripts/operation-context.test.mjs": "modified",
    "apps/srm/scripts/private-host.integration.test.mjs": "modified",
    "apps/srm/scripts/request-quota-adoption.test.mjs": "modified",
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": "added",
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": "modified",
    "apps/srm/scripts/xray-performance-adoption.test.mjs": "modified",
    "apps/srm/scripts/xray-style-acceptance.mjs": "modified",
    "apps/srm/src/server/full-ui-parity-adoption.test.ts": "modified",
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": "modified",
    "packages/maps-embed/package.json": "modified",
    "packages/newsfeed-contracts/README.md": "modified",
    "packages/newsfeed-contracts/index.d.ts": "modified",
    "packages/newsfeed-contracts/index.mjs": "modified",
    "packages/newsfeed-contracts/package.json": "modified",
    "packages/platform-contracts/README.md": "modified",
    "packages/platform-contracts/current-fresh-report/package.json": "modified",
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": "modified",
    "packages/platform-contracts/migrations/access/028-api-path-transport.sql": "added",
    "packages/platform-contracts/package-lock.json": "modified",
    "packages/platform-contracts/package.json": "modified",
    "packages/platform-contracts/payload-capture/package.json": "modified",
    "packages/platform-contracts/payload-capture/test/public-package.test.mjs": "modified",
    "packages/platform-contracts/readonly-miss-report/package.json": "modified",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": "modified",
    "packages/platform-contracts/root-atomic-claim/package.json": "modified",
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs": "modified",
    "packages/platform-contracts/src/external-call.d.mts": "modified",
    "packages/platform-contracts/src/external-call.mjs": "modified",
    "packages/platform-contracts/src/native-external-transport.d.mts": "modified",
    "packages/platform-contracts/src/native-external-transport.mjs": "modified",
    "packages/platform-contracts/test/api-path-transport.test.mjs": "added",
    "packages/platform-contracts/test/external-call.test.mjs": "modified",
    "packages/platform-contracts/test/types/api-path.mts": "added",
    "packages/platform-contracts/test/types/native-external.mts": "modified",
    "packages/platform-source-hub-contracts/README.md": "added",
    "packages/platform-source-hub-contracts/index.d.ts": "added",
    "packages/platform-source-hub-contracts/index.mjs": "added",
    "packages/platform-source-hub-contracts/package.json": "added",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "modified"
  },
  "modes": {
    ".github/workflows/newsfeed-ci.yml": "100644",
    ".github/workflows/platform-source-hub-ci.yml": "100644",
    "Canon/evidence/2026-11-03-source-hub-newsfeed-stage2a.md": "100644",
    "Canon/registries/platform-source-hub-contract-families-v1.json": "100644",
    "Canon/runbooks/newsfeed-source-hub-infrastructure-provisioning-v1.md": "100644",
    "apps/architecture-lab/sdk-1.33-compatibility.json": "100644",
    "apps/architecture-lab/test/payload-capture-publication.test.mjs": "100644",
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": "100644",
    "apps/dashboard-preview/package-lock.json": "100644",
    "apps/maps-runtime/package-lock.json": "100644",
    "apps/maps-runtime/platform-integration.json": "100644",
    "apps/maps-runtime/test/embed.test.mjs": "100644",
    "apps/newsfeed-runtime/README.md": "100644",
    "apps/newsfeed-runtime/docs/stage2b-activation.pl.md": "100644",
    "apps/newsfeed-runtime/examples/development.env.example": "100644",
    "apps/newsfeed-runtime/migrations/001-foundation.sql": "100644",
    "apps/newsfeed-runtime/operation-integration.json": "100644",
    "apps/newsfeed-runtime/package-lock.json": "100644",
    "apps/newsfeed-runtime/package.json": "100644",
    "apps/newsfeed-runtime/scripts/migrate.mjs": "100644",
    "apps/newsfeed-runtime/src/auth.mjs": "100644",
    "apps/newsfeed-runtime/src/capabilities.mjs": "100644",
    "apps/newsfeed-runtime/src/config.mjs": "100644",
    "apps/newsfeed-runtime/src/database.mjs": "100644",
    "apps/newsfeed-runtime/src/main.mjs": "100644",
    "apps/newsfeed-runtime/src/newsapi.mjs": "100644",
    "apps/newsfeed-runtime/src/query.mjs": "100644",
    "apps/newsfeed-runtime/src/repository.mjs": "100644",
    "apps/newsfeed-runtime/src/server.mjs": "100644",
    "apps/newsfeed-runtime/src/source-hub-client.mjs": "100644",
    "apps/newsfeed-runtime/test/end-to-end.test.mjs": "100644",
    "apps/newsfeed-runtime/test/fixtures.mjs": "100644",
    "apps/newsfeed-runtime/test/persistence.test.mjs": "100644",
    "apps/newsfeed-runtime/test/runtime-consumer.ts": "100644",
    "apps/newsfeed-runtime/test/runtime.test.mjs": "100644",
    "apps/newsfeed-runtime/tsconfig.json": "100644",
    "apps/platform-source-hub/README.md": "100644",
    "apps/platform-source-hub/docs/live-evidence.json": "100644",
    "apps/platform-source-hub/docs/provider-capabilities.pl.md": "100644",
    "apps/platform-source-hub/docs/stage2b-activation.pl.md": "100644",
    "apps/platform-source-hub/examples/development.env.example": "100644",
    "apps/platform-source-hub/migrations/001-foundation.sql": "100644",
    "apps/platform-source-hub/package-lock.json": "100644",
    "apps/platform-source-hub/package.json": "100644",
    "apps/platform-source-hub/scripts/ci-routing.mjs": "100644",
    "apps/platform-source-hub/scripts/live-probe.mjs": "100644",
    "apps/platform-source-hub/scripts/migrate.mjs": "100644",
    "apps/platform-source-hub/src/admission.mjs": "100644",
    "apps/platform-source-hub/src/auth.mjs": "100644",
    "apps/platform-source-hub/src/capabilities.mjs": "100644",
    "apps/platform-source-hub/src/config.mjs": "100644",
    "apps/platform-source-hub/src/database.mjs": "100644",
    "apps/platform-source-hub/src/errors.mjs": "100644",
    "apps/platform-source-hub/src/main.mjs": "100644",
    "apps/platform-source-hub/src/observability.mjs": "100644",
    "apps/platform-source-hub/src/providers/brave.mjs": "100644",
    "apps/platform-source-hub/src/providers/newsapi-capabilities.mjs": "100644",
    "apps/platform-source-hub/src/providers/newsapi-query.mjs": "100644",
    "apps/platform-source-hub/src/providers/newsapi.mjs": "100644",
    "apps/platform-source-hub/src/providers/trading-economics.mjs": "100644",
    "apps/platform-source-hub/src/repository.mjs": "100644",
    "apps/platform-source-hub/src/server.mjs": "100644",
    "apps/platform-source-hub/src/transport.mjs": "100644",
    "apps/platform-source-hub/test/adapters.test.mjs": "100644",
    "apps/platform-source-hub/test/ci-routing.test.mjs": "100644",
    "apps/platform-source-hub/test/contracts.test.mjs": "100644",
    "apps/platform-source-hub/test/fixtures.mjs": "100644",
    "apps/platform-source-hub/test/persistence.test.mjs": "100644",
    "apps/platform-source-hub/test/server.test.mjs": "100644",
    "apps/platform-source-hub/test/types.ts": "100644",
    "apps/platform-source-hub/tsconfig.json": "100644",
    "apps/sg-runtime/operation-integration.json": "100644",
    "apps/sg-runtime/package-lock.json": "100644",
    "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx": "100644",
    "apps/sg-runtime/tests/category-operation.test.ts": "100644",
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": "100644",
    "apps/sg-runtime/tests/identity-runtime.test.ts": "100644",
    "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs": "100644",
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": "100644",
    "apps/sg-runtime/tests/operation-context.test.mjs": "100644",
    "apps/sg-runtime/tests/pci-smart-integrity.mjs": "100644",
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": "100644",
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts": "100644",
    "apps/sg-runtime/tests/private-host.integration.test.mjs": "100644",
    "apps/sg-runtime/tests/self-service-account.test.ts": "100644",
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": "100644",
    "apps/sg-runtime/tests/xray-gateway.test.ts": "100644",
    "apps/srm/deployment/root-atomic-claim-targets.json": "100644",
    "apps/srm/operation-integration.json": "100644",
    "apps/srm/package-lock.json": "100644",
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": "100644",
    "apps/srm/scripts/native-execution-adoption.test.mjs": "100644",
    "apps/srm/scripts/operation-context.test.mjs": "100644",
    "apps/srm/scripts/private-host.integration.test.mjs": "100644",
    "apps/srm/scripts/request-quota-adoption.test.mjs": "100644",
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": "100644",
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": "100644",
    "apps/srm/scripts/xray-performance-adoption.test.mjs": "100644",
    "apps/srm/scripts/xray-style-acceptance.mjs": "100644",
    "apps/srm/src/server/full-ui-parity-adoption.test.ts": "100644",
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": "100644",
    "packages/maps-embed/package.json": "100644",
    "packages/newsfeed-contracts/README.md": "100644",
    "packages/newsfeed-contracts/index.d.ts": "100644",
    "packages/newsfeed-contracts/index.mjs": "100644",
    "packages/newsfeed-contracts/package.json": "100644",
    "packages/platform-contracts/README.md": "100644",
    "packages/platform-contracts/current-fresh-report/package.json": "100644",
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": "100644",
    "packages/platform-contracts/migrations/access/028-api-path-transport.sql": "100644",
    "packages/platform-contracts/package-lock.json": "100644",
    "packages/platform-contracts/package.json": "100644",
    "packages/platform-contracts/payload-capture/package.json": "100644",
    "packages/platform-contracts/payload-capture/test/public-package.test.mjs": "100644",
    "packages/platform-contracts/readonly-miss-report/package.json": "100644",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": "100644",
    "packages/platform-contracts/root-atomic-claim/package.json": "100644",
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs": "100644",
    "packages/platform-contracts/src/external-call.d.mts": "100644",
    "packages/platform-contracts/src/external-call.mjs": "100644",
    "packages/platform-contracts/src/native-external-transport.d.mts": "100644",
    "packages/platform-contracts/src/native-external-transport.mjs": "100644",
    "packages/platform-contracts/test/api-path-transport.test.mjs": "100644",
    "packages/platform-contracts/test/external-call.test.mjs": "100644",
    "packages/platform-contracts/test/types/api-path.mts": "100644",
    "packages/platform-contracts/test/types/native-external.mts": "100644",
    "packages/platform-source-hub-contracts/README.md": "100644",
    "packages/platform-source-hub-contracts/index.d.ts": "100644",
    "packages/platform-source-hub-contracts/index.mjs": "100644",
    "packages/platform-source-hub-contracts/package.json": "100644",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "100644"
  },
  "routes": {
    ".github/workflows/newsfeed-ci.yml": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-003"
    },
    ".github/workflows/platform-source-hub-ci.yml": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-003"
    },
    "Canon/evidence/2026-11-03-source-hub-newsfeed-stage2a.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-019"
    },
    "Canon/registries/platform-source-hub-contract-families-v1.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-019"
    },
    "Canon/runbooks/newsfeed-source-hub-infrastructure-provisioning-v1.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-019"
    },
    "apps/architecture-lab/sdk-1.33-compatibility.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    "apps/architecture-lab/test/payload-capture-publication.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    "apps/dashboard-preview/package-lock.json": {
      "projectKey": "SG2",
      "owner": "Dashboard Preview",
      "surfaceId": "SG2-BASE-003"
    },
    "apps/maps-runtime/package-lock.json": {
      "projectKey": "SRM",
      "owner": "Maps Capability",
      "surfaceId": "MAPS-BASE-001"
    },
    "apps/maps-runtime/platform-integration.json": {
      "projectKey": "SRM",
      "owner": "Maps Capability",
      "surfaceId": "MAPS-BASE-001"
    },
    "apps/maps-runtime/test/embed.test.mjs": {
      "projectKey": "SRM",
      "owner": "Maps Capability",
      "surfaceId": "MAPS-BASE-001"
    },
    "apps/newsfeed-runtime/README.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/docs/stage2b-activation.pl.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/examples/development.env.example": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/migrations/001-foundation.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/operation-integration.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/scripts/migrate.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/auth.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/capabilities.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/config.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/database.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/main.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/newsapi.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/query.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/repository.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/server.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/source-hub-client.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/test/end-to-end.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/test/fixtures.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/test/persistence.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/test/runtime-consumer.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/test/runtime.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/tsconfig.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/platform-source-hub/README.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/docs/live-evidence.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/docs/provider-capabilities.pl.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/docs/stage2b-activation.pl.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/examples/development.env.example": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/migrations/001-foundation.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/scripts/ci-routing.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/scripts/live-probe.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/scripts/migrate.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/admission.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/auth.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/capabilities.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/config.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/database.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/errors.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/main.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/observability.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/providers/brave.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/providers/newsapi-capabilities.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/providers/newsapi-query.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/providers/newsapi.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/providers/trading-economics.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/repository.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/server.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/transport.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/adapters.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/ci-routing.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/contracts.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/fixtures.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/persistence.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/server.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/types.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/tsconfig.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/sg-runtime/operation-integration.json": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/package-lock.json": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/category-operation.test.ts": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/identity-runtime.test.ts": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/operation-context.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/pci-smart-integrity.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/private-host.integration.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/self-service-account.test.ts": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-gateway.test.ts": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/srm/deployment/root-atomic-claim-targets.json": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/operation-integration.json": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/package-lock.json": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/native-execution-adoption.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/operation-context.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/private-host.integration.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/request-quota-adoption.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/xray-performance-adoption.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/xray-style-acceptance.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/full-ui-parity-adoption.test.ts": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "packages/maps-embed/package.json": {
      "projectKey": "SRM",
      "owner": "Maps Capability",
      "surfaceId": "MAPS-BASE-003"
    },
    "packages/newsfeed-contracts/README.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-002"
    },
    "packages/newsfeed-contracts/index.d.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-002"
    },
    "packages/newsfeed-contracts/index.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-002"
    },
    "packages/newsfeed-contracts/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-002"
    },
    "packages/platform-contracts/README.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-fresh-report/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/access/028-api-path-transport.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/payload-capture/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/payload-capture/test/public-package.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/readonly-miss-report/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/root-atomic-claim/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/external-call.d.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/external-call.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/native-external-transport.d.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/native-external-transport.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/api-path-transport.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/external-call.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/types/api-path.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/types/native-external.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-source-hub-contracts/README.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/index.d.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/index.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "scripts/governance/platform-source-hub-foundation.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-020"
    }
  }
})
// Proposed closed review; activation requires explicit owner acceptance.
export const SOURCE_HUB_CURRENT_E1_REVIEW=Object.freeze({
  "prNumber": 897,
  "branch": "architecture/source-hub-e1-current-authority-20261105",
  "reviewedCandidateSha": "1d1c33e557bbf134493f037a39e5ef3041dfe7b1",
  "reviewedBaseSha": "b4b6eda9dbfbbd9f84895ff215879ab2b65025cf",
  "blobs": {
    ".github/workflows/identity-runtime-ci.yml": "62a4a27b0b38fecff78f25fc4985ebd8cb8ceccd",
    ".github/workflows/newsfeed-ci.yml": "f2e99a70adc53054d1e22610934f6c4a92b1a961",
    ".github/workflows/platform-contracts-ci.yml": "adedd8ee30d6435f6e87cc2db53bd52dcbe16e96",
    ".github/workflows/platform-source-hub-ci.yml": "f82e434aaf89eedb31ff880b423257dbef0416fc",
    "Canon/runbooks/source-hub-newsfeed-current-e1-development-v1.md": "a74847b0d372bc34c8a0934c5f68d2020e047c46",
    "apps/identity-runtime/package-lock.json": "d4d225c60f81898435575a31957a73f292bbfeb5",
    "apps/identity-runtime/package.json": "d1c1cad8adcdb954dd7a97e18061890549e5a704",
    "apps/identity-runtime/src/current-e1-authority.ts": "4ef8933eaa1657a0434b6d56a9f8fec3c78ad2dd",
    "apps/identity-runtime/src/http-handler.ts": "6e43c77de313edfc216c4c6dc9889d398cc139fa",
    "apps/identity-runtime/src/main.ts": "aa6b22dcc7d314ef5080631d81db3ca9146c349f",
    "apps/identity-runtime/src/node-server.ts": "dce43b7cfc39aba60979ba82246dd93c9c3cd968",
    "apps/identity-runtime/test/current-e1-authority.test.mjs": "db4dbc28d4313b6be5480cbf4264fbad6e104ee2",
    "apps/newsfeed-runtime/migrations/002-current-e1-authority.sql": "470ccde47678a9d52d4a159911514441541e6d24",
    "apps/newsfeed-runtime/package-lock.json": "20f8df26a6bddd633d1914d641a9dd0c00335234",
    "apps/newsfeed-runtime/package.json": "6cad399c902f0f7eb8069f9df5012e19787e0802",
    "apps/newsfeed-runtime/src/auth.mjs": "184500508319b2b48af7eff65fe370fd1ce643f2",
    "apps/newsfeed-runtime/src/main.mjs": "5385e96f1977738b786ac5bbd199ab30ca26ec1c",
    "apps/platform-source-hub/migrations/003-current-e1-authority.sql": "662177cd3589b7ab6cc0d7bb0cbd0ecb13339de3",
    "apps/platform-source-hub/package-lock.json": "b3ad3efb27d6df5a64a0e42601795e95d1bc47d5",
    "apps/platform-source-hub/package.json": "dae235716077f803e9667d79dde419ea0564a595",
    "apps/platform-source-hub/src/auth.mjs": "36f9ed0a06bab10c0ff9668c3117a103dc6e4d64",
    "apps/platform-source-hub/src/main.mjs": "32c1689751bfe03ba482af283e832f1b54f85b40",
    "apps/platform-source-hub/test/current-e1-authority.test.mjs": "c4fb9f7b9b9e46467d767e26d231cfb5b18d9523",
    "packages/platform-contracts/current-e1-authority/index.d.mts": "96d5aba7f3000a3b6b2eecd6a3362cc79392b0bd",
    "packages/platform-contracts/current-e1-authority/index.mjs": "5dfd6e257fc1b9f705e789190363693d0159e374",
    "packages/platform-contracts/current-e1-authority/migrations/001-authority.sql": "939629ad95feb33dfcd50fdcfca1b96eeef83481",
    "packages/platform-contracts/current-e1-authority/migrations/002-receiver.sql": "7fae7faf5878af1ce092592d58aefec469333edd",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "64d39c20027464e647203ad6ae9d4f840b954ee5",
    "packages/platform-contracts/current-e1-authority/package.json": "5253bea26a931b2045694d696fc6ccdaae73d280",
    "packages/platform-contracts/test/current-e1-authority.test.mjs": "874bee12d21142ad8b6af2ece4e12362ed78c59e",
    "packages/platform-contracts/test/fixtures/current-e1-authority-postgres.mjs": "52e42cdba115bb3300b24022cbe81edbb9ca15dc"
  },
  "statuses": {
    ".github/workflows/identity-runtime-ci.yml": "modified",
    ".github/workflows/newsfeed-ci.yml": "modified",
    ".github/workflows/platform-contracts-ci.yml": "modified",
    ".github/workflows/platform-source-hub-ci.yml": "modified",
    "Canon/runbooks/source-hub-newsfeed-current-e1-development-v1.md": "added",
    "apps/identity-runtime/package-lock.json": "modified",
    "apps/identity-runtime/package.json": "modified",
    "apps/identity-runtime/src/current-e1-authority.ts": "added",
    "apps/identity-runtime/src/http-handler.ts": "modified",
    "apps/identity-runtime/src/main.ts": "modified",
    "apps/identity-runtime/src/node-server.ts": "modified",
    "apps/identity-runtime/test/current-e1-authority.test.mjs": "added",
    "apps/newsfeed-runtime/migrations/002-current-e1-authority.sql": "added",
    "apps/newsfeed-runtime/package-lock.json": "modified",
    "apps/newsfeed-runtime/package.json": "modified",
    "apps/newsfeed-runtime/src/auth.mjs": "modified",
    "apps/newsfeed-runtime/src/main.mjs": "modified",
    "apps/platform-source-hub/migrations/003-current-e1-authority.sql": "added",
    "apps/platform-source-hub/package-lock.json": "modified",
    "apps/platform-source-hub/package.json": "modified",
    "apps/platform-source-hub/src/auth.mjs": "modified",
    "apps/platform-source-hub/src/main.mjs": "modified",
    "apps/platform-source-hub/test/current-e1-authority.test.mjs": "added",
    "packages/platform-contracts/current-e1-authority/index.d.mts": "added",
    "packages/platform-contracts/current-e1-authority/index.mjs": "added",
    "packages/platform-contracts/current-e1-authority/migrations/001-authority.sql": "added",
    "packages/platform-contracts/current-e1-authority/migrations/002-receiver.sql": "added",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "added",
    "packages/platform-contracts/current-e1-authority/package.json": "added",
    "packages/platform-contracts/test/current-e1-authority.test.mjs": "added",
    "packages/platform-contracts/test/fixtures/current-e1-authority-postgres.mjs": "added"
  },
  "modes": {
    ".github/workflows/identity-runtime-ci.yml": "100644",
    ".github/workflows/newsfeed-ci.yml": "100644",
    ".github/workflows/platform-contracts-ci.yml": "100644",
    ".github/workflows/platform-source-hub-ci.yml": "100644",
    "Canon/runbooks/source-hub-newsfeed-current-e1-development-v1.md": "100644",
    "apps/identity-runtime/package-lock.json": "100644",
    "apps/identity-runtime/package.json": "100644",
    "apps/identity-runtime/src/current-e1-authority.ts": "100644",
    "apps/identity-runtime/src/http-handler.ts": "100644",
    "apps/identity-runtime/src/main.ts": "100644",
    "apps/identity-runtime/src/node-server.ts": "100644",
    "apps/identity-runtime/test/current-e1-authority.test.mjs": "100644",
    "apps/newsfeed-runtime/migrations/002-current-e1-authority.sql": "100644",
    "apps/newsfeed-runtime/package-lock.json": "100644",
    "apps/newsfeed-runtime/package.json": "100644",
    "apps/newsfeed-runtime/src/auth.mjs": "100644",
    "apps/newsfeed-runtime/src/main.mjs": "100644",
    "apps/platform-source-hub/migrations/003-current-e1-authority.sql": "100644",
    "apps/platform-source-hub/package-lock.json": "100644",
    "apps/platform-source-hub/package.json": "100644",
    "apps/platform-source-hub/src/auth.mjs": "100644",
    "apps/platform-source-hub/src/main.mjs": "100644",
    "apps/platform-source-hub/test/current-e1-authority.test.mjs": "100644",
    "packages/platform-contracts/current-e1-authority/index.d.mts": "100644",
    "packages/platform-contracts/current-e1-authority/index.mjs": "100644",
    "packages/platform-contracts/current-e1-authority/migrations/001-authority.sql": "100644",
    "packages/platform-contracts/current-e1-authority/migrations/002-receiver.sql": "100644",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "100644",
    "packages/platform-contracts/current-e1-authority/package.json": "100644",
    "packages/platform-contracts/test/current-e1-authority.test.mjs": "100644",
    "packages/platform-contracts/test/fixtures/current-e1-authority-postgres.mjs": "100644"
  },
  "routes": {
    ".github/workflows/identity-runtime-ci.yml": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-002"
    },
    ".github/workflows/newsfeed-ci.yml": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-003"
    },
    ".github/workflows/platform-contracts-ci.yml": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "ARCH-BASE-004"
    },
    ".github/workflows/platform-source-hub-ci.yml": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-003"
    },
    "Canon/runbooks/source-hub-newsfeed-current-e1-development-v1.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-019"
    },
    "apps/identity-runtime/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/src/current-e1-authority.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/src/http-handler.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/src/main.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/src/node-server.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/test/current-e1-authority.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/newsfeed-runtime/migrations/002-current-e1-authority.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/auth.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/src/main.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/platform-source-hub/migrations/003-current-e1-authority.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/auth.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/main.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/current-e1-authority.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/index.d.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/index.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/migrations/001-authority.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/migrations/002-receiver.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/current-e1-authority.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/fixtures/current-e1-authority-postgres.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    }
  }
});
// DRAFT closed admission; active only after separate owner approval and controlled main acceptance.
export const SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW=Object.freeze({
  "prNumber": 904,
  "branch": "architecture/source-hub-universal-consumers-20261105",
  "reviewedCandidateSha": "20cd23cec09657562b39bed8904cc1bb9981e08f",
  "reviewedBaseSha": "817c671e31606536a1536dd187165ac07145a0fc",
  "blobs": {
    "Canon/evidence/2026-11-05-source-hub-universal-first-party-access.md": "e87c6881214364461a8b20e0e7e7492dfe4318b4",
    "Canon/registries/governance-manifest-v2.json": "a5418bbd30b823cd8af266eca6b47e0e6911f04a",
    "Canon/runbooks/source-hub-first-party-development-v1.md": "d82cb8ee9d06316bfde733eb42193a9e75c0c290",
    "Canon/v1.1-platform-source-hub-universal-first-party-consumer-access.md": "04ef8f04c9fae22b82ffa1c2ea523f1e53d3ab98",
    "apps/identity-runtime/package-lock.json": "f855e265d8d28ab2157295650ec56801f197fb99",
    "apps/identity-runtime/src/http-handler.ts": "0c9d577edbb8e9dfc2087e894e30557af9fd96dc",
    "apps/identity-runtime/src/node-server.ts": "66a6684dc35650225de7552d6019cb8055a17c9d",
    "apps/identity-runtime/test/first-party-source.test.mjs": "46ce4e967fa40fa1af9ed73bd7f8a1c03bc7da4c",
    "apps/newsfeed-runtime/package-lock.json": "fe7ecc01586d0bdd84649a36639266c08807955a",
    "apps/platform-source-hub/README.md": "cef52e20c782107b71d94b712f3805ebae48983c",
    "apps/platform-source-hub/docs/first-party-consumers.pl.md": "99080644ef09d834aa3eefa051ef744a313e489a",
    "apps/platform-source-hub/examples/development.env.example": "50b99814ede98dbcec78d54baa6c9b2b92e1983b",
    "apps/platform-source-hub/migrations/004-universal-consumers.sql": "1314dcdca549d1cafdb58e62f49cd21fa6818a87",
    "apps/platform-source-hub/package-lock.json": "062bf99657ba46ef79136458db705384dff59712",
    "apps/platform-source-hub/scripts/migrate.mjs": "e055fef46fb1862ee1c423856d4c2ff51079fddd",
    "apps/platform-source-hub/src/config.mjs": "4e8d3f27d3e8c3feecbe9fa8dec63b0a6dfc8758",
    "apps/platform-source-hub/src/consumer-access.mjs": "e66475426872f1caf10bcef786a7fe23a505afb0",
    "apps/platform-source-hub/src/main.mjs": "d11e5b0b7297edce2198ff45809c82ef477daede",
    "apps/platform-source-hub/src/repository.mjs": "b57f2196658d9fa52b7b9030c0aadd755657d9bc",
    "apps/platform-source-hub/src/server.mjs": "ee340cc6a9aefe311446b4965f4f84139960550d",
    "apps/platform-source-hub/test/contracts.test.mjs": "de0b39ebd06893d239e057e4d29e13c1f59a79d0",
    "apps/platform-source-hub/test/first-party-consumers.test.mjs": "dfd1ef26af433944420ce52746419c917f825e64",
    "apps/platform-source-hub/test/first-party-fixtures.mjs": "d64edb0ef25f52319da03e14aef1bf058228f0ad",
    "apps/platform-source-hub/test/types.ts": "a9d9f1c821354334d61ccc609b55657dc9cffe7f",
    "packages/platform-contracts/current-e1-authority/first-party.d.mts": "2dc44e5a91df90b07a0fbf938fa4b5564c4e6b2f",
    "packages/platform-contracts/current-e1-authority/first-party.mjs": "d25879b372da5ec93103e6c4db5a71f6e819922e",
    "packages/platform-contracts/current-e1-authority/index.d.mts": "6bb7bad78ceb8a281ac5e901939f7b2b1e13ad6b",
    "packages/platform-contracts/current-e1-authority/index.mjs": "7a2ded45c6a94a930735617f61ebf7f46bb13702",
    "packages/platform-contracts/current-e1-authority/migrations/003-first-party-authority.sql": "2fe9411c299a301e383d6d282b153ba68db16a89",
    "packages/platform-contracts/current-e1-authority/migrations/004-first-party-receiver.sql": "617dffc411bbed4f295259f20337873a0e932ac6",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "24ef23d126043ef6ca8fee761285bc98cb952331",
    "packages/platform-contracts/current-e1-authority/package.json": "479331a99565c87c7cbb719abd80ba510291ef56",
    "packages/platform-contracts/test/first-party-source-access.test.mjs": "ffa9c8edb9a7ef4a506a95b6dfb602b4768cf447",
    "packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs": "3b1b3c1ba6e5c24db99b8622057a972eb3a91b39",
    "packages/platform-source-hub-contracts/README.md": "3c99f0cf2fde001935d2713401681ee2dd8b4ec2",
    "packages/platform-source-hub-contracts/client.d.mts": "a59c403e42df2553e744932562eeff998affc018",
    "packages/platform-source-hub-contracts/client.mjs": "aac33d8c53bc313d79e7a256b0233a36408311b7",
    "packages/platform-source-hub-contracts/package.json": "851c3a131a82033e2bf9b987d79db03d062569b9",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "2f21ec823028cec332748376770d9b80f715222c"
  },
  "statuses": {
    "Canon/evidence/2026-11-05-source-hub-universal-first-party-access.md": "added",
    "Canon/registries/governance-manifest-v2.json": "modified",
    "Canon/runbooks/source-hub-first-party-development-v1.md": "added",
    "Canon/v1.1-platform-source-hub-universal-first-party-consumer-access.md": "added",
    "apps/identity-runtime/package-lock.json": "modified",
    "apps/identity-runtime/src/http-handler.ts": "modified",
    "apps/identity-runtime/src/node-server.ts": "modified",
    "apps/identity-runtime/test/first-party-source.test.mjs": "added",
    "apps/newsfeed-runtime/package-lock.json": "modified",
    "apps/platform-source-hub/README.md": "modified",
    "apps/platform-source-hub/docs/first-party-consumers.pl.md": "added",
    "apps/platform-source-hub/examples/development.env.example": "modified",
    "apps/platform-source-hub/migrations/004-universal-consumers.sql": "added",
    "apps/platform-source-hub/package-lock.json": "modified",
    "apps/platform-source-hub/scripts/migrate.mjs": "modified",
    "apps/platform-source-hub/src/config.mjs": "modified",
    "apps/platform-source-hub/src/consumer-access.mjs": "added",
    "apps/platform-source-hub/src/main.mjs": "modified",
    "apps/platform-source-hub/src/repository.mjs": "modified",
    "apps/platform-source-hub/src/server.mjs": "modified",
    "apps/platform-source-hub/test/contracts.test.mjs": "modified",
    "apps/platform-source-hub/test/first-party-consumers.test.mjs": "added",
    "apps/platform-source-hub/test/first-party-fixtures.mjs": "added",
    "apps/platform-source-hub/test/types.ts": "modified",
    "packages/platform-contracts/current-e1-authority/first-party.d.mts": "added",
    "packages/platform-contracts/current-e1-authority/first-party.mjs": "added",
    "packages/platform-contracts/current-e1-authority/index.d.mts": "modified",
    "packages/platform-contracts/current-e1-authority/index.mjs": "modified",
    "packages/platform-contracts/current-e1-authority/migrations/003-first-party-authority.sql": "added",
    "packages/platform-contracts/current-e1-authority/migrations/004-first-party-receiver.sql": "added",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "modified",
    "packages/platform-contracts/current-e1-authority/package.json": "modified",
    "packages/platform-contracts/test/first-party-source-access.test.mjs": "added",
    "packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs": "added",
    "packages/platform-source-hub-contracts/README.md": "modified",
    "packages/platform-source-hub-contracts/client.d.mts": "added",
    "packages/platform-source-hub-contracts/client.mjs": "added",
    "packages/platform-source-hub-contracts/package.json": "modified",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "modified"
  },
  "modes": {
    "Canon/evidence/2026-11-05-source-hub-universal-first-party-access.md": "100644",
    "Canon/registries/governance-manifest-v2.json": "100644",
    "Canon/runbooks/source-hub-first-party-development-v1.md": "100644",
    "Canon/v1.1-platform-source-hub-universal-first-party-consumer-access.md": "100644",
    "apps/identity-runtime/package-lock.json": "100644",
    "apps/identity-runtime/src/http-handler.ts": "100644",
    "apps/identity-runtime/src/node-server.ts": "100644",
    "apps/identity-runtime/test/first-party-source.test.mjs": "100644",
    "apps/newsfeed-runtime/package-lock.json": "100644",
    "apps/platform-source-hub/README.md": "100644",
    "apps/platform-source-hub/docs/first-party-consumers.pl.md": "100644",
    "apps/platform-source-hub/examples/development.env.example": "100644",
    "apps/platform-source-hub/migrations/004-universal-consumers.sql": "100644",
    "apps/platform-source-hub/package-lock.json": "100644",
    "apps/platform-source-hub/scripts/migrate.mjs": "100644",
    "apps/platform-source-hub/src/config.mjs": "100644",
    "apps/platform-source-hub/src/consumer-access.mjs": "100644",
    "apps/platform-source-hub/src/main.mjs": "100644",
    "apps/platform-source-hub/src/repository.mjs": "100644",
    "apps/platform-source-hub/src/server.mjs": "100644",
    "apps/platform-source-hub/test/contracts.test.mjs": "100644",
    "apps/platform-source-hub/test/first-party-consumers.test.mjs": "100644",
    "apps/platform-source-hub/test/first-party-fixtures.mjs": "100644",
    "apps/platform-source-hub/test/types.ts": "100644",
    "packages/platform-contracts/current-e1-authority/first-party.d.mts": "100644",
    "packages/platform-contracts/current-e1-authority/first-party.mjs": "100644",
    "packages/platform-contracts/current-e1-authority/index.d.mts": "100644",
    "packages/platform-contracts/current-e1-authority/index.mjs": "100644",
    "packages/platform-contracts/current-e1-authority/migrations/003-first-party-authority.sql": "100644",
    "packages/platform-contracts/current-e1-authority/migrations/004-first-party-receiver.sql": "100644",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "100644",
    "packages/platform-contracts/current-e1-authority/package.json": "100644",
    "packages/platform-contracts/test/first-party-source-access.test.mjs": "100644",
    "packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs": "100644",
    "packages/platform-source-hub-contracts/README.md": "100644",
    "packages/platform-source-hub-contracts/client.d.mts": "100644",
    "packages/platform-source-hub-contracts/client.mjs": "100644",
    "packages/platform-source-hub-contracts/package.json": "100644",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "100644"
  },
  "routes": {
    "Canon/evidence/2026-11-05-source-hub-universal-first-party-access.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-019"
    },
    "Canon/registries/governance-manifest-v2.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-019"
    },
    "Canon/runbooks/source-hub-first-party-development-v1.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-019"
    },
    "Canon/v1.1-platform-source-hub-universal-first-party-consumer-access.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-019"
    },
    "apps/identity-runtime/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/src/http-handler.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/src/node-server.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/test/first-party-source.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/newsfeed-runtime/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/platform-source-hub/README.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/docs/first-party-consumers.pl.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/examples/development.env.example": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/migrations/004-universal-consumers.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/scripts/migrate.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/config.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/consumer-access.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/main.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/repository.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/server.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/contracts.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/first-party-consumers.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/first-party-fixtures.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/types.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/first-party.d.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/first-party.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/index.d.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/index.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/migrations/003-first-party-authority.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/migrations/004-first-party-receiver.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/first-party-source-access.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-source-hub-contracts/README.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/client.d.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/client.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "scripts/governance/platform-source-hub-foundation.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-020"
    }
  }
});
function isPinnedUniversalFirstPartyReview(files){
 const r=SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW;
 return Array.isArray(files)&&files.length===Object.keys(r.blobs).length&&new Set(files.map(f=>f?.filename)).size===files.length
  &&files.every(f=>Object.hasOwn(r.blobs,f?.filename??'')&&f.sha===r.blobs[f.filename]&&f.status===r.statuses[f.filename]&&!Object.hasOwn(f,'previous_filename'));
}
function assertUniversalFirstPartyRoutes(files,repositoryRoot){
 for(const f of files){const e=SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW.routes[f.filename],profile=resolveProjectProfile(e.projectKey,repositoryRoot),route=resolveProjectRouting({profile,targets:[f.filename],repositoryRoot});
  if(!route.ok||route.results.length!==1)fail('UNIVERSAL_FIRST_PARTY_ROUTING_REJECTED');const r=route.results[0];
  if(r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.baselineClassification!=='ALIGNED'||r.projectBoundaryStatus!=='ALLOWED'||r.currentOwner!==e.owner||r.matchedSurfaceId!==e.surfaceId)fail('UNIVERSAL_FIRST_PARTY_ROUTING_REJECTED');
 }
}
export function assertUniversalFirstPartyReviewEntry(file,entry){
 const r=SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW;
 if(!Object.hasOwn(r.blobs,file?.filename??'')||file.sha!==r.blobs[file.filename]||entry!==r.modes[file.filename]+' blob '+file.sha+'\t'+file.filename+'\0')fail('UNIVERSAL_FIRST_PARTY_FILE_MODE_REJECTED');
}

function isPinnedCurrentE1Review(files){
 const r=SOURCE_HUB_CURRENT_E1_REVIEW;
 return Array.isArray(files)&&files.length===Object.keys(r.blobs).length&&new Set(files.map(f=>f?.filename)).size===files.length
  &&files.every(f=>Object.hasOwn(r.blobs,f?.filename??'')&&f.sha===r.blobs[f.filename]&&f.status===r.statuses[f.filename]&&!Object.hasOwn(f,'previous_filename'));
}
function assertCurrentE1Routes(files,repositoryRoot){
 for(const f of files){const e=SOURCE_HUB_CURRENT_E1_REVIEW.routes[f.filename],profile=resolveProjectProfile(e.projectKey,repositoryRoot),route=resolveProjectRouting({profile,targets:[f.filename],repositoryRoot});
  if(!route.ok||route.results.length!==1)fail('CURRENT_E1_ROUTING_REJECTED');const r=route.results[0];
  if(r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.baselineClassification!=='ALIGNED'||r.projectBoundaryStatus!=='ALLOWED'||r.currentOwner!==e.owner||r.matchedSurfaceId!==e.surfaceId)fail('CURRENT_E1_ROUTING_REJECTED');
 }
}
export function assertCurrentE1ReviewEntry(file,entry){
 const r=SOURCE_HUB_CURRENT_E1_REVIEW;
 if(!Object.hasOwn(r.blobs,file?.filename??'')||file.sha!==r.blobs[file.filename]||entry!==r.modes[file.filename]+' blob '+file.sha+'\t'+file.filename+'\0')fail('CURRENT_E1_FILE_MODE_REJECTED');
}

function isPinnedSourceHubStage2aReview(files){
 return Array.isArray(files)&&files.length===Object.keys(SOURCE_HUB_STAGE2A_REVIEW.blobs).length
  &&new Set(files.map(f=>f?.filename)).size===files.length
  &&files.every(f=>Object.hasOwn(SOURCE_HUB_STAGE2A_REVIEW.blobs,f?.filename??'')
   &&f.sha===SOURCE_HUB_STAGE2A_REVIEW.blobs[f.filename]&&f.status===SOURCE_HUB_STAGE2A_REVIEW.statuses[f.filename]&&!Object.hasOwn(f,'previous_filename'))
}
function assertSourceHubStage2aRoutes(files,repositoryRoot){
 for(const file of files){
  const expected=SOURCE_HUB_STAGE2A_REVIEW.routes[file.filename],profile=resolveProjectProfile(expected.projectKey,repositoryRoot)
  const route=resolveProjectRouting({profile,targets:[file.filename],repositoryRoot})
  if(!route.ok||route.results.length!==1)fail('SOURCE_HUB_STAGE2A_ROUTING_REJECTED')
  const r=route.results[0]
  if(r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.baselineClassification!=='ALIGNED'
   ||r.projectBoundaryStatus!=='ALLOWED'||r.currentOwner!==expected.owner||r.matchedSurfaceId!==expected.surfaceId)fail('SOURCE_HUB_STAGE2A_ROUTING_REJECTED')
 }
}

// Proposed exact ECR G1 review; activation requires separate CI-policy approval
// and controlled trusted-main acceptance. No generic Canon/app admission.
export const ECR_G1_GOVERNANCE_REVIEW=Object.freeze({
  "prNumber": 906,
  "branch": "architecture/ecr-sourcehub-backend-20261106",
  "reviewedCandidateSha": "253bdbd0f445914e2f964d42cd2206de093cb460",
  "reviewedBaseSha": "1cc5282c718ab1ce85fa9da4831592739c0ff899",
  "blobs": Object.freeze({
    ".github/workflows/governance-preflight.yml": "8c268570c40d515fac63905542a5c5997e71034f",
    "Canon/evidence/2026-11-06-ecr-g1-governance-activation.md": "116e038301c335c7392f8e6fd49db791f009d7d3",
    "Canon/evidence/2026-11-06-ecr-sourcehub-preimplementation-reconciliation.md": "1f402303038194cb6dcc7bc5c11fe3b80a64522e",
    "Canon/proposals/economic-calendar-runtime-source-hub-g1-v1.json": "e0b23cd708d1caad3101d31503e6bfa7107aa290",
    "Canon/proposals/v1.1-economic-calendar-runtime-source-hub-and-preferences-amendment.md": "88169bd1a8edae5a2e6fa7ebb83a8d3f89932c41",
    "Canon/registries/architecture-onboarding-v1.json": "6070fb51ab0dadb15ada4be789fdce15152e3f54",
    "Canon/registries/current-architecture-baseline-v1.json": "b24b5f1f9586d6947d192138a0d76b65815405ce",
    "Canon/registries/governance-manifest-v2.json": "42a0d520016786131efcddfb5d34f84bc44c43ec",
    "Canon/v1.0-economic-calendar-runtime-business-and-architecture-canon.md": "66166b72b0cfb16937203cd74b7a7c00f67e840d",
    "Canon/v1.1-economic-calendar-runtime-source-hub-and-preferences-amendment.md": "73a181d9178dc0863d42376071b42e0c7be879c1",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "ef22e9e324cb309ca689aa742685ceb2563a8242",
    "scripts/governance/ecr-routing.test.mjs": "0b0753392f309c5e5b0c071e35784b38a7204d4c"
  }),
  "statuses": Object.freeze({
    ".github/workflows/governance-preflight.yml": "modified",
    "Canon/evidence/2026-11-06-ecr-g1-governance-activation.md": "added",
    "Canon/evidence/2026-11-06-ecr-sourcehub-preimplementation-reconciliation.md": "added",
    "Canon/proposals/economic-calendar-runtime-source-hub-g1-v1.json": "added",
    "Canon/proposals/v1.1-economic-calendar-runtime-source-hub-and-preferences-amendment.md": "added",
    "Canon/registries/architecture-onboarding-v1.json": "modified",
    "Canon/registries/current-architecture-baseline-v1.json": "modified",
    "Canon/registries/governance-manifest-v2.json": "modified",
    "Canon/v1.0-economic-calendar-runtime-business-and-architecture-canon.md": "added",
    "Canon/v1.1-economic-calendar-runtime-source-hub-and-preferences-amendment.md": "added",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "modified",
    "scripts/governance/ecr-routing.test.mjs": "added"
  }),
  "modes": Object.freeze({
    ".github/workflows/governance-preflight.yml": "100644",
    "Canon/evidence/2026-11-06-ecr-g1-governance-activation.md": "100644",
    "Canon/evidence/2026-11-06-ecr-sourcehub-preimplementation-reconciliation.md": "100644",
    "Canon/proposals/economic-calendar-runtime-source-hub-g1-v1.json": "100644",
    "Canon/proposals/v1.1-economic-calendar-runtime-source-hub-and-preferences-amendment.md": "100644",
    "Canon/registries/architecture-onboarding-v1.json": "100644",
    "Canon/registries/current-architecture-baseline-v1.json": "100644",
    "Canon/registries/governance-manifest-v2.json": "100644",
    "Canon/v1.0-economic-calendar-runtime-business-and-architecture-canon.md": "100644",
    "Canon/v1.1-economic-calendar-runtime-source-hub-and-preferences-amendment.md": "100644",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "100644",
    "scripts/governance/ecr-routing.test.mjs": "100644"
  })
});
function isPinnedEcrG1Review(files){
 const r=ECR_G1_GOVERNANCE_REVIEW;
 return Array.isArray(files)&&files.length===Object.keys(r.blobs).length&&new Set(files.map(f=>f?.filename)).size===files.length
  &&files.every(f=>Object.hasOwn(r.blobs,f?.filename??'')&&f.sha===r.blobs[f.filename]&&f.status===r.statuses[f.filename]&&!Object.hasOwn(f,'previous_filename'));
}
export function assertEcrG1ReviewEntry(file,entry){
 const r=ECR_G1_GOVERNANCE_REVIEW;
 if(!Object.hasOwn(r.blobs,file?.filename??'')||file.sha!==r.blobs[file.filename]||entry!==r.modes[file.filename]+' blob '+file.sha+'\t'+file.filename+'\0')fail('ECR_G1_FILE_MODE_REJECTED');
}

// Proposed exact backend review; activation needs the separate trusted-CI decision.
// No generic ECR, SourceHub, optional-package or workflow admission.
export const ECR_BACKEND_REVIEW=Object.freeze({
  "prNumber": 908,
  "branch": "architecture/ecr-sourcehub-live-backend-20261106",
  "reviewedCandidateSha": "253e20369fcd26f1985fc14188fd3e7f927a8faa",
  "reviewedBaseSha": "b837f93b47d15cd812242a2ab0df6e69c35b3656",
  "blobs": Object.freeze({
    ".github/workflows/economic-calendar-ci.yml": "12eb6ae888b891fcb794ac537556f36678bbb828",
    "apps/economic-calendar-runtime/README.md": "72ed33ccd3fa94f0907126d8c24da5f2edbd00d9",
    "apps/economic-calendar-runtime/migrations/001-read-model-and-preferences.sql": "4d9690e08c47ac4ed58b273ed5c9f09ab6cb7105",
    "apps/economic-calendar-runtime/package-lock.json": "a7527da73893091511fe30b0e0cedfacaf6dc7fb",
    "apps/economic-calendar-runtime/package.json": "0eaf4e2a8a7e431a083bdd58c3873abfdc0cd7f2",
    "apps/economic-calendar-runtime/scripts/live-probe.mjs": "b47e1e282523b2937ac1fa1f777de420bb36ee8a",
    "apps/economic-calendar-runtime/scripts/migrate.mjs": "41ace4d3f2b983f543353140380426ecd4d79127",
    "apps/economic-calendar-runtime/scripts/sync.mjs": "f1a8160cef52003fd90c32c864011e0db478f339",
    "apps/economic-calendar-runtime/src/authorization.mjs": "97555300ace3caba31ed9c7d5adc8444e3ea3f30",
    "apps/economic-calendar-runtime/src/config.mjs": "bc6db6c34b0fca6e08df9ca786cc44fcaa72cc59",
    "apps/economic-calendar-runtime/src/database.mjs": "0f1b9a301115f0356edf21076dcd8156faab7c52",
    "apps/economic-calendar-runtime/src/main.mjs": "3464c71a0c76cc0cbc0d686709978983377b221f",
    "apps/economic-calendar-runtime/src/repository.mjs": "693649986edd11bf3840cc1a940b09f9a67c6285",
    "apps/economic-calendar-runtime/src/server.mjs": "7a06460f1d31afa81ef79b5bb0b681bf3de1fb8c",
    "apps/economic-calendar-runtime/src/synchronization.mjs": "d51df55cf0f3381d1c215ad0ac2e6973fdc9161a",
    "apps/economic-calendar-runtime/test/api.test.mjs": "2366633c1e6c9fa9e48f63f82a2992d6215124fc",
    "apps/economic-calendar-runtime/test/contracts.test.mjs": "05a46dcb3ea41626a366f0089cce5c64a44fa6e6",
    "apps/economic-calendar-runtime/test/fixtures.mjs": "4f93e9f718b20f102d50b8bab99ace96588de58b",
    "apps/economic-calendar-runtime/test/persistence.test.mjs": "7d510927db554f498a0dacc094eead0d69eb15f8",
    "apps/economic-calendar-runtime/tsconfig.json": "42ba04cd71eb3fb517f178bd3750c98f1dbf4ff3",
    "apps/identity-runtime/package-lock.json": "49dbc0545c1436e85314815225c60d55fafb52f8",
    "apps/newsfeed-runtime/package-lock.json": "6cfbb8246d0f58bc02f12ea8cf147ba5b55ac67b",
    "apps/platform-source-hub/migrations/005-calendar-storage-rights.sql": "facd971fa6dab54ccf1abfde63f8fe577b3fbef1",
    "apps/platform-source-hub/package-lock.json": "07c19d47e5ac09def559a6e9623fcb94caf966ee",
    "apps/platform-source-hub/scripts/migrate.mjs": "005025b14a07809b97189d8b5eda667a1df6483e",
    "apps/platform-source-hub/src/repository.mjs": "73fea99afdc0354e8a74d6f8742cd022d0dcd460",
    "apps/platform-source-hub/test/calendar-storage-rights.test.mjs": "b81b8f53506071666110bc5827c65860f7c12999",
    "packages/economic-calendar-contracts/README.md": "23925c87b98618786affb733d919017a8886a69d",
    "packages/economic-calendar-contracts/index.d.mts": "7c9b8fd8d609c32c6632b93b9946318c84e30bbb",
    "packages/economic-calendar-contracts/index.mjs": "90cf9ef27606b0c7553404e74a3f09f83a2f61f0",
    "packages/economic-calendar-contracts/package.json": "3c678a9df08fd947eb6adcf9618fd423bbfa5f91",
    "packages/platform-contracts/current-e1-authority/index.d.mts": "ba7cb5805c35147bf35bb9329dc6e795a1e7d5f5",
    "packages/platform-contracts/current-e1-authority/index.mjs": "7cd90689ab9784d4fd850d70b9b41254c367603c",
    "packages/platform-contracts/current-e1-authority/migrations/005-calendar-authority.sql": "6bb3d8e4f933c865622c46ece9aa645f04c71a2f",
    "packages/platform-contracts/current-e1-authority/migrations/006-calendar-receiver.sql": "f2da72a900788c6ff553593481fa8e8fd3e0ec3f",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "67fac0488840af61b5e468823800de3be977e014",
    "packages/platform-contracts/current-e1-authority/package.json": "304041670c2bf73e00db8bf9503dc1f0f1e91657",
    "packages/platform-contracts/test/calendar-current-e1.test.mjs": "6a6eae1433d61c9a115a1964e8b2d8e0e08265f6",
    "packages/platform-contracts/test/fixtures/calendar-current-e1-postgres.mjs": "b572f81391c6e2e538cb4f2d5138447fe842ed28",
    "packages/platform-source-hub-contracts/README.md": "3edc86b198596abd871d5b8e2b345bdf8ec53aa3",
    "packages/platform-source-hub-contracts/index.d.ts": "a8ff3cc62fc8013c6c153529c4ecdc2a1650dfde",
    "packages/platform-source-hub-contracts/index.mjs": "5e19c2d7d56ab4a2741d8b10df7c44e46d7a35a4",
    "packages/platform-source-hub-contracts/package.json": "17dedd4bcf6911def103f9b282765898b37391cc",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "8517f71a2e1556b20da36ba5888824bb0ddb1605"
  }),
  "statuses": Object.freeze({
    ".github/workflows/economic-calendar-ci.yml": "added",
    "apps/economic-calendar-runtime/README.md": "added",
    "apps/economic-calendar-runtime/migrations/001-read-model-and-preferences.sql": "added",
    "apps/economic-calendar-runtime/package-lock.json": "added",
    "apps/economic-calendar-runtime/package.json": "added",
    "apps/economic-calendar-runtime/scripts/live-probe.mjs": "added",
    "apps/economic-calendar-runtime/scripts/migrate.mjs": "added",
    "apps/economic-calendar-runtime/scripts/sync.mjs": "added",
    "apps/economic-calendar-runtime/src/authorization.mjs": "added",
    "apps/economic-calendar-runtime/src/config.mjs": "added",
    "apps/economic-calendar-runtime/src/database.mjs": "added",
    "apps/economic-calendar-runtime/src/main.mjs": "added",
    "apps/economic-calendar-runtime/src/repository.mjs": "added",
    "apps/economic-calendar-runtime/src/server.mjs": "added",
    "apps/economic-calendar-runtime/src/synchronization.mjs": "added",
    "apps/economic-calendar-runtime/test/api.test.mjs": "added",
    "apps/economic-calendar-runtime/test/contracts.test.mjs": "added",
    "apps/economic-calendar-runtime/test/fixtures.mjs": "added",
    "apps/economic-calendar-runtime/test/persistence.test.mjs": "added",
    "apps/economic-calendar-runtime/tsconfig.json": "added",
    "apps/identity-runtime/package-lock.json": "modified",
    "apps/newsfeed-runtime/package-lock.json": "modified",
    "apps/platform-source-hub/migrations/005-calendar-storage-rights.sql": "added",
    "apps/platform-source-hub/package-lock.json": "modified",
    "apps/platform-source-hub/scripts/migrate.mjs": "modified",
    "apps/platform-source-hub/src/repository.mjs": "modified",
    "apps/platform-source-hub/test/calendar-storage-rights.test.mjs": "added",
    "packages/economic-calendar-contracts/README.md": "added",
    "packages/economic-calendar-contracts/index.d.mts": "added",
    "packages/economic-calendar-contracts/index.mjs": "added",
    "packages/economic-calendar-contracts/package.json": "added",
    "packages/platform-contracts/current-e1-authority/index.d.mts": "modified",
    "packages/platform-contracts/current-e1-authority/index.mjs": "modified",
    "packages/platform-contracts/current-e1-authority/migrations/005-calendar-authority.sql": "added",
    "packages/platform-contracts/current-e1-authority/migrations/006-calendar-receiver.sql": "added",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "modified",
    "packages/platform-contracts/current-e1-authority/package.json": "modified",
    "packages/platform-contracts/test/calendar-current-e1.test.mjs": "added",
    "packages/platform-contracts/test/fixtures/calendar-current-e1-postgres.mjs": "added",
    "packages/platform-source-hub-contracts/README.md": "modified",
    "packages/platform-source-hub-contracts/index.d.ts": "modified",
    "packages/platform-source-hub-contracts/index.mjs": "modified",
    "packages/platform-source-hub-contracts/package.json": "modified",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "modified"
  }),
  "modes": Object.freeze({
    ".github/workflows/economic-calendar-ci.yml": "100644",
    "apps/economic-calendar-runtime/README.md": "100644",
    "apps/economic-calendar-runtime/migrations/001-read-model-and-preferences.sql": "100644",
    "apps/economic-calendar-runtime/package-lock.json": "100644",
    "apps/economic-calendar-runtime/package.json": "100644",
    "apps/economic-calendar-runtime/scripts/live-probe.mjs": "100644",
    "apps/economic-calendar-runtime/scripts/migrate.mjs": "100644",
    "apps/economic-calendar-runtime/scripts/sync.mjs": "100644",
    "apps/economic-calendar-runtime/src/authorization.mjs": "100644",
    "apps/economic-calendar-runtime/src/config.mjs": "100644",
    "apps/economic-calendar-runtime/src/database.mjs": "100644",
    "apps/economic-calendar-runtime/src/main.mjs": "100644",
    "apps/economic-calendar-runtime/src/repository.mjs": "100644",
    "apps/economic-calendar-runtime/src/server.mjs": "100644",
    "apps/economic-calendar-runtime/src/synchronization.mjs": "100644",
    "apps/economic-calendar-runtime/test/api.test.mjs": "100644",
    "apps/economic-calendar-runtime/test/contracts.test.mjs": "100644",
    "apps/economic-calendar-runtime/test/fixtures.mjs": "100644",
    "apps/economic-calendar-runtime/test/persistence.test.mjs": "100644",
    "apps/economic-calendar-runtime/tsconfig.json": "100644",
    "apps/identity-runtime/package-lock.json": "100644",
    "apps/newsfeed-runtime/package-lock.json": "100644",
    "apps/platform-source-hub/migrations/005-calendar-storage-rights.sql": "100644",
    "apps/platform-source-hub/package-lock.json": "100644",
    "apps/platform-source-hub/scripts/migrate.mjs": "100644",
    "apps/platform-source-hub/src/repository.mjs": "100644",
    "apps/platform-source-hub/test/calendar-storage-rights.test.mjs": "100644",
    "packages/economic-calendar-contracts/README.md": "100644",
    "packages/economic-calendar-contracts/index.d.mts": "100644",
    "packages/economic-calendar-contracts/index.mjs": "100644",
    "packages/economic-calendar-contracts/package.json": "100644",
    "packages/platform-contracts/current-e1-authority/index.d.mts": "100644",
    "packages/platform-contracts/current-e1-authority/index.mjs": "100644",
    "packages/platform-contracts/current-e1-authority/migrations/005-calendar-authority.sql": "100644",
    "packages/platform-contracts/current-e1-authority/migrations/006-calendar-receiver.sql": "100644",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "100644",
    "packages/platform-contracts/current-e1-authority/package.json": "100644",
    "packages/platform-contracts/test/calendar-current-e1.test.mjs": "100644",
    "packages/platform-contracts/test/fixtures/calendar-current-e1-postgres.mjs": "100644",
    "packages/platform-source-hub-contracts/README.md": "100644",
    "packages/platform-source-hub-contracts/index.d.ts": "100644",
    "packages/platform-source-hub-contracts/index.mjs": "100644",
    "packages/platform-source-hub-contracts/package.json": "100644",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "100644"
  }),
  "routes": Object.freeze({
    ".github/workflows/economic-calendar-ci.yml": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-003"
    },
    "apps/economic-calendar-runtime/README.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/migrations/001-read-model-and-preferences.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/scripts/live-probe.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/scripts/migrate.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/scripts/sync.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/src/authorization.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/src/config.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/src/database.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/src/main.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/src/repository.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/src/server.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/src/synchronization.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/test/api.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/test/contracts.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/test/fixtures.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/test/persistence.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/economic-calendar-runtime/tsconfig.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/identity-runtime/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/newsfeed-runtime/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/platform-source-hub/migrations/005-calendar-storage-rights.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/scripts/migrate.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/repository.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/calendar-storage-rights.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "packages/economic-calendar-contracts/README.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-002"
    },
    "packages/economic-calendar-contracts/index.d.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-002"
    },
    "packages/economic-calendar-contracts/index.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-002"
    },
    "packages/economic-calendar-contracts/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-002"
    },
    "packages/platform-contracts/current-e1-authority/index.d.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/index.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/migrations/005-calendar-authority.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/migrations/006-calendar-receiver.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/calendar-current-e1.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/fixtures/calendar-current-e1-postgres.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-source-hub-contracts/README.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/index.d.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/index.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "scripts/governance/platform-source-hub-foundation.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-020"
    }
  })
});
function isPinnedEcrBackendReview(files){
 const r=ECR_BACKEND_REVIEW;
 return Array.isArray(files)&&files.length===Object.keys(r.blobs).length&&new Set(files.map(f=>f?.filename)).size===files.length
  &&files.every(f=>Object.hasOwn(r.blobs,f?.filename??'')&&f.sha===r.blobs[f.filename]&&f.status===r.statuses[f.filename]&&!Object.hasOwn(f,'previous_filename'));
}
function assertEcrBackendRoutes(files,repositoryRoot){
 for(const f of files){const e=ECR_BACKEND_REVIEW.routes[f.filename],profile=resolveProjectProfile(e.projectKey,repositoryRoot),route=resolveProjectRouting({profile,targets:[f.filename],repositoryRoot});
  if(!route.ok||route.results.length!==1)fail('ECR_BACKEND_ROUTING_REJECTED');const r=route.results[0];
  if(r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.baselineClassification!=='ALIGNED'||r.projectBoundaryStatus!=='ALLOWED'||r.currentOwner!==e.owner||r.matchedSurfaceId!==e.surfaceId)fail('ECR_BACKEND_ROUTING_REJECTED');
 }
}
export function assertEcrBackendReviewEntry(file,entry){
 const r=ECR_BACKEND_REVIEW;
 if(!Object.hasOwn(r.blobs,file?.filename??'')||file.sha!==r.blobs[file.filename]||entry!==r.modes[file.filename]+' blob '+file.sha+'\t'+file.filename+'\0')fail('ECR_BACKEND_FILE_MODE_REJECTED');
}

// Proposed exact PR915 review. Owner approval and trusted-main acceptance
// remain required before this class is active. No generic consumer admission.
export const SOURCE_HUB_MARKET_SYMBOL_REVIEW=Object.freeze({
  "prNumber": 915,
  "branch": "architecture/source-hub-te-markets-20261106",
  "reviewedCandidateSha": "1739f9ef55dd758837701d249955901fb97b7df0",
  "reviewedBaseSha": "4628637868ed8eeb109d1f10ff4bff35bc6f6c07",
  "ownerPacketSha256": "a84e18017e44af327d85f119235db0426c3b368148ea6f9201159d147b37291d",
  "blobs": {
    "apps/architecture-lab/sdk-1.34-compatibility.json": "49b8e909f1e2b55444be78f4df64f6ba77bdef13",
    "apps/architecture-lab/test/payload-capture-publication.test.mjs": "5d7a33b406321345b9be2087a689f115578ac269",
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": "9ce1c127f1e5b93e83de96d55a212fbdb0d5a404",
    "apps/dashboard-preview/package-lock.json": "ac4ce0d294e90b6f09098e96fdf0a42261d5f74e",
    "apps/economic-calendar-runtime/package-lock.json": "6a56fa4ab6fcdb59106ff95e836978c2054c6589",
    "apps/identity-runtime/package-lock.json": "ae072fbf79a1e394edbdf65251546b02f6b8d6fe",
    "apps/maps-runtime/package-lock.json": "2b71f123fbcba197c19e0d7f0e0e6037f9a0884d",
    "apps/maps-runtime/platform-integration.json": "6804bed810919a76b3add7e8dade4210d6e28a76",
    "apps/maps-runtime/test/embed.test.mjs": "c811135dd1ddcab69f96c7f56f623adb83520b91",
    "apps/newsfeed-runtime/operation-integration.json": "4c5e7be29c86b32b97cb3e86fea376782a770cc0",
    "apps/newsfeed-runtime/package-lock.json": "928c68e2b196122b9eedfdf5b88e8542b0438c63",
    "apps/newsfeed-runtime/test/runtime.test.mjs": "61f8e088279d2f2814c415a40f5754352f6eba1d",
    "apps/platform-source-hub/docs/te-market-observations.pl.md": "3a960f8e9d83832be9d679b43362c3375b2df845",
    "apps/platform-source-hub/migrations/006-market-observations.sql": "20846f08940e5ae11543dc1be7d731d6ff0da126",
    "apps/platform-source-hub/package-lock.json": "7ca22b70d53643b9d04c1e07806b0f6ca1d85af4",
    "apps/platform-source-hub/scripts/ci-routing.mjs": "350154eddbedc3993f9e93e4a596618a92354a3a",
    "apps/platform-source-hub/scripts/migrate.mjs": "2c39af69187473e0db57c032ef906eb473e31def",
    "apps/platform-source-hub/src/admission.mjs": "879cd2384380548512658791e88c6bb9aee4eb37",
    "apps/platform-source-hub/src/capabilities.mjs": "0a7880b0130e67f8d9746d182d51058a803d4d46",
    "apps/platform-source-hub/src/providers/trading-economics.mjs": "438725236ea62fe3c54bc1e664169ce9af1a9422",
    "apps/platform-source-hub/test/ci-routing.test.mjs": "58ca917d83ddd202f4e80beee37ef9608b4ed1e4",
    "apps/platform-source-hub/test/contracts.test.mjs": "2ce2f6c8ff50b8b2dfa6bc2cc5a5189e725db1e0",
    "apps/platform-source-hub/test/market-observations.test.mjs": "f9db8106d1d3e55833015573dd7a668bab5cbd1f",
    "apps/platform-source-hub/test/types.ts": "28f8789636779117033362ec87c473b0167b3f7d",
    "apps/sg-runtime/operation-integration.json": "4e831c2ea51b653c34e91687dff8312f42a7207f",
    "apps/sg-runtime/package-lock.json": "6a19915f9d99cfd38bd12c66e603c099212b574c",
    "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx": "4a900d47ea56f39ba3aacfc50fe53e1b2c4f5810",
    "apps/sg-runtime/tests/category-operation.test.ts": "fe945f98850d32e1b357da2512a483cc758e035d",
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": "9c50f41c83ca6e93c7e443ab7f413c2d2e4047f3",
    "apps/sg-runtime/tests/identity-runtime.test.ts": "b7ba0ccc33976b02e6819d236411b8516bdf0c9b",
    "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs": "c0995266f30b8d8124e08830c79ac7ca2afd1a73",
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": "59bda2c6d00b7fa7b5b5a51b89d4a9bbb098bc94",
    "apps/sg-runtime/tests/operation-context.test.mjs": "10ca94bc15e525950c8b8a89a38576149e81e75f",
    "apps/sg-runtime/tests/pci-smart-integrity.mjs": "871c45f3005e0dcd8c4ca753bfe96b35c99e845c",
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": "3d6b52129fdb014827a24e5cced7adac3dec7e6c",
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts": "96258d1bd47adec6db2cd3f4a2b64a96496bcf91",
    "apps/sg-runtime/tests/private-host.integration.test.mjs": "87d97bb7fb6e11c1bae3ecfe3fbd82e17f33ce74",
    "apps/sg-runtime/tests/self-service-account.test.ts": "f3812e1cb2e3dcd48bfcd503840493f51e76945e",
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": "2a77311736b608b3b0cafe0259001db7500ba828",
    "apps/sg-runtime/tests/xray-gateway.test.ts": "97e894c10990ddddaaa8fa35acc6efabdb6899ab",
    "apps/srm/deployment/root-atomic-claim-targets.json": "6b5c3724b04ec91ad0b392ef75de3ba826c7ec03",
    "apps/srm/operation-integration.json": "dce564628433aa0fdcc2c0a95716114e7c2cb236",
    "apps/srm/package-lock.json": "57ef53ade93ff7f37b7742d2869ca8ffa0addda2",
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": "dde529baeec362194b19f0f7afa6ad8390587f41",
    "apps/srm/scripts/native-execution-adoption.test.mjs": "9810d5b07a1b98e44122cd4e30a1db491e7c50a4",
    "apps/srm/scripts/operation-context.test.mjs": "688bf34739c81514e88fe2891335e7b4861e218a",
    "apps/srm/scripts/private-host.integration.test.mjs": "12d18297456bdfb44b9a968978c7848b452bb046",
    "apps/srm/scripts/request-quota-adoption.test.mjs": "454f84531f58c0ff220b3668e5e14ec719d10087",
    "apps/srm/scripts/source-hub-market-symbol-compatibility.test.mjs": "8faf1b92b9a56f69cf0686f4d5b37ff423710955",
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": "adaddcc9e85886edfb7abeabcb2bf99038968e7e",
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": "1d6a2c5ae17f3fb8132c8a10fd30be891533b0a1",
    "apps/srm/scripts/xray-performance-adoption.test.mjs": "93023da5f916a2439a973d44f4c9220191929422",
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": "7fbe72a0725d18755924f9a1a218ecd18e3c57ac",
    "packages/maps-embed/package.json": "4730495899cd3b7ebd553ced93ac3216b48c7d76",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "c539a74d4247d1140bd6eb7719e8df44eddf8af0",
    "packages/platform-contracts/current-e1-authority/package.json": "8aab0dc13807c0debb6fe6e7e5bef56911972e13",
    "packages/platform-contracts/current-fresh-report/package.json": "c3511ea1f272bf0ef1220a3a68e31565d5c6fcbd",
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": "6d080bf85afd46cc7242d68e6024c9a672d002d4",
    "packages/platform-contracts/migrations/access/029-market-symbol-transport.sql": "3b18c9e84674391f090a9ae7838cece3ffc02498",
    "packages/platform-contracts/package-lock.json": "90f46f3d3c73f57c1d8272896b53ba034aa3a868",
    "packages/platform-contracts/package.json": "137ea0b58656979414dbfaf0238290c36a0be070",
    "packages/platform-contracts/payload-capture/package.json": "53014dc1060c2d9c7606e3258cc92ab57715fb08",
    "packages/platform-contracts/payload-capture/test/public-package.test.mjs": "043dce8ebfccae7d8319b4429544392418a7ab8d",
    "packages/platform-contracts/readonly-miss-report/package.json": "25141d71f013c95ba3b039f13a96ab9cbe1d413a",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": "2f3ce248f3e029721b1b901dad580596c8ada319",
    "packages/platform-contracts/root-atomic-claim/package.json": "df57dd6b97185a982c85738723df0cb85a1035ec",
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs": "0b0014d4e60aa07cc251d4a4cafc0c0cb58a4608",
    "packages/platform-contracts/src/external-call.d.mts": "1e85f3563f2e5416f47558c9bcad978e14edc725",
    "packages/platform-contracts/src/external-call.mjs": "b64a2408473b6a001f339692930d8f0e0a1c624c",
    "packages/platform-contracts/src/native-external-transport.d.mts": "39103801728a705f5cb66fcb5ac4d446ce27c08e",
    "packages/platform-contracts/src/native-external-transport.mjs": "9d8fef834c561e3bc38ecdf62f6b0b81fd298918",
    "packages/platform-contracts/test/market-symbol-transport.test.mjs": "d76a760f75b89740d1439f5d61e63d8763ccdeea",
    "packages/platform-source-hub-contracts/README.md": "342ddc876507b32c563194d7bb51d3a866bc7a2d",
    "packages/platform-source-hub-contracts/index.d.ts": "c15abb797555a1c77bae59c1b3a99a39d0b2bb79",
    "packages/platform-source-hub-contracts/index.mjs": "6c575f0ed0df69a40a7d9a9d6c3a8756bca3e7d4",
    "packages/platform-source-hub-contracts/package.json": "ce912446ec91d60e7c950ee58f03c004b066fe21",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "a53c9901e5daeff4a058f8dbaa55ed79f041a902"
  },
  "statuses": {
    "apps/architecture-lab/sdk-1.34-compatibility.json": "added",
    "apps/architecture-lab/test/payload-capture-publication.test.mjs": "modified",
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": "modified",
    "apps/dashboard-preview/package-lock.json": "modified",
    "apps/economic-calendar-runtime/package-lock.json": "modified",
    "apps/identity-runtime/package-lock.json": "modified",
    "apps/maps-runtime/package-lock.json": "modified",
    "apps/maps-runtime/platform-integration.json": "modified",
    "apps/maps-runtime/test/embed.test.mjs": "modified",
    "apps/newsfeed-runtime/operation-integration.json": "modified",
    "apps/newsfeed-runtime/package-lock.json": "modified",
    "apps/newsfeed-runtime/test/runtime.test.mjs": "modified",
    "apps/platform-source-hub/docs/te-market-observations.pl.md": "added",
    "apps/platform-source-hub/migrations/006-market-observations.sql": "added",
    "apps/platform-source-hub/package-lock.json": "modified",
    "apps/platform-source-hub/scripts/ci-routing.mjs": "modified",
    "apps/platform-source-hub/scripts/migrate.mjs": "modified",
    "apps/platform-source-hub/src/admission.mjs": "modified",
    "apps/platform-source-hub/src/capabilities.mjs": "modified",
    "apps/platform-source-hub/src/providers/trading-economics.mjs": "modified",
    "apps/platform-source-hub/test/ci-routing.test.mjs": "modified",
    "apps/platform-source-hub/test/contracts.test.mjs": "modified",
    "apps/platform-source-hub/test/market-observations.test.mjs": "added",
    "apps/platform-source-hub/test/types.ts": "modified",
    "apps/sg-runtime/operation-integration.json": "modified",
    "apps/sg-runtime/package-lock.json": "modified",
    "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx": "modified",
    "apps/sg-runtime/tests/category-operation.test.ts": "modified",
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": "modified",
    "apps/sg-runtime/tests/identity-runtime.test.ts": "modified",
    "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs": "modified",
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": "modified",
    "apps/sg-runtime/tests/operation-context.test.mjs": "modified",
    "apps/sg-runtime/tests/pci-smart-integrity.mjs": "modified",
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": "modified",
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts": "modified",
    "apps/sg-runtime/tests/private-host.integration.test.mjs": "modified",
    "apps/sg-runtime/tests/self-service-account.test.ts": "modified",
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": "modified",
    "apps/sg-runtime/tests/xray-gateway.test.ts": "modified",
    "apps/srm/deployment/root-atomic-claim-targets.json": "modified",
    "apps/srm/operation-integration.json": "modified",
    "apps/srm/package-lock.json": "modified",
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": "modified",
    "apps/srm/scripts/native-execution-adoption.test.mjs": "modified",
    "apps/srm/scripts/operation-context.test.mjs": "modified",
    "apps/srm/scripts/private-host.integration.test.mjs": "modified",
    "apps/srm/scripts/request-quota-adoption.test.mjs": "modified",
    "apps/srm/scripts/source-hub-market-symbol-compatibility.test.mjs": "added",
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": "modified",
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": "modified",
    "apps/srm/scripts/xray-performance-adoption.test.mjs": "modified",
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": "modified",
    "packages/maps-embed/package.json": "modified",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "modified",
    "packages/platform-contracts/current-e1-authority/package.json": "modified",
    "packages/platform-contracts/current-fresh-report/package.json": "modified",
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": "modified",
    "packages/platform-contracts/migrations/access/029-market-symbol-transport.sql": "added",
    "packages/platform-contracts/package-lock.json": "modified",
    "packages/platform-contracts/package.json": "modified",
    "packages/platform-contracts/payload-capture/package.json": "modified",
    "packages/platform-contracts/payload-capture/test/public-package.test.mjs": "modified",
    "packages/platform-contracts/readonly-miss-report/package.json": "modified",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": "modified",
    "packages/platform-contracts/root-atomic-claim/package.json": "modified",
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs": "modified",
    "packages/platform-contracts/src/external-call.d.mts": "modified",
    "packages/platform-contracts/src/external-call.mjs": "modified",
    "packages/platform-contracts/src/native-external-transport.d.mts": "modified",
    "packages/platform-contracts/src/native-external-transport.mjs": "modified",
    "packages/platform-contracts/test/market-symbol-transport.test.mjs": "added",
    "packages/platform-source-hub-contracts/README.md": "modified",
    "packages/platform-source-hub-contracts/index.d.ts": "modified",
    "packages/platform-source-hub-contracts/index.mjs": "modified",
    "packages/platform-source-hub-contracts/package.json": "modified",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "modified"
  },
  "modes": {
    "apps/architecture-lab/sdk-1.34-compatibility.json": "100644",
    "apps/architecture-lab/test/payload-capture-publication.test.mjs": "100644",
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": "100644",
    "apps/dashboard-preview/package-lock.json": "100644",
    "apps/economic-calendar-runtime/package-lock.json": "100644",
    "apps/identity-runtime/package-lock.json": "100644",
    "apps/maps-runtime/package-lock.json": "100644",
    "apps/maps-runtime/platform-integration.json": "100644",
    "apps/maps-runtime/test/embed.test.mjs": "100644",
    "apps/newsfeed-runtime/operation-integration.json": "100644",
    "apps/newsfeed-runtime/package-lock.json": "100644",
    "apps/newsfeed-runtime/test/runtime.test.mjs": "100644",
    "apps/platform-source-hub/docs/te-market-observations.pl.md": "100644",
    "apps/platform-source-hub/migrations/006-market-observations.sql": "100644",
    "apps/platform-source-hub/package-lock.json": "100644",
    "apps/platform-source-hub/scripts/ci-routing.mjs": "100644",
    "apps/platform-source-hub/scripts/migrate.mjs": "100644",
    "apps/platform-source-hub/src/admission.mjs": "100644",
    "apps/platform-source-hub/src/capabilities.mjs": "100644",
    "apps/platform-source-hub/src/providers/trading-economics.mjs": "100644",
    "apps/platform-source-hub/test/ci-routing.test.mjs": "100644",
    "apps/platform-source-hub/test/contracts.test.mjs": "100644",
    "apps/platform-source-hub/test/market-observations.test.mjs": "100644",
    "apps/platform-source-hub/test/types.ts": "100644",
    "apps/sg-runtime/operation-integration.json": "100644",
    "apps/sg-runtime/package-lock.json": "100644",
    "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx": "100644",
    "apps/sg-runtime/tests/category-operation.test.ts": "100644",
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": "100644",
    "apps/sg-runtime/tests/identity-runtime.test.ts": "100644",
    "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs": "100644",
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": "100644",
    "apps/sg-runtime/tests/operation-context.test.mjs": "100644",
    "apps/sg-runtime/tests/pci-smart-integrity.mjs": "100644",
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": "100644",
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts": "100644",
    "apps/sg-runtime/tests/private-host.integration.test.mjs": "100644",
    "apps/sg-runtime/tests/self-service-account.test.ts": "100644",
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": "100644",
    "apps/sg-runtime/tests/xray-gateway.test.ts": "100644",
    "apps/srm/deployment/root-atomic-claim-targets.json": "100644",
    "apps/srm/operation-integration.json": "100644",
    "apps/srm/package-lock.json": "100644",
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": "100644",
    "apps/srm/scripts/native-execution-adoption.test.mjs": "100644",
    "apps/srm/scripts/operation-context.test.mjs": "100644",
    "apps/srm/scripts/private-host.integration.test.mjs": "100644",
    "apps/srm/scripts/request-quota-adoption.test.mjs": "100644",
    "apps/srm/scripts/source-hub-market-symbol-compatibility.test.mjs": "100644",
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": "100644",
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": "100644",
    "apps/srm/scripts/xray-performance-adoption.test.mjs": "100644",
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": "100644",
    "packages/maps-embed/package.json": "100644",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "100644",
    "packages/platform-contracts/current-e1-authority/package.json": "100644",
    "packages/platform-contracts/current-fresh-report/package.json": "100644",
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": "100644",
    "packages/platform-contracts/migrations/access/029-market-symbol-transport.sql": "100644",
    "packages/platform-contracts/package-lock.json": "100644",
    "packages/platform-contracts/package.json": "100644",
    "packages/platform-contracts/payload-capture/package.json": "100644",
    "packages/platform-contracts/payload-capture/test/public-package.test.mjs": "100644",
    "packages/platform-contracts/readonly-miss-report/package.json": "100644",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": "100644",
    "packages/platform-contracts/root-atomic-claim/package.json": "100644",
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs": "100644",
    "packages/platform-contracts/src/external-call.d.mts": "100644",
    "packages/platform-contracts/src/external-call.mjs": "100644",
    "packages/platform-contracts/src/native-external-transport.d.mts": "100644",
    "packages/platform-contracts/src/native-external-transport.mjs": "100644",
    "packages/platform-contracts/test/market-symbol-transport.test.mjs": "100644",
    "packages/platform-source-hub-contracts/README.md": "100644",
    "packages/platform-source-hub-contracts/index.d.ts": "100644",
    "packages/platform-source-hub-contracts/index.mjs": "100644",
    "packages/platform-source-hub-contracts/package.json": "100644",
    "scripts/governance/platform-source-hub-foundation.test.mjs": "100644"
  },
  "routes": {
    "apps/architecture-lab/sdk-1.34-compatibility.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    "apps/architecture-lab/test/payload-capture-publication.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    "apps/dashboard-preview/package-lock.json": {
      "projectKey": "SG2",
      "owner": "Dashboard Preview",
      "surfaceId": "SG2-BASE-003"
    },
    "apps/economic-calendar-runtime/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ECR-BASE-001"
    },
    "apps/identity-runtime/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/maps-runtime/package-lock.json": {
      "projectKey": "SRM",
      "owner": "Maps Capability",
      "surfaceId": "MAPS-BASE-001"
    },
    "apps/maps-runtime/platform-integration.json": {
      "projectKey": "SRM",
      "owner": "Maps Capability",
      "surfaceId": "MAPS-BASE-001"
    },
    "apps/maps-runtime/test/embed.test.mjs": {
      "projectKey": "SRM",
      "owner": "Maps Capability",
      "surfaceId": "MAPS-BASE-001"
    },
    "apps/newsfeed-runtime/operation-integration.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/newsfeed-runtime/test/runtime.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/platform-source-hub/docs/te-market-observations.pl.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/migrations/006-market-observations.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/scripts/ci-routing.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/scripts/migrate.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/admission.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/capabilities.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/src/providers/trading-economics.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/ci-routing.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/contracts.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/market-observations.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/types.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/sg-runtime/operation-integration.json": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/package-lock.json": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/category-operation.test.ts": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/identity-runtime.test.ts": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/operation-context.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/pci-smart-integrity.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/porr-demo-middleware.test.ts": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/private-host.integration.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/self-service-account.test.ts": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-gateway.test.ts": {
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/srm/deployment/root-atomic-claim-targets.json": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/operation-integration.json": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/package-lock.json": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/native-execution-adoption.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/operation-context.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/private-host.integration.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/request-quota-adoption.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/source-hub-market-symbol-compatibility.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/xray-performance-adoption.test.mjs": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": {
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "packages/maps-embed/package.json": {
      "projectKey": "SRM",
      "owner": "Maps Capability",
      "surfaceId": "MAPS-BASE-003"
    },
    "packages/platform-contracts/current-e1-authority/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-e1-authority/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-fresh-report/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/access/029-market-symbol-transport.sql": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/package-lock.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/payload-capture/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/payload-capture/test/public-package.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/readonly-miss-report/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/root-atomic-claim/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/external-call.d.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/external-call.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/native-external-transport.d.mts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/native-external-transport.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/market-symbol-transport.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-source-hub-contracts/README.md": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/index.d.ts": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/index.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "packages/platform-source-hub-contracts/package.json": {
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-002"
    },
    "scripts/governance/platform-source-hub-foundation.test.mjs": {
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-020"
    }
  }
});
function isPinnedMarketSymbolReview(files){
 const r=SOURCE_HUB_MARKET_SYMBOL_REVIEW;
 return Array.isArray(files)&&files.length===Object.keys(r.blobs).length&&new Set(files.map(f=>f?.filename)).size===files.length
  &&files.every(f=>Object.hasOwn(r.blobs,f?.filename??'')&&f.sha===r.blobs[f.filename]&&f.status===r.statuses[f.filename]&&!Object.hasOwn(f,'previous_filename'));
}
function assertMarketSymbolRoutes(files,repositoryRoot){
 for(const f of files){const e=SOURCE_HUB_MARKET_SYMBOL_REVIEW.routes[f.filename],profile=resolveProjectProfile(e.projectKey,repositoryRoot),route=resolveProjectRouting({profile,targets:[f.filename],repositoryRoot});
  if(!route.ok||route.results.length!==1)fail('MARKET_SYMBOL_ROUTING_REJECTED');const r=route.results[0];
  if(r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.baselineClassification!=='ALIGNED'||r.projectBoundaryStatus!=='ALLOWED'||r.currentOwner!==e.owner||r.matchedSurfaceId!==e.surfaceId)fail('MARKET_SYMBOL_ROUTING_REJECTED');
 }
}
export function assertMarketSymbolReviewEntry(file,entry){
 const r=SOURCE_HUB_MARKET_SYMBOL_REVIEW;
 if(!Object.hasOwn(r.blobs,file?.filename??'')||file.sha!==r.blobs[file.filename]||entry!==r.modes[file.filename]+' blob '+file.sha+'\t'+file.filename+'\0')fail('MARKET_SYMBOL_FILE_MODE_REJECTED');
}


// One owner-authorized existing Insights G1 PR; no generic governance prefix.
export const INSIGHTS_G1_REVIEW=Object.freeze({
  "prNumber": 848,
  "branch": "governance/procurement-insights-g1-20261101",
  "reviewedCandidateSha": "f24d1c017bd6766bf3b2d382ef12c0040bc5311c",
  "reviewedBaseSha": "734ccc742be1e5183a2d45436a575fd52f185361",
  "blobs": {
    "Canon/registries/current-architecture-baseline-v1.json": "d1dff639dee376331f6aea34e89ea5fe5294c1dd",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "05996c7c2b3dfd66df61b6a9a14c9a771be9c6d5",
    "Canon/evidence/2026-11-01-procurement-insights-g1-onboarding.md": "f9c8e4f2a4ea8b2defdbb7bd15efb24bfde345f7",
    "scripts/governance/governance.test.mjs": "07c21dee8234fd52b960181c84eb3d7987f731c0"
  },
  "statuses": {
    "Canon/registries/current-architecture-baseline-v1.json": "modified",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "modified",
    "Canon/evidence/2026-11-01-procurement-insights-g1-onboarding.md": "added",
    "scripts/governance/governance.test.mjs": "modified"
  },
  "modes": {
    "Canon/registries/current-architecture-baseline-v1.json": "100644",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "100644",
    "Canon/evidence/2026-11-01-procurement-insights-g1-onboarding.md": "100644",
    "scripts/governance/governance.test.mjs": "100644"
  }
});
Object.freeze(INSIGHTS_G1_REVIEW.blobs);Object.freeze(INSIGHTS_G1_REVIEW.statuses);Object.freeze(INSIGHTS_G1_REVIEW.modes);
function isPinnedInsightsG1Review(files){
 const r=INSIGHTS_G1_REVIEW;return Array.isArray(files)&&files.length===Object.keys(r.blobs).length&&new Set(files.map(f=>f?.filename)).size===files.length
  &&files.every(f=>Object.hasOwn(r.blobs,f?.filename??'')&&f.sha===r.blobs[f.filename]&&f.status===r.statuses[f.filename]&&!Object.hasOwn(f,'previous_filename'));
}
export function assertInsightsG1ReviewEntry(file,entry){
 const r=INSIGHTS_G1_REVIEW;if(!Object.hasOwn(r.blobs,file?.filename??'')||file.sha!==r.blobs[file.filename]||entry!==r.modes[file.filename]+' blob '+file.sha+'\t'+file.filename+'\0')fail('INSIGHTS_G1_FILE_MODE_REJECTED');
}

// PROPOSED closed review. No activation before owner acceptance and trusted-main CI.
export const OIL_REPORT_E1_REVIEW=Object.freeze({prNumber:923,branch:'feat/oil-autonomous-runner-20261109',sourceSha:'493746c6f3d70b41ea39a7ec2a76e5609a94b9bb',baseSha:'515c19bb39279d9fd7da73d45f8850235bbc774d',entries:Object.freeze({
 ".github/workflows/insights-ci.yml":Object.freeze({"sha":"3e8ab8967717514d90af839deb7ae57201234318","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-003"}),
 "Canon/registries/operation-access-matrix-v1.json":Object.freeze({"sha":"e2c9498fca2365568dca9c2c810e0946f96ccd30","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Governance Source Layer","surfaceId":"SG2-BASE-019"}),
 "apps/architecture-lab/assistant-m1-sdk-compatibility.mjs":Object.freeze({"sha":"c9dd58a6d55c142b61e0fda069db20589fdd29f4","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"}),
 "apps/architecture-lab/docs/insights-report-e1.md":Object.freeze({"sha":"b1e5a624cc0af34153764cbc94f0c27ab4ce75d6","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"}),
 "apps/architecture-lab/insights-report-source-compatibility.json":Object.freeze({"sha":"45cd20674cd6eebec69f0fd07ec1702c109b20be","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"}),
 "apps/architecture-lab/scripts/install-insights-report.mjs":Object.freeze({"sha":"5669523fdc2c7212eb4e83507a61f715663780de","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"}),
 "apps/architecture-lab/test/insights-e1.test.mjs":Object.freeze({"sha":"0edc3c77ef17e4cfb8aceb9e5df2f7be0080fc44","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"}),
 "apps/architecture-lab/test/sdk-compatibility.test.mjs":Object.freeze({"sha":"6931a69595013e94ebe90c0e39177f6331fb1c5d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"}),
 "apps/insights-runtime/config/development.example.json":Object.freeze({"sha":"30318ded03da3104078831e95720726865d5548a","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/docs/autonomous-oil-report.md":Object.freeze({"sha":"ac51a5f094bc8d644f456bae4ba8a56b68b059f6","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/package-lock.json":Object.freeze({"sha":"65cd24b90a4bce0965fa3bd35a3f6de555a4b3ee","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/package.json":Object.freeze({"sha":"f36b06649d234d2198b4f9043880affa842e78ee","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/render/fonts/DejaVuSans-Bold.ttf":Object.freeze({"sha":"6d65fa7dc41ae8ffae77a4a843a73ba31ffd78c7","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/render/fonts/DejaVuSans.ttf":Object.freeze({"sha":"e5f7eecce43be41ff0703ed99e1553029b849f14","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/render/fonts/LICENSE.txt":Object.freeze({"sha":"bd9adcae4f83b6a3a4a94de221ebd2a924a07576","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/render/fonts/manifest.json":Object.freeze({"sha":"06764ea378a18554a62a058ac3f423ed2932021e","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/render/report.py":Object.freeze({"sha":"48ae49a0c3f468185c14e7878a06946b850048ca","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/render/requirements.txt":Object.freeze({"sha":"028739618825d46ec4447c0fbe7e5ac3ed48170e","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/scripts/check.mjs":Object.freeze({"sha":"1b71510c33b4d911cbab655d04e02060fb629f32","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/scripts/worker.mjs":Object.freeze({"sha":"334211014f1fbc8af40e695c88e8ae225e6df6c4","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/sql/001-report-editions.sql":Object.freeze({"sha":"4ac449089c2caab8f223cf34830d8fd750d301f1","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/sql/002-runtime-binding.sql":Object.freeze({"sha":"85120c463527930611dc9709d9ce9d1a7dfa10e9","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/api.mjs":Object.freeze({"sha":"2e06438d1163dbb5272b40950d7f9a00193107b0","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/calendar.mjs":Object.freeze({"sha":"b8de3cec71e9f40e402c235a0e2b1efc126bb682","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/composer.mjs":Object.freeze({"sha":"1d5be7c4b6ca813e9ae9a0ae8f9a2c86eab44a1c","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/evidence.mjs":Object.freeze({"sha":"69ad45da7facac5aa9706669e2be7f9cf87ab08f","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/host.d.mts":Object.freeze({"sha":"32a2c05ae810f54f47c19c98a9b838d10789c3ea","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/host.mjs":Object.freeze({"sha":"d72cee9d4190bda2f5851e345043bdf977a8827a","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/planner.mjs":Object.freeze({"sha":"d357c3842f9d3d2c7d04786176b180ac1a3dd9b9","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/renderer.mjs":Object.freeze({"sha":"d4e8525aecfd851913d177b5199f212e6f46a390","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/runner.mjs":Object.freeze({"sha":"7df4cbfb36aeea01b2f1954ff857f62d47f1010a","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/runtime.mjs":Object.freeze({"sha":"e4b65be0df92f8c30fe3dd99d6b92ce0a4c6d980","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/scheduler.mjs":Object.freeze({"sha":"a7edf59578fe9bee0675adab0c358c928a353ca9","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/source-adapters.mjs":Object.freeze({"sha":"06bdc2427faf81fa5e5987615ee524dd086c51ea","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/store.mjs":Object.freeze({"sha":"a4683f2a26d797e31735c278714e01c0853d5245","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/src/telemetry.mjs":Object.freeze({"sha":"0a88372fcda198b352608f950b1637d6ddde0d30","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/tests/fixtures/offline-report.json":Object.freeze({"sha":"0853a4efd721d6819613fd456242d8d38cc66ca4","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/tests/host.test.mjs":Object.freeze({"sha":"1aecdf95450da9dce09f096a7b624ca11201cd46","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/tests/postgres.test.mjs":Object.freeze({"sha":"ea57f0c89f80f956c2cd875e2ca6af4c1a097c98","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/insights-runtime/tests/report.test.mjs":Object.freeze({"sha":"bdcd5790867d45dab2cbc0e3da1fc0a7e1788d2c","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"}),
 "apps/newsfeed-runtime/operation-integration.json":Object.freeze({"sha":"44eeb528546b2f1c490706202cbe924a1f7118fa","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"}),
 "apps/newsfeed-runtime/test/runtime.test.mjs":Object.freeze({"sha":"31719efe7b9e102162c22eabf85568cbea66494c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"}),
 "apps/platform-source-hub/scripts/ci-routing.mjs":Object.freeze({"sha":"dab6cae8142ab51acf1edbf4a578bbbbf20f3200","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"}),
 "apps/platform-source-hub/test/ci-routing.test.mjs":Object.freeze({"sha":"fc13ef1b21f4392c10e82440abd0f9b90411dadc","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"}),
 "apps/sg-runtime/app/api/v1/insights/[...report]/route.ts":Object.freeze({"sha":"ff02910dc9f59e2b89480d4a425b02297fc2456e","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/lib/insights/autonomous-runtime.ts":Object.freeze({"sha":"abbe9fe9d640b17f38e3f047f57be0010d1c54cc","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/next.config.mjs":Object.freeze({"sha":"3c885a2fd894dbbf7d681a5df0e6b1f83337fdd2","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/operation-integration.json":Object.freeze({"sha":"dc9799bf6e15d8e8871c6b5c7fa1be3310183671","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/package-lock.json":Object.freeze({"sha":"754083ae969e79d0e626e890456ca64d5d09d044","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/package.json":Object.freeze({"sha":"1e6a9825259b3158d0011ab03720490158e42db6","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/scripts/bootstrap-insights-renderer.mjs":Object.freeze({"sha":"c0f98d601259227e995ac098adc7651243013f03","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/scripts/insights-worker.ts":Object.freeze({"sha":"fde861589062484672a715f61c892cd0d4db5418","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/scripts/start-with-insights.mjs":Object.freeze({"sha":"778b7158f95778355b107b9fbaee6c38aa433dbc","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx":Object.freeze({"sha":"5bd1a5e50ed8406d6ffb53b83c301ef2720d56dd","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/assistant-m1-integrity.mjs":Object.freeze({"sha":"c0d124965addec4fc3dad3eef471012577ce884d","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/category-operation.test.ts":Object.freeze({"sha":"5d60274548d61c25921c2463e1fb5ca9c05263a4","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs":Object.freeze({"sha":"5cfbfc2ea8080d8d66ca247e62a0d9996a90bcc2","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/identity-runtime.test.ts":Object.freeze({"sha":"c3b7ae5b8a33d5624ae98cd1b256f117a3487cac","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/insights-host.test.ts":Object.freeze({"sha":"90581b355ed65a05125e10ce775de0567f4f5231","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs":Object.freeze({"sha":"bbe8e86b2f1960eb4ec7d9ce61ca32649d2cdfc7","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs":Object.freeze({"sha":"096953d8c0291f403a2f7f128d67e3fc17b05517","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/operation-context.test.mjs":Object.freeze({"sha":"3a7b971d35b2ba2ae691dd846301d78728f79ee2","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/pci-smart-integrity.test.mjs":Object.freeze({"sha":"7ef4d53ea11606075f92b8ca86f0777fc8f3abb7","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/porr-demo-middleware.test.ts":Object.freeze({"sha":"d77079c20c85b099505e54c895fec66785315664","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/private-host.integration.test.mjs":Object.freeze({"sha":"673503d7c6402aa426232ad76b2fa6a9b6f63d6c","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/self-service-account.test.ts":Object.freeze({"sha":"98abc6c8f720939b41c66359e4ad3c64606cd1a7","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs":Object.freeze({"sha":"506748ff0aabbd6bb54ab43acdc54fd792f1d267","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/sg-runtime/tests/xray-gateway.test.ts":Object.freeze({"sha":"9f9b02b0eca8ca708a7e55311551ed9c335dfcbc","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"}),
 "apps/srm/deployment/root-atomic-claim-targets.json":Object.freeze({"sha":"47dae24d46489e0883702eba7c620961286679d2","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/operation-integration.json":Object.freeze({"sha":"8a698af1b35c14cd60b009aac2004ebcb496958c","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs":Object.freeze({"sha":"d986d8e4f6df7b02ccfb0f29db6148bf13db06fb","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/scripts/native-execution-adoption.test.mjs":Object.freeze({"sha":"a353e2a2161f21e049bfcf73bf0484feb7fb37d4","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/scripts/operation-context.test.mjs":Object.freeze({"sha":"a72074e65a203cbee84f9811bcdbdfb1f47d50ad","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/scripts/private-host.integration.test.mjs":Object.freeze({"sha":"eaaf72d958241b3efd3562579b78fc91b710b269","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/scripts/request-quota-adoption.test.mjs":Object.freeze({"sha":"551a9aa5e02c2a6937405c6fe4b53b2b7fc99f8e","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/scripts/rural-location-release.test.mjs":Object.freeze({"sha":"a201d17b48edd8b40e0299e9694034c582298011","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/scripts/source-hub-sdk-compatibility.mjs":Object.freeze({"sha":"3373570e5339dd21c98765174d9b023614b8393f","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/scripts/supplier-location-admission.integration.test.mjs":Object.freeze({"sha":"cfe902aa8189e31e42e3ea7d70549d61022022f1","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/scripts/xray-performance-adoption.test.mjs":Object.freeze({"sha":"d2b046ff5f406cdeaef719764c145eec19431669","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/scripts/xray-workflow-contract.test.ts":Object.freeze({"sha":"9fcbb5cf8d9a8b9f461af4473cd5db3e922a966e","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/src/modules/xray/krs-session-transport.test.ts":Object.freeze({"sha":"e3ae263fd7daff1999a1ff4ec7752c469ee7b645","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/src/modules/xray/supplier-locations-view.test.ts":Object.freeze({"sha":"b4dc813900dd3147d870a2f6af739a152bed16fa","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/src/server/company-source-policy.test.ts":Object.freeze({"sha":"3b4c5d93aff25adb613684620cd9fe568ce869c7","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/src/server/root-atomic-claim-adoption.test.ts":Object.freeze({"sha":"95e6ddbdb4727dfd30ef37282ab0f4380b0d87e7","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/src/server/supplier-location-geocoding-runtime.test.ts":Object.freeze({"sha":"c6f7fa10c9609bb8c417b3c6da0724fb458b561d","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "apps/srm/src/server/supplier-map-readiness.test.ts":Object.freeze({"sha":"de0e454f7cb449a0ef4d358e0f70fc2b088142ac","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"}),
 "packages/insights-contracts/index.d.mts":Object.freeze({"sha":"5a51d85194e434d47c9d2ccfe94e365a30f8d6c6","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-002"}),
 "packages/insights-contracts/index.mjs":Object.freeze({"sha":"7e41be8661b134bc796c8f2de6840048b61e6bc6","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-002"}),
 "packages/insights-contracts/package.json":Object.freeze({"sha":"2b727ad5b61feae5945e7bb2855137f99cf40ba2","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-002"}),
 "packages/platform-contracts/current-e1-authority/index.d.mts":Object.freeze({"sha":"b6118e04dab526f816dd3d1e1c3ad0fde499cd80","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/current-e1-authority/index.mjs":Object.freeze({"sha":"1cb5e1cea8cf489351c1e84a2cb0d4c60860a034","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/current-e1-authority/insights-service.mjs":Object.freeze({"sha":"69e92e2d3d403006f8d5d47210721eefc97f998a","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/current-e1-authority/migrations/007-insights-authority.sql":Object.freeze({"sha":"a85c520b2d8a1d4d0ad0cbb50e15fa7c0696a9cd","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/current-e1-authority/migrations/008-insights-receiver.sql":Object.freeze({"sha":"16874e93aa436bc69476dc9370a02b1419f39e21","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/current-e1-authority/migrations/009-insights-service.sql":Object.freeze({"sha":"621427174d6bc159aea870bc97d6287300343044","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/current-e1-authority/package.json":Object.freeze({"sha":"a06a78680978fe52d4cbf4c015b9f84a86e7b4cf","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs":Object.freeze({"sha":"8e36171d0723eb01043bdcf280b39ca7ffe2f0bb","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/migrations/access/030-model-execution.sql":Object.freeze({"sha":"e2e0c4b785f0560f14a0e67ef86f17aa641fcc1d","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/migrations/access/031-model-execution-long-report.sql":Object.freeze({"sha":"6701df1f6a26d199b98476c920b92b149b017ff0","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/migrations/access/032-report-model-templates.sql":Object.freeze({"sha":"03ccd43a36493189e79602662e0d57118582984d","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/package.json":Object.freeze({"sha":"8491a574aed363f08f99b1056eca509088193fc3","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs":Object.freeze({"sha":"f1868c82646f95762fc41581533f3969f715cef4","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/src/external-call.d.mts":Object.freeze({"sha":"6b9f05082eb47620d249b77fc7eebbb1d257d04f","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/src/external-call.mjs":Object.freeze({"sha":"c464da5cb76531b695e3f8b0880d9c45b5644702","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/src/model-execution.d.mts":Object.freeze({"sha":"d2fd45069f4fdf133f59ed4463736e31072a74ac","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/src/model-execution.mjs":Object.freeze({"sha":"b55166de2d891cc8416aba0ee146d294623491b3","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/src/native-external-transport.mjs":Object.freeze({"sha":"a2c4df67232f89494f5e9d37602b52630104037e","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/src/operation-context.d.mts":Object.freeze({"sha":"559f2a2de1ec1b55077cb38634d1c1c74fd6a216","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/src/operation-context.mjs":Object.freeze({"sha":"b4a6122ab512c47299ceae73095257d06668df05","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/test/external-call.test.mjs":Object.freeze({"sha":"08e694b6e49ec061dcbb1746dd09e38ee84fc64b","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/test/fixtures/calendar-current-e1-postgres.mjs":Object.freeze({"sha":"c55187d88c47e659ca66575d7379b2f2e158df77","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/test/operation-context.test.mjs":Object.freeze({"sha":"7918c400deabc3639a528d5a8f2e978120ceb6d2","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
 "packages/platform-contracts/test/private-operation-host.test.mjs":Object.freeze({"sha":"5277345af7cb107c2123098e1083d5f957ba9987","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}),
})})
function isPinnedOilReportReview(files){
 const r=OIL_REPORT_E1_REVIEW;return Array.isArray(files)&&files.length===Object.keys(r.entries).length&&new Set(files.map(f=>f?.filename)).size===files.length&&files.every(f=>{const e=r.entries[f?.filename];return e&&e.sha===f.sha&&e.status===f.status&&!Object.hasOwn(f,'previous_filename')});
}
function assertOilReportRoutes(files,repositoryRoot){
 for(const f of files){const e=OIL_REPORT_E1_REVIEW.entries[f.filename],profile=resolveProjectProfile(e.projectKey,repositoryRoot),route=resolveProjectRouting({profile,targets:[f.filename],repositoryRoot});const r=route.results[0];
  if(!route.ok||route.results.length!==1||r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.baselineClassification!=='ALIGNED'||r.projectBoundaryStatus!=='ALLOWED'||r.currentOwner!==e.owner||r.matchedSurfaceId!==e.surfaceId)fail('OIL_REPORT_ROUTING_REJECTED');
 }
}
export function assertOilReportReviewEntry(file,entry){const e=OIL_REPORT_E1_REVIEW.entries[file?.filename];if(!e||e.sha!==file.sha||entry!==e.mode+' blob '+file.sha+'\t'+file.filename+'\0')fail('OIL_REPORT_FILE_MODE_REJECTED')}
function reviewedReportPeer(owner,version,section,name,spec){
 return owner==='@profitia/platform-current-e1-authority'&&version==='1.2.1'&&name==='@profitia/platform-contracts'&&((section==='peerDependencies'&&spec==='1.33.0 || 1.34.0')||(section==='devDependencies'&&spec==='file:..'))
 ||owner==='@profitia/platform-source-hub-contracts'&&['1.4.0','1.5.0','1.6.0','1.7.0'].includes(version)&&section==='peerDependencies'&&name==='@profitia/platform-current-e1-authority'&&spec==='1.1.0 || 1.2.0 || 1.2.1';
}

function architecturePathAllowed(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(name) || name.split('/').some(p => !p || p.startsWith('.'))) return false
  return /^packages\/platform-contracts\/(?:src\/[A-Za-z0-9_/-]+\.(?:mjs|d\.mts)|migrations\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.sql|test\/[A-Za-z0-9._/-]+\.(?:mjs|mts|json)|package(?:-lock)?\.json|README\.md)$/.test(name)
    || /^Canon\/evidence\/[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+\.md$/.test(name)
}

// Closed governance-only ACG review. Not generic registry, runtime or package admission.
export const ACG_G1_REVIEW = Object.freeze({
 prNumber:931,branch:'architecture/acg-m1-g1-20261109',sourceSha:'5497a96bbc64fc02b8f7a977757dce5cd85a3037',
 entries:Object.freeze({
  'Canon/registries/current-architecture-baseline-v1.json':Object.freeze({sha:'f9000e3b157b276d6f7d69df6a2ed27299881bf7',status:'modified',mode:'100644'}),
  'Canon/v1.1-repository-routing-and-module-ownership-canon.md':Object.freeze({sha:'47fc6dda78cc407969453c9d3d2865502cd98bb2',status:'modified',mode:'100644'}),
 }),
})
function isPinnedAcgG1Review(files){
 return Array.isArray(files)&&files.length===2&&new Set(files.map(f=>f?.filename)).size===2
  &&files.every(f=>{const e=ACG_G1_REVIEW.entries[f?.filename];return e&&f.sha===e.sha&&f.status===e.status&&!Object.hasOwn(f,'previous_filename')})
}
export function assertAcgG1ReviewEntry(file,entry){
 const e=ACG_G1_REVIEW.entries[file?.filename]
 if(!e||e.sha!==file.sha||entry!==e.mode+' blob '+file.sha+'\t'+file.filename+'\0')fail('ACG_G1_FILE_MODE_REJECTED')
}


// Owner-approved M1 dependency: closed blobs, modes and actual owner profiles.
export const ACG_M1_EXECUTION_REVIEW=Object.freeze({prNumber:937,branch:'architecture/acg-m1-execution-20261109',sourceSha:'1f25d37589d0c8e0e0020f014ab9788b4a04417b',baseSha:'adce82d074984743eb2f3c1cab10690fcc0aa0ff',entries:Object.freeze({
  ".github/workflows/assistant-context-gateway-ci.yml": {
    "sha": "f88119a3291fea0b448f89a184268b1f87c046a5",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  ".github/workflows/identity-runtime-ci.yml": {
    "sha": "70abc781e47c2ebbc9b3bb65ff470dba25e79439",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "apps/architecture-lab/assistant-m1-sdk-compatibility.json": {
    "sha": "8b6ab7ad850431d622fc2254b50baab36e8d8198",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "apps/architecture-lab/assistant-m1-sdk-compatibility.mjs": {
    "sha": "52a7cf3b58baa0ab655b301edbd498821ba611e9",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "apps/architecture-lab/test/sdk-compatibility.test.mjs": {
    "sha": "23d2487a6c500dd6d0c265a7e22aa25d66747490",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "apps/newsfeed-runtime/operation-integration.json": {
    "sha": "d1cdd3cbca4e410dd89401902fd3ee0d9aa00149",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "apps/newsfeed-runtime/test/runtime.test.mjs": {
    "sha": "91304e3143dc553fad161c7381bf6c314ed3f683",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "apps/package-limits/migrations/004-assistant-usage.sql": {
    "sha": "1c639f4aac951e8b14b74abcdf0bc6f4433e6607",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "apps/package-limits/scripts/ci-proof.mjs": {
    "sha": "9501ca3f134f870f6198ea050bae89fb4c226fe5",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "apps/package-limits/test/database.test.mjs": {
    "sha": "4290b938c263b56c749eb2f613842b6bb2e439ae",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "apps/platform-source-hub/scripts/ci-routing.mjs": {
    "sha": "0a2ecc60a65d9c453bb038642fe369a17e7ad7ad",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "apps/platform-source-hub/test/ci-routing.test.mjs": {
    "sha": "2be4400eab88bbb8c968e621dd68842d328f29b1",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "apps/sg-runtime/operation-integration.json": {
    "sha": "9ddf935ac4e314c4fb20726c52e4d14e14b5306c",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx": {
    "sha": "9a128ea7561da55f774f3498c36aa5d61794d959",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/category-operation.test.ts": {
    "sha": "35b9a787798311ae1fd9eb3a7ed597289961fec0",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": {
    "sha": "59b6d14e35edf75a08269bf9f6e1e5c027438bc4",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/identity-runtime.test.ts": {
    "sha": "b1482a970a6e97127acceda1afaec59e3b14c26c",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs": {
    "sha": "abd206fb6214a6a84b243e5e21cd00136b0f5b9a",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": {
    "sha": "3b5e41eff030adb5aca96b3e21f020c5dcb8790d",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/operation-context.test.mjs": {
    "sha": "c918fa390c2618d3f9cc71ee38117c979bb327a5",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/pci-smart-integrity.mjs": {
    "sha": "15625d7f5721b13b0a9dc46d03a5bfa37ad43c2f",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": {
    "sha": "0718b16857a99f1e87ea5378a07752b9e6c2918d",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/porr-demo-middleware.test.ts": {
    "sha": "a339a281345a864f15b2d4092be2901b3dd3a321",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/private-host.integration.test.mjs": {
    "sha": "5ca8199681831048b1b92b0420113e62b332e8fa",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/self-service-account.test.ts": {
    "sha": "afaed35a2a760ce0fa275320637e0da21fc33687",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": {
    "sha": "29373faaaf2bed8df6ec7ea53f4e821a9b204d25",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/sg-runtime/tests/xray-gateway.test.ts": {
    "sha": "27239de29a2362150febdf75bfa4173aeb998a08",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SG2",
    "owner": "SG Runtime"
  },
  "apps/srm/deployment/root-atomic-claim-targets.json": {
    "sha": "96d2fcd6fdc1d3f5ad448084101094e994ecf2cb",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SRM",
    "owner": "SRM Runtime"
  },
  "apps/srm/operation-integration.json": {
    "sha": "895cdca5bce4940d3da12d01db040b7d01203203",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SRM",
    "owner": "SRM Runtime"
  },
  "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": {
    "sha": "19c448507031d8a30e6778fac37b21fed5866db7",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SRM",
    "owner": "SRM Runtime"
  },
  "apps/srm/scripts/native-execution-adoption.test.mjs": {
    "sha": "7a633c656a5f21035a74b2456ee2978edc3669d7",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SRM",
    "owner": "SRM Runtime"
  },
  "apps/srm/scripts/operation-context.test.mjs": {
    "sha": "c2a5752fb5654a3a919fe1ba00bb7ea9cee56681",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SRM",
    "owner": "SRM Runtime"
  },
  "apps/srm/scripts/private-host.integration.test.mjs": {
    "sha": "d5c22562e9a587be8fe7e4bb7f7f1a3012ef90b0",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SRM",
    "owner": "SRM Runtime"
  },
  "apps/srm/scripts/request-quota-adoption.test.mjs": {
    "sha": "b93b9d0176858433c5cdc350259530644a0bb5fe",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SRM",
    "owner": "SRM Runtime"
  },
  "apps/srm/scripts/source-hub-sdk-compatibility.mjs": {
    "sha": "894b433202a61fa4c760593cca0bfdc5275047d4",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SRM",
    "owner": "SRM Runtime"
  },
  "apps/srm/scripts/supplier-location-admission.integration.test.mjs": {
    "sha": "07bf1aa43c7343b28babf0f97b0797e63ae2ffe9",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SRM",
    "owner": "SRM Runtime"
  },
  "apps/srm/scripts/xray-performance-adoption.test.mjs": {
    "sha": "4251cc6356fb35fddd96bd2cd2e85128b0c3f944",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SRM",
    "owner": "SRM Runtime"
  },
  "apps/srm/src/server/root-atomic-claim-adoption.test.ts": {
    "sha": "a28205517cb176ce08799555756da30b2b788cbc",
    "status": "modified",
    "mode": "100644",
    "projectKey": "SRM",
    "owner": "SRM Runtime"
  },
  "Canon/registries/operation-access-matrix-v1.json": {
    "sha": "163fec8f8b3cc0aafb4a60c0e18a3b446cbc3149",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Governance Source Layer"
  },
  "Canon/v1.0-operation-context-and-access-contract.md": {
    "sha": "20c89648fbf6e8f360ac72048a92ca87b76c2d02",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Governance Source Layer"
  },
  "packages/assistant-context-contracts/package.json": {
    "sha": "45a389f274c6bd2b102403583eb18583d51efe1a",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/assistant-context-contracts/src/index.d.mts": {
    "sha": "ff14b296bf55fac8b254abac2e0c1fd0e78fcf60",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/assistant-context-contracts/src/index.mjs": {
    "sha": "4c3bce4c4abedba5c4366307e307b5de3a60bc8a",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/assistant-context-gateway/package.json": {
    "sha": "f8fb36356d413aebd797c6266c0669dcf3e451ac",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/assistant-context-gateway/src/index.d.mts": {
    "sha": "6a85d36db2aa2b6de436b65756b10ecd07f0d948",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/assistant-context-gateway/src/index.mjs": {
    "sha": "32ec2f6da053e55fb69bf086257df8c53ae5e47f",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/assistant-context-gateway/test/gateway.test.mjs": {
    "sha": "a59888bed3bca7ccd8b6132825d39f73f7d75700",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": {
    "sha": "e129d69d23205ca0c89815e21f8677adfe0a179b",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/migrations/access/030-assistant-operations.sql": {
    "sha": "cd51f699b27b9be8a7a955b4acb6710b184c4b24",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/package.json": {
    "sha": "6c6d0c4b67f751d02cbaeddb88e9e9b43d3156c6",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": {
    "sha": "9166a1b887a8e082440addafac8af6d387fb07f5",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/src/assistant-operation-host.d.mts": {
    "sha": "420747b0b5ad9a9fe5f12bbdaca80d48a3406083",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/src/assistant-operation-host.mjs": {
    "sha": "201d40081298116e8aad9b6288d9ccbf6975a717",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/src/assistant-usage.d.mts": {
    "sha": "05f953e5c2953f670190510d75fd34cad78457da",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/src/assistant-usage.mjs": {
    "sha": "27a1d4f4297cf7f7dfe01685eb6a4bda47827518",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/src/operation-context.d.mts": {
    "sha": "e6a8d3c78bb826b4106f192bc93573d4b984db3f",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/src/operation-context.mjs": {
    "sha": "7876cea1facda17c7f2aa240bd10cfccd1f792a2",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/test/assistant-native-postgres.test.mjs": {
    "sha": "e976e47a73ae76322747602f3c19892941fa1976",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/test/assistant-operation-host.test.mjs": {
    "sha": "9cac1aae230abb6bb3b563ce300c65163e55e976",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/test/assistant-usage.test.mjs": {
    "sha": "02e272db1fca05d72078e65508a261adc5054c75",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/test/operation-context.test.mjs": {
    "sha": "02489d7f2810a0ea42b4583a42c3a604a6ff4d9b",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "packages/platform-contracts/test/private-operation-host.test.mjs": {
    "sha": "0dda8548d39ae5c4109b2ac3c6783a5a7ac8db6c",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform"
  },
  "scripts/governance/platform-source-hub-foundation.test.mjs": {
    "sha": "544d40b2ae17134042a465e1c50cbc5768651b45",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Governance Source Layer"
  }
})});
function isPinnedAcgM1Review(files){return Array.isArray(files)&&files.length===Object.keys(ACG_M1_EXECUTION_REVIEW.entries).length&&new Set(files.map(f=>f?.filename)).size===files.length&&files.every(f=>{const e=ACG_M1_EXECUTION_REVIEW.entries[f?.filename];return Object.hasOwn(ACG_M1_EXECUTION_REVIEW.entries,f?.filename)&&e&&f.sha===e.sha&&f.status===e.status&&!Object.hasOwn(f,'previous_filename')})}
export function assertAcgM1ReviewEntry(file,entry){const e=ACG_M1_EXECUTION_REVIEW.entries[file?.filename];if(!e||e.sha!==file.sha||entry!==e.mode+' blob '+file.sha+'\t'+file.filename+'\0')fail('ACG_M1_FILE_MODE_REJECTED')}
function assertAcgM1ReviewRoutes(files,repositoryRoot){
 for(const projectKey of ['ARCHITECTURE','SG2','SRM']){
  const selected=files.filter(f=>ACG_M1_EXECUTION_REVIEW.entries[f.filename].projectKey===projectKey),profile=resolveProjectProfile(projectKey,repositoryRoot)
  if(profile.repository.slug!==REPOSITORY)fail('ACG_M1_ROUTING_REJECTED')
  const routing=resolveProjectRouting({profile,targets:selected.map(f=>f.filename),repositoryRoot})
  if(!routing.ok||routing.results.some(r=>r.projectBoundaryStatus!=='ALLOWED'||r.baselineClassification!=='ALIGNED'||r.currentOwner!==ACG_M1_EXECUTION_REVIEW.entries[r.normalizedPath]?.owner))fail('ACG_M1_ROUTING_REJECTED')
 }
}

// PROPOSED exact Stage03 review; separate CI owner acceptance required.
export const ECR_STAGE03_REVIEW=Object.freeze({"prNumber":947,"branch":"architecture/ecr-stage03-durable-store-20261110","sourceSha":"995c2b5f385b515d647e6d770d77873503815311","baseSha":"3d1eb89373fbb1d6d358b7c0a40726a0fe8c5c62",entries:Object.freeze({
  "apps/architecture-lab/ecr-stage03-sdk-compatibility.mjs": {
    "sha": "70c0ac4f58b70d6d60bd4c043c47f99afe3274b5",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ARCH-BASE-002"
  },
  "apps/architecture-lab/test/sdk-compatibility.test.mjs": {
    "sha": "2ae79feeb859c08a837fbf620400bc5f9f531896",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ARCH-BASE-002"
  },
  "apps/economic-calendar-runtime/README.md": {
    "sha": "7253c2dfb84169aa9161e1de45c68d94b523b82e",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/migrations/002-multi-source-calendar.sql": {
    "sha": "71e196c0a9fd66536d98b6034f027fa13f6dbbc4",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/operations/activate-calendar-storage.sql": {
    "sha": "7616c152aebee31959d2272b27d5363155a96051",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/operations/enroll-schedule-service.sql": {
    "sha": "406da6fd87e74f8a4c684e2e7a0b74bf0747e4b6",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/operations/stage03-owner-plan.json": {
    "sha": "c9c0a0d5fd753d6684327cc80ea501eebd5eeef5",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/package-lock.json": {
    "sha": "90ad77dd37b8d8602422b91fb159a877d4086f9b",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/package.json": {
    "sha": "6f4012b95dafbe27a91c599bf303475a923f0ccc",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/scripts/migrate.mjs": {
    "sha": "95b28753a431d13e82b63703de0f9bb55d3e9d2b",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/scripts/source-acquire.mjs": {
    "sha": "66fff5df4588cd43b4b6e2fb3bea18a61da3e932",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/scripts/sync.mjs": {
    "sha": "934f35edcfeb05cea8cd45e9fd112be6596493df",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/scripts/verify-storage.mjs": {
    "sha": "1f68ebf054a56a8b58c02a978144cb4ec20c4d34",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/repository.mjs": {
    "sha": "b0fcf84eb693674ffd8d3d204d1954607252428a",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/server.mjs": {
    "sha": "a93c569d14584dc299cdb1ab1ae04736ba14d533",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/source-service.mjs": {
    "sha": "38a7c241abb1bcf5a4e09d4fcb1f590990b30f78",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/synchronization.mjs": {
    "sha": "ae7be62ee8853b1142a0aa1759681237a8075df6",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/test/schedule-storage.test.mjs": {
    "sha": "92f3b3058e515e309c8d6ebd98b55e64bbd14054",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/test/source-service.test.mjs": {
    "sha": "f6039b97b8b4ad25a7da4b3b9b973c1cd15de064",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/platform-source-hub/migrations/008-calendar-consumer-storage.sql": {
    "sha": "35eeae1dd1decc162022ecbc20009fad91038667",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/operations/calendar-consumer-storage-owner-plan.json": {
    "sha": "ad7fb5cdc7f7ffbeff47c0d46aee2df1108db8c6",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/package-lock.json": {
    "sha": "0f17bea4342130ec2f07354d918a63bd9585a91d",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/scripts/migrate.mjs": {
    "sha": "e2818ec72eef43789743740a47abe2e59edbad26",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/src/capabilities.mjs": {
    "sha": "a102342de087f1e4a9c796be7f1e0180d8a7e6c3",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/src/config.mjs": {
    "sha": "f43ebb5cc6bff4cca3b246da822feee7838cf379",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/src/providers/commodities-sh.mjs": {
    "sha": "38e80e80468731ac8ebf0f989a80e8ddf6831798",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/src/providers/eia-schedules.mjs": {
    "sha": "5a98882cb4e5ce8cb06ffd4b18accd497e5fb56f",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/src/providers/publication-schedules.mjs": {
    "sha": "c3ce5f10f90bc99fe808ff36c61de375cb7077e1",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/src/repository.mjs": {
    "sha": "bade8272b55e8c7e0be9e696dfdcce3951ea6702",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/test/publication-schedule-integration.test.mjs": {
    "sha": "63d6ae5fac228edd37c8816ad8d982d8eee6b420",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "packages/economic-calendar-contracts/README.md": {
    "sha": "5c1d98b53fa26b33f47eb649aa14a75ad4e3a094",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-002"
  },
  "packages/economic-calendar-contracts/index.d.mts": {
    "sha": "2824e81924254fa59f04218461c54aea4e9c576a",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-002"
  },
  "packages/economic-calendar-contracts/index.mjs": {
    "sha": "dc72a388d78e5248ab43409b3f5b3a46f9044daf",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-002"
  },
  "packages/economic-calendar-contracts/package.json": {
    "sha": "882f9ba8e3c7baa4b62f7eab7938d904c453b359",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-002"
  },
  "packages/platform-source-hub-contracts/README.md": {
    "sha": "0873bb5149cd1a100084be3d1eca086877033865",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "packages/platform-source-hub-contracts/calendar-storage-acceptance-v1.json": {
    "sha": "ab926b070738a2fbf611e9ec6cf1c1d439ab9d5b",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "packages/platform-source-hub-contracts/commodities-v1.d.mts": {
    "sha": "5d7b3bef6d7b4c36ba29128fe8a251303278c9bf",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "packages/platform-source-hub-contracts/commodities-v1.mjs": {
    "sha": "9c7a551f38e30c2b877b0401e1c33fce537c2688",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "packages/platform-source-hub-contracts/index.d.ts": {
    "sha": "8650b3c6c39a66f7ea773e7c458db7d7bcb685da",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "packages/platform-source-hub-contracts/index.mjs": {
    "sha": "4f9eb552f19aac613af697aeb64634e40e4e26b1",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "packages/platform-source-hub-contracts/package.json": {
    "sha": "05184f565c407177c50b524fd93346a07829c3b7",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "scripts/governance/platform-source-hub-foundation.test.mjs": {
    "sha": "c2766162eb2cb023d60a62ea0ca3a69be3fe1764",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Governance Source Layer",
    "surfaceId": "SG2-BASE-020"
  }
})});
function isPinnedEcrStage03Review(files){const r=ECR_STAGE03_REVIEW;return Array.isArray(files)&&files.length===Object.keys(r.entries).length&&new Set(files.map(f=>f?.filename)).size===files.length&&files.every(f=>{const e=r.entries[f?.filename];return Object.hasOwn(r.entries,f?.filename)&&e&&e.sha===f.sha&&e.status===f.status&&!Object.hasOwn(f,'previous_filename')})}
export function assertEcrStage03ReviewEntry(file,entry){const e=ECR_STAGE03_REVIEW.entries[file?.filename];if(!e||e.sha!==file.sha||entry!==e.mode+' blob '+file.sha+'\t'+file.filename+'\0')fail('ECR_STAGE03_FILE_MODE_REJECTED')}
function assertEcrStage03Routes(files,repositoryRoot){
 const profile=resolveProjectProfile('ARCHITECTURE',repositoryRoot),routing=resolveProjectRouting({profile,targets:files.map(f=>f.filename),repositoryRoot})
 if(profile.repository.slug!==REPOSITORY||!routing.ok||routing.results.length!==files.length||routing.results.some(r=>{const e=ECR_STAGE03_REVIEW.entries[r.normalizedPath];return !e||r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.projectBoundaryStatus!=='ALLOWED'||r.baselineClassification!=='ALIGNED'||r.currentOwner!==e.owner||r.matchedSurfaceId!==e.surfaceId}))fail('ECR_STAGE03_ROUTING_REJECTED')
}

// Proposed exact Stage04-05 source review; separate CI owner acceptance required.
export const ECR_STAGE0405_REVIEW=Object.freeze({"prNumber":959,"branch":"architecture/ecr-stage04-05-semantic-continuous-20261110","sourceSha":"5425e1c0605c391397f87c98d1bfee57b520da0f","baseSha":"4b03a7cf552ba88506c8cbb5ca627acc8f4e505f",entries:Object.freeze({
  "apps/architecture-lab/ecr-stage03-sdk-compatibility.mjs": {
    "sha": "4b1bc65d38f3baab89887a176a3670544ddc6f89",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ARCH-BASE-002"
  },
  "apps/economic-calendar-runtime/README.md": {
    "sha": "f7c42e1683df8318c30e4b1cb35902c3dc52e6d9",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/migrations/003-semantic-continuous.sql": {
    "sha": "28aa56bb8feb4d2013ba48e5971f3fafc45d0f38",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/operations/activate-stage04-05.sql": {
    "sha": "ffd4a64044351d7401b20f40a9360aa674ebb7ba",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/operations/enroll-stage04-05.sql": {
    "sha": "498f1ffe2b85b7fd3cf278f80e4e78c1a902329c",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/operations/semantic-bootstrap.json": {
    "sha": "fec9d09e01aeb71ab573765d5d3cd8094993a813",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/operations/stage04-05-owner-plan.json": {
    "sha": "b5279ff6309f27d00cfc180e78a88a4ea9e54c11",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/package-lock.json": {
    "sha": "bb8b7cd96474ba2b75e79b8999b849f09b4257a5",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/package.json": {
    "sha": "3af5e74660b793f3dcd103fd11fa766d429d3c95",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/scripts/continuous.mjs": {
    "sha": "0b8be40c41b350e46186c5bd97fad6e55e19e89a",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/scripts/curate.mjs": {
    "sha": "fdca1ed3a042bfe30cd7cda428c1e2eeee476db3",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/scripts/migrate.mjs": {
    "sha": "03a2f27a361b1719a564078f7b17523b4edbca18",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/continuous.mjs": {
    "sha": "12e20ff0aa99c0478cc40369e30130503603bd8a",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/repository.mjs": {
    "sha": "0fd1e018aeaa18ba973ef4154a0c3b38fcc0cc68",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/result-links.mjs": {
    "sha": "1620ab95a6b074cb50f09ee4ccb0b8cd63bcfd7d",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/results.mjs": {
    "sha": "55e848b2c7c7c630e86bca8e17ea67af5a910018",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/semantics.mjs": {
    "sha": "49bae41253fd42488021038ebea00d04e0a54793",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/server.mjs": {
    "sha": "538456393d7352469d71365ec94636b21acc11df",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/source-service.mjs": {
    "sha": "b90fa5b4c8b0627fce588ba539af76b55e408305",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/synchronization.mjs": {
    "sha": "12f1319ddaaccdc70d5aa8d61716cca1b2893895",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/test/continuous.test.mjs": {
    "sha": "c5c281911cfc936b363efb304d7c75ef8be78d48",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/test/semantics.test.mjs": {
    "sha": "b3c17523b5800ae130be704a0ce8c166a7694b6f",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/platform-source-hub/migrations/009-ecr-results-storage.sql": {
    "sha": "060a33403ae60252dd156e3c5070e9d657d39e5b",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/operations/activate-ecr-results.sql": {
    "sha": "64ae26943a38c9b658d31b2abbc718b41749b368",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/operations/stage04-05-owner-plan.json": {
    "sha": "308caaddac8256d22dd89254db51391775bf6ddb",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/package-lock.json": {
    "sha": "06890c4d8324a89b6830c6f56720878c9f2918fb",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/scripts/migrate.mjs": {
    "sha": "90f63a5b1cf06812f0ba8d516b81fd392c40215d",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/src/capabilities.mjs": {
    "sha": "7d0eb2a44d69abc0069340cf2c85f7d49557fb22",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/src/config.mjs": {
    "sha": "cf657ff3a2deba65a7d7be03bc08e8b5d616b76a",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/src/providers/eia.mjs": {
    "sha": "0afbf22b1b26534defd9612d06ccdd98ea784c59",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/src/repository.mjs": {
    "sha": "d1a7c6102b9af8eeff759585c58805a8d4939d68",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "apps/platform-source-hub/test/ecr-results-storage.test.mjs": {
    "sha": "8c0fd52054e41d03aa836cc868e70221040de713",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "packages/economic-calendar-contracts/package.json": {
    "sha": "80dde51608c750b7a7a94021598c9e9efa61f311",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-002"
  },
  "packages/economic-calendar-contracts/semantic.d.mts": {
    "sha": "d3374b6c68b67506684916fa09f740c982f4ca96",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-002"
  },
  "packages/economic-calendar-contracts/semantic.mjs": {
    "sha": "e92d0f71be1f728af7a9937819098a5d6a5f7521",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-002"
  },
  "packages/platform-contracts/current-e1-authority/migrations/010-ecr-service-continuity.sql": {
    "sha": "6d4adeddcd4d4a2e5b382b40d204bc23dd082388",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ARCH-BASE-001"
  },
  "packages/platform-contracts/test/ecr-service-continuity.test.mjs": {
    "sha": "a31541d282614463cf897980b6e4ac3678854aff",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ARCH-BASE-001"
  },
  "packages/platform-source-hub-contracts/commodities-v1.d.mts": {
    "sha": "c53d79f554d4d2527aed009b5795e11df5c4692c",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "packages/platform-source-hub-contracts/commodities-v1.mjs": {
    "sha": "32276d2d1fa40fcc2c8c2f28e6d785d0dd6f11d4",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "packages/platform-source-hub-contracts/index.d.ts": {
    "sha": "8fedba289e38cb30df500814dc3140bd5307ea39",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "packages/platform-source-hub-contracts/index.mjs": {
    "sha": "673108718f10870ee84a4a567691c37dd02c5770",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "packages/platform-source-hub-contracts/package.json": {
    "sha": "464a63fd54f7f4d3afd01aac42b0fff0efd8a1a3",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "packages/platform-source-hub-contracts/semantic-continuous-acceptance-v1.json": {
    "sha": "b8ab649ef01dc5ba4a5dc7bd46de5417816be44f",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "scripts/governance/platform-source-hub-foundation.test.mjs": {
    "sha": "7b5accdb1cb2df117574a1af791a141108cd7048",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Governance Source Layer",
    "surfaceId": "SG2-BASE-020"
  }
})});
function isPinnedEcrStage0405Review(files){const r=ECR_STAGE0405_REVIEW;return Array.isArray(files)&&files.length===Object.keys(r.entries).length&&new Set(files.map(f=>f?.filename)).size===files.length&&files.every(f=>{const e=r.entries[f?.filename];return Object.hasOwn(r.entries,f?.filename)&&e&&e.sha===f.sha&&e.status===f.status&&!Object.hasOwn(f,'previous_filename')})}
export function assertEcrStage0405ReviewEntry(file,entry){const e=ECR_STAGE0405_REVIEW.entries[file?.filename];if(!e||e.sha!==file.sha||entry!==e.mode+' blob '+file.sha+'\t'+file.filename+'\0')fail('ECR_STAGE0405_FILE_MODE_REJECTED')}
function assertEcrStage0405Routes(files,repositoryRoot){
 const profile=resolveProjectProfile('ARCHITECTURE',repositoryRoot),routing=resolveProjectRouting({profile,targets:files.map(f=>f.filename),repositoryRoot})
 if(profile.repository.slug!==REPOSITORY||!routing.ok||routing.results.length!==files.length||routing.results.some(r=>{const e=ECR_STAGE0405_REVIEW.entries[r.normalizedPath];return !e||r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.projectBoundaryStatus!=='ALLOWED'||r.baselineClassification!=='ALIGNED'||r.currentOwner!==e.owner||r.matchedSurfaceId!==e.surfaceId}))fail('ECR_STAGE0405_ROUTING_REJECTED')
}

// Proposed source-only closure; exact owner acceptance is required before adoption.
export const ECR_SOURCE_CONTINUITY_REVIEW=Object.freeze({"prNumber":972,"branch":"architecture/ecr-source-access-continuity-20261110","sourceSha":"c537ffb8a8cbef06f45f984d9e3875dee2288505","baseSha":"ce520b5a3d4ca5f2a48156f8d879ff31f3c874c2",entries:Object.freeze({
  "apps/architecture-lab/ecr-stage03-sdk-compatibility.mjs": {
    "sha": "e7e89b0293300dfb10e9be9680a250d8a8ff5aa4",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ARCH-BASE-002"
  },
  "apps/economic-calendar-runtime/README.md": {
    "sha": "0728a5a11199b969055ef95e3b721f87db657158",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/operations/activate-source-access-continuity.sql": {
    "sha": "178b734fa0b56fdf222139e11c87f8ba1f9cd39e",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/operations/source-access-continuity-owner-plan.json": {
    "sha": "0c0341afd6f6ebd277aa370c2560682fc651a2f7",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/scripts/continuous.mjs": {
    "sha": "e74b3ae63165250bd4cec2ded2171453af7356de",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/access-continuity.mjs": {
    "sha": "b5b3be4d8b4b780bb2a38620438877420e7ea0dd",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/src/continuous.mjs": {
    "sha": "ef9732ec3aefc64dc59ba97c9bf23bd90642b1b3",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/test/access-continuity.test.mjs": {
    "sha": "7fa8f4b0dd944fb903125d7d43a4fae6266eebfb",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/economic-calendar-runtime/test/source-access-continuity-postgres.test.mjs": {
    "sha": "d39ce2adcebe8b5b64bd8994591b3af787b99825",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ECR-BASE-001"
  },
  "apps/platform-source-hub/migrations/010-ecr-source-continuity.sql": {
    "sha": "7ed60424b1d7f1128bd82908377ff6d85a1b3bb1",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-001"
  },
  "packages/platform-contracts/current-e1-authority/migrations/011-ecr-source-continuity.sql": {
    "sha": "607339b1d10cfcd185a68e157487ac20ecf3214f",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ARCH-BASE-001"
  },
  "packages/platform-contracts/test/ecr-service-continuity.test.mjs": {
    "sha": "a2fade7d9310f6e8ec847d921a24ce93c3d88d38",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "ARCH-BASE-001"
  },
  "packages/platform-source-hub-contracts/source-access-continuity-acceptance-v1.json": {
    "sha": "9a7ee676ed4e3c0a992b3c16974f67f89e5bd8df",
    "status": "added",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Architecture Platform",
    "surfaceId": "SOURCE-HUB-BASE-002"
  },
  "scripts/governance/platform-source-hub-foundation.test.mjs": {
    "sha": "6678398d4e645670eee3c892e685967749990a8c",
    "status": "modified",
    "mode": "100644",
    "projectKey": "ARCHITECTURE",
    "owner": "Governance Source Layer",
    "surfaceId": "SG2-BASE-020"
  }
})});
function isPinnedEcrSourceContinuityReview(files){const r=ECR_SOURCE_CONTINUITY_REVIEW;return Array.isArray(files)&&files.length===Object.keys(r.entries).length&&new Set(files.map(f=>f?.filename)).size===files.length&&files.every(f=>{const e=r.entries[f?.filename];return Object.hasOwn(r.entries,f?.filename)&&e&&e.sha===f.sha&&e.status===f.status&&!Object.hasOwn(f,'previous_filename')})}
export function assertEcrSourceContinuityReviewEntry(file,entry){const e=ECR_SOURCE_CONTINUITY_REVIEW.entries[file?.filename];if(!e||e.sha!==file.sha||entry!==e.mode+' blob '+file.sha+'\t'+file.filename+'\0')fail('ECR_SOURCE_CONTINUITY_FILE_MODE_REJECTED')}
function assertEcrSourceContinuityRoutes(files,repositoryRoot){
 const profile=resolveProjectProfile('ARCHITECTURE',repositoryRoot),routing=resolveProjectRouting({profile,targets:files.map(f=>f.filename),repositoryRoot})
 if(profile.repository.slug!==REPOSITORY||!routing.ok||routing.results.length!==files.length||routing.results.some(r=>{const e=ECR_SOURCE_CONTINUITY_REVIEW.entries[r.normalizedPath];return !e||r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.projectBoundaryStatus!=='ALLOWED'||r.baselineClassification!=='ALIGNED'||r.currentOwner!==e.owner||r.matchedSurfaceId!==e.surfaceId}))fail('ECR_SOURCE_CONTINUITY_ROUTING_REJECTED')
}

// Proposed exact Newsfeed saved-search review; activation requires the separate
// controller owner decision and trusted-main acceptance. No generic app grant.
// PROPOSED closed Stage I source review. A local test/import does not activate
// policy: explicit owner acceptance and trusted-main admission are required.
export const REGISTRATION_SDK_INITIAL_REVIEW=Object.freeze({
  "prNumber": 983,
  "branch": "architecture/registration-bootstrap-stage-i-20261111",
  "sourceSha": "57f175c61ecc205a57a18401bace8037dffd4ff7",
  "baseSha": "f8f6340ab1ac862a584352f86988dde199172b37",
  "treeSha": "392ade60a03e3874a69d974bd4ae1f72d6cf6c65",
  "inputs": [
    {
      "projectKey": "ARCHITECTURE",
      "taskId": "ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110",
      "prNumber": 983,
      "sourceSha": "4e67c9234a88f82479d669598fb730d6ad8fbc53"
    },
    {
      "projectKey": "SG2",
      "taskId": "SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110",
      "prNumber": 987,
      "sourceSha": "67c758774a58b09b2df31942ba6e6ce79f3141ac"
    },
    {
      "projectKey": "SRM",
      "taskId": "SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111",
      "prNumber": 986,
      "sourceSha": "99dca957c47d4f755e49b731e79db0e8dbd56c9d"
    }
  ],
  "entries": {
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": {
      "sha": "184536c22980b5c40df41ce65362caa4130de63c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    "apps/identity-runtime/src/organisation-onboarding.ts": {
      "sha": "98169978b157e0676f513f1b7ce11bac5c0a84d3",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/test/organisation-onboarding.test.mjs": {
      "sha": "f04a4b27f7b39d7031839afb877fe6f5e836ff83",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/sg-runtime/operation-integration.json": {
      "sha": "bd3b3d6169ef575c2a79ae9c80ee529014f41632",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": {
      "sha": "5f2c3194cadc617806f2a097e75cbdaebdef21a5",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": {
      "sha": "6836893a46e189aade7a422b4eca912dc9cbc9b1",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/operation-context.test.mjs": {
      "sha": "f77c83fa347330a710d53079fe8f3f12a0ba8d6c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/private-host.integration.test.mjs": {
      "sha": "e2c3e0ae81a713425b104139f036783e81f5aa1e",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": {
      "sha": "6e53641ad436dbd95568a49c26f7176616c8c686",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-platform-compatibility.test.mjs": {
      "sha": "e2a7d72bc910352bab449ff4cf2e651e015af96b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/srm/operation-integration.json": {
      "sha": "7d399125fbb50f8b4f0b00db2662c05b1096995f",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": {
      "sha": "ce2340a7ab9c700795715281aa9ee922d8daedfa",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/native-execution-adoption.test.mjs": {
      "sha": "2f79f558f44efa3b94cbbec919bc774044b8a73b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/operation-context.test.mjs": {
      "sha": "b152578e6931f9fa1582b0ced87d93606143130b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/private-host.integration.test.mjs": {
      "sha": "a9544af37bb7b32b5a36105d40beb4769f1da489",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/request-quota-adoption.test.mjs": {
      "sha": "da960d8679088a1a108f23f445a997bc5b5ea788",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": {
      "sha": "f08c6b08e09258ebddd4f8891cbf268cfcc623a2",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": {
      "sha": "731a3a0d130ea41c3af85509130a0df9911c0df2",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/xray-performance-adoption.test.mjs": {
      "sha": "071102735bd9d3322c5d096c05d1513c3772e5d6",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": {
      "sha": "f412f1607a4fca31cb1bbb583d45e7dc0828854c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql": {
      "sha": "a0239d930b8da5333e5589a1734bacb54d67191c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/profile/008-organisation-create.sql": {
      "sha": "5571f58c2ee30e3a0f1a33204ba8af4c53c29660",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/package.json": {
      "sha": "c2b5ab6d8a117c351fa0e03b3878eeec83f5c9f7",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": {
      "sha": "cd02bb919957e9da7cebb4c40fbe9a3ff4940fbe",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/operation-context.d.mts": {
      "sha": "b00220f767db22897bb3ec65233bb39fba715e4e",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/operation-context.mjs": {
      "sha": "d018c17a251abbf698c87a29aded91f93a4e493c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-bootstrap.d.mts": {
      "sha": "ffcacec4080ca608ab00e3aff0b7371f23f08a55",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-bootstrap.mjs": {
      "sha": "008ef066c74bd72a2a546f15f4cc1694db9ef297",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-invitations.d.mts": {
      "sha": "674a1e3d7841bad6194a176ecccd70622bae012b",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-invitations.mjs": {
      "sha": "280935c68a5d1c8194669f8894b87324c2ed6843",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-profile.d.mts": {
      "sha": "a8e933f8f4946ad9459baab93110976be88e97ef",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-profile.mjs": {
      "sha": "be2730964c8af8b32f8c8f2baf45aa26fe807949",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-bootstrap-postgres.test.mjs": {
      "sha": "28e82cc2af6d32f6a7e396c48ad081323680b140",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-bootstrap.test.mjs": {
      "sha": "ea30c87f19cfb0bc064cd922c23a0b0dde354c99",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-invitations.test.mjs": {
      "sha": "64fcb4270f376573c132040eb8fd66642240ecdc",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs": {
      "sha": "203ee38cf32c28327eecd1093100bef54db3a84d",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-profile.test.mjs": {
      "sha": "a6ed612325ad049dded4a4fbfdc00b254bc147e1",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.json": {
      "sha": "53f6aedd40627606841dac0ae5c6cd639751a793",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.mjs": {
      "sha": "7f86765be878281f1c721ecfd669bb628b5e1781",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs": {
      "sha": "aa8cdb529f429628561fc2fcb89c2624dd782f26",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/private-operation-host.test.mjs": {
      "sha": "b96001f516411487bf6e1ca07aa21cb0a007cc5d",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    }
  }
})
// Exact metadata/test reconciliation. The initial41-file owner decision remains immutable.
export const REGISTRATION_SDK_PREVIOUS_REVIEW=Object.freeze({
  "prNumber": 983,
  "branch": "architecture/registration-bootstrap-stage-i-20261111",
  "sourceSha": "84d1122f5f40294821ee40775e7774a967968f4f",
  "baseSha": "fa81114d35281693604833f1b7639b3c3b829ce6",
  "treeSha": "bde4dc12274077ad8e088cdefe715e728c914759",
  "inputs": [
    {
      "projectKey": "ARCHITECTURE",
      "taskId": "ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110",
      "prNumber": 989,
      "sourceSha": "9ae4a3e7d309a9eb55fa9ff237494ff2dc02506f"
    },
    {
      "projectKey": "SG2",
      "taskId": "SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110",
      "prNumber": 987,
      "sourceSha": "dfaa4bb2053ae9b4856edabb9c40478d0b5b66c9"
    },
    {
      "projectKey": "SRM",
      "taskId": "SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111",
      "prNumber": 986,
      "sourceSha": "c9b06b32dd64f5b75d67b81ea4a85a19d541c472"
    }
  ],
  "entries": {
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": {
      "sha": "184536c22980b5c40df41ce65362caa4130de63c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    "apps/identity-runtime/src/organisation-onboarding.ts": {
      "sha": "98169978b157e0676f513f1b7ce11bac5c0a84d3",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/test/organisation-onboarding.test.mjs": {
      "sha": "f04a4b27f7b39d7031839afb877fe6f5e836ff83",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/newsfeed-runtime/test/runtime.test.mjs": {
      "sha": "36209e9d8c055fbbf695ba546634a25b1e161259",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/platform-source-hub/scripts/ci-routing.mjs": {
      "sha": "54142248b9b8096ed3d3b22e582478d019c505a6",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/ci-routing.test.mjs": {
      "sha": "f7b9d7bebae5d87c7aeb8e669077f6c7547d90f4",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/sg-runtime/operation-integration.json": {
      "sha": "bd3b3d6169ef575c2a79ae9c80ee529014f41632",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-m2-integrity.mjs": {
      "sha": "55d2d9f8cc17adb3dcb7c5a2dfb0495b2b4c8de0",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": {
      "sha": "5f2c3194cadc617806f2a097e75cbdaebdef21a5",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": {
      "sha": "6836893a46e189aade7a422b4eca912dc9cbc9b1",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/operation-context.test.mjs": {
      "sha": "f77c83fa347330a710d53079fe8f3f12a0ba8d6c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/private-host.integration.test.mjs": {
      "sha": "e2c3e0ae81a713425b104139f036783e81f5aa1e",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": {
      "sha": "6e53641ad436dbd95568a49c26f7176616c8c686",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-platform-compatibility.test.mjs": {
      "sha": "e2a7d72bc910352bab449ff4cf2e651e015af96b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/srm/operation-integration.json": {
      "sha": "7d399125fbb50f8b4f0b00db2662c05b1096995f",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": {
      "sha": "ce2340a7ab9c700795715281aa9ee922d8daedfa",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/native-execution-adoption.test.mjs": {
      "sha": "2f79f558f44efa3b94cbbec919bc774044b8a73b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/operation-context.test.mjs": {
      "sha": "b152578e6931f9fa1582b0ced87d93606143130b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/private-host.integration.test.mjs": {
      "sha": "a9544af37bb7b32b5a36105d40beb4769f1da489",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/request-quota-adoption.test.mjs": {
      "sha": "da960d8679088a1a108f23f445a997bc5b5ea788",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": {
      "sha": "0f951336afbdd7820344ef82325f81aa0ac0a9b2",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": {
      "sha": "731a3a0d130ea41c3af85509130a0df9911c0df2",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/xray-performance-adoption.test.mjs": {
      "sha": "071102735bd9d3322c5d096c05d1513c3772e5d6",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/peer-read-boundary.test.ts": {
      "sha": "84a815444776c192eec80211190ff0dea189d26c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": {
      "sha": "d272026e1d3554700eeb87a3096343f0cc34dd23",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/supplier-location-geocoding-runtime.test.ts": {
      "sha": "0cb4a302f931fdbdb93cb3cb34c1e9dcf9d0fca7",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": {
      "sha": "f412f1607a4fca31cb1bbb583d45e7dc0828854c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql": {
      "sha": "a0239d930b8da5333e5589a1734bacb54d67191c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/profile/008-organisation-create.sql": {
      "sha": "5571f58c2ee30e3a0f1a33204ba8af4c53c29660",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/package.json": {
      "sha": "c2b5ab6d8a117c351fa0e03b3878eeec83f5c9f7",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": {
      "sha": "cd02bb919957e9da7cebb4c40fbe9a3ff4940fbe",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/operation-context.d.mts": {
      "sha": "b00220f767db22897bb3ec65233bb39fba715e4e",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/operation-context.mjs": {
      "sha": "d018c17a251abbf698c87a29aded91f93a4e493c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-bootstrap.d.mts": {
      "sha": "ffcacec4080ca608ab00e3aff0b7371f23f08a55",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-bootstrap.mjs": {
      "sha": "008ef066c74bd72a2a546f15f4cc1694db9ef297",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-invitations.d.mts": {
      "sha": "674a1e3d7841bad6194a176ecccd70622bae012b",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-invitations.mjs": {
      "sha": "280935c68a5d1c8194669f8894b87324c2ed6843",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-profile.d.mts": {
      "sha": "a8e933f8f4946ad9459baab93110976be88e97ef",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-profile.mjs": {
      "sha": "be2730964c8af8b32f8c8f2baf45aa26fe807949",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-bootstrap-postgres.test.mjs": {
      "sha": "28e82cc2af6d32f6a7e396c48ad081323680b140",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-bootstrap.test.mjs": {
      "sha": "ea30c87f19cfb0bc064cd922c23a0b0dde354c99",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-invitations.test.mjs": {
      "sha": "64fcb4270f376573c132040eb8fd66642240ecdc",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs": {
      "sha": "203ee38cf32c28327eecd1093100bef54db3a84d",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-profile.test.mjs": {
      "sha": "a6ed612325ad049dded4a4fbfdc00b254bc147e1",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.json": {
      "sha": "5ac1ea073a88c4b734ae644fd4c61cb10d6e89dd",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.mjs": {
      "sha": "4b2487e09a4f2747613a30ae8d4fe2f2a97f67e0",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs": {
      "sha": "5368aff3e2355bb509e2e99cc26e2601e735187b",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/private-operation-host.test.mjs": {
      "sha": "b96001f516411487bf6e1ca07aa21cb0a007cc5d",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    }
  }
})
export const REGISTRATION_SDK_COMPLETE_REVIEW=Object.freeze({"prNumber":983,"branch":"architecture/registration-bootstrap-stage-i-20261111","sourceSha":"23954edbc65b8b404e7491f3bda56b8877b72864","baseSha":"736396e6818c34bf588896f9435abc389889ed92","treeSha":"3907ddec3ec7bda18329a3e8db3d93c5515ceba4","inputs":[{"projectKey":"ARCHITECTURE","taskId":"ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110","prNumber":989,"sourceSha":"f2725faad33090144ea5768b40dff6d997e7ef4b"},{"projectKey":"SG2","taskId":"SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110","prNumber":987,"sourceSha":"4b756105b6852b036cb51371bc33eb7803e9dd98"},{"projectKey":"SRM","taskId":"SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111","prNumber":986,"sourceSha":"fcb0eae366f4a9b9d26e9305a2163e83db15229e"}],"entries":Object.freeze({"apps/architecture-lab/test/sdk-compatibility.test.mjs":{"sha":"184536c22980b5c40df41ce65362caa4130de63c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/identity-runtime/src/organisation-onboarding.ts":{"sha":"98169978b157e0676f513f1b7ce11bac5c0a84d3","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/test/organisation-onboarding.test.mjs":{"sha":"f04a4b27f7b39d7031839afb877fe6f5e836ff83","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/newsfeed-runtime/test/runtime.test.mjs":{"sha":"36209e9d8c055fbbf695ba546634a25b1e161259","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/platform-source-hub/scripts/ci-routing.mjs":{"sha":"54142248b9b8096ed3d3b22e582478d019c505a6","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/platform-source-hub/test/ci-routing.test.mjs":{"sha":"f7b9d7bebae5d87c7aeb8e669077f6c7547d90f4","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/sg-runtime/operation-integration.json":{"sha":"bd3b3d6169ef575c2a79ae9c80ee529014f41632","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-integrity.mjs":{"sha":"ec0e23a87827d130e41210ca3cf0bbc29786efd5","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-integrity.test.mjs":{"sha":"8d2e68fa62b1295d35fbe74b9bdef6e9ab920582","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs":{"sha":"751ed6551ab43dd832e232136608a919837d779b","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-m1-integrity.mjs":{"sha":"9f28f13a7da11d6def28a91a1440d22ea793b59c","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-m2-integrity.mjs":{"sha":"55d2d9f8cc17adb3dcb7c5a2dfb0495b2b4c8de0","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-m2-source-view.mjs":{"sha":"a526345d7c153113ea629f3c16ec5c35c41567cb","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs":{"sha":"b19f2eea8f16ddb07d67dc0cbf4a97c15ea51181","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-send-arrow-integrity.test.mjs":{"sha":"4189be2d1998d14cfd5f25d74093595b6581b7fa","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs":{"sha":"5f2c3194cadc617806f2a097e75cbdaebdef21a5","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/native-sql-roundtrips.test.mjs":{"sha":"6836893a46e189aade7a422b4eca912dc9cbc9b1","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/operation-context.test.mjs":{"sha":"77a86e00786e8efd17d92fecbeb82aa0a56fec94","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/organisation-sdk-history.test.mjs":{"sha":"62b7b2aa205062d4f9598aa619ec3b2df8aff459","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/pci-smart-integrity.test.mjs":{"sha":"b08edf93ef8026ca982a6ce2a2c4d0ca1425f505","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/private-host.integration.test.mjs":{"sha":"19cb9afe8792b44ebf2822bf61692827bac49404","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs":{"sha":"6e53641ad436dbd95568a49c26f7176616c8c686","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/xray-platform-compatibility.test.mjs":{"sha":"e2a7d72bc910352bab449ff4cf2e651e015af96b","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/srm/app/login/porr-account.tsx":{"sha":"f17f19b531cac97f09e87568123f2f71e1114416","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/operation-integration.json":{"sha":"7d399125fbb50f8b4f0b00db2662c05b1096995f","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs":{"sha":"76e92f7822da73f8a74ac0feb10604b5b0789876","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/native-execution-adoption.test.mjs":{"sha":"ccbe63d9197e0be179cdfa9b512d80ca03c0de60","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/operation-context.test.mjs":{"sha":"1f2857013f176fe740e79539ca6c676cc0afab03","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/porr-account-ui.test.mjs":{"sha":"353de6a9e489103b2bea6e02c4bf7639ce624b63","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/private-host.integration.test.mjs":{"sha":"6156c9ab32f32ce116df6f58689f2b9a1b7ef878","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/request-quota-adoption.test.mjs":{"sha":"85b91a57e72633eee79aceb1a73bece0d1139d74","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/source-hub-sdk-compatibility.mjs":{"sha":"efedf34427ba2529e599d1568de31312df63bbda","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/supplier-location-admission.integration.test.mjs":{"sha":"555d0af768e006ca1c3e5788629cf749203dc7b5","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/xray-performance-adoption.test.mjs":{"sha":"0eea6287d1bb24e84eff8688c0bfa4a5e16bda4a","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/peer-read-boundary.test.ts":{"sha":"84a815444776c192eec80211190ff0dea189d26c","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/root-atomic-claim-adoption.test.ts":{"sha":"d272026e1d3554700eeb87a3096343f0cc34dd23","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/supplier-location-geocoding-runtime.test.ts":{"sha":"0cb4a302f931fdbdb93cb3cb34c1e9dcf9d0fca7","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs":{"sha":"f412f1607a4fca31cb1bbb583d45e7dc0828854c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql":{"sha":"a0239d930b8da5333e5589a1734bacb54d67191c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/migrations/profile/008-organisation-create.sql":{"sha":"5571f58c2ee30e3a0f1a33204ba8af4c53c29660","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/package.json":{"sha":"c2b5ab6d8a117c351fa0e03b3878eeec83f5c9f7","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs":{"sha":"cd02bb919957e9da7cebb4c40fbe9a3ff4940fbe","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.d.mts":{"sha":"b00220f767db22897bb3ec65233bb39fba715e4e","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.mjs":{"sha":"d018c17a251abbf698c87a29aded91f93a4e493c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-bootstrap.d.mts":{"sha":"ffcacec4080ca608ab00e3aff0b7371f23f08a55","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-bootstrap.mjs":{"sha":"008ef066c74bd72a2a546f15f4cc1694db9ef297","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-invitations.d.mts":{"sha":"674a1e3d7841bad6194a176ecccd70622bae012b","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-invitations.mjs":{"sha":"280935c68a5d1c8194669f8894b87324c2ed6843","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-profile.d.mts":{"sha":"a8e933f8f4946ad9459baab93110976be88e97ef","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-profile.mjs":{"sha":"be2730964c8af8b32f8c8f2baf45aa26fe807949","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-bootstrap-postgres.test.mjs":{"sha":"28e82cc2af6d32f6a7e396c48ad081323680b140","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-bootstrap.test.mjs":{"sha":"ea30c87f19cfb0bc064cd922c23a0b0dde354c99","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-invitations.test.mjs":{"sha":"64fcb4270f376573c132040eb8fd66642240ecdc","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs":{"sha":"203ee38cf32c28327eecd1093100bef54db3a84d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-profile.test.mjs":{"sha":"a6ed612325ad049dded4a4fbfdc00b254bc147e1","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-sdk-compatibility.json":{"sha":"33ffdc98f29e6157136b898e704d75fc629a77db","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-sdk-compatibility.mjs":{"sha":"6a791a82346ba08e0b7bc8dcacd8fb7737555df1","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs":{"sha":"7cc4c3e2b9eefc8bdd1c5ccee426fbb2c49b2c1c","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/private-operation-host.test.mjs":{"sha":"b96001f516411487bf6e1ca07aa21cb0a007cc5d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}})})
export const REGISTRATION_SDK_TEST_SOURCE_REVIEW=Object.freeze({"prNumber":983,"branch":"architecture/registration-bootstrap-stage-i-20261111","sourceSha":"b4ca8b7072bd105e1ac3f3ead85a1104bf7f04c4","baseSha":"3b556e076a6e42be58a184f6cb27c3933f9a83c1","treeSha":"26358c1380e9f628f87036b5f825dca52dd3f2ca","inputs":[{"projectKey":"ARCHITECTURE","prNumber":989,"sourceSha":"c1eec8aaeb7dc9959888bd3d14c3f9c110fb9d65"},{"projectKey":"SG2","prNumber":987,"sourceSha":"9df41b364fabe880043ffe83fb3247bb9cb8a62e"},{"projectKey":"SRM","prNumber":986,"sourceSha":"fcb0eae366f4a9b9d26e9305a2163e83db15229e"}],"entries":Object.freeze({"apps/architecture-lab/test/sdk-compatibility.test.mjs":{"sha":"184536c22980b5c40df41ce65362caa4130de63c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/identity-runtime/src/organisation-onboarding.ts":{"sha":"98169978b157e0676f513f1b7ce11bac5c0a84d3","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/test/organisation-onboarding.test.mjs":{"sha":"f04a4b27f7b39d7031839afb877fe6f5e836ff83","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/newsfeed-runtime/test/runtime.test.mjs":{"sha":"36209e9d8c055fbbf695ba546634a25b1e161259","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/platform-source-hub/scripts/ci-routing.mjs":{"sha":"54142248b9b8096ed3d3b22e582478d019c505a6","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/platform-source-hub/test/ci-routing.test.mjs":{"sha":"f7b9d7bebae5d87c7aeb8e669077f6c7547d90f4","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/sg-runtime/operation-integration.json":{"sha":"bd3b3d6169ef575c2a79ae9c80ee529014f41632","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-integrity.mjs":{"sha":"ec0e23a87827d130e41210ca3cf0bbc29786efd5","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-integrity.test.mjs":{"sha":"8d2e68fa62b1295d35fbe74b9bdef6e9ab920582","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs":{"sha":"751ed6551ab43dd832e232136608a919837d779b","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-m1-integrity.mjs":{"sha":"9f28f13a7da11d6def28a91a1440d22ea793b59c","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-m2-integrity.mjs":{"sha":"55d2d9f8cc17adb3dcb7c5a2dfb0495b2b4c8de0","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-m2-source-view.mjs":{"sha":"a526345d7c153113ea629f3c16ec5c35c41567cb","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs":{"sha":"b19f2eea8f16ddb07d67dc0cbf4a97c15ea51181","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-send-arrow-integrity.test.mjs":{"sha":"4189be2d1998d14cfd5f25d74093595b6581b7fa","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs":{"sha":"5f2c3194cadc617806f2a097e75cbdaebdef21a5","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/native-sql-roundtrips.test.mjs":{"sha":"6836893a46e189aade7a422b4eca912dc9cbc9b1","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/operation-context.test.mjs":{"sha":"77a86e00786e8efd17d92fecbeb82aa0a56fec94","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/organisation-sdk-history.test.mjs":{"sha":"62b7b2aa205062d4f9598aa619ec3b2df8aff459","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/pci-smart-integrity.test.mjs":{"sha":"b08edf93ef8026ca982a6ce2a2c4d0ca1425f505","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/private-host.integration.test.mjs":{"sha":"5269cf475e341ee4a9e72d54ba9dcae4e3d13d45","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs":{"sha":"6e53641ad436dbd95568a49c26f7176616c8c686","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/xray-platform-compatibility.test.mjs":{"sha":"e2a7d72bc910352bab449ff4cf2e651e015af96b","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/srm/app/login/porr-account.tsx":{"sha":"f17f19b531cac97f09e87568123f2f71e1114416","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/operation-integration.json":{"sha":"7d399125fbb50f8b4f0b00db2662c05b1096995f","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs":{"sha":"76e92f7822da73f8a74ac0feb10604b5b0789876","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/native-execution-adoption.test.mjs":{"sha":"ccbe63d9197e0be179cdfa9b512d80ca03c0de60","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/operation-context.test.mjs":{"sha":"1f2857013f176fe740e79539ca6c676cc0afab03","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/porr-account-ui.test.mjs":{"sha":"353de6a9e489103b2bea6e02c4bf7639ce624b63","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/private-host.integration.test.mjs":{"sha":"6156c9ab32f32ce116df6f58689f2b9a1b7ef878","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/request-quota-adoption.test.mjs":{"sha":"85b91a57e72633eee79aceb1a73bece0d1139d74","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/source-hub-sdk-compatibility.mjs":{"sha":"efedf34427ba2529e599d1568de31312df63bbda","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/supplier-location-admission.integration.test.mjs":{"sha":"555d0af768e006ca1c3e5788629cf749203dc7b5","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/xray-performance-adoption.test.mjs":{"sha":"0eea6287d1bb24e84eff8688c0bfa4a5e16bda4a","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/peer-read-boundary.test.ts":{"sha":"84a815444776c192eec80211190ff0dea189d26c","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/root-atomic-claim-adoption.test.ts":{"sha":"d272026e1d3554700eeb87a3096343f0cc34dd23","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/supplier-location-geocoding-runtime.test.ts":{"sha":"0cb4a302f931fdbdb93cb3cb34c1e9dcf9d0fca7","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs":{"sha":"f412f1607a4fca31cb1bbb583d45e7dc0828854c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql":{"sha":"a0239d930b8da5333e5589a1734bacb54d67191c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/migrations/profile/008-organisation-create.sql":{"sha":"5571f58c2ee30e3a0f1a33204ba8af4c53c29660","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/package.json":{"sha":"c2b5ab6d8a117c351fa0e03b3878eeec83f5c9f7","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs":{"sha":"cd02bb919957e9da7cebb4c40fbe9a3ff4940fbe","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.d.mts":{"sha":"b00220f767db22897bb3ec65233bb39fba715e4e","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.mjs":{"sha":"d018c17a251abbf698c87a29aded91f93a4e493c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-bootstrap.d.mts":{"sha":"ffcacec4080ca608ab00e3aff0b7371f23f08a55","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-bootstrap.mjs":{"sha":"008ef066c74bd72a2a546f15f4cc1694db9ef297","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-invitations.d.mts":{"sha":"674a1e3d7841bad6194a176ecccd70622bae012b","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-invitations.mjs":{"sha":"280935c68a5d1c8194669f8894b87324c2ed6843","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-profile.d.mts":{"sha":"a8e933f8f4946ad9459baab93110976be88e97ef","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-profile.mjs":{"sha":"be2730964c8af8b32f8c8f2baf45aa26fe807949","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-bootstrap-postgres.test.mjs":{"sha":"28e82cc2af6d32f6a7e396c48ad081323680b140","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-bootstrap.test.mjs":{"sha":"ea30c87f19cfb0bc064cd922c23a0b0dde354c99","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-invitations.test.mjs":{"sha":"64fcb4270f376573c132040eb8fd66642240ecdc","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs":{"sha":"203ee38cf32c28327eecd1093100bef54db3a84d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-profile.test.mjs":{"sha":"a6ed612325ad049dded4a4fbfdc00b254bc147e1","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-sdk-compatibility.json":{"sha":"a6f28d6b1928aea0839448526df6d4e0afb908e4","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-sdk-compatibility.mjs":{"sha":"f309cb4ba8e6db083c84efc40bd2f3e5c0b3a9c5","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs":{"sha":"18aba285817c06615d54932fa079b8eb24d3c4d7","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/private-operation-host.test.mjs":{"sha":"b96001f516411487bf6e1ca07aa21cb0a007cc5d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}})})
export const REGISTRATION_SDK_REVIEW=Object.freeze({"prNumber":983,"branch":"architecture/registration-bootstrap-stage-i-20261111","sourceSha":"2be25df1b7b5c81519673d43504f056261387fe9","baseSha":"0775f8a18d2fbeca462bb0a9d654914b15c53dad","treeSha":"bd218dba47623d35e91e5402cdb1deb1ddf89b2f","inputs":[{"projectKey":"ARCHITECTURE","sourceSha":"5a963f313317d57e1946e1d7aabd28192db9c7bd"},{"projectKey":"SG2","sourceSha":"1ea8487fe7cc40cd5a817958c8b093203233fe82"},{"projectKey":"SRM","sourceSha":"2e087d89e6d0bf9f75a289df3e6c161ba658a922"},{"projectKey":"ARCHITECTURE","sourceSha":"6dd651bee360d80a644f7526cf1397f60a0db461"}],"entries":{"apps/architecture-lab/test/sdk-compatibility.test.mjs":{"sha":"610dfbe38117a42cf2c779b4632b8c7750c48006","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/identity-runtime/README.md":{"sha":"5120ffc0369dbf61768d4b8eec350e15c40fe444","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/http-handler.ts":{"sha":"5a0814c30b27854ac5fdd35f0733b31663b65010","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/main.ts":{"sha":"f501b78acfb1b57fbfef2fd77d9ce0ee2dc2ded2","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/organisation-draft.ts":{"sha":"2aa5b0bd1dc9ac6a6cdaa52ad8cc7ecc3a532de2","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/organisation-onboarding.ts":{"sha":"98169978b157e0676f513f1b7ce11bac5c0a84d3","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/test/organisation-draft.test.mjs":{"sha":"c0aec90965fe8e59a8ddf7c54b26defdd6bdf715","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/test/organisation-onboarding.test.mjs":{"sha":"f04a4b27f7b39d7031839afb877fe6f5e836ff83","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/newsfeed-runtime/test/runtime.test.mjs":{"sha":"5519835ee8bc3c475c89955c90b40d2d9f6b3e31","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/platform-source-hub/scripts/ci-routing.mjs":{"sha":"8e4cdafb5f714e7e5453aaf3ca9f6070d5e369a7","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/platform-source-hub/test/ci-routing.test.mjs":{"sha":"1d2ce68442dda9f02f4038c6e0f38f6edab9088a","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/sg-runtime/operation-integration.json":{"sha":"bd3b3d6169ef575c2a79ae9c80ee529014f41632","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-integrity.mjs":{"sha":"3aa3efce05c1e32852db09e0712d505f545703a9","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-integrity.test.mjs":{"sha":"8d2e68fa62b1295d35fbe74b9bdef6e9ab920582","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs":{"sha":"128042b7ecf8338580490d94cb2c32a4554a4e2c","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-m1-integrity.mjs":{"sha":"9f28f13a7da11d6def28a91a1440d22ea793b59c","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-m2-integrity.mjs":{"sha":"55d2d9f8cc17adb3dcb7c5a2dfb0495b2b4c8de0","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-m2-source-view.mjs":{"sha":"a526345d7c153113ea629f3c16ec5c35c41567cb","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs":{"sha":"b19f2eea8f16ddb07d67dc0cbf4a97c15ea51181","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-send-arrow-integrity.test.mjs":{"sha":"4189be2d1998d14cfd5f25d74093595b6581b7fa","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs":{"sha":"bbaea986f3025be73b3671f060a22fb0eb04577e","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/native-sql-roundtrips.test.mjs":{"sha":"d036b253252494e96188cb597100e8dd50ee202a","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/operation-context.test.mjs":{"sha":"14cffed76391f717fd86b677b57996d2fea9e9a5","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/organisation-sdk-history.test.mjs":{"sha":"62b7b2aa205062d4f9598aa619ec3b2df8aff459","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/pci-smart-integrity.test.mjs":{"sha":"67a4d7c372dad41e70db60fab3cf362298195c35","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/private-host.integration.test.mjs":{"sha":"d7634ec820378e16fe77b528a2c3ae7aca981021","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs":{"sha":"f53c72ba9f83eeccbc3fbc2acfdcfd7f43987058","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/xray-platform-compatibility.test.mjs":{"sha":"e2a7d72bc910352bab449ff4cf2e651e015af96b","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/srm/app/login/porr-account.tsx":{"sha":"c0149d2354e38b5ca701df7bedb5bf29ba25caa1","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/operation-integration.json":{"sha":"7d399125fbb50f8b4f0b00db2662c05b1096995f","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs":{"sha":"72173ae2f3a552621318edb5de432159b862e620","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/native-execution-adoption.test.mjs":{"sha":"0da985a6c0c0f84a0d4aacabb2f134dd7c2c3db7","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/operation-context.test.mjs":{"sha":"e5bddf17ef1a94029a2bea96d48ed0c731b9bce6","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/porr-account-ui.test.mjs":{"sha":"353de6a9e489103b2bea6e02c4bf7639ce624b63","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/private-host.integration.test.mjs":{"sha":"d74fce2fb8412368352686171770a85861d74ad5","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/request-quota-adoption.test.mjs":{"sha":"4c62c98034d1d951da03e697ddbd210ed2004f06","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/source-hub-sdk-compatibility.mjs":{"sha":"efedf34427ba2529e599d1568de31312df63bbda","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/supplier-location-admission.integration.test.mjs":{"sha":"6e7fa64e937164caba4b2bf40171ae382d697f01","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/xray-performance-adoption.test.mjs":{"sha":"cebe2d1f9522d5937cd6535bc500679362904c40","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/peer-read-boundary.test.ts":{"sha":"84a815444776c192eec80211190ff0dea189d26c","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/root-atomic-claim-adoption.test.ts":{"sha":"b3830877a971df99cfc53d9497aa9b17048437af","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/supplier-location-geocoding-runtime.test.ts":{"sha":"0cb4a302f931fdbdb93cb3cb34c1e9dcf9d0fca7","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"Canon/evidence/2026-11-11-registration-native-draft-http.md":{"sha":"267c92c5aec1f342c2c5ee00123f69505677368a","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Governance Source Layer","surfaceId":"SG2-BASE-019"},"packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs":{"sha":"f826d708d9e11b309592bd681a1ebafa5223a1f3","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql":{"sha":"a0239d930b8da5333e5589a1734bacb54d67191c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/migrations/profile/008-organisation-create.sql":{"sha":"5571f58c2ee30e3a0f1a33204ba8af4c53c29660","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/package.json":{"sha":"db586c8d54c09507fe05fe3e218ff1c0370d2c34","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs":{"sha":"93e5f7cb8fc1bedac88af2f5f6580b763d7a9b4a","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.d.mts":{"sha":"f8d97e7a27cb885d7f7f800a7d35543941605ba2","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.mjs":{"sha":"5be3fbe9824d2a671f6b504322314b3a8be3759c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-bootstrap.d.mts":{"sha":"ffcacec4080ca608ab00e3aff0b7371f23f08a55","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-bootstrap.mjs":{"sha":"008ef066c74bd72a2a546f15f4cc1694db9ef297","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-invitations.d.mts":{"sha":"674a1e3d7841bad6194a176ecccd70622bae012b","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-invitations.mjs":{"sha":"280935c68a5d1c8194669f8894b87324c2ed6843","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-profile.d.mts":{"sha":"a8e933f8f4946ad9459baab93110976be88e97ef","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/organisation-profile.mjs":{"sha":"be2730964c8af8b32f8c8f2baf45aa26fe807949","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-bootstrap-postgres.test.mjs":{"sha":"28e82cc2af6d32f6a7e396c48ad081323680b140","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-bootstrap.test.mjs":{"sha":"f4df6bd2aad25b441a3ab80fd611442cbf4884b8","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-invitations.test.mjs":{"sha":"64fcb4270f376573c132040eb8fd66642240ecdc","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs":{"sha":"203ee38cf32c28327eecd1093100bef54db3a84d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-profile.test.mjs":{"sha":"a6ed612325ad049dded4a4fbfdc00b254bc147e1","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-sdk-compatibility.json":{"sha":"d336dcaa47ecf6e5264be8f449a63ad52c7c7781","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-sdk-compatibility.mjs":{"sha":"fd15eb0b9b07fc59b7e92697c40b26684e79a1f0","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs":{"sha":"c7baabf64e3ad2c35ec7e57b009f0eacd12bf9d9","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/private-operation-host.test.mjs":{"sha":"d821982f50e009a3452502308fc98fcec4f92b0d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"}}})
export const REGISTRATION_SDK_RECONCILED_PROVENANCE=Object.freeze({"recordDigest":"ccf680f0a83b61f3944dd2823259e9487ddae5c2a7707b8d05e793241c4aae40","previousSourceSha":"0775f8a18d2fbeca462bb0a9d654914b15c53dad","sourceCount":165,"operationSourceDigest":"3877ef17593c118c4d188aa9e464c329373723cb8776a44cbda5987c31dd67ce","bindings":{"SG2":{"taskId":"SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110","raw":"a6bf50993c98a71aeccd349dd904baafb53b3cd653324d97bab3fc5e34ac509f","normalized":"5f85f0a172508e80a7502aff2c8d3f388dcb4f0c1197eebe6e51917834cd8136"},"SRM":{"taskId":"SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111","raw":"1303ac82c0570ca4929f64e1620e2ec7a6bfd3809607f57eb33da621c8ecd06d","normalized":"d0626a3b74287b03c77feedb0ace57737257126c3012c7b56547331ea9bb9aa7"}}})
function pinnedRegistrationSdkReview(files){
 return [REGISTRATION_SDK_REVIEW,REGISTRATION_SDK_TEST_SOURCE_REVIEW,REGISTRATION_SDK_COMPLETE_REVIEW,REGISTRATION_SDK_PREVIOUS_REVIEW,REGISTRATION_SDK_INITIAL_REVIEW].find(r=>Array.isArray(files)&&files.length===Object.keys(r.entries).length&&new Set(files.map(f=>f?.filename)).size===files.length&&files.every(f=>Object.hasOwn(r.entries,f?.filename)&&r.entries[f.filename].sha===f.sha&&r.entries[f.filename].status===f.status&&!Object.hasOwn(f,'previous_filename')))
}
function isPinnedRegistrationSdkReview(files){
 return Boolean(pinnedRegistrationSdkReview(files))
}
function assertRegistrationSdkRoutes(files,repositoryRoot){
 const review=pinnedRegistrationSdkReview(files)
 if(!review)fail('REGISTRATION_SDK_ROUTING_REJECTED')
 for(const file of files){
  const e=review.entries[file.filename],profile=resolveProjectProfile(e.projectKey,repositoryRoot),routing=resolveProjectRouting({profile,targets:[file.filename],repositoryRoot}),r=routing.results[0]
  if(profile.repository.slug!==REPOSITORY||!routing.ok||routing.results.length!==1||r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.baselineClassification!=='ALIGNED'||r.projectBoundaryStatus!=='ALLOWED'||r.currentOwner!==e.owner||r.matchedSurfaceId!==e.surfaceId)fail('REGISTRATION_SDK_ROUTING_REJECTED')
 }
}
export function assertRegistrationSdkReviewEntry(file,entry){
 const e=[REGISTRATION_SDK_REVIEW,REGISTRATION_SDK_TEST_SOURCE_REVIEW,REGISTRATION_SDK_COMPLETE_REVIEW,REGISTRATION_SDK_PREVIOUS_REVIEW,REGISTRATION_SDK_INITIAL_REVIEW].map(r=>Object.hasOwn(r.entries,file?.filename)?r.entries[file.filename]:null).find(e=>e?.sha===file?.sha&&e?.status===file?.status)
 if(!e||e.sha!==file.sha||e.status!==file.status||entry!==e.mode+' blob '+file.sha+'\t'+file.filename+'\0')fail('REGISTRATION_SDK_FILE_MODE_REJECTED')
}

export const NEWSFEED_SAVED_SEARCH_REVIEW=Object.freeze({"prNumber":969,"branch":"architecture/pi-end-to-end-20261110","sourceSha":"8fa964a159a468968293337c9d0c79c326cb84e5","baseSha":"1e0dc1ca4057437805561a841105e291d028df10","entries":Object.freeze({"apps/newsfeed-runtime/docs/development-v1.2.md":{"sha":"87bc9ff343f6726ab47454c81c03d529211e2ca7","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/migrations/003-saved-searches.sql":{"sha":"0da6a251c5af904f9784abf8e8ff80cedb36ab80","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/saved-searches-integration.json":{"sha":"af2cfcf9ce736a6beb53db85fe3ed41122886466","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/scripts/migrate.mjs":{"sha":"1f71ed906188dce57b7399d9c06b287485c8dfea","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/main.mjs":{"sha":"40955da8f73a74de6db24fed2dde064cf757c040","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/repository.mjs":{"sha":"94031e717c45686b1629bf627a5db97e4c2a4e48","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/scheduler.mjs":{"sha":"3257d018479164eb64a17f0e748630cfbf93cab0","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/server.mjs":{"sha":"7cc04ec11fb1597cd4cdd5b447890207a5c538bf","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/statistics.mjs":{"sha":"b4d4191a03c0c3e84dd463ca99bac2d4e136928a","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/assistant-context.test.mjs":{"sha":"49a071dc01e23c307900b6ad1af9dc7045f53125","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/saved-searches.test.mjs":{"sha":"956f37e1045bd7d4b7cbacdf3358c96af1223755","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/scheduler.test.mjs":{"sha":"f89761ecabe037a0f7888c9ac4891d18769acdfa","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/statistics.test.mjs":{"sha":"cafa33a981d8e651e54fa9a791eabdb71536cbdb","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"packages/newsfeed-contracts/README.md":{"sha":"0db6057f326af75520d0fcbf98b19fd04b410a46","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-002"},"packages/newsfeed-contracts/index.d.ts":{"sha":"25f0171264bcebfb678bf1dc61d5a75541040652","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-002"},"packages/newsfeed-contracts/index.mjs":{"sha":"a4be29318480ba5bc49a710f57058cdae8d994e5","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-002"},"packages/newsfeed-contracts/package.json":{"sha":"331c263ef3b32744d347c562e14486be54d8ce6f","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-002"},"scripts/governance/platform-source-hub-foundation.test.mjs":{"sha":"bb6eb6fcfc7465ed6b3b67fed4106ff155b51280","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Governance Source Layer","surfaceId":"SG2-BASE-020"}})})
function isPinnedNewsfeedSavedSearchReview(files){
 const r=NEWSFEED_SAVED_SEARCH_REVIEW
 return Array.isArray(files)&&files.length===Object.keys(r.entries).length&&new Set(files.map(f=>f?.filename)).size===files.length&&files.every(f=>Object.hasOwn(r.entries,f?.filename)&&r.entries[f.filename].sha===f.sha&&r.entries[f.filename].status===f.status&&!Object.hasOwn(f,'previous_filename'))
}
function assertNewsfeedSavedSearchRoutes(files,repositoryRoot){
 const profile=resolveProjectProfile('ARCHITECTURE',repositoryRoot),route=resolveProjectRouting({profile,targets:files.map(f=>f.filename),repositoryRoot})
 if(profile.repository.slug!==REPOSITORY||!route.ok||route.results.length!==files.length||route.results.some(r=>{const e=NEWSFEED_SAVED_SEARCH_REVIEW.entries[r.normalizedPath];return !e||r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.projectBoundaryStatus!=='ALLOWED'||r.baselineClassification!=='ALIGNED'||r.currentOwner!==e.owner||r.matchedSurfaceId!==e.surfaceId}))fail('NEWSFEED_SAVED_SEARCH_ROUTING_REJECTED')
}
export function assertNewsfeedSavedSearchReviewEntry(file,entry){
 const e=NEWSFEED_SAVED_SEARCH_REVIEW.entries[file?.filename]
 if(!e||e.sha!==file.sha||entry!==e.mode+' blob '+file.sha+'\t'+file.filename+'\0')fail('NEWSFEED_SAVED_SEARCH_FILE_MODE_REJECTED')
}


export const PRIVATE_RECURRING_REVIEW=Object.freeze({"prNumber":995,"branch":"architecture/pi-private-recurring-20261111","sourceSha":"a5e271a60f7faf0c0a97deea70c2e78665066824","baseSha":"c4e0b750c7e7f32f9ae07c4274b90fc06378ebd4","entries":{"apps/architecture-lab/ecr-stage03-sdk-compatibility.mjs":{"sha":"06ce3f2e647c725c5fc6599f883026441e2d413c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/private-recurring-source-adoption.json":{"sha":"d4b5c7206a996ea9849f3cda60640d03ff66a76e","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/private-recurring-source.json":{"sha":"b5a53d704b6b8fb624d880525ed702bcb0fbceb2","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/private-recurring-source.mjs":{"sha":"94eb0468f5a13e597c726bf48f7131b9d28fac30","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/test/payload-capture-publication.test.mjs":{"sha":"ddeef1baa75deb075366238cc95483de59e1484c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/test/private-recurring-source.test.mjs":{"sha":"fc036afe20dcacfe8e6b5b06ce34e039cfa17bd9","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/test/sdk-compatibility.test.mjs":{"sha":"9b3933ee9733caec34101d00b52f0852a74408eb","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/dashboard-preview/package-lock.json":{"sha":"93ab3c24ba1ab723d87523372011811aa319ab0c","status":"modified","mode":"100644","projectKey":"SG2","owner":"Dashboard Preview","surfaceId":"SG2-BASE-003"},"apps/economic-calendar-runtime/package-lock.json":{"sha":"195f6db5ca63ec6e71b8023b96060684400bd213","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ECR-BASE-001"},"apps/identity-runtime/package-lock.json":{"sha":"e26ebac4dcfec8fb8cf6e60ebcf64508b8ffb516","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/http-handler.ts":{"sha":"4a276645f7ea94b21ea215d57f097f574a1d1dc5","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/mailgun-delivery.ts":{"sha":"33bd6d5457e5e803383d4004498c59df86a2c897","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/main.ts":{"sha":"8e5dcbef5106a30ca184c2c1f25f423952b82a61","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/node-server.ts":{"sha":"9a47b9b85ebcaeeeb0645bb723bbe4e6abbc1a18","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/report-email.ts":{"sha":"8dd2134fb9b69c3462c3c35766ccbc5c8fd74048","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/test/report-email.test.mjs":{"sha":"cc3060f57502e9e8b10bca5afb55cbb71dbe3a97","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/insights-runtime/package-lock.json":{"sha":"521606dd28fd46c1c9a322134b9bf87401b80109","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/package.json":{"sha":"62f662780b873077bd0d61702b1c8d04022e2696","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/scripts/migrate-recurring.mjs":{"sha":"c64188d138e44efae9c27b99fac62dcd134e6a40","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/sql/004-recurring-subscriptions.sql":{"sha":"40f78a04aa326281b320206c2dee9ec73f360d87","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/sql/005-report-delivery.sql":{"sha":"73706c73e037cdac188e79cbca708bcd18845997","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/host.mjs":{"sha":"ba1a436aea76893955ec13a303b34e9911141f81","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/recurring.mjs":{"sha":"30455db78c6c682c0dad3862053d626ebabe6890","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/runner.mjs":{"sha":"1325404656478d8d412ca8f5dedb89375b6cacba","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/runtime.mjs":{"sha":"fb255e5151e6e4caba9ee6bed68a319733f9b5ad","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/store.mjs":{"sha":"a1299e8d9783175a8d9e25f4876ab6cd658695b5","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/subscription-api.mjs":{"sha":"5d9ef4c9482bb184193a28d294e600f57c46d8b6","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/subscription-store.mjs":{"sha":"80a1a3a32584a6f39b32aa376f3561ab65273939","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/subscriptions.mjs":{"sha":"fc49b98f2738b5c7ca2d2cc6315bad4d4ebbe0d5","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/tests/recurring-subscriptions.test.mjs":{"sha":"0768a8616562f7af2510442dd078b7516b4b4ab4","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/tests/report-delivery.test.mjs":{"sha":"075dc4879eacbe1248739745b5a5927f1590e444","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/maps-runtime/package-lock.json":{"sha":"a82d479021a99721da6672884bd99de16a045afa","status":"modified","mode":"100644","projectKey":"SRM","owner":"Maps Capability","surfaceId":"MAPS-BASE-001"},"apps/maps-runtime/test/embed.test.mjs":{"sha":"1a73025f8f4cd6150dbf9d70b0814f81376d7f98","status":"modified","mode":"100644","projectKey":"SRM","owner":"Maps Capability","surfaceId":"MAPS-BASE-001"},"apps/newsfeed-runtime/docs/private-recurring-development.pl.md":{"sha":"cc6e4ca37dfe731dd536a028f405a80de467c140","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/migrations/004-recurring-monitoring.sql":{"sha":"28afd09041fd19d500406f61f55ffe12610443b2","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/package-lock.json":{"sha":"13b28d62338d41c39cd2b4cd107ba85cb0c24922","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/package.json":{"sha":"5cf5625f5fee0d5325e9f4a4b2c184f577c1e571","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/scripts/migrate.mjs":{"sha":"9c26c6ebc510291a89f661a6103c5b9e39ca2394","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/config.mjs":{"sha":"51875a6a2d2a536de130ae2d8d0fe95512a489c6","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/main.mjs":{"sha":"dd97c81b0ce62625d3fab4ba777fed588a8da77a","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/recurring.mjs":{"sha":"5e708b25cd0ddc050b84b37643df5f34d2c154d1","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/repository.mjs":{"sha":"94a8527d5f6c6ba2cb63ded2c7cd52e38b9d5f15","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/server.mjs":{"sha":"85d4abdabdf90cfc7f860a4e76ea16301862c58d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/source-hub-client.mjs":{"sha":"ebc6c373ef41d20e863e2a33fd76e83af5d745cf","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/worker.mjs":{"sha":"5f03940652b27785681b8b447b11d63cfd744147","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/assistant-context.test.mjs":{"sha":"04da6e956c45e9a260c94733317c0c0f3ea2241e","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/recurring-monitoring.test.mjs":{"sha":"ba164b79ec59be143294ab3e054c4c810d6b9697","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/runtime.test.mjs":{"sha":"8632924417139f33250cd80b9c58b33fdc3ee534","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/package-limits/package-lock.json":{"sha":"8353d8f31e61bd7ee06c427da9445eb67d93032d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"LIMITS-BASE-001"},"apps/package-limits/scripts/ci-proof.mjs":{"sha":"fd57c38a3338742f9d5d2ce1abb3bdac6f8b5f58","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"LIMITS-BASE-001"},"apps/platform-source-hub/package-lock.json":{"sha":"064248be3464a70645a1bfdc28fd37b9384697b1","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/platform-source-hub/scripts/ci-routing.mjs":{"sha":"64df679abeebf328be9a64be99d6cb6f5caa67ea","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/platform-source-hub/test/ci-routing.test.mjs":{"sha":"9faea8c74f7846d54f713e49c28b2977548f0953","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/sg-runtime/components/appshell/appshell-dashboard.tsx":{"sha":"6378a598349af129bbdbab134d2e1046e1ce9197","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/appshell/assistant-conversation-transport.ts":{"sha":"bcf558ed2f12c63415bf4ee914d26426abfc5540","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/appshell/assistant-screen-context.ts":{"sha":"4533fc824ce8795b0f50d47c9b89f6d71af30f7f","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/procurement-insights/reports.tsx":{"sha":"73957f7cd070614d6bd45b02b14f56488c321524","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/procurement-insights/workspace.tsx":{"sha":"c42439aa07032f42328f9808699fb8aa7ffd773a","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/lib/assistant/context-selection.ts":{"sha":"f839ec1d5de93a84de78b20d85a54d918466ae72","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/lib/assistant/conversation.ts":{"sha":"261e17be03772ba6f72a7b77379b03ee197df0a2","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/lib/assistant/sources.ts":{"sha":"f1f3e029e4026ffa1506caea4374c9d6b6dc4a98","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/package-lock.json":{"sha":"8c3770dd408770c106dd2bfc2f081b0488a0c186","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/package.json":{"sha":"a555d89e9bdff0a41d843b82d68ff5390699433e","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/private-recurring-source-adoption.json":{"sha":"187d43b7486c73d04e075b8494a757e66a4799b0","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-integrity.mjs":{"sha":"3fd0dd1b4a7c8b93e3d54b223863e71715b70404","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs":{"sha":"41305f794c7bb7880ccbc62f56bdbdeea8e7d74f","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/operation-context.test.mjs":{"sha":"06a8c39bfa1afa2f5e6fd6c6df72656d01bd2885","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/procurement-insights-context.test.ts":{"sha":"5e26f4549f62987f66a99102415ed6d01e430fc5","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/srm/app/login/porr-account.tsx":{"sha":"b03bfe713ff0764c921ab0af93ded7e86f48a4b1","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/deployment/root-atomic-claim-targets.json":{"sha":"e397d0be2270dc43c7e4f6b77a5c66526098884b","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/package-lock.json":{"sha":"620220c9b573cef4cb4a17e2cbc4934af5350711","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/private-recurring-source-adoption.json":{"sha":"b2141e1ed65723c9c560a636ccee86df182d6731","status":"added","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs":{"sha":"05e0853c43c1de30b645545390969faabb589cc0","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/native-execution-adoption.test.mjs":{"sha":"af1634d11e2aa36605a29821c4940f7b3cb0b31e","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/operation-context.test.mjs":{"sha":"95107d19eda0b81357f1998d0a56b28f0dd39ee0","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/private-host.integration.test.mjs":{"sha":"3b56be0d61387092a592e01c8edde0c2800e5c0d","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/request-quota-adoption.test.mjs":{"sha":"1cef3840e3bd0aa08f778dce90bbe78778a64060","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/supplier-location-admission.integration.test.mjs":{"sha":"c352c2c7e993fd250d66f6bdc4c3b5fef260dca4","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/xray-performance-adoption.test.mjs":{"sha":"d246f127efef56b9dd2d2355bae70d949e0a087d","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/root-atomic-claim-adoption.test.ts":{"sha":"810585b901bdf2e2a208c604ac1643df44812c88","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"packages/assistant-context-contracts/package.json":{"sha":"9fb71786772aea04e7fea2a2f05631fa520327c7","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-contracts/src/index.d.mts":{"sha":"6434db655b84dc92d6e8d717eca524a535795a88","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-contracts/src/index.mjs":{"sha":"a9e5d0209f433301ab931f94c14085f199d3c443","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-contracts/test/procurement-insights.test.mjs":{"sha":"9ffa62fbe36afc6c06a4feae011c8f71989a5128","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-gateway/package.json":{"sha":"7fabf516cbe8b0ae85c7af73dadd1526fbe16a52","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/src/index.d.mts":{"sha":"e3e7da3038dcaed4da0e3cd2b10610a7b06fa9de","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/src/index.mjs":{"sha":"91d8d762026d6b15e395a67987e8d1189ac61cec","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/src/multi-source.mjs":{"sha":"172d816248a08bfc6c57a754cf96a2f0f0f2d60d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/test/procurement-insights.test.mjs":{"sha":"8a498950c07f3f41fce93c4c4e1e86a5fe79d576","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/maps-embed/package.json":{"sha":"57293ced3e09534099ce516735752bb050c18318","status":"modified","mode":"100644","projectKey":"SRM","owner":"Maps Capability","surfaceId":"MAPS-BASE-003"},"packages/platform-contracts/current-e1-authority/index.d.mts":{"sha":"576f6ef868201184f69fce938ad2d74ff48f1731","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/index.mjs":{"sha":"1ccc923c12d686e0382678a644e93f97da833927","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/install-recurring.mjs":{"sha":"d58430ad8915ff6b8f4a63fe1896e045449ee4b3","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/migrations/012-recurring-authority.sql":{"sha":"eb00141c5b9b4254b975d18eaa9fca3b19740e43","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/migrations/013-recurring-receiver.sql":{"sha":"5d65f9efacd1c71a02ebe6220ab578012ac9c89f","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/migrations/014-recurring-delivery.sql":{"sha":"d03eaa0eb252a8624f234baa1075c33311dccaeb","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/package-lock.json":{"sha":"f2cf78d602012a2a5ab8b6f0705bb35546cec58b","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/package.json":{"sha":"5f1f9d4b9a9956df9449f49222e2c3ab034117f1","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/recurring.d.mts":{"sha":"023b9765caaabdf1dc7dd41c988c17d8389c82d8","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/recurring.mjs":{"sha":"0be0b3fef08fe5b34fe693b8e6aa76a184deea12","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-fresh-report/package.json":{"sha":"94f0e8b538ad670680307f4a2cf8932fd14146fb","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs":{"sha":"57770978b257de32ba6c5017c7b6a2cb98653201","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/package-lock.json":{"sha":"d493bb030166e87c6ae280c9d7adcd0ed6f18f14","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/package.json":{"sha":"3ea9875e1ba89f3f728452bf66d4cf090be36b31","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/payload-capture/package.json":{"sha":"ba68ef20409fa384472f572bad3440a88a650bb4","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/payload-capture/test/public-package.test.mjs":{"sha":"16eddc9619c7709c715bcbbfa0429675ec029c1b","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/readonly-miss-report/package.json":{"sha":"6bfa2d9014bf59034f491b3552a80022b82f068a","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs":{"sha":"6305ac3b67d15c0288d60f06e77379b7ee855474","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/root-atomic-claim/package.json":{"sha":"6b12b955b2018a4d2e09558a3156fed01608874a","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs":{"sha":"e8c32ecf64024bdb67303e5baa0547f1679dbc50","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.d.mts":{"sha":"fd26f243357cff3b2f92b2ca9aec132e47d449cc","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.mjs":{"sha":"d2e8f7f30704defbeeb3570d99280b5d1c2504d0","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/recurring-job.d.mts":{"sha":"6a54d9e945df97bc0133dd13c286161e4915bfde","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/recurring-job.mjs":{"sha":"9b81938e75b86954a75a46e23ae58695c78dd3ca","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/private-operation-host.test.mjs":{"sha":"f3cafb24b4938571072bf07832420d6e22ebedb9","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/recurring-current-e1.test.mjs":{"sha":"ec82aac43c6dec98dacead70d677f0868a0bd45c","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/recurring-job.test.mjs":{"sha":"cbc303d369a08352a088c67882f77dae215398b1","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-source-hub-contracts/package.json":{"sha":"1bd8785e7f20e7a315a4f2f21547363d32a8782e","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-002"},"scripts/governance/platform-source-hub-foundation.test.mjs":{"sha":"da3643ca7b03ed36a7c434df2b8f5d0bc0d6adf6","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Governance Source Layer","surfaceId":"SG2-BASE-020"}}})
export const PRIVATE_RECURRING_FINAL_REVIEW=Object.freeze({"prNumber":995,"branch":"architecture/pi-private-recurring-20261111","sourceSha":"c48bc060ad6dd2d2ba51e198d9a29a33d4d22030","baseSha":"73be66880ffe28d26dd51610b09a8e6c38946220","entries":{"apps/architecture-lab/ecr-stage03-sdk-compatibility.mjs":{"sha":"06ce3f2e647c725c5fc6599f883026441e2d413c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/private-recurring-source-adoption.json":{"sha":"040e2540580a73f2f6273baf07ff1674b6e4014a","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/private-recurring-source.json":{"sha":"87880b989b000cd7198f94357002f2088f623001","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/private-recurring-source.mjs":{"sha":"492d5ef245b50bb709bd6ab7300013be8f88b6ce","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/test/payload-capture-publication.test.mjs":{"sha":"ddeef1baa75deb075366238cc95483de59e1484c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/test/private-recurring-source.test.mjs":{"sha":"fc036afe20dcacfe8e6b5b06ce34e039cfa17bd9","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/test/sdk-compatibility.test.mjs":{"sha":"9b3933ee9733caec34101d00b52f0852a74408eb","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/dashboard-preview/package-lock.json":{"sha":"93ab3c24ba1ab723d87523372011811aa319ab0c","status":"modified","mode":"100644","projectKey":"SG2","owner":"Dashboard Preview","surfaceId":"SG2-BASE-003"},"apps/economic-calendar-runtime/package-lock.json":{"sha":"195f6db5ca63ec6e71b8023b96060684400bd213","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ECR-BASE-001"},"apps/identity-runtime/package-lock.json":{"sha":"e26ebac4dcfec8fb8cf6e60ebcf64508b8ffb516","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/http-handler.ts":{"sha":"4a276645f7ea94b21ea215d57f097f574a1d1dc5","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/mailgun-delivery.ts":{"sha":"33bd6d5457e5e803383d4004498c59df86a2c897","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/main.ts":{"sha":"8e5dcbef5106a30ca184c2c1f25f423952b82a61","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/node-server.ts":{"sha":"9a47b9b85ebcaeeeb0645bb723bbe4e6abbc1a18","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/report-email.ts":{"sha":"8dd2134fb9b69c3462c3c35766ccbc5c8fd74048","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/test/report-email.test.mjs":{"sha":"cc3060f57502e9e8b10bca5afb55cbb71dbe3a97","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/insights-runtime/package-lock.json":{"sha":"521606dd28fd46c1c9a322134b9bf87401b80109","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/package.json":{"sha":"62f662780b873077bd0d61702b1c8d04022e2696","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/scripts/migrate-recurring.mjs":{"sha":"c64188d138e44efae9c27b99fac62dcd134e6a40","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/sql/004-recurring-subscriptions.sql":{"sha":"40f78a04aa326281b320206c2dee9ec73f360d87","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/sql/005-report-delivery.sql":{"sha":"73706c73e037cdac188e79cbca708bcd18845997","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/host.mjs":{"sha":"ba1a436aea76893955ec13a303b34e9911141f81","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/recurring.mjs":{"sha":"30455db78c6c682c0dad3862053d626ebabe6890","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/runner.mjs":{"sha":"1325404656478d8d412ca8f5dedb89375b6cacba","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/runtime.mjs":{"sha":"fb255e5151e6e4caba9ee6bed68a319733f9b5ad","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/store.mjs":{"sha":"a1299e8d9783175a8d9e25f4876ab6cd658695b5","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/subscription-api.mjs":{"sha":"5d9ef4c9482bb184193a28d294e600f57c46d8b6","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/subscription-store.mjs":{"sha":"80a1a3a32584a6f39b32aa376f3561ab65273939","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/subscriptions.mjs":{"sha":"fc49b98f2738b5c7ca2d2cc6315bad4d4ebbe0d5","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/tests/recurring-subscriptions.test.mjs":{"sha":"0768a8616562f7af2510442dd078b7516b4b4ab4","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/tests/report-delivery.test.mjs":{"sha":"075dc4879eacbe1248739745b5a5927f1590e444","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/maps-runtime/package-lock.json":{"sha":"a82d479021a99721da6672884bd99de16a045afa","status":"modified","mode":"100644","projectKey":"SRM","owner":"Maps Capability","surfaceId":"MAPS-BASE-001"},"apps/maps-runtime/test/embed.test.mjs":{"sha":"1a73025f8f4cd6150dbf9d70b0814f81376d7f98","status":"modified","mode":"100644","projectKey":"SRM","owner":"Maps Capability","surfaceId":"MAPS-BASE-001"},"apps/newsfeed-runtime/docs/private-recurring-development.pl.md":{"sha":"cc6e4ca37dfe731dd536a028f405a80de467c140","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/migrations/004-recurring-monitoring.sql":{"sha":"28afd09041fd19d500406f61f55ffe12610443b2","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/package-lock.json":{"sha":"13b28d62338d41c39cd2b4cd107ba85cb0c24922","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/package.json":{"sha":"5cf5625f5fee0d5325e9f4a4b2c184f577c1e571","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/scripts/migrate.mjs":{"sha":"9c26c6ebc510291a89f661a6103c5b9e39ca2394","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/config.mjs":{"sha":"51875a6a2d2a536de130ae2d8d0fe95512a489c6","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/main.mjs":{"sha":"dd97c81b0ce62625d3fab4ba777fed588a8da77a","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/recurring.mjs":{"sha":"5e708b25cd0ddc050b84b37643df5f34d2c154d1","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/repository.mjs":{"sha":"94a8527d5f6c6ba2cb63ded2c7cd52e38b9d5f15","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/server.mjs":{"sha":"85d4abdabdf90cfc7f860a4e76ea16301862c58d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/source-hub-client.mjs":{"sha":"ebc6c373ef41d20e863e2a33fd76e83af5d745cf","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/worker.mjs":{"sha":"5f03940652b27785681b8b447b11d63cfd744147","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/assistant-context.test.mjs":{"sha":"04da6e956c45e9a260c94733317c0c0f3ea2241e","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/recurring-monitoring.test.mjs":{"sha":"ba164b79ec59be143294ab3e054c4c810d6b9697","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/runtime.test.mjs":{"sha":"8632924417139f33250cd80b9c58b33fdc3ee534","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/package-limits/package-lock.json":{"sha":"8353d8f31e61bd7ee06c427da9445eb67d93032d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"LIMITS-BASE-001"},"apps/package-limits/scripts/ci-proof.mjs":{"sha":"fd57c38a3338742f9d5d2ce1abb3bdac6f8b5f58","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"LIMITS-BASE-001"},"apps/platform-source-hub/package-lock.json":{"sha":"064248be3464a70645a1bfdc28fd37b9384697b1","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/platform-source-hub/scripts/ci-routing.mjs":{"sha":"64df679abeebf328be9a64be99d6cb6f5caa67ea","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/platform-source-hub/test/ci-routing.test.mjs":{"sha":"9faea8c74f7846d54f713e49c28b2977548f0953","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/sg-runtime/components/appshell/appshell-dashboard.tsx":{"sha":"6378a598349af129bbdbab134d2e1046e1ce9197","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/appshell/assistant-conversation-transport.ts":{"sha":"bcf558ed2f12c63415bf4ee914d26426abfc5540","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/appshell/assistant-screen-context.ts":{"sha":"4533fc824ce8795b0f50d47c9b89f6d71af30f7f","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/procurement-insights/reports.tsx":{"sha":"73957f7cd070614d6bd45b02b14f56488c321524","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/procurement-insights/workspace.tsx":{"sha":"c42439aa07032f42328f9808699fb8aa7ffd773a","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/lib/assistant/context-selection.ts":{"sha":"f839ec1d5de93a84de78b20d85a54d918466ae72","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/lib/assistant/conversation.ts":{"sha":"261e17be03772ba6f72a7b77379b03ee197df0a2","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/lib/assistant/sources.ts":{"sha":"f1f3e029e4026ffa1506caea4374c9d6b6dc4a98","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/package-lock.json":{"sha":"8c3770dd408770c106dd2bfc2f081b0488a0c186","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/package.json":{"sha":"a555d89e9bdff0a41d843b82d68ff5390699433e","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/private-recurring-source-adoption.json":{"sha":"f4ea393ee88150a3778712b30d48a90a29763ff7","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-integrity.mjs":{"sha":"3fd0dd1b4a7c8b93e3d54b223863e71715b70404","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs":{"sha":"41305f794c7bb7880ccbc62f56bdbdeea8e7d74f","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs":{"sha":"1824fcf2a5ec6a0d31643d1512102839d7762d3d","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/native-sql-roundtrips.test.mjs":{"sha":"118179e6ce49c0f0c08464d727037ea6404b94f6","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/operation-context.test.mjs":{"sha":"06a8c39bfa1afa2f5e6fd6c6df72656d01bd2885","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/pci-smart-integrity.test.mjs":{"sha":"3688578e99b260886971389b2eea811d057c2049","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/private-host.integration.test.mjs":{"sha":"d52015941accedbe16a0c6fe60f8184ea8b30768","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/procurement-insights-context.test.ts":{"sha":"5e26f4549f62987f66a99102415ed6d01e430fc5","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/srm/app/login/porr-account.tsx":{"sha":"b03bfe713ff0764c921ab0af93ded7e86f48a4b1","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/deployment/root-atomic-claim-targets.json":{"sha":"e397d0be2270dc43c7e4f6b77a5c66526098884b","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/package-lock.json":{"sha":"620220c9b573cef4cb4a17e2cbc4934af5350711","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/private-recurring-source-adoption.json":{"sha":"6277568ef90494c8946b296d520f9f2e0b9d0c66","status":"added","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs":{"sha":"05e0853c43c1de30b645545390969faabb589cc0","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/native-execution-adoption.test.mjs":{"sha":"af1634d11e2aa36605a29821c4940f7b3cb0b31e","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/operation-context.test.mjs":{"sha":"95107d19eda0b81357f1998d0a56b28f0dd39ee0","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/private-host.integration.test.mjs":{"sha":"3b56be0d61387092a592e01c8edde0c2800e5c0d","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/request-quota-adoption.test.mjs":{"sha":"1cef3840e3bd0aa08f778dce90bbe78778a64060","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/supplier-location-admission.integration.test.mjs":{"sha":"c352c2c7e993fd250d66f6bdc4c3b5fef260dca4","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/xray-performance-adoption.test.mjs":{"sha":"d246f127efef56b9dd2d2355bae70d949e0a087d","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/root-atomic-claim-adoption.test.ts":{"sha":"810585b901bdf2e2a208c604ac1643df44812c88","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"packages/assistant-context-contracts/package.json":{"sha":"9fb71786772aea04e7fea2a2f05631fa520327c7","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-contracts/src/index.d.mts":{"sha":"6434db655b84dc92d6e8d717eca524a535795a88","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-contracts/src/index.mjs":{"sha":"a9e5d0209f433301ab931f94c14085f199d3c443","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-contracts/test/procurement-insights.test.mjs":{"sha":"9ffa62fbe36afc6c06a4feae011c8f71989a5128","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-gateway/package.json":{"sha":"7fabf516cbe8b0ae85c7af73dadd1526fbe16a52","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/src/index.d.mts":{"sha":"e3e7da3038dcaed4da0e3cd2b10610a7b06fa9de","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/src/index.mjs":{"sha":"91d8d762026d6b15e395a67987e8d1189ac61cec","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/src/multi-source.mjs":{"sha":"172d816248a08bfc6c57a754cf96a2f0f0f2d60d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/test/procurement-insights.test.mjs":{"sha":"8a498950c07f3f41fce93c4c4e1e86a5fe79d576","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/maps-embed/package.json":{"sha":"57293ced3e09534099ce516735752bb050c18318","status":"modified","mode":"100644","projectKey":"SRM","owner":"Maps Capability","surfaceId":"MAPS-BASE-003"},"packages/platform-contracts/current-e1-authority/index.d.mts":{"sha":"576f6ef868201184f69fce938ad2d74ff48f1731","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/index.mjs":{"sha":"1ccc923c12d686e0382678a644e93f97da833927","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/install-recurring.mjs":{"sha":"d58430ad8915ff6b8f4a63fe1896e045449ee4b3","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/migrations/012-recurring-authority.sql":{"sha":"eb00141c5b9b4254b975d18eaa9fca3b19740e43","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/migrations/013-recurring-receiver.sql":{"sha":"5d65f9efacd1c71a02ebe6220ab578012ac9c89f","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/migrations/014-recurring-delivery.sql":{"sha":"d03eaa0eb252a8624f234baa1075c33311dccaeb","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/package-lock.json":{"sha":"f2cf78d602012a2a5ab8b6f0705bb35546cec58b","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/package.json":{"sha":"5f1f9d4b9a9956df9449f49222e2c3ab034117f1","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/recurring.d.mts":{"sha":"023b9765caaabdf1dc7dd41c988c17d8389c82d8","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/recurring.mjs":{"sha":"0be0b3fef08fe5b34fe693b8e6aa76a184deea12","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-fresh-report/package.json":{"sha":"94f0e8b538ad670680307f4a2cf8932fd14146fb","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs":{"sha":"57770978b257de32ba6c5017c7b6a2cb98653201","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/package-lock.json":{"sha":"d493bb030166e87c6ae280c9d7adcd0ed6f18f14","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/package.json":{"sha":"3ea9875e1ba89f3f728452bf66d4cf090be36b31","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/payload-capture/package.json":{"sha":"ba68ef20409fa384472f572bad3440a88a650bb4","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/payload-capture/test/public-package.test.mjs":{"sha":"16eddc9619c7709c715bcbbfa0429675ec029c1b","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/readonly-miss-report/package.json":{"sha":"6bfa2d9014bf59034f491b3552a80022b82f068a","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs":{"sha":"6305ac3b67d15c0288d60f06e77379b7ee855474","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/root-atomic-claim/package.json":{"sha":"6b12b955b2018a4d2e09558a3156fed01608874a","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs":{"sha":"e8c32ecf64024bdb67303e5baa0547f1679dbc50","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.d.mts":{"sha":"fd26f243357cff3b2f92b2ca9aec132e47d449cc","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.mjs":{"sha":"d2e8f7f30704defbeeb3570d99280b5d1c2504d0","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/recurring-job.d.mts":{"sha":"6a54d9e945df97bc0133dd13c286161e4915bfde","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/recurring-job.mjs":{"sha":"9b81938e75b86954a75a46e23ae58695c78dd3ca","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/private-operation-host.test.mjs":{"sha":"f3cafb24b4938571072bf07832420d6e22ebedb9","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/recurring-current-e1.test.mjs":{"sha":"ec82aac43c6dec98dacead70d677f0868a0bd45c","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/recurring-job.test.mjs":{"sha":"cbc303d369a08352a088c67882f77dae215398b1","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-source-hub-contracts/package.json":{"sha":"1bd8785e7f20e7a315a4f2f21547363d32a8782e","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-002"},"scripts/governance/platform-source-hub-foundation.test.mjs":{"sha":"da3643ca7b03ed36a7c434df2b8f5d0bc0d6adf6","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Governance Source Layer","surfaceId":"SG2-BASE-020"}}})

export const PRIVATE_RECURRING_COMPLETION_REVIEW=Object.freeze({"prNumber":995,"branch":"architecture/pi-private-recurring-20261111","sourceSha":"710ca9054870cf3c7ec007bfa3e253ab01d5e831","baseSha":"1abc68e248334fbdf03d1741561158fde020a27b","entries":{"apps/architecture-lab/ecr-stage03-sdk-compatibility.mjs":{"sha":"06ce3f2e647c725c5fc6599f883026441e2d413c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/private-recurring-source-adoption.json":{"sha":"beb919308fe750ada314db7e902e27a8ee343dff","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/private-recurring-source.json":{"sha":"da5f241857d12086fdf005e5cc7dca06a1f3f5c3","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/private-recurring-source.mjs":{"sha":"4a89d0394c1a8dec1d7955d17637911e0665f276","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/test/payload-capture-publication.test.mjs":{"sha":"ddeef1baa75deb075366238cc95483de59e1484c","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/test/private-recurring-source.test.mjs":{"sha":"fc036afe20dcacfe8e6b5b06ce34e039cfa17bd9","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/architecture-lab/test/sdk-compatibility.test.mjs":{"sha":"9b3933ee9733caec34101d00b52f0852a74408eb","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-002"},"apps/dashboard-preview/package-lock.json":{"sha":"93ab3c24ba1ab723d87523372011811aa319ab0c","status":"modified","mode":"100644","projectKey":"SG2","owner":"Dashboard Preview","surfaceId":"SG2-BASE-003"},"apps/economic-calendar-runtime/package-lock.json":{"sha":"195f6db5ca63ec6e71b8023b96060684400bd213","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ECR-BASE-001"},"apps/identity-runtime/package-lock.json":{"sha":"e26ebac4dcfec8fb8cf6e60ebcf64508b8ffb516","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/http-handler.ts":{"sha":"4a276645f7ea94b21ea215d57f097f574a1d1dc5","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/mailgun-delivery.ts":{"sha":"33bd6d5457e5e803383d4004498c59df86a2c897","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/main.ts":{"sha":"8e5dcbef5106a30ca184c2c1f25f423952b82a61","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/node-server.ts":{"sha":"9a47b9b85ebcaeeeb0645bb723bbe4e6abbc1a18","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/src/report-email.ts":{"sha":"8dd2134fb9b69c3462c3c35766ccbc5c8fd74048","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/identity-runtime/test/report-email.test.mjs":{"sha":"cc3060f57502e9e8b10bca5afb55cbb71dbe3a97","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"IDENTITY-BASE-001"},"apps/insights-runtime/package-lock.json":{"sha":"521606dd28fd46c1c9a322134b9bf87401b80109","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/package.json":{"sha":"62f662780b873077bd0d61702b1c8d04022e2696","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/scripts/migrate-recurring.mjs":{"sha":"c64188d138e44efae9c27b99fac62dcd134e6a40","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/sql/004-recurring-subscriptions.sql":{"sha":"40f78a04aa326281b320206c2dee9ec73f360d87","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/sql/005-report-delivery.sql":{"sha":"73706c73e037cdac188e79cbca708bcd18845997","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/host.mjs":{"sha":"ba1a436aea76893955ec13a303b34e9911141f81","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/recurring.mjs":{"sha":"30455db78c6c682c0dad3862053d626ebabe6890","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/runner.mjs":{"sha":"1325404656478d8d412ca8f5dedb89375b6cacba","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/runtime.mjs":{"sha":"fb255e5151e6e4caba9ee6bed68a319733f9b5ad","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/store.mjs":{"sha":"a1299e8d9783175a8d9e25f4876ab6cd658695b5","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/subscription-api.mjs":{"sha":"5d9ef4c9482bb184193a28d294e600f57c46d8b6","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/subscription-store.mjs":{"sha":"80a1a3a32584a6f39b32aa376f3561ab65273939","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/src/subscriptions.mjs":{"sha":"fc49b98f2738b5c7ca2d2cc6315bad4d4ebbe0d5","status":"modified","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/tests/recurring-subscriptions.test.mjs":{"sha":"0768a8616562f7af2510442dd078b7516b4b4ab4","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/insights-runtime/tests/report-delivery.test.mjs":{"sha":"075dc4879eacbe1248739745b5a5927f1590e444","status":"added","mode":"100644","projectKey":"SG2","owner":"Insights Domain","surfaceId":"INSIGHTS-BASE-001"},"apps/maps-runtime/package-lock.json":{"sha":"a82d479021a99721da6672884bd99de16a045afa","status":"modified","mode":"100644","projectKey":"SRM","owner":"Maps Capability","surfaceId":"MAPS-BASE-001"},"apps/maps-runtime/test/embed.test.mjs":{"sha":"1a73025f8f4cd6150dbf9d70b0814f81376d7f98","status":"modified","mode":"100644","projectKey":"SRM","owner":"Maps Capability","surfaceId":"MAPS-BASE-001"},"apps/newsfeed-runtime/docs/private-recurring-development.pl.md":{"sha":"cc6e4ca37dfe731dd536a028f405a80de467c140","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/migrations/004-recurring-monitoring.sql":{"sha":"28afd09041fd19d500406f61f55ffe12610443b2","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/package-lock.json":{"sha":"13b28d62338d41c39cd2b4cd107ba85cb0c24922","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/package.json":{"sha":"5cf5625f5fee0d5325e9f4a4b2c184f577c1e571","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/scripts/migrate.mjs":{"sha":"9c26c6ebc510291a89f661a6103c5b9e39ca2394","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/config.mjs":{"sha":"51875a6a2d2a536de130ae2d8d0fe95512a489c6","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/main.mjs":{"sha":"dd97c81b0ce62625d3fab4ba777fed588a8da77a","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/recurring.mjs":{"sha":"5e708b25cd0ddc050b84b37643df5f34d2c154d1","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/repository.mjs":{"sha":"94a8527d5f6c6ba2cb63ded2c7cd52e38b9d5f15","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/server.mjs":{"sha":"85d4abdabdf90cfc7f860a4e76ea16301862c58d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/source-hub-client.mjs":{"sha":"ebc6c373ef41d20e863e2a33fd76e83af5d745cf","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/src/worker.mjs":{"sha":"5f03940652b27785681b8b447b11d63cfd744147","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/assistant-context.test.mjs":{"sha":"04da6e956c45e9a260c94733317c0c0f3ea2241e","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/recurring-monitoring.test.mjs":{"sha":"ba164b79ec59be143294ab3e054c4c810d6b9697","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/newsfeed-runtime/test/runtime.test.mjs":{"sha":"8632924417139f33250cd80b9c58b33fdc3ee534","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"NEWSFEED-BASE-001"},"apps/package-limits/package-lock.json":{"sha":"8353d8f31e61bd7ee06c427da9445eb67d93032d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"LIMITS-BASE-001"},"apps/package-limits/scripts/ci-proof.mjs":{"sha":"fd57c38a3338742f9d5d2ce1abb3bdac6f8b5f58","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"LIMITS-BASE-001"},"apps/platform-source-hub/package-lock.json":{"sha":"064248be3464a70645a1bfdc28fd37b9384697b1","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/platform-source-hub/scripts/ci-routing.mjs":{"sha":"64df679abeebf328be9a64be99d6cb6f5caa67ea","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/platform-source-hub/test/ci-routing.test.mjs":{"sha":"9faea8c74f7846d54f713e49c28b2977548f0953","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-001"},"apps/sg-runtime/components/appshell/appshell-dashboard.tsx":{"sha":"6378a598349af129bbdbab134d2e1046e1ce9197","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/appshell/assistant-conversation-transport.ts":{"sha":"bcf558ed2f12c63415bf4ee914d26426abfc5540","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/appshell/assistant-screen-context.ts":{"sha":"4533fc824ce8795b0f50d47c9b89f6d71af30f7f","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/procurement-insights/reports.tsx":{"sha":"73957f7cd070614d6bd45b02b14f56488c321524","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/components/procurement-insights/workspace.tsx":{"sha":"c42439aa07032f42328f9808699fb8aa7ffd773a","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/lib/assistant/context-selection.ts":{"sha":"f839ec1d5de93a84de78b20d85a54d918466ae72","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/lib/assistant/conversation.ts":{"sha":"261e17be03772ba6f72a7b77379b03ee197df0a2","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/lib/assistant/sources.ts":{"sha":"f1f3e029e4026ffa1506caea4374c9d6b6dc4a98","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/package-lock.json":{"sha":"8c3770dd408770c106dd2bfc2f081b0488a0c186","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/package.json":{"sha":"a555d89e9bdff0a41d843b82d68ff5390699433e","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/private-recurring-source-adoption.json":{"sha":"0ca0b2fea217c8ed5cfc28d992701225f783779e","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-integrity.mjs":{"sha":"3fd0dd1b4a7c8b93e3d54b223863e71715b70404","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs":{"sha":"41305f794c7bb7880ccbc62f56bdbdeea8e7d74f","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs":{"sha":"1824fcf2a5ec6a0d31643d1512102839d7762d3d","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/native-sql-roundtrips.test.mjs":{"sha":"118179e6ce49c0f0c08464d727037ea6404b94f6","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/operation-context.test.mjs":{"sha":"06a8c39bfa1afa2f5e6fd6c6df72656d01bd2885","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/pci-smart-integrity.test.mjs":{"sha":"3688578e99b260886971389b2eea811d057c2049","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/private-host.integration.test.mjs":{"sha":"d52015941accedbe16a0c6fe60f8184ea8b30768","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/procurement-insights-context.test.ts":{"sha":"5e26f4549f62987f66a99102415ed6d01e430fc5","status":"added","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs":{"sha":"e00c15aaeabf4bc5fa89d94d48768d921898a858","status":"modified","mode":"100644","projectKey":"SG2","owner":"SG Runtime","surfaceId":"SG2-BASE-001"},"apps/srm/app/login/porr-account.tsx":{"sha":"b03bfe713ff0764c921ab0af93ded7e86f48a4b1","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/deployment/root-atomic-claim-targets.json":{"sha":"e397d0be2270dc43c7e4f6b77a5c66526098884b","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/package-lock.json":{"sha":"620220c9b573cef4cb4a17e2cbc4934af5350711","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/private-recurring-source-adoption.json":{"sha":"1a4490b95301561e070f3a2a8b344a9259b1ba52","status":"added","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs":{"sha":"05e0853c43c1de30b645545390969faabb589cc0","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/native-execution-adoption.test.mjs":{"sha":"af1634d11e2aa36605a29821c4940f7b3cb0b31e","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/operation-context.test.mjs":{"sha":"95107d19eda0b81357f1998d0a56b28f0dd39ee0","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/private-host.integration.test.mjs":{"sha":"3b56be0d61387092a592e01c8edde0c2800e5c0d","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/request-quota-adoption.test.mjs":{"sha":"1cef3840e3bd0aa08f778dce90bbe78778a64060","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/supplier-location-admission.integration.test.mjs":{"sha":"c352c2c7e993fd250d66f6bdc4c3b5fef260dca4","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/scripts/xray-performance-adoption.test.mjs":{"sha":"d246f127efef56b9dd2d2355bae70d949e0a087d","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"apps/srm/src/server/root-atomic-claim-adoption.test.ts":{"sha":"810585b901bdf2e2a208c604ac1643df44812c88","status":"modified","mode":"100644","projectKey":"SRM","owner":"SRM Runtime","surfaceId":"SG2-BASE-016"},"packages/assistant-context-contracts/package.json":{"sha":"9fb71786772aea04e7fea2a2f05631fa520327c7","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-contracts/src/index.d.mts":{"sha":"6434db655b84dc92d6e8d717eca524a535795a88","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-contracts/src/index.mjs":{"sha":"a9e5d0209f433301ab931f94c14085f199d3c443","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-contracts/test/procurement-insights.test.mjs":{"sha":"9ffa62fbe36afc6c06a4feae011c8f71989a5128","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-001"},"packages/assistant-context-gateway/package.json":{"sha":"7fabf516cbe8b0ae85c7af73dadd1526fbe16a52","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/src/index.d.mts":{"sha":"e3e7da3038dcaed4da0e3cd2b10610a7b06fa9de","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/src/index.mjs":{"sha":"91d8d762026d6b15e395a67987e8d1189ac61cec","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/src/multi-source.mjs":{"sha":"172d816248a08bfc6c57a754cf96a2f0f0f2d60d","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/assistant-context-gateway/test/procurement-insights.test.mjs":{"sha":"8a498950c07f3f41fce93c4c4e1e86a5fe79d576","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ACG-BASE-002"},"packages/maps-embed/package.json":{"sha":"57293ced3e09534099ce516735752bb050c18318","status":"modified","mode":"100644","projectKey":"SRM","owner":"Maps Capability","surfaceId":"MAPS-BASE-003"},"packages/platform-contracts/current-e1-authority/index.d.mts":{"sha":"576f6ef868201184f69fce938ad2d74ff48f1731","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/index.mjs":{"sha":"1ccc923c12d686e0382678a644e93f97da833927","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/install-recurring.mjs":{"sha":"d58430ad8915ff6b8f4a63fe1896e045449ee4b3","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/migrations/012-recurring-authority.sql":{"sha":"eb00141c5b9b4254b975d18eaa9fca3b19740e43","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/migrations/013-recurring-receiver.sql":{"sha":"5d65f9efacd1c71a02ebe6220ab578012ac9c89f","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/migrations/014-recurring-delivery.sql":{"sha":"d03eaa0eb252a8624f234baa1075c33311dccaeb","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/package-lock.json":{"sha":"f2cf78d602012a2a5ab8b6f0705bb35546cec58b","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/package.json":{"sha":"5f1f9d4b9a9956df9449f49222e2c3ab034117f1","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/recurring.d.mts":{"sha":"023b9765caaabdf1dc7dd41c988c17d8389c82d8","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-e1-authority/recurring.mjs":{"sha":"0be0b3fef08fe5b34fe693b8e6aa76a184deea12","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-fresh-report/package.json":{"sha":"94f0e8b538ad670680307f4a2cf8932fd14146fb","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs":{"sha":"57770978b257de32ba6c5017c7b6a2cb98653201","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/package-lock.json":{"sha":"d493bb030166e87c6ae280c9d7adcd0ed6f18f14","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/package.json":{"sha":"3ea9875e1ba89f3f728452bf66d4cf090be36b31","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/payload-capture/package.json":{"sha":"ba68ef20409fa384472f572bad3440a88a650bb4","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/payload-capture/test/public-package.test.mjs":{"sha":"16eddc9619c7709c715bcbbfa0429675ec029c1b","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/readonly-miss-report/package.json":{"sha":"6bfa2d9014bf59034f491b3552a80022b82f068a","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs":{"sha":"6305ac3b67d15c0288d60f06e77379b7ee855474","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/root-atomic-claim/package.json":{"sha":"6b12b955b2018a4d2e09558a3156fed01608874a","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/root-atomic-claim/test/root-atomic-claim.test.mjs":{"sha":"e8c32ecf64024bdb67303e5baa0547f1679dbc50","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.d.mts":{"sha":"fd26f243357cff3b2f92b2ca9aec132e47d449cc","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/operation-context.mjs":{"sha":"d2e8f7f30704defbeeb3570d99280b5d1c2504d0","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/recurring-job.d.mts":{"sha":"6a54d9e945df97bc0133dd13c286161e4915bfde","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/src/recurring-job.mjs":{"sha":"9b81938e75b86954a75a46e23ae58695c78dd3ca","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/private-operation-host.test.mjs":{"sha":"f3cafb24b4938571072bf07832420d6e22ebedb9","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/recurring-current-e1.test.mjs":{"sha":"ec82aac43c6dec98dacead70d677f0868a0bd45c","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-contracts/test/recurring-job.test.mjs":{"sha":"cbc303d369a08352a088c67882f77dae215398b1","status":"added","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"ARCH-BASE-001"},"packages/platform-source-hub-contracts/package.json":{"sha":"1bd8785e7f20e7a315a4f2f21547363d32a8782e","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Architecture Platform","surfaceId":"SOURCE-HUB-BASE-002"},"scripts/governance/platform-source-hub-foundation.test.mjs":{"sha":"da3643ca7b03ed36a7c434df2b8f5d0bc0d6adf6","status":"modified","mode":"100644","projectKey":"ARCHITECTURE","owner":"Governance Source Layer","surfaceId":"SG2-BASE-020"}}})
function privateRecurringReview(files){
 return [PRIVATE_RECURRING_REVIEW,PRIVATE_RECURRING_FINAL_REVIEW,PRIVATE_RECURRING_COMPLETION_REVIEW].find(r=>Array.isArray(files)&&files.length===Object.keys(r.entries).length&&new Set(files.map(f=>f?.filename)).size===files.length&&files.every(f=>Object.hasOwn(r.entries,f?.filename)&&r.entries[f.filename].sha===f.sha&&r.entries[f.filename].status===f.status&&!Object.hasOwn(f,'previous_filename')))
}
function isPinnedPrivateRecurringReview(files){return !!privateRecurringReview(files)}

function assertPrivateRecurringRoutes(files,repositoryRoot){
 const review=privateRecurringReview(files);if(!review)fail('PRIVATE_RECURRING_FILE_LIST_REQUIRED')
 for(const key of ['ARCHITECTURE','SG2','SRM']){
  const selected=files.filter(f=>review.entries[f.filename].projectKey===key),profile=resolveProjectProfile(key,repositoryRoot),route=resolveProjectRouting({profile,targets:selected.map(f=>f.filename),repositoryRoot})
  if(profile.repository.slug!==REPOSITORY||!route.ok||route.results.length!==selected.length||route.results.some(r=>{const e=review.entries[r.normalizedPath];return !e||r.resolutionStatus!=='RESOLVED'||r.highestSpecificityMatchCount!==1||r.projectBoundaryStatus!=='ALLOWED'||r.baselineClassification!=='ALIGNED'||r.currentOwner!==e.owner||r.matchedSurfaceId!==e.surfaceId}))fail('PRIVATE_RECURRING_ROUTING_REJECTED')
 }
}

export function assertPrivateRecurringReviewEntry(file,entry){
 if(![PRIVATE_RECURRING_REVIEW,PRIVATE_RECURRING_FINAL_REVIEW,PRIVATE_RECURRING_COMPLETION_REVIEW].some(r=>{
  const e=r.entries[file?.filename];return !!e&&e.sha===file.sha&&entry===e.mode+' blob '+file.sha+'\t'+file.filename+'\0'
 }))fail('PRIVATE_RECURRING_FILE_MODE_REJECTED')
}

export const PRIVATE_RECURRING_PROVENANCE=Object.freeze({"recordPath":"apps/architecture-lab/private-recurring-source.json","recordSha256":"9e9dd40ee05fb5c8889868f6c3b5282d74c6b05d68914b8652d16bbd1f0021c8","operationSourceDigest":"1722f1604df42aec084df0ff7610240a25e687caffd58547dbed320a200676ed","previousSourceSha":"141cc559063c43cefa991acb9260b32ac5b92615","preservedReceipts":{"apps/sg-runtime/operation-integration.json":"a6bf50993c98a71aeccd349dd904baafb53b3cd653324d97bab3fc5e34ac509f","apps/srm/operation-integration.json":"1303ac82c0570ca4929f64e1620e2ec7a6bfd3809607f57eb33da621c8ecd06d","apps/newsfeed-runtime/operation-integration.json":"a8b43f4f6213806843160d4373bb62bfd9357ba03cfbc16865fb2bce266f88f1","apps/sg-runtime/assistant-context-integration.json":"d932f227977789643086b6a9eb179598a6f48071964b2d26ba82d25fceb7b2ec","apps/newsfeed-runtime/assistant-context-integration.json":"4057379e02c7b698f3f24348c40b84275d92c3a892b55e96b1c6d23175298dfc","apps/newsfeed-runtime/saved-searches-integration.json":"fcfea3ae736cfd3446dac7c70c34f6f59a723a48bdae11234706d76f01652a6c","apps/sg-runtime/procurement-insights-integration.json":"6dca06d8b0731e585925100b0578d41a61711f335940350d1ea32c296a3d7177","apps/sg-runtime/assistant-ecr-integration.json":"5814e2e5cbdf1a32d22cff3aa55de806ec34c9debdecc21ff06c4f9f887a82bc","apps/sg-runtime/assistant-markdown-integration.json":"27ff06aff8bc44592f0073732748834b7759182fa4307d901c7d63304381a38b","apps/sg-runtime/registration-stage-i-integration.json":"4a7a572e67e12ed73c523502cef4cb432009e735737df851419d80898653f414","apps/sg-runtime/assistant-send-arrow-integration.json":"62c6af6817a022c31788d801cc0eac293a24b3f25d9e529d32b1bff4908fa230"},"taskIds":{"ARCHITECTURE":"ARCH-PI-RECURRING-E1-20261111","SG2":"SG2-PI-RECURRING-E2E-20261111","SRM":"SRM-PI-RECURRING-SDK-20261111"},"adoptions":{"ARCHITECTURE":"apps/architecture-lab/private-recurring-source-adoption.json","SG2":"apps/sg-runtime/private-recurring-source-adoption.json","SRM":"apps/srm/private-recurring-source-adoption.json"}})
export const PRIVATE_RECURRING_FINAL_PROVENANCE=Object.freeze({...PRIVATE_RECURRING_PROVENANCE,recordSha256:'ae3641b3a874922a95d7dfc0cc4b3a2f758595e0b60a5b1d197b84b85cb19432',sourceFileCount:367})
export const PRIVATE_RECURRING_COMPLETION_PROVENANCE=Object.freeze({...PRIVATE_RECURRING_PROVENANCE,recordSha256:'75877d5750e07d1c8172be0af76bc5933f2eeefc22cc39747a2621b9cab24619',sourceFileCount:368})
const recurringHash=b=>createHash('sha256').update(b).digest('hex')
function privateRecurringProvenance(bytes){
 const h=recurringHash(bytes),p=[PRIVATE_RECURRING_PROVENANCE,PRIVATE_RECURRING_FINAL_PROVENANCE,PRIVATE_RECURRING_COMPLETION_PROVENANCE].find(p=>p.recordSha256===h)
 if(!p)fail('PRIVATE_RECURRING_RECORD_REJECTED');return p
}

function privateRecurringMetadata(bytes){
 const provenance=privateRecurringProvenance(bytes),a=JSON.parse(bytes)
 if(a.scope!=='PRIVATE_RECURRING_SOURCE_ACCEPTANCE'||a.schemaVersion!=='1.0.0'||a.platformVersion!=='1.36.0'
  ||a.legacyImplementation!=='1.0.0-candidate.16'||a.optionalImplementation!=='1.0.0-candidate.22'
  ||a.previousSourceSha!==PRIVATE_RECURRING_PROVENANCE.previousSourceSha||Object.keys(a.sourceDigests).length!==(provenance.sourceFileCount??364)
  ||a.sdkDigests.operationSourceDigest!==PRIVATE_RECURRING_PROVENANCE.operationSourceDigest
  ||JSON.stringify(a.taskIds)!==JSON.stringify(PRIVATE_RECURRING_PROVENANCE.taskIds)
  ||JSON.stringify(a.preservedReceipts)!==JSON.stringify(PRIVATE_RECURRING_PROVENANCE.preservedReceipts)
  ||['runtimeActivated','newGrantsInstalled','providerCallsPerformed','deploymentPerformed'].some(k=>a[k]!==false))fail('PRIVATE_RECURRING_RECORD_REJECTED')
 return a
}
/** Pure trusted data: validate every reviewed current byte and immutable receipt;
 * candidate JavaScript is never imported while package credentials exist. */
export function assertPrivateRecurringRecord(bytes,{digestForPath,adoptions,currentReceipts,historicalReceipts}){
 const a=privateRecurringMetadata(bytes),provenance=privateRecurringProvenance(bytes)
 for(const [p,h]of Object.entries(a.sourceDigests))if(digestForPath(p)!==h)fail('PRIVATE_RECURRING_SOURCE_BYTES_REJECTED')
 for(const [project,p]of Object.entries(PRIVATE_RECURRING_PROVENANCE.adoptions)){
  const expected={schemaVersion:'1.0.0',projectKey:project,taskId:a.taskIds[project],targetEnvironment:'development',scope:'SOURCE_ONLY_NO_RUNTIME_ACTIVATION',sourceRecord:PRIVATE_RECURRING_PROVENANCE.recordPath,sourceRecordSha256:provenance.recordSha256}
  if(JSON.stringify(adoptions[project])!==JSON.stringify(expected))fail('PRIVATE_RECURRING_ADOPTION_REJECTED')
 }
 for(const [p,h]of Object.entries(a.preservedReceipts))if(recurringHash(currentReceipts[p])!==h||recurringHash(historicalReceipts[p])!==h)fail('PRIVATE_RECURRING_PREDECESSOR_REJECTED')
 return a
}

// Closed continuation for PR #1021. Preparation is not policy activation.
// Only these exact14 regular source bytes may be projected to their accepted
// predecessor. The existing registration, recurring, package and credential
// checks remain mandatory; candidate JavaScript is never imported here.
export const ASSISTANT_ECR_WEEK_REVIEW=Object.freeze({
  "recordPath": "apps/sg-runtime/assistant-ecr-week-integration.json",
  "recordSha256": "31ce8f1d7e5ca1d9c3aedf80f92e23fe0f1a93cb8f5fd5d003eb54a244859dd4",
  "previousSourceSha": "b6df3533750d0278440b0a432e412731bff47a42",
  "sourceCommit": "0ebf41d600ac6ab1df8dffcde1dfe3c982ea8771",
  "prNumber": 1021,
  "branch": "sg2/acg-ecr-weeks-20261111-40671bf2",
  "sourceDigests": {
    "apps/sg-runtime/components/appshell/assistant-conversation-session.ts": "96d063c60c29030ea06a7f242567690d48f694ebae51538f1ec229b0ae6568df",
    "apps/sg-runtime/lib/assistant/context-selection.ts": "8a8f4e995f2cf3f739d8182905e436675cb4ddd0d9b9240146c2d6b6cd917ab2",
    "apps/sg-runtime/lib/assistant/conversation.ts": "04fdf8afb4571a9acac826d0ffe1f6061813216c6b262ce5b571769eb40aed5d",
    "apps/sg-runtime/lib/assistant/model.ts": "b9c0558a11017760fcc25768aee1c8269dcd5093963255b79f4446af2b55246f",
    "apps/sg-runtime/lib/assistant/runtime.ts": "52f379da1e703976fefa7900519b8c716df25b026079a6a99dd2732867d6c6ef",
    "apps/sg-runtime/tests/assistant-conversation-handler.test.ts": "f5af231edac5eb8f82a5c7a349d47c2819191d692d7f19f536b396ac44c37b46",
    "apps/sg-runtime/tests/assistant-conversation.test.ts": "b954b440d59bcd1a66f90ec3d02d274b84917f5d8de97761fb38941fd23bddf1",
    "apps/sg-runtime/tests/assistant-economic-calendar.test.ts": "d4ab11946dc33a309c8346aa2edd80fdcb68d59ab847b6ec10a807782f2ee1f9",
    "apps/sg-runtime/tests/assistant-model.test.ts": "f589c834c94488e7b9d37524cd0a13515ac0ce7b8f9071a07bb11d9f3fcd7908",
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": "aa9b2199d5d2cd1554f808a02f7fd63bf397adca045f4d535e7d2af0f158c080",
    "apps/sg-runtime/tests/assistant-ecr-week-integrity.mjs": "8c602c69c4da51e51525d48d73674e223daa8dbd96bf58d80863c0471a652639",
    "apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs": "0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f",
    "apps/sg-runtime/assistant-ecr-week-integration.json": "31ce8f1d7e5ca1d9c3aedf80f92e23fe0f1a93cb8f5fd5d003eb54a244859dd4",
    "apps/architecture-lab/private-recurring-source.mjs": "9035324816864e64040c1ad3d29e064284ad2e3f8eb626a9b3c1ede55fbb4b28"
  },
  "preservedReceipts": {
    "apps/sg-runtime/operation-integration.json": "a6bf50993c98a71aeccd349dd904baafb53b3cd653324d97bab3fc5e34ac509f",
    "apps/sg-runtime/assistant-context-integration.json": "d932f227977789643086b6a9eb179598a6f48071964b2d26ba82d25fceb7b2ec",
    "apps/sg-runtime/procurement-insights-integration.json": "6dca06d8b0731e585925100b0578d41a61711f335940350d1ea32c296a3d7177",
    "apps/sg-runtime/assistant-markdown-integration.json": "27ff06aff8bc44592f0073732748834b7759182fa4307d901c7d63304381a38b",
    "apps/sg-runtime/registration-stage-i-integration.json": "4a7a572e67e12ed73c523502cef4cb432009e735737df851419d80898653f414",
    "apps/sg-runtime/assistant-send-arrow-integration.json": "62c6af6817a022c31788d801cc0eac293a24b3f25d9e529d32b1bff4908fa230",
    "apps/sg-runtime/assistant-ecr-integration.json": "5814e2e5cbdf1a32d22cff3aa55de806ec34c9debdecc21ff06c4f9f887a82bc",
    "apps/sg-runtime/assistant-ecr-precision-integration.json": "a017c2b971e3c72606847264150715c983fa9483537d26be90144a64e0377ee7",
    "apps/sg-runtime/private-recurring-source-adoption.json": "edf9d51c199251e148b39c92a3084944c1a4b8419be29175c88b6e2583df11f2",
    "apps/architecture-lab/private-recurring-source.json": "75877d5750e07d1c8172be0af76bc5933f2eeefc22cc39747a2621b9cab24619",
    "apps/architecture-lab/private-recurring-source-adoption.json": "a79c186897851acb93142949fe7aee19184cbfe68b3acdf51cbda084c00c1254",
    "apps/srm/private-recurring-source-adoption.json": "88d0252f634eface35b34adf31ac97cbf0d396fcf1fe6da452c74bdc23c7c633"
  }
})
export function assertAssistantEcrWeekRecord(bytes,{sourceDigestForPath,currentReceiptDigestForPath,historicalReceiptDigestForPath}){
 if(recurringHash(bytes)!==ASSISTANT_ECR_WEEK_REVIEW.recordSha256)fail('ASSISTANT_ECR_WEEK_RECORD_REJECTED')
 for(const [p,h]of Object.entries(ASSISTANT_ECR_WEEK_REVIEW.sourceDigests))
  if(sourceDigestForPath(p)!==h)fail('ASSISTANT_ECR_WEEK_SOURCE_BYTES_REJECTED')
 for(const [p,h]of Object.entries(ASSISTANT_ECR_WEEK_REVIEW.preservedReceipts))
  if(currentReceiptDigestForPath(p)!==h||historicalReceiptDigestForPath(p)!==h)fail('ASSISTANT_ECR_WEEK_PREDECESSOR_REJECTED')
 return JSON.parse(bytes)
}
export function assistantEcrWeekSourceProjection(root){
 const recordPath=ASSISTANT_ECR_WEEK_REVIEW.recordPath
 let bytes;try{bytes=readRegistrationSdkFile(root,recordPath)}catch(error){if(error?.code==='ENOENT')return null;throw error}
 const read=p=>{
  const bytes=readRegistrationSdkFile(root,p)
  if(fs.lstatSync(path.join(fs.realpathSync(root),p)).mode&0o111)fail('ASSISTANT_ECR_WEEK_FILE_MODE_REJECTED')
  return bytes
 }
 const historical=p=>execFileSync('git',['show',ASSISTANT_ECR_WEEK_REVIEW.previousSourceSha+':'+p],{cwd:root,stdio:['ignore','pipe','ignore']})
 assertAssistantEcrWeekRecord(bytes,{sourceDigestForPath:p=>recurringHash(read(p)),
  currentReceiptDigestForPath:p=>recurringHash(read(p)),historicalReceiptDigestForPath:p=>recurringHash(historical(p))})
 const mapped=new Set(Object.keys(ASSISTANT_ECR_WEEK_REVIEW.sourceDigests)),cache=new Map()
 return p=>{
  if(!mapped.has(p))return readRegistrationSdkFile(root,p)
  if(!cache.has(p))cache.set(p,historical(p))
  return Buffer.from(cache.get(p))
 }
}

export function assertPrivateRecurringProvenance(root){
 const physical=p=>readRegistrationSdkFile(root,p)
 let bytes;try{bytes=physical(PRIVATE_RECURRING_PROVENANCE.recordPath)}catch(error){if(error?.code==='ENOENT')return null;throw error}
 // Authenticate the complete current graph before projecting only the exact
 // reviewed registration overlay onto accepted recurring main. No candidate JS.
 let registration=null,hasRegistration=false
 try{physical('packages/platform-contracts/test/organisation-sdk-compatibility.json');hasRegistration=true}catch(error){if(error?.code!=='ENOENT')throw error}
 if(hasRegistration)registration=assertRegistrationSdkProvenance(root)
 const weekRead=assistantEcrWeekSourceProjection(root)
 let read=weekRead??physical
 if(registration&&registrationHash(physical('packages/platform-contracts/test/organisation-sdk-compatibility.json'))===REGISTRATION_SDK_RECONCILED_PROVENANCE.recordDigest){
  // The approved overlay also includes native Identity files outside the SDK
  // record's source-only maps. Verify every exact65 physical blob before any
  // historical projection; the closed review is the only additional authority.
  for(const [p,e]of Object.entries(REGISTRATION_SDK_REVIEW.entries)){
   const b=physical(p),blob=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')
   if(e.mode!=='100644'||blob!==e.sha)fail('REGISTRATION_SDK_SOURCE_BYTES_REJECTED')
  }
  const mapped=new Set([...Object.keys(REGISTRATION_SDK_REVIEW.entries),...Object.keys(registration.sourceDigests),...Object.keys(registration.compatibilityTestSourceDigests),...Object.values(registration.consumerSourceDigests).flatMap(v=>Object.keys(v)),'apps/sg-runtime/operation-integration.json','apps/srm/operation-integration.json'])
  const cache=new Map()
  read=p=>{if(!mapped.has(p))return (weekRead??physical)(p);if(!cache.has(p))cache.set(p,execFileSync('git',['show',registration.previousSourceSha+':'+p],{cwd:root,stdio:['ignore','pipe','ignore']}));return Buffer.from(cache.get(p))}
 }
 const a=privateRecurringMetadata(bytes),adoptions={},currentReceipts={},historicalReceipts={}
 for(const [k,p]of Object.entries(PRIVATE_RECURRING_PROVENANCE.adoptions))adoptions[k]=JSON.parse(read(p))
 for(const p of Object.keys(a.preservedReceipts)){
  currentReceipts[p]=read(p)
  historicalReceipts[p]=execFileSync('git',['show',a.previousSourceSha+':'+p],{cwd:root,stdio:['ignore','pipe','ignore']})
 }
 return assertPrivateRecurringRecord(bytes,{digestForPath:p=>recurringHash(read(p)),adoptions,currentReceipts,historicalReceipts})
}
export function privateRecurringProofContract(receipt,recordBytes,receiptBytes){
 const prior=adoptedOperationContract(receipt)
 if(recordBytes===null)return prior
 const a=privateRecurringMetadata(recordBytes)
 if(prior.implementation!=='1.0.0-candidate.16'||prior.sourceDigest!=='dc609cc3a4a92ce013a7ffdac34337b341f355725319a19a5917e0e1851b6052'
  ||recurringHash(receiptBytes)!==a.preservedReceipts['apps/sg-runtime/operation-integration.json'])fail('PRIVATE_RECURRING_PREDECESSOR_REJECTED')
 return {...prior,sourceDigest:PRIVATE_RECURRING_PROVENANCE.operationSourceDigest}
}
function currentProofContract(root,receipt){
 const a=assertPrivateRecurringProvenance(root)
 if(receipt?.sdkSourceContinuations!==undefined){
  const record=assertRegistrationSdkProvenance(root)
  if(record.platformVersion==='1.36.0'&&!a)fail('PRIVATE_RECURRING_RECORD_REJECTED')
  return {...adoptedOperationContract(receipt),sourceDigest:record.sdkDigests.operationSourceDigest}
 }
 return privateRecurringProofContract(receipt,a?readRegistrationSdkFile(root,PRIVATE_RECURRING_PROVENANCE.recordPath):null,readRegistrationSdkFile(root,'apps/sg-runtime/operation-integration.json'))
}
function reviewedPrivateRecurringPeer(owner,version,section,name,spec){
 return owner==='@profitia/maps-embed'&&version==='0.1.2'&&section==='peerDependencies'&&name==='@profitia/platform-contracts'&&spec===REVIEWED_MAPS_EMBED_PEERS[name]+' || 1.33.0 || 1.34.0 || 1.36.0'
 ||owner==='@profitia/platform-current-e1-authority'&&version==='1.3.0'&&name==='@profitia/platform-contracts'&&(section==='peerDependencies'&&spec==='1.36.0'||section==='devDependencies'&&spec==='file:..')
 ||owner==='@profitia/platform-source-hub-contracts'&&version==='1.7.1'&&section==='peerDependencies'&&name==='@profitia/platform-current-e1-authority'&&spec==='1.1.0 || 1.2.0 || 1.2.1 || 1.3.0'
}


function reviewedPrivateRecurringAuthority(candidate,authority,section,name,spec){
 if(authority.name!==candidate.name)return false
 const prior=authority[section]?.[name]
 if(candidate.name==='@profitia/maps-embed')return authority.version==='0.1.2'
  &&authority.peerDependencies?.['@profitia/maps-contracts']==='0.1.0'
  &&[REVIEWED_MAPS_EMBED_PEERS[name]+' || 1.33.0 || 1.34.0',spec].includes(prior)
 if(candidate.name==='@profitia/platform-current-e1-authority')return ['1.2.1','1.3.0'].includes(authority.version)
  &&(section==='devDependencies'?prior==='file:..':['1.33.0 || 1.34.0',spec].includes(prior))
 if(candidate.name==='@profitia/platform-source-hub-contracts')return ['1.7.0','1.7.1'].includes(authority.version)
  &&['1.1.0 || 1.2.0 || 1.2.1',spec].includes(prior)
 return false
}

export function assertArchitectureFiles(pr, files, repositoryRoot = controlRoot()) {
  if (!Number.isInteger(pr.changed_files) || pr.changed_files < 1 || pr.changed_files > 300 || !shaPattern.test(pr.base?.sha ?? '')
    || !Array.isArray(files) || files.length !== pr.changed_files) fail('ARCHITECTURE_FILE_LIST_REQUIRED')
  if(isPinnedPrivateRecurringReview(files)){assertPrivateRecurringRoutes(files,repositoryRoot);return}
  if(isPinnedRegistrationSdkReview(files)){assertRegistrationSdkRoutes(files,repositoryRoot);return}
  if(isPinnedNewsfeedSavedSearchReview(files)){assertNewsfeedSavedSearchRoutes(files,repositoryRoot);return}
  if(isPinnedEcrSourceContinuityReview(files)){assertEcrSourceContinuityRoutes(files,repositoryRoot);return}
  if(isPinnedEcrStage0405Review(files)){assertEcrStage0405Routes(files,repositoryRoot);return}
  if(isPinnedEcrStage03Review(files)){assertEcrStage03Routes(files,repositoryRoot);return}
  if(isPinnedAcgM1Review(files)){assertAcgM1ReviewRoutes(files,repositoryRoot);return}
  if(isPinnedOilReportReview(files)){assertOilReportRoutes(files,repositoryRoot);return}
  if(isPinnedMarketSymbolReview(files)){assertMarketSymbolRoutes(files,repositoryRoot);return}
  if(isPinnedEcrBackendReview(files)){assertEcrBackendRoutes(files,repositoryRoot);return}
  if(isPinnedUniversalFirstPartyReview(files)){assertUniversalFirstPartyRoutes(files,repositoryRoot);return}
  if(isPinnedCurrentE1Review(files)){assertCurrentE1Routes(files,repositoryRoot);return}
  if(isPinnedSourceHubStage2aReview(files)){assertSourceHubStage2aRoutes(files,repositoryRoot);return}
  const krsReview = files.length === KRS_GOVERNANCE_REVIEW_FILES.length
    && files.every(file => KRS_GOVERNANCE_REVIEW_FILES.includes(file?.filename))
  const freshReportReview = isPinnedFreshReportReview(files)
  const payloadCaptureReview = isPinnedPayloadCaptureReview(files)
  const readonlyMissReview = isPinnedReadonlyMissReportReview(files)
  const freshFixtureReview = isPinnedFreshFixtureTeardownReview(files)
  const rootAtomicClaimReview = isPinnedRootAtomicClaimReview(files)
  const closedReview = isPinnedPlatformKnowledgeG1Review(files) || isPinnedAcgG1Review(files) || isPinnedInsightsG1Review(files) || isPinnedEcrG1Review(files) || krsReview || isPinnedAdpGovernanceReview(files) || isPinnedLimitsG1Review(files) || isPinnedNewsfeedG1Review(files) || isPinnedSourceHubG1Review(files) || freshReportReview || payloadCaptureReview || readonlyMissReview || freshFixtureReview || rootAtomicClaimReview
  const names = new Set()
  for (const file of files) {
    if (!(closedReview || architecturePathAllowed(file.filename))
      || !(closedReview ? ['added', 'modified'] : ['added', 'modified', 'removed']).includes(file.status)
      || Object.hasOwn(file, 'previous_filename') || !shaPattern.test(file.sha ?? '') || names.has(file.filename)) fail('ARCHITECTURE_PATH_REJECTED')
    names.add(file.filename)
  }
  const profile = resolveProjectProfile('ARCHITECTURE', repositoryRoot)
  if (profile.repository.slug !== REPOSITORY || profile.repository.routingRegistry !== 'Canon/registries/current-architecture-baseline-v1.json') fail('ARCHITECTURE_ROUTING_REJECTED')
  const routing = resolveProjectRouting({profile, targets: [...names], repositoryRoot})
  if (!routing.ok || routing.results.some(r => r.projectBoundaryStatus !== 'ALLOWED' || r.baselineClassification !== 'ALIGNED'
    || r.currentOwner !== (r.normalizedPath.startsWith('packages/')
      || freshReportReview && r.normalizedPath === 'apps/architecture-lab/current-fresh-report-acceptance.json'
      || payloadCaptureReview && r.normalizedPath.startsWith('apps/architecture-lab/')
      || readonlyMissReview && r.normalizedPath === 'apps/architecture-lab/test/readonly-miss-report.test.mjs'
      || rootAtomicClaimReview && r.normalizedPath === 'apps/architecture-lab/test/root-atomic-claim.test.mjs'
      || freshFixtureReview && r.normalizedPath === 'apps/architecture-lab/src/operation-postgres-fixture.mjs'
      ? 'Architecture Platform' : 'Governance Source Layer'))) fail('ARCHITECTURE_ROUTING_REJECTED')
  if (!closedReview && ![...names].some(n => n.startsWith('packages/platform-contracts/'))) fail('ARCHITECTURE_PRODUCER_REQUIRED')
}

export function selectCandidate(context, pr, expectedSha, {files, repositoryRoot = controlRoot()} = {}) {
  const family = candidateFamily(context, pr, expectedSha)
  if(pr&&(pr.number===PRIVATE_RECURRING_REVIEW.prNumber||pr.head.ref===PRIVATE_RECURRING_REVIEW.branch||isPinnedPrivateRecurringReview(files))){if(family!=='ARCHITECTURE'||pr.number!==PRIVATE_RECURRING_REVIEW.prNumber||pr.head.ref!==PRIVATE_RECURRING_REVIEW.branch||!isPinnedPrivateRecurringReview(files))fail('PRIVATE_RECURRING_REVIEW_IDENTITY_REJECTED')}
  if (pr && (pr.number===PLATFORM_KNOWLEDGE_G1_REVIEW.prNumber || pr.head?.ref===PLATFORM_KNOWLEDGE_G1_REVIEW.branch || isPinnedPlatformKnowledgeG1Review(files))) {
    if (family!=='ARCHITECTURE' || pr.number!==PLATFORM_KNOWLEDGE_G1_REVIEW.prNumber
      || pr.head.ref!==PLATFORM_KNOWLEDGE_G1_REVIEW.branch || expectedSha!==PLATFORM_KNOWLEDGE_G1_REVIEW.sourceSha
      || !isPinnedPlatformKnowledgeG1Review(files)) fail('PLATFORM_KNOWLEDGE_G1_REVIEW_IDENTITY_REJECTED')
  }

  if(pr&&(pr.number===REGISTRATION_SDK_REVIEW.prNumber||pr.head.ref===REGISTRATION_SDK_REVIEW.branch||isPinnedRegistrationSdkReview(files))){if(family!=='ARCHITECTURE'||pr.number!==REGISTRATION_SDK_REVIEW.prNumber||pr.head.ref!==REGISTRATION_SDK_REVIEW.branch||!isPinnedRegistrationSdkReview(files))fail('REGISTRATION_SDK_REVIEW_IDENTITY_REJECTED')}
  if(pr&&(pr.number===NEWSFEED_SAVED_SEARCH_REVIEW.prNumber||pr.head.ref===NEWSFEED_SAVED_SEARCH_REVIEW.branch||isPinnedNewsfeedSavedSearchReview(files))){if(family!=='ARCHITECTURE'||pr.number!==NEWSFEED_SAVED_SEARCH_REVIEW.prNumber||pr.head.ref!==NEWSFEED_SAVED_SEARCH_REVIEW.branch||!isPinnedNewsfeedSavedSearchReview(files))fail('NEWSFEED_SAVED_SEARCH_REVIEW_IDENTITY_REJECTED')}
  if(pr&&(pr.number===ECR_SOURCE_CONTINUITY_REVIEW.prNumber||pr.head.ref===ECR_SOURCE_CONTINUITY_REVIEW.branch||isPinnedEcrSourceContinuityReview(files))){if(family!=='ARCHITECTURE'||pr.number!==ECR_SOURCE_CONTINUITY_REVIEW.prNumber||pr.head.ref!==ECR_SOURCE_CONTINUITY_REVIEW.branch||!isPinnedEcrSourceContinuityReview(files))fail('ECR_SOURCE_CONTINUITY_REVIEW_IDENTITY_REJECTED')}
  if(pr&&(pr.number===ECR_STAGE0405_REVIEW.prNumber||pr.head.ref===ECR_STAGE0405_REVIEW.branch||isPinnedEcrStage0405Review(files))){if(family!=='ARCHITECTURE'||pr.number!==ECR_STAGE0405_REVIEW.prNumber||pr.head.ref!==ECR_STAGE0405_REVIEW.branch||!isPinnedEcrStage0405Review(files))fail('ECR_STAGE0405_REVIEW_IDENTITY_REJECTED')}
  if(pr&&(pr.number===ECR_STAGE03_REVIEW.prNumber||pr.head.ref===ECR_STAGE03_REVIEW.branch||isPinnedEcrStage03Review(files))){if(family!=='ARCHITECTURE'||pr.number!==ECR_STAGE03_REVIEW.prNumber||pr.head.ref!==ECR_STAGE03_REVIEW.branch||!isPinnedEcrStage03Review(files))fail('ECR_STAGE03_REVIEW_IDENTITY_REJECTED')}
  if(pr&&(pr.number===ACG_M1_EXECUTION_REVIEW.prNumber||pr.head.ref===ACG_M1_EXECUTION_REVIEW.branch||isPinnedAcgM1Review(files))){if(family!=='ARCHITECTURE'||pr.number!==ACG_M1_EXECUTION_REVIEW.prNumber||pr.head.ref!==ACG_M1_EXECUTION_REVIEW.branch||!isPinnedAcgM1Review(files))fail('ACG_M1_REVIEW_IDENTITY_REJECTED')}
  if(pr&&(pr.number===ACG_G1_REVIEW.prNumber||pr.head.ref===ACG_G1_REVIEW.branch||isPinnedAcgG1Review(files))){
   if(family!=='ARCHITECTURE'||pr.number!==ACG_G1_REVIEW.prNumber||pr.head.ref!==ACG_G1_REVIEW.branch||!isPinnedAcgG1Review(files))fail('ACG_G1_REVIEW_IDENTITY_REJECTED')
  }
  if(pr&&(pr.number===OIL_REPORT_E1_REVIEW.prNumber||pr.head.ref===OIL_REPORT_E1_REVIEW.branch||isPinnedOilReportReview(files))){if(family!=='ARCHITECTURE'||pr.number!==OIL_REPORT_E1_REVIEW.prNumber||pr.head.ref!==OIL_REPORT_E1_REVIEW.branch||!isPinnedOilReportReview(files))fail('OIL_REPORT_REVIEW_IDENTITY_REJECTED')}
  if(pr&&(pr.number===SOURCE_HUB_MARKET_SYMBOL_REVIEW.prNumber||pr.head.ref===SOURCE_HUB_MARKET_SYMBOL_REVIEW.branch)){
    if(family!=='ARCHITECTURE'||pr.number!==SOURCE_HUB_MARKET_SYMBOL_REVIEW.prNumber||pr.head.ref!==SOURCE_HUB_MARKET_SYMBOL_REVIEW.branch||!isPinnedMarketSymbolReview(files))fail('MARKET_SYMBOL_REVIEW_IDENTITY_REJECTED')
  }
  if(pr&&(pr.number===INSIGHTS_G1_REVIEW.prNumber||pr.head.ref===INSIGHTS_G1_REVIEW.branch||isPinnedInsightsG1Review(files))){
    if(family!=='ARCHITECTURE'||pr.number!==INSIGHTS_G1_REVIEW.prNumber||pr.head.ref!==INSIGHTS_G1_REVIEW.branch||!isPinnedInsightsG1Review(files))fail('INSIGHTS_G1_REVIEW_IDENTITY_REJECTED')
  }
  if (family === 'MAIN') return context.controlSha
  if (family === 'ARCHITECTURE') {
    assertArchitectureFiles(pr, files, repositoryRoot)
    if(isPinnedMarketSymbolReview(files)&&(pr.number!==SOURCE_HUB_MARKET_SYMBOL_REVIEW.prNumber||pr.head.ref!==SOURCE_HUB_MARKET_SYMBOL_REVIEW.branch))fail('MARKET_SYMBOL_REVIEW_IDENTITY_REJECTED')
    if(isPinnedEcrBackendReview(files)&&(pr.number!==ECR_BACKEND_REVIEW.prNumber||pr.head.ref!==ECR_BACKEND_REVIEW.branch))fail('ECR_BACKEND_REVIEW_IDENTITY_REJECTED')
    if(isPinnedEcrG1Review(files)&&(pr.number!==ECR_G1_GOVERNANCE_REVIEW.prNumber||pr.head.ref!==ECR_G1_GOVERNANCE_REVIEW.branch))fail('ECR_G1_REVIEW_IDENTITY_REJECTED')
    if(isPinnedUniversalFirstPartyReview(files)&&(pr.number!==SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW.prNumber||pr.head.ref!==SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW.branch))fail('UNIVERSAL_FIRST_PARTY_REVIEW_IDENTITY_REJECTED')
    if(isPinnedCurrentE1Review(files)&&(pr.number!==SOURCE_HUB_CURRENT_E1_REVIEW.prNumber||pr.head.ref!==SOURCE_HUB_CURRENT_E1_REVIEW.branch))fail('CURRENT_E1_REVIEW_IDENTITY_REJECTED')
    if(isPinnedSourceHubStage2aReview(files)&&(pr.number!==SOURCE_HUB_STAGE2A_REVIEW.prNumber||pr.head.ref!==SOURCE_HUB_STAGE2A_REVIEW.branch))fail('SOURCE_HUB_STAGE2A_REVIEW_IDENTITY_REJECTED')
    if (isPinnedAdpGovernanceReview(files)
      && (pr.number !== ADP_GOVERNANCE_REVIEW.prNumber || pr.head.ref !== ADP_GOVERNANCE_REVIEW.branch)) fail('ADP_GOVERNANCE_REVIEW_IDENTITY_REJECTED')
    if (isPinnedLimitsG1Review(files)
      && (pr.number !== LIMITS_G1_GOVERNANCE_REVIEW.prNumber || pr.head.ref !== LIMITS_G1_GOVERNANCE_REVIEW.branch)) fail('LIMITS_G1_REVIEW_IDENTITY_REJECTED')
    if (isPinnedNewsfeedG1Review(files)
      && (pr.number !== NEWSFEED_G1_GOVERNANCE_REVIEW.prNumber || pr.head.ref !== NEWSFEED_G1_GOVERNANCE_REVIEW.branch)) fail('NEWSFEED_G1_REVIEW_IDENTITY_REJECTED')
    if (isPinnedSourceHubG1Review(files)
      && (pr.number !== SOURCE_HUB_G1_GOVERNANCE_REVIEW.prNumber || pr.head.ref !== SOURCE_HUB_G1_GOVERNANCE_REVIEW.branch)) fail('SOURCE_HUB_G1_REVIEW_IDENTITY_REJECTED')
    if (isPinnedFreshReportReview(files)
      && (pr.number !== FRESH_REPORT_PRODUCER_REVIEW.prNumber || pr.head.ref !== FRESH_REPORT_PRODUCER_REVIEW.branch)) fail('FRESH_REPORT_REVIEW_IDENTITY_REJECTED')
    if (isPinnedPayloadCaptureReview(files)
      && (pr.number !== PAYLOAD_CAPTURE_PRODUCER_REVIEW.prNumber || pr.head.ref !== PAYLOAD_CAPTURE_PRODUCER_REVIEW.branch
        || expectedSha !== PAYLOAD_CAPTURE_PRODUCER_REVIEW.sourceSha)) fail('PAYLOAD_CAPTURE_REVIEW_IDENTITY_REJECTED')
    if (isPinnedFreshFixtureTeardownReview(files)
      && (pr.number !== FRESH_FIXTURE_TEARDOWN_REVIEW.prNumber || pr.head.ref !== FRESH_FIXTURE_TEARDOWN_REVIEW.branch
        || expectedSha !== FRESH_FIXTURE_TEARDOWN_REVIEW.sourceSha)) fail('FRESH_FIXTURE_TEARDOWN_REVIEW_IDENTITY_REJECTED')
    if (isPinnedRootAtomicClaimReview(files)
      && (pr.number !== ROOT_ATOMIC_CLAIM_PRODUCER_REVIEW.prNumber || pr.head.ref !== ROOT_ATOMIC_CLAIM_PRODUCER_REVIEW.branch
        || expectedSha !== ROOT_ATOMIC_CLAIM_PRODUCER_REVIEW.sourceSha)) fail('ROOT_ATOMIC_CLAIM_REVIEW_IDENTITY_REJECTED')
    if (isPinnedReadonlyMissReportReview(files)
      && (pr.number !== READONLY_MISS_REPORT_PRODUCER_REVIEW.prNumber || pr.head.ref !== READONLY_MISS_REPORT_PRODUCER_REVIEW.branch
        || expectedSha !== READONLY_MISS_REPORT_PRODUCER_REVIEW.sourceSha)) fail('READONLY_MISS_REVIEW_IDENTITY_REJECTED')
  }
  return expectedSha
}

export async function resolveCandidateAdmission(c, number, expectedSha, request = api, repositoryRoot = controlRoot()) {
  assertTrustedContext(c)
  if (number && !/^[1-9][0-9]*$/.test(number)) fail('PR_NUMBER_REJECTED')
  const endpoint = `repos/${REPOSITORY}/pulls/${number}`
  const pr = number ? (await request(endpoint)).data : null
  const family = candidateFamily(c, pr, expectedSha)
  if (family !== 'ARCHITECTURE') return {sha: selectCandidate(c, pr, expectedSha)}
  if (!Number.isInteger(pr.changed_files) || pr.changed_files < 1 || pr.changed_files > 300) fail('ARCHITECTURE_FILE_LIST_REQUIRED')
  const files = []
  for (let page = 1; page <= 4; page++) {
    const batch = (await request(`${endpoint}/files?per_page=100&page=${page}`)).data
    if (!Array.isArray(batch) || batch.length > 100) fail('ARCHITECTURE_FILE_LIST_REQUIRED')
    files.push(...batch)
    if (files.length > 300) fail('ARCHITECTURE_FILE_LIST_REQUIRED')
    if (batch.length < 100) break
  }
  // PR files are not SHA-addressed. Fence pagination with a second metadata
  // read, then bind the complete list to the actual pinned Git tree below.
  const current = (await request(endpoint)).data
  if (candidateFamily(c, current, expectedSha) !== family || current.base.sha !== pr.base.sha || current.changed_files !== pr.changed_files) fail('CANDIDATE_CHANGED_DURING_RESOLUTION')
  const sha = selectCandidate(c, current, expectedSha, {files, repositoryRoot})
  return {sha, admission: {kind: family, baseSha: pr.base.sha, files: files.map(({filename, status, sha}) => ({filename, status, sha}))}}
}

export function assertArchitectureCheckout(root, sha, admission, repositoryRoot = controlRoot()) {
  if (!admission || admission.kind !== 'ARCHITECTURE' || !shaPattern.test(sha ?? '') || !shaPattern.test(admission.baseSha ?? '')) fail('ARCHITECTURE_CHECKOUT_REJECTED')
  assertArchitectureFiles({changed_files: admission.files?.length, base: {sha: admission.baseSha}}, admission.files, repositoryRoot)
  const changed = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', `${admission.baseSha}...${sha}`], {cwd: root, encoding: 'utf8'}).split('\0').filter(Boolean).sort()
  if (JSON.stringify(changed) !== JSON.stringify(admission.files.map(f => f.filename).sort())) fail('ARCHITECTURE_DIFF_MISMATCH')
  for (const file of admission.files) {
    const entry = execFileSync('git', ['ls-tree', '-z', sha, '--', file.filename], {cwd: root, encoding: 'utf8'})
    if (file.status === 'removed') {if (entry !== '') fail('ARCHITECTURE_DIFF_MISMATCH'); continue}
    if(isPinnedPrivateRecurringReview(admission.files))assertPrivateRecurringReviewEntry(file,entry)
    if(isPinnedRegistrationSdkReview(admission.files))assertRegistrationSdkReviewEntry(file,entry)
    if(isPinnedNewsfeedSavedSearchReview(admission.files))assertNewsfeedSavedSearchReviewEntry(file,entry)
    if(isPinnedEcrSourceContinuityReview(admission.files))assertEcrSourceContinuityReviewEntry(file,entry)
    if(isPinnedEcrStage0405Review(admission.files))assertEcrStage0405ReviewEntry(file,entry)
    if(isPinnedEcrStage03Review(admission.files))assertEcrStage03ReviewEntry(file,entry)
    if(isPinnedAcgM1Review(admission.files))assertAcgM1ReviewEntry(file,entry)
    if(isPinnedAcgG1Review(admission.files))assertAcgG1ReviewEntry(file,entry)
    if(isPinnedOilReportReview(admission.files))assertOilReportReviewEntry(file,entry)
    if(isPinnedInsightsG1Review(admission.files))assertInsightsG1ReviewEntry(file,entry)
    if(isPinnedEcrBackendReview(admission.files))assertEcrBackendReviewEntry(file,entry)
    if(isPinnedEcrG1Review(admission.files))assertEcrG1ReviewEntry(file,entry)
    if(isPinnedMarketSymbolReview(admission.files))assertMarketSymbolReviewEntry(file,entry)
    if(isPinnedUniversalFirstPartyReview(admission.files))assertUniversalFirstPartyReviewEntry(file,entry)
    if(isPinnedCurrentE1Review(admission.files))assertCurrentE1ReviewEntry(file,entry)
    if(isPinnedSourceHubStage2aReview(admission.files)&&entry!==SOURCE_HUB_STAGE2A_REVIEW.modes[file.filename]+' blob '+file.sha+'\t'+file.filename+'\0')fail('SOURCE_HUB_STAGE2A_FILE_MODE_REJECTED')
    if (isPinnedPlatformKnowledgeG1Review(admission.files) && entry !== `100644 blob ${file.sha}\t${file.filename}\0`) fail('PLATFORM_KNOWLEDGE_G1_FILE_MODE_REJECTED')
    if (!['100644', '100755'].some(mode => entry === `${mode} blob ${file.sha}\t${file.filename}\0`)) fail('ARCHITECTURE_CHECKOUT_REJECTED')
    const target = path.join(root, file.filename), stat = fs.lstatSync(target)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024 || fs.realpathSync(target) !== target
      || execFileSync('git', ['hash-object', '--no-filters', '--', file.filename], {cwd: root, encoding: 'utf8'}).trim() !== file.sha) fail('ARCHITECTURE_CHECKOUT_REJECTED')
  }
}

export function assertCredentialMetadata({scopes, expiresAt, login}, now = Date.now()) {
  const granted = (scopes ?? '').split(',').map(x => x.trim()).filter(Boolean)
  if (granted.length !== 1 || granted[0] !== 'read:packages' || login !== 'profitia') fail('CREDENTIAL_SCOPE_OR_OWNER_REJECTED')
  const expiry = Date.parse(expiresAt ?? '')
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 31 * 86400000) fail('CREDENTIAL_EXPIRY_REJECTED')
}

function assertOperationContractMetadata(c) {
  if (!c || Object.keys(c).sort().join(',') !== 'id,implementation,sourceDigest,version' || c.id !== 'profitia.operation-context' || c.version !== '1.0.0' || !/^1\.0\.0-candidate\.[1-9][0-9]*$/.test(c.implementation ?? '') || !/^[a-f0-9]{64}$/.test(c.sourceDigest ?? '')) fail('CONTRACT_PROVENANCE_MISMATCH')
}

export function assertReceipt(receipt) {
  if (receipt?.projectKey !== 'SG2' || receipt.targetEnvironment !== 'development' || receipt.scope !== 'ISOLATED_OPERATION_INTEGRATION_ONLY' || receipt.liveRouteUsesContract !== false || receipt.automaticProductDeployment !== false) fail('ADOPTION_RECEIPT_REJECTED')
  assertOperationContractMetadata(receipt.contract)
  adoptedOperationContract(receipt)
  return receipt
}

/** Old acceptance remains immutable. M1 explicitly binds the currently imported
 * Root without rewriting any historical consumer or producer claim. */

export const REGISTRATION_SDK_PROVENANCE=Object.freeze({
 recordDigests:Object.freeze(['66c07a72cd3817f17eca8243697a633106cc79caa2e2e8a19b1d7a74e0e4d3f1','a0ebdd9af086aba27d025aa821b2c22d43551e997dfa0642c0c59aac11cc4ac5','020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e','25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c']),
 recordPredecessors:Object.freeze({'020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e':'b2fccbb8b9132a63c2c39507a1ebc838cf6228e1','25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c':'b2fccbb8b9132a63c2c39507a1ebc838cf6228e1'}),
 operationSourceDigest:'58a5d94ba89b8bcc781affa3a9964d5f1d9f3ee11a152cddc7bc9ac098de2acf',
 previousSourceSha:'f8f6340ab1ac862a584352f86988dde199172b37',
 bindings:Object.freeze({
  "SG2": {
    "taskId": "SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110",
    "raw": "a6bf50993c98a71aeccd349dd904baafb53b3cd653324d97bab3fc5e34ac509f",
    "normalized": "5f85f0a172508e80a7502aff2c8d3f388dcb4f0c1197eebe6e51917834cd8136"
  },
  "SRM": {
    "taskId": "SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111",
    "raw": "1303ac82c0570ca4929f64e1620e2ec7a6bfd3809607f57eb33da621c8ecd06d",
    "normalized": "d0626a3b74287b03c77feedb0ace57737257126c3012c7b56547331ea9bb9aa7"
  }
})
})
const registrationHash=bytes=>createHash('sha256').update(bytes).digest('hex')
function registrationSdkRecordPredecessor(bytes){
 const digest=registrationHash(bytes)
 if(digest===REGISTRATION_SDK_RECONCILED_PROVENANCE.recordDigest)return REGISTRATION_SDK_RECONCILED_PROVENANCE.previousSourceSha
 if(!REGISTRATION_SDK_PROVENANCE.recordDigests.includes(digest))fail('REGISTRATION_SDK_RECORD_REJECTED')
 return REGISTRATION_SDK_PROVENANCE.recordPredecessors[digest]??REGISTRATION_SDK_PROVENANCE.previousSourceSha
}
function registrationPreviousReceipt(receipt,project){
 const b=REGISTRATION_SDK_PROVENANCE.bindings[project],frames=receipt?.sdkSourceContinuations
 if(!b||receipt.projectKey!==project||receipt.targetEnvironment!=='development'||!Array.isArray(frames)||frames.length!==1)fail('REGISTRATION_SDK_RECEIPT_REJECTED')
 const f=frames[0]
 if(!f||Object.getPrototypeOf(f)!==Object.prototype||Object.keys(f).sort().join(',')!=='acceptanceId,previousReceiptSha256,schemaVersion,targetEnvironment,taskId'
  ||f.schemaVersion!=='1.0'||f.acceptanceId!=='organisation-bootstrap-v1'||f.taskId!==b.taskId||f.targetEnvironment!=='development'||f.previousReceiptSha256!==b.raw)fail('REGISTRATION_SDK_RECEIPT_REJECTED')
 const prior={...receipt};delete prior.sdkSourceContinuations
 if(registrationHash(JSON.stringify(prior))!==b.normalized)fail('REGISTRATION_SDK_PREDECESSOR_REJECTED')
 return prior
}
/** Pure metadata verification. No candidate JavaScript is imported or executed. */
export function assertRegistrationSdkRecord(bytes,{digestForPath,receipts,historicalReceipts}){
 const previousSourceSha=registrationSdkRecordPredecessor(bytes)
 const record=JSON.parse(bytes)
 const profile=registrationHash(bytes)===REGISTRATION_SDK_RECONCILED_PROVENANCE.recordDigest?REGISTRATION_SDK_RECONCILED_PROVENANCE:{sourceCount:155,operationSourceDigest:REGISTRATION_SDK_PROVENANCE.operationSourceDigest}
 if(record.defaultRootImplementation!=='1.0.0-candidate.16'||record.optionalRootImplementation!=='1.0.0-candidate.21'
  ||record.sdkDigests.operationSourceDigest!==profile.operationSourceDigest
  ||record.previousSourceSha!==previousSourceSha||Object.keys(record.sourceDigests).length!==profile.sourceCount
  ||['runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed'].some(k=>record[k]!==false))fail('REGISTRATION_SDK_RECORD_REJECTED')
 for(const map of [record.sourceDigests,record.compatibilityTestSourceDigests,record.preservedSourceDigests,record.consumerSourceDigests.SG2,record.consumerSourceDigests.SRM])
  for(const [name,expected]of Object.entries(map))if(digestForPath(name)!==expected)fail('REGISTRATION_SDK_SOURCE_BYTES_REJECTED')
 for(const project of ['SG2','SRM']){
  const prior=registrationPreviousReceipt(receipts[project],project),historical=historicalReceipts[project]
  if(registrationHash(historical)!==REGISTRATION_SDK_PROVENANCE.bindings[project].raw||JSON.stringify(prior)!==JSON.stringify(JSON.parse(historical)))fail('REGISTRATION_SDK_PREDECESSOR_REJECTED')
 }
 return record
}
export function readRegistrationSdkFile(root,name){
 const base=fs.realpathSync(root)
 {
  if(typeof name!=='string'||name.includes(String.fromCharCode(92))||path.posix.isAbsolute(name)||path.posix.normalize(name)!==name||name.startsWith('../'))fail('REGISTRATION_SDK_SOURCE_FILE_REJECTED')
  const file=path.join(base,name),stat=fs.lstatSync(file)
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024||fs.realpathSync(file)!==file)fail('REGISTRATION_SDK_SOURCE_FILE_REJECTED')
  return fs.readFileSync(file)
 }
}
export function assertRegistrationSdkProvenance(root){
 const base=fs.realpathSync(root),read=name=>readRegistrationSdkFile(base,name)
 const bytes=read('packages/platform-contracts/test/organisation-sdk-compatibility.json'),previousSourceSha=registrationSdkRecordPredecessor(bytes)
 const files={SG2:'apps/sg-runtime/operation-integration.json',SRM:'apps/srm/operation-integration.json'}
 const receipts=Object.fromEntries(Object.entries(files).map(([k,p])=>[k,JSON.parse(read(p))]))
 const historicalReceipts=Object.fromEntries(Object.entries(files).map(([k,p])=>[k,execFileSync('git',['show',previousSourceSha+':'+p],{cwd:base,stdio:['ignore','pipe','ignore']})]))
 return assertRegistrationSdkRecord(bytes,{digestForPath:p=>registrationHash(read(p)),receipts,historicalReceipts})
}

export function adoptedOperationContract(receipt){
 if(receipt?.sdkSourceContinuations!==undefined){
  const prior=adoptedOperationContract(registrationPreviousReceipt(receipt,'SG2'))
  if(prior.implementation!=='1.0.0-candidate.16'||prior.sourceDigest!=='dc609cc3a4a92ce013a7ffdac34337b341f355725319a19a5917e0e1851b6052')fail('REGISTRATION_SDK_PREDECESSOR_REJECTED')
  return {...prior,sourceDigest:REGISTRATION_SDK_PROVENANCE.operationSourceDigest}
 }
 const oil=receipt?.oilAutonomousReportCompatibility
 if(oil!==undefined){
  if(oil.schemaVersion!=='1.0'||oil.taskId!=='SG2-OIL-FINAL-INTEGRATION-20261109'||oil.targetEnvironment!=='development'
   ||oil.scope!=='EXPLICIT_SOURCE_ADOPTION_CANDIDATE_NOT_LIVE_ADMISSION'
   ||oil.producer?.projectKey!=='ARCHITECTURE'||oil.producer?.taskId!=='ARCH-OIL-E1-REPORT-ADOPTION-20261109'||oil.producer?.pullRequest!==923
   ||oil.producer?.sourceSha!=='e189433899349ddda6664c37988255c13845b3e2'||oil.sourceSha!==oil.producer.sourceSha
   ||oil.previousReceiptSourceSha!=='7ed96210f4cc3ccfcd0e0dac6ad126144bdcdecb'||oil.previousReceiptSha256!=='c79fa9f732bedb8692c54553e04bd14c5b756b4e8cd24cd66c1d2c44a73636f9'
   ||oil.sdkDigests?.operationSourceDigest!=='dc609cc3a4a92ce013a7ffdac34337b341f355725319a19a5917e0e1851b6052'
   ||['runtimeGrantsActivated','sourceTemplatesInstalled','privateArchiveInstalled','deploymentPerformed','paidCallsPerformed'].some(k=>oil[k]!==false))fail('OIL_SOURCE_RECEIPT_REJECTED')
  assertOperationContractMetadata(receipt.contract)
  if(receipt.contract.implementation!=='1.0.0-candidate.16'||receipt.contract.sourceDigest!==oil.sdkDigests.operationSourceDigest)fail('OIL_SOURCE_RECEIPT_REJECTED')
  return receipt.contract
 }
 const a=receipt?.assistantM1SourceCompatibility
 if(a===undefined)return receipt.contract
 if(a.schemaVersion!=='1.0'||a.taskId!=='SG2-ACG-M1-20261109'||a.targetEnvironment!=='development'
  ||a.scope!=='OPTIONAL_ASSISTANT_SOURCE_NO_RUNTIME_ACTIVATION'
  ||a.rootProducer?.projectKey!=='ARCHITECTURE'||a.rootProducer?.taskId!=='ARCH-ACG-M1-EXECUTION-20261109'||a.rootProducer?.pullRequest!==937
  ||a.rootProducer?.sourceSha!=='6a7863459977f5651bf30100935118e1613021fd'
  ||['assistantOptedIn','sql030Installed','historyInstalled','grantsChanged','providerCallsPerformed','deploymentPerformed'].some(k=>a[k]!==false))fail('ASSISTANT_SOURCE_RECEIPT_REJECTED')
 assertOperationContractMetadata(a.rootContract)
 if(['id','version','implementation'].some(k=>a.rootContract[k]!==receipt.contract[k])||a.rootContract.sourceDigest!==a.sdkDigests?.operationSourceDigest)fail('ASSISTANT_SOURCE_RECEIPT_REJECTED')
 return a.rootContract
}

export function assertPackagePolicy(candidate, authority, configuration, {reviewedPrivateRecurring=false}={}) {
  if (configuration !== npmrc) fail('NPM_CONFIGURATION_REJECTED')
  if (candidate.lockfileVersion !== 3 || authority.lockfileVersion !== 3) fail('LOCKFILE_VERSION_REJECTED')
  const found = new Set()
  for (const [key, entry] of Object.entries(candidate.packages ?? {})) {
    if (key.includes('..') || key.startsWith('/') || key.includes('\\')) fail('LOCKFILE_PATH_REJECTED')
    const privateName = key.split('node_modules/').at(-1)
    if (entry.name?.startsWith('@profitia/') && entry.name !== privateName) fail('PRIVATE_PACKAGE_ALIAS_REJECTED')
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, spec] of Object.entries(entry[section] ?? {})) {
        if ((name.startsWith('@profitia/') && !PRIVATE_PACKAGES.includes(name) && !Object.hasOwn(LOCAL_PACKAGES, name)) || String(spec).includes('@profitia/')) fail('PRIVATE_PACKAGE_ALIAS_REJECTED')
        if (Object.hasOwn(LOCAL_PACKAGES, name) && spec !== `file:${LOCAL_PACKAGES[name]}`
          && !reviewedReportPeer(privateName,entry.version,section,name,spec)
          && !(reviewedPrivateRecurring&&reviewedPrivateRecurringPeer(privateName,entry.version,section,name,spec))
          && !(key === 'node_modules/@profitia/maps-embed' && reviewedMapsPeer(privateName, entry.version, section, name, spec))) fail('LOCAL_DEPENDENCY_REJECTED')
      }
    }
    if (privateName.startsWith('@profitia/')) {
      if (!PRIVATE_PACKAGES.includes(privateName) && !Object.hasOwn(LOCAL_PACKAGES, privateName)) fail('PRIVATE_PACKAGE_REJECTED')
      if (PRIVATE_PACKAGES.includes(privateName)) {
        if (key !== `node_modules/${privateName}`) fail('NESTED_PRIVATE_PACKAGE_REJECTED')
        const accepted = authority.packages?.[key]
        const analytical=privateName==='@profitia/cic-core'&&candidate.packages?.['']?.name==='@sg/runtime'&&analyticalPins.some(pin=>candidate.packages?.['']?.dependencies?.[privateName]===pin.version&&Object.entries(pin).every(([k,v])=>entry[k]===v))
        if (!accepted?.integrity?.startsWith('sha512-') || !analytical&&(entry.version !== accepted.version || entry.integrity !== accepted.integrity || entry.resolved !== accepted.resolved) || entry.link) fail('PRIVATE_PACKAGE_PIN_MISMATCH')
        found.add(privateName)
      }
      if (Object.hasOwn(LOCAL_PACKAGES, privateName)) {
        if (key !== `node_modules/${privateName}` || entry.link || ![LOCAL_PACKAGES[privateName], `file:${LOCAL_PACKAGES[privateName]}`].includes(entry.resolved)) fail('LOCAL_DEPENDENCY_REJECTED')
      }
    }
    if (entry.resolved) {
      if (!entry.resolved.includes('://')) {
        if (!Object.hasOwn(LOCAL_PACKAGES, privateName) || ![LOCAL_PACKAGES[privateName], `file:${LOCAL_PACKAGES[privateName]}`].includes(entry.resolved)) fail('LOCAL_DEPENDENCY_REJECTED')
      } else {
        const u = new URL(entry.resolved)
        if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || !['registry.npmjs.org', 'npm.pkg.github.com'].includes(u.hostname)) fail('PACKAGE_REGISTRY_REJECTED')
        if (u.hostname === 'npm.pkg.github.com' && !PRIVATE_PACKAGES.includes(privateName)) fail('PRIVATE_PACKAGE_REJECTED')
      }
    }
  }
  if (found.size !== PRIVATE_PACKAGES.length) fail('PRIVATE_PACKAGE_SET_MISMATCH')
}

export function assertManifestPolicy(candidate, authority, {reviewedPrivateRecurring=false}={}) {
  if (JSON.stringify(candidate.workspaces) !== JSON.stringify(authority.workspaces) || JSON.stringify(candidate.overrides) !== JSON.stringify(authority.overrides)) fail('DEPENDENCY_POLICY_CHANGE_REQUIRES_REVIEW')
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, spec] of Object.entries(candidate[section] ?? {})) {
      if (String(spec).includes('@profitia/')) fail('PRIVATE_PACKAGE_ALIAS_REJECTED')
      if (Object.hasOwn(LOCAL_PACKAGES, name) && spec === `file:${LOCAL_PACKAGES[name]}`) continue
      if(reviewedPrivateRecurring&&reviewedPrivateRecurringPeer(candidate.name,candidate.version,section,name,spec)){if(!reviewedPrivateRecurringAuthority(candidate,authority,section,name,spec))fail('PRIVATE_RECURRING_PEER_AUTHORITY_REJECTED');continue}
      if(reviewedReportPeer(candidate.name,candidate.version,section,name,spec)&&authority.name===candidate.name&&authority.version===candidate.version&&authority[section]?.[name]===spec)continue
      if (reviewedMapsPeer(candidate.name, candidate.version, section, name, spec)
        && authority.name === candidate.name && authority.version === candidate.version
        && authority[section]?.[name] === spec) continue
      const analytical=candidate.name==='@sg/runtime'&&section==='dependencies'&&name==='@profitia/cic-core'&&analyticalPins.some(pin=>spec===pin.version)
      if (name.startsWith('@profitia/') && (!PRIVATE_PACKAGES.includes(name) || !analytical&&spec !== authority[section]?.[name])) fail('PRIVATE_MANIFEST_PIN_MISMATCH')
      if (/^(?:file:|link:|workspace:)/.test(String(spec))) fail('LOCAL_DEPENDENCY_REJECTED')
    }
  }
}

// One explicit backward-compatibility decision for the untouched SG2 consumer.
// It grants no opt-in to the ECR-only 1.4 protocol. Full candidate admission,
// private artifacts, peer policy and token removal remain independent gates.
function reviewedEcrStage0405LegacyConsumer(root,candidateLock,name,entry,manifestPath,authorityFile){
 if(name!=='@profitia/platform-source-hub-contracts'||entry.version!=='1.6.0')return false
 const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')
 const file=path.join(root,'apps/sg-runtime/package-lock.json'),expected=ECR_STAGE0405_REVIEW.entries['packages/platform-source-hub-contracts/package.json'].sha
 if(!fs.existsSync(file)||!fs.existsSync(authorityFile))return false
 const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||fs.realpathSync(file)!==file)return false
 const bytes=fs.readFileSync(file)
 if(blob(bytes)!=='0ae03c01834736fb682323e184af79e984912c1a'||JSON.stringify(JSON.parse(bytes))!==JSON.stringify(candidateLock))return false
 if(blob(fs.readFileSync(manifestPath))!==expected)return false
 const authorityBlob=blob(fs.readFileSync(authorityFile))
 return authorityBlob==='05184f565c407177c50b524fd93346a07829c3b7'||authorityBlob===expected
}

export function assertLocalPackageSources(root, candidateLock, authorityRoot = controlRoot(), {reviewedStage2a=false,reviewedMarketSymbol=false,reviewedOilReport=false,reviewedPrivateRecurring=false}={}) {
  const canonicalRoot = fs.realpathSync(root)
  const app = path.join(canonicalRoot, 'apps/sg-runtime')
  if (fs.realpathSync(app) !== app) fail('LOCAL_DEPENDENCY_REJECTED')
  for (const [key, entry] of Object.entries(candidateLock.packages ?? {})) {
    if (!entry.resolved || entry.resolved.includes('://')) continue
    const name = key.split('node_modules/').at(-1)
    if (!Object.hasOwn(LOCAL_PACKAGES, name) || ![LOCAL_PACKAGES[name], `file:${LOCAL_PACKAGES[name]}`].includes(entry.resolved)) fail('LOCAL_DEPENDENCY_REJECTED')
    const expected = path.resolve(app, LOCAL_PACKAGES[name])
    if (!expected.startsWith(canonicalRoot + path.sep) || fs.realpathSync(expected) !== expected) fail('LOCAL_DEPENDENCY_REJECTED')
    const manifestPath = path.join(expected, 'package.json')
    if (fs.realpathSync(manifestPath) !== manifestPath) fail('LOCAL_DEPENDENCY_REJECTED')
    const manifest = readJson(manifestPath)
    if (manifest.name !== name) fail('LOCAL_PACKAGE_NAME_MISMATCH')
    const authorityFile = path.resolve(authorityRoot, 'apps/sg-runtime', LOCAL_PACKAGES[name], 'package.json')
    const reviewedEcrLegacy=manifest.version==='1.7.0'&&reviewedEcrStage0405LegacyConsumer(canonicalRoot,candidateLock,name,entry,manifestPath,authorityFile)
    if (typeof manifest.version !== 'string' || manifest.version !== entry.version&&!reviewedEcrLegacy) fail('LOCAL_PACKAGE_VERSION_MISMATCH')
    let authority
    if(!fs.existsSync(authorityFile)){
      const relative=path.relative(canonicalRoot,manifestPath).split(path.sep).join('/'),review=OIL_REPORT_E1_REVIEW.entries[relative],bytes=fs.readFileSync(manifestPath),blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
      if(!reviewedOilReport||!['@profitia/insights-runtime','@profitia/insights-contracts'].includes(name)||!review||review.sha!==blob)fail('LOCAL_PACKAGE_AUTHORITY_REQUIRED');
      authority=manifest;
    }else authority=reviewedEcrLegacy?manifest:readJson(authorityFile)
    if(name==='@profitia/maps-embed'){
      if(JSON.stringify(entry.peerDependencies??{})!==JSON.stringify(manifest.peerDependencies??{}))fail('LOCAL_PACKAGE_PEER_MISMATCH')
      if(reviewedMarketSymbol&&manifest.peerDependencies?.['@profitia/platform-contracts']===REVIEWED_MAPS_EMBED_PEERS['@profitia/platform-contracts']+' || 1.33.0 || 1.34.0'&&authority.peerDependencies?.['@profitia/platform-contracts']!==manifest.peerDependencies['@profitia/platform-contracts']){
        const bytes=fs.readFileSync(manifestPath),blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')
        if(blob!==SOURCE_HUB_MARKET_SYMBOL_REVIEW.blobs['packages/maps-embed/package.json']||authority.name!==manifest.name||authority.version!==manifest.version||authority.peerDependencies?.['@profitia/platform-contracts']!==REVIEWED_MAPS_EMBED_PEERS['@profitia/platform-contracts']+' || 1.33.0')fail('MARKET_SYMBOL_PEER_TRANSITION_REJECTED')
        authority=structuredClone(authority);authority.peerDependencies['@profitia/platform-contracts']=manifest.peerDependencies['@profitia/platform-contracts']
      }
      if(reviewedStage2a&&manifest.peerDependencies?.['@profitia/platform-contracts']===REVIEWED_MAPS_EMBED_PEERS['@profitia/platform-contracts']+' || 1.33.0'){
        const bytes=fs.readFileSync(manifestPath),blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')
        if(blob!==SOURCE_HUB_STAGE2A_REVIEW.blobs['packages/maps-embed/package.json']||authority.name!==manifest.name||authority.version!==manifest.version
          ||authority.peerDependencies?.['@profitia/platform-contracts']!==REVIEWED_MAPS_EMBED_PEERS['@profitia/platform-contracts'])fail('SOURCE_HUB_STAGE2A_PEER_TRANSITION_REJECTED')
        authority=structuredClone(authority);authority.peerDependencies['@profitia/platform-contracts']=manifest.peerDependencies['@profitia/platform-contracts']
      }
    }
    assertManifestPolicy(manifest, authority, {reviewedPrivateRecurring})
  }
}

export function assertProof(proof, run, candidateSha, workflowId, {currentRunId, currentRef, completedJobs = [], expectedControlDigest = controlPolicyDigest()} = {}) {
  const sameRun = String(run.id) === String(currentRunId) && currentRef === 'refs/heads/main' && run.event === 'push' && completedJobs.some(j => j.name === 'SG2 controlled operation integration' && j.conclusion === 'success')
  if (run.workflow_id !== workflowId || run.repository?.full_name !== REPOSITORY || run.head_branch !== 'main' || !['push', 'workflow_dispatch'].includes(run.event) || run.actor?.login !== 'profitia' || (!sameRun && run.conclusion !== 'success')) fail('UNTRUSTED_VALIDATION_RUN')
  if (proof.schemaVersion !== '1.0' || proof.repository !== REPOSITORY || proof.projectKey !== 'SG2' || proof.targetEnvironment !== 'development' || proof.scope !== 'ISOLATED_API_AND_PERSISTENCE' || proof.candidateSha !== candidateSha || proof.controlSha !== run.head_sha || String(proof.runId) !== String(run.id) || proof.workflow !== WORKFLOW) fail('VALIDATION_PROVENANCE_MISMATCH')
  if (proof.credentialRemovedBeforeCandidateExecution !== true || proof.privatePackageArtifactsPublished !== false || proof.productDeploymentPerformed !== false || proof.customerIdentityAdapterVerified !== false || proof.install !== 'CLEAN_REGISTRY_IGNORE_SCRIPTS' || proof.tests !== 'PASS' || proof.typecheck !== 'PASS' || proof.build !== 'PASS') fail('VALIDATION_INCOMPLETE')
  if (proof.controlPolicyDigest !== expectedControlDigest) fail('CONTROL_POLICY_PROVENANCE_MISMATCH')
  if (proof.contract?.id !== 'profitia.operation-context' || !/^[a-f0-9]{64}$/.test(proof.contract?.sourceDigest ?? '')) fail('CONTRACT_PROVENANCE_MISMATCH')
  return proof
}

function context(env = process.env) {
  return {repository: env.GITHUB_REPOSITORY, ref: env.GITHUB_REF, workflowRef: env.GITHUB_WORKFLOW_REF, event: env.GITHUB_EVENT_NAME, actor: env.GITHUB_ACTOR, triggeringActor: env.GITHUB_TRIGGERING_ACTOR, controlSha: env.GITHUB_SHA}
}
function controlRoot() {return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')}
export const CONTROL_POLICY_FILES = Object.freeze([WORKFLOW, 'scripts/governance/controlled-package-ci.mjs', 'Canon/registries/architecture-environment-topology-v1.json',
  'scripts/governance/project-profile.mjs', 'scripts/governance/routing-engine.mjs', 'scripts/architecture-classify.mjs',
  'Canon/registries/profitia-projects-v1.json', 'Canon/registries/current-architecture-baseline-v1.json'])
const policyFiles = CONTROL_POLICY_FILES
export function controlPolicyDigest(root = controlRoot()) {
  const digest = createHash('sha256')
  for (const name of policyFiles) digest.update(fs.readFileSync(path.join(root, name)))
  return digest.digest('hex')
}
function candidateRoot() {return path.resolve(process.env.CANDIDATE_ROOT ?? fail('CANDIDATE_ROOT_REQUIRED'))}
function statePath() {return path.join(process.env.RUNNER_TEMP ?? fail('RUNNER_TEMP_REQUIRED'), 'controlled-package-resolution.json')}
function readJson(file) {return JSON.parse(fs.readFileSync(file, 'utf8'))}
function output(name, value) {if (!process.env.GITHUB_OUTPUT) fail('GITHUB_OUTPUT_REQUIRED'); fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)}
async function api(endpoint, token = process.env.GH_TOKEN) {
  const response = await fetch(`https://api.github.com/${endpoint}`, {redirect: 'error', headers: {'Accept': 'application/vnd.github+json', ...(token ? {Authorization: `Bearer ${token}`} : {})}})
  if (!response.ok) fail(`GITHUB_API_${response.status}`)
  return {data: await response.json(), headers: response.headers}
}
async function checkEnvironment() {
  const registered = readJson(path.join(controlRoot(), 'Canon/registries/architecture-environment-topology-v1.json')).environments.development.github
  const endpoint = `repos/${REPOSITORY}/environments/${encodeURIComponent(registered.environmentName)}`
  const [environment, branches] = await Promise.all([api(endpoint), api(`${endpoint}/deployment-branch-policies`)])
  assertEnvironment(environment.data, branches.data.branch_policies, registered)
  return registered
}
async function resolve() {
  const c = assertTrustedContext(context())
  if (execFileSync('git', ['rev-parse', 'HEAD'], {cwd: controlRoot(), encoding: 'utf8'}).trim() !== c.controlSha) fail('CONTROL_CHECKOUT_MISMATCH')
  const registered = await checkEnvironment()
  const number = process.env.CANDIDATE_PR ?? ''
  const {sha, admission} = await resolveCandidateAdmission(c, number, process.env.EXPECTED_SHA)
  let receipt
  try {receipt = (await api(`repos/${REPOSITORY}/contents/apps/sg-runtime/operation-integration.json?ref=${sha}`)).data}
  catch (error) {if (!number && error.message === 'GITHUB_API_404') {output('adopted', 'false'); console.log('NOT_ADOPTED: no SG2 runtime proof claimed'); return}; throw error}
  receipt = JSON.parse(Buffer.from(receipt.content, 'base64').toString('utf8'))
  assertReceipt(receipt)
  fs.writeFileSync(statePath(), JSON.stringify({sha, controlSha: c.controlSha, runId: process.env.GITHUB_RUN_ID, receipt, registered, ...(admission ? {admission} : {})}), {mode: 0o600})
  output('adopted', 'true'); output('candidate_sha', sha)
  console.log(`Accepted internal SG2 source ${sha}; control ${c.controlSha}`)
}
/** Static, closed source layouts. Candidate data selects neither file paths nor
 * executable hashing code. Candidate15 binds its imported request metadata and optional SQL;
 * candidate16 adds the fixed supplier-location policy/types/installation; it may never fall back to the legacy two files. */
export function operationContractProvenanceDigest(root, contract, {reviewedPrivateRecurring=false}={}) {
  assertOperationContractMetadata(contract)
  const legacy = /^1\.0\.0-candidate\.([1-9][0-9]*)$/.exec(contract?.implementation ?? '')
  if (!legacy || Number(legacy[1]) > 16) fail('CONTRACT_SOURCE_LAYOUT_UNSUPPORTED')
  const names = ['src/operation-context.mjs', 'src/operation-context.d.mts',
    ...(Number(legacy[1]) >= 15 ? ['src/request-operations.mjs', 'src/request-operations.d.mts', 'migrations/access/017-additional-request-operations.sql'] : []),
    ...(Number(legacy[1]) === 16 ? ['src/supplier-location.mjs', 'src/supplier-location.d.mts', 'migrations/access/019-supplier-location-operations.sql'] : [])]
  let base, contents
  try {
    base = fs.realpathSync(root)
    const read = name => {
      const file = path.join(base, 'packages/platform-contracts', name)
      const stat = fs.lstatSync(file)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024 || fs.realpathSync(file) !== file) fail('CONTRACT_SOURCE_FILE_REJECTED')
      return fs.readFileSync(file)
    }
    contents = names.map(read)
    const source=contents[0].toString('utf8')
    const assistant=/^export const ASSISTANT_ROOT_CONTRACT=Object\.freeze\(\{\.\.\.OPERATION_CONTRACT,implementation:'1\.0\.0-candidate\.20'\}\)$/m.test(source)
    if(assistant){
      if(Number(legacy[1])!==16)fail('CONTRACT_SOURCE_LAYOUT_UNSUPPORTED')
      contents.push(...['src/assistant-usage.mjs','src/assistant-usage.d.mts'].map(read))
    }else if(source.includes('./assistant-usage.mjs'))fail('CONTRACT_SOURCE_LAYOUT_UNSUPPORTED')
    if(source.includes('./recurring-job.mjs')){
      if(!reviewedPrivateRecurring||Number(legacy[1])!==16)fail('CONTRACT_SOURCE_LAYOUT_UNSUPPORTED')
      contents.push(...['src/recurring-job.mjs','src/recurring-job.d.mts'].map(read))
    }
  } catch { fail('CONTRACT_SOURCE_FILE_REJECTED') }
  const identity = /^export\s+const\s+OPERATION_CONTRACT\s*=\s*Object\.freeze\(\s*\{\s*id:\s*'profitia\.operation-context',\s*version:\s*'1\.0\.0',\s*implementation:\s*'(1\.0\.0-candidate\.[1-9][0-9]*)'\s*\}\s*\)\s*;?\s*$/m.exec(contents[0].toString('utf8'))
  if (!identity || identity[1] !== contract.implementation) fail('CONTRACT_IMPLEMENTATION_MISMATCH')
  const digest = createHash('sha256')
  for (const content of contents) digest.update(content)
  return digest.digest('hex')
}
function checkCandidate() {
  const c = assertTrustedContext(context()), state = readJson(statePath()), root = candidateRoot()
  if (state.controlSha !== c.controlSha || state.runId !== process.env.GITHUB_RUN_ID || !shaPattern.test(state.sha) || execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim() !== state.sha) fail('CANDIDATE_CHECKOUT_MISMATCH')
  if (state.admission) assertArchitectureCheckout(root, state.sha, state.admission)
  const app = path.join(root, 'apps/sg-runtime'), recurring=assertPrivateRecurringProvenance(root), reviewedPrivateRecurring=!!recurring
  const candidateLock = readJson(path.join(app, 'package-lock.json'))
  assertPackagePolicy(candidateLock, readJson(path.join(controlRoot(), 'apps/sg-runtime/package-lock.json')), fs.readFileSync(path.join(app, '.npmrc'), 'utf8'),{reviewedPrivateRecurring})
  assertManifestPolicy(readJson(path.join(app, 'package.json')), readJson(path.join(controlRoot(), 'apps/sg-runtime/package.json')),{reviewedPrivateRecurring})
  assertLocalPackageSources(root, candidateLock, controlRoot(), {reviewedPrivateRecurring,reviewedOilReport:state.admission?.kind==='ARCHITECTURE'&&isPinnedOilReportReview(state.admission.files),reviewedStage2a:state.admission?.kind==='ARCHITECTURE'&&isPinnedSourceHubStage2aReview(state.admission.files),reviewedMarketSymbol:state.admission?.kind==='ARCHITECTURE'&&isPinnedMarketSymbolReview(state.admission.files)})
  if(state.receipt?.sdkSourceContinuations!==undefined)assertRegistrationSdkProvenance(root)
  const contract=currentProofContract(root,state.receipt)
  if (operationContractProvenanceDigest(root, contract,{reviewedPrivateRecurring}) !== contract.sourceDigest || JSON.stringify(readJson(path.join(app, 'operation-integration.json'))) !== JSON.stringify(state.receipt)) fail('CONTRACT_PROVENANCE_MISMATCH')
  return {state, app}
}
async function install() {
  const {app} = checkCandidate()
  const token = process.env.NPM_TOKEN
  if (!token) fail('CONTROLLED_PACKAGE_CREDENTIAL_REQUIRED')
  const identity = await api('user', token)
  assertCredentialMetadata({scopes: identity.headers.get('x-oauth-scopes'), expiresAt: identity.headers.get('github-authentication-token-expiration'), login: identity.data.login})
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'controlled-npm-cache-'))
  try {
    // Do not print captured npm output or upload its logs. No lifecycle code receives the token.
    const result = spawnSync('npm', ['ci', '--install-links', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd: app, env: {...process.env, NPM_CONFIG_CACHE: cache}, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024})
    if (result.status !== 0) fail('CONTROLLED_DEPENDENCY_INSTALL_FAILED')
    console.log('Clean registry installation completed with lifecycle scripts disabled')
  } finally {fs.rmSync(cache, {recursive: true, force: true})}
}
function proof() {
  if (process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN || process.env.GH_TOKEN) fail('CREDENTIAL_PRESENT_IN_EXECUTION_PHASE')
  const {state} = checkCandidate(), directory = path.join(process.env.RUNNER_TEMP, ARTIFACT)
  fs.mkdirSync(directory, {recursive: true})
  fs.writeFileSync(path.join(directory, 'proof.json'), JSON.stringify({schemaVersion: '1.0', repository: REPOSITORY, workflow: WORKFLOW, projectKey: 'SG2', targetEnvironment: 'development', scope: 'ISOLATED_API_AND_PERSISTENCE', candidateSha: state.sha, controlSha: state.controlSha, controlPolicyDigest: controlPolicyDigest(), runId: state.runId, contract: currentProofContract(candidateRoot(),state.receipt), install: 'CLEAN_REGISTRY_IGNORE_SCRIPTS', credentialRemovedBeforeCandidateExecution: true, privatePackageArtifactsPublished: false, tests: 'PASS', typecheck: 'PASS', build: 'PASS', productDeploymentPerformed: false, customerIdentityAdapterVerified: false}, null, 2))
  output('proof_sha', state.sha)
}
async function verify() {
  const sha = process.env.EXPECTED_SHA
  if (!shaPattern.test(sha ?? '')) fail('CANDIDATE_SHA_MISMATCH')
  await checkEnvironment()
  const workflow = (await api(`repos/${REPOSITORY}/actions/workflows/platform-contracts-ci.yml`)).data
  const listed = (await api(`repos/${REPOSITORY}/actions/workflows/${workflow.id}/runs?branch=main&status=success&per_page=50`)).data.workflow_runs
  const current = (await api(`repos/${REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`)).data
  const runs = current.head_branch === 'main' && current.event === 'push' ? [current, ...listed.filter(r => r.id !== current.id)] : listed
  for (const run of runs) {
    const artifacts = (await api(`repos/${REPOSITORY}/actions/runs/${run.id}/artifacts`)).data.artifacts.filter(a => a.name === ARTIFACT && !a.expired)
    if (artifacts.length !== 1) continue
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'controlled-proof-'))
    try {
      const downloaded = spawnSync('gh', ['run', 'download', String(run.id), '--repo', REPOSITORY, '--name', ARTIFACT, '--dir', directory], {stdio: 'pipe'})
      if (downloaded.status !== 0 || fs.readdirSync(directory).join(',') !== 'proof.json' || fs.statSync(path.join(directory, 'proof.json')).size > 16384) continue
      const p = readJson(path.join(directory, 'proof.json'))
      if (p.candidateSha !== sha) continue
      const jobs = String(run.id) === process.env.GITHUB_RUN_ID ? (await api(`repos/${REPOSITORY}/actions/runs/${run.id}/jobs`)).data.jobs : []
      assertProof(p, run, sha, workflow.id, {currentRunId: process.env.GITHUB_RUN_ID, currentRef: process.env.GITHUB_REF, completedJobs: jobs})
      const sourceFiles = await Promise.all(policyFiles.map(async name => Buffer.from((await api(`repos/${REPOSITORY}/contents/${name}?ref=${run.head_sha}`)).data.content, 'base64')))
      const actualControl = createHash('sha256'); for (const bytes of sourceFiles) actualControl.update(bytes)
      if (actualControl.digest('hex') !== p.controlPolicyDigest) fail('CONTROL_POLICY_PROVENANCE_MISMATCH')
      const receiptBytes=Buffer.from((await api(`repos/${REPOSITORY}/contents/apps/sg-runtime/operation-integration.json?ref=${sha}`)).data.content,'base64'),sourceReceipt=JSON.parse(receiptBytes)
      let recurringRecord=null;try{recurringRecord=Buffer.from((await api(`repos/${REPOSITORY}/contents/${PRIVATE_RECURRING_PROVENANCE.recordPath}?ref=${sha}`)).data.content,'base64')}catch(error){if(error.message!=='GITHUB_API_404')throw error}
      assertReceipt(sourceReceipt)
      if (JSON.stringify(p.contract) !== JSON.stringify(privateRecurringProofContract(sourceReceipt,recurringRecord,receiptBytes))) fail('CONTRACT_PROVENANCE_MISMATCH')
      console.log(`Verified actual SG2 tests/build for ${sha}: https://github.com/${REPOSITORY}/actions/runs/${run.id}`)
      return
    } finally {fs.rmSync(directory, {recursive: true, force: true})}
  }
  fail('CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const commands = {resolve, 'check-candidate': checkCandidate, install, proof, verify}
    const command = commands[process.argv[2]]
    if (!command) fail('UNKNOWN_CONTROLLED_CI_COMMAND')
    await command()
  } catch (error) {console.error(error.message?.match(/^[A-Z][A-Z0-9_]+$/) ? error.message : 'CONTROLLED_CI_FAILED_CLOSED'); process.exitCode = 1}
}
