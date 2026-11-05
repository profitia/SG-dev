-- Current E1 1.0.0 receiver, installed only in explicitly enrolled databases.
-- pgcrypto is installed separately by the authorized existing migrator/admin.
DO $guard$ BEGIN
 IF current_user <> 'profitia_access_owner' THEN RAISE EXCEPTION 'Explicit access owner required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto' AND extnamespace='public'::regnamespace) THEN RAISE EXCEPTION 'Approved public pgcrypto required'; END IF;
END $guard$;
CREATE SCHEMA profitia_e1_receiver AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_e1_receiver FROM PUBLIC;
CREATE TABLE profitia_e1_receiver.installation (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 login_role name NOT NULL UNIQUE,
 binding jsonb NOT NULL CHECK(jsonb_typeof(binding)='object'),
 authority_origin text NOT NULL CHECK(authority_origin ~ '^https://[^/?#]+$'),
 resource_id text NOT NULL CHECK(resource_id IN ('source-hub-private','newsfeed-observations')),
 key_id text NOT NULL CHECK(length(key_id) BETWEEN 1 AND 128),
 proof_key bytea NOT NULL CHECK(octet_length(proof_key)=32),
 status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
ALTER TABLE profitia_e1_receiver.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_e1_receiver.installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_e1_receiver.installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE FUNCTION profitia_e1_receiver.descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver,profitia_access AS $fn$
DECLARE d jsonb; r profitia_e1_receiver.installation%ROWTYPE;
BEGIN
 d:=profitia_access.runtime_descriptor();
 SELECT * INTO r FROM profitia_e1_receiver.installation WHERE singleton AND login_role=session_user AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND OR d->>'environment'<>'development' OR r.binding IS DISTINCT FROM (d-'revision'-'schemaVersion'-'fixedOrganisationId') THEN RAISE EXCEPTION 'Receiver binding unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('contract','profitia.current-e1-authority/1.0.0','binding',r.binding,'authorityOrigin',r.authority_origin,'resourceId',r.resource_id,'keyId',r.key_id);
END $fn$;
CREATE FUNCTION profitia_e1_receiver.challenge(p_nonce text,p_org uuid,p_operation text,p_resource text,p_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE d jsonb; challenge jsonb;
BEGIN
 d:=profitia_e1_receiver.descriptor();
 IF p_nonce!~'^[a-f0-9]{64}$' OR p_digest!~'^[a-f0-9]{64}$' OR p_org IS NULL OR p_operation NOT IN ('personal.list.read','personal.list.write') OR p_resource IS DISTINCT FROM d->>'resourceId' THEN RAISE EXCEPTION 'Challenge refused' USING ERRCODE='42501'; END IF;
 challenge:=jsonb_build_object('binding',d->'binding','transactionId',txid_current()::text,'nonce',p_nonce,'organisationId',p_org,'operation',p_operation,'resourceId',p_resource,'requestDigest',p_digest);
 PERFORM set_config('profitia.current_e1_challenge',challenge::text,true);
 RETURN challenge;
END $fn$;
CREATE FUNCTION profitia_e1_receiver.accept(p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE d jsonb; r profitia_e1_receiver.installation%ROWTYPE; raw text; p jsonb;
BEGIN
 d:=profitia_e1_receiver.descriptor();
 SELECT * INTO STRICT r FROM profitia_e1_receiver.installation WHERE singleton FOR SHARE;
 raw:=p_proof->>'payload';
 IF raw IS NULL OR octet_length(raw)>16384 OR p_proof->>'signature' IS DISTINCT FROM encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex') THEN RAISE EXCEPTION 'Proof refused' USING ERRCODE='42501'; END IF;
 p:=raw::jsonb;
 IF p->>'contract' IS DISTINCT FROM d->>'contract' OR p->>'keyId' IS DISTINCT FROM r.key_id
 OR p->'request'->'binding' IS DISTINCT FROM r.binding OR p->'request'->>'transactionId' IS DISTINCT FROM txid_current()::text
 OR p->'request' IS DISTINCT FROM nullif(current_setting('profitia.current_e1_challenge',true),'')::jsonb
 OR p->'state'->>'transactionId' IS DISTINCT FROM txid_current()::text
 OR p->'state'->>'applicationId' IS DISTINCT FROM r.binding->>'applicationId' OR p->'state'->>'environment' IS DISTINCT FROM 'development'
 OR p->'actor'->>'audience' IS DISTINCT FROM r.binding->>'applicationId' OR p->'actor'->>'environment' IS DISTINCT FROM 'development'
 OR p->'actor'->>'kind' IS DISTINCT FROM 'HUMAN' OR p->'actor'->>'actorId' IS DISTINCT FROM p->'actor'->>'userId'
 OR p->'state'->'access'->>'actorId' IS DISTINCT FROM p->'actor'->>'userId' OR p->'state'->'access'->>'organisationId' IS DISTINCT FROM p->'request'->>'organisationId'
 OR p->'request'->>'resourceId' IS DISTINCT FROM r.resource_id
 OR NOT coalesce(isfinite((p->>'expiresAt')::timestamptz) AND (p->>'expiresAt')::timestamptz>clock_timestamp() AND (p->>'expiresAt')::timestamptz<=clock_timestamp()+interval '15 seconds',false) THEN RAISE EXCEPTION 'Proof binding refused' USING ERRCODE='42501'; END IF;
 PERFORM set_config('profitia.current_e1_proof',p_proof::text,true);
 RETURN p;
END $fn$;
CREATE FUNCTION profitia_e1_receiver.scope_allows(p_application text,p_org uuid,p_user uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE p jsonb;
BEGIN
 p:=profitia_e1_receiver.accept(nullif(current_setting('profitia.current_e1_proof',true),'')::jsonb);
 RETURN p_application=p->'request'->'binding'->>'applicationId' AND p_org=(p->'request'->>'organisationId')::uuid AND p_user=(p->'actor'->>'userId')::uuid;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $fn$;
CREATE FUNCTION profitia_e1_receiver.append_audit(p_event jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE p jsonb;
BEGIN
 p:=profitia_e1_receiver.accept(nullif(current_setting('profitia.current_e1_proof',true),'')::jsonb);
 IF p_event->>'phase' IS DISTINCT FROM 'OUTCOME' OR p_event->>'actorId' IS DISTINCT FROM p->'actor'->>'actorId'
 OR p_event->>'organisationId' IS DISTINCT FROM p->'request'->>'organisationId' OR p_event->>'applicationId' IS DISTINCT FROM p->'state'->>'applicationId'
 OR p_event->>'operation' IS DISTINCT FROM p->'request'->>'operation' OR p_event->>'resourceId' IS DISTINCT FROM p->'request'->>'resourceId'
 OR p_event->>'policyVersion' IS DISTINCT FROM p->'state'->>'policyVersion' THEN RAISE EXCEPTION 'Audit scope refused' USING ERRCODE='42501'; END IF;
 PERFORM profitia_access.append_audit(p_event);
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_e1_receiver FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_e1_receiver FROM PUBLIC;
-- The accepted bootstrap grants only descriptor/challenge/accept/scope_allows/append_audit
-- to the exact pre-existing enrolled ordinary login. No key/table privileges.
