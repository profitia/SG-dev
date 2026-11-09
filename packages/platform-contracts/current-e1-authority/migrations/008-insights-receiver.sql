-- Additive Insights report resource mode; no enrollment, credentials or grants.
-- Additive current E1 receiver profile, installed by its existing access owner.
-- Does not create a key, receiver binding, runtime role or business entitlement.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR to_regprocedure('profitia_e1_receiver.accept(jsonb)') IS NULL THEN RAISE EXCEPTION 'Current E1 receiver owner and predecessor required'; END IF;
END $guard$;
ALTER TABLE profitia_e1_receiver.installation DROP CONSTRAINT installation_resource_id_check;
ALTER TABLE profitia_e1_receiver.installation ADD CONSTRAINT installation_resource_id_check CHECK(resource_id IN('source-hub-private','newsfeed-observations','economic-calendar','insights-reports'));
CREATE OR REPLACE FUNCTION profitia_e1_receiver.resource_allows(root text,operation text,resource text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $fn$
 SELECT coalesce(CASE WHEN root='insights-reports' THEN (operation IN('insights.report.start','insights.report.list') AND resource='oil-asphalt') OR (operation IN('insights.report.status','insights.report.download') AND resource~*'^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') WHEN root='economic-calendar' THEN
 (operation='knowledge.read' AND resource='economic-calendar-events') OR (operation IN('personal.list.read','personal.list.write') AND resource='economic-calendar-preferences')
 ELSE operation IN('personal.list.read','personal.list.write') AND (resource=root OR root='newsfeed-observations' AND resource~*'^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') END,false)
$fn$;
REVOKE ALL ON FUNCTION profitia_e1_receiver.resource_allows(text,text,text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION profitia_e1_receiver.challenge(p_nonce text,p_org uuid,p_operation text,p_resource text,p_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE d jsonb; challenge jsonb;
BEGIN
 d:=profitia_e1_receiver.descriptor();
 IF p_nonce!~'^[a-f0-9]{64}$' OR p_digest!~'^[a-f0-9]{64}$' OR p_org IS NULL OR NOT profitia_e1_receiver.resource_allows(d->>'resourceId',p_operation,p_resource) THEN RAISE EXCEPTION 'Challenge refused' USING ERRCODE='42501'; END IF;
 challenge:=jsonb_build_object('binding',d->'binding','transactionId',txid_current()::text,'nonce',p_nonce,'organisationId',p_org,'operation',p_operation,'resourceId',p_resource,'requestDigest',p_digest);
 PERFORM set_config('profitia.current_e1_challenge',challenge::text,true);
 RETURN challenge;
END $fn$;
CREATE OR REPLACE FUNCTION profitia_e1_receiver.accept(p_proof jsonb) RETURNS jsonb
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
 OR NOT profitia_e1_receiver.resource_allows(r.resource_id,p->'request'->>'operation',p->'request'->>'resourceId')
 OR NOT coalesce(isfinite((p->>'expiresAt')::timestamptz) AND (p->>'expiresAt')::timestamptz>clock_timestamp() AND (p->>'expiresAt')::timestamptz<=clock_timestamp()+interval '15 seconds',false) THEN RAISE EXCEPTION 'Proof binding refused' USING ERRCODE='42501'; END IF;
 PERFORM set_config('profitia.current_e1_proof',p_proof::text,true);
 RETURN p;
END $fn$;
CREATE OR REPLACE FUNCTION profitia_e1_receiver.calendar_scope(kind text,p_user uuid DEFAULT NULL,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_e1_receiver AS $fn$
DECLARE p jsonb; op text; resource text;
BEGIN
 p:=profitia_e1_receiver.accept(nullif(current_setting('profitia.current_e1_proof',true),'')::jsonb);
 op:=p->'request'->>'operation';resource:=p->'request'->>'resourceId';
 IF (profitia_e1_receiver.descriptor()->>'resourceId') IS DISTINCT FROM 'economic-calendar' THEN RETURN false; END IF;
 IF kind='events' THEN RETURN p_user IS NULL AND p_write IS FALSE AND op='knowledge.read' AND resource='economic-calendar-events'; END IF;
 IF kind='preferences' THEN RETURN p_user=(p->'actor'->>'userId')::uuid AND resource='economic-calendar-preferences' AND op IN('personal.list.read','personal.list.write') AND (NOT p_write OR op='personal.list.write'); END IF;
 RETURN false;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $fn$;
REVOKE ALL ON FUNCTION profitia_e1_receiver.calendar_scope(text,uuid,boolean) FROM PUBLIC;
-- Current, signed and transaction-bound report scope for the product RLS.
CREATE FUNCTION profitia_e1_receiver.report_scope(p_org uuid,p_job uuid,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;op text;resource text;
BEGIN
 p:=profitia_e1_receiver.accept(nullif(current_setting('profitia.current_e1_proof',true),'')::jsonb);
 IF (profitia_e1_receiver.descriptor()->>'resourceId') IS DISTINCT FROM 'insights-reports'
 OR p_org IS DISTINCT FROM (p->'request'->>'organisationId')::uuid THEN RETURN false; END IF;
 op:=p->'request'->>'operation';resource:=p->'request'->>'resourceId';
 RETURN coalesce((op='insights.report.start' AND resource='oil-asphalt')
  OR (NOT p_write AND op='insights.report.list' AND resource='oil-asphalt')
  OR (NOT p_write AND op IN('insights.report.status','insights.report.download') AND resource=p_job::text),false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END $fn$;
REVOKE ALL ON FUNCTION profitia_e1_receiver.report_scope(uuid,uuid,boolean) FROM PUBLIC;
