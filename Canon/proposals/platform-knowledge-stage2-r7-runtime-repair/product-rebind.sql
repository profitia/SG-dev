-- Payload only. The existing product migrator opens BEGIN and SET LOCAL ROLE
-- platform_knowledge_owner, applies exact SQL002, then runs this payload.
-- pk.repair_release = the selected, accepted, CI-PASS R7 release SHA.
-- pk.restore_previous = false for activation, true only for own recovery.
DO $$ DECLARE release text:=current_setting('pk.repair_release',true);
 restoring text:=current_setting('pk.restore_previous',true);expected text;target text;n integer;
BEGIN
 IF current_database()<>'platform_knowledge' OR current_user<>'platform_knowledge_owner'
  OR release IS NULL OR release!~'^[a-f0-9]{40}$'
  OR release='cfa76c865083b43d14408f4bbfa27b2287c03972'
  OR restoring IS NULL OR restoring NOT IN('true','false')
 THEN RAISE EXCEPTION 'R7_PRODUCT_EXECUTION_REJECTED';END IF;
 expected:=CASE WHEN restoring='true' THEN release ELSE 'cfa76c865083b43d14408f4bbfa27b2287c03972' END;
 target:=CASE WHEN restoring='true' THEN 'cfa76c865083b43d14408f4bbfa27b2287c03972' ELSE release END;
 IF NOT EXISTS(SELECT 1 FROM platform_knowledge.schema_version WHERE version=1 AND source_sha256='9a049aa46804f5fea4e84cb6dcedc4be358ffd983183ac7d21129b663654e9d7')
  OR EXISTS(SELECT 1 FROM platform_knowledge.jobs WHERE status IN('QUEUED','RUNNING','RETRY_WAIT'))
 THEN RAISE EXCEPTION 'R7_PRODUCT_STATE_REJECTED';END IF;
 SELECT count(*) INTO n FROM platform_knowledge.authority_bindings
 WHERE login_role IN('platform_knowledge_api','platform_knowledge_worker') AND status='ACTIVE'
  AND binding->>'deploymentId'=expected AND binding->>'environment'='development'
  AND binding->>'projectId'='sparkling-sky-79692560' AND binding->>'branchId'='br-billowing-grass-b9ko5s4f'
  AND binding->>'databaseName'='platform_knowledge' AND binding->>'role'=login_role::text
  AND binding->>'knowledgeSchemaDigest'='9a049aa46804f5fea4e84cb6dcedc4be358ffd983183ac7d21129b663654e9d7'
  AND expires_at='2026-12-11T23:59:00Z'::timestamptz;
 IF n<>2 THEN RAISE EXCEPTION 'R7_PRODUCT_BINDINGS_CHANGED';END IF;
 UPDATE platform_knowledge.authority_bindings
 SET binding=jsonb_set(binding,'{deploymentId}',to_jsonb(target),false)
 WHERE login_role IN('platform_knowledge_api','platform_knowledge_worker') AND binding->>'deploymentId'=expected;
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>2 THEN RAISE EXCEPTION 'R7_PRODUCT_UPDATE_COUNT_REJECTED';END IF;
END $$;
