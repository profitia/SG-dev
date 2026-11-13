-- Private ECR delivery state. Installation is separate from owner admission.
-- No roles, recipients, product grants or transport credentials are created.
DO $guard$ BEGIN
 IF current_user<>'economic_calendar_development_owner' OR NOT EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND semantic_schema_digest IS NOT NULL)
 THEN RAISE EXCEPTION 'Accepted ECR predecessor and owner required';END IF;
END $guard$;
ALTER TABLE economic_calendar.installation ADD COLUMN notification_schema_digest text CHECK(notification_schema_digest~'^[a-f0-9]{64}$');
CREATE TABLE economic_calendar.notification_delivery_policy(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),
 transport_role name NOT NULL,qualifier_role name NOT NULL,service_id text NOT NULL,
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),source_ref text NOT NULL,
 version bigint NOT NULL CHECK(version>0)
);
CREATE TABLE economic_calendar.notification_settings(
 user_id uuid NOT NULL,organisation_id uuid NOT NULL,revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 email_enabled boolean NOT NULL DEFAULT false,time_zone text NOT NULL,enabled_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(user_id,organisation_id),
 CHECK(email_enabled=(enabled_at IS NOT NULL))
);
CREATE TABLE economic_calendar.notification_watches(
 user_id uuid NOT NULL,organisation_id uuid NOT NULL,publication_id text NOT NULL REFERENCES economic_calendar.publications(publication_id),
 type text NOT NULL CHECK(type IN('approaching','results','changes')),enabled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,organisation_id,publication_id,type),
 FOREIGN KEY(user_id,organisation_id) REFERENCES economic_calendar.notification_settings(user_id,organisation_id)
);
CREATE TABLE economic_calendar.notification_outbox(
 delivery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,organisation_id uuid NOT NULL,
 publication_id text NOT NULL,event_id text NOT NULL REFERENCES economic_calendar.events(event_id),
 type text NOT NULL CHECK(type IN('approaching','results','changes')),source_version text NOT NULL,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','CLAIMED','SENDING','ACCEPTED','REJECTED','UNKNOWN','CANCELLED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,
 lease_id uuid,lease_until timestamptz,nonce text,attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT clock_timestamp(),begun_at timestamptz,settled_at timestamptz,provider_id_digest text,
 recipient_digest text CHECK(recipient_digest~'^[a-f0-9]{64}$'),
 delivery_status text NOT NULL DEFAULT 'UNCONFIRMED' CHECK(delivery_status IN('UNCONFIRMED','DEFERRED','FAILED','DELIVERED')),
 provider_observed_at timestamptz,receipt_at timestamptz,
 FOREIGN KEY(user_id,organisation_id) REFERENCES economic_calendar.notification_settings(user_id,organisation_id),
 UNIQUE(user_id,organisation_id,event_id,type,source_version),
 CHECK(provider_id_digest IS NULL OR provider_id_digest~'^[a-f0-9]{64}$')
);
CREATE INDEX notification_due ON economic_calendar.notification_outbox(available_at,created_at) WHERE status IN('PENDING','CLAIMED','SENDING');
CREATE TABLE economic_calendar.notification_provider_receipts(
 token_digest text PRIMARY KEY CHECK(token_digest~'^[a-f0-9]{64}$'),event_digest text NOT NULL CHECK(event_digest~'^[a-f0-9]{64}$'),
 payload_digest text NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),delivery_id uuid NOT NULL REFERENCES economic_calendar.notification_outbox(delivery_id),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX notification_provider_events ON economic_calendar.notification_provider_receipts(event_digest);
CREATE TABLE economic_calendar.notification_health_state(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),last_alerted_at timestamptz NOT NULL DEFAULT '-infinity');
INSERT INTO economic_calendar.notification_health_state(singleton) VALUES(true);
CREATE INDEX notification_failures ON economic_calendar.notification_outbox(settled_at) WHERE status IN('REJECTED','UNKNOWN');
CREATE FUNCTION economic_calendar.notification_scope(p_user uuid,p_org uuid,p_write boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;
BEGIN
 IF NOT economic_calendar.installation_active() THEN RETURN false;END IF;
 IF NOT profitia_e1_receiver.calendar_scope('preferences',p_user,p_write) THEN RETURN false;END IF;
 p:=profitia_e1_receiver.accept(nullif(current_setting('profitia.current_e1_proof',true),'')::jsonb);
 RETURN p->'request'->>'organisationId'=p_org::text;
END $fn$;
CREATE FUNCTION economic_calendar.installation_active() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE')
$fn$;
CREATE FUNCTION economic_calendar.notification_available() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT economic_calendar.installation_active() AND EXISTS(SELECT 1 FROM economic_calendar.notification_delivery_policy WHERE singleton AND status='ACTIVE' AND expires_at>clock_timestamp())
$fn$;
REVOKE ALL ON FUNCTION economic_calendar.notification_scope(uuid,uuid,boolean),economic_calendar.installation_active(),economic_calendar.notification_available() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION economic_calendar.notification_scope(uuid,uuid,boolean),economic_calendar.notification_available() TO economic_calendar_development_runtime;
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['notification_delivery_policy','notification_settings','notification_watches','notification_outbox','notification_health_state','notification_provider_receipts'] LOOP
 EXECUTE format('ALTER TABLE economic_calendar.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE economic_calendar.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON economic_calendar.%I TO economic_calendar_development_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['notification_settings','notification_outbox'] LOOP
 EXECUTE format($p$CREATE POLICY private_reader ON economic_calendar.%I FOR SELECT TO economic_calendar_development_runtime USING(economic_calendar.notification_scope(user_id,organisation_id,false))$p$,t);
 END LOOP;
 CREATE POLICY private_insert ON economic_calendar.notification_settings FOR INSERT TO economic_calendar_development_runtime WITH CHECK(economic_calendar.notification_scope(user_id,organisation_id,true));
 CREATE POLICY private_update ON economic_calendar.notification_settings FOR UPDATE TO economic_calendar_development_runtime USING(economic_calendar.notification_scope(user_id,organisation_id,true)) WITH CHECK(economic_calendar.notification_scope(user_id,organisation_id,true));
END $policies$;
GRANT SELECT,INSERT,UPDATE ON economic_calendar.notification_settings TO economic_calendar_development_runtime;
GRANT SELECT ON economic_calendar.notification_outbox TO economic_calendar_development_runtime;

-- Existing watch flags do not imply email consent. Activation records a fresh
-- epoch for each newly enabled type; unrelated preference writes preserve it.
CREATE FUNCTION economic_calendar.refresh_notification_watches() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE u uuid;org uuid;data jsonb;w jsonb;k text;s record;
BEGIN
 u:=NEW.user_id;
 IF TG_TABLE_NAME='preferences' THEN data:=NEW.data;ELSE SELECT p.data INTO data FROM economic_calendar.preferences p WHERE p.user_id=u;END IF;
 FOR s IN SELECT organisation_id FROM economic_calendar.notification_settings WHERE user_id=u LOOP
  org:=s.organisation_id;
  DELETE FROM economic_calendar.notification_watches n WHERE n.user_id=u AND n.organisation_id=org AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(coalesce(data->'publicationWatches','[]'::jsonb)) x WHERE x->>'publicationId'=n.publication_id AND x->>n.type='true');
  FOR w IN SELECT value FROM jsonb_array_elements(coalesce(data->'publicationWatches','[]'::jsonb)) LOOP
   FOREACH k IN ARRAY ARRAY['approaching','results','changes'] LOOP
    IF w->>k='true' AND EXISTS(SELECT 1 FROM economic_calendar.publications WHERE publication_id=w->>'publicationId') THEN
     INSERT INTO economic_calendar.notification_watches(user_id,organisation_id,publication_id,type) VALUES(u,org,w->>'publicationId',k) ON CONFLICT DO NOTHING;
    END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 RETURN NEW;
END $fn$;
CREATE TRIGGER notification_watch_preferences AFTER INSERT OR UPDATE OF data ON economic_calendar.preferences FOR EACH ROW EXECUTE FUNCTION economic_calendar.refresh_notification_watches();
CREATE TRIGGER notification_watch_consent AFTER INSERT OR UPDATE ON economic_calendar.notification_settings FOR EACH ROW EXECUTE FUNCTION economic_calendar.refresh_notification_watches();

CREATE FUNCTION economic_calendar.notification_gate(p_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT EXISTS(SELECT 1 FROM economic_calendar.notification_outbox o
 JOIN economic_calendar.notification_settings s USING(user_id,organisation_id)
 JOIN economic_calendar.notification_watches w USING(user_id,organisation_id,publication_id,type)
 JOIN economic_calendar.events e USING(event_id)
 JOIN economic_calendar.notification_delivery_policy p ON p.singleton AND p.status='ACTIVE' AND p.transport_role=session_user AND p.expires_at>clock_timestamp()
 WHERE o.delivery_id=p_id AND s.email_enabled AND o.created_at>=s.enabled_at AND o.created_at>=w.enabled_at
 AND o.expires_at>clock_timestamp() AND o.lease_until>clock_timestamp() AND o.status IN('CLAIMED','SENDING')
 AND EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE')
 AND economic_calendar.retained_source_allowed(e.provider,e.current_data->'source'->>'licenceRef')
 AND (o.type<>'approaching' OR o.payload->'schedule' IS NOT DISTINCT FROM e.current_data->'schedule')
 AND (o.type='approaching' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(o.payload->'results','[]'::jsonb)) r WHERE NOT EXISTS(
  SELECT 1 FROM economic_calendar.result_storage_policies rp WHERE rp.status='ACTIVE' AND rp.provider_id=r->>'provider' AND rp.dataset_id=r->>'dataset' AND r->>'series'=ANY(rp.series_ids) AND rp.licence_ref=r->>'licenceRef'))))
$fn$;

CREATE FUNCTION economic_calendar.capture_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e economic_calendar.events%ROWTYPE;t text;v text;content jsonb;observed timestamptz;published timestamptz;
BEGIN
 IF NOT NEW.adopted_as_current THEN RETURN NEW;END IF;
 SELECT * INTO e FROM economic_calendar.events WHERE event_id=NEW.event_id;IF NOT FOUND OR e.publication_id IS NULL THEN RETURN NEW;END IF;
 observed:=NEW.observed_at;
 IF TG_TABLE_NAME='result_observations' THEN
  IF NEW.actual IS NULL OR NEW.change_kind NOT IN('FIRST_OBSERVED','VALUE_CHANGED') THEN RETURN NEW;END IF;
  published:=NEW.published_at;
  t:=CASE WHEN NEW.change_kind='FIRST_OBSERVED' THEN 'results' ELSE 'changes' END;
  v:=CASE WHEN t='results' THEN 'first:'||e.event_id ELSE NEW.receipt_ref::text END;
  SELECT jsonb_agg(jsonb_build_object('observationId',r.observation_id,'sequence',r.sequence,'actual',r.actual::text,'unit',r.unit,'referencePeriod',r.reference_period,'observedAt',r.observed_at,'sourceUrl',r.source_url,'provider',r.provider_id,'dataset',r.dataset_id,'series',r.series_id,'licenceRef',r.licence_ref) ORDER BY r.observation_id)
  INTO content FROM(SELECT DISTINCT ON(observation_id) * FROM economic_calendar.result_observations r WHERE r.event_id=e.event_id AND r.adopted_as_current
   AND(t='results' OR r.receipt_ref=NEW.receipt_ref AND r.change_kind=NEW.change_kind) ORDER BY observation_id,sequence DESC)r WHERE r.actual IS NOT NULL;
  content:=jsonb_build_object('results',content,'changeKind',NEW.change_kind);
 ELSE
  IF NEW.sequence=1 OR NOT (NEW.change_kinds&&ARRAY['SCHEDULE_CHANGED','ACTUAL_CHANGED','PREVIOUS_REVISED']) THEN RETURN NEW;END IF;
  t:='changes';v:='event:'||NEW.sequence::text;content:=jsonb_build_object('changeKinds',NEW.change_kinds,'schedule',NEW.data->'schedule','values',NEW.data->'values');
 END IF;
 content:=content||jsonb_build_object('title',e.current_data->>'title','eventId',e.event_id,'publicationId',e.publication_id,'type',t,'provider',e.provider,'sourceUrl',e.current_data->>'sourceUrl','observedAt',observed);
 INSERT INTO economic_calendar.notification_outbox(user_id,organisation_id,publication_id,event_id,type,source_version,payload,expires_at,available_at)
 SELECT s.user_id,s.organisation_id,e.publication_id,e.event_id,t,v,content,clock_timestamp()+interval '24 hours',clock_timestamp()+CASE WHEN t='results' THEN interval '2 minutes' ELSE interval '0 seconds' END
 FROM economic_calendar.notification_settings s JOIN economic_calendar.notification_watches w USING(user_id,organisation_id)
 WHERE s.email_enabled AND w.publication_id=e.publication_id AND w.type=t AND observed>greatest(s.enabled_at,w.enabled_at)
 -- A first acquisition of an old edition is backfill, not a new publication.
 -- A genuinely observed revision of an old edition remains a new change.
 AND(t<>'results' OR (e.current_data->>'eventAt')::timestamptz>=greatest(s.enabled_at,w.enabled_at,clock_timestamp()-interval '24 hours')
   OR published>=greatest(s.enabled_at,w.enabled_at,clock_timestamp()-interval '24 hours'))
 ON CONFLICT(user_id,organisation_id,event_id,type,source_version) DO UPDATE SET payload=EXCLUDED.payload WHERE notification_outbox.status='PENDING';
 RETURN NEW;
END $fn$;
CREATE TRIGGER notification_result AFTER INSERT ON economic_calendar.result_observations FOR EACH ROW EXECUTE FUNCTION economic_calendar.capture_notification();
CREATE TRIGGER notification_change AFTER INSERT ON economic_calendar.observations FOR EACH ROW EXECUTE FUNCTION economic_calendar.capture_notification();

-- Owner-only bounded acceptance rehearsal. Uses an existing real event and
-- the ordinary consent/watch/current-E1 delivery path; never creates a source
-- event, fabricated change or historical backlog. Not granted to any runtime.
CREATE FUNCTION economic_calendar.qualify_delivery_rehearsal(p_user uuid,p_org uuid,p_event text,p_type text,p_key uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e economic_calendar.events%ROWTYPE;content jsonb;
BEGIN
 IF p_key IS NULL OR p_type NOT IN('approaching','results','changes') OR NOT economic_calendar.notification_available() THEN RAISE EXCEPTION 'Rehearsal not admitted';END IF;
 SELECT * INTO STRICT e FROM economic_calendar.events WHERE event_id=p_event;
 IF NOT EXISTS(SELECT 1 FROM economic_calendar.notification_settings s JOIN economic_calendar.notification_watches w USING(user_id,organisation_id) WHERE s.user_id=p_user AND s.organisation_id=p_org AND s.email_enabled AND w.publication_id=e.publication_id AND w.type=p_type)
 OR NOT economic_calendar.retained_source_allowed(e.provider,e.current_data->'source'->>'licenceRef') THEN RAISE EXCEPTION 'Explicit consent and current source rights required';END IF;
 SELECT jsonb_agg(jsonb_build_object('actual',r.actual::text,'unit',r.unit,'referencePeriod',r.reference_period,'provider',r.provider_id,'dataset',r.dataset_id,'series',r.series_id,'licenceRef',r.licence_ref) ORDER BY r.series_id) INTO content
 FROM(SELECT DISTINCT ON(observation_id) * FROM economic_calendar.result_observations WHERE event_id=p_event AND adopted_as_current ORDER BY observation_id,sequence DESC)r WHERE r.actual IS NOT NULL;
 IF p_type='results' AND content IS NULL THEN RAISE EXCEPTION 'Actual retained result required';END IF;
 INSERT INTO economic_calendar.notification_outbox(user_id,organisation_id,publication_id,event_id,type,source_version,payload,expires_at)
 VALUES(p_user,p_org,e.publication_id,e.event_id,p_type,'control:'||p_key::text,jsonb_build_object('controlTest',true,'type',p_type,'title',e.current_data->>'title','eventId',e.event_id,'publicationId',e.publication_id,'provider',e.provider,'schedule',e.current_data->'schedule','results',coalesce(content,'[]'::jsonb)),clock_timestamp()+interval '1 hour')
 ON CONFLICT(user_id,organisation_id,event_id,type,source_version) DO NOTHING;
 RETURN FOUND;
END $fn$;

CREATE FUNCTION economic_calendar.qualify_reminders() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE n integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM economic_calendar.notification_delivery_policy WHERE singleton AND status='ACTIVE' AND qualifier_role=session_user AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'Qualifier not admitted' USING ERRCODE='42501';END IF;
 INSERT INTO economic_calendar.notification_outbox(user_id,organisation_id,publication_id,event_id,type,source_version,payload,expires_at)
 SELECT s.user_id,s.organisation_id,e.publication_id,e.event_id,'approaching',encode(public.digest(convert_to((e.current_data->'schedule')::text,'UTF8'),'sha256'),'hex'),
 jsonb_build_object('title',e.current_data->>'title','type','approaching','eventId',e.event_id,'publicationId',e.publication_id,'provider',e.provider,'sourceUrl',e.current_data->>'sourceUrl','schedule',e.current_data->'schedule'),d.until_at
 FROM economic_calendar.notification_settings s JOIN economic_calendar.notification_watches w USING(user_id,organisation_id)
 JOIN economic_calendar.events e ON e.publication_id=w.publication_id
 CROSS JOIN LATERAL(SELECT CASE WHEN e.current_data->'schedule'->>'timePrecision' IN('INSTANT','TIME_WINDOW') THEN(e.current_data->>'eventAt')::timestamptz-interval '1 hour'
 WHEN e.current_data->'schedule'->>'timePrecision'='DATE' THEN((e.current_data->'schedule'->>'dateOnly')::date+time '09:00') AT TIME ZONE s.time_zone END AS due_at,
 CASE WHEN e.current_data->'schedule'->>'timePrecision' IN('INSTANT','TIME_WINDOW') THEN(e.current_data->>'eventAt')::timestamptz
 WHEN e.current_data->'schedule'->>'timePrecision'='DATE' THEN((e.current_data->'schedule'->>'dateOnly')::date+time '21:00') AT TIME ZONE s.time_zone END AS until_at)d
 WHERE s.email_enabled AND w.type='approaching' AND d.due_at>=greatest(s.enabled_at,w.enabled_at) AND clock_timestamp()>=d.due_at AND clock_timestamp()<d.until_at
 AND economic_calendar.retained_source_allowed(e.provider,e.current_data->'source'->>'licenceRef')
 ON CONFLICT(user_id,organisation_id,event_id,type,source_version) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n;
END $fn$;

CREATE FUNCTION economic_calendar.notification_descriptor() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT jsonb_build_object('schemaDigest',i.notification_schema_digest,'contract','profitia.economic-calendar-notifications/1.0.0','serviceId',p.service_id,'environment',i.environment,'applicationId',i.application_id)
 FROM economic_calendar.notification_delivery_policy p,economic_calendar.installation i WHERE p.singleton AND i.singleton AND p.status='ACTIVE' AND p.transport_role=session_user AND p.expires_at>clock_timestamp() AND i.status='ACTIVE'
$fn$;
CREATE FUNCTION economic_calendar.notification_claim(p_lease uuid,p_nonce text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE o economic_calendar.notification_outbox%ROWTYPE;
BEGIN
 IF economic_calendar.notification_descriptor() IS NULL OR p_nonce!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Transport not admitted' USING ERRCODE='42501';END IF;
 UPDATE economic_calendar.notification_outbox SET status='UNKNOWN',settled_at=clock_timestamp() WHERE status='SENDING' AND lease_until<=clock_timestamp();
 UPDATE economic_calendar.notification_outbox SET status=CASE WHEN attempts>=3 THEN 'REJECTED' ELSE 'PENDING' END,settled_at=CASE WHEN attempts>=3 THEN clock_timestamp() END,available_at=clock_timestamp()+interval '1 minute',lease_id=NULL,lease_until=NULL WHERE status='CLAIMED' AND lease_until<=clock_timestamp();
 FOR o IN SELECT * FROM economic_calendar.notification_outbox WHERE status='PENDING' AND available_at<=clock_timestamp() ORDER BY created_at,delivery_id FOR UPDATE SKIP LOCKED LIMIT 50 LOOP
  UPDATE economic_calendar.notification_outbox SET status='CLAIMED',lease_id=p_lease,nonce=p_nonce,lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1 WHERE delivery_id=o.delivery_id;
  IF NOT economic_calendar.notification_gate(o.delivery_id) THEN UPDATE economic_calendar.notification_outbox SET status='CANCELLED',settled_at=clock_timestamp() WHERE delivery_id=o.delivery_id;CONTINUE;END IF;
  RETURN jsonb_build_object('request',jsonb_build_object('applicationId','profitia-economic-calendar-runtime-development','deliveryId',o.delivery_id,'leaseId',p_lease,'nonce',p_nonce,'organisationId',o.organisation_id,'ownerUserId',o.user_id,'eventId',o.event_id,'payloadDigest',encode(public.digest(convert_to(o.payload::text,'UTF8'),'sha256'),'hex')),'payload',o.payload,'expiresAt',o.expires_at);
 END LOOP;RETURN NULL;
END $fn$;
CREATE FUNCTION economic_calendar.notification_begin(p_id uuid,p_lease uuid,p_nonce text,p_recipient_digest text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF p_recipient_digest IS NULL OR p_recipient_digest!~'^[a-f0-9]{64}$' OR NOT economic_calendar.notification_gate(p_id) THEN RETURN false;END IF;
 UPDATE economic_calendar.notification_outbox SET status='SENDING',begun_at=clock_timestamp(),recipient_digest=p_recipient_digest WHERE delivery_id=p_id AND lease_id=p_lease AND nonce=p_nonce AND lease_until>clock_timestamp() AND status='CLAIMED';
 RETURN FOUND;
END $fn$;
CREATE FUNCTION economic_calendar.notification_settle(p_id uuid,p_lease uuid,p_status text,p_provider_digest text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 -- A revoked sender can still settle its already-bound lease, including an
 -- uncertain HTTP outcome. This grants no new claim/begin/send authority.
 IF NOT EXISTS(SELECT 1 FROM economic_calendar.notification_delivery_policy WHERE singleton AND transport_role=session_user) OR p_status NOT IN('ACCEPTED','REJECTED','UNKNOWN','RELEASE') THEN RAISE EXCEPTION 'Settlement refused' USING ERRCODE='42501';END IF;
 UPDATE economic_calendar.notification_outbox SET status=CASE WHEN p_status='RELEASE' THEN CASE WHEN attempts>=3 THEN 'REJECTED' ELSE 'PENDING' END ELSE p_status END,
 settled_at=CASE WHEN p_status='RELEASE' THEN NULL ELSE clock_timestamp() END,available_at=clock_timestamp()+make_interval(secs=>least(3600,60*attempts)),provider_id_digest=coalesce(provider_id_digest,p_provider_digest)
 WHERE delivery_id=p_id AND lease_id=p_lease AND ((status='SENDING' AND p_status IN('ACCEPTED','REJECTED','UNKNOWN')) OR(status='CLAIMED' AND p_status IN('RELEASE','REJECTED')));
 RETURN FOUND;
END $fn$;
CREATE FUNCTION economic_calendar.notification_provider_event(p jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE o economic_calendar.notification_outbox%ROWTYPE;previous text;k text;observed timestamptz;
BEGIN
 -- Authenticated provider receipts may settle historical attempts after consent
 -- or policy revocation. They confer no ability to claim or send another mail.
 IF NOT EXISTS(SELECT 1 FROM economic_calendar.notification_delivery_policy WHERE singleton AND transport_role=session_user) THEN RAISE EXCEPTION 'Receipt writer not admitted' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p)<>'object' OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(p) key) IS DISTINCT FROM ARRAY['deliveryId','eventDigest','leaseId','messageDigest','occurredAt','payloadDigest','recipientDigest','status','tokenDigest'] OR p->>'status' NOT IN('DEFERRED','FAILED','DELIVERED') THEN RETURN false;END IF;
 FOREACH k IN ARRAY ARRAY['eventDigest','messageDigest','payloadDigest','recipientDigest','tokenDigest'] LOOP IF p->>k IS NULL OR p->>k!~'^[a-f0-9]{64}$' THEN RETURN false;END IF;END LOOP;
 observed:=(p->>'occurredAt')::timestamptz;
 IF NOT isfinite(observed) OR observed>clock_timestamp()+interval '1 minute' THEN RETURN false;END IF;
 -- Serialize event and token replays, including concurrent duplicate callbacks.
 PERFORM pg_advisory_xact_lock(hashtextextended('calendar-receipt-event:'||(p->>'eventDigest'),0));
 PERFORM pg_advisory_xact_lock(hashtextextended('calendar-receipt-token:'||(p->>'tokenDigest'),0));
 SELECT payload_digest INTO previous FROM economic_calendar.notification_provider_receipts WHERE token_digest=p->>'tokenDigest';
 IF FOUND THEN RETURN previous=p->>'payloadDigest';END IF;
 IF EXISTS(SELECT 1 FROM economic_calendar.notification_provider_receipts WHERE event_digest=p->>'eventDigest' AND payload_digest<>p->>'payloadDigest') THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM economic_calendar.notification_provider_receipts WHERE event_digest=p->>'eventDigest') THEN
  INSERT INTO economic_calendar.notification_provider_receipts(token_digest,event_digest,payload_digest,delivery_id) VALUES(p->>'tokenDigest',p->>'eventDigest',p->>'payloadDigest',(p->>'deliveryId')::uuid);
  RETURN true;
 END IF;
 SELECT * INTO o FROM economic_calendar.notification_outbox WHERE delivery_id=(p->>'deliveryId')::uuid FOR UPDATE;
 IF NOT FOUND OR o.lease_id IS DISTINCT FROM(p->>'leaseId')::uuid OR o.recipient_digest IS DISTINCT FROM p->>'recipientDigest' OR o.status NOT IN('SENDING','ACCEPTED','UNKNOWN') OR observed<o.begun_at-interval '1 minute' OR o.provider_id_digest IS NOT NULL AND o.provider_id_digest<>p->>'messageDigest' THEN RETURN false;END IF;
 INSERT INTO economic_calendar.notification_provider_receipts(token_digest,event_digest,payload_digest,delivery_id) VALUES(p->>'tokenDigest',p->>'eventDigest',p->>'payloadDigest',o.delivery_id);
 UPDATE economic_calendar.notification_outbox SET provider_id_digest=coalesce(provider_id_digest,p->>'messageDigest'),
 delivery_status=CASE WHEN delivery_status='DELIVERED' OR provider_observed_at>observed THEN delivery_status ELSE p->>'status' END,
 provider_observed_at=greatest(provider_observed_at,observed),receipt_at=clock_timestamp() WHERE delivery_id=o.delivery_id;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $fn$;
CREATE FUNCTION economic_calendar.notification_health() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE previous timestamptz;at timestamptz:=clock_timestamp();r jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM economic_calendar.notification_delivery_policy WHERE singleton AND status='ACTIVE' AND qualifier_role=session_user AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'Monitor not admitted' USING ERRCODE='42501';END IF;
 SELECT last_alerted_at INTO STRICT previous FROM economic_calendar.notification_health_state WHERE singleton FOR UPDATE;
 SELECT jsonb_build_object('unknown',count(*) FILTER(WHERE status='UNKNOWN' AND delivery_status='UNCONFIRMED'),'rejected',count(*) FILTER(WHERE status='REJECTED'),
 'newFailures',count(*) FILTER(WHERE status IN('UNKNOWN','REJECTED') AND delivery_status<>'DELIVERED' AND settled_at>previous AND settled_at<=at OR delivery_status='FAILED' AND receipt_at>previous AND receipt_at<=at),
 'pending',count(*) FILTER(WHERE status IN('PENDING','CLAIMED','SENDING')),'providerAccepted',count(*) FILTER(WHERE status='ACCEPTED'),
 'deliveredToRecipientServer',count(*) FILTER(WHERE delivery_status='DELIVERED'),'failed',count(*) FILTER(WHERE delivery_status='FAILED'),'deferred',count(*) FILTER(WHERE delivery_status='DEFERRED'))
 INTO r FROM economic_calendar.notification_outbox;
 UPDATE economic_calendar.notification_health_state SET last_alerted_at=at WHERE singleton;RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION economic_calendar.refresh_notification_watches(),economic_calendar.notification_gate(uuid),economic_calendar.capture_notification(),economic_calendar.qualify_delivery_rehearsal(uuid,uuid,text,text,uuid),economic_calendar.qualify_reminders(),economic_calendar.notification_descriptor(),economic_calendar.notification_claim(uuid,text),economic_calendar.notification_begin(uuid,uuid,text,text),economic_calendar.notification_settle(uuid,uuid,text,text),economic_calendar.notification_provider_event(jsonb),economic_calendar.notification_health() FROM PUBLIC;
