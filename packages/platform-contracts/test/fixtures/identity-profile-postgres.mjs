import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import pg from '../../../../apps/architecture-lab/node_modules/pg/lib/index.js'
import { profileSchemaDigest } from '../../src/user-profile.mjs'

export function clerkFixture(subject = 'user_synthetic_a') {
  const f = { subject, origin: 'http://localhost:3600', issuer: 'https://synthetic.clerk.accounts.dev', active: true, banned: false, calls: [] }
  f.client = {
    authenticateRequest: async () => { f.calls.push('sdk'); const exp = Math.floor(Date.now()/1000)+60; return {status:f.active?'signed-in':'signed-out',isAuthenticated:f.active,
      toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:f.subject,sessionId:'sess_'+f.subject,sessionClaims:{iss:f.issuer,sub:f.subject,sid:'sess_'+f.subject,azp:f.origin,exp}})} },
    sessions: {getSession:async id=>{f.calls.push('session');return {id,userId:f.subject,status:f.active?'active':'revoked',expireAt:Date.now()+60000,abandonAt:Date.now()+60000,actor:null}}},
    users: {getUser:async id=>{f.calls.push('user');return {id,banned:f.banned,locked:false,deprovisioned:false,emailAddresses:[{emailAddress:'same-synthetic@example.test'}]}}},
  }
  f.request = method => new Request(f.origin+'/api/account',{method,headers:method==='GET'?{}:{origin:f.origin}})
  return f
}

export async function postgresFixture() {
  const external = process.env.B1_TEST_ADMIN_URL
  let directory, bin, operator
  if (external) {
    const u = new URL(external)
    if (!['localhost','127.0.0.1','[::1]'].includes(u.hostname) || u.pathname !== '/identity_profile_b1_test') throw Error('Synthetic loopback database only')
    operator = new pg.Client({ connectionString: external })
  } else {
    bin = process.env.B1_PG_BIN || (fs.existsSync('/opt/homebrew/opt/postgresql@16/bin/initdb') ? '/opt/homebrew/opt/postgresql@16/bin' : '/usr/lib/postgresql/16/bin')
    if (!fs.existsSync(path.join(bin,'initdb'))) throw Error('Local PostgreSQL required; DATABASE_ACCEPTANCE=PENDING_OWNER_RESOURCE')
    directory=fs.mkdtempSync(path.join(os.tmpdir(),'b1pg-'))
    const run = (name,args) => { const r=spawnSync(path.join(bin,name),args,{encoding:'utf8'});if(r.status!==0)throw Error('Local PostgreSQL setup failed: '+name) }
    run('initdb',['-D',directory+'/data','-U','b1_operator','-A','trust','--no-locale','-E','UTF8'])
    run('pg_ctl',['-D',directory+'/data','-l',directory+'/server.log','-o',`-c listen_addresses='' -k ${directory}`,'-w','start'])
    operator=new pg.Client({host:directory,user:'b1_operator',database:'postgres'})
  }
  await operator.connect()
  const operatorConfig=operator.connectionParameters
  if (!external) await operator.query('CREATE DATABASE identity_profile_b1_test')
  const config={host:operatorConfig.host,port:operatorConfig.port,user:operatorConfig.user,password:operatorConfig.password,database:'identity_profile_b1_test'}
  const admin=new pg.Client(config);await admin.connect()
  const proofKey=randomBytes(32)
  const binding={applicationId:'identity-b1-synthetic',environment:'development',projectId:'synthetic-private-project',branchId:'synthetic-development',databaseName:'identity_profile_b1_test',role:'identity_b1_runtime',schemaDigest:'356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2'}
  const load=name=>fs.readFileSync(new URL('../../migrations/'+name,import.meta.url),'utf8')
  await admin.query(`CREATE ROLE profitia_access_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    CREATE ROLE identity_b1_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    CREATE ROLE identity_b1_foreign LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    GRANT CREATE ON DATABASE identity_profile_b1_test TO profitia_access_owner;
    CREATE EXTENSION pgcrypto; SET ROLE profitia_access_owner;`)
  await admin.query('BEGIN');await admin.query(load('access/001-internal-access.sql'))
  await admin.query("INSERT INTO profitia_access.installation(singleton,schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES(true,'1.0.0',$1,'development',$2,$3,'identity_profile_b1_test')",[binding.schemaDigest,binding.projectId,binding.branchId]);await admin.query('COMMIT')
  const migration=load('profile/001-user-profile.sql')
  if(createHash('sha256').update(migration).digest('hex')!==profileSchemaDigest())throw Error('Migration digest mismatch')
  await admin.query('BEGIN');await admin.query(migration)
  await admin.query("INSERT INTO profitia_profile.installation VALUES(true,'1.0.0',$1)",[profileSchemaDigest()])
  await admin.query("INSERT INTO profitia_access.applications VALUES($1,'ACTIVE',NULL);",[binding.applicationId])
  await admin.query("INSERT INTO profitia_access.runtime_bindings VALUES('identity_b1_runtime',$1,'ACTIVE')",[binding.applicationId])
  await admin.query("INSERT INTO profitia_profile.runtime_policies(login_role,issuer,enabled,allow_registration,max_binding_lifetime_ms,proof_key) VALUES('identity_b1_runtime','https://synthetic.clerk.accounts.dev',true,true,60000,$1)",[proofKey])
  await admin.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_profile TO identity_b1_runtime;
    GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb) TO identity_b1_runtime;
    GRANT EXECUTE ON FUNCTION profitia_profile.runtime_descriptor(),profitia_profile.provision_account(text,text,bigint,bigint,text),profitia_profile.read_current(),profitia_profile.ensure_current(),profitia_profile.update_current(bigint,jsonb),profitia_profile.scope_allows(uuid) TO identity_b1_runtime;
    GRANT SELECT ON profitia_profile.user_profiles TO identity_b1_runtime;`)
  await admin.query('COMMIT')
  const pool=new pg.Pool({...config,user:binding.role,max:8})
  const independentQuery=(text,values)=>pool.query(text,values)
  const transact=async(run,limits={timeoutMs:15000})=>{
    const c=await pool.connect();let timeout
    try {await c.query('BEGIN');const task=run({query:(text,values)=>c.query(text,values),transaction:c});const result=await Promise.race([task,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Transaction deadline')),limits.timeoutMs)})]);await c.query('COMMIT');return result}
    catch(error){await c.query('ROLLBACK');throw error}finally{clearTimeout(timeout);c.release()}
  }
  const options=f=>({client:f.client,identityApplication:{appId:binding.applicationId,environment:'development',issuer:f.issuer,authorizedParties:[f.origin]},binding,schemaDigest:profileSchemaDigest(),proofKey,transact,
    independentQuery,application:{appId:binding.applicationId,profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'synthetic-deployment',configurationVersion:'synthetic-v1',identityIssuer:f.issuer,organisationId:null,features:['account'],operations:['account.settings.read','account.settings.write']}})
  return {admin,pool,config,binding,proofKey,options,independentQuery,transact,
    async close(){await pool.end();await admin.end();await operator.end();if(directory){spawnSync(path.join(bin,'pg_ctl'),['-D',directory+'/data','-m','immediate','-w','stop']);fs.rmSync(directory,{recursive:true,force:true})}},
  }
}
