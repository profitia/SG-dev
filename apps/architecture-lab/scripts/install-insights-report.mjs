/** Maintenance only. Never imported by the application or scheduled worker.
 * Executes an owner-approved exact SQL packet using existing installers. It
 * does not grant SET ROLE membership or invent a release/backup/owner decision. */
import {readFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
const hash=v=>createHash('sha256').update(v).digest('hex');
const targets={
 E1:{projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',hosts:['ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech','ep-late-heart-b9mxo8oi-pooler.c-7.eu-central-1.aws.neon.tech'],owners:['profitia_access_owner','insights_report_owner']},
 SOURCE:{projectId:'autumn-waterfall-65938876',branchId:'br-dry-hall-b294222f',databaseName:'neondb',hosts:['ep-muddy-pine-b22pdyqd.c-6.eu-central-1.aws.neon.tech','ep-muddy-pine-b22pdyqd-pooler.c-6.eu-central-1.aws.neon.tech'],owners:['profitia_ingestion_owner']}
};
const schemas=new Set(['packages/platform-contracts/current-e1-authority/migrations/002-receiver.sql',
 'packages/platform-contracts/current-e1-authority/migrations/007-insights-authority.sql',
 'packages/platform-contracts/current-e1-authority/migrations/008-insights-receiver.sql',
 'packages/platform-contracts/current-e1-authority/migrations/009-insights-service.sql',
 'packages/platform-contracts/migrations/access/030-model-execution.sql',
 'packages/platform-contracts/migrations/access/031-model-execution-long-report.sql',
 'packages/platform-contracts/migrations/access/032-report-model-templates.sql',
 'apps/insights-runtime/sql/001-report-editions.sql','apps/insights-runtime/sql/002-runtime-binding.sql']);
const roles=new Set(['insights_report_owner','sg2_insights_report_development_runtime','sg2_insights_report_development_receiver',
 'sg2_insights_report_development_e1','sg2_insights_report_development_composer','sg2_insights_report_development_counter']);
const check=(v,code)=>{if(!v)throw Object.assign(Error(code),{code})};
export async function verifyInstallPacket(bytes,expectedSha,sourceRoot){
 check(hash(bytes)===expectedSha,'EXACT_APPROVED_PACKET_REQUIRED');
 const p=JSON.parse(bytes);check(p.contract==='profitia.insights-development-install/1.0'&&p.environment==='development'&&p.ownerDecisionRef&&p.sourceSha&&p.steps?.length,'APPROVED_INSTALLATION_REQUIRED');
 for(const b of p.databases){const t=targets[b.id];check(t&&['projectId','branchId','databaseName'].every(k=>b[k]===t[k])&&b.backupRef&&b.recoveryVerified===true,'EXACT_RECOVERABLE_DEVELOPMENT_REQUIRED')}
 for(const step of p.steps){const t=targets[step.database];check(t&&p.databases.some(d=>d.id===step.database),'UNKNOWN_DATABASE');
  if(step.kind==='ROLE'){check(roles.has(step.role)&&step.expiresAt&&Date.parse(step.expiresAt)>Date.now(),'BOUNDED_OWN_ROLE_REQUIRED');continue}
  check(t.owners.includes(step.owner),'EXACT_OWNER_REQUIRED');
  if(step.kind==='SCHEMA'){
   check(schemas.has(step.path),'UNREVIEWED_SCHEMA');const path=resolve(sourceRoot,step.path);check(!relative(sourceRoot,path).startsWith('..'),'OUTSIDE_SOURCE_ROOT');
   check(hash(await readFile(path))===step.sha256,'SCHEMA_SHA_MISMATCH');
  }else check(step.kind==='STATEMENT'&&typeof step.sql==='string'&&step.sha256===hash(step.sql)&&Array.isArray(step.values),'EXACT_STATEMENT_REQUIRED');
 }
 return p;
}
export async function installApprovedPacket({bytes,expectedSha,sourceRoot,environment=process.env,secretBindings}){
 const p=await verifyInstallPacket(bytes,expectedSha,sourceRoot);check(secretBindings&&typeof secretBindings==='object','IN_MEMORY_BINDINGS_REQUIRED');
 const receipts=[];
 for(const database of p.databases){
  const t=targets[database.id],url=new URL(environment[database.connectionVariable]);
  check(t.hosts.includes(url.hostname)&&url.pathname==='/'+t.databaseName&&url.password&&url.searchParams.get('sslmode')==='require','MAINTENANCE_CONNECTION_MISMATCH');
  const db=new pg.Client({connectionString:url.href,connectionTimeoutMillis:10000});await db.connect();
  try{
   await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';SELECT pg_advisory_xact_lock(170009,20261109)");
   const actual=(await db.query('SELECT current_database() AS database,session_user::text AS installer')).rows[0];
   check(actual.database===database.databaseName&&actual.installer===database.installerRole,'ACTUAL_INSTALLER_MISMATCH');
   const installation=database.id==='E1'?'profitia_access.installation':'profitia_ingestion.installation';
   const row=(await db.query(`SELECT project_id,branch_id,database_name,environment FROM ${installation} WHERE singleton`)).rows[0];
   check(row&&row.project_id===t.projectId&&row.branch_id===t.branchId&&row.database_name===t.databaseName&&row.environment==='development','ACTUAL_BRANCH_MISMATCH');
   for(const step of p.steps.filter(s=>s.database===database.id)){
    if(step.kind==='ROLE'){
     check(!(await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[step.role])).rowCount,'ROLE_ALREADY_EXISTS_REVIEW_REQUIRED');
     const password=secretBindings[step.passwordBinding];
     check(step.role==='insights_report_owner'||typeof password==='string'&&/^[a-f0-9]{64}$/.test(password),'RAM_PASSWORD_REQUIRED');
     await db.query(`CREATE ROLE "${step.role}" ${step.role==='insights_report_owner'?'NOLOGIN':"LOGIN PASSWORD '"+password+"' CONNECTION LIMIT 4 VALID UNTIL '"+new Date(step.expiresAt).toISOString()+"'"} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`);
    }else{
     // Existing installer only. A missing SET capability stops and rolls back;
     // this program never grants or changes membership to work around it.
     await db.query('SET LOCAL ROLE "'+step.owner+'"');
     if(step.kind==='SCHEMA'){
      let text=await readFile(resolve(sourceRoot,step.path),'utf8');
      if(step.path==='apps/insights-runtime/sql/001-report-editions.sql')text=text.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
      if(step.ifAbsent){check(/^[a-z_]+$/.test(step.ifAbsent),'INVALID_SCHEMA_GUARD');const found=(await db.query('SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=$1) AS exists',[step.ifAbsent])).rows[0].exists;
       check(!found||step.acceptExistingDigestSql,'EXISTING_SCHEMA_REVIEW_REQUIRED');
       if(found){const match=(await db.query(step.acceptExistingDigestSql,step.acceptExistingDigestValues??[])).rows[0]?.matches;check(match===true,'EXISTING_SCHEMA_DIGEST_MISMATCH');continue}
      }
      await db.query(text);
     }else{
      const values=step.values.map(v=>v&&typeof v==='object'&&Object.keys(v).join()==='secretBinding'?(check(Object.hasOwn(secretBindings,v.secretBinding),'MISSING_RAM_SECRET'),secretBindings[v.secretBinding]):v);
      await db.query(step.sql,values);
     }
     await db.query('RESET ROLE');
    }
   }
   await db.query('RESET ROLE');check((await db.query('SELECT current_user=session_user AS restored')).rows[0].restored,'INSTALLER_SCOPE_NOT_RESTORED');
   await db.query('COMMIT');receipts.push({database:database.id,projectId:t.projectId,branchId:t.branchId,status:'COMMITTED',packetSha256:expectedSha});
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw Object.assign(Error('INSTALLATION_STOPPED'),{code:'INSTALLATION_STOPPED',database:database.id,sqlState:/^[A-Z0-9]{5}$/.test(e.code??'')?e.code:null})}
  finally{await db.end()}
 }
 return receipts;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [mode,file,sha,sourceRoot]=process.argv.slice(2),bytes=await readFile(file,'utf8');
  if(mode==='--verify'){const p=await verifyInstallPacket(bytes,sha,sourceRoot);console.log(JSON.stringify({status:'VERIFIED_NOT_EXECUTED',steps:p.steps.length,packetSha256:sha}))}
  else {check(mode==='--apply','EXPLICIT_MODE_REQUIRED');const secretBindings=JSON.parse(process.env.INSIGHTS_INSTALL_BINDINGS_JSON??'null');console.log(JSON.stringify(await installApprovedPacket({bytes,expectedSha:sha,sourceRoot,secretBindings})))}
 }catch(e){console.error(JSON.stringify({status:'STOPPED',code:e.code??'INSTALLATION_UNAVAILABLE',database:e.database??null,sqlState:e.sqlState??null}));process.exitCode=1}
}
