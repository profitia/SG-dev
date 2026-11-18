-- Payload only. Reuse the approved original R6 transaction membership recipe:
-- BEGIN; exact two membership checks; temporary SET on own OID139949;
-- SET LOCAL ROLE profitia_access_owner; this payload; SET LOCAL ROLE NONE;
-- restore SET=false and both exact original edges BEFORE COMMIT.
-- Do not rerun SQL015/016, applications, grants, keys or original enrollment.
DO $$ DECLARE release text:=current_setting('pk.repair_release',true);
 restoring text:=current_setting('pk.restore_previous',true);expected text;target text;n integer;
BEGIN
 IF current_database()<>'platform_private' OR current_user<>'profitia_access_owner'
  OR release IS NULL OR release!~'^[a-f0-9]{40}$'
  OR release='cfa76c865083b43d14408f4bbfa27b2287c03972'
  OR restoring IS NULL OR restoring NOT IN('true','false')
 THEN RAISE EXCEPTION 'R7_IDENTITY_EXECUTION_REJECTED';END IF;
 expected:=CASE WHEN restoring='true' THEN release ELSE 'cfa76c865083b43d14408f4bbfa27b2287c03972' END;
 target:=CASE WHEN restoring='true' THEN 'cfa76c865083b43d14408f4bbfa27b2287c03972' ELSE release END;
 SELECT count(*) INTO n FROM profitia_e1_authority.knowledge_receivers
 WHERE login_role IN('platform_knowledge_api','platform_knowledge_worker') AND status='ACTIVE'
  AND binding->>'deploymentId'=expected AND binding->>'environment'='development'
  AND binding->>'projectId'='sparkling-sky-79692560' AND binding->>'branchId'='br-billowing-grass-b9ko5s4f'
  AND binding->>'databaseName'='platform_knowledge' AND binding->>'role'=login_role::text
  AND binding->>'knowledgeSchemaDigest'='9a049aa46804f5fea4e84cb6dcedc4be358ffd983183ac7d21129b663654e9d7'
  AND expires_at='2026-12-11T23:59:00Z'::timestamptz
  AND source_ref=CASE WHEN restoring='true' THEN 'ARCH-PK-STAGE2-R7-GO-20261118@'||release ELSE 'ARCH-PK-STAGE2-TECHNICAL-GO-20261117@cfa76c865083b43d14408f4bbfa27b2287c03972' END;
 IF n<>2 THEN RAISE EXCEPTION 'R7_IDENTITY_BINDINGS_CHANGED';END IF;
 UPDATE profitia_e1_authority.knowledge_receivers
 SET binding=jsonb_set(binding,'{deploymentId}',to_jsonb(target),false),version=version+1,
 source_ref=CASE WHEN restoring='true' THEN 'ARCH-PK-STAGE2-TECHNICAL-GO-20261117@cfa76c865083b43d14408f4bbfa27b2287c03972' ELSE 'ARCH-PK-STAGE2-R7-GO-20261118@'||release END
 WHERE login_role IN('platform_knowledge_api','platform_knowledge_worker') AND binding->>'deploymentId'=expected;
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>2 THEN RAISE EXCEPTION 'R7_IDENTITY_UPDATE_COUNT_REJECTED';END IF;
END $$;
