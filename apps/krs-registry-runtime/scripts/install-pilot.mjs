import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {fileURLToPath} from 'node:url'
const root=new URL('../../../',import.meta.url)
const read=path=>fs.readFileSync(new URL(path,root),'utf8')
const digest=value=>createHash('sha256').update(value).digest('hex')
const quote=value=>"'"+String(value).replaceAll("'","''")+"'"
export function installationPlan({ownerLogin='architecture_sg_lab_owner',database='krs_registry_pilot',project='fancy-cell-49425728',branch='br-divine-fog-baohc5ay',deploymentId,approvalRef,sourceSha}){
 if(!/^[a-z][a-z0-9_]*$/.test(ownerLogin)||!['krs_registry_pilot','krs_registry_test'].includes(database)
  ||!approvalRef||!deploymentId||!/^[a-f0-9]{40}$/.test(sourceSha))throw Error('Exact approved pilot binding required')
 const core=['008-platform-ingestion.sql','009-external-call-admission.sql','012-native-external-transport.sql'].map(name=>({name,sql:read('packages/platform-contracts/migrations/access/'+name)}))
 const [ingestion,external,native]=core.map(x=>digest(x.sql)),reference=quote(approvalRef+':'+sourceSha),qdb=quote(database)
 const statements=[
  `DO $$ BEGIN IF current_database()<>${qdb} OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN('krs_registry','profitia_ingestion','profitia_external_call','profitia_external_native')) THEN RAISE EXCEPTION 'Empty exact pilot database required';END IF;END $$`,
  `GRANT krs_catalog_owner,profitia_ingestion_owner TO ${ownerLogin} WITH INHERIT FALSE,SET TRUE`,
  'SET LOCAL ROLE krs_catalog_owner',
  `REVOKE ALL ON DATABASE ${database} FROM PUBLIC`,
  `GRANT CONNECT ON DATABASE ${database} TO krs_reader,krs_ingest`,
  read('apps/krs-registry-runtime/migrations/001.up.sql'),
  `GRANT CREATE ON DATABASE ${database} TO profitia_ingestion_owner`,
  'GRANT USAGE,CREATE ON SCHEMA krs_registry TO profitia_ingestion_owner',
  'GRANT TRIGGER ON ALL TABLES IN SCHEMA krs_registry TO profitia_ingestion_owner',
  'SET LOCAL ROLE profitia_ingestion_owner',core[0].sql,
  `INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',${quote(ingestion)},'development',${quote(project)},${quote(branch)},${qdb})`,
  core[1].sql,
  `INSERT INTO profitia_external_call.installation(schema_version,schema_digest,source_schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',${quote(external)},${quote(ingestion)},'development',${quote(project)},${quote(branch)},${qdb})`,
  core[2].sql,
  `INSERT INTO profitia_external_native.installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',${quote(native)},${reference})`,
  `INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES('krs_ingest',${quote(randomUUID())},${quote(randomUUID())},'krs-registry-source','PLATFORM_INTERNAL',${quote(deploymentId)},'krs-native-pilot-v1','ACTIVE',${reference},clock_timestamp()+interval '24 hours')`,
 ]
 const sources=[['krs.registry.official','external-call-control-v1','krs-source-control-v1','technical-source-control-v1','krs-official:current',20],['krs.registry.catalog','profitia.krs-report-projection/1.0.0','krs-normalizer/1.0.1','krs-public-company-v1','krs-catalog:0000028860',20]]
 for(const[id,schema,quality,classification,resource,capacity]of sources){
  statements.push(`INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES(${quote(id)},'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',${quote(schema)},${quote(quality)},${quote(classification)},'source-receipt-v1','ACTIVE',${reference},clock_timestamp()+interval '24 hours')`,
   `INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES(${quote(randomUUID())},'krs_ingest',${quote(id)},${quote(resource)},'ALLOW','ACTIVE',${reference},clock_timestamp()+interval '24 hours')`,
   `INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES(${quote(randomUUID())},'krs-registry-source',${quote(id)},'SOURCE_TRANSACTION',${capacity},clock_timestamp(),clock_timestamp()+interval '24 hours',clock_timestamp()+interval '23 hours 59 minutes','ACTIVE',${reference})`)
 }
 const policy=randomUUID(),rules=[{method:'GET',prefix:'/api/krs/OdpisAktualny/',parameter:'OPAQUE',suffix:'',requestFormat:'NONE'},{method:'GET',prefix:'/api/krs/OdpisPelny/',parameter:'OPAQUE',suffix:'',requestFormat:'NONE'},{method:'GET',prefix:'/api/Krs/Biuletyn/',parameter:'OPAQUE',suffix:'',requestFormat:'NONE'},{method:'GET',prefix:'/api/Krs/BiuletynGodzinowy/',parameter:'OPAQUE',suffix:'',requestFormat:'NONE'}]
 statements.push(`INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES(${quote(policy)},'krs_ingest','krs.registry.official','krs-official:current','krs-native-pilot-v1','https://api-krs.ms.gov.pl','HTTPS','[{"method":"GET","path":"/api/krs/OdpisAktualny"}]',8192,4194304,10000,'UPSTREAM_ATTEMPT_ADMISSION',20,clock_timestamp(),clock_timestamp()+interval '24 hours',clock_timestamp()+interval '23 hours 59 minutes','ACTIVE',${reference})`,
  `INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,source_ref,expires_at) SELECT policy_id,version,${quote(JSON.stringify(rules))},'[]',4194304,'NONE','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',${reference},expires_at FROM profitia_external_call.policies WHERE policy_id=${quote(policy)}`,
  'GRANT USAGE ON SCHEMA profitia_ingestion,profitia_external_call,profitia_external_native TO krs_ingest',
  'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_ingestion,profitia_external_call,profitia_external_native TO krs_ingest',
  read('apps/krs-registry-runtime/migrations/002-native-catalog.sql'),
  'SET LOCAL ROLE krs_catalog_owner',`REVOKE CREATE ON DATABASE ${database} FROM profitia_ingestion_owner`,
  'REVOKE CREATE ON SCHEMA krs_registry FROM profitia_ingestion_owner','REVOKE TRIGGER ON ALL TABLES IN SCHEMA krs_registry FROM profitia_ingestion_owner','RESET ROLE',
  `GRANT krs_catalog_owner,profitia_ingestion_owner TO ${ownerLogin} WITH INHERIT FALSE,SET FALSE`)
 return {sourceSha,approvalRef,database,project,branch,deploymentId,schemaDigests:{ingestion,external,native},statements}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const target=JSON.parse(read('apps/krs-registry-runtime/deployment/pilot-targets.json'))
 if(target.state!=='OWNER_APPROVED_PENDING_INSTALLATION'||!target.ownerApprovalRef)throw Error('Actual owner resource approval required')
 const plan=installationPlan({sourceSha:process.env.KRS_SOURCE_SHA,deploymentId:process.env.KRS_SOURCE_DEPLOYMENT_ID,approvalRef:target.ownerApprovalRef})
 if(process.argv[2]==='--emit-sql')process.stdout.write(JSON.stringify(plan))
 else console.log(JSON.stringify({...plan,statements:undefined,statementCount:plan.statements.length},null,2))
}
