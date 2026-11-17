-- Optional physical optimization for append_audit's unchanged transaction-
-- mixing check. It deliberately searches across applications/environments.
-- No authority/function/SDK/receipt, installation digest, grant, role, policy,
-- limit or business row changes. Apply under the existing controlled owner.
DO $guard$
DECLARE existing oid; candidate record;
BEGIN
 IF current_user <> 'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
   OR to_regprocedure('profitia_access.append_audit(jsonb)') IS NULL
   OR to_regprocedure('profitia_request_work.audit_allows(jsonb)') IS NULL
   OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='profitia_access.security_events'::regclass
    AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity) THEN
  RAISE EXCEPTION 'Existing controlled E1 native audit installation required' USING ERRCODE='42501';
 END IF;
 FOR candidate IN SELECT * FROM (VALUES
  ('native_inspection_transaction_idx', $definition$CREATE INDEX native_inspection_transaction_idx ON profitia_access.security_events USING btree ((((event -> 'requestInspection'::text) ->> 'transactionId'::text))) WHERE ((phase = 'INTENT'::text) AND (((event -> 'requestInspection'::text) ->> 'transactionId'::text) IS NOT NULL))$definition$),
  ('native_continuation_transaction_idx', $definition$CREATE INDEX native_continuation_transaction_idx ON profitia_access.security_events USING btree ((((event -> 'requestContinuation'::text) ->> 'transactionId'::text))) WHERE ((phase = 'INTENT'::text) AND (((event -> 'requestContinuation'::text) ->> 'transactionId'::text) IS NOT NULL))$definition$)
 ) AS expected(name,definition) LOOP
  existing := to_regclass('profitia_access.'||candidate.name);
  IF existing IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_index i ON i.indexrelid=c.oid
    WHERE c.oid=existing AND c.relowner='profitia_access_owner'::regrole
     AND i.indrelid='profitia_access.security_events'::regclass AND i.indisvalid AND i.indisready
     AND NOT i.indisunique AND pg_get_indexdef(c.oid)=candidate.definition) THEN
   RAISE EXCEPTION 'Native audit index source drift; reconciliation required' USING ERRCODE='42501';
  END IF;
 END LOOP;
END $guard$;
CREATE INDEX IF NOT EXISTS native_inspection_transaction_idx
 ON profitia_access.security_events(((event->'requestInspection'->>'transactionId')))
 WHERE phase='INTENT' AND event->'requestInspection'->>'transactionId' IS NOT NULL;
CREATE INDEX IF NOT EXISTS native_continuation_transaction_idx
 ON profitia_access.security_events(((event->'requestContinuation'->>'transactionId')))
 WHERE phase='INTENT' AND event->'requestContinuation'->>'transactionId' IS NOT NULL;
