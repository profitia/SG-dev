import {randomUUID} from 'node:crypto'

export const TERMINAL_STATES=Object.freeze(['CLOSED','INSUFFICIENT_EVIDENCE','OUT_OF_SCOPE','BUDGET_STOP','ROLLED_BACK','NEEDS_TECHNICAL_REVIEW'])
const fail=code=>{throw Object.assign(Error('Quality controller refused transition'),{code})}
const require=(v,code='RESULT_INVALID')=>{if(!v)fail(code)}
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const positive=v=>Number.isSafeInteger(v)&&v>0
const cleanPatch=p=>p&&hash(p.artifactSha256)&&hash(p.treeSha256)

/** Called only after independent result verification. Neither an agent's report
 * nor a semantic verdict may be passed directly to this state transition. */
export function advanceIncident(record,action,result,now){
 require(record.pending?.action===action&&typeof result==='object'&&result!==null&&Number.isFinite(now))
 const n=structuredClone(record);n.pending=null;n.wakeAt=now;n.lastResult=result.result
 const retry=reason=>{
  n.status=n.attemptsUsed<2?'REPRODUCED':'NEEDS_TECHNICAL_REVIEW';n.reason=reason;n.checks=null
 }
 switch(action){
  case 'QUALIFY':
   if(result.result==='INSUFFICIENT_EVIDENCE'||result.result==='OUT_OF_SCOPE'){n.status=result.result;break}
   require(result.result==='DETERMINISTIC_FAILURE'&&result.method==='DETERMINISTIC'&&hash(result.causeFingerprint))
   require(result.repairClass===record.repairClass&&result.causeFingerprint===record.causeFingerprint)
   n.status='TRIAGED';break
  case 'REPRODUCE':
   if(result.result==='NOT_REPRODUCED'){n.status='INSUFFICIENT_EVIDENCE';n.reason='BASELINE_NOT_RED';break}
   require(result.result==='RED'&&result.baseSha===record.baseSha&&hash(result.proofSha256))
   n.status='REPRODUCED';n.reproduction={baseSha:result.baseSha,proofSha256:result.proofSha256};break
  case 'EXECUTE':
   require(record.attemptsUsed>=1&&record.attemptsUsed<=2)
   if(result.result==='FAILED'){retry('EXECUTION_FAILED');break}
   require(result.result==='PATCH'&&result.baseSha===record.baseSha&&cleanPatch(result.patch))
   n.status='PATCH_READY';n.patch=result.patch;n.checks=null;break
  case 'VERIFY':
   if(result.result==='FAIL'){retry('INDEPENDENT_VERIFICATION_FAILED');break}
   require(result.result==='PASS'&&result.baseSha===record.baseSha&&result.artifactSha256===record.patch?.artifactSha256
    &&result.baseTest==='FAIL'&&result.candidateTest==='PASS'&&result.holdoutCases>=200
    &&result.criticalRegressions===0&&result.accessViolations===0&&result.unverifiableCases===0&&result.criticalCasesPass===true&&result.criticalRepeats===3&&result.stable===true
    &&Number.isFinite(result.correctnessDeltaPp)&&result.correctnessDeltaPp>=-1&&Number.isFinite(result.unjustifiedRefusalDeltaPp)&&result.unjustifiedRefusalDeltaPp<=2
    &&Number.isSafeInteger(result.scopeBeforeDefects)&&result.scopeBeforeDefects>=0&&Number.isSafeInteger(result.scopeAfterDefects)&&result.scopeAfterDefects>=0
    &&(result.scopeBeforeDefects<10||result.scopeAfterDefects*2<=result.scopeBeforeDefects)
    &&['C1','C2','C3'].every(c=>Number.isSafeInteger(result.classCounts?.[c])&&result.classCounts[c]>=20)&&hash(result.proofSha256))
   n.status='VERIFIED';n.verification={proofSha256:result.proofSha256,artifactSha256:result.artifactSha256};n.checks=null;break
  case 'PROPOSE':
   require(result.result==='PR_READY'&&positive(result.prNumber)&&sha(result.headSha)&&result.artifactSha256===record.patch?.artifactSha256)
   n.status='VERIFIED';n.pr={number:result.prNumber,headSha:result.headSha};n.checks=null;break
  case 'CHECKS':
   require(result.headSha===record.pr?.headSha)
   if(result.result==='WAIT'){n.status='VERIFIED';n.wakeAt=now+30000;break}
   if(result.result==='FAIL'){retry('REQUIRED_CI_FAILED');break}
   require(result.result==='PASS'&&result.requiredChecksComplete===true&&hash(result.proofSha256))
   n.status='VERIFIED';n.checks={headSha:result.headSha,proofSha256:result.proofSha256};break
  case 'PROMOTE':
   if(result.result==='BASE_CHANGED'){
    require(sha(result.actualBaseSha));n.status='TRIAGED';n.baseSha=result.actualBaseSha;n.reproduction=null;n.patch=null;n.verification=null;n.checks=null;n.pr=null;n.reason='BASE_CHANGED';break
   }
   if(result.result==='FOREIGN_DEPLOYMENT'){n.status='NEEDS_TECHNICAL_REVIEW';n.reason='FOREIGN_DEPLOYMENT';break}
   require(result.result==='RELEASED'&&sha(result.sourceSha)&&hash(result.artifactSha256)&&hash(result.configurationSha256)
    &&typeof result.deployId==='string'&&result.deployId&&sha(result.lastKnownGoodSha)&&result.exactRuntimeVerified===true)
   n.status='RELEASED';n.release={sourceSha:result.sourceSha,artifactSha256:result.artifactSha256,configurationSha256:result.configurationSha256,
    deployId:result.deployId,lastKnownGoodSha:result.lastKnownGoodSha,releasedAt:now};n.observingUntil=now+30*60000;break
  case 'VERIFY_RUNTIME':
   require(result.sourceSha===record.release?.sourceSha)
   if(result.result==='REGRESSION_CONFIRMED'){n.status='OBSERVING';n.rollbackRequired=true;n.classSuspended=true;n.reason='CONFIRMED_RUNTIME_REGRESSION';break}
   if(result.result==='UNKNOWN'){n.status='RELEASED';n.wakeAt=now+60000;break}
   require(result.result==='PASS'&&result.answerVerified===true&&hash(result.proofSha256));n.status='OBSERVING';n.runtimeProof=result.proofSha256;break
  case 'OBSERVE':
   require(result.sourceSha===record.release?.sourceSha)
   if(result.result==='REGRESSION_CONFIRMED'){n.rollbackRequired=true;n.classSuspended=true;n.reason='CONFIRMED_REGRESSION';break}
   require(['STABLE','UNKNOWN'].includes(result.result))
   if(result.result==='STABLE'&&record.runtimeProof&&now>=record.observingUntil)n.status='CLOSED'
   else{n.status='OBSERVING';n.wakeAt=now+60000}
   break
  case 'ROLLBACK':
   require(record.rollbacksUsed===1)
   if(result.result==='FOREIGN_DEPLOYMENT'){n.status='NEEDS_TECHNICAL_REVIEW';n.reason='ROLLBACK_FOREIGN_DEPLOYMENT';n.classSuspended=true;break}
   require(result.result==='RESTORED'&&result.sourceSha===record.release?.lastKnownGoodSha&&result.exactRuntimeVerified===true&&hash(result.proofSha256))
   n.status='ROLLED_BACK';n.rollbackProof=result.proofSha256;n.classSuspended=true;break
  default:fail('ACTION_UNSUPPORTED')
 }
 return n
}

export function nextAction(record,now){
 require(Number.isFinite(now)&&Number.isSafeInteger(record.attemptsUsed)&&record.attemptsUsed>=0&&record.attemptsUsed<=2,'STATE_INVALID')
 if(TERMINAL_STATES.includes(record.status)||record.wakeAt>now)return null
 if(record.rollbackRequired){require(record.rollbacksUsed===0,'ROLLBACK_ALREADY_ATTEMPTED');return 'ROLLBACK'}
 switch(record.status){
  case 'OBSERVED':return 'QUALIFY'
  case 'TRIAGED':return 'REPRODUCE'
  case 'REPRODUCED':require(record.attemptsUsed<2,'ATTEMPTS_EXHAUSTED');return 'EXECUTE'
  case 'PATCH_READY':return 'VERIFY'
  case 'VERIFIED':return !record.pr?'PROPOSE':!record.checks?'CHECKS':'PROMOTE'
  case 'RELEASED':return 'VERIFY_RUNTIME'
  case 'OBSERVING':return 'OBSERVE'
  default:fail('STATE_INVALID')
 }
}

/** Durable outbox: record intent before any external action. A restart always
 * reconciles that nonce; it never treats a lost HTTP reply as permission to run
 * another agent. Store methods must enforce revision/lease and repository locks. */
export function createQualityController({store,actions,authorize,budget,now=Date.now,workerId}){
 require(typeof workerId==='string'&&workerId.length>0,'CONFIGURATION_REQUIRED')
 for(const [o,names]of [[store,['claim','prepare','recordExternal','complete','stop','release']],[actions,['dispatch','reconcile','cancel','verify']],[budget,['ensureIncident','closeIncident']]])for(const name of names)require(typeof o?.[name]==='function','CONFIGURATION_REQUIRED')
 require(typeof authorize==='function'&&typeof now==='function','CONFIGURATION_REQUIRED')
 return Object.freeze({async tick(id){
  const claimed=await store.claim({id,workerId,now:now(),leaseMs:30000});if(!claimed)return {status:'BUSY'}
  let record=claimed.record
  const identity=()=>({id,leaseToken:claimed.leaseToken,revision:record.revision})
  const cancelPending=async()=>{
   // A cancellation HTTP acknowledgement is not confirmation that a job
   // stopped, or that its earlier merge/deploy had no effect.
   const result=await actions.cancel(record.pending,{record})
   if(result.state==='CONFIRMED_STOPPED'&&result.effects==='OWN_RELEASE'&&record.pending.action==='PROMOTE'){
    // Cancellation cannot erase an already accepted provider deployment. Adopt
    // only independently verified own-release facts and keep free monitoring.
    const verified=await actions.verify('PROMOTE',result.releaseResult,{record,containment:true})
    require(verified.result==='RELEASED','CANCELLATION_EFFECT_UNVERIFIED')
    const changed=advanceIncident(record,'PROMOTE',verified,now())
    record=await store.complete({...identity(),nonce:record.pending.nonce,record:{...changed,status:'OBSERVING',classSuspended:true}})
    await budget.closeIncident(id)
    return {status:record.status,waitingFor:'FREE_SAFETY_MONITORING'}
   }
   if(result.state==='CONFIRMED_STOPPED'&&result.effects==='NONE'){
    const changed=record.release?{...record,status:'OBSERVING',classSuspended:true,wakeAt:now()+60000,pending:null}:{...record,pending:null}
    record=await store.complete({...identity(),nonce:record.pending.nonce,record:changed})
    await budget.closeIncident(id)
    return {status:record.status}
   }
   return {status:record.status,waitingFor:result.effects==='UNKNOWN'?'RECONCILIATION':'CANCELLATION'}
  }
  try{
   if(TERMINAL_STATES.includes(record.status))return record.pending?await cancelPending():{status:record.status}
   // authorize performs fresh mandate, data-purpose, source and revocation checks.
   // An already published release retains free safety monitoring and bounded
   // LKG restoration after the paid/data-purpose mandate expires. The port
   // must return only operational authority in that case, never a data grant.
   const authority=await authorize(record,{containment:record.rollbackRequired===true||!!record.release})
   require(authority?.manifest?.incidentId===id,'AUTHORITY_MISMATCH')
   const finish=async result=>{
    const verified=await actions.verify(record.pending.action,result,{record,authority})
    const changed=advanceIncident(record,record.pending.action,verified,now())
    record=await store.complete({...identity(),nonce:record.pending.nonce,record:changed})
    if(['CLOSED','ROLLED_BACK','INSUFFICIENT_EVIDENCE','OUT_OF_SCOPE','NEEDS_TECHNICAL_REVIEW'].includes(record.status))await budget.closeIncident(id)
    return {status:record.status}
   }
   if(record.pending){
    const external=await actions.reconcile(record.pending,{record,authority})
    if(external.state==='COMPLETE')return await finish(external.result)
    require(['UNKNOWN','RUNNING'].includes(external.state),'RECONCILIATION_INVALID')
    return {status:record.status,waitingFor:external.state,nonce:record.pending.nonce}
   }
   const action=nextAction(record,now());if(!action)return {status:record.status}
   if(['EXECUTE','PROPOSE','PROMOTE','VERIFY_RUNTIME'].includes(action))await budget.ensureIncident(id,{repairClass:record.repairClass,causeFingerprint:record.causeFingerprint,acceptanceRequired:true})
   const prepared=await store.prepare({...identity(),action,nonce:randomUUID(),now:now(),consumeAttempt:action==='EXECUTE',consumeRollback:action==='ROLLBACK',enforceReleaseWindow:action==='PROMOTE'})
   if(prepared.waitUntil)return {status:record.status,waitingUntil:prepared.waitUntil}
   record=prepared.record
   // All dispatch ports accept finite actions and immutable IDs/digests, never
   // an executable command, URL, transcript, or model-generated instruction.
   const dispatched=await actions.dispatch(action,{record,intent:record.pending,authority})
   if(dispatched.immediate!==undefined)return await finish(dispatched.immediate)
   require(typeof dispatched.externalId==='string'&&dispatched.externalId.length>0&&dispatched.externalId.length<=256,'EXTERNAL_ID_INVALID')
   record=await store.recordExternal({...identity(),nonce:record.pending.nonce,externalId:dispatched.externalId})
   return {status:record.status,waitingFor:'RUNNING',nonce:record.pending.nonce}
  }catch(error){
   // An external timeout leaves the committed intent intact for reconciliation.
   if(record.pending&&['DELIVERY_UNCERTAIN','PROVIDER_UNAVAILABLE','LEASE_LOST'].includes(error?.code))return {status:record.status,waitingFor:'RECONCILIATION'}
   if(record.release&&!record.pending){
    require(typeof store.contain==='function','CONTAINMENT_STORE_REQUIRED')
    record=await store.contain({...identity(),reason:['LIMIT_EXCEEDED','AUTHORITY_REVOKED','MANDATE_EXPIRED'].includes(error?.code)?error.code:'CONTROL_FAILURE'})
    return {status:record.status,waitingFor:'FREE_SAFETY_MONITORING'}
   }
   const reason=error?.code==='LIMIT_EXCEEDED'?'BUDGET_STOP':error?.code==='AUTHORITY_REVOKED'||error?.code==='MANDATE_EXPIRED'?'OUT_OF_SCOPE':'NEEDS_TECHNICAL_REVIEW'
   record=await store.stop({...identity(),status:reason,reason:error?.code??'CONTROL_FAILURE'})
   return record.pending?await cancelPending():{status:record.status}
  }finally{await store.release({id,leaseToken:claimed.leaseToken})}
 }})
}
