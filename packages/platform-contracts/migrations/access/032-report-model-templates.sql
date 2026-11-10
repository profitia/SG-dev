-- Additive owner-installed Source template. No activation/grant/credential here.
DO $guard$ BEGIN IF current_user<>'profitia_ingestion_owner' THEN RAISE EXCEPTION 'Source owner required'; END IF; END $guard$;
CREATE SCHEMA profitia_report_model AUTHORIZATION profitia_ingestion_owner;
CREATE TABLE profitia_report_model.templates (
 login_role name PRIMARY KEY REFERENCES profitia_ingestion.runtime_bindings(login_role),
 source_id text NOT NULL REFERENCES profitia_ingestion.sources(source_id),
 kind text NOT NULL CHECK(kind IN('COMPOSER','COUNTER')),profile_id text NOT NULL,
 reservation_micro_usd bigint NOT NULL CHECK(reservation_micro_usd BETWEEN 1 AND 5000000),
 total_budget_micro_usd bigint NOT NULL CHECK(total_budget_micro_usd>=reservation_micro_usd),
 maximum_editions integer NOT NULL CHECK(maximum_editions BETWEEN 1 AND 1000),
 maximum_input_tokens integer NOT NULL CHECK(maximum_input_tokens BETWEEN 1 AND 15000),
 maximum_output_tokens integer NOT NULL CHECK(maximum_output_tokens BETWEEN 1 AND 16000),
 root_configuration_version text NOT NULL,source_ref text NOT NULL,key_project_ref text NOT NULL,
 liability_ref text NOT NULL,candidate_ref text NOT NULL,release_ref text NOT NULL,
 expires_at timestamptz NOT NULL,status text NOT NULL CHECK(status IN('ACTIVE','REVOKED'))
);
CREATE TABLE profitia_report_model.reservations (
 login_role name NOT NULL REFERENCES profitia_report_model.templates(login_role),edition_key text NOT NULL CHECK(edition_key~'^[a-f0-9]{64}$'),
 request_digest text NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),policy_id uuid NOT NULL UNIQUE,
 reserved_micro_usd bigint NOT NULL,PRIMARY KEY(login_role,edition_key)
);
ALTER TABLE profitia_report_model.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_report_model.templates FORCE ROW LEVEL SECURITY;
ALTER TABLE profitia_report_model.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_report_model.reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_scope ON profitia_report_model.templates TO profitia_ingestion_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_scope ON profitia_report_model.reservations TO profitia_ingestion_owner USING(true) WITH CHECK(true);
CREATE FUNCTION profitia_report_model.long_allowed(p_role name,p_source text,p_resource text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,profitia_report_model AS $fn$
 SELECT EXISTS(SELECT 1 FROM profitia_report_model.templates WHERE login_role=p_role AND source_id=p_source AND kind='COMPOSER' AND status='ACTIVE' AND expires_at>clock_timestamp() AND p_resource~'^insights-report:[a-f0-9]{64}$')
$fn$;
ALTER TABLE profitia_external_call.policies DROP CONSTRAINT policies_timeout_ms_check;
ALTER TABLE profitia_external_call.policies ADD CONSTRAINT policies_timeout_ms_check CHECK(timeout_ms BETWEEN 100 AND 120000 OR timeout_ms=600000 AND origin='https://api.openai.com' AND transport='HTTPS' AND path_rules='[{"method":"POST","path":"/v1/responses"}]'::jsonb AND capacity=1 AND (status='REVOKED' OR expires_at<=clock_timestamp() OR (source_id='sg2.oil-report.openai' AND resource_id='sg2-oil-report:compose' AND login_role='sg2_oil_composer_development_source_runtime') OR profitia_report_model.long_allowed(login_role,source_id,resource_id)));
CREATE FUNCTION profitia_report_model.prepare_attempt(p_key text,p_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_report_model AS $fn$
DECLARE t profitia_report_model.templates%ROWTYPE;r profitia_report_model.reservations%ROWTYPE;pid uuid;resource text;path text;used bigint;n integer;
BEGIN
 IF p_key!~'^[a-f0-9]{64}$' OR p_digest!~'^[a-f0-9]{64}$' OR profitia_ingestion.runtime_descriptor() IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO t FROM profitia_report_model.templates WHERE login_role=session_user AND status='ACTIVE' AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO r FROM profitia_report_model.reservations WHERE login_role=session_user AND edition_key=p_key;
 IF FOUND THEN
  IF r.request_digest<>p_digest THEN RETURN NULL; END IF;pid:=r.policy_id;
 ELSE
  SELECT count(*),coalesce(sum(reserved_micro_usd),0) INTO n,used FROM profitia_report_model.reservations WHERE login_role=session_user;
  IF n>=t.maximum_editions OR used+t.reservation_micro_usd>t.total_budget_micro_usd THEN RETURN NULL; END IF;
  pid:=gen_random_uuid();resource:='insights-report:'||p_key;path:=CASE WHEN t.kind='COMPOSER' THEN '/v1/responses' ELSE '/v1/responses/input_tokens' END;
  INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref)
   VALUES(pid,session_user,t.source_id,resource,'insights-report-v1','https://api.openai.com','HTTPS',jsonb_build_array(jsonb_build_object('method','POST','path',path)),65584,CASE WHEN t.kind='COMPOSER' THEN 4000000 ELSE 65536 END,CASE WHEN t.kind='COMPOSER' THEN 600000 ELSE 20000 END,'UPSTREAM_ATTEMPT_ADMISSION',1,clock_timestamp(),t.expires_at,t.expires_at,'ACTIVE',t.source_ref);
  INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref)
   VALUES(pid,1,jsonb_build_array(jsonb_build_object('method','POST','path',path,'requestFormat','JSON')),'[]',CASE WHEN t.kind='COMPOSER' THEN 4000000 ELSE 65536 END,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',t.expires_at,t.source_ref);
  IF t.kind='COMPOSER' THEN
   INSERT INTO profitia_model_execution.policies VALUES(pid,t.profile_id,'gpt-6.1-sol',t.maximum_input_tokens,t.maximum_output_tokens,65536,t.reservation_micro_usd,1,t.key_project_ref,t.liability_ref,t.candidate_ref,t.release_ref,t.source_ref||':'||p_key,t.expires_at,'ACTIVE',1);
  END IF;
  INSERT INTO profitia_report_model.reservations VALUES(session_user,p_key,p_digest,pid,t.reservation_micro_usd);
 END IF;
 RETURN jsonb_build_object('policyId',pid,'resourceId','insights-report:'||p_key,'sourceId',t.source_id,'configurationVersion','insights-report-v1','profileId',t.profile_id,'reservationMicroUsd',t.reservation_micro_usd,'expiresAt',t.expires_at);
END $fn$;
REVOKE ALL ON SCHEMA profitia_report_model FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_report_model FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_report_model FROM PUBLIC;
-- Revoking/shortening a template fences all already issued child policies in
-- the same owner transaction. Cost holds and immutable reservations survive.
CREATE FUNCTION profitia_report_model.fence_children() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 UPDATE profitia_external_native.policies SET expires_at=least(expires_at,NEW.expires_at),
  status=CASE WHEN NEW.status='REVOKED' THEN 'REVOKED' ELSE status END,version=version+1
 WHERE policy_id IN(SELECT policy_id FROM profitia_report_model.reservations WHERE login_role=NEW.login_role);
 UPDATE profitia_model_execution.policies SET expires_at=least(expires_at,NEW.expires_at),
  status=CASE WHEN NEW.status='REVOKED' THEN 'REVOKED' ELSE status END,version=version+1
 WHERE policy_id IN(SELECT policy_id FROM profitia_report_model.reservations WHERE login_role=NEW.login_role); UPDATE profitia_external_call.policies SET expires_at=least(expires_at,NEW.expires_at),window_end=least(window_end,NEW.expires_at),
  status=CASE WHEN NEW.status='REVOKED' THEN 'REVOKED' ELSE status END,version=version+1
 WHERE policy_id IN(SELECT policy_id FROM profitia_report_model.reservations WHERE login_role=NEW.login_role);

 RETURN NEW;
END $fn$;
CREATE TRIGGER template_fence AFTER UPDATE OF status,expires_at ON profitia_report_model.templates
 FOR EACH ROW EXECUTE FUNCTION profitia_report_model.fence_children();
REVOKE ALL ON FUNCTION profitia_report_model.fence_children() FROM PUBLIC;
