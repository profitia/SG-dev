-- Additive canonical E1 purpose extension for Stage1 controlled acceptance.
-- No installation, runtime binding, purpose, fixture input or secret is seeded.
-- No general source licence or access to historical real conversations is granted.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR current_database()<>'platform_private'
 OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))
 OR NOT EXISTS(SELECT FROM profitia_access.installation WHERE singleton AND environment='development'
  AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x')
 OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='sg2_assistant_quality_authority' AND rolcanlogin
  AND NOT(rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))
 OR EXISTS(SELECT FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='sg2_assistant_quality_authority'))
 THEN RAISE EXCEPTION 'QUALITY_PURPOSE_OWNER_REQUIRED';END IF;
END $guard$;
CREATE SCHEMA profitia_assistant_quality_access AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_assistant_quality_access FROM PUBLIC;
CREATE TABLE profitia_assistant_quality_access.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest='__QUALITY_PURPOSE_SCHEMA_DIGEST__'),
 storage_generation uuid NOT NULL,enabled boolean NOT NULL DEFAULT false,source_ref text NOT NULL
);
CREATE TABLE profitia_assistant_quality_access.credentials(
 login_role name PRIMARY KEY CHECK(login_role IN('sg2_private_development_runtime','sg2_assistant_quality_authority')),
 service_id uuid NOT NULL,command_key bytea NOT NULL CHECK(octet_length(command_key)=32)
);
CREATE TABLE profitia_assistant_quality_access.purpose_grants(
 grant_id uuid PRIMARY KEY,service_id uuid NOT NULL,account_id uuid NOT NULL REFERENCES profitia_access.accounts,
 organisation_id uuid NOT NULL REFERENCES profitia_access.organisations,enabled boolean NOT NULL DEFAULT false,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at) AND expires_at>created_at AND expires_at<=created_at+interval '168 hours'),
 data_mode text NOT NULL CHECK(data_mode='CONTROLLED_ACCEPTANCE'),source_ref text NOT NULL,
 UNIQUE(service_id,account_id)
);
-- Only separately enrolled hashes of controlled inputs may be captured. The
-- runtime cannot enrol a transcript, relax a source scope or extend its expiry.
CREATE TABLE profitia_assistant_quality_access.accepted_inputs(
 grant_id uuid NOT NULL REFERENCES profitia_assistant_quality_access.purpose_grants,
 input_sha256 text NOT NULL CHECK(input_sha256~'^[a-f0-9]{64}$'),enabled boolean NOT NULL DEFAULT false,
 source_scopes jsonb NOT NULL CHECK(jsonb_typeof(source_scopes)='array' AND jsonb_array_length(source_scopes)<=64 AND octet_length(source_scopes::text)<=24000),
 source_ref text NOT NULL,PRIMARY KEY(grant_id,input_sha256)
);
CREATE TABLE profitia_assistant_quality_access.account_epochs(
 account_id uuid PRIMARY KEY REFERENCES profitia_access.accounts,epoch bigint NOT NULL DEFAULT 1 CHECK(epoch>0),
 not_before timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE profitia_assistant_quality_access.evidence_bindings(
 evidence_id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES profitia_access.accounts,grant_id uuid NOT NULL,
 input_sha256 text NOT NULL,epoch bigint NOT NULL,storage_generation uuid NOT NULL,
 occurred_at timestamptz NOT NULL,earliest_input_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 FOREIGN KEY(grant_id,input_sha256) REFERENCES profitia_assistant_quality_access.accepted_inputs,
 CHECK(earliest_input_at<=occurred_at AND expires_at<=earliest_input_at+interval '168 hours')
);
-- A committed account epoch is outside the product store. Restoring an earlier
-- product snapshot cannot undo a completed deletion or revive its QA evidence.
CREATE TABLE profitia_assistant_quality_access.invalidations(
 decision_id uuid PRIMARY KEY,account_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','credentials','purpose_grants','accepted_inputs','account_epochs','evidence_bindings','invalidations'] LOOP
  EXECUTE format('ALTER TABLE profitia_assistant_quality_access.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_assistant_quality_access.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_assistant_quality_access.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('REVOKE ALL ON profitia_assistant_quality_access.%I FROM PUBLIC,sg2_private_development_runtime,sg2_assistant_quality_authority',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['installation','credentials','purpose_grants','accepted_inputs'] LOOP
  EXECUTE format('CREATE TRIGGER authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_assistant_quality_access.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
  EXECUTE format('CREATE TRIGGER authority_truncate_fence BEFORE TRUNCATE ON profitia_assistant_quality_access.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
 END LOOP;
END $rls$;
CREATE TRIGGER advance_version BEFORE UPDATE ON profitia_assistant_quality_access.purpose_grants
 FOR EACH ROW EXECUTE FUNCTION profitia_access.advance_version();

CREATE FUNCTION profitia_assistant_quality_access.apply(p_json text,p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_assistant_quality_access,profitia_access,pg_temp AS $fn$
DECLARE i installation%ROWTYPE;k credentials%ROWTYPE;g purpose_grants%ROWTYPE;f accepted_inputs%ROWTYPE;
 e account_epochs%ROWTYPE;b evidence_bindings%ROWTYPE;d jsonb;r jsonb;event jsonb;command jsonb;op text;expected text[];
 ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000);uid uuid;eid uuid;did uuid;occurred timestamptz;earliest timestamptz;expiry timestamptz;
BEGIN
 IF session_user NOT IN('sg2_private_development_runtime','sg2_assistant_quality_authority') OR current_database()<>'platform_private'
 OR EXISTS(SELECT FROM pg_roles WHERE rolname=session_user AND(NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))
 OR EXISTS(SELECT FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user))
 OR p_json IS NULL OR octet_length(p_json)>32768 THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 d:=profitia_access.runtime_descriptor();
 IF d->>'applicationId'<>'spendguru' OR d->>'environment'<>'development'
 OR d->>'projectId'<>'spring-bread-28217539' OR d->>'branchId'<>'br-sparkling-term-b99l107x'
 THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 SELECT * INTO i FROM installation WHERE singleton;
 SELECT * INTO k FROM credentials WHERE login_role=session_user;
 IF i.schema_digest IS DISTINCT FROM '__QUALITY_PURPOSE_SCHEMA_DIGEST__' OR k.command_key IS NULL
 OR p_proof IS DISTINCT FROM encode(public.hmac(convert_to(p_json,'UTF8'),k.command_key,'sha256'),'hex')
 THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 command:=p_json::jsonb;op:=command->>'action';
 IF jsonb_typeof(command) IS DISTINCT FROM 'object' OR command->>'contract' IS DISTINCT FROM 'QualityPurposeAuthority/1.0.0'
 OR command->>'schemaDigest' IS DISTINCT FROM i.schema_digest OR command->>'storageGeneration' IS DISTINCT FROM i.storage_generation::text
 OR command->>'serviceId' IS DISTINCT FROM k.service_id::text OR coalesce((command->>'until')::bigint,0)<=ms OR (command->>'until')::bigint>ms+10000
 OR coalesce(op,'') NOT IN('DESCRIPTOR','CAPTURE','READ','INVALIDATE')
 OR session_user='sg2_private_development_runtime' AND op='READ'
 OR session_user='sg2_assistant_quality_authority' AND op IN('CAPTURE','INVALIDATE')
 THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 expected:=ARRAY['contract','action','schemaDigest','storageGeneration','serviceId','until']||CASE op
 WHEN 'CAPTURE' THEN ARRAY['accountId','evidenceId','decisionId','inputSha256','sourceScopes','occurredAt','earliestInputAt']
 WHEN 'READ' THEN ARRAY['accountId','evidenceId','sourceScopes'] WHEN 'INVALIDATE' THEN ARRAY['accountId','decisionId'] ELSE ARRAY[]::text[] END;
 IF ARRAY(SELECT jsonb_object_keys(command) ORDER BY 1)<>ARRAY(SELECT unnest(expected) ORDER BY 1)
 THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 r:=jsonb_build_object('applicationId','spendguru','environment','development','projectId','spring-bread-28217539',
 'branchId','br-sparkling-term-b99l107x','databaseName',current_database(),'runtimeRole',session_user,'schemaDigest',i.schema_digest,
 'serviceId',k.service_id,'storageGeneration',i.storage_generation,'dataMode','CONTROLLED_ACCEPTANCE');
 IF op='DESCRIPTOR' THEN RETURN r||jsonb_build_object('enabled',i.enabled);END IF;
 uid:=(command->>'accountId')::uuid;
 IF op IN('CAPTURE','INVALIDATE') THEN
  did:=(command->>'decisionId')::uuid;
  SELECT se.event INTO event FROM profitia_access.security_events se WHERE se.application_id='spendguru' AND se.environment='development'
   AND se.decision_id=did AND se.phase='INTENT' AND se.recorded_at>clock_timestamp()-interval '30 seconds'
   AND se.event->>'decision'='ALLOW' AND se.event->>'actorKind'='HUMAN' AND se.event->>'actorId'=uid::text
   AND se.event->>'operation'='assistant.history.write' AND se.event->>'policyVersion'='access-v1:'||(d->>'revision');
  IF NOT FOUND THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 END IF;
 -- Deletion containment remains available after purpose expiry/revocation and
 -- does not require a product licence. It still needs a fresh real HUMAN
 -- account-history decision, and cannot grant or renew any QA access.
 IF op='INVALIDATE' THEN
  IF NOT EXISTS(SELECT FROM profitia_access.accounts WHERE user_id=uid AND status='ACTIVE') THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
  INSERT INTO account_epochs(account_id)VALUES(uid)ON CONFLICT DO NOTHING;
  SELECT * INTO e FROM account_epochs WHERE account_id=uid FOR UPDATE;
  INSERT INTO invalidations(decision_id,account_id)VALUES(did,uid)ON CONFLICT DO NOTHING;
  IF FOUND THEN UPDATE account_epochs SET epoch=epoch+1,not_before=clock_timestamp() WHERE account_id=uid RETURNING * INTO e;END IF;
  RETURN r||jsonb_build_object('invalidated',true,'epoch',e.epoch::text);
 END IF;
 IF NOT i.enabled THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 SELECT * INTO g FROM purpose_grants WHERE service_id=k.service_id AND account_id=uid AND enabled AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND OR d->>'fixedOrganisationId' IS NOT NULL AND (d->>'fixedOrganisationId')::uuid<>g.organisation_id
 OR NOT EXISTS(SELECT FROM profitia_access.accounts WHERE user_id=uid AND status='ACTIVE')
 OR NOT EXISTS(SELECT FROM profitia_access.memberships m JOIN profitia_access.organisations o USING(organisation_id)
  WHERE m.user_id=uid AND m.organisation_id=g.organisation_id AND m.status='ACTIVE' AND o.status='ACTIVE' AND m.expires_at>clock_timestamp())
 OR NOT EXISTS(SELECT FROM profitia_access.product_grants WHERE application_id='spendguru' AND organisation_id=g.organisation_id
  AND product='SPENDGURU' AND status='ACTIVE' AND expires_at>clock_timestamp() AND features @> ARRAY['assistant'])
 THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 INSERT INTO account_epochs(account_id,not_before)VALUES(uid,g.created_at) ON CONFLICT DO NOTHING;
 SELECT * INTO e FROM account_epochs WHERE account_id=uid FOR UPDATE;
 eid:=(command->>'evidenceId')::uuid;
 IF op='CAPTURE' THEN
  SELECT * INTO f FROM accepted_inputs WHERE grant_id=g.grant_id AND input_sha256=command->>'inputSha256' AND enabled FOR SHARE;
  IF NOT FOUND OR command->'sourceScopes'<>'null'::jsonb AND f.source_scopes IS DISTINCT FROM command->'sourceScopes' THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
  occurred:=(command->>'occurredAt')::timestamptz;earliest:=(command->>'earliestInputAt')::timestamptz;
  IF NOT isfinite(occurred) OR NOT isfinite(earliest) OR occurred>clock_timestamp() OR earliest>occurred OR earliest<e.not_before
  OR EXISTS(SELECT FROM jsonb_array_elements(f.source_scopes) s WHERE s->>'organisationId'<>g.organisation_id::text
   OR s->>'classification'<>'SHARED_KNOWLEDGE' OR (s->>'validUntil')::timestamptz<=clock_timestamp())
  THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
  SELECT least(g.expires_at,earliest+interval '168 hours',coalesce(min((s->>'validUntil')::timestamptz),g.expires_at)) INTO expiry FROM jsonb_array_elements(f.source_scopes) s;
  IF expiry<=clock_timestamp() THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
  INSERT INTO evidence_bindings VALUES(eid,uid,g.grant_id,f.input_sha256,e.epoch,i.storage_generation,occurred,earliest,expiry)ON CONFLICT DO NOTHING;
 END IF;
 SELECT * INTO b FROM evidence_bindings WHERE evidence_id=eid AND account_id=uid AND grant_id=g.grant_id
  AND epoch=e.epoch AND storage_generation=i.storage_generation AND earliest_input_at>=e.not_before AND expires_at>clock_timestamp();
 IF NOT FOUND OR op='CAPTURE' AND(b.input_sha256<>f.input_sha256 OR b.occurred_at<>occurred OR b.earliest_input_at<>earliest OR b.expires_at<>expiry)
 THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 SELECT * INTO f FROM accepted_inputs WHERE grant_id=b.grant_id AND input_sha256=b.input_sha256 AND enabled;
 IF NOT FOUND OR command->'sourceScopes'<>'null'::jsonb AND command->'sourceScopes' IS DISTINCT FROM f.source_scopes
 OR EXISTS(SELECT FROM jsonb_array_elements(f.source_scopes) s WHERE (s->>'validUntil')::timestamptz<=clock_timestamp())
 THEN RAISE EXCEPTION 'QUALITY_PURPOSE_UNAVAILABLE';END IF;
 -- Reuse the canonical security-event writer. This records authority decisions,
 -- never a transcript, ciphertext, HMAC proof or a claim that a model ran.
 PERFORM profitia_access.append_audit(jsonb_build_object('decisionId',gen_random_uuid(),'applicationId','spendguru','environment','development',
 'phase','DECISION','decision','ALLOW','reasonCode','QUALITY_PURPOSE_AUTHORISED',
 'operation',CASE op WHEN 'CAPTURE' THEN 'assistant.quality.authorize-capture' ELSE 'assistant.quality.authorize-read' END,
 'actorKind',CASE op WHEN 'CAPTURE' THEN 'HUMAN' ELSE 'SERVICE' END,'actorId',CASE op WHEN 'CAPTURE' THEN uid ELSE k.service_id END,
 'subjectUserId',uid,'organisationId',g.organisation_id,'resourceId',eid,'resourceType','assistant_quality_evidence','dataClass','ACCOUNT_PRIVATE',
 'ownerUserId',uid,'ownerOrganisationId',NULL,'policyVersion','access-v1:'||(d->>'revision'),
 'accessBasisType',CASE op WHEN 'CAPTURE' THEN 'ACCOUNT_SELF' ELSE 'SERVICE_GRANT' END,
 'accessVersion',g.grant_id::text||':'||g.version::text||':'||e.epoch::text,'accessSourceRef',g.source_ref,
 'feature','assistant','effect','READ','usagePolicy','NOT_APPLICABLE',
 'identityIssuer',CASE op WHEN 'CAPTURE' THEN event->>'identityIssuer' ELSE 'urn:profitia:database-quality-purpose:v1' END,
 'identityAudience','spendguru','identityProofRef',CASE op WHEN 'CAPTURE' THEN event->>'identityProofRef' ELSE 'database-quality:'||k.service_id::text END));
 RETURN r||jsonb_build_object('operation',CASE op WHEN 'CAPTURE' THEN 'assistant.quality.capture' ELSE 'assistant.quality.read' END,
 'actorKind',CASE op WHEN 'CAPTURE' THEN 'HUMAN' ELSE 'SERVICE' END,'actorId',CASE op WHEN 'CAPTURE' THEN uid ELSE k.service_id END,
 'accountId',uid,'validUntil',least(ms+30000,floor(extract(epoch FROM least(g.expires_at,b.expires_at))*1000))::bigint,
 'purpose',jsonb_build_object('id','ASSISTANT_QUALITY','policyVersion','1.0.0','grantId',g.grant_id,'validUntil',to_char(g.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
 'sourceScopes',f.source_scopes,'expiresAt',to_char(b.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'inputSha256',b.input_sha256);
END $fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_assistant_quality_access FROM PUBLIC;
GRANT USAGE ON SCHEMA profitia_assistant_quality_access TO sg2_private_development_runtime,sg2_assistant_quality_authority;
GRANT EXECUTE ON FUNCTION profitia_assistant_quality_access.apply(text,text) TO sg2_private_development_runtime,sg2_assistant_quality_authority;
