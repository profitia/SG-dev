import {createHash} from 'node:crypto'
const literal=s=>"'"+String(s).replaceAll("'","''")+"'"
/** Additional technical transports only. Existing global Source funding,
 * quotas, history and all HUMAN entitlements are retained. No credentials,
 * cloud resource, migration or identity directory are created by this plan. */
export function pilot2PrivateInstallationPlan(sourceSha){
 if(!/^[a-f0-9]{40}$/.test(sourceSha??''))throw Error('Accepted exact source required')
 const ref=literal('SRM-PILOT2-STAGING-BASELINE-20261024:'+sourceSha)
 const statements=["SET LOCAL statement_timeout='15s'","SET LOCAL lock_timeout='3s'",
  "SELECT pg_advisory_xact_lock(hashtext('srm-pilot2-private-transports'))",
  `DO $guard$ BEGIN
   IF current_user<>session_user OR current_user<>'neondb_owner' OR current_database()<>'platform_private'
    OR NOT pg_has_role(session_user,'profitia_ingestion_owner','SET')
    OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND environment='development')
    OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.runtime_bindings WHERE login_role='srm_pilot2_source' AND status='ACTIVE' AND deployment_id ~ '^srv-dbeh6srrjlhs73fmikrg:[a-f0-9]{40}:srm-provider-source$')
    OR EXISTS(SELECT 1 FROM profitia_ingestion.grants WHERE login_role='srm_pilot2_source' AND source_id IN('srm.provider.vercly','srm.provider.public-web'))
    OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member='srm_pilot2_source'::regrole) THEN RAISE EXCEPTION 'Exact isolated technical adoption required';END IF;
   END $guard$`,'SET LOCAL ROLE profitia_ingestion_owner',
  `DO $adopt$ DECLARE r record;v jsonb;id uuid;BEGIN
   FOR r IN SELECT n.nspname FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE a.grantee='srm_provider_development_source'::regrole AND a.privilege_type='USAGE' AND n.nspowner=current_user::regrole LOOP EXECUTE format('GRANT USAGE ON SCHEMA %I TO srm_pilot2_source',r.nspname);END LOOP;
   FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee='srm_provider_development_source'::regrole AND a.privilege_type='EXECUTE' AND p.proowner=current_user::regrole LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO srm_pilot2_source',r.signature);END LOOP;
   INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,version,source_ref,expires_at)
    SELECT gen_random_uuid(),'srm_pilot2_source',source_id,resource_id,effect,status,1,${ref},expires_at
    FROM profitia_ingestion.grants WHERE login_role='srm_provider_development_source' AND source_id IN('srm.provider.vercly','srm.provider.public-web')
     AND status='ACTIVE' AND effect='ALLOW' AND expires_at>clock_timestamp();
   IF(SELECT count(*) FROM profitia_ingestion.grants WHERE login_role='srm_pilot2_source' AND source_id IN('srm.provider.vercly','srm.provider.public-web') AND status='ACTIVE')<>2 THEN RAISE EXCEPTION 'Two existing accepted private transports required';END IF;
   FOR r IN SELECT p.policy_id,to_jsonb(p) value FROM profitia_external_call.policies p WHERE login_role='srm_provider_development_source' AND status='ACTIVE' AND expires_at>clock_timestamp()
    AND resource_id IN('srm-provider:vercly','srm-provider:vercly-krs','srm-provider:public-web') LOOP
    id:=gen_random_uuid();v:=r.value||jsonb_build_object('policy_id',id,'login_role','srm_pilot2_source','version',1,'admitted_count',0,
     'capacity',CASE r.value->>'resource_id' WHEN 'srm-provider:vercly-krs' THEN 5 ELSE 20 END,'source_ref',${ref});
    INSERT INTO profitia_external_call.policies SELECT(jsonb_populate_record(NULL::profitia_external_call.policies,v)).*;
    IF r.value->>'resource_id'='srm-provider:public-web' THEN
     SELECT to_jsonb(p) INTO STRICT v FROM profitia_public_web.policies p WHERE policy_id=r.policy_id AND status='ACTIVE' AND expires_at>clock_timestamp();
     v:=v||jsonb_build_object('policy_id',id,'base_policy_version',1,'source_ref',${ref});
     INSERT INTO profitia_public_web.policies SELECT(jsonb_populate_record(NULL::profitia_public_web.policies,v)).*;
    ELSE
     SELECT to_jsonb(p) INTO STRICT v FROM profitia_external_native.policies p WHERE policy_id=r.policy_id AND status='ACTIVE' AND expires_at>clock_timestamp();
     v:=v||jsonb_build_object('policy_id',id,'base_policy_version',1,'source_ref',${ref});
     INSERT INTO profitia_external_native.policies SELECT(jsonb_populate_record(NULL::profitia_external_native.policies,v)).*;
    END IF;
   END LOOP;
   IF(SELECT count(*) FROM profitia_external_call.policies WHERE login_role='srm_pilot2_source' AND resource_id IN('srm-provider:vercly','srm-provider:vercly-krs','srm-provider:public-web') AND status='ACTIVE')<>3 THEN RAISE EXCEPTION 'Three bounded current transports required';END IF;
  END $adopt$`,'RESET ROLE',
  "DO $cleanup$ BEGIN IF current_user<>session_user OR current_user<>'neondb_owner' OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member='srm_pilot2_source'::regrole) THEN RAISE EXCEPTION 'No Source owner membership permitted';END IF;END $cleanup$"]
 return Object.freeze({version:'pilot2-current-private-transports-v1',sourceSha,statements,digest:createHash('sha256').update(JSON.stringify(statements)).digest('hex')})
}
