// Exact source continuation only. This module never authorises data or runtime access.
import {procurementInsightsCompletionPredecessor} from './procurement-insights-completion-integrity.mjs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const PI_SHELL_RECEIPT='apps/sg-runtime/procurement-insights-shell-integration.json'
export const PI_SHELL_BASE='0775f8a18d2fbeca462bb0a9d654914b15c53dad'
export const PI_SHELL_PATHS=Object.freeze([
 'apps/architecture-lab/private-recurring-source.mjs',
 'apps/sg-runtime/middleware.ts',
 'apps/sg-runtime/tests/porr-demo-middleware.test.ts',
 'apps/sg-runtime/tests/procurement-insights-shell-integrity.mjs'
])
const hash=b=>createHash('sha256').update(b).digest('hex')
export function procurementInsightsShellPredecessor(current,historical){
 const completion=procurementInsightsCompletionPredecessor(current,historical);if(completion)return procurementInsightsShellPredecessor(completion.previousBytes,historical)
 let bytes
 try{bytes=current(PI_SHELL_RECEIPT)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>text.includes("'"+PI_SHELL_RECEIPT+s)))return null
  throw error
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','previousSourceSha','sourceDigests','preservedReceipts','authorisationChanged','sdkChanged','databaseChanged','deploymentPerformed'].sort())
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-PI-RECURRING-E2E-20261111');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.scope,'ADOPTED_NEUTRAL_PI_SHELL_ROUTING');assert.equal(a.previousSourceSha,PI_SHELL_BASE)
 for(const f of ['authorisationChanged','sdkChanged','databaseChanged','deploymentPerformed'])assert.equal(a[f],false,f)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...PI_SHELL_PATHS].sort())
 for(const p of PI_SHELL_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact PI shell source '+p)}
 const record='apps/architecture-lab/private-recurring-source.json'
 const previousRecord=JSON.parse(historical(PI_SHELL_BASE,record))
 const preserved=[record,...Object.keys(previousRecord.preservedReceipts),...['apps/architecture-lab','apps/sg-runtime','apps/srm'].map(p=>p+'/private-recurring-source-adoption.json')]
 assert.deepEqual(Object.keys(a.preservedReceipts).sort(),preserved.sort())
 for(const p of preserved){assert.equal(hash(historical(PI_SHELL_BASE,p)),a.preservedReceipts[p]);assert.equal(hash(current(p)),a.preservedReceipts[p],'immutable accepted receipt '+p)}
 const middleware='apps/sg-runtime/middleware.ts',before=Buffer.from(historical(PI_SHELL_BASE,middleware)).toString('utf8')
 const original='adp|benchmark-finder|xray',replacement=original+'|procurement-insights'
 assert.equal(before.split(original).length,2)
 assert.equal(Buffer.from(current(middleware)).toString('utf8'),before.replace(original,replacement),'only the adopted neutral PI shell is admitted')
 const added=new Set(['apps/sg-runtime/tests/procurement-insights-shell-integrity.mjs']),mapped=new Set(PI_SHELL_PATHS),cache=new Map()
 return{manifest:a,previousBytes:p=>{
  if(p===PI_SHELL_RECEIPT||added.has(p))throw Object.assign(Error('PI shell correction absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(PI_SHELL_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
