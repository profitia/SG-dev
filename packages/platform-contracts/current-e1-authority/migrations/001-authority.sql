-- Current E1 1.0.0 producer. Additive; run as the existing access owner.
-- No directory copy, role creation, implicit grants or source policy changes.
DO $guard$ BEGIN
 IF current_user <> 'profitia_access_owner' THEN RAISE EXCEPTION 'Explicit access owner required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto' AND extnamespace='public'::regnamespace) THEN RAISE EXCEPTION 'Approved public pgcrypto required'; END IF;
END $guard$;
CREATE SCHEMA profitia_e1_authority AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_e1_authority FROM PUBLIC;
CREATE TABLE profitia_e1_authority.receivers (
 application_id text PRIMARY KEY REFERENCES profitia_access.applications(application_id),
 binding jsonb NOT NULL CHECK(jsonb_typeof(binding)='object'),
 issuer text NOT NULL CHECK(issuer ~ '^https://[^/?#]+$'),
 authorized_parties text[] NOT NULL CHECK(cardinality(authorized_parties)>0 AND array_position(authorized_parties,NULL) IS NULL),
 resource_id text NOT NULL CHECK(resource_id IN ('source-hub-private','newsfeed-observations')),
 key_id text NOT NULL CHECK(length(key_id) BETWEEN 1 AND 128),
 proof_key bytea NOT NULL CHECK(octet_length(proof_key)=32),
 status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
ALTER TABLE profitia_e1_authority.receivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_e1_authority.receivers FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_e1_authority.receivers TO profitia_access_owner USING(true) WITH CHECK(true);

CREATE FUNCTION profitia_e1_authority.receiver(p_application text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_authority,profitia_access AS $fn$
DECLARE d jsonb; r profitia_e1_authority.receivers%ROWTYPE;
BEGIN
 d:=profitia_access.runtime_descriptor();
 IF d->>'applicationId'<>'identity-runtime-development' OR d->>'environment'<>'development' THEN RAISE EXCEPTION 'Authority binding refused' USING ERRCODE='42501'; END IF;
 SELECT rr.* INTO r FROM profitia_e1_authority.receivers rr JOIN profitia_access.applications a USING(application_id)
 WHERE rr.application_id=p_application AND rr.status='ACTIVE' AND rr.expires_at>clock_timestamp() AND a.status='ACTIVE';
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('binding',r.binding,'issuer',r.issuer,'authorizedParties',r.authorized_parties,'resourceId',r.resource_id,'keyId',r.key_id);
END $fn$;

CREATE FUNCTION profitia_e1_authority.issue(p_application text,p_identity jsonb,p_actor jsonb,p_request jsonb,p_previous jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_authority,profitia_access AS $fn$
DECLARE config jsonb; r profitia_e1_authority.receivers%ROWTYPE; e profitia_access.external_identities%ROWTYPE;
 u profitia_access.accounts%ROWTYPE; m profitia_access.memberships%ROWTYPE; o profitia_access.organisations%ROWTYPE;
 pg profitia_access.product_grants%ROWTYPE; parent_product profitia_access.product_grants%ROWTYPE; permissions jsonb; denies jsonb; fingerprint text;
 expiry timestamptz; actor jsonb; state jsonb; payload jsonb; raw text; previous jsonb;
BEGIN
 config:=profitia_e1_authority.receiver(p_application);
 IF config IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO STRICT r FROM profitia_e1_authority.receivers WHERE application_id=p_application;
 -- Closed, transaction-bound request; it never contains a claimed user ID.
 IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR octet_length(p_request::text)>4096
 OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_request) k) IS DISTINCT FROM ARRAY['binding','nonce','operation','organisationId','requestDigest','resourceId','transactionId']
 OR p_request->'binding' IS DISTINCT FROM r.binding OR (p_request->>'resourceId' IS DISTINCT FROM r.resource_id AND NOT (r.resource_id='newsfeed-observations' AND coalesce(p_request->>'resourceId','')~*'^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'))
 OR coalesce(p_request->>'operation','') NOT IN ('personal.list.read','personal.list.write')
 OR coalesce(p_request->>'nonce','')!~'^[a-f0-9]{64}$' OR coalesce(p_request->>'requestDigest','')!~'^[a-f0-9]{64}$'
 OR coalesce(p_request->>'transactionId','')!~'^[0-9]{1,20}$'
 OR p_identity->>'issuer' IS DISTINCT FROM r.issuer THEN RETURN NULL; END IF;
 -- Shared canonical E1 fence: no mutation can interleave this observation.
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 SELECT * INTO e FROM profitia_access.external_identities WHERE issuer=r.issuer AND subject=p_identity->>'subject' AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO u FROM profitia_access.accounts WHERE user_id=e.user_id AND status='ACTIVE';
 IF NOT FOUND OR p_actor->>'kind' IS DISTINCT FROM 'HUMAN' OR p_actor->>'actorId' IS DISTINCT FROM u.user_id::text
 OR p_actor->>'userId' IS DISTINCT FROM u.user_id::text OR p_actor->>'audience' IS DISTINCT FROM p_application
 OR p_actor->>'environment' IS DISTINCT FROM 'development' OR p_actor->>'issuer' IS DISTINCT FROM r.issuer
 OR p_actor->>'proofRef' NOT LIKE 'clerk-session:%:binding:'||e.binding_id::text||':'||e.version::text||':'||u.version::text THEN RETURN NULL; END IF;
 SELECT * INTO m FROM profitia_access.memberships WHERE user_id=u.user_id AND organisation_id=(p_request->>'organisationId')::uuid AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO o FROM profitia_access.organisations WHERE organisation_id=m.organisation_id AND status='ACTIVE';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id=p_application AND fixed_organisation_id IS NOT NULL AND fixed_organisation_id<>o.organisation_id) THEN RETURN NULL; END IF;
 SELECT * INTO pg FROM profitia_access.product_grants WHERE application_id=p_application AND organisation_id=o.organisation_id AND product='SPENDGURU' AND status='ACTIVE' AND 'personal_workspace'=ANY(features) AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 -- The consumer offer never survives withdrawal of its canonical SPENDGURU
 -- entitlement. This is a current central dependency, never a copied product.
 SELECT * INTO parent_product FROM profitia_access.product_grants WHERE application_id='spendguru' AND organisation_id=o.organisation_id AND product='SPENDGURU' AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id) ORDER BY grant_id) FILTER(WHERE effect='ALLOW'),'[]'::jsonb),
 coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id) ORDER BY grant_id) FILTER(WHERE effect='DENY'),'[]'::jsonb)
 INTO permissions,denies FROM profitia_access.permission_grants
 WHERE application_id=p_application AND organisation_id=o.organisation_id AND user_id=u.user_id;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(permissions) p WHERE p->>'operation'=p_request->>'operation' AND p->>'feature'='personal_workspace' AND (p->>'resourceId' IS NULL OR p->>'resourceId'=r.resource_id))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(denies) p WHERE p->>'operation'=p_request->>'operation' AND p->>'feature'='personal_workspace' AND (p->>'resourceId' IS NULL OR p->>'resourceId'=r.resource_id)) THEN RETURN NULL; END IF;
 fingerprint:=encode(public.digest(convert_to(jsonb_build_object('account',to_jsonb(u),'identity',to_jsonb(e),'organisation',to_jsonb(o),'membership',to_jsonb(m),'product',to_jsonb(pg),'parentProduct',to_jsonb(parent_product),'permissions',permissions,'denies',denies,'receiver',config,'receiverExpiry',r.expires_at)::text,'UTF8'),'sha256'),'hex');
 expiry:=least(e.expires_at,m.expires_at,pg.expires_at,parent_product.expires_at,r.expires_at,(p_actor->>'expiresAt')::timestamptz,clock_timestamp()+interval '15 seconds');
 IF p_previous IS NOT NULL THEN
  raw:=p_previous->>'payload';
  IF raw IS NULL OR octet_length(raw)>16384 OR p_previous->>'signature' IS DISTINCT FROM encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex') THEN RETURN NULL; END IF;
  previous:=raw::jsonb;
  IF previous->'request' IS DISTINCT FROM p_request OR previous->>'fingerprint' IS DISTINCT FROM fingerprint
  OR previous->'actor'->>'userId' IS DISTINCT FROM u.user_id::text OR previous->'actor'->>'proofRef' IS DISTINCT FROM p_actor->>'proofRef'
  OR previous->>'keyId' IS DISTINCT FROM r.key_id OR (previous->>'expiresAt')::timestamptz<=clock_timestamp() THEN RETURN NULL; END IF;
  expiry:=least(expiry,(previous->>'expiresAt')::timestamptz);
 END IF;
 IF NOT isfinite(expiry) OR expiry<=clock_timestamp() THEN RETURN NULL; END IF;
 actor:=p_actor||jsonb_build_object('expiresAt',expiry);
 state:=jsonb_build_object('applicationId',p_application,'environment','development','policyVersion','current-e1-v1:'||fingerprint,
 'identityBindingVersion',e.binding_id::text||':'||e.version::text||':'||u.version::text,'transactionId',p_request->>'transactionId',
 'access',jsonb_build_object('type','MEMBERSHIP','actorId',u.user_id,'organisationId',o.organisation_id,'status','ACTIVE','version',m.version::text||':'||fingerprint,'sourceRef',m.source_ref,'expiresAt',expiry,'permissions',permissions,'denies',denies),
 'products',jsonb_build_array(jsonb_build_object('product',pg.product,'features',pg.features,'organisationId',pg.organisation_id,'environment','development','applicationId',pg.application_id,'status',pg.status,'version',pg.version::text,'sourceRef',pg.source_ref,'source',pg.source,'expiresAt',pg.expires_at)),
 'usagePolicy','NOT_APPLICABLE');
 payload:=jsonb_build_object('contract','profitia.current-e1-authority/1.0.0','keyId',r.key_id,'request',p_request,'actor',actor,'state',state,'fingerprint',fingerprint,'expiresAt',expiry);
 raw:=payload::text;
 RETURN jsonb_build_object('payload',raw,'signature',encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex'));
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN RETURN NULL;
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_e1_authority FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_e1_authority FROM PUBLIC;
GRANT USAGE ON SCHEMA profitia_e1_authority TO identity_b1_runtime;
GRANT EXECUTE ON FUNCTION profitia_e1_authority.receiver(text),profitia_e1_authority.issue(text,jsonb,jsonb,jsonb,jsonb) TO identity_b1_runtime;
