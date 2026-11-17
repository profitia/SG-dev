-- Additive Development-only private QA store. No installation, purpose grant,
-- enabling row or credential is seeded. Apply transactionally as the existing
-- product owner after exact-source review and ordinary role creation.
DO $guard$ BEGIN
 IF current_user<>'sg2_assistant_history_owner' OR current_database()<>'neondb'
 OR NOT EXISTS(SELECT 1 FROM sg2_assistant_history.installation WHERE singleton
  AND application_id='spendguru' AND environment='development'
  AND project_id='autumn-waterfall-65938876' AND branch_id='br-dry-hall-b294222f')
 THEN RAISE EXCEPTION 'QA_PRODUCT_OWNER_REQUIRED';END IF;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN('sg2_assistant_quality_capture','sg2_assistant_quality_reader')
  AND rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))<>2
 OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
  WHERE r.rolname IN('sg2_assistant_quality_capture','sg2_assistant_quality_reader'))
 THEN RAISE EXCEPTION 'QA_ORDINARY_ROLES_REQUIRED';END IF;
END $guard$;
CREATE SCHEMA sg2_assistant_quality_evidence AUTHORIZATION sg2_assistant_history_owner;
REVOKE ALL ON SCHEMA sg2_assistant_quality_evidence FROM PUBLIC;
CREATE TABLE sg2_assistant_quality_evidence.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_digest text NOT NULL CHECK(schema_digest='__QUALITY_EVIDENCE_SCHEMA_DIGEST__'),
 storage_generation uuid NOT NULL,test_account_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT false,source_ref text NOT NULL
);
CREATE TABLE sg2_assistant_quality_evidence.credentials(
 role_name name PRIMARY KEY CHECK(role_name IN('sg2_assistant_quality_capture','sg2_assistant_quality_reader')),
 service_id uuid NOT NULL,command_key bytea NOT NULL CHECK(octet_length(command_key)=32)
);
CREATE TABLE sg2_assistant_quality_evidence.evidence(
 evidence_id uuid PRIMARY KEY,account_id uuid NOT NULL,interaction_id uuid NOT NULL,
 storage_generation uuid NOT NULL,purpose_grant_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL,earliest_input_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 plaintext_sha256 text NOT NULL CHECK(plaintext_sha256~'^[a-f0-9]{64}$'),
 sealed jsonb NOT NULL CHECK(jsonb_typeof(sealed)='object' AND octet_length(sealed::text)<=263000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(account_id,interaction_id) REFERENCES sg2_assistant_history.turns(user_id,command_id) ON DELETE CASCADE,
 CHECK(earliest_input_at<=occurred_at AND expires_at<=occurred_at+interval '168 hours'
  AND expires_at<=earliest_input_at+interval '168 hours')
);
CREATE INDEX quality_evidence_expiry ON sg2_assistant_quality_evidence.evidence(expires_at);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','credentials','evidence'] LOOP
  EXECUTE format('ALTER TABLE sg2_assistant_quality_evidence.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE sg2_assistant_quality_evidence.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON sg2_assistant_quality_evidence.%I TO sg2_assistant_history_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('REVOKE ALL ON sg2_assistant_quality_evidence.%I FROM PUBLIC,sg2_assistant_quality_capture,sg2_assistant_quality_reader',t);
 END LOOP;
END $rls$;
CREATE FUNCTION sg2_assistant_quality_evidence.apply(p_json text,p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sg2_assistant_quality_evidence,pg_temp AS $fn$
DECLARE i installation%ROWTYPE;c credentials%ROWTYPE;e evidence%ROWTYPE;
 d jsonb;action text;keys text[];receipt jsonb;removed integer;expiry timestamptz;occurred timestamptz;earliest timestamptz;
 ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000);
BEGIN
 IF session_user NOT IN('sg2_assistant_quality_capture','sg2_assistant_quality_reader') OR current_database()<>'neondb'
 OR pg_has_role(session_user,'sg2_assistant_history_owner','MEMBER')
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND(NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))
 OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=session_user)
 OR p_json IS NULL OR octet_length(p_json)>280000
 THEN RAISE EXCEPTION 'QA_EVIDENCE_UNAVAILABLE';END IF;
 SELECT * INTO i FROM installation WHERE singleton;
 IF NOT FOUND OR i.schema_digest<>'__QUALITY_EVIDENCE_SCHEMA_DIGEST__' THEN RAISE EXCEPTION 'QA_EVIDENCE_UNAVAILABLE';END IF;
 SELECT * INTO c FROM credentials WHERE role_name=session_user;
 IF NOT FOUND OR p_proof IS NULL OR p_proof<>encode(public.hmac(convert_to(p_json,'UTF8'),c.command_key,'sha256'),'hex')
 THEN RAISE EXCEPTION 'QA_EVIDENCE_UNAVAILABLE';END IF;
 d:=p_json::jsonb;action:=d->>'action';
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR d->>'contract' IS DISTINCT FROM 'QualityEvidenceStore/1.0.0'
 OR d->>'schemaDigest' IS DISTINCT FROM i.schema_digest OR d->>'storageGeneration' IS DISTINCT FROM i.storage_generation::text
 OR d->>'serviceId' IS DISTINCT FROM c.service_id::text OR coalesce((d->>'until')::bigint,0)<=ms OR (d->>'until')::bigint>ms+10000
 OR coalesce(action,'') NOT IN('DESCRIPTOR','PUT','GET','PURGE')
 OR session_user='sg2_assistant_quality_capture' AND action='GET'
 OR session_user='sg2_assistant_quality_reader' AND action='PUT'
 THEN RAISE EXCEPTION 'QA_EVIDENCE_UNAVAILABLE';END IF;
 keys:=ARRAY['contract','action','schemaDigest','serviceId','storageGeneration','until']||
  CASE action WHEN 'PUT' THEN ARRAY['accountId','evidenceId','interactionId','occurredAt','earliestInputAt','expiresAt','purposeGrantId','plaintextSha256','sealed']
  WHEN 'GET' THEN ARRAY['accountId','evidenceId'] ELSE ARRAY[]::text[] END;
 IF ARRAY(SELECT jsonb_object_keys(d) ORDER BY 1)<>ARRAY(SELECT unnest(keys) ORDER BY 1)
 THEN RAISE EXCEPTION 'QA_EVIDENCE_UNAVAILABLE';END IF;
 receipt:=jsonb_build_object('applicationId','spendguru','environment','development','projectId','autumn-waterfall-65938876',
  'branchId','br-dry-hall-b294222f','databaseName',current_database(),'runtimeRole',session_user,
  'schemaDigest',i.schema_digest,'serviceId',c.service_id,'storageGeneration',i.storage_generation);
 IF action='DESCRIPTOR' THEN RETURN receipt||jsonb_build_object('enabled',i.enabled,'mode','CONTROLLED_ACCOUNT_ONLY');END IF;
 IF action='PURGE' THEN
  DELETE FROM evidence WHERE expires_at<=clock_timestamp() OR storage_generation<>i.storage_generation;
  GET DIAGNOSTICS removed=ROW_COUNT;RETURN receipt||jsonb_build_object('removed',removed);
 END IF;
 IF NOT i.enabled OR (d->>'accountId')::uuid IS DISTINCT FROM i.test_account_id
 THEN RAISE EXCEPTION 'QA_EVIDENCE_UNAVAILABLE';END IF;
 IF action='PUT' THEN
  occurred:=(d->>'occurredAt')::timestamptz;earliest:=(d->>'earliestInputAt')::timestamptz;expiry:=(d->>'expiresAt')::timestamptz;
  IF occurred IS NULL OR earliest IS NULL OR expiry IS NULL OR occurred>clock_timestamp() OR earliest>occurred
   OR expiry<=clock_timestamp() OR expiry>occurred+interval '168 hours' OR expiry>earliest+interval '168 hours'
   OR coalesce(d->>'plaintextSha256','') !~ '^[a-f0-9]{64}$' OR (d->>'evidenceId')::uuid IS NULL
   OR (d->>'purposeGrantId')::uuid IS NULL OR (d->>'interactionId')::uuid IS NULL
   OR jsonb_typeof(d->'sealed') IS DISTINCT FROM 'object'
   OR ARRAY(SELECT jsonb_object_keys(d->'sealed') ORDER BY 1)<>ARRAY['ciphertext','nonce','tag']
   OR coalesce(d->'sealed'->>'nonce','') !~ '^[A-Za-z0-9+/]{16}$'
   OR coalesce(d->'sealed'->>'tag','') !~ '^[A-Za-z0-9+/]{22}==$'
   OR coalesce(d->'sealed'->>'ciphertext','') !~ '^[A-Za-z0-9+/]+={0,2}$'
   OR length(d->'sealed'->>'ciphertext')>262144
   OR NOT EXISTS(SELECT 1 FROM sg2_assistant_history.turns t WHERE t.user_id=i.test_account_id
    AND t.command_id=(d->>'interactionId')::uuid AND t.created_at>=earliest AND t.created_at<=occurred+interval '2 minutes')
  THEN RAISE EXCEPTION 'QA_EVIDENCE_UNAVAILABLE';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(d->>'evidenceId',0));
  SELECT * INTO e FROM evidence WHERE evidence_id=(d->>'evidenceId')::uuid;
  IF FOUND THEN
   IF e.account_id<>i.test_account_id OR e.plaintext_sha256<>d->>'plaintextSha256'
    OR e.interaction_id<>(d->>'interactionId')::uuid OR e.storage_generation<>i.storage_generation OR e.expires_at<>expiry
    OR e.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'QA_EVIDENCE_CONFLICT';END IF;
   RETURN receipt||jsonb_build_object('stored',true);
  END IF;
  INSERT INTO evidence(evidence_id,account_id,interaction_id,storage_generation,purpose_grant_id,occurred_at,earliest_input_at,expires_at,plaintext_sha256,sealed)
   VALUES((d->>'evidenceId')::uuid,i.test_account_id,(d->>'interactionId')::uuid,i.storage_generation,
    (d->>'purposeGrantId')::uuid,occurred,earliest,expiry,d->>'plaintextSha256',d->'sealed');
  RETURN receipt||jsonb_build_object('stored',true);
 END IF;
 SELECT * INTO e FROM evidence WHERE evidence_id=(d->>'evidenceId')::uuid AND account_id=i.test_account_id
  AND storage_generation=i.storage_generation AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'QA_EVIDENCE_UNAVAILABLE';END IF;
 RETURN receipt||jsonb_build_object('sealed',e.sealed,'plaintextSha256',e.plaintext_sha256);
END $fn$;
REVOKE ALL ON FUNCTION sg2_assistant_quality_evidence.apply(text,text) FROM PUBLIC;
GRANT USAGE ON SCHEMA sg2_assistant_quality_evidence TO sg2_assistant_quality_capture,sg2_assistant_quality_reader;
GRANT EXECUTE ON FUNCTION sg2_assistant_quality_evidence.apply(text,text) TO sg2_assistant_quality_capture,sg2_assistant_quality_reader;
