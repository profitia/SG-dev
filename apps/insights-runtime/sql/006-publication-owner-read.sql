-- Development-only repair of the existing domain-owner publication path.
-- No runtime enrolment, membership, bypass-RLS, report approval or content write.
-- Apply only through a separately admitted, transactional owner installation.
DO $migration$
DECLARE p record; actual_qual text; actual_check text; owner_read text;
BEGIN
 IF current_user<>'insights_report_owner' OR current_database()<>'platform_private'
 OR NOT EXISTS(SELECT 1 FROM insights_private.subscription_migrations WHERE version='1.0.0' AND digest='fcd98c117513adb4d2f54c8d9ca1b3a54e741c81262fdeb7e6305f6c13df3f99')
 OR NOT EXISTS(SELECT 1 FROM insights_private.recurring_migrations WHERE version='1.0.0' AND digest='b6db2ac3c18fe0a15c66d7177b70f68d66a0d3d2b847de237e01e4785386c778')
 OR NOT EXISTS(SELECT 1 FROM insights_private.runtime_bindings WHERE binding->>'environment'='development'
  AND binding->>'projectId'='spring-bread-28217539' AND binding->>'branchId'='br-sparkling-term-b99l107x'
  AND binding->>'databaseName'='platform_private')
 THEN RAISE EXCEPTION 'PUBLICATION_READ_ACCEPTED_DEVELOPMENT_OWNER_REQUIRED';END IF;
 LOCK TABLE insights_private.report_jobs,insights_private.report_artifacts IN SHARE ROW EXCLUSIVE MODE;
 FOR p IN SELECT * FROM (VALUES
  ('report_jobs','current_job_read','id',
   '(insights_private.scope_allows(organisation_id, id, false) OR insights_private.subscription_job_scope(organisation_id, id, (business_key)::text, (document -> ''command''::text), document, false))',NULL::text),
  ('report_jobs','current_job_update','id',
   'insights_private.scope_allows(organisation_id, id, true)','insights_private.scope_allows(organisation_id, id, true)'),
  ('report_artifacts','current_artifact_read','job_id',
   'insights_private.scope_allows(organisation_id, job_id, false)',NULL::text)
 ) AS expected(table_name,policy_name,job_column,using_expression,check_expression) LOOP
  SELECT pg_get_expr(pol.polqual,pol.polrelid),pg_get_expr(pol.polwithcheck,pol.polrelid)
   INTO STRICT actual_qual,actual_check
   FROM pg_catalog.pg_policy pol JOIN pg_catalog.pg_class c ON c.oid=pol.polrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='insights_private' AND c.relname=p.table_name AND pol.polname=p.policy_name
   AND NOT pol.polpermissive AND pol.polroles=ARRAY[0::oid]
   AND c.relowner='insights_report_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity;
  IF actual_qual IS DISTINCT FROM p.using_expression OR actual_check IS DISTINCT FROM p.check_expression
  THEN RAISE EXCEPTION 'PUBLICATION_READ_POLICY_BASE_CHANGED';END IF;
  owner_read:=format(
   'CURRENT_USER = ''insights_report_owner'' AND SESSION_USER = ''neondb_owner'' AND organisation_id = current_setting(''insights.organisation_id'',true) AND %I::text = current_setting(''insights.publication_job_id'',true)',
   p.job_column);
  -- FOR SHARE in the existing publication validator also needs the UPDATE
  -- visibility policy. Its WITH CHECK is deliberately retained: no owner
  -- content UPDATE is admitted by this read/row-lock branch.
  EXECUTE format('ALTER POLICY %I ON insights_private.%I USING ((%s) OR (%s))',
   p.policy_name,p.table_name,actual_qual,owner_read);
 END LOOP;
 INSERT INTO insights_private.subscription_migrations(version,digest)
 VALUES('1.0.1-publication-owner-read','__PUBLICATION_OWNER_READ_SCHEMA_DIGEST__');
END $migration$;
