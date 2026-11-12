// Test/build-only continuation. No runtime, authorisation or deployment grant.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const PI_LIVE_ACCEPTANCE_RECORD='apps/sg-runtime/procurement-insights-live-acceptance.json';
export const PI_LIVE_ACCEPTANCE_BASE='82bcb78813937331d7822a96c5319b26e788abe1';
export const PI_LIVE_ACCEPTANCE_PATHS=Object.freeze([
 'apps/insights-runtime/src/host.mjs',
 'apps/insights-runtime/tests/host-pool-concurrency.test.mjs',
 'apps/sg-runtime/components/procurement-insights/workspace.tsx',
 'apps/sg-runtime/tests/procurement-insights-notification-navigation.test.tsx',
 'apps/sg-runtime/tests/procurement-insights-live-acceptance-source.mjs',
 'apps/sg-runtime/tests/procurement-insights-live-acceptance-source.test.mjs',
 'packages/platform-contracts/test/recurring-consent-transport-source.mjs'
]);
const additions=new Set(PI_LIVE_ACCEPTANCE_PATHS.filter(p=>p.includes('host-pool-concurrency')||p.includes('notification-navigation')||p.includes('live-acceptance-source')));
const hash=b=>createHash('sha256').update(b).digest('hex');
export function procurementInsightsLiveAcceptancePredecessor(current,historical){
 let bytes;try{bytes=current(PI_LIVE_ACCEPTANCE_RECORD)}catch(e){
  const text=String(e?.stderr??e?.message??'');
  if(e?.code==='ENOENT'||e?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>text.includes("'"+PI_LIVE_ACCEPTANCE_RECORD+s)))return null;
  throw e;
 }
 const a=JSON.parse(bytes);
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','baseCandidateSha','magicPathRevision','sourceDigests','preservedReceipts','authorisationChanged','schemaChanged','providerCallsPerformed','deploymentPerformed'].sort());
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-PI-RECURRING-E2E-20261111');assert.equal(a.targetEnvironment,'development');
 assert.equal(a.scope,'PI_LIVE_NOTIFICATION_AND_REPORT_POOL_CORRECTIONS');assert.equal(a.baseCandidateSha,PI_LIVE_ACCEPTANCE_BASE);assert.equal(a.magicPathRevision,'471325033734762496');
 for(const f of ['authorisationChanged','schemaChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[f],false,f);
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...PI_LIVE_ACCEPTANCE_PATHS].sort());
 for(const[p,h]of Object.entries(a.sourceDigests)){assert.match(h,/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),h,'exact live correction source '+p);}
 const completion='apps/sg-runtime/procurement-insights-completion-integration.json',transport='packages/platform-contracts/test/recurring-consent-transport-source.json';
 const expected=[...new Set([completion,transport,...Object.keys(JSON.parse(historical(PI_LIVE_ACCEPTANCE_BASE,completion)).preservedReceipts),...Object.keys(JSON.parse(historical(PI_LIVE_ACCEPTANCE_BASE,transport)).preservedReceipts)])].sort();
 assert.deepEqual(Object.keys(a.preservedReceipts).sort(),expected);
 for(const[p,h]of Object.entries(a.preservedReceipts)){assert.equal(hash(historical(PI_LIVE_ACCEPTANCE_BASE,p)),h);assert.equal(hash(current(p)),h,'immutable accepted receipt '+p);}
 const mapped=new Set(PI_LIVE_ACCEPTANCE_PATHS),cache=new Map();
 return{manifest:a,previousBytes:p=>{
  if(p===PI_LIVE_ACCEPTANCE_RECORD||additions.has(p))throw Object.assign(Error('Live corrections absent from predecessor'),{code:'ENOENT'});
  if(!mapped.has(p))return current(p);
  if(!cache.has(p))cache.set(p,Buffer.from(historical(PI_LIVE_ACCEPTANCE_BASE,p)));
  return Buffer.from(cache.get(p));
 }};
}
