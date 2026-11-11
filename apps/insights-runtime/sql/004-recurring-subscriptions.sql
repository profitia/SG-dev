-- Additive private subscription dispatch. Existing producer, review gate,
-- financial admission and immutable publication remain separate authorities.
DO $guard$ BEGIN
 IF current_user<>'insights_report_owner' OR to_regprocedure('profitia_e1_receiver.recurring_scope(uuid,uuid,uuid,bigint,text)') IS NULL
 OR NOT EXISTS(SELECT 1 FROM insights_private.subscription_migrations WHERE version='1.0.0' AND digest='fcd98c117513adb4d2f54c8d9ca1b3a54e741c81262fdeb7e6305f6c13df3f99')
 THEN RAISE EXCEPTION 'Accepted subscriptions and recurring E1 required';END IF;
END $guard$;
CREATE TABLE insights_private.recurring_migrations(version text PRIMARY KEY,digest text NOT NULL CHECK(digest~'^[a-f0-9]{64}$'));
CREATE TABLE insights_private.subscription_delegations(
 subscription_id uuid PRIMARY KEY,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 delegation_id uuid NOT NULL UNIQUE,delegation_version bigint NOT NULL,resource_version bigint NOT NULL,
 definition_digest text NOT NULL CHECK(definition_digest~'^[a-f0-9]{64}$'),status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),next_due_at timestamptz,
 FOREIGN KEY(organisation_id,owner_user_id,subscription_id) REFERENCES insights_private.report_subscriptions(organisation_id,owner_user_id,id)
);
CREATE TABLE insights_private.subscription_jobs(
 id uuid PRIMARY KEY,subscription_id uuid NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 delegation_id uuid NOT NULL,resource_version bigint NOT NULL,definition_digest text NOT NULL,slot_at timestamptz NOT NULL,schedule_slot text NOT NULL,
 lease_id uuid NOT NULL,claimed_at timestamptz NOT NULL,lease_until timestamptz NOT NULL,state text NOT NULL CHECK(state IN('LEASED','QUEUED')),
 expected_command jsonb,expected_business_key text,producer_job_id uuid REFERENCES insights_private.report_jobs(id),
 UNIQUE(subscription_id,schedule_slot),FOREIGN KEY(organisation_id,owner_user_id,subscription_id) REFERENCES insights_private.report_subscriptions(organisation_id,owner_user_id,id)
);
ALTER TABLE insights_private.subscription_runs ADD COLUMN executed_by_actor_id uuid;
ALTER TABLE insights_private.subscription_runs ADD COLUMN e1_decision_id uuid;
CREATE INDEX recurring_subscriptions_due ON insights_private.subscription_delegations(next_due_at,subscription_id) WHERE status='ACTIVE';
DO $policy$ DECLARE t text;r name;BEGIN
 FOREACH t IN ARRAY ARRAY['recurring_migrations','subscription_delegations','subscription_jobs'] LOOP
 EXECUTE format('ALTER TABLE insights_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE insights_private.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON insights_private.%I TO insights_report_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
 CREATE POLICY version_read ON insights_private.recurring_migrations FOR SELECT TO PUBLIC USING(true);
 CREATE POLICY own_schedule ON insights_private.subscription_delegations FOR SELECT TO PUBLIC USING(insights_private.subscription_scope(organisation_id,owner_user_id,false));
 FOR r IN SELECT login_role FROM insights_private.runtime_bindings WHERE mode='RECEIVER' AND status='ACTIVE' AND expires_at>clock_timestamp() LOOP
 EXECUTE format('GRANT SELECT ON insights_private.recurring_migrations,insights_private.subscription_delegations TO %I',r);
 END LOOP;
END $policy$;
CREATE FUNCTION insights_private.subscription_recurring_binding() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE b insights_private.runtime_bindings%ROWTYPE;d jsonb;
BEGIN
 d:=profitia_e1_receiver.recurring_descriptor();
 SELECT * INTO b FROM insights_private.runtime_bindings WHERE login_role=session_user AND mode='RECEIVER' AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND OR insights_private.runtime_descriptor() IS NULL OR d->'binding' IS DISTINCT FROM b.binding
 OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='insights_private' AND c.relname IN('recurring_migrations','subscription_delegations','subscription_jobs') AND c.relowner='insights_report_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity)<>3
 THEN RAISE EXCEPTION 'Private recurring receiver refused' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('organisationId',b.organisation_id,'descriptor',d);
END $fn$;
CREATE FUNCTION insights_private.subscription_recurring_digest(s insights_private.report_subscriptions) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT encode(public.digest(convert_to(s.definition::text,'UTF8'),'sha256'),'hex')
$fn$;
CREATE FUNCTION insights_private.subscription_recurring_command(p_id uuid,p_version bigint,p_enabled boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE b jsonb;s insights_private.report_subscriptions%ROWTYPE;d insights_private.subscription_delegations%ROWTYPE;schedule jsonb;weekday integer;
BEGIN
 b:=insights_private.subscription_recurring_binding();
 SELECT * INTO s FROM insights_private.report_subscriptions WHERE id=p_id AND organisation_id=(b->>'organisationId')::uuid FOR UPDATE;
 IF NOT FOUND OR s.version<>p_version OR s.definition->'schedule'='null'::jsonb OR s.definition->'schedule' IS NULL
 OR p_enabled AND s.status<>'ACTIVE' OR NOT insights_private.subscription_scope(s.organisation_id,s.owner_user_id,true)
 THEN RAISE EXCEPTION 'Current private subscription required' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM insights_private.subscription_delegations WHERE subscription_id=s.id;
 weekday:=(s.definition->'schedule'->>'weekday')::integer;
 schedule:=jsonb_build_object('frequency','WEEKLY','timeZone','Europe/Warsaw','localTime',s.definition->'schedule'->>'localTime',
 'startDate',s.definition->'schedule'->>'startDate','endDate',s.definition->'schedule'->'endDate',
 'weekdays',jsonb_build_array(CASE WHEN weekday=0 THEN 7 ELSE weekday END),'monthDay',NULL,'dstPolicy','NEXT_VALID_MINUTE_EARLIEST_REPEAT');
 RETURN jsonb_build_object('delegationId',coalesce(d.delegation_id,gen_random_uuid()),'organisationId',s.organisation_id,'operation','insights.subscription.execute',
 'resourceId',s.id,'resourceVersion',(s.version+1)::text,'definitionDigest',insights_private.subscription_recurring_digest(s),'schedule',schedule,'enabled',p_enabled);
END $fn$;
CREATE FUNCTION insights_private.subscription_recurring_activate(p_receipt jsonb,p_next timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE b jsonb;p jsonb;s insights_private.report_subscriptions%ROWTYPE;
BEGIN
 b:=insights_private.subscription_recurring_binding();p:=profitia_e1_receiver.recurring_consent_receipt(p_receipt);
 SELECT * INTO s FROM insights_private.report_subscriptions WHERE id=(p->>'resourceId')::uuid AND organisation_id=(b->>'organisationId')::uuid FOR UPDATE;
 IF NOT FOUND OR s.organisation_id::text IS DISTINCT FROM p->>'organisationId' OR s.owner_user_id::text IS DISTINCT FROM p->>'ownerUserId'
 OR s.version+1<>(p->>'resourceVersion')::bigint OR insights_private.subscription_recurring_digest(s) IS DISTINCT FROM p->>'definitionDigest'
 OR p->>'status'='ACTIVE' AND(p_next IS NULL OR p_next<=clock_timestamp() OR s.status<>'ACTIVE')
 OR NOT insights_private.subscription_scope(s.organisation_id,s.owner_user_id,true)
 THEN RAISE EXCEPTION 'Current signed subscription consent required' USING ERRCODE='42501';END IF;
 UPDATE insights_private.report_subscriptions SET next_due_at=p_next,execution_state=CASE WHEN p->>'status'='ACTIVE' THEN 'READY' WHEN status='ENDED' THEN 'ENDED' ELSE 'WAITING_AUTHORIZATION' END WHERE id=s.id RETURNING * INTO s;
 INSERT INTO insights_private.subscription_delegations VALUES(s.id,s.organisation_id,s.owner_user_id,(p->>'delegationId')::uuid,(p->>'version')::bigint,s.version,p->>'definitionDigest',p->>'status',p_next)
 ON CONFLICT(subscription_id) DO UPDATE SET delegation_id=excluded.delegation_id,delegation_version=excluded.delegation_version,resource_version=excluded.resource_version,definition_digest=excluded.definition_digest,status=excluded.status,next_due_at=excluded.next_due_at;
END $fn$;
CREATE FUNCTION insights_private.subscription_recurring_candidates() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE b jsonb;
BEGIN
 b:=insights_private.subscription_recurring_binding();
 RETURN(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM(
 SELECT d.subscription_id AS id,d.resource_version::text AS version,d.next_due_at AS "slotAt"
 FROM insights_private.subscription_delegations d JOIN insights_private.report_subscriptions s ON s.id=d.subscription_id AND s.organisation_id=d.organisation_id AND s.owner_user_id=d.owner_user_id
 WHERE d.organisation_id=(b->>'organisationId')::uuid AND d.status='ACTIVE' AND s.status='ACTIVE' AND s.execution_state='READY' AND s.version=d.resource_version AND d.next_due_at<=clock_timestamp()+interval '3 hours'
 ORDER BY d.next_due_at,d.subscription_id LIMIT 50)x);
END $fn$;
CREATE FUNCTION insights_private.subscription_recurring_claim(p_id uuid,p_version bigint,p_slot timestamptz,p_job uuid,p_lease uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE b jsonb;d insights_private.subscription_delegations%ROWTYPE;s insights_private.report_subscriptions%ROWTYPE;j insights_private.subscription_jobs%ROWTYPE;slot text;
BEGIN
 b:=insights_private.subscription_recurring_binding();
 SELECT * INTO d FROM insights_private.subscription_delegations WHERE subscription_id=p_id AND organisation_id=(b->>'organisationId')::uuid AND resource_version=p_version AND status='ACTIVE' AND next_due_at=p_slot AND next_due_at<=clock_timestamp()+interval '3 hours' FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO s FROM insights_private.report_subscriptions WHERE id=d.subscription_id AND organisation_id=d.organisation_id AND owner_user_id=d.owner_user_id FOR SHARE;
 IF NOT FOUND OR s.status<>'ACTIVE' OR s.execution_state<>'READY' OR s.version<>d.resource_version OR insights_private.subscription_recurring_digest(s)<>d.definition_digest THEN RETURN NULL;END IF;
 slot:=to_char(p_slot AT TIME ZONE 'Europe/Warsaw','YYYY-MM-DD"T"HH24:MI')||'@Europe/Warsaw';
 INSERT INTO insights_private.subscription_jobs(id,subscription_id,organisation_id,owner_user_id,delegation_id,resource_version,definition_digest,slot_at,schedule_slot,lease_id,claimed_at,lease_until,state)
 VALUES(p_job,s.id,s.organisation_id,s.owner_user_id,d.delegation_id,s.version,d.definition_digest,p_slot,slot,p_lease,clock_timestamp(),clock_timestamp()+interval '30 seconds','LEASED') ON CONFLICT DO NOTHING;
 SELECT * INTO j FROM insights_private.subscription_jobs WHERE subscription_id=s.id AND schedule_slot=slot FOR UPDATE;
 IF j.state<>'LEASED' OR j.resource_version<>s.version THEN RETURN NULL;END IF;
 IF j.id<>p_job THEN IF j.lease_until>clock_timestamp() THEN RETURN NULL;END IF;
 UPDATE insights_private.subscription_jobs SET lease_id=p_lease,claimed_at=clock_timestamp(),lease_until=clock_timestamp()+interval '30 seconds' WHERE id=j.id RETURNING * INTO j;END IF;
 RETURN jsonb_build_object('id',j.id,'organisationId',j.organisation_id,'ownerUserId',j.owner_user_id,'delegationId',j.delegation_id,'resourceId',j.subscription_id,'resourceVersion',j.resource_version::text,'definitionDigest',j.definition_digest,'leaseId',j.lease_id,'claimedAt',j.claimed_at,'slotAt',j.slot_at,'scheduleSlot',j.schedule_slot);
END $fn$;
CREATE FUNCTION insights_private.subscription_recurring_read(p_job uuid,p_lease uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE b jsonb;j insights_private.subscription_jobs%ROWTYPE;s insights_private.report_subscriptions%ROWTYPE;p jsonb;
BEGIN
 b:=insights_private.subscription_recurring_binding();
 SELECT * INTO j FROM insights_private.subscription_jobs WHERE id=p_job AND lease_id=p_lease AND lease_until>clock_timestamp() AND organisation_id=(b->>'organisationId')::uuid FOR UPDATE;
 IF NOT FOUND OR j.state<>'LEASED' OR NOT profitia_e1_receiver.recurring_scope(j.organisation_id,j.owner_user_id,j.subscription_id,j.resource_version,'EFFECT')
 THEN RAISE EXCEPTION 'Current private report lease required' USING ERRCODE='42501';END IF;
 p:=profitia_e1_receiver.recurring_accept(nullif(current_setting('profitia.recurring_proof',true),'')::jsonb);
 IF p->'request'->>'resourceId' IS DISTINCT FROM j.id::text OR p->'request'->>'leaseId' IS DISTINCT FROM j.lease_id::text OR p->'request'->>'scheduleSlot' IS DISTINCT FROM j.schedule_slot
 OR (p->'request'->>'slotAt')::timestamptz IS DISTINCT FROM j.slot_at OR(p->'request'->>'claimedAt')::timestamptz IS DISTINCT FROM j.claimed_at
 OR p->'request'->>'definitionDigest' IS DISTINCT FROM j.definition_digest OR p->'request'->>'delegationId' IS DISTINCT FROM j.delegation_id::text
 THEN RAISE EXCEPTION 'Private report job binding refused' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM insights_private.report_subscriptions WHERE id=j.subscription_id AND organisation_id=j.organisation_id AND owner_user_id=j.owner_user_id FOR SHARE;
 IF NOT FOUND OR s.status<>'ACTIVE' OR s.execution_state<>'READY' OR s.version<>j.resource_version OR insights_private.subscription_recurring_digest(s)<>j.definition_digest
 OR NOT EXISTS(SELECT 1 FROM insights_private.subscription_delegations WHERE delegation_id=j.delegation_id AND resource_version=j.resource_version AND status='ACTIVE')
 THEN RAISE EXCEPTION 'Subscription changed or revoked' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('job',to_jsonb(j),'subscription',to_jsonb(s));
END $fn$;
CREATE FUNCTION insights_private.subscription_recurring_intent(p_job uuid,p_lease uuid,p_command jsonb,p_key text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE checked jsonb;j insights_private.subscription_jobs%ROWTYPE;s jsonb;local_date date;period_start date;
BEGIN
 checked:=insights_private.subscription_recurring_read(p_job,p_lease);j:=jsonb_populate_record(NULL::insights_private.subscription_jobs,checked->'job');s:=checked->'subscription';
 local_date:=(j.slot_at AT TIME ZONE 'Europe/Warsaw')::date;period_start:=local_date-((extract(dow FROM local_date)::integer+5)%7)-7;
 IF p_command->>'definitionId' IS DISTINCT FROM s->>'definition_id' OR p_command->>'profileVersion' IS DISTINCT FROM s->>'profile_version'
 OR p_command->'period'->>'fromDate' IS DISTINCT FROM period_start::text OR p_command->'period'->>'throughDate' IS DISTINCT FROM(period_start+6)::text
 OR p_command->>'revision' IS DISTINCT FROM '1' OR p_command->>'allowPartial' IS DISTINCT FROM 'false' OR p_key!~'^[a-f0-9]{64}$'
 OR j.expected_command IS NOT NULL AND(j.expected_command IS DISTINCT FROM p_command OR j.expected_business_key<>p_key)
 THEN RAISE EXCEPTION 'Exact admitted report command required' USING ERRCODE='42501';END IF;
 UPDATE insights_private.subscription_jobs SET expected_command=p_command,expected_business_key=p_key WHERE id=j.id;
 PERFORM set_config('insights.organisation_id',j.organisation_id::text,true);
END $fn$;
CREATE FUNCTION insights_private.subscription_job_scope(p_org text,p_job uuid,p_key text,p_command jsonb,p_document jsonb,p_write boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;checked jsonb;j insights_private.subscription_jobs%ROWTYPE;
BEGIN
 p:=profitia_e1_receiver.recurring_accept(nullif(current_setting('profitia.recurring_proof',true),'')::jsonb);
 IF p->'request'->>'operation' IS DISTINCT FROM 'insights.subscription.execute' THEN RETURN false;END IF;
 checked:=insights_private.subscription_recurring_read((p->'request'->>'resourceId')::uuid,(p->'request'->>'leaseId')::uuid);j:=jsonb_populate_record(NULL::insights_private.subscription_jobs,checked->'job');
 RETURN coalesce(j.organisation_id::text=p_org AND j.expected_business_key=p_key AND(j.expected_command-'asOf')=(p_command-'asOf')
 AND(NOT p_write OR p_job=j.id AND p_document->'author'->>'kind'='SERVICE' AND p_document->'author'->>'actorId'=p->'actor'->>'actorId'),false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END $fn$;
-- Existing HUMAN and organisation-wide producer paths are preserved verbatim.
-- The extra clause admits only the exact producer edition bound to this one
-- current private recurring transaction. It cannot update jobs/artifacts.
ALTER POLICY current_job_read ON insights_private.report_jobs USING(insights_private.scope_allows(organisation_id,id,false) OR insights_private.subscription_job_scope(organisation_id,id,business_key,document->'command',document,false));
ALTER POLICY current_job_insert ON insights_private.report_jobs WITH CHECK(insights_private.scope_allows(organisation_id,id,true) OR insights_private.subscription_job_scope(organisation_id,id,business_key,document->'command',document,true));
CREATE FUNCTION insights_private.subscription_recurring_complete(p_job uuid,p_lease uuid,p_producer uuid,p_decision uuid,p_next timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE checked jsonb;j insights_private.subscription_jobs%ROWTYPE;producer insights_private.report_jobs%ROWTYPE;p jsonb;
BEGIN
 checked:=insights_private.subscription_recurring_read(p_job,p_lease);j:=jsonb_populate_record(NULL::insights_private.subscription_jobs,checked->'job');
 IF p_next IS NOT NULL AND p_next<=j.slot_at THEN RAISE EXCEPTION 'Next report slot required' USING ERRCODE='42501';END IF;
 SELECT * INTO producer FROM insights_private.report_jobs WHERE id=p_producer AND organisation_id=j.organisation_id::text;
 IF NOT FOUND OR producer.business_key<>j.expected_business_key OR((producer.document->'command')-'asOf') IS DISTINCT FROM(j.expected_command-'asOf') THEN RAISE EXCEPTION 'Actual producer edition required' USING ERRCODE='42501';END IF;
 p:=profitia_e1_receiver.recurring_accept(nullif(current_setting('profitia.recurring_proof',true),'')::jsonb);
 INSERT INTO insights_private.subscription_runs(id,subscription_id,organisation_id,owner_user_id,subscription_version,slot_key,producer_job_id,status,executed_by_actor_id,e1_decision_id)
 VALUES(j.id,j.subscription_id,j.organisation_id,j.owner_user_id,j.resource_version,j.schedule_slot,producer.id,'QUEUED',(p->'actor'->>'actorId')::uuid,p_decision);
 UPDATE insights_private.subscription_jobs SET state='QUEUED',producer_job_id=producer.id WHERE id=j.id;
 UPDATE insights_private.subscription_delegations SET next_due_at=p_next WHERE delegation_id=j.delegation_id AND resource_version=j.resource_version;
END $fn$;
REVOKE ALL ON insights_private.recurring_migrations,insights_private.subscription_delegations,insights_private.subscription_jobs FROM PUBLIC;
REVOKE ALL ON FUNCTION insights_private.subscription_recurring_binding(),insights_private.subscription_recurring_digest(insights_private.report_subscriptions),insights_private.subscription_recurring_command(uuid,bigint,boolean),insights_private.subscription_recurring_activate(jsonb,timestamptz),insights_private.subscription_recurring_candidates(),insights_private.subscription_recurring_claim(uuid,bigint,timestamptz,uuid,uuid),insights_private.subscription_recurring_read(uuid,uuid),insights_private.subscription_recurring_intent(uuid,uuid,jsonb,text),insights_private.subscription_job_scope(text,uuid,text,jsonb,jsonb,boolean),insights_private.subscription_recurring_complete(uuid,uuid,uuid,uuid,timestamptz) FROM PUBLIC;
DO $grants$ DECLARE r name;BEGIN FOR r IN SELECT login_role FROM insights_private.runtime_bindings WHERE mode='RECEIVER' AND status='ACTIVE' AND expires_at>clock_timestamp() LOOP
 EXECUTE format('GRANT EXECUTE ON FUNCTION insights_private.subscription_recurring_command(uuid,bigint,boolean),insights_private.subscription_recurring_activate(jsonb,timestamptz),insights_private.subscription_recurring_candidates(),insights_private.subscription_recurring_claim(uuid,bigint,timestamptz,uuid,uuid),insights_private.subscription_recurring_read(uuid,uuid),insights_private.subscription_recurring_intent(uuid,uuid,jsonb,text),insights_private.subscription_job_scope(text,uuid,text,jsonb,jsonb,boolean),insights_private.subscription_recurring_complete(uuid,uuid,uuid,uuid,timestamptz) TO %I',r);
END LOOP;END $grants$;


-- A newly linked subscription may reuse an already published canonical
-- edition. The same durable notice is emitted without another production run.
CREATE FUNCTION insights_private.subscription_linked_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 INSERT INTO insights_private.subscription_events(id,organisation_id,owner_user_id,producer_job_id,event_kind)
 SELECT gen_random_uuid(),NEW.organisation_id,NEW.owner_user_id,NEW.producer_job_id,'REPORT_PUBLISHED'
 FROM insights_private.report_subscriptions s JOIN insights_private.published_editions p ON p.producer_job_id=NEW.producer_job_id AND p.organisation_id=NEW.organisation_id
 WHERE s.id=NEW.subscription_id AND s.organisation_id=NEW.organisation_id AND s.owner_user_id=NEW.owner_user_id AND s.definition->'notifications'->>'assistant'='true'
 ON CONFLICT DO NOTHING;RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION insights_private.subscription_linked_notice() FROM PUBLIC;
CREATE TRIGGER linked_publication_notice AFTER INSERT ON insights_private.subscription_runs FOR EACH ROW EXECUTE FUNCTION insights_private.subscription_linked_notice();
