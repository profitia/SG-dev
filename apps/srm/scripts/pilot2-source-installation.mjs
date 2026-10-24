import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {installationPlan} from '../../krs-registry-runtime/scripts/install-pilot.mjs'

const root=new URL('../../../',import.meta.url)
const read=file=>fs.readFileSync(new URL(file,root),'utf8')
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const q=value=>"'"+String(value).replaceAll("'","''")+"'"
const expiry="clock_timestamp()+interval '365 days'"
export function validatePilot2RegistryTarget(t){
 if(t?.targetEnvironment!=='development'||t.render?.serviceId!=='srv-dbeh6srrjlhs73fmikrg'
  ||t.catalog?.projectId!=='snowy-breeze-40315151'||t.catalog?.branchId!=='br-summer-rain-b1nwbcbr'
  ||t.catalog?.host!=='ep-fragrant-cloud-b1y6i4v8.c-5.eu-central-1.aws.neon.tech'
  ||t.catalog?.databaseName!=='krs_registry_pilot'||t.catalog?.newCompute!==false
  ||t.catalog?.operatorRole!=='neondb_owner'||t.catalog?.ownerRole!=='krs_catalog_owner'
  ||t.catalog?.readerRole!=='krs_reader'||t.catalog?.sourceRole!=='krs_ingest'
  ||t.runtime?.applicationId!=='krs-registry-source'||t.runtime?.configurationVersion!=='krs-native-pilot-v1'
  ||t.providerRouting?.internalGusKrsQuotas!=='UNMETERED'||t.dataBoundary?.newHumanAccountsOrGrants!==false
  ||t.approval?.additionalCompute!==false||t.approval?.costCapUsd!==10)throw Error('Exact approved isolated PILOT2 Source target required')
 return t
}
/** A consumer installation plan, using the existing producer's schema phases
 * and immutable migrations. It creates no account, organisation or permission
 * directory, and performs no connection, role/password change or cloud action. */
export function pilot2SourceInstallationPlan(target,sourceSha){
 const t=validatePilot2RegistryTarget(target)
 if(!/^[a-f0-9]{40}$/.test(sourceSha??''))throw Error('Accepted exact source SHA required')
 const deploymentId=t.render.serviceId+':'+sourceSha+':krs-registry-source'
 const base=installationPlan({ownerLogin:t.catalog.operatorRole,database:t.catalog.databaseName,
  project:t.catalog.projectId,branch:t.catalog.branchId,deploymentId,sourceSha,approvalRef:t.taskId})
 const start=base.statements.findIndex(sql=>sql.startsWith('INSERT INTO profitia_ingestion.runtime_bindings'))
 const end=base.statements.findIndex(sql=>sql.startsWith('GRANT USAGE ON SCHEMA profitia_ingestion,'))
 if(start<0||end<=start||!base.statements.at(-1).includes('SET FALSE'))throw Error('Accepted producer installation phases changed')
 const files=['021-native-soap-transport.sql','024-unmetered-public-sources.sql']
 const extensions=files.map(name=>({name,sql:read('packages/platform-contracts/migrations/access/'+name)}))
 if(hash(extensions[1].sql)!==t.runtime.unmeteredSchemaDigest)throw Error('Unmetered Source acceptance drift')
 const reference=q(t.taskId+':'+sourceSha),sourceRole=q(t.catalog.sourceRole)
 const statements=[...base.statements.slice(0,start),extensions[0].sql,
  `SELECT set_config('profitia.install.unmetered_digest',${q(t.runtime.unmeteredSchemaDigest)},true)`,extensions[1].sql,
  `INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at)
   VALUES(${sourceRole},${q(randomUUID())},${q(randomUUID())},'krs-registry-source','PLATFORM_INTERNAL',${q(deploymentId)},'krs-native-pilot-v1','ACTIVE',${reference},${expiry})`]
 const definitions=[
  ['krs.registry.official','external-call-control-v1','krs-source-control-v1','technical-source-control-v1','krs-official:current'],
  ['krs.registry.catalog','profitia.krs-report-projection/1.0.0','krs-normalizer/1.0.1','krs-public-company-v1',null],
  ['krs.registry.gus','external-call-control-v1','gus-bir12-source-v1','technical-source-control-v1','krs-gus:nip-map'],
 ]
 for(const[id,schema,quality,classification,resource]of definitions){
  statements.push(`INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at)
    VALUES(${q(id)},'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',${q(schema)},${q(quality)},${q(classification)},'source-receipt-v1','ACTIVE',${reference},${expiry})`,
   `INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at)
    VALUES(${q(randomUUID())},${sourceRole},${q(id)},${resource===null?'NULL':q(resource)},'ALLOW','ACTIVE',${reference},${expiry})`,
   `INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref,quota_mode)
    VALUES(${q(randomUUID())},'krs-registry-source',${q(id)},'SOURCE_TRANSACTION',NULL,NULL,NULL,NULL,'ACTIVE',${reference},'UNMETERED')`)
 }
 const krsRules=['OdpisAktualny','OdpisPelny'].map(name=>({method:'GET',prefix:'/api/krs/'+name+'/',parameter:'OPAQUE',suffix:'',requestFormat:'NONE'}))
 const providers=[
  {source:'krs.registry.official',resource:'krs-official:current',origin:'https://api-krs.ms.gov.pl',paths:[{method:'GET',path:'/api/krs/OdpisAktualny'}],rules:krsRules,maximum:4194304,credentials:'NONE'},
  {source:'krs.registry.gus',resource:'krs-gus:nip-map',origin:'https://wyszukiwarkaregon.stat.gov.pl',paths:[{method:'POST',path:'/wsBIR/UslugaBIRzewnPubl.svc'}],rules:[{method:'POST',path:'/wsBIR/UslugaBIRzewnPubl.svc',requestFormat:'SOAP'}],maximum:1048576,credentials:'SERVER_HEADERS'},
 ]
 for(const p of providers){
  const id=q(randomUUID())
  statements.push(`INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref,quota_mode)
    VALUES(${id},${sourceRole},${q(p.source)},${q(p.resource)},'krs-native-pilot-v1',${q(p.origin)},'HTTPS',${q(JSON.stringify(p.paths))},8192,${p.maximum},10000,'UPSTREAM_ATTEMPT_ADMISSION',NULL,NULL,NULL,NULL,'ACTIVE',${reference},'UNMETERED')`,
   `INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,source_ref,expires_at)
    SELECT policy_id,version,${q(JSON.stringify(p.rules))},'[]',${p.maximum},${q(p.credentials)},'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',${reference},${expiry} FROM profitia_external_call.policies WHERE policy_id=${id}`)
 }
 // The producer's remaining ACL/catalog fences are preserved byte for byte.
 statements.push(...base.statements.slice(end,-1),
  `REVOKE krs_catalog_owner,profitia_ingestion_owner FROM ${t.catalog.operatorRole}`,
  `DO $verify$ BEGIN IF pg_has_role(${q(t.catalog.operatorRole)},'krs_catalog_owner','MEMBER')
    OR pg_has_role(${q(t.catalog.operatorRole)},'profitia_ingestion_owner','MEMBER')
    OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member IN('krs_ingest'::regrole,'krs_reader'::regrole)) THEN
    RAISE EXCEPTION 'No temporary owner membership or runtime role inheritance may remain';END IF;END $verify$`)
 return {sourceSha,approvalRef:t.taskId,deploymentId,projectId:t.catalog.projectId,branchId:t.catalog.branchId,databaseName:t.catalog.databaseName,
  schemaDigests:{...base.schemaDigests,soap:hash(extensions[0].sql),unmetered:hash(extensions[1].sql)},
  immutableProducerSchemaPhases:true,newHumanAccountsOrGrants:false,internalQuotaMode:'UNMETERED',statements}
}

/** All role DDL, temporary SET ROLE, source installation and cleanup belong in
 * one outer transaction. The independently created database must still be
 * empty and owned by the existing operator. No credential appears in this plan. */
export function pilot2SourceBootstrapPlan(target,sourceSha){
 const p=pilot2SourceInstallationPlan(target,sourceSha),t=validatePilot2RegistryTarget(target)
 const roles=['krs_catalog_owner','profitia_ingestion_owner','krs_reader','krs_ingest']
 const installer='pilot2_source_bootstrap'
 const statements=[
  `SET LOCAL statement_timeout='30s'`,`SET LOCAL lock_timeout='3s'`,
  `DO $empty$ BEGIN IF current_user<>${q(t.catalog.operatorRole)} OR current_user<>session_user
    OR current_database()<>${q(p.databaseName)}
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT IN('public','information_schema') AND nspname NOT LIKE 'pg_%')
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN(${[...roles,installer].map(q).join(',')})) THEN
    RAISE EXCEPTION 'Exact empty PILOT2 database and fresh limited roles required';END IF;END $empty$`,
  // PostgreSQL grants the creator ADMIN membership. A disposable creator lets
  // us remove that membership completely, without a database superuser.
  `CREATE ROLE ${installer} NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS`,
  `GRANT ${installer} TO ${t.catalog.operatorRole} WITH INHERIT FALSE,SET TRUE`,
  `SET ROLE ${installer}`,
  ...roles.map(role=>`CREATE ROLE ${role} ${role.endsWith('_owner')?'NOLOGIN':'LOGIN CONNECTION LIMIT 4'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`),
  `DO $credentials$ BEGIN IF current_user<>${q(installer)} OR current_setting('profitia.install.initial_credentials_ready',true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Initial runtime credentials must be initialized before creator cleanup';END IF;END $credentials$`,
  `GRANT krs_catalog_owner,profitia_ingestion_owner TO ${t.catalog.operatorRole} WITH INHERIT FALSE,SET TRUE GRANTED BY ${installer}`,
  `RESET ROLE`,
  `ALTER DATABASE ${p.databaseName} OWNER TO krs_catalog_owner`,
 ]
 for(const sql of p.statements){
  if(sql.startsWith('GRANT krs_catalog_owner,profitia_ingestion_owner TO'))continue
  // Keep maintenance connectivity for the pre-existing project operator, with
  // no standing owner membership or execution capability.
  if(sql==='RESET ROLE')statements.push(`GRANT CONNECT ON DATABASE ${p.databaseName} TO ${t.catalog.operatorRole}`)
  // Revoke the installer-issued grants as their actual grantor, then drop
  // the disposable creator and all of its automatic ADMIN memberships.
  if(sql.startsWith('REVOKE krs_catalog_owner,profitia_ingestion_owner FROM')){
   statements.push(`SET ROLE ${installer}`,sql,`RESET ROLE`,`DROP ROLE ${installer}`)
  }else statements.push(sql)
 }
 statements.push(`DO $closed$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${q(installer)})
    OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=${q(t.catalog.operatorRole)}::regrole
    AND roleid IN(${roles.map(name=>q(name)+'::regrole').join(',')})) THEN
    RAISE EXCEPTION 'Temporary PILOT2 membership remains';END IF;END $closed$`)
 return {...p,requiresOneOuterTransaction:true,requiresInitialCredentials:true,
  initialCredentialIndex:statements.findIndex(sql=>sql.startsWith('DO $credentials$')),newRoles:roles,statements}
}

/** Native pg execution is required: accepted migrations contain multiple SQL
 * commands. Never emit, log, return or persist the password-bearing commands.
 * The first password must exist while the disposable creator still has ADMIN.
 * Rotate these bootstrap credentials through Neon's API before runtime use. */
export async function applyPilot2SourceBootstrap(client,target,sourceSha,passwords){
 const roles=['krs_ingest','krs_reader']
 if(!passwords||Object.keys(passwords).sort().join(',')!==roles.join(',')
  ||roles.some(role=>typeof passwords[role]!=='string'||!/^[A-Za-z0-9_-]{40,128}$/.test(passwords[role])))
  throw Error('Two in-memory generated initial runtime credentials required')
 const plan=pilot2SourceBootstrapPlan(target,sourceSha)
 if(plan.initialCredentialIndex<0)throw Error('Initial credential boundary required')
 let index=-1
 await client.query('BEGIN')
 try{
  for(const [i,sql]of plan.statements.entries()){
   index=i
   if(i===plan.initialCredentialIndex){
    for(const role of roles)await client.query(`ALTER ROLE ${role} PASSWORD ${q(passwords[role])}`)
    await client.query("SELECT set_config('profitia.install.initial_credentials_ready','true',true)")
   }
   await client.query(sql)
  }
  await client.query('COMMIT')
  return {sourceSha:plan.sourceSha,projectId:plan.projectId,branchId:plan.branchId,databaseName:plan.databaseName,
   transaction:'COMMITTED',credentialsInitializedBeforeCleanup:true,temporaryMembershipsRemoved:true}
 }catch(error){
  await client.query('ROLLBACK').catch(()=>{})
  // A PostgreSQL error can carry SQL context. Discard it instead of allowing
  // a password-bearing statement to reach diagnostics or PMOS.
  const failure=Error('PILOT2_SOURCE_BOOTSTRAP_FAILED')
  failure.sqlState=typeof error?.code==='string'&&/^[A-Z0-9]{5}$/.test(error.code)?error.code:'UNAVAILABLE'
  failure.statementIndex=index
  throw failure
 }
}
