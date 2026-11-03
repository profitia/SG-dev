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
async function main(){const c=ENVIRONMENTS.development,u=new URL(process.env.NEWSFEED_MIGRATOR_DATABASE_URL??'');
 if(process.env.NEWSFEED_ENVIRONMENT!=='development'||u.hostname!==c.databaseHost.replace('-pooler','')||decodeURIComponent(u.username)!=='newsfeed_development_migrator'||u.pathname!=='/neondb'||!['require','verify-full'].includes(u.searchParams.get('sslmode')??'')||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k)))throw Error('MIGRATOR_CONFIGURATION_REFUSED');
 u.searchParams.delete('sslmode');u.searchParams.delete('channel_binding');const client=new pg.Client({connectionString:u.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true});await client.connect();try{process.stdout.write(JSON.stringify(await migrate(client,{...c,environment:'development',databaseName:'neondb'}))+'\n');}finally{await client.end();}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.stderr.write('{"error":"MIGRATION_REFUSED_OR_FAILED"}\n');process.exitCode=1;});
