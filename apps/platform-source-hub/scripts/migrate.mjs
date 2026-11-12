import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
import {ENVIRONMENTS} from '../src/config.mjs';
const hash=source=>createHash('sha256').update(source).digest('hex');
const identifier=value=>{if(!/^[a-z][a-z0-9_]{1,62}$/.test(value))throw Error('INVALID_ROLE');return '"'+value+'"';};
const sourceSchema=new URL('../../../packages/platform-contracts/migrations/access/',import.meta.url);
async function install(client,{file,schema,owner,binding}){
 const sql=await readFile(new URL(file,sourceSchema),'utf8'),digest=hash(sql);
 await client.query('SET LOCAL ROLE '+identifier(owner));
 const exists=await client.query('SELECT to_regnamespace($1) IS NOT NULL AS present',[schema]);
 if(exists.rows[0].present){const r=await client.query('SELECT * FROM '+schema+'.installation WHERE singleton');const x=r.rows[0];if(!x||x.schema_digest!==digest||binding&&(['environment','project_id','branch_id','database_name'].some(k=>x[k]!==binding[k])))throw Error('EXISTING_SCHEMA_MISMATCH');return;}
 await client.query(sql);
 if(schema==='profitia_access'||schema==='profitia_ingestion')await client.query('INSERT INTO '+schema+'.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES(\'1.0.0\',$1,$2,$3,$4,$5)',[digest,binding.environment,binding.project_id,binding.branch_id,binding.database_name]);
 else if(schema==='profitia_external_call'){const base=hash(await readFile(new URL('008-platform-ingestion.sql',sourceSchema),'utf8'));await client.query('INSERT INTO profitia_external_call.installation(schema_version,schema_digest,source_schema_digest,environment,project_id,branch_id,database_name) VALUES(\'1.0.0\',$1,$2,$3,$4,$5,$6)',[digest,base,binding.environment,binding.project_id,binding.branch_id,binding.database_name]);}
 else await client.query('INSERT INTO '+schema+'.installation(schema_version,schema_digest,source_ref) VALUES(\'1.0.0\',$1,\'source-hub-stage2a-owner-activation\')',[digest]);
}
// No identity bindings, memberships, product grants, provider admission or
// capacity is manufactured here. Accepted owners provision those separately.
async function installUnmetered(client){
 const sql=await readFile(new URL('024-unmetered-public-sources.sql',sourceSchema),'utf8'),digest=hash(sql);
 await client.query('SET LOCAL ROLE profitia_ingestion_owner');
 const {rows:[installed]}=await client.query("SELECT to_jsonb(i)->>'unmetered_schema_digest' AS digest FROM profitia_ingestion.installation i WHERE singleton");
 if(installed?.digest){if(installed.digest!==digest)throw Error('EXISTING_UNMETERED_SCHEMA_MISMATCH');return digest;}
 // SQL024 requires every Source binding to be disabled by its owner first.
 // The migrator never revokes or restores a live binding on the owner's behalf.
 await client.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[digest]);
 await client.query(sql);return digest;
}
export async function migrate(client,c){
 if(c.environment!=='development')throw Error('ENVIRONMENT_NOT_ACTIVATED');
 const role='source_hub_development_migrator',owner='source_hub_development_owner',runtime='source_hub_development_runtime',source='source_hub_development_source_runtime';
 const identity=await client.query('SELECT current_user AS role,session_user AS login,current_database() AS database,rolsuper,rolbypassrls,rolinherit,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname=current_user');
 const x=identity.rows[0];if(x?.role!==role||x.login!==role||x.database!==c.databaseName||x.rolsuper||x.rolbypassrls||x.rolinherit||x.rolcreaterole||x.rolcreatedb||x.rolreplication)throw Error('MIGRATOR_BINDING_MISMATCH');
 const binding={environment:c.environment,project_id:c.projectId,branch_id:c.branchId,database_name:c.databaseName};
 await client.query('BEGIN');try{
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('source-hub-stage2a-migrations',0))");
  for(const [file,schema,schemaOwner]of[['001-internal-access.sql','profitia_access','profitia_access_owner'],['008-platform-ingestion.sql','profitia_ingestion','profitia_ingestion_owner'],['009-external-call-admission.sql','profitia_external_call','profitia_ingestion_owner'],['012-native-external-transport.sql','profitia_external_native','profitia_ingestion_owner'],['028-api-path-transport.sql','profitia_external_api_path','profitia_ingestion_owner']])await install(client,{file,schema,owner:schemaOwner,binding:['profitia_external_native','profitia_external_api_path'].includes(schema)?null:binding});
  await client.query('SET LOCAL ROLE profitia_access_owner');
  await client.query('GRANT USAGE ON SCHEMA profitia_access TO '+runtime);
  for(const signature of['runtime_descriptor()','identity_binding(text,text)','lock_access(uuid,uuid,text,text,text)','scope_allows(text,uuid,uuid)','append_audit(jsonb)'])await client.query('GRANT EXECUTE ON FUNCTION profitia_access.'+signature+' TO '+runtime);
  await client.query('SET LOCAL ROLE profitia_ingestion_owner');
  for(const schema of['profitia_ingestion','profitia_external_call','profitia_external_native'])await client.query('GRANT USAGE ON SCHEMA '+schema+' TO '+source);
  for(const signature of['runtime_descriptor()','current_state(text,text)','lock_ingestion(text,text,text)','scope_allows(text,text)','reserve(text,text,text,text,uuid)','complete(uuid,uuid)','receipt(text,text,text,text)','append_audit(jsonb)'])await client.query('GRANT EXECUTE ON FUNCTION profitia_ingestion.'+signature+' TO '+source);
  for(const signature of['descriptor(text,text)','apply_control(uuid,uuid,text)','read_status(uuid,text,text)'])await client.query('GRANT EXECUTE ON FUNCTION profitia_external_call.'+signature+' TO '+source);
  await client.query('GRANT EXECUTE ON FUNCTION profitia_external_native.descriptor(text,text) TO '+source);
  const unmeteredDigest=c.installUnmetered===true?await installUnmetered(client):null;
  await client.query('SET LOCAL ROLE '+owner);
  const sql=await readFile(new URL('../migrations/001-foundation.sql',import.meta.url),'utf8'),digest=hash(sql);
  const exists=await client.query("SELECT to_regnamespace('source_hub') IS NOT NULL AS present");
  if(exists.rows[0].present){const r=await client.query('SELECT * FROM source_hub.installation WHERE singleton'),i=r.rows[0];if(!i||i.schema_digest!==digest||i.application_id!==c.applicationId||Object.entries(binding).some(([k,v])=>i[k]!==v))throw Error('EXISTING_SCHEMA_MISMATCH');}
  else{await client.query(sql.replaceAll('__OWNER_ROLE__',identifier(owner)).replaceAll('__RUNTIME_ROLE_LITERAL__',"'"+runtime+"'").replaceAll('__RUNTIME_ROLE__',identifier(runtime)));await client.query('INSERT INTO source_hub.installation(singleton,schema_version,schema_digest,environment,application_id,project_id,branch_id,database_name) VALUES(true,\'1.0.0\',$1,$2,$3,$4,$5,$6)',[digest,c.environment,c.applicationId,c.projectId,c.branchId,c.databaseName]);}
  const ledger=await client.query("SELECT to_regclass('source_hub.migrations') IS NOT NULL AS present");
  if(!ledger.rows[0].present){
   await client.query('CREATE TABLE source_hub.migrations(version text PRIMARY KEY,digest text NOT NULL CHECK(digest~\'^[a-f0-9]{64}$\'),applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');
   await client.query('ALTER TABLE source_hub.migrations ENABLE ROW LEVEL SECURITY');
   await client.query('ALTER TABLE source_hub.migrations FORCE ROW LEVEL SECURITY');
   await client.query('CREATE POLICY schema_owner ON source_hub.migrations TO '+identifier(owner)+' USING(true) WITH CHECK(true)');
   await client.query('CREATE POLICY configuration_read ON source_hub.migrations FOR SELECT TO '+identifier(runtime)+' USING(true)');
  }
  await client.query('GRANT SELECT ON source_hub.migrations TO '+identifier(runtime));
  const migrations=[];
  for(const version of ['002-te-news',...(c.installFirstParty===true?['004-universal-consumers']:[]),...(c.installCalendarStorage===true?['005-calendar-storage-rights']:[]),...(c.installCommodities===true?['006-commodity-providers']:[]),...(c.installMarketObservations===true?['006-market-observations']:[]),...(c.installPublicationSchedules===true?['007-publication-schedules']:[]),...(c.installCalendarConsumerStorage===true?['008-calendar-consumer-storage']:[]),...(c.installEcrResultsStorage===true?['009-ecr-results-storage']:[]),...(c.installExpandedEcrResults===true?['011-expanded-ecr-results']:[])]){
   const extension=await readFile(new URL('../migrations/'+version+'.sql',import.meta.url),'utf8'),extensionDigest=hash(extension);
   const applied=await client.query('SELECT digest FROM source_hub.migrations WHERE version=$1',[version]);
   if(applied.rows.length){if(applied.rows[0].digest!==extensionDigest)throw Error('EXISTING_MIGRATION_MISMATCH');}
   else{await client.query(extension);await client.query('INSERT INTO source_hub.migrations(version,digest) VALUES($1,$2)',[version,extensionDigest]);}
   migrations.push({version,digest:extensionDigest});
  }
  await client.query('COMMIT');return {schemaVersion:'1.0.0',schemaDigest:digest,migrations,...(unmeteredDigest?{unmeteredSourceSchemaDigest:unmeteredDigest}:{}),status:'APPLIED_OR_VERIFIED'};
 }catch(error){await client.query('ROLLBACK');throw error;}
}
async function main(){
 const c=ENVIRONMENTS.development,u=new URL(process.env.SOURCE_HUB_MIGRATOR_DATABASE_URL??'');
 const firstParty=process.env.SOURCE_HUB_INSTALL_FIRST_PARTY;if(firstParty!==undefined&&!['true','false'].includes(firstParty))throw Error('FIRST_PARTY_INSTALL_OPTION_REFUSED');
 const calendarStorage=process.env.SOURCE_HUB_INSTALL_CALENDAR_STORAGE;if(calendarStorage!==undefined&&!['true','false'].includes(calendarStorage)||calendarStorage==='true'&&firstParty!=='true')throw Error('CALENDAR_STORAGE_INSTALL_OPTION_REFUSED');
 const markets=process.env.SOURCE_HUB_INSTALL_MARKET_OBSERVATIONS;if(markets!==undefined&&!['true','false'].includes(markets)||markets==='true'&&firstParty!=='true')throw Error('MARKET_INSTALL_OPTION_REFUSED');
 const commodities=process.env.SOURCE_HUB_INSTALL_COMMODITIES;if(commodities!==undefined&&!['true','false'].includes(commodities)||commodities==='true'&&firstParty!=='true')throw Error('COMMODITY_INSTALL_OPTION_REFUSED');
 const schedules=process.env.SOURCE_HUB_INSTALL_PUBLICATION_SCHEDULES;if(schedules!==undefined&&!['true','false'].includes(schedules)||schedules==='true'&&firstParty!=='true')throw Error('SCHEDULE_INSTALL_OPTION_REFUSED');
 const consumerStorage=process.env.SOURCE_HUB_INSTALL_CALENDAR_CONSUMER_STORAGE;if(consumerStorage!==undefined&&!['true','false'].includes(consumerStorage)||consumerStorage==='true'&&(firstParty!=='true'||commodities!=='true'||schedules!=='true'))throw Error('CALENDAR_CONSUMER_STORAGE_INSTALL_OPTION_REFUSED');
 const results=process.env.SOURCE_HUB_INSTALL_ECR_RESULTS_STORAGE;if(results!==undefined&&!['true','false'].includes(results)||results==='true'&&(firstParty!=='true'||consumerStorage!=='true'))throw Error('ECR_RESULTS_INSTALL_OPTION_REFUSED');
 const expanded=process.env.SOURCE_HUB_INSTALL_EXPANDED_ECR_RESULTS;if(expanded!==undefined&&!['true','false'].includes(expanded)||expanded==='true'&&results!=='true')throw Error('EXPANDED_ECR_RESULTS_INSTALL_OPTION_REFUSED');
 const unmetered=process.env.SOURCE_HUB_INSTALL_UNMETERED_SOURCE;if(unmetered!==undefined&&!['true','false'].includes(unmetered))throw Error('UNMETERED_INSTALL_OPTION_REFUSED');
 if(process.env.SOURCE_HUB_ENVIRONMENT!=='development'||u.hostname!==c.host.replace('-pooler','')||decodeURIComponent(u.username)!=='source_hub_development_migrator'||u.pathname!=='/neondb'||!['require','verify-full'].includes(u.searchParams.get('sslmode')??'')||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k)))throw Error('MIGRATOR_CONFIGURATION_REFUSED');
 u.searchParams.delete('sslmode');u.searchParams.delete('channel_binding');const client=new pg.Client({connectionString:u.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true});await client.connect();
 try{const result=await migrate(client,{...c,environment:'development',databaseName:'neondb',installUnmetered:unmetered==='true',installFirstParty:firstParty==='true',installCalendarStorage:calendarStorage==='true',installCommodities:commodities==='true',installMarketObservations:markets==='true',installPublicationSchedules:schedules==='true',installCalendarConsumerStorage:consumerStorage==='true',installEcrResultsStorage:results==='true',installExpandedEcrResults:expanded==='true'});process.stdout.write(JSON.stringify(result)+'\n');}finally{await client.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.stderr.write('{"error":"MIGRATION_REFUSED_OR_FAILED"}\n');process.exitCode=1;});
