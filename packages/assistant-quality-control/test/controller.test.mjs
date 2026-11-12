import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {advanceIncident,nextAction,createQualityController} from '../src/controller.mjs'

const base='a'.repeat(40),head='b'.repeat(40),h='c'.repeat(64),now=100000
const incident=()=>({id:randomUUID(),revision:1,status:'OBSERVED',repairClass:'C1',causeFingerprint:h,baseSha:base,attemptsUsed:0,rollbacksUsed:0,pending:null,wakeAt:0})
function advance(r,a,v,t=now){return advanceIncident({...r,pending:{action:a,nonce:randomUUID()}},a,v,t)}
test('OFFLINE state contract requires deterministic diagnosis, independent red/green and complete protected regression',()=>{
 let r=incident();assert.equal(nextAction(r,now),'QUALIFY')
 assert.throws(()=>advance(r,'QUALIFY',{result:'DETERMINISTIC_FAILURE',method:'SEMANTIC_ADVISORY',repairClass:'C1',causeFingerprint:h}))
 r=advance(r,'QUALIFY',{result:'DETERMINISTIC_FAILURE',method:'DETERMINISTIC',repairClass:'C1',causeFingerprint:h});assert.equal(r.status,'TRIAGED')
 r=advance(r,'REPRODUCE',{result:'RED',baseSha:base,proofSha256:h});assert.equal(r.status,'REPRODUCED')
 r.attemptsUsed=1;r=advance(r,'EXECUTE',{result:'PATCH',baseSha:base,patch:{artifactSha256:h,treeSha256:h}})
 const good={result:'PASS',baseSha:base,artifactSha256:h,baseTest:'FAIL',candidateTest:'PASS',holdoutCases:200,criticalRegressions:0,accessViolations:0,criticalCasesPass:true,criticalRepeats:3,stable:true,correctnessDeltaPp:0,unjustifiedRefusalDeltaPp:0,scopeBeforeDefects:0,scopeAfterDefects:0,classCounts:{C1:100,C2:50,C3:50},proofSha256:h}
 for(const change of [{baseTest:'PASS'},{holdoutCases:199},{criticalRegressions:1},{accessViolations:1},{artifactSha256:'d'.repeat(64)},{correctnessDeltaPp:-1.1},{unjustifiedRefusalDeltaPp:2.1},{criticalRepeats:2},{stable:false},{criticalCasesPass:false}])assert.throws(()=>advance(r,'VERIFY',{...good,...change}))
 r=advance(r,'VERIFY',good);assert.equal(nextAction(r,now),'PROPOSE')
 r=advance(r,'PROPOSE',{result:'PR_READY',prNumber:123,headSha:head,artifactSha256:h});assert.equal(nextAction(r,now),'CHECKS')
 r=advance(r,'CHECKS',{result:'WAIT',headSha:head});assert.equal(nextAction(r,now),null)
 r=advance(r,'CHECKS',{result:'PASS',headSha:head,requiredChecksComplete:true,proofSha256:h},now+30000);assert.equal(nextAction(r,now+30000),'PROMOTE')
})
test('Failed work consumes at most two attempts; a changed base invalidates proofs without resetting attempts',()=>{
 const first=advance({...incident(),status:'PATCH_READY',attemptsUsed:1},'VERIFY',{result:'FAIL'});assert.equal(first.status,'REPRODUCED')
 const second=advance({...first,attemptsUsed:2},'EXECUTE',{result:'FAILED'});assert.equal(second.status,'NEEDS_TECHNICAL_REVIEW');assert.equal(nextAction(second,now),null)
 const changed=advance({...incident(),status:'VERIFIED',attemptsUsed:1},'PROMOTE',{result:'BASE_CHANGED',actualBaseSha:head})
 assert.equal(changed.status,'TRIAGED');assert.equal(changed.attemptsUsed,1);assert.equal(changed.reproduction,null);assert.equal(changed.baseSha,head)
})
test('Only independently confirmed own regression requests rollback; foreign deployment is never overwritten',()=>{
 let r=advance({...incident(),status:'VERIFIED',attemptsUsed:1},'PROMOTE',{result:'RELEASED',sourceSha:head,artifactSha256:h,configurationSha256:h,deployId:'fixture',lastKnownGoodSha:base,exactRuntimeVerified:true})
 r=advance(r,'VERIFY_RUNTIME',{result:'UNKNOWN',sourceSha:head});assert.equal(r.rollbackRequired,undefined)
 r=advance(r,'VERIFY_RUNTIME',{result:'PASS',sourceSha:head,answerVerified:true,proofSha256:h});assert.equal(r.status,'OBSERVING')
 r=advance(r,'OBSERVE',{result:'UNKNOWN',sourceSha:head},now+70000);assert.equal(r.rollbackRequired,undefined)
 r=advance(r,'OBSERVE',{result:'REGRESSION_CONFIRMED',sourceSha:head},now+140000);assert.equal(nextAction(r,now+140000),'ROLLBACK')
 r.rollbacksUsed=1;r=advance(r,'ROLLBACK',{result:'FOREIGN_DEPLOYMENT'});assert.equal(r.status,'NEEDS_TECHNICAL_REVIEW');assert.equal(r.classSuspended,true)
})
test('OFFLINE durable intent survives lost dispatch reply and restart; no second agent or attempt is started',async()=>{
 let r={...incident(),status:'REPRODUCED'},dispatches=0,attempts=0
 const store={
  claim:async()=>({record:structuredClone(r),leaseToken:'fixture'}),
  prepare:async o=>{assert.equal(o.revision,r.revision);attempts+=Number(o.consumeAttempt);r={...r,revision:r.revision+1,attemptsUsed:attempts,pending:{action:o.action,nonce:o.nonce}};return {record:structuredClone(r)}},
  recordExternal:async()=>{throw Error('No acknowledged ID expected')},complete:async()=>{throw Error('No completed run expected')},
  stop:async()=>{throw Error('Uncertain delivery must remain recoverable')},release:async()=>{},
 }
 const options={store,actions:{dispatch:async()=>{dispatches++;throw Object.assign(Error('Timeout'),{code:'DELIVERY_UNCERTAIN'})},reconcile:async()=>({state:'UNKNOWN'}),cancel:async()=>({state:'UNKNOWN',effects:'UNKNOWN'}),verify:async()=>{throw Error('No result')}},
  authorize:async()=>({manifest:{incidentId:r.id}}),budget:{ensureIncident:async()=>{},closeIncident:async()=>{}},now:()=>now,workerId:'fixture'}
 const one=await createQualityController(options).tick(r.id);assert.equal(one.waitingFor,'RECONCILIATION')
 const two=await createQualityController(options).tick(r.id);assert.equal(two.waitingFor,'UNKNOWN');assert.equal(dispatches,1);assert.equal(attempts,1)
})
test('Missing budget or revoked authority stops before dispatch',async()=>{
 for(const code of ['LIMIT_EXCEEDED','AUTHORITY_REVOKED']){
  const r={...incident(),status:'REPRODUCED'};let dispatched=0,stopped
  const store={claim:async()=>({record:r,leaseToken:'fixture'}),prepare:async()=>{throw Error('No work allowed')},recordExternal:async()=>{},complete:async()=>{},stop:async v=>(stopped=v.status,{...r,status:v.status}),release:async()=>{}}
  const c=createQualityController({store,actions:{dispatch:async()=>{dispatched++},reconcile:async()=>{},cancel:async()=>({state:'UNKNOWN',effects:'UNKNOWN'}),verify:async()=>{}},authorize:async()=>{if(code==='AUTHORITY_REVOKED')throw Object.assign(Error('Denied'),{code});return {manifest:{incidentId:r.id}}},budget:{ensureIncident:async()=>{throw Object.assign(Error('Limit'),{code})},closeIncident:async()=>{}},now:()=>now,workerId:'fixture'})
  await c.tick(r.id);assert.equal(dispatched,0);assert.equal(stopped,code==='LIMIT_EXCEEDED'?'BUDGET_STOP':'OUT_OF_SCOPE')
 }
})
test('Revocation keeps the pending execution until cancellation and lack of side effects are confirmed',async()=>{
 let r={...incident(),status:'REPRODUCED',attemptsUsed:1,pending:{action:'EXECUTE',nonce:randomUUID(),externalId:'fixture-run'}},cancelled=0,complete=0
 const store={claim:async()=>({record:structuredClone(r),leaseToken:'fixture'}),prepare:async()=>{throw Error('No new work')},recordExternal:async()=>{},complete:async v=>{complete++;r={...v.record,revision:r.revision+1};return structuredClone(r)},stop:async v=>{r={...r,status:v.status,revision:r.revision+1};return structuredClone(r)},release:async()=>{}}
 let confirmed=false
 const options={store,actions:{dispatch:async()=>{throw Error('No dispatch')},reconcile:async()=>{throw Error('No private replay')},cancel:async()=>{cancelled++;return confirmed?{state:'CONFIRMED_STOPPED',effects:'NONE'}:{state:'CANCELLING',effects:'UNKNOWN'}},verify:async()=>{}},authorize:async()=>{throw Object.assign(Error('Revoked'),{code:'AUTHORITY_REVOKED'})},budget:{ensureIncident:async()=>{},closeIncident:async()=>{}},workerId:'fixture',now:()=>now}
 assert.equal((await createQualityController(options).tick(r.id)).waitingFor,'RECONCILIATION');assert(r.pending);assert.equal(complete,0)
 confirmed=true;assert.equal((await createQualityController(options).tick(r.id)).status,'OUT_OF_SCOPE');assert.equal(r.pending,null);assert.equal(complete,1);assert.equal(cancelled,2)
})
test('An expired paid budget preserves free monitoring of an already deployed release',async()=>{
 const r={...incident(),status:'RELEASED',release:{sourceSha:head}},calls=[]
 const store={claim:async()=>({record:r,leaseToken:'fixture'}),prepare:async()=>{throw Error('No paid work')},recordExternal:async()=>{},complete:async()=>{},stop:async()=>{throw Error('Must preserve safety monitoring')},contain:async v=>{calls.push(v.reason);return {...r,status:'OBSERVING',classSuspended:true}},release:async()=>{}}
 const controller=createQualityController({store,actions:{dispatch:async()=>{throw Error('No dispatch')},reconcile:async()=>{},cancel:async()=>{},verify:async()=>{}},
  authorize:async(_,options)=>{assert.equal(options.containment,true);return {manifest:{incidentId:r.id}}},budget:{ensureIncident:async()=>{throw Object.assign(Error('Expired'),{code:'LIMIT_EXCEEDED'})},closeIncident:async()=>{}},workerId:'fixture',now:()=>now})
 assert.equal((await controller.tick(r.id)).waitingFor,'FREE_SAFETY_MONITORING');assert.deepEqual(calls,['LIMIT_EXCEEDED'])
})
