-- PROPOSAL ONLY: explicit Identity owner GO required. Not a startup migration.
-- Existing central E1 only; never run through an ordinary SourceHub/PMOS connection.
-- Maintainer verifies endpoint/project/branch, preserves owner membership and
-- provisions ONLY the approved passwordless ordinary role before SET LOCAL ROLE.
-- Exact separate administrator statement after GO (only if the role is absent):
-- CREATE ROLE source_hub_catalogue_development_ingest LOGIN PASSWORD NULL NOINHERIT
-- NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION
-- VALID UNTIL '2026-12-04T22:19:09.000Z';
-- BEGIN + advisory lock + set_config('source_hub.catalogue_service_spec', approved JSON,
-- true) + this file + readback + COMMIT. ROLLBACK on any mismatch.
-- Readback must compare exact public-key digest, application/role/organisation,
-- six exact grants, configuration/deployment, expiry, and unchanged old consumers.
DO $catalogue$
DECLARE p jsonb := current_setting('source_hub.catalogue_service_spec',true)::jsonb;
 expected jsonb := $profile${"schemaVersion":"SourceHubCatalogueServiceProfile/1","status":"PROPOSED_NOT_GRANTED","applicationId":"profitia-source-hub-catalogue-development","componentId":"source-hub-catalogue-development","role":"source_hub_catalogue_development_ingest","profileId":"SPENDGURU_SAAS","sourceOrigin":"urn:profitia:service:source-hub-catalogue:development","receiverApplicationId":"profitia-source-hub-development","targetOrigin":"https://source-hub-development.onrender.com","keyId":"source-hub-catalogue-20261106-v1","configurationVersion":"source-hub-catalogue-v1","organisationId":"225e465b-8b89-467d-92d1-7fef61b555fe","bindingId":"3f17d981-5c86-48b8-9650-68c52a1c55a3","serviceId":"b7840f12-541f-4feb-8768-5ffdcc718256","expiresAt":"2026-12-04T22:19:09.000Z","sourceQuotaMode":"UNMETERED","automaticRetry":false,"publicKey":"GENERATE_AFTER_OWNER_GO","publicKeySha256":"ATTEST_AFTER_OWNER_GO","privateKeyPersistence":"OWNER_APPROVED_SSourceHub catalogueET_STORE","grants":[{"grantId":"9f4c85f3-4f41-4877-a353-3fcdb388db5a","resourceId":"api.eia.data-catalog","operation":"knowledge.read","feature":"market","effect":"ALLOW"},{"grantId":"3ef72c2c-ed6d-408e-91c0-e02416d41679","resourceId":"api.eia.series-observations","operation":"knowledge.read","feature":"market","effect":"ALLOW"},{"grantId":"26f8eeb2-5433-47bc-b8eb-5e48c004bdfa","resourceId":"api.cftc.data-catalog","operation":"knowledge.read","feature":"market","effect":"ALLOW"},{"grantId":"2143779d-32b7-4edf-a0ab-160d9cd88214","resourceId":"api.cftc.positioning-observations","operation":"knowledge.read","feature":"market","effect":"ALLOW"},{"grantId":"3dbc511f-ccdf-47c5-97f7-88b091711e06","resourceId":"api.commodities-sh.data-catalog","operation":"knowledge.read","feature":"market","effect":"ALLOW"},{"grantId":"d1e875fc-2121-4c17-a803-397880364fd5","resourceId":"api.commodities-sh.publication-calendar","operation":"knowledge.read","feature":"market","effect":"ALLOW"}]}$profile$::jsonb;
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
 THEN RAISE EXCEPTION 'EXACT_APPROVED_SOURCEHUB_CATALOGUE_PROFILE_REQUIRED'; END IF;
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
 FOR g IN SELECT value FROM jsonb_array_elements(p->'grants') LOOP
 INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,source_ref,expires_at)
 VALUES((g->>'grantId')::uuid,p->>'role',(p->>'organisationId')::uuid,'knowledge.read','market',g->>'resourceId','ALLOW','ACTIVE',p->>'ownerDecisionRef',(p->>'expiresAt')::timestamptz);
 END LOOP;
 INSERT INTO profitia_e1_authority.source_components(component_id,key_id,application_id,login_role,receiver_application_id,source_origin,public_key,deployment_id,configuration_version,status,source_ref,expires_at)
 VALUES(p->>'componentId',p->>'keyId',p->>'applicationId',p->>'role',p->>'receiverApplicationId',p->>'sourceOrigin',p->>'publicKey',p->>'deploymentId',p->>'configurationVersion','ACTIVE',p->>'ownerDecisionRef',(p->>'expiresAt')::timestamptz);
END $catalogue$;
