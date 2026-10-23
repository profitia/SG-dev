-- Optional physical optimization only. No authority/function/SDK/receipt,
-- installation digest, grant, role, limit, policy or business row changes.
-- The unchanged active_in_transaction query does not include `event ?
-- 'requestWork'`, so it cannot use SQL016's narrower partial index.
DO $guard$
DECLARE existing oid; expected text := $definition$CREATE INDEX native_work_current_transaction_idx ON profitia_access.security_events USING btree (application_id, environment, (((event -> 'requestWork'::text) ->> 'transactionId'::text))) WHERE (phase = 'INTENT'::text)$definition$;
BEGIN
 IF current_user <> 'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
   OR to_regprocedure('profitia_request_work.active_in_transaction()') IS NULL
   OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='profitia_access.security_events'::regclass
    AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity) THEN
  RAISE EXCEPTION 'Existing controlled E1 native work installation required' USING ERRCODE='42501';
 END IF;
 existing := to_regclass('profitia_access.native_work_current_transaction_idx');
 IF existing IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_index i ON i.indexrelid=c.oid
   WHERE c.oid=existing AND c.relowner='profitia_access_owner'::regrole
    AND i.indrelid='profitia_access.security_events'::regclass AND i.indisvalid AND i.indisready
    AND NOT i.indisunique AND pg_get_indexdef(c.oid)=expected) THEN
  RAISE EXCEPTION 'Current-work index source drift; reconciliation required' USING ERRCODE='42501';
 END IF;
END $guard$;
CREATE INDEX IF NOT EXISTS native_work_current_transaction_idx
 ON profitia_access.security_events(application_id,environment,((event->'requestWork'->>'transactionId')))
 WHERE phase='INTENT';
