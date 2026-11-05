-- Additive E1 technical component/key enrollment. No accounts, memberships,
-- runtime roles, product grants, service grants or provider budgets are created.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR to_regclass('profitia_services.read_grants') IS NULL
 OR to_regclass('profitia_e1_authority.receivers') IS NULL THEN
  RAISE EXCEPTION 'Existing accepted E1 and service-read authority required';
 END IF;
END $guard$;
CREATE TABLE profitia_e1_authority.source_receivers (
 application_id text PRIMARY KEY REFERENCES profitia_e1_authority.receivers(application_id),
 target_origin text NOT NULL CHECK(target_origin~'^https://[^/?#*]+$'),
 product_application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
CREATE TABLE profitia_e1_authority.source_components (
 component_id text NOT NULL CHECK(component_id~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
 key_id text NOT NULL CHECK(key_id~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
 application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
 login_role name NOT NULL REFERENCES profitia_access.runtime_bindings(login_role),
 receiver_application_id text NOT NULL REFERENCES profitia_e1_authority.source_receivers(application_id),
 source_origin text NOT NULL CHECK(length(source_origin) BETWEEN 1 AND 256 AND source_origin!~'[[:space:]*]'),
 public_key text NOT NULL CHECK(length(public_key) BETWEEN 64 AND 1024 AND public_key LIKE '-----BEGIN PUBLIC KEY-----%'),
 deployment_id text NOT NULL CHECK(length(deployment_id) BETWEEN 1 AND 256),
 configuration_version text NOT NULL CHECK(length(configuration_version) BETWEEN 1 AND 256),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 PRIMARY KEY(component_id,key_id)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['source_receivers','source_components'] LOOP
  EXECUTE format('ALTER TABLE profitia_e1_authority.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_e1_authority.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_e1_authority.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE TRIGGER advance_version BEFORE UPDATE ON profitia_e1_authority.%I FOR EACH ROW EXECUTE FUNCTION profitia_access.advance_version()',t);
  EXECUTE format('CREATE TRIGGER authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_e1_authority.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
  EXECUTE format('CREATE TRIGGER authority_truncate_fence BEFORE TRUNCATE ON profitia_e1_authority.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
 END LOOP;
END $policies$;
CREATE FUNCTION profitia_e1_authority.source_ready() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_authority,profitia_access AS $fn$
DECLARE d jsonb;
BEGIN
 d:=profitia_access.runtime_descriptor();
 RETURN d->>'applicationId'='identity-runtime-development' AND d->>'environment'='development'
  AND EXISTS(SELECT 1 FROM profitia_e1_authority.source_receivers s JOIN profitia_e1_authority.receivers r USING(application_id)
    JOIN profitia_access.applications a ON a.application_id=s.application_id AND a.status='ACTIVE'
    WHERE s.status='ACTIVE' AND s.expires_at>clock_timestamp() AND r.status='ACTIVE' AND r.expires_at>clock_timestamp());
END $fn$;
CREATE FUNCTION profitia_e1_authority.source_consumer(p_component text,p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_authority,profitia_access AS $fn$
DECLARE d jsonb; k profitia_e1_authority.source_components%ROWTYPE; r profitia_e1_authority.source_receivers%ROWTYPE;
BEGIN
 d:=profitia_access.runtime_descriptor();
 IF d->>'applicationId'<>'identity-runtime-development' OR d->>'environment'<>'development' THEN RAISE EXCEPTION 'Identity authority required' USING ERRCODE='42501'; END IF;
 SELECT c.* INTO k FROM profitia_e1_authority.source_components c
 JOIN profitia_access.runtime_bindings b ON b.login_role=c.login_role AND b.application_id=c.application_id AND b.status='ACTIVE'
 JOIN profitia_access.applications a ON a.application_id=c.application_id AND a.status='ACTIVE'
 JOIN pg_roles pr ON pr.rolname=c.login_role AND pr.rolcanlogin AND NOT(pr.rolsuper OR pr.rolbypassrls OR pr.rolcreaterole OR pr.rolcreatedb OR pr.rolinherit OR pr.rolreplication)
 WHERE NOT EXISTS(SELECT 1 FROM pg_roles owner_role WHERE (owner_role.rolname LIKE '%\_owner' ESCAPE '\' OR owner_role.rolname LIKE '%\_migrator' ESCAPE '\' OR owner_role.rolsuper OR owner_role.rolbypassrls OR owner_role.rolcreaterole OR owner_role.rolcreatedb OR owner_role.rolreplication) AND pg_has_role(pr.oid,owner_role.oid,'MEMBER'))
 AND c.component_id=p_component AND c.key_id=p_key AND c.status='ACTIVE' AND c.expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT s.* INTO r FROM profitia_e1_authority.source_receivers s
 JOIN profitia_e1_authority.receivers old ON old.application_id=s.application_id AND old.status='ACTIVE' AND old.expires_at>clock_timestamp()
 JOIN profitia_access.applications a ON a.application_id=s.application_id AND a.status='ACTIVE'
 WHERE s.application_id=k.receiver_application_id AND s.status='ACTIVE' AND s.expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('status',k.status,'componentId',k.component_id,'consumerApplicationId',k.application_id,'receiverApplicationId',r.application_id,
  'sourceOrigin',k.source_origin,'targetOrigin',r.target_origin,'keyId',k.key_id,'publicKey',k.public_key,'expiresAt',least(k.expires_at,r.expires_at),
  'version',k.version,'deploymentId',k.deployment_id,'configurationVersion',k.configuration_version,
  'keyDigest',encode(public.digest(convert_to(to_jsonb(k)::text,'UTF8'),'sha256'),'hex'));
END $fn$;

CREATE FUNCTION profitia_e1_authority.issue_source(p_claim jsonb,p_key_digest text,p_identity jsonb,p_actor jsonb,p_request jsonb,p_previous jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_authority,profitia_access,profitia_services AS $fn$
DECLARE kd jsonb; k profitia_e1_authority.source_components%ROWTYPE; sr profitia_e1_authority.source_receivers%ROWTYPE; r profitia_e1_authority.receivers%ROWTYPE;
 e profitia_access.external_identities%ROWTYPE; u profitia_access.accounts%ROWTYPE; m profitia_access.memberships%ROWTYPE;
 o profitia_access.organisations%ROWTYPE; pg profitia_access.product_grants%ROWTYPE; sb profitia_services.runtime_bindings%ROWTYPE; sg profitia_services.read_grants%ROWTYPE;
 permissions jsonb; denies jsonb; fingerprint text; expiry timestamptz; actor jsonb; state jsonb; consumer jsonb; frame jsonb; raw text; old jsonb; kind text;
BEGIN
 -- Fence E1/key updates during this observation; never copy or cache ALLOW.
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 kd:=profitia_e1_authority.source_consumer(p_claim->>'componentId',p_claim->>'keyId');
 IF kd IS NULL OR kd->>'keyDigest' IS DISTINCT FROM p_key_digest THEN RETURN NULL; END IF;
 SELECT * INTO STRICT k FROM profitia_e1_authority.source_components WHERE component_id=p_claim->>'componentId' AND key_id=p_claim->>'keyId';
 SELECT * INTO STRICT sr FROM profitia_e1_authority.source_receivers WHERE application_id=k.receiver_application_id;
 SELECT * INTO STRICT r FROM profitia_e1_authority.receivers WHERE application_id=k.receiver_application_id;
 kind:=p_request->>'kind';
 IF p_claim->>'contract' IS DISTINCT FROM 'profitia.first-party-source-access/1.0.0'
 OR p_claim->>'environment' IS DISTINCT FROM 'development' OR p_claim->>'consumerApplicationId' IS DISTINCT FROM k.application_id
 OR p_claim->>'receiverApplicationId' IS DISTINCT FROM r.application_id OR p_claim->>'sourceOrigin' IS DISTINCT FROM k.source_origin OR p_claim->>'targetOrigin' IS DISTINCT FROM sr.target_origin
 OR p_request->'binding' IS DISTINCT FROM r.binding OR p_request->>'operation' IS DISTINCT FROM 'knowledge.read'
 OR coalesce(p_request->>'resourceId','')!~'^api\.[a-z-]+\.[a-z-]+$' OR coalesce(p_request->>'nonce','')!~'^[a-f0-9]{64}$'
 OR coalesce(p_request->>'transactionId','')!~'^[0-9]{1,20}$' OR coalesce(p_request->>'requestDigest','')!~'^[a-f0-9]{64}$'
 OR p_request->>'componentId' IS DISTINCT FROM k.component_id OR p_request->>'keyId' IS DISTINCT FROM k.key_id
 OR p_request->>'consumerRequestId' IS DISTINCT FROM p_claim->>'requestId'
 OR p_request->>'requestDigest' IS DISTINCT FROM p_claim->>'bodyDigest'
 OR NOT coalesce((p_claim->>'expiresAt')::bigint>extract(epoch FROM clock_timestamp())*1000 AND (p_claim->>'issuedAt')::bigint<extract(epoch FROM clock_timestamp())*1000+3000,false) THEN RETURN NULL; END IF;
 SELECT * INTO o FROM profitia_access.organisations WHERE organisation_id=(p_request->>'organisationId')::uuid AND status='ACTIVE';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id=k.application_id AND fixed_organisation_id IS NOT NULL AND fixed_organisation_id<>o.organisation_id) THEN RETURN NULL; END IF;
 SELECT * INTO pg FROM profitia_access.product_grants WHERE application_id=sr.product_application_id AND organisation_id=o.organisation_id
  AND product='SPENDGURU' AND status='ACTIVE' AND 'market'=ANY(features) AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id=sr.product_application_id AND status='ACTIVE' AND (fixed_organisation_id IS NULL OR fixed_organisation_id=o.organisation_id)) THEN RETURN NULL; END IF;
 expiry:=least(k.expires_at,sr.expires_at,r.expires_at,pg.expires_at,to_timestamp((p_claim->>'expiresAt')::numeric/1000),clock_timestamp()+interval '15 seconds');
 IF kind='HUMAN' THEN
  IF p_request->>'grantId' IS NOT NULL OR p_identity->>'issuer' IS DISTINCT FROM r.issuer THEN RETURN NULL; END IF;
  SELECT * INTO e FROM profitia_access.external_identities WHERE issuer=r.issuer AND subject=p_identity->>'subject' AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO u FROM profitia_access.accounts WHERE user_id=e.user_id AND status='ACTIVE';
  IF NOT FOUND OR p_actor->>'kind' IS DISTINCT FROM 'HUMAN' OR p_actor->>'actorId' IS DISTINCT FROM u.user_id::text
   OR p_actor->>'userId' IS DISTINCT FROM u.user_id::text OR p_actor->>'audience' IS DISTINCT FROM r.application_id
   OR p_actor->>'issuer' IS DISTINCT FROM r.issuer OR p_actor->>'environment' IS DISTINCT FROM 'development'
   OR p_actor->>'proofRef' NOT LIKE 'clerk-session:%:binding:'||e.binding_id::text||':'||e.version::text||':'||u.version::text THEN RETURN NULL; END IF;
  SELECT * INTO m FROM profitia_access.memberships WHERE user_id=u.user_id AND organisation_id=o.organisation_id AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  expiry:=least(expiry,m.expires_at,e.expires_at,(p_actor->>'expiresAt')::timestamptz);actor:=p_actor||jsonb_build_object('expiresAt',expiry);
  SELECT coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id) ORDER BY grant_id) FILTER(WHERE effect='ALLOW' AND application_id=sr.product_application_id),'[]'::jsonb),
   coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id) ORDER BY grant_id) FILTER(WHERE effect='DENY'),'[]'::jsonb)
   INTO permissions,denies FROM profitia_access.permission_grants WHERE application_id IN(sr.product_application_id,k.application_id) AND organisation_id=o.organisation_id AND user_id=u.user_id;
 ELSEIF kind='SERVICE' THEN
  IF p_identity IS NOT NULL OR p_actor IS NOT NULL THEN RETURN NULL; END IF;
  SELECT * INTO sb FROM profitia_services.runtime_bindings WHERE login_role=k.login_role AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO sg FROM profitia_services.read_grants WHERE grant_id=(p_request->>'grantId')::uuid AND login_role=sb.login_role AND organisation_id=o.organisation_id
   AND operation='knowledge.read' AND feature='market' AND effect='ALLOW' AND status='ACTIVE' AND expires_at>clock_timestamp() AND (resource_id IS NULL OR resource_id=p_request->>'resourceId');
  IF NOT FOUND THEN RETURN NULL; END IF;
  expiry:=least(expiry,sb.expires_at,sg.expires_at);
  actor:=jsonb_build_object('kind','SERVICE','actorId',sb.service_id,'serviceId',sb.service_id,'issuer','urn:profitia:database-service-runtime:v1',
   'audience',r.application_id,'environment','development','proofRef','database-service:'||sb.binding_id::text||':'||sb.version::text,'expiresAt',expiry);
  SELECT coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id) ORDER BY grant_id) FILTER(WHERE effect='ALLOW'),'[]'::jsonb),
   coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id) ORDER BY grant_id) FILTER(WHERE effect='DENY'),'[]'::jsonb)
   INTO permissions,denies FROM profitia_services.read_grants WHERE login_role=sb.login_role AND organisation_id=o.organisation_id AND status='ACTIVE' AND expires_at>clock_timestamp();
 ELSE RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(permissions) p WHERE p->>'operation'='knowledge.read' AND p->>'feature'='market' AND (p->>'resourceId' IS NULL OR p->>'resourceId'=p_request->>'resourceId'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(denies) p WHERE p->>'operation'='knowledge.read' AND p->>'feature'='market' AND (p->>'resourceId' IS NULL OR p->>'resourceId'=p_request->>'resourceId')) THEN RETURN NULL; END IF;
 IF NOT isfinite(expiry) OR expiry<=clock_timestamp() THEN RETURN NULL; END IF;
 -- Canonical operation-context still evaluates these permissions, explicit
 -- denies, product and shared resource. This function supplies current facts.
 fingerprint:=encode(public.digest(convert_to(jsonb_build_object('component',to_jsonb(k),'receiver',to_jsonb(sr),'receiverKey',r.key_id,'receiverStatus',r.status,'receiverExpiry',r.expires_at,
  'account',to_jsonb(u),'identity',to_jsonb(e),'membership',to_jsonb(m),'organisation',to_jsonb(o),'product',to_jsonb(pg),'service',to_jsonb(sb),'grant',to_jsonb(sg),'permissions',permissions,'denies',denies)::text,'UTF8'),'sha256'),'hex');
 IF p_previous IS NOT NULL THEN
  raw:=p_previous->>'payload';IF raw IS NULL OR octet_length(raw)>24576 OR p_previous->>'signature' IS DISTINCT FROM encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex') THEN RETURN NULL; END IF;
  old:=raw::jsonb;
  IF old->>'contract' IS DISTINCT FROM 'profitia.first-party-source-access/1.0.0' OR old->'request' IS DISTINCT FROM p_request OR old->>'fingerprint' IS DISTINCT FROM fingerprint
   OR old->'actor'->>'actorId' IS DISTINCT FROM actor->>'actorId' OR old->'actor'->>'proofRef' IS DISTINCT FROM actor->>'proofRef' OR (old->>'expiresAt')::timestamptz<=clock_timestamp() THEN RETURN NULL; END IF;
  expiry:=least(expiry,(old->>'expiresAt')::timestamptz);actor:=actor||jsonb_build_object('expiresAt',expiry);
 END IF;
 consumer:=jsonb_build_object('componentId',k.component_id,'applicationId',k.application_id,'keyId',k.key_id,'origin',k.source_origin,'deploymentId',k.deployment_id,'configurationVersion',k.configuration_version);
 state:=jsonb_build_object('applicationId',r.application_id,'environment','development','policyVersion','first-party-source-v1:'||fingerprint,'transactionId',p_request->>'transactionId',
  'access',jsonb_build_object('type',CASE WHEN kind='HUMAN' THEN 'MEMBERSHIP' ELSE 'SERVICE_GRANT' END,'actorId',actor->>'actorId','organisationId',o.organisation_id,'status','ACTIVE',
  'version',fingerprint,'sourceRef',CASE WHEN kind='HUMAN' THEN m.source_ref ELSE sg.source_ref END,'expiresAt',expiry,'permissions',permissions,'denies',denies),
  'products',jsonb_build_array(jsonb_build_object('product','SPENDGURU','features',pg.features,'organisationId',pg.organisation_id,'environment','development','applicationId',r.application_id,
    'status','ACTIVE','version',pg.version::text,'sourceRef',pg.source_ref,'source',pg.source,'expiresAt',pg.expires_at)),'usagePolicy','NOT_APPLICABLE');
 frame:=jsonb_build_object('contract','profitia.first-party-source-access/1.0.0','keyId',r.key_id,'request',p_request,'actor',actor,'state',state,'consumer',consumer,'fingerprint',fingerprint,'expiresAt',expiry);
 raw:=frame::text;
 RETURN jsonb_build_object('payload',raw,'signature',encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex'));
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN RETURN NULL;
END $fn$;
REVOKE ALL ON profitia_e1_authority.source_components,profitia_e1_authority.source_receivers FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_e1_authority.source_ready(),profitia_e1_authority.source_consumer(text,text),profitia_e1_authority.issue_source(jsonb,text,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION profitia_e1_authority.source_ready(),profitia_e1_authority.source_consumer(text,text),profitia_e1_authority.issue_source(jsonb,text,jsonb,jsonb,jsonb,jsonb) TO identity_b1_runtime;
