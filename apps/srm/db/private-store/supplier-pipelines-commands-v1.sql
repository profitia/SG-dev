-- SRM supplier-pipelines/1.0.0 closed command/query receiver.
-- Candidate only. No runtime ACL, enrollment, installation or activation grant.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR current_database()<>'platform_private'
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_workspace_installation WHERE singleton AND contract_version='1.0.0')
  OR to_regclass('srm.supplier_workspace_commands_installation') IS NOT NULL
  OR coalesce(current_setting('profitia.install.commands_digest',true),'')!~'^[a-f0-9]{64}$'
  OR coalesce(current_setting('profitia.install.source_sha',true),'')!~'^[a-f0-9]{40}$'
 THEN RAISE EXCEPTION 'Exact controlled receiver installation required' USING ERRCODE='42501';END IF;
END $guard$;

CREATE FUNCTION srm.workspace_fail(p_code text,p_field text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SCP:'||p_code,DETAIL=coalesce(p_field,'');
END $fn$;
CREATE FUNCTION srm.workspace_require(p_operation text,p_resource uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;BEGIN
 s:=profitia_supplier_workspace.current_scope();
 IF s.scope_id IS NULL OR profitia_supplier_workspace.scope_allows(s.organisation_id,p_operation,p_resource) IS NOT TRUE
 THEN PERFORM srm.workspace_fail('FORBIDDEN');END IF;
END $fn$;

CREATE FUNCTION srm.workspace_json_category(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE org uuid:=(profitia_supplier_workspace.current_scope()).organisation_id;r jsonb;BEGIN
 PERFORM srm.workspace_require('supplier.category.read',p_id);
 SELECT jsonb_build_object('categoryId',id,'name',name,'version',version,
  'lifecycle',CASE WHEN archived_at IS NULL THEN 'ACTIVE' ELSE 'ARCHIVED' END) INTO r
 FROM srm.supplier_categories WHERE organization_id=org AND id=p_id;
 IF r IS NULL THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;RETURN r;
END $fn$;
CREATE FUNCTION srm.workspace_json_membership(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE org uuid:=(profitia_supplier_workspace.current_scope()).organisation_id;m srm.supplier_pipeline_memberships%ROWTYPE;r jsonb;BEGIN
 PERFORM srm.workspace_require('supplier.assignment.read',p_id);
 SELECT * INTO m FROM srm.supplier_pipeline_memberships WHERE organization_id=org AND id=p_id;
 IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
 PERFORM srm.workspace_require('supplier.catalog.read',m.supplier_id);
 PERFORM srm.workspace_require('supplier.pipeline.read',m.pipeline_id);
 SELECT jsonb_build_object('membershipId',m.id,'supplierId',m.supplier_id,'pipelineId',m.pipeline_id,
  'pipelineName',coalesce(m.pipeline_name_at_end,p.name),'stageId',m.stage_id,'stageName',coalesce(m.stage_name_at_end,t.name),
  'kind',m.kind,'version',m.version,'startedAt',m.started_at,'endedAt',m.ended_at,'endReason',m.end_reason) INTO r
 FROM srm.supplier_pipelines p JOIN srm.supplier_pipeline_stages t ON t.organization_id=p.organization_id AND t.pipeline_id=p.id
 WHERE p.organization_id=org AND p.id=m.pipeline_id AND t.id=m.stage_id;
 IF r IS NULL THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;RETURN r;
END $fn$;
CREATE FUNCTION srm.workspace_json_pipeline(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE org uuid:=(profitia_supplier_workspace.current_scope()).organisation_id;r jsonb;BEGIN
 PERFORM srm.workspace_require('supplier.pipeline.read',p_id);PERFORM srm.workspace_require('supplier.assignment.read');
 SELECT jsonb_build_object('pipelineId',p.id,'kind',p.kind,'name',p.name,'categoryId',p.category_id,
  'version',p.version,'lifecycle',CASE WHEN p.archived_at IS NULL THEN 'ACTIVE' ELSE 'ARCHIVED' END,
  'activeCount',(SELECT count(*) FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.pipeline_id=p.id AND m.ended_at IS NULL),
  'stages',(SELECT coalesce(jsonb_agg(jsonb_build_object('stageId',t.id,'name',t.name,'order',t.stage_order,
   'activeCount',(SELECT count(*) FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.pipeline_id=p.id AND m.stage_id=t.id AND m.ended_at IS NULL)) ORDER BY t.stage_order),'[]'::jsonb)
   FROM srm.supplier_pipeline_stages t WHERE t.organization_id=org AND t.pipeline_id=p.id AND t.deleted_at IS NULL)) INTO r
 FROM srm.supplier_pipelines p WHERE p.organization_id=org AND p.id=p_id;
 IF r IS NULL THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;RETURN r;
END $fn$;
CREATE FUNCTION srm.workspace_json_supplier(p_id uuid,p_full boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE org uuid:=(profitia_supplier_workspace.current_scope()).organisation_id;r jsonb;BEGIN
 PERFORM srm.workspace_require('supplier.catalog.read',p_id);
 PERFORM srm.workspace_require('supplier.category.read');PERFORM srm.workspace_require('supplier.adp-status.read');
 IF p_full THEN PERFORM srm.workspace_require('supplier.pipeline.read');PERFORM srm.workspace_require('supplier.assignment.read');END IF;
 SELECT jsonb_build_object('supplierId',s.id,'nipNormalized',s.nip,
  'displayName',coalesce(nullif(btrim(s.display_name),''),'Nazwa nieuzupełniona'),
  'relationshipOwner',CASE WHEN p.relationship_owner_account_id IS NULL THEN NULL ELSE jsonb_build_object(
   'accountId',p.relationship_owner_account_id,'displayName',NULL,'state',CASE
    WHEN profitia_supplier_workspace.member_allowed(org,p.relationship_owner_account_id) THEN 'ACTIVE' ELSE 'UNAVAILABLE' END) END,
  'cardCategories',(SELECT coalesce(jsonb_agg(srm.workspace_json_category(c.category_id) ORDER BY c.category_id),'[]'::jsonb)
   FROM srm.supplier_category_links c WHERE c.organization_id=org AND c.supplier_id=s.id AND c.ended_at IS NULL),
  'adp',jsonb_build_object('status','UNKNOWN','projectionVersion',1),
  'version',coalesce(p.version,0),'lifecycle',CASE WHEN p.archived_at IS NULL THEN 'ACTIVE' ELSE 'ARCHIVED' END,
  'updatedAt',greatest(s.updated_at,p.updated_at)) ||
  CASE WHEN p_full THEN jsonb_build_object('contacts',coalesce(p.contacts,'[]'::jsonb),
   'memberships',(SELECT coalesce(jsonb_agg(srm.workspace_json_membership(m.id) ORDER BY m.started_at,m.id),'[]'::jsonb)
    FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.supplier_id=s.id)) ELSE '{}'::jsonb END INTO r
 FROM srm.suppliers s LEFT JOIN srm.supplier_workspace_profiles p ON p.organization_id=s.organization_id AND p.supplier_id=s.id
 WHERE s.organization_id=org AND s.id=p_id;
 IF r IS NULL THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;RETURN r;
END $fn$;

CREATE FUNCTION srm.workspace_read(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;k text:=p->>'kind';allowed text[];expected text;
 org uuid;sid uuid;pid uuid;cursor_id uuid;cursor_time timestamptz;category uuid;life text;
 q text;lim integer;ids uuid[];r jsonb;items jsonb;total bigint;next_id uuid;
BEGIN
 s:=profitia_supplier_workspace.current_scope();org:=s.organisation_id;
 IF s.scope_id IS NULL OR s.access_mode<>'READ' OR jsonb_typeof(p) IS DISTINCT FROM 'object' THEN PERFORM srm.workspace_fail('FORBIDDEN');END IF;
 allowed:=CASE k
  WHEN 'SUPPLIERS' THEN ARRAY['kind','q','categoryId','lifecycle','cursor','limit']
  WHEN 'SUPPLIER_BY_NIP' THEN ARRAY['kind','nip'] WHEN 'SUPPLIER_CARD' THEN ARRAY['kind','supplierId']
  WHEN 'ADP_STATUS' THEN ARRAY['kind','supplierId'] WHEN 'CATEGORIES' THEN ARRAY['kind','q','lifecycle','cursor','limit']
  WHEN 'PIPELINES' THEN ARRAY['kind','categoryId','lifecycle','cursor','limit']
  WHEN 'PIPELINE' THEN ARRAY['kind','pipelineId','cursor','limit'] WHEN 'HISTORY' THEN ARRAY['kind','supplierId','cursor','limit'] END;
 expected:=CASE WHEN k IN('SUPPLIERS','SUPPLIER_BY_NIP','SUPPLIER_CARD') THEN 'supplier.catalog.read' WHEN k='HISTORY' THEN 'supplier.assignment.read'
  WHEN k='CATEGORIES' THEN 'supplier.category.read' WHEN k IN('PIPELINE','PIPELINES') THEN 'supplier.pipeline.read'
  WHEN k='ADP_STATUS' THEN 'supplier.adp-status.read' END;
 IF allowed IS NULL OR expected IS DISTINCT FROM s.operation OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) t(key) WHERE NOT(key=ANY(allowed)))
 THEN PERFORM srm.workspace_fail('FIELD_INVALID','query');END IF;
 lim:=coalesce((p->>'limit')::int,50);IF lim<1 OR lim>100 THEN PERFORM srm.workspace_fail('FIELD_INVALID','limit');END IF;
 cursor_id:=(p->>'cursor')::uuid;sid:=(p->>'supplierId')::uuid;pid:=(p->>'pipelineId')::uuid;category:=(p->>'categoryId')::uuid;
 life:=coalesce(p->>'lifecycle','ACTIVE');q:=lower(btrim(regexp_replace(normalize(coalesce(p->>'q',''),NFKC),'[[:space:]]+',' ','g')));
 IF life NOT IN('ACTIVE','ARCHIVED') OR length(q)>200 THEN PERFORM srm.workspace_fail('FIELD_INVALID','query');END IF;
 IF k IN('SUPPLIER_CARD','ADP_STATUS','HISTORY') THEN
  IF sid IS NULL THEN PERFORM srm.workspace_fail('FIELD_INVALID','supplierId');END IF;
  PERFORM srm.workspace_require('supplier.catalog.read',sid);
  PERFORM 1 FROM srm.suppliers WHERE organization_id=org AND id=sid;
  IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
 END IF;
 IF k='SUPPLIER_CARD' THEN RETURN srm.workspace_json_supplier(sid,true);
 ELSIF k='ADP_STATUS' THEN RETURN jsonb_build_object('status','UNKNOWN','projectionVersion',1);
 ELSIF k='SUPPLIER_BY_NIP' THEN
  IF p->>'nip' IS NULL THEN PERFORM srm.workspace_fail('NIP_REQUIRED','nip');END IF;
  IF srm.workspace_valid_nip(p->>'nip') IS NOT TRUE THEN PERFORM srm.workspace_fail('INVALID_NIP','nip');END IF;
  SELECT jsonb_build_object('supplierId',a.id,'displayName',coalesce(nullif(btrim(a.display_name),''),'Nazwa nieuzupełniona'),
   'lifecycle',CASE WHEN b.archived_at IS NULL THEN 'ACTIVE' ELSE 'ARCHIVED' END) INTO r
  FROM srm.suppliers a LEFT JOIN srm.supplier_workspace_profiles b ON b.organization_id=a.organization_id AND b.supplier_id=a.id
  WHERE a.organization_id=org AND a.nip=p->>'nip';RETURN r;
 ELSIF k='SUPPLIERS' THEN
  PERFORM srm.workspace_require('supplier.category.read');PERFORM srm.workspace_require('supplier.adp-status.read');
  WITH matching AS(SELECT a.id FROM srm.suppliers a LEFT JOIN srm.supplier_workspace_profiles b ON b.organization_id=a.organization_id AND b.supplier_id=a.id
   WHERE a.organization_id=org AND (b.archived_at IS NULL)=(life='ACTIVE')
    AND(q='' OR position(q in lower(normalize(coalesce(a.display_name,''),NFKC)))>0
     OR position(regexp_replace(q,'[[:space:]-]','','g') in coalesce(a.nip,''))>0)
    AND(category IS NULL OR EXISTS(SELECT 1 FROM srm.supplier_category_links c WHERE c.organization_id=org AND c.supplier_id=a.id AND c.category_id=category AND c.ended_at IS NULL)))
  SELECT (SELECT count(*) FROM matching),(SELECT array_agg(id ORDER BY id) FROM(SELECT id FROM matching WHERE cursor_id IS NULL OR id>cursor_id ORDER BY id LIMIT lim+1) page) INTO total,ids;
  SELECT coalesce(jsonb_agg(srm.workspace_json_supplier(x,false) ORDER BY ord),'[]'::jsonb) INTO items FROM unnest(ids[1:lim]) WITH ORDINALITY t(x,ord);
 ELSIF k='CATEGORIES' THEN
  WITH matching AS(SELECT id FROM srm.supplier_categories WHERE organization_id=org AND(archived_at IS NULL)=(life='ACTIVE')
   AND(q='' OR position(q in normalized_name)>0))
  SELECT(SELECT count(*) FROM matching),(SELECT array_agg(id ORDER BY id) FROM(SELECT id FROM matching WHERE cursor_id IS NULL OR id>cursor_id ORDER BY id LIMIT lim+1) page) INTO total,ids;
  SELECT coalesce(jsonb_agg(srm.workspace_json_category(x) ORDER BY ord),'[]'::jsonb) INTO items FROM unnest(ids[1:lim]) WITH ORDINALITY t(x,ord);
 ELSIF k='PIPELINES' THEN
  PERFORM srm.workspace_require('supplier.assignment.read');
  WITH matching AS(SELECT id FROM srm.supplier_pipelines WHERE organization_id=org AND(archived_at IS NULL)=(life='ACTIVE') AND(category IS NULL OR category_id=category))
  SELECT(SELECT count(*) FROM matching),(SELECT array_agg(id ORDER BY id) FROM(SELECT id FROM matching WHERE cursor_id IS NULL OR id>cursor_id ORDER BY id LIMIT lim+1) page) INTO total,ids;
  SELECT coalesce(jsonb_agg(srm.workspace_json_pipeline(x) ORDER BY ord),'[]'::jsonb) INTO items FROM unnest(ids[1:lim]) WITH ORDINALITY t(x,ord);
 ELSIF k='PIPELINE' THEN
  IF pid IS NULL THEN PERFORM srm.workspace_fail('FIELD_INVALID','pipelineId');END IF;
  PERFORM srm.workspace_require('supplier.catalog.read');r:=srm.workspace_json_pipeline(pid);
  WITH matching AS(SELECT id FROM srm.supplier_pipeline_memberships WHERE organization_id=org AND pipeline_id=pid AND ended_at IS NULL)
  SELECT(SELECT count(*) FROM matching),(SELECT array_agg(id ORDER BY id) FROM(SELECT id FROM matching WHERE cursor_id IS NULL OR id>cursor_id ORDER BY id LIMIT lim+1) page) INTO total,ids;
  SELECT coalesce(jsonb_agg(srm.workspace_json_membership(m.id)||jsonb_build_object('supplierDisplayName',coalesce(nullif(btrim(a.display_name),''),'Nazwa nieuzupełniona'),'nipNormalized',a.nip) ORDER BY t.ord),'[]'::jsonb) INTO items
  FROM unnest(ids[1:lim]) WITH ORDINALITY t(x,ord)
  JOIN srm.supplier_pipeline_memberships m ON m.organization_id=org AND m.id=t.x
  JOIN srm.suppliers a ON a.organization_id=org AND a.id=m.supplier_id;
 ELSIF k='HISTORY' THEN
  PERFORM srm.workspace_require('supplier.category.read');PERFORM srm.workspace_require('supplier.pipeline.read');PERFORM srm.workspace_require('supplier.assignment.read');
  IF cursor_id IS NOT NULL THEN
   SELECT occurred_at INTO cursor_time FROM srm.supplier_workspace_events WHERE organization_id=org AND supplier_id=sid AND id=cursor_id;
   IF NOT FOUND THEN PERFORM srm.workspace_fail('FIELD_INVALID','cursor');END IF;
  END IF;
  WITH matching AS(SELECT id,occurred_at FROM srm.supplier_workspace_events WHERE organization_id=org AND supplier_id=sid)
  SELECT(SELECT count(*) FROM matching),(SELECT array_agg(id ORDER BY occurred_at,id) FROM(SELECT * FROM matching WHERE cursor_id IS NULL OR(occurred_at,id)>(cursor_time,cursor_id) ORDER BY occurred_at,id LIMIT lim+1) page) INTO total,ids;
  SELECT coalesce(jsonb_agg(jsonb_build_object('eventId',e.id,'actorAccountId',e.actor_account_id,'commandId',e.command_id,
   'occurredAt',e.occurred_at,'action',e.action,'supplierId',e.supplier_id,'pipelineId',e.pipeline_id,
   'before',e.before_state,'after',e.after_state) ORDER BY t.ord),'[]'::jsonb) INTO items
  FROM unnest(ids[1:lim]) WITH ORDINALITY t(x,ord) JOIN srm.supplier_workspace_events e ON e.organization_id=org AND e.id=t.x;
 END IF;
 next_id:=CASE WHEN coalesce(array_length(ids,1),0)>lim THEN ids[lim] ELSE NULL END;
 IF k='PIPELINE' THEN RETURN r||jsonb_build_object('memberships',jsonb_build_object('items',items,'totalCount',total,'nextCursor',next_id));END IF;
 RETURN jsonb_build_object('items',items,'totalCount',total,'nextCursor',next_id);
END $fn$;


CREATE FUNCTION srm.workspace_supplier_state(p_id uuid,p_expected bigint DEFAULT NULL,p_active boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;m srm.suppliers%ROWTYPE;p srm.supplier_workspace_profiles%ROWTYPE;v bigint;BEGIN
 s:=profitia_supplier_workspace.current_scope();PERFORM srm.workspace_require('supplier.catalog.read',p_id);
 SELECT * INTO m FROM srm.suppliers a WHERE a.organization_id=s.organisation_id AND a.id=p_id FOR UPDATE;
 IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
 SELECT * INTO p FROM srm.supplier_workspace_profiles a WHERE a.organization_id=s.organisation_id AND a.supplier_id=p_id;
 v:=coalesce(p.version,0);
 IF p_expected IS NOT NULL AND v<>p_expected THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
 IF p_active AND p.archived_at IS NOT NULL THEN PERFORM srm.workspace_fail('RECORD_ARCHIVED');END IF;
 RETURN jsonb_build_object('supplierId',m.id,'nip',m.nip,'displayName',coalesce(nullif(btrim(m.display_name),''),'Nazwa nieuzupełniona'),
  'version',v,'lifecycle',CASE WHEN p.archived_at IS NULL THEN 'ACTIVE' ELSE 'ARCHIVED' END,
  'contacts',coalesce(p.contacts,'[]'::jsonb),'relationshipOwnerAccountId',p.relationship_owner_account_id);
END $fn$;
CREATE FUNCTION srm.workspace_pipeline_state(p_id uuid,p_expected bigint DEFAULT NULL,p_active boolean DEFAULT true)
RETURNS srm.supplier_pipelines LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE org uuid:=(profitia_supplier_workspace.current_scope()).organisation_id;p srm.supplier_pipelines%ROWTYPE;BEGIN
 PERFORM srm.workspace_require('supplier.pipeline.read',p_id);
 SELECT * INTO p FROM srm.supplier_pipelines a WHERE a.organization_id=org AND a.id=p_id FOR UPDATE;
 IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
 IF p_expected IS NOT NULL AND p.version<>p_expected THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
 IF p_active AND p.archived_at IS NOT NULL THEN PERFORM srm.workspace_fail('RECORD_ARCHIVED');END IF;RETURN p;
END $fn$;
CREATE FUNCTION srm.workspace_category_state(p_id uuid,p_expected bigint DEFAULT NULL,p_active boolean DEFAULT true)
RETURNS srm.supplier_categories LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE org uuid:=(profitia_supplier_workspace.current_scope()).organisation_id;p srm.supplier_categories%ROWTYPE;BEGIN
 PERFORM srm.workspace_require('supplier.category.read',p_id);
 -- All category writers hold the same organization lock; no unrelated WRITE
 -- permission is needed merely to check a category while defining a process.
 SELECT * INTO p FROM srm.supplier_categories a WHERE a.organization_id=org AND a.id=p_id;
 IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
 IF p_expected IS NOT NULL AND p.version<>p_expected THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
 IF p_active AND p.archived_at IS NOT NULL THEN PERFORM srm.workspace_fail('RECORD_ARCHIVED');END IF;RETURN p;
END $fn$;
CREATE FUNCTION srm.workspace_event(p_command text,p_action text,p_supplier uuid,p_pipeline uuid,p_before jsonb,p_after jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;BEGIN
 s:=profitia_supplier_workspace.current_scope();
 INSERT INTO srm.supplier_workspace_events(organization_id,actor_account_id,command_id,action,supplier_id,pipeline_id,before_state,after_state)
 VALUES(s.organisation_id,s.actor_id,p_command,p_action,p_supplier,p_pipeline,p_before,p_after);
END $fn$;
CREATE FUNCTION srm.workspace_end_membership(p_id uuid,p_reason text,p_command text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;m srm.supplier_pipeline_memberships%ROWTYPE;b jsonb;a jsonb;BEGIN
 s:=profitia_supplier_workspace.current_scope();PERFORM srm.workspace_require('supplier.assignment.write',p_id);
 SELECT * INTO m FROM srm.supplier_pipeline_memberships x WHERE x.organization_id=s.organisation_id AND x.id=p_id FOR UPDATE;
 IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
 IF m.ended_at IS NOT NULL THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
 b:=srm.workspace_json_membership(p_id);
 UPDATE srm.supplier_pipeline_memberships SET ended_at=clock_timestamp(),end_reason=p_reason,version=version+1,
  pipeline_name_at_end=b->>'pipelineName',stage_name_at_end=b->>'stageName',updated_by_account_id=s.actor_id
 WHERE organization_id=s.organisation_id AND id=p_id;
 a:=srm.workspace_json_membership(p_id);
 PERFORM srm.workspace_event(p_command,'MEMBERSHIP_'||p_reason,m.supplier_id,m.pipeline_id,b,a);RETURN a;
END $fn$;
CREATE FUNCTION srm.workspace_contacts(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c jsonb;out jsonb:='[]'::jsonb;id uuid;BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'array' OR jsonb_array_length(p)>20 THEN PERFORM srm.workspace_fail('FIELD_INVALID','contacts');END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(p) LOOP
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(c) k WHERE k NOT IN('contactId','name','role','email','phone'))
   OR jsonb_typeof(c->'name') IS DISTINCT FROM 'string' OR length(btrim(c->>'name')) NOT BETWEEN 1 AND 200
   OR c->>'role' IS NOT NULL AND length(c->>'role')>200
   OR c->>'email' IS NOT NULL AND(length(c->>'email')>254 OR c->>'email'!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
   OR c->>'phone' IS NOT NULL AND length(c->>'phone')>40 THEN PERFORM srm.workspace_fail('FIELD_INVALID','contacts');END IF;
  id:=coalesce((c->>'contactId')::uuid,gen_random_uuid());
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(out) x WHERE x->>'contactId'=id::text) THEN PERFORM srm.workspace_fail('FIELD_INVALID','contacts');END IF;
  out:=out||jsonb_build_array(jsonb_build_object('contactId',id,'name',c->>'name','role',c->>'role','email',c->>'email','phone',c->>'phone'));
 END LOOP;RETURN out;
END $fn$;
CREATE FUNCTION srm.workspace_command_fields() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT $schema${"SUPPLIER_CREATE":{"allowed":["nip","displayName","contacts","categoryIds","relationshipOwnerAccountId"],"required":["nip","displayName"]},"SUPPLIER_UPDATE":{"allowed":["supplierId","expectedVersion","nip","displayName","contacts","relationshipOwnerAccountId","confirmIdentifierChange"],"required":["supplierId","expectedVersion"]},"SUPPLIER_ARCHIVE":{"allowed":["supplierId","expectedVersion","expectedCount"],"required":["supplierId","expectedVersion","expectedCount"]},"SUPPLIER_RESTORE":{"allowed":["supplierId","expectedVersion"],"required":["supplierId","expectedVersion"]},"CATEGORY_CREATE":{"allowed":["name"],"required":["name"]},"CATEGORY_UPDATE":{"allowed":["categoryId","expectedVersion","name"],"required":["categoryId","expectedVersion","name"]},"CATEGORY_ARCHIVE":{"allowed":["categoryId","expectedVersion"],"required":["categoryId","expectedVersion"]},"CATEGORY_RESTORE":{"allowed":["categoryId","expectedVersion"],"required":["categoryId","expectedVersion"]},"SUPPLIER_CATEGORY_ADD":{"allowed":["supplierId","categoryId","expectedVersion"],"required":["supplierId","categoryId","expectedVersion"]},"SUPPLIER_CATEGORY_REMOVE":{"allowed":["supplierId","categoryId","expectedVersion"],"required":["supplierId","categoryId","expectedVersion"]},"PIPELINE_CREATE":{"allowed":["name","kind","categoryId","stages"],"required":["name","kind","stages"]},"PIPELINE_UPDATE":{"allowed":["pipelineId","expectedVersion","name"],"required":["pipelineId","expectedVersion","name"]},"PIPELINE_ARCHIVE":{"allowed":["pipelineId","expectedVersion","expectedCount"],"required":["pipelineId","expectedVersion","expectedCount"]},"PIPELINE_RESTORE":{"allowed":["pipelineId","expectedVersion"],"required":["pipelineId","expectedVersion"]},"STAGE_ADD":{"allowed":["pipelineId","expectedVersion","name","order"],"required":["pipelineId","expectedVersion","name","order"]},"STAGES_UPDATE":{"allowed":["pipelineId","expectedVersion","stages"],"required":["pipelineId","expectedVersion","stages"]},"STAGE_REMOVE":{"allowed":["pipelineId","stageId","expectedPipelineVersion","expectedCount","targetStageId"],"required":["pipelineId","stageId","expectedPipelineVersion","expectedCount"]},"MEMBERSHIP_ADD":{"allowed":["pipelineId","supplierId","stageId","expectedPipelineVersion"],"required":["pipelineId","supplierId","stageId","expectedPipelineVersion"]},"MEMBERSHIP_MOVE":{"allowed":["membershipId","stageId","expectedVersion","expectedPipelineVersion"],"required":["membershipId","stageId","expectedVersion","expectedPipelineVersion"]},"MEMBERSHIP_END":{"allowed":["membershipId","expectedVersion"],"required":["membershipId","expectedVersion"]},"SUPPLIER_TRANSFER":{"allowed":["supplierId","sourceMembershipId","sourceVersion","targetPipelineId","targetStageId","expectedTargetVersion","reason"],"required":["supplierId","sourceMembershipId","sourceVersion","targetPipelineId","targetStageId","expectedTargetVersion"]}}$schema$::jsonb
$fn$;
CREATE FUNCTION srm.workspace_validate_command(p jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb:=p->'data';shape jsonb;key text;v jsonb;command text:=p->>'command';BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p))<>4
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('contractVersion','idempotencyKey','command','data'))
  OR p->>'contractVersion' IS DISTINCT FROM '1.0.0' OR jsonb_typeof(p->'idempotencyKey') IS DISTINCT FROM 'string'
  OR p->>'idempotencyKey'!~'^[a-zA-Z0-9_-]{8,128}$' OR jsonb_typeof(d) IS DISTINCT FROM 'object'
  THEN PERFORM srm.workspace_fail('FIELD_INVALID','body');END IF;
 shape:=srm.workspace_command_fields()->command;
 IF shape IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE NOT(shape->'allowed' ? k))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(shape->'required') k WHERE NOT(d ? k))
 THEN PERFORM srm.workspace_fail('FIELD_INVALID','data');END IF;
 FOR key,v IN SELECT * FROM jsonb_each(d) LOOP
  IF key ~ 'Version$' OR key='expectedVersion' OR key='expectedCount' OR key='order' THEN
   IF jsonb_typeof(v) IS DISTINCT FROM 'number' OR (v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric)
    OR (v#>>'{}')::numeric<0 OR (v#>>'{}')::numeric>9007199254740991 THEN PERFORM srm.workspace_fail('FIELD_INVALID',key);END IF;
  ELSIF key IN('displayName','name','reason') THEN
   IF jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(btrim(v#>>'{}')) NOT BETWEEN 1 AND (CASE WHEN key='reason' THEN 500 ELSE 200 END)
    OR (v#>>'{}')~'[[:cntrl:]]' THEN PERFORM srm.workspace_fail('FIELD_INVALID',key);END IF;
  ELSIF key='categoryIds' THEN
   IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)>50
    OR(SELECT count(DISTINCT x) FROM jsonb_array_elements_text(v) x)<>jsonb_array_length(v) THEN PERFORM srm.workspace_fail('FIELD_INVALID',key);END IF;
  ELSIF key='stages' THEN
   IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v) NOT BETWEEN 1 AND 50 THEN PERFORM srm.workspace_fail('FIELD_INVALID',key);END IF;
  END IF;
 END LOOP;
 IF d ? 'nip' AND srm.workspace_valid_nip(d->>'nip') IS NOT TRUE THEN
  PERFORM srm.workspace_fail(CASE WHEN coalesce(d->>'nip','')='' THEN 'NIP_REQUIRED' ELSE 'INVALID_NIP' END,'nip');END IF;
END $fn$;


CREATE FUNCTION srm.workspace_put_profile(p_supplier uuid,p_old jsonb,p_contacts jsonb,p_owner uuid,p_archived timestamptz) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;v bigint:=(p_old->>'version')::bigint;BEGIN
 s:=profitia_supplier_workspace.current_scope();
 IF v=0 THEN
  INSERT INTO srm.supplier_workspace_profiles(organization_id,supplier_id,contacts,relationship_owner_account_id,archived_at,created_by_account_id,updated_by_account_id)
  VALUES(s.organisation_id,p_supplier,p_contacts,p_owner,p_archived,s.actor_id,s.actor_id);RETURN 1;
 END IF;
 UPDATE srm.supplier_workspace_profiles SET contacts=p_contacts,relationship_owner_account_id=p_owner,archived_at=p_archived,
  version=version+1,updated_by_account_id=s.actor_id,updated_at=clock_timestamp()
 WHERE organization_id=s.organisation_id AND supplier_id=p_supplier AND version=v RETURNING version INTO v;
 IF NOT FOUND THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;RETURN v;
END $fn$;

CREATE FUNCTION srm.workspace_apply(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;org uuid;actor uuid;cmd text:=p->>'command';key text:=p->>'idempotencyKey';d jsonb:=p->'data';
 v_id uuid;v_supplier uuid;v_pipeline uuid;v_stage uuid;v_target uuid;v_category uuid;v_owner uuid;v_nip text;v_name text;
 v_before jsonb;v_after jsonb;v_contacts jsonb;v_result jsonb;v_item jsonb;v_version bigint;v_count bigint;v_changed bigint;
 v_old_order integer;v_order integer;v_status integer:=200;v_life timestamptz;
 v_pipe srm.supplier_pipelines%ROWTYPE;v_other srm.supplier_pipelines%ROWTYPE;v_cat srm.supplier_categories%ROWTYPE;
 v_member srm.supplier_pipeline_memberships%ROWTYPE;v_stage_row srm.supplier_pipeline_stages%ROWTYPE;
 v_row record;v_ids uuid[];v_input_ids uuid[];v_names text[];v_orders integer[];
BEGIN
 s:=profitia_supplier_workspace.current_scope();org:=s.organisation_id;actor:=s.actor_id;
 IF s.scope_id IS NULL OR s.access_mode<>'WRITE' THEN PERFORM srm.workspace_fail('FORBIDDEN');END IF;
 PERFORM srm.workspace_validate_command(p);
 PERFORM profitia_supplier_workspace.ensure_organisation();
 CASE cmd
 WHEN 'SUPPLIER_CREATE' THEN
  v_nip:=d->>'nip';v_name:=d->>'displayName';
  IF d ? 'nip' AND srm.workspace_valid_nip(v_nip) IS NOT TRUE THEN PERFORM srm.workspace_fail('INVALID_NIP','nip');END IF;
  IF v_name IS NULL OR length(btrim(v_name)) NOT BETWEEN 1 AND 200 THEN PERFORM srm.workspace_fail('FIELD_INVALID','displayName');END IF;
  PERFORM 1 FROM srm.suppliers a WHERE a.organization_id=org AND a.nip=v_nip;
  IF FOUND THEN PERFORM srm.workspace_fail('DUPLICATE_NIP','nip');END IF;
  v_owner:=(d->>'relationshipOwnerAccountId')::uuid;v_contacts:=srm.workspace_contacts(coalesce(d->'contacts','[]'::jsonb));v_supplier:=gen_random_uuid();
  INSERT INTO srm.suppliers(organization_id,id,nip,display_name) VALUES(org,v_supplier,v_nip,v_name);
  INSERT INTO srm.supplier_workspace_profiles(organization_id,supplier_id,contacts,relationship_owner_account_id,created_by_account_id,updated_by_account_id)
   VALUES(org,v_supplier,v_contacts,v_owner,actor,actor);
  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(d->'categoryIds','[]'::jsonb)) LOOP
   v_category:=(v_item#>>'{}')::uuid;PERFORM srm.workspace_category_state(v_category);
   PERFORM srm.workspace_require('supplier.category.write',v_category);
   INSERT INTO srm.supplier_category_links(organization_id,supplier_id,category_id,created_by_account_id) VALUES(org,v_supplier,v_category,actor);
  END LOOP;
  v_after:=srm.workspace_supplier_state(v_supplier);
  PERFORM srm.workspace_event(key,cmd,v_supplier,NULL,NULL,v_after||jsonb_build_object('categoryIds',coalesce(d->'categoryIds','[]'::jsonb)));
  v_result:=jsonb_build_object('supplierId',v_supplier,'version',1,'lifecycle','ACTIVE');v_status:=201;
 WHEN 'SUPPLIER_UPDATE' THEN
  v_supplier:=(d->>'supplierId')::uuid;v_before:=srm.workspace_supplier_state(v_supplier,(d->>'expectedVersion')::bigint);
  IF NOT(d ?| ARRAY['nip','displayName','contacts','relationshipOwnerAccountId']) THEN PERFORM srm.workspace_fail('FIELD_INVALID','data');END IF;
  v_nip:=coalesce(d->>'nip',v_before->>'nip');
  IF d ? 'nip' AND srm.workspace_valid_nip(v_nip) IS NOT TRUE THEN PERFORM srm.workspace_fail('INVALID_NIP','nip');END IF;
  IF v_nip IS DISTINCT FROM v_before->>'nip' THEN
   PERFORM 1 FROM srm.suppliers a WHERE a.organization_id=org AND a.nip=v_nip AND a.id<>v_supplier;
   IF FOUND THEN PERFORM srm.workspace_fail('DUPLICATE_NIP','nip');END IF;
   PERFORM srm.workspace_require('supplier.assignment.read');PERFORM srm.workspace_require('supplier.category.read');
   IF coalesce((d->>'confirmIdentifierChange')::boolean,false) IS NOT TRUE AND(
    EXISTS(SELECT 1 FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.supplier_id=v_supplier)
    OR EXISTS(SELECT 1 FROM srm.supplier_category_links c WHERE c.organization_id=org AND c.supplier_id=v_supplier)
    -- Legacy masters conservatively require confirmation; report ACLs never
    -- grant this catalogue receiver access to report/request contents.
    OR EXISTS(SELECT 1 FROM srm.suppliers a WHERE a.organization_id=org AND a.id=v_supplier
     AND a.created_at<=(SELECT installed_at FROM srm.supplier_workspace_installation WHERE singleton)))
    THEN PERFORM srm.workspace_fail('FIELD_INVALID','confirmIdentifierChange');END IF;
  END IF;
  v_contacts:=CASE WHEN d ? 'contacts' THEN srm.workspace_contacts(d->'contacts') ELSE v_before->'contacts' END;
  v_owner:=CASE WHEN d ? 'relationshipOwnerAccountId' THEN(d->>'relationshipOwnerAccountId')::uuid ELSE(v_before->>'relationshipOwnerAccountId')::uuid END;
  UPDATE srm.suppliers SET nip=v_nip,display_name=CASE WHEN d ? 'displayName' THEN d->>'displayName' ELSE display_name END,updated_at=clock_timestamp()
   WHERE organization_id=org AND id=v_supplier;
  v_version:=srm.workspace_put_profile(v_supplier,v_before,v_contacts,v_owner,NULL);
  v_after:=srm.workspace_supplier_state(v_supplier);
  PERFORM srm.workspace_event(key,cmd,v_supplier,NULL,v_before,v_after);
  v_result:=jsonb_build_object('supplierId',v_supplier,'version',v_version,'lifecycle','ACTIVE');
 WHEN 'SUPPLIER_ARCHIVE','SUPPLIER_RESTORE' THEN
  v_supplier:=(d->>'supplierId')::uuid;v_before:=srm.workspace_supplier_state(v_supplier,(d->>'expectedVersion')::bigint,false);
  IF(v_before->>'lifecycle'='ARCHIVED')=(cmd='SUPPLIER_ARCHIVE') THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
  v_count:=0;
  IF cmd='SUPPLIER_ARCHIVE' THEN
   PERFORM srm.workspace_require('supplier.assignment.read');
   SELECT count(*) INTO v_count FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.supplier_id=v_supplier AND m.ended_at IS NULL;
   IF v_count IS DISTINCT FROM(d->>'expectedCount')::bigint THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
   SELECT array_agg(DISTINCT m.pipeline_id) INTO v_ids FROM srm.supplier_pipeline_memberships m
    WHERE m.organization_id=org AND m.supplier_id=v_supplier AND m.ended_at IS NULL;
   FOR v_id IN SELECT m.id FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.supplier_id=v_supplier AND m.ended_at IS NULL ORDER BY m.id LOOP
    PERFORM srm.workspace_end_membership(v_id,'SUPPLIER_ARCHIVED',key);
   END LOOP;
   UPDATE srm.supplier_pipelines SET version=version+1,updated_by_account_id=actor,updated_at=clock_timestamp() WHERE organization_id=org AND id=ANY(v_ids);
  END IF;
  v_life:=CASE WHEN cmd='SUPPLIER_ARCHIVE' THEN clock_timestamp() ELSE NULL END;
  v_version:=srm.workspace_put_profile(v_supplier,v_before,v_before->'contacts',(v_before->>'relationshipOwnerAccountId')::uuid,v_life);
  v_after:=srm.workspace_supplier_state(v_supplier,NULL,false);
  PERFORM srm.workspace_event(key,cmd,v_supplier,NULL,v_before,v_after);
  v_result:=jsonb_build_object('supplierId',v_supplier,'version',v_version,'lifecycle',v_after->>'lifecycle','endedCount',v_count);
 WHEN 'CATEGORY_CREATE' THEN
  v_category:=gen_random_uuid();
  INSERT INTO srm.supplier_categories(organization_id,id,name,created_by_account_id,updated_by_account_id)
   VALUES(org,v_category,d->>'name',actor,actor);
  v_after:=srm.workspace_json_category(v_category);PERFORM srm.workspace_event(key,cmd,NULL,NULL,NULL,v_after);
  v_result:=v_after;v_status:=201;
 WHEN 'CATEGORY_UPDATE','CATEGORY_ARCHIVE','CATEGORY_RESTORE' THEN
  v_category:=(d->>'categoryId')::uuid;v_cat:=srm.workspace_category_state(v_category,(d->>'expectedVersion')::bigint,cmd='CATEGORY_UPDATE');
  v_before:=srm.workspace_json_category(v_category);
  IF cmd<>'CATEGORY_UPDATE' AND(v_cat.archived_at IS NOT NULL)=(cmd='CATEGORY_ARCHIVE') THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
  UPDATE srm.supplier_categories SET name=CASE WHEN cmd='CATEGORY_UPDATE' THEN d->>'name' ELSE name END,
   archived_at=CASE WHEN cmd='CATEGORY_ARCHIVE' THEN clock_timestamp() WHEN cmd='CATEGORY_RESTORE' THEN NULL ELSE archived_at END,
   version=version+1,updated_by_account_id=actor,updated_at=clock_timestamp() WHERE organization_id=org AND id=v_category;
  v_after:=srm.workspace_json_category(v_category);PERFORM srm.workspace_event(key,cmd,NULL,NULL,v_before,v_after);v_result:=v_after;
 WHEN 'SUPPLIER_CATEGORY_ADD','SUPPLIER_CATEGORY_REMOVE' THEN
  v_supplier:=(d->>'supplierId')::uuid;v_category:=(d->>'categoryId')::uuid;
  v_before:=srm.workspace_supplier_state(v_supplier,(d->>'expectedVersion')::bigint);
  v_cat:=srm.workspace_category_state(v_category,NULL,cmd='SUPPLIER_CATEGORY_ADD');
  IF cmd='SUPPLIER_CATEGORY_ADD' THEN
   PERFORM 1 FROM srm.supplier_category_links c WHERE c.organization_id=org AND c.supplier_id=v_supplier AND c.category_id=v_category AND c.ended_at IS NULL;
   IF FOUND THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
   INSERT INTO srm.supplier_category_links(organization_id,supplier_id,category_id,created_by_account_id) VALUES(org,v_supplier,v_category,actor);
  ELSE
   UPDATE srm.supplier_category_links SET ended_at=clock_timestamp(),ended_by_account_id=actor
    WHERE organization_id=org AND supplier_id=v_supplier AND category_id=v_category AND ended_at IS NULL;
   IF NOT FOUND THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
  END IF;
  v_version:=srm.workspace_put_profile(v_supplier,v_before,v_before->'contacts',(v_before->>'relationshipOwnerAccountId')::uuid,NULL);
  v_after:=jsonb_build_object('supplierId',v_supplier,'categoryId',v_category,'version',v_version,'linked',cmd='SUPPLIER_CATEGORY_ADD');
  PERFORM srm.workspace_event(key,cmd,v_supplier,NULL,jsonb_build_object('categoryId',v_category,'linked',cmd='SUPPLIER_CATEGORY_REMOVE'),v_after);
  v_result:=v_after;
 WHEN 'PIPELINE_CREATE' THEN
  IF d->>'kind' NOT IN('SUPPLIER','CATEGORY') OR d->>'kind' IS NULL THEN PERFORM srm.workspace_fail('FIELD_INVALID','kind');END IF;
  v_category:=(d->>'categoryId')::uuid;
  IF(d->>'kind'='CATEGORY') IS DISTINCT FROM(v_category IS NOT NULL) THEN PERFORM srm.workspace_fail('FIELD_INVALID','categoryId');END IF;
  IF v_category IS NOT NULL THEN PERFORM srm.workspace_category_state(v_category);END IF;
  v_pipeline:=gen_random_uuid();
  INSERT INTO srm.supplier_pipelines(organization_id,id,kind,name,category_id,created_by_account_id,updated_by_account_id)
   VALUES(org,v_pipeline,d->>'kind',d->>'name',v_category,actor,actor);
  v_order:=0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(d->'stages') LOOP
   IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' OR jsonb_typeof(v_item->'name') IS DISTINCT FROM 'string'
    OR length(btrim(v_item->>'name')) NOT BETWEEN 1 AND 200 THEN PERFORM srm.workspace_fail('FIELD_INVALID','stages');END IF;
   INSERT INTO srm.supplier_pipeline_stages(organization_id,pipeline_id,name,stage_order) VALUES(org,v_pipeline,v_item->>'name',v_order);v_order:=v_order+1;
  END LOOP;
  v_after:=jsonb_build_object('pipelineId',v_pipeline,'kind',d->>'kind','name',d->>'name','categoryId',v_category,'version',1,
   'stages',(SELECT jsonb_agg(jsonb_build_object('stageId',a.id,'name',a.name,'order',a.stage_order) ORDER BY a.stage_order) FROM srm.supplier_pipeline_stages a WHERE a.organization_id=org AND a.pipeline_id=v_pipeline AND a.deleted_at IS NULL));
  PERFORM srm.workspace_event(key,cmd,NULL,v_pipeline,NULL,v_after);v_result:=v_after;v_status:=201;
 WHEN 'PIPELINE_UPDATE','PIPELINE_ARCHIVE','PIPELINE_RESTORE' THEN
  v_pipeline:=(d->>'pipelineId')::uuid;v_pipe:=srm.workspace_pipeline_state(v_pipeline,(d->>'expectedVersion')::bigint,cmd='PIPELINE_UPDATE');
  v_before:=jsonb_build_object('pipelineId',v_pipe.id,'name',v_pipe.name,'version',v_pipe.version,'lifecycle',CASE WHEN v_pipe.archived_at IS NULL THEN 'ACTIVE' ELSE 'ARCHIVED' END);
  IF cmd<>'PIPELINE_UPDATE' AND(v_pipe.archived_at IS NOT NULL)=(cmd='PIPELINE_ARCHIVE') THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
  v_count:=0;
  IF cmd='PIPELINE_ARCHIVE' THEN
   PERFORM srm.workspace_require('supplier.assignment.read');
   SELECT count(*) INTO v_count FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.pipeline_id=v_pipeline AND m.ended_at IS NULL;
   IF v_count IS DISTINCT FROM(d->>'expectedCount')::bigint THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
   FOR v_id IN SELECT m.id FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.pipeline_id=v_pipeline AND m.ended_at IS NULL ORDER BY m.id LOOP
    PERFORM srm.workspace_end_membership(v_id,'PIPELINE_ARCHIVED',key);
   END LOOP;
  END IF;
  UPDATE srm.supplier_pipelines SET name=CASE WHEN cmd='PIPELINE_UPDATE' THEN d->>'name' ELSE name END,
   archived_at=CASE WHEN cmd='PIPELINE_ARCHIVE' THEN clock_timestamp() WHEN cmd='PIPELINE_RESTORE' THEN NULL ELSE archived_at END,
   version=version+1,updated_by_account_id=actor,updated_at=clock_timestamp() WHERE organization_id=org AND id=v_pipeline RETURNING version INTO v_version;
  v_after:=jsonb_build_object('pipelineId',v_pipeline,'name',CASE WHEN cmd='PIPELINE_UPDATE' THEN d->>'name' ELSE v_pipe.name END,
   'version',v_version,'lifecycle',CASE WHEN cmd='PIPELINE_ARCHIVE' THEN 'ARCHIVED' ELSE 'ACTIVE' END,'endedCount',v_count);
  PERFORM srm.workspace_event(key,cmd,NULL,v_pipeline,v_before,v_after);v_result:=v_after;

 WHEN 'STAGE_ADD','STAGES_UPDATE','STAGE_REMOVE' THEN
  v_pipeline:=(d->>'pipelineId')::uuid;
  v_pipe:=srm.workspace_pipeline_state(v_pipeline,NULL,true);
  IF v_pipe.version IS DISTINCT FROM coalesce((d->>'expectedPipelineVersion')::bigint,(d->>'expectedVersion')::bigint)
   THEN PERFORM srm.workspace_fail(CASE WHEN cmd='STAGE_REMOVE' THEN 'PIPELINE_CHANGED' ELSE 'VERSION_CONFLICT' END);END IF;
  SELECT array_agg(t.id ORDER BY t.stage_order) INTO v_ids FROM srm.supplier_pipeline_stages t
   WHERE t.organization_id=org AND t.pipeline_id=v_pipeline AND t.deleted_at IS NULL;
  v_count:=coalesce(array_length(v_ids,1),0);
  v_before:=jsonb_build_object('pipelineId',v_pipeline,'version',v_pipe.version,'stages',
   (SELECT jsonb_agg(jsonb_build_object('stageId',t.id,'name',t.name,'order',t.stage_order) ORDER BY t.stage_order)
    FROM srm.supplier_pipeline_stages t WHERE t.organization_id=org AND t.pipeline_id=v_pipeline AND t.deleted_at IS NULL));
  v_changed:=0;
  IF cmd='STAGE_ADD' THEN
   v_order:=(d->>'order')::int;
   IF v_order<0 OR v_order>v_count OR v_count>=50 THEN PERFORM srm.workspace_fail('FIELD_INVALID','order');END IF;
   UPDATE srm.supplier_pipeline_stages SET stage_order=stage_order+1 WHERE organization_id=org AND pipeline_id=v_pipeline AND deleted_at IS NULL AND stage_order>=v_order;
   v_stage:=gen_random_uuid();
   INSERT INTO srm.supplier_pipeline_stages(organization_id,pipeline_id,id,name,stage_order) VALUES(org,v_pipeline,v_stage,d->>'name',v_order);
  ELSIF cmd='STAGES_UPDATE' THEN
   SELECT array_agg((x->>'stageId')::uuid),array_agg((x->>'order')::int),
    array_agg(lower(btrim(regexp_replace(normalize(x->>'name',NFKC),'[[:space:]]+',' ','g'))))
    INTO v_input_ids,v_orders,v_names FROM jsonb_array_elements(d->'stages') x;
   IF coalesce(array_length(v_input_ids,1),0)<>v_count OR NOT(v_input_ids @> v_ids AND v_ids @> v_input_ids)
    OR (SELECT count(DISTINCT x) FROM unnest(v_input_ids) x)<>v_count
    OR (SELECT count(DISTINCT x) FROM unnest(v_orders) x)<>v_count
    OR (SELECT count(DISTINCT x) FROM unnest(v_names) x)<>v_count
    OR EXISTS(SELECT 1 FROM unnest(v_orders) x WHERE x<0 OR x>=v_count)
    OR EXISTS(SELECT 1 FROM unnest(v_names) x WHERE x IS NULL OR length(x) NOT BETWEEN 1 AND 200)
    THEN PERFORM srm.workspace_fail('FIELD_INVALID','stages');END IF;
   -- All rows are restored in this transaction. Temporarily excluding them
   -- from the partial name index permits a valid simultaneous name swap.
   UPDATE srm.supplier_pipeline_stages SET deleted_at=clock_timestamp(),stage_order=NULL
    WHERE organization_id=org AND pipeline_id=v_pipeline AND deleted_at IS NULL;
   FOR v_item IN SELECT value FROM jsonb_array_elements(d->'stages') LOOP
    UPDATE srm.supplier_pipeline_stages SET deleted_at=NULL,name=v_item->>'name',stage_order=(v_item->>'order')::int
     WHERE organization_id=org AND pipeline_id=v_pipeline AND id=(v_item->>'stageId')::uuid;
   END LOOP;
  ELSE
   v_stage:=(d->>'stageId')::uuid;v_target:=(d->>'targetStageId')::uuid;
   PERFORM srm.workspace_require('supplier.assignment.read');
   SELECT * INTO v_stage_row FROM srm.supplier_pipeline_stages t WHERE t.organization_id=org AND t.pipeline_id=v_pipeline AND t.id=v_stage AND t.deleted_at IS NULL;
   IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
   IF v_count<=1 THEN PERFORM srm.workspace_fail('LAST_STAGE');END IF;
   SELECT count(*) INTO v_changed FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.pipeline_id=v_pipeline AND m.stage_id=v_stage AND m.ended_at IS NULL;
   IF v_changed IS DISTINCT FROM(d->>'expectedCount')::bigint THEN PERFORM srm.workspace_fail('PIPELINE_CHANGED');END IF;
   IF v_changed>0 AND v_target IS NULL OR v_target=v_stage THEN PERFORM srm.workspace_fail('FIELD_INVALID','targetStageId');END IF;
   IF v_target IS NOT NULL THEN
    PERFORM 1 FROM srm.supplier_pipeline_stages t WHERE t.organization_id=org AND t.pipeline_id=v_pipeline AND t.id=v_target AND t.deleted_at IS NULL;
    IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
   END IF;
   FOR v_member IN SELECT m.* FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.pipeline_id=v_pipeline AND m.stage_id=v_stage AND m.ended_at IS NULL ORDER BY m.id LOOP
    v_after:=srm.workspace_json_membership(v_member.id);
    PERFORM srm.workspace_require('supplier.assignment.write',v_member.id);
    UPDATE srm.supplier_pipeline_memberships SET stage_id=v_target,version=version+1,updated_by_account_id=actor WHERE organization_id=org AND id=v_member.id;
    PERFORM srm.workspace_event(key,'STAGE_REMOVAL_MOVED',v_member.supplier_id,v_pipeline,v_after,srm.workspace_json_membership(v_member.id));
   END LOOP;
   v_old_order:=v_stage_row.stage_order;
   UPDATE srm.supplier_pipeline_stages SET deleted_at=clock_timestamp(),stage_order=NULL WHERE organization_id=org AND id=v_stage;
   UPDATE srm.supplier_pipeline_stages SET stage_order=stage_order-1
    WHERE organization_id=org AND pipeline_id=v_pipeline AND deleted_at IS NULL AND stage_order>v_old_order;
  END IF;
  UPDATE srm.supplier_pipelines SET version=version+1,updated_by_account_id=actor,updated_at=clock_timestamp() WHERE organization_id=org AND id=v_pipeline RETURNING version INTO v_version;
  v_after:=jsonb_build_object('pipelineId',v_pipeline,'version',v_version,'stages',
   (SELECT jsonb_agg(jsonb_build_object('stageId',t.id,'name',t.name,'order',t.stage_order) ORDER BY t.stage_order)
    FROM srm.supplier_pipeline_stages t WHERE t.organization_id=org AND t.pipeline_id=v_pipeline AND t.deleted_at IS NULL));
  PERFORM srm.workspace_event(key,cmd,NULL,v_pipeline,v_before,v_after);
  v_result:=v_after||jsonb_build_object('stageId',v_stage,'targetStageId',v_target,'movedCount',v_changed);
 WHEN 'MEMBERSHIP_ADD' THEN
  v_supplier:=(d->>'supplierId')::uuid;v_pipeline:=(d->>'pipelineId')::uuid;v_stage:=(d->>'stageId')::uuid;
  v_before:=srm.workspace_supplier_state(v_supplier);
  IF srm.workspace_valid_nip(v_before->>'nip') IS NOT TRUE THEN PERFORM srm.workspace_fail('INVALID_NIP','nip');END IF;
  v_pipe:=srm.workspace_pipeline_state(v_pipeline,(d->>'expectedPipelineVersion')::bigint);
  PERFORM 1 FROM srm.supplier_pipeline_stages t WHERE t.organization_id=org AND t.pipeline_id=v_pipeline AND t.id=v_stage AND t.deleted_at IS NULL;
  IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
  IF v_pipe.kind='SUPPLIER' AND EXISTS(SELECT 1 FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.supplier_id=v_supplier AND m.kind='SUPPLIER' AND m.ended_at IS NULL)
   THEN PERFORM srm.workspace_fail('ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS');END IF;
  PERFORM 1 FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.supplier_id=v_supplier AND m.pipeline_id=v_pipeline AND m.ended_at IS NULL;
  IF FOUND THEN PERFORM srm.workspace_fail('VERSION_CONFLICT','supplierId');END IF;
  v_id:=gen_random_uuid();
  -- No supplier-category link is created: classification and process are independent.
  INSERT INTO srm.supplier_pipeline_memberships(organization_id,id,supplier_id,pipeline_id,kind,stage_id,created_by_account_id,updated_by_account_id)
   VALUES(org,v_id,v_supplier,v_pipeline,v_pipe.kind,v_stage,actor,actor);
  UPDATE srm.supplier_pipelines SET version=version+1,updated_by_account_id=actor,updated_at=clock_timestamp() WHERE organization_id=org AND id=v_pipeline RETURNING version INTO v_version;
  v_after:=srm.workspace_json_membership(v_id);PERFORM srm.workspace_event(key,cmd,v_supplier,v_pipeline,NULL,v_after);
  v_result:=v_after||jsonb_build_object('pipelineVersion',v_version);v_status:=201;
 WHEN 'MEMBERSHIP_MOVE','MEMBERSHIP_END' THEN
  v_id:=(d->>'membershipId')::uuid;PERFORM srm.workspace_require('supplier.assignment.write',v_id);
  SELECT * INTO v_member FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.id=v_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
  IF v_member.ended_at IS NOT NULL OR v_member.version IS DISTINCT FROM(d->>'expectedVersion')::bigint THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
  v_supplier:=v_member.supplier_id;v_pipeline:=v_member.pipeline_id;
  v_before:=srm.workspace_json_membership(v_id);
  v_pipe:=srm.workspace_pipeline_state(v_pipeline,CASE WHEN cmd='MEMBERSHIP_MOVE' THEN(d->>'expectedPipelineVersion')::bigint ELSE NULL END);
  IF cmd='MEMBERSHIP_MOVE' THEN
   v_stage:=(d->>'stageId')::uuid;
   PERFORM 1 FROM srm.supplier_pipeline_stages t WHERE t.organization_id=org AND t.pipeline_id=v_pipeline AND t.id=v_stage AND t.deleted_at IS NULL;
   IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
   IF v_stage=v_member.stage_id THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
   UPDATE srm.supplier_pipeline_memberships SET stage_id=v_stage,version=version+1,updated_by_account_id=actor WHERE organization_id=org AND id=v_id;
   v_after:=srm.workspace_json_membership(v_id);PERFORM srm.workspace_event(key,cmd,v_supplier,v_pipeline,v_before,v_after);
  ELSE
   v_after:=srm.workspace_end_membership(v_id,'ENDED',key);
  END IF;
  UPDATE srm.supplier_pipelines SET version=version+1,updated_by_account_id=actor,updated_at=clock_timestamp() WHERE organization_id=org AND id=v_pipeline RETURNING version INTO v_version;
  v_result:=v_after||jsonb_build_object('pipelineVersion',v_version);
 WHEN 'SUPPLIER_TRANSFER' THEN
  v_supplier:=(d->>'supplierId')::uuid;v_id:=(d->>'sourceMembershipId')::uuid;
  PERFORM srm.workspace_supplier_state(v_supplier);PERFORM srm.workspace_require('supplier.assignment.write',v_id);
  SELECT * INTO v_member FROM srm.supplier_pipeline_memberships m WHERE m.organization_id=org AND m.id=v_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
  IF v_member.supplier_id<>v_supplier OR v_member.kind<>'SUPPLIER' THEN PERFORM srm.workspace_fail('FIELD_INVALID','sourceMembershipId');END IF;
  IF v_member.ended_at IS NOT NULL OR v_member.version IS DISTINCT FROM(d->>'sourceVersion')::bigint THEN PERFORM srm.workspace_fail('VERSION_CONFLICT');END IF;
  v_pipeline:=(d->>'targetPipelineId')::uuid;v_stage:=(d->>'targetStageId')::uuid;
  v_pipe:=srm.workspace_pipeline_state(v_member.pipeline_id);v_other:=srm.workspace_pipeline_state(v_pipeline,(d->>'expectedTargetVersion')::bigint);
  IF v_other.kind<>'SUPPLIER' OR v_pipe.kind<>'SUPPLIER' OR v_pipe.id=v_other.id THEN PERFORM srm.workspace_fail('FIELD_INVALID','targetPipelineId');END IF;
  PERFORM 1 FROM srm.supplier_pipeline_stages t WHERE t.organization_id=org AND t.pipeline_id=v_pipeline AND t.id=v_stage AND t.deleted_at IS NULL;
  IF NOT FOUND THEN PERFORM srm.workspace_fail('NOT_FOUND');END IF;
  v_before:=srm.workspace_json_membership(v_id);
  PERFORM srm.workspace_end_membership(v_id,'TRANSFERRED',key);
  v_target:=gen_random_uuid();
  INSERT INTO srm.supplier_pipeline_memberships(organization_id,id,supplier_id,pipeline_id,kind,stage_id,created_by_account_id,updated_by_account_id)
   VALUES(org,v_target,v_supplier,v_pipeline,'SUPPLIER',v_stage,actor,actor);
  UPDATE srm.supplier_pipelines SET version=version+1,updated_by_account_id=actor,updated_at=clock_timestamp() WHERE organization_id=org AND id IN(v_pipe.id,v_other.id);
  v_after:=srm.workspace_json_membership(v_target);
  PERFORM srm.workspace_event(key,cmd,v_supplier,v_pipeline,v_before,v_after||jsonb_build_object('reason',d->>'reason'));
  v_result:=jsonb_build_object('sourceMembershipId',v_id,'sourceVersion',v_member.version+1,
   'targetMembership',v_after,'sourcePipelineVersion',v_pipe.version+1,'targetPipelineVersion',v_other.version+1);v_status:=201;
 ELSE PERFORM srm.workspace_fail('FIELD_INVALID','command');
 END CASE;
 RETURN jsonb_build_object('status',v_status,'result',v_result);
END $fn$;

CREATE OR REPLACE FUNCTION srm.supplier_pipelines_execute(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE descriptor jsonb;s profitia_supplier_workspace.scopes%ROWTYPE;v_result jsonb;v_receipt srm.supplier_workspace_receipts%ROWTYPE;
 v_digest text;v_code text;v_message text;v_detail text;v_field text;v_status integer;v_existing jsonb;v_nip text;
BEGIN
 descriptor:=profitia_supplier_workspace.assert_payload(p);s:=profitia_supplier_workspace.current_scope();
 IF s.scope_id IS NULL OR current_setting('transaction_isolation')<>'read committed'
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_workspace_installation WHERE singleton AND contract_version='1.0.0')
 THEN RAISE EXCEPTION 'Current admitted receiver transaction required' USING ERRCODE='42501';END IF;
 IF s.access_mode='READ' THEN
  BEGIN RETURN jsonb_build_object('ok',true,'replayed',false,'status',200,'result',srm.workspace_read(p));
  EXCEPTION WHEN raise_exception THEN
   GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT,v_detail=PG_EXCEPTION_DETAIL;
   IF v_message !~ '^SCP:[A-Z_]+$' THEN RAISE;END IF;
   v_code:=substr(v_message,5);v_field:=nullif(v_detail,'');
  WHEN invalid_text_representation OR invalid_parameter_value OR numeric_value_out_of_range THEN v_code:='FIELD_INVALID';v_field:='query';
  END;
 ELSE
  PERFORM srm.workspace_validate_command(p);
  -- One existing transaction/ledger. The organization lock serializes CAS,
  -- NIP races, stage counts and all lifecycle operations without global writes.
  PERFORM pg_advisory_xact_lock(hashtextextended('srm-workspace:'||s.organisation_id::text,0));
  v_digest:=encode(sha256(convert_to(profitia_supplier_workspace.canonical_json(p-'idempotencyKey'),'UTF8')),'hex');
  SELECT * INTO v_receipt FROM srm.supplier_workspace_receipts r
   WHERE r.organization_id=s.organisation_id AND r.actor_account_id=s.actor_id AND r.idempotency_key=p->>'idempotencyKey';
  IF FOUND THEN
   IF v_receipt.command_digest<>v_digest OR v_receipt.command_name IS DISTINCT FROM p->>'command'
    THEN RETURN jsonb_build_object('ok',false,'status',409,'code','IDEMPOTENCY_CONFLICT');END IF;
   RETURN v_receipt.result||jsonb_build_object('replayed',true);
  END IF;
  BEGIN
   v_result:=jsonb_build_object('ok',true,'replayed',false)||srm.workspace_apply(p);
   INSERT INTO srm.supplier_workspace_receipts(organization_id,actor_account_id,idempotency_key,command_digest,command_name,result)
    VALUES(s.organisation_id,s.actor_id,p->>'idempotencyKey',v_digest,p->>'command',v_result);
   RETURN v_result;
  EXCEPTION WHEN raise_exception THEN
   GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT,v_detail=PG_EXCEPTION_DETAIL;
   IF v_message !~ '^SCP:[A-Z_]+$' THEN RAISE;END IF;
   v_code:=substr(v_message,5);v_field:=nullif(v_detail,'');
  WHEN unique_violation THEN
   v_code:=CASE WHEN p->>'command' IN('SUPPLIER_CREATE','SUPPLIER_UPDATE') THEN 'DUPLICATE_NIP'
    WHEN p->>'command' IN('MEMBERSHIP_ADD','SUPPLIER_TRANSFER') THEN 'ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS' ELSE 'FIELD_INVALID' END;
   v_field:=CASE WHEN v_code='DUPLICATE_NIP' THEN 'nip' WHEN v_code='FIELD_INVALID' THEN 'name' ELSE NULL END;
  WHEN check_violation THEN
   GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
   v_code:=CASE WHEN v_message~'^SCP:[A-Z_]+$' THEN substr(v_message,5) ELSE 'FIELD_INVALID' END;
  WHEN foreign_key_violation THEN v_code:='NOT_FOUND';
  WHEN insufficient_privilege THEN v_code:='FORBIDDEN';
  WHEN invalid_text_representation OR invalid_parameter_value OR numeric_value_out_of_range OR not_null_violation THEN v_code:='FIELD_INVALID';v_field:='data';
  END;
 END IF;
 IF v_code='DUPLICATE_NIP' THEN
  v_nip:=p->'data'->>'nip';
  SELECT jsonb_build_object('supplierId',a.id,'displayName',coalesce(nullif(btrim(a.display_name),''),'Nazwa nieuzupełniona'),
   'lifecycle',CASE WHEN b.archived_at IS NULL THEN 'ACTIVE' ELSE 'ARCHIVED' END) INTO v_existing
   FROM srm.suppliers a LEFT JOIN srm.supplier_workspace_profiles b ON b.organization_id=a.organization_id AND b.supplier_id=a.id
   WHERE a.organization_id=s.organisation_id AND a.nip=v_nip;
  IF v_existing IS NULL THEN v_code:='VERSION_CONFLICT';END IF;
 END IF;
 v_status:=CASE WHEN v_code IN('NIP_REQUIRED','INVALID_NIP','FIELD_INVALID') THEN 422 WHEN v_code='NOT_FOUND' THEN 404
  WHEN v_code='FORBIDDEN' THEN 403 WHEN v_code IN('DUPLICATE_NIP','ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS','VERSION_CONFLICT','PIPELINE_CHANGED','IDEMPOTENCY_CONFLICT','LAST_STAGE','RECORD_ARCHIVED') THEN 409 ELSE 503 END;
 RETURN jsonb_strip_nulls(jsonb_build_object('ok',false,'status',v_status,'code',coalesce(v_code,'UNAVAILABLE'),
  'fieldErrors',CASE WHEN v_field IS NOT NULL THEN jsonb_build_object(v_field,CASE WHEN v_field='nip' THEN 'Podaj poprawny NIP firmy.' ELSE 'Sprawdź wartość pola.' END) END,
  'existingSupplier',v_existing));
END $fn$;

CREATE TABLE srm.supplier_workspace_commands_installation(
 singleton boolean PRIMARY KEY CHECK(singleton),contract_version text NOT NULL CHECK(contract_version='1.0.0'),
 source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$'),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'));
ALTER TABLE srm.supplier_workspace_commands_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.supplier_workspace_commands_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.supplier_workspace_commands_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON srm.supplier_workspace_commands_installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_workspace.immutable();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON srm.supplier_workspace_commands_installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_workspace.immutable();
INSERT INTO srm.supplier_workspace_commands_installation VALUES(true,'1.0.0',current_setting('profitia.install.source_sha'),current_setting('profitia.install.commands_digest'));
REVOKE ALL ON srm.supplier_workspace_commands_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION
 srm.workspace_fail(text,text),srm.workspace_require(text,uuid),
 srm.workspace_json_category(uuid),srm.workspace_json_membership(uuid),srm.workspace_json_pipeline(uuid),srm.workspace_json_supplier(uuid,boolean),
 srm.workspace_read(jsonb),srm.workspace_supplier_state(uuid,bigint,boolean),srm.workspace_pipeline_state(uuid,bigint,boolean),
 srm.workspace_category_state(uuid,bigint,boolean),srm.workspace_event(text,text,uuid,uuid,jsonb,jsonb),
 srm.workspace_end_membership(uuid,text,text),srm.workspace_contacts(jsonb),srm.workspace_command_fields(),srm.workspace_validate_command(jsonb),
 srm.workspace_put_profile(uuid,jsonb,jsonb,uuid,timestamptz),srm.workspace_apply(jsonb),srm.supplier_pipelines_execute(jsonb)
 FROM PUBLIC;
