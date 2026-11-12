import {createHmac} from 'node:crypto'
import {TERMINAL_STATES} from './controller.mjs'

const fail=code=>{throw Object.assign(Error('Quality control store unavailable'),{code})}
const require=(v,c='CONTROL_RECORD_INVALID')=>{if(!v)fail(c)}
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const integer=v=>Number.isSafeInteger(v)&&v>=0
const states=['OBSERVED','TRIAGED','REPRODUCED','PATCH_READY','VERIFIED','RELEASED','OBSERVING',...TERMINAL_STATES]
const fields=new Set(['id','revision','status','repairClass','causeFingerprint','baseSha','attemptsUsed','rollbacksUsed','pending','wakeAt',
 'lastResult','reason','checks','reproduction','patch','verification','pr','release','observingUntil','rollbackRequired','runtimeProof','rollbackProof','classSuspended'])
function metadata(v,depth=0){
 require(depth<=5)
 if(v===null||typeof v==='boolean')return
 if(typeof v==='number'){require(integer(v));return}
 if(typeof v==='string'){require(/^[a-zA-Z0-9_:.-]{1,256}$/.test(v));return}
 require(v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length<=32)
 for(const [k,value]of Object.entries(v)){require(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(k)&&!['constructor','prototype','__proto__'].includes(k));metadata(value,depth+1)}
}
export function assertControlRecord(r){
 metadata(r);require(Buffer.byteLength(JSON.stringify(r))<=16384&&Object.keys(r).every(k=>fields.has(k)))
 require(uuid(r.id)&&integer(r.revision)&&r.revision>0&&states.includes(r.status)&&['C1','C2','C3'].includes(r.repairClass)
  &&hash(r.causeFingerprint)&&sha(r.baseSha)&&[0,1,2].includes(r.attemptsUsed)&&[0,1].includes(r.rollbacksUsed)&&integer(r.wakeAt))
 if(r.pending!==null)require(uuid(r.pending?.nonce)&&['QUALIFY','REPRODUCE','EXECUTE','VERIFY','PROPOSE','CHECKS','PROMOTE','VERIFY_RUNTIME','OBSERVE','ROLLBACK'].includes(r.pending?.action))
 return structuredClone(r)
}

/** Only IDs, hashes, bounded state and provider identifiers. No purpose grant,
 * private evidence or cost authority is manufactured by this adapter. */
export function createQualityStore({query,commandKey,schemaDigest,serviceId,now=Date.now}){
 require(typeof query==='function'&&typeof now==='function'&&hash(commandKey)&&hash(schemaDigest)&&uuid(serviceId),'EXPLICIT_STORE_BINDING_REQUIRED')
 const key=Buffer.from(commandKey,'hex')
 async function call(action,payload={}){
  const json=JSON.stringify({contract:'QualityControlStore/1.0.0',action,...payload,serviceId,schemaDigest,until:now()+10000})
  require(Buffer.byteLength(json)<=32768)
  let r
  try{r=(await query('SELECT sg2_assistant_quality_control.apply($1::text,$2::text) AS result',[json,createHmac('sha256',key).update(json).digest('hex')])).rows}
  catch(e){fail(e?.code==='P0001'&&['LEASE_LOST','IDEMPOTENCY_CONFLICT','ATTEMPTS_EXHAUSTED','ROLLBACK_ALREADY_ATTEMPTED','CONTROL_RECORD_INVALID','CLASS_SUSPENDED'].includes(e.message)?e.message:'CONTROL_STORE_UNAVAILABLE')}
  const v=r?.[0]?.result
  require(r?.length===1&&v?.applicationId==='spendguru'&&v.environment==='development'&&v.projectId==='autumn-waterfall-65938876'
   &&v.branchId==='br-dry-hall-b294222f'&&v.databaseName==='neondb'&&v.runtimeRole==='sg2_assistant_quality_controller'
   &&v.schemaDigest===schemaDigest&&v.serviceId===serviceId,'STORE_BINDING_MISMATCH')
  if(v.record)assertControlRecord(v.record)
  return v
 }
 const identity=o=>{require(uuid(o.id)&&uuid(o.leaseToken)&&integer(o.revision)&&o.revision>0);return {id:o.id,leaseToken:o.leaseToken,revision:o.revision}}
 return Object.freeze({
  async descriptor(){return call('DESCRIPTOR')},
  async create({id,repairClass,causeFingerprint,baseSha}){return (await call('CREATE',{record:assertControlRecord({id,revision:1,status:'OBSERVED',repairClass,causeFingerprint,baseSha,attemptsUsed:0,rollbacksUsed:0,pending:null,wakeAt:0})})).record},
  async listDue(){const r=await call('LIST_DUE');require(Array.isArray(r.ids)&&r.ids.length<=20&&r.ids.every(uuid));return r.ids},
  async claim({id,workerId,leaseMs}){require(uuid(id)&&leaseMs===30000&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(workerId));const r=await call('CLAIM',{id,workerId,leaseMs});if(r.status==='BUSY')return null;require(uuid(r.leaseToken));return {record:r.record,leaseToken:r.leaseToken}},
  async prepare(o){require(uuid(o.nonce)&&o.consumeAttempt===(o.action==='EXECUTE')&&o.consumeRollback===(o.action==='ROLLBACK')&&o.enforceReleaseWindow===(o.action==='PROMOTE'));return call('PREPARE',{...identity(o),actionName:o.action,nonce:o.nonce})},
  async recordExternal(o){require(uuid(o.nonce)&&typeof o.externalId==='string');return (await call('RECORD_EXTERNAL',{...identity(o),nonce:o.nonce,externalId:o.externalId})).record},
  async complete(o){require(uuid(o.nonce));return (await call('COMPLETE',{...identity(o),nonce:o.nonce,record:assertControlRecord(o.record)})).record},
  async stop(o){require(['OUT_OF_SCOPE','BUDGET_STOP','NEEDS_TECHNICAL_REVIEW'].includes(o.status)&&/^[A-Z][A-Z0-9_]{0,79}$/.test(o.reason));return (await call('STOP',{...identity(o),status:o.status,reason:o.reason})).record},
  async contain(o){require(['LIMIT_EXCEEDED','AUTHORITY_REVOKED','MANDATE_EXPIRED'].includes(o.reason));return (await call('CONTAIN',{...identity(o),reason:o.reason})).record},
  async release({id,leaseToken}){require(uuid(id)&&uuid(leaseToken));await call('RELEASE',{id,leaseToken})},
  async purge(){await call('PURGE')},
 })
}
