import {createHash, randomUUID} from 'node:crypto'

export const CONTRACT_ID = 'sg2.dev.five-case-denial-read.v1'
const old = 'srv-dapa3tid0e5s73f8bc5g:35c9284856bb9be5771f6381046ffbffaf39a9f6'
const current = 'srv-dapa3tid0e5s73f8bc5g:b4023cb02e10fc7045f8b2bc173224ae3da3cb5a'
export const CASES = Object.freeze([
 ['H1','2026-11-02T16:59:07Z','2026-11-02T16:59:19Z',old],
 ['H2','2026-11-02T17:10:02Z','2026-11-02T17:10:14Z',old],
 ['H3','2026-11-02T17:10:51Z','2026-11-02T17:11:03Z',old],
 ['H4','2026-11-02T17:13:46Z','2026-11-02T17:13:58Z',old],
 ['C1','2026-11-03T04:22:44Z','2026-11-03T04:22:56Z',current],
].map(([caseId,start,end,deploymentId])=>Object.freeze({caseId,start,end,deploymentId})))
const queries = Object.freeze({
 private:'SELECT profitia_sg2_d1_private.read_case($1::text) AS result',
 source:'SELECT profitia_sg2_d1_source.read_case($1::text) AS result',
})
const reasons = new Set(['UNSUPPORTED_CONTRACT','UNVERIFIED_IDENTITY','CONTEXT_INVALID','ENVIRONMENT_MISMATCH','APPLICATION_FEATURE_UNAVAILABLE','ACCESS_BASIS_INVALID','PERMISSION_DENIED','PRODUCT_UNAVAILABLE','RESOURCE_SCOPE_MISMATCH','DATA_CLASSIFICATION_UNKNOWN','DELEGATION_INVALID','DELIVERY_UNCERTAIN','RESOURCE_VERSION_CONFLICT','LIMIT_POLICY_UNAVAILABLE','LIMIT_EXCEEDED','IDEMPOTENCY_CONFLICT','AUDIT_UNAVAILABLE','POLICY_UNAVAILABLE','EXPLICIT_DENY'])
const fields = ['caseId','store','recorded_at','application_id','deploymentId','operation','phase','decision','reasonCode','event_count','firstCheckpoint','correlationEvidence']
const exact = (v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))
const fail = code=>{throw new Error(code)}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
function validateRow(row,c,store) {
 const pair=store==='source'
  ? row?.application_id==='spendguru-benchmark-source'&&row?.operation==='knowledge.ingest'
  : (row?.application_id==='spendguru'&&['benchmark.discovery.request','benchmark.discovery.read'].includes(row?.operation))
    ||(row?.application_id==='spendguru-benchmark-dispatch'&&row?.operation==='job.execute')
 if(!exact(row,fields)||row.caseId!==c.caseId||row.store!==store||!pair||row.deploymentId!==c.deploymentId
  ||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(row.recorded_at)
  ||!(Date.parse(row.recorded_at)>=Date.parse(c.start)&&Date.parse(row.recorded_at)<Date.parse(c.end))
  ||!['DECISION','FAILURE'].includes(row.phase)||row.decision!=='DENY'||!(row.reasonCode===null||reasons.has(row.reasonCode))
  ||row.event_count!==1||row.firstCheckpoint!=='NOT_RECORDED'||row.correlationEvidence!=='WINDOW_ONLY')fail('D1_PROJECTION_REJECTED')
 return Object.freeze({...row})
}

/** Offline controlled operator contract. No HTTP route, product runtime or arbitrary query API. */
export function createFiveCaseReader(config) {
 if(!exact(config,['environment','privateQuery','sourceQuery','audit','now'])||config.environment!=='development'
  ||typeof config.privateQuery!=='function'||typeof config.sourceQuery!=='function'||typeof config.now!=='function'
  ||typeof config.audit?.begin!=='function'||typeof config.audit?.complete!=='function'||typeof config.audit?.failure!=='function')fail('D1_CONFIGURATION_REJECTED')
 // Capture trusted adapters, so a caller cannot switch a connection during the read.
 const {privateQuery,sourceQuery,audit,now}=config
 const queryByStore={private:privateQuery,source:sourceQuery}
 const read=async function(...args) {
  if(args.length)fail('D1_INPUT_REJECTED')
  const executionRef=randomUUID(),rows=[],invocations=[]
  const intent=Object.freeze({contractId:CONTRACT_ID,executionRef,environment:'development',caseIds:CASES.map(c=>c.caseId),maxRows:100})
  let ack
  try { ack=await audit.begin(intent) }catch{fail('D1_AUDIT_UNAVAILABLE')}
  const validAck=()=>exact(ack,['durable','authorizationRef','expiresAt'])&&ack.durable===true&&uuid.test(ack.authorizationRef)
   &&Number.isFinite(now())&&Number.isFinite(Date.parse(ack.expiresAt))&&Date.parse(ack.expiresAt)>now()
   &&Date.parse(ack.expiresAt)-now()<=30*60*1000
  if(!validAck())fail('D1_AUTHORIZATION_REJECTED')
  try {
   for(const c of CASES)for(const store of ['private','source']) {
    if(!validAck())fail('D1_AUTHORIZATION_EXPIRED')
    const response=await queryByStore[store](queries[store],[c.caseId])
    if(!Array.isArray(response?.rows)||response.rows.length!==1||!exact(response.rows[0],['result']))fail('D1_PROJECTION_REJECTED')
    const v=response.rows[0].result
    if(!exact(v,['caseId','store','rows','invocationRef'])||v.caseId!==c.caseId||v.store!==store||!uuid.test(v.invocationRef)||!Array.isArray(v.rows)||v.rows.length>100)fail('D1_PROJECTION_REJECTED')
    rows.push(...v.rows.map(row=>validateRow(row,c,store)))
    invocations.push(Object.freeze({caseId:c.caseId,store,invocationRef:v.invocationRef,rowCount:v.rows.length}))
    if(rows.length>100)fail('D1_OVERFLOW')
   }
   if(!validAck())fail('D1_AUTHORIZATION_EXPIRED')
   const results=CASES.map(c=>Object.freeze({caseId:c.caseId,status:rows.some(r=>r.caseId===c.caseId)?'WINDOW_ONLY':'NOT_RECORDED'}))
   const output=Object.freeze({contractId:CONTRACT_ID,environment:'development',results:Object.freeze(results),rows:Object.freeze(rows)})
   const outputSha256=createHash('sha256').update(JSON.stringify(output)).digest('hex')
   const completion=await audit.complete(Object.freeze({...intent,authorizationRef:ack.authorizationRef,invocations:Object.freeze(invocations),rowCount:rows.length,outputSha256,correlationEvidence:'WINDOW_ONLY'}))
   if(!exact(completion,['durable','outputSha256'])||completion.durable!==true||completion.outputSha256!==outputSha256)fail('D1_AUDIT_UNAVAILABLE')
   return output
  }catch{
   // Never expose upstream exceptions, rows, partial results, SQL or credentials.
   try{await audit.failure(Object.freeze({...intent,authorizationRef:ack.authorizationRef,invocations:Object.freeze(invocations),status:'AUDIT_UNAVAILABLE'}))}catch{}
   fail('D1_READ_UNAVAILABLE')
  }
 }
 return Object.freeze({contractId:CONTRACT_ID,read})
}
