-- PREPARED ONLY. Owner acceptance of this exact replacement and rollback is
-- required. Existing grants, counters, licences and trigger functions remain.
-- Caller supplies a bounded JSON spec through set_config with parameters,
-- begins/commits one transaction and checks the actual target host and gates.
DO $binding$ BEGIN
 IF session_user<>'source_hub_development_migrator' OR current_user<>session_user
 THEN RAISE EXCEPTION 'EXISTING_CONTROLLED_SOURCE_MIGRATOR_REQUIRED'; END IF;
 IF current_setting('ecr.transport.replacement_spec',true) IS NULL
 THEN RAISE EXCEPTION 'EXACT_REPLACEMENT_SPEC_REQUIRED'; END IF;
END $binding$;
SELECT pg_advisory_xact_lock(hashtextextended('source-hub-stage2a-migrations',0));
SELECT pg_advisory_xact_lock(hashtextextended('ecr-source-access-continuity',0));
SET LOCAL ROLE source_hub_development_owner;
DO $source$ DECLARE
 s jsonb:=current_setting('ecr.transport.replacement_spec')::jsonb;
 i source_hub.installation%ROWTYPE;
 l source_hub.provider_licences%ROWTYPE;
 p source_hub.ecr_source_continuity_policy%ROWTYPE;
BEGIN
 SELECT * INTO STRICT i FROM source_hub.installation WHERE singleton FOR SHARE;
 IF i.environment<>'development' OR i.project_id<>'delicate-queen-44677134'
 OR i.branch_id<>'br-orange-salad-ba2llks7' OR i.database_name<>current_database()
 OR s->>'decisionRef'!~'^owner-decision:sha256:[a-f0-9]{64}$'
 OR s->>'fromPolicyId'=s->>'toPolicyId'
 OR s->'pathRules' NOT IN (
 '[{"method":"GET","path":"/petroleum/supply/weekly/schedule.php"},{"method":"GET","path":"/outlooks/steo/release_schedule.php"}]'::jsonb,
 '[{"method":"GET","path":"/petroleum/supply/weekly/schedule.php"},{"method":"GET","path":"/outlooks/steo/release_schedule.php"},{"method":"GET","path":"/petroleum/gasdiesel/schedule.php"},{"method":"GET","path":"/petroleum/heatingoilpropane/schedule.php"}]'::jsonb)
 THEN RAISE EXCEPTION 'EXACT_DEVELOPMENT_CALENDAR_REPLACEMENT_REQUIRED'; END IF;
 SELECT * INTO STRICT l FROM source_hub.provider_licences WHERE provider_id='eia' AND family='publication-calendar' FOR UPDATE;
 SELECT * INTO STRICT p FROM source_hub.ecr_source_continuity_policy WHERE singleton FOR UPDATE;
 IF l.source_policy_id<>(s->>'fromPolicyId')::uuid OR l.status<>'ACTIVE'
 OR l.retention_seconds<>0 OR l.expires_at<=clock_timestamp()
 OR l.licence_ref<>'source-hub-eia-official-publication-schedules-20261109'
 OR p.status<>'ACTIVE' OR p.lease_until<=clock_timestamp()
 OR p.expected_fingerprints->>'licence:source-hub.eia.publication-calendar' IS DISTINCT FROM source_hub.ecr_control_fingerprint(to_jsonb(l))
 OR encode(public.digest(convert_to(to_jsonb(l)::text,'UTF8'),'sha256'),'hex') IS DISTINCT FROM s->>'licenceRowSha256'
 OR encode(public.digest(convert_to(to_jsonb(p)::text,'UTF8'),'sha256'),'hex') IS DISTINCT FROM s->>'continuityRowSha256'
 THEN RAISE EXCEPTION 'CURRENT_LICENCE_AND_CONTINUITY_CAS_REQUIRED'; END IF;
 PERFORM set_config('ecr.transport.previous_fingerprints',p.expected_fingerprints::text,true);
END $source$;
SET LOCAL ROLE profitia_ingestion_owner;
LOCK TABLE profitia_external_call.calls IN SHARE ROW EXCLUSIVE MODE NOWAIT;
DO $transport$ DECLARE
 s jsonb:=current_setting('ecr.transport.replacement_spec')::jsonb;
 e profitia_external_call.policies%ROWTYPE;
 n profitia_external_native.policies%ROWTYPE;
 ne profitia_external_call.policies%ROWTYPE;
 nn profitia_external_native.policies%ROWTYPE;
 native_rules jsonb; ids jsonb;
BEGIN
 SELECT * INTO STRICT e FROM profitia_external_call.policies WHERE policy_id=(s->>'fromPolicyId')::uuid FOR UPDATE;
 SELECT * INTO STRICT n FROM profitia_external_native.policies WHERE policy_id=e.policy_id FOR UPDATE;
 IF encode(public.digest(convert_to(to_jsonb(e)::text,'UTF8'),'sha256'),'hex') IS DISTINCT FROM s->>'externalRowSha256'
 OR encode(public.digest(convert_to(to_jsonb(n)::text,'UTF8'),'sha256'),'hex') IS DISTINCT FROM s->>'nativeRowSha256'
 OR e.status<>'ACTIVE' OR n.status<>'ACTIVE' OR n.expires_at<=clock_timestamp()
 OR n.base_policy_version<>e.version OR e.login_role<>'source_hub_development_source_runtime'
 OR e.source_id<>'source-hub.eia.publication-calendar' OR e.resource_id<>'api.eia.publication-calendar'
 OR e.origin<>'https://www.eia.gov' OR e.transport<>'HTTPS' OR e.quota_mode<>'UNMETERED'
 OR n.credential_mode<>'SERVER_HEADERS' OR n.redirect_origins<>'[]'::jsonb
 OR (current_setting('ecr.transport.previous_fingerprints')::jsonb)->>'external:source-hub.eia.publication-calendar' IS DISTINCT FROM source_hub.ecr_control_fingerprint(to_jsonb(e))
 OR (current_setting('ecr.transport.previous_fingerprints')::jsonb)->>'native:source-hub.eia.publication-calendar' IS DISTINCT FROM source_hub.ecr_control_fingerprint(to_jsonb(n))
 OR EXISTS(SELECT 1 FROM profitia_external_call.calls WHERE policy_id=e.policy_id AND status IN('PLANNED','ATTEMPT_RESERVED'))
 OR EXISTS(SELECT 1 FROM profitia_external_call.policies WHERE policy_id=(s->>'toPolicyId')::uuid)
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='profitia_external_native.policies'::regclass AND tgname='native_policy_change' AND tgenabled='O')
 THEN RAISE EXCEPTION 'EXACT_IDLE_ACTIVE_SOURCE_PAIR_REQUIRED'; END IF;
 SELECT jsonb_agg(r||jsonb_build_object('requestFormat','NONE') ORDER BY ord) INTO native_rules FROM jsonb_array_elements(s->'pathRules') WITH ORDINALITY v(r,ord);
 -- Revoke native while its original parent version still matches. Neither
 -- immutable definition nor historical counter is rewritten.
 UPDATE profitia_external_native.policies SET status='REVOKED' WHERE policy_id=n.policy_id;
 UPDATE profitia_external_call.policies SET status='REVOKED' WHERE policy_id=e.policy_id;
 ne:=jsonb_populate_record(NULL::profitia_external_call.policies,to_jsonb(e)||jsonb_build_object('policy_id',s->>'toPolicyId','path_rules',s->'pathRules','version',1,'status','ACTIVE','admitted_count',0,'source_ref',s->>'decisionRef'));
 INSERT INTO profitia_external_call.policies SELECT ne.*;
 nn:=jsonb_populate_record(NULL::profitia_external_native.policies,to_jsonb(n)||jsonb_build_object('policy_id',s->>'toPolicyId','base_policy_version',1,'path_rules',native_rules,'version',1,'status','ACTIVE','source_ref',s->>'decisionRef'));
 INSERT INTO profitia_external_native.policies SELECT nn.*;
 IF (SELECT admitted_count FROM profitia_external_call.policies WHERE policy_id=e.policy_id)<>e.admitted_count
 OR (SELECT count(*) FROM profitia_external_call.policies WHERE login_role=e.login_role AND source_id=e.source_id AND resource_id=e.resource_id AND status='ACTIVE')<>1
 THEN RAISE EXCEPTION 'COUNTER_HISTORY_OR_UNIQUE_ACTIVE_PAIR_VIOLATED'; END IF;
 ids:=jsonb_build_object('external:source-hub.eia.publication-calendar',source_hub.ecr_control_fingerprint(to_jsonb(ne)),
 'native:source-hub.eia.publication-calendar',source_hub.ecr_control_fingerprint(to_jsonb(nn)));
 PERFORM set_config('ecr.transport.new_fingerprints',ids::text,true);
END $transport$;
SET LOCAL ROLE source_hub_development_owner;
DO $link$ DECLARE
 s jsonb:=current_setting('ecr.transport.replacement_spec')::jsonb;
 l source_hub.provider_licences%ROWTYPE;
 previous jsonb:=current_setting('ecr.transport.previous_fingerprints')::jsonb;
 next_values jsonb:=current_setting('ecr.transport.new_fingerprints')::jsonb;
BEGIN
 UPDATE source_hub.provider_licences SET source_policy_id=(s->>'toPolicyId')::uuid
 WHERE provider_id='eia' AND family='publication-calendar' AND source_policy_id=(s->>'fromPolicyId')::uuid RETURNING * INTO STRICT l;
 next_values:=next_values||jsonb_build_object('licence:source-hub.eia.publication-calendar',source_hub.ecr_control_fingerprint(to_jsonb(l)));
 IF (SELECT count(*) FROM jsonb_object_keys(next_values))<>3
 THEN RAISE EXCEPTION 'ONLY_THREE_APPROVED_LINK_FINGERPRINTS'; END IF;
 UPDATE source_hub.ecr_source_continuity_policy SET expected_fingerprints=previous||next_values,updated_at=clock_timestamp() WHERE singleton;
 IF (SELECT expected_fingerprints-ARRAY['external:source-hub.eia.publication-calendar','native:source-hub.eia.publication-calendar','licence:source-hub.eia.publication-calendar'] FROM source_hub.ecr_source_continuity_policy WHERE singleton)
 IS DISTINCT FROM previous-ARRAY['external:source-hub.eia.publication-calendar','native:source-hub.eia.publication-calendar','licence:source-hub.eia.publication-calendar']
 THEN RAISE EXCEPTION 'UNRELATED_CONTINUITY_CHANGE_REFUSED'; END IF;
END $link$;
RESET ROLE;
SELECT 'EXACT_CALENDAR_TRANSPORT_REPLACED'::text AS status,true AS historical_counter_preserved,true AS native_guard_preserved;
