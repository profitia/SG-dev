-- Additive receiver functions over the existing enrolled E1 proof key.
-- This key remains private to Identity/this receiver; components use distinct
-- Ed25519 private keys and never receive the receiver's proof key.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR to_regclass('profitia_e1_receiver.installation') IS NULL THEN RAISE EXCEPTION 'Existing accepted E1 receiver required'; END IF;
END $guard$;
CREATE FUNCTION profitia_e1_receiver.source_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE d jsonb;
BEGIN
 d:=profitia_e1_receiver.descriptor();
 IF d->>'resourceId'<>'source-hub-private' THEN RAISE EXCEPTION 'Source capability receiver required' USING ERRCODE='42501'; END IF;
 RETURN d||jsonb_build_object('contract','profitia.first-party-source-access/1.0.0');
END $fn$;
CREATE FUNCTION profitia_e1_receiver.source_challenge(p_nonce text,p_claim jsonb,p_context jsonb,p_resource text,p_proof_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE d jsonb; c jsonb; kind text;
BEGIN
 d:=profitia_e1_receiver.source_descriptor();kind:=p_context->>'kind';
 IF p_nonce!~'^[a-f0-9]{64}$' OR coalesce(p_proof_digest,'')!~'^[a-f0-9]{64}$' OR coalesce(p_claim->>'bodyDigest','')!~'^[a-f0-9]{64}$'
  OR coalesce(p_resource,'')!~'^api\.[a-z-]+\.[a-z-]+$' OR p_context->>'organisationId' IS NULL
  OR p_claim->>'receiverApplicationId' IS DISTINCT FROM d->'binding'->>'applicationId'
  OR p_context IS DISTINCT FROM p_claim->'execution' OR p_resource IS DISTINCT FROM p_claim->>'resourceId'
  OR p_claim->>'environment' IS DISTINCT FROM 'development' OR kind NOT IN('HUMAN','SERVICE') OR kind IS NULL
  OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_context) k) IS DISTINCT FROM (CASE WHEN kind='HUMAN' THEN ARRAY['kind','organisationId'] ELSE ARRAY['grantId','kind','organisationId'] END)
  OR kind='SERVICE' AND coalesce(p_context->>'grantId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' THEN RAISE EXCEPTION 'Source challenge refused' USING ERRCODE='42501'; END IF;
 c:=jsonb_build_object('binding',d->'binding','transactionId',txid_current()::text,'nonce',p_nonce,'organisationId',(p_context->>'organisationId')::uuid,
  'operation','knowledge.read','resourceId',p_resource,'requestDigest',p_claim->>'bodyDigest','componentId',p_claim->>'componentId','keyId',p_claim->>'keyId',
  'consumerRequestId',p_claim->>'requestId','consumerProofDigest',p_proof_digest,'kind',kind,'grantId',p_context->>'grantId');
 PERFORM set_config('profitia.source_challenge',c::text,true);RETURN c;
END $fn$;
CREATE FUNCTION profitia_e1_receiver.source_accept(p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE d jsonb; r profitia_e1_receiver.installation%ROWTYPE; raw text; p jsonb; kind text;
BEGIN
 d:=profitia_e1_receiver.source_descriptor();SELECT * INTO STRICT r FROM profitia_e1_receiver.installation WHERE singleton FOR SHARE;
 raw:=p_proof->>'payload';
 IF raw IS NULL OR octet_length(raw)>24576 OR p_proof->>'signature' IS DISTINCT FROM encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex') THEN RAISE EXCEPTION 'Source proof refused' USING ERRCODE='42501'; END IF;
 p:=raw::jsonb;kind:=p->'actor'->>'kind';
 IF p->>'contract' IS DISTINCT FROM d->>'contract' OR p->>'keyId' IS DISTINCT FROM r.key_id
  OR p->'request'->'binding' IS DISTINCT FROM r.binding OR p->'request'->>'transactionId' IS DISTINCT FROM txid_current()::text
  OR p->'request' IS DISTINCT FROM nullif(current_setting('profitia.source_challenge',true),'')::jsonb
  OR p->'state'->>'transactionId' IS DISTINCT FROM txid_current()::text OR p->'state'->>'applicationId' IS DISTINCT FROM r.binding->>'applicationId'
  OR p->'state'->>'environment' IS DISTINCT FROM 'development' OR p->'request'->>'operation' IS DISTINCT FROM 'knowledge.read'
  OR p->'actor'->>'audience' IS DISTINCT FROM r.binding->>'applicationId' OR p->'actor'->>'environment' IS DISTINCT FROM 'development'
  OR kind IS DISTINCT FROM p->'request'->>'kind' OR kind NOT IN('HUMAN','SERVICE')
  OR p->'state'->'access'->>'actorId' IS DISTINCT FROM p->'actor'->>'actorId'
  OR p->'state'->'access'->>'organisationId' IS DISTINCT FROM p->'request'->>'organisationId'
  OR p->'consumer'->>'componentId' IS DISTINCT FROM p->'request'->>'componentId' OR p->'consumer'->>'keyId' IS DISTINCT FROM p->'request'->>'keyId'
  OR kind='HUMAN' AND (p->'actor'->>'actorId' IS DISTINCT FROM p->'actor'->>'userId' OR p->'state'->'access'->>'type' IS DISTINCT FROM 'MEMBERSHIP')
  OR kind='SERVICE' AND (p->'actor'->>'actorId' IS DISTINCT FROM p->'actor'->>'serviceId' OR p->'actor'->>'userId' IS NOT NULL OR p->'state'->'access'->>'type' IS DISTINCT FROM 'SERVICE_GRANT')
  OR NOT coalesce(isfinite((p->>'expiresAt')::timestamptz) AND (p->>'expiresAt')::timestamptz>clock_timestamp() AND (p->>'expiresAt')::timestamptz<=clock_timestamp()+interval '15 seconds',false)
  THEN RAISE EXCEPTION 'Source proof binding refused' USING ERRCODE='42501'; END IF;
 PERFORM set_config('profitia.source_proof',p_proof::text,true);RETURN p;
END $fn$;
CREATE FUNCTION profitia_e1_receiver.source_scope(p_application text,p_org uuid,p_kind text,p_actor uuid,p_consumer text,p_resource text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE p jsonb;
BEGIN
 p:=profitia_e1_receiver.source_accept(nullif(current_setting('profitia.source_proof',true),'')::jsonb);
 RETURN p_application=p->'state'->>'applicationId' AND p_org=(p->'request'->>'organisationId')::uuid
  AND p_kind=p->'actor'->>'kind' AND p_actor=(p->'actor'->>'actorId')::uuid
  AND p_consumer=p->'consumer'->>'componentId' AND p_resource=p->'request'->>'resourceId';
EXCEPTION WHEN OTHERS THEN RETURN false;
END $fn$;
CREATE FUNCTION profitia_e1_receiver.source_application(p_application text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE p jsonb;
BEGIN
 p:=profitia_e1_receiver.source_accept(nullif(current_setting('profitia.source_proof',true),'')::jsonb);
 RETURN p_application=p->'consumer'->>'applicationId';
EXCEPTION WHEN OTHERS THEN RETURN false;
END $fn$;
CREATE FUNCTION profitia_e1_receiver.source_append_audit(p_event jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE p jsonb;
BEGIN
 p:=profitia_e1_receiver.source_accept(nullif(current_setting('profitia.source_proof',true),'')::jsonb);
 IF p_event->>'phase' IS DISTINCT FROM 'OUTCOME' OR p_event->>'actorId' IS DISTINCT FROM p->'actor'->>'actorId'
  OR p_event->>'actorKind' IS DISTINCT FROM p->'actor'->>'kind' OR p_event->>'organisationId' IS DISTINCT FROM p->'request'->>'organisationId'
  OR p_event->>'applicationId' IS DISTINCT FROM p->'state'->>'applicationId' OR p_event->>'operation' IS DISTINCT FROM 'knowledge.read'
  OR p_event->>'resourceId' IS DISTINCT FROM p->'request'->>'resourceId' OR p_event->>'policyVersion' IS DISTINCT FROM p->'state'->>'policyVersion'
  THEN RAISE EXCEPTION 'Source audit scope refused' USING ERRCODE='42501'; END IF;
 PERFORM profitia_access.append_audit(p_event);
END $fn$;
REVOKE ALL ON FUNCTION profitia_e1_receiver.source_descriptor(),profitia_e1_receiver.source_challenge(text,jsonb,jsonb,text,text),profitia_e1_receiver.source_accept(jsonb),profitia_e1_receiver.source_scope(text,uuid,text,uuid,text,text),profitia_e1_receiver.source_append_audit(jsonb),profitia_e1_receiver.source_application(text) FROM PUBLIC;
-- The accepted enrollment grants these functions only to the existing ordinary
-- receiver runtime. No key/table privilege is granted and no role is created.
