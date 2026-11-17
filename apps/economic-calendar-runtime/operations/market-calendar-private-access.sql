-- Controlled owner operation; preparation is not activation.
-- Caller must hold the exact separately approved plan and record the real decision.
DO $install$
DECLARE p jsonb:=current_setting('profitia.market_calendar_owner_plan',true)::jsonb;
 expected jsonb:=$plan${"schemaVersion":"ECRMarketCalendarPrivateAccess/1","status":"PROPOSED_NOT_ACTIVATED","taskId":"ARCHITECTURE-ECR-MARKET-CALENDAR-CONSUMER-20261111","targetEnvironment":"development","identity":{"projectId":"spring-bread-28217539","branchId":"br-sparkling-term-b99l107x","databaseName":"platform_private","ownerRole":"profitia_access_owner","temporaryOperatorSetRole":{"operator":"neondb_owner","restoreExactMembershipsBeforeCommit":true}},"organisationId":"225e465b-8b89-467d-92d1-7fef61b555fe","acceptanceUserId":"092c2d9f-a84b-4c18-b3d6-e172a61399b8","product":"SPENDGURU","addFeatureOnly":"personal_workspace","productApplications":["spendguru","profitia-economic-calendar-runtime-development"],"preserveProductExpiry":true,"permissionGrants":[{"grantId":"64a54c25-a59e-40cd-9209-ee0b06ec1ebd","applicationId":"profitia-economic-calendar-runtime-development","effect":"ALLOW","operation":"personal.list.read","feature":"personal_workspace","resourceId":"economic-calendar-preferences"},{"grantId":"40519cd3-8459-4fc8-b211-fa8966bf6574","applicationId":"profitia-economic-calendar-runtime-development","effect":"ALLOW","operation":"personal.list.write","feature":"personal_workspace","resourceId":"economic-calendar-preferences"}],"scope":"EXISTING_OWNER_ACCEPTANCE_ONLY_NOT_A_FUTURE_MANUAL_USER_ENROLMENT_POLICY","producerPackage":"@profitia/economic-calendar-contracts@1.3.0","existingEventWireContract":"profitia.economic-calendar/1.1.0","developmentReleases":["economic-calendar-runtime-development","sg2-development-runtime"],"newResources":false,"newCosts":false,"databaseMigration":false,"serviceGrantChanged":false,"sourceHubChanged":false,"providerLicenceChanged":false,"notificationsDelivery":false,"rollback":"Restore only added feature values and revoke only two new exact private grants; preserve user data, prior grants, observations, historical receipts and current LKG releases."}$plan$::jsonb;
 decision text:=current_setting('profitia.owner_decision_ref',true); g jsonb; parent_features text[]; ecr_features text[];
BEGIN
 IF current_user<>'profitia_access_owner' OR current_database()<>'platform_private'
 OR p IS DISTINCT FROM expected OR decision IS NULL OR decision NOT LIKE 'owner-decision:sha256:%'
 OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE environment='development' AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x')
 THEN RAISE EXCEPTION 'EXACT_OWNER_PLAN_AND_IDENTITY_DEVELOPMENT_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ecr-market-calendar-private-access',0));
 IF NOT EXISTS(SELECT 1 FROM profitia_access.accounts WHERE user_id=(p->>'acceptanceUserId')::uuid AND status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM profitia_access.memberships WHERE organisation_id=(p->>'organisationId')::uuid AND user_id=(p->>'acceptanceUserId')::uuid AND status='ACTIVE' AND expires_at>clock_timestamp())
 OR NOT EXISTS(SELECT 1 FROM profitia_e1_authority.receivers WHERE application_id='profitia-economic-calendar-runtime-development' AND resource_id='economic-calendar' AND status='ACTIVE' AND expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'CURRENT_OWNER_MEMBERSHIP_AND_RECEIVER_REQUIRED'; END IF;
 SELECT features INTO parent_features FROM profitia_access.product_grants WHERE application_id='spendguru' AND organisation_id=(p->>'organisationId')::uuid AND product='SPENDGURU' AND status='ACTIVE' AND expires_at>clock_timestamp() FOR UPDATE;
 SELECT features INTO ecr_features FROM profitia_access.product_grants WHERE application_id='profitia-economic-calendar-runtime-development' AND organisation_id=(p->>'organisationId')::uuid AND product='SPENDGURU' AND status='ACTIVE' AND expires_at>clock_timestamp() FOR UPDATE;
 IF parent_features IS DISTINCT FROM ARRAY['benchmark','category','market','forecast']::text[] OR ecr_features IS DISTINCT FROM ARRAY['market']::text[]
 THEN RAISE EXCEPTION 'CURRENT_PRODUCT_FEATURES_CHANGED_RECONCILE'; END IF;
 IF EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE grant_id IN(SELECT (v->>'grantId')::uuid FROM jsonb_array_elements(p->'permissionGrants')v))
 OR EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id='profitia-economic-calendar-runtime-development' AND organisation_id=(p->>'organisationId')::uuid AND user_id=(p->>'acceptanceUserId')::uuid AND operation IN('personal.list.read','personal.list.write'))
 THEN RAISE EXCEPTION 'PRIVATE_ACCESS_ALREADY_PRESENT_RECONCILE'; END IF;
 UPDATE profitia_access.product_grants SET features=features||ARRAY['personal_workspace'] WHERE application_id IN('spendguru','profitia-economic-calendar-runtime-development') AND organisation_id=(p->>'organisationId')::uuid AND product='SPENDGURU';
 FOR g IN SELECT v FROM jsonb_array_elements(p->'permissionGrants')v LOOP
  INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id)
  VALUES((g->>'grantId')::uuid,g->>'applicationId',(p->>'organisationId')::uuid,(p->>'acceptanceUserId')::uuid,g->>'effect',g->>'operation',g->>'feature',g->>'resourceId');
 END LOOP;
END $install$;
