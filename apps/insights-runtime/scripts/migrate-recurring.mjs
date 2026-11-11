// Existing Development installer only; no role membership or runtime enrollment.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
const hash=v=>createHash('sha256').update(v).digest('hex');
const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
export async function migrateRecurringReports(client,phase,expectedDigest){
 const plan={recurring:{file:'004-recurring-subscriptions.sql',table:'recurring_migrations',version:true},delivery:{file:'005-report-delivery.sql',table:'delivery_installation',version:false}}[phase];
 if(!plan)throw Error('EXACT_REPORT_MIGRATION_REQUIRED');
 const sql=readFileSync(new URL('../sql/'+plan.file,import.meta.url),'utf8'),digest=hash(sql);
 if(expectedDigest!==digest)throw Error('EXACT_MIGRATION_DIGEST_REQUIRED');
 await client.query('BEGIN');try{
  await client.query("SET LOCAL lock_timeout='3s'");await client.query("SET LOCAL statement_timeout='30s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('pi-private-recurring-migrations',0))");
  const login=(await client.query('SELECT current_user AS role,session_user AS login,current_database() AS database')).rows[0];
  if(login?.role!=='neondb_owner'||login.login!==login.role||login.database!=='platform_private')throw Error('EXISTING_DEVELOPMENT_INSTALLER_REQUIRED');
  for(const owner of ['profitia_access_owner','insights_report_owner'])if(!(await client.query("SELECT pg_has_role(session_user,$1,'SET') AS allowed",[owner])).rows[0]?.allowed)throw Error('EXISTING_AUTHORISED_INSTALLER_REQUIRED');
  await client.query('SET LOCAL ROLE profitia_access_owner');
  const i=(await client.query('SELECT environment,project_id,branch_id,database_name FROM profitia_access.installation WHERE singleton')).rows[0];
  if(i?.environment!=='development'||i.project_id!=='spring-bread-28217539'||i.branch_id!=='br-sparkling-term-b99l107x'||i.database_name!=='platform_private')throw Error('DEVELOPMENT_PHYSICAL_BINDING_REFUSED');
  let identity;
  if(phase==='delivery'){
   const roles=(await client.query("SELECT login_role FROM profitia_access.runtime_bindings WHERE application_id='identity-runtime-development' AND status='ACTIVE'")).rows;
   if(roles.length!==1)throw Error('ONE_ACTUAL_IDENTITY_RUNTIME_REQUIRED');identity=roles[0].login_role;
  }
  await client.query('SET LOCAL ROLE insights_report_owner');
  const present=(await client.query('SELECT to_regclass($1) IS NOT NULL AS present',['insights_private.'+plan.table])).rows[0]?.present;
  if(present){
   const recorded=(await client.query('SELECT '+(plan.version?'digest':'schema_digest')+' AS digest FROM insights_private.'+plan.table+' WHERE '+(plan.version?"version='1.0.0'":'singleton'))).rows;
   if(recorded.length!==1||recorded[0].digest!==digest)throw Error('EXISTING_REPORT_SCHEMA_MISMATCH');
  }else{
   await client.query(sql);
   await client.query('INSERT INTO insights_private.'+plan.table+(plan.version?"(version,digest) VALUES('1.0.0',$1)":'(singleton,schema_digest) VALUES(true,$1)'),[digest]);
  }
  if(identity){
   await client.query('GRANT USAGE ON SCHEMA insights_private TO '+quote(identity));
   await client.query('GRANT EXECUTE ON FUNCTION insights_private.delivery_descriptor(),insights_private.delivery_claim(uuid,text),insights_private.delivery_begin(jsonb,jsonb,text),insights_private.delivery_settle(uuid,uuid,text,text) TO '+quote(identity));
  }
  await client.query('RESET ROLE');await client.query('COMMIT');return{phase,schemaDigest:digest,status:'APPLIED_OR_VERIFIED'};
 }catch(error){await client.query('ROLLBACK');throw error}
}
async function main(){
 const u=new URL(process.env.PI_REPORT_INSTALLER_DATABASE_URL??'');
 if(process.env.PI_RECURRING_ENVIRONMENT!=='development'||!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!=='ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech'||u.hash||u.port&&u.port!=='5432'||u.pathname!=='/platform_private'||u.searchParams.get('sslmode')!=='require'||u.searchParams.get('channel_binding')!=='require'||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k)))throw Error('DIRECT_DEVELOPMENT_INSTALLER_URL_REQUIRED');
 u.searchParams.delete('sslmode');u.searchParams.delete('channel_binding');const client=new pg.Client({connectionString:u.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true});await client.connect();
 try{console.log(JSON.stringify(await migrateRecurringReports(client,process.argv[2],process.argv[3])))}finally{await client.end()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('{"error":"REPORT_MIGRATION_REFUSED"}');process.exitCode=1});
