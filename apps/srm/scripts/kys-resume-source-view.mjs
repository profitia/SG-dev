// Test-only current KYS delta validation and exact historical source view.
// The historical host receipt remains immutable. No product imports this file.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const RECEIPT='apps/srm/operation-integration.json'
const BASE='16fd69465162e4b37ca968c46cb901ba2b7f9f12'
const PRODUCTION=['src/server/kys-cache.ts','src/server/vercly-kys.ts','src/server/xray-lookup.ts','src/server/supplier-native-sensitive.ts','src/server/supplier-native-sensitive-store.ts','src/server/provider-source-transport.ts'].sort()
const TESTS=['scripts/xray-workflow-contract.test.ts','scripts/private-sensitive.integration.test.mjs','src/server/assistant-context-runtime.test.ts','src/server/company-source-policy.test.ts','src/server/full-ui-parity-adoption.test.ts','src/server/kys-cache.test.ts','src/server/kys-orchestration.test.ts','src/server/peer-read-boundary.test.ts','src/server/root-atomic-claim-adoption.test.ts','src/server/supplier-location-geocoding-runtime.test.ts','src/server/vercly-kys.test.ts'].sort()
const hash=b=>createHash('sha256').update(b).digest('hex')
export function kysResumePredecessor(current,historical){
 const complete=JSON.parse(current(RECEIPT)),a=complete.verclyKysResumeRecovery
 if(!a)return {prior:complete,previousBytes:current}
 assert.equal(a.previousApplicationAuthority,BASE);assert.equal(a.taskId,'SRM-VERCLY-RESUME-20261117')
 assert.equal(a.paidPostRetryAllowed,false);assert.equal(a.resumptionMethod,'GET_EXISTING_CORRELATION_ONLY')
 const old=Buffer.from(historical(BASE,RECEIPT)),prior=JSON.parse(old)
 const {verclyKysResumeRecovery,...preserved}=complete;assert.deepEqual(preserved,prior,'all prior receipts remain unchanged')
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),PRODUCTION)
 assert.deepEqual(Object.keys(a.testSourceDigests).sort(),TESTS)
 for(const [p,h]of Object.entries({...a.applicationSourceDigests,...a.testSourceDigests}))assert.equal(hash(current('apps/srm/'+p)),h,'current KYS source '+p)
 for(const p of PRODUCTION)assert.equal(hash(historical(BASE,'apps/srm/'+p)),a.previousApplicationSourceDigests[p],p)
 const mapped=new Set([...PRODUCTION,...TESTS].map(p=>'apps/srm/'+p))
 return {prior,previousBytes:p=>p===RECEIPT?old:mapped.has(p)?historical(BASE,p):current(p)}
}
