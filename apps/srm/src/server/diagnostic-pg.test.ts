import {EventEmitter} from 'node:events'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {instrumentDiagnosticPool,diagnosticSqlCategory} from './diagnostic-pg'
import {withDiagnosticRequest,type DiagnosticPacket} from './diagnostic-trace'
class Client{
 releases=0;lastPromise:Promise<unknown>|null=null;release=()=>{this.releases++}
 query(sql:string,values?:unknown,callback?:Function):unknown{
  const cb=typeof values==='function'?values:callback,error=sql==='FAIL'?Error('private-sql-error-9511855233'):null
  const result={command:/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)?sql:'SELECT',rows:[{fixture:'private-financial-value'}]}
  if(cb){queueMicrotask(()=>cb(error,result));return undefined}
  this.lastPromise=error?Promise.reject(error):Promise.resolve(result);return this.lastPromise
 }
}
class Pool extends EventEmitter{
 client=new Client();fail=false
 connect(callback?:Function):unknown{
  this.emit('connect',this.client)
  if(callback){queueMicrotask(()=>callback(this.fail?Error('private-connection-error'):null,this.client,this.client.release));return undefined}
  return this.fail?Promise.reject(Error('private-connection-error')):Promise.resolve(this.client)
 }
 query(sql:string){return new Promise((resolve,reject)=>{this.connect((err:unknown,c:Client,release:Function)=>{if(err){reject(err);return}c.query(sql,(error:unknown,result:unknown)=>{release();if(error)reject(error);else resolve(result)})})})}
}
test('actual raw client queries,BEGIN/COMMIT,connection occupancy and transaction are observed once',async()=>{
 const pool=instrumentDiagnosticPool(new Pool());assert.equal(instrumentDiagnosticPool(pool),pool);let packet:DiagnosticPacket|undefined
 await withDiagnosticRequest('search',undefined,async()=>{
  const client=await pool.connect() as Client
  await client.query('BEGIN');const result=client.query('SELECT private','hidden-parameter')
  assert.equal(result,client.lastPromise);await result;await client.query('COMMIT');client.release()
 },{enabled:true,emit:p=>{packet=p}})
 assert(packet);assert.equal(packet.sqlQueryCalls,3);assert.equal(packet.commandsKnown,3);assert.equal(packet.rows.filter(x=>x.category==='SQL_BEGIN').length,1)
 assert.equal(packet.resources.filter(x=>x.kind==='TRANSACTION'&&x.outcome==='COMMITTED').length,1)
 const transaction=packet.resources.find(x=>x.kind==='TRANSACTION')!,queries=packet.rows.filter(x=>x.kind==='SQL')
 assert(queries.every(q=>q.transactionId===transaction.id&&q.connectionId===transaction.connectionId));assert.match(transaction.id,/^[a-f0-9]{16}$/)
 assert.equal(packet.resources.filter(x=>x.kind==='CONNECTION'&&x.status==='CLOSED').length,1)
 assert.equal(packet.accountedMs,packet.totalMs);assert.equal(packet.unresolvedJoins,0)
 const encoded=JSON.stringify(packet);for(const secret of ['private-financial-value','hidden-parameter','SELECT private'])assert.equal(encoded.includes(secret),false)
})
test('Pool.query callback path is not counted twice and retains result/release',async()=>{
 const pool=instrumentDiagnosticPool(new Pool());let packet:DiagnosticPacket|undefined
 const result=await withDiagnosticRequest('search',undefined,()=>pool.query('SELECT fixture'),{enabled:true,emit:p=>{packet=p}})
 assert.deepEqual(result,{command:'SELECT',rows:[{fixture:'private-financial-value'}]});assert.equal(pool.client.releases,1);assert.equal(packet?.sqlQueryCalls,1)
})
test('failure,rollback and pool rejection remain failures without private error text',async()=>{
 const pool=instrumentDiagnosticPool(new Pool());let packet:DiagnosticPacket|undefined
 await withDiagnosticRequest('search',undefined,async()=>{
  const c=await pool.connect() as Client;await c.query('BEGIN');await assert.rejects(c.query('FAIL') as Promise<unknown>);await c.query('ROLLBACK');c.release()
 },{enabled:true,emit:p=>{packet=p}})
 assert.equal(packet?.sqlQueryCalls,3);assert.equal(packet?.commandCountIncomplete,true);assert(packet?.resources.some(x=>x.outcome==='ROLLED_BACK'))
 assert.equal(JSON.stringify(packet).includes('9511855233'),false)
 pool.fail=true;await assert.rejects(withDiagnosticRequest('search',undefined,()=>pool.connect() as Promise<unknown>,{enabled:true,emit:()=>{}}),/private-connection-error/)
})
test('finite SQL classification distinguishes security and register without exporting parameters',()=>{
 assert.equal(diagnosticSqlCategory('SELECT * FROM pg_roles'),'SQL_SECURITY_CONTEXT')
 assert.equal(diagnosticSqlCategory('SELECT * FROM krs_registry.company_sources WHERE krs=$1 AND register=$2',['hidden','P']),'SQL_KRS_P')
 assert.equal(diagnosticSqlCategory('SELECT * FROM krs_registry.company_sources WHERE krs=$1 AND register=$2',['hidden','S']),'SQL_KRS_S')
 assert.equal(diagnosticSqlCategory('SELECT profitia_access.scope_allows($1)'),'SQL_SECURITY_SCOPE')
 assert.equal(diagnosticSqlCategory('SELECT profitia_external_call.apply_control($1)'),'SQL_SOURCE_CONTROL')
})
test('callback connection errors preserve the exact supplied argument count',async()=>{
 const error=Error('synthetic-private-connection-error')
 const pool=instrumentDiagnosticPool({connect(cb:Function){queueMicrotask(()=>cb(error))}})
 let calls=0
 await withDiagnosticRequest('search',undefined,()=>new Promise<void>(resolve=>{
  pool.connect(function(...args:unknown[]){calls++;assert.equal(args.length,1);assert.equal(args[0],error);resolve()})
 }),{enabled:true,emit:()=>{}})
 assert.equal(calls,1)
})
test('PostgreSQL COMMIT returning ROLLBACK cannot be reported as a committed transaction',async()=>{
 const pool=new Pool(),query=pool.client.query
 pool.client.query=function(sql:string,...args:unknown[]){return sql==='COMMIT'?Promise.resolve({command:'ROLLBACK',rows:[]}):Reflect.apply(query,this,[sql,...args])}
 instrumentDiagnosticPool(pool);let packet:DiagnosticPacket|undefined
 await withDiagnosticRequest('search',undefined,async()=>{const c=await pool.connect() as Client;await c.query('BEGIN');await c.query('COMMIT');c.release()},{enabled:true,emit:p=>{packet=p}})
 assert(packet);assert(packet.resources.some(r=>r.kind==='TRANSACTION'&&r.outcome==='ROLLED_BACK'));assert(!packet.resources.some(r=>r.outcome==='COMMITTED'))
})
test('public Client.connect is distinguished from total pool acquisition',async()=>{
 class PhysicalClient extends Client{connect(callback:Function){queueMicrotask(()=>callback(null))}}
 class PhysicalPool extends Pool{Client=PhysicalClient;client=new PhysicalClient();override connect(cb?:Function):unknown{
  const action=(done:Function)=>this.client.connect((err:unknown)=>{this.emit('connect',this.client);done(err,this.client,this.client.release)})
  if(cb){action(cb);return undefined}return new Promise((resolve,reject)=>action((err:unknown,c:Client)=>err?reject(err):resolve(c)))
 }}
 const pool=instrumentDiagnosticPool(new PhysicalPool(),'JOBS');let packet:DiagnosticPacket|undefined
 await withDiagnosticRequest('search',undefined,async()=>{const c=await pool.connect() as Client;await c.query('SELECT fixture');c.release()},{enabled:true,emit:p=>{packet=p}})
 assert(packet);assert.equal(packet.rows.filter(r=>r.category==='PG_CONNECT').length,1);assert.equal(packet.rows.filter(r=>r.category==='PG_ACQUIRE').length,1)
 const setup=packet.rows.find(r=>r.category==='PG_CONNECT')!,acquire=packet.rows.find(r=>r.category==='PG_ACQUIRE')!
 assert.equal(setup.parentSpanId,acquire.spanId);assert.equal(setup.poolKind,'JOBS');assert.equal(packet.complete,true)
})
