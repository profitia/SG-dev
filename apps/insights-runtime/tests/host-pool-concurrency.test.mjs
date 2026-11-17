// SYNTHETIC_ONLY: bounded local connection leases, no database or provider I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pgPorts} from '../src/host.mjs';

class BoundedPool {
 constructor(){this.active=0;this.maximum=0;this.pending=[];this.commands=[];}
 async connect(){
  if(this.active){await new Promise((resolve,reject)=>{
   const entry={resolve:()=>{clearTimeout(entry.timer);resolve();},timer:null};
   entry.timer=setTimeout(()=>{this.pending=this.pending.filter(x=>x!==entry);reject(Error('POOL_ACQUISITION_DEADLINE'));},100);
   this.pending.push(entry);
  });}else this.active++;
  this.maximum=Math.max(this.maximum,this.active);
  let released=false;
  return {query:async sql=>{this.commands.push(sql);await new Promise(r=>setImmediate(r));return{rows:[]};},release:()=>{
   assert(!released,'each connection is released exactly once');released=true;
   const next=this.pending.shift();if(next)next.resolve();else this.active--;
  }};
 }
 async query(sql){const c=await this.connect();try{return await c.query(sql);}finally{c.release();}}
}
test('two report operations retain an independent audit connection while transaction leases are occupied',async()=>{
 const transactions=new BoundedPool(),independent=new BoundedPool();
 const ports=pgPorts(transactions,independent);
 const operation=()=>ports.transact(async({query})=>{
  await ports.independentQuery('CURRENT_AUTHORITY_AUDIT');
  await query('PRIVATE_REPORT_READ');
  return 'authorized';
 });
 assert.deepEqual(await Promise.all([operation(),operation()]),['authorized','authorized']);
 assert.equal(independent.commands.filter(x=>x==='CURRENT_AUTHORITY_AUDIT').length,2);
 assert.equal(transactions.commands.filter(x=>x==='COMMIT').length,2);
 assert(!transactions.commands.includes('CURRENT_AUTHORITY_AUDIT'));
 assert(!transactions.commands.includes('ROLLBACK'));
 assert.equal(transactions.maximum,1);assert.equal(independent.maximum,1);
 assert.equal(transactions.active+independent.active,0);
});
test('independent audit refusal still rolls back the report transaction',async()=>{
 const transactions=new BoundedPool(),independent={query:async()=>{throw Error('AUDIT_UNAVAILABLE');}};
 const ports=pgPorts(transactions,independent);
 await assert.rejects(ports.transact(()=>ports.independentQuery('CURRENT_AUTHORITY_AUDIT')),/AUDIT_UNAVAILABLE/);
 assert(transactions.commands.includes('ROLLBACK'));assert(!transactions.commands.includes('COMMIT'));
 assert.equal(transactions.active,0);
});
