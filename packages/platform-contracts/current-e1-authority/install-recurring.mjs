// Operator entry point only. This installer never grants role membership,
// creates a principal, enrolls an executor or changes Source admission.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const central={project_id:'spring-bread-28217539',branch_id:'br-sparkling-term-b99l107x',database_name:'platform_private'};
const newsfeed={project_id:'shiny-bonus-85532609',branch_id:'br-wispy-bonus-b9ohunab',database_name:'neondb'};
const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
const hash=v=>createHash('sha256').update(v).digest('hex');
const authorityFunctions=['recurring_ready()','recurring_schema_digest()','recurring_component_ready(text,text,text,text)','recurring_consent(text,jsonb,jsonb)','recurring_identity(text,text,jsonb)','issue_recurring(text,text,text,jsonb,jsonb,jsonb)'];
const receiverFunctions=['recurring_descriptor()','recurring_consent_receipt(jsonb)','recurring_challenge(jsonb,text)','recurring_accept(jsonb)','recurring_scope(uuid,uuid,uuid,bigint,text)','recurring_audit(jsonb)'];
export function recurringMigrationPlan(phase){
 const plans={
  authority:{file:'012-recurring-authority.sql',target:central,schema:'profitia_e1_authority',table:'recurring_installation'},
  'newsfeed-receiver':{file:'013-recurring-receiver.sql',target:newsfeed,schema:'profitia_e1_receiver',table:'recurring_installation',domainOwner:'newsfeed_development_owner'},
  'reports-receiver':{file:'013-recurring-receiver.sql',target:central,schema:'profitia_e1_receiver',table:'recurring_installation',domainOwner:'insights_report_owner'},
  'delivery-authority':{file:'014-recurring-delivery.sql',target:central,schema:'profitia_e1_authority',table:'recurring_delivery_installation'}
 };
 const p=plans[phase];if(!p)throw Error('EXACT_RECURRING_PHASE_REQUIRED');return Object.freeze({...p,phase,owner:'profitia_access_owner'});
}
/** The existing installer must already have SET permission. Any separately
 * approved reversible SET exception is outside this function and transaction. */
export async function installRecurringMigration(client,phase,expectedDigest){
 const p=recurringMigrationPlan(phase),sql=readFileSync(new URL('migrations/'+p.file,import.meta.url),'utf8'),digest=hash(sql);
 if(expectedDigest!==digest)throw Error('EXACT_MIGRATION_DIGEST_REQUIRED');
 await client.query('BEGIN');try{
  await client.query("SET LOCAL lock_timeout='3s'");await client.query("SET LOCAL statement_timeout='30s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('pi-private-recurring-migrations',0))");
  const login=(await client.query('SELECT current_user AS role,session_user AS login,current_database() AS database')).rows[0];
  if(login?.role!==login?.login||login?.database!==p.target.database_name||!['neondb_owner','newsfeed_development_migrator'].includes(login.login))throw Error('INSTALLER_LOGIN_REFUSED');
  if(!(await client.query("SELECT pg_has_role(session_user,$1,'SET') AS allowed",[p.owner])).rows[0]?.allowed)throw Error('EXISTING_AUTHORISED_INSTALLER_REQUIRED');
  await client.query('SET LOCAL ROLE '+quote(p.owner));
  const i=(await client.query('SELECT environment,project_id,branch_id,database_name FROM profitia_access.installation WHERE singleton')).rows[0];
  if(i?.environment!=='development'||Object.entries(p.target).some(([k,v])=>i[k]!==v))throw Error('DEVELOPMENT_PHYSICAL_BINDING_REFUSED');
  const present=(await client.query('SELECT to_regclass($1) IS NOT NULL AS present',[p.schema+'.'+p.table])).rows[0]?.present;
  if(present){
   if((await client.query('SELECT schema_digest FROM '+p.schema+'.'+p.table+' WHERE singleton')).rows[0]?.schema_digest!==digest)throw Error('EXISTING_RECURRING_SCHEMA_MISMATCH');
  }else{
   await client.query(sql);await client.query('INSERT INTO '+p.schema+'.'+p.table+'(singleton,schema_digest) VALUES(true,$1)',[digest]);
  }
  if(phase.endsWith('receiver')){
   const receiver=(await client.query('SELECT login_role FROM profitia_e1_receiver.installation WHERE singleton')).rows[0]?.login_role;
   if(!receiver)throw Error('ACTUAL_RECEIVER_ROLE_REQUIRED');
   for(const role of [receiver,p.domainOwner]){
    await client.query('GRANT USAGE ON SCHEMA profitia_e1_receiver TO '+quote(role));
    await client.query('GRANT EXECUTE ON FUNCTION '+receiverFunctions.map(f=>'profitia_e1_receiver.'+f).join(',')+' TO '+quote(role));
   }
  }else{
   const roles=(await client.query("SELECT login_role FROM profitia_access.runtime_bindings WHERE application_id='identity-runtime-development' AND status='ACTIVE'")).rows;
   if(roles.length!==1)throw Error('ONE_ACTUAL_IDENTITY_RUNTIME_REQUIRED');
   const identity=quote(roles[0].login_role),functions=phase==='authority'?authorityFunctions:['recurring_delivery_descriptor()','recurring_delivery_identity(jsonb)','recurring_delivery_proof(jsonb,jsonb,text)','recurring_delivery_verify(jsonb)'];
   await client.query('GRANT USAGE ON SCHEMA profitia_e1_authority TO '+identity);
   await client.query('GRANT EXECUTE ON FUNCTION '+functions.map(f=>'profitia_e1_authority.'+f).join(',')+' TO '+identity);
   if(phase==='delivery-authority'){
    await client.query('GRANT USAGE ON SCHEMA profitia_e1_authority TO insights_report_owner');
    await client.query('GRANT EXECUTE ON FUNCTION profitia_e1_authority.recurring_delivery_descriptor(),profitia_e1_authority.recurring_delivery_verify(jsonb),profitia_e1_authority.recurring_delivery_available(text) TO insights_report_owner');
   }
  }
  await client.query('RESET ROLE');await client.query('COMMIT');return{phase,schemaDigest:digest,status:'APPLIED_OR_VERIFIED'};
 }catch(error){await client.query('ROLLBACK');throw error}
}
async function main(){
 const phase=process.argv[2],p=recurringMigrationPlan(phase),u=new URL(process.env.PI_RECURRING_INSTALLER_DATABASE_URL??'');
 if(process.env.PI_RECURRING_ENVIRONMENT!=='development'||!u.hostname.endsWith('.neon.tech')||u.hostname.includes('-pooler.')||u.pathname!=='/'+p.target.database_name||u.searchParams.get('sslmode')!=='require'||u.searchParams.get('channel_binding')!=='require'||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k)))throw Error('DIRECT_DEVELOPMENT_INSTALLER_URL_REQUIRED');
 const {default:pg}=await import('../../../apps/architecture-lab/node_modules/pg/lib/index.js');u.searchParams.delete('sslmode');u.searchParams.delete('channel_binding');
 const client=new pg.Client({connectionString:u.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true});await client.connect();
 try{console.log(JSON.stringify(await installRecurringMigration(client,phase,process.argv[3])))}finally{await client.end()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('{"error":"RECURRING_INSTALLER_REFUSED"}');process.exitCode=1});
