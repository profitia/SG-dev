// Exact source adoption for the account-entry correction. No runtime authority.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const REGISTRATION_ENTRY_PATH='apps/sg-runtime/registration-stage-i-integration.json'
export const REGISTRATION_ENTRY_BASE_SHA='b4cb5b7f7a731c2d845b569d21f09b88d84b3d8d'
export const REGISTRATION_ENTRY_PATHS=Object.freeze([
 'apps/sg-runtime/app/[locale]/account/page.tsx',
 'apps/sg-runtime/tests/appshell-product-boundary.test.ts',
 'apps/sg-runtime/tests/assistant-m2-integrity.mjs',
 'apps/sg-runtime/tests/pci-smart-integrity.test.mjs',
 'apps/sg-runtime/tests/procurement-insights-integrity.mjs',
 'apps/sg-runtime/tests/registration-stage-i-integrity.mjs',
 'apps/sg-runtime/tests/registration-stage-i-integrity.test.mjs'
])
export const REGISTRATION_ENTRY_PRESERVED=Object.freeze([
 'apps/sg-runtime/app/[locale]/dashboard/layout.tsx',
 'apps/sg-runtime/app/[locale]/page.tsx',
 'apps/sg-runtime/app/[locale]/register/page.tsx',
 'apps/sg-runtime/components/auth/account-landing.tsx',
 'apps/sg-runtime/components/auth/session-boundary.tsx',
 'apps/sg-runtime/lib/platform/account-session.ts',
 'apps/sg-runtime/middleware.ts',
 'apps/sg-runtime/package.json',
 'apps/sg-runtime/package-lock.json'
])
const receipts=['apps/sg-runtime/operation-integration.json','apps/sg-runtime/assistant-context-integration.json','apps/sg-runtime/procurement-insights-integration.json']
const hash=b=>createHash('sha256').update(b).digest('hex')
export function registrationStageOnePredecessor(current,historical){
 let bytes
 try{bytes=current(REGISTRATION_ENTRY_PATH)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&text.includes("'"+REGISTRATION_ENTRY_PATH+"' does not exist in "))return null
  throw error
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','previousSourceSha','sourceDigests','previousReceipts','authorisationChanged','sdkChanged','databaseChanged','deploymentPerformed'].sort())
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110')
 assert.equal(a.targetEnvironment,'development');assert.equal(a.scope,'ACCOUNT_ENTRY_SERVER_REDIRECT')
 assert.equal(a.previousSourceSha,REGISTRATION_ENTRY_BASE_SHA)
 for(const f of ['authorisationChanged','sdkChanged','databaseChanged','deploymentPerformed'])assert.equal(a[f],false,f)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...REGISTRATION_ENTRY_PATHS].sort())
 for(const p of REGISTRATION_ENTRY_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact account-entry source '+p)}
 assert.deepEqual(Object.keys(a.previousReceipts).sort(),[...receipts].sort())
 for(const p of receipts){assert.equal(hash(historical(a.previousSourceSha,p)),a.previousReceipts[p]);assert.equal(hash(current(p)),a.previousReceipts[p],'immutable earlier receipt '+p)}
 for(const p of REGISTRATION_ENTRY_PRESERVED)assert.deepEqual(Buffer.from(current(p)),Buffer.from(historical(a.previousSourceSha,p)),'unchanged account guard, registration, middleware or dependency '+p)
 const mapped=new Set(REGISTRATION_ENTRY_PATHS),cache=new Map()
 return{manifest:a,previousBytes:p=>{
  if(p===REGISTRATION_ENTRY_PATH)throw Object.assign(Error('Account entry adoption absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(a.previousSourceSha,p)))
  return Buffer.from(cache.get(p))
 }}
}
