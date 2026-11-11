import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
import {ENVIRONMENTS} from '../src/config.mjs';
const hash=source=>createHash('sha256').update(source).digest('hex');
export async function migrate(client,c){
 if(c.environment!=='development')throw Error('ENVIRONMENT_NOT_ACTIVATED');
 const runtime='newsfeed_development_runtime',owner='newsfeed_development_owner';
 const r=await client.query('SELECT current_user AS role,session_user AS login,current_database() AS database,rolsuper,rolbypassrls,rolinherit,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname=current_user'),x=r.rows[0];
 if(x?.role!=='newsfeed_development_migrator'||x.login!==x.role||x.database!==c.databaseName||x.rolsuper||x.rolbypassrls||x.rolinherit||x.rolcreaterole||x.rolcreatedb||x.rolreplication)throw Error('MIGRATOR_BINDING_MISMATCH');
 await client.query('BEGIN');try{
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('newsfeed-stage2a-migrations',0))");await client.query('SET LOCAL ROLE profitia_access_owner');
  const base=await readFile(new URL('../../../packages/platform-contracts/migrations/access/001-internal-access.sql',import.meta.url),'utf8'),baseHash=hash(base),binding={environment:c.environment,project_id:c.projectId,branch_id:c.branchId,database_name:c.databaseName};
  const exists=await client.query("SELECT to_regnamespace('profitia_access') IS NOT NULL AS present");
  if(exists.rows[0].present){const old=(await client.query('SELECT * FROM profitia_access.installation WHERE singleton')).rows[0];if(!old||old.schema_digest!==baseHash||Object.entries(binding).some(([k,v])=>old[k]!==v))throw Error('EXISTING_SCHEMA_MISMATCH');}
  else{await client.query(base);await client.query('INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES(\'1.0.0\',$1,$2,$3,$4,$5)',[baseHash,c.environment,c.projectId,c.branchId,c.databaseName]);}
  await client.query('GRANT USAGE ON SCHEMA profitia_access TO '+runtime);
  for(const signature of['runtime_descriptor()','identity_binding(text,text)','lock_access(uuid,uuid,text,text,text)','scope_allows(text,uuid,uuid)','append_audit(jsonb)'])await client.query('GRANT EXECUTE ON FUNCTION profitia_access.'+signature+' TO '+runtime);
  await client.query('SET LOCAL ROLE '+owner);const sql=await readFile(new URL('../migrations/001-foundation.sql',import.meta.url),'utf8'),digest=hash(sql);
  const present=await client.query("SELECT to_regnamespace('newsfeed') IS NOT NULL AS present");
  if(present.rows[0].present){const old=(await client.query('SELECT * FROM newsfeed.installation WHERE singleton')).rows[0];if(!old||old.schema_digest!==digest||old.application_id!==c.applicationId||Object.entries(binding).some(([k,v])=>old[k]!==v))throw Error('EXISTING_SCHEMA_MISMATCH');}
  else{await client.query(sql.replaceAll('__OWNER_ROLE__',owner).replaceAll('__RUNTIME_ROLE__',runtime));await client.query('INSERT INTO newsfeed.installation(singleton,schema_version,schema_digest,environment,application_id,project_id,branch_id,database_name) VALUES(true,\'1.0.0\',$1,$2,$3,$4,$5,$6)',[digest,c.environment,c.applicationId,c.projectId,c.branchId,c.databaseName]);}
  await client.query('COMMIT');return {schemaVersion:'1.0.0',schemaDigest:digest,status:'APPLIED_OR_VERIFIED'};
 }catch(error){await client.query('ROLLBACK');throw error;}
}
export async function migrateSavedSearches(client,c,expectedDigest){
 if(c.environment!=='development')throw Error('ENVIRONMENT_NOT_ACTIVATED');
 const sql=await readFile(new URL('../migrations/003-saved-searches.sql',import.meta.url),'utf8'),digest=hash(sql);
 if(expectedDigest!==digest)throw Error('EXACT_MIGRATION_DIGEST_REQUIRED');
 const r=await client.query('SELECT current_user AS role,session_user AS login,current_database() AS database,rolsuper,rolbypassrls,rolinherit,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname=current_user'),x=r.rows[0];
 if(x?.role!=='newsfeed_development_migrator'||x.login!==x.role||x.database!==c.databaseName||x.rolsuper||x.rolbypassrls||x.rolinherit||x.rolcreaterole||x.rolcreatedb||x.rolreplication)throw Error('MIGRATOR_BINDING_MISMATCH');
 await client.query('BEGIN');try{
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('newsfeed-stage2a-migrations',0))");
  // The domain's fixed read-only sharing projection validates the original
  // current-E1 proof. It receives no key, identity table or SET ROLE privilege.
  const sharingValidator=await client.query("SELECT coalesce(bool_and(has_schema_privilege('newsfeed_development_owner',n.oid,'USAGE') AND has_function_privilege('newsfeed_development_owner',p.oid,'EXECUTE')),false) AS allowed FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='profitia_e1_receiver' AND p.proname='scope_allows' AND p.proargtypes='25 2950 2950 16'::oidvector");
  if(sharingValidator.rows[0]?.allowed!==true)throw Error('SHARED_READ_PROOF_VALIDATOR_GRANT_REQUIRED');
  await client.query('SET LOCAL ROLE newsfeed_development_owner');
  const prerequisite=await client.query("SELECT to_regprocedure('profitia_e1_receiver.scope_allows(text,uuid,uuid,boolean)') IS NOT NULL AS receiver,EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='newsfeed.observations'::regclass AND polname='current_e1_select' AND NOT polpermissive) AS policy");
  if(!prerequisite.rows[0]?.receiver||!prerequisite.rows[0]?.policy)throw Error('CURRENT_E1_SQL002_REQUIRED');
  const i=(await client.query('SELECT * FROM newsfeed.installation WHERE singleton')).rows[0];
  if(!i||i.schema_version!=='1.0.0'||i.environment!==c.environment||i.application_id!==c.applicationId||i.project_id!==c.projectId||i.branch_id!==c.branchId||i.database_name!==c.databaseName)throw Error('EXISTING_SCHEMA_MISMATCH');
  const present=(await client.query("SELECT to_regclass('newsfeed.saved_search_migrations') IS NOT NULL AS present")).rows[0].present;
  if(present){const old=(await client.query("SELECT digest FROM newsfeed.saved_search_migrations WHERE version='1.2.0'")).rows[0];if(old?.digest!==digest)throw Error('SAVED_SEARCH_SCHEMA_MISMATCH');}
  else{await client.query(sql.replaceAll('__OWNER_ROLE__','newsfeed_development_owner').replaceAll('__RUNTIME_ROLE__','newsfeed_development_runtime'));await client.query("INSERT INTO newsfeed.saved_search_migrations(version,digest) VALUES('1.2.0',$1)",[digest]);}
  await client.query('COMMIT');return {schemaVersion:'1.2.0',schemaDigest:digest,status:'APPLIED_OR_VERIFIED'};
 }catch(error){await client.query('ROLLBACK');throw error;}
}
export async function migrateMonitoring(client,c,expectedDigest){
 if(c.environment!=='development')throw Error('ENVIRONMENT_NOT_ACTIVATED');
 const sql=await readFile(new URL('../migrations/004-recurring-monitoring.sql',import.meta.url),'utf8'),digest=hash(sql);
 if(expectedDigest!==digest)throw Error('EXACT_MIGRATION_DIGEST_REQUIRED');
 const login=(await client.query('SELECT current_user AS role,session_user AS login,current_database() AS database,rolsuper,rolbypassrls,rolinherit,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname=current_user')).rows[0];
 if(login?.role!=='newsfeed_development_migrator'||login.login!==login.role||login.database!==c.databaseName||['rolsuper','rolbypassrls','rolinherit','rolcreaterole','rolcreatedb','rolreplication'].some(k=>login[k]))throw Error('MIGRATOR_BINDING_MISMATCH');
 await client.query('BEGIN');try{
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('newsfeed-stage2a-migrations',0))");
  await client.query("SET LOCAL lock_timeout='3s'");await client.query("SET LOCAL statement_timeout='30s'");
  await client.query('SET LOCAL ROLE newsfeed_development_owner');
  const i=(await client.query('SELECT * FROM newsfeed.installation WHERE singleton')).rows[0];
  if(!i||i.environment!==c.environment||i.project_id!==c.projectId||i.branch_id!==c.branchId||i.database_name!==c.databaseName||i.application_id!==c.applicationId)throw Error('EXISTING_SCHEMA_MISMATCH');
  const present=(await client.query("SELECT to_regclass('newsfeed.recurring_migrations') IS NOT NULL AS present")).rows[0].present;
  if(present){const r=(await client.query("SELECT digest FROM newsfeed.recurring_migrations WHERE version='1.0.0'")).rows[0];if(r?.digest!==digest)throw Error('RECURRING_SCHEMA_MISMATCH')}
  else{await client.query(sql);await client.query("INSERT INTO newsfeed.recurring_migrations(version,digest) VALUES('1.0.0',$1)",[digest])}
  await client.query('RESET ROLE');await client.query('COMMIT');
  return{schemaVersion:'1.0.0',schemaDigest:digest,status:'APPLIED_OR_VERIFIED'};
 }catch(e){await client.query('ROLLBACK');throw e}
}
async function main(){const c=ENVIRONMENTS.development,u=new URL(process.env.NEWSFEED_MIGRATOR_DATABASE_URL??'');
 if(process.env.NEWSFEED_ENVIRONMENT!=='development'||u.hostname!==c.databaseHost.replace('-pooler','')||decodeURIComponent(u.username)!=='newsfeed_development_migrator'||u.pathname!=='/neondb'||!['require','verify-full'].includes(u.searchParams.get('sslmode')??'')||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k)))throw Error('MIGRATOR_CONFIGURATION_REFUSED');
 u.searchParams.delete('sslmode');u.searchParams.delete('channel_binding');const client=new pg.Client({connectionString:u.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true});await client.connect();try{const binding={...c,environment:'development',databaseName:'neondb'};const result=process.argv.includes('--recurring-monitoring')?await migrateMonitoring(client,binding,process.argv[process.argv.indexOf('--expected-sha256')+1]):process.argv.includes('--saved-searches')?await migrateSavedSearches(client,binding,process.argv[process.argv.indexOf('--expected-sha256')+1]):await migrate(client,binding);process.stdout.write(JSON.stringify(result)+'\n');}finally{await client.end();}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.stderr.write('{"error":"MIGRATION_REFUSED_OR_FAILED"}\n');process.exitCode=1;});
