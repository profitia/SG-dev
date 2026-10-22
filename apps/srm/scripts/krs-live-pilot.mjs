import {randomUUID} from 'node:crypto'
const quote=value=>"'"+String(value).replaceAll("'","''")+"'"
const roles={jobs:'srm_krs_pilot_jobs',providerSource:'srm_krs_pilot_source',corporateSource:'srm_krs_pilot_corporate'}
const original={jobs:'srm_private_development_jobs',providerSource:'srm_provider_development_source',corporateSource:'srm_corporate_development_source'}
/** Exact additive technical installation. Password creation is separate; the
 * plan contains no credentials or business DML. Existing HUMAN grants, Source
 * budgets, commercial quotas and original deployment policies are unchanged. */
export function privatePilotPlan({sourceSha,organisationId,approvalRef}){
 if(!/^[a-f0-9]{40}$/.test(sourceSha)||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(organisationId)
  ||approvalRef!=='USER-20261022-KRS-ISOLATED-PILOT')throw Error('Exact approved pilot identity required')
 const ref=quote(approvalRef+':'+sourceSha),org=quote(organisationId),service='srv-dbd5hlcipgvc73d98ukg',deployment=service+':'+sourceSha
 const statements=[`DO $$ BEGIN IF current_database()<>'platform_private' OR current_user<>'neondb_owner'
  OR (SELECT count(*) FROM pg_roles WHERE rolname IN('srm_krs_pilot_jobs','srm_krs_pilot_source','srm_krs_pilot_corporate') AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit)<>3
 THEN RAISE EXCEPTION 'Exact unbound ordinary pilot roles required';END IF;END $$`,
 `GRANT CONNECT ON DATABASE platform_private TO ${Object.values(roles).join(',')}`,
 'GRANT profitia_ingestion_owner TO neondb_owner WITH INHERIT FALSE,SET TRUE',
 'SET LOCAL ROLE profitia_access_owner',
 `INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES('${roles.jobs}','srm-jobs','ACTIVE')`,
 `INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at)
  SELECT '${roles.jobs}',${quote(randomUUID())},${quote(randomUUID())},profile_id,${quote(deployment+':srm-jobs')},configuration_version,'ACTIVE',${ref},least(expires_at,clock_timestamp()+interval '24 hours')
  FROM profitia_services.runtime_bindings WHERE login_role='${original.jobs}' AND status='ACTIVE'`,
 `INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,resource_id,effect,status,source_ref,expires_at)
  SELECT ${quote(randomUUID())},'${roles.jobs}',g.binding_id,g.organisation_id,g.resource_id,g.effect,g.status,${ref},least(g.expires_at,clock_timestamp()+interval '24 hours')
  FROM profitia_jobs.execution_grants g JOIN profitia_jobs.operation_bindings b USING(binding_id)
  WHERE g.login_role='${original.jobs}' AND g.organisation_id=${org}::uuid AND g.status='ACTIVE' AND g.effect='ALLOW'
   AND b.operation='supplier.report.refresh' AND b.foreground_role='srm_private_development_runtime'`,
 'RESET ROLE','SET LOCAL ROLE profitia_ingestion_owner']
 for(const key of ['providerSource','corporateSource']){
  statements.push(`INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at)
   SELECT '${roles[key]}',${quote(randomUUID())},${quote(randomUUID())},application_id,profile_id,${quote(deployment+':'+(key==='providerSource'?'srm-provider-source':'srm-corporate-source'))},configuration_version,'ACTIVE',${ref},least(expires_at,clock_timestamp()+interval '24 hours')
   FROM profitia_ingestion.runtime_bindings WHERE login_role='${original[key]}' AND status='ACTIVE'`,
  `INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at)
   SELECT gen_random_uuid(),'${roles[key]}',source_id,resource_id,effect,status,${ref},least(expires_at,clock_timestamp()+interval '24 hours')
   FROM profitia_ingestion.grants WHERE login_role='${original[key]}' AND status='ACTIVE' AND effect='ALLOW'
    AND source_id IN('srm.provider.mgbi','srm.supplier.source-request','srm.catalog.corporate')`)
 }
 // New role-local safety ceilings draw on the SAME application/source budget.
 // They cannot raise its existing capacity or the provider account's quota.
 for(const [resource,ceiling]of [['srm-provider:mgbi',1],['srm-provider:mgbi-files-api',20],['srm-provider:mgbi-files-storage',20]]){
  const id=quote(randomUUID()),r=quote(resource)
  statements.push(`INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref)
   SELECT ${id},'${roles.providerSource}',source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,${ceiling},clock_timestamp(),least(window_end,clock_timestamp()+interval '24 hours'),least(expires_at,clock_timestamp()+interval '23 hours 59 minutes'),'ACTIVE',${ref}
   FROM profitia_external_call.policies WHERE login_role='${original.providerSource}' AND resource_id=${r} AND status='ACTIVE' AND capacity-admitted_count>=${ceiling}`,
  `INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,source_ref,expires_at)
   SELECT ${id},1,n.path_rules,n.redirect_origins,n.maximum_response_bytes,n.credential_mode,n.completion_mode,'ACTIVE',${ref},least(n.expires_at,p.expires_at)
   FROM profitia_external_native.policies n JOIN profitia_external_call.policies old ON old.policy_id=n.policy_id
   JOIN profitia_external_call.policies p ON p.policy_id=${id}
   WHERE old.login_role='${original.providerSource}' AND old.resource_id=${r} AND old.status='ACTIVE' AND n.status='ACTIVE'`)
 }
 statements.push('RESET ROLE')
 for(const key of Object.keys(roles)){
  // Copy only existing explicit object privileges under their real owner.
  // No role membership, CREATE, ownership, privilege escalation or schema DDL.
  statements.push(`DO $acl$ DECLARE item record; BEGIN
   FOR item IN
    SELECT n.nspowner AS owner,format('GRANT USAGE ON SCHEMA %I TO %I',n.nspname,'${roles[key]}') AS command FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE a.grantee='${original[key]}'::regrole AND a.privilege_type='USAGE'
    UNION ALL SELECT p.proowner,format('GRANT EXECUTE ON FUNCTION %s TO %I',p.oid::regprocedure,'${roles[key]}') FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee='${original[key]}'::regrole AND a.privilege_type='EXECUTE'
    UNION ALL SELECT c.relowner,format('GRANT %s ON TABLE %s TO %I',a.privilege_type,c.oid::regclass,'${roles[key]}') FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE a.grantee='${original[key]}'::regrole AND a.privilege_type IN('SELECT','INSERT','UPDATE','DELETE')
   LOOP IF pg_get_userbyid(item.owner) NOT IN('profitia_access_owner','profitia_ingestion_owner') THEN RAISE EXCEPTION 'Unaccepted privilege owner';END IF;
    EXECUTE format('SET LOCAL ROLE %I',pg_get_userbyid(item.owner));EXECUTE item.command;RESET ROLE;
   END LOOP;END $acl$`)
 }
 statements.push(`GRANT profitia_ingestion_owner TO neondb_owner WITH INHERIT FALSE,SET FALSE`)
 return {sourceSha,approvalRef,serviceId:service,roles,statements}
}
