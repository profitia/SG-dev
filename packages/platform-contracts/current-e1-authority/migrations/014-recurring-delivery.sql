-- Published-report delivery is a separate admitted Identity purpose. It does
-- not reuse a Clerk webhook, OTP instruction, new account or Source policy.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR to_regprocedure('profitia_e1_authority.recurring_schema_digest()') IS NULL THEN RAISE EXCEPTION 'Recurring E1 predecessor required';END IF;
END $guard$;
CREATE TABLE profitia_e1_authority.recurring_delivery_installation(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'));
CREATE TABLE profitia_e1_authority.recurring_delivery_policies(
 application_id text PRIMARY KEY REFERENCES profitia_e1_authority.receivers(application_id),
 login_role name NOT NULL REFERENCES profitia_access.runtime_bindings(login_role),
 service_id text NOT NULL CHECK(length(service_id) BETWEEN 3 AND 100),app_origin text NOT NULL CHECK(app_origin='https://dev-sg2.spendguru.app'),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['recurring_delivery_installation','recurring_delivery_policies'] LOOP
 EXECUTE format('ALTER TABLE profitia_e1_authority.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE profitia_e1_authority.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON profitia_e1_authority.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
 EXECUTE format('CREATE TRIGGER authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_e1_authority.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
 END LOOP;
 CREATE TRIGGER advance_version BEFORE UPDATE ON profitia_e1_authority.recurring_delivery_policies FOR EACH ROW EXECUTE FUNCTION profitia_access.advance_version();
END $policies$;
CREATE FUNCTION profitia_e1_authority.recurring_delivery_descriptor() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;
BEGIN
 d:=profitia_access.runtime_descriptor();
 IF d->>'applicationId' IS DISTINCT FROM 'identity-runtime-development' OR d->>'environment' IS DISTINCT FROM 'development' THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('schemaDigest',(SELECT schema_digest FROM profitia_e1_authority.recurring_delivery_installation WHERE singleton),'policies',coalesce((SELECT jsonb_agg(jsonb_build_object('applicationId',application_id,'appOrigin',app_origin,'serviceId',service_id)) FROM profitia_e1_authority.recurring_delivery_policies WHERE login_role=session_user AND status='ACTIVE' AND expires_at>clock_timestamp()),'[]'));
END $fn$;
CREATE FUNCTION profitia_e1_authority.recurring_delivery_identity(p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e profitia_access.external_identities%ROWTYPE;p profitia_e1_authority.recurring_delivery_policies%ROWTYPE;
BEGIN
 IF profitia_e1_authority.recurring_delivery_descriptor() IS NULL OR octet_length(p_request::text)>4096 OR(SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(p_request) key) IS DISTINCT FROM ARRAY['applicationId','deliveryId','leaseId','nonce','organisationId','ownerUserId','pdfSha256','producerJobId','subscriptionId','subscriptionVersion']
 OR p_request->>'nonce'!~'^[a-f0-9]{64}$' OR p_request->>'pdfSha256'!~'^[a-f0-9]{64}$' THEN RETURN NULL;END IF;
 SELECT * INTO p FROM profitia_e1_authority.recurring_delivery_policies WHERE application_id=p_request->>'applicationId' AND login_role=session_user AND status='ACTIVE' AND expires_at>clock_timestamp();IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT e1.* INTO e FROM profitia_access.external_identities e1
 JOIN profitia_e1_authority.receivers r ON r.application_id=p.application_id AND r.issuer=e1.issuer AND r.status='ACTIVE' AND r.expires_at>clock_timestamp()
 JOIN profitia_access.applications a ON a.application_id=r.application_id AND a.status='ACTIVE' AND(a.fixed_organisation_id IS NULL OR a.fixed_organisation_id=(p_request->>'organisationId')::uuid)
 JOIN profitia_access.accounts u ON u.user_id=e1.user_id AND u.status='ACTIVE'
 WHERE e1.user_id=(p_request->>'ownerUserId')::uuid AND e1.status='ACTIVE' AND e1.expires_at>clock_timestamp();IF NOT FOUND THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_access.organisations WHERE organisation_id=(p_request->>'organisationId')::uuid AND status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM profitia_access.memberships WHERE organisation_id=(p_request->>'organisationId')::uuid AND user_id=(p_request->>'ownerUserId')::uuid AND status='ACTIVE' AND expires_at>clock_timestamp())
 OR NOT EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id=p.application_id AND organisation_id=(p_request->>'organisationId')::uuid AND product='SPENDGURU' AND 'market'=ANY(features) AND status='ACTIVE' AND expires_at>clock_timestamp())
 OR NOT EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id='spendguru' AND organisation_id=(p_request->>'organisationId')::uuid AND product='SPENDGURU' AND 'market'=ANY(features) AND status='ACTIVE' AND expires_at>clock_timestamp())
 OR NOT EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=p.application_id AND organisation_id=(p_request->>'organisationId')::uuid AND user_id=(p_request->>'ownerUserId')::uuid AND operation='insights.report.download' AND feature='market' AND effect='ALLOW' AND(resource_id IS NULL OR resource_id=p_request->>'producerJobId'))
 OR EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=p.application_id AND organisation_id=(p_request->>'organisationId')::uuid AND user_id=(p_request->>'ownerUserId')::uuid AND operation='insights.report.download' AND feature='market' AND effect='DENY' AND(resource_id IS NULL OR resource_id=p_request->>'producerJobId')) THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('environment','development','issuer',e.issuer,'subject',e.subject,'appOrigin',p.app_origin);
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $fn$;
CREATE FUNCTION profitia_e1_authority.recurring_delivery_proof(p_request jsonb,p_observation jsonb,p_recipient_digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE identity jsonb;r profitia_e1_authority.receivers%ROWTYPE;raw text;decision uuid:=gen_random_uuid();policy profitia_e1_authority.recurring_delivery_policies%ROWTYPE;
BEGIN
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 identity:=profitia_e1_authority.recurring_delivery_identity(p_request);
 IF identity IS NULL OR p_recipient_digest!~'^[a-f0-9]{64}$' OR p_observation->>'environment' IS DISTINCT FROM 'development' OR p_observation->>'issuer' IS DISTINCT FROM identity->>'issuer' OR p_observation->>'subject' IS DISTINCT FROM identity->>'subject' OR p_observation->>'status' IS DISTINCT FROM 'ACTIVE'
 OR NOT coalesce((p_observation->>'observedAt')::timestamptz<=clock_timestamp() AND(p_observation->>'expiresAt')::timestamptz>clock_timestamp() AND(p_observation->>'expiresAt')::timestamptz<=(p_observation->>'observedAt')::timestamptz+interval '5 seconds',false) THEN RETURN NULL;END IF;
 SELECT * INTO STRICT r FROM profitia_e1_authority.receivers WHERE application_id=p_request->>'applicationId';
 SELECT * INTO STRICT policy FROM profitia_e1_authority.recurring_delivery_policies WHERE application_id=r.application_id;
 raw:=jsonb_build_object('contract','profitia.recurring-report-delivery/1.0.0','request',p_request,'decisionId',decision,'recipientDigest',p_recipient_digest,'expiresAt',least((p_observation->>'expiresAt')::timestamptz,clock_timestamp()+interval '5 seconds'))::text;
 PERFORM profitia_access.append_audit(jsonb_build_object('applicationId','identity-runtime-development','environment','development','decisionId',decision::text,'phase','DECISION','decision','ALLOW','reasonCode','CURRENT_REPORT_DELIVERY','operation','insights.report.notify','actorKind','SERVICE','actorId',policy.service_id,'subjectUserId',p_request->>'ownerUserId','organisationId',p_request->>'organisationId','resourceId',p_request->>'producerJobId'));
 RETURN jsonb_build_object('payload',raw,'signature',encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex'));
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $fn$;
REVOKE ALL ON profitia_e1_authority.recurring_delivery_installation,profitia_e1_authority.recurring_delivery_policies FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_e1_authority.recurring_delivery_descriptor(),profitia_e1_authority.recurring_delivery_identity(jsonb),profitia_e1_authority.recurring_delivery_proof(jsonb,jsonb,text) FROM PUBLIC;

CREATE FUNCTION profitia_e1_authority.recurring_delivery_verify(p_proof jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r profitia_e1_authority.receivers%ROWTYPE;raw text;p jsonb;
BEGIN
 raw:=p_proof->>'payload';IF raw IS NULL OR octet_length(raw)>8192 THEN RAISE EXCEPTION 'Delivery proof refused' USING ERRCODE='42501';END IF;
 p:=raw::jsonb;SELECT * INTO r FROM profitia_e1_authority.receivers WHERE application_id=p->'request'->>'applicationId' AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND OR p_proof->>'signature' IS DISTINCT FROM encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex')
 OR p->>'contract' IS DISTINCT FROM 'profitia.recurring-report-delivery/1.0.0' OR profitia_e1_authority.recurring_delivery_identity(p->'request') IS NULL
 OR NOT coalesce((p->>'expiresAt')::timestamptz>clock_timestamp() AND(p->>'expiresAt')::timestamptz<=clock_timestamp()+interval '5 seconds',false) THEN RAISE EXCEPTION 'Current delivery proof required' USING ERRCODE='42501';END IF;RETURN p;
END $fn$;
REVOKE ALL ON FUNCTION profitia_e1_authority.recurring_delivery_verify(jsonb) FROM PUBLIC;

CREATE FUNCTION profitia_e1_authority.recurring_delivery_available(p_app text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;
BEGIN
 d:=profitia_access.runtime_descriptor();
 RETURN d->>'applicationId'=p_app AND d->>'environment'='development' AND EXISTS(SELECT 1 FROM profitia_e1_authority.recurring_delivery_installation)
 AND EXISTS(SELECT 1 FROM profitia_e1_authority.recurring_delivery_policies p JOIN profitia_access.runtime_bindings b ON b.login_role=p.login_role AND b.application_id='identity-runtime-development' AND b.status='ACTIVE' JOIN profitia_access.applications a ON a.application_id=b.application_id AND a.status='ACTIVE' WHERE p.application_id=p_app AND p.status='ACTIVE' AND p.expires_at>clock_timestamp());
END $fn$;
REVOKE ALL ON FUNCTION profitia_e1_authority.recurring_delivery_available(text) FROM PUBLIC;
