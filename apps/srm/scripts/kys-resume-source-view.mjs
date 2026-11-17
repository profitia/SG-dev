// Test-only validation of the bounded KYS delta. Historical shared receipts stay byte-identical.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const RECEIPT='apps/srm/operation-integration.json',ADOPTION='apps/srm/vercly-kys-resume-integration.json'
const BASE='16fd69465162e4b37ca968c46cb901ba2b7f9f12'
const PRODUCTION=["src/server/kys-cache.ts", "src/server/provider-source-transport.ts", "src/server/supplier-native-sensitive-store.ts", "src/server/supplier-native-sensitive.ts", "src/server/vercly-kys.ts", "src/server/xray-lookup.ts"]
const TESTS=["scripts/operation-context.integration.test.mjs", "scripts/private-sensitive.integration.test.mjs", "scripts/staging-rollback.test.mjs", "src/server/kys-cache.test.ts", "src/server/kys-orchestration.test.ts", "src/server/peer-read-boundary.test.ts", "src/server/supplier-location-geocoding-runtime.test.ts", "src/server/vercly-kys.test.ts"]
const hash=b=>createHash('sha256').update(b).digest('hex')
export function kysResumePredecessor(current,historical){
 const root=Buffer.from(current(RECEIPT)),complete=JSON.parse(root);let bytes
 try{bytes=current(ADOPTION)}catch(e){if(e?.code==='ENOENT')return {prior:complete,previousBytes:current};throw e}
 const a=JSON.parse(bytes)
 assert.equal(a.previousApplicationAuthority,BASE);assert.equal(a.taskId,'SRM-VERCLY-RESUME-20261117')
 assert.equal(a.paidPostRetryAllowed,false);assert.equal(a.resumptionMethod,'GET_EXISTING_CORRELATION_ONLY')
 const old=Buffer.from(historical(BASE,RECEIPT)),prior=JSON.parse(old)
 assert.deepEqual(root,old,'all historical shared-root bytes stay immutable')
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),PRODUCTION)
 assert.deepEqual(Object.keys(a.testSourceDigests).sort(),TESTS)
 for(const[p,h]of Object.entries({...a.applicationSourceDigests,...a.testSourceDigests}))assert.equal(hash(current('apps/srm/'+p)),h,'current KYS source '+p)
 for(const p of PRODUCTION)assert.equal(hash(historical(BASE,'apps/srm/'+p)),a.previousApplicationSourceDigests[p],p)
 const mapped=new Set([...PRODUCTION,...TESTS].map(p=>'apps/srm/'+p))
 return {prior,previousBytes:p=>p===RECEIPT?old:mapped.has(p)?historical(BASE,p):current(p)}
}
