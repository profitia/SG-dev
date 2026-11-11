-- Durable references to immutable PUBLISHED editions, not a second email
-- provider, report producer, directory or publication authority.
DO $guard$ BEGIN IF current_user<>'insights_report_owner' OR to_regclass('insights_private.recurring_migrations') IS NULL OR to_regprocedure('profitia_e1_authority.recurring_delivery_verify(jsonb)') IS NULL THEN RAISE EXCEPTION 'Admitted recurring and Identity delivery required';END IF;END $guard$;
CREATE TABLE insights_private.delivery_installation(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'));
CREATE TABLE insights_private.report_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,subscription_id uuid NOT NULL,
 producer_job_id uuid NOT NULL REFERENCES insights_private.published_editions(producer_job_id),subscription_version bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
 state text NOT NULL DEFAULT 'QUEUED' CHECK(state IN('QUEUED','LEASED','SENDING','ACCEPTED','REJECTED','UNKNOWN','EXPIRED')),
 lease_id uuid,lease_until timestamptz,nonce text,decision_id uuid,recipient_digest text,provider_id text,
 CHECK(recipient_digest IS NULL OR recipient_digest~'^[a-f0-9]{64}$'),CHECK(provider_id IS NULL OR length(provider_id)<=255),
 UNIQUE(producer_job_id,organisation_id,owner_user_id),
 FOREIGN KEY(organisation_id,owner_user_id,subscription_id) REFERENCES insights_private.report_subscriptions(organisation_id,owner_user_id,id)
);
CREATE INDEX report_delivery_pending ON insights_private.report_deliveries(created_at,id) WHERE state IN('QUEUED','LEASED','SENDING');
DO $policies$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['delivery_installation','report_deliveries'] LOOP
 EXECUTE format('ALTER TABLE insights_private.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE insights_private.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON insights_private.%I TO insights_report_owner USING(true) WITH CHECK(true)',t);
END LOOP;END $policies$;
CREATE FUNCTION insights_private.delivery_descriptor() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r pg_roles%ROWTYPE;
BEGIN
 SELECT * INTO r FROM pg_roles WHERE rolname=session_user;
 IF NOT FOUND OR NOT r.rolcanlogin OR r.rolsuper OR r.rolinherit OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) THEN RETURN NULL;END IF;
 d:=profitia_e1_authority.recurring_delivery_descriptor();IF d IS NULL THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('reportSchemaDigest',(SELECT schema_digest FROM insights_private.delivery_installation WHERE singleton));
END $fn$;
CREATE FUNCTION insights_private.delivery_current(d insights_private.report_deliveries) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT EXISTS(SELECT 1 FROM insights_private.report_subscriptions s JOIN insights_private.published_editions p ON p.producer_job_id=d.producer_job_id AND p.organisation_id=s.organisation_id JOIN insights_private.subscription_runs r ON r.producer_job_id=p.producer_job_id AND r.subscription_id=s.id AND r.organisation_id=s.organisation_id AND r.owner_user_id=s.owner_user_id
 WHERE s.id=d.subscription_id AND s.organisation_id=d.organisation_id AND s.owner_user_id=d.owner_user_id AND s.version=d.subscription_version AND s.status='ACTIVE' AND s.definition->'notifications'->>'email'='true')
$fn$;
CREATE FUNCTION insights_private.delivery_claim(p_lease uuid,p_nonce text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE descriptor jsonb;d insights_private.report_deliveries%ROWTYPE;published_record insights_private.published_editions%ROWTYPE;app text;
BEGIN
 descriptor:=insights_private.delivery_descriptor();IF descriptor IS NULL OR p_nonce!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Admitted Identity sender required' USING ERRCODE='42501';END IF;
 -- Rescan references only: handles publisher/process restart without changing
 -- the immutable publication trigger or silently generating another report.
 INSERT INTO insights_private.report_deliveries(organisation_id,owner_user_id,subscription_id,producer_job_id,subscription_version)
 SELECT DISTINCT ON(p.producer_job_id,s.organisation_id,s.owner_user_id) s.organisation_id,s.owner_user_id,s.id,p.producer_job_id,s.version
 FROM insights_private.published_editions p JOIN insights_private.subscription_runs r ON r.producer_job_id=p.producer_job_id AND r.organisation_id=p.organisation_id
 JOIN insights_private.report_subscriptions s ON s.id=r.subscription_id AND s.organisation_id=r.organisation_id AND s.owner_user_id=r.owner_user_id
 WHERE s.status='ACTIVE' AND s.definition->'notifications'->>'email'='true' AND greatest(p.published_at,r.created_at)>clock_timestamp()-interval '24 hours'
 ORDER BY p.producer_job_id,s.organisation_id,s.owner_user_id,s.id ON CONFLICT DO NOTHING;
 UPDATE insights_private.report_deliveries SET state=CASE WHEN state='SENDING' THEN 'UNKNOWN' WHEN expires_at<=clock_timestamp() THEN 'EXPIRED' ELSE 'QUEUED' END WHERE state IN('QUEUED','LEASED','SENDING') AND(expires_at<=clock_timestamp() OR lease_until<=clock_timestamp());
 FOR d IN SELECT * FROM insights_private.report_deliveries WHERE state='QUEUED' AND expires_at>clock_timestamp() ORDER BY created_at,id LIMIT 50 FOR UPDATE SKIP LOCKED LOOP
  IF NOT insights_private.delivery_current(d) THEN UPDATE insights_private.report_deliveries SET state='REJECTED' WHERE id=d.id;CONTINUE;END IF;
  SELECT * INTO STRICT published_record FROM insights_private.published_editions WHERE producer_job_id=d.producer_job_id;
  SELECT b.binding->>'applicationId' INTO app FROM insights_private.runtime_bindings b WHERE b.mode='RECEIVER' AND b.organisation_id=d.organisation_id AND b.status='ACTIVE' AND b.expires_at>clock_timestamp();
  IF app IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(descriptor->'policies') policy WHERE policy->>'applicationId'=app) THEN CONTINUE;END IF;
  UPDATE insights_private.report_deliveries SET state='LEASED',lease_id=p_lease,lease_until=clock_timestamp()+interval '30 seconds',nonce=p_nonce WHERE id=d.id;
  RETURN jsonb_build_object('request',jsonb_build_object('applicationId',app,'deliveryId',d.id,'leaseId',p_lease,'nonce',p_nonce,'organisationId',d.organisation_id,'ownerUserId',d.owner_user_id,'subscriptionId',d.subscription_id,'subscriptionVersion',d.subscription_version::text,'producerJobId',d.producer_job_id,'pdfSha256',published_record.pdf_sha256),'title',published_record.title,'editionId',published_record.edition_id,'asOf',published_record.as_of,'publishedAt',published_record.published_at,'period',published_record.period,'expiresAt',d.expires_at);
 END LOOP;RETURN NULL;
END $fn$;
CREATE FUNCTION insights_private.delivery_begin(p_request jsonb,p_proof jsonb,p_recipient_digest text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d insights_private.report_deliveries%ROWTYPE;p jsonb;published insights_private.published_editions%ROWTYPE;
BEGIN
 IF insights_private.delivery_descriptor() IS NULL THEN RAISE EXCEPTION 'Identity binding refused' USING ERRCODE='42501';END IF;
 p:=profitia_e1_authority.recurring_delivery_verify(p_proof);
 SELECT * INTO d FROM insights_private.report_deliveries WHERE id=(p_request->>'deliveryId')::uuid AND lease_id=(p_request->>'leaseId')::uuid AND nonce=p_request->>'nonce' AND state='LEASED' AND lease_until>clock_timestamp() AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND OR p->'request' IS DISTINCT FROM p_request OR p->>'recipientDigest' IS DISTINCT FROM p_recipient_digest OR NOT insights_private.delivery_current(d)
 OR p_request->>'organisationId' IS DISTINCT FROM d.organisation_id::text OR p_request->>'ownerUserId' IS DISTINCT FROM d.owner_user_id::text OR p_request->>'subscriptionId' IS DISTINCT FROM d.subscription_id::text OR p_request->>'subscriptionVersion' IS DISTINCT FROM d.subscription_version::text OR p_request->>'producerJobId' IS DISTINCT FROM d.producer_job_id::text
 THEN RAISE EXCEPTION 'Current exact report delivery required' USING ERRCODE='42501';END IF;
 SELECT * INTO STRICT published FROM insights_private.published_editions WHERE producer_job_id=d.producer_job_id;
 IF p_request->>'pdfSha256' IS DISTINCT FROM published.pdf_sha256 THEN RAISE EXCEPTION 'Published version changed' USING ERRCODE='42501';END IF;
 UPDATE insights_private.report_deliveries SET state='SENDING',lease_until=clock_timestamp()+interval '45 seconds',recipient_digest=p_recipient_digest,decision_id=(p->>'decisionId')::uuid WHERE id=d.id;
END $fn$;
CREATE FUNCTION insights_private.delivery_settle(p_id uuid,p_lease uuid,p_status text,p_provider text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d insights_private.report_deliveries%ROWTYPE;
BEGIN
 IF insights_private.delivery_descriptor() IS NULL OR p_status NOT IN('RELEASE','ACCEPTED','REJECTED','UNKNOWN') THEN RAISE EXCEPTION 'Delivery settlement refused' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM insights_private.report_deliveries WHERE id=p_id AND lease_id=p_lease AND state IN('LEASED','SENDING') FOR UPDATE;IF NOT FOUND THEN RETURN;END IF;
 IF p_status='RELEASE' AND d.state<>'LEASED' THEN RAISE EXCEPTION 'An attempted send cannot be retried' USING ERRCODE='42501';END IF;
 IF d.state='LEASED' AND p_status NOT IN('RELEASE','REJECTED') OR length(p_provider)>255 THEN RAISE EXCEPTION 'Invalid delivery outcome' USING ERRCODE='42501';END IF;
 UPDATE insights_private.report_deliveries SET state=CASE p_status WHEN 'RELEASE' THEN 'QUEUED' ELSE p_status END,lease_until=NULL,provider_id=CASE WHEN p_status='ACCEPTED' THEN p_provider ELSE NULL END WHERE id=d.id;
END $fn$;
REVOKE ALL ON insights_private.delivery_installation,insights_private.report_deliveries FROM PUBLIC;
REVOKE ALL ON FUNCTION insights_private.delivery_descriptor(),insights_private.delivery_current(insights_private.report_deliveries),insights_private.delivery_claim(uuid,text),insights_private.delivery_begin(jsonb,jsonb,text),insights_private.delivery_settle(uuid,uuid,text,text) FROM PUBLIC;

CREATE FUNCTION insights_private.delivery_available() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;
BEGIN
 d:=insights_private.runtime_descriptor();
 RETURN d IS NOT NULL AND EXISTS(SELECT 1 FROM insights_private.delivery_installation)
 AND profitia_e1_authority.recurring_delivery_available(d->>'applicationId');
END $fn$;
CREATE FUNCTION insights_private.delivery_states(p_jobs uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF insights_private.runtime_descriptor() IS NULL OR cardinality(p_jobs)>100 THEN RAISE EXCEPTION 'Current bounded recipient scope required' USING ERRCODE='42501';END IF;
 RETURN(SELECT coalesce(jsonb_agg(jsonb_build_object('producerJobId',d.producer_job_id,'state',d.state)),'[]') FROM insights_private.report_deliveries d WHERE d.producer_job_id=ANY(p_jobs) AND insights_private.subscription_scope(d.organisation_id,d.owner_user_id,false));
END $fn$;
REVOKE ALL ON FUNCTION insights_private.delivery_available(),insights_private.delivery_states(uuid[]) FROM PUBLIC;
DO $grants$ DECLARE r name;BEGIN FOR r IN SELECT login_role FROM insights_private.runtime_bindings WHERE mode='RECEIVER' AND status='ACTIVE' AND expires_at>clock_timestamp() LOOP
 EXECUTE format('GRANT EXECUTE ON FUNCTION insights_private.delivery_available(),insights_private.delivery_states(uuid[]) TO %I',r);
 EXECUTE format('GRANT SELECT ON insights_private.delivery_installation TO %I',r);
END LOOP;END $grants$;

CREATE POLICY delivery_version_read ON insights_private.delivery_installation FOR SELECT TO PUBLIC USING(true);
