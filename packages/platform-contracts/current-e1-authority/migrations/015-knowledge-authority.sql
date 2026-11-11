-- Optional Platform Knowledge contract in the EXISTING central E1 authority.
-- Schema only: no accounts, permissions, keys, entitlements or live enrollments.
DO $$ BEGIN IF current_user<>'profitia_access_owner' OR to_regclass('profitia_e1_authority.receivers') IS NULL
 THEN RAISE EXCEPTION 'CURRENT_E1_OWNER_REQUIRED'; END IF; END $$;
CREATE TABLE profitia_e1_authority.knowledge_receivers(
 login_role name PRIMARY KEY, application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
 kind text NOT NULL CHECK(kind IN ('API','WORKER')), binding jsonb NOT NULL,
 origin text NOT NULL CHECK(origin~'^https://[^/?#*]+$'), authority_origin text NOT NULL CHECK(authority_origin~'^https://[^/?#*]+$'),
 issuer text NOT NULL, authorized_parties text[] NOT NULL,
 key_id text, public_key text, status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
 version bigint NOT NULL DEFAULT 1, source_ref text NOT NULL, expires_at timestamptz NOT NULL,
 CHECK(kind='API' OR(key_id IS NOT NULL AND public_key LIKE '-----BEGIN PUBLIC KEY-----%')),
 CHECK(binding->>'environment'='development' AND binding->>'projectId'='sparkling-sky-79692560'
  AND binding->>'branchId'='br-billowing-grass-b9ko5s4f' AND binding->>'databaseName'='platform_knowledge')
);
-- Exact feature grants belong to E1, never the product database. Private scope
-- is account-based and has no organisation owner. Existing org grants do not
-- become private grants. Explicit DENY wins; installation creates none.
CREATE TABLE profitia_e1_authority.knowledge_grants(
 grant_id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES profitia_access.accounts(user_id),
 scope text NOT NULL CHECK(scope IN ('PROFITIA_SHARED','ACCOUNT_PRIVATE')),
 operation text NOT NULL CHECK(operation IN ('document.import','document.read','document.query','document.publish','document.withdraw','document.delete','memory.read','memory.write','memory.forget')),
 effect text NOT NULL CHECK(effect IN ('ALLOW','DENY')), use_purpose text NOT NULL CHECK(use_purpose IN ('PROFITIA_INTERNAL','CUSTOMER_SERVICE')),
 binding_standard boolean NOT NULL DEFAULT false, status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
 version bigint NOT NULL DEFAULT 1, source_ref text NOT NULL, expires_at timestamptz NOT NULL,
 CHECK(scope='ACCOUNT_PRIVATE' OR operation NOT LIKE 'memory.%'),
 CHECK(NOT binding_standard OR(scope='PROFITIA_SHARED' AND operation='document.publish'))
);
CREATE TABLE profitia_e1_authority.knowledge_delegations(
 delegation_id uuid PRIMARY KEY, job_id uuid NOT NULL UNIQUE, source_id uuid NOT NULL, generation_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES profitia_access.accounts(user_id), issuer text NOT NULL, subject text NOT NULL,
 scope text NOT NULL CHECK(scope IN ('PROFITIA_SHARED','ACCOUNT_PRIVATE')), rights_digest text NOT NULL,
 source_version integer NOT NULL, maximum_microusd bigint NOT NULL CHECK(maximum_microusd BETWEEN 1 AND 1000000),
 grant_fingerprint text NOT NULL, status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 CHECK(expires_at<=created_at+interval '30 minutes')
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['knowledge_receivers','knowledge_grants','knowledge_delegations'] LOOP
 EXECUTE format('ALTER TABLE profitia_e1_authority.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE profitia_e1_authority.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owner_access ON profitia_e1_authority.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
 EXECUTE format('CREATE TRIGGER authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_e1_authority.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
END LOOP; END $$;
CREATE FUNCTION profitia_e1_authority.knowledge_receiver(p_role text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r profitia_e1_authority.knowledge_receivers%ROWTYPE; d jsonb; BEGIN
 d:=profitia_access.runtime_descriptor();
 IF d->>'applicationId'<>'identity-runtime-development' OR d->>'environment'<>'development' THEN RETURN NULL;END IF;
 SELECT k.* INTO r FROM profitia_e1_authority.knowledge_receivers k JOIN profitia_access.applications a ON a.application_id=k.application_id AND a.status='ACTIVE'
 WHERE k.login_role=p_role AND k.status='ACTIVE' AND k.expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('applicationId',r.application_id,'kind',r.kind,'binding',r.binding,'origin',r.origin,'authorityOrigin',r.authority_origin,
  'issuer',r.issuer,'authorizedParties',r.authorized_parties,'keyId',r.key_id,'publicKey',r.public_key);
END $$;
CREATE FUNCTION profitia_e1_authority.knowledge_ready() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT profitia_e1_authority.knowledge_receiver('platform_knowledge_api') IS NOT NULL
 AND profitia_e1_authority.knowledge_receiver('platform_knowledge_worker') IS NOT NULL $$;
CREATE FUNCTION profitia_e1_authority.knowledge_state(p_user uuid,p_scope text,p_operation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE grants jsonb; organisations jsonb; u jsonb; chosen profitia_e1_authority.knowledge_grants%ROWTYPE; fingerprint text; BEGIN
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 SELECT to_jsonb(a) INTO u FROM profitia_access.accounts a WHERE user_id=p_user AND status='ACTIVE';IF u IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO chosen FROM profitia_e1_authority.knowledge_grants WHERE user_id=p_user AND scope=p_scope AND operation=p_operation
 AND effect='ALLOW' AND status='ACTIVE' AND expires_at>clock_timestamp() ORDER BY expires_at DESC LIMIT 1;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM profitia_e1_authority.knowledge_grants WHERE user_id=p_user AND scope=p_scope AND operation=p_operation
 AND effect='DENY' AND status='ACTIVE' AND expires_at>clock_timestamp()) THEN RETURN NULL;END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY grant_id),'[]') INTO grants FROM profitia_e1_authority.knowledge_grants g WHERE user_id=p_user;
 SELECT coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('organisationStatus',o.status) ORDER BY m.organisation_id),'[]') INTO organisations
 FROM profitia_access.memberships m JOIN profitia_access.organisations o USING(organisation_id) WHERE m.user_id=p_user;
 fingerprint:=encode(public.digest(convert_to(jsonb_build_object('account',u,'grants',grants,'memberships',organisations)::text,'UTF8'),'sha256'),'hex');
 RETURN jsonb_build_object('grantFingerprint',fingerprint,'delegationFingerprint',encode(public.digest(convert_to(jsonb_build_object('account',u,'grant',to_jsonb(chosen))::text,'UTF8'),'sha256'),'hex'),'grantExpiresAt',chosen.expires_at,
  'principal',jsonb_build_object('environment','development','internalUserId',p_user,'organisationIds',
   (SELECT coalesce(jsonb_agg(m.organisation_id ORDER BY m.organisation_id),'[]') FROM profitia_access.memberships m JOIN profitia_access.organisations o USING(organisation_id)
    WHERE m.user_id=p_user AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND o.status='ACTIVE'),
   'usePurpose',chosen.use_purpose,'sharedKnowledgeAllowed',p_scope='PROFITIA_SHARED',
   'operator',p_scope='PROFITIA_SHARED' AND EXISTS(SELECT 1 FROM profitia_e1_authority.knowledge_grants WHERE user_id=p_user AND scope=p_scope
    AND operation='document.import' AND effect='ALLOW' AND status='ACTIVE' AND expires_at>clock_timestamp())
    AND NOT EXISTS(SELECT 1 FROM profitia_e1_authority.knowledge_grants WHERE user_id=p_user AND scope=p_scope AND operation='document.import' AND effect='DENY' AND status='ACTIVE' AND expires_at>clock_timestamp()),
   'publishBindingStandard',chosen.binding_standard));
END $$;
CREATE FUNCTION profitia_e1_authority.knowledge_human_issue(p_role text,p_identity jsonb,p_actor jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb; e profitia_access.external_identities%ROWTYPE; u profitia_access.accounts%ROWTYPE; s text; st jsonb; state jsonb;
 expiry timestamptz; principal jsonb; d jsonb; delegated jsonb:=NULL; grant_fp text; started_at timestamptz:=clock_timestamp(); BEGIN
 r:=profitia_e1_authority.knowledge_receiver(p_role);
 IF r IS NULL OR r->>'kind'<>'API' OR p_request->>'requestOrigin' IS DISTINCT FROM r->>'origin' OR p_identity->>'issuer' IS DISTINCT FROM r->>'issuer'
 OR p_request->>'role' IS DISTINCT FROM p_role OR coalesce(p_request->>'nonce','')!~'^[a-f0-9]{64}$'
 OR coalesce(p_request->>'requestDigest','')!~'^[a-f0-9]{64}$' THEN RETURN NULL;END IF;
 SELECT * INTO e FROM profitia_access.external_identities WHERE issuer=p_identity->>'issuer' AND subject=p_identity->>'subject' AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO u FROM profitia_access.accounts WHERE user_id=e.user_id AND status='ACTIVE';
 IF NOT FOUND OR p_actor->>'kind'<>'HUMAN' OR p_actor->>'userId' IS DISTINCT FROM u.user_id::text OR p_actor->>'actorId' IS DISTINCT FROM u.user_id::text
 OR p_actor->>'audience' IS DISTINCT FROM r->>'applicationId' OR p_actor->>'environment'<>'development'
 OR p_actor->>'proofRef' NOT LIKE 'clerk-session:%:binding:'||e.binding_id::text||':'||e.version::text||':'||u.version::text
 OR(p_actor->>'expiresAt')::timestamptz<=clock_timestamp() THEN RETURN NULL;END IF;
 expiry:=least(e.expires_at,(p_actor->>'expiresAt')::timestamptz,clock_timestamp()+interval '15 seconds');
 FOR s IN SELECT jsonb_array_elements_text(p_request->'scopes') LOOP
  st:=profitia_e1_authority.knowledge_state(u.user_id,s,p_request->>'operation');IF st IS NULL THEN RETURN NULL;END IF;
  IF principal IS NULL THEN principal:=st->'principal';grant_fp:=st->>'grantFingerprint';ELSE
   principal:=principal||jsonb_build_object('sharedKnowledgeAllowed',(principal->>'sharedKnowledgeAllowed')::boolean OR(st->'principal'->>'sharedKnowledgeAllowed')::boolean,
    'operator',(principal->>'operator')::boolean OR(st->'principal'->>'operator')::boolean,
    'usePurpose',CASE WHEN principal->>'usePurpose'='PROFITIA_INTERNAL' OR st->'principal'->>'usePurpose'='PROFITIA_INTERNAL' THEN 'PROFITIA_INTERNAL' ELSE 'CUSTOMER_SERVICE' END);
  END IF;
  expiry:=least(expiry,(st->>'grantExpiresAt')::timestamptz);
 END LOOP;
 IF principal IS NULL THEN RETURN NULL;END IF;
 d:=p_request->'delegation';
 IF d IS NOT NULL AND d<>'null'::jsonb THEN
  IF p_request->>'operation'<>'document.import' OR jsonb_array_length(p_request->'scopes')<>1 OR d->>'scope' IS DISTINCT FROM p_request->'scopes'->>0
   OR d->>'rightsDigest'!~'^[a-f0-9]{64}$' OR(d->>'maximumMicrousd')::bigint NOT BETWEEN 1 AND 1000000 OR(d->>'sourceVersion')::integer<>1
   OR(d->>'scope'='ACCOUNT_PRIVATE' AND d->>'ownerUserId' IS NOT NULL AND d->>'ownerUserId' IS DISTINCT FROM u.user_id::text)
   OR(d->>'scope'='PROFITIA_SHARED' AND d->>'ownerUserId' IS NOT NULL) THEN RETURN NULL;END IF;
  INSERT INTO profitia_e1_authority.knowledge_delegations(delegation_id,job_id,source_id,generation_id,user_id,issuer,subject,scope,rights_digest,source_version,maximum_microusd,grant_fingerprint,status,created_at,expires_at)
   VALUES(gen_random_uuid(),(d->>'jobId')::uuid,(d->>'sourceId')::uuid,(d->>'generationId')::uuid,u.user_id,e.issuer,e.subject,d->>'scope',d->>'rightsDigest',1,(d->>'maximumMicrousd')::bigint,st->>'delegationFingerprint','ACTIVE',started_at,
    least((st->>'grantExpiresAt')::timestamptz,started_at+interval '30 minutes')) ON CONFLICT(job_id) DO NOTHING;
  SELECT jsonb_build_object('delegationId',delegation_id,'jobId',job_id,'sourceId',source_id,'generationId',generation_id,'rightsDigest',rights_digest,'scope',scope,'sourceVersion',source_version,'maximumMicrousd',maximum_microusd,'expiresAt',expires_at)
   INTO delegated FROM profitia_e1_authority.knowledge_delegations WHERE job_id=(d->>'jobId')::uuid AND source_id=(d->>'sourceId')::uuid AND generation_id=(d->>'generationId')::uuid AND user_id=u.user_id AND status='ACTIVE';
  IF delegated IS NULL THEN RETURN NULL;END IF;
 END IF;
 principal:=principal||jsonb_build_object('allowedScopes',p_request->'scopes');
 RETURN jsonb_build_object('contract','profitia.current-e1-knowledge/1.0.0','nonce',p_request->>'nonce','binding',r->'binding','principal',principal,
  'operation',p_request->>'operation','resourceId',p_request->>'resourceId','scopes',p_request->'scopes','grantFingerprint',grant_fp,'expiresAt',expiry,'delegation',delegated);
END $$;
CREATE FUNCTION profitia_e1_authority.knowledge_job_identity(p_role text,p_job uuid,p_delegation uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('environment','development','issuer',d.issuer,'subject',d.subject)
 FROM profitia_e1_authority.knowledge_delegations d WHERE d.job_id=p_job AND d.delegation_id=p_delegation AND d.status='ACTIVE' AND d.expires_at>clock_timestamp()
 AND profitia_e1_authority.knowledge_receiver(p_role)->>'kind'='WORKER' $$;
CREATE FUNCTION profitia_e1_authority.knowledge_job_issue(p_role text,p_job uuid,p_delegation uuid,p_nonce text,p_observation jsonb,p_require_external boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb; d profitia_e1_authority.knowledge_delegations%ROWTYPE; st jsonb; BEGIN
 r:=profitia_e1_authority.knowledge_receiver(p_role);IF r IS NULL OR r->>'kind'<>'WORKER' OR p_nonce!~'^[a-f0-9]{64}$' THEN RETURN NULL;END IF;
 SELECT * INTO d FROM profitia_e1_authority.knowledge_delegations WHERE delegation_id=p_delegation AND job_id=p_job AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL;END IF;
 st:=profitia_e1_authority.knowledge_state(d.user_id,d.scope,'document.import');
 IF st IS NULL OR st->>'delegationFingerprint' IS DISTINCT FROM d.grant_fingerprint OR(p_require_external AND(p_observation->>'status'<>'ACTIVE'
 OR p_observation->>'issuer' IS DISTINCT FROM d.issuer OR p_observation->>'subject' IS DISTINCT FROM d.subject OR p_observation->>'environment'<>'development'
 OR NOT coalesce((p_observation->>'observedAt')::timestamptz<=clock_timestamp() AND(p_observation->>'expiresAt')::timestamptz>clock_timestamp()
 AND(p_observation->>'expiresAt')::timestamptz<=(p_observation->>'observedAt')::timestamptz+interval '5 seconds',false))) THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_access.external_identities WHERE issuer=d.issuer AND subject=d.subject AND user_id=d.user_id AND status='ACTIVE' AND expires_at>clock_timestamp()) THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('contract','profitia.current-e1-knowledge/1.0.0','nonce',p_nonce,'binding',r->'binding','principal',(st->'principal')||jsonb_build_object('allowedScopes',jsonb_build_array(d.scope)),
 'grantFingerprint',st->>'grantFingerprint','expiresAt',least(d.expires_at,clock_timestamp()+interval '15 seconds'),
 'sourceId',d.source_id,'generationId',d.generation_id,'rightsDigest',d.rights_digest,'sourceVersion',d.source_version,'maximumMicrousd',d.maximum_microusd,'delegationExpiresAt',d.expires_at);
END $$;
REVOKE ALL ON profitia_e1_authority.knowledge_receivers,profitia_e1_authority.knowledge_grants,profitia_e1_authority.knowledge_delegations FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_e1_authority.knowledge_receiver(text),profitia_e1_authority.knowledge_ready(),profitia_e1_authority.knowledge_state(uuid,text,text),
 profitia_e1_authority.knowledge_human_issue(text,jsonb,jsonb,jsonb),profitia_e1_authority.knowledge_job_identity(text,uuid,uuid),
 profitia_e1_authority.knowledge_job_issue(text,uuid,uuid,text,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION profitia_e1_authority.knowledge_receiver(text),profitia_e1_authority.knowledge_ready(),
 profitia_e1_authority.knowledge_human_issue(text,jsonb,jsonb,jsonb),profitia_e1_authority.knowledge_job_identity(text,uuid,uuid),
 profitia_e1_authority.knowledge_job_issue(text,uuid,uuid,text,jsonb,boolean) TO identity_b1_runtime;
