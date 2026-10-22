import {randomUUID} from 'node:crypto'
import type {Pool,PoolClient} from 'pg'
import {canonical,sha256,demand,calendarDate} from '@profitia/krs-registry-contracts'
import type {CompanySnapshot} from '@profitia/krs-registry-contracts'
import {bulletinIds,createKrsClient} from './client.js'
import {normalizeExtract} from './normalizer.js'
import {storeSnapshot} from './catalog.js'
import type {CatalogPublicationBoundary} from './e1.js'
import {RegistryError} from './errors.js'
export function warsawDay(now:number):string{
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
  const get=(name:string)=>parts.find(p=>p.type===name)!.value;return `${get('year')}-${get('month')}-${get('day')}`
}
export type SyncPlan={approvalRef:string;days:string[];maximumItems:number;maximumMilliseconds:number;maximumCalls:number}
export function validatePlan(plan:SyncPlan,now:number):void{
  demand(Object.keys(plan).sort().join(',')==='approvalRef,days,maximumCalls,maximumItems,maximumMilliseconds')
  demand(typeof plan.approvalRef==='string'&&plan.approvalRef.length>0&&plan.approvalRef.length<=256)
  demand(Array.isArray(plan.days)&&plan.days.length>=1&&plan.days.length<=31&&new Set(plan.days).size===plan.days.length&&plan.days.every(d=>calendarDate(d)&&d>'2021-12-08'&&d<warsawDay(now)),'UNAPPROVED_DAY_WINDOW')
  demand(Number.isInteger(plan.maximumItems)&&plan.maximumItems>=1&&plan.maximumItems<=10000&&Number.isInteger(plan.maximumCalls)&&plan.maximumCalls>=1&&plan.maximumCalls<=1000&&Number.isInteger(plan.maximumMilliseconds)&&plan.maximumMilliseconds>=1&&plan.maximumMilliseconds<=3600000,'INVALID_SYNC_BUDGET')
}
export async function transaction<T>(pool:Pool,work:(tx:PoolClient)=>Promise<T>):Promise<T>{
  const tx=await pool.connect();try{await tx.query('BEGIN');await tx.query("SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='5s'");const value=await work(tx);await tx.query('COMMIT');return value}catch(e){await tx.query('ROLLBACK');throw e}finally{tx.release()}
}
export async function enqueueBulletin(tx:PoolClient,day:string,bytes:Uint8Array,acquiredAt:string,refreshReference:string|null=null):Promise<{revision:string;count:number}>{
  demand(calendarDate(day)&&day>'2021-12-08');const ids=bulletinIds(bytes)
  demand(refreshReference===null||typeof refreshReference==='string'&&refreshReference.length>=1&&refreshReference.length<=256)
  const revision=await sha256(canonical({ids,refreshReference})),sourceDigest=await sha256(bytes)
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['krs-day:'+day])
  const old=(await tx.query('SELECT revision FROM krs_registry.checkpoints WHERE day=$1',[day])).rows[0]
  await tx.query("INSERT INTO krs_registry.checkpoints(day,revision,source_digest,state,acquired_at) VALUES($1,$2,$3,'PENDING',$4) ON CONFLICT(day) DO UPDATE SET revision=EXCLUDED.revision,source_digest=EXCLUDED.source_digest,acquired_at=EXCLUDED.acquired_at,state=CASE WHEN krs_registry.checkpoints.revision=EXCLUDED.revision THEN krs_registry.checkpoints.state ELSE 'PENDING' END",[day,revision,sourceDigest,acquiredAt])
  for(const id of ids){await tx.query("INSERT INTO krs_registry.companies(krs,entity_key,state) VALUES($1,$2,'UNKNOWN') ON CONFLICT DO NOTHING",[id,'PL:KRS:'+id]);await tx.query('INSERT INTO krs_registry.items(day,revision,krs) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[day,revision,id])}
  if(ids.length===0)await tx.query("UPDATE krs_registry.checkpoints SET state='COMPLETE' WHERE day=$1 AND revision=$2",[day,revision])
  // Corrected list, including removed items, remains represented by old immutable item revisions.
  void old;return {revision,count:ids.length}
}
export type QueueItem={day:string;revision:string;krs:string;lease_token:string}
export async function claim(pool:Pool,days:string[],leaseSeconds=60):Promise<QueueItem|null>{
  demand(leaseSeconds>=1&&leaseSeconds<=300&&days.length>=1&&days.length<=31)
  return transaction(pool,async tx=>{
    const r=await tx.query("SELECT i.day::text,i.revision,i.krs FROM krs_registry.items i JOIN krs_registry.checkpoints c ON c.day=i.day AND c.revision=i.revision WHERE i.day=ANY($1::date[]) AND (i.state='PENDING' OR (i.state='RUNNING' AND i.lease_until<clock_timestamp())) ORDER BY i.day,i.krs FOR UPDATE OF i SKIP LOCKED LIMIT 1",[days])
    const row=r.rows[0];if(!row)return null;const token=randomUUID()
    await tx.query("UPDATE krs_registry.items SET state='RUNNING',attempts=attempts+1,lease_token=$4,lease_until=clock_timestamp()+make_interval(secs=>$5) WHERE day=$1 AND revision=$2 AND krs=$3",[row.day,row.revision,row.krs,token,leaseSeconds])
    return {...row,lease_token:token}
  })
}
export async function finishItem(tx:PoolClient,item:QueueItem,snapshots:CompanySnapshot[],effectRef:string):Promise<void>{
  // Serialize only the short publication/checkpoint transaction, not remote Source work.
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['krs-day:'+item.day])
  const lock=await tx.query("SELECT 1 FROM krs_registry.items WHERE day=$1 AND revision=$2 AND krs=$3 AND state='RUNNING' AND lease_token=$4 AND lease_until>=clock_timestamp() FOR UPDATE",[item.day,item.revision,item.krs,item.lease_token])
  if(lock.rowCount!==1)throw new RegistryError('LEASE_LOST')
  demand(snapshots.length>=1&&snapshots.length<=2&&snapshots.every(s=>s.canonicalKrs===item.krs&&s.source.extract==='CURRENT'))
  let ref='';for(const snapshot of snapshots)ref=await storeSnapshot(tx,snapshot,effectRef+':'+snapshot.source.register)
  await tx.query("UPDATE krs_registry.items SET state='DONE',evidence_ref=$5,lease_token=NULL,lease_until=NULL,diagnostic=NULL WHERE day=$1 AND revision=$2 AND krs=$3 AND lease_token=$4",[item.day,item.revision,item.krs,item.lease_token,ref])
  await tx.query("UPDATE krs_registry.checkpoints c SET state='COMPLETE' WHERE day=$1 AND revision=$2 AND NOT EXISTS(SELECT 1 FROM krs_registry.items i WHERE i.day=c.day AND i.revision=c.revision AND i.state<>'DONE')",[item.day,item.revision])
}
export async function markFailed(pool:Pool,item:QueueItem,uncertain:boolean,diagnostic:string):Promise<void>{
  // Closed diagnostics only; never provider payload or private request data.
  const code=['IDENTIFIER_CONFLICT','KRS_UNAVAILABLE','KRS_HTTP_404','REGISTER_UNRESOLVED'].includes(diagnostic)?diagnostic:'SOURCE_UNAVAILABLE'
  await pool.query("UPDATE krs_registry.items SET state=$5,diagnostic=$6,lease_token=NULL,lease_until=NULL WHERE day=$1 AND revision=$2 AND krs=$3 AND lease_token=$4",[item.day,item.revision,item.krs,item.lease_token,uncertain?'UNCERTAIN':'FAILED',code])
}
export async function replayFailed(pool:Pool,day:string,revision:string,maximum:number):Promise<number>{
  demand(calendarDate(day)&&/^[a-f0-9]{64}$/.test(revision)&&Number.isInteger(maximum)&&maximum>=1&&maximum<=10000)
  // UNCERTAIN is deliberately excluded: reconcile the existing E1 receipt first, never blindly retry.
  return transaction(pool,async tx=>(await tx.query("WITH batch AS (SELECT day,revision,krs FROM krs_registry.items WHERE day=$1 AND revision=$2 AND state='FAILED' ORDER BY krs FOR UPDATE SKIP LOCKED LIMIT $3) UPDATE krs_registry.items i SET state='PENDING' FROM batch b WHERE (i.day,i.revision,i.krs)=(b.day,b.revision,b.krs)",[day,revision,maximum])).rowCount??0)
}
export function createSynchronizer(options:{pool:Pool;client:ReturnType<typeof createKrsClient>;publication:CatalogPublicationBoundary<PoolClient>;enabled?:boolean;now?:()=>number;refreshReference?:string}){
  const now=options.now??Date.now
  return {async run(plan:SyncPlan){
    if(!options.enabled)throw new RegistryError('SYNCHRONIZATION_DISABLED');validatePlan(plan,now());const started=now();let completed=0
    const budget=()=>{if(now()-started>=plan.maximumMilliseconds||options.client.diagnostics().attempts>=plan.maximumCalls)throw new RegistryError('SYNC_BUDGET_EXHAUSTED')}
    for(const day of [...plan.days].sort()){
      budget();const intent=await sha256(canonical({approvalRef:plan.approvalRef,day,action:'BULLETIN',run:started})),result=await options.client.get({operation:'DAILY',day},intent)
      demand(bulletinIds(result.bytes).length<=plan.maximumItems,'BULLETIN_EXCEEDS_APPROVED_QUEUE_BUDGET')
      const contentDigest=await sha256(result.bytes)
      await options.publication.publish({intentKey:intent,contentDigest},tx=>enqueueBulletin(tx,day,result.bytes,result.retrievedAt,options.refreshReference??null))
    }
    while(completed<plan.maximumItems){
      budget();const item=await claim(options.pool,plan.days);if(!item)break
      const intent=await sha256(canonical({day:item.day,revision:item.revision,krs:item.krs}))
      try{
        const snapshots:CompanySnapshot[]=[]
        // Both registers are bounded. A non-404 failure cannot be treated as a missing register.
        for(const register of ['P','S'] as const){
          budget();try{const r=await options.client.get({operation:'CURRENT',krs:item.krs,register},await sha256(intent+register));snapshots.push(await normalizeExtract(r.bytes,{krs:item.krs,register,extract:'CURRENT',retrievedAt:r.retrievedAt}))}catch(e){if(!(e instanceof RegistryError&&e.code==='KRS_HTTP_404'))throw e}
        }
        if(snapshots.length===0)throw new RegistryError('REGISTER_UNRESOLVED',null,'RESPONSE')
        if(snapshots.length===2&&(snapshots[0]!.nip!==snapshots[1]!.nip||snapshots[0]!.regon!==snapshots[1]!.regon))throw new RegistryError('IDENTIFIER_CONFLICT',null,'RESPONSE')
        const contentDigest=await sha256(canonical(snapshots.map(s=>s.source.contentDigest)))
        await options.publication.publish({intentKey:intent,contentDigest},(tx,effectRef)=>finishItem(tx,item,snapshots,effectRef))
        completed++
      }catch(e){const error=e as RegistryError;await markFailed(options.pool,item,error.certainty!=='RESPONSE'&&error.certainty!=='NOT_SENT',error.code);break}
    }
    return {completed,diagnostics:options.client.diagnostics(),coverage:'PROGRESSIVE' as const,backlog:(await options.pool.query("SELECT state,count(*)::int AS count FROM krs_registry.items GROUP BY state ORDER BY state")).rows}
  }}
}
