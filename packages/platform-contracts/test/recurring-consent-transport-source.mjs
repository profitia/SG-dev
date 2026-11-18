// Test-only source continuation; never imported by a product runtime.
import {procurementInsightsLiveAcceptancePredecessor} from '../../../apps/sg-runtime/tests/procurement-insights-live-acceptance-source.mjs';
import assert from 'node:assert/strict';
import {completeFunctionalPredecessor} from '../../../apps/architecture-lab/ecr-complete-functional-source.mjs';
import {createHash} from 'node:crypto';
export const RECURRING_CONSENT_TRANSPORT_RECORD='packages/platform-contracts/test/recurring-consent-transport-source.json';
export const RECURRING_CONSENT_TRANSPORT_BASE='0c5a6ce71127f13402a14b256745e0fb0ffd5a1d';
export const RECURRING_CONSENT_TRANSPORT_PATHS=Object.freeze([
 'packages/platform-contracts/current-e1-authority/recurring.mjs',
 'packages/platform-contracts/test/recurring-consent-transport.test.mjs',
 'packages/platform-contracts/test/recurring-consent-transport-source.mjs',
 'apps/architecture-lab/private-recurring-source.mjs',
 'apps/sg-runtime/tests/procurement-insights-completion-integrity.mjs',
 'apps/sg-runtime/components/procurement-insights/workspace.css',
 'apps/sg-runtime/market-calendar-integration.json',
 'apps/sg-runtime/components/procurement-insights/market-calendar.css',
 'apps/sg-runtime/components/procurement-insights/market-calendar.tsx',
 'apps/sg-runtime/tests/market-calendar.test.tsx',
 'apps/platform-source-hub/scripts/ci-routing.mjs',
 'apps/platform-source-hub/test/ci-routing.test.mjs',
 'apps/sg-runtime/tests/porr-demo-middleware.test.ts',
 'apps/srm/scripts/private-host.integration.test.mjs',
 'apps/srm/scripts/supplier-location-admission.integration.test.mjs',
]);
const added=new Set(RECURRING_CONSENT_TRANSPORT_PATHS.slice(1,3));
const hash=b=>createHash('sha256').update(b).digest('hex');
export function recurringConsentTransportPredecessor(current,historical){
 const complete=completeFunctionalPredecessor(current,historical);
 if(complete)return recurringConsentTransportPredecessor(complete.previousBytes,historical);
 const live=procurementInsightsLiveAcceptancePredecessor(current,historical);
 if(live){const accepted=recurringConsentTransportPredecessor(live.previousBytes,historical);assert(accepted);return {...accepted,live};}
 let bytes;try{bytes=current(RECURRING_CONSENT_TRANSPORT_RECORD)}catch(error){
  const text=String(error?.stderr??error?.message??'');
  if(error?.code==='ENOENT'||error?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>text.includes("'"+RECURRING_CONSENT_TRANSPORT_RECORD+s)))return null;
  throw error;
 }
 const a=JSON.parse(bytes);
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','baseCandidateSha','reviewBaseSha','reviewedPaths','sourceDigests','preservedReceipts','authorisationChanged','schemaChanged','providerCallsPerformed','deploymentPerformed'].sort());
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'ARCH-PI-RECURRING-E1-20261111');assert.equal(a.targetEnvironment,'development');
 assert.equal(a.scope,'RECURRING_CONSENT_BEARER_TRANSPORT_CORRECTION');assert.equal(a.baseCandidateSha,RECURRING_CONSENT_TRANSPORT_BASE);assert.equal(a.reviewBaseSha,'99cd4aa1591ba2fc3a387ce637f920dac74880be');
 for(const flag of ['authorisationChanged','schemaChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag);
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...RECURRING_CONSENT_TRANSPORT_PATHS].sort());
 for(const p of RECURRING_CONSENT_TRANSPORT_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact recurring consent transport source '+p);}
 const receipt='apps/sg-runtime/procurement-insights-completion-integration.json';
 const completion=JSON.parse(historical(RECURRING_CONSENT_TRANSPORT_BASE,receipt));
 const reviewed=[...Object.keys(completion.sourceDigests),receipt,...RECURRING_CONSENT_TRANSPORT_PATHS.slice(0,3),RECURRING_CONSENT_TRANSPORT_RECORD,'apps/platform-source-hub/scripts/ci-routing.mjs','apps/platform-source-hub/test/ci-routing.test.mjs',...RECURRING_CONSENT_TRANSPORT_PATHS.slice(12)];
 assert.deepEqual(a.reviewedPaths.slice().sort(),[...new Set(reviewed)].sort());
 const preserved=[...Object.keys(completion.preservedReceipts).filter(p=>!RECURRING_CONSENT_TRANSPORT_PATHS.includes(p)),receipt];
 assert.deepEqual(Object.keys(a.preservedReceipts).sort(),preserved.sort());
 for(const[p,digest]of Object.entries(a.preservedReceipts)){assert.equal(hash(historical(RECURRING_CONSENT_TRANSPORT_BASE,p)),digest);assert.equal(hash(current(p)),digest,'immutable accepted receipt '+p);}
 const mapped=new Set(RECURRING_CONSENT_TRANSPORT_PATHS),cache=new Map();
 return {manifest:a,previousBytes:p=>{
  if(p===RECURRING_CONSENT_TRANSPORT_RECORD||added.has(p))throw Object.assign(Error('Recurring consent correction absent from predecessor'),{code:'ENOENT'});
  if(!mapped.has(p))return current(p);
  if(!cache.has(p))cache.set(p,Buffer.from(historical(RECURRING_CONSENT_TRANSPORT_BASE,p)));
  return Buffer.from(cache.get(p));
 }};
}
