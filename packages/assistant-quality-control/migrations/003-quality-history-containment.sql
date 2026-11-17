-- Independent deletion containment remains available when capture configuration is off.
-- This entry point cannot capture/read/enrol evidence, change a grant or expose a key.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR current_database()<>'platform_private'
 OR NOT EXISTS(SELECT FROM profitia_access.installation WHERE singleton AND environment='development'
  AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x')
 OR to_regprocedure('profitia_assistant_quality_access.apply(text,text)') IS NULL
 THEN RAISE EXCEPTION 'QUALITY_PURPOSE_OWNER_REQUIRED';END IF;
END $guard$;
CREATE FUNCTION profitia_assistant_quality_access.invalidate_history(p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_assistant_quality_access,profitia_access,pg_temp AS $fn$
DECLARE i installation%ROWTYPE;k credentials%ROWTYPE;d jsonb;event jsonb;body text;r jsonb;uid uuid;
BEGIN
 IF session_user<>'sg2_private_development_runtime' OR current_database()<>'platform_private'
 OR EXISTS(SELECT FROM pg_roles WHERE rolname=session_user AND(NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))
 OR EXISTS(SELECT FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user))
 OR p_decision IS NULL THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 d:=profitia_access.runtime_descriptor();
 IF d->>'applicationId'<>'spendguru' OR d->>'environment'<>'development'
 OR d->>'projectId'<>'spring-bread-28217539' OR d->>'branchId'<>'br-sparkling-term-b99l107x'
 THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 SELECT se.event INTO event FROM profitia_access.security_events se WHERE se.application_id='spendguru' AND se.environment='development'
  AND se.decision_id=p_decision AND se.phase='INTENT' AND se.recorded_at>clock_timestamp()-interval '30 seconds'
  AND se.event->>'decision'='ALLOW' AND se.event->>'actorKind'='HUMAN'
  AND se.event->>'operation'='assistant.history.write' AND se.event->>'policyVersion'='access-v1:'||(d->>'revision');
 IF NOT FOUND THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 uid:=(event->>'actorId')::uuid;
 SELECT * INTO i FROM installation WHERE singleton;
 SELECT * INTO k FROM credentials WHERE login_role=session_user;
 IF i.schema_digest IS DISTINCT FROM '1da8abda37255639bdaf0f1710184ef06e489487c66beafe4354b09c529d987d'
 OR k.command_key IS NULL THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 -- Account identity comes only from the fresh canonical HUMAN intent. The
 -- host supplies no target account, service, generation, HMAC key or QA flag.
 body:=jsonb_build_object('contract','QualityPurposeAuthority/1.0.0','action','INVALIDATE',
  'schemaDigest',i.schema_digest,'storageGeneration',i.storage_generation,'serviceId',k.service_id,
  'until',floor(extract(epoch FROM clock_timestamp())*1000)::bigint+10000,
  'accountId',uid,'decisionId',p_decision)::text;
 r:=profitia_assistant_quality_access.apply(body,encode(public.hmac(convert_to(body,'UTF8'),k.command_key,'sha256'),'hex'));
 RETURN r||jsonb_build_object('accountId',uid,'containmentVersion','QUALITY_HISTORY_CONTAINMENT_V1');
END $fn$;
REVOKE ALL ON FUNCTION profitia_assistant_quality_access.invalidate_history(uuid) FROM PUBLIC,sg2_assistant_quality_authority;
GRANT EXECUTE ON FUNCTION profitia_assistant_quality_access.invalidate_history(uuid) TO sg2_private_development_runtime;
