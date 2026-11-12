// Test/build-only provenance. Never imported by a product runtime.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const PI_COMPLETION_RECEIPT='apps/sg-runtime/procurement-insights-completion-integration.json';
export const PI_COMPLETION_BASE='42e9d43ea846a5e6216faa18bfec8f939aac6971';
export const PI_COMPLETION_PATHS=Object.freeze([
 'apps/architecture-lab/private-recurring-source.mjs',
 'apps/architecture-lab/test/market-calendar-source.test.mjs',
 'apps/insights-runtime/src/publication-query.mjs',
 'apps/insights-runtime/src/subscription-api.mjs',
 'apps/insights-runtime/src/subscription-store.mjs',
 'apps/insights-runtime/tests/report-library.test.mjs',
 'apps/insights-runtime/tests/subscriptions.test.mjs',
 'apps/sg-runtime/components/procurement-insights/inline-item.tsx',
 'apps/sg-runtime/components/procurement-insights/reports.tsx',
 'apps/sg-runtime/components/procurement-insights/workspace.css',
 'apps/sg-runtime/components/procurement-insights/workspace.tsx',
 'apps/sg-runtime/package.json',
 'apps/sg-runtime/procurement-insights-shell-integration.json',
 'apps/sg-runtime/tests/porr-demo-middleware.test.ts',
 'apps/sg-runtime/tests/pci-smart-integrity.test.mjs',
 'apps/sg-runtime/tests/market-calendar-integrity.test.mjs',
 'apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs',
 'apps/sg-runtime/tests/procurement-insights-completion.test.mjs',
 'apps/sg-runtime/tests/procurement-insights-completion-integrity.mjs',
 'apps/sg-runtime/tests/procurement-insights-shell-integrity.mjs'
]);
const added=new Set(['apps/insights-runtime/src/publication-query.mjs','apps/insights-runtime/tests/report-library.test.mjs','apps/sg-runtime/procurement-insights-shell-integration.json','apps/sg-runtime/tests/procurement-insights-completion.test.mjs','apps/sg-runtime/tests/procurement-insights-completion-integrity.mjs','apps/sg-runtime/tests/procurement-insights-shell-integrity.mjs']);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function procurementInsightsCompletionPredecessor(current,historical){
 let bytes;try{bytes=current(PI_COMPLETION_RECEIPT)}catch(error){
  const text=String(error?.stderr??error?.message??'');
  if(error?.code==='ENOENT'||error?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>text.includes("'"+PI_COMPLETION_RECEIPT+s)))return null;
  throw error;
 }
 const a=JSON.parse(bytes);
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','baseCandidateSha','magicPathRevision','sourceDigests','preservedReceipts','authorisationChanged','schemaChanged','providerCallsPerformed','deploymentPerformed'].sort());
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-PI-RECURRING-E2E-20261111');assert.equal(a.targetEnvironment,'development');
 assert.equal(a.scope,'PROCUREMENT_INSIGHTS_LIBRARY_AND_SOURCE_ACTION_COMPLETION');assert.equal(a.baseCandidateSha,PI_COMPLETION_BASE);assert.match(a.magicPathRevision,/^\d{18}$/);
 for(const flag of ['authorisationChanged','schemaChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag);
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...PI_COMPLETION_PATHS].sort());
 for(const p of PI_COMPLETION_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact PI completion source '+p);}
 const source=JSON.parse(historical(PI_COMPLETION_BASE,'apps/architecture-lab/private-recurring-source.json'));
 const preserved=['apps/architecture-lab/private-recurring-source.json',...Object.keys(source.preservedReceipts),...['apps/architecture-lab','apps/sg-runtime','apps/srm'].map(p=>p+'/private-recurring-source-adoption.json'),'apps/sg-runtime/assistant-ecr-week-integration.json','apps/economic-calendar-runtime/market-calendar-preferences-integration.json','apps/architecture-lab/market-calendar-test-compatibility.json','apps/sg-runtime/market-calendar-integration.json','apps/sg-runtime/oil-renderer-integration.json'];
 assert.deepEqual(Object.keys(a.preservedReceipts).sort(),preserved.sort());
 for(const [p,digest]of Object.entries(a.preservedReceipts)){assert.equal(hash(historical(PI_COMPLETION_BASE,p)),digest);assert.equal(hash(current(p)),digest,'immutable source receipt '+p);}
 const mapped=new Set(PI_COMPLETION_PATHS),cache=new Map();
 return {manifest:a,previousBytes:p=>{
  if(p===PI_COMPLETION_RECEIPT||added.has(p))throw Object.assign(Error('PI completion absent from predecessor'),{code:'ENOENT'});
  if(!mapped.has(p))return current(p);
  if(!cache.has(p))cache.set(p,Buffer.from(historical(PI_COMPLETION_BASE,p)));
  return Buffer.from(cache.get(p));
 }};
}
