-- Additive SOAP wire admission over the existing Source engine. No grants,
-- budgets, active policies, credentials, counters or historical SQL are changed.
-- Run only as the accepted controlled owner in an explicitly approved database.
DO $soap$
DECLARE definition text;candidate text;
BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
  RAISE EXCEPTION 'Controlled Source owner required' USING ERRCODE='42501';
 END IF;
 SELECT pg_get_functiondef('profitia_external_native.valid_rules(jsonb)'::regprocedure) INTO definition;
 IF position('''NONE'',''JSON'',''FORM'',''SOAP''' IN definition)>0 THEN RETURN; END IF;
 IF position('''NONE'',''JSON'',''FORM''' IN definition)=0 THEN
  RAISE EXCEPTION 'Native request format policy drift' USING ERRCODE='42501';
 END IF;
 candidate:=replace(definition,'''NONE'',''JSON'',''FORM''','''NONE'',''JSON'',''FORM'',''SOAP''');
 -- Only add one enum value; all path rules, ACLs, ownership and policies survive.
 IF candidate=definition THEN RAISE EXCEPTION 'SOAP policy patch refused'; END IF;
 EXECUTE candidate;
END $soap$;

-- Scheduling state only: this reserves no Source effect and authorizes no HTTP.
-- Source PLAN/ATTEMPT/SETTLE, current role binding and budgets remain mandatory.
CREATE TABLE IF NOT EXISTS profitia_external_native.gus_slots(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 reserved_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS gus_slots_time ON profitia_external_native.gus_slots(reserved_at);
REVOKE ALL ON profitia_external_native.gus_slots FROM PUBLIC;
CREATE OR REPLACE FUNCTION profitia_external_native.reserve_gus_slot() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $gate$
DECLARE d jsonb;at_time timestamptz;wait_until timestamptz;candidate timestamptz;
BEGIN
 d:=profitia_external_native.descriptor('krs.registry.gus','krs-gus:nip-map');
 IF d IS NULL OR d->>'role' IS DISTINCT FROM session_user::text
  OR d->>'applicationId' IS DISTINCT FROM 'krs-registry-source' OR d->>'environment' IS DISTINCT FROM 'development'
  OR d->>'origin' IS DISTINCT FROM 'https://wyszukiwarkaregon.stat.gov.pl'
  OR d->'nativePathRules' IS DISTINCT FROM '[{"method":"POST","path":"/wsBIR/UslugaBIRzewnPubl.svc","requestFormat":"SOAP"}]'::jsonb THEN
  RAISE EXCEPTION 'Current admitted GUS Source binding required' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(1357132359,1200003);
 at_time:=clock_timestamp();wait_until:=at_time;
 DELETE FROM profitia_external_native.gus_slots WHERE reserved_at<=at_time-interval '1 hour';
 SELECT reserved_at+interval '1 second' INTO candidate FROM profitia_external_native.gus_slots
  WHERE reserved_at>at_time-interval '1 second' ORDER BY reserved_at DESC OFFSET 2 LIMIT 1;
 IF candidate IS NOT NULL THEN wait_until:=greatest(wait_until,candidate);END IF;
 SELECT reserved_at+interval '1 minute' INTO candidate FROM profitia_external_native.gus_slots
  WHERE reserved_at>at_time-interval '1 minute' ORDER BY reserved_at DESC OFFSET 119 LIMIT 1;
 IF candidate IS NOT NULL THEN wait_until:=greatest(wait_until,candidate);END IF;
 SELECT reserved_at+interval '1 hour' INTO candidate FROM profitia_external_native.gus_slots
  ORDER BY reserved_at DESC OFFSET 5999 LIMIT 1;
 IF candidate IS NOT NULL THEN wait_until:=greatest(wait_until,candidate);END IF;
 IF wait_until>at_time THEN RETURN ceil(extract(epoch FROM wait_until-at_time)*1000)::integer+1;END IF;
 INSERT INTO profitia_external_native.gus_slots(reserved_at) VALUES(at_time);
 RETURN 0;
END $gate$;
REVOKE ALL ON FUNCTION profitia_external_native.reserve_gus_slot() FROM PUBLIC;
-- Installation deliberately grants nothing. Only the approved existing Source
-- login receives USAGE/EXECUTE during separate exact-SHA pilot admission.
