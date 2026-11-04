import pg from 'pg';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
export function createDatabase({connectionString,binding,ssl=true,maximumConnections=5}){
 const u=new URL(connectionString);u.searchParams.delete('sslmode');u.searchParams.delete('channel_binding');
 if(!ssl&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw new SourceHubError('TLS_REQUIRED',503);
 /** @type {import('pg').PoolConfig & {enableChannelBinding:boolean,query_timeout:number}} */
 const poolOptions={connectionString:u.href,ssl:ssl?{rejectUnauthorized:true}:false,enableChannelBinding:true,query_timeout:5000,max:maximumConnections,connectionTimeoutMillis:3000,idleTimeoutMillis:10000,allowExitOnIdle:true};
 const pool=new pg.Pool(poolOptions);
 pool.on('error',()=>{});
 /** @param {string} sql @param {any[]} values @returns {Promise<import('pg').QueryResult>} */
 const query=(sql,values=[])=>pool.query(sql,values);
 async function transact(action,{timeoutMs=5000,maxWaitMs=3000}={}){
  const client=await pool.connect();let active=true,timedOut=false,timer;
  const q=(sql,values=[])=>{if(!active)throw new SourceHubError('TRANSACTION_EXPIRED',503);return client.query(sql,values);};
  try{
   await q('BEGIN');await q("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)",[String(timeoutMs),String(Math.min(maxWaitMs,timeoutMs))]);
   const value=await Promise.race([Promise.resolve().then(()=>action({query:q,transaction:Object.freeze({query:q})})),new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;active=false;reject(new SourceHubError('TRANSACTION_EXPIRED',503));},timeoutMs);})]);
   if(!active)throw new SourceHubError('TRANSACTION_EXPIRED',503);await q('COMMIT');return value;
  }catch(error){active=false;try{await client.query('ROLLBACK');}catch{}throw error;}
  finally{active=false;clearTimeout(timer);client.release(timedOut);}
 }
 async function verifyLogin(){
  const r=await query("SELECT current_database() AS database,current_user AS role,session_user AS login,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,EXISTS(SELECT 1 FROM pg_roles o WHERE o.rolname LIKE '%\\_owner' ESCAPE '\\' AND pg_has_role(current_user,o.oid,'MEMBER')) AS owner_membership FROM pg_roles r WHERE rolname=current_user");const x=r.rows[0];
  if(!x||x.database!==binding.databaseName||x.role!==binding.role||x.login!==binding.role||x.rolsuper||x.rolbypassrls||x.rolcreaterole||x.rolcreatedb||x.rolreplication||x.owner_membership)throw new SourceHubError('DATABASE_BINDING_MISMATCH',503);return true;
 }
 return Object.freeze({query,transact,verifyLogin,close:()=>pool.end()});
}
