import test from 'node:test'
import assert from 'node:assert/strict'
import {assertSourceAdmission,exactBenchmarkSourceEntry,BENCHMARK_UNMETERED_SOURCE_ADMISSION as pin} from './development-execution.mjs'
const approved={
  "id": "ARCHITECTURE:ARCH-FINDER-UNMETERED-CONTRACT-20261118",
  "status": "ACTIVE",
  "repository": "profitia/SG-dev",
  "actor": "profitia",
  "taskId": "ARCH-FINDER-UNMETERED-CONTRACT-20261118",
  "targetEnvironment": "development",
  "scope": "SOURCE_VALIDATION_ONLY",
  "approvalRef": "owner:chat:01a1e92f-cd84-7a92-97d7-36d3fbc49ef0:20261118:finder-ci-approved-7edf89c0-cba7412b",
  "sourceSha": "7edf89c07502bc331f5d4966c961f7eb1058b51a",
  "baseSha": "a34dcdfc2b4e9c83e0112435a344d586d8c51d16",
  "validFrom": "2026-11-18T14:46:57.368Z",
  "validUntil": "2026-11-19T22:59:00.000Z",
  "files": [
    {
      "path": "apps/architecture-lab/benchmark-unmetered-source.json",
      "blob": "1995ff7a85556d980f8add3d72d41e109a319bbe",
      "mode": "100644",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    {
      "path": "apps/architecture-lab/test/sdk-compatibility.test.mjs",
      "blob": "3a0cd271d255cd5bba395f50d6328c4b6f10d378",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    {
      "path": "packages/platform-contracts/README.md",
      "blob": "fca4046621d6788ab5729a07738d8876b7bc9596",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs",
      "blob": "d697c78a79a36cacf5c8045d84939952dc24d668",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/migrations/access/034-unmetered-benchmark-requests.sql",
      "blob": "78029433d8e6634b29837e3bc3c41c5ea25879e7",
      "mode": "100644",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/migrations/access/035-source-technical-continuity.sql",
      "blob": "112162e2d516326e2615ef7d07eee46d3c702875",
      "mode": "100644",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs",
      "blob": "85e07cc53e5b7c1bc8f258ad32023e9bfd4a581e",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/external-call.mjs",
      "blob": "0adbcbc84466ca0484a458816d243b5f28973288",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/operation-context.d.mts",
      "blob": "6807cafb88bafb322dd104d43a96f0188c765a41",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/operation-context.mjs",
      "blob": "1856e05d3af0d2510fb000e41128fd9e14e194f9",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/platform-ingestion.d.mts",
      "blob": "0a26da96ad40279edd0d82f024cb09fd29d5504a",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/platform-ingestion.mjs",
      "blob": "9d56480b553ce6b11a35d165fadd3bdd96554807",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/private-operation-host.d.mts",
      "blob": "114b2eb958ea2177632eaa22802ec78f3ecdc068",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/private-operation-host.mjs",
      "blob": "c5db72d7c73b809cbe21d7d9fc57f6dd1741fa10",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/request-ledger.d.mts",
      "blob": "0063c25585f39a757121dc8e84a9a1ff454bd719",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/request-ledger.mjs",
      "blob": "df49251e17d7ccd0e99d88e1c383fb5b3f2767fd",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/assistant-reservation-source.mjs",
      "blob": "969b4dbf33a79e05371605cf485d222d372d4b06",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/assistant-reservation-source.test.mjs",
      "blob": "39165f91eb171f435f9c2678c2c0b60f3ac8b982",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/benchmark-unmetered-source.mjs",
      "blob": "5508b0ecd5b3c2afb15b612ee0f6fe4857969991",
      "mode": "100644",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/benchmark-unmetered-source.test.mjs",
      "blob": "d9884e1c3b58c6d715a5f1c07989c23e92d91b4c",
      "mode": "100644",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/private-operation-host.test.mjs",
      "blob": "b79ce3d64361fcbfd80a4d387648437d45a7dee3",
      "mode": "100644",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/source-technical-continuity.integration.test.mjs",
      "blob": "594e37922d1ef42bafb510fe713a609a8744ecbd",
      "mode": "100644",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/unmetered-benchmark-requests.integration.test.mjs",
      "blob": "c829743e2e31f8f306df2f2b8a3459e5e9f58e08",
      "mode": "100644",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    }
  ]
}
const root=new URL('../../',import.meta.url).pathname
const fixture=()=>{const r=structuredClone(approved);return {r,now:Date.parse(r.validFrom)+1000,state:{repository:r.repository,actor:r.actor,candidateSha:r.sourceSha,currentMainSha:r.baseSha,repositoryRoot:root,files:r.files.map(f=>({filename:f.path,sha:f.blob,status:f.status}))}}}
test('only the owner approved complete producer source inventory admits its one new record',()=>{const {r,state,now}=fixture();assert.equal(assertSourceAdmission(r,state,root,now),r);const e=r.files.find(e=>e.path===pin.newSourceRecord);assert.equal(exactBenchmarkSourceEntry(r,e),true);assert.equal(exactBenchmarkSourceEntry(r,{...e,path:'apps/architecture-lab/private-recurring-source.json'}),false)})
test('changed identity, scope, time, source, path, mode or any Git blob cannot inherit the approval',()=>{for(const change of [r=>r.status='REVOKED',r=>r.actor='foreign',r=>r.targetEnvironment='production',r=>r.scope='DEPLOYMENT',r=>r.sourceSha='0'.repeat(40),r=>r.baseSha='0'.repeat(40),r=>r.id+='-foreign',r=>r.files[0].blob='0'.repeat(40),r=>r.files[0].mode='100755',r=>r.files[0].owner='foreign',r=>r.files.push({...r.files[0]}),r=>r.files.splice(0,1),r=>r.files.find(e=>e.path===pin.newSourceRecord).path='Canon/registries/profitia-projects-v1.json']){const {r,state,now}=fixture();change(r);assert.throws(()=>assertSourceAdmission(r,state,root,now))}const {r,state}=fixture();assert.throws(()=>assertSourceAdmission(r,state,root,Date.parse(r.validUntil)));assert.throws(()=>assertSourceAdmission(r,state,root,Date.parse(r.validFrom)-1))})
test('transport refresh retains the approved source while other protected source, permissions and historical receipts remain closed',()=>{const {r,state,now}=fixture();assert.equal(assertSourceAdmission(r,{...state,candidateSha:'1'.repeat(40),currentMainSha:'2'.repeat(40)},root,now),r);for(const path of ['.github/workflows/platform-contracts-ci.yml','AGENTS.md','apps/sg-runtime/operation-integration.json','scripts/governance/development-execution.mjs']){const bad=structuredClone(r),i=bad.files.findIndex(e=>e.path===pin.newSourceRecord);bad.files[i].path=path;const altered={...state,files:bad.files.map(e=>({filename:e.path,sha:e.blob,status:e.status}))};assert.throws(()=>assertSourceAdmission(bad,altered,root,now))}})
