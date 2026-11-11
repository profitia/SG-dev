-- Product data only. This migration does not install Identity/E1 grants.
-- Applied transactionally by the separately held migrator, explicitly SET ROLE.
DO $$ BEGIN
 IF current_database()<>'platform_knowledge' OR current_user<>'platform_knowledge_owner'
 THEN RAISE EXCEPTION 'PK_MIGRATION_BINDING_REJECTED'; END IF;
END $$;
CREATE TABLE platform_knowledge.schema_version(version integer PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE platform_knowledge.account_state(
 user_id text PRIMARY KEY, deleted_at timestamptz, lifecycle_event_id text UNIQUE,
 memory_enabled boolean NOT NULL DEFAULT false, consent_version text, consent_at timestamptz,
 CHECK (NOT memory_enabled OR consent_at IS NOT NULL)
);
CREATE TABLE platform_knowledge.sources(
 id uuid PRIMARY KEY, environment text NOT NULL DEFAULT 'development' CHECK(environment='development'),
 scope text NOT NULL CHECK(scope IN ('PROFITIA_SHARED','ACCOUNT_PRIVATE')),
 owner_user_id text, owner_organisation_id text CHECK(owner_organisation_id IS NULL),
 uploaded_by text NOT NULL, request_id text NOT NULL, file_name text NOT NULL,
 media_type text NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 52428800),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), source_version integer NOT NULL DEFAULT 1,
 rights jsonb NOT NULL CHECK(jsonb_typeof(rights)='object'), metadata jsonb NOT NULL DEFAULT '{}',
 authority text NOT NULL DEFAULT 'REFERENCE' CHECK(authority IN ('BINDING_STANDARD','REFERENCE','HISTORICAL','WITHDRAWN')),
 status text NOT NULL DEFAULT 'CURRENT' CHECK(status IN ('CURRENT','REFERENCE','HISTORICAL','WITHDRAWN')),
 published_at timestamptz, published_by text, revoked_at timestamptz, deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz, rights_expires_at timestamptz, last_material_use_at timestamptz,
 raw_key text UNIQUE, raw_expires_at timestamptz NOT NULL, raw_deleted_at timestamptz,
 active_generation_id uuid, revision bigint NOT NULL DEFAULT 1,
 CHECK((scope='ACCOUNT_PRIVATE' AND owner_user_id IS NOT NULL AND published_at IS NULL)
   OR(scope='PROFITIA_SHARED' AND owner_user_id IS NULL)),
 CHECK(rights ?& ARRAY['classification','purpose','organisationConstraintId','externalAiAllowed','quotingAllowed','apiExcerptAllowed']),
 CHECK(rights->>'classification' IN ('UNKNOWN','PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED')),
 CHECK(rights->>'purpose' IN ('PRIVATE','PROFITIA_INTERNAL','CUSTOMER_SERVICE')),
 CHECK(jsonb_typeof(rights->'organisationConstraintId') IN ('null','string')),
 CHECK(jsonb_typeof(rights->'externalAiAllowed')='boolean' AND jsonb_typeof(rights->'quotingAllowed')='boolean' AND jsonb_typeof(rights->'apiExcerptAllowed')='boolean'),
 CHECK(raw_expires_at<=created_at+interval '24 hours'),
 UNIQUE(uploaded_by,request_id)
);
CREATE TABLE platform_knowledge.generations(
 id uuid PRIMARY KEY, source_id uuid NOT NULL REFERENCES platform_knowledge.sources(id),
 state text NOT NULL DEFAULT 'BUILDING' CHECK(state IN ('BUILDING','VERIFIED','ACTIVE','RETIRED','FAILED')),
 parser_version text NOT NULL, chunker_version text NOT NULL, cognitive_model text NOT NULL,
 embedding_model text NOT NULL, embedding_dimensions integer NOT NULL CHECK(embedding_dimensions=1536),
 config_digest text NOT NULL, source_digest text, inventory jsonb, coverage jsonb,
 character_count integer, chunk_count integer, validation jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), verified_at timestamptz,
 UNIQUE(id,source_id)
);
ALTER TABLE platform_knowledge.sources ADD CONSTRAINT active_generation_source
 FOREIGN KEY(active_generation_id,id) REFERENCES platform_knowledge.generations(id,source_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE platform_knowledge.chunks(
 id uuid PRIMARY KEY, generation_id uuid NOT NULL REFERENCES platform_knowledge.generations(id),
 ordinal integer NOT NULL, start_offset integer NOT NULL CHECK(start_offset>=0), end_offset integer NOT NULL,
 text_content text NOT NULL, sha256 text NOT NULL, token_count integer NOT NULL,
 locations jsonb NOT NULL, identifiers text[] NOT NULL DEFAULT '{}',
 embedding public.vector(1536), search_text tsvector GENERATED ALWAYS AS(to_tsvector('simple'::regconfig,text_content)) STORED,
 CHECK(end_offset>start_offset AND char_length(text_content)=end_offset-start_offset),
 UNIQUE(generation_id,ordinal), UNIQUE(generation_id,start_offset)
);
CREATE INDEX chunks_lexical ON platform_knowledge.chunks USING gin(search_text);
CREATE INDEX chunks_identifiers ON platform_knowledge.chunks USING gin(identifiers);
-- Exact vector search deliberately starts without ANN: tiny corpus, deterministic
-- pre-filtered access scope and no cross-scope approximate-candidate leakage.
CREATE TABLE platform_knowledge.cognition(
 generation_id uuid NOT NULL REFERENCES platform_knowledge.generations(id), ordinal integer NOT NULL,
 chunk_ids uuid[] NOT NULL, analysis jsonb NOT NULL, complete boolean NOT NULL,
 PRIMARY KEY(generation_id,ordinal)
);
CREATE TABLE platform_knowledge.jobs(
 id uuid PRIMARY KEY, source_id uuid NOT NULL REFERENCES platform_knowledge.sources(id),
 generation_id uuid NOT NULL REFERENCES platform_knowledge.generations(id),
 kind text NOT NULL CHECK(kind IN ('IMPORT','REINDEX','PURGE')),
 status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','RUNNING','RETRY_WAIT','READY','PARTIAL','FAILED','CANCELLED','REVOKED')),
 stage text NOT NULL DEFAULT 'EXTRACT', attempt integer NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 3),
 fence bigint NOT NULL DEFAULT 0, lease_owner text, lease_until timestamptz, heartbeat_at timestamptz,
 available_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 deadline_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '30 minutes', finished_at timestamptz,
 delegation jsonb NOT NULL, checkpoint jsonb NOT NULL DEFAULT '{}', error_code text,
 UNIQUE(generation_id,kind)
);
CREATE INDEX jobs_pending ON platform_knowledge.jobs(status,available_at);
CREATE TABLE platform_knowledge.provider_calls(
 id uuid PRIMARY KEY, source_id uuid NOT NULL REFERENCES platform_knowledge.sources(id),
 generation_id uuid REFERENCES platform_knowledge.generations(id),
 call_key text NOT NULL UNIQUE, stage_key text NOT NULL, reserved_by name NOT NULL DEFAULT current_user,
 kind text NOT NULL CHECK(kind IN ('COGNITIVE','EMBEDDING','QUERY_EMBEDDING','SUMMARY')),
 model text NOT NULL, state text NOT NULL CHECK(state IN ('RESERVED','SUCCEEDED','FAILED_BEFORE_SEND','UNKNOWN')),
 reserved_microusd bigint NOT NULL CHECK(reserved_microusd>0), spent_microusd bigint NOT NULL DEFAULT 0 CHECK(spent_microusd>=0),
 input_tokens integer, output_tokens integer, response_id text, result jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), finished_at timestamptz
);
CREATE INDEX provider_calls_source ON platform_knowledge.provider_calls(source_id);
CREATE TABLE platform_knowledge.budget(
 id boolean PRIMARY KEY DEFAULT true CHECK(id), ceiling_microusd bigint NOT NULL CHECK(ceiling_microusd BETWEEN 1 AND 10000000),
 spent_microusd bigint NOT NULL DEFAULT 0, reserved_microusd bigint NOT NULL DEFAULT 0,
 CHECK(spent_microusd>=0 AND reserved_microusd>=0)
);
INSERT INTO platform_knowledge.budget(id,ceiling_microusd) VALUES(true,10000000);
CREATE TABLE platform_knowledge.audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, source_id uuid, job_id uuid,
 operation text NOT NULL, actor_ref text NOT NULL, outcome text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), technical jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE platform_knowledge.lifecycle_receipts(
 event_id text PRIMARY KEY, user_id text NOT NULL, status text NOT NULL CHECK(status IN ('ACCEPTED','PURGING','COMPLETED')),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz
);
CREATE FUNCTION platform_knowledge.source_visible(s platform_knowledge.sources) RETURNS boolean
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT s.deleted_at IS NULL AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>statement_timestamp())
 AND coalesce(nullif(current_setting('pk.allowed_scopes',true),''),'[]')::jsonb ? s.scope
 AND NOT EXISTS(SELECT 1 FROM platform_knowledge.account_state a WHERE a.user_id=s.owner_user_id AND a.deleted_at IS NOT NULL)
 AND ((s.scope='ACCOUNT_PRIVATE' AND s.owner_user_id=nullif(current_setting('pk.user_id',true),''))
   OR(s.scope='PROFITIA_SHARED' AND (s.published_at IS NOT NULL AND current_setting('pk.shared_read',true)='true'
       OR current_setting('pk.operator',true)='true')))
 AND (s.rights->>'organisationConstraintId' IS NULL
   OR (coalesce(nullif(current_setting('pk.organisation_ids',true),''),'[]')::jsonb ? (s.rights->>'organisationConstraintId')))
 AND (s.rights->>'purpose'<>'PROFITIA_INTERNAL' OR current_setting('pk.purpose',true)='PROFITIA_INTERNAL')
 $$;
ALTER TABLE platform_knowledge.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_knowledge.sources FORCE ROW LEVEL SECURITY;
CREATE POLICY api_sources ON platform_knowledge.sources TO platform_knowledge_api
 USING(platform_knowledge.source_visible(sources))
 WITH CHECK(coalesce(nullif(current_setting('pk.allowed_scopes',true),''),'[]')::jsonb ? scope AND
  ((scope='ACCOUNT_PRIVATE' AND owner_user_id=nullif(current_setting('pk.user_id',true),'') AND owner_organisation_id IS NULL)
  OR(scope='PROFITIA_SHARED' AND owner_user_id IS NULL AND current_setting('pk.operator',true)='true')));
CREATE POLICY worker_sources ON platform_knowledge.sources TO platform_knowledge_worker USING(true) WITH CHECK(true);
CREATE POLICY owner_sources ON platform_knowledge.sources TO platform_knowledge_owner USING(true) WITH CHECK(true);
-- Product rows never carry identity grants. Child rows inherit source access.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['generations','jobs','provider_calls'] LOOP
  EXECUTE format('ALTER TABLE platform_knowledge.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE platform_knowledge.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY api_child ON platform_knowledge.%I TO platform_knowledge_api USING(EXISTS(SELECT 1 FROM platform_knowledge.sources s WHERE s.id=source_id)) WITH CHECK(EXISTS(SELECT 1 FROM platform_knowledge.sources s WHERE s.id=source_id))',t);
  EXECUTE format('CREATE POLICY worker_child ON platform_knowledge.%I TO platform_knowledge_worker,platform_knowledge_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['chunks','cognition'] LOOP
  EXECUTE format('ALTER TABLE platform_knowledge.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE platform_knowledge.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY api_child ON platform_knowledge.%I TO platform_knowledge_api USING(EXISTS(SELECT 1 FROM platform_knowledge.generations g WHERE g.id=generation_id)) WITH CHECK(EXISTS(SELECT 1 FROM platform_knowledge.generations g WHERE g.id=generation_id))',t);
  EXECUTE format('CREATE POLICY worker_child ON platform_knowledge.%I TO platform_knowledge_worker,platform_knowledge_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA platform_knowledge FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA platform_knowledge FROM PUBLIC;
GRANT SELECT ON platform_knowledge.schema_version TO platform_knowledge_api,platform_knowledge_worker;
GRANT SELECT,INSERT,UPDATE ON platform_knowledge.sources,platform_knowledge.generations,platform_knowledge.jobs TO platform_knowledge_api;
GRANT SELECT ON platform_knowledge.chunks,platform_knowledge.cognition TO platform_knowledge_api;
GRANT SELECT,INSERT,UPDATE ON platform_knowledge.provider_calls,platform_knowledge.budget,platform_knowledge.account_state,platform_knowledge.lifecycle_receipts TO platform_knowledge_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON platform_knowledge.sources,platform_knowledge.generations,platform_knowledge.jobs,
 platform_knowledge.chunks,platform_knowledge.cognition,platform_knowledge.provider_calls,platform_knowledge.budget,
 platform_knowledge.account_state,platform_knowledge.lifecycle_receipts TO platform_knowledge_worker;
GRANT INSERT ON platform_knowledge.audit TO platform_knowledge_api,platform_knowledge_worker;
GRANT USAGE ON SEQUENCE platform_knowledge.audit_id_seq TO platform_knowledge_api,platform_knowledge_worker;
GRANT EXECUTE ON FUNCTION platform_knowledge.source_visible(platform_knowledge.sources) TO platform_knowledge_api;
-- Settle an already-reserved external effect even after source/account
-- revocation. Runtime cannot read another principal's data through this port.
CREATE FUNCTION platform_knowledge.settle_provider_call(p_id uuid,p_spent bigint,p_input integer,p_output integer,p_response text,p_result jsonb) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c platform_knowledge.provider_calls%ROWTYPE; usable boolean; BEGIN
 SELECT * INTO c FROM platform_knowledge.provider_calls WHERE id=p_id AND reserved_by=session_user FOR UPDATE;
 IF NOT FOUND OR c.state<>'RESERVED' OR p_spent<0 OR p_input<0 OR p_output<0 THEN RAISE EXCEPTION 'CALL_SETTLEMENT_REJECTED';END IF;
 SELECT deleted_at IS NULL AND revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM platform_knowledge.account_state a WHERE a.user_id=s.owner_user_id AND a.deleted_at IS NOT NULL)
 INTO usable FROM platform_knowledge.sources s WHERE id=c.source_id FOR SHARE;
 UPDATE platform_knowledge.provider_calls SET state='SUCCEEDED',spent_microusd=p_spent,input_tokens=p_input,output_tokens=p_output,
  response_id=p_response,result=CASE WHEN usable THEN p_result ELSE NULL END,finished_at=clock_timestamp() WHERE id=p_id;
 UPDATE platform_knowledge.budget SET reserved_microusd=reserved_microusd-c.reserved_microusd,spent_microusd=spent_microusd+p_spent WHERE id=true;
 RETURN coalesce(usable,false);
END $$;
CREATE FUNCTION platform_knowledge.unknown_provider_call(p_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 UPDATE platform_knowledge.provider_calls SET state='UNKNOWN' WHERE id=p_id AND reserved_by=session_user AND state='RESERVED';END $$;
REVOKE ALL ON FUNCTION platform_knowledge.settle_provider_call(uuid,bigint,integer,integer,text,jsonb),platform_knowledge.unknown_provider_call(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_knowledge.settle_provider_call(uuid,bigint,integer,integer,text,jsonb),platform_knowledge.unknown_provider_call(uuid) TO platform_knowledge_api,platform_knowledge_worker;
GRANT DELETE ON platform_knowledge.audit TO platform_knowledge_worker;
INSERT INTO platform_knowledge.schema_version(version) VALUES(1);
