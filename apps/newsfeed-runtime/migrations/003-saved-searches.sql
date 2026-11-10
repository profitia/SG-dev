-- Additive Newsfeed1.2. No change to provider licences or Source retention.
-- Installed by the existing domain owner after current-E1 SQL002.
ALTER TABLE newsfeed.observations ADD COLUMN phrases jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(phrases)='array' AND jsonb_array_length(phrases)<=20);
ALTER TABLE newsfeed.observations ADD COLUMN schedule jsonb CHECK(schedule IS NULL OR jsonb_typeof(schedule)='object');
ALTER TABLE newsfeed.observations ADD COLUMN notifications boolean NOT NULL DEFAULT false;
ALTER TABLE newsfeed.observations ADD COLUMN next_due_at timestamptz;
ALTER TABLE newsfeed.observations ADD COLUMN monitoring_state text NOT NULL DEFAULT 'MANUAL' CHECK(monitoring_state IN('MANUAL','WAITING_AUTHORIZATION','ACTIVE','PAUSED','ENDED','ERROR'));
ALTER TABLE newsfeed.monitor_runs ADD COLUMN request_snapshot jsonb;
ALTER TABLE newsfeed.monitor_runs ADD COLUMN schedule_slot text;
CREATE UNIQUE INDEX monitoring_slot_once ON newsfeed.monitor_runs(environment,application_id,organisation_id,owner_user_id,observation_id,schedule_slot) WHERE schedule_slot IS NOT NULL;

CREATE TABLE newsfeed.saved_search_migrations(version text PRIMARY KEY,digest text NOT NULL CHECK(digest~'^[a-f0-9]{64}$'),installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE newsfeed.observation_versions(
 environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,observation_id uuid NOT NULL,version bigint NOT NULL,
 definition jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,observation_id,version),
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,observation_id) REFERENCES newsfeed.observations(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE
);
CREATE FUNCTION newsfeed.snapshot_observation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,newsfeed AS $fn$
BEGIN
 INSERT INTO newsfeed.observation_versions(environment,application_id,organisation_id,owner_user_id,observation_id,version,definition)
 VALUES(NEW.environment,NEW.application_id,NEW.organisation_id,NEW.owner_user_id,NEW.id,NEW.version,
 jsonb_build_object('name',NEW.name,'subjectKind',NEW.subject_kind,'subject',NEW.subject,'request',NEW.filters,'phrases',NEW.phrases,'schedule',NEW.schedule,'notifications',NEW.notifications,'status',NEW.status));
 RETURN NEW;
END $fn$;
CREATE TRIGGER observation_snapshot AFTER INSERT OR UPDATE ON newsfeed.observations FOR EACH ROW EXECUTE FUNCTION newsfeed.snapshot_observation();
INSERT INTO newsfeed.observation_versions(environment,application_id,organisation_id,owner_user_id,observation_id,version,definition)
 SELECT environment,application_id,organisation_id,owner_user_id,id,version,jsonb_build_object('name',name,'subjectKind',subject_kind,'subject',subject,'request',filters,'phrases',phrases,'schedule',schedule,'notifications',notifications,'status',status,'historyBeforeMigration','UNKNOWN') FROM newsfeed.observations;

-- Only the permitted permanent metadata index; never raw payloads, snippets,
-- article bodies or an artificial extension of the provider retentionUntil.
CREATE TABLE newsfeed.publication_index(
 id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 url_fingerprint text NOT NULL CHECK(url_fingerprint~'^[a-f0-9]{64}$'),url text NOT NULL CHECK(url~'^https?://'),headline text CHECK(length(headline)<=2000),
 published_at timestamptz,provider_id text NOT NULL,kind text NOT NULL CHECK(kind IN('NEWS_ARTICLE','WEB_PAGE')),
 source_record_ref text NOT NULL,licence_ref text NOT NULL,retrieved_at timestamptz NOT NULL,
 first_detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,id),UNIQUE(environment,application_id,organisation_id,owner_user_id,url_fingerprint)
);
CREATE TABLE newsfeed.search_publications(
 environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,observation_id uuid NOT NULL,publication_id uuid NOT NULL,
 detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,observation_id,publication_id),
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,observation_id) REFERENCES newsfeed.observations(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,publication_id) REFERENCES newsfeed.publication_index(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE
);
CREATE TABLE newsfeed.run_publications(
 environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,run_id uuid NOT NULL,publication_id uuid NOT NULL,
 metadata_snapshot jsonb NOT NULL CHECK(octet_length(metadata_snapshot::text)<=8192),
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,run_id,publication_id),
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,run_id) REFERENCES newsfeed.monitor_runs(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,publication_id) REFERENCES newsfeed.publication_index(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE
);
CREATE TABLE newsfeed.inbox_events(
 id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 observation_id uuid NOT NULL,publication_id uuid NOT NULL,event_kind text NOT NULL CHECK(event_kind='PUBLICATION_DETECTED'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),read_at timestamptz,
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,id),UNIQUE(environment,application_id,organisation_id,owner_user_id,observation_id,publication_id,event_kind),
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,observation_id) REFERENCES newsfeed.observations(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,publication_id) REFERENCES newsfeed.publication_index(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE
);
CREATE INDEX publication_index_date ON newsfeed.publication_index(environment,application_id,organisation_id,owner_user_id,published_at,id);
CREATE INDEX saved_search_due ON newsfeed.observations(next_due_at,id) WHERE monitoring_state='ACTIVE' AND status='ACTIVE';
CREATE INDEX inbox_unread ON newsfeed.inbox_events(environment,application_id,organisation_id,owner_user_id,created_at DESC,id DESC);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['observation_versions','publication_index','search_publications','run_publications','inbox_events'] LOOP
  EXECUTE format('ALTER TABLE newsfeed.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE newsfeed.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY schema_owner ON newsfeed.%I TO __OWNER_ROLE__ USING(true) WITH CHECK(true)',t);
  EXECUTE format($p$CREATE POLICY private_scope ON newsfeed.%I TO __RUNTIME_ROLE__ USING(
   environment=current_setting('profitia.environment',true) AND application_id=current_setting('profitia.application_id',true)
   AND organisation_id::text=current_setting('profitia.organisation_id',true) AND owner_user_id::text=current_setting('profitia.user_id',true)
   AND environment=(SELECT i.environment FROM newsfeed.installation i WHERE i.singleton) AND application_id=(SELECT i.application_id FROM newsfeed.installation i WHERE i.singleton)
  ) WITH CHECK(environment=current_setting('profitia.environment',true) AND application_id=current_setting('profitia.application_id',true)
   AND organisation_id::text=current_setting('profitia.organisation_id',true) AND owner_user_id::text=current_setting('profitia.user_id',true)
   AND environment=(SELECT i.environment FROM newsfeed.installation i WHERE i.singleton) AND application_id=(SELECT i.application_id FROM newsfeed.installation i WHERE i.singleton))$p$,t);
  EXECUTE format('CREATE POLICY current_e1_select ON newsfeed.%I AS RESTRICTIVE FOR SELECT TO __RUNTIME_ROLE__ USING(profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,false))',t);
  EXECUTE format('CREATE POLICY current_e1_insert ON newsfeed.%I AS RESTRICTIVE FOR INSERT TO __RUNTIME_ROLE__ WITH CHECK(profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,true))',t);
  EXECUTE format('CREATE POLICY current_e1_update ON newsfeed.%I AS RESTRICTIVE FOR UPDATE TO __RUNTIME_ROLE__ USING(profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,true)) WITH CHECK(profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,true))',t);
  EXECUTE format('CREATE POLICY current_e1_delete ON newsfeed.%I AS RESTRICTIVE FOR DELETE TO __RUNTIME_ROLE__ USING(profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,true))',t);
 END LOOP;
END $policies$;
REVOKE ALL ON FUNCTION newsfeed.snapshot_observation() FROM PUBLIC;
GRANT SELECT ON newsfeed.saved_search_migrations TO __RUNTIME_ROLE__;
GRANT SELECT ON newsfeed.observation_versions TO __RUNTIME_ROLE__;
GRANT SELECT,INSERT ON newsfeed.publication_index,newsfeed.search_publications,newsfeed.run_publications TO __RUNTIME_ROLE__;
GRANT SELECT,INSERT,UPDATE ON newsfeed.inbox_events TO __RUNTIME_ROLE__;
REVOKE INSERT,UPDATE,DELETE ON newsfeed.observation_versions FROM __RUNTIME_ROLE__;
REVOKE UPDATE,DELETE ON newsfeed.publication_index,newsfeed.search_publications,newsfeed.run_publications FROM __RUNTIME_ROLE__;

-- Sharing is a fixed domain projection. Private table RLS and the actor's
-- current E1 scope remain unchanged. A shared reader never impersonates the
-- owner, edits the definition, discovers data or obtains a provider credential.
CREATE TABLE newsfeed.observation_shares(
 id uuid PRIMARY KEY,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 observation_id uuid NOT NULL,access_kind text NOT NULL CHECK(access_kind IN('USER','ORG')),
 recipient_user_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(access_kind='USER' AND recipient_user_id IS NOT NULL AND recipient_user_id<>owner_user_id OR access_kind='ORG' AND recipient_user_id IS NULL),
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,observation_id) REFERENCES newsfeed.observations(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX share_resource_recipient ON newsfeed.observation_shares(observation_id,access_kind,coalesce(recipient_user_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE TABLE newsfeed.share_invitations(
 id uuid PRIMARY KEY,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,observation_id uuid NOT NULL,
 token_digest text NOT NULL UNIQUE CHECK(token_digest~'^[a-f0-9]{64}$'),expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 claimed_by_user_id uuid,claimed_at timestamptz,
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,observation_id) REFERENCES newsfeed.observations(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE,
 CHECK((claimed_by_user_id IS NULL)=(claimed_at IS NULL))
);
DO $shares$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['observation_shares','share_invitations'] LOOP
  EXECUTE format('ALTER TABLE newsfeed.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE newsfeed.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY schema_owner ON newsfeed.%I TO __OWNER_ROLE__ USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY own_read ON newsfeed.%I FOR SELECT TO __RUNTIME_ROLE__ USING(profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,false))',t);
  EXECUTE format('CREATE POLICY own_insert ON newsfeed.%I FOR INSERT TO __RUNTIME_ROLE__ WITH CHECK(profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,true))',t);
  EXECUTE format('CREATE POLICY own_delete ON newsfeed.%I FOR DELETE TO __RUNTIME_ROLE__ USING(profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,true))',t);
 END LOOP;
END $shares$;
GRANT SELECT,INSERT,DELETE ON newsfeed.observation_shares,newsfeed.share_invitations TO __RUNTIME_ROLE__;

CREATE FUNCTION newsfeed.shared_actor(p_write boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE actor uuid;org uuid;app text;env text;i newsfeed.installation%ROWTYPE;
BEGIN
 IF session_user<>'__RUNTIME_ROLE__' THEN RAISE EXCEPTION 'Sharing scope refused' USING ERRCODE='42501'; END IF;
 actor:=nullif(current_setting('profitia.user_id',true),'')::uuid;org:=nullif(current_setting('profitia.organisation_id',true),'')::uuid;
 app:=current_setting('profitia.application_id',true);env:=current_setting('profitia.environment',true);
 SELECT * INTO STRICT i FROM newsfeed.installation WHERE singleton;
 IF actor IS NULL OR org IS NULL OR env IS DISTINCT FROM i.environment OR app IS DISTINCT FROM i.application_id
 OR NOT profitia_e1_receiver.scope_allows(app,org,actor,p_write) THEN RAISE EXCEPTION 'Sharing scope refused' USING ERRCODE='42501'; END IF;
 RETURN actor;
END $fn$;
CREATE FUNCTION newsfeed.claim_invitation(p_digest text,p_share_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE actor uuid;v newsfeed.share_invitations%ROWTYPE;
BEGIN
 actor:=newsfeed.shared_actor(true);
 SELECT * INTO v FROM newsfeed.share_invitations WHERE token_digest=p_digest
 AND environment=current_setting('profitia.environment',true) AND application_id=current_setting('profitia.application_id',true)
 AND organisation_id::text=current_setting('profitia.organisation_id',true) FOR UPDATE;
 IF NOT FOUND OR v.owner_user_id=actor OR v.expires_at<=clock_timestamp() OR v.claimed_by_user_id IS NOT NULL
 THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='PT404'; END IF;
 -- The recipient is taken only from the freshly verified E1 actor. No
 -- directory copy, caller-supplied recipient ID or artificial membership.
 INSERT INTO newsfeed.observation_shares(id,environment,application_id,organisation_id,owner_user_id,observation_id,access_kind,recipient_user_id)
 VALUES(p_share_id,v.environment,v.application_id,v.organisation_id,v.owner_user_id,v.observation_id,'USER',actor) ON CONFLICT DO NOTHING;
 UPDATE newsfeed.share_invitations SET claimed_by_user_id=actor,claimed_at=clock_timestamp() WHERE id=v.id;
 RETURN v.observation_id;
END $fn$;
CREATE FUNCTION newsfeed.read_shared(p_id uuid,p_kind text,p_limit integer DEFAULT 50,p_after timestamptz DEFAULT NULL,p_after_id uuid DEFAULT NULL,p_run uuid DEFAULT NULL,p_query text DEFAULT '',p_access text DEFAULT 'shared',p_publication uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE actor uuid;v newsfeed.observations%ROWTYPE;g newsfeed.observation_shares%ROWTYPE;answer jsonb;
BEGIN
 actor:=newsfeed.shared_actor(false);
 IF p_kind NOT IN('feed','list','observation','history','publications','statistics') OR p_limit NOT BETWEEN 1 AND 101
 OR p_access NOT IN('shared','organisation') OR length(p_query)>200 OR (p_after IS NULL)<>(p_after_id IS NULL)
 THEN RAISE EXCEPTION 'Invalid shared query' USING ERRCODE='22023'; END IF;
 IF p_kind='feed' THEN
  -- Lock applicable read grants before the fresh projection; a concurrent
  -- revocation either completes first and disappears or waits for this read.
  PERFORM 1 FROM newsfeed.observation_shares WHERE environment=current_setting('profitia.environment',true)
  AND application_id=current_setting('profitia.application_id',true) AND organisation_id::text=current_setting('profitia.organisation_id',true)
  AND (access_kind='ORG' OR recipient_user_id=actor) FOR SHARE;
  WITH eligible AS(
   SELECT o.* FROM newsfeed.observations o WHERE o.environment=current_setting('profitia.environment',true)
   AND o.application_id=current_setting('profitia.application_id',true) AND o.organisation_id::text=current_setting('profitia.organisation_id',true)
   AND (o.owner_user_id=actor OR EXISTS(SELECT 1 FROM newsfeed.observation_shares s WHERE(s.environment,s.application_id,s.organisation_id,s.owner_user_id,s.observation_id)=(o.environment,o.application_id,o.organisation_id,o.owner_user_id,o.id) AND(s.access_kind='ORG' OR s.recipient_user_id=actor)))
  ),visible AS(
   SELECT p.id,p.environment,p.application_id,p.organisation_id,p.owner_user_id,max(l.detected_at) AS detected_at
   FROM eligible o JOIN newsfeed.search_publications l ON(l.environment,l.application_id,l.organisation_id,l.owner_user_id,l.observation_id)=(o.environment,o.application_id,o.organisation_id,o.owner_user_id,o.id)
   JOIN newsfeed.publication_index p ON(p.environment,p.application_id,p.organisation_id,p.owner_user_id,p.id)=(l.environment,l.application_id,l.organisation_id,l.owner_user_id,l.publication_id)
   WHERE p_query='' OR strpos(lower(coalesce(p.headline,'')),lower(p_query))>0
   GROUP BY p.id,p.environment,p.application_id,p.organisation_id,p.owner_user_id
  ),selected AS(
   SELECT * FROM visible WHERE p_after IS NULL OR(detected_at,id)<(p_after,p_after_id) ORDER BY detected_at DESC,id DESC LIMIT p_limit
  )SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO answer FROM(
   SELECT p.*,feed_row.detected_at,(SELECT jsonb_agg(to_jsonb(t)) FROM(SELECT o.id,o.name FROM eligible o JOIN newsfeed.search_publications l ON(l.environment,l.application_id,l.organisation_id,l.owner_user_id,l.observation_id)=(o.environment,o.application_id,o.organisation_id,o.owner_user_id,o.id) WHERE(l.environment,l.application_id,l.organisation_id,l.owner_user_id,l.publication_id)=(p.environment,p.application_id,p.organisation_id,p.owner_user_id,p.id) ORDER BY o.name,o.id LIMIT 5)t) AS topics
   FROM selected feed_row JOIN newsfeed.publication_index p ON(p.environment,p.application_id,p.organisation_id,p.owner_user_id,p.id)=(feed_row.environment,feed_row.application_id,feed_row.organisation_id,feed_row.owner_user_id,feed_row.id)
   ORDER BY feed_row.detected_at DESC,p.id DESC
  )x;RETURN answer;
 END IF;
 IF p_kind='list' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]'::jsonb) INTO answer FROM(
   SELECT x.* FROM newsfeed.observations x WHERE x.environment=current_setting('profitia.environment',true)
   AND x.application_id=current_setting('profitia.application_id',true) AND x.organisation_id::text=current_setting('profitia.organisation_id',true)
   AND x.owner_user_id<>actor AND (p_after IS NULL OR (x.updated_at,x.id)<(p_after,p_after_id))
   AND EXISTS(SELECT 1 FROM newsfeed.observation_shares s WHERE s.observation_id=x.id AND s.organisation_id=x.organisation_id
    AND s.environment=x.environment AND s.application_id=x.application_id AND s.owner_user_id=x.owner_user_id
    AND (s.access_kind='ORG' AND p_access='organisation' OR s.access_kind='USER' AND s.recipient_user_id=actor AND p_access='shared'))
   ORDER BY x.updated_at DESC,x.id DESC LIMIT p_limit
  )o;RETURN answer;
 END IF;
 SELECT * INTO v FROM newsfeed.observations WHERE id=p_id AND environment=current_setting('profitia.environment',true)
 AND application_id=current_setting('profitia.application_id',true) AND organisation_id::text=current_setting('profitia.organisation_id',true) AND owner_user_id<>actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Observation unavailable' USING ERRCODE='PT404'; END IF;
 SELECT * INTO g FROM newsfeed.observation_shares WHERE observation_id=v.id AND environment=v.environment AND application_id=v.application_id
 AND organisation_id=v.organisation_id AND owner_user_id=v.owner_user_id AND (access_kind='ORG' OR access_kind='USER' AND recipient_user_id=actor)
 ORDER BY access_kind LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Observation unavailable' USING ERRCODE='PT404'; END IF;
 -- Resource and ACL locks linearize every read before concurrent revocation.
 IF p_kind='observation' THEN RETURN to_jsonb(v); END IF;
 IF p_kind='history' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO answer FROM(
   SELECT x.* FROM newsfeed.monitor_runs x WHERE x.environment=v.environment AND x.application_id=v.application_id
   AND x.organisation_id=v.organisation_id AND x.owner_user_id=v.owner_user_id AND x.observation_id=v.id
   AND (p_after IS NULL OR (x.created_at,x.id)<(p_after,p_after_id)) ORDER BY x.created_at DESC,x.id DESC LIMIT p_limit
  )r;RETURN answer;
 END IF;
 IF p_run IS NOT NULL AND NOT EXISTS(SELECT 1 FROM newsfeed.monitor_runs WHERE id=p_run AND observation_id=v.id AND environment=v.environment
 AND application_id=v.application_id AND organisation_id=v.organisation_id AND owner_user_id=v.owner_user_id)
 THEN RAISE EXCEPTION 'Run unavailable' USING ERRCODE='PT404'; END IF;
 IF p_kind='statistics' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'headline',p.headline,'publishedAt',p.published_at,'detectedAt',l.detected_at)),'[]'::jsonb)
  INTO answer FROM newsfeed.search_publications l JOIN newsfeed.publication_index p ON (p.environment,p.application_id,p.organisation_id,p.owner_user_id,p.id)=(l.environment,l.application_id,l.organisation_id,l.owner_user_id,l.publication_id)
  WHERE (l.environment,l.application_id,l.organisation_id,l.owner_user_id,l.observation_id)=(v.environment,v.application_id,v.organisation_id,v.owner_user_id,v.id);
  RETURN answer;
 END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO answer FROM(
  SELECT p.*,l.detected_at,rp.metadata_snapshot FROM newsfeed.search_publications l
  JOIN newsfeed.publication_index p ON (p.environment,p.application_id,p.organisation_id,p.owner_user_id,p.id)=(l.environment,l.application_id,l.organisation_id,l.owner_user_id,l.publication_id)
  LEFT JOIN newsfeed.run_publications rp ON p_run IS NOT NULL AND (rp.environment,rp.application_id,rp.organisation_id,rp.owner_user_id,rp.publication_id,rp.run_id)=(p.environment,p.application_id,p.organisation_id,p.owner_user_id,p.id,p_run)
  WHERE (l.environment,l.application_id,l.organisation_id,l.owner_user_id,l.observation_id)=(v.environment,v.application_id,v.organisation_id,v.owner_user_id,v.id)
  AND (p_run IS NULL OR rp.run_id IS NOT NULL) AND (p_publication IS NULL OR p.id=p_publication) AND (p_after IS NULL OR (l.detected_at,p.id)<(p_after,p_after_id))
  AND (p_query='' OR strpos(lower(coalesce(CASE WHEN p_run IS NULL THEN p.headline ELSE rp.metadata_snapshot->>'headline' END,'')),lower(p_query))>0)
  ORDER BY l.detected_at DESC,p.id DESC LIMIT p_limit
 )x;RETURN answer;
END $fn$;
REVOKE ALL ON FUNCTION newsfeed.shared_actor(boolean),newsfeed.claim_invitation(text,uuid),newsfeed.read_shared(uuid,text,integer,timestamptz,uuid,uuid,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION newsfeed.claim_invitation(text,uuid),newsfeed.read_shared(uuid,text,integer,timestamptz,uuid,uuid,text,text,uuid) TO __RUNTIME_ROLE__;
