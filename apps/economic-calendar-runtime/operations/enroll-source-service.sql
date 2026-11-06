-- PROPOSAL ONLY: explicit Identity owner GO required. Not a startup migration.
-- Existing central E1 only; never run through an ordinary ECR/PMOS connection.
-- Maintainer verifies endpoint/project/branch, preserves owner membership and
-- provisions ONLY the approved passwordless ordinary role before SET LOCAL ROLE.
-- Exact separate administrator statement after GO (only if the role is absent):
-- CREATE ROLE economic_calendar_development_ingest LOGIN PASSWORD NULL NOINHERIT
-- NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION
-- VALID UNTIL '2026-12-04T22:19:09.000Z';
-- BEGIN + advisory lock + set_config('ecr.source_service_spec', approved JSON,
-- true) + this file + readback + COMMIT. ROLLBACK on any mismatch.
-- Readback must compare exact public-key digest, application/role/organisation,
-- single grant, configuration/deployment, expiry, and unchanged old consumers.
DO $ecr$
DECLARE p jsonb := current_setting('ecr.source_service_spec',true)::jsonb;
 expected jsonb := $profile${"schemaVersion":"ECRSourceServiceProfile/1","status":"PROPOSED_NOT_GRANTED","applicationId":"profitia-economic-calendar-runtime-development","componentId":"economic-calendar-runtime-development","role":"economic_calendar_development_ingest","profileId":"SPENDGURU_SAAS","sourceOrigin":"urn:profitia:service:economic-calendar-runtime:development","receiverApplicationId":"profitia-source-hub-development","targetOrigin":"https://source-hub-development.onrender.com","keyId":"ecr-source-service-20261106-v1","configurationVersion":"ecr-source-service-v1","organisationId":"225e465b-8b89-467d-92d1-7fef61b555fe","bindingId":"c713afb2-1668-4cd5-9b2e-8efe052edd6b","serviceId":"a80cf159-700a-4b5a-bd5a-8598113fa4e2","expiresAt":"2026-12-04T22:19:09.000Z","sourceQuotaMode":"UNMETERED","automaticRetry":false,"publicKey":"GENERATE_AFTER_OWNER_GO","publicKeySha256":"ATTEST_AFTER_OWNER_GO","privateKeyPersistence":"OWNER_APPROVED_SECRET_STORE","grants":[{"grantId":"8eff4273-f10e-43ea-8d6c-0be4f6ceffd8","resourceId":"api.trading-economics.economic-calendar","operation":"knowledge.read","feature":"market","effect":"ALLOW"}]}$profile$::jsonb;
 r record; g jsonb;
BEGIN
 IF current_user <> 'profitia_access_owner' THEN RAISE EXCEPTION 'EXACT_E1_OWNER_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development'
 AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name=current_database())
 OR to_regclass('profitia_e1_authority.source_components') IS NULL
 THEN RAISE EXCEPTION 'EXACT_CENTRAL_FIRST_PARTY_INSTALLATION_REQUIRED'; END IF;
 IF p IS NULL OR p-ARRAY['publicKey','publicKeySha256','ownerDecisionRef','deploymentId','status']
 IS DISTINCT FROM expected-ARRAY['publicKey','publicKeySha256','ownerDecisionRef','deploymentId','status']
 OR p->>'status' IS DISTINCT FROM 'ENROLLED'
 OR coalesce(p->>'ownerDecisionRef','') !~ '^owner-decision:sha256:[a-f0-9]{64}$'
 OR coalesce(p->>'deploymentId','') !~ '^[a-f0-9]{40}$'
 OR (p->>'expiresAt')::timestamptz <= clock_timestamp()+interval '10 minutes'
 OR coalesce(p->>'publicKey','') !~ '^-----BEGIN PUBLIC KEY-----'
 OR length(p->>'publicKey') NOT BETWEEN 100 AND 200
 OR p->>'publicKeySha256' IS DISTINCT FROM encode(public.digest(convert_to(p->>'publicKey','UTF8'),'sha256'),'hex')
 THEN RAISE EXCEPTION 'EXACT_APPROVED_ECR_CALENDAR_PROFILE_REQUIRED'; END IF;
 SELECT * INTO r FROM pg_roles WHERE rolname=p->>'role';
 IF NOT FOUND OR NOT r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolinherit OR r.rolreplication
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
 THEN RAISE EXCEPTION 'ORDINARY_DEDICATED_ROLE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_e1_authority.source_receivers WHERE application_id=p->>'receiverApplicationId'
 AND target_origin=p->>'targetOrigin' AND product_application_id='spendguru' AND status='ACTIVE' AND expires_at >= (p->>'expiresAt')::timestamptz)
 OR NOT EXISTS(SELECT 1 FROM profitia_access.organisations WHERE organisation_id=(p->>'organisationId')::uuid AND status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id='spendguru' AND organisation_id=(p->>'organisationId')::uuid
 AND product='SPENDGURU' AND 'market'=ANY(features) AND status='ACTIVE' AND expires_at >= (p->>'expiresAt')::timestamptz)
 THEN RAISE EXCEPTION 'EXISTING_RECEIVER_OR_MARKET_ENTITLEMENT_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id=p->>'applicationId')
 OR EXISTS(SELECT 1 FROM profitia_access.runtime_bindings WHERE login_role=p->>'role')
 OR EXISTS(SELECT 1 FROM profitia_services.runtime_bindings WHERE login_role=p->>'role')
 OR EXISTS(SELECT 1 FROM profitia_e1_authority.source_components WHERE component_id=p->>'componentId')
 THEN RAISE EXCEPTION 'IDENTITY_ALREADY_EXISTS_STOP_AND_RECONCILE'; END IF;
 INSERT INTO profitia_access.applications(application_id,status,fixed_organisation_id)
 VALUES(p->>'applicationId','ACTIVE',(p->>'organisationId')::uuid);
 INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES(p->>'role',p->>'applicationId','ACTIVE');
 INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at)
 VALUES(p->>'role',(p->>'bindingId')::uuid,(p->>'serviceId')::uuid,p->>'profileId',p->>'deploymentId',p->>'configurationVersion','ACTIVE',p->>'ownerDecisionRef',(p->>'expiresAt')::timestamptz);
 g:=p->'grants'->0;
 INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,source_ref,expires_at)
 VALUES((g->>'grantId')::uuid,p->>'role',(p->>'organisationId')::uuid,'knowledge.read','market',g->>'resourceId','ALLOW','ACTIVE',p->>'ownerDecisionRef',(p->>'expiresAt')::timestamptz);
 INSERT INTO profitia_e1_authority.source_components(component_id,key_id,application_id,login_role,receiver_application_id,source_origin,public_key,deployment_id,configuration_version,status,source_ref,expires_at)
 VALUES(p->>'componentId',p->>'keyId',p->>'applicationId',p->>'role',p->>'receiverApplicationId',p->>'sourceOrigin',p->>'publicKey',p->>'deploymentId',p->>'configurationVersion','ACTIVE',p->>'ownerDecisionRef',(p->>'expiresAt')::timestamptz);
END $ecr$;
