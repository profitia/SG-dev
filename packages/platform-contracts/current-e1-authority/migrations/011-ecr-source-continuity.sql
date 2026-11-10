-- Read-only expiry projection for the already enrolled ECR SERVICE login.
-- No grant, component, product, receiver or renewal behaviour is modified.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR to_regclass('profitia_e1_authority.ecr_continuity_policy') IS NULL
 THEN RAISE EXCEPTION 'Accepted ECR continuity and explicit access owner required'; END IF;
END $guard$;
CREATE FUNCTION profitia_e1_authority.ecr_access_expiry_status() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p profitia_e1_authority.ecr_continuity_policy%ROWTYPE; deps jsonb; more jsonb;
BEGIN
 IF session_user<>'economic_calendar_development_ingest'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT(rolsuper OR rolinherit OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user))
 THEN RAISE EXCEPTION 'Own ordinary ECR SERVICE required' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM profitia_e1_authority.ecr_continuity_policy WHERE singleton;
 deps:=jsonb_build_array(jsonb_build_object('id','service-continuity-owner-policy','kind','OWNER_RENEWAL_BASIS','source','ECR SERVICE','status',coalesce(p.status,'MISSING'),'expiresAt',NULL,'expiryMode','NO_FIXED_EXPIRY'));
 WITH records(id,kind,status,expiry) AS(
  SELECT 'service-binding','SERVICE_BINDING',b.status,b.expires_at FROM(VALUES(1))v(x) LEFT JOIN profitia_services.runtime_bindings b ON b.login_role=session_user
  UNION ALL SELECT 'service-component','SERVICE_COMPONENT',c.status,c.expires_at FROM(VALUES(1))v(x) LEFT JOIN profitia_e1_authority.source_components c ON c.component_id=p.component_id AND c.login_role=session_user
  UNION ALL SELECT 'service-grant:'||g.resource_id,'SERVICE_GRANT',g.status,g.expires_at FROM profitia_services.read_grants g WHERE g.grant_id=ANY(p.grant_ids)
  UNION ALL SELECT 'parent-product-market','PRODUCT_ENTITLEMENT',CASE WHEN count(*)=0 THEN 'MISSING' ELSE 'ACTIVE' END,min(expires_at) FROM profitia_access.product_grants
   WHERE application_id='spendguru' AND organisation_id=p.organisation_id AND product='SPENDGURU' AND 'market'=ANY(features) AND status='ACTIVE'
  UNION ALL SELECT 'identity-source-receiver','E1_RECEIVER',r.status,profitia_e1_authority.ecr_receiver_deadline(p.component_id,r.application_id,r.expires_at) FROM profitia_e1_authority.source_receivers r WHERE r.application_id='profitia-source-hub-development'
  UNION ALL SELECT 'identity-business-receiver','E1_RECEIVER',r.status,profitia_e1_authority.ecr_receiver_deadline(p.component_id,r.application_id,r.expires_at) FROM profitia_e1_authority.receivers r WHERE r.application_id='profitia-source-hub-development'
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'source','ECR SERVICE','status',coalesce(status,'MISSING'),'expiresAt',expiry,'expiryMode','FINITE','action',CASE WHEN kind='PRODUCT_ENTITLEMENT' THEN 'The product owner must renew the real SPENDGURU market entitlement; source renewal cannot extend it.' ELSE 'Check the existing ECR finite renewal and owner revocation state; do not recreate grants.' END) ORDER BY id),'[]'::jsonb) INTO more FROM records;
 deps:=deps||more||jsonb_build_array(
 jsonb_build_object('id','organisation-state','kind','ORGANISATION_STATE','source','ECR SERVICE','status',coalesce((SELECT status FROM profitia_access.organisations WHERE organisation_id=p.organisation_id),'MISSING'),'expiresAt',NULL,'expiryMode','NO_FIXED_EXPIRY'),
 jsonb_build_object('id','application-state','kind','APPLICATION_STATE','source','ECR SERVICE','status',coalesce((SELECT status FROM profitia_access.applications WHERE application_id=p.application_id),'MISSING'),'expiresAt',NULL,'expiryMode','NO_FIXED_EXPIRY'),
 jsonb_build_object('id','application-binding','kind','SERVICE_BINDING','source','ECR SERVICE','status',coalesce((SELECT status FROM profitia_access.runtime_bindings WHERE login_role=session_user AND application_id=p.application_id),'MISSING'),'expiresAt',NULL,'expiryMode','NO_FIXED_EXPIRY'));
 IF(SELECT count(*) FROM profitia_services.read_grants WHERE grant_id=ANY(p.grant_ids))<>3 THEN deps:=deps||jsonb_build_array(jsonb_build_object('id','missing-service-grant','kind','SERVICE_GRANT','source','ECR SERVICE','status','MISSING','expiresAt',NULL)); END IF;
 IF EXISTS(SELECT 1 FROM profitia_services.read_grants WHERE login_role=session_user AND organisation_id=p.organisation_id AND operation='knowledge.read' AND status='ACTIVE' AND effect='DENY' AND expires_at>clock_timestamp() AND(resource_id IS NULL OR resource_id=ANY(p.resources))) THEN deps:=deps||jsonb_build_array(jsonb_build_object('id','service-deny','kind','SERVICE_GRANT','source','ECR SERVICE','status','DENIED','expiresAt',NULL)); END IF;
 RETURN jsonb_build_object('dependencies',deps);
END $fn$;
REVOKE ALL ON FUNCTION profitia_e1_authority.ecr_access_expiry_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION profitia_e1_authority.ecr_access_expiry_status() TO economic_calendar_development_ingest;
