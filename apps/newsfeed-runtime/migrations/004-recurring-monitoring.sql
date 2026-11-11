-- Private monitoring queue; no source credentials/policies or new identities.
DO $guard$ BEGIN IF current_user<>'newsfeed_development_owner'
 OR to_regprocedure('profitia_e1_receiver.recurring_scope(uuid,uuid,uuid,bigint,text)') IS NULL
 OR NOT EXISTS(SELECT 1 FROM newsfeed.saved_search_migrations WHERE version='1.2.0' AND digest='d818a0868a57ea68c551c4162c4e2f01b0744044d8ac5dfa620d4277cb7d4442')
 THEN RAISE EXCEPTION 'Accepted saved searches and recurring E1 required';END IF;END $guard$;
CREATE TABLE newsfeed.recurring_migrations(version text PRIMARY KEY,digest text NOT NULL CHECK(digest~'^[a-f0-9]{64}$'));
CREATE TABLE newsfeed.monitor_delegations(
 environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,observation_id uuid NOT NULL,
 delegation_id uuid NOT NULL UNIQUE,delegation_version bigint NOT NULL,resource_version bigint NOT NULL,definition_digest text NOT NULL,
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),next_due_at timestamptz,
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,observation_id),
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,observation_id) REFERENCES newsfeed.observations(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE
);
CREATE TABLE newsfeed.monitor_jobs(
 id uuid PRIMARY KEY,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,observation_id uuid NOT NULL,
 delegation_id uuid NOT NULL,resource_version bigint NOT NULL,definition_digest text NOT NULL,
 slot_at timestamptz NOT NULL,schedule_slot text NOT NULL,lease_id uuid NOT NULL,claimed_at timestamptz NOT NULL,lease_until timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN('LEASED','INTENT','SUCCEEDED','UNCERTAIN','CANCELLED')),upstream_started boolean NOT NULL DEFAULT false,error_code text,
 UNIQUE(environment,application_id,organisation_id,owner_user_id,observation_id,schedule_slot),
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,observation_id) REFERENCES newsfeed.observations(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE
);
CREATE INDEX monitoring_due ON newsfeed.monitor_delegations(next_due_at,observation_id) WHERE status='ACTIVE';
DO $policy$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['recurring_migrations','monitor_delegations','monitor_jobs'] LOOP
 EXECUTE format('ALTER TABLE newsfeed.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE newsfeed.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON newsfeed.%I TO newsfeed_development_owner USING(true) WITH CHECK(true)',t);
END LOOP;END $policy$;
CREATE FUNCTION newsfeed.monitoring_binding() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;
BEGIN d:=profitia_e1_receiver.recurring_descriptor();
 IF session_user<>'newsfeed_development_runtime' OR d->'binding'->>'environment' IS DISTINCT FROM 'development'
 OR d->'binding'->>'applicationId' IS DISTINCT FROM 'profitia-newsfeed-api-development'
 OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='newsfeed' AND c.relname IN('recurring_migrations','monitor_delegations','monitor_jobs') AND c.relowner='newsfeed_development_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity)<>3 THEN RAISE EXCEPTION 'Monitoring binding refused' USING ERRCODE='42501';END IF;RETURN d;
END $fn$;
CREATE FUNCTION newsfeed.monitoring_digest(o newsfeed.observations) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT encode(public.digest(convert_to(jsonb_build_object('request',o.filters,'phrases',o.phrases,'schedule',o.schedule,'notifications',o.notifications)::text,'UTF8'),'sha256'),'hex')
$fn$;
CREATE FUNCTION newsfeed.monitoring_command(p_id uuid,p_version bigint,p_enabled boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE o newsfeed.observations%ROWTYPE;d newsfeed.monitor_delegations%ROWTYPE;proof jsonb;
BEGIN
 PERFORM newsfeed.monitoring_binding();proof:=profitia_e1_receiver.accept(nullif(current_setting('profitia.current_e1_proof',true),'')::jsonb);
 SELECT * INTO o FROM newsfeed.observations WHERE id=p_id AND environment='development' AND application_id='profitia-newsfeed-api-development'
 AND organisation_id=(proof->'request'->>'organisationId')::uuid AND owner_user_id=(proof->'actor'->>'userId')::uuid FOR UPDATE;
 IF NOT FOUND OR o.version<>p_version OR o.schedule IS NULL OR p_enabled AND o.status<>'ACTIVE'
 OR NOT profitia_e1_receiver.scope_allows(o.application_id,o.organisation_id,o.owner_user_id,true) THEN RAISE EXCEPTION 'Observation delegation refused' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM newsfeed.monitor_delegations WHERE (environment,application_id,organisation_id,owner_user_id,observation_id)=(o.environment,o.application_id,o.organisation_id,o.owner_user_id,o.id);
 RETURN jsonb_build_object('delegationId',coalesce(d.delegation_id,gen_random_uuid()),'organisationId',o.organisation_id,'operation','newsfeed.monitor.execute',
 'resourceId',o.id,'resourceVersion',(o.version+1)::text,'definitionDigest',newsfeed.monitoring_digest(o),'schedule',o.schedule,'enabled',p_enabled);
END $fn$;
CREATE FUNCTION newsfeed.monitoring_activate(p_receipt jsonb,p_next timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;o newsfeed.observations%ROWTYPE;
BEGIN
 PERFORM newsfeed.monitoring_binding();p:=profitia_e1_receiver.recurring_consent_receipt(p_receipt);
 SELECT * INTO o FROM newsfeed.observations WHERE environment='development' AND application_id=p->>'applicationId' AND organisation_id=(p->>'organisationId')::uuid
 AND owner_user_id=(p->>'ownerUserId')::uuid AND id=(p->>'resourceId')::uuid FOR UPDATE;
 IF NOT FOUND OR o.version+1<>(p->>'resourceVersion')::bigint OR o.schedule IS DISTINCT FROM p->'schedule'
 OR newsfeed.monitoring_digest(o) IS DISTINCT FROM p->>'definitionDigest' OR p->>'status'='ACTIVE' AND(p_next IS NULL OR p_next<=clock_timestamp()) OR NOT profitia_e1_receiver.scope_allows(o.application_id,o.organisation_id,o.owner_user_id,true)
 THEN RAISE EXCEPTION 'Current observation consent required' USING ERRCODE='42501';END IF;
 UPDATE newsfeed.observations SET next_due_at=p_next,monitoring_state=CASE WHEN p->>'status'='ACTIVE' THEN 'ACTIVE' ELSE 'PAUSED' END
 WHERE (environment,application_id,organisation_id,owner_user_id,id)=(o.environment,o.application_id,o.organisation_id,o.owner_user_id,o.id) RETURNING * INTO o;
 INSERT INTO newsfeed.monitor_delegations VALUES(o.environment,o.application_id,o.organisation_id,o.owner_user_id,o.id,(p->>'delegationId')::uuid,(p->>'version')::bigint,o.version,p->>'definitionDigest',p->>'status',o.next_due_at)
 ON CONFLICT(environment,application_id,organisation_id,owner_user_id,observation_id) DO UPDATE SET delegation_id=excluded.delegation_id,delegation_version=excluded.delegation_version,resource_version=excluded.resource_version,definition_digest=excluded.definition_digest,status=excluded.status,next_due_at=excluded.next_due_at;
 RETURN jsonb_build_object('id',o.id,'version',o.version,'monitoringState',o.monitoring_state,'nextDueAt',o.next_due_at);
END $fn$;
CREATE FUNCTION newsfeed.monitoring_candidates() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE stale newsfeed.monitor_jobs%ROWTYPE;
BEGIN
 PERFORM newsfeed.monitoring_binding();
 FOR stale IN SELECT * FROM newsfeed.monitor_jobs WHERE state='INTENT' AND lease_until<=clock_timestamp() FOR UPDATE SKIP LOCKED LOOP
  PERFORM newsfeed.monitoring_uncertain(stale.id,stale.lease_id);
 END LOOP;
 -- IDs and scheduling metadata only. No query, title, phrase or article is
 -- disclosed by this technical scan before current private E1 admission.
 RETURN(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM(
 SELECT d.observation_id AS id,d.resource_version::text AS version,d.next_due_at AS "slotAt"
 FROM newsfeed.monitor_delegations d JOIN newsfeed.observations o ON(o.environment,o.application_id,o.organisation_id,o.owner_user_id,o.id)=(d.environment,d.application_id,d.organisation_id,d.owner_user_id,d.observation_id)
 WHERE d.status='ACTIVE' AND o.status='ACTIVE' AND o.monitoring_state='ACTIVE' AND o.version=d.resource_version AND d.next_due_at<=clock_timestamp()
 ORDER BY d.next_due_at,d.observation_id LIMIT 50)c);
END $fn$;
CREATE FUNCTION newsfeed.monitoring_claim(p_id uuid,p_version bigint,p_slot timestamptz,p_job uuid,p_lease uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d newsfeed.monitor_delegations%ROWTYPE;o newsfeed.observations%ROWTYPE;j newsfeed.monitor_jobs%ROWTYPE;slot text;
BEGIN
 PERFORM newsfeed.monitoring_binding();
 SELECT dd.* INTO d FROM newsfeed.monitor_delegations dd WHERE observation_id=p_id AND resource_version=p_version AND status='ACTIVE' AND next_due_at=p_slot AND next_due_at<=clock_timestamp() FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO o FROM newsfeed.observations WHERE(environment,application_id,organisation_id,owner_user_id,id)=(d.environment,d.application_id,d.organisation_id,d.owner_user_id,d.observation_id) FOR SHARE;
 IF NOT FOUND OR o.version<>d.resource_version OR o.status<>'ACTIVE' OR o.monitoring_state<>'ACTIVE' OR newsfeed.monitoring_digest(o)<>d.definition_digest THEN RETURN NULL;END IF;
 slot:=to_char(p_slot AT TIME ZONE(o.schedule->>'timeZone'),'YYYY-MM-DD"T"HH24:MI')||'@'||(o.schedule->>'timeZone');
 INSERT INTO newsfeed.monitor_jobs(id,environment,application_id,organisation_id,owner_user_id,observation_id,delegation_id,resource_version,definition_digest,slot_at,schedule_slot,lease_id,claimed_at,lease_until,state)
 VALUES(p_job,d.environment,d.application_id,d.organisation_id,d.owner_user_id,d.observation_id,d.delegation_id,d.resource_version,d.definition_digest,p_slot,slot,p_lease,clock_timestamp(),clock_timestamp()+interval '30 seconds','LEASED') ON CONFLICT DO NOTHING;
 SELECT * INTO j FROM newsfeed.monitor_jobs WHERE(environment,application_id,organisation_id,owner_user_id,observation_id,schedule_slot)=(d.environment,d.application_id,d.organisation_id,d.owner_user_id,d.observation_id,slot) FOR UPDATE;
 IF j.state<>'LEASED' OR j.resource_version<>o.version THEN RETURN NULL;END IF;
 IF j.id<>p_job THEN
  IF j.lease_until>clock_timestamp() THEN RETURN NULL;END IF;
  UPDATE newsfeed.monitor_jobs SET lease_id=p_lease,claimed_at=clock_timestamp(),lease_until=clock_timestamp()+interval '30 seconds' WHERE id=j.id RETURNING * INTO j;
 END IF;
 RETURN jsonb_build_object('id',j.id,'organisationId',j.organisation_id,'ownerUserId',j.owner_user_id,'delegationId',j.delegation_id,'resourceId',j.observation_id,'resourceVersion',j.resource_version::text,'definitionDigest',j.definition_digest,'leaseId',j.lease_id,'claimedAt',j.claimed_at,'slotAt',j.slot_at,'scheduleSlot',j.schedule_slot);
END $fn$;
CREATE FUNCTION newsfeed.monitoring_read(p_job uuid,p_lease uuid,p_phase text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE j newsfeed.monitor_jobs%ROWTYPE;o newsfeed.observations%ROWTYPE;p jsonb;
BEGIN
 PERFORM newsfeed.monitoring_binding();SELECT * INTO j FROM newsfeed.monitor_jobs WHERE id=p_job AND lease_id=p_lease AND lease_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND OR NOT profitia_e1_receiver.recurring_scope(j.organisation_id,j.owner_user_id,j.observation_id,j.resource_version,p_phase)
 THEN RAISE EXCEPTION 'Current monitoring lease required' USING ERRCODE='42501';END IF;
 p:=profitia_e1_receiver.recurring_accept(nullif(current_setting('profitia.recurring_proof',true),'')::jsonb);
 IF p->'request'->>'resourceId' IS DISTINCT FROM j.id::text OR p->'request'->>'leaseId' IS DISTINCT FROM j.lease_id::text OR p->'request'->>'scheduleSlot' IS DISTINCT FROM j.schedule_slot
 THEN RAISE EXCEPTION 'Monitoring job binding refused' USING ERRCODE='42501';END IF;
 SELECT * INTO o FROM newsfeed.observations WHERE(environment,application_id,organisation_id,owner_user_id,id)=(j.environment,j.application_id,j.organisation_id,j.owner_user_id,j.observation_id) FOR SHARE;
 IF NOT FOUND OR o.version<>j.resource_version OR o.status<>'ACTIVE' OR o.monitoring_state<>'ACTIVE' OR newsfeed.monitoring_digest(o)<>j.definition_digest
 OR NOT EXISTS(SELECT 1 FROM newsfeed.monitor_delegations d WHERE d.delegation_id=j.delegation_id AND d.status='ACTIVE' AND d.resource_version=j.resource_version)
 THEN RAISE EXCEPTION 'Observation changed or revoked' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('job',to_jsonb(j),'observation',to_jsonb(o));
END $fn$;
CREATE FUNCTION newsfeed.monitoring_intent(p_job uuid,p_lease uuid,p_next timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE checked jsonb;j newsfeed.monitor_jobs%ROWTYPE;o jsonb;p jsonb;
BEGIN
 checked:=newsfeed.monitoring_read(p_job,p_lease,'PREPARE');j:=jsonb_populate_record(NULL::newsfeed.monitor_jobs,checked->'job');o:=checked->'observation';
 IF j.state<>'LEASED' OR p_next IS NOT NULL AND p_next<=j.slot_at THEN RAISE EXCEPTION 'Monitoring intent refused' USING ERRCODE='42501';END IF;
 p:=profitia_e1_receiver.recurring_accept(nullif(current_setting('profitia.recurring_proof',true),'')::jsonb);
 INSERT INTO newsfeed.monitor_runs(id,environment,application_id,organisation_id,owner_user_id,observation_id,actor_id,observation_version,idempotency_digest,request_digest,status,request_snapshot,schedule_slot)
 VALUES(j.id,j.environment,j.application_id,j.organisation_id,j.owner_user_id,j.observation_id,(p->'actor'->>'actorId')::uuid,j.resource_version,encode(public.digest(j.schedule_slot,'sha256'),'hex'),j.definition_digest,'PENDING',jsonb_build_object('version',j.resource_version,'request',o->'filters','phrases',o->'phrases','name',o->'name'),j.schedule_slot);
 UPDATE newsfeed.monitor_jobs SET state='INTENT' WHERE id=j.id;
 UPDATE newsfeed.monitor_delegations SET next_due_at=p_next WHERE delegation_id=j.delegation_id AND resource_version=j.resource_version;
END $fn$;
CREATE FUNCTION newsfeed.monitoring_effect(p_job uuid,p_lease uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE checked jsonb;j newsfeed.monitor_jobs%ROWTYPE;proof jsonb;
BEGIN
 checked:=newsfeed.monitoring_read(p_job,p_lease,'EFFECT');j:=jsonb_populate_record(NULL::newsfeed.monitor_jobs,checked->'job');
 proof:=profitia_e1_receiver.recurring_accept(nullif(current_setting('profitia.recurring_proof',true),'')::jsonb);
 IF proof->'request'->>'sourceResourceId' IS DISTINCT FROM ('api.'||(checked->'observation'->'filters'->>'provider')||'.'||(checked->'observation'->'filters'->>'family'))
 OR j.state<>'INTENT' OR j.upstream_started THEN RAISE EXCEPTION 'Upstream already admitted or uncertain' USING ERRCODE='42501';END IF;
 UPDATE newsfeed.monitor_jobs SET upstream_started=true WHERE id=j.id;
END $fn$;
CREATE FUNCTION newsfeed.monitoring_complete(p_job uuid,p_lease uuid,p_items jsonb,p_detected integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE checked jsonb;j newsfeed.monitor_jobs%ROWTYPE;item jsonb;publication uuid;added integer:=0;linked integer;
BEGIN
 checked:=newsfeed.monitoring_read(p_job,p_lease,'EFFECT');j:=jsonb_populate_record(NULL::newsfeed.monitor_jobs,checked->'job');
 IF j.state<>'INTENT' OR NOT j.upstream_started OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)>500 OR p_detected<0
 THEN RAISE EXCEPTION 'Monitoring completion refused' USING ERRCODE='42501';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF(SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(item) key) IS DISTINCT FROM ARRAY['headline','kind','licenceRef','provider','publishedAt','retrievedAt','sourceRecordRef','url']
  OR item->>'url'!~'^https?://' OR length(item->>'url')>4096 OR coalesce(item->>'kind','') NOT IN('NEWS_ARTICLE','WEB_PAGE')
  OR length(item->>'headline')>2000 OR coalesce(item->>'licenceRef','')='' OR coalesce(item->>'sourceRecordRef','')='' OR (item->>'retrievedAt')::timestamptz IS NULL
  THEN RAISE EXCEPTION 'Permanent metadata projection refused' USING ERRCODE='42501';END IF;
  publication:=NULL;
  INSERT INTO newsfeed.publication_index(id,environment,application_id,organisation_id,owner_user_id,url_fingerprint,url,headline,published_at,provider_id,kind,source_record_ref,licence_ref,retrieved_at)
  VALUES(gen_random_uuid(),j.environment,j.application_id,j.organisation_id,j.owner_user_id,encode(public.digest(item->>'url','sha256'),'hex'),item->>'url',item->>'headline',(item->>'publishedAt')::timestamptz,item->>'provider',item->>'kind',item->>'sourceRecordRef',item->>'licenceRef',(item->>'retrievedAt')::timestamptz)
  ON CONFLICT DO NOTHING RETURNING id INTO publication;
  IF publication IS NULL THEN SELECT id INTO STRICT publication FROM newsfeed.publication_index WHERE(environment,application_id,organisation_id,owner_user_id,url_fingerprint)=(j.environment,j.application_id,j.organisation_id,j.owner_user_id,encode(public.digest(item->>'url','sha256'),'hex'));END IF;
  INSERT INTO newsfeed.search_publications VALUES(j.environment,j.application_id,j.organisation_id,j.owner_user_id,j.observation_id,publication,clock_timestamp()) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS linked=ROW_COUNT;added:=added+linked;
  INSERT INTO newsfeed.run_publications VALUES(j.environment,j.application_id,j.organisation_id,j.owner_user_id,j.id,publication,item) ON CONFLICT DO NOTHING;
  IF linked>0 AND (checked->'observation'->>'notifications')::boolean THEN
   INSERT INTO newsfeed.inbox_events(id,environment,application_id,organisation_id,owner_user_id,observation_id,publication_id,event_kind)
   VALUES(gen_random_uuid(),j.environment,j.application_id,j.organisation_id,j.owner_user_id,j.observation_id,publication,'PUBLICATION_DETECTED') ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 UPDATE newsfeed.monitor_runs SET status='SUCCEEDED',detected_count=p_detected,publication_count=added,completed_at=clock_timestamp()
 WHERE(environment,application_id,organisation_id,owner_user_id,id)=(j.environment,j.application_id,j.organisation_id,j.owner_user_id,j.id) AND status='PENDING';
 UPDATE newsfeed.monitor_jobs SET state='SUCCEEDED' WHERE id=j.id;
 RETURN jsonb_build_object('id',j.id,'status','SUCCEEDED','newPublications',added,'detected',p_detected);
END $fn$;
CREATE FUNCTION newsfeed.monitoring_uncertain(p_job uuid,p_lease uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE j newsfeed.monitor_jobs%ROWTYPE;
BEGIN
 PERFORM newsfeed.monitoring_binding();SELECT * INTO j FROM newsfeed.monitor_jobs WHERE id=p_job AND lease_id=p_lease FOR UPDATE;
 IF NOT FOUND OR j.state NOT IN('LEASED','INTENT') THEN RETURN;END IF;
 -- Metadata-only recovery; cannot read criteria, renew a lease or retry I/O.
 UPDATE newsfeed.monitor_jobs SET state=CASE WHEN j.state='INTENT' THEN 'UNCERTAIN' ELSE 'LEASED' END,lease_until=clock_timestamp(),error_code='EXECUTION_NOT_CONFIRMED' WHERE id=j.id;
 UPDATE newsfeed.monitor_runs SET status='UNCERTAIN',error_code='EXECUTION_NOT_CONFIRMED',completed_at=clock_timestamp()
 WHERE(environment,application_id,organisation_id,owner_user_id,id)=(j.environment,j.application_id,j.organisation_id,j.owner_user_id,j.id) AND status='PENDING';
END $fn$;
REVOKE ALL ON newsfeed.recurring_migrations,newsfeed.monitor_delegations,newsfeed.monitor_jobs FROM PUBLIC;
REVOKE ALL ON FUNCTION newsfeed.monitoring_binding(),newsfeed.monitoring_digest(newsfeed.observations),newsfeed.monitoring_command(uuid,bigint,boolean),newsfeed.monitoring_activate(jsonb,timestamptz),newsfeed.monitoring_candidates(),newsfeed.monitoring_claim(uuid,bigint,timestamptz,uuid,uuid),newsfeed.monitoring_read(uuid,uuid,text),newsfeed.monitoring_intent(uuid,uuid,timestamptz),newsfeed.monitoring_effect(uuid,uuid),newsfeed.monitoring_complete(uuid,uuid,jsonb,integer),newsfeed.monitoring_uncertain(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION newsfeed.monitoring_command(uuid,bigint,boolean),newsfeed.monitoring_activate(jsonb,timestamptz),newsfeed.monitoring_candidates(),newsfeed.monitoring_claim(uuid,bigint,timestamptz,uuid,uuid),newsfeed.monitoring_read(uuid,uuid,text),newsfeed.monitoring_intent(uuid,uuid,timestamptz),newsfeed.monitoring_effect(uuid,uuid),newsfeed.monitoring_complete(uuid,uuid,jsonb,integer),newsfeed.monitoring_uncertain(uuid,uuid) TO newsfeed_development_runtime;
GRANT SELECT ON newsfeed.recurring_migrations TO newsfeed_development_runtime;
CREATE POLICY migration_read ON newsfeed.recurring_migrations FOR SELECT TO newsfeed_development_runtime USING(true);

