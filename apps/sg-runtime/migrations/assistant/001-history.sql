-- Controlled product-store extension. No account enrolment or authority grant.
DO $guard$ BEGIN
 IF current_user<>'sg2_assistant_history_owner' OR current_database()<>'neondb'
 THEN RAISE EXCEPTION 'ASSISTANT_HISTORY_OWNER_REQUIRED';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto' AND n.nspname='public')
 THEN RAISE EXCEPTION 'ASSISTANT_HISTORY_CRYPTO_REQUIRED';END IF;
END $guard$;
CREATE SCHEMA sg2_assistant_history AUTHORIZATION sg2_assistant_history_owner;
REVOKE ALL ON SCHEMA sg2_assistant_history FROM PUBLIC;
CREATE TABLE sg2_assistant_history.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 environment text NOT NULL CHECK(environment='development'),application_id text NOT NULL CHECK(application_id='spendguru'),
 project_id text NOT NULL CHECK(project_id='autumn-waterfall-65938876'),branch_id text NOT NULL CHECK(branch_id='br-dry-hall-b294222f'),
 command_key bytea NOT NULL CHECK(octet_length(command_key)=32),pilot_user_id uuid NOT NULL,source_ref text NOT NULL
);
CREATE TABLE sg2_assistant_history.conversations(
 id uuid PRIMARY KEY DEFAULT public.gen_random_uuid(),user_id uuid NOT NULL,locale text NOT NULL CHECK(locale IN('pl','en')),revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '30 days'
);
CREATE INDEX assistant_owner_history ON sg2_assistant_history.conversations(user_id,updated_at DESC);
CREATE TABLE sg2_assistant_history.turns(
 id uuid PRIMARY KEY DEFAULT public.gen_random_uuid(),conversation_id uuid NOT NULL REFERENCES sg2_assistant_history.conversations ON DELETE CASCADE,
 user_id uuid NOT NULL,command_id uuid NOT NULL,assistant_message_id uuid NOT NULL DEFAULT public.gen_random_uuid(),
 message text NOT NULL CHECK(length(message) BETWEEN 1 AND 8000),response text NOT NULL DEFAULT '' CHECK(length(response)<=64000),
 status text NOT NULL CHECK(status IN('QUEUED','COMPLETE','INTERRUPTED','FAILED')),
 scopes jsonb NOT NULL CHECK(jsonb_typeof(scopes)='array' AND jsonb_array_length(scopes)<=4 AND octet_length(scopes::text)<=8192),
 sources jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(sources)='array' AND jsonb_array_length(sources)<=4 AND octet_length(sources::text)<=8192),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(user_id,command_id)
);
CREATE INDEX assistant_conversation_turns ON sg2_assistant_history.turns(conversation_id,created_at,id);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','conversations','turns'] LOOP
  EXECUTE format('ALTER TABLE sg2_assistant_history.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE sg2_assistant_history.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON sg2_assistant_history.%I TO sg2_assistant_history_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $rls$;
CREATE FUNCTION sg2_assistant_history.prune() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,sg2_assistant_history AS $fn$
DECLARE removed integer;
BEGIN
 IF session_user<>'sg2_assistant_history_runtime' THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
 DELETE FROM conversations WHERE expires_at<=clock_timestamp();GET DIAGNOSTICS removed=ROW_COUNT;RETURN removed;
END $fn$;
CREATE FUNCTION sg2_assistant_history.descriptor() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,sg2_assistant_history AS $fn$
BEGIN
 IF session_user<>'sg2_assistant_history_runtime' OR current_database()<>'neondb' THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
 RETURN(SELECT jsonb_build_object('schemaDigest',schema_digest,'environment',environment,'applicationId',application_id,
  'projectId',project_id,'branchId',branch_id,'databaseName',current_database(),'runtimeRole',session_user,'userId',pilot_user_id) FROM installation WHERE singleton);
END $fn$;
CREATE FUNCTION sg2_assistant_history.apply(p_json text,p_proof text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,sg2_assistant_history AS $fn$
DECLARE i installation%ROWTYPE;d jsonb;actor uuid;action text;c conversations%ROWTYPE;t turns%ROWTYPE;result jsonb;keys text[];
BEGIN
 IF session_user<>'sg2_assistant_history_runtime' OR current_database()<>'neondb' OR p_json IS NULL OR octet_length(p_json)>262144
 OR pg_has_role(session_user,'sg2_assistant_history_owner','MEMBER')
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND(NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit))
 THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
 SELECT * INTO i FROM installation WHERE singleton;
 IF NOT FOUND OR i.schema_digest<>'__ASSISTANT_HISTORY_SCHEMA_DIGEST__' OR p_proof IS NULL
 OR p_proof<>encode(public.hmac(convert_to(p_json,'UTF8'),i.command_key,'sha256'),'hex') THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
 d:=p_json::jsonb;actor:=(d->>'userId')::uuid;action:=d->>'action';
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR d->>'contract' IS DISTINCT FROM '1.0.0' OR d->>'schemaDigest' IS DISTINCT FROM i.schema_digest OR actor IS NULL OR actor<>i.pilot_user_id
 OR coalesce((d->>'until')::bigint,0)<=floor(extract(epoch FROM clock_timestamp())*1000)
 OR (d->>'until')::bigint>floor(extract(epoch FROM clock_timestamp())*1000)+10000
 OR coalesce(action,'') NOT IN('LIST','LOAD','BEGIN','COMPLETE','INTERRUPT','CHECK','DELETE') THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
 keys:=ARRAY['action','contract','schemaDigest','until','userId']||(CASE action
  WHEN 'LIST' THEN ARRAY[]::text[] WHEN 'BEGIN' THEN ARRAY['conversationId','commandId','message','locale','scopes','expectedRevision']
  WHEN 'COMPLETE' THEN ARRAY['conversationId','commandId','response','sources']
  WHEN 'INTERRUPT' THEN ARRAY['conversationId','commandId'] WHEN 'CHECK' THEN ARRAY['conversationId','commandId']
  ELSE ARRAY['conversationId'] END);
 IF ARRAY(SELECT jsonb_object_keys(d) ORDER BY 1)<>ARRAY(SELECT unnest(keys) ORDER BY 1) THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
 PERFORM prune();
 IF action='LIST' THEN
  SELECT coalesce(jsonb_agg(v ORDER BY v->>'updatedAt' DESC),'[]') INTO result FROM
   (SELECT jsonb_build_object('id',id,'createdAt',created_at,'updatedAt',updated_at,'locale',locale) AS v FROM conversations WHERE user_id=actor ORDER BY updated_at DESC LIMIT 200) q;
  RETURN jsonb_build_object('items',result);
 END IF;
 IF action='BEGIN' THEN
  -- Stable command ID is global within this private account. Replays never
  -- create another conversation, turn, provider dispatch or bill.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':'||coalesce(d->>'commandId',''),0));
  SELECT * INTO t FROM turns WHERE user_id=actor AND command_id=(d->>'commandId')::uuid;
  IF FOUND THEN
   IF t.message IS DISTINCT FROM d->>'message' OR t.scopes IS DISTINCT FROM d->'scopes'
    OR d->>'conversationId' IS NOT NULL AND t.conversation_id IS DISTINCT FROM (d->>'conversationId')::uuid
   THEN RAISE EXCEPTION 'HISTORY_CONFLICT';END IF;
   RETURN jsonb_build_object('status','REPLAY','conversationId',t.conversation_id,'turnId',t.id);
  END IF;
  IF jsonb_typeof(d->'message') IS DISTINCT FROM 'string' OR coalesce(length(d->>'message'),0) NOT BETWEEN 1 AND 8000
  OR coalesce(d->>'locale','') NOT IN('pl','en') OR jsonb_typeof(d->'scopes') IS DISTINCT FROM 'array'
  OR jsonb_array_length(d->'scopes')>4 OR octet_length((d->'scopes')::text)>8192 OR (d->>'commandId')::uuid IS NULL THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
  IF d->>'conversationId' IS NULL THEN
   IF d->'expectedRevision' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'HISTORY_CONFLICT';END IF;
   IF (SELECT count(*) FROM conversations WHERE user_id=actor)>=200 THEN RAISE EXCEPTION 'HISTORY_CAPACITY';END IF;
   INSERT INTO conversations(user_id,locale) VALUES(actor,d->>'locale') RETURNING * INTO c;
  ELSE
   SELECT * INTO c FROM conversations WHERE id=(d->>'conversationId')::uuid AND user_id=actor FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
   IF c.revision IS DISTINCT FROM (d->>'expectedRevision')::bigint THEN RAISE EXCEPTION 'HISTORY_CONFLICT';END IF;
  END IF;
  UPDATE turns SET status='INTERRUPTED',updated_at=clock_timestamp() WHERE conversation_id=c.id AND status='QUEUED' AND created_at<clock_timestamp()-interval '2 minutes';
  IF EXISTS(SELECT 1 FROM turns WHERE conversation_id=c.id AND status='QUEUED') THEN RAISE EXCEPTION 'HISTORY_CONFLICT';END IF;
  INSERT INTO turns(conversation_id,user_id,command_id,message,status,scopes) VALUES(c.id,actor,(d->>'commandId')::uuid,d->>'message','QUEUED',d->'scopes') RETURNING * INTO t;
  UPDATE conversations SET revision=revision+1,updated_at=clock_timestamp(),expires_at=clock_timestamp()+interval '30 days' WHERE id=c.id;
  RETURN jsonb_build_object('status','NEW','conversationId',c.id,'turnId',t.id);
 END IF;
 SELECT * INTO c FROM conversations WHERE id=(d->>'conversationId')::uuid AND user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
 IF action='DELETE' THEN DELETE FROM conversations WHERE id=c.id;RETURN jsonb_build_object('deleted',true);END IF;
 IF action='LOAD' THEN
  SELECT coalesce(jsonb_agg(v ORDER BY v->>'createdAt',v->>'id'),'[]') INTO result FROM
   (SELECT jsonb_build_object('id',id,'commandId',command_id,'assistantMessageId',assistant_message_id,'message',message,'response',response,
    'status',status,'scopes',scopes,'sources',sources,'createdAt',created_at) v FROM turns WHERE conversation_id=c.id AND user_id=actor ORDER BY created_at DESC,id DESC LIMIT 50) q;
  RETURN jsonb_build_object('id',c.id,'revision',c.revision,'turns',result);
 END IF;
 SELECT * INTO t FROM turns WHERE conversation_id=c.id AND user_id=actor AND command_id=(d->>'commandId')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
 IF action='CHECK' THEN
  IF t.status<>'QUEUED' THEN RAISE EXCEPTION 'HISTORY_CONFLICT';END IF;
  RETURN jsonb_build_object('active',true);
 END IF;
 IF action='INTERRUPT' THEN
  IF t.status='QUEUED' THEN UPDATE turns SET status='INTERRUPTED',updated_at=clock_timestamp() WHERE id=t.id;END IF;
  RETURN jsonb_build_object('interrupted',true);
 END IF;
 IF t.status='COMPLETE' THEN
  IF t.response IS DISTINCT FROM d->>'response' OR t.sources IS DISTINCT FROM d->'sources' THEN RAISE EXCEPTION 'HISTORY_CONFLICT';END IF;
 ELSIF t.status='QUEUED' THEN
  IF jsonb_typeof(d->'response') IS DISTINCT FROM 'string' OR coalesce(length(d->>'response'),0) NOT BETWEEN 1 AND 64000
   OR jsonb_typeof(d->'sources') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'sources')>4 OR octet_length((d->'sources')::text)>8192
   THEN RAISE EXCEPTION 'HISTORY_UNAVAILABLE';END IF;
  UPDATE turns SET response=d->>'response',sources=d->'sources',status='COMPLETE',updated_at=clock_timestamp() WHERE id=t.id;
  UPDATE conversations SET revision=revision+1,updated_at=clock_timestamp(),expires_at=clock_timestamp()+interval '30 days' WHERE id=c.id;
 ELSE RAISE EXCEPTION 'HISTORY_CONFLICT';END IF;
 RETURN jsonb_build_object('complete',true);
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA sg2_assistant_history FROM PUBLIC,sg2_assistant_history_runtime;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sg2_assistant_history FROM PUBLIC,sg2_assistant_history_runtime;
GRANT USAGE ON SCHEMA sg2_assistant_history TO sg2_assistant_history_runtime;
GRANT EXECUTE ON FUNCTION sg2_assistant_history.apply(text,text),sg2_assistant_history.prune(),sg2_assistant_history.descriptor() TO sg2_assistant_history_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA sg2_assistant_history REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
