-- Additive receiver; existing HUMAN proof path, bindings and RLS unchanged.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR to_regprocedure('profitia_e1_receiver.descriptor()') IS NULL THEN RAISE EXCEPTION 'Accepted current E1 receiver required';END IF;
END $guard$;
CREATE TABLE profitia_e1_receiver.recurring_installation(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'));
ALTER TABLE profitia_e1_receiver.recurring_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_e1_receiver.recurring_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_e1_receiver.recurring_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE FUNCTION profitia_e1_receiver.recurring_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;digest text;
BEGIN
 d:=profitia_e1_receiver.descriptor();
 SELECT schema_digest INTO digest FROM profitia_e1_receiver.recurring_installation WHERE singleton;
 IF NOT FOUND OR d->>'resourceId' NOT IN('newsfeed-observations','insights-reports') THEN RAISE EXCEPTION 'Recurring receiver not enrolled' USING ERRCODE='42501';END IF;
 RETURN d||jsonb_build_object('contract','profitia.current-private-recurring/1.0.0','schemaDigest',digest);
END $fn$;
CREATE FUNCTION profitia_e1_receiver.recurring_consent_receipt(p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r profitia_e1_receiver.installation%ROWTYPE;raw text;p jsonb;
BEGIN
 PERFORM profitia_e1_receiver.recurring_descriptor();
 SELECT * INTO STRICT r FROM profitia_e1_receiver.installation WHERE singleton FOR SHARE;raw:=p_proof->>'payload';
 IF raw IS NULL OR octet_length(raw)>8192 OR p_proof->>'signature' IS DISTINCT FROM encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex') THEN RAISE EXCEPTION 'Consent receipt refused' USING ERRCODE='42501';END IF;
 p:=raw::jsonb;
 IF p->>'contract' IS DISTINCT FROM 'profitia.recurring-consent-receipt/1.0.0' OR p->>'applicationId' IS DISTINCT FROM r.binding->>'applicationId'
 OR NOT coalesce((p->>'expiresAt')::timestamptz>clock_timestamp() AND (p->>'expiresAt')::timestamptz<=clock_timestamp()+interval '15 seconds',false)
 THEN RAISE EXCEPTION 'Consent receipt binding refused' USING ERRCODE='42501';END IF;RETURN p;
END $fn$;
REVOKE ALL ON FUNCTION profitia_e1_receiver.recurring_consent_receipt(jsonb) FROM PUBLIC;
CREATE FUNCTION profitia_e1_receiver.recurring_challenge(p_input jsonb,p_nonce text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;p jsonb;c jsonb;
BEGIN
 d:=profitia_e1_receiver.recurring_descriptor();p:=p_input->'payload';
 IF p_input->>'operation' IS DISTINCT FROM (CASE d->>'resourceId' WHEN 'newsfeed-observations' THEN 'newsfeed.monitor.execute' ELSE 'insights.subscription.execute' END)
 OR p_nonce!~'^[a-f0-9]{64}$' OR p_input->>'payloadDigest'!~'^[a-f0-9]{64}$'
 OR coalesce(p->>'phase','') NOT IN('PREPARE','EFFECT','COMPLETE')
 OR NOT coalesce((p->>'claimedAt')::timestamptz<=clock_timestamp() AND (p->>'claimedAt')::timestamptz>clock_timestamp()-interval '30 seconds',false)
 THEN RAISE EXCEPTION 'Recurring challenge refused' USING ERRCODE='42501';END IF;
 -- UUID casts reject missing/invalid IDs below; explicit null rejection makes
 -- SQL's unknown truth value incapable of authorising a malformed envelope.
 IF (p_input->>'resourceId')::uuid IS NULL OR (p_input->>'organisationId')::uuid IS NULL OR(p->>'delegationId')::uuid IS NULL
 OR (p->>'resourceId')::uuid IS NULL OR (p->>'leaseId')::uuid IS NULL OR coalesce(p->>'resourceVersion','')!~'^[1-9][0-9]*$'
 OR coalesce(p->>'definitionDigest','')!~'^[a-f0-9]{64}$' OR coalesce(p->>'scheduleSlot','')='' OR (p->>'slotAt')::timestamptz IS NULL
 THEN RAISE EXCEPTION 'Recurring scope required' USING ERRCODE='42501';END IF;
 c:=jsonb_build_object('binding',d->'binding','schemaDigest',d->>'schemaDigest','transactionId',txid_current()::text,'nonce',p_nonce,
 'operation',p_input->>'operation','organisationId',p_input->>'organisationId','resourceId',p_input->>'resourceId','payloadDigest',p_input->>'payloadDigest',
 'delegationId',p->>'delegationId','privateResourceId',p->>'resourceId','resourceVersion',p->>'resourceVersion','definitionDigest',p->>'definitionDigest',
 'leaseId',p->>'leaseId','claimedAt',p->>'claimedAt','slotAt',p->>'slotAt','scheduleSlot',p->>'scheduleSlot','phase',p->>'phase','sourceResourceId',p->>'sourceResourceId');
 PERFORM set_config('profitia.recurring_challenge',c::text,true);RETURN c;
END $fn$;
CREATE FUNCTION profitia_e1_receiver.recurring_accept(p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE descriptor_value jsonb;r profitia_e1_receiver.installation%ROWTYPE;raw text;p jsonb;d jsonb;c jsonb;
BEGIN
 descriptor_value:=profitia_e1_receiver.recurring_descriptor();
 SELECT * INTO STRICT r FROM profitia_e1_receiver.installation WHERE singleton FOR SHARE;
 raw:=p_proof->>'payload';
 IF raw IS NULL OR octet_length(raw)>24576 OR p_proof->>'signature' IS DISTINCT FROM encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex') THEN RAISE EXCEPTION 'Recurring proof refused' USING ERRCODE='42501';END IF;
 p:=raw::jsonb;c:=p->'request';d:=p->'state'->'recurringDelegation';
 IF p->>'contract' IS DISTINCT FROM descriptor_value->>'contract' OR p->>'keyId' IS DISTINCT FROM r.key_id
 OR c IS DISTINCT FROM nullif(current_setting('profitia.recurring_challenge',true),'')::jsonb
 OR c->'binding' IS DISTINCT FROM r.binding OR c->>'transactionId' IS DISTINCT FROM txid_current()::text
 OR p->'state'->>'transactionId' IS DISTINCT FROM txid_current()::text
 OR p->'state'->>'applicationId' IS DISTINCT FROM r.binding->>'applicationId' OR p->'state'->>'environment' IS DISTINCT FROM 'development'
 OR p->'actor'->>'audience' IS DISTINCT FROM r.binding->>'applicationId' OR p->'actor'->>'kind' IS DISTINCT FROM 'SERVICE'
 OR p->'actor'->>'actorId' IS DISTINCT FROM p->'actor'->>'serviceId' OR p->'actor'->>'userId' IS NOT NULL
 OR p->'state'->'access'->>'type' IS DISTINCT FROM 'DELEGATED_USER' OR p->'state'->'access'->>'actorId' IS DISTINCT FROM p->'actor'->>'actorId'
 OR d->>'schemaDigest' IS DISTINCT FROM descriptor_value->>'schemaDigest' OR d->>'jobId' IS DISTINCT FROM c->>'resourceId'
 OR d->>'resourceId' IS DISTINCT FROM c->>'privateResourceId' OR d->>'resourceVersion' IS DISTINCT FROM c->>'resourceVersion'
 OR d->>'organisationId' IS DISTINCT FROM c->>'organisationId' OR d->>'payloadDigest' IS DISTINCT FROM c->>'payloadDigest'
 OR d->>'ownerUserId' IS NOT DISTINCT FROM p->'actor'->>'actorId'
 OR NOT coalesce((p->>'expiresAt')::timestamptz>clock_timestamp() AND (p->>'expiresAt')::timestamptz<=clock_timestamp()+interval '15 seconds',false)
 THEN RAISE EXCEPTION 'Recurring proof binding refused' USING ERRCODE='42501';END IF;
 PERFORM set_config('profitia.recurring_proof',p_proof::text,true);RETURN p;
END $fn$;
CREATE FUNCTION profitia_e1_receiver.recurring_scope(p_org uuid,p_owner uuid,p_resource uuid,p_version bigint,p_phase text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;d jsonb;
BEGIN
 p:=profitia_e1_receiver.recurring_accept(nullif(current_setting('profitia.recurring_proof',true),'')::jsonb);d:=p->'state'->'recurringDelegation';
 RETURN coalesce(p_org=(d->>'organisationId')::uuid AND p_owner=(d->>'ownerUserId')::uuid
 AND p_resource=(d->>'resourceId')::uuid AND p_version=(d->>'resourceVersion')::bigint AND p_phase=p->'request'->>'phase',false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END $fn$;
CREATE FUNCTION profitia_e1_receiver.recurring_audit(p_event jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;d jsonb;
BEGIN
 p:=profitia_e1_receiver.recurring_accept(nullif(current_setting('profitia.recurring_proof',true),'')::jsonb);d:=p->'state'->'recurringDelegation';
 IF p_event->>'phase' IS DISTINCT FROM 'OUTCOME' OR p_event->>'actorId' IS DISTINCT FROM p->'actor'->>'actorId'
 OR p_event->>'subjectUserId' IS DISTINCT FROM d->>'ownerUserId' OR p_event->>'organisationId' IS DISTINCT FROM d->>'organisationId'
 OR p_event->>'operation' IS DISTINCT FROM p->'request'->>'operation' OR p_event->>'resourceId' IS DISTINCT FROM d->>'jobId'
 OR p_event->>'payloadDigest' IS DISTINCT FROM d->>'payloadDigest' OR p_event->>'policyVersion' IS DISTINCT FROM d->>'policyVersion'
 THEN RAISE EXCEPTION 'Recurring audit refused' USING ERRCODE='42501';END IF;
 PERFORM profitia_access.append_audit(p_event);
END $fn$;
REVOKE ALL ON profitia_e1_receiver.recurring_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_e1_receiver.recurring_descriptor(),profitia_e1_receiver.recurring_challenge(jsonb,text),profitia_e1_receiver.recurring_accept(jsonb),profitia_e1_receiver.recurring_scope(uuid,uuid,uuid,bigint,text),profitia_e1_receiver.recurring_audit(jsonb) FROM PUBLIC;

