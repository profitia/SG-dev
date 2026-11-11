-- Additive private recurring consent; existing Identity/E1 remains authoritative.
-- No account, role, key, grant, runtime binding or provider policy is created.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR to_regclass('profitia_services.runtime_bindings') IS NULL
 OR to_regclass('profitia_e1_authority.source_components') IS NULL THEN RAISE EXCEPTION 'Accepted current E1 and SQL005 required'; END IF;
END $guard$;
CREATE TABLE profitia_e1_authority.recurring_installation(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'));
CREATE TABLE profitia_e1_authority.recurring_executors(
 component_id text NOT NULL,key_id text NOT NULL,owner_application_id text NOT NULL REFERENCES profitia_e1_authority.receivers(application_id),
 operation text NOT NULL CHECK(operation IN('newsfeed.monitor.execute','insights.subscription.execute')),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 PRIMARY KEY(component_id,key_id,owner_application_id,operation),
 FOREIGN KEY(component_id,key_id) REFERENCES profitia_e1_authority.source_components(component_id,key_id)
);
CREATE TABLE profitia_e1_authority.recurring_consents(
 delegation_id uuid PRIMARY KEY,application_id text NOT NULL REFERENCES profitia_e1_authority.receivers(application_id),
 organisation_id uuid NOT NULL REFERENCES profitia_access.organisations(organisation_id),owner_user_id uuid NOT NULL REFERENCES profitia_access.accounts(user_id),
 operation text NOT NULL CHECK(operation IN('newsfeed.monitor.execute','insights.subscription.execute')),resource_id uuid NOT NULL,
 resource_version bigint NOT NULL CHECK(resource_version>0),definition_digest text NOT NULL CHECK(definition_digest~'^[a-f0-9]{64}$'),
 schedule jsonb NOT NULL CHECK(jsonb_typeof(schedule)='object' AND octet_length(schedule::text)<=2048),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(application_id,organisation_id,owner_user_id,operation,resource_id)
);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['recurring_installation','recurring_executors','recurring_consents'] LOOP
 EXECUTE format('ALTER TABLE profitia_e1_authority.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE profitia_e1_authority.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON profitia_e1_authority.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
 EXECUTE format('CREATE TRIGGER authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_e1_authority.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['recurring_executors','recurring_consents'] LOOP
 EXECUTE format('CREATE TRIGGER advance_version BEFORE UPDATE ON profitia_e1_authority.%I FOR EACH ROW EXECUTE FUNCTION profitia_access.advance_version()',t);
 END LOOP;
END $policies$;
CREATE FUNCTION profitia_e1_authority.recurring_ready() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 RETURN profitia_access.runtime_descriptor()->>'applicationId'='identity-runtime-development'
 AND EXISTS(SELECT 1 FROM profitia_e1_authority.recurring_installation);
END $fn$;
CREATE FUNCTION profitia_e1_authority.recurring_slot(p_schedule jsonb,p_at timestamptz) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE wall timestamp;local_date date;candidate timestamptz;earliest timestamptz;
BEGIN
 IF p_schedule->>'frequency' NOT IN('DAILY','WEEKLY','MONTHLY') OR p_schedule->>'dstPolicy'<>'SKIP_NONEXISTENT_EARLIEST_REPEAT'
 OR p_schedule->>'localTime'!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' OR p_schedule->>'startDate'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_schedule->>'timeZone') OR NOT isfinite(p_at) THEN RETURN false;END IF;
 wall:=p_at AT TIME ZONE (p_schedule->>'timeZone');local_date:=wall::date;
 IF to_char(wall,'HH24:MI:SS')<>(p_schedule->>'localTime')||':00' OR local_date<(p_schedule->>'startDate')::date
 OR (p_schedule->>'endDate' IS NOT NULL AND local_date>(p_schedule->>'endDate')::date)
 OR p_schedule->>'frequency'='WEEKLY' AND NOT coalesce(p_schedule->'weekdays' @> to_jsonb(extract(isodow FROM wall)::integer),false)
 OR p_schedule->>'frequency'='MONTHLY' AND extract(day FROM wall)::integer<>(p_schedule->>'monthDay')::integer
 THEN RETURN false;END IF;
 -- Both sides of DST are checked. One logical local slot uses its earliest
 -- matching UTC instant; a nonexistent wall time has no matching instant.
 SELECT min(x) INTO earliest FROM generate_series(p_at-interval '3 hours',p_at+interval '3 hours',interval '1 minute') x
 WHERE x AT TIME ZONE (p_schedule->>'timeZone')=wall;
 RETURN earliest=p_at;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $fn$;
-- Stable serialization of this closed metadata command, matching the SDK.
CREATE FUNCTION profitia_e1_authority.recurring_canonical(v jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE answer text;
BEGIN
 CASE jsonb_typeof(v)
 WHEN 'object' THEN SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||profitia_e1_authority.recurring_canonical(value),',' ORDER BY key COLLATE "C"),'')||'}' INTO answer FROM jsonb_each(v);
 WHEN 'array' THEN SELECT '['||coalesce(string_agg(profitia_e1_authority.recurring_canonical(value),',' ORDER BY ord),'')||']' INTO answer FROM jsonb_array_elements(v) WITH ORDINALITY a(value,ord);
 ELSE answer:=v::text;END CASE;RETURN answer;
END $fn$;
REVOKE ALL ON FUNCTION profitia_e1_authority.recurring_canonical(jsonb) FROM PUBLIC;
CREATE FUNCTION profitia_e1_authority.recurring_consent(p_app text,p_proof jsonb,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r profitia_e1_authority.receivers%ROWTYPE;p jsonb;raw text;c profitia_e1_authority.recurring_consents%ROWTYPE;op text;
BEGIN
 IF NOT profitia_e1_authority.recurring_ready() THEN RETURN NULL;END IF;
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 SELECT * INTO r FROM profitia_e1_authority.receivers WHERE application_id=p_app AND status='ACTIVE' AND expires_at>clock_timestamp() FOR SHARE;
 raw:=p_proof->>'payload';
 IF NOT FOUND OR raw IS NULL OR octet_length(raw)>16384 OR p_proof->>'signature' IS DISTINCT FROM encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex') THEN RETURN NULL;END IF;
 p:=raw::jsonb;op:=p_command->>'operation';
 IF op NOT IN('newsfeed.monitor.execute','insights.subscription.execute')
 OR p->>'contract'<>'profitia.current-e1-authority/1.0.0' OR p->>'keyId' IS DISTINCT FROM r.key_id OR p->'request'->'binding' IS DISTINCT FROM r.binding
 OR p->'actor'->>'kind' IS DISTINCT FROM 'HUMAN' OR p->'actor'->>'actorId' IS DISTINCT FROM p->'actor'->>'userId'
 OR p->'state'->'access'->>'type' IS DISTINCT FROM 'MEMBERSHIP'
 OR p->'request'->>'requestDigest' IS DISTINCT FROM encode(public.digest(convert_to(profitia_e1_authority.recurring_canonical(p_command),'UTF8'),'sha256'),'hex')
 OR p->'request'->>'organisationId' IS DISTINCT FROM p_command->>'organisationId'
 OR p->'request'->>'operation' IS DISTINCT FROM (CASE op WHEN 'newsfeed.monitor.execute' THEN 'personal.list.write' ELSE 'insights.report.start' END)
 OR p->'request'->>'resourceId' IS DISTINCT FROM (CASE op WHEN 'newsfeed.monitor.execute' THEN p_command->>'resourceId' ELSE 'oil-asphalt' END)
 OR NOT coalesce((p->>'expiresAt')::timestamptz>clock_timestamp(),false)
 OR p_command->>'resourceVersion'!~'^[1-9][0-9]*$' OR p_command->>'definitionDigest'!~'^[a-f0-9]{64}$'
 OR jsonb_typeof(p_command->'schedule') IS DISTINCT FROM 'object' THEN RETURN NULL;END IF;
 SELECT * INTO c FROM profitia_e1_authority.recurring_consents WHERE application_id=p_app AND organisation_id=(p_command->>'organisationId')::uuid
 AND owner_user_id=(p->'actor'->>'userId')::uuid AND operation=op AND resource_id=(p_command->>'resourceId')::uuid FOR UPDATE;
 IF FOUND THEN
  IF c.delegation_id<>(p_command->>'delegationId')::uuid OR c.resource_version>(p_command->>'resourceVersion')::bigint THEN RETURN NULL;END IF;
  IF c.resource_version=(p_command->>'resourceVersion')::bigint AND (c.definition_digest<>p_command->>'definitionDigest' OR c.schedule IS DISTINCT FROM p_command->'schedule') THEN RETURN NULL;END IF;
  UPDATE profitia_e1_authority.recurring_consents SET resource_version=(p_command->>'resourceVersion')::bigint,definition_digest=p_command->>'definitionDigest',schedule=p_command->'schedule',
   status=CASE WHEN (p_command->>'enabled')::boolean THEN 'ACTIVE' ELSE 'REVOKED' END,updated_at=clock_timestamp() WHERE delegation_id=c.delegation_id RETURNING * INTO c;
 ELSE
  INSERT INTO profitia_e1_authority.recurring_consents(delegation_id,application_id,organisation_id,owner_user_id,operation,resource_id,resource_version,definition_digest,schedule,status)
  VALUES((p_command->>'delegationId')::uuid,p_app,(p_command->>'organisationId')::uuid,(p->'actor'->>'userId')::uuid,op,(p_command->>'resourceId')::uuid,
   (p_command->>'resourceVersion')::bigint,p_command->>'definitionDigest',p_command->'schedule',CASE WHEN (p_command->>'enabled')::boolean THEN 'ACTIVE' ELSE 'REVOKED' END) RETURNING * INTO c;
 END IF;
 raw:=jsonb_build_object('contract','profitia.recurring-consent-receipt/1.0.0','applicationId',p_app,'organisationId',c.organisation_id,'ownerUserId',c.owner_user_id,'resourceId',c.resource_id,'definitionDigest',c.definition_digest,'schedule',c.schedule,'delegationId',c.delegation_id,'version',c.version::text,'resourceVersion',c.resource_version::text,'status',c.status,'expiresAt',least((p->>'expiresAt')::timestamptz,clock_timestamp()+interval '15 seconds'))::text;
 RETURN jsonb_build_object('payload',raw,'signature',encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex'));
END $fn$;
CREATE FUNCTION profitia_e1_authority.recurring_identity(p_component text,p_key text,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE k jsonb;c profitia_e1_authority.recurring_consents%ROWTYPE;e profitia_access.external_identities%ROWTYPE;
BEGIN
 IF NOT profitia_e1_authority.recurring_ready() THEN RETURN NULL;END IF;
 k:=profitia_e1_authority.source_consumer(p_component,p_key);
 IF k IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO c FROM profitia_e1_authority.recurring_consents WHERE delegation_id=(p_request->>'delegationId')::uuid AND status='ACTIVE';
 IF NOT FOUND OR c.application_id IS DISTINCT FROM p_request->'binding'->>'applicationId' OR c.organisation_id::text IS DISTINCT FROM p_request->>'organisationId'
 OR c.resource_id::text IS DISTINCT FROM p_request->>'privateResourceId' OR c.resource_version::text IS DISTINCT FROM p_request->>'resourceVersion'
 OR c.definition_digest IS DISTINCT FROM p_request->>'definitionDigest' OR c.operation IS DISTINCT FROM p_request->>'operation'
 OR NOT EXISTS(SELECT 1 FROM profitia_e1_authority.recurring_executors x JOIN profitia_e1_authority.source_components sc USING(component_id,key_id)
 JOIN profitia_services.runtime_bindings b ON b.login_role=sc.login_role AND b.status='ACTIVE' AND b.expires_at>clock_timestamp()
 WHERE x.component_id=p_component AND x.key_id=p_key AND x.owner_application_id=c.application_id AND x.operation=c.operation AND x.status='ACTIVE' AND x.expires_at>clock_timestamp())
 THEN RETURN NULL;END IF;
 SELECT ee.* INTO e FROM profitia_access.external_identities ee JOIN profitia_access.accounts a USING(user_id)
 JOIN profitia_e1_authority.receivers r ON r.application_id=c.application_id AND r.issuer=ee.issuer AND r.status='ACTIVE' AND r.expires_at>clock_timestamp()
 JOIN profitia_access.applications app ON app.application_id=c.application_id AND app.status='ACTIVE' AND(app.fixed_organisation_id IS NULL OR app.fixed_organisation_id=c.organisation_id)
 WHERE ee.user_id=c.owner_user_id AND ee.status='ACTIVE' AND ee.expires_at>clock_timestamp() AND a.status='ACTIVE';
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('environment','development','issuer',e.issuer,'subject',e.subject);
END $fn$;
CREATE FUNCTION profitia_e1_authority.issue_recurring(p_component text,p_key text,p_key_digest text,p_request jsonb,p_observation jsonb,p_previous jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE k jsonb;identity jsonb;c profitia_e1_authority.recurring_consents%ROWTYPE;r profitia_e1_authority.receivers%ROWTYPE;
 u profitia_access.accounts%ROWTYPE;m profitia_access.memberships%ROWTYPE;o profitia_access.organisations%ROWTYPE;pg profitia_access.product_grants%ROWTYPE;parent profitia_access.product_grants%ROWTYPE;
 sg profitia_services.read_grants%ROWTYPE;sc profitia_e1_authority.source_components%ROWTYPE;sb profitia_services.runtime_bindings%ROWTYPE;ex profitia_e1_authority.recurring_executors%ROWTYPE;ei profitia_access.external_identities%ROWTYPE;
 permissions jsonb;denies jsonb;owner_feature text;owner_op text;policy_resource text;fingerprint text;expiry timestamptz;actor jsonb;state jsonb;d jsonb;raw text;old jsonb;lease_until timestamptz;
BEGIN
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 k:=profitia_e1_authority.source_consumer(p_component,p_key);identity:=profitia_e1_authority.recurring_identity(p_component,p_key,p_request);
 IF k IS NULL OR identity IS NULL OR k->>'keyDigest' IS DISTINCT FROM p_key_digest
 OR p_observation->>'environment'<>'development' OR p_observation->>'issuer' IS DISTINCT FROM identity->>'issuer' OR p_observation->>'subject' IS DISTINCT FROM identity->>'subject'
 OR p_observation->>'status' IS DISTINCT FROM 'ACTIVE' OR NOT coalesce((p_observation->>'observedAt')::timestamptz<=clock_timestamp() AND (p_observation->>'expiresAt')::timestamptz>clock_timestamp() AND (p_observation->>'expiresAt')::timestamptz<=(p_observation->>'observedAt')::timestamptz+interval '5 seconds',false)
 THEN RETURN NULL;END IF;
 SELECT * INTO STRICT c FROM profitia_e1_authority.recurring_consents WHERE delegation_id=(p_request->>'delegationId')::uuid;
 SELECT * INTO r FROM profitia_e1_authority.receivers WHERE application_id=c.application_id AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(p_request) key) IS DISTINCT FROM ARRAY['binding','claimedAt','definitionDigest','delegationId','leaseId','nonce','operation','organisationId','payloadDigest','phase','privateResourceId','resourceId','resourceVersion','scheduleSlot','schemaDigest','slotAt','sourceResourceId','transactionId'] OR p_request->'binding' IS DISTINCT FROM r.binding OR p_request->>'nonce'!~'^[a-f0-9]{64}$' OR p_request->>'payloadDigest'!~'^[a-f0-9]{64}$'
 OR p_request->>'schemaDigest'!~'^[a-f0-9]{64}$' OR p_request->>'transactionId'!~'^[0-9]{1,20}$' THEN RETURN NULL;END IF;
 IF NOT profitia_e1_authority.recurring_slot(c.schedule,(p_request->>'slotAt')::timestamptz) OR (p_request->>'slotAt')::timestamptz>clock_timestamp()
 OR (p_request->>'claimedAt')::timestamptz>clock_timestamp() OR (p_request->>'claimedAt')::timestamptz<clock_timestamp()-interval '30 seconds'
 THEN RETURN NULL;END IF;
 SELECT * INTO u FROM profitia_access.accounts WHERE user_id=c.owner_user_id AND status='ACTIVE';IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO m FROM profitia_access.memberships WHERE user_id=c.owner_user_id AND organisation_id=c.organisation_id AND status='ACTIVE' AND expires_at>clock_timestamp();IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO o FROM profitia_access.organisations WHERE organisation_id=c.organisation_id AND status='ACTIVE';IF NOT FOUND THEN RETURN NULL;END IF;
 owner_feature:=CASE c.operation WHEN 'newsfeed.monitor.execute' THEN 'personal_workspace' ELSE 'market' END;
 owner_op:=CASE c.operation WHEN 'newsfeed.monitor.execute' THEN 'personal.list.write' ELSE 'insights.report.start' END;
 policy_resource:=CASE c.operation WHEN 'newsfeed.monitor.execute' THEN 'newsfeed-observations' ELSE 'oil-asphalt' END;
 SELECT * INTO pg FROM profitia_access.product_grants WHERE application_id=c.application_id AND organisation_id=c.organisation_id AND product='SPENDGURU' AND owner_feature=ANY(features) AND status='ACTIVE' AND expires_at>clock_timestamp();IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO parent FROM profitia_access.product_grants WHERE application_id='spendguru' AND organisation_id=c.organisation_id AND product='SPENDGURU' AND status='ACTIVE' AND expires_at>clock_timestamp();IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',g.feature,'resourceId',resource_id) ORDER BY grant_id) FILTER(WHERE effect='ALLOW'),'[]'),coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',g.feature,'resourceId',resource_id) ORDER BY grant_id) FILTER(WHERE effect='DENY'),'[]') INTO permissions,denies FROM profitia_access.permission_grants g WHERE application_id=c.application_id AND organisation_id=c.organisation_id AND user_id=c.owner_user_id;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(permissions) p WHERE p->>'operation'=owner_op AND p->>'feature'=owner_feature AND (p->>'resourceId' IS NULL OR p->>'resourceId' IN(policy_resource,c.resource_id::text)))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(denies) p WHERE p->>'operation'=owner_op AND p->>'feature'=owner_feature AND(p->>'resourceId' IS NULL OR p->>'resourceId' IN(policy_resource,c.resource_id::text))) THEN RETURN NULL;END IF;
 SELECT * INTO STRICT ex FROM profitia_e1_authority.recurring_executors WHERE component_id=p_component AND key_id=p_key AND owner_application_id=c.application_id AND operation=c.operation;
 SELECT * INTO STRICT ei FROM profitia_access.external_identities WHERE issuer=identity->>'issuer' AND subject=identity->>'subject';
 SELECT * INTO STRICT sc FROM profitia_e1_authority.source_components WHERE component_id=p_component AND key_id=p_key;
 SELECT * INTO sb FROM profitia_services.runtime_bindings WHERE login_role=sc.login_role AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND OR sb.service_id=c.owner_user_id THEN RETURN NULL;END IF;
 IF p_request->>'sourceResourceId' IS NOT NULL THEN
  IF p_request->>'sourceResourceId'!~'^api[.][a-z-]+[.]news-discovery$' THEN RETURN NULL;END IF;
  SELECT * INTO sg FROM profitia_services.read_grants WHERE login_role=sc.login_role AND organisation_id=c.organisation_id
   AND operation='knowledge.read' AND feature='market' AND effect='ALLOW' AND status='ACTIVE' AND expires_at>clock_timestamp()
   AND(resource_id IS NULL OR resource_id=p_request->>'sourceResourceId') ORDER BY resource_id NULLS LAST LIMIT 1;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM profitia_services.read_grants WHERE login_role=sc.login_role AND organisation_id=c.organisation_id AND operation='knowledge.read'
   AND effect='DENY' AND status='ACTIVE' AND expires_at>clock_timestamp() AND(resource_id IS NULL OR resource_id=p_request->>'sourceResourceId')) THEN RETURN NULL;END IF;
 END IF;
 fingerprint:=encode(public.digest(convert_to(jsonb_build_object('sourceGrant',to_jsonb(sg),'consent',to_jsonb(c),'executor',to_jsonb(ex),'identityBinding',to_jsonb(ei),'component',k,'service',to_jsonb(sb),'account',to_jsonb(u),'member',to_jsonb(m),'organisation',to_jsonb(o),'product',to_jsonb(pg),'parent',to_jsonb(parent),'permissions',permissions,'denies',denies,'receiver',to_jsonb(r)-'proof_key','identity',identity)::text,'UTF8'),'sha256'),'hex');
 lease_until:=(p_request->>'claimedAt')::timestamptz+interval '30 seconds';
 expiry:=least(lease_until,clock_timestamp()+interval '15 seconds',m.expires_at,pg.expires_at,parent.expires_at,r.expires_at,sb.expires_at,(k->>'expiresAt')::timestamptz);
 IF p_previous IS NOT NULL THEN
  raw:=p_previous->>'payload';IF raw IS NULL OR p_previous->>'signature' IS DISTINCT FROM encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex') THEN RETURN NULL;END IF;
  old:=raw::jsonb;IF old->'request' IS DISTINCT FROM p_request OR old->>'fingerprint' IS DISTINCT FROM fingerprint OR (old->>'expiresAt')::timestamptz<=clock_timestamp() THEN RETURN NULL;END IF;
 END IF;
 IF expiry<=clock_timestamp() THEN RETURN NULL;END IF;
 actor:=jsonb_build_object('kind','SERVICE','actorId',sb.service_id,'serviceId',sb.service_id,'proofRef','recurring-service:'||sb.binding_id::text||':'||sb.version::text,'issuer','urn:profitia:database-service-runtime:v1','audience',c.application_id,'environment','development','expiresAt',lease_until);
 d:=jsonb_build_object('contract','profitia.private-recurring-job/1.0.0','schemaDigest',p_request->>'schemaDigest','delegationId',c.delegation_id,'delegationVersion',c.version::text,
 'jobId',p_request->>'resourceId','leaseId',p_request->>'leaseId','executorApplicationId',c.application_id,'serviceActorId',sb.service_id,'organisationId',c.organisation_id,'ownerUserId',c.owner_user_id,
 'resourceType',CASE c.operation WHEN 'newsfeed.monitor.execute' THEN 'newsfeed_observation' ELSE 'report_subscription' END,'resourceId',c.resource_id,'resourceVersion',c.resource_version::text,
 'scheduleSlot',p_request->>'scheduleSlot','payloadDigest',p_request->>'payloadDigest','policyResourceId',policy_resource,'claimedAt',p_request->>'claimedAt','expiresAt',lease_until,'policyVersion','recurring-e1-v1:'||fingerprint,
 'ownerApplication',jsonb_build_object('appId',c.application_id,'environment','development','profileId','SPENDGURU_SAAS','configurationVersion','current-e1-v1','organisationId',NULL,'features',jsonb_build_array(owner_feature),'operations',jsonb_build_array(owner_op)),
 'ownerAccess',jsonb_build_object('type','MEMBERSHIP','actorId',c.owner_user_id,'organisationId',c.organisation_id,'status','ACTIVE','version',m.version::text,'sourceRef',m.source_ref,'expiresAt',m.expires_at,'permissions',permissions,'denies',denies),
 'ownerProducts',jsonb_build_array(jsonb_build_object('product','SPENDGURU','features',pg.features,'organisationId',pg.organisation_id,'environment','development','applicationId',pg.application_id,'status',pg.status,'version',pg.version::text,'sourceRef',pg.source_ref,'source',pg.source,'expiresAt',pg.expires_at)),'identityObservation',p_observation);
 state:=jsonb_build_object('applicationId',c.application_id,'environment','development','policyVersion','recurring-e1-v1:'||fingerprint,'usagePolicy','NOT_APPLICABLE','transactionId',p_request->>'transactionId','products','[]'::jsonb,'recurringDelegation',d,
 'sourceGrant',CASE WHEN sg.grant_id IS NULL THEN NULL ELSE jsonb_build_object('grantId',sg.grant_id,'resourceId',p_request->>'sourceResourceId','expiresAt',sg.expires_at,'sourceRef',sg.source_ref) END,
 'access',jsonb_build_object('type','DELEGATED_USER','actorId',sb.service_id,'organisationId',c.organisation_id,'status','ACTIVE','version',c.version::text||':'||fingerprint,'sourceRef','recurring-consent:'||c.delegation_id::text,'expiresAt',lease_until,'permissions',jsonb_build_array(jsonb_build_object('operation',c.operation,'feature',owner_feature,'resourceId',p_request->>'resourceId')),'denies','[]'::jsonb));
 raw:=jsonb_build_object('contract','profitia.current-private-recurring/1.0.0','keyId',r.key_id,'request',p_request,'actor',actor,'state',state,'fingerprint',fingerprint,'expiresAt',expiry)::text;
 IF octet_length(raw)>24576 THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('payload',raw,'signature',encode(public.hmac(convert_to(raw,'UTF8'),r.proof_key,'sha256'),'hex'));
END $fn$;
REVOKE ALL ON profitia_e1_authority.recurring_installation,profitia_e1_authority.recurring_executors,profitia_e1_authority.recurring_consents FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_e1_authority.recurring_ready(),profitia_e1_authority.recurring_slot(jsonb,timestamptz),profitia_e1_authority.recurring_consent(text,jsonb,jsonb),profitia_e1_authority.recurring_identity(text,text,jsonb),profitia_e1_authority.issue_recurring(text,text,text,jsonb,jsonb,jsonb) FROM PUBLIC;
-- Exact execute privileges and actual executor enrollments are applied only
-- by the controlled Development installer after acceptance. No implicit grants.

