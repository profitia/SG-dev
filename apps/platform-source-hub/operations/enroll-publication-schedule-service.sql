-- PROPOSED: exact Identity owner GO required. No role/key/application creation.
-- Use only central Identity Development, bound owner connection, BEGIN and
-- advisory lock; set source_hub.publication_schedule_plan and
-- source_hub.publication_schedule_owner_ref; read back and COMMIT.
DO $schedule$
DECLARE p jsonb := current_setting('source_hub.publication_schedule_plan',true)::jsonb;
 expected jsonb := $plan${"schemaVersion":"SourceHubPublicationScheduleActivation/1","status":"PROPOSED_NOT_ACTIVATED","environment":"development","projectId":"delicate-queen-44677134","branchId":"br-orange-salad-ba2llks7","databaseName":"neondb","applicationId":"profitia-source-hub-development","sourceRole":"source_hub_development_source_runtime","configurationVersion":"source-hub-development-unmetered-20261104-v1","expiresAt":"2026-12-04T22:19:09.000Z","retentionSeconds":0,"sourceQuotaMode":"UNMETERED","automaticRetry":false,"paidExecution":false,"source":{"provider":"eia","family":"publication-calendar","sourceId":"source-hub.eia.publication-calendar","resourceId":"api.eia.publication-calendar","policyId":"76e25fdd-7d49-4852-9ef8-84c9d25eeae1","grantId":"7b6aaa5a-9585-48d7-8741-f4d49a0796c1","budgetId":"e644ce77-b4eb-43fd-aea8-6c7064cd2f42","licenceRef":"source-hub-eia-official-publication-schedules-20261109","origin":"https://www.eia.gov","pathRules":[{"method":"GET","path":"/petroleum/supply/weekly/schedule.php"},{"method":"GET","path":"/outlooks/steo/release_schedule.php"}]},"identity":{"componentId":"source-hub-catalogue-development","applicationId":"profitia-source-hub-catalogue-development","role":"source_hub_catalogue_development_ingest","serviceId":"b7840f12-541f-4feb-8768-5ffdcc718256","organisationId":"225e465b-8b89-467d-92d1-7fef61b555fe","grantId":"db188207-a79c-428a-8725-1b244527ccc9","operation":"knowledge.read","feature":"market","resourceId":"api.eia.publication-calendar","publicKeySha256":"c7ad35af124781eb5d911dd59d1e1d3716697d323becfca6b808c625dc408340"},"runtimeFlag":{"SOURCE_HUB_EIA_SCHEDULES_ENABLED":"true"},"newInfrastructure":false,"newRoles":false,"newKeys":false}$plan$::jsonb;
 decision text := current_setting('source_hub.publication_schedule_owner_ref',true);
 g jsonb; r record;
BEGIN
 IF current_user<>'profitia_access_owner' THEN RAISE EXCEPTION 'EXACT_E1_OWNER_REQUIRED'; END IF;
 IF p IS DISTINCT FROM expected OR coalesce(decision,'') !~ '^owner-decision:sha256:[a-f0-9]{64}$'
 OR (p->>'expiresAt')::timestamptz<=clock_timestamp()+interval '10 minutes'
 THEN RAISE EXCEPTION 'EXACT_PUBLICATION_SCHEDULE_APPROVAL_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development'
 AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name=current_database())
 THEN RAISE EXCEPTION 'EXACT_CENTRAL_INSTALLATION_REQUIRED'; END IF;
 g := p->'identity';
 SELECT * INTO r FROM pg_roles WHERE rolname=g->>'role';
 IF NOT FOUND OR NOT r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolinherit OR r.rolreplication
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
 THEN RAISE EXCEPTION 'EXISTING_ORDINARY_SERVICE_ROLE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id=g->>'applicationId' AND status='ACTIVE' AND fixed_organisation_id=(g->>'organisationId')::uuid)
 OR NOT EXISTS(SELECT 1 FROM profitia_access.runtime_bindings WHERE login_role=g->>'role' AND application_id=g->>'applicationId' AND status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM profitia_services.runtime_bindings WHERE login_role=g->>'role' AND service_id=(g->>'serviceId')::uuid AND status='ACTIVE' AND expires_at >= (p->>'expiresAt')::timestamptz)
 OR NOT EXISTS(SELECT 1 FROM profitia_e1_authority.source_components WHERE component_id=g->>'componentId' AND application_id=g->>'applicationId'
 AND login_role=g->>'role' AND receiver_application_id=p->>'applicationId' AND status='ACTIVE' AND expires_at >= (p->>'expiresAt')::timestamptz
 AND encode(public.digest(convert_to(public_key,'UTF8'),'sha256'),'hex')=g->>'publicKeySha256')
 OR NOT EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id='spendguru' AND organisation_id=(g->>'organisationId')::uuid AND product='SPENDGURU' AND 'market'=ANY(features) AND status='ACTIVE' AND expires_at >= (p->>'expiresAt')::timestamptz)
 THEN RAISE EXCEPTION 'CURRENT_APPROVED_EXISTING_COMPONENT_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM profitia_services.read_grants WHERE grant_id=(g->>'grantId')::uuid
 OR login_role=g->>'role' AND organisation_id=(g->>'organisationId')::uuid AND resource_id=g->>'resourceId')
 THEN RAISE EXCEPTION 'GRANT_EXISTS_RECONCILE_WITHOUT_OVERWRITE'; END IF;
 INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,source_ref,expires_at)
 VALUES((g->>'grantId')::uuid,g->>'role',(g->>'organisationId')::uuid,g->>'operation',g->>'feature',g->>'resourceId','ALLOW','ACTIVE',decision,(p->>'expiresAt')::timestamptz);
END $schedule$;
