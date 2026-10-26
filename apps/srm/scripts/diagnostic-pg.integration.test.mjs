import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {instrumentDiagnosticPool} from '../src/server/diagnostic-pg.ts'
import {withDiagnosticRequest,diagnosticRun} from '../src/server/diagnostic-trace.ts'

test('real PostgreSQL: raw clients,pool queue,callbacks,multiple commands,rollback and independent audit are fully observed',async()=>{
 const connectionString=assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL,'srm_app','architecture_test_owner')
 const pool=instrumentDiagnosticPool(new pg.Pool({connectionString,max:1}),'JOBS')
 const audit=instrumentDiagnosticPool(new pg.Pool({connectionString,max:1}),'INDEPENDENT_AUDIT')
 const packets=[]
 try{
  await withDiagnosticRequest('search',undefined,()=>diagnosticRun('SERIAL',async()=>{
   const client=await pool.connect()
   await client.query('BEGIN')
   await client.query('SELECT $1::text AS fixture',['SYNTHETIC_PRIVATE_VALUE'])
   await client.query('COMMIT')
   client.release()
   await new Promise((resolve,reject)=>pool.query('SELECT 1; SELECT 2',(error,result)=>error?reject(error):resolve(result)))
   const held=await pool.connect()
   const waiting=pool.connect();setTimeout(()=>held.release(),10)
   const queued=await waiting;await queued.query('SELECT 3');queued.release()
   const failed=await pool.connect()
   await failed.query('BEGIN')
   await assert.rejects(failed.query('SELECT 1/0'),{code:'22012'})
   await failed.query('ROLLBACK');failed.release()
   await audit.query('SELECT 4')
  },{join:'SERIAL'}),{enabled:true,emit:p=>packets.push(p)})
  const p=packets[0]
  assert.equal(p.sqlQueryCalls,9)
  assert.equal(p.commandsKnown,9) // 8 successful calls,one contains two commands
  assert.equal(p.commandCountIncomplete,true)
  assert.equal(p.rows.filter(r=>r.category==='PG_CONNECT').length,2)
  assert(p.rows.some(r=>r.category==='PG_ACQUIRE'&&r.inclusiveMs>=8))
  assert(p.resources.some(r=>r.kind==='TRANSACTION'&&r.outcome==='COMMITTED'))
  assert(p.resources.some(r=>r.kind==='TRANSACTION'&&r.outcome==='ROLLED_BACK'))
  assert.equal(p.complete,true);assert.equal(p.accountedMs,p.totalMs)
  assert(p.rows.some(r=>r.kind==='SQL'&&r.poolKind==='INDEPENDENT_AUDIT'))
  assert.equal(p.serverInternalStatementCount,null)
  assert(!JSON.stringify(p).includes('SYNTHETIC_PRIVATE_VALUE'))
 }finally{await Promise.all([pool.end(),audit.end()])}
})
